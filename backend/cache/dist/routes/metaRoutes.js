import express from 'express';
import { getMeta } from '../controllers/meta.js';
export const metaRoutes = express.Router();
metaRoutes.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(`Blob ID missing.<br><br> Useage: <b>https://cdn.suiftly.io${req.baseUrl}/<i>&lt;your_blob_id&gt;</i></b>`);
});
metaRoutes.get('/:id', getMeta);
