import express from 'express';
import {
  predictRisk,
  estimateEffort,
  getInsights,
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// AI Routes Phase 1: All protected, but currently returning stubs
router.post('/predict-risk', protect, predictRisk);
router.post('/estimate-effort', protect, estimateEffort);
router.get('/insights/:sprintId', protect, getInsights);

export default router;
