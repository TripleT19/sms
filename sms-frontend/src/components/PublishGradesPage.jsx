import React, { useState, useEffect } from 'react';
import {
  FaCheckCircle, FaSpinner, FaTimes,
} from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const PublishGradesPage = () => {
  const token = localStorage.getItem('auth_token');
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Assessment type for publishing (and for fetching submissions)
  const [assessmentType, setAssessmentType] = useState('end_term');

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Promotion modal
  const [promotionModal, setPromotionModal] = useState({
    open: false,
    submissions: [],
    promotionData: [],
    threshold: 50,
    nextOpeningDate: '',
    loadingSummary: false,
    publishingPromotion: false,
  });

  // ======================== HELPERS ========================

  const isFinalTerm = () => {
    const term = terms.find(t => t.id.toString() === selectedTermId);
    if (!term) return false;
    return (
      term.name.toLowerCase().includes('term 3') ||
      term.name.toLowerCase().includes('final') ||
      term.name.toLowerCase().includes('last')
    );
  };

  const buildKey = (sub) => `${sub.class_id}-${sub.stream_id || 'none'}`;

  // Fetch terms
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/academic/terms/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTerms(data);
          if (data.length > 0) setSelectedTermId(data[0].id.toString());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTerms();
  }, [token]);

  // Fetch submissions – now sends assessment_type
  useEffect(() => {
    if (!selectedTermId) return;
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/grades/submissions-list?term_id=${selectedTermId}&assessment_type=${assessmentType}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data);
          setSelectedIds(new Set());
          setSelectAll(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [selectedTermId, assessmentType, token]);

  // ======================== SINGLE / BULK PUBLISH ========================

  const openPublish = (submission) => {
    openPromotionModalIfNeeded([submission]);
  };

  const openBulkPublish = () => {
    const selectedSubmissions = submissions.filter(s => selectedIds.has(buildKey(s)));
    if (selectedSubmissions.length === 0) return;
    openPromotionModalIfNeeded(selectedSubmissions);
  };

  const openPromotionModalIfNeeded = async (submissionsList) => {
    if (isFinalTerm() && assessmentType === 'end_term') {
      // Show promotion settings only for final term end_term
      setPromotionModal({
        open: true,
        submissions: submissionsList,
        promotionData: [],
        threshold: 50,
        nextOpeningDate: '',
        loadingSummary: true,
        publishingPromotion: false,
      });
      await fetchPromotionSummaries(submissionsList);
    } else {
      // Direct publish (no promotion)
      executePublish(submissionsList);
    }
  };

  const fetchPromotionSummaries = async (submissionsList) => {
    const summaries = [];
    for (const sub of submissionsList) {
      try {
        const res = await fetch(
          `${API_BASE}/api/grades/promotion-data?term_id=${selectedTermId}&class_id=${sub.class_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const item = data.find(
            d => d.class_id === sub.class_id && d.stream_id === sub.stream_id
          );
          if (item) summaries.push(item);
        }
      } catch (err) {
        // ignore
      }
    }
    setPromotionModal(prev => ({
      ...prev,
      loadingSummary: false,
      promotionData: summaries,
    }));
  };

  const executePublish = async (submissionsList, promotionPayload = null) => {
    const keys = submissionsList.map(s => buildKey(s));
    if (submissionsList.length === 1) {
      setPublishing(keys[0]);
    } else {
      setBulkPublishing(true);
    }

    setMessage({ type: '', text: '' });
    let successCount = 0;
    let errorCount = 0;

    for (const sub of submissionsList) {
      const body = {
        class_id: sub.class_id,
        stream_id: sub.stream_id || null,
        term_id: selectedTermId,
        assessment_type: assessmentType,   // ← include assessment type
      };
      if (promotionPayload) {
        body.threshold = promotionPayload.threshold;
        body.next_opening_date = promotionPayload.next_opening_date || null;
      }

      try {
        const res = await fetch(`${API_BASE}/api/grades/publish-and-promote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          successCount++;
          setSubmissions(prev =>
            prev.filter(s => !(s.class_id === sub.class_id && s.stream_id === sub.stream_id))
          );
          setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(buildKey(sub));
            return next;
          });
        } else {
          errorCount++;
          if (submissionsList.length === 1) {
            setMessage({ type: 'error', text: data.message || 'Publish failed.' });
          }
        }
      } catch {
        errorCount++;
      }
    }

    if (submissionsList.length > 1) {
      setMessage({
        type: successCount > 0 ? 'success' : 'error',
        text: `Published ${successCount} class(es).${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
      });
    } else if (successCount === 1) {
      const sub = submissionsList[0];
      setMessage({
        type: 'success',
        text: `Published ${sub.class_name}${sub.stream_name ? ' (' + sub.stream_name + ')' : ''} (${assessmentType === 'mid_term' ? 'Mid-Term' : 'End of Term'}).`,
      });
    }

    setPublishing(null);
    setBulkPublishing(false);
    setPromotionModal(prev => ({ ...prev, open: false }));
  };

  const handlePromotionConfirm = () => {
    executePublish(promotionModal.submissions, {
      threshold: promotionModal.threshold,
      next_opening_date: promotionModal.nextOpeningDate,
    });
  };

  // Selection logic
  const toggleSelection = (key) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(submissions.map(s => buildKey(s))));
      setSelectAll(true);
    }
  };

  useEffect(() => {
    if (submissions.length > 0 && selectedIds.size === submissions.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedIds, submissions]);

  // ======================== RENDER HELPERS ========================

  const getPromotionSummaryText = (item, threshold) => {
    if (!item) return 'Loading...';
    const isSkillClass = item.students.length > 0 && item.students[0].average === null;
    if (isSkillClass) {
      return `${item.students.length} student(s) will be promoted based on teacher assessment.`;
    }
    const above = item.students.filter(s => s.average !== null && s.average >= threshold).length;
    const isLastClass = item.next_classes.length === 0;
    if (isLastClass) {
      return `${above} student(s) will graduate (above ${threshold}%).`;
    } else {
      const nextClassName = item.next_classes[0]?.name || 'next class';
      return `${above} student(s) will be promoted to ${nextClassName} (above ${threshold}%).`;
    }
  };

  // ======================== RENDER ========================

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">Publish Grades</h1>

      {/* Term and Assessment Type selectors */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-sm font-medium text-gray-700">Term:</label>
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 ml-2"
          >
            {terms.map(term => (
              <option key={term.id} value={term.id}>{term.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Assessment Type:</label>
          <select
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 ml-2"
          >
            <option value="end_term">End of Term</option>
            <option value="mid_term">Mid Term</option>
          </select>
        </div>
        {loading && <FaSpinner className="animate-spin text-blue-600" />}
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Bulk actions */}
      {submissions.length > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={selectAll} onChange={handleSelectAll} />
            Select All
          </label>
          <button
            onClick={openBulkPublish}
            disabled={bulkPublishing || selectedIds.size === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            {bulkPublishing ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
            Publish Selected ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Submission table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-blue-50">
            <tr>
              <th className="p-4 w-10">
                <input type="checkbox" checked={selectAll} onChange={handleSelectAll} disabled={submissions.length === 0} />
              </th>
              <th className="p-4">Class</th>
              <th className="p-4">Stream</th>
              <th className="p-4">Progress</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No classes with submitted grades ready to publish.
                </td>
              </tr>
            ) : (
              submissions.map(sub => {
                const key = buildKey(sub);
                const isPublishingSingle = publishing === key;
                return (
                  <tr key={key} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(key)}
                        onChange={() => toggleSelection(key)}
                      />
                    </td>
                    <td className="p-4 font-medium">{sub.class_name}</td>
                    <td className="p-4">{sub.stream_name || '—'}</td>
                    <td className="p-4">{sub.submitted_count} / {sub.total_students}</td>
                    <td className="p-4">
                      <button
                        onClick={() => openPublish(sub)}
                        disabled={isPublishingSingle || bulkPublishing}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {isPublishingSingle ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                        Publish
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ==================== PROMOTION MODAL (unchanged) ==================== */}
      {promotionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-900">
                Final Term – Promotion Settings
              </h2>
              <button
                onClick={() => setPromotionModal(prev => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {promotionModal.loadingSummary ? (
              <div className="flex justify-center py-8">
                <FaSpinner className="animate-spin text-2xl text-blue-600" />
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="space-y-3 mb-6">
                  {promotionModal.promotionData.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                      <p className="font-medium">{item.class_name}{item.stream_name ? ` (${item.stream_name})` : ''}</p>
                      <p className="text-gray-600">
                        {getPromotionSummaryText(item, promotionModal.threshold)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium">Minimum Average for Promotion</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={promotionModal.threshold}
                      onChange={(e) =>
                        setPromotionModal(prev => ({ ...prev, threshold: Number(e.target.value) }))
                      }
                      className="w-full p-2 border rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      (Applies only to numeric classes; skill classes are promoted based on teacher assessment.)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Next School Opening Date</label>
                    <input
                      type="date"
                      value={promotionModal.nextOpeningDate}
                      onChange={(e) =>
                        setPromotionModal(prev => ({ ...prev, nextOpeningDate: e.target.value }))
                      }
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-4">
                  <button
                    onClick={handlePromotionConfirm}
                    disabled={promotionModal.publishingPromotion}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {promotionModal.publishingPromotion ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                    Confirm & Publish
                  </button>
                  <button
                    onClick={() => setPromotionModal(prev => ({ ...prev, open: false }))}
                    className="border px-6 py-2 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishGradesPage;