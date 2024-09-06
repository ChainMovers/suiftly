import { sendFile } from '../services/sendFile.js';
export const getMeta = async (req, res) => {
    // Let the service layer fully handle the request.
    await sendFile(req, res, 'json');
};
