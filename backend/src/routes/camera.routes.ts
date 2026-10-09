import { Router } from 'express';
import {
  getAllCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  getSavedConfigs,
  saveConfig,
  deleteConfig,
  testConnection,
  getCameraStatus,
  disconnectCamera,
} from '../controllers/camera.controller.js';

export const cameraRouter = Router();

// Test & Bridge endpoints
cameraRouter.post('/cameras/test-connection', testConnection);
cameraRouter.get('/cameras/:id/status', getCameraStatus);
cameraRouter.post('/cameras/:id/disconnect', disconnectCamera);

// Connection Configs
cameraRouter.get('/cameras/configs', getSavedConfigs);
cameraRouter.post('/cameras/configs', saveConfig);
cameraRouter.delete('/cameras/configs/:id', deleteConfig);

// Main Camera CRUD
cameraRouter.get('/cameras', getAllCameras);
cameraRouter.get('/cameras/:id', getCameraById);
cameraRouter.post('/cameras', createCamera);
cameraRouter.put('/cameras/:id', updateCamera);
cameraRouter.delete('/cameras/:id', deleteCamera);
