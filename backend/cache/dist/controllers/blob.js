import { sendFile } from '../services/sendFile.js';
export async function getBlob(req, res) {
    // Let the service layer fully handle the request.
    await sendFile(req, res, 'blob');
}
