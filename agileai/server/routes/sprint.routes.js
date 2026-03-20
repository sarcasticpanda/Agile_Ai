import express from 'express';
import {
  getSprints,
  createSprint,
  getSprintById,
  updateSprint,
  deleteSprint,
  startSprint,
  completeSprint,
} from '../controllers/sprintController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(protect, getSprints)
  .post(protect, requireRole('admin', 'pm'), createSprint);

router
  .route('/:id')
  .get(protect, getSprintById)
  .patch(protect, requireRole('admin', 'pm'), updateSprint)
  .delete(protect, requireRole('admin', 'pm'), deleteSprint);

router.post('/:id/start', protect, requireRole('admin', 'pm'), startSprint);
router.post('/:id/complete', protect, requireRole('admin', 'pm'), completeSprint);

export default router;
