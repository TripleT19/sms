import React, { useState, useEffect } from 'react';
import {
  FaSpinner,
  FaExclamationCircle,
  FaCheckCircle,
  FaChild,
  FaBookOpen,
  FaGraduationCap,
  FaTrophy,
  FaChartLine,
  FaAward,
  FaChevronDown,
  FaDownload,
  FaHistory,
  FaCalendarAlt,
  FaEye,
  FaArrowLeft,
  FaUniversity,
  FaPaperPlane,
  FaPaperclip,
  FaMoneyBillWave,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const ratingConfig = {
  EE: { label: 'Exceeding Expectations', color: 'bg-emerald-100 text-emerald-800', icon: FaCheckCircle },
  A:  { label: 'Achieved',              color: 'bg-blue-100 text-blue-800',      icon: FaCheckCircle },
  D:  { label: 'Developing',            color: 'bg-amber-100 text-amber-800',    icon: FaExclamationCircle },
  B:  { label: 'Beginning',             color: 'bg-red-100 text-red-800',        icon: FaExclamationCircle },
};

const PreviousRecords = () => {
  const token = localStorage.getItem('auth_token');
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [terms, setTerms] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [bankDetails, setBankDetails] = useState([]);

  // State for the full report view
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloading, setDownloading] = useState(null);

  // Finance message modal state (copied from CurrentRecords)
  const [financeModal, setFinanceModal] = useState({
    open: false,
    studentId: null,
    message: '',
    attachment: null,
    attachmentName: '',
    sending: false,
  });

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Fetch children on mount
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/parent/children`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const childList = data.children || [];
          setChildren(childList);
          setBankDetails(data.bank_details || []);
          if (childList.length > 0) setSelectedChildId(childList[0].student_id);
        } else if (res.status === 403) {
          showModal('error', 'You do not have parent access.');
        }
      } catch {
        showModal('error', 'Failed to load children.');
      } finally {
        setLoadingChildren(false);
      }
    };
    fetchChildren();
  }, [token]);

  // Fetch terms when selected child changes
  useEffect(() => {
    if (!selectedChildId) return;
    // Reset report view when child changes
    setSelectedReport(null);
    setSelectedTerm(null);
    const fetchTerms = async () => {
      setLoadingTerms(true);
      try {
        const res = await fetch(`${API_BASE}/api/parent/child/${selectedChildId}/terms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTerms(data);
        } else {
          showModal('error', 'Failed to load terms.');
        }
      } catch {
        showModal('error', 'Network error while fetching terms.');
      } finally {
        setLoadingTerms(false);
      }
    };
    fetchTerms();
  }, [selectedChildId, token]);

  // Load full report for a specific term
  const loadReport = async (term) => {
    setLoadingReport(true);
    setSelectedReport(null);
    setSelectedTerm(term);
    try {
      const res = await fetch(
        `${API_BASE}/api/parent/child/${selectedChildId}/report/${term.term_id}?assessment_type=${term.assessment_type || 'end_term'}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedReport(data);
      } else {
        showModal('error', 'Failed to load report details.');
      }
    } catch {
      showModal('error', 'Network error.');
    } finally {
      setLoadingReport(false);
    }
  };

  // Go back to terms list
  const goBackToTerms = () => {
    setSelectedReport(null);
    setSelectedTerm(null);
  };

  // Download report for a specific term
  const handleDownloadReport = async (studentId, termId) => {
    setDownloading(termId);
    try {
      const res = await fetch(`${API_BASE}/api/parent/report-card/${studentId}?term_id=${termId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${studentId}_Term${termId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        showModal('error', 'Download failed.');
      }
    } catch {
      showModal('error', 'Network error.');
    } finally {
      setDownloading(null);
    }
  };

  // Finance message handlers (copied from CurrentRecords)
  const openFinanceModal = (studentId) => {
    setFinanceModal({
      open: true,
      studentId: studentId,
      message: '',
      attachment: null,
      attachmentName: '',
      sending: false,
    });
  };

  const closeFinanceModal = () => {
    setFinanceModal(prev => ({ ...prev, open: false }));
  };

  const handleFinanceAttachment = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFinanceModal(prev => ({ ...prev, attachment: file, attachmentName: file.name }));
  };

  const handleSendFinanceMessage = async () => {
    if (!financeModal.message.trim() && !financeModal.attachment) {
      showModal('error', 'Please enter a message or attach a file.');
      return;
    }
    setFinanceModal(prev => ({ ...prev, sending: true }));
    try {
      const formData = new FormData();
      formData.append('sender_role', 'parent');
      formData.append('recipient_type', 'finance_officer');
      formData.append('student_id', financeModal.studentId);
      formData.append('message', financeModal.message);
      if (financeModal.attachment) {
        formData.append('attachment', financeModal.attachment);
      }

      const res = await fetch(`${API_BASE}/api/messages/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        showModal('success', 'Message sent to Finance Officer.');
        closeFinanceModal();
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed to send message.');
      }
    } catch {
      showModal('error', 'Network error.');
    } finally {
      setFinanceModal(prev => ({ ...prev, sending: false }));
    }
  };

  if (loadingChildren) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <FaSpinner className="animate-spin text-4xl text-indigo-600" />
        <span className="ml-3 text-gray-600 text-lg font-medium">Loading children's records...</span>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent mb-8">
            Previous Records
          </h1>
          <div className="bg-white rounded-2xl shadow-md p-12">
            <FaChild className="text-5xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No children linked to your account.</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedChild = children.find(c => c.student_id === Number(selectedChildId));
  const hasOutstandingBalance = selectedChild && selectedChild.fees_balance > 0;

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            Previous Records
          </h1>
          <p className="text-gray-500 mt-2">View academic history across all terms</p>
        </div>

        {/* Child Selector */}
        <div className="mb-8 flex justify-center">
          <div className="relative inline-block">
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-xl px-5 py-3 pr-10 text-lg font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            >
              {children.map(child => (
                <option key={child.student_id} value={child.student_id}>
                  {child.name} – {child.class_name} {child.stream_name ? `(${child.stream_name})` : ''}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Back button when viewing a report */}
        {selectedReport && (
          <div className="mb-4">
            <button
              onClick={goBackToTerms}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition"
            >
              <FaArrowLeft /> Back to Terms
            </button>
          </div>
        )}

        {/* Terms List or Full Report */}
        {selectedReport ? (
          // --- Full Report View (full width, similar to CurrentRecords) ---
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Top Banner */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                    <FaGraduationCap className="text-3xl" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedReport.name}</h2>
                    <p className="text-indigo-100 text-sm">
                      {selectedReport.student_number} · {selectedReport.class_name}
                      {selectedReport.stream_name ? ` (${selectedReport.stream_name})` : ''}
                    </p>
                    <p className="text-indigo-200 text-xs mt-1">
                      {selectedReport.term_name} · {selectedReport.academic_year}
                      {selectedReport.grading_type === 'skill' ? ' · Skill‑Based' : ' · Numeric'}
                    </p>
                  </div>
                </div>
                {!selectedReport.results_withheld && <FaBookOpen className="text-3xl opacity-30" />}
                {selectedReport.results_withheld && <FaMoneyBillWave className="text-3xl opacity-30" />}
              </div>
            </div>

            {/* Withheld Banner with Bank Details & Message Button */}
            {selectedReport.results_withheld && (
              <div className="p-8 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-200">
                <div className="flex flex-col items-center text-center">
                  <FaExclamationCircle className="text-red-500 text-5xl mb-4" />
                  <h2 className="text-2xl font-bold text-red-700 mb-2">Results Withheld</h2>
                  <p className="text-red-600 text-lg mb-1">
                    Outstanding balance: <span className="font-bold">MK {selectedReport.fees_balance?.toLocaleString()}</span>
                  </p>
                  <p className="text-gray-500 text-sm mb-8">
                    Please settle the outstanding fees to access this report card.
                  </p>

                  {/* Bank details */}
                  {bankDetails.length > 0 && (
                    <div className="w-full max-w-2xl mb-6">
                      <h3 className="font-semibold text-gray-800 mb-4">Payment Instructions</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {bankDetails.map(bank => (
                          <div key={bank.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-start gap-3 text-left">
                            <FaUniversity className="text-indigo-500 mt-1 text-xl" />
                            <div className="text-sm">
                              <p className="font-semibold text-gray-800">{bank.bank_name}</p>
                              <p className="text-gray-600">Account Name: {bank.account_name}</p>
                              <p className="text-gray-600">Account Number: {bank.account_number}</p>
                              {bank.branch && <p className="text-gray-600">Branch: {bank.branch}</p>}
                              {bank.swift_code && <p className="text-gray-600">Swift: {bank.swift_code}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Finance Officer Button */}
                  <button
                    onClick={() => openFinanceModal(selectedReport.student_id)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition shadow-md"
                  >
                    <FaPaperPlane /> Message Finance Officer
                  </button>
                </div>
              </div>
            )}

            {/* Academic Content – hidden when withheld */}
            {!selectedReport.results_withheld && (
              <div className="p-6">
                {selectedReport.no_grades ? (
                  <div className="text-center py-8 text-gray-500">
                    <FaChartLine className="text-4xl mx-auto mb-2 text-gray-300" />
                    <p>No assessment data available for this term.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Numeric summary cards */}
                    {selectedReport.grading_type !== 'skill' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
                          <p className="text-sm text-indigo-600 font-medium mb-1">Average Score</p>
                          <p className="text-3xl font-bold text-indigo-900">{selectedReport.average ?? '—'}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-5 rounded-xl border border-emerald-100">
                          <p className="text-sm text-emerald-600 font-medium mb-1">Class Position</p>
                          <p className="text-3xl font-bold text-emerald-900">
                            {selectedReport.class_position ?? '—'} <span className="text-lg font-normal text-emerald-700">/ {selectedReport.class_total}</span>
                          </p>
                        </div>
                        {selectedReport.stream_position && (
                          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-5 rounded-xl border border-amber-100">
                            <p className="text-sm text-amber-600 font-medium mb-1">Stream Position</p>
                            <p className="text-3xl font-bold text-amber-900">{selectedReport.stream_position}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Promotion banner */}
                    {selectedReport.promotion && (
                      <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl flex items-center gap-4">
                        <FaTrophy className="text-green-500 text-2xl" />
                        <div>
                          <p className="font-bold text-green-800 text-lg">
                            {selectedReport.promotion.promoted
                              ? selectedReport.promotion.graduating ? '🎓 Graduating!' : `Promoted to ${selectedReport.promotion.next_class}`
                              : 'Not promoted'}
                          </p>
                          {selectedReport.promotion.next_opening_date && (
                            <p className="text-sm text-green-600">Next opening: {selectedReport.promotion.next_opening_date}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Skill Assessments */}
                    {selectedReport.grading_type === 'skill' && selectedReport.grades && (
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                          <FaAward className="text-indigo-500" /> Skill Assessments
                        </h3>
                        {(() => {
                          const skills = Array.isArray(selectedReport.grades) ? selectedReport.grades : [];
                          if (skills.length === 0) return <p className="text-gray-500">No skill assessments recorded.</p>;
                          const competencies = [];
                          skills.forEach(skill => {
                            let comp = competencies.find(c => c.name === skill.competency);
                            if (!comp) {
                              comp = {
                                name: skill.competency,
                                description: skill.competency_description || '',
                                skills: [],
                              };
                              competencies.push(comp);
                            }
                            comp.skills.push(skill);
                          });
                          return competencies.map(comp => (
                            <div key={comp.name} className="bg-gray-50 rounded-xl p-5 border border-gray-100 mb-4">
                              <h4 className="text-lg font-semibold text-indigo-800">{comp.name}</h4>
                              {comp.description && (
                                <p className="text-sm text-gray-500 mt-1 mb-4">{comp.description}</p>
                              )}
                              <div className="space-y-3">
                                {comp.skills.map((skill, idx) => {
                                  const ratingInfo = ratingConfig[skill.rating] || { label: 'Not rated', color: 'bg-gray-100 text-gray-600', icon: FaExclamationCircle };
                                  const IconComp = ratingInfo.icon;
                                  return (
                                    <div key={idx} className="bg-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-medium text-gray-800">{skill.skill}</span>
                                        </div>
                                        {skill.skill_description && (
                                          <p className="text-xs text-gray-500 ml-6">{skill.skill_description}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${ratingInfo.color}`}>
                                          <IconComp className="text-xs" /> {skill.rating}
                                        </span>
                                        {skill.comment && (
                                          <span className="text-xs text-gray-500 italic">{skill.comment}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}

                    {/* Numeric Grades Table */}
                    {selectedReport.grading_type !== 'skill' && selectedReport.grades && selectedReport.grades.length > 0 && (
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                          <FaChartLine className="text-indigo-500" /> Subject Grades
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full text-left">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="p-4 font-semibold text-gray-600 text-sm">Subject</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm">Score</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm">Grade</th>
                                <th className="p-4 font-semibold text-gray-600 text-sm">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedReport.grades.map((g, idx) => (
                                <tr key={idx} className="border-t hover:bg-blue-50/50 transition">
                                  <td className="p-4 font-medium text-gray-800">{g.subject}</td>
                                  <td className="p-4">{g.score ?? '—'}</td>
                                  <td className="p-4">
                                    <span className="inline-block bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-sm font-semibold">
                                      {g.grade ?? '—'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-sm text-gray-600">{g.remarks ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Teacher's Comment */}
                    {selectedReport.comment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                        <h3 className="font-semibold text-amber-800 mb-2">Teacher's Comment</h3>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedReport.comment}</p>
                      </div>
                    )}

                    {/* Download button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDownloadReport(selectedReport.student_id, selectedTerm.term_id)}
                        disabled={downloading === selectedTerm.term_id}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50 shadow-md"
                      >
                        {downloading === selectedTerm.term_id ? <FaSpinner className="animate-spin" /> : <FaDownload />}
                        {downloading === selectedTerm.term_id ? 'Downloading...' : 'Download Report Card'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // --- Terms List (grid) ---
          <>
            {loadingTerms ? (
              <div className="flex justify-center py-12">
                <FaSpinner className="animate-spin text-3xl text-indigo-600" />
                <span className="ml-3 text-gray-600">Loading terms...</span>
              </div>
            ) : terms.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                <FaHistory className="text-5xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No previous terms with assessment data found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {terms.map((term) => {
                  // Hide average & class position if child has outstanding balance
                  const hideStats = hasOutstandingBalance;
                  return (
                    <div
                      key={term.term_id}
                      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6 border border-gray-100 cursor-pointer"
                      onClick={() => loadReport(term)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{term.term_name}</h3>
                          <p className="text-sm text-gray-500">{term.academic_year}</p>
                          <div className="mt-2">
                            <span className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-medium">
                              {term.assessment_type === 'mid_term' ? 'Mid-Term' : 'End of Term'}
                            </span>
                          </div>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-full">
                          <FaCalendarAlt className="text-indigo-500" />
                        </div>
                      </div>
                      {!hideStats && (
                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Average</span>
                            <p className="font-semibold">{term.average ?? '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Class Pos.</span>
                            <p className="font-semibold">{term.class_position ?? '—'}</p>
                          </div>
                          {term.stream_position && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Stream Pos.</span>
                              <p className="font-semibold">{term.stream_position}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {hideStats && (
                        <div className="mt-4 text-sm text-red-600 font-medium flex items-center gap-1">
                          <FaExclamationCircle /> Results withheld
                        </div>
                      )}
                      <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium">
                        <FaEye className="mr-1" /> View Details
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Finance Message Modal (same as CurrentRecords) */}
      {financeModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Message Finance Officer</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm">Message</label>
                <textarea
                  value={financeModal.message}
                  onChange={e => setFinanceModal(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full p-2 border rounded"
                  rows={4}
                  placeholder="Explain your payment or attach proof of payment..."
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-indigo-600 flex items-center gap-1">
                  <FaPaperclip /> Attach file
                  <input type="file" className="hidden" onChange={handleFinanceAttachment} />
                </label>
                {financeModal.attachmentName && (
                  <span className="text-xs text-gray-600">{financeModal.attachmentName}</span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeFinanceModal} className="px-4 py-2 border rounded">Cancel</button>
              <button
                onClick={handleSendFinanceMessage}
                disabled={financeModal.sending}
                className="px-4 py-2 bg-indigo-600 text-white rounded flex items-center gap-2 disabled:opacity-50"
              >
                {financeModal.sending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                {financeModal.sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviousRecords;