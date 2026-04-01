import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { BacklogPage } from './pages/BacklogPage';
import { SharedBoardPage } from './pages/SharedBoardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TeamPage } from './pages/TeamPage';
import { AdminPage } from './pages/AdminPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AIInsightsPage } from './pages/AIInsightsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PendingPage } from './pages/PendingPage';
import { MyTasksPage } from './pages/MyTasksPage';

// PM Specific Imports
import { PMLayout } from './components/layout/PMLayout';
import { PmDashboardPage } from './pages/pm/PmDashboardPage';
import { PmTeamPage } from './pages/pm/PmTeamPage';
import { PmAnalyticsPage } from './pages/pm/PmAnalyticsPage';

import useAuthStore from './store/authStore';
import { Toaster } from 'react-hot-toast';

// Protected Route Wrapper (For Admins and Developers)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role?.toLowerCase() !== 'admin' && user?.status === 'pending') return <Navigate to="/pending" replace />;
  
  // Phase 4 Strict Fork: Divert PMs to their isolated routes
  if (user?.role?.toLowerCase() === 'pm') return <Navigate to="/pm/dashboard" replace />;
  
  return children;
};

// PM Specific Route Wrapper
const PMRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.status === 'pending') return <Navigate to="/pending" replace />;
  if (user?.role?.toLowerCase() !== 'pm' && user?.role?.toLowerCase() !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

// Pending Route Wrapper
const PendingRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Admins bypass pending screen automatically
  if (user?.role?.toLowerCase() === 'admin' || user?.status !== 'pending') return <Navigate to="/dashboard" replace />;
  return children;
};

// Fixed by @Frontend — Admin only route guard
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Admins bypass pending check implicitly here, but just in case:
  if (user?.role?.toLowerCase() !== 'admin') {
    if (user?.status === 'pending') return <Navigate to="/pending" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Fixed by @Frontend â€” Role-based route guard
const RoleRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const normalizedRole = user?.role?.toLowerCase();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (normalizedRole !== 'admin' && user?.status === 'pending') return <Navigate to="/pending" replace />;
  if (!roles.includes(normalizedRole)) return <Navigate to="/dashboard" replace />;
  return children;
};

// Global App wrapper
function App() {
  const navigate = useNavigate();

  useEffect(() => {
    // Axios interceptors are self-initializing in src/api/axiosInstance.js
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<AuthPage />} />

        {/* Pending Route */}
        <Route path="/pending" element={<PendingRoute><PendingPage /></PendingRoute>} />

        {/* Phase 4: Isolated PM Routes */}
        <Route path="/pm" element={<PMRoute><PMLayout /></PMRoute>}>
          <Route path="dashboard" element={<PmDashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="backlog" element={<BacklogPage />} />
          <Route path="board" element={<SharedBoardPage />} />
          <Route path="analytics" element={<PmAnalyticsPage />} />
          <Route path="team" element={<PmTeamPage />} />
          <Route path="profile" element={<div className="p-10 text-center text-slate-500">Profile UI Constructing...</div>} />
        </Route>

        {/* Protected Routes (Dev/Admin) */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/my-tasks" element={<ProtectedRoute><MyTasksPage /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
        
        {/* Project Specific Routes */}
        <Route path="/projects/:projectId/backlog" element={<ProtectedRoute><BacklogPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/board" element={<ProtectedRoute><SharedBoardPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/sprints/:sprintId" element={<ProtectedRoute><SharedBoardPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
        
        {/* Global Nav Routes */}
        <Route path="/team" element={<RoleRoute roles={['admin', 'pm']}><TeamPage /></RoleRoute>} />
        <Route path="/analytics" element={<RoleRoute roles={['admin', 'pm']}><AnalyticsPage /></RoleRoute>} />
        <Route path="/ai-insights" element={
          <RoleRoute roles={['admin', 'pm']}>
            <AIInsightsPage />
          </RoleRoute>
        } />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        
        {/* Admin only */}
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
