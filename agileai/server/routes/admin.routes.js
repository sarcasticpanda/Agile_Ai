import express from 'express';
import {
  getUsers,
  updateUserRole,
  deleteUser,
  getStats,
  getLogs,
  getProjectsOverview,
  getHierarchyOverview,
  getActivityLogs,
  getPendingUsers,
  getAdminFreePool
} from '../controllers/adminController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.use(requireRole('admin'));

router.get('/users', getUsers);
router.patch('/users/:id', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/stats', getStats);
router.get('/logs', getLogs); // Still accessible if needed, but we prefer activity-logs
router.get('/activity-logs', getActivityLogs);
router.get('/projects', getProjectsOverview);
router.get('/hierarchy', getHierarchyOverview);
router.get('/pending-users', getPendingUsers);
router.get('/free-pool', getAdminFreePool);

export default router;
