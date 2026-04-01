import express from 'express';
import {
  getMyRoster,
  getFreePool,
  claimDeveloper,
  releaseDeveloper
} from '../controllers/teamController.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication and PM role
router.use(protect);
router.use(requireRole('pm', 'admin')); // Admins might bypass but focusing on PM

router.get('/roster', getMyRoster);
router.get('/free-pool', getFreePool);
router.post('/claim/:id', claimDeveloper);
router.post('/release/:id', releaseDeveloper);

export default router;