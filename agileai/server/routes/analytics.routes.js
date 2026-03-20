import express from 'express';
import {
  getBurndown,
  getVelocity,
  getTeamStats,
  getCompletionStats,
} from '../controllers/analyticsController.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/burndown/:sprintId', protect, getBurndown);
router.get('/velocity/:projectId', protect, getVelocity);
router.get('/team/:projectId', protect, getTeamStats);
router.get('/completion/:sprintId', protect, getCompletionStats);

export default router;
