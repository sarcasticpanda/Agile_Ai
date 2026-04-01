import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getSprintRisk,
  getProjectRiskOverview,
  getExecutiveDashboard,
} from '../controllers/riskController.js';

const router = express.Router();

router.use(protect);

router.get('/sprint/:sprintId', getSprintRisk);
router.get('/project/:projectId', getProjectRiskOverview);
router.get('/dashboard', getExecutiveDashboard);

export default router;
