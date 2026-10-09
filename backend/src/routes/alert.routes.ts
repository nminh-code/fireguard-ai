import { Router } from 'express';
import {
  getLatestAlert,
  getAlertHistory,
  getAlertById,
} from '../controllers/alert.controller.js';

export const alertRouter = Router();

alertRouter.get('/alerts/latest', getLatestAlert);
alertRouter.get('/alerts', getAlertHistory);
alertRouter.get('/alerts/:id', getAlertById);
