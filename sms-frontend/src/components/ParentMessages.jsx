import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaPlus, FaPaperPlane, FaInbox, FaSpinner,
  FaCheck, FaCheckDouble, FaSync, FaTimes,
  FaEdit, FaTrash, FaDownload, FaPaperclip, FaFile,
  FaArrowDown, FaShare,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';
const POLL_INTERVAL = 1000;

const ParentMessages = () => {
  const token = localStorage.getItem('auth_token');
  const [userId, setUserId] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [showNewMsgModal, setShowNewMsgModal] = useState(false);
  const [senderRole, setSenderRole] = useState('parent');
  // Pre‑cached staff list for teachers
  const [staffList, setStaffList] = useState([]);
  const [recipientsData, setRecipientsData] = useState(null);
  const [newMsgData, setNewMsgData] = useState({
    student_id: '',
    recipient_type: 'class_teacher',
    recipient_id: '',
    subject_id: '',
    message: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingBody, setEditingBody] = useState('');

  // Preview modal
  const [previewModal, setPreviewModal] = useState({ open: false, url: '', name: '', type: '' });

  // Confirm dialog (delete)
  const [confirmDelete, setConfirmDelete] = useState({ open: false, messageId: null });

  // Forward modal
  const [forwardModal, setForwardModal] = useState({ open: false, messageId: null, recipients: [] });
  const [forwardRecipient, setForwardRecipient] = useState('');
  const [forwardComment, setForwardComment] = useState('');

  // Scroll refs
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isAtBottom = useRef(true);
  const prevMessageCount = useRef(0);
  const initialScrollDone = useRef(false);

  const [showNewMsgIndicator, setShowNewMsgIndicator] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });

  /* Scroll helpers */
  const checkIfAtBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return false;
    const threshold = 2;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      isAtBottom.current = true;
      setShowScrollButton(false);
      setShowNewMsgIndicator(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    isAtBottom.current = atBottom;
    setShowScrollButton(!atBottom);
    if (atBottom) setShowNewMsgIndicator(false);
  }, [checkIfAtBottom]);

  /* Fetch user + preload staff list */
  useEffect(() => {
    const fetchUser = async () => {
      const res = await fetch(`${API_BASE}/api/user`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUserId(data.id);
        const roles = data.roles?.map(r => r.name) || [];
        setUserRoles(roles);
        if (roles.includes('Parent')) setSenderRole('parent');
        else if (roles.includes('Teacher')) setSenderRole('teacher');

        // Preload staff list if user is a teacher
        if (roles.includes('Teacher')) {
          try {
            const staffRes = await fetch(`${API_BASE}/api/messages/recipients?sender_role=teacher`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (staffRes.ok) {
              const staffData = await staffRes.json();
              setStaffList(staffData.staff_members || []);
            }
          } catch (e) { /* ignore */ }
        }
      }
    };
    fetchUser();
  }, [token]);

  /* Fetch conversations */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setConversations(await res.json());
    } catch (err) { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  /* Fetch messages */
  const fetchMessages = useCallback(async (convId) => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/conversations/${convId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const newMsgs = data.conversation?.messages || [];
        setMessages(newMsgs);
        if (newMsgs.length > prevMessageCount.current && !isAtBottom.current) {
          setShowNewMsgIndicator(true);
        }
        prevMessageCount.current = newMsgs.length;
      }
    } catch (err) { /* silent */ }
  }, [token]);

  /* Conversation selection & polling */
  useEffect(() => {
    if (selectedConv) {
      setLoadingMessages(true);
      initialScrollDone.current = false;
      fetchMessages(selectedConv).finally(() => {
        setLoadingMessages(false);
        if (!initialScrollDone.current) {
          scrollToBottom();
          initialScrollDone.current = true;
        }
      });
      pollingRef.current = setInterval(() => fetchMessages(selectedConv), POLL_INTERVAL);
    } else {
      setMessages([]);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      prevMessageCount.current = 0;
      setShowNewMsgIndicator(false);
      setShowScrollButton(false);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedConv, fetchMessages, scrollToBottom]);

  /* Send reply */
  const handleSendReply = async () => {
    if ((!newMessage.trim() && !attachment) || sending || !selectedConv) return;
    setSending(true);
    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId, body: newMessage, attachment: attachmentPreview,
      attachment_name: attachment?.name, attachment_type: attachment?.type,
      sender_id: userId, sender_name: 'You', created_at: 'Just now',
      read_at: null, sending: true, edited: false, is_deleted: false,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(), 50);
    const messageText = newMessage;
    const file = attachment;
    setNewMessage(''); setAttachment(null); setAttachmentPreview(null);

    try {
      const formData = new FormData();
      formData.append('body', messageText);
      if (file) formData.append('attachment', file);
      const res = await fetch(`${API_BASE}/api/messages/conversations/${selectedConv}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        showModal('error', 'Failed to send.');
      } else {
        await fetchMessages(selectedConv);
        scrollToBottom();
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      showModal('error', 'Network error.');
    } finally { setSending(false); }
  };

  /* File select */
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttachment(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachmentPreview(reader.result);
      reader.readAsDataURL(file);
    } else setAttachmentPreview(null);
  };

  /* Attachment preview */
  const openPreview = (url, name, type) => setPreviewModal({ open: true, url, name, type });
  const closePreview = () => setPreviewModal({ open: false, url: '', name: '', type: '' });
  const handleDownload = (url, name) => {
    const a = document.createElement('a'); a.href = url; a.download = name || 'attachment'; a.click();
  };

  /* Edit */
  const handleEditClick = (msg) => { setEditingMsgId(msg.id); setEditingBody(msg.body); };
  const handleEditSave = async () => {
    if (!editingBody.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/${editingMsgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: editingBody }),
      });
      if (res.ok) { setEditingMsgId(null); await fetchMessages(selectedConv); }
      else showModal('error', 'Edit failed.');
    } catch { showModal('error', 'Network error.'); }
  };
  const handleEditCancel = () => { setEditingMsgId(null); };

  /* Delete */
  const handleDeleteClick = (msgId) => setConfirmDelete({ open: true, messageId: msgId });
  const handleDeleteConfirm = async () => {
    const msgId = confirmDelete.messageId;
    setConfirmDelete({ open: false, messageId: null });
    if (!msgId) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/${msgId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await fetchMessages(selectedConv);
      else showModal('error', 'Delete failed.');
    } catch { showModal('error', 'Network error.'); }
  };
  const handleDeleteCancel = () => setConfirmDelete({ open: false, messageId: null });

  /* Forward */
  const openForwardModal = (msgId) => {
    // Use pre‑cached staff list
    setForwardModal({ open: true, messageId: msgId, recipients: staffList });
    setForwardRecipient(staffList[0]?.id?.toString() || '');
    setForwardComment('');
  };
  const handleForwardSend = async () => {
    if (!forwardRecipient || !forwardModal.messageId) return;
    try {
      const res = await fetch(`${API_BASE}/api/messages/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: forwardModal.messageId, recipient_id: forwardRecipient, comment: forwardComment }),
      });
      if (res.ok) {
        setForwardModal({ open: false, messageId: null, recipients: [] });
        showModal('success', 'Message forwarded.');
      } else {
        showModal('error', 'Forward failed.');
      }
    } catch { showModal('error', 'Network error.'); }
  };

  /* New message modal – reset everything and open */
  const openNewMessageModal = async () => {
    // Reset all fields completely
    setNewMsgData({
      student_id: '',
      recipient_type: senderRole === 'parent' ? 'class_teacher' : 'staff_member',
      recipient_id: '',
      subject_id: '',
      message: '',
    });
    setAttachment(null);
    setAttachmentPreview(null);

    if (senderRole === 'parent') {
      // Fetch parent recipients (children) fresh each time
      try {
        const res = await fetch(`${API_BASE}/api/messages/recipients?sender_role=parent`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRecipientsData(data);
          if (Array.isArray(data) && data.length > 0) {
            setNewMsgData(prev => ({ ...prev, student_id: data[0].student_id }));
          }
        }
      } catch { showModal('error', 'Failed to load recipients.'); }
    } else {
      // For teacher, just use pre‑cached staff list – no delay!
      setRecipientsData({ staff_members: staffList });
    }
    setShowNewMsgModal(true);
  };

  const handleCloseNewMessageModal = () => {
    setShowNewMsgModal(false);
    // Reset everything on close
    setNewMsgData({
      student_id: '',
      recipient_type: 'class_teacher',
      recipient_id: '',
      subject_id: '',
      message: '',
    });
    setAttachment(null);
    setAttachmentPreview(null);
    setRecipientsData(null);
  };

  const handleNewMessageSubmit = async () => {
    const formData = new FormData();
    formData.append('sender_role', senderRole);
    formData.append('recipient_type', newMsgData.recipient_type);
    if (senderRole === 'parent') {
        formData.append('student_id', newMsgData.student_id || '');
    }
    formData.append('subject_id', newMsgData.subject_id || '');
    formData.append('message', newMsgData.message || '');
    if (senderRole === 'teacher') formData.append('recipient_id', newMsgData.recipient_id || '');
    if (attachment) formData.append('attachment', attachment);

    try {
      const res = await fetch(`${API_BASE}/api/messages/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        handleCloseNewMessageModal();   // reset & close
        await fetchConversations();
        setSelectedConv(data.conversation_id);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed to start conversation.');
      }
    } catch { showModal('error', 'Network error.'); }
  };

  /* Ticks */
  const getTickIcon = (msg) => {
    if (msg.sending) return <FaSpinner className="animate-spin text-xs text-gray-400" />;
    if (msg.sender_id !== userId) return null;
    if (msg.read_at) return <FaCheckDouble className="text-blue-500 text-xs" title="Read" />;
    return <FaCheck className="text-gray-400 text-xs" title="Sent" />;
  };

  const handleCloseConversation = () => { setSelectedConv(null); setMessages([]); };
  const storageUrl = (path) => `${API_BASE}/${path}`;
  const isBoth = userRoles.includes('Parent') && userRoles.includes('Teacher');
  const isTeacher = userRoles.includes('Teacher');

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <FaSpinner className="animate-spin text-2xl text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={() => setModal({ ...modal, isOpen: false })} />

      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-blue-900 mb-2">Delete Message</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this message?</p>
            <div className="flex justify-end gap-4">
              <button onClick={handleDeleteCancel} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-indigo-900 mb-6">Messages</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-1/3 bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Conversations</h2>
            <div className="flex gap-2">
              <button onClick={fetchConversations} className="text-indigo-600 hover:text-indigo-800"><FaSync /></button>
              <button onClick={openNewMessageModal} className="text-indigo-600 hover:text-indigo-800"><FaPlus /></button>
            </div>
          </div>
          {conversations.length === 0 ? (
            <p className="text-gray-500">No conversations.</p>
          ) : (
            <ul className="space-y-2">
              {conversations.map(conv => (
                <li
                  key={conv.id}
                  className={`p-3 rounded-lg cursor-pointer ${selectedConv === conv.id ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
                  onClick={() => setSelectedConv(conv.id)}
                >
                  <p className="font-medium">{conv.other_user}</p>
                  <p className="text-sm text-gray-600 truncate">{conv.last_message?.body || conv.subject}</p>
                  {conv.unread && <span className="inline-block w-2 h-2 bg-red-500 rounded-full ml-1" />}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Message panel */}
        <div className="w-2/3 bg-white rounded-xl shadow p-4 flex flex-col relative">
          {selectedConv ? (
            <>
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                <h3 className="font-semibold text-gray-700">
                  {conversations.find(c => c.id === selectedConv)?.other_user || 'Conversation'}
                </h3>
                <button onClick={handleCloseConversation} className="text-gray-400 hover:text-red-500"><FaTimes /></button>
              </div>

              {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                  <FaSpinner className="animate-spin text-2xl text-indigo-600" />
                </div>
              ) : (
                <>
                  {showNewMsgIndicator && (
                    <button onClick={scrollToBottom} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-2 self-center hover:bg-indigo-200 transition">
                      New messages ↓
                    </button>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-3 mb-4" ref={messagesContainerRef} onScroll={handleScroll}>
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_id === userId ? 'justify-end' : ''}`}>
                        <div className={`max-w-xs p-3 rounded-lg ${msg.sender_id === userId ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                          {msg.is_deleted ? (
                            <p className="text-sm italic opacity-70">This message was deleted</p>
                          ) : (
                            <>
                              {msg.attachment && (
                                <div className="mb-2 cursor-pointer" onClick={() => openPreview(storageUrl(msg.attachment), msg.attachment_name, msg.attachment_type)}>
                                  {msg.attachment_type?.startsWith('image/') ? (
                                    <img src={storageUrl(msg.attachment)} alt={msg.attachment_name} className="max-w-full rounded-lg max-h-32 object-cover" />
                                  ) : (
                                    <div className="flex items-center gap-2 p-2 bg-white/20 rounded-lg">
                                      <FaFile className="text-lg" />
                                      <span className="text-xs truncate">{msg.attachment_name || 'File'}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {editingMsgId === msg.id ? (
                                <div>
                                  <textarea className="w-full p-2 rounded border text-sm text-black" rows={2} value={editingBody} onChange={e => setEditingBody(e.target.value)} />
                                  <div className="flex gap-2 mt-1">
                                    <button onClick={handleEditSave} className="text-xs bg-green-500 text-white px-2 py-1 rounded">Save</button>
                                    <button onClick={handleEditCancel} className="text-xs bg-gray-400 text-white px-2 py-1 rounded">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm">{msg.body}{msg.edited && <span className="text-xs ml-1 opacity-70">(edited)</span>}</p>
                              )}

                              <div className="flex items-center justify-between gap-2 mt-1">
                                <p className="text-xs opacity-70">{msg.created_at}</p>
                                <div className="flex items-center gap-1">
                                  {msg.sender_id === userId && !msg.sending && !msg.is_deleted && (
                                    <>
                                      <button onClick={() => handleEditClick(msg)} className="text-xs opacity-70 hover:opacity-100"><FaEdit /></button>
                                      <button onClick={() => handleDeleteClick(msg.id)} className="text-xs opacity-70 hover:opacity-100"><FaTrash /></button>
                                      {isTeacher && <button onClick={() => openForwardModal(msg.id)} className="text-xs opacity-70 hover:opacity-100"><FaShare /></button>}
                                    </>
                                  )}
                                  {getTickIcon(msg)}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {showScrollButton && (
                    <button onClick={scrollToBottom} className="absolute bottom-20 right-6 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition">
                      <FaArrowDown />
                    </button>
                  )}

                  {attachment && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs">{attachment.name}</span>
                      <button onClick={() => { setAttachment(null); setAttachmentPreview(null); }} className="text-red-500 text-xs"><FaTimes /></button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <label className="cursor-pointer text-gray-500 hover:text-indigo-600 p-2"><FaPaperclip /><input type="file" className="hidden" onChange={handleFileSelect} /></label>
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a reply..." className="flex-1 p-2 border rounded-lg" onKeyDown={e => e.key === 'Enter' && handleSendReply()} disabled={sending} />
                    <button onClick={handleSendReply} disabled={sending} className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1">
                      {sending ? <><FaSpinner className="animate-spin" /> Sending</> : <FaPaperPlane />}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <FaInbox className="text-4xl" /><p className="ml-2">Select a conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMsgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">New Message</h2>
            <div className="space-y-3">
              {isBoth && (
                <div>
                  <label className="block text-sm">Send as</label>
                  <select value={senderRole} onChange={e => {
                    setSenderRole(e.target.value);
                    setNewMsgData(prev => ({ ...prev, recipient_type: e.target.value === 'parent' ? 'class_teacher' : 'staff_member', recipient_id: '' }));
                  }} className="w-full p-2 border rounded">
                    <option value="parent">Parent</option>
                    <option value="teacher">Staff Member</option>
                  </select>
                </div>
              )}

              {senderRole === 'parent' ? (
                <>
                  <div>
                    <label className="block text-sm">Student</label>
                    <select value={newMsgData.student_id} onChange={e => setNewMsgData({ ...newMsgData, student_id: e.target.value })} className="w-full p-2 border rounded">
                      {recipientsData?.map(child => (
                        <option key={child.student_id} value={child.student_id}>{child.student_name} ({child.class_name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm">Send to</label>
                    <select value={newMsgData.recipient_type} onChange={e => setNewMsgData({ ...newMsgData, recipient_type: e.target.value })} className="w-full p-2 border rounded">
                      <option value="class_teacher">Class Teacher</option>
                      <option value="headteacher">Headteacher</option>
                      <option value="finance_officer">Finance Officer</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm">Staff Member</label>
                  <select value={newMsgData.recipient_id} onChange={e => setNewMsgData({ ...newMsgData, recipient_id: e.target.value })} className="w-full p-2 border rounded">
                    <option value="">Select a staff member</option>
                    {recipientsData?.staff_members?.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm">Message</label>
                <textarea value={newMsgData.message} onChange={e => setNewMsgData({ ...newMsgData, message: e.target.value })} className="w-full p-2 border rounded" rows={4} />
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-indigo-600"><FaPaperclip /> Attach file<input type="file" className="hidden" onChange={handleFileSelect} /></label>
                {attachment && <span className="text-xs">{attachment.name}</span>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={handleCloseNewMessageModal} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleNewMessageSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {forwardModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Forward Message</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm">Forward to (Staff Member)</label>
                <select value={forwardRecipient} onChange={e => setForwardRecipient(e.target.value)} className="w-full p-2 border rounded">
                  <option value="">Select a staff member</option>
                  {forwardModal.recipients.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm">Add a comment (optional)</label>
                <textarea value={forwardComment} onChange={e => setForwardComment(e.target.value)} className="w-full p-2 border rounded" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setForwardModal({ open: false, messageId: null, recipients: [] })} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={handleForwardSend} className="px-4 py-2 bg-indigo-600 text-white rounded">Forward</button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-xl max-w-2xl w-full p-4 relative mx-4 max-h-[90vh] flex flex-col">
            <button onClick={closePreview} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"><FaTimes size={20} /></button>
            <div className="flex-1 overflow-auto text-center">
              {previewModal.type?.startsWith('image/') ? (
                <img src={previewModal.url} alt={previewModal.name} className="max-w-full max-h-[70vh] rounded-lg mx-auto" />
              ) : previewModal.type === 'application/pdf' ? (
                <iframe src={previewModal.url} title={previewModal.name} className="w-full h-[70vh] rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-4 py-10">
                  <FaFile className="text-6xl text-gray-400" />
                  <p className="text-lg font-medium">{previewModal.name}</p>
                  <p className="text-sm text-gray-500">File type not supported for preview</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-center">
              <button onClick={() => handleDownload(previewModal.url, previewModal.name)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"><FaDownload /> Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentMessages;