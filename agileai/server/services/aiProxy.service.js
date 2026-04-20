// AI Proxy Service
// Connects to the Python FastAPI microservice
import axios from 'axios';

const getAIServiceUrl = () => process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

const logAi = (operation, { ms, ok, status, detail }) => {
  const payload = { operation, ms, ok, status, detail: detail || undefined };
  if (ok) {
    console.log('[AI]', JSON.stringify(payload));
  } else {
    console.warn('[AI]', JSON.stringify(payload));
  }
};

const postJson = async (operation, path, body, timeoutMs = 5000) => {
  const url = `${getAIServiceUrl().replace(/\/$/, '')}${path}`;
  const started = Date.now();
  try {
    const response = await axios.post(url, body, { timeout: timeoutMs });
    const ms = Date.now() - started;
    const ok = response?.data?.ok === true;
    logAi(operation, { ms, ok, status: response?.status });
    return response.data;
  } catch (error) {
    const ms = Date.now() - started;
    const status = error?.response?.status;
    logAi(operation, {
      ms,
      ok: false,
      status: status ?? null,
      detail: error?.response?.data?.detail || error?.message || String(error),
    });
    return null;
  }
};

export const predictRisk = async (sprintData) => postJson('predictRisk', '/predict-risk', sprintData);

export const estimateEffort = async (taskData) => postJson('estimate-effort', '/estimate-effort', taskData);

export const getInsights = async (sprintData) => postJson('getInsights', '/insights', sprintData);

export const predictBurnout = async (userData) => postJson('predictBurnout', '/predict-burnout', userData);
