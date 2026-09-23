import React, { useState, useEffect } from 'react';
import { FaSave, FaSpinner, FaUpload, FaTrash } from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const SchoolInfoPage = () => {
  const token = localStorage.getItem('auth_token');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_name: '',
    email_primary: '',
    email_secondary: '',
    phone_primary: '',
    phone_secondary: '',
    postal_address: '',
    website: '',
    headteacher_name: '',
    motto: '',
    logo: null,            // File object
    remove_logo: false,
  });
  const [logoPreview, setLogoPreview] = useState(null); // full URL or null
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // Fetch existing information
  const fetchInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/school-info`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Object.keys(data).length) {
          setForm(prev => ({
            ...prev,
            school_name: data.school_name || '',
            email_primary: data.email_primary || '',
            email_secondary: data.email_secondary || '',
            phone_primary: data.phone_primary || '',
            phone_secondary: data.phone_secondary || '',
            postal_address: data.postal_address || '',
            website: data.website || '',
            headteacher_name: data.headteacher_name || '',
            motto: data.motto || '',
            logo: null,
            remove_logo: false,
          }));
          // Build full URL from the relative path
          setLogoPreview(data.logo ? `${API_BASE}/storage/${data.logo}` : null);
        }
      }
    } catch (err) {
      showModal('error', 'Failed to load school information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfo(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({ ...prev, logo: file, remove_logo: false }));
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({ ...prev, logo: null, remove_logo: true }));
    setLogoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();
    Object.keys(form).forEach(key => {
      if (form[key] !== null && form[key] !== undefined) {
        formData.append(key, form[key]);
      }
    });

    try {
      const res = await fetch(`${API_BASE}/api/school-info`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        showModal('success', 'School information updated');
        // Re-fetch to refresh preview from server
        await fetchInfo();
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Failed to update');
      }
    } catch (err) {
      showModal('error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
        <span className="ml-3 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-blue-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6">Settings</h1>

      <div className="bg-white rounded-xl shadow p-6 max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium mb-2">School Logo</label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="School Logo" className="w-20 h-20 object-contain border rounded" onError={(e) => e.target.style.display = 'none'} />
              ) : (
                <div className="w-20 h-20 bg-gray-100 border rounded flex items-center justify-center text-gray-400">
                  No Logo
                </div>
              )}
              <div className="flex gap-2">
                <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 flex items-center gap-2">
                  <FaUpload />
                  {form.logo ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                {logoPreview && (
                  <button type="button" onClick={handleRemoveLogo} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2">
                    <FaTrash /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ... rest of form fields (same as before) ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">School Name *</label>
              <input type="text" name="school_name" value={form.school_name} onChange={handleChange} required className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Primary Email</label>
              <input type="email" name="email_primary" value={form.email_primary} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Secondary Email</label>
              <input type="email" name="email_secondary" value={form.email_secondary} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Primary Phone</label>
              <input type="text" name="phone_primary" value={form.phone_primary} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Secondary Phone</label>
              <input type="text" name="phone_secondary" value={form.phone_secondary} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">Postal Address</label>
              <textarea name="postal_address" value={form.postal_address} onChange={handleChange} rows={2} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Website</label>
              <input type="url" name="website" value={form.website} onChange={handleChange} placeholder="https://..." className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Headteacher Name</label>
              <input type="text" name="headteacher_name" value={form.headteacher_name} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">Motto</label>
              <input type="text" name="motto" value={form.motto} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchoolInfoPage;