import React, { useState, useEffect } from 'react';
import {
  FaPlus, FaEdit, FaTrash, FaDownload, FaUpload,
  FaSearch, FaSpinner, FaChevronDown, FaChevronUp, FaTimes,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Aunt', 'Uncle', 'Sibling', 'Other'];
const ENROLLMENT_STATUSES = ['Active', 'Graduated', 'Transferred', 'Suspended', 'Withdrawn'];

const StudentEnrollmentPage = () => {
  const token = localStorage.getItem('auth_token');
  const [classes, setClasses] = useState([]);
  const [activeClassId, setActiveClassId] = useState(null);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  const [search, setSearch] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  const [studentModal, setStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const emptyForm = {
    first_name: '', middle_name: '', last_name: '', preferred_name: '',
    gender: 'Male', date_of_birth: '', nationality: '',
    admission_date: today,
    class_id: '', stream_id: '', academic_year: '',
    enrollment_status: 'Active', auto_assign: false,
    residential_address: '', city_town: '', district_region: '',
    student_phone: '', student_email: '',
    blood_group: '', allergies: '', medical_conditions: '',
    disabilities: '', current_medication: '', emergency_medical_notes: '',
    uses_school_transport: false, pickup_location: '', transport_route: '', bus_number: '',
    guardians: [],
  };

  const [form, setForm] = useState(emptyForm);
  const [availableStreams, setAvailableStreams] = useState([]);

  const [guardianSearch, setGuardianSearch] = useState('');
  const [guardianSearchResults, setGuardianSearchResults] = useState([]);
  const [searchingGuardian, setSearchingGuardian] = useState(false);

  const [collapsedSections, setCollapsedSections] = useState({
    personal: false,
    enrollment: false,
    contact: false,
    guardians: false,
    medical: false,
    transport: false,
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const confirmAction = (title, message, action) => {
    setConfirm({ isOpen: true, title, message, action });
  };
  const executeConfirm = () => {
    confirm.action?.();
    setConfirm({ isOpen: false });
  };

  const fetchData = async () => {
    try {
      const classesRes = await fetch(`${API_BASE}/api/academic/classes`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const studentsRes = await fetch(`${API_BASE}/api/students`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });

      if (classesRes.ok) {
        const cls = await classesRes.json();
        setClasses(cls);
        if (cls.length > 0 && !activeClassId) setActiveClassId(cls[0].id);
      }
      if (studentsRes.ok) setStudents(await studentsRes.json());
    } catch (err) {
      showModal('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => { setExpandedStudentId(null); setSearch(''); }, [activeClassId]);

  const handleGuardianSearch = async (query) => {
    setGuardianSearch(query);
    if (query.length < 2) {
      setGuardianSearchResults([]);
      return;
    }
    setSearchingGuardian(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) setGuardianSearchResults(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingGuardian(false);
    }
  };

  const addGuardianFromSearch = (user) => {
    setForm(prev => ({
      ...prev,
      guardians: [...prev.guardians, {
        id: null, user_id: user.id,
        first_name: user.first_name, last_name: user.last_name,
        relationship: 'Guardian', phone: '', alt_phone: '', email: user.email,
        occupation: '', residential_address: '', is_emergency_contact: false,
        create_account: false,
      }],
    }));
    setGuardianSearch('');
    setGuardianSearchResults([]);
  };

  const addNewGuardian = () => {
    setForm(prev => ({
      ...prev,
      guardians: [...prev.guardians, {
        id: null, user_id: null,
        first_name: '', last_name: '', relationship: 'Guardian',
        phone: '', alt_phone: '', email: '', occupation: '',
        residential_address: '', is_emergency_contact: false,
        create_account: false,
      }],
    }));
  };

  const removeGuardian = (index) => {
    setForm(prev => ({
      ...prev,
      guardians: prev.guardians.filter((_, i) => i !== index),
    }));
  };

  const handleGuardianChange = (index, field, value) => {
    const updated = [...form.guardians];
    updated[index][field] = value;
    setForm(prev => ({ ...prev, guardians: updated }));
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleClassChange = (classId) => {
    const selectedClass = classes.find(c => c.id == classId);
    setAvailableStreams(selectedClass ? selectedClass.streams : []);
    setForm(prev => ({ ...prev, class_id: classId, stream_id: '' }));
  };

  const openAddStudent = () => {
    setEditingStudent(null);
    setForm({
      ...emptyForm,
      class_id: activeClassId || '',
      guardians: [],
    });
    setAvailableStreams([]);
    if (activeClassId) handleClassChange(activeClassId);
    setStudentModal(true);
  };

  const openEditStudent = (student) => {
    setEditingStudent(student);
    setForm({
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      preferred_name: student.preferred_name || '',
      gender: student.gender || 'Male',
      date_of_birth: student.date_of_birth || '',
      nationality: student.nationality || '',
      admission_date: student.admission_date || today,
      class_id: student.class_id || '',
      stream_id: student.stream_id || '',
      academic_year: student.academic_year || '',
      enrollment_status: student.enrollment_status || 'Active',
      auto_assign: false,
      residential_address: student.residential_address || '',
      city_town: student.city_town || '',
      district_region: student.district_region || '',
      student_phone: student.student_phone || '',
      student_email: student.student_email || '',
      blood_group: student.blood_group || '',
      allergies: student.allergies || '',
      medical_conditions: student.medical_conditions || '',
      disabilities: student.disabilities || '',
      current_medication: student.current_medication || '',
      emergency_medical_notes: student.emergency_medical_notes || '',
      uses_school_transport: student.uses_school_transport || false,
      pickup_location: student.pickup_location || '',
      transport_route: student.transport_route || '',
      bus_number: student.bus_number || '',
      guardians: student.guardians?.map(g => ({
        id: g.id,
        user_id: g.user_id || null,
        first_name: g.first_name,
        last_name: g.last_name,
        relationship: g.relationship || 'Guardian',
        phone: g.phone || '',
        alt_phone: g.alt_phone || '',
        email: g.email || '',
        occupation: g.occupation || '',
        residential_address: g.residential_address || '',
        is_emergency_contact: g.is_emergency_contact || false,
        create_account: false,
      })) || [],
    });
    const selectedClass = classes.find(c => c.id == student.class_id);
    setAvailableStreams(selectedClass ? selectedClass.streams : []);
    setStudentModal(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      auto_assign: form.auto_assign,
      student_number: editingStudent ? form.student_number : 'auto',
      guardians: form.guardians.map(g => ({
        ...g,
        create_account: g.create_account && !g.user_id,
      })),
    };
    if (form.auto_assign) payload.stream_id = null;

    const url = editingStudent
      ? `${API_BASE}/api/students/${editingStudent.id}`
      : `${API_BASE}/api/students`;
    const method = editingStudent ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchData();
        showModal('success', editingStudent ? 'Student updated' : 'Student enrolled');
        setStudentModal(false);
      } else {
        const err = await res.json();
        showModal('error', err.message || 'Operation failed');
      }
    } catch {
      showModal('error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = (id) => {
    confirmAction('Delete Student', 'Are you sure?', async () => {
      await fetch(`${API_BASE}/api/students/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchData();
      showModal('success', 'Student removed');
    });
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/students/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      await fetchData();
      showModal('success', data.message);
    } else {
      showModal('error', 'Import failed');
    }
  };

  const downloadTemplate = () => {
    fetch(`${API_BASE}/api/students/template`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'student_import_template.csv'; a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  const currentStudents = activeClassId && students[activeClassId] ? students[activeClassId] : [];
  const filteredStudents = currentStudents.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    s.student_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
        <span className="ml-3 text-gray-600 text-lg">Loading enrollment data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-blue-50 min-h-screen">
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

      <h1 className="text-3xl font-bold text-blue-900 mb-8">Student Enrollment</h1>

      {/* Class Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {classes.map(cls => (
          <button
            key={cls.id}
            onClick={() => setActiveClassId(cls.id)}
            className={`px-4 py-2 rounded-full font-medium transition ${
              activeClassId === cls.id ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
            }`}
          >
            {cls.name} ({students[cls.id]?.length || 0})
          </button>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        <button onClick={openAddStudent} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <FaPlus /> Enroll Student
        </button>
        <button onClick={downloadTemplate} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <FaDownload /> Template
        </button>
        <label className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer">
          <FaUpload /> Import
          <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
        </label>
        <div className="relative flex-1 max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Student list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {filteredStudents.length === 0 ? (
          <p className="p-6 text-gray-500">No students in this class.</p>
        ) : (
          filteredStudents.map(student => (
            <div key={student.id} className="border-b last:border-b-0">
              <div
                className="flex justify-between items-center p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedStudentId === student.id ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                  <div>
                    <span className="font-semibold">{student.first_name} {student.last_name}</span>
                    <span className="ml-2 text-sm text-gray-600">{student.student_number}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{student.class?.name}{student.stream ? ` - ${student.stream.name}` : ''}</span>
                  <button onClick={(e) => { e.stopPropagation(); openEditStudent(student); }} className="text-blue-600"><FaEdit /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id); }} className="text-red-600"><FaTrash /></button>
                </div>
              </div>
              {expandedStudentId === student.id && (
                <div className="px-4 pb-4 bg-gray-50 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-2">
                    {/* Personal */}
                    <div>
                      <h4 className="font-semibold text-blue-900 border-b mb-1">Personal</h4>
                      <Detail label="First Name" value={student.first_name} />
                      <Detail label="Middle Name" value={student.middle_name} />
                      <Detail label="Last Name" value={student.last_name} />
                      <Detail label="Preferred Name" value={student.preferred_name} />
                      <Detail label="Gender" value={student.gender} />
                      <Detail label="Date of Birth" value={student.date_of_birth} />
                      <Detail label="Nationality" value={student.nationality} />
                    </div>
                    {/* Enrollment */}
                    <div>
                      <h4 className="font-semibold text-blue-900 border-b mb-1">Enrollment</h4>
                      <Detail label="Student Number" value={student.student_number} />
                      <Detail label="Admission Date" value={student.admission_date} />
                      <Detail label="Class" value={student.class?.name} />
                      <Detail label="Stream" value={student.stream?.name || '—'} />
                      <Detail label="Academic Year" value={student.academic_year} />
                      <Detail label="Status" value={student.enrollment_status} />
                    </div>
                    {/* Contact */}
                    <div>
                      <h4 className="font-semibold text-blue-900 border-b mb-1">Contact</h4>
                      <Detail label="Address" value={student.residential_address} />
                      <Detail label="City/Town" value={student.city_town} />
                      <Detail label="District/Region" value={student.district_region} />
                      <Detail label="Student Phone" value={student.student_phone} />
                      <Detail label="Student Email" value={student.student_email} />
                    </div>
                    {/* Guardians */}
                    <div>
                      <h4 className="font-semibold text-blue-900 border-b mb-1">Guardians</h4>
                      {student.guardians?.length ? (
                        student.guardians.map((g, idx) => (
                          <div key={g.id} className="text-sm mb-1">
                            <span className="font-medium">{g.first_name} {g.last_name}</span>
                            {g.relationship && <span> ({g.relationship})</span>}
                            {g.is_emergency_contact && <span className="text-red-600 ml-1">🚨 Emergency</span>}
                            <div className="text-gray-600">{g.phone}{g.email ? ` · ${g.email}` : ''}</div>
                          </div>
                        ))
                      ) : 'No guardians'}
                    </div>
                    {/* Medical */}
                    <div>
                      <h4 className="font-semibold text-blue-900 border-b mb-1">Medical</h4>
                      <Detail label="Blood Group" value={student.blood_group} />
                      <Detail label="Allergies" value={student.allergies} />
                      <Detail label="Medical Conditions" value={student.medical_conditions} />
                      <Detail label="Disabilities" value={student.disabilities} />
                      <Detail label="Current Medication" value={student.current_medication} />
                      <Detail label="Emergency Notes" value={student.emergency_medical_notes} />
                    </div>
                    {/* Transport */}
                    <div>
                      <h4 className="font-semibold text-blue-900 border-b mb-1">Transport</h4>
                      <Detail label="Uses School Transport" value={student.uses_school_transport ? 'Yes' : 'No'} />
                      {student.uses_school_transport && (
                        <>
                          <Detail label="Pickup Location" value={student.pickup_location} />
                          <Detail label="Route" value={student.transport_route} />
                          <Detail label="Bus Number" value={student.bus_number} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Student Modal */}
      {studentModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-40 pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 animate-fade-in overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">{editingStudent ? 'Edit Student' : 'Enroll New Student'}</h2>
            <form onSubmit={handleSaveStudent}>
              {/* Personal Information */}
              <Section title="Personal Information" collapsed={collapsedSections.personal} onToggle={() => toggleSection('personal')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="First Name *" name="first_name" value={form.first_name} onChange={handleFormChange} required />
                  <Input label="Middle Name" name="middle_name" value={form.middle_name} onChange={handleFormChange} />
                  <Input label="Last Name *" name="last_name" value={form.last_name} onChange={handleFormChange} required />
                  <Input label="Preferred Name" name="preferred_name" value={form.preferred_name} onChange={handleFormChange} />
                  <Select label="Gender *" name="gender" value={form.gender} onChange={handleFormChange} options={['Male', 'Female']} />
                  <Input label="Date of Birth" type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleFormChange} />
                  <Input label="Nationality" name="nationality" value={form.nationality} onChange={handleFormChange} />
                </div>
              </Section>

              {/* Enrollment Details */}
              <Section title="Enrollment Details" collapsed={collapsedSections.enrollment} onToggle={() => toggleSection('enrollment')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Admission Date" type="date" name="admission_date" value={form.admission_date} onChange={handleFormChange} />
                  <Select label="Class *" name="class_id" value={form.class_id} onChange={e => { handleFormChange(e); handleClassChange(e.target.value); }} required
                    options={classes.map(c => ({ value: c.id, label: c.name }))} />
                  {availableStreams.length > 0 && !form.auto_assign && (
                    <Select label="Stream" name="stream_id" value={form.stream_id} onChange={handleFormChange}
                     options={availableStreams.map(s => ({ value: s.stream_id, label: s.stream_name || s.name }))} emptyOption />
                  )}
                  <Input label="Academic Year" name="academic_year" value={form.academic_year} onChange={handleFormChange} />
                  <Select label="Enrollment Status" name="enrollment_status" value={form.enrollment_status} onChange={handleFormChange}
                    options={ENROLLMENT_STATUSES} />
                  <div className="flex items-center mt-5">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="auto_assign" checked={form.auto_assign} onChange={handleFormChange} />
                      Auto-assign stream
                    </label>
                  </div>
                </div>
              </Section>

              {/* Contact Information */}
              <Section title="Contact Information" collapsed={collapsedSections.contact} onToggle={() => toggleSection('contact')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Residential Address" name="residential_address" value={form.residential_address} onChange={handleFormChange} />
                  <Input label="City/Town" name="city_town" value={form.city_town} onChange={handleFormChange} />
                  <Input label="District/Region" name="district_region" value={form.district_region} onChange={handleFormChange} />
                  <Input label="Student Phone" name="student_phone" value={form.student_phone} onChange={handleFormChange} />
                  <Input label="Student Email" type="email" name="student_email" value={form.student_email} onChange={handleFormChange} />
                </div>
              </Section>

              {/* Guardians Section */}
              <Section title="Parent/Guardian Information" collapsed={collapsedSections.guardians} onToggle={() => toggleSection('guardians')}>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Guardians</span>
                    <button type="button" onClick={addNewGuardian} className="text-blue-600 text-sm flex items-center gap-1"><FaPlus /> Add Guardian</button>
                  </div>
                  <div className="relative mb-2">
                    <input type="text" placeholder="Search existing user..." value={guardianSearch} onChange={e => handleGuardianSearch(e.target.value)} className="w-full p-2 border rounded" />
                    {searchingGuardian && <FaSpinner className="absolute right-3 top-3 animate-spin text-gray-400" />}
                    {guardianSearchResults.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded shadow-lg mt-1 w-full max-h-40 overflow-y-auto">
                        {guardianSearchResults.map(user => (
                          <div key={user.id} className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center" onClick={() => addGuardianFromSearch(user)}>
                            <span>{user.first_name} {user.last_name} ({user.email})</span>
                            <FaPlus className="text-blue-600" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.guardians.map((guardian, idx) => (
                    <div key={idx} className="border p-3 rounded mb-2 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm">{guardian.user_id ? 'Existing User' : 'New Guardian'}</span>
                        <button type="button" onClick={() => removeGuardian(idx)} className="text-red-600 text-sm"><FaTimes /></button>
                      </div>
                      {!guardian.user_id ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Input label="First Name *" value={guardian.first_name} onChange={e => handleGuardianChange(idx, 'first_name', e.target.value)} required />
                          <Input label="Last Name *" value={guardian.last_name} onChange={e => handleGuardianChange(idx, 'last_name', e.target.value)} required />
                          <Input label="Email" type="email" value={guardian.email} onChange={e => handleGuardianChange(idx, 'email', e.target.value)} />
                          <Input label="Phone" value={guardian.phone} onChange={e => handleGuardianChange(idx, 'phone', e.target.value)} />
                          <Input label="Alt. Phone" value={guardian.alt_phone} onChange={e => handleGuardianChange(idx, 'alt_phone', e.target.value)} />
                          <Select label="Relationship *" value={guardian.relationship} onChange={e => handleGuardianChange(idx, 'relationship', e.target.value)} options={RELATIONSHIPS} />
                          <Input label="Occupation" value={guardian.occupation} onChange={e => handleGuardianChange(idx, 'occupation', e.target.value)} />
                          <Input label="Address" value={guardian.residential_address} onChange={e => handleGuardianChange(idx, 'residential_address', e.target.value)} />
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={guardian.is_emergency_contact} onChange={e => handleGuardianChange(idx, 'is_emergency_contact', e.target.checked)} />
                              Emergency Contact
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={guardian.create_account || false} onChange={e => handleGuardianChange(idx, 'create_account', e.target.checked)} />
                              Create Parent Account
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700">
                          {guardian.first_name} {guardian.last_name} ({guardian.email})
                          <div className="mt-2 flex items-center gap-4">
                            <Select label="Relationship *" value={guardian.relationship} onChange={e => handleGuardianChange(idx, 'relationship', e.target.value)} options={RELATIONSHIPS} />
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={guardian.is_emergency_contact} onChange={e => handleGuardianChange(idx, 'is_emergency_contact', e.target.checked)} />
                              Emergency Contact
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>

              {/* Medical Information */}
              <Section title="Medical Information" collapsed={collapsedSections.medical} onToggle={() => toggleSection('medical')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Blood Group" name="blood_group" value={form.blood_group} onChange={handleFormChange} />
                  <Input label="Allergies" name="allergies" value={form.allergies} onChange={handleFormChange} />
                  <Input label="Medical Conditions" name="medical_conditions" value={form.medical_conditions} onChange={handleFormChange} />
                  <Input label="Disabilities" name="disabilities" value={form.disabilities} onChange={handleFormChange} />
                  <Input label="Current Medication" name="current_medication" value={form.current_medication} onChange={handleFormChange} />
                  <Input label="Emergency Medical Notes" name="emergency_medical_notes" value={form.emergency_medical_notes} onChange={handleFormChange} />
                </div>
              </Section>

              {/* Transport Information */}
              <Section title="Transport Information" collapsed={collapsedSections.transport} onToggle={() => toggleSection('transport')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="uses_school_transport" checked={form.uses_school_transport} onChange={handleFormChange} />
                    Uses School Transport
                  </label>
                  {form.uses_school_transport && (
                    <>
                      <Input label="Pickup Location" name="pickup_location" value={form.pickup_location} onChange={handleFormChange} />
                      <Input label="Route" name="transport_route" value={form.transport_route} onChange={handleFormChange} />
                      <Input label="Bus Number" name="bus_number" value={form.bus_number} onChange={handleFormChange} />
                    </>
                  )}
                </div>
              </Section>

              <div className="flex gap-4 mt-6">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {saving ? <FaSpinner className="animate-spin" /> : null}
                  {saving ? 'Saving...' : (editingStudent ? 'Update Student' : 'Enroll Student')}
                </button>
                <button type="button" onClick={() => setStudentModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Helper Components */}
      <div className="hidden">
        {/* This ensures the Section, Input, Select components are defined */}
      </div>
    </div>
  );
};

// Reusable form components
const Input = ({ label, name, value, onChange, type = 'text', required = false, ...rest }) => (
  <div>
    <label className="block text-sm font-medium">{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} required={required} className="w-full p-2 border rounded" {...rest} />
  </div>
);

const Select = ({ label, name, value, onChange, options, required = false, emptyOption = false }) => (
  <div>
    <label className="block text-sm font-medium">{label}</label>
    <select name={name} value={value} onChange={onChange} required={required} className="w-full p-2 border rounded">
      {emptyOption && <option value="">— Select —</option>}
      {options.map(opt => (
        <option key={typeof opt === 'object' ? opt.value : opt} value={typeof opt === 'object' ? opt.value : opt}>
          {typeof opt === 'object' ? opt.label : opt}
        </option>
      ))}
    </select>
  </div>
);

const Section = ({ title, children, collapsed, onToggle }) => (
  <div className="border rounded mb-4">
    <div className="flex justify-between items-center p-3 bg-gray-100 cursor-pointer" onClick={onToggle}>
      <h3 className="font-semibold">{title}</h3>
      {collapsed ? <FaChevronDown /> : <FaChevronUp />}
    </div>
    {!collapsed && <div className="p-4">{children}</div>}
  </div>
);

// Detail component for expanded view
const Detail = ({ label, value }) => (
  <div className="text-sm">
    <span className="font-medium">{label}:</span>{' '}
    <span className="text-gray-700">{value || '—'}</span>
  </div>
);

export default StudentEnrollmentPage;