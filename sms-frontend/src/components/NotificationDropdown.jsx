import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaCheck, FaSpinner, FaTimes, FaCalendarAlt, FaUsers } from 'react-icons/fa';

const API_BASE = 'https://laravel.moyorise.com';

const NotificationDropdown = ({ unreadCount, setUnreadCount }) => {
  const token = localStorage.getItem('auth_token');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      } else if (res.status === 401) {
        localStorage.clear();
        navigate('/login');
      }
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    setOpen(!open);
    if (!open) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id) => {
    await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative text-gray-500 hover:text-blue-600 transition"
      >
        <FaBell className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <FaTimes size={14} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <FaSpinner className="animate-spin text-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">No new notifications</p>
            ) : (
              notifications.map(notif => {
                const isExpanded = expandedId === notif.id;
                const event = notif.event;

                return (
                  <div key={notif.id} className="border-b border-gray-50 last:border-b-0">
                    <div
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition"
                      onClick={() => toggleExpand(notif.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            {isExpanded
                              ? notif.message
                              : notif.message.length > 60
                                ? notif.message.slice(0, 60) + '…'
                                : notif.message}
                          </p>
                          {!isExpanded && notif.message.length > 60 && (
                            <span className="text-xs text-blue-600">Read more</span>
                          )}

                          {isExpanded && event && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                              <p className="font-medium text-gray-700">{event.title}</p>
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

                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                          }}
                          className="text-gray-400 hover:text-blue-600 transition ml-2 flex-shrink-0"
                          title="Mark as read"
                        >
                          <FaCheck size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2 text-center">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/dashboard/notifications');
              }}
              className="text-sm text-blue-600 hover:underline w-full"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;