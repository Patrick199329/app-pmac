import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppSettingsProvider } from './context/AppSettingsContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AccessGating from './pages/AccessGating';
import VideoPlayer from './pages/VideoPlayer';
import QuestionnaireStart from './pages/QuestionnaireStart';
import QuestionnaireEngine from './pages/QuestionnaireEngine';
import QuestionnaireFinish from './pages/QuestionnaireFinish';
import TieBreakerStart from './pages/TieBreakerStart';
import TieBreakerEngine from './pages/TieBreakerEngine';
import TieBreakerFinish from './pages/TieBreakerFinish';
import SubtypeStart from './pages/SubtypeStart';
import SubtypeEngine from './pages/SubtypeEngine';
import SubtypeFinish from './pages/SubtypeFinish';
import ResultView from './pages/ResultView';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageAccess from './pages/admin/ManageAccess';
import ManageVideos from './pages/admin/ManageVideos';
import ManageReports from './pages/admin/ManageReports';
import ManageQuestions from './pages/admin/ManageQuestions';
import IntegrityCheck from './pages/admin/IntegrityCheck';
import AppConfig from './pages/admin/AppConfig';
import AuditReport from './pages/admin/AuditReport';

import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AppSettingsProvider>
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Main App Routes with Layout */}
          <Route element={<Layout />}>
            <Route path="/access" element={<AccessGating />} />

            {/* Protected Test Routes Group */}
            <Route element={<ProtectedRoute />}>
              <Route path="/video/:key" element={<VideoPlayer />} />
              <Route path="/basic/start" element={<QuestionnaireStart />} />
              <Route path="/basic/q/:index" element={<QuestionnaireEngine />} />
              <Route path="/basic/finish" element={<QuestionnaireFinish />} />

              <Route path="/de/start" element={<TieBreakerStart />} />
              <Route path="/de/q/:step" element={<TieBreakerEngine />} />
              <Route path="/de/finish" element={<TieBreakerFinish />} />

              <Route path="/st/start" element={<SubtypeStart />} />
              <Route path="/st/q/:step" element={<SubtypeEngine />} />
              <Route path="/st/finish" element={<SubtypeFinish />} />

              <Route path="/result/:attemptId" element={<ResultView />} />
            </Route>

            {/* Administrative Routes Group */}
            <Route element={<ProtectedRoute requireAdmin />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/access" element={<ManageAccess />} />
              <Route path="/admin/videos" element={<ManageVideos />} />
              <Route path="/admin/reports" element={<ManageReports />} />
              <Route path="/admin/questions" element={<ManageQuestions />} />
              <Route path="/admin/integrity" element={<IntegrityCheck />} />
              <Route path="/admin/config" element={<AppConfig />} />
              <Route path="/admin/audit/:userId" element={<AuditReport />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/access" replace />} />
          </Route>
        </Routes>
      </Router>
    </AppSettingsProvider>
  );
}

export default App;
