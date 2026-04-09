import { calculateSprintRisk } from '../services/riskEngine.js';
import { apiResponse } from '../utils/apiResponse.js';
import Sprint from '../models/Sprint.model.js';
import Project from '../models/Project.model.js';

const getUserIdString = (req) => (req.user?._id ? String(req.user._id) : null);

const ensureProjectAccess = async (req, res, projectId) => {
  const userId = getUserIdString(req);
  if (!userId) {
    apiResponse(res, 401, false, null, 'Not authorized');
    return null;
  }

  const project = await Project.findById(projectId).select('owner members.user').lean();
  if (!project) {
    apiResponse(res, 404, false, null, 'Project not found');
    return null;
  }

  if (req.user.role === 'admin') return project;

  const isOwner = String(project.owner) === userId;
  const isMember = Array.isArray(project.members)
    ? project.members.some((m) => String(m.user) === userId)
    : false;

  if (!isOwner && !isMember) {
    apiResponse(res, 403, false, null, 'Not authorized for this project');
    return null;
  }

  return project;
};

const ensureSprintAccess = async (req, res, sprintId) => {
  const sprint = await Sprint.findById(sprintId).select('projectId').lean();
  if (!sprint) {
    apiResponse(res, 404, false, null, 'Sprint not found');
    return null;
  }

  const project = await ensureProjectAccess(req, res, sprint.projectId);
  if (!project) return null;

  return sprint;
};

/**
 * GET /api/risk/sprint/:sprintId
 * Full risk analysis for a sprint
 */
export const getSprintRisk = async (req, res) => {
  try {
    const { sprintId } = req.params;

    const accessSprint = await ensureSprintAccess(req, res, sprintId);
    if (!accessSprint) return;

    const result = await calculateSprintRisk(sprintId);

    // Cache risk score on the sprint document
    await Sprint.findByIdAndUpdate(sprintId, {
      'aiRiskScore': result.riskScore,
      'aiRiskLevel': result.riskLevel,
      // 'aiPrediction.confidence': result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.5,
      'aiRiskFactors': result.factors.map((f) => ({
        factor: f.name,
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

    const project = await ensureProjectAccess(req, res, projectId);
    if (!project) return;

    const activeSprints = await Sprint.find({
      projectId,
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
    let activeSprintsQuery = { status: 'active' };
    if (req.user.role !== 'admin') {
      const projects = await Project.find({
        $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
      })
        .select('_id')
        .lean();
      const projectIds = projects.map((p) => p._id);
      activeSprintsQuery = { status: 'active', projectId: { $in: projectIds } };
    }

    const activeSprints = await Sprint.find(activeSprintsQuery)
      .populate('projectId', 'name')
      .lean();

    const summary = await Promise.all(
      activeSprints.map(async (sprint) => {
        try {
          const risk = await calculateSprintRisk(sprint._id.toString());
          return {
            sprintId: sprint._id,
            sprintTitle: sprint.title,
            projectId: sprint.projectId?._id,
            projectName: sprint.projectId?.name,
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
