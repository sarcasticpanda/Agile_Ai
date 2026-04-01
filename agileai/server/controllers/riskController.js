import { calculateSprintRisk } from '../services/riskEngine.js';
import { apiResponse } from '../utils/apiResponse.js';
import Sprint from '../models/Sprint.model.js';

/**
 * GET /api/risk/sprint/:sprintId
 * Full risk analysis for a sprint
 */
export const getSprintRisk = async (req, res) => {
  try {
    const { sprintId } = req.params;
    const result = await calculateSprintRisk(sprintId);

    // Cache risk score on the sprint document
    await Sprint.findByIdAndUpdate(sprintId, {
      'aiRiskScore': result.riskScore,
      'aiRiskLevel': result.riskLevel,
      // 'aiPrediction.confidence': result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.5,
      'aiRiskFactors': result.factors.map((f) => ({
        name: f.name,
        impact: f.impact,
        direction: f.direction,
      })),
      'aiLastAnalyzed': result.generatedAt,
    });

    apiResponse(res, 200, true, result, 'Risk analysis complete');
  } catch (err) {
    apiResponse(res, 500, false, null, err.message);
  }
};

/**
 * GET /api/risk/project/:projectId
 * Risk overview for all active sprints in a project
 */
export const getProjectRiskOverview = async (req, res) => {
  try {
    const { projectId } = req.params;
    const activeSprints = await Sprint.find({
      project: projectId,
      status: { $in: ['planning', 'active'] },
    }).lean();

    const results = await Promise.all(
      activeSprints.map(async (sprint) => {
        try {
          const risk = await calculateSprintRisk(sprint._id.toString());
          return { sprintId: sprint._id, title: sprint.title, status: sprint.status, ...risk };
        } catch {
          return { sprintId: sprint._id, title: sprint.title, status: sprint.status, riskScore: null, riskLevel: 'unknown' };
        }
      })
    );

    apiResponse(res, 200, true, results, 'Project risk overview');
  } catch (err) {
    apiResponse(res, 500, false, null, err.message);
  }
};

/**
 * GET /api/risk/dashboard
 * Cross-project executive risk summary
 */
export const getExecutiveDashboard = async (req, res) => {
  try {
    const activeSprints = await Sprint.find({ status: 'active' })
      .populate('project', 'name')
      .lean();

    const summary = await Promise.all(
      activeSprints.map(async (sprint) => {
        try {
          const risk = await calculateSprintRisk(sprint._id.toString());
          return {
            sprintId: sprint._id,
            sprintTitle: sprint.title,
            projectId: sprint.project?._id,
            projectName: sprint.project?.name,
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            totalPoints: risk.totalPoints,
            recommendation: risk.recommendation,
          };
        } catch {
          return null;
        }
      })
    );

    const filtered = summary.filter(Boolean);
    const highRisk = filtered.filter((s) => s.riskLevel === 'high').length;
    const mediumRisk = filtered.filter((s) => s.riskLevel === 'medium').length;
    const lowRisk = filtered.filter((s) => s.riskLevel === 'low').length;

    apiResponse(res, 200, true, {
      sprints: filtered,
      summary: { total: filtered.length, highRisk, mediumRisk, lowRisk },
    }, 'Executive dashboard');
  } catch (err) {
    apiResponse(res, 500, false, null, err.message);
  }
};
