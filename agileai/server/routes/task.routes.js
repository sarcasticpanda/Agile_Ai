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
  addComment,
  deleteComment,
  addWorklog,
  deleteWorklog,
} from '../controllers/taskController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(protect, getTasks)
  .post(protect, createTask);

router
  .route('/:id')
  .get(protect, getTaskById)
  .patch(protect, updateTask)
  .delete(protect, requireRole('admin', 'pm'), deleteTask);

router.patch('/:id/status', protect, updateTaskStatus);
router.patch('/:id/sprint', protect, requireRole('admin', 'pm'), updateTaskSprint);
router.patch('/:id/order', protect, reorderTask);

router.post('/:id/comment', protect, addComment);
router.delete('/:id/comment/:cid', protect, deleteComment);

router.post('/:id/worklog', protect, addWorklog);
router.delete('/:id/worklog/:wid', protect, deleteWorklog);

export default router;
