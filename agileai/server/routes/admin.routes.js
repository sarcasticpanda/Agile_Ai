import express from 'express';
import {
  getUsers,
  updateUserRole,
  deleteUser,
  getStats,
} from '../controllers/adminController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.use(requireRole('admin'));

router.get('/users', getUsers);
router.patch('/users/:id', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/stats', getStats);

export default router;
