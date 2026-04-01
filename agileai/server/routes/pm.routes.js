import express from 'express';
import {
  createDeveloper,
  getMyDevelopers,
  getPendingDevelopers,
  releaseDeveloper,
  approveDeveloper
} from '../controllers/pmController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.use(requireRole('pm', 'admin'));

router.post('/create-developer', createDeveloper);
router.get('/my-developers', getMyDevelopers);
router.get('/pending-developers', getPendingDevelopers);
router.patch('/developers/:id/release', releaseDeveloper);
router.patch('/developers/:id/approve', approveDeveloper);

export default router;