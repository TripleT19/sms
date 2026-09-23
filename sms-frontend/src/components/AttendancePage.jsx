import React, { useState, useEffect } from 'react';
import {
  FaSpinner,
  FaLock,
  FaUnlock,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const STATUS_OPTIONS = ['·', 'P', 'L', 'A', 'S'];
const STATUS_COLORS = {
  P: 'bg-green-500 text-white',
  L: 'bg-yellow-500 text-white',
  A: 'bg-red-500 text-white',
  S: 'bg-blue-500 text-white',
  '·': 'bg-white text-gray-700',
};

const AttendancePage = () => {
  const token = localStorage.getItem('auth_token');

  const [activeTab, setActiveTab] = useState('mark');

  const [terms, setTerms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [availableStreams, setAvailableStreams] = useState([]);

  const [weeks, setWeeks] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [nonTeachingDays, setNonTeachingDays] = useState([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Fetch initial data
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [termsRes, assignRes] = await Promise.all([
          fetch(`${API_BASE}/api/academic/terms/all`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
          fetch(`${API_BASE}/api/teacher/assignments`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
        ]);
        if (termsRes.ok) setTerms(await termsRes.json());
        if (assignRes.ok) setAssignments(await assignRes.json());
      } catch (err) {
        showModal('error', 'Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  // Update available streams when class changes
  useEffect(() => {
    if (selectedClass) {
      const cls = assignments.find(c => c.id == selectedClass);
      setAvailableStreams(cls?.streams || []);
      setSelectedStream('');
    } else {
      setAvailableStreams([]);
      setSelectedStream('');
    }
  }, [selectedClass, assignments]);

  // Auto-load attendance when filters change
  useEffect(() => {
    if (selectedTerm && selectedClass) {
      loadAttendance();
    } else {
      setWeeks([]);
      setStudents([]);
      setAttendanceData({});
      setNonTeachingDays([]);
    }
  }, [selectedTerm, selectedClass, selectedStream]);

  const loadAttendance = async () => {
    if (!selectedTerm || !selectedClass) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        term_id: selectedTerm,
        class_id: selectedClass,
        stream_id: selectedStream || '',
      });
      const weeksRes = await fetch(`${API_BASE}/api/attendance/weeks?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (weeksRes.ok) {
        const weekData = await weeksRes.json();
        setWeeks(weekData.weeks);
        setStudents(weekData.students);
        setNonTeachingDays(weekData.non_teaching_days || []);

        const map = {};
        weekData.students.forEach(s => {
          const studentMap = {};
          if (s.records) {
            Object.keys(s.records).forEach(date => {
              studentMap[date] = s.records[date];
            });
          }
          map[s.id] = studentMap;
        });
        setAttendanceData(map);

        // Default to current week
        const today = new Date().toISOString().split('T')[0];
        const currentWeekIdx = weekData.weeks.findIndex(w =>
          w.days.some(d => d.date === today)
        );
        setSelectedWeekIndex(currentWeekIdx !== -1 ? currentWeekIdx : 0);
      } else {
        showModal('error', 'Failed to load attendance data');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Save attendance status
  const saveAttendance = async (studentId, date, newStatus) => {
    const previousStatus = attendanceData[studentId]?.[date] || '·';

    // Optimistic update
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [date]: newStatus === '·' ? undefined : newStatus,
      },
    }));

    try {
      const res = await fetch(`${API_BASE}/api/attendance/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          date,
          status: newStatus === '·' ? 'A' : newStatus,
          term_id: selectedTerm,
          class_id: selectedClass,
          stream_id: selectedStream || null,
        }),
      });

      if (!res.ok) {
        // Revert on failure
        setAttendanceData(prev => ({
          ...prev,
          [studentId]: {
            ...(prev[studentId] || {}),
            [date]: previousStatus,
          },
        }));
        showModal('error', 'Failed to save attendance');
      }
    } catch (err) {
      setAttendanceData(prev => ({
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [date]: previousStatus,
        },
      }));
      showModal('error', 'Network error');
    }
  };

  // Toggle non-teaching day
  const toggleNonTeachingDay = async (date) => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance/non-teaching-day/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date,
          class_id: selectedClass,
          stream_id: selectedStream || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'added') {
          setNonTeachingDays(prev => [...prev, date]);
        } else {
          setNonTeachingDays(prev => prev.filter(d => d !== date));
        }
      } else {
        showModal('error', 'Failed to update non-teaching day');
      }
    } catch (err) {
      showModal('error', 'Network error');
    }
  };

  const computePercentage = (studentId) => {
    const today = new Date().toISOString().split('T')[0];
    let totalDays = 0;
    let presentDays = 0;
    weeks.forEach(week => {
      week.days.forEach(day => {
        if (day.date <= today && !nonTeachingDays.includes(day.date)) {
          totalDays++;
          const status = attendanceData[studentId]?.[day.date];
          if (status === 'P' || status === 'L') presentDays++;
        }
      });
    });
    if (totalDays === 0) return 0;
    return Math.round((presentDays / totalDays) * 100);
  };

  const displayWeeks = activeTab === 'mark'
    ? (selectedWeekIndex !== null && weeks[selectedWeekIndex] ? [weeks[selectedWeekIndex]] : [])
    : weeks;

  if (loading && !students.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
        <span className="ml-3 text-gray-600 text-lg">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-blue-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-4 md:mb-8">Attendance</h1>

      {/* Tabs */}
      <div className="flex gap-2 md:gap-4 mb-4 md:mb-8">
        <button
          onClick={() => setActiveTab('mark')}
          className={`px-4 py-2 rounded-full font-medium text-sm md:text-base transition ${
            activeTab === 'mark' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
          }`}
        >
          Mark Attendance
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-4 py-2 rounded-full font-medium text-sm md:text-base transition ${
            activeTab === 'view' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
          }`}
        >
          View Attendance
        </button>
      </div>

      {/* Selection Bar */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow mb-4 md:mb-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-end gap-3 sm:gap-4">
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium mb-1">Term *</label>
          <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="w-full p-2 border rounded text-sm md:text-base">
            <option value="">Select Term</option>
            {terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium mb-1">Class *</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-2 border rounded text-sm md:text-base">
            <option value="">Select Class</option>
            {assignments.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
        </div>
        {availableStreams.length > 0 && (
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium mb-1">Stream</label>
            <select value={selectedStream} onChange={e => setSelectedStream(e.target.value)} className="w-full p-2 border rounded text-sm md:text-base">
              <option value="">All Streams</option>
              {availableStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Week selector (only for mark tab) */}
      {activeTab === 'mark' && weeks.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setSelectedWeekIndex(Math.max(0, (selectedWeekIndex || 0) - 1))}
            className="p-2 border rounded bg-white hover:bg-gray-100"
          >
            <FaChevronLeft />
          </button>
          <select
            value={selectedWeekIndex || 0}
            onChange={e => setSelectedWeekIndex(parseInt(e.target.value))}
            className="p-2 border rounded text-sm md:text-base flex-1"
          >
            {weeks.map((week, idx) => (
              <option key={week.week_number} value={idx}>
                Week {week.week_number} ({week.days[0]?.date} - {week.days[week.days.length-1]?.date})
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedWeekIndex(Math.min(weeks.length - 1, (selectedWeekIndex || 0) + 1))}
            className="p-2 border rounded bg-white hover:bg-gray-100"
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {/* Attendance Grid */}
      {displayWeeks.length > 0 && students.length > 0 ? (
        <div className="bg-white rounded-xl shadow overflow-auto">
          <table className="min-w-full border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-blue-100">
                <th className="sticky left-0 bg-blue-100 p-1 md:p-2 border z-10">Student</th>
                <th className="sticky left-[80px] md:left-[120px] bg-blue-100 p-1 md:p-2 border z-10">%</th>
                {displayWeeks.map(week => (
                  <th key={week.week_number} colSpan={week.days.length} className="p-1 md:p-2 border text-center font-semibold">
                    Wk {week.week_number}
                  </th>
                ))}
              </tr>
              <tr className="bg-blue-50">
                <th className="sticky left-0 bg-blue-50 p-1 md:p-2 border z-10"></th>
                <th className="sticky left-[80px] md:left-[120px] bg-blue-50 p-1 md:p-2 border z-10"></th>
                {displayWeeks.map(week =>
                  week.days.map(day => (
                    <th key={day.date} className="p-1 border text-center relative">
                      <span className="block text-xs md:text-sm">{day.label}</span>
                      {activeTab === 'mark' && (
                        <button
                          className="block mx-auto mt-0.5 text-gray-500 hover:text-gray-700"
                          onClick={() => toggleNonTeachingDay(day.date)}
                          title={nonTeachingDays.includes(day.date) ? 'Mark as teaching day' : 'Mark as non-teaching day'}
                        >
                          {nonTeachingDays.includes(day.date) ? <FaLock className="text-red-500 text-xs" /> : <FaUnlock className="text-xs" />}
                        </button>
                      )}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white p-1 md:p-2 border font-medium z-10 whitespace-nowrap">
                    {student.name}
                  </td>
                  <td className="sticky left-[80px] md:left-[120px] bg-white p-1 md:p-2 border text-center font-semibold z-10">
                    {computePercentage(student.id)}%
                  </td>
                  {displayWeeks.map(week =>
                    week.days.map(day => {
                      const isNonTeaching = nonTeachingDays.includes(day.date);
                      const currentStatus = attendanceData[student.id]?.[day.date] || '·';

                      if (isNonTeaching) {
                        return (
                          <td key={day.date} className="p-1 border text-center bg-gray-300 cursor-not-allowed">
                            <span className="text-xs font-semibold">H</span>
                          </td>
                        );
                      }

                      if (activeTab === 'mark') {
                        return (
                          <td key={day.date} className="p-0 border">
                            <select
                              value={currentStatus}
                              onChange={(e) => saveAttendance(student.id, day.date, e.target.value)}
                              className={`w-full h-full text-center text-xs md:text-sm font-semibold border-none outline-none rounded ${STATUS_COLORS[currentStatus] || 'bg-white text-gray-700'} px-1 py-1`}
                              style={{ minWidth: '2.2rem' }}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt} className="bg-white text-gray-700">
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      } else {
                        const colorClass = STATUS_COLORS[currentStatus] || 'bg-white text-gray-700';
                        return (
                          <td key={day.date} className={`p-1 border text-center font-semibold text-xs md:text-sm ${colorClass}`}>
                            {currentStatus === '·' ? '' : currentStatus}
                          </td>
                        );
                      }
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-600 text-sm">Select term, class, and optionally stream. Attendance will load automatically.</p>
      )}
    </div>
  );
};

export default AttendancePage;