import express from 'express';
import { getView } from '../controllers/view.js';
export const viewRoutes = express.Router();
viewRoutes.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.send('Blob ID missing.<br><br> Useage: <b>https://cdn.suiftly.io/view/<i>&lt;your_blob_id&gt;</i></b>');
});
viewRoutes.get('/:id', getView);
