import { apiResponse } from '../utils/apiResponse.js';
import * as analyticsService from '../services/analyticsService.js';
import Sprint from '../models/Sprint.model.js';
import Project from '../models/Project.model.js';
import User from '../models/User.model.js';
import { refreshUserAiBurnoutNow } from '../services/aiRefresh.service.js';

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

export const getOverview = async (req, res) => {
  const userId = getUserIdString(req);
  if (!userId) {
    return apiResponse(res, 401, false, null, 'Not authorized');
  }

  const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';
  const requestedPmId = isAdmin && req.query?.pmId ? String(req.query.pmId) : null;
  let scopedUserId = req.user?._id;
  let scopedPm = null;

  if (requestedPmId) {
    scopedPm = await User.findById(requestedPmId)
      .select('_id name email avatar role status')
      .lean();

    if (!scopedPm || String(scopedPm.role || '').toLowerCase() !== 'pm') {
      return apiResponse(res, 404, false, null, 'PM scope not found');
    }

    scopedUserId = scopedPm._id;
  }

  let projects;
  if (isAdmin && !requestedPmId) {
    projects = await Project.find({ status: { $ne: 'archived' } }).select('_id').lean();
  } else {
    // PM overview is scoped to projects they own or are assigned to.
    projects = await Project.find({
      status: { $ne: 'archived' },
      $or: [{ owner: scopedUserId }, { 'members.user': scopedUserId }],
    })
      .select('_id')
      .lean();
  }

  const projectIds = projects.map((p) => p._id);
  const result =
    projectIds.length > 0
      ? await analyticsService.calculateOverview(projectIds)
      : {
          stats: {
            totalVelocity: 0,
            completionRate: 0,
            blockers: 0,
            cycleTimeDays: 0,
            velocityChangePct: null,
            completionChangePct: null,
          },
          orgPerformance: [],
          projectHealth: [],
        };

  const payload = scopedPm
    ? {
        ...result,
        scopedPm: {
          _id: scopedPm._id,
          name: scopedPm.name,
          email: scopedPm.email,
          avatar: scopedPm.avatar,
          status: scopedPm.status,
        },
      }
    : result;

  return apiResponse(res, 200, true, payload, 'Overview fetched successfully');
};

export const getOverviewPms = async (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return apiResponse(res, 403, false, null, 'Not authorized');
  }

  const pms = await User.find({ role: 'pm', status: { $ne: 'rejected' } })
    .select('_id name email avatar status')
    .lean();

  if (pms.length === 0) {
    return apiResponse(res, 200, true, [], 'PM analytics scopes fetched successfully');
  }

  const pmIds = pms.map((pm) => pm._id);

  const projects = await Project.find({
    status: { $ne: 'archived' },
    $or: [{ owner: { $in: pmIds } }, { 'members.user': { $in: pmIds } }],
  })
    .select('_id title owner members')
    .lean();

  const developersByPm = await User.aggregate([
    {
      $match: {
        role: 'developer',
        managedBy: { $in: pmIds },
      },
    },
    {
      $group: {
        _id: '$managedBy',
        count: { $sum: 1 },
      },
    },
  ]);

  const developerCountMap = new Map(
    developersByPm.map((entry) => [String(entry._id), Number(entry.count || 0)])
  );

  const pmScopes = pms
    .map((pm) => {
      const pmId = String(pm._id);
      const scopedProjects = projects
        .filter((project) => {
          const ownerId = project?.owner ? String(project.owner) : '';
          if (ownerId === pmId) return true;

          const members = Array.isArray(project?.members) ? project.members : [];
          return members.some((member) => String(member?.user) === pmId);
        })
        .map((project) => ({
          _id: project._id,
          title: project.title,
        }));

      return {
        _id: pm._id,
        name: pm.name,
        email: pm.email,
        avatar: pm.avatar,
        status: pm.status,
        developerCount: developerCountMap.get(pmId) || 0,
        projectCount: scopedProjects.length,
        projects: scopedProjects,
      };
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  return apiResponse(res, 200, true, pmScopes, 'PM analytics scopes fetched successfully');
};

export const getBurndown = async (req, res) => {
  const { sprintId } = req.params;

  const sprint = await ensureSprintAccess(req, res, sprintId);
  if (!sprint) return;

  const result = await analyticsService.calculateBurndown(sprintId);
  apiResponse(res, 200, true, result, 'Burndown fetched successfully');
};

export const getVelocity = async (req, res) => {
  const { projectId } = req.params;

  const project = await ensureProjectAccess(req, res, projectId);
  if (!project) return;

  const result = await analyticsService.calculateVelocity(projectId);
  apiResponse(res, 200, true, result, 'Velocity fetched successfully');
};

export const getTeamStats = async (req, res) => {
  const { projectId } = req.params;
  const { sprintId } = req.query;

  const project = await ensureProjectAccess(req, res, projectId);
  if (!project) return;

  const refreshCutoffMs = Date.now() - 2 * 60 * 1000;
  let result = await analyticsService.calculateTeamStats(projectId, {
    sprintId: sprintId || null,
  });

  const staleDeveloperIds = Array.from(
    new Set(
      (result || [])
        .filter((entry) => String(entry?.user?.role || '').toLowerCase() === 'developer')
        .filter((entry) => {
          const aiScoreMissing = entry?.aiBurnoutRiskScore === null || entry?.aiBurnoutRiskScore === undefined;
          if (aiScoreMissing) return true;

          const lastAnalyzedMs = entry?.aiBurnoutLastAnalyzedAt
            ? new Date(entry.aiBurnoutLastAnalyzedAt).getTime()
            : 0;

          if (!Number.isFinite(lastAnalyzedMs) || lastAnalyzedMs <= 0) return true;
          if (lastAnalyzedMs < refreshCutoffMs) return true;

          return Boolean(entry?.aiBurnoutStaleByActivity);
        })
        .map((entry) => String(entry?.user?._id || ''))
        .filter(Boolean)
    )
  );

  if (staleDeveloperIds.length > 0) {
    await Promise.allSettled(
      staleDeveloperIds.map((userId) => refreshUserAiBurnoutNow(userId, { pushHistory: false }))
    );

    result = await analyticsService.calculateTeamStats(projectId, {
      sprintId: sprintId || null,
    });
  }

  apiResponse(res, 200, true, result, 'Team stats fetched successfully');
};

export const getCompletionStats = async (req, res) => {
  const { sprintId } = req.params;
  
  const accessSprint = await ensureSprintAccess(req, res, sprintId);
  if (!accessSprint) return;

  const sprint = await Sprint.findById(sprintId);
  if (!sprint) return apiResponse(res, 404, false, null, 'Sprint not found');

  const tasks = await Task.find({ sprint: sprintId }).lean();
  const totalCounts = tasks.length;
  const completedCounts = tasks.filter(t => t.status === 'done').length;

  const types = tasks.reduce((acc, task) => {
    acc[task.type] = (acc[task.type] || 0) + 1;
    return acc;
  }, {});

  const result = {
    total: totalCounts,
    completed: completedCounts,
    completionPercentage: totalCounts > 0 ? (completedCounts / totalCounts) * 100 : 0,
    byType: types
  };

  apiResponse(res, 200, true, result, 'Completion stats fetched successfully');
};
