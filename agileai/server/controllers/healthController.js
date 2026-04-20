import mongoose from 'mongoose';
import axios from 'axios';
import { apiResponse } from '../utils/apiResponse.js';

const getAIServiceUrl = () => process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * GET /api/health — process + Mongo + optional AI inference service.
 * HTTP 200 when Mongo is connected; AI status is informational in payload.
 */
export const getHealth = async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;

  const aiUrl = getAIServiceUrl();
  const started = Date.now();
  let ai = { ok: false, url: aiUrl, latencyMs: null, error: null, models: null };

  try {
    const response = await axios.get(`${aiUrl.replace(/\/$/, '')}/health`, { timeout: 3000 });
    ai.latencyMs = Date.now() - started;
    ai.ok = response?.data?.ok === true;
    ai.models = response?.data?.models ?? null;
  } catch (error) {
    ai.latencyMs = Date.now() - started;
    ai.error = error?.message || String(error);
  }

  if (!mongoOk) {
    return apiResponse(
      res,
      503,
      false,
      {
        ok: false,
        mongo: { ok: false, readyState: mongoose.connection.readyState },
        ai,
        uptimeSec: Math.round(process.uptime()),
      },
      'Database unavailable'
    );
  }

  return apiResponse(res, 200, true, {
    ok: true,
    mongo: { ok: true, readyState: mongoose.connection.readyState },
    ai,
    uptimeSec: Math.round(process.uptime()),
  }, 'OK');
};
