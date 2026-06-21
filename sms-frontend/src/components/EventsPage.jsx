import React, { useState, useEffect } from 'react';
import {
  FaPlus, FaEdit, FaTrash, FaSearch, FaSpinner,
  FaCalendarAlt, FaTasks, FaBullhorn, FaPlane, FaGraduationCap, FaClock,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const EVENT_TYPES = [
  { value: 'exam', label: 'Exam', icon: <FaGraduationCap /> },
  { value: 'task', label: 'Task', icon: <FaTasks /> },
  { value: 'holiday', label: 'Holiday', icon: <FaPlane /> },
  { value: 'trip', label: 'Trip', icon: <FaPlane /> },
  { value: 'announcement', label: 'Announcement', icon: <FaBullhorn /> },
];

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  return new Date(dateTimeStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const EventsPage = () => {
  const token = localStorage.getItem('auth_token');

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  const [eventModal, setEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', type: 'announcement',
    start_date: '', end_date: '', deadline: '',
    target_parents: false, target_teachers: false, target_staff: false,
    class_id: '', stream_id: '',
    teachers: [],
  });

  const [selectAllTeachers, setSelectAllTeachers] = useState(false);

  const [classes, setClasses] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [availableStreams, setAvailableStreams] = useState([]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const confirmAction = (title, message, action) => {
    setConfirm({ isOpen: true, title, message, action });
  };
  const executeConfirm = () => { confirm.action?.(); setConfirm({ isOpen: false }); };

  // Helper to safely parse JSON responses
  const safeJsonParse = async (response, label) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error(`${label} response was not valid JSON:`, text.substring(0, 200));
      throw new Error(`${label} returned invalid data`);
    }
  };

  // Fetch initial data (classes + teachers)
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [classesRes, teachersRes] = await Promise.all([
          fetch(`${API_BASE}/api/academic/classes`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
          fetch(`${API_BASE}/api/events/teachers/list`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
        ]);

        if (classesRes.ok) {
          const cls = await safeJsonParse(classesRes, 'Classes');
          setClasses(cls);
        } else {
          showModal('error', 'Failed to load classes');
        }

        if (teachersRes.ok) {
          const teachersData = await safeJsonParse(teachersRes, 'Teachers');
          setAllTeachers(teachersData);
        } else {
          showModal('error', 'Failed to load teachers');
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        showModal('error', 'Failed to load class/teacher data');
      } finally {
        setInitialDataLoaded(true);
      }
    };
    fetchInitial();
  }, [token]);

  // Fetch events
  const fetchEvents = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (filterType) params.append('type', filterType);
    if (filterStatus) params.append('status', filterStatus);

    try {
      const res = await fetch(`${API_BASE}/api/events?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await safeJsonParse(res, 'Events');
        setEvents(data);
      } else {
        showModal('error', 'Failed to load events');
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      showModal('error', 'Could not load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialDataLoaded) {
      fetchEvents();
    }
  }, [search, filterType, filterStatus, initialDataLoaded]);

  // When class changes in form, update streams
  const handleClassChange = (classId) => {
    const selectedClass = classes.find(c => c.id == classId);
    setAvailableStreams(selectedClass?.streams || []);
    setForm(prev => ({ ...prev, class_id: classId, stream_id: '' }));
  };

  // Toggle all teachers
  const handleSelectAllTeachers = () => {
    if (selectAllTeachers) {
      setForm(prev => ({ ...prev, teachers: [] }));
    } else {
      setForm(prev => ({ ...prev, teachers: allTeachers.map(t => t.id) }));
    }
    setSelectAllTeachers(!selectAllTeachers);
  };

  // When teacher selection changes manually, update "select all" checkbox
  useEffect(() => {
    if (form.teachers.length === allTeachers.length && allTeachers.length > 0) {
      setSelectAllTeachers(true);
    } else {
      setSelectAllTeachers(false);
    }
  }, [form.teachers, allTeachers]);

  const openAddEvent = () => {
    setEditingEvent(null);
    setForm({
      title: '', description: '', type: 'announcement',
      start_date: '', end_date: '', deadline: '',
      target_parents: false, target_teachers: false, target_staff: false,
      class_id: '', stream_id: '',
      teachers: [],
    });
    setSelectAllTeachers(false);
    setAvailableStreams([]);
    setEventModal(true);
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      type: event.type,
      start_date: event.start_date || '',
      end_date: event.end_date || '',
      deadline: event.deadline ? event.deadline.slice(0, 16) : '',
      target_parents: event.target_parents,
      target_teachers: event.target_teachers,
      target_staff: event.target_staff,
      class_id: event.class_id || '',
      stream_id: event.stream_id || '',
      teachers: event.teachers?.map(t => t.id) || [],
    });
    setSelectAllTeachers(false);
    if (event.class_id) handleClassChange(event.class_id);
    setEventModal(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (payload.type !== 'task') delete payload.teachers;

    const url = editingEvent
      ? `${API_BASE}/api/events/${editingEvent.id}`
      : `${API_BASE}/api/events`;
    const method = editingEvent ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchEvents();
        showModal('success', editingEvent ? 'Event updated. Notifications will be sent.' : 'Event created. Notifications sent.');
        setEventModal(false);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = (id) => {
    confirmAction('Delete Event', 'Are you sure?', async () => {
      await fetch(`${API_BASE}/api/events/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchEvents();
      showModal('success', 'Event deleted');
    });
  };

  const getAudience = (event) => {
    const parts = [];
    if (event.target_parents) parts.push('Parents');
    if (event.target_teachers) parts.push('Teachers');
    if (event.target_staff) parts.push('Staff');
    if (event.class_id) {
      parts.push(event.class?.name + (event.stream ? ` ${event.stream.name}` : ''));
    }
    return parts.join(', ') || 'All';
  };

  const isTaskType = form.type === 'task';

  if (loading && !events.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
        <span className="ml-3 text-gray-600">Loading events...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-blue-50 min-h-screen">
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

      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6">Events & Announcements</h1>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:w-auto">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="p-2 border rounded-lg text-sm"
        >
          <option value="">All Types</option>
          {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="p-2 border rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
        <button onClick={openAddEvent} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
          <FaPlus /> New Event
        </button>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No events found. Create one using the button above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => {
            const isExpired = event.status === 'expired';
            return (
              <div key={event.id} className={`bg-white rounded-xl shadow p-5 border-l-4 ${isExpired ? 'border-gray-400 opacity-70' : 'border-blue-600'} relative`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold uppercase px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    {EVENT_TYPES.find(t => t.value === event.type)?.icon} {event.type}
                  </span>
                  {!isExpired && (
                    <div className="flex gap-2">
                      <button onClick={() => openEditEvent(event)} className="text-blue-600 hover:text-blue-800"><FaEdit /></button>
                      <button onClick={() => handleDeleteEvent(event.id)} className="text-red-600 hover:text-red-800"><FaTrash /></button>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">{event.title}</h3>
                {event.description && <p className="text-sm text-gray-600 mb-3">{event.description}</p>}

                <div className="text-xs text-gray-500 space-y-1">
                  {event.start_date && (
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt className="text-blue-500" />
                      <span>{formatDate(event.start_date)}{event.end_date ? ` — ${formatDate(event.end_date)}` : ''}</span>
                    </div>
                  )}
                  {event.deadline && (
                    <div className="flex items-center gap-2">
                      <FaClock className="text-red-500" />
                      <span>Deadline: {formatDateTime(event.deadline)}</span>
                      {isExpired && <span className="text-red-600 font-semibold">(Passed)</span>}
                    </div>
                  )}
                  {event.type === 'task' && event.teachers?.length > 0 && (
                    <div className="mt-2">
                      <span className="font-medium">Assigned to:</span>
                      <ul className="list-disc list-inside">
                        {event.teachers.map(t => <li key={t.id}>{t.first_name} {t.last_name}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="mt-2">
                    <span className="font-medium">Audience:</span> {getAudience(event)}
                  </div>
                  {isExpired && (
                    <div className="mt-2 text-red-600 font-semibold flex items-center gap-1">
                      <FaClock /> Expired
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Event Modal */}
      {eventModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-40 pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-fade-in overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">{editingEvent ? 'Edit Event' : 'Create Event'}</h2>
            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Title *</label>
                  <input type="text" name="title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Type *</label>
                  <select name="type" value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full p-2 border rounded">
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">Description</label>
                  <textarea name="description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows="3" className="w-full p-2 border rounded" />
                </div>

                {/* Date fields – only for non-task */}
                {!isTaskType && (
                  <>
                    <div>
                      <label className="block text-sm font-medium">Start Date</label>
                      <input type="date" name="start_date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">End Date</label>
                      <input type="date" name="end_date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                  </>
                )}

                {/* Deadline – only for tasks */}
                {isTaskType && (
                  <div>
                    <label className="block text-sm font-medium">Deadline</label>
                    <input type="datetime-local" name="deadline" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} className="w-full p-2 border rounded" />
                  </div>
                )}

                {/* Teacher assignment – only for tasks */}
                {isTaskType && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium">Assign Teachers</label>
                    {allTeachers.length === 0 ? (
                      <p className="text-sm text-gray-500">No teachers available.</p>
                    ) : (
                      <>
                        <div className="mb-1">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectAllTeachers}
                              onChange={handleSelectAllTeachers}
                            />
                            Select All Teachers
                          </label>
                        </div>
                        <select
                          multiple
                          value={form.teachers.map(String)}
                          onChange={e => setForm({...form, teachers: Array.from(e.target.selectedOptions, o => parseInt(o.value))})}
                          className="w-full p-2 border rounded h-32"
                        >
                          {allTeachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple, or use the "Select All" checkbox above.</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Target Audience – only for non-task */}
              {!isTaskType && (
                <div>
                  <label className="block text-sm font-medium mb-2">Target Audience</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.target_parents} onChange={e => setForm({...form, target_parents: e.target.checked})} />
                      Parents
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.target_teachers} onChange={e => setForm({...form, target_teachers: e.target.checked})} />
                      Teachers
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.target_staff} onChange={e => setForm({...form, target_staff: e.target.checked})} />
                      Staff
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-sm font-medium">Specific Class (optional)</label>
                      {classes.length === 0 ? (
                        <p className="text-sm text-gray-500">No classes available.</p>
                      ) : (
                        <select value={form.class_id} onChange={e => handleClassChange(e.target.value)} className="w-full p-2 border rounded">
                          <option value="">None</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                    </div>
                    {availableStreams.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium">Stream (optional)</label>
                        <select value={form.stream_id} onChange={e => setForm({...form, stream_id: e.target.value})} className="w-full p-2 border rounded">
                          <option value="">All Streams</option>
                          {availableStreams.map(s => <option key={s.id} value={s.id}>{s.stream_name || s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {saving ? <FaSpinner className="animate-spin" /> : null}
                  {saving ? 'Saving...' : (editingEvent ? 'Update' : 'Create')}
                </button>
                <button type="button" onClick={() => setEventModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;