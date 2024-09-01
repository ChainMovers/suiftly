// Download, unzip, verify and maintain metrics in various directories
// depending of its age and validity.
//
// The file is downloaded from the BunnyCDN logging endpoint like this:
//   https://logging.bunnycdn.com/{mm}-{dd}-{yy}/pull_zone_id.log
//
// This is build using variables as follow:
//   ${PREFIX_URL}{mm}-{dd}-{yy}${SUFFIX_URL}
// and {mm}-{dd}-{yy} is a target date.
//
// If ACCESS_KEY is defined, add an Access-Key header to the request.
//
// Requests have the header `Accept-Encoding: gzip`.
//
// The downloaded file is stored in DOWNLOAD_DIR with as `{yy}-{mm}-{dd}.gz`.
//
// (1) Move .gz files older than 37 days from DOWNLOAD_DIR to ARCHIVE_DIR.
//
// (2) Check in DOWNLOAD_DIR for any file missing in last 30 days.
//
// (3) Attempt to download the missing files. Log but ignore failures (move to next step).
//     Do not try to download files older than August 29th, 2024.
//
// (4) For every .gz files in DOWNLOAD_DIR, check if there is a corresponding .log file in RECENT_DIR
//
//     if not then try to unzip it in UNZIP_DIR, as a {yy}-{mm}-{dd}.log file. Log but
//     ignore failures (move to next step). A failure is an empty directory.
//
// (5) Check for any .log file of size > 0 in UNZIP_DIR. Move them to RECENT_DIR.
//
// (6) Delete any file in UNZIP_DIR that is older than 40 days.
//
// (7) Delete any file in RECENT_DIR that is older than 40 days.

import { Semaphore } from 'async-mutex';
import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as cron from 'node-cron';
import path from 'path';
import * as readline from 'readline';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import zlib from 'zlib';

const EXPIRATION_RECENT_DIR = 40 * 24 * 60 * 60 * 1000; // 40 days in milliseconds
const EXPIRATION_UNZIP_DIR = 40 * 24 * 60 * 60 * 1000;
const EXPIRATION_DOWNLOAD_DIR = 37 * 24 * 60 * 60 * 1000; // 37 days in milliseconds

const readdir = promisify(fs.readdir);

// Load more .env specific to this app (and interpolate $HOME)
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || '';
dotenv.config({ path: path.join(HOME_DIR, 'suiftly-ops', 'dotenv', '.env.metrics') });

for (const key in process.env) {
    if (process.env[key]?.startsWith('$HOME')) {
        process.env[key] = process.env[key]?.replace('$HOME', HOME_DIR);
    }
}

// Type guard on string to supported Route conversion.
const ROUTES = ['blob', 'icon48x48', 'icon96x96', 'icon256x256', 'meta', 'metrics', 'view'] as const;
type Route = (typeof ROUTES)[number];
const isValidRoute = (route: string): route is Route => {
    return ROUTES.includes(route as Route);
};

// Defines how metrics are stored in-memory and on disk (JSON).
interface RouteDayMetrics {
    hits: number;
    hitsEdge: number;
    visitors: number;
    visitors_set?: Set<string>;
}

interface DailyMetrics {
    [date: string]: Partial<Record<Route, RouteDayMetrics>>;
}

interface Metrics {
    blobId: string;
    daily: DailyMetrics;
    sizes: Partial<Record<Route, number>>;
}

// In-memory map only for while parsing a log file.
interface MetricsMap {
    [blobId: string]: Metrics;
}

// All metrics (up to one year) are kept in local file system.
//
// The data flows are:
//   DOWNLOAD_DIR -(unzip)-> UNZIP_DIR -(validated)-> RECENT_DIR
//   DOWNLOAD_DIR -(present in RECENT_DIR)-> ARCHIVE_DIR
const CDN_METRICS_DIR = process.env.CDN_METRICS_DIR || `${HOME_DIR}/cdn-metrics`;

// Last 30 days downloaded files (compressed)
const DOWNLOAD_DIR = process.env.CDN_METRICS_DOWNLOAD_DIR || `${CDN_METRICS_DIR}/download`;

// Intermediate directory to validate the unzip of a given day.
const UNZIP_DIR = process.env.CDN_METRICS_UNZIP_DIR || `${CDN_METRICS_DIR}/unzipped`;

// Last 30 days validated unzipped logs.
const RECENT_DIR = process.env.CDN_METRICS_RECENT_DIR || `${CDN_METRICS_DIR}/recent`;

// Last one year zipper logs.
const ARCHIVE_DIR = process.env.CDN_METRICS_ARCHIVE_DIR || `${CDN_METRICS_DIR}/archive`;

// URL fragments used to download daily metrics.
const PREFIX_URL = process.env.CDN_METRICS_PREFIX_URL || '';
const SUFFIX_URL = process.env.CDN_METRICS_SUFFIX_URL || '';

// Optional access key to logging API endpoint.
const ACCESS_KEY = process.env.CDN_METRICS_ACCESS_KEY;

// Control that only one cron job runs at the time.
const isTaskRunningSemaphore = new Semaphore(1);

// Cron job should be cancelled when returning false.
function prepareSetup(): boolean {
    // Ensure directories exists
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }
    if (!fs.existsSync(UNZIP_DIR)) {
        fs.mkdirSync(UNZIP_DIR, { recursive: true });
    }
    if (!fs.existsSync(RECENT_DIR)) {
        fs.mkdirSync(RECENT_DIR, { recursive: true });
    }
    if (!fs.existsSync(ARCHIVE_DIR)) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    // Validate the env variables.
    if (!PREFIX_URL) {
        console.error('Missing environment variables: CDN_METRICS_PREFIX_URL');
        return false;
    }

    if (!SUFFIX_URL) {
        console.error('Missing environment variables: CDN_METRICS_SUFFIX_URL');
        return false;
    }

    if (!CDN_METRICS_DIR) {
        console.error('Missing environment variables: CDN_METRICS_DIR');
        return false;
    }

    return true;
}

function extractDateFromFilename(filename: string): Date | null {
    try {
        const match = filename.match(/^(\d{2})-(\d{2})-(\d{2})/);
        if (!match) {
            console.error('Invalid date pattern for file:', filename);
            return null;
        }
        const [_, yy, mm, dd] = match;

        if (!yy || !mm || !dd) {
            console.error('Invalid date parts for file:', filename);
            return null;
        }

        // Convert to integers
        const year = parseInt(`20${yy}`, 10);
        const month = parseInt(mm, 10) - 1; // JavaScript months are 0-based
        const day = parseInt(dd, 10);

        // Validate date parts
        if (year < 2024 || year > 2099) {
            console.error('Invalid year for file: ', year, filename);
            return null; // Assuming valid years are between 2000 and 2099
        }
        if (month < 0 || month > 11) {
            console.error('Invalid month for file: ', month, filename);
            return null;
        }

        if (day < 1 || day > 31) {
            console.error('Invalid day for file: ', day, filename);
            return null;
        }
        const date = new Date(year, month, day);

        if (!date) {
            console.log('Invalid date:', year, month, day, filename);
            return null;
        }
        return date;
    } catch (error) {
        console.error('Error extracting date from filename:', error, filename);
        return null;
    }
}

function convertDateToFilename(date: Date): string {
    // Note: Not strictly inverse of extractDateFromFilename because
    //       this function does not append an extension to the string.
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function convertDateToURLFragment(date: Date): string {
    // Note: Filesystem uses sortable date format {yy}-{mm}-{dd}
    //       while URL uses {mm}-{dd}-{yy}
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}-${year}`;
}

async function archiveOldDownloadFiles() {
    const files = await readdir(DOWNLOAD_DIR);
    const now = Date.now();
    const cutoff = now - EXPIRATION_DOWNLOAD_DIR;

    for (const file of files) {
        if (file.endsWith('.gz')) {
            const fileDate = extractDateFromFilename(file);
            if (fileDate) {
                if (fileDate.getTime() < cutoff) {
                    const filePath = path.join(DOWNLOAD_DIR, file);
                    const archivePath = path.join(ARCHIVE_DIR, file);
                    fs.renameSync(filePath, archivePath);
                    console.log(`Moved file to archive: ${file}`);
                }
            }
        }
    }
}

async function downloadMissingFiles(missingDates: Date[]) {
    // Do not download files older than August 29th, 2024
    const cutoffDate = new Date(2024, 7, 29); // Note: month zero base

    for (const date of missingDates) {
        if (date < cutoffDate) {
            continue;
        }
        // Build the URL
        try {
            const dateURLFragment = convertDateToURLFragment(date);
            if (!dateURLFragment) {
                console.error(`Invalid URL fragment date:${date}`);
                continue;
            }
            const url = `${PREFIX_URL}${dateURLFragment}${SUFFIX_URL}`;
            const outputFilename = convertDateToFilename(date);
            const outputPath = path.join(DOWNLOAD_DIR, `${outputFilename}.gz`);

            await downloadFile(url, outputPath);
        } catch (error) {
            console.error(`Failed to download date:${date} error:${error}`);
        }
    }
}

async function unzipFiles() {
    // Process every {yy}-{mm}-{dd).gz files that are in DOWNLOAD_DIR but
    // does not have a corresponding directory {yy}-{mm}-{dd} in RECENT_DIR
    const files = await readdir(DOWNLOAD_DIR);
    for (const file of files) {
        if (!file.endsWith('.gz')) continue;

        const dateString = file.replace('.gz', '');
        const recentDir = path.join(RECENT_DIR, dateString);
        if (fs.existsSync(recentDir)) {
            // Already processed
            continue;
        }
        // Unzip the file in UNZIP_DIR. If successful, then move it
        // to RECENT_DIR.
        try {
            await gunzipFile(path.join(DOWNLOAD_DIR, file), UNZIP_DIR);
            const expectedOutputFile = path.join(UNZIP_DIR, dateString);
            // Verify the expected output file is not of size 0
            const stats = fs.statSync(expectedOutputFile);
            if (stats.size === 0) {
                console.error(`Empty file: ${expectedOutputFile}`);
                fs.unlinkSync(expectedOutputFile);
                continue;
            }
            // Move the expectedOutputFile in RECENT_DIR
            fs.renameSync(expectedOutputFile, path.join(RECENT_DIR, dateString));
        } catch (error) {
            console.error(`Failed to unzip file for ${dateString}:`, error);
        }
    }
}

async function deleteOldFiles(dir: string, expiration: number) {
    const files = await readdir(dir);
    const now = Date.now();
    const cutoff = now - expiration;

    for (const file of files) {
        // Check if the file is older than the expiration date
        // by extracting a Date from the file name
        const date = extractDateFromFilename(file);
        if (!date) {
            console.error('Invalid date:', file);
            continue;
        }
        if (date.getTime() < cutoff) {
            const filePath = path.join(dir, file);
            fs.unlinkSync(filePath);
        }
    }
}

function getDownloadDirMissingDates() {
    const now = new Date();
    const missingDates = [];
    for (let i = 1; i <= 30; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const filedate = convertDateToFilename(date);
        const filePath = path.join(DOWNLOAD_DIR, `${filedate}.gz`);
        if (!fs.existsSync(filePath)) {
            missingDates.push(date);
        }
    }
    return missingDates;
}

// Function to download the file
async function downloadFile(url: string, outputPath: string) {
    // Note: Using axios to stream the unmodified gzip response.
    //       fetch (or http) can't do that because they
    //       automatically decompress the response.
    try {
        const headers: Record<string, string> = {};
        headers['User-Agent'] = 'curl/8.2.1';
        headers['Accept'] = '*/*';
        headers['Accept-Encoding'] = 'gzip';

        if (ACCESS_KEY) {
            headers['AccessKey'] = ACCESS_KEY;
        }

        console.log('Downloading:', url, outputPath);
        const response = await axios({
            decompress: false,
            headers: headers,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000,
            url: url,
        });

        console.log('Response Headers:', response.headers);
        console.log('Response Status:', response.status);

        // Do nothing if the length in the response header is 0
        // This is normal if there is no stats yet for the day.
        if (response.headers['content-length'] === '0') {
            return;
        }
        const fileStream = fs.createWriteStream(outputPath);
        await pipeline(response.data, fileStream)
            .then(() => console.log('Download complete'))
            .catch(error => {
                console.error('Error downloading file:', error, url, outputPath);
                throw error;
            });
    } catch (error) {
        console.error('Error downloading file:', error, url, outputPath);
        throw error;
    }
}

async function gunzipFile(gzPathname: string, outputDir: string): Promise<void> {
    // Decompress gzPathname into outputDir.
    const outputPathname = path.join(outputDir, path.basename(gzPathname, '.gz'));
    if (fs.existsSync(outputPathname)) {
        // Delete existing file.
        fs.unlinkSync(outputPathname);
    }

    const input = fs.createReadStream(gzPathname);
    const gunzip = zlib.createGunzip();
    const output = fs.createWriteStream(outputPathname);

    try {
        await pipeline(input, gunzip, output);
        console.log(`${outputPathname} decompressed`);
    } catch (err) {
        console.error(`A decompression error occurred with ${gzPathname} ${err}`);
        if (fs.existsSync(outputPathname)) {
            fs.unlinkSync(outputPathname);
        }
        throw err;
    }
}

// The content of the files in RECENT_DIR are parsed one by one.
// Once they are processed, the file is renamed with a ".done" extension.
//
// Files with a ".done" extension are ignored.
//
// Each line of the file are parsed and result into updating
// one file in $HOME/cache/prefix1/prefix2/{blobId}.metrics
//
// Where:
//   blobId is extracted from the line
//   prefix1 is the first 2 characters of the blobId
//   prefix2 is the next 2 characters of the blobId
//
// The .metrics file is a JSON file with the following format:
// {
//   "blobId": "qjwu732...",
//   "sizes": {
//     "blob": 123456,
//     "meta": 123456,
//   },
//   "daily": {
//     "2024-02-03": {
//       "blob": {
//         "hits": 123,
//         "visitors": 2,
//         "hitsEdge": 0,
//       },
//       "meta": {
//         "hits": 123,
//         "visitors": 2,
//         "hitsEdge": 0,
//       },
//       ...
//     }
//   }
// }
//
// A file in RECENT_DIR represent all activities for the date indicated in the filename.
// Each line is for one potential "hit" related to a single blob.
//
// The RECENT_DIR file has the following format:
//   <cache-status>|<status-code>|<timestamp>|<bytes-sent>|<pull-zone-id>|<remote-ip>|<referer-url>|<url>|<edge-location>|<user-agent>|<unique-request-id>|<country-code>
//
// Example:
//   HIT|200|1507167062421|412|390|163.172.53.229|-|https://cdn.suiftly.io/blob/fkwu278s6sdhwejn2376asdhu23asdas|WA|Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.146 Safari/537.36|322b688bd63fb63f2babe9de30a5d262|DE
//
// The URL is parse to extract the blobID. The URL pattern must match one of:
//    https://cdn.suiftly.io/blob/{blobId}
//    https://cdn.suiftly.io/meta/{blobId}
//    https://cdn.suiftly.io/view/{blobId}
//    https://cdn.suiftly.io/metrics/{blobId}
//    https://cdn.suiftly.io/icon256x256/{blobId}
//
// If one of these pattern do not match, than the line is ignored.
//
// Sums are accumulated for each distinct blobID and route (e.g. "blob","meta", "view"...)
//    hits: when <status-code> is 200
//    visitors: Count of distinct <remote-ip>
//    cdn-hits: When <cache-status> is HIT
//
// The "networkSizes" are the largest <bytes-sent> for each distinct route.
//
// Once a daily file from RECENT_DIR is parsed and all stats are accumulated, the .metric file
// is UPDATED with the new stats. If the file does not exist, it is created.
//
// The update is atomic (create a .metric.tmp file and rename it to .metric).
async function updateMetrics() {
    try {
        const files = await fs.promises.readdir(RECENT_DIR);

        for (const file of files) {
            if (file.endsWith('.done')) continue;

            const date = extractDateFromFilename(file);
            if (!date) {
                console.error('Invalid date:', file);
                continue;
            }

            // Process the file as a stream because it can be large.
            const filePath = path.join(RECENT_DIR, file);
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                crlfDelay: Infinity,
                input: fileStream,
            });

            const metricsMap: MetricsMap = {};
            for await (const line of rl) {
                if (!line.trim()) continue; // Skip empty lines

                const parts = line.split('|');
                if (parts.length < 12) continue; // Ensure there are enough parts

                const statusCode = parts[1] || '';
                if (statusCode !== '200') continue; // Skip lines with non-200 status code

                const url = parts[7] || '';
                const urlPattern = /https:\/\/cdn\.suiftly\.io\/(blob|meta|view|metrics|icon-256x256)\/([^/]+)/;
                const match = url.match(urlPattern);

                if (!match) continue; // Skip lines that do not match the pattern

                const route = match[1] || '';
                const blobId = match[2] || '';
                if (!route || !blobId) continue; // Skip lines with missing URL fragments

                // Convert route string to Route type.
                if (!isValidRoute(route)) {
                    console.error('Invalid route:', route);
                    continue; // Skip lines with non-supported route
                }
                const routeType = route as Route;

                // TODO Sanity check the blobId.

                // Parse and validate remaining metrics.
                const cacheStatus = parts[0] || '';
                const bytesSent = parseInt(parts[3] || '0', 10);
                const remoteIp = parts[5] || '';
                if (!cacheStatus) {
                    console.error('Missing cache status:', line);
                    continue;
                }
                if (!remoteIp) {
                    console.error('Missing remote IP:', line);
                    continue;
                }

                // Add to in-memory map if not already present.
                // Initialize references to avoid multiple lookups
                const blobMetrics =
                    metricsMap[blobId] ||
                    (metricsMap[blobId] = {
                        blobId: blobId,
                        daily: {},
                        sizes: {},
                    });

                const iso_date = date.toISOString().slice(0, 10);
                const dayMetrics = blobMetrics.daily[iso_date] || (blobMetrics.daily[iso_date] = {});

                // As needed add an object element to dayMetrics depending of the route.
                // Also, use a visitors_map to track unique visitors. This will not be saved
                // in the .metrics file.
                const routeMetrics =
                    dayMetrics[routeType] ||
                    (dayMetrics[routeType] = {
                        hits: 0,
                        hitsEdge: 0,
                        visitors: 0,
                        visitors_set: undefined,
                    });

                routeMetrics.hits += 1;

                if (cacheStatus === 'HIT') {
                    routeMetrics.hitsEdge += 1;
                }

                // Track unique visitors based on remoteIp
                if (!routeMetrics.visitors_set) {
                    console.log('First visitor:', remoteIp);
                    routeMetrics.visitors_set = new Set<string>([remoteIp]);
                    routeMetrics.visitors = 1;
                } else if (!routeMetrics.visitors_set.has(remoteIp)) {
                    console.log('New visitor:', remoteIp);
                    routeMetrics.visitors_set.add(remoteIp);
                    routeMetrics.visitors += 1;
                }

                // Check that the networkSizes are updated with the largest value.
                const networkSize = blobMetrics.sizes[routeType] || 0;
                if (bytesSent > networkSize) {
                    blobMetrics.sizes[routeType] = bytesSent;
                }
            } // End of lines processing

            // Iterate the metricsMap and write the metrics to disk.
            // The inner daily objects must be merged with the
            // existing daily objects in the file.
            //
            // The networkSizes must be updated with the largest between
            // what is in the file and what is in the metricsMap.
            for (const blobId in metricsMap) {
                const blobMetrics = metricsMap[blobId];
                if (!blobMetrics) {
                    // Should never happen, but keep typescript happy.
                    console.error('Unexpected blobMetrics missing:', blobId);
                    continue;
                }
                // Sanity checks that the expected fields are present.
                if (!blobMetrics.sizes) {
                    console.error('No sizes metrics object for blob:', blobId);
                    continue;
                }
                if (!blobMetrics.daily) {
                    console.error('No daily metrics object for blob:', blobId);
                    continue;
                }
                if (!blobMetrics.blobId) {
                    console.error('No blobId field for blob:', blobId);
                    continue;
                }

                // Remove elements in sizes that are zero.
                // At least one element should exists.
                for (const route in blobMetrics.sizes) {
                    if (blobMetrics.sizes[route as Route] === 0) {
                        delete blobMetrics.sizes[route as Route];
                    }
                }
                if (Object.keys(blobMetrics.sizes).length === 0) {
                    console.error('No sizes metrics route for blob:', blobId);
                    continue;
                }

                const prefix1 = blobId.slice(0, 2);
                const prefix2 = blobId.slice(2, 4);
                const metricsDir = path.join(HOME_DIR, 'cache', prefix1, prefix2);
                const metricsFilePath = path.join(metricsDir, `${blobId}.metrics`);
                let fileMetrics: Metrics | undefined = undefined;
                if (!fs.existsSync(metricsDir)) {
                    // That should never happen, but just in case...
                    fs.mkdirSync(metricsDir, { recursive: true });
                } else {
                    // Load the existing .metrics file if it exists.
                    // If anything goes wrong, just log and move on to
                    // the next blobId.
                    try {
                        if (fs.existsSync(metricsFilePath)) {
                            const content = fs.readFileSync(metricsFilePath, 'utf8');
                            fileMetrics = JSON.parse(content);
                            if (!fileMetrics) {
                                console.error('Invalid JSON content:', metricsFilePath);
                                continue;
                            }
                            // Sanity check that fileMetrics.blobId is the same as blobMetrics.blobId
                            // Initialize fileMetrics.blobId if it does not exist.
                            if (fileMetrics.blobId !== blobMetrics.blobId) {
                                console.error('BlobId mismatch:', fileMetrics.blobId, blobMetrics.blobId);
                                continue;
                            }
                        }
                    } catch (error) {
                        console.error('Error loading metrics file:', error);
                        continue;
                    }
                }

                // If the fileMetrics does not exist, then create one.
                if (!fileMetrics) {
                    fileMetrics = {
                        blobId: blobMetrics.blobId,
                        daily: {},
                        sizes: {},
                    };
                }

                // merge blobMetrics into fileMetrics.

                // Update fileMetrics.sizes with potential larger values from blobMetrics.size
                // Initialize fileMetrics.sizes if it does not exist.
                if (!fileMetrics.sizes) {
                    fileMetrics.sizes = blobMetrics.sizes;
                } else {
                    for (const [route, size] of Object.entries(blobMetrics.sizes)) {
                        const routeType = route as Route;
                        if (size > 0 && size > (fileMetrics.sizes[routeType] || 0)) {
                            fileMetrics.sizes[routeType] = size;
                        }
                    }
                }

                // Remove all visitors_set from blobMetrics.daily
                // because they are not saved in the .metrics file.
                for (const day in blobMetrics.daily) {
                    if (Object.prototype.hasOwnProperty.call(blobMetrics.daily, day)) {
                        const dayMetrics = blobMetrics.daily[day];
                        for (const route in dayMetrics) {
                            if (Object.prototype.hasOwnProperty.call(dayMetrics, route)) {
                                const routeMetrics = dayMetrics[route as Route];
                                if (routeMetrics) {
                                    delete routeMetrics.visitors_set;
                                }
                            }
                        }
                    }
                }
                // Update fileMetrics.daily with blobMetrics.daily
                // Initialize fileMetrics.daily if it does not exist.
                // When it exists, the update is a merge of the members (the days).
                // If a day already exists in fileMetrics.daily, then it is overwritten.
                if (!fileMetrics.daily) {
                    fileMetrics.daily = blobMetrics.daily;
                } else {
                    for (const [day, dayMetrics] of Object.entries(blobMetrics.daily)) {
                        let fileMetricsDay = fileMetrics.daily[day];
                        if (!fileMetricsDay) {
                            fileMetricsDay = {};
                            fileMetrics.daily[day] = fileMetricsDay;
                        }
                        for (const route in dayMetrics) {
                            const routeType = route as Route;
                            fileMetricsDay[routeType] = dayMetrics[routeType];
                        }
                    }
                }

                // Write into a temporary file and rename it to the final file.
                const metricsFilePathTmp = `${metricsFilePath}.tmp`;
                await fs.promises.writeFile(metricsFilePathTmp, JSON.stringify(fileMetrics, null, 2));
                await fs.promises.rename(metricsFilePathTmp, metricsFilePath);
            } // end for(blobId)
            const doneFilePath = `${filePath}.done`;
            await fs.promises.rename(filePath, doneFilePath);
            console.log(`${filePath} metrics updated`);
        } // end for(file)
    } catch (err) {
        console.error('Error updating metrics:', err);
    }
}

// Main function to maintain metric download and storage.
async function main(): Promise<void> {
    const [_, release] = await isTaskRunningSemaphore.acquire();

    try {
        if (!prepareSetup()) {
            console.error('Setup failed. Cron job iteration canceled.');
            return;
        }
        await archiveOldDownloadFiles();
        await deleteOldFiles(UNZIP_DIR, EXPIRATION_UNZIP_DIR);
        await deleteOldFiles(RECENT_DIR, EXPIRATION_RECENT_DIR);
        const missingDates = getDownloadDirMissingDates();
        await downloadMissingFiles(missingDates);
        await unzipFiles();
        await updateMetrics();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        release();
    }
}

// Schedule the task to run periodically (e.g., every hour)
cron.schedule('*/30 * * * *', () => {
    console.log('Running scheduled task...');
    main();
});

// Run the main function immediately
main();
