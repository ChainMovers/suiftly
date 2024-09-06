import { Request, Response } from 'express';

import { sendFile } from '@/services/sendFile';

export const getMetrics = async (req: Request, res: Response) => {
    // Let the service layer fully handle the request.
    await sendFile(req, res, 'metrics');
};
