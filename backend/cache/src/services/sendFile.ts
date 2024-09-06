import { spawn } from 'child_process';
import { Request, Response } from 'express';
import * as fs from 'fs';
import path from 'path';

import { isValidBlobId } from '../common/blob';
import { getIdPrefixes } from '../common/strings';

const BLOB_SIZE_LIMIT = 209715200;

// Test Blob Info
//
// MIME type: image/png
//
// Blob ID: 0nzvRVLeF0I5kbWO3s_VDa-ixYZ_nhkp4J2EubJUtjo
// Unencoded size: 165 KiB
// Encoded size (including metadata): 62.0 MiB
// Sui object ID: 0x0ebad3b13ee9bc64f8d6370e71d3408a43febaa017a309d2367117afe144ae8c

// Cache-Control value initialized once
const blobCacheControl = process.env.BLOB_CACHE_CONTROL || 'public, max-age=10';
const metaCacheControl = process.env.META_CACHE_CONTROL || 'public, max-age=10';
const metricsCacheControl = process.env.METRICS_CACHE_CONTROL || 'public, max-age=10';
const iconsCacheControl = process.env.ICONS_CACHE_CONTROL || 'public, max-age=10';

interface SendFileOptions {
    headers: {
        'Cache-Control': string;
        'Content-Type': string;
    };
}

// ext can be one of ".blob", ".meta", ".json", ".metrics", ".48x48", ".96x96", ".256x256"
export type FileExtension = '48x48' | '96x96' | '256x256' | 'blob' | 'json' | 'metrics';
export async function sendFile(req: Request, res: Response, ext: FileExtension): Promise<void> {
    const { id = '' } = req.params;

    // Request validation
    try {
        await isValidBlobId(id);
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).send(error.message);
            return;
        } else {
            res.status(400).send('Invalid request (1)');
            return;
        }
    }

    const { prefix_1, prefix_2 } = getIdPrefixes(id);
    if (!prefix_1 || !prefix_2) {
        // Should never happen because id was validated.
        res.status(500).send('Internal Server Error (prefix)');
        return;
    }

    const homePath = process.env.HOME || '';

    // Response options.
    let isBlobRequest = false;
    let isIconRequest = false;
    let options: SendFileOptions | undefined = undefined;
    switch (ext) {
        case '48x48':
        case '96x96':
        case '256x256':
            options = {
                headers: {
                    'Cache-Control': iconsCacheControl,
                    'Content-Type': 'image/jpeg; charset=binary',
                },
            };
            isIconRequest = true;
            break;
        case 'json':
            options = {
                headers: {
                    'Cache-Control': metaCacheControl,
                    'Content-Type': 'application/json; charset=us-ascii',
                },
            };
            break;
        case 'metrics':
            options = {
                headers: {
                    'Cache-Control': metricsCacheControl,
                    'Content-Type': 'application/json; charset=us-ascii',
                },
            };
            break;
        case 'blob':
            // Will be initalized later after reading the meta file.
            isBlobRequest = true;
            break;
        default:
            res.status(500).send(`Internal error. Invalid file extension ${ext}`);
            return;
    }

    // If an auxiliary file already exists, just send it.
    // Auxiliary files are anything except ".blob".
    //
    // .blob is the main file on which all auxiliary files
    // are based from.
    //
    // If the aux file does not exists, then it will next be
    // tentatively created with a "load-blob <id>" shell call.
    //
    let auxFilePath: string | undefined = undefined;
    let auxFileExists = false;

    if (!isBlobRequest) {
        // Check if the aux file already exists.
        try {
            auxFilePath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.${ext}`);
            await fs.promises.access(auxFilePath, fs.constants.F_OK);
            auxFileExists = true;
        } catch (error) {
            // File does not exist. Keep going to try to generate it and try again later.
        }
    }

    if (ext === 'metrics' && !auxFileExists) {
        // Metrics may normally not exists.
        res.json({
            blobId: id,
            message: 'No metrics accumulated yet for this blob. Metrics updated every ~24 hours.',
            status: 'no_metrics',
        });
        return;
    }

    if (!isBlobRequest && auxFilePath && auxFileExists && options) {
        // The requested aux file exists, so just respond with it.
        try {
            return res.sendFile(auxFilePath, options, error => {
                if (error) {
                    return res.status(500).send(`Error streaming (1) ${ext}`);
                }
            });
        } catch (error) {
            // This unlikely to happen because file access already verified.
            console.error('Unexpected error:', error);
            res.status(500).send(`Error streaming blob(2) ${ext}`);
            return;
        }
    }

    // Get the .json to get the MIME type and size.
    //
    // This has multiple purpose:
    //   - Get MIME type needed when .blob is requested.
    //   - Get blob size to detect early if too big.
    //   - Decide if the blob need to be downloaded.
    //
    // If the .json or aux file does not exists, then do an async shell
    // call to "load-blob <id>".
    let mime_parsed: string | undefined = undefined;
    let blob_size_parsed: number | undefined = undefined;
    let attempts = 0;
    const ATTEMPTS_LIMIT = 3;

    const jsonPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.json`);

    while (!mime_parsed && (isBlobRequest || !auxFileExists) && attempts < ATTEMPTS_LIMIT) {
        // First, make sure the .json file is parsed.
        if (!mime_parsed) {
            try {
                await fs.promises.access(jsonPath, fs.constants.F_OK);

                // Read the meta JSON file and extract the MIME type
                const meta = await fs.promises.readFile(jsonPath, 'utf8');

                try {
                    const parsedMeta = JSON.parse(meta);
                    mime_parsed = parsedMeta.mime;
                    blob_size_parsed = parsedMeta.size;
                } catch (parseError) {
                    console.error(`Error meta parsing: ${parseError} id: ${id}`);
                    res.status(500).send('Internal Server Error (meta parsing)');
                    return;
                }

                if (blob_size_parsed) {
                    if (blob_size_parsed > BLOB_SIZE_LIMIT) {
                        console.error(`Error: Blob size exceeds limit ${blob_size_parsed} > ${BLOB_SIZE_LIMIT}`);
                        res.status(404).send(
                            `Blob size ${blob_size_parsed} not supported by Suiftly (${BLOB_SIZE_LIMIT} limit)`,
                        );
                        return;
                    }
                }
            } catch (error) {
                let return_server_error = true;
                if (error instanceof Error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                        return_server_error = false;
                    }
                }
                if (return_server_error) {
                    console.error('Error accessing or reading meta file:', error);
                    res.status(500).send('Internal Server Error (cache access)');
                    return;
                }
            }
        }

        // Decide if load-blob call is needed.
        if (!mime_parsed || (mime_parsed && !auxFileExists)) {
            try {
                // Do an async shell call to "load-blob <id>".
                // Note: load-blob handles safe concurrent loading (at blob granularity).
                //
                // Status code are:
                // #   0: Success
                // #   1: Does not exists on Walrus
                // #   2: Does not exists on Suiftly
                // #   3: Unsupported MIME type
                // #   4: Unsupported Blob Size
                // #   5: Invalid ID
                // #   32: Unknown error
                //
                // In all error cases, the web client should fallback to Walrus directly.
                let status_code = 255;
                let starting_shell_process_failed = false;

                const loadBlob = path.resolve(homePath, 'suiftly-ops/scripts/load-blob');
                const loadBlobProcess = spawn(loadBlob, [id]);

                await new Promise<void>(resolve => {
                    loadBlobProcess.once('close', code => {
                        if (code !== null) {
                            status_code = code;
                        }
                        resolve();
                    });

                    loadBlobProcess.once('error', err => {
                        console.error('Failed to start load-blob process:', err);
                        starting_shell_process_failed = true;
                        resolve();
                    });
                });

                // Fail the request only on error while the last load-blob attempt.
                if (attempts >= ATTEMPTS_LIMIT - 1) {
                    if (status_code === 0) {
                        // Success.
                    } else {
                        if (status_code === 1) {
                            res.status(404).send('Blob is not stored on Walrus');
                        } else if (status_code === 2) {
                            res.status(404).send('Blob is not stored on Suiftly');
                        } else if (status_code === 3) {
                            res.status(404).send('Blob MIME type not supported by Suiftly');
                        } else if (status_code === 4) {
                            res.status(404).send(`Blob size not supported by Suiftly (${BLOB_SIZE_LIMIT} limit)`);
                        } else if (status_code === 5) {
                            res.status(400).send(`Invalid request (2)`);
                        } else if (starting_shell_process_failed) {
                            res.status(500).send('Internal Server Error load-blob call (1)');
                        } else {
                            res.status(500).send(`Internal Server Error code=(${status_code})`);
                        }
                        return;
                    }
                }
            } catch (error) {
                if (attempts >= ATTEMPTS_LIMIT - 1) {
                    res.status(500).send('Internal Server Error load-blob call (2)');
                    return;
                }
            }
        }

        // When applicable, verify if a needed aux file exists.
        if (auxFilePath) {
            try {
                await fs.promises.access(auxFilePath, fs.constants.F_OK);
                auxFileExists = true;
            } catch (err) {
                if (attempts >= ATTEMPTS_LIMIT - 1) {
                    res.status(500).send(`Internal Server Error (loading ${ext})`);
                    return;
                }
            }
        }

        attempts++;
    }

    // Some sanity checks.
    if (!mime_parsed) {
        const message = `Internal Server Error: mime not found ${id}`;
        console.error(message);
        res.status(500).send(message);
        return;
    }

    if (!blob_size_parsed) {
        const message = `Internal Server Error: size not found ${id}`;
        console.error(message);
        res.status(500).send(message);
        return;
    }

    if (!isBlobRequest && !auxFileExists) {
        if (isIconRequest && !mime_parsed.startsWith('image/')) {
            // User error, requesting a non-image as an icon.
            res.status(400).send(`Blob mime type [${mime_parsed}] is not an image`);
        } else {
            // Should not happen, unless some backend issues.
            const message = `${ext} file not found for ${id}`;
            console.error(message);
            res.status(404).send(message);
        }
        return;
    }

    // Send the requested file.
    let requestedFilePath: string | undefined = undefined;

    if (auxFilePath) {
        requestedFilePath = auxFilePath;
        // Note: options already initialized.
    } else if (isBlobRequest) {
        requestedFilePath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.blob`);
        options = {
            headers: {
                'Cache-Control': blobCacheControl,
                'Content-Type': mime_parsed,
            },
        };
    } else {
        // Should never happen...
        const message = `Internal error on ressource type handling`;
        console.error(message);
        res.status(500).send(message);
        return;
    }

    // Stream the response.
    if (requestedFilePath && options) {
        try {
            res.sendFile(requestedFilePath, options, error => {
                if (error) {
                    // Do not console.error this one. Problem might
                    // be on the client side.
                    res.status(500).send(`Error streaming blob(1) ${error}`);
                }
            });
            return; // Success!
        } catch (error) {
            // sendFile not supposed to throw, but just in case...
            const message = `Error streaming blob(2) ${error}`;
            console.error(message);
            res.status(500).send(message);
            return;
        }
    }

    // Should never happen...
    const error_on_return = `Internal Server error: Unexpectedly failed getting ${ext} for ${id}`;
    console.error(error_on_return);
    res.status(500).send(error_on_return);
}
