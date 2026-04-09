import express from 'express';
import {
  getOverview,
  getOverviewPms,
  getBurndown,
  getVelocity,
  getTeamStats,
  getCompletionStats,
} from '../controllers/analyticsController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/overview/pms', protect, requireRole('admin'), getOverviewPms);
router.get('/overview', protect, requireRole('admin', 'pm'), getOverview);
router.get('/burndown/:sprintId', protect, getBurndown);
router.get('/velocity/:projectId', protect, getVelocity);
router.get('/team/:projectId', protect, getTeamStats);
router.get('/completion/:sprintId', protect, getCompletionStats);

export default router;
