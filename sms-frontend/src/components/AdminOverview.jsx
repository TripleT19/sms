import React, { useState, useEffect } from 'react';
import {
  FaUsers, FaChalkboardTeacher, FaUserGraduate, FaUserCheck,
  FaUserTimes, FaSchool, FaClipboardCheck, FaCheckCircle,
  FaSpinner, FaBullhorn, FaHistory,
} from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/* ===================================================
   Modern, compact SVG Bar Chart
   =================================================== */
const BarChart = ({ data, title, color = '#4f46e5' }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const chartWidth = Math.max(data.length * 40 + 40, 200);
  const chartHeight = 120;   // compact height
  const barWidth = 18;

  // Create a unique gradient ID for this chart
  const gradientId = `bar-grad-${title.replace(/\s/g, '')}`;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <svg
        width="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, max / 2, max].map((val, i) => {
          const y = chartHeight - (val / max) * chartHeight;
          return (
            <g key={i}>
              <line
                x1="30" y1={y}
                x2={chartWidth} y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="28" y={y + 4}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
              >
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = (item.value / max) * chartHeight;
          const x = 40 + idx * 40;
          const y = chartHeight - barHeight;
          return (
            <g key={idx}>
              {/* Bar with rounded top corners */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={`url(#${gradientId})`}
                rx="3"
              />
              {/* Value on top */}
              <text
                x={x + barWidth / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize="9"
                fill="#334155"
                fontWeight="500"
              >
                {item.value}
              </text>
              {/* Label below */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 15}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ===================================================
   Modern, compact SVG Line Chart
   =================================================== */
const LineChart = ({ data, title, color = '#4f46e5' }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const chartWidth = Math.max(data.length * 40 + 40, 200);
  const chartHeight = 120;   // compact height

  // Convert data to points
  const points = data
    .map((item, idx) => {
      const x = 40 + idx * 40;
      const y = chartHeight - (item.value / max) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const gradientId = `line-grad-${title.replace(/\s/g, '')}`;
  const areaPath = points + ` ${40 + (data.length - 1) * 40},${chartHeight} 40,${chartHeight}`;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <svg
        width="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, max / 2, max].map((val, i) => {
          const y = chartHeight - (val / max) * chartHeight;
          return (
            <g key={i}>
              <line
                x1="30" y1={y}
                x2={chartWidth} y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x="28" y={y + 4}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
              >
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Area under line */}
        <polygon
          points={areaPath}
          fill={`url(#${gradientId})`}
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {data.map((item, idx) => {
          const x = 40 + idx * 40;
          const y = chartHeight - (item.value / max) * chartHeight;
          return (
            <g key={idx}>
              <circle cx={x} cy={y} r="4" fill="#fff" stroke={color} strokeWidth="2" />
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                fontSize="9"
                fill="#334155"
                fontWeight="500"
              >
                {item.value}
              </text>
              <text
                x={x}
                y={chartHeight + 15}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const AdminOverview = () => {
  const token = localStorage.getItem('auth_token');
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        const [statsRes, annRes, logRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/stats`, { headers }),
          fetch(`${API_BASE}/api/events?type=announcement`, { headers }),
          fetch(`${API_BASE}/api/logs/recent?limit=5`, { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (annRes.ok) setAnnouncements(await annRes.json());
        if (logRes.ok) setLogs(await logRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading || !stats) {
    return (
      <div className="p-6 flex justify-center">
        <FaSpinner className="animate-spin text-2xl text-indigo-600" />
      </div>
    );
  }

  const admissionsData = stats.monthly_admissions?.map(item => ({
    label: item.month.substring(0, 3),   // e.g. "Jul"
    value: item.count,
  })) || [];

  const growthData = stats.student_growth?.map(item => ({
    label: item.month.substring(0, 3),
    value: item.total,
  })) || [];

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-900 mb-8">Admin Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Parents', value: stats.parents, icon: FaUsers, color: 'bg-blue-100 text-blue-600' },
          { label: 'Staff', value: stats.staff, icon: FaChalkboardTeacher, color: 'bg-green-100 text-green-600' },
          { label: 'Students', value: stats.students, icon: FaUserGraduate, color: 'bg-indigo-100 text-indigo-600' },
          { label: 'Active Users', value: stats.active_users, icon: FaUserCheck, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'Classes', value: stats.classes, icon: FaSchool, color: 'bg-amber-100 text-amber-600' },
          { label: 'To Publish', value: stats.submitted_results, icon: FaClipboardCheck, color: 'bg-orange-100 text-orange-600' },
          { label: 'Published', value: stats.published_results, icon: FaCheckCircle, color: 'bg-teal-100 text-teal-600' },
          { label: 'New Students', value: stats.new_students, icon: FaUserGraduate, color: 'bg-cyan-100 text-cyan-600' },
        ].map(card => (
          <div key={card.label} className="bg-white p-3 rounded-xl shadow flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.color}`}>
              <card.icon className="text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-600">{card.label}</p>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts – side by side on large screens, stack on small */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <BarChart data={admissionsData} title="Monthly Admissions" color="#4f46e5" />
        <LineChart data={growthData} title="Student Growth" color="#10b981" />
      </div>

      {/* Announcements & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaBullhorn className="text-indigo-500" /> Announcements
          </h2>
          {announcements.length === 0 ? (
            <p className="text-gray-500">No announcements.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.slice(0, 5).map(ann => (
                <li key={ann.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{ann.title}</p>
                  {ann.description && <p className="text-sm text-gray-600">{ann.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(ann.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaHistory className="text-indigo-500" /> Recent Activity
          </h2>
          {logs.length === 0 ? (
            <p className="text-gray-500">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map(log => (
                <li key={log.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">{log.user?.first_name} {log.user?.last_name}</span> – {log.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(log.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;