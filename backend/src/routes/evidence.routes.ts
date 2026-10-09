import { Router } from 'express';
import { getEvidence } from '../controllers/evidence.controller.js';

export const evidenceRouter = Router();

evidenceRouter.get('/evidence/:file', getEvidence);
