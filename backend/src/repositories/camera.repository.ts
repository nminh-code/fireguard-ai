import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Camera, CameraConnectionConfig } from '../models/camera.model.js';
import { INITIAL_CAMERAS, INITIAL_CAMERA_CONFIGS } from '../data/seedCameras.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.FAVIS_DATA_DIR || path.resolve(__dirname, '../../data');
const CAMERAS_FILE = path.join(DATA_DIR, 'cameras.json');
const CONFIGS_FILE = path.join(DATA_DIR, 'camera-configs.json');

export class CameraRepository {
  private cameras: Camera[] = [];
  private configs: CameraConnectionConfig[] = [];
  private initialized: boolean = false;

  constructor() {
    this.ensureDataFiles();
  }

  private ensureDataFiles(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Initialize Cameras
      if (!fs.existsSync(CAMERAS_FILE)) {
        this.cameras = [...INITIAL_CAMERAS];
        this.saveToFile(CAMERAS_FILE, this.cameras);
      } else {
        const raw = fs.readFileSync(CAMERAS_FILE, 'utf-8');
        this.cameras = JSON.parse(raw);
      }

      // 2. Initialize Camera Connection Configs
      if (!fs.existsSync(CONFIGS_FILE)) {
        this.configs = [...INITIAL_CAMERA_CONFIGS];
        this.saveToFile(CONFIGS_FILE, this.configs);
      } else {
        const raw = fs.readFileSync(CONFIGS_FILE, 'utf-8');
        this.configs = JSON.parse(raw);
      }

      this.initialized = true;
    } catch (err) {
      console.error('[CameraRepository] Error initializing data files:', err);
      throw err;
    }
  }

  private saveToFile(filePath: string, data: unknown): void {
    try {
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`[CameraRepository] Error saving to ${filePath}:`, err);
      const previous = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
      if (filePath === CAMERAS_FILE) this.cameras = previous;
      if (filePath === CONFIGS_FILE) this.configs = previous;
      throw err;
    }
  }

  // --- Camera Entities CRUD ---
  public async findAll(): Promise<Camera[]> {
    return [...this.cameras];
  }

  public async findById(id: string): Promise<Camera | null> {
    const cam = this.cameras.find(
      (c) => c.id.toLowerCase() === id.toLowerCase() || c.code.toLowerCase() === id.toLowerCase()
    );
    return cam ? { ...cam } : null;
  }

  public async create(cameraData: Omit<Camera, 'id'> & { id?: string }): Promise<Camera> {
    const newId = cameraData.id || `cam-${(this.cameras.length + 1).toString().padStart(2, '0')}`;
    const newCam: Camera = {
      ...cameraData,
      id: newId,
    };
    this.cameras.push(newCam);
    this.saveToFile(CAMERAS_FILE, this.cameras);
    return { ...newCam };
  }

  public async update(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    const idx = this.cameras.findIndex(
      (c) => c.id.toLowerCase() === id.toLowerCase() || c.code.toLowerCase() === id.toLowerCase()
    );
    if (idx === -1) return null;

    this.cameras[idx] = {
      ...this.cameras[idx],
      ...updates,
      lastUpdate: updates.lastUpdate || new Date().toLocaleTimeString('vi-VN', { hour12: false }),
    };
    this.saveToFile(CAMERAS_FILE, this.cameras);
    return { ...this.cameras[idx] };
  }

  public async delete(id: string): Promise<boolean> {
    const initialLen = this.cameras.length;
    this.cameras = this.cameras.filter(
      (c) => c.id.toLowerCase() !== id.toLowerCase() && c.code.toLowerCase() !== id.toLowerCase()
    );
    if (this.cameras.length < initialLen) {
      this.saveToFile(CAMERAS_FILE, this.cameras);
      return true;
    }
    return false;
  }

  // --- Camera Connection Configs CRUD ---
  public async findAllConfigs(): Promise<CameraConnectionConfig[]> {
    return [...this.configs];
  }

  public async findConfigById(id: string): Promise<CameraConnectionConfig | null> {
    const found = this.configs.find((c) => c.id.toLowerCase() === id.toLowerCase());
    return found ? { ...found } : null;
  }

  public async saveConfig(config: CameraConnectionConfig): Promise<CameraConnectionConfig> {
    const idx = this.configs.findIndex((c) => c.id.toLowerCase() === config.id.toLowerCase());
    if (idx >= 0) {
      this.configs[idx] = { ...config };
    } else {
      this.configs.push({ ...config });
    }
    this.saveToFile(CONFIGS_FILE, this.configs);
    return { ...config };
  }

  public async deleteConfig(id: string): Promise<boolean> {
    const initialLen = this.configs.length;
    this.configs = this.configs.filter((c) => c.id.toLowerCase() !== id.toLowerCase());
    if (this.configs.length < initialLen) {
      this.saveToFile(CONFIGS_FILE, this.configs);
      return true;
    }
    return false;
  }
}

export const cameraRepository = new CameraRepository();
