import React, { useEffect, useState } from 'react';
import { useNavigate, NavLink, Outlet, Link } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaBook,
  FaUser,
  FaUsers,
  FaSchool,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaGraduationCap,
  FaClipboardCheck,
  FaCalendarAlt,
  FaStar,
  FaMoneyBillWave,
  FaBell,
  FaEnvelope,
  FaHistory,
  FaBullhorn,
  FaCheckCircle,
} from 'react-icons/fa';
import NotificationDropdown from './NotificationDropdown';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [teacherHasClass, setTeacherHasClass] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Fetch user data and teacher assignments
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          navigate('/login');
          return;
        }

        if (!response.ok) throw new Error('Failed to fetch user');

        const userData = await response.json();
        setUser(userData);

        const roles = userData.roles?.map(r => r.name) || [];
        setUserRoles(roles);

        // Fetch unread notification count immediately after login
        const countRes = await fetch(`${API_BASE}/api/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (countRes.ok) {
          const countData = await countRes.json();
          setUnreadNotifications(countData.count || 0);
        }

        // Check teacher assignments for Attendance link
        if (roles.includes('Teacher')) {
          try {
            const assignRes = await fetch(`${API_BASE}/api/teacher/assignments`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (assignRes.ok) {
              const assignments = await assignRes.json();
              setTeacherHasClass(assignments.length > 0);
            }
          } catch {
            setTeacherHasClass(false);
          }
        }

        // Show welcome banner only once per session
        const welcomed = sessionStorage.getItem('dashboard_welcomed');
        if (!welcomed) {
          setShowWelcome(true);
          sessionStorage.setItem('dashboard_welcomed', 'true');
        }
      } catch (error) {
        console.error(error);
        localStorage.removeItem('auth_token');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate]);

  // Auto‑dismiss welcome after 5 seconds
  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  // Periodically refresh unread count every 30 seconds
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadNotifications(data.count || 0);
        }
      } catch {
        // ignore
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      await fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_roles');
    sessionStorage.removeItem('dashboard_welcomed');
    navigate('/login');
  };

  // Build dynamic sidebar links
  const links = [];

  if (userRoles.includes('Admin')) {
    links.push(
      { to: '/dashboard', icon: FaTachometerAlt, label: 'Dashboard', end: true },
      { to: '/dashboard/academic', icon: FaSchool, label: 'Academic' },
      { to: '/dashboard/enrollment', icon: FaUserGraduate, label: 'Enrollment' },
      { to: '/dashboard/events', icon: FaCalendarAlt, label: 'Events' },
      { to: '/dashboard/grades', icon: FaStar, label: 'Grades' },
      { to: '/dashboard/publish-grades', icon: FaCheckCircle, label: 'Publish Grades' },
      { to: '/dashboard/profile', icon: FaUser, label: 'Profile' },
      { to: '/dashboard/users', icon: FaUsers, label: 'Users' },
      { to: '/dashboard/settings', icon: FaCog, label: 'Settings' },
    );
  }

  if (userRoles.includes('Finance Officer')) {
    links.push(
      { to: '/dashboard', icon: FaTachometerAlt, label: 'Dashboard', end: true },
      { to: '/dashboard/finance', icon: FaMoneyBillWave, label: 'Finance' },
      { to: '/dashboard/events', icon: FaCalendarAlt, label: 'Events' },
      { to: '/dashboard/profile', icon: FaUser, label: 'Profile' },
    );
  }

  if (userRoles.includes('Teacher')) {
    links.push(
      { to: '/dashboard', icon: FaTachometerAlt, label: 'Dashboard', end: true },
      { to: '/dashboard/grades', icon: FaStar, label: 'Grades' },
      { to: '/dashboard/events', icon: FaCalendarAlt, label: 'Events' },
      { to: '/dashboard/profile', icon: FaUser, label: 'Profile' },
      { to: '/dashboard/students', icon: FaUserGraduate, label: 'Students' },
    );
    if (teacherHasClass) {
      links.push({ to: '/dashboard/attendance', icon: FaClipboardCheck, label: 'Attendance' });
    }
  }

  if (userRoles.includes('Parent')) {
    links.push(
      { to: '/dashboard', icon: FaTachometerAlt, label: 'Dashboard', end: true },
      { to: '/dashboard/profile', icon: FaUser, label: 'Profile' },
      { to: '/dashboard/current-records', icon: FaClipboardCheck, label: 'Current Records' },
      { to: '/dashboard/previous-records', icon: FaHistory, label: 'Previous Records' },
      { to: '/dashboard/payments', icon: FaMoneyBillWave, label: 'Payments' },
      { to: '/dashboard/announcements', icon: FaBullhorn, label: 'Announcements' },
    );
  }

  // Common Notifications link (for every role) – still in sidebar for full page access
  links.push({ to: '/dashboard/notifications', icon: FaBell, label: 'Notifications' });

  // Remove duplicates
  const uniqueLinks = [];
  const seen = new Set();
  links.forEach(link => {
    const key = link.to + (link.end ? 'end' : '');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLinks.push(link);
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <p className="text-gray-600 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  const profilePicUrl = user?.profile_pic
    ? `${API_BASE}/storage/${user.profile_pic}`
    : null;

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-blue-950 text-white flex flex-col transition-all duration-300 ease-in-out z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-6 border-b border-blue-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <FaGraduationCap className="text-2xl text-blue-300" />
              <span className="text-xl font-bold">EduManage</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-blue-300 hover:text-white transition"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {uniqueLinks.map((link, index) => (
            <NavLink
              key={link.to + index}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-800 text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`
              }
            >
              <link.icon className="text-lg" />
              {sidebarOpen && <span>{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-blue-200 hover:bg-blue-800 hover:text-white rounded-lg transition"
          >
            <FaSignOutAlt />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <header className="bg-white shadow-sm px-6 py-3 flex justify-between items-center sticky top-0 z-30">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* Notification dropdown replaces the old bell link */}
            <NotificationDropdown
              unreadCount={unreadNotifications}
              setUnreadCount={setUnreadNotifications}
            />

            {/* Messages (placeholder) */}
            <button className="relative text-gray-500 hover:text-blue-600 transition">
              <FaEnvelope className="text-xl" />
              {/* static badge – could be made dynamic later */}
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                0
              </span>
            </button>

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <img
                src={
                  profilePicUrl ||
                  'https://via.placeholder.com/40?text=U'
                }
                alt="User"
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-600"
              />
              <span className="text-gray-700 font-medium hidden sm:block">
                {user?.first_name || user?.name || 'User'}
              </span>
            </div>
          </div>
        </header>

        {showWelcome && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between animate-fade-in">
            <div>
              <h2 className="text-xl font-bold">
                Welcome back, {user?.first_name || user?.name || 'User'}!
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                You are logged in as <strong>{userRoles.join(', ')}</strong>
              </p>
            </div>
            <button
              onClick={() => setShowWelcome(false)}
              className="text-white hover:bg-blue-700 rounded-full p-1 transition"
            >
              <FaTimes />
            </button>
          </div>
        )}

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
