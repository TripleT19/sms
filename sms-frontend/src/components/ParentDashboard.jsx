import React, { useState, useEffect } from 'react';
import {
  FaUserGraduate,
  FaMoneyBillWave,
  FaChartLine,
  FaSpinner,
  FaExclamationCircle,
  FaCheckCircle,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaChild,
} from 'react-icons/fa';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useNavigate } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE = 'https://laravel.moyorise.com';

const ParentDashboard = () => {
  const token = localStorage.getItem('auth_token');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [overallAvg, setOverallAvg] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const childrenRes = await fetch(`${API_BASE}/api/parent/children`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!childrenRes.ok) throw new Error('Failed to fetch children');
        const childrenData = await childrenRes.json();
        const childList = childrenData.children || [];
        setBankDetails(childrenData.bank_details || []);

        const childrenWithHistory = await Promise.all(
          childList.map(async (child) => {
            const termsRes = await fetch(
              `${API_BASE}/api/parent/child/${child.student_id}/terms`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            let terms = [];
            if (termsRes.ok) {
              terms = await termsRes.json();
            }
            // Sort descending by term_id (latest first)
            terms.sort((a, b) => b.term_id - a.term_id);

            let trend = 'stable';
            let trendValue = 0;
            if (terms.length >= 2) {
              const latest = terms[0].average;
              const previous = terms[1].average;
              if (latest !== null && previous !== null) {
                const diff = latest - previous;
                trendValue = diff;
                if (diff > 0.5) trend = 'up';
                else if (diff < -0.5) trend = 'down';
                else trend = 'stable';
              }
            }

            const currentAvg = child.average ?? null;
            const currentPosition = child.position ?? null;
            const currentTotal = child.total_in_class ?? null;
            const feesBalance = child.fees_balance ?? 0;

            // Build chart data (oldest to newest)
            const avgHistory = terms
              .map((t) => t.average)
              .filter((a) => a !== null)
              .reverse();
            const termLabels = terms.map((t) => t.term_name).reverse();

            return {
              ...child,
              terms,
              trend,
              trendValue,
              currentAvg,
              currentPosition,
              currentTotal,
              feesBalance,
              avgHistory,
              termLabels,
            };
          })
        );

        setChildren(childrenWithHistory);

        const total = childrenWithHistory.reduce((sum, c) => sum + c.feesBalance, 0);
        setTotalOutstanding(total);

        const avgs = childrenWithHistory
          .map((c) => c.currentAvg)
          .filter((a) => a !== null);
        if (avgs.length > 0) {
          const avg = avgs.reduce((s, a) => s + a, 0) / avgs.length;
          setOverallAvg(Math.round(avg * 10) / 10);
        } else {
          setOverallAvg(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <FaSpinner className="animate-spin text-4xl text-indigo-600" />
        <span className="ml-3 text-gray-600 text-lg font-medium">Loading dashboard...</span>
      </div>
    );
  }

  const hasChildren = children.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            Parent Dashboard
          </h1>
          <p className="text-gray-500 mt-2">Monitor your children's academic progress and fees</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4 transform transition hover:scale-105">
            <div className="bg-indigo-100 p-3 rounded-full">
              <FaChild className="text-2xl text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Children</p>
              <p className="text-2xl font-bold text-indigo-900">{children.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4 transform transition hover:scale-105">
            <div className="bg-red-100 p-3 rounded-full">
              <FaMoneyBillWave className="text-2xl text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Outstanding Fees</p>
              <p className="text-2xl font-bold text-red-600">
                MK {totalOutstanding.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4 transform transition hover:scale-105">
            <div className="bg-green-100 p-3 rounded-full">
              <FaChartLine className="text-2xl text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Average Performance</p>
              <p className="text-2xl font-bold text-green-700">
                {overallAvg !== null ? `${overallAvg}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Children Cards */}
        {!hasChildren ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center">
            <FaChild className="text-5xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No children linked to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {children.map((child) => {
              const trendIcon =
                child.trend === 'up' ? (
                  <FaArrowUp className="text-green-500" />
                ) : child.trend === 'down' ? (
                  <FaArrowDown className="text-red-500" />
                ) : (
                  <FaMinus className="text-gray-400" />
                );
              const trendText =
                child.trend === 'up'
                  ? 'Improving'
                  : child.trend === 'down'
                  ? 'Declining'
                  : 'Stable';
              const trendColor =
                child.trend === 'up'
                  ? 'text-green-600 bg-green-50'
                  : child.trend === 'down'
                  ? 'text-red-600 bg-red-50'
                  : 'text-gray-600 bg-gray-50';

              const chartData =
                child.avgHistory && child.avgHistory.length >= 2
                  ? {
                      labels: child.termLabels,
                      datasets: [
                        {
                          label: 'Average Score',
                          data: child.avgHistory,
                          borderColor: '#4F46E5',
                          backgroundColor: 'rgba(79, 70, 229, 0.1)',
                          tension: 0.3,
                          pointBackgroundColor: '#4F46E5',
                          fill: true,
                        },
                      ],
                    }
                  : null;

              return (
                <div
                  key={child.student_id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden transform transition hover:shadow-xl"
                >
                  <div className="p-5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold">{child.name}</h2>
                        <p className="text-indigo-100 text-sm">
                          {child.class_name} {child.stream_name ? `· ${child.stream_name}` : ''}
                        </p>
                      </div>
                      <div className="bg-white bg-opacity-20 p-2 rounded-full">
                        <FaUserGraduate className="text-2xl" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Current Average</p>
                        <p className="text-2xl font-bold text-gray-800">
                          {child.currentAvg !== null ? `${child.currentAvg}%` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Class Position</p>
                        <p className="text-2xl font-bold text-gray-800">
                          {child.currentPosition && child.currentTotal
                            ? `${child.currentPosition} / ${child.currentTotal}`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${trendColor}`}>
                        {trendIcon} {trendText}
                        {child.trendValue !== 0 && (
                          <span className="ml-1 text-xs">
                            ({child.trendValue > 0 ? '+' : ''}
                            {child.trendValue.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-500">Fees Balance</span>
                      <span
                        className={`font-bold ${
                          child.feesBalance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        MK {child.feesBalance.toLocaleString()}
                      </span>
                    </div>

                    {chartData && (
                      <div className="mt-2 h-24">
                        <Line
                          data={chartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              x: { display: false },
                              y: { display: false, beginAtZero: true },
                            },
                            elements: { point: { radius: 2 } },
                          }}
                        />
                      </div>
                    )}

                    <button
                      onClick={() => navigate('/dashboard/previous-records')}
                      className="w-full mt-2 bg-indigo-50 text-indigo-600 py-2 rounded-xl text-sm font-medium hover:bg-indigo-100 transition"
                    >
                      View Full History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bankDetails.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Payment Instructions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankDetails.map((bank) => (
                <div key={bank.id} className="p-4 bg-gray-50 rounded-xl border">
                  <p className="font-bold text-gray-800">{bank.bank_name}</p>
                  <p className="text-sm text-gray-600">Account: {bank.account_name}</p>
                  <p className="text-sm text-gray-600">Number: {bank.account_number}</p>
                  {bank.branch && <p className="text-sm text-gray-600">Branch: {bank.branch}</p>}
                  {bank.swift_code && <p className="text-sm text-gray-600">Swift: {bank.swift_code}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;