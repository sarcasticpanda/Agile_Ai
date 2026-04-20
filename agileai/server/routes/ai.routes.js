import express from 'express';
import {
  predictRisk,
  estimateEffort,
  getInsights,
  predictBurnout,
  getSprintRiskCached,
  getMyBurnout,
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// ---- Open to ALL authenticated roles (dev, pm, admin) ----
// Developers can read their own burnout score; PMs read their team's
router.get('/burnout/:userId', getMyBurnout);

// GET cached sprint risk — PM/admin + any dev on that project
router.get('/sprint-risk/:sprintId', getSprintRiskCached);

// ---- PM / Admin only below this line ----
router.use(requireRole('admin', 'pm'));

router.post('/predict-risk', predictRisk);
router.post('/estimate-effort', estimateEffort);
router.post('/predict-burnout', predictBurnout);
router.get('/insights/:sprintId', getInsights);

export default router;
