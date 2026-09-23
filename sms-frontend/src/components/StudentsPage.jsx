import React, { useState, useEffect } from 'react';
import {
  FaSpinner, FaUserGraduate, FaClipboardCheck,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const StudentsPage = () => {
  const token = localStorage.getItem('auth_token');
  const [assignments, setAssignments] = useState([]);   // teacher's classes/streams
  const [terms, setTerms] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [availableStreams, setAvailableStreams] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Fetch teacher assignments and terms
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assignRes, termsRes] = await Promise.all([
          fetch(`${API_BASE}/api/teacher/assignments`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/academic/terms/all`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (assignRes.ok) {
          const data = await assignRes.json();
          setAssignments(data);
          if (data.length > 0) {
            setSelectedClass(data[0].id);
            setAvailableStreams(data[0].streams || []);
            if (data[0].streams?.length > 0) {
              setSelectedStream(data[0].streams[0].id);
            }
          }
        }
        if (termsRes.ok) {
          const termsData = await termsRes.json();
          setTerms(termsData);
          // Select current active term, or the latest
          const active = termsData.find(t => new Date(t.start_date) <= new Date() && new Date(t.end_date) >= new Date());
          setSelectedTerm(active ? active.id : (termsData.length > 0 ? termsData[0].id : ''));
        }
      } catch (err) {
        showModal('error', 'Failed to load data.');
      } finally {
        setLoadingAssignments(false);
      }
    };
    fetchData();
  }, [token]);

  // Update available streams when class changes
  useEffect(() => {
    if (selectedClass) {
      const cls = assignments.find(c => c.id == selectedClass);
      setAvailableStreams(cls?.streams || []);
      if (cls?.streams?.length > 0) {
        setSelectedStream(cls.streams[0].id);
      } else {
        setSelectedStream('');
      }
    }
  }, [selectedClass, assignments]);

  // Fetch students when class/stream/term changes
  useEffect(() => {
    if (!selectedClass || !selectedTerm) return;
    setLoadingStudents(true);
    const fetchStudents = async () => {
      try {
        const params = new URLSearchParams({
          term_id: selectedTerm,
          class_id: selectedClass,
        });
        if (selectedStream) params.append('stream_id', selectedStream);

        const res = await fetch(`${API_BASE}/api/attendance/students?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStudents(data);
        }
      } catch (err) {
        showModal('error', 'Failed to load students.');
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedStream, selectedTerm, token]);

  const selectedClassObj = assignments.find(c => c.id == selectedClass);
  const selectedStreamObj = availableStreams.find(s => s.id == selectedStream);

  if (loadingAssignments) {
    return (
      <div className="p-6 flex justify-center">
        <FaSpinner className="animate-spin text-2xl text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <h1 className="text-3xl font-bold text-indigo-900 mb-6">My Students</h1>

      {/* Selection bar */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col sm:flex-row flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Term</label>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            className="p-2 border rounded"
          >
            {terms.map(term => (
              <option key={term.id} value={term.id}>{term.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Class</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="p-2 border rounded"
          >
            {assignments.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
        {availableStreams.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Stream</label>
            <select
              value={selectedStream}
              onChange={e => setSelectedStream(e.target.value)}
              className="p-2 border rounded"
            >
              {availableStreams.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Class info card */}
      {selectedClassObj && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {selectedClassObj.name}
            {selectedStreamObj ? ` (${selectedStreamObj.name})` : ''}
          </h2>
          <p className="text-gray-600">
            Total Students: <span className="font-semibold">{students.length}</span>
          </p>
        </div>
      )}

      {/* Student list */}
      {loadingStudents ? (
        <div className="flex justify-center py-10">
          <FaSpinner className="animate-spin text-2xl text-indigo-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <FaUserGraduate className="text-4xl mx-auto mb-2 text-gray-300" />
          <p>No students found for this class.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 font-semibold text-gray-600 text-sm">#</th>
                <th className="p-3 font-semibold text-gray-600 text-sm">Student Name</th>
                <th className="p-3 font-semibold text-gray-600 text-sm">Student Number</th>
                <th className="p-3 font-semibold text-gray-600 text-sm">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => (
                <tr key={student.id} className="border-t hover:bg-blue-50/50 transition">
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3 font-medium">{student.name}</td>
                  <td className="p-3">{student.student_number}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                      student.attendance_pct >= 80 ? 'text-green-600' :
                      student.attendance_pct >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      <FaClipboardCheck className="text-xs" />
                      {student.attendance_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;