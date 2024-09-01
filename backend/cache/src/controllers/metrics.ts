import { Request, Response } from 'express';
import * as fs from 'fs';
import path from 'path';

import { isValidBlobId } from '@/common/blob';
import { getIdPrefixes } from '@/common/strings';

// Test Blob Info
//
// MIME type: image/png
//
// Blob ID: 0nzvRVLeF0I5kbWO3s_VDa-ixYZ_nhkp4J2EubJUtjo
// Unencoded size: 165 KiB
// Encoded size (including metadata): 62.0 MiB
// Sui object ID: 0x0ebad3b13ee9bc64f8d6370e71d3408a43febaa017a309d2367117afe144ae8c

// Cache-Control value initialized once
const metricsCacheControl = process.env.METRICS_CACHE_CONTROL || 'public, max-age=10';

export const getMetrics = async (req: Request, res: Response) => {
    const { id = '' } = req.params;

    // Request validation
    try {
        await isValidBlobId(id);
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).send(error.message);
        } else {
            res.status(400).send('Unknown error');
        }
    }

    const { prefix_1, prefix_2 } = getIdPrefixes(id);
    if (!prefix_1 || !prefix_2) {
        // Should never happen because id was validated.
        return res.status(500).send('Internal Server Error (prefix)');
    }

    // Attempt reading metrics information
    // from ~/cache/prefix1/prefix2/<id>.metrics
    //
    // If it is not created yet, then there is no metrics.
    // Return empty metrics JSON:
    // {
    //   "status": "no_metrics",
    //   "message": "No metrics accumulated yet for this item. Metrics updated every ~24 hours.",
    // }
    //
    // If the .metrics file exists, return it as JSON.
    const homePath = process.env.HOME || '';
    const jsonPath = path.resolve(homePath, 'cache', prefix_1, prefix_2, `${id}.metrics`);

    const options = {
        headers: {
            'Cache-Control': metricsCacheControl,
            'Content-Type': 'application/json',
        },
    };

    try {
        await fs.promises.access(jsonPath);
        // Stream the .metrics as response.
        res.sendFile(jsonPath, options, err => {
            if (err) {
                res.status(500).send('Error streaming metrics');
            }
        });
    } catch (err) {
        // File does not exist, return "no_metrics" JSON response
        res.json({
            blobId: id,
            message: 'No metrics accumulated yet for this blob. Metrics updated every ~24 hours.',
            status: 'no_metrics',
        });
    }
};
