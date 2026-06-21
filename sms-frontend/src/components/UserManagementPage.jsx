import React, { useState, useEffect, useRef } from 'react';
import {
  FaUserPlus,
  FaSpinner,
  FaTrash,
  FaEdit,
  FaKey,
  FaSave,
  FaTimes,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const UserManagementPage = () => {
  const token = localStorage.getItem('auth_token');
  const formRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Unified form for add / edit
  const [form, setForm] = useState({
    id: null,
    salutation: '',
    first_name: '',
    last_name: '',
    email: '',
    roles: [],
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notification modal
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Confirmation modal (delete / reset)
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          fetch(`${API_BASE}/api/users`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
          fetch(`${API_BASE}/api/roles`, {
            headers: { Accept: 'application/json' },
          }),
        ]);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users);
        }
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setAllRoles(rolesData.roles);
        }
      } catch (err) {
        showModal('error', 'Failed to load data.');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchData();
  }, [token]);

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRoleToggle = (roleId) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(id => id !== roleId)
        : [...prev.roles, roleId],
    }));
  };

  const resetForm = () => {
    setForm({ id: null, salutation: '', first_name: '', last_name: '', email: '', roles: [] });
    setEditing(false);
  };

  const openEdit = (user) => {
    // Map role names back to IDs
    const roleIds = user.roles
      .map(roleName => allRoles.find(r => r.name === roleName)?.id)
      .filter(Boolean);

    setForm({
      id: user.id,
      salutation: user.salutation || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      roles: roleIds,
    });
    setEditing(true);

    // Scroll to the form smoothly
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.roles.length === 0) {
      showModal('error', 'Please select at least one role.');
      return;
    }
    setSaving(true);
    const url = editing
      ? `${API_BASE}/api/users/${form.id}`
      : `${API_BASE}/api/users`;
    const method = editing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          salutation: form.salutation,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          roles: form.roles,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showModal('success', editing ? 'User updated!' : 'User created! Activation email sent.');
        if (editing) {
          setUsers(prev => prev.map(u => (u.id === form.id ? data.user : u)));
        } else {
          setUsers(prev => [...prev, data.user]);
        }
        resetForm();
      } else {
        showModal('error', data.message || 'Operation failed.');
      }
    } catch (err) {
      showModal('error', 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  // Confirm actions
  const confirmAction = (title, message, action) => {
    setConfirm({ isOpen: true, title, message, action });
  };

  const executeConfirm = async () => {
    if (confirm.action) await confirm.action();
    setConfirm({ isOpen: false, title: '', message: '', action: null });
  };

  const handleDelete = (user) => {
    confirmAction(
      'Delete User',
      `Are you sure you want to delete ${user.first_name} ${user.last_name}? This cannot be undone.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (res.ok) {
            setUsers(prev => prev.filter(u => u.id !== user.id));
            showModal('success', 'User deleted.');
          } else {
            const data = await res.json();
            showModal('error', data.message || 'Failed to delete.');
          }
        } catch (err) {
          showModal('error', 'Network error.');
        }
      }
    );
  };

  const handleResetPassword = (user) => {
    confirmAction(
      'Reset Password',
      `Send a password reset link to ${user.email}?`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/api/users/${user.id}/reset-password`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
          if (res.ok) {
            showModal('success', `Reset link sent to ${user.email}.`);
          } else {
            const data = await res.json();
            showModal('error', data.message || 'Failed to send link.');
          }
        } catch (err) {
          showModal('error', 'Network error.');
        }
      }
    );
  };

  if (loadingUsers) {
    return <div className="p-6"><p className="text-gray-600">Loading users...</p></div>;
  }

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      {/* Success/Error Modal */}
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      {/* Confirmation Modal */}
      {confirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in">
            <h3 className="text-xl font-bold text-blue-900 mb-2">{confirm.title}</h3>
            <p className="text-gray-600 mb-6">{confirm.message}</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setConfirm({ isOpen: false })} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={executeConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-blue-900 mb-8">User Management</h1>

      {/* Inline Add / Edit Form (scroll target) */}
      <div ref={formRef} className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          {editing ? <><FaEdit /> Edit User</> : <><FaUserPlus /> Add New User</>}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Salutation</label>
              <select name="salutation" value={form.salutation} onChange={handleInputChange} className="w-full mt-1 p-2 border border-gray-300 rounded-lg">
                <option value="">-- Select --</option>
                <option>Mr</option>
                <option>Mrs</option>
                <option>Ms</option>
                <option>Dr</option>
                <option>Prof</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name *</label>
              <input type="text" name="first_name" value={form.first_name} onChange={handleInputChange} required className="w-full mt-1 p-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name *</label>
              <input type="text" name="last_name" value={form.last_name} onChange={handleInputChange} required className="w-full mt-1 p-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleInputChange} required className="w-full mt-1 p-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          {/* Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign Roles *</label>
            <div className="flex flex-wrap gap-2">
              {allRoles.map(role => (
                <label
                  key={role.id}
                  className={`flex items-center gap-1 px-3 py-1 border rounded-full cursor-pointer ${
                    form.roles.includes(role.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role.id)}
                    onChange={() => handleRoleToggle(role.id)}
                    className="hidden"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving || form.roles.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <FaSpinner className="animate-spin" /> : (editing ? <FaSave /> : <FaUserPlus />)}
              {saving ? 'Saving...' : (editing ? 'Update User' : 'Create User')}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <FaTimes /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <h2 className="text-xl font-semibold p-6">Existing Users</h2>
        <table className="w-full text-left">
          <thead className="bg-blue-50">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Roles</th>
              <th className="p-4">Highest Role</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t hover:bg-gray-50">
                <td className="p-4">
                  {user.salutation && `${user.salutation} `}
                  {user.first_name} {user.last_name}
                </td>
                <td className="p-4">{user.email}</td>
                <td className="p-4">
                  {Array.isArray(user.roles) ? user.roles.join(', ') : 'No roles'}
                </td>
                <td className="p-4">
                  <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                    {user.highest_role || 'None'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(user)} className="text-blue-600 hover:text-blue-800 transition" title="Edit">
                      <FaEdit />
                    </button>
                    <button onClick={() => handleResetPassword(user)} className="text-yellow-600 hover:text-yellow-800 transition" title="Reset Password">
                      <FaKey />
                    </button>
                    <button onClick={() => handleDelete(user)} className="text-red-600 hover:text-red-800 transition" title="Delete">
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPage;