import { Router } from 'express';
import {
  getAllIncidents,
  getIncidentById,
  getDashboardStats,
  getHistory,
  startResponse,
  resolveIncident,
  markFalseAlarm,
  simulateFireEvent,
} from '../controllers/incident.controller.js';

export const incidentRouter = Router();

incidentRouter.get('/incidents/stats', getDashboardStats);
incidentRouter.get('/incidents/history', getHistory);
incidentRouter.post('/incidents/simulate', simulateFireEvent);

incidentRouter.get('/incidents', getAllIncidents);
incidentRouter.get('/incidents/:id', getIncidentById);
incidentRouter.post('/incidents/:id/start-response', startResponse);
incidentRouter.post('/incidents/:id/resolve', resolveIncident);
incidentRouter.post('/incidents/:id/false-alarm', markFalseAlarm);
