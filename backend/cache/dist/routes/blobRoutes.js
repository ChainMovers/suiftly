import express from 'express';
import { getBlob } from '../controllers/blob.js';
export const blobRoutes = express.Router();
blobRoutes.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.send('Blob ID missing.<br><br> Useage: <b>https://cdn.suiftly.io/blob/<i>&lt;your_blob_id&gt;</i></b>');
});
blobRoutes.get('/:id', getBlob);