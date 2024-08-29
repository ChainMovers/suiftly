import cors from 'cors';
import express from 'express';
import 'dotenv/config';
import { router } from './router.js';
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
app.use('/blob', router);
app.listen(port, () => {
    console.log(`App listening on port: ${port}`);
});
