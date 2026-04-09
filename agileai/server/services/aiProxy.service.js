// AI Proxy Service 
// Connects to the Python FastAPI microservice
import axios from 'axios';

const getAIServiceUrl = () => process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

export const predictRisk = async (sprintData) => {
  try {
    const response = await axios.post(`${getAIServiceUrl()}/predict-risk`, sprintData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for predictRisk:', error.message);
    // Fallback or re-throw
    throw new Error('AI Service unavailable');
  }
};

export const estimateEffort = async (taskData) => {
  try {
    const response = await axios.post(`${getAIServiceUrl()}/estimate-effort`, taskData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for estimateEffort:', error.message);
    throw new Error('AI Service unavailable');
  }
};

export const getInsights = async (sprintData) => {
  try {
    const response = await axios.post(`${getAIServiceUrl()}/insights`, sprintData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for insights:', error.message);
    throw new Error('AI Service unavailable');
  }
};

export const predictBurnout = async (userData) => {
  try {
    const response = await axios.post(`${getAIServiceUrl()}/predict-burnout`, userData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for predictBurnout:', error.message);
    throw new Error('AI Service unavailable');
  }
};
