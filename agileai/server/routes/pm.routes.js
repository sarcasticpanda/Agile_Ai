import express from 'express';
import {
  createDeveloper,
  getMyDevelopers,
  getPendingDevelopers,
  getFreePool,
  releaseDeveloper,
  previewReleaseDeveloperImpact,
  approveDeveloper,
  claimDeveloper
} from '../controllers/pmController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.use(requireRole('pm', 'admin'));

router.post('/create-developer', createDeveloper);
router.get('/my-developers', getMyDevelopers);
router.get('/pending-developers', getPendingDevelopers);
router.get('/free-pool', getFreePool);
router.patch('/developers/:id/release', releaseDeveloper);
router.get('/developers/:id/release-impact', previewReleaseDeveloperImpact);
router.patch('/developers/:id/approve', approveDeveloper);
router.patch('/developers/:id/claim', claimDeveloper);

export default router;