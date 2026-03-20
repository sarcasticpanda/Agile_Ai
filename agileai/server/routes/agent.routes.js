import express from 'express';
import { apiResponse } from '../utils/apiResponse.js';

const router = express.Router();

router.all('/*', (req, res) => {
  apiResponse(res, 501, false, null, 'Agent API coming in Phase 3');
});

export default router;
