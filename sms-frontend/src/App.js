import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import ProfilePage from './components/ProfilePage';
import PasswordResetPage from './components/PasswordResetPage';
import UserManagementPage from './components/UserManagementPage';
import AcademicManagementPage from './components/AcademicManagementPage';
import StudentEnrollmentPage from './components/StudentEnrollmentPage';
import AttendancePage from './components/AttendancePage';
import EventsPage from './components/EventsPage';
import GradesPage from './components/GradesPage';
import FinancePage from './components/FinancePage';
import SchoolInfoPage from './components/SchoolInfoPage';
import NotificationsPage from './components/NotificationsPage';
import PublishGradesPage from './components/PublishGradesPage';
import CurrentRecords from './components/CurrentRecords';
import ParentMessages from './components/ParentMessages';
import ParentPayments from './components/ParentPayments';
import AnnouncementsPage from './components/AnnouncementsPage';
import StudentsPage from './components/StudentsPage';

const PreviousRecords = () => (
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-gray-800">Previous Records</h2>
    <p className="text-gray-600 mt-2">Past term records are displayed here.</p>
  </div>
);

const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('auth_token');
  if (!token) return <Navigate to="/login" replace />;

  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }

  const stored = localStorage.getItem('user_roles');
  const roles = stored ? JSON.parse(stored) : [];
  const hasAccess = allowedRoles.some(role => roles.includes(role));

  return hasAccess ? children : <Navigate to="/dashboard" replace />;
};

const Home = () => (
  <div>
    <h2 className="text-2xl font-semibold mb-4 text-gray-800">Dashboard Overview</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow">Total Students: 250</div>
      <div className="bg-white p-6 rounded-xl shadow">Total Teachers: 35</div>
      <div className="bg-white p-6 rounded-xl shadow">Active Courses: 12</div>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />

        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Home />} />

          {/* Admin */}
          <Route path="academic" element={<ProtectedRoute allowedRoles={['Admin']}><AcademicManagementPage /></ProtectedRoute>} />
          <Route path="enrollment" element={<ProtectedRoute allowedRoles={['Admin']}><StudentEnrollmentPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagementPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['Admin']}><SchoolInfoPage /></ProtectedRoute>} />
          <Route path="publish-grades" element={<ProtectedRoute allowedRoles={['Admin']}><PublishGradesPage /></ProtectedRoute>} />

          {/* Finance Officer */}
          <Route path="finance" element={<ProtectedRoute allowedRoles={['Finance Officer']}><FinancePage /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="events" element={<ProtectedRoute allowedRoles={['Admin', 'Finance Officer', 'Teacher']}><EventsPage /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="grades" element={<ProtectedRoute allowedRoles={['Admin', 'Teacher']}><GradesPage /></ProtectedRoute>} />
          <Route path="students" element={<ProtectedRoute allowedRoles={['Teacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute allowedRoles={['Teacher']}><AttendancePage /></ProtectedRoute>} />

          {/* Parent */}
          <Route path="current-records" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><CurrentRecords /></ProtectedRoute>} />
          <Route path="previous-records" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><PreviousRecords /></ProtectedRoute>} />
          <Route path="payments" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><ParentPayments /></ProtectedRoute>} />

          {/* Announcements – accessible to all authenticated users */}
          <Route path="announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />

          {/* Messages – accessible to every authenticated user */}
          <Route path="messages" element={<ProtectedRoute><ParentMessages /></ProtectedRoute>} />

          {/* Common */}
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;