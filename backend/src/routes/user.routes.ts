import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';

export const userRouter = Router();

// Users Routes
userRouter.get('/users', getAllUsers);
userRouter.get('/users/:id', getUserById);
userRouter.post('/users', createUser);
userRouter.put('/users/:id', updateUser);
userRouter.delete('/users/:id', deleteUser);
