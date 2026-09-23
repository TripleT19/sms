import React, { useState, useEffect, useCallback } from 'react';
import { FaBell, FaCheck, FaSpinner, FaCheckDouble, FaCalendarAlt, FaUsers, FaChevronDown, FaChevronUp } from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const NotificationsPage = () => {
  const token = localStorage.getItem('auth_token');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedIds, setExpandedIds] = useState([]);

  const fetchNotifications = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/notifications?page=${pageNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_roles');
        window.location.href = '/login';
        return;
      }

      if (!res.ok) throw new Error('Failed to load notifications');

      const data = await res.json();
      if (pageNumber === 1) {
        setNotifications(data.data);
      } else {
        setNotifications(prev => [...prev, ...data.data]);
      }
      setHasMore(data.current_page < data.last_page);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage);
    }
  };

  const getEventAudience = (event) => {
    if (!event) return '';
    const parts = [];
    if (event.target_parents) parts.push('Parents');
    if (event.target_teachers) parts.push('Teachers');
    if (event.target_staff) parts.push('Staff');
    if (event.class) {
      parts.push(event.class.name);
      if (event.stream) parts.push(event.stream.name);
    }
    return parts.join(', ') || 'All';
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-blue-900">Notifications</h1>
        <button
          onClick={handleMarkAllAsRead}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <FaCheckDouble /> Mark All Read
        </button>
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex justify-center py-12">
          <FaSpinner className="animate-spin text-4xl text-blue-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FaBell className="text-5xl mx-auto mb-4 text-gray-300" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map(notif => {
              const isExpanded = expandedIds.includes(notif.id);
              const event = notif.event;

              return (
                <div
                  key={notif.id}
                  className={`bg-white rounded-xl shadow p-4 border-l-4 ${
                    notif.read_at ? 'border-gray-300' : 'border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div
                        className="cursor-pointer"
                        onClick={() => toggleExpand(notif.id)}
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-gray-800 font-medium">
                            {isExpanded
                              ? notif.message
                              : notif.message.length > 80
                                ? notif.message.slice(0, 80) + '…'
                                : notif.message}
                          </p>
                          <span className="text-gray-400 ml-2 mt-1 flex-shrink-0">
                            {isExpanded ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Expanded event details */}
                      {isExpanded && event && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                          <p className="font-semibold text-gray-700">{event.title}</p>
                          {event.description && (
                            <p className="text-gray-600">{event.description}</p>
                          )}
                          {(event.start_date || event.end_date) && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <FaCalendarAlt className="text-gray-400" size={12} />
                              <span>
                                {formatDate(event.start_date)}
                                {event.end_date ? ` – ${formatDate(event.end_date)}` : ''}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-gray-600">
                            <FaUsers className="text-gray-400" size={12} />
                            <span>{getEventAudience(event)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mark as read button */}
                    {!notif.read_at && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-gray-400 hover:text-blue-600 transition ml-4 flex-shrink-0"
                        title="Mark as read"
                      >
                        <FaCheck size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={loadMore}
                disabled={loading}
                className="bg-white border border-blue-300 text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NotificationsPage;