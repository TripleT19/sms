import React, { useState, useEffect } from 'react';
import { FaCheckCircle, FaSpinner, FaSchool, FaLayerGroup } from 'react-icons/fa';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const PublishGradesPage = () => {
  const token = localStorage.getItem('auth_token');
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(null); // id of class being published
  const [message, setMessage] = useState({ type: '', text: '' });

  // Fetch list of terms on mount
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

  // Fetch submission status when term changes
  useEffect(() => {
    if (!selectedTermId) return;
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/grades/submission-status?term_id=${selectedTermId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data); // expected: array of { class_id, class_name, stream_name, status, ... }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [selectedTermId, token]);

  const handlePublish = async (submission) => {
    setPublishing(submission.class_id);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/grades/comments/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          class_id: submission.class_id,
          stream_id: submission.stream_id || null,
          term_id: selectedTermId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Grades for ${submission.class_name} published.` });
        // Update local status
        setSubmissions(prev =>
          prev.map(s =>
            s.class_id === submission.class_id && s.stream_id === submission.stream_id
              ? { ...s, status: 'published' }
              : s
          )
        );
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to publish.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setPublishing(null);
    }
  };

  const submissionsToShow = submissions.filter(s => s.status === 'submitted' || s.status === 'pending');

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">Publish Grades</h1>

      {/* Term Selector */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Select Term:</label>
        <select
          value={selectedTermId}
          onChange={(e) => setSelectedTermId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-600"
        >
          {terms.map(term => (
            <option key={term.id} value={term.id}>{term.name}</option>
          ))}
        </select>
        {loading && <FaSpinner className="animate-spin text-blue-600" />}
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Table of submitted classes */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-blue-50">
            <tr>
              <th className="p-4">Class</th>
              <th className="p-4">Stream</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {submissionsToShow.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  No classes with submitted grades in this term.
                </td>
              </tr>
            ) : (
              submissionsToShow.map(sub => (
                <tr key={`${sub.class_id}-${sub.stream_id || '0'}`} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-medium">{sub.class_name}</td>
                  <td className="p-4">{sub.stream_name || '—'}</td>
                  <td className="p-4">
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full uppercase">
                      {sub.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handlePublish(sub)}
                      disabled={publishing === sub.class_id}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                      {publishing === sub.class_id ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                      Publish
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PublishGradesPage;