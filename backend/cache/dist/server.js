import cors from 'cors';
import express from 'express';
import 'dotenv/config';
import { router } from './router.js';
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.get('/', (req, res) => res.send('Server is running!'));
app.use('/api', router);
app.listen(port, () => {
    console.log(`App listening on port: ${port}`);
});
