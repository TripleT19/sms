import React, { useState, useEffect } from 'react';
import {
  FaPlus, FaEdit, FaTrash, FaDownload, FaSearch, FaSpinner,
  FaMoneyBillWave, FaFileInvoice, FaReceipt, FaCheckCircle, FaTimesCircle,
  FaExchangeAlt, FaUniversity, FaExclamationTriangle,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';
const FEE_CATEGORIES = ['School Fees', 'Bus Fare', 'Trip', 'School Fund', 'Other'];

const FinancePage = () => {
  const token = localStorage.getItem('auth_token');
  const [activeTab, setActiveTab] = useState('feesAndPayments');

  // =========== SHARED DATA ===========
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStream, setSelectedStream] = useState('');
  const [availableStreams, setAvailableStreams] = useState([]);

  // =========== STUDENTS & FEES ===========
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFees, setStudentFees] = useState([]);
  const [loadingFees, setLoadingFees] = useState(false);

  // =========== FEE TYPES ===========
  const [feeTypes, setFeeTypes] = useState([]);

  // =========== TERM ENFORCEMENT WARNING ===========
  const [previousTermUnpaid, setPreviousTermUnpaid] = useState(false);

  // =========== MODALS & FORMS ===========
  const [assignMultiModal, setAssignMultiModal] = useState(false);
  const [selectedStudentForAssign, setSelectedStudentForAssign] = useState(null);
  const [assignFeesList, setAssignFeesList] = useState([{ fee_type_id: '', amount: '', location: '' }]);
  const [assigning, setAssigning] = useState(false);

  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: new Date().toISOString().split('T')[0], method: 'Cash', notes: '' });
  const [savingPayment, setSavingPayment] = useState(false);

  const [editPaidModal, setEditPaidModal] = useState(false);
  const [editingFeeForPaid, setEditingFeeForPaid] = useState(null);
  const [newPaidAmount, setNewPaidAmount] = useState('');
  const [savingPaidAmount, setSavingPaidAmount] = useState(false);

  const [transferModal, setTransferModal] = useState(false);
  const [transferSource, setTransferSource] = useState(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [feeTypeModal, setFeeTypeModal] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState(null);
  const [feeTypeForm, setFeeTypeForm] = useState({
    name: '', category: 'Other', description: '', is_mandatory: false,
    class_id: '', stream_id: '', has_variations: false,
    amounts: [{ class_id: '', stream_id: '', location: '', amount: '' }],
  });
  const [savingFeeType, setSavingFeeType] = useState(false);
  const [feeTypeStreams, setFeeTypeStreams] = useState({});

  const [bankDetails, setBankDetails] = useState([]);
  const [bankModal, setBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [bankForm, setBankForm] = useState({
    bank_name: '', account_name: '', account_number: '', branch: '', swift_code: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const confirmAction = (title, message, action) => setConfirm({ isOpen: true, title, message, action });
  const executeConfirm = () => { confirm.action?.(); setConfirm({ isOpen: false }); };

  // ==================== SAFE JSON FETCH ====================
  const safeFetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text();
      let message;
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || `Error ${res.status}`;
      } catch {
        message = text || `Request failed with status ${res.status}`;
      }
      throw new Error(message);
    }
    const text = await res.text();
    if (!text) {
      // empty response – return an empty array/object depending on context
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON:', text.substring(0, 200));
      throw new Error('Invalid JSON response from server');
    }
  };

  // ==================== FETCH INITIAL DATA ====================
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [classesData, termsData] = await Promise.all([
          safeFetchJson(`${API_BASE}/api/academic/classes`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
          safeFetchJson(`${API_BASE}/api/academic/terms/all`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          }),
        ]);
        setClasses(classesData || []);
        setTerms(termsData || []);
      } catch (err) {
        showModal('error', 'Failed to load initial data: ' + err.message);
      }
    };
    fetchInitial();
  }, []);

  const fetchFeeTypes = async () => {
    try {
      const data = await safeFetchJson(`${API_BASE}/api/fees/fee-types`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      setFeeTypes(data || []);
    } catch (err) {
      showModal('error', 'Failed to load fee types: ' + err.message);
    }
  };

  const fetchBankDetails = async () => {
    try {
      const data = await safeFetchJson(`${API_BASE}/api/fees/bank-details`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      setBankDetails(data || []);
    } catch (err) {
      showModal('error', 'Failed to load bank details: ' + err.message);
    }
  };

  useEffect(() => {
    fetchFeeTypes();
    fetchBankDetails();
  }, []);

  // Refresh data on tab switch
  useEffect(() => {
    fetchFeeTypes();
    fetchBankDetails();
    if (activeTab === 'feesAndPayments' && selectedClass && selectedTerm) {
      fetchStudentsAndFees();
    }
  }, [activeTab]);

  // Update available streams when class changes
  useEffect(() => {
    if (selectedClass) {
      const cls = classes.find(c => c.id == selectedClass);
      setAvailableStreams(cls?.streams || []);
      setSelectedStream('');
    } else {
      setAvailableStreams([]);
      setSelectedStream('');
    }
  }, [selectedClass, classes]);

  // Ensure mandatory fees and fetch students/fees when selection changes
  useEffect(() => {
    if (selectedClass && selectedTerm) {
      safeFetchJson(`${API_BASE}/api/fees/ensure-mandatory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ class_id: selectedClass, stream_id: selectedStream || null, term_id: selectedTerm }),
      })
        .then(() => fetchStudentsAndFees())
        .catch((err) => showModal('error', 'Failed to ensure mandatory fees: ' + err.message));
    } else {
      setStudents([]);
      setStudentFees([]);
    }
  }, [selectedClass, selectedStream, selectedTerm]);

  const fetchStudentsAndFees = async () => {
    try {
      const studentsData = await safeFetchJson(`${API_BASE}/api/fees/students-by-class?${new URLSearchParams({ class_id: selectedClass, stream_id: selectedStream || '' })}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      setStudents(studentsData || []);

      setLoadingFees(true);
      const feesData = await safeFetchJson(`${API_BASE}/api/fees/student-fees?${new URLSearchParams({ class_id: selectedClass, stream_id: selectedStream || '', term_id: selectedTerm })}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      setStudentFees(feesData || []);
      setLoadingFees(false);

      checkPreviousTermUnpaid();
    } catch (err) {
      showModal('error', 'Failed to load student data: ' + err.message);
      setLoadingFees(false);
    }
  };

  const checkPreviousTermUnpaid = async () => {
    if (!selectedTerm || !selectedClass) return;
    const currentTermIndex = terms.findIndex(t => t.id == selectedTerm);
    if (currentTermIndex <= 0) { setPreviousTermUnpaid(false); return; }
    const prevTerm = terms[currentTermIndex - 1];
    try {
      const data = await safeFetchJson(`${API_BASE}/api/fees/student-fees?class_id=${selectedClass}&stream_id=${selectedStream || ''}&term_id=${prevTerm.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const hasUnpaid = (data || []).some(fee => fee.status !== 'paid');
      setPreviousTermUnpaid(hasUnpaid);
    } catch { /* ignore */ }
  };

  const getStudentFees = (studentId) => studentFees.filter(sf => sf.student_id === studentId);

  // ==================== MULTI‑ASSIGN LOGIC ====================
  const optionalFeeTypes = feeTypes.filter(ft => !ft.is_mandatory);

  const openAssignMulti = (student) => {
    setSelectedStudentForAssign(student);
    setAssignFeesList([{ fee_type_id: '', amount: '', location: '' }]);
    setAssignMultiModal(true);
  };

  const handleAssignFeeChange = (index, field, value) => {
    const updated = [...assignFeesList];
    updated[index][field] = value;

    if (field === 'fee_type_id' || field === 'location') {
      const selectedType = feeTypes.find(ft => ft.id == updated[index].fee_type_id);
      if (selectedType) {
        let amount = null;
        if (updated[index].location) {
          const locAmt = selectedType.amounts.find(a => (a.location || '') === updated[index].location);
          if (locAmt) amount = locAmt.amount;
        }
        if (!amount) {
          amount = getAmountForStudent(selectedType, selectedClass, selectedStream);
        }
        updated[index].amount = amount || '';
      }
    }
    setAssignFeesList(updated);
  };

  const getAmountForStudent = (feeType, classId, streamId) => {
    const match = feeType.amounts.find(amt => amt.class_id == classId && (streamId ? amt.stream_id == streamId : true));
    if (match) return match.amount;
    const classMatch = feeType.amounts.find(amt => amt.class_id == classId && !amt.stream_id);
    if (classMatch) return classMatch.amount;
    return feeType.amounts[0]?.amount || 0;
  };

  const addFeeRow = () => setAssignFeesList([...assignFeesList, { fee_type_id: '', amount: '', location: '' }]);
  const removeFeeRow = (index) => setAssignFeesList(assignFeesList.filter((_, i) => i !== index));

  const handleAssignMultiSubmit = async () => {
    setAssigning(true);
    const payload = {
      student_id: selectedStudentForAssign.id,
      term_id: selectedTerm,
      fees: assignFeesList.map(f => ({ fee_type_id: f.fee_type_id, amount: f.amount, location: f.location || null })),
    };
    try {
      await safeFetchJson(`${API_BASE}/api/fees/assign-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      showModal('success', 'Fees assigned');
      fetchStudentsAndFees();
      setAssignMultiModal(false);
    } catch (err) {
      showModal('error', err.message || 'Failed');
    } finally {
      setAssigning(false);
    }
  };

  // ==================== EDIT PAID AMOUNT ====================
  const openEditPaidModal = (fee) => { setEditingFeeForPaid(fee); setNewPaidAmount(fee.paid_amount); setEditPaidModal(true); };

  const handleEditPaidAmount = async () => {
    if (newPaidAmount === '' || isNaN(newPaidAmount) || Number(newPaidAmount) < 0) {
      showModal('error', 'Please enter a valid paid amount'); return;
    }
    setSavingPaidAmount(true);
    try {
      await safeFetchJson(`${API_BASE}/api/fees/student-fee/${editingFeeForPaid.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_paid_amount: newPaidAmount }),
      });
      showModal('success', 'Paid amount updated');
      fetchStudentsAndFees();
      setEditPaidModal(false);
    } catch (err) {
      showModal('error', err.message || 'Failed');
    } finally {
      setSavingPaidAmount(false);
    }
  };

  // ==================== DELETE FEE ====================
  const handleDeleteFee = (fee) => {
    confirmAction('Delete Fee Assignment', `Are you sure you want to remove "${fee.fee_type?.name}"?`, async () => {
      try {
        await safeFetchJson(`${API_BASE}/api/fees/student-fee/${fee.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        showModal('success', 'Fee assignment removed');
        fetchStudentsAndFees();
      } catch (err) {
        showModal('error', err.message || 'Cannot delete');
      }
    });
  };

  // ==================== PAYMENT & TRANSFER ====================
  const openPaymentModal = (fee) => {
    setSelectedFee(fee);
    const balance = Number(fee.total_amount) - Number(fee.paid_amount);
    setPaymentForm({ amount: balance, payment_date: new Date().toISOString().split('T')[0], method: 'Cash', notes: '' });
    setPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    setSavingPayment(true);
    try {
      await safeFetchJson(`${API_BASE}/api/fees/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_fee_id: selectedFee.id, amount: paymentForm.amount,
          payment_date: paymentForm.payment_date, method: paymentForm.method, notes: paymentForm.notes,
        }),
      });
      showModal('success', 'Payment recorded');
      setPaymentModal(false);
      fetchStudentsAndFees();
    } catch (err) {
      if (err.message.includes('overpayment')) {
        showModal('error', `Overpayment of MK ${err.message.split(' ')[0]}. Please use the transfer function.`);
      } else {
        showModal('error', err.message || 'Failed');
      }
    } finally {
      setSavingPayment(false);
    }
  };

  const openTransferModal = (sourceFee) => { setTransferSource(sourceFee); setTransferTarget(''); setTransferAmount(''); setTransferModal(true); };

  const handleTransfer = async () => {
    if (!transferTarget || !transferAmount) return;
    setTransferring(true);
    try {
      await safeFetchJson(`${API_BASE}/api/fees/transfer-overpayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from_student_fee_id: transferSource.id, to_student_fee_id: transferTarget, amount: transferAmount }),
      });
      showModal('success', 'Overpayment transferred');
      setTransferModal(false);
      fetchStudentsAndFees();
    } catch (err) {
      showModal('error', err.message || 'Failed');
    } finally {
      setTransferring(false);
    }
  };

  // ==================== DOWNLOADS ====================
  const downloadInvoice = async (feeId) => {
    try {
      const res = await fetch(`${API_BASE}/api/fees/invoice/${feeId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showModal('error', 'Failed to download invoice'); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Invoice.pdf`; a.click(); window.URL.revokeObjectURL(url);
    } catch { showModal('error', 'Network error'); }
  };

  const downloadFeeReceipt = async (feeId) => {
    try {
      const res = await fetch(`${API_BASE}/api/fees/receipt/${feeId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showModal('error', 'Failed to download receipt'); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Receipt.pdf`; a.click(); window.URL.revokeObjectURL(url);
    } catch { showModal('error', 'Network error'); }
  };

  // ==================== FEE TYPE MANAGEMENT ====================
  const openFeeTypeModal = (ft = null) => {
    if (ft) {
      setEditingFeeType(ft);
      setFeeTypeForm({
        name: ft.name, category: ft.category || 'Other', description: ft.description || '',
        is_mandatory: ft.is_mandatory, class_id: ft.class_id || '', stream_id: ft.stream_id || '',
        has_variations: ft.has_variations || false,
        amounts: ft.amounts.length > 0
          ? ft.amounts.map(a => ({ class_id: a.class_id || '', stream_id: a.stream_id || '', location: a.location || '', amount: a.amount }))
          : [{ class_id: '', stream_id: '', location: '', amount: '' }],
      });
    } else {
      setEditingFeeType(null);
      setFeeTypeForm({
        name: '', category: 'Other', description: '', is_mandatory: false,
        class_id: '', stream_id: '', has_variations: false,
        amounts: [{ class_id: '', stream_id: '', location: '', amount: '' }],
      });
    }
    setFeeTypeModal(true);
  };

  const handleAmountRowChange = (index, field, value) => {
    const updated = [...feeTypeForm.amounts];
    updated[index][field] = value;
    if (field === 'class_id') {
      const cls = classes.find(c => c.id == value);
      setFeeTypeStreams(prev => ({ ...prev, [index]: cls?.streams || [] }));
      updated[index].stream_id = '';
    }
    setFeeTypeForm({ ...feeTypeForm, amounts: updated });
  };

  const addAmountRow = () => setFeeTypeForm({ ...feeTypeForm, amounts: [...feeTypeForm.amounts, { class_id: '', stream_id: '', location: '', amount: '' }] });
  const removeAmountRow = (index) => setFeeTypeForm({ ...feeTypeForm, amounts: feeTypeForm.amounts.filter((_, i) => i !== index) });

  const handleFeeTypeClassChange = (classId) => {
    const cls = classes.find(c => c.id == classId);
    setAvailableStreams(cls?.streams || []);
    setFeeTypeForm({ ...feeTypeForm, class_id: classId, stream_id: '' });
  };

  const handleFeeTypeSubmit = async (e) => {
    e.preventDefault(); setSavingFeeType(true);
    const payload = { ...feeTypeForm };
    payload.amounts = payload.amounts.filter(a => a.amount !== '');
    const url = editingFeeType ? `${API_BASE}/api/fees/fee-types/${editingFeeType.id}` : `${API_BASE}/api/fees/fee-types`;
    const method = editingFeeType ? 'PUT' : 'POST';
    try {
      await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      fetchFeeTypes();
      setFeeTypeModal(false);
      showModal('success', editingFeeType ? 'Fee type updated' : 'Fee type created');
    } catch (err) {
      showModal('error', err.message || 'Failed');
    } finally {
      setSavingFeeType(false);
    }
  };

  const handleDeleteFeeType = (id, name) => {
    confirmAction('Delete Fee Type', `Are you sure you want to delete "${name}"? This action cannot be undone.`, async () => {
      try {
        await safeFetchJson(`${API_BASE}/api/fees/fee-types/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        fetchFeeTypes();
        showModal('success', 'Fee type deleted');
      } catch (err) {
        showModal('error', err.message || 'Failed to delete');
      }
    });
  };

  // ==================== BANKING DETAILS ====================
  const openBankModal = (bank = null) => {
    if (bank) {
      setEditingBank(bank);
      setBankForm({ bank_name: bank.bank_name, account_name: bank.account_name, account_number: bank.account_number, branch: bank.branch || '', swift_code: bank.swift_code || '' });
    } else {
      setEditingBank(null);
      setBankForm({ bank_name: '', account_name: '', account_number: '', branch: '', swift_code: '' });
    }
    setBankModal(true);
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault(); setSavingBank(true);
    const url = editingBank ? `${API_BASE}/api/fees/bank-details/${editingBank.id}` : `${API_BASE}/api/fees/bank-details`;
    const method = editingBank ? 'PUT' : 'POST';
    try {
      await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bankForm),
      });
      showModal('success', editingBank ? 'Bank details updated' : 'Bank details added');
      fetchBankDetails();
      setBankModal(false);
    } catch (err) {
      showModal('error', err.message || 'Failed');
    } finally {
      setSavingBank(false);
    }
  };

  const handleDeleteBank = (id) => {
    confirmAction('Delete Bank Detail', 'Are you sure?', async () => {
      try {
        await safeFetchJson(`${API_BASE}/api/fees/bank-details/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        fetchBankDetails();
        showModal('success', 'Bank details deleted');
      } catch (err) {
        showModal('error', err.message || 'Failed to delete');
      }
    });
  };

  // ==================== FILTERED STUDENTS ====================
  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // ==================== RENDER ====================
  return (
    <div className="p-4 md:p-6 bg-blue-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />
      {confirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h3 className="text-xl font-bold text-blue-900 mb-2">{confirm.title}</h3>
            <p className="text-gray-600 mb-6">{confirm.message}</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setConfirm({ isOpen: false })} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={executeConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-6">Finance Management</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('feesAndPayments')} className={`px-4 py-2 rounded-full font-medium transition ${activeTab === 'feesAndPayments' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'}`}><FaMoneyBillWave className="inline mr-2" /> Fees & Payments</button>
        <button onClick={() => setActiveTab('feeTypes')} className={`px-4 py-2 rounded-full font-medium transition ${activeTab === 'feeTypes' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'}`}><FaFileInvoice className="inline mr-2" /> Fee Types</button>
        <button onClick={() => setActiveTab('banking')} className={`px-4 py-2 rounded-full font-medium transition ${activeTab === 'banking' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'}`}><FaUniversity className="inline mr-2" /> Banking</button>
      </div>

      {/* ==================== FEES & PAYMENTS TAB ==================== */}
      {activeTab === 'feesAndPayments' && (
        <div>
          <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Term *</label>
              <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="p-2 border rounded">
                <option value="">Select Term</option>
                {terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Class *</label>
              <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStream(''); }} className="p-2 border rounded">
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedClass && availableStreams.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Stream</label>
                <select value={selectedStream} onChange={e => setSelectedStream(e.target.value)} className="p-2 border rounded">
                  <option value="">All Streams</option>
                  {availableStreams.map(s => <option key={s.id} value={s.id}>{s.stream_name || s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {previousTermUnpaid && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg flex items-center gap-2 text-yellow-800">
              <FaExclamationTriangle className="text-lg" />
              <span>There are unpaid fees for previous terms. You must clear them before paying for this term.</span>
            </div>
          )}

          {selectedClass && selectedTerm ? (
            <div className="bg-white rounded-xl shadow mb-6 p-4">
              <div className="relative max-w-sm mb-4">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search student by name..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-blue-50">
                    <tr><th className="p-4">Student</th><th className="p-4">Fees Summary</th><th className="p-4">Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => {
                      const studentFeeList = getStudentFees(student.id);
                      return (
                        <tr key={student.id} className="border-t hover:bg-gray-50">
                          <td className="p-4 font-medium">{student.first_name} {student.last_name}<br /><span className="text-sm text-gray-500">{student.student_number}</span></td>
                          <td className="p-4">
                            {studentFeeList.length === 0 ? (
                              <span className="text-gray-400">No fees assigned</span>
                            ) : (
                              <div className="space-y-2">
                                {studentFeeList.map(sf => {
                                  const balance = Number(sf.total_amount) - Number(sf.paid_amount);
                                  const canDelete = sf.payments?.length === 0 && !sf.fee_type?.is_mandatory;
                                  return (
                                    <div key={sf.id} className="flex items-center gap-2 text-sm flex-wrap">
                                      <span className="font-medium">{sf.fee_type?.name}</span>
                                      <span className={balance === 0 ? 'text-green-600' : 'text-red-600'}>
                                        MK {Number(sf.total_amount).toLocaleString()} | Paid: MK {Number(sf.paid_amount).toLocaleString()}
                                        {balance > 0 && ` (Bal: MK ${balance.toLocaleString()})`}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => openEditPaidModal(sf)} className="text-blue-600 hover:text-blue-800" title="Edit paid amount"><FaEdit /></button>
                                        <button onClick={() => openPaymentModal(sf)} className="text-green-600 hover:text-green-800" title="Record payment"><FaMoneyBillWave /></button>
                                        {Number(sf.paid_amount) > Number(sf.total_amount) && (
                                          <button onClick={() => openTransferModal(sf)} className="text-yellow-600 hover:text-yellow-800" title="Transfer overpayment"><FaExchangeAlt /></button>
                                        )}
                                        <button onClick={() => downloadInvoice(sf.id)} className="text-gray-600 hover:text-gray-800" title="Download invoice"><FaFileInvoice /></button>
                                        {sf.status === 'paid' && (
                                          <button onClick={() => downloadFeeReceipt(sf.id)} className="text-purple-600 hover:text-purple-800" title="Download paid receipt"><FaReceipt /></button>
                                        )}
                                        {canDelete && (
                                          <button onClick={() => handleDeleteFee(sf)} className="text-red-600 hover:text-red-800" title="Delete fee assignment"><FaTrash /></button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <button onClick={() => openAssignMulti(student)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"><FaPlus /> Assign Fees</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">Please select term, class, and optionally stream to view students.</p>
          )}
        </div>
      )}

      {/* ==================== FEE TYPES TAB ==================== */}
      {activeTab === 'feeTypes' && (
        <div>
          <button onClick={() => openFeeTypeModal()} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Fee Type</button>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50">
                <tr><th className="p-4">Name</th><th className="p-4">Category</th><th className="p-4">Amounts</th><th className="p-4">Mandatory</th><th className="p-4">Actions</th></tr>
              </thead>
              <tbody>
                {feeTypes.map(ft => (
                  <tr key={ft.id} className="border-t">
                    <td className="p-4 font-medium">{ft.name}</td><td className="p-4">{ft.category}</td>
                    <td className="p-4">
                      {ft.amounts.map((amt, i) => (
                        <div key={i} className="text-sm">
                          {amt.class ? `${amt.class.name}${amt.stream ? ` ${amt.stream.name}` : ''}: ` : ''}
                          {amt.location ? `${amt.location}: ` : ''}MK {Number(amt.amount).toLocaleString()}
                        </div>
                      ))}
                    </td>
                    <td className="p-4">{ft.is_mandatory ? <FaCheckCircle className="text-green-500" /> : <FaTimesCircle className="text-red-500" />}</td>
                    <td className="p-4">
                      <button onClick={() => openFeeTypeModal(ft)} className="text-blue-600 mr-2" title="Edit fee type"><FaEdit /></button>
                      <button onClick={() => handleDeleteFeeType(ft.id, ft.name)} className="text-red-600" title="Delete fee type"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== BANKING DETAILS TAB ==================== */}
      {activeTab === 'banking' && (
        <div>
          <button onClick={() => openBankModal()} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><FaPlus /> Add Bank</button>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-blue-50">
                <tr><th className="p-4">Bank Name</th><th className="p-4">Account Name</th><th className="p-4">Account Number</th><th className="p-4">Branch</th><th className="p-4">Swift Code</th><th className="p-4">Actions</th></tr>
              </thead>
              <tbody>
                {bankDetails.map(bank => (
                  <tr key={bank.id} className="border-t">
                    <td className="p-4">{bank.bank_name}</td><td className="p-4">{bank.account_name}</td><td className="p-4">{bank.account_number}</td>
                    <td className="p-4">{bank.branch || '—'}</td><td className="p-4">{bank.swift_code || '—'}</td>
                    <td className="p-4">
                      <button onClick={() => openBankModal(bank)} className="text-blue-600 mr-2"><FaEdit /></button>
                      <button onClick={() => handleDeleteBank(bank.id)} className="text-red-600"><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      {assignMultiModal && selectedStudentForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Assign Optional Fees to {selectedStudentForAssign.first_name} {selectedStudentForAssign.last_name}</h2>
            {optionalFeeTypes.length === 0 ? (
              <p className="text-gray-600">No optional fee types available.</p>
            ) : (
              <div className="space-y-4">
                {assignFeesList.map((item, index) => (
                  <div key={index} className="border p-3 rounded relative">
                    <button onClick={() => removeFeeRow(index)} className="absolute top-2 right-2 text-red-500"><FaTimesCircle /></button>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm">Fee Type</label>
                        <select value={item.fee_type_id} onChange={e => handleAssignFeeChange(index, 'fee_type_id', e.target.value)} className="w-full p-2 border rounded">
                          <option value="">Select</option>
                          {optionalFeeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                        </select>
                      </div>
                      {item.fee_type_id && (
                        <>
                          {feeTypes.find(ft => ft.id == item.fee_type_id)?.has_variations && (
                            <div>
                              <label className="text-sm">Location / Class</label>
                              <select value={item.location} onChange={e => handleAssignFeeChange(index, 'location', e.target.value)} className="w-full p-2 border rounded">
                                <option value="">Standard</option>
                                {feeTypes.find(ft => ft.id == item.fee_type_id)?.amounts.map(amt => (
                                  <option key={amt.id} value={amt.location || ''}>{amt.location || (amt.class ? amt.class.name : 'Standard')} - MK {amt.amount}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="text-sm">Amount (MK) – auto‑filled</label>
                            <input type="number" value={item.amount} readOnly className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addFeeRow} className="text-blue-600 text-sm flex items-center gap-1"><FaPlus /> Add another fee</button>
              </div>
            )}
            <div className="mt-6 flex gap-4">
              <button onClick={handleAssignMultiSubmit} disabled={assigning} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                {assigning ? <FaSpinner className="animate-spin" /> : null}{assigning ? 'Assigning...' : 'Assign All Fees'}
              </button>
              <button onClick={() => setAssignMultiModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editPaidModal && editingFeeForPaid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Edit Paid Amount</h2>
            <p className="text-sm text-gray-600 mb-4">{editingFeeForPaid.student?.first_name} {editingFeeForPaid.student?.last_name} – {editingFeeForPaid.fee_type?.name}<br />Total Fee: MK {Number(editingFeeForPaid.total_amount).toLocaleString()}</p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium">Current Paid Amount (MK)</label><input type="text" value={Number(editingFeeForPaid.paid_amount).toLocaleString()} readOnly className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed" /></div>
              <div><label className="block text-sm font-medium">New Paid Amount (MK) *</label><input type="number" min="0" max={editingFeeForPaid.total_amount} step="0.01" value={newPaidAmount} onChange={e => setNewPaidAmount(e.target.value)} className="w-full p-2 border rounded" /></div>
              <button onClick={handleEditPaidAmount} disabled={savingPaidAmount} className="bg-blue-600 text-white px-4 py-2 rounded-lg w-full">{savingPaidAmount ? <FaSpinner className="animate-spin inline mr-1" /> : null}{savingPaidAmount ? 'Saving...' : 'Update Paid Amount'}</button>
            </div>
            <button onClick={() => setEditPaidModal(false)} className="mt-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {paymentModal && selectedFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Record Payment</h2>
            <p className="text-sm text-gray-600 mb-4">{selectedFee.student?.first_name} {selectedFee.student?.last_name} – {selectedFee.fee_type?.name}<br />Total: MK {Number(selectedFee.total_amount).toLocaleString()} | Paid: MK {Number(selectedFee.paid_amount).toLocaleString()}<br />Balance: MK {Number(selectedFee.total_amount - selectedFee.paid_amount).toLocaleString()}</p>
            <div className="space-y-4">
              <div><label className="block text-sm">Amount *</label><input type="number" min="0.01" step="0.01" max={selectedFee.total_amount - selectedFee.paid_amount} value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full p-2 border rounded" required /></div>
              <div><label className="block text-sm">Payment Date</label><input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})} className="w-full p-2 border rounded" /></div>
              <div><label className="block text-sm">Method</label><select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} className="w-full p-2 border rounded"><option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option></select></div>
              <div><label className="block text-sm">Notes</label><input type="text" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full p-2 border rounded" /></div>
              <button onClick={handleRecordPayment} disabled={savingPayment} className="bg-blue-600 text-white px-4 py-2 rounded-lg w-full">{savingPayment ? 'Recording...' : 'Record Payment'}</button>
            </div>
            <button onClick={() => setPaymentModal(false)} className="mt-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {transferModal && transferSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">Transfer Overpayment</h2>
            <p className="text-sm text-gray-600 mb-4">Source: {transferSource.student?.first_name} – {transferSource.fee_type?.name} (Overpaid: MK {Number(transferSource.paid_amount - transferSource.total_amount).toLocaleString()})</p>
            <div className="space-y-4">
              <div><label className="block text-sm">Transfer to Fee</label><select value={transferTarget} onChange={e => setTransferTarget(e.target.value)} className="w-full p-2 border rounded"><option value="">Select destination</option>{studentFees.filter(sf => sf.id !== transferSource.id && sf.student_id === transferSource.student_id).map(sf => (<option key={sf.id} value={sf.id}>{sf.fee_type?.name} (Term: {sf.term?.name || 'N/A'})</option>))}</select></div>
              <div><label className="block text-sm">Amount</label><input type="number" min="0.01" max={transferSource.paid_amount - transferSource.total_amount} value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="w-full p-2 border rounded" /></div>
              <button onClick={handleTransfer} disabled={transferring} className="bg-yellow-600 text-white px-4 py-2 rounded-lg w-full">{transferring ? 'Transferring...' : 'Transfer'}</button>
            </div>
            <button onClick={() => setTransferModal(false)} className="mt-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {feeTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingFeeType ? 'Edit Fee Type' : 'Add Fee Type'}</h2>
            <form onSubmit={handleFeeTypeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm">Category *</label><select value={feeTypeForm.category} onChange={e => setFeeTypeForm({...feeTypeForm, category: e.target.value})} className="w-full p-2 border rounded" required>{FEE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div><label className="block text-sm">Name *</label><input type="text" value={feeTypeForm.name} onChange={e => setFeeTypeForm({...feeTypeForm, name: e.target.value})} className="w-full p-2 border rounded" required /></div>
                <div className="md:col-span-2"><label className="block text-sm">Description</label><textarea value={feeTypeForm.description} onChange={e => setFeeTypeForm({...feeTypeForm, description: e.target.value})} className="w-full p-2 border rounded" rows={2} /></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={feeTypeForm.is_mandatory} onChange={e => setFeeTypeForm({...feeTypeForm, is_mandatory: e.target.checked})} id="mandatory" /><label htmlFor="mandatory">Mandatory (auto‑assigned to students)</label></div>
                <div><label className="block text-sm">Restrict to Class (optional)</label><select value={feeTypeForm.class_id} onChange={e => handleFeeTypeClassChange(e.target.value)} className="w-full p-2 border rounded"><option value="">All Classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                {feeTypeForm.class_id && availableStreams.length > 0 && (
                  <div><label className="block text-sm">Stream</label><select value={feeTypeForm.stream_id} onChange={e => setFeeTypeForm({...feeTypeForm, stream_id: e.target.value})} className="w-full p-2 border rounded"><option value="">All Streams</option>{availableStreams.map(s => <option key={s.id} value={s.id}>{s.stream_name || s.name}</option>)}</select></div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amounts *</label>
                {feeTypeForm.amounts.map((amt, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 mb-2">
                    <div className="flex-1 min-w-[120px]"><label className="text-xs">Class</label><select value={amt.class_id} onChange={e => handleAmountRowChange(idx, 'class_id', e.target.value)} className="w-full p-2 border rounded"><option value="">All</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    {amt.class_id && (feeTypeStreams[idx]?.length > 0) && (
                      <div className="flex-1 min-w-[120px]"><label className="text-xs">Stream</label><select value={amt.stream_id} onChange={e => handleAmountRowChange(idx, 'stream_id', e.target.value)} className="w-full p-2 border rounded"><option value="">All</option>{feeTypeStreams[idx]?.map(s => <option key={s.id} value={s.id}>{s.stream_name || s.name}</option>)}</select></div>
                    )}
                    <div className="flex-1 min-w-[120px]"><label className="text-xs">Location (optional)</label><input type="text" value={amt.location} onChange={e => handleAmountRowChange(idx, 'location', e.target.value)} placeholder="e.g., Area A" className="w-full p-2 border rounded" /></div>
                    <div className="flex-1 min-w-[100px]"><label className="text-xs">Amount (MK) *</label><input type="number" min="0" step="0.01" value={amt.amount} onChange={e => handleAmountRowChange(idx, 'amount', e.target.value)} className="w-full p-2 border rounded" required /></div>
                    {feeTypeForm.amounts.length > 1 && <button type="button" onClick={() => removeAmountRow(idx)} className="text-red-500 p-2"><FaTrash /></button>}
                  </div>
                ))}
                <button type="button" onClick={addAmountRow} className="text-blue-600 text-sm flex items-center gap-1"><FaPlus /> Add amount</button>
              </div>
              <div className="flex gap-4 mt-6">
                <button type="submit" disabled={savingFeeType} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">{savingFeeType ? <FaSpinner className="animate-spin" /> : null}{savingFeeType ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setFeeTypeModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4">{editingBank ? 'Edit Bank Details' : 'Add Bank Details'}</h2>
            <form onSubmit={handleBankSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm">Bank Name *</label><input type="text" value={bankForm.bank_name} onChange={e => setBankForm({...bankForm, bank_name: e.target.value})} required className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm">Account Name *</label><input type="text" value={bankForm.account_name} onChange={e => setBankForm({...bankForm, account_name: e.target.value})} required className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm">Account Number *</label><input type="text" value={bankForm.account_number} onChange={e => setBankForm({...bankForm, account_number: e.target.value})} required className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm">Branch (optional)</label><input type="text" value={bankForm.branch} onChange={e => setBankForm({...bankForm, branch: e.target.value})} className="w-full p-2 border rounded" /></div>
                <div><label className="block text-sm">Swift Code (optional)</label><input type="text" value={bankForm.swift_code} onChange={e => setBankForm({...bankForm, swift_code: e.target.value})} className="w-full p-2 border rounded" /></div>
              </div>
              <div className="flex gap-4">
                <button type="submit" disabled={savingBank} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">{savingBank ? <FaSpinner className="animate-spin" /> : null}{savingBank ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setBankModal(false)} className="border px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePage;