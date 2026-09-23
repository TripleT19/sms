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
import PreviousRecords from './components/PreviousRecords';  // ← imported component
import ParentMessages from './components/ParentMessages';
import ParentPayments from './components/ParentPayments';
import AnnouncementsPage from './components/AnnouncementsPage';
import StudentsPage from './components/StudentsPage';

// Overview pages
import AdminOverview from './components/AdminOverview';
import TeacherOverview from './components/TeacherOverview';
import FinanceOverview from './components/FinanceOverview';
import HeadteacherDashboard from './components/HeadteacherDashboard';
import DeputyHeadteacherDashboard from './components/DeputyHeadteacherDashboard';
import DirectorDashboard from './components/DirectorDashboard';
import ParentDashboard from './components/ParentDashboard';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('auth_token');
  if (!token) return <Navigate to="/login" replace />;
  if (!allowedRoles || allowedRoles.length === 0) return children;
  const stored = localStorage.getItem('user_roles');
  const roles = stored ? JSON.parse(stored) : [];
  const hasAccess = allowedRoles.some(role => roles.includes(role));
  return hasAccess ? children : <Navigate to="/dashboard" replace />;
};

const Home = () => (
  <div><h2 className="text-2xl font-semibold mb-4 text-gray-800">Dashboard Overview</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-xl shadow">Total Students: 250</div><div className="bg-white p-6 rounded-xl shadow">Total Teachers: 35</div><div className="bg-white p-6 rounded-xl shadow">Active Courses: 12</div></div></div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Home />} />   {/* fallback – never seen because of redirect */}

          {/* Admin */}
          <Route path="admin-overview" element={<ProtectedRoute allowedRoles={['Admin']}><AdminOverview /></ProtectedRoute>} />
          <Route path="academic" element={<ProtectedRoute allowedRoles={['Admin']}><AcademicManagementPage /></ProtectedRoute>} />
          <Route path="enrollment" element={<ProtectedRoute allowedRoles={['Admin']}><StudentEnrollmentPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagementPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['Admin']}><SchoolInfoPage /></ProtectedRoute>} />
          <Route path="publish-grades" element={<ProtectedRoute allowedRoles={['Admin']}><PublishGradesPage /></ProtectedRoute>} />

          {/* Director */}
          <Route path="director" element={<ProtectedRoute allowedRoles={['Director', 'Admin']}><DirectorDashboard /></ProtectedRoute>} />

          {/* Finance Officer */}
          <Route path="finance-overview" element={<ProtectedRoute allowedRoles={['Finance Officer']}><FinanceOverview /></ProtectedRoute>} />
          <Route path="finance" element={<ProtectedRoute allowedRoles={['Finance Officer']}><FinancePage /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="events" element={<ProtectedRoute allowedRoles={['Admin', 'Finance Officer', 'Teacher', 'Director', 'Headteacher', 'Deputy Headteacher']}><EventsPage /></ProtectedRoute>} />

          {/* Teacher */}
          <Route path="teacher-overview" element={<ProtectedRoute allowedRoles={['Teacher']}><TeacherOverview /></ProtectedRoute>} />
          <Route path="grades" element={<ProtectedRoute allowedRoles={['Admin', 'Teacher', 'Director', 'Headteacher', 'Deputy Headteacher']}><GradesPage /></ProtectedRoute>} />
          <Route path="students" element={<ProtectedRoute allowedRoles={['Teacher', 'Admin', 'Director', 'Headteacher', 'Deputy Headteacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="attendance" element={<ProtectedRoute allowedRoles={['Teacher']}><AttendancePage /></ProtectedRoute>} />

          {/* Headteacher */}
          <Route path="headteacher" element={<ProtectedRoute allowedRoles={['Headteacher', 'Admin']}><HeadteacherDashboard /></ProtectedRoute>} />

          {/* Deputy Headteacher */}
          <Route path="deputy-headteacher" element={<ProtectedRoute allowedRoles={['Deputy Headteacher', 'Admin']}><DeputyHeadteacherDashboard /></ProtectedRoute>} />

          {/* Parent */}
          <Route path="current-records" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><CurrentRecords /></ProtectedRoute>} />
          <Route path="previous-records" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><PreviousRecords /></ProtectedRoute>} />
          <Route path="payments" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><ParentPayments /></ProtectedRoute>} />
          <Route path="parent-dashboard" element={<ProtectedRoute allowedRoles={['Parent', 'Admin']}><ParentDashboard /></ProtectedRoute>} />

          {/* Announcements – all authenticated users */}
          <Route path="announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />

          {/* Messages – all authenticated users */}
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