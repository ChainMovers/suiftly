import express from 'express';
import { getBlob } from '@/controller';

export const router = express.Router();

router.get('/:id', getBlob);
