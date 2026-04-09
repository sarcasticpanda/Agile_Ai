import express from 'express';
import {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getMembers,
  addMember,
  removeMember,
  previewMemberRemovalImpact,
} from '../controllers/projectController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router
  .route('/')
  .get(protect, getProjects)
  .post(protect, requireRole('admin', 'pm'), createProject);

router
  .route('/:id')
  .get(protect, getProjectById)
  .patch(protect, requireRole('admin', 'pm'), updateProject)
  .delete(protect, requireRole('admin'), deleteProject);

router
  .route('/:id/members')
  .get(protect, getMembers)
  .post(protect, requireRole('admin', 'pm'), addMember);

router
  .route('/:id/members/:uid')
  .delete(protect, requireRole('admin', 'pm'), removeMember);

router
  .route('/:id/members/:uid/removal-impact')
  .get(protect, requireRole('admin', 'pm'), previewMemberRemovalImpact);

export default router;
