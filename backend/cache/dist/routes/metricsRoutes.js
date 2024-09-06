import express from 'express';
import { getMetrics } from '../controllers/metrics.js';
export const metricsRoutes = express.Router();
metricsRoutes.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(`Blob ID missing.<br><br> Useage: <b>https://cdn.suiftly.io${req.baseUrl}/<i>&lt;your_blob_id&gt;</i></b>`);
});
metricsRoutes.get('/:id', getMetrics);
