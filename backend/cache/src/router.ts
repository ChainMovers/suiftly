import express from 'express';

import { getBlob } from '@/controller';

export const router = express.Router();

router.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(
        'Blob ID missing.<br><br> Example of valid use: <b>https://cdn.suiftly.io/blob/<i>&lt;your_blob_id&gt;</i></b>',
    );
});

router.get('/:id', getBlob);
