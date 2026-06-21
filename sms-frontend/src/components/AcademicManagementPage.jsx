import React, { useState, useEffect } from 'react';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaDownload,
  FaUpload,
  FaUsers,
  FaBookOpen,
  FaSearch,
  FaStream,
  FaSpinner,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const AcademicManagementPage = () => {
  const token = localStorage.getItem('auth_token');
  const [activeTab, setActiveTab] = useState('classes');

  // Data
  const [classes, setClasses] = useState([]);
  const [classesWithStreams, setClassesWithStreams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherSubjectAssignments, setTeacherSubjectAssignments] = useState([]);
  const [years, setYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [streams, setStreams] = useState([]);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  // Search
  const [searchClass, setSearchClass] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [searchStream, setSearchStream] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTeacherAssignment, setSearchTeacherAssignment] = useState('');

  // Modals
  const [classModal, setClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classSaving, setClassSaving] = useState(false);

  const [streamManageModal, setStreamManageModal] = useState(null);
  const [streamManageSaving, setStreamManageSaving] = useState(false);

  const [streamCRUDModal, setStreamCRUDModal] = useState(false);
  const [editingStream, setEditingStream] = useState(null);
  const [streamSaving, setStreamSaving] = useState(false);

  const [teacherAssignModal, setTeacherAssignModal] = useState(null);
  const [teacherAssignSaving, setTeacherAssignSaving] = useState(false);

  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectSaving, setSubjectSaving] = useState(false);

  const [subjectAssignModal, setSubjectAssignModal] = useState(null);
  const [subjectAssignSaving, setSubjectAssignSaving] = useState(false);

  const [yearModal, setYearModal] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [yearSaving, setYearSaving] = useState(false);

  const [termModal, setTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [termSaving, setTermSaving] = useState(false);

  const [teacherSubjectModal, setTeacherSubjectModal] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    user_id: '',
    subject_id: '',
    class_id: '',
    stream_id: '',
  });
  const [availableStreams, setAvailableStreams] = useState([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const confirmAction = (title, message, action) => {
    setConfirm({ isOpen: true, title, message, action });
  };
  const executeConfirm = () => {
    confirm.action?.();
    setConfirm({ isOpen: false });
  };

  // ==================== FETCH ALL DATA ====================
  const fetchAllData = async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    try {
      const [
        classesRes, subjectsRes, teachersRes, assignmentsRes,
        yearsRes, termsRes, streamsRes, classesWithStreamsRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/academic/classes`, { headers }),
        fetch(`${API_BASE}/api/academic/subjects`, { headers }),
        fetch(`${API_BASE}/api/academic/teachers`, { headers }),
        fetch(`${API_BASE}/api/academic/teacher-subjects`, { headers }),
        fetch(`${API_BASE}/api/academic/years`, { headers }),
        fetch(`${API_BASE}/api/academic/terms/all`, { headers }),
        fetch(`${API_BASE}/api/academic/streams`, { headers }),
        fetch(`${API_BASE}/api/academic/classes-with-streams`, { headers }),
      ]);

      // Check each response and log if something went wrong
      if (!classesRes.ok) console.error('Classes endpoint failed', classesRes.status);
      if (!subjectsRes.ok) console.error('Subjects endpoint failed', subjectsRes.status);
      if (!teachersRes.ok) console.error('Teachers endpoint failed', teachersRes.status);
      if (!assignmentsRes.ok) console.error('Teacher-subjects endpoint failed', assignmentsRes.status);
      if (!yearsRes.ok) console.error('Years endpoint failed', yearsRes.status);
      if (!termsRes.ok) console.error('Terms endpoint failed', termsRes.status);
      if (!streamsRes.ok) console.error('Streams endpoint failed', streamsRes.status);
      if (!classesWithStreamsRes.ok) console.error('Classes-with-streams endpoint failed', classesWithStreamsRes.status);

      // Set state only for successful responses
      if (classesRes.ok) setClasses(await classesRes.json());
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
      if (teachersRes.ok) setTeachers(await teachersRes.json());
      if (assignmentsRes.ok) setTeacherSubjectAssignments(await assignmentsRes.json());
      if (yearsRes.ok) setYears(await yearsRes.json());
      if (termsRes.ok) setTerms(await termsRes.json());
      if (streamsRes.ok) setStreams(await streamsRes.json());
      if (classesWithStreamsRes.ok) setClassesWithStreams(await classesWithStreamsRes.json());

      // If any critical data is missing, you can still show a warning
      if (!classesRes.ok && !subjectsRes.ok && !teachersRes.ok) {
        showModal('error', 'Failed to load essential data. Please try again.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showModal('error', 'Network error. Please check your connection and backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ==================== CLASSES ====================
  const handleClassSubmit = async (e) => {
    e.preventDefault();
    setClassSaving(true);
    const form = e.target;
    const body = { name: form.name.value };
    const url = editingClass ? `${API_BASE}/api/academic/classes/${editingClass.id}` : `${API_BASE}/api/academic/classes`;
    const method = editingClass ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAllData();
        showModal('success', editingClass ? 'Class updated' : 'Class created');
        setClassModal(false);
        setEditingClass(null);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Operation failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setClassSaving(false);
    }
  };

  const handleDeleteClass = (id) => {
    const cls = classes.find(c => c.id === id);
    confirmAction('Delete Class', `Delete ${cls?.name}?`, async () => {
      await fetch(`${API_BASE}/api/academic/classes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchAllData();
      showModal('success', 'Class deleted');
    });
  };

  const openStreamManage = (classItem) => {
    setStreamManageModal({
      classId: classItem.id,
      selectedStreams: classItem.streams?.map(s => s.stream_id) || [],
    });
  };

  const handleStreamManageSave = async () => {
    setStreamManageSaving(true);
    const { classId, selectedStreams } = streamManageModal;
    await fetch(`${API_BASE}/api/academic/classes/${classId}/streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ streams: selectedStreams }),
    });
    await fetchAllData();
    showModal('success', 'Streams updated');
    setStreamManageModal(null);
    setStreamManageSaving(false);
  };

  const openTeacherAssign = (type, id) => {
    if (type === 'class') {
      const cls = classes.find(c => c.id === id);
      setTeacherAssignModal({ type: 'class', id, teachers: cls?.teachers?.map(t => t.id) || [] });
    } else {
      for (const cls of classes) {
        const cs = cls.streams?.find(s => s.id === id);
        if (cs) {
          setTeacherAssignModal({ type: 'stream', id, teachers: cs.teachers?.map(t => t.id) || [] });
          return;
        }
      }
      setTeacherAssignModal({ type: 'stream', id, teachers: [] });
    }
  };

  const handleTeacherAssignSave = async () => {
    setTeacherAssignSaving(true);
    const { type, id, teachers } = teacherAssignModal;
    const url = type === 'class'
      ? `${API_BASE}/api/academic/classes/${id}/teachers`
      : `${API_BASE}/api/academic/class-streams/${id}/teachers`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teachers }),
    });
    await fetchAllData();
    showModal('success', 'Teachers updated');
    setTeacherAssignModal(null);
    setTeacherAssignSaving(false);
  };

  const openSubjectAssign = (classItem) => setSubjectAssignModal(classItem);
  const handleSubjectAssignSave = async () => {
    setSubjectAssignSaving(true);
    const form = document.getElementById('subject-assign-form');
    const subjectIds = Array.from(new FormData(form).getAll('subjects')).map(Number);
    const res = await fetch(`${API_BASE}/api/academic/classes/${subjectAssignModal.id}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subjects: subjectIds }),
    });
    if (res.ok) {
      await fetchAllData();
      showModal('success', 'Subjects updated');
      setSubjectAssignModal(null);
    } else {
      const err = await res.json();
      showModal('error', err.message || 'Failed');
    }
    setSubjectAssignSaving(false);
  };

  // ==================== STREAMS ====================
  const handleStreamCRUDSubmit = async (e) => {
    e.preventDefault();
    setStreamSaving(true);
    const form = e.target;
    const body = { name: form.name.value };
    const url = editingStream ? `${API_BASE}/api/academic/streams/${editingStream.id}` : `${API_BASE}/api/academic/streams`;
    const method = editingStream ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAllData();
        showModal('success', editingStream ? 'Stream updated' : 'Stream created');
        setStreamCRUDModal(false);
        setEditingStream(null);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setStreamSaving(false);
    }
  };

  const handleDeleteStream = (id) => {
    const stream = streams.find(s => s.id === id);
    confirmAction('Delete Stream', `Delete ${stream?.name}?`, async () => {
      await fetch(`${API_BASE}/api/academic/streams/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchAllData();
      showModal('success', 'Stream deleted');
    });
  };

  // ==================== SUBJECTS ====================
  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    setSubjectSaving(true);
    const form = e.target;
    const body = { name: form.name.value, description: form.description.value };
    const url = editingSubject ? `${API_BASE}/api/academic/subjects/${editingSubject.id}` : `${API_BASE}/api/academic/subjects`;
    const method = editingSubject ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAllData();
        showModal('success', editingSubject ? 'Subject updated' : 'Subject created');
        setSubjectModal(false);
        setEditingSubject(null);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleDeleteSubject = (id) => {
    const sub = subjects.find(s => s.id === id);
    confirmAction('Delete Subject', `Delete ${sub?.name}?`, async () => {
      await fetch(`${API_BASE}/api/academic/subjects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchAllData();
      showModal('success', 'Subject deleted');
    });
  };

  const handleImportSubjects = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/academic/subjects/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAllData();
      showModal('success', data.message);
    } else {
      showModal('error', 'Import failed');
    }
  };

  const downloadTemplate = () => {
    fetch(`${API_BASE}/api/academic/subjects/template`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'subject_template.csv'; a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  // ==================== ACADEMIC YEARS ====================
  const handleYearSubmit = async (e) => {
    e.preventDefault();
    setYearSaving(true);
    const form = e.target;
    const body = { name: form.name.value, start_date: form.start_date.value, end_date: form.end_date.value };
    const url = editingYear ? `${API_BASE}/api/academic/years/${editingYear.id}` : `${API_BASE}/api/academic/years`;
    const method = editingYear ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAllData();
        showModal('success', editingYear ? 'Year updated' : 'Year created');
        setYearModal(false); setEditingYear(null);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setYearSaving(false);
    }
  };

  const handleDeleteYear = (id) => {
    const yr = years.find(y => y.id === id);
    confirmAction('Delete Year', `Delete ${yr?.name}?`, async () => {
      await fetch(`${API_BASE}/api/academic/years/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchAllData();
      showModal('success', 'Year deleted');
    });
  };

  // ==================== TERMS ====================
  const handleTermSubmit = async (e) => {
    e.preventDefault();
    setTermSaving(true);
    const form = e.target;
    const body = {
      name: form.name.value,
      start_date: form.start_date.value,
      end_date: form.end_date.value,
      academic_year_id: form.academic_year_id.value,
    };
    const url = editingTerm ? `${API_BASE}/api/academic/terms/${editingTerm.id}` : `${API_BASE}/api/academic/terms`;
    const method = editingTerm ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAllData();
        showModal('success', editingTerm ? 'Term updated' : 'Term created');
        setTermModal(false); setEditingTerm(null);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setTermSaving(false);
    }
  };

  const handleDeleteTerm = (id) => {
    const term = terms.find(t => t.id === id);
    confirmAction('Delete Term', `Delete ${term?.name}?`, async () => {
      await fetch(`${API_BASE}/api/academic/terms/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchAllData();
      showModal('success', 'Term deleted');
    });
  };

  // ==================== TEACHER SUBJECT ASSIGNMENTS ====================
  const openAddAssignment = () => {
    setNewAssignment({ user_id: '', subject_id: '', class_id: '', stream_id: '' });
    setAvailableStreams([]);
    setTeacherSubjectModal(true);
  };

  const handleClassChange = (classId) => {
    const selectedClass = classesWithStreams.find(c => c.id == classId);
    setAvailableStreams(selectedClass ? selectedClass.streams : []);
    setNewAssignment(prev => ({ ...prev, class_id: classId, stream_id: '' }));
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    setAssignmentSaving(true);
    const body = { ...newAssignment, stream_id: newAssignment.stream_id || null };
    try {
      const res = await fetch(`${API_BASE}/api/academic/teacher-subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchAllData();
        showModal('success', 'Assignment created');
        setTeacherSubjectModal(false);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleDeleteAssignment = (id) => {
    confirmAction('Remove Assignment', 'Are you sure?', async () => {
      await fetch(`${API_BASE}/api/academic/teacher-subjects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchAllData();
      showModal('success', 'Assignment removed');
    });
  };

  // ==================== FILTERS ====================
  const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(searchClass.toLowerCase()));
  const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(searchSubject.toLowerCase()));
  const filteredStreams = streams.filter(s => s.name.toLowerCase().includes(searchStream.toLowerCase()));
  const filteredTerms = terms.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAssignments = teacherSubjectAssignments.filter(a =>
    a.teacher_name.toLowerCase().includes(searchTeacherAssignment.toLowerCase()) ||
    a.subject_name.toLowerCase().includes(searchTeacherAssignment.toLowerCase()) ||
    a.class_name.toLowerCase().includes(searchTeacherAssignment.toLowerCase()) ||
    (a.stream_name && a.stream_name.toLowerCase().includes(searchTeacherAssignment.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
        <span className="ml-3 text-gray-600 text-lg">Loading academic data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      {confirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-blue-900 mb-2">{confirm.title}</h3>
            <p className="text-gray-600 mb-6">{confirm.message}</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setConfirm({ isOpen: false })} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={executeConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-blue-900 mb-8">Academic Management</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 flex-wrap">
        {['classes', 'streams', 'subjects', 'years', 'terms', 'teacher-subjects'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-full font-medium transition ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
            }`}
          >
            {tab === 'years' ? 'Academic Years' : tab === 'teacher-subjects' ? 'Teacher Subjects' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ==================== CLASSES TAB ==================== */}
      {activeTab === 'classes' && (
        <div>
          <div className="flex gap-4 mb-4 items-center">
            <button onClick={() => { setEditingClass(null); setClassModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <FaPlus /> Add Class
            </button>
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search classes..." value={searchClass} onChange={e => setSearchClass(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="space-y-6">
            {filteredClasses.map(cls => {
              const hasStreams = cls.streams && cls.streams.length > 0;
              return (
                <div key={cls.id} className="bg-white rounded-xl shadow p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-semibold">{cls.name}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => openStreamManage(cls)} className="text-blue-600 text-sm underline"><FaStream className="inline mr-1" /> Assign Streams</button>
                      <button onClick={() => { setEditingClass(cls); setClassModal(true); }} className="text-blue-600"><FaEdit /></button>
                      <button onClick={() => handleDeleteClass(cls.id)} className="text-red-600"><FaTrash /></button>
                    </div>
                  </div>
                  <div className="mb-4 flex items-center gap-2">
                    <FaBookOpen className="text-gray-500" />
                    <span className="font-medium">Subjects:</span>
                    <span className="text-gray-700">{cls.subjects?.length ? cls.subjects.map(s => s.name).join(', ') : 'None'}</span>
                    <button onClick={() => openSubjectAssign(cls)} className="text-blue-600 underline text-sm ml-2">Manage</button>
                  </div>
                  {!hasStreams ? (
                    <div className="flex items-center gap-2">
                      <FaUsers className="text-gray-500" />
                      <span className="font-medium">Class Teachers:</span>
                      <span className="text-gray-700">{cls.teachers?.length ? cls.teachers.map(t => t.name).join(', ') : 'No teachers assigned'}</span>
                      <button onClick={() => openTeacherAssign('class', cls.id)} className="text-blue-600 underline text-sm ml-2">Assign</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cls.streams.map(cs => (
                        <div key={cs.id} className="bg-blue-50 rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <strong>{cs.stream_name}</strong>
                            <div className="text-sm text-gray-600">
                              Teachers: {cs.teachers?.length ? cs.teachers.map(t => t.name).join(', ') : 'None assigned'}
                            </div>
                          </div>
                          <button onClick={() => openTeacherAssign('stream', cs.id)} className="text-green-600 text-sm hover:underline"><FaUsers className="inline mr-1" /> Assign</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== STREAMS TAB ==================== */}
      {activeTab === 'streams' && (
        <div>
          <div className="flex gap-4 mb-4 items-center">
            <button onClick={() => { setEditingStream(null); setStreamCRUDModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Stream</button>
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search streams..." value={searchStream} onChange={e => setSearchStream(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50"><tr><th className="p-4">Name</th><th className="p-4">Actions</th></tr></thead>
              <tbody>
                {filteredStreams.map(stream => (
                  <tr key={stream.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{stream.name}</td>
                    <td className="p-4">
                      <button onClick={() => { setEditingStream(stream); setStreamCRUDModal(true); }} className="text-blue-600 mr-2"><FaEdit /></button>
                      <button onClick={() => handleDeleteStream(stream.id)} className="text-red-600"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SUBJECTS TAB ==================== */}
      {activeTab === 'subjects' && (
        <div>
          <div className="flex gap-4 mb-4 items-center flex-wrap">
            <button onClick={() => { setEditingSubject(null); setSubjectModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Subject</button>
            <button onClick={downloadTemplate} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaDownload /> Template</button>
            <label className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"><FaUpload /> Import<input type="file" accept=".csv" className="hidden" onChange={handleImportSubjects} /></label>
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search subjects..." value={searchSubject} onChange={e => setSearchSubject(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50"><tr><th className="p-4">Name</th><th className="p-4">Description</th><th className="p-4">Actions</th></tr></thead>
              <tbody>
                {filteredSubjects.map(sub => (
                  <tr key={sub.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{sub.name}</td><td className="p-4">{sub.description || '-'}</td>
                    <td className="p-4">
                      <button onClick={() => { setEditingSubject(sub); setSubjectModal(true); }} className="text-blue-600 mr-2"><FaEdit /></button>
                      <button onClick={() => handleDeleteSubject(sub.id)} className="text-red-600"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== YEARS & TERMS ==================== */}
      {activeTab === 'years' && (
        <div>
          <button onClick={() => { setEditingYear(null); setYearModal(true); }} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Academic Year</button>
          <div className="space-y-4">
            {years.map(year => (
              <div key={year.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div><h3 className="text-xl font-semibold">{year.name}</h3><p className="text-sm text-gray-600">{year.start_date} – {year.end_date}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingYear(year); setYearModal(true); }} className="text-blue-600"><FaEdit /></button>
                  <button onClick={() => handleDeleteYear(year.id)} className="text-red-600"><FaTrash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'terms' && (
        <div>
          <div className="flex gap-4 mb-4 items-center">
            <button onClick={() => { setEditingTerm(null); setTermModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Term</button>
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search terms..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50"><tr><th className="p-4">Name</th><th className="p-4">Academic Year</th><th className="p-4">Start Date</th><th className="p-4">End Date</th><th className="p-4">Actions</th></tr></thead>
              <tbody>
                {filteredTerms.map(term => (
                  <tr key={term.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{term.name}</td><td className="p-4">{term.academic_year?.name || 'No year'}</td>
                    <td className="p-4">{term.start_date}</td><td className="p-4">{term.end_date}</td>
                    <td className="p-4">
                      <button onClick={() => { setEditingTerm(term); setTermModal(true); }} className="text-blue-600 mr-2"><FaEdit /></button>
                      <button onClick={() => handleDeleteTerm(term.id)} className="text-red-600"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TEACHER SUBJECTS TAB ==================== */}
      {activeTab === 'teacher-subjects' && (
        <div>
          <div className="flex gap-4 mb-4 items-center">
            <button onClick={openAddAssignment} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Assignment</button>
            <div className="relative flex-1 max-w-sm">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search assignments..." value={searchTeacherAssignment} onChange={e => setSearchTeacherAssignment(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50"><tr><th className="p-4">Teacher</th><th className="p-4">Subject</th><th className="p-4">Class</th><th className="p-4">Stream</th><th className="p-4">Actions</th></tr></thead>
              <tbody>
                {filteredAssignments.map(a => (
                  <tr key={a.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{a.teacher_name}</td><td className="p-4">{a.subject_name}</td><td className="p-4">{a.class_name}</td><td className="p-4">{a.stream_name || '—'}</td>
                    <td className="p-4"><button onClick={() => handleDeleteAssignment(a.id)} className="text-red-600"><FaTrash /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Class Modal */}
      {classModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{editingClass ? 'Edit Class' : 'Add Class'}</h2>
            <form onSubmit={handleClassSubmit}>
              <input name="name" defaultValue={editingClass?.name} required placeholder="Class Name" className="w-full p-2 border rounded mb-3" />
              <div className="flex gap-4">
                <button type="submit" disabled={classSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {classSaving ? <FaSpinner className="animate-spin" /> : null}
                  {classSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setClassModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stream CRUD Modal */}
      {streamCRUDModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{editingStream ? 'Edit Stream' : 'Add Stream'}</h2>
            <form onSubmit={handleStreamCRUDSubmit}>
              <input name="name" defaultValue={editingStream?.name} required placeholder="Stream Name" className="w-full p-2 border rounded mb-3" />
              <div className="flex gap-4">
                <button type="submit" disabled={streamSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {streamSaving ? <FaSpinner className="animate-spin" /> : null}
                  {streamSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setStreamCRUDModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Streams Modal */}
      {streamManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Assign Streams</h2>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {streams.map(stream => (
                <label key={stream.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={streamManageModal.selectedStreams.includes(stream.id)}
                    onChange={e => {
                      const updated = e.target.checked ? [...streamManageModal.selectedStreams, stream.id] : streamManageModal.selectedStreams.filter(id => id !== stream.id);
                      setStreamManageModal(prev => ({ ...prev, selectedStreams: updated }));
                    }} />
                  <span>{stream.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={handleStreamManageSave} disabled={streamManageSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                {streamManageSaving ? <FaSpinner className="animate-spin" /> : null}
                {streamManageSaving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setStreamManageModal(null)} className="border px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Assignment Modal */}
      {teacherAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Assign Teachers to {teacherAssignModal.type === 'class' ? 'Class' : 'Stream'}</h2>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {teachers.map(t => (
                <label key={t.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={teacherAssignModal.teachers.includes(t.id)}
                    onChange={e => {
                      const updated = e.target.checked ? [...teacherAssignModal.teachers, t.id] : teacherAssignModal.teachers.filter(id => id !== t.id);
                      setTeacherAssignModal(prev => ({ ...prev, teachers: updated }));
                    }} />
                  <span>{t.first_name} {t.last_name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={handleTeacherAssignSave} disabled={teacherAssignSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                {teacherAssignSaving ? <FaSpinner className="animate-spin" /> : null}
                {teacherAssignSaving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setTeacherAssignModal(null)} className="border px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject CRUD Modal */}
      {subjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{editingSubject ? 'Edit Subject' : 'Add Subject'}</h2>
            <form onSubmit={handleSubjectSubmit}>
              <input name="name" defaultValue={editingSubject?.name} required placeholder="Subject Name" className="w-full p-2 border rounded mb-3" />
              <textarea name="description" defaultValue={editingSubject?.description} placeholder="Description" className="w-full p-2 border rounded mb-3" rows="3" />
              <div className="flex gap-4">
                <button type="submit" disabled={subjectSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {subjectSaving ? <FaSpinner className="animate-spin" /> : null}
                  {subjectSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setSubjectModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject Assignment Modal */}
      {subjectAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Assign Subjects to {subjectAssignModal.name}</h2>
            <form id="subject-assign-form" onSubmit={e => { e.preventDefault(); handleSubjectAssignSave(); }}>
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {subjects.map(s => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input type="checkbox" name="subjects" value={s.id} defaultChecked={subjectAssignModal.subjects?.some(sub => sub.id === s.id)} />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={subjectAssignSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {subjectAssignSaving ? <FaSpinner className="animate-spin" /> : null}
                  {subjectAssignSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setSubjectAssignModal(null)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Year Modal */}
      {yearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{editingYear ? 'Edit Academic Year' : 'Add Academic Year'}</h2>
            <form onSubmit={handleYearSubmit}>
              <input name="name" defaultValue={editingYear?.name} required placeholder="Year Name" className="w-full p-2 border rounded mb-3" />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-sm">Start Date</label><input type="date" name="start_date" defaultValue={editingYear?.start_date} required className="w-full p-2 border rounded" /></div>
                <div><label className="text-sm">End Date</label><input type="date" name="end_date" defaultValue={editingYear?.end_date} required className="w-full p-2 border rounded" /></div>
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={yearSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {yearSaving ? <FaSpinner className="animate-spin" /> : null}
                  {yearSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setYearModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Term Modal */}
      {termModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{editingTerm ? 'Edit Term' : 'Add Term'}</h2>
            <form onSubmit={handleTermSubmit}>
              <input name="name" defaultValue={editingTerm?.name} required placeholder="Term Name" className="w-full p-2 border rounded mb-3" />
              <select name="academic_year_id" defaultValue={editingTerm?.academic_year_id || ''} className="w-full p-2 border rounded mb-3" required>
                <option value="">Select Academic Year</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-sm">Start Date</label><input type="date" name="start_date" defaultValue={editingTerm?.start_date} required className="w-full p-2 border rounded" /></div>
                <div><label className="text-sm">End Date</label><input type="date" name="end_date" defaultValue={editingTerm?.end_date} required className="w-full p-2 border rounded" /></div>
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={termSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {termSaving ? <FaSpinner className="animate-spin" /> : null}
                  {termSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setTermModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Subject Assignment Modal */}
      {teacherSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Assign Subject to Teacher</h2>
            <form onSubmit={handleAddAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Teacher *</label>
                <select value={newAssignment.user_id} onChange={e => setNewAssignment(prev => ({ ...prev, user_id: e.target.value }))} required className="w-full p-2 border rounded">
                  <option value="">Select Teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Subject *</label>
                <select value={newAssignment.subject_id} onChange={e => setNewAssignment(prev => ({ ...prev, subject_id: e.target.value }))} required className="w-full p-2 border rounded">
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Class *</label>
                <select value={newAssignment.class_id} onChange={e => handleClassChange(e.target.value)} required className="w-full p-2 border rounded">
                  <option value="">Select Class</option>
                  {classesWithStreams.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {availableStreams.length > 0 && (
                <div>
                  <label className="block text-sm font-medium">Stream (optional)</label>
                  <select value={newAssignment.stream_id} onChange={e => setNewAssignment(prev => ({ ...prev, stream_id: e.target.value }))} className="w-full p-2 border rounded">
                    <option value="">All / No specific stream</option>
                    {availableStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-4">
                <button type="submit" disabled={assignmentSaving} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {assignmentSaving ? <FaSpinner className="animate-spin" /> : null}
                  {assignmentSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setTeacherSubjectModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicManagementPage;