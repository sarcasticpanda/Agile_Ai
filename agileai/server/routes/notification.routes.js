import express from 'express';
import {
  getNotifications,
  markAsRead,
  deleteNotification,
  markAllAsRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.post('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
