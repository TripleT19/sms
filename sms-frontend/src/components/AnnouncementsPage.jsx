import React, { useState, useEffect } from 'react';
import { FaBullhorn, FaSpinner, FaCalendarAlt, FaUsers } from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const AnnouncementsPage = () => {
  const token = localStorage.getItem('auth_token');
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/events?type=announcement`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data);
        }
      } catch (err) {
        showModal('error', 'Failed to load announcements.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [token]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <FaSpinner className="animate-spin text-4xl text-indigo-600" />
        <span className="ml-3 text-gray-600 text-lg">Loading announcements...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            Announcements
          </h1>
          <p className="text-gray-500 mt-2">Stay updated with the latest school news and notices</p>
        </div>

        {announcements.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <FaBullhorn className="text-5xl mx-auto mb-3 text-gray-300" />
            <p className="text-lg">No announcements at the moment.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map(announcement => (
              <div key={announcement.id} className="bg-white rounded-2xl shadow-md hover:shadow-lg transition overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-800">{announcement.title}</h2>
                    {announcement.target_parents || announcement.target_teachers || announcement.target_staff ? (
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        <FaUsers className="text-gray-400" />
                        {announcement.target_parents ? ' Parents' : ''}
                        {announcement.target_teachers ? ' Teachers' : ''}
                        {announcement.target_staff ? ' Staff' : ''}
                      </span>
                    ) : null}
                  </div>

                  {announcement.description && (
                    <p className="text-gray-600 mb-4 whitespace-pre-wrap">{announcement.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <FaCalendarAlt className="text-gray-400" />
                      {formatDate(announcement.start_date)}
                      {announcement.end_date && ` – ${formatDate(announcement.end_date)}`}
                    </span>
                    {announcement.class && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                        {announcement.class.name}{announcement.stream ? ` (${announcement.stream.name})` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsPage;