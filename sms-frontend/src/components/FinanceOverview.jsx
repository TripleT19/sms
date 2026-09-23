import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaMoneyBillWave, FaSpinner, FaChartLine, FaHistory, FaBullhorn,
} from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const FinanceOverview = () => {
  const token = localStorage.getItem('auth_token');
  const navigate = useNavigate();
  const [finance, setFinance] = useState({ term: '', total_fees: 0, collected: 0, outstanding: 0 });
  const [announcements, setAnnouncements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        const [finRes, annRes, logRes] = await Promise.all([
          fetch(`${API_BASE}/api/statistics/finance`, { headers }),
          fetch(`${API_BASE}/api/events?type=announcement`, { headers }),
          fetch(`${API_BASE}/api/logs/recent?limit=5`, { headers }),
        ]);
        if (finRes.ok) setFinance(await finRes.json());
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
      <h1 className="text-3xl font-bold text-blue-900 mb-8">Finance Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg"><FaMoneyBillWave className="text-2xl text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-600">Total Billed ({finance.term})</p>
            <p className="text-2xl font-bold text-blue-900">MK {finance.total_fees?.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-lg"><FaChartLine className="text-2xl text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-600">Collected</p>
            <p className="text-2xl font-bold text-green-900">MK {finance.collected?.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-lg"><FaMoneyBillWave className="text-2xl text-red-600" /></div>
          <div>
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className="text-2xl font-bold text-red-900">MK {finance.outstanding?.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

      <div className="bg-white p-8 rounded-xl shadow text-center">
        <FaMoneyBillWave className="text-5xl text-indigo-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Manage Finances</h2>
        <p className="text-gray-600 mb-6">View detailed fee records, record payments, and download invoices.</p>
        <button
          onClick={() => navigate('/dashboard/finance')}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
        >
          Go to Finance
        </button>
      </div>
    </div>
  );
};

export default FinanceOverview;