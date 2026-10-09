import { Router } from 'express';
import {
  getSite,
  getZones,
  addZone,
  updateZone,
  deleteZone,
  getSettings,
  updateSettings,
} from '../controllers/site.controller.js';

export const siteRouter = Router();

// Site & Zones Routes
siteRouter.get('/site', getSite);
siteRouter.get('/site/zones', getZones);
siteRouter.post('/site/zones', addZone);
siteRouter.put('/site/zones/:id', updateZone);
siteRouter.delete('/site/zones/:id', deleteZone);

// Settings Routes
siteRouter.get('/settings', getSettings);
siteRouter.put('/settings', updateSettings);
