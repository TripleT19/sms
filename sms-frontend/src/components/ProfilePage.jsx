import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaCamera,
  FaSave,
  FaLock,
  FaSpinner,
} from 'react-icons/fa';
import Modal from './Modal';  // adjust path if needed

const API_BASE = 'https://laravel.moyorise.com';

const ProfilePage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('auth_token');

  // Data
  const [user, setUser] = useState(null);
  const [allQualifications, setAllQualifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    salutation: '',
    username: '',
    email: '',
    phone: '',
    qualifications: [],
  });
  const [profilePic, setProfilePic] = useState(null);
  const [previewPic, setPreviewPic] = useState(null);
  const [saving, setSaving] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  // Modal state
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });

  const showModal = (type, message) => {
    setModal({ isOpen: true, type, message });
  };
  const closeModal = () => setModal({ ...modal, isOpen: false });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          navigate('/login');
          return;
        }
        const data = await res.json();
        setUser(data.user);
        setAllQualifications(data.all_qualifications || []);
        setForm({
          first_name: data.user.first_name || '',
          last_name: data.user.last_name || '',
          salutation: data.user.salutation || '',
          username: data.user.username || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          qualifications: data.user.qualifications?.map(q => q.id) || [],
        });
        // Build full image URL
        if (data.user.profile_pic) {
          setPreviewPic(`${API_BASE}/storage/${data.user.profile_pic}`);
        }
      } catch (err) {
        console.error(err);
        showModal('error', 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, navigate]);

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleQualificationToggle = (qualId) => {
    setForm(prev => ({
      ...prev,
      qualifications: prev.qualifications.includes(qualId)
        ? prev.qualifications.filter(id => id !== qualId)
        : [...prev.qualifications, qualId],
    }));
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setPreviewPic(URL.createObjectURL(file));
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();
    formData.append('first_name', form.first_name);
    formData.append('last_name', form.last_name);
    formData.append('salutation', form.salutation);
    formData.append('username', form.username);
    formData.append('email', form.email);
    formData.append('phone', form.phone);
    if (profilePic) {
      formData.append('profile_pic', profilePic);
    }
    // Append qualifications array correctly
    form.qualifications.forEach(id => formData.append('qualifications[]', id));

    try {
      const res = await fetch(`${API_BASE}/api/profile/update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showModal('success', 'Profile updated successfully.');
        setUser(data.user);
        // Update preview with fresh image path
        if (data.user.profile_pic) {
          setPreviewPic(`${API_BASE}/storage/${data.user.profile_pic}`);
        }
      } else {
        showModal('error', data.message || 'Update failed.');
      }
    } catch (err) {
      showModal('error', 'Network error, please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showModal('error', 'New passwords do not match.');
      return;
    }
    setChangingPwd(true);
    try {
      const res = await fetch(`${API_BASE}/api/profile/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showModal('success', 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showModal('error', data.message || 'Failed to change password.');
      }
    } catch (err) {
      showModal('error', 'Network error.');
    } finally {
      setChangingPwd(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  const isParent = user?.roles?.some(r => r.name === 'Parent');

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-900 mb-8">My Profile</h1>

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onClose={closeModal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture & Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="relative inline-block">
              <img
                src={previewPic || 'https://via.placeholder.com/150?text=User'}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-blue-600"
              />
              <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition">
                <FaCamera />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePicChange}
                  className="hidden"
                />
              </label>
            </div>
            <h2 className="text-xl font-semibold mt-4">{user?.full_name}</h2>
            <p className="text-gray-600">@{user?.username}</p>
            <div className="mt-2">
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                {user?.highest_role || 'No role'}
              </span>
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <form onSubmit={handleProfileUpdate} className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FaUser /> Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Salutation</label>
                <select
                  name="salutation"
                  value={form.salutation}
                  onChange={handleInputChange}
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Select --</option>
                  <option>Mr</option>
                  <option>Mrs</option>
                  <option>Ms</option>
                  <option>Dr</option>
                  <option>Prof</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleInputChange}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleInputChange}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleInputChange}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleInputChange}
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Qualifications (if not parent) */}
            {!isParent && (
              <div className="mt-6">
                <h4 className="text-lg font-medium mb-2">Qualifications</h4>
                <div className="flex flex-wrap gap-2">
                  {allQualifications.map(q => (
                    <label
                      key={q.id}
                      className={`flex items-center gap-2 px-3 py-1 border rounded-full cursor-pointer ${
                        form.qualifications.includes(q.id)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-blue-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.qualifications.includes(q.id)}
                        onChange={() => handleQualificationToggle(q.id)}
                        className="hidden"
                      />
                      {q.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          {/* Change Password */}
          <form onSubmit={handlePasswordChange} className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FaLock /> Change Password
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full mt-1 p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={changingPwd}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              {changingPwd ? <FaSpinner className="animate-spin" /> : <FaLock />}
              {changingPwd ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;