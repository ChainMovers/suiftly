import express from 'express';
import { getIcon } from '../controllers/icon.js';
export const iconRoutes = express.Router();
iconRoutes.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(`Blob ID missing.<br><br> Useage: <b>https://cdn.suiftly.io${req.baseUrl}/<i>&lt;your_blob_id&gt;</i></b>`);
});
iconRoutes.get('/:id', getIcon);
