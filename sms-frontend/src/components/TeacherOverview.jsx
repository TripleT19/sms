import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUserGraduate, FaStar, FaSpinner, FaBullhorn, FaHistory, FaClipboardCheck,
} from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const TeacherOverview = () => {
  const token = localStorage.getItem('auth_token');
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        const [assignRes, tasksRes, annRes, logRes] = await Promise.all([
          fetch(`${API_BASE}/api/teacher/assignments`, { headers }),
          fetch(`${API_BASE}/api/events?type=task`, { headers }),
          fetch(`${API_BASE}/api/events?type=announcement`, { headers }),
          fetch(`${API_BASE}/api/logs/recent?limit=5`, { headers }),
        ]);
        if (assignRes.ok) setAssignments(await assignRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (annRes.ok) setAnnouncements(await annRes.json());
        if (logRes.ok) setLogs(await logRes.json());
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

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-900 mb-8">Teacher Dashboard</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">My Classes</h2>
        {assignments.length === 0 ? (
          <p className="text-gray-500">You are not assigned to any class.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assignments.map(cls => (
              <div key={cls.id} className="bg-white p-4 rounded-xl shadow">
                <h3 className="font-bold text-gray-800">{cls.name}</h3>
                <div className="flex flex-wrap gap-1 mt-2">
                  {cls.streams?.map(s => (
                    <span key={s.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{s.name}</span>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigate('/dashboard/grades')} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full">Grades</button>
                  <button onClick={() => navigate('/dashboard/students')} className="text-xs bg-green-600 text-white px-3 py-1 rounded-full">Students</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaClipboardCheck className="text-indigo-500" /> Tasks
          </h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500">No tasks assigned.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 5).map(task => (
                <li key={task.id} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.deadline ? 'Due: ' + new Date(task.deadline).toLocaleDateString() : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FaBullhorn className="text-indigo-500" /> Announcements
          </h2>
          {announcements.length === 0 ? (
            <p className="text-gray-500">No announcements.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.slice(0, 5).map(ann => (
                <li key={ann.id} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{ann.title}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(ann.created_at)}</p>
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
                <li key={log.id} className="p-2 bg-gray-50 rounded">
                  <p className="text-sm"><span className="font-medium">{log.user?.first_name} {log.user?.last_name}</span> – {log.description}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(log.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherOverview;