import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { blobRoutes } from './routes/blobRoutes.js';
import { iconRoutes } from './routes/iconRoutes.js';
import { metaRoutes } from './routes/metaRoutes.js';
import { metricsRoutes } from './routes/metricsRoutes.js';
import { viewRoutes } from './routes/viewRoutes.js';
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
// Serve a blank and transparent favicon.ico
const favicon = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QYQFhQnJ5sZJQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAANSURBVDjLY2AYBaNgFIwEAGIMCk0pDgAAAABJRU5ErkJggg==', 'base64');
app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // TODO Increase after testing
    res.send(favicon);
});
app.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 1 day
    res.send('CDN is responding.<br><br> Access your own blob with <b>https://cdn.suiftly.io/blob/<i>&ltyour_blob_id&gt</i></b>');
});
app.use('/blob', blobRoutes);
app.use('/metrics', metricsRoutes);
app.use('/view', viewRoutes);
app.use('/meta', metaRoutes);
app.use('/icon48x48', iconRoutes);
app.use('/icon96x96', iconRoutes);
app.use('/icon256x256', iconRoutes);
app.listen(port, () => {
    console.log(`App listening on port: ${port}`);
});
