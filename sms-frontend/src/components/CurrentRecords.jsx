import React, { useState, useEffect } from 'react';
import {
  FaDownload, FaSpinner, FaExclamationCircle, FaCheckCircle, FaUniversity,
  FaStar, FaChild, FaBookOpen, FaGraduationCap, FaTrophy, FaMedal,
  FaChartLine, FaAward, FaChevronDown, FaMoneyBillWave, FaPaperPlane, FaPaperclip,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const ratingConfig = {
  EE: { label: 'Exceeding Expectations', color: 'bg-emerald-100 text-emerald-800', icon: FaStar },
  A:  { label: 'Achieved',              color: 'bg-blue-100 text-blue-800',      icon: FaCheckCircle },
  D:  { label: 'Developing',            color: 'bg-amber-100 text-amber-800',    icon: FaMedal },
  B:  { label: 'Beginning',             color: 'bg-red-100 text-red-800',        icon: FaExclamationCircle },
};

const CurrentRecords = () => {
  const token = localStorage.getItem('auth_token');
  const [children, setChildren] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [downloading, setDownloading] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState('');

  // Finance message modal state
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
      } catch (err) {
        showModal('error', 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchChildren();
  }, [token]);

  const handleDownloadReport = async (studentId, termId) => {
    setDownloading(studentId);
    try {
      const res = await fetch(`${API_BASE}/api/parent/report-card/${studentId}?term_id=${termId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report.pdf`;
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

  // ---------- Finance message handlers ----------
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

  if (loading) {
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
            My Children's Records
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
  const gradesArray = selectedChild ? (Array.isArray(selectedChild.grades) ? selectedChild.grades : []) : [];
  const skillsArray = selectedChild ? (Array.isArray(selectedChild.skills) ? selectedChild.skills : []) : [];
  const isSkillBased = selectedChild?.grading_type === 'skill';
  const resultsWithheld = selectedChild?.results_withheld || selectedChild?.fees_balance > 0;

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            My Children's Records
          </h1>
          <p className="text-gray-500 mt-2">View academic progress and skill assessments</p>
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

        {/* Selected Child's Report */}
        {selectedChild ? (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all hover:shadow-xl">
            {/* Top Banner */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                    <FaGraduationCap className="text-3xl" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedChild.name}</h2>
                    <p className="text-indigo-100 text-sm">
                      {selectedChild.student_number} · {selectedChild.class_name}
                      {selectedChild.stream_name ? ` (${selectedChild.stream_name})` : ''}
                    </p>
                    <p className="text-indigo-200 text-xs mt-1">
                      {selectedChild.term_name ? `Term: ${selectedChild.term_name}` : ''}
                      {selectedChild.academic_year ? ` · Academic Year: ${selectedChild.academic_year}` : ''}
                      {isSkillBased ? ' · Skill‑Based Assessment' : ' · Numeric Grading'}
                    </p>
                  </div>
                </div>
                {!resultsWithheld && <FaBookOpen className="text-3xl opacity-30" />}
                {resultsWithheld && <FaMoneyBillWave className="text-3xl opacity-30" />}
              </div>
            </div>

            {/* Withheld Banner – now includes "Message Finance Officer" button */}
            {resultsWithheld && (
              <div className="p-8 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-200">
                <div className="flex flex-col items-center text-center">
                  <FaExclamationCircle className="text-red-500 text-5xl mb-4" />
                  <h2 className="text-2xl font-bold text-red-700 mb-2">Results Withheld</h2>
                  <p className="text-red-600 text-lg mb-1">
                    Outstanding balance: <span className="font-bold">MK {selectedChild.fees_balance.toLocaleString()}</span>
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
                    onClick={() => openFinanceModal(selectedChild.student_id)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition shadow-md"
                  >
                    <FaPaperPlane /> Message Finance Officer
                  </button>
                </div>
              </div>
            )}

            {/* Academic section – only when NOT withheld */}
            {!resultsWithheld && (
              <div className="p-6">
                {selectedChild.no_grades ? (
                  <div className="text-center py-8 text-gray-500">
                    <FaChartLine className="text-4xl mx-auto mb-2 text-gray-300" />
                    <p>No assessment data available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Numeric summary cards */}
                    {!isSkillBased && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
                          <p className="text-sm text-indigo-600 font-medium mb-1">Average Score</p>
                          <p className="text-3xl font-bold text-indigo-900">{selectedChild.average ?? '—'}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-5 rounded-xl border border-emerald-100">
                          <p className="text-sm text-emerald-600 font-medium mb-1">Class Position</p>
                          <p className="text-3xl font-bold text-emerald-900">
                            {selectedChild.position ?? '—'} <span className="text-lg font-normal text-emerald-700">/ {selectedChild.total_in_class}</span>
                          </p>
                        </div>
                        {selectedChild.stream_position && (
                          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-5 rounded-xl border border-amber-100">
                            <p className="text-sm text-amber-600 font-medium mb-1">Stream Position</p>
                            <p className="text-3xl font-bold text-amber-900">{selectedChild.stream_position}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Promotion banner */}
                    {selectedChild.promotion && (
                      <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl flex items-center gap-4">
                        <FaTrophy className="text-green-500 text-2xl" />
                        <div>
                          <p className="font-bold text-green-800 text-lg">
                            {selectedChild.promotion.promoted
                              ? selectedChild.promotion.graduating ? '🎓 Graduating!' : `Promoted to ${selectedChild.promotion.next_class}`
                              : 'Not promoted'}
                          </p>
                          {selectedChild.promotion.next_opening_date && (
                            <p className="text-sm text-green-600">Next opening: {selectedChild.promotion.next_opening_date}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Skill Assessments */}
                    {isSkillBased && (
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                          <FaAward className="text-indigo-500" /> Skill Assessments
                        </h3>
                        {skillsArray.length > 0 ? (
                          <div className="space-y-6">
                            {(() => {
                              const competencies = [];
                              skillsArray.forEach(skill => {
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
                                <div key={comp.name} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
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
                        ) : (
                          <p className="text-gray-500">No skill assessments recorded.</p>
                        )}
                      </div>
                    )}

                    {/* Numeric Grades Table */}
                    {!isSkillBased && gradesArray.length > 0 && (
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
                              {gradesArray.map((g, idx) => (
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
                    {selectedChild.comment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                        <h3 className="font-semibold text-amber-800 mb-2">Teacher's Comment</h3>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedChild.comment}</p>
                      </div>
                    )}

                    {/* Download button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDownloadReport(selectedChild.student_id, selectedChild.term_id)}
                        disabled={downloading === selectedChild.student_id}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50 shadow-md hover:shadow-lg"
                      >
                        {downloading === selectedChild.student_id ? <FaSpinner className="animate-spin" /> : <FaDownload />}
                        {downloading === selectedChild.student_id ? 'Downloading...' : 'Download Report Card'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500">Select a child to view records.</p>
        )}
      </div>

      {/* Finance Message Modal */}
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

export default CurrentRecords;