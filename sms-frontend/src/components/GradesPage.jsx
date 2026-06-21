import React, { useState, useEffect, useMemo } from 'react';
import {
  FaSave, FaSpinner, FaPaperPlane, FaCheck, FaLock,
  FaDownload, FaUpload, FaMagic, FaUserCheck,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

// Client‑side grading scale
const computeGradeAndRemarks = (score) => {
  if (score === '' || score === null || score === undefined) return { grade: null, remarks: null };
  const num = Number(score);
  if (isNaN(num)) return { grade: null, remarks: null };
  if (num >= 80 && num <= 100) return { grade: 'A', remarks: 'Excellent' };
  if (num >= 70 && num <= 79) return { grade: 'B', remarks: 'Very Good' };
  if (num >= 55 && num <= 69) return { grade: 'C', remarks: 'Good' };
  if (num >= 40 && num <= 54) return { grade: 'D', remarks: 'Average' };
  return { grade: 'N', remarks: 'Need Support' };
};

// Client‑side positions
const computePositions = (students, gradesData) => {
  const list = students.map(s => ({
    student_id: s.student_id,
    score: gradesData[s.student_id]?.score ?? null,
    name: s.name,
  }));

  const sorted = [...list].sort((a, b) => {
    if (a.score === b.score) return a.name.localeCompare(b.name);
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  let rank = 1;
  let prevScore = null;
  const positions = {};
  sorted.forEach((item, index) => {
    if (item.score === null) {
      positions[item.student_id] = null;
      return;
    }
    if (prevScore !== null && item.score < prevScore) {
      rank = index + 1;
    }
    positions[item.student_id] = rank;
    prevScore = item.score;
  });

  const updated = { ...gradesData };
  Object.keys(updated).forEach(studentId => {
    updated[studentId] = {
      ...updated[studentId],
      position: positions[studentId] ?? null,
    };
  });
  return updated;
};

// Personalised comment templates
const getPronoun = (gender) => (gender === 'Male' ? 'He' : 'She');

const COMMENT_TEMPLATES = {
  A: {
    without: (firstName, pronoun) =>
      `${firstName} has demonstrated excellent academic performance throughout the assessment period. ${pronoun} consistently produces high‑quality work and shows a strong understanding of concepts. Keep up the excellent work.`,
    with: {
      '90-100': (firstName, pronoun) =>
        `${firstName} has demonstrated excellent academic performance throughout the assessment period. ${pronoun} consistently produces high‑quality work and shows a strong understanding of concepts. ${pronoun === 'He' ? 'His' : 'Her'} excellent attendance has contributed positively to this success.`,
      '75-89': (firstName, pronoun) =>
        `${firstName} has demonstrated excellent academic performance. ${pronoun} consistently produces high‑quality work. Good attendance has supported steady academic progress.`,
      'below75': (firstName, pronoun) =>
        `${firstName} has demonstrated excellent academic performance. ${pronoun} consistently produces high‑quality work. Improving attendance further may help maintain this excellent achievement.`,
    },
  },
  B: {
    without: (firstName, pronoun) =>
      `${firstName} has shown a strong understanding of the subjects and good academic skills. ${pronoun} is encouraged to continue working hard to achieve even greater success.`,
    with: {
      '90-100': (firstName, pronoun) =>
        `${firstName} has shown a strong understanding of the subjects. ${pronoun} has maintained excellent attendance, which has positively supported learning. Keep striving for excellence.`,
      '75-89': (firstName, pronoun) =>
        `${firstName} has shown a strong understanding of the subjects. ${pronoun} has attended regularly, and with continued effort can achieve even higher results.`,
      'below75': (firstName, pronoun) =>
        `${firstName} has shown a strong understanding of the subjects. Improved attendance may contribute to even better academic outcomes.`,
    },
  },
  C: {
    without: (firstName, pronoun) =>
      `${firstName} has demonstrated a satisfactory understanding of the subjects. ${pronoun} is encouraged to put in extra effort to improve further.`,
    with: {
      '90-100': (firstName, pronoun) =>
        `${firstName} has demonstrated a satisfactory understanding of the subjects. Excellent attendance is commendable; however, additional effort is needed to raise performance.`,
      '75-89': (firstName, pronoun) =>
        `${firstName} has demonstrated a satisfactory understanding of the subjects. Regular attendance has helped, but more focus on studies is required.`,
      'below75': (firstName, pronoun) =>
        `${firstName} requires significant support to improve academic performance. Poor attendance may be affecting progress and should be improved alongside study habits.`,
    },
  },
  D: {
    without: (firstName, pronoun) =>
      `${firstName} has met the minimum expectations. ${pronoun} needs to work harder and remain focused to improve results.`,
    with: {
      '90-100': (firstName, pronoun) =>
        `${firstName} has met the minimum expectations. Although attendance has been excellent, greater academic commitment is required to raise performance.`,
      '75-89': (firstName, pronoun) =>
        `${firstName} has met the minimum expectations. Regular attendance is noted; however, a more disciplined study routine is needed.`,
      'below75': (firstName, pronoun) =>
        `${firstName} has met the minimum expectations. Poor attendance may be contributing to the modest results; regular attendance and focused effort are needed.`,
    },
  },
  N: {
    without: (firstName, pronoun) =>
      `${firstName} requires additional support and commitment to improve academic performance. Greater effort and consistent study habits are strongly encouraged.`,
    with: {
      '90-100': (firstName, pronoun) =>
        `${firstName} requires additional support to improve academic performance. Although attendance has been good, significant improvement in study habits is necessary.`,
      '75-89': (firstName, pronoun) =>
        `${firstName} requires additional support to improve academic performance. Regular attendance alone is not sufficient; a more disciplined approach to learning is needed.`,
      'below75': (firstName, pronoun) =>
        `${firstName} requires significant support to improve academic performance. Poor attendance may be affecting progress and should be improved alongside study habits.`,
    },
  },
};

const getLetterGrade = (avg) => {
  if (avg === null || avg === undefined || isNaN(avg)) return null;
  if (avg >= 80 && avg <= 100) return 'A';
  if (avg >= 70 && avg <= 79) return 'B';
  if (avg >= 55 && avg <= 69) return 'C';
  if (avg >= 40 && avg <= 54) return 'D';
  return 'N';
};

const generateProfessionalComment = (student) => {
  const avg = student.average_score;
  const att = student.attendance_pct;
  const grade = getLetterGrade(avg);
  if (!grade) return '';

  const firstName = student.first_name || student.name?.split(' ')[0] || 'The learner';
  const gender = student.gender || 'Male';
  const pronoun = getPronoun(gender);

  if (student.include_attendance && att !== null && att !== undefined) {
    let bucket = 'below75';
    if (att >= 90) bucket = '90-100';
    else if (att >= 75) bucket = '75-89';

    const templateFn = COMMENT_TEMPLATES[grade]?.with?.[bucket];
    return templateFn ? templateFn(firstName, pronoun) : (COMMENT_TEMPLATES[grade]?.without?.(firstName, pronoun) || '');
  }

  const templateFn = COMMENT_TEMPLATES[grade]?.without;
  return templateFn ? templateFn(firstName, pronoun) : '';
};

// ---------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------
const GradesPage = () => {
  const token = localStorage.getItem('auth_token');
  const [activeTab, setActiveTab] = useState('grades');

  // Shared selection
  const [terms, setTerms] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [availableStreams, setAvailableStreams] = useState([]);
  const [allowedSubjects, setAllowedSubjects] = useState([]);

  // Grades state
  const [students, setStudents] = useState([]);
  const [gradesData, setGradesData] = useState({});
  const [savingGrades, setSavingGrades] = useState(false);

  // Comments state
  const [commentStudents, setCommentStudents] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Master attendance toggle
  const [includeAttendanceForAll, setIncludeAttendanceForAll] = useState(false);

  // Grading completeness & submission lock
  const [allGraded, setAllGraded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Download / upload
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const gradedWithPositions = useMemo(
    () => computePositions(students, gradesData),
    [students, gradesData]
  );

  // Fetch initial data
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [termsRes, classesRes] = await Promise.all([
          fetch(`${API_BASE}/api/academic/terms/all`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
          fetch(`${API_BASE}/api/grades/classes`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
        ]);
        if (termsRes.ok) setTerms(await termsRes.json());
        if (classesRes.ok) setTeacherClasses(await classesRes.json());
      } catch (err) {
        showModal('error', 'Failed to load initial data');
      }
    };
    fetchInitial();
  }, []);

  // Update available streams when class changes
  useEffect(() => {
    if (selectedClass) {
      const cls = teacherClasses.find(c => c.id == selectedClass);
      setAvailableStreams(cls?.streams || []);
      setSelectedStream('');
    } else {
      setAvailableStreams([]);
      setSelectedStream('');
    }
  }, [selectedClass, teacherClasses]);

  // Fetch allowed subjects
  useEffect(() => {
    if (selectedClass && selectedTerm) {
      fetchAllowedSubjects();
    } else {
      setAllowedSubjects([]);
      setSelectedSubject('');
    }
  }, [selectedClass, selectedStream, selectedTerm]);

  const fetchAllowedSubjects = async () => {
    try {
      const params = new URLSearchParams({
        class_id: selectedClass,
        stream_id: selectedStream || '',
      });
      const res = await fetch(`${API_BASE}/api/grades/allowed-subjects?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const subjects = await res.json();
        setAllowedSubjects(subjects);
        if (subjects.length > 0 && !subjects.find(s => s.id == selectedSubject)) {
          setSelectedSubject(subjects[0].id);
        }
      }
    } catch (err) {
      showModal('error', 'Failed to load subjects');
    }
  };

  // Check grading completeness AND submission status
  const checkGradingStatus = async () => {
    try {
      const params = new URLSearchParams({
        class_id: selectedClass,
        stream_id: selectedStream || '',
        term_id: selectedTerm,
      });
      const res = await fetch(`${API_BASE}/api/grades/grading-status?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setAllGraded(data.all_graded);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const checkSubmissionStatus = async () => {
    if (!selectedClass || !selectedTerm) return;
    try {
      const params = new URLSearchParams({
        class_id: selectedClass,
        stream_id: selectedStream || '',
        term_id: selectedTerm,
      });
      const res = await fetch(`${API_BASE}/api/grades/submission-status?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setIsLocked(data.all_submitted);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Re‑check status whenever selection changes or tab changes
  useEffect(() => {
    if (selectedClass && selectedTerm) {
      checkGradingStatus();
      checkSubmissionStatus();
    } else {
      setAllGraded(false);
      setIsLocked(false);
    }
  }, [selectedClass, selectedStream, selectedTerm, activeTab]);

  // Load students and grades
  const loadStudentsAndGrades = async () => {
    if (!selectedClass || !selectedSubject || !selectedTerm) return;
    try {
      const params = new URLSearchParams({
        class_id: selectedClass,
        stream_id: selectedStream || '',
        subject_id: selectedSubject,
        term_id: selectedTerm,
      });
      const res = await fetch(`${API_BASE}/api/grades/students?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        const map = {};
        data.forEach(s => {
          map[s.student_id] = {
            score: s.score,
            grade: s.grade,
            remarks: s.remarks,
            position: s.position,
          };
        });
        setGradesData(map);
      }
    } catch (err) {
      showModal('error', 'Failed to load students');
    }
  };

  useEffect(() => {
    loadStudentsAndGrades();
  }, [selectedClass, selectedStream, selectedSubject, selectedTerm]);

  // Handle score change – only if not locked
  const handleScoreChange = (studentId, value) => {
    if (isLocked) return;
    const computed = computeGradeAndRemarks(value);
    setGradesData(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        score: value,
        grade: computed.grade,
        remarks: computed.remarks,
      },
    }));
  };

  const handleSaveGrades = async () => {
    if (isLocked) return;
    setSavingGrades(true);
    const payload = {
      class_id: selectedClass,
      stream_id: selectedStream || null,
      subject_id: selectedSubject,
      term_id: selectedTerm,
      grades: students.map(s => ({
        student_id: s.student_id,
        score: gradesData[s.student_id]?.score ?? null,
      })),
    };
    try {
      const res = await fetch(`${API_BASE}/api/grades/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showModal('success', 'Grades saved');
        await loadStudentsAndGrades();
        checkGradingStatus();
        checkSubmissionStatus();
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setSavingGrades(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedClass || !selectedTerm) {
      showModal('error', 'Please select class and term');
      return;
    }
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        class_id: selectedClass,
        stream_id: selectedStream || '',
        term_id: selectedTerm,
      });
      const res = await fetch(`${API_BASE}/api/grades/download?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grades_${selectedTerm}_${selectedClass}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        showModal('error', 'Download failed');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (e) => {
    if (isLocked) return;
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedClass || !selectedTerm) {
      showModal('error', 'Please select class and term');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('class_id', selectedClass);
    formData.append('stream_id', selectedStream || '');
    formData.append('term_id', selectedTerm);

    try {
      const res = await fetch(`${API_BASE}/api/grades/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        showModal('success', data.message);
        checkGradingStatus();
        if (selectedSubject) {
          loadStudentsAndGrades();
        }
        checkSubmissionStatus();
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Upload failed');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setUploading(false);
    }
  };

  // ---------- COMMENTS TAB ----------
  const loadComments = async () => {
    if (!selectedClass || !selectedTerm) return;
    setLoadingComments(true);
    try {
      const params = new URLSearchParams({
        class_id: selectedClass,
        stream_id: selectedStream || '',
        term_id: selectedTerm,
      });
      const res = await fetch(`${API_BASE}/api/grades/comments?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setCommentStudents(data);
        if (data.length > 0) {
          const allInclude = data.every(s => s.include_attendance);
          setIncludeAttendanceForAll(allInclude);
        }
      }
    } catch (err) {
      showModal('error', 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'comments' && allGraded) {
      loadComments();
    }
  }, [activeTab, selectedClass, selectedStream, selectedTerm, allGraded]);

  const handleCommentChange = (studentId, field, value) => {
    if (isLocked) return;
    setCommentStudents(prev =>
      prev.map(s => (s.student_id === studentId ? { ...s, [field]: value } : s))
    );
  };

  const handleToggleIncludeAttendanceAll = () => {
    if (isLocked) return;
    const newValue = !includeAttendanceForAll;
    setIncludeAttendanceForAll(newValue);
    setCommentStudents(prev =>
      prev.map(s => {
        if (s.submitted) return s;
        return { ...s, include_attendance: newValue };
      })
    );
  };

  const handleSaveAllComments = async () => {
    if (isLocked) return;
    setSavingComment(true);
    const payload = {
      class_id: selectedClass,
      stream_id: selectedStream || null,
      term_id: selectedTerm,
      comments: commentStudents.map(s => ({
        student_id: s.student_id,
        comment: s.comment,
        include_attendance: s.include_attendance,
      })),
    };
    try {
      const res = await fetch(`${API_BASE}/api/grades/comments/save-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showModal('success', 'All comments saved');
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed to save comments');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setSavingComment(false);
    }
  };

  const handleAutoGenerateAll = () => {
    if (isLocked) return;
    setCommentStudents(prev =>
      prev.map(s => {
        if (s.submitted) return s;
        const generated = generateProfessionalComment(s);
        return { ...s, comment: generated };
      })
    );
  };

  const handleSubmitToAdmin = async () => {
    if (isLocked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/grades/comments/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          class_id: selectedClass,
          stream_id: selectedStream || null,
          term_id: selectedTerm,
        }),
      });
      if (res.ok) {
        showModal('success', 'Submitted to admin');
        loadComments();
        checkSubmissionStatus();
      } else {
        showModal('error', 'Failed to submit');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (isLocked) return;
    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/api/grades/comments/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          class_id: selectedClass,
          stream_id: selectedStream || null,
          term_id: selectedTerm,
        }),
      });
      if (res.ok) {
        showModal('success', 'Published to parents');
        loadComments();
        checkSubmissionStatus();
      } else {
        showModal('error', 'Failed to publish');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setPublishing(false);
    }
  };

  const allSubmitted = commentStudents.every(s => s.submitted);
  const allPublished = commentStudents.every(s => s.published);
  const anySubmitted = commentStudents.some(s => s.submitted);

  const displayData = gradedWithPositions;

  return (
    <div className="p-4 md:p-6 bg-blue-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6">Grades & Report Cards</h1>

      {/* Lock banner */}
      {isLocked && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-xl flex items-center gap-3 text-red-800">
          <FaLock className="text-2xl" />
          <div>
            <p className="font-semibold">Report has been submitted to admin</p>
            <p className="text-sm">Grades and comments are locked for editing, but you can still view them by selecting a different term/class/stream/subject.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('grades')} className={`px-4 py-2 rounded-full font-medium transition ${activeTab === 'grades' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'}`}>
          Grades Entry
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          disabled={!allGraded || isLocked}
          className={`px-4 py-2 rounded-full font-medium transition flex items-center gap-2 ${
            activeTab === 'comments' ? 'bg-blue-600 text-white' : (allGraded && !isLocked) ? 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title={!allGraded ? 'All subjects must be graded first' : isLocked ? 'Report is locked' : ''}
        >
          {(!allGraded || isLocked) && <FaLock className="text-xs" />}
          Comments & Submission
        </button>
      </div>

      {/* Selection Bar – dropdowns ALWAYS enabled */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col sm:flex-row flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Term *</label>
          <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="p-2 border rounded">
            <option value="">Select Term</option>
            {terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Class *</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2 border rounded">
            <option value="">Select Class</option>
            {teacherClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
        </div>
        {availableStreams.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Stream</label>
            <select value={selectedStream} onChange={e => setSelectedStream(e.target.value)} className="p-2 border rounded">
              <option value="">All Streams</option>
              {availableStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {activeTab === 'grades' && (
          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="p-2 border rounded">
              <option value="">Select Subject</option>
              {allowedSubjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleDownload} disabled={downloading || !selectedClass || !selectedTerm} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50">
            {downloading ? <FaSpinner className="animate-spin" /> : <FaDownload />}
            {downloading ? 'Downloading...' : 'Download'}
          </button>
          {!isLocked && (
            <label className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-yellow-700">
              {uploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading || isLocked} />
            </label>
          )}
        </div>
      </div>

      {/* GRADES ENTRY TAB */}
      {activeTab === 'grades' && (
        <>
          {isLocked && !students.length ? (
            <p className="text-gray-600">No data available.</p>
          ) : students.length > 0 ? (
            <>
              <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
                <table className="w-full text-left">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="p-4 sticky left-0 bg-blue-50">#</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Score</th>
                      <th className="p-4">Out Of</th>
                      <th className="p-4">Grade</th>
                      <th className="p-4">Remarks</th>
                      <th className="p-4">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => {
                      const gradeInfo = displayData[student.student_id] || {};
                      return (
                        <tr key={student.student_id} className="border-t hover:bg-gray-50">
                          <td className="p-4 sticky left-0 bg-white">{idx + 1}</td>
                          <td className="p-4">
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-gray-500">{student.student_number}</div>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              className={`w-20 p-2 border rounded text-center ${isLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              value={gradeInfo.score ?? ''}
                              onChange={e => handleScoreChange(student.student_id, e.target.value)}
                              disabled={isLocked}
                            />
                          </td>
                          <td className="p-4 text-center">100</td>
                          <td className="p-4 text-center font-semibold">{gradeInfo.grade || '—'}</td>
                          <td className="p-4 text-center text-sm">{gradeInfo.remarks || '—'}</td>
                          <td className="p-4 text-center">{gradeInfo.position ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleSaveGrades}
                disabled={savingGrades || isLocked}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
              >
                {savingGrades ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {savingGrades ? 'Saving...' : 'Save Grades'}
              </button>
            </>
          ) : (
            <p className="text-gray-600">Select term, class, stream (optional), and subject to load students.</p>
          )}
        </>
      )}

      {/* COMMENTS & SUBMISSION TAB */}
      {activeTab === 'comments' && (
        <>
          {!allGraded ? (
            <div className="text-center py-8 text-gray-500">
              <FaLock className="text-3xl mx-auto mb-2" />
              <p className="text-lg font-medium">Comments are locked</p>
              <p>You must enter grades for all subjects before you can write comments and submit reports.</p>
            </div>
          ) : isLocked ? (
            <div className="text-center py-8 text-gray-500">
              <FaLock className="text-3xl mx-auto mb-2" />
              <p className="text-lg font-medium">Report has been submitted</p>
              <p>Comments cannot be edited after submission. You can still view them by changing the selection above.</p>
            </div>
          ) : loadingComments ? (
            <div className="text-center py-8"><FaSpinner className="animate-spin text-2xl mx-auto" /><p>Loading...</p></div>
          ) : commentStudents.length === 0 ? (
            <p className="text-gray-600">No students found for the selected class/term.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 mb-4 items-center">
                <button
                  onClick={handleAutoGenerateAll}
                  disabled={isLocked}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition disabled:opacity-50"
                >
                  <FaMagic />
                  Auto-Generate All
                </button>
                <button
                  onClick={handleSaveAllComments}
                  disabled={savingComment || isLocked || allSubmitted}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {savingComment ? <FaSpinner className="animate-spin" /> : <FaSave />}
                  {savingComment ? 'Saving...' : 'Save All Comments'}
                </button>
                {!isLocked && !allSubmitted && (
                  <label className="flex items-center gap-2 text-sm bg-white px-4 py-2 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={includeAttendanceForAll}
                      onChange={handleToggleIncludeAttendanceAll}
                    />
                    <FaUserCheck className="text-blue-600" />
                    Include Attendance for All
                  </label>
                )}
              </div>

              {anySubmitted && !isLocked && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                  <FaLock className="inline mr-1" /> Some comments have already been submitted and cannot be edited.
                </div>
              )}

              <div className="bg-white rounded-xl shadow overflow-x-auto mb-4">
                <table className="w-full text-left">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="p-4 sticky left-0 bg-blue-50">Student</th>
                      <th className="p-4">Avg Score</th>
                      <th className="p-4">Attendance</th>
                      <th className="p-4">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commentStudents.map(student => {
                      const isSubmitted = student.submitted;
                      return (
                        <tr key={student.student_id} className="border-t hover:bg-gray-50">
                          <td className="p-4 sticky left-0 bg-white font-medium">
                            {student.name}
                            {isSubmitted && <span className="ml-2 text-xs text-green-600">(Submitted)</span>}
                          </td>
                          <td className="p-4">{student.average_score ?? '—'}</td>
                          <td className="p-4">{student.attendance_pct}%</td>
                          <td className="p-4">
                            <textarea
                              className={`border rounded p-2 w-full min-w-[200px] ${isLocked || isSubmitted ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              rows={2}
                              value={student.comment}
                              onChange={e => handleCommentChange(student.student_id, 'comment', e.target.value)}
                              disabled={isLocked || isSubmitted}
                            />
                            <label className="flex items-center gap-2 text-sm mt-1">
                              <input
                                type="checkbox"
                                checked={student.include_attendance}
                                onChange={e => handleCommentChange(student.student_id, 'include_attendance', e.target.checked)}
                                disabled={isLocked || isSubmitted}
                              />
                              Include attendance in comment
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Submission buttons – only if not locked */}
              {!isLocked && (
                <div className="flex gap-4">
                  {!allSubmitted && (
                    <button
                      onClick={handleSubmitToAdmin}
                      disabled={submitting}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                    >
                      {submitting ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                      {submitting ? 'Submitting...' : 'Submit to Admin'}
                    </button>
                  )}
                  {allSubmitted && !allPublished && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
                    >
                      {publishing ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                      {publishing ? 'Publishing...' : 'Publish to Parents'}
                    </button>
                  )}
                  {allPublished && <p className="text-green-600 font-semibold">Published to parents</p>}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GradesPage;