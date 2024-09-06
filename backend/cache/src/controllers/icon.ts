import { Request, Response } from 'express';

import { FileExtension, sendFile } from '@/services/sendFile';

export const getIcon = async (req: Request, res: Response) => {
    // Extract the {Size}x{Size} from the URL.
    // The URL is in the format of /icon{Size}x{Size}/:id
    // Example:
    //   https://cdn.suiftly.io/icon48x48/{blobId}

    const sizeMatch = req.baseUrl.match(/icon(\d+x\d+)/);
    if (!sizeMatch) {
        return res.status(400).send(`Invalid URL format ${req.baseUrl}`);
    }

    const size = sizeMatch[1];
    const validSizes: string[] = ['48x48', '96x96', '256x256'];

    if (!size || !validSizes.includes(size)) {
        return res.status(400).send('Invalid icon size');
    }

    const ext: FileExtension = size as FileExtension;

    // Let the service layer fully handle the request.
    await sendFile(req, res, ext);
};
