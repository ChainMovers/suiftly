import { spawn } from 'child_process';
import { Request, Response } from 'express';
import * as fs from 'fs';
import path from 'path';

import { isValidBlobId } from '../common/blob';
import { getIdPrefixes } from '../common/strings';

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
const SIZE_LIMIT = 209715200;

export const getBlob = async (req: Request, res: Response) => {
    const { id = '' } = req.params;


    // Request validation
    try {
        await isValidBlobId(id);
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).send(error.message);
        } else {
            return res.status(400).send('Invalid request');
        }
    }

    const { prefix_1, prefix_2 } = getIdPrefixes(id);
    if (!prefix_1 || !prefix_2) {
        // Should never happen because id was validated.
        return res.status(500).send('Internal Server Error (prefix)');
    }

    const homePath = process.env.HOME || '';

    // First attempt at reading meta information
    // from ~/cache/prefix1/prefix2/<id>.json
    //
    // The meta file confirms:
    //  - the blob is locally available.
    //  - get the blob MIME type.
    //
    // If the meta file does not exists, then do an async shell
    // call to "load-blob <id>". If this call is successful, then
    // try again to read the meta file.
    //
    // Once meta are confirmed, then the blob to return
    // for this request is stored in:
    //    $HOME/cache/prefix1/prefix2/<id>.blob
    const jsonPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.json`);

    // Read the meta JSON file and extract the MIME type and size.
    let mime_parsed: string | undefined = undefined;
    let blob_size: number | undefined = undefined;
    let attempts = 0;
    const ATTEMPTS_LIMIT = 3;

    while (!mime_parsed && attempts < ATTEMPTS_LIMIT) {
        try {
            await fs.promises.access(jsonPath, fs.constants.F_OK);

            // Read the meta JSON file and extract the MIME type
            const meta = await fs.promises.readFile(jsonPath, 'utf8');

            try {
                const parsedMeta = JSON.parse(meta);
                mime_parsed = parsedMeta.mime;
                blob_size = parsedMeta.size;
            } catch (parseError) {
                console.error(`Error meta parsing: ${parseError} id: ${id}`);
                return res.status(500).send('Internal Server Error (meta parsing)');
            }

            if (blob_size) {
                if (blob_size > SIZE_LIMIT) {
                    console.error(`Error: Blob size exceeds limit ${blob_size} > ${SIZE_LIMIT}`);
                    return res
                        .status(404)
                        .send(`Blob size ${blob_size} not supported by Suiftly (${SIZE_LIMIT} limit)`);
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
                return res.status(500).send('Internal Server Error (cache access)');
            }
        }

        if (!mime_parsed) {
            // Do an async shell call to "load-blob <id>".
            // Note: load-blob handles safe concurrent loading (at blob granularity).
            //
            // Status code are:
            // 0: Success
            // 1: Does not exists on Walrus
            // 2: Does not exists on Suiftly
            // 3: Unsupported MIME type
            // 4: Unsupported Blob Size
            // 5: Unknown error
            //
            // In all error cases, the client should fallback to Walrus directly.
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

            try {
                // Fail the request only on error while the last attempt.
                if (attempts >= ATTEMPTS_LIMIT - 1) {
                    if (status_code === 0) {
                        // Success.
                    } else if (status_code === 1) {
                        return res.status(404).send('Blob is not stored on Walrus');
                    } else if (status_code === 2) {
                        return res.status(404).send('Blob is not stored on Suiftly');
                    } else if (status_code === 3) {
                        return res.status(404).send('Blob MIME type not supported by Suiftly');
                    } else if (status_code === 4) {
                        return res.status(404).send(`Blob size not supported by Suiftly (${SIZE_LIMIT} limit)`);
                    } else if (starting_shell_process_failed) {
                        return res.status(500).send('Internal Server Error (shell call)');
                    } else {
                        return res.status(500).send(`Internal Server Error (${status_code})`);
                    }
                }
            } catch (err) {
                if (attempts >= ATTEMPTS_LIMIT - 1) {
                    return res.status(500).send('Internal Server Error (loading blob)');
                }
            }
        }
        attempts++;
    }

    if (!mime_parsed) {
        console.error('Error meta parsing: mime not found');
        return res.status(500).send('Internal Server Error (timeout)');
    }

    if (!blob_size) {
        console.error('Error meta parsing: size not found');
        return res.status(500).send('Internal Server Error (size missing)');
    }

    const blobPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.blob`);

    // Set headers and options

    const options = {
        headers: {
            'Cache-Control': blobCacheControl,
            'Content-Type': mime_parsed,
        },
    };

    // Stream the binary as response.
    res.sendFile(blobPath, options, err => {
        if (err) {
            res.status(500).send('Error streaming blob');
        }
    });
};
