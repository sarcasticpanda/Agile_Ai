// AI Proxy Service Placeholder
// This file will connect to the Python FastAPI microservice in Phase 2
import axios from 'axios';

// Get AI Service URL from env, fallback to default Phase 2 expected port
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8001';

export const predictRisk = async (sprintId) => {
  // Phase 1 Mock Data (Phase 2 will replace with Axios call to Python Service)
  // const response = await axios.post(`${AI_SERVICE_URL}/predict-risk`, { sprintId });
  // return response.data;

  return {
    riskScore: 45,
    riskLevel: 'medium',
    confidence: 0.85,
    factors: [
      { name: 'Developer Workload', impact: 15, direction: 'negative' },
      { name: 'Historical Velocity', impact: 10, direction: 'positive' }
    ],
    generatedAt: new Date()
  };
};

export const estimateEffort = async (taskId) => {
  // Phase 1 Mock Data
  return {
    predictedHours: 8,
    confidence: 0.9,
    generatedAt: new Date()
  };
};

export const getInsights = async (sprintId) => {
  // Phase 1 Mock Data
  return {
    insights: [
      "The team is on track to complete the sprint successfully.",
      "Consider reassigning one issue from Junior Dev to balance workload."
    ],
    recommendations: [
      "Prioritize task T-402 as it's blocking 2 others."
    ]
  };
};
