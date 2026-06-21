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

// ---------- Simple placeholder pages for missing views ----------
const TeacherStudentsPage = () => (
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-gray-800">My Students</h2>
    <p className="text-gray-600 mt-2">List of your students will appear here.</p>
  </div>
);

const CurrentRecords = () => (
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-gray-800">Current Records</h2>
    <p className="text-gray-600 mt-2">Your child’s current term records will show here.</p>
  </div>
);

const PreviousRecords = () => (
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-gray-800">Previous Records</h2>
    <p className="text-gray-600 mt-2">Past term records are displayed here.</p>
  </div>
);

const ParentPayments = () => (
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-gray-800">Payments</h2>
    <p className="text-gray-600 mt-2">Your payment history will appear here.</p>
  </div>
);

const Announcements = () => (
  <div className="p-6">
    <h2 className="text-2xl font-semibold text-gray-800">Announcements</h2>
    <p className="text-gray-600 mt-2">School and class announcements will be shown here.</p>
  </div>
);

// ---------- Role-based access guard ----------
const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('auth_token');
  if (!token) return <Navigate to="/login" replace />;

  const stored = localStorage.getItem('user_roles');
  const roles = stored ? JSON.parse(stored) : [];
  const hasAccess = allowedRoles.some(role => roles.includes(role));

  return hasAccess ? children : <Navigate to="/dashboard" replace />;
};

// ---------- Dashboard home placeholder (used as index route) ----------
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

// ---------- App Component ----------
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />

        {/* Dashboard with nested routes */}
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Home />} />

          {/* Admin only */}
          <Route
            path="academic"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AcademicManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="enrollment"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <StudentEnrollmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <SchoolInfoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="publish-grades"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <PublishGradesPage />
              </ProtectedRoute>
            }
          />

          {/* Finance Officer only */}
          <Route
            path="finance"
            element={
              <ProtectedRoute allowedRoles={['Finance Officer']}>
                <FinancePage />
              </ProtectedRoute>
            }
          />

          {/* Shared: Admin, Finance Officer, Teacher */}
          <Route
            path="events"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Finance Officer', 'Teacher']}>
                <EventsPage />
              </ProtectedRoute>
            }
          />

          {/* Teacher only */}
          <Route
            path="grades"
            element={
              <ProtectedRoute allowedRoles={['Teacher']}>
                <GradesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="students"
            element={
              <ProtectedRoute allowedRoles={['Teacher']}>
                <TeacherStudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance"
            element={
              <ProtectedRoute allowedRoles={['Teacher']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          {/* Parent only */}
          <Route
            path="current-records"
            element={
              <ProtectedRoute allowedRoles={['Parent']}>
                <CurrentRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="previous-records"
            element={
              <ProtectedRoute allowedRoles={['Parent']}>
                <PreviousRecords />
              </ProtectedRoute>
            }
          />
          <Route
            path="payments"
            element={
              <ProtectedRoute allowedRoles={['Parent']}>
                <ParentPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="announcements"
            element={
              <ProtectedRoute allowedRoles={['Parent']}>
                <Announcements />
              </ProtectedRoute>
            }
          />

          {/* Open to all authenticated users */}
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;