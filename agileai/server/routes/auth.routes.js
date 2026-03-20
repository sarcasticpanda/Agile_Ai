import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  refreshToken,
  logoutUser,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logoutUser);
router.post('/change-password', protect, updateMe); // Reusing updateMe for simplicity in phase 1

router
  .route('/me')
  .get(protect, getMe)
  .patch(protect, updateMe);

export default router;
