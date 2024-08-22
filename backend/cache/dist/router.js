import express from 'express';
import { getBlob } from './controller.js';
export const router = express.Router();
router.get('/:id', getBlob);
