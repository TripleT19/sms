import React, { useState, useEffect } from 'react';
import { FaDownload, FaSpinner } from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const BulkReportDownload = () => {
  const token = localStorage.getItem('auth_token');
  const [terms, setTerms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });

  // Filters
  const [termId, setTermId] = useState('');
  const [assessmentType, setAssessmentType] = useState('end_term');
  const [mode, setMode] = useState('class'); // 'students' | 'class' | 'all'
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });

  useEffect(() => {
    const fetchInitial = async () => {
      const [termsRes, classesRes] = await Promise.all([
        fetch(`${API_BASE}/api/academic/terms/all`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/academic/classes-with-streams`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (termsRes.ok) setTerms(await termsRes.json());
      if (classesRes.ok) setClasses(await classesRes.json());
    };
    fetchInitial();
  }, [token]);

  // When class changes, fetch students of that class
  useEffect(() => {
    if (classId && mode === 'students') {
      fetchStudents(classId);
    } else {
      setStudents([]);
    }
  }, [classId, mode]);

  const fetchStudents = async (classId) => {
    const res = await fetch(`${API_BASE}/api/students?class_id=${classId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      // Flatten grouped response
      const all = Object.values(data).flat();
      setStudents(all);
    }
  };

  const toggleStudent = (id) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleDownload = async () => {
    if (!termId) return showModal('error', 'Select a term.');
    setDownloading(true);
    try {
      const payload = {
        term_id: termId,
        assessment_type: assessmentType,
      };
      if (mode === 'students') {
        payload.student_ids = selectedStudentIds;
      } else if (mode === 'class') {
        payload.class_id = classId;
        if (streamId) payload.stream_id = streamId;
      } else {
        payload.all_classes = true;
      }
      const res = await fetch(`${API_BASE}/api/admin/reports/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reports.zip';
        a.click();
        window.URL.revokeObjectURL(url);
        showModal('success', 'Download started.');
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Download failed.');
      }
    } catch {
      showModal('error', 'Network error.');
    } finally {
      setDownloading(false);
    }
  };

  const selectedClass = classes.find(c => c.id == classId);
  const streams = selectedClass?.streams || [];

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={() => setModal({ isOpen: false })} />
      <h1 className="text-3xl font-bold text-blue-900 mb-6">Download Reports</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium">Term *</label>
            <select value={termId} onChange={e => setTermId(e.target.value)} className="w-full p-2 border rounded">
              <option value="">Select Term</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Assessment Type</label>
            <select value={assessmentType} onChange={e => setAssessmentType(e.target.value)} className="w-full p-2 border rounded">
              <option value="end_term">End of Term</option>
              <option value="mid_term">Mid Term</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Download Mode</label>
          <div className="flex gap-4">
            {['students', 'class', 'all'].map(m => (
              <label key={m} className="flex items-center gap-2">
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                <span className="capitalize">{m === 'students' ? 'Specific Students' : m === 'class' ? 'By Class' : 'All Classes'}</span>
              </label>
            ))}
          </div>
        </div>

        {mode === 'class' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Class</label>
              <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full p-2 border rounded">
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {streams.length > 0 && (
              <div>
                <label className="block text-sm font-medium">Stream (optional)</label>
                <select value={streamId} onChange={e => setStreamId(e.target.value)} className="w-full p-2 border rounded">
                  <option value="">All Streams</option>
                  {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {mode === 'students' && (
          <div>
            <label className="block text-sm font-medium mb-2">Class</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full p-2 border rounded mb-4">
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {students.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded p-2">
                {students.map(s => (
                  <label key={s.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                    />
                    {s.first_name} {s.last_name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleDownload}
        disabled={downloading || !termId}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {downloading ? <FaSpinner className="animate-spin" /> : <FaDownload />}
        {downloading ? 'Generating ZIP...' : 'Download Reports (ZIP)'}
      </button>
    </div>
  );
};

export default BulkReportDownload;