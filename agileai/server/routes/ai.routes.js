import express from 'express';
import {
  predictRisk,
  estimateEffort,
  getInsights,
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// AI Routes Phase 1: Fixed by @Backend — restrict to PM/Admin per role matrix
router.use(protect);
router.use(requireRole('admin', 'pm'));

router.post('/predict-risk', predictRisk);
router.post('/estimate-effort', estimateEffort);
router.get('/insights/:sprintId', getInsights);

export default router;
