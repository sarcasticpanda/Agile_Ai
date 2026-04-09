import express from 'express';
import {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskSprint,
  reorderTask,
  previewAssignmentWarnings,
  addComment,
  deleteComment,
  addWorklog,
  deleteWorklog,
  startWorklogTimer,
  stopWorklogTimer,
} from '../controllers/taskController.js';
import { protect } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(protect, getTasks)
  .post(protect, requireRole('admin', 'pm'), createTask); // Fixed by @Backend — restrict to PM/Admin

router.post('/assignment-warning', protect, requireRole('admin', 'pm'), previewAssignmentWarnings);

router
  .route('/:id')
  .get(protect, getTaskById)
  .patch(protect, requireRole('admin', 'pm'), updateTask) // Fixed by @Backend — restrict sensitive updates
  .delete(protect, requireRole('admin', 'pm'), deleteTask);

router.patch('/:id/status', protect, updateTaskStatus); // Status logic handled in controller
router.patch('/:id/sprint', protect, requireRole('admin', 'pm'), updateTaskSprint);
router.patch('/:id/order', protect, requireRole('admin', 'pm'), reorderTask); // Fixed by @Backend — board layout

router.post('/:id/comment', protect, addComment);
router.delete('/:id/comment/:cid', protect, deleteComment);

router.post('/:id/worklog', protect, addWorklog);
router.delete('/:id/worklog/:wid', protect, deleteWorklog);
router.post('/:id/worklog/start', protect, startWorklogTimer);
router.post('/:id/worklog/stop', protect, stopWorklogTimer);

export default router;
