import cors from 'cors';
import express from 'express';
import 'dotenv/config';

import { router } from '@/router';

const port = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.send(
    'CDN is responding.<br><br> Access your own blob with <b>https://cdn.suiftly.io/blob/<i>&ltyour_blob_id&gt</i></b>'
  );
});

app.use('/blob', router);

app.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});
