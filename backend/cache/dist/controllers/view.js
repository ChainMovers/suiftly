import { format, subDays } from 'date-fns';
import path from 'path';
import { isValidBlobId } from '../common/blob.js';
import { isValidMetricsType, loadMetricsFile } from '../common/cdn-metrics.js';
import { getIdPrefixes } from '../common/strings.js';
// Test Blob Info
//
// MIME type: image/png
//
// Blob ID: 0nzvRVLeF0I5kbWO3s_VDa-ixYZ_nhkp4J2EubJUtjo
// Unencoded size: 165 KiB
// Encoded size (including metadata): 62.0 MiB
// Sui object ID: 0x0ebad3b13ee9bc64f8d6370e71d3408a43febaa017a309d2367117afe144ae8c
// Cache-Control value initialized once
//const viewCacheControl = process.env.VIEW_CACHE_CONTROL || 'public, max-age=10';
export const getView = async (req, res) => {
    const { id = '' } = req.params;
    // Request validation
    try {
        await isValidBlobId(id);
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).send(error.message);
        }
        else {
            res.status(400).send('Unknown error');
        }
    }
    const { prefix_1, prefix_2 } = getIdPrefixes(id);
    if (!prefix_1 || !prefix_2) {
        // Should never happen because id was validated.
        return res.status(500).send('Internal Server Error (prefix)');
    }
    // Generate a self-sufficient single-HTML page that display
    // a thumbnail 96x96 of the blob ~/cache/prefix1/prefix2/<id>.blob
    // and metrics from ~/cache/prefix1/prefix2/<id>.metrics
    //
    // If the .blob does not exists, show an empty placeholder for now.
    //
    // If the .metrics do not exists, just display "No Metrics available yet".
    //
    // To know if the .blob is an image, parse the MIME type from the .json.
    // (See blob.ts for the encoding).
    //
    // The page will have the Blob ID at the top (as the title).
    // Below the title, the thumbnail of the blob.
    //
    // Metrics will have 3 charts:
    //  (1) Daily hits count (last 30 days)
    //  (2) Daily unique visitors count (last 30 days)
    //  (3) Daily CDN Hits Precentage (last 30 days)
    //
    // All charts are date(daily) x-axis
    //   - Always display 30 days.
    //   - For missing days in .metrics, use a placeholder value
    //     (0 for counts, 100% for percentage)
    //   - Each chart should have a title.
    //
    // The time the page was generated should be shown at the bottom.
    // (use UTC time format).
    //
    // The format of .metrics is JSON. Example:
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
    // All data is coming from the daily.{data}.blob object.
    //
    // The CDN Hits Percentage is calculated as: (hitsEdge / hits * 100) and is 0% when hits is 0
    // when stats are not present for a given day.
    //
    const homePath = process.env.HOME || '';
    const metricsPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.metrics`);
    //const jsonPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.json`);
    //const blobPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.blob`);
    try {
        // Read the metrics file. Can fail but won't throw an error.
        const metrics = await loadMetricsFile(metricsPath, { verbose: false });
        const isValidMetrics = isValidMetricsType(metrics, { verbose: false });
        if (!isValidMetrics) {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${id}</title>
            </head>
            <body>
                <h3>No Metrics data available yet for blob [ ${id} ].</h3>
                <text>May take up to 24 hours for next update.</text>
            </body>
            </html>
        `;
            // Send the HTML response
            res.send(html);
            return;
        }
        const today = new Date();
        const last30Days = Array.from({ length: 30 }, (_, i) => format(subDays(today, i + 1), 'yyyy-MM-dd')).reverse();
        // Calculate CDN Hits Percentage
        const blobHits = [];
        const blobVisitors = [];
        const blobCdnHitsPercentage = [];
        last30Days.forEach(date => {
            // If the date is not in the metrics, use a placeholder
            const dayMetrics = (isValidMetrics && metrics.daily[date]?.blob) || { hits: 0, hitsEdge: 0, visitors: 0 };
            blobHits.push(dayMetrics.hits);
            blobVisitors.push(dayMetrics.visitors);
            const cdnHitsPercentage = dayMetrics.hits === 0 ? 0 : (dayMetrics.hitsEdge / dayMetrics.hits) * 100;
            blobCdnHitsPercentage.push(cdnHitsPercentage);
        });
        // Remove the leading yyyy- in each element of last30Days
        last30Days.forEach((date, i) => {
            last30Days[i] = date.slice(5);
        });
        // Generate HTML with Charts
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${id}</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <style>
                    .chart-container {
                        width: 400px;
                        height: 200px;
                        margin: 0px auto; /* Center the heading */
                    }
                    h2 {
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <h2>Dashboard for ${id}</h2>
                <div class="chart-container">
                  <canvas id="hitsChart"></canvas>
                </div>
                <div class="chart-container">
                  <canvas id="visitorsChart"></canvas>
                </div>
                <div class="chart-container">
                  <canvas id="cdnHitsPercentageChart"></canvas>
                </div>
                <script>
                    const dates = ${JSON.stringify(last30Days)};
                    const blobHits = ${JSON.stringify(blobHits)};
                    const blobVisitors = ${JSON.stringify(blobVisitors)};
                    const blobCdnHitsPercentage = ${JSON.stringify(blobCdnHitsPercentage)};

                    const hitsCtx = document.getElementById('hitsChart').getContext('2d');
                    new Chart(hitsCtx, {
                        type: 'line',
                        data: {
                            labels: dates,
                            datasets: [{
                                label: 'Hits',
                                data: blobHits,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }
                    });

                    const visitorsCtx = document.getElementById('visitorsChart').getContext('2d');
                    new Chart(visitorsCtx, {
                        type: 'line',
                        data: {
                            labels: dates,
                            datasets: [{
                                label: 'Unique Visitors',
                                data: blobVisitors,
                                borderColor: 'rgba(153, 102, 255, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }
                    });

                    const cdnHitsPercentageCtx = document.getElementById('cdnHitsPercentageChart').getContext('2d');
                    new Chart(cdnHitsPercentageCtx, {
                        type: 'bar',
                        data: {
                            labels: dates,
                            datasets: [{
                                label: 'CDN Cache Hits (%)',
                                data: blobCdnHitsPercentage,
                                borderColor: 'rgba(255, 159, 64, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
        // Send the HTML response
        res.send(html);
    }
    catch (error) {
        console.error('Error reading metrics:', error);
        res.status(500).send('Internal Server Error');
    }
};
