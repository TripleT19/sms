import React, { useState, useEffect } from 'react';
import {
  FaUserGraduate, FaMoneyBillWave, FaChartLine, FaClipboardCheck,
  FaCalendarAlt, FaSpinner, FaBullhorn, FaHistory,
} from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const HeadteacherDashboard = () => {
  const token = localStorage.getItem('auth_token');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, classes: 0 });
  const [performance, setPerformance] = useState({ term: '', classes: [] });
  const [finance, setFinance] = useState({ term: '', total_fees: 0, collected: 0, outstanding: 0 });
  const [tasks, setTasks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        const [studentsRes, classesRes, perfRes, finRes, tasksRes, announcementsRes, logsRes] = await Promise.all([
          fetch(`${API_BASE}/api/students`, { headers }),
          fetch(`${API_BASE}/api/academic/classes`, { headers }),
          fetch(`${API_BASE}/api/statistics/performance`, { headers }),
          fetch(`${API_BASE}/api/statistics/finance`, { headers }),
          fetch(`${API_BASE}/api/events?type=task`, { headers }),
          fetch(`${API_BASE}/api/events?type=announcement`, { headers }),
          fetch(`${API_BASE}/api/logs/recent?limit=5`, { headers }),
        ]);

        let studentCount = 0;
        if (studentsRes.ok) {
          const data = await studentsRes.json();
          Object.values(data).forEach(arr => { studentCount += arr.length; });
        }
        let classCount = 0;
        if (classesRes.ok) {
          const data = await classesRes.json();
          classCount = data.length;
        }

        setStats({ students: studentCount, classes: classCount });
        if (perfRes.ok) setPerformance(await perfRes.json());
        if (finRes.ok) setFinance(await finRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (announcementsRes.ok) setAnnouncements(await announcementsRes.json());
        if (logsRes.ok) setLogs(await logsRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [token]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <FaSpinner className="animate-spin text-2xl text-indigo-600" />
      </div>
    );
  }

  const avgPerformance = performance.classes.length > 0
    ? (performance.classes.reduce((sum, c) => sum + (c.average || 0), 0) / performance.classes.length).toFixed(1)
    : '—';

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-900 mb-8">Headteacher Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg"><FaUserGraduate className="text-2xl text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-600">Total Students</p>
            <p className="text-2xl font-bold text-blue-900">{stats.students}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-lg"><FaMoneyBillWave className="text-2xl text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-600">Fees Collected ({finance.term})</p>
            <p className="text-2xl font-bold text-green-900">MK {finance.collected?.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow flex items-center gap-4">
          <div className="bg-amber-100 p-3 rounded-lg"><FaChartLine className="text-2xl text-amber-600" /></div>
          <div>
            <p className="text-sm text-gray-600">Avg Performance ({performance.term})</p>
            <p className="text-2xl font-bold text-amber-900">{avgPerformance}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Class Performance ({performance.term})</h2>
          {performance.classes.length === 0 ? (
            <p className="text-gray-500">No data available.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50"><tr><th className="p-2">Class</th><th className="p-2">Avg Score</th><th className="p-2">Students</th></tr></thead>
              <tbody>
                {performance.classes.map(cls => (
                  <tr key={cls.class_id} className="border-t">
                    <td className="p-2">{cls.class_name}</td>
                    <td className="p-2">{cls.average ?? '—'}</td>
                    <td className="p-2">{cls.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Finance ({finance.term})</h2>
          <div className="flex justify-between mb-4"><span>Total Billed</span><span className="font-bold">MK {finance.total_fees?.toLocaleString()}</span></div>
          <div className="flex justify-between mb-4"><span>Collected</span><span className="font-bold text-green-600">MK {finance.collected?.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Outstanding</span><span className="font-bold text-red-600">MK {finance.outstanding?.toLocaleString()}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><FaClipboardCheck className="text-indigo-500" /> Tasks</h2>
          {tasks.length === 0 ? <p className="text-gray-500">No tasks.</p> : (
            <ul className="space-y-2">{tasks.slice(0, 5).map(task => (
              <li key={task.id} className="p-2 bg-gray-50 rounded">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-gray-500">{task.deadline ? 'Due: ' + new Date(task.deadline).toLocaleDateString() : ''}</p>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><FaBullhorn className="text-indigo-500" /> Announcements</h2>
          {announcements.length === 0 ? <p className="text-gray-500">No announcements.</p> : (
            <ul className="space-y-2">{announcements.slice(0, 5).map(ann => (
              <li key={ann.id} className="p-2 bg-gray-50 rounded">
                <p className="font-medium">{ann.title}</p>
                <p className="text-xs text-gray-400">{formatDateTime(ann.created_at)}</p>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"><FaHistory className="text-indigo-500" /> Recent Activity</h2>
          {logs.length === 0 ? <p className="text-gray-500">No recent activity.</p> : (
            <ul className="space-y-2">{logs.map(log => (
              <li key={log.id} className="p-2 bg-gray-50 rounded">
                <p className="text-sm"><span className="font-medium">{log.user?.first_name} {log.user?.last_name}</span> – {log.description}</p>
                <p className="text-xs text-gray-400">{formatDateTime(log.created_at)}</p>
              </li>
            ))}</ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeadteacherDashboard;