import React, { useEffect, useState } from 'react';
import { useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FaTachometerAlt, FaUserGraduate, FaChalkboardTeacher,
  FaUser, FaUsers, FaSchool, FaCog, FaSignOutAlt, FaBars, FaTimes,
  FaGraduationCap, FaClipboardCheck, FaCalendarAlt, FaStar,
  FaMoneyBillWave, FaBell, FaEnvelope, FaHistory, FaBullhorn,
  FaChevronDown, FaChevronRight,
} from 'react-icons/fa';
import NotificationDropdown from './NotificationDropdown';
import useAutoLogout from '../hooks/useAutoLogout';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const Dashboard = () => {
  useAutoLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [teacherHasClass, setTeacherHasClass] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isGuardian, setIsGuardian] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

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
          localStorage.removeItem('user_roles');
          navigate('/login');
          return;
        }

        if (!response.ok) throw new Error('Failed to fetch user data');

        const userData = await response.json();
        setUser(userData);

        const roles = userData.roles?.map(r => r.name) || [];
        setUserRoles(roles);
        setIsGuardian(userData.has_guardian_relationships || false);

        const isParent = roles.includes('Parent') || userData.has_guardian_relationships;
        if (isParent && location.pathname === '/dashboard') {
          navigate('/dashboard/current-records', { replace: true });
        }

        fetch(`${API_BASE}/api/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(res => res.json())
          .then(data => setUnreadNotifications(data.count || 0))
          .catch(() => {});

        fetch(`${API_BASE}/api/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(res => res.json())
          .then(data => setUnreadMessages(data.count || 0))
          .catch(() => {});

        if (roles.includes('Teacher')) {
          fetch(`${API_BASE}/api/teacher/assignments`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(res => res.json())
            .then(assignments => setTeacherHasClass(assignments.length > 0))
            .catch(() => setTeacherHasClass(false));
        }

        const welcomed = sessionStorage.getItem('dashboard_welcomed');
        if (!welcomed) {
          setShowWelcome(true);
          sessionStorage.setItem('dashboard_welcomed', 'true');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      fetch(`${API_BASE}/api/notifications/unread-count`, {
        headers: { Authorization: token },
      })
        .then(res => res.json())
        .then(data => setUnreadNotifications(data.count || 0))
        .catch(() => {});

      fetch(`${API_BASE}/api/messages/unread-count`, {
        headers: { Authorization: token },
      })
        .then(res => res.json())
        .then(data => setUnreadMessages(data.count || 0))
        .catch(() => {});
    }, 5000);

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

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  // ---------- Build sidebar groups ----------
  const groups = [];

  // Admin
  if (userRoles.includes('Admin')) {
    groups.push({
      name: 'Academic',
      icon: FaSchool,
      links: [
        { to: '/dashboard/academic', label: 'Academic Setup', icon: FaCog },
        { to: '/dashboard/enrollment', label: 'Enrollment', icon: FaUserGraduate },
      ],
    });
    groups.push({
      name: 'Assessment',
      icon: FaClipboardCheck,
      links: [
        { to: '/dashboard/grades', label: 'Grades', icon: FaStar },
        { to: '/dashboard/publish-grades', label: 'Publish Results', icon: FaClipboardCheck },
      ],
    });

    // Students group – if Admin also has Teacher role and teaches at least one class, include Attendance
    const studentLinks = [
      { to: '/dashboard/students', label: 'Students', icon: FaUserGraduate },
    ];
    if (userRoles.includes('Teacher') && teacherHasClass) {
      studentLinks.push({ to: '/dashboard/attendance', label: 'Attendance', icon: FaClipboardCheck });
    }
    groups.push({
      name: 'Students',
      icon: FaUserGraduate,
      links: studentLinks,
    });

    groups.push({
      name: 'Administration',
      icon: FaCog,
      links: [
        { to: '/dashboard/users', label: 'Users', icon: FaUsers },
        { to: '/dashboard/settings', label: 'Settings', icon: FaCog },
      ],
    });
  }

  // Finance Officer
  if (userRoles.includes('Finance Officer')) {
    groups.push({
      name: 'Finance',
      icon: FaMoneyBillWave,
      links: [
        { to: '/dashboard/finance', label: 'Finance', icon: FaMoneyBillWave },
      ],
    });
  }

  // Teacher (non‑Admin) – always show Students with Attendance if they have classes
  if (userRoles.includes('Teacher') && !userRoles.includes('Admin')) {
    groups.push({
      name: 'Assessment',
      icon: FaClipboardCheck,
      links: [
        { to: '/dashboard/grades', label: 'Grades', icon: FaStar },
      ],
    });

    const teacherStudentLinks = [
      { to: '/dashboard/students', label: 'Students', icon: FaUserGraduate },
    ];
    if (teacherHasClass) {
      teacherStudentLinks.push({ to: '/dashboard/attendance', label: 'Attendance', icon: FaClipboardCheck });
    }
    groups.push({
      name: 'Students',
      icon: FaUserGraduate,
      links: teacherStudentLinks,
    });
  }

  // Communication – for everyone, with conditional Events
  const communicationLinks = [
    { to: '/dashboard/announcements', label: 'Announcements', icon: FaBullhorn },
    { to: '/dashboard/messages', label: 'Messages', icon: FaEnvelope },
    { to: '/dashboard/notifications', label: 'Notifications', icon: FaBell },
  ];

  if (userRoles.some(role => ['Admin', 'Finance Officer', 'Teacher'].includes(role))) {
    communicationLinks.unshift({ to: '/dashboard/events', label: 'Events', icon: FaCalendarAlt });
  }

  groups.push({
    name: 'Communication',
    icon: FaBullhorn,
    links: communicationLinks,
  });

  // Parent Portal – for guardians only
  if (isGuardian) {
    groups.push({
      name: 'Parent Portal',
      icon: FaUserGraduate,
      links: [
        { to: '/dashboard/current-records', label: 'Current Records', icon: FaClipboardCheck },
        { to: '/dashboard/previous-records', label: 'Previous Records', icon: FaHistory },
        { to: '/dashboard/payments', label: 'Payments', icon: FaMoneyBillWave },
      ],
    });
  }

  const isOnlyParent = isGuardian && !userRoles.some(r => ['Admin', 'Teacher', 'Finance Officer'].includes(r));

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
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-blue-300 hover:text-white transition">
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {/* Dashboard link */}
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition ${
                isActive ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`
            }
          >
            <FaTachometerAlt className="text-lg" />
            {sidebarOpen && <span>Dashboard</span>}
          </NavLink>

          {/* Groups */}
          {groups.map(group => {
            if (isOnlyParent) {
              return (
                <div key={group.name}>
                  {sidebarOpen && (
                    <div className="px-4 py-2 text-xs text-blue-400 uppercase tracking-wider">
                      {group.name}
                    </div>
                  )}
                  {group.links.map((link, idx) => (
                    <NavLink
                      key={link.to + idx}
                      to={link.to}
                      end={link.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition ${
                          isActive ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                        }`
                      }
                    >
                      <link.icon className="text-lg" />
                      {sidebarOpen && <span>{link.label}</span>}
                    </NavLink>
                  ))}
                </div>
              );
            }

            const isOpen = openDropdown === group.name;
            return (
              <div key={group.name} className="mb-1">
                <button
                  onClick={() => toggleDropdown(group.name)}
                  className="flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-blue-200 hover:bg-blue-800 hover:text-white transition w-full"
                >
                  <group.icon className="text-lg" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left">{group.name}</span>
                      {isOpen ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
                    </>
                  )}
                </button>
                {isOpen && sidebarOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {group.links.map((link, idx) => (
                      <NavLink
                        key={link.to + idx}
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                            isActive ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                          }`
                        }
                      >
                        <link.icon className="text-sm" />
                        <span>{link.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Profile */}
          <NavLink
            to="/dashboard/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition ${
                isActive ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`
            }
          >
            <FaUser className="text-lg" />
            {sidebarOpen && <span>Profile</span>}
          </NavLink>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-blue-800">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2 text-blue-200 hover:bg-blue-800 hover:text-white rounded-lg transition">
            <FaSignOutAlt />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <header className="bg-white shadow-sm px-6 py-3 flex justify-between items-center sticky top-0 z-30">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <NotificationDropdown unreadCount={unreadNotifications} setUnreadCount={setUnreadNotifications} />
            <button
              onClick={() => navigate('/dashboard/messages')}
              className="relative text-gray-500 hover:text-blue-600 transition"
            >
              <FaEnvelope className="text-xl" />
              {unreadMessages > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {unreadMessages}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <img src={profilePicUrl || 'https://via.placeholder.com/40?text=U'} alt="User" className="w-10 h-10 rounded-full object-cover border-2 border-blue-600" />
              <span className="text-gray-700 font-medium hidden sm:block">
                {user?.first_name || user?.name || 'User'}
              </span>
            </div>
          </div>
        </header>

        {showWelcome && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between animate-fade-in">
            <div>
              <h2 className="text-xl font-bold">Welcome back, {user?.first_name || user?.name || 'User'}!</h2>
              <p className="text-sm text-blue-100 mt-1">
                You are logged in as <strong>{userRoles.join(', ')}</strong>
              </p>
            </div>
            <button onClick={() => setShowWelcome(false)} className="text-white hover:bg-blue-700 rounded-full p-1 transition">
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