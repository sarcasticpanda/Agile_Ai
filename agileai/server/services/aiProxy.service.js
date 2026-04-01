// AI Proxy Service 
// Connects to the Python FastAPI microservice
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000/api/ai';

export const predictRisk = async (sprintData) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/predict-risk`, sprintData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for predictRisk:', error.message);
    // Fallback or re-throw
    throw new Error('AI Service unavailable');
  }
};

export const estimateEffort = async (taskData) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/estimate-effort`, taskData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for estimateEffort:', error.message);
    throw new Error('AI Service unavailable');
  }
};

export const getInsights = async (sprintData) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/insights`, sprintData);
    return response.data;
  } catch (error) {
    console.error('Error hitting AI Service for insights:', error.message);
    throw new Error('AI Service unavailable');
  }
};
