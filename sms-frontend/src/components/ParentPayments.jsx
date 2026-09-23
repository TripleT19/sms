import React, { useState, useEffect } from 'react';
import {
  FaDownload, FaSpinner, FaUniversity,
  FaMoneyBillWave, FaChevronDown, FaFileInvoiceDollar, FaReceipt,
} from 'react-icons/fa';
import Modal from './Modal';

const API_BASE = 'https://laravel.moyorise.com';

const ParentPayments = () => {
  const token = localStorage.getItem('auth_token');
  const [children, setChildren] = useState([]);
  const [bankDetails, setBankDetails] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [feeRecords, setFeeRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFees, setLoadingFees] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '' });

  const showModal = (type, msg) => setModal({ isOpen: true, type, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/parent/children`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const childList = data.children || [];
          setChildren(childList);
          setBankDetails(data.bank_details || []);
          if (childList.length > 0) {
            setSelectedChildId(childList[0].student_id);
          }
        }
      } catch (err) {
        showModal('error', 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [token]);

  useEffect(() => {
    if (!selectedChildId) {
      setFeeRecords([]);
      return;
    }
    setLoadingFees(true);
    const fetchFees = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fees/student-fees?student_id=${selectedChildId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const grouped = {};
          data.forEach(fee => {
            const termId = fee.term_id;
            if (!grouped[termId]) {
              grouped[termId] = {
                term_id: termId,
                term_name: fee.term?.name || `Term ${termId}`,
                fees: [],
                total_amount: 0,
                paid_amount: 0,
              };
            }
            grouped[termId].fees.push(fee);
            grouped[termId].total_amount += parseFloat(fee.total_amount);
            grouped[termId].paid_amount += parseFloat(fee.paid_amount);
          });
          setFeeRecords(Object.values(grouped));
        }
      } catch (err) {
        showModal('error', 'Failed to load fee records.');
      } finally {
        setLoadingFees(false);
      }
    };
    fetchFees();
  }, [selectedChildId, token]);

  const handleDownload = async (url, studentFeeId) => {
    setDownloading(studentFeeId);
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `invoice_${studentFeeId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        showModal('error', 'Download failed.');
      }
    } catch {
      showModal('error', 'Network error.');
    } finally {
      setDownloading(null);
    }
  };

  const selectedChild = children.find(c => c.student_id == selectedChildId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <FaSpinner className="animate-spin text-4xl text-indigo-600" />
        <span className="ml-3 text-gray-600 text-lg font-medium">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      <Modal isOpen={modal.isOpen} type={modal.type} message={modal.message} onClose={closeModal} />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            Fee Payments
          </h1>
          <p className="text-gray-500 mt-2">View outstanding balances, download invoices and receipts</p>
        </div>

        {/* Child Selector */}
        <div className="mb-8 flex justify-center">
          <div className="relative inline-block">
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-xl px-5 py-3 pr-10 text-lg font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            >
              {children.map(child => (
                <option key={child.student_id} value={child.student_id}>
                  {child.name} – {child.class_name} {child.stream_name ? `(${child.stream_name})` : ''}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Bank details info card */}
        {bankDetails.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaUniversity className="text-indigo-500" /> Payment Instructions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankDetails.map(bank => (
                <div key={bank.id} className="bg-gray-50 p-4 rounded-xl border flex items-start gap-3 text-sm">
                  <FaUniversity className="text-indigo-500 mt-1" />
                  <div>
                    <p className="font-semibold text-gray-800">{bank.bank_name}</p>
                    <p>Account Name: {bank.account_name}</p>
                    <p>Account Number: {bank.account_number}</p>
                    {bank.branch && <p>Branch: {bank.branch}</p>}
                    {bank.swift_code && <p>Swift: {bank.swift_code}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fee Records */}
        {loadingFees ? (
          <div className="flex justify-center py-10">
            <FaSpinner className="animate-spin text-2xl text-indigo-600" />
          </div>
        ) : feeRecords.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <FaMoneyBillWave className="text-4xl mx-auto mb-2 text-gray-300" />
            <p>No fee records found for this child.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {feeRecords.map(term => (
              <div key={term.term_id} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-500 text-white">
                  <h2 className="text-xl font-bold">{term.term_name}</h2>
                  <div className="flex gap-6 mt-2 text-sm">
                    <span>Total: MK {term.total_amount.toLocaleString()}</span>
                    <span>Paid: MK {term.paid_amount.toLocaleString()}</span>
                    <span className="font-semibold">
                      Balance: MK {(term.total_amount - term.paid_amount).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 font-semibold text-gray-600 text-sm">Fee Type</th>
                          <th className="p-3 font-semibold text-gray-600 text-sm">Total</th>
                          <th className="p-3 font-semibold text-gray-600 text-sm">Paid</th>
                          <th className="p-3 font-semibold text-gray-600 text-sm">Balance</th>
                          <th className="p-3 font-semibold text-gray-600 text-sm">Status</th>
                          <th className="p-3 font-semibold text-gray-600 text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {term.fees.map(fee => (
                          <tr key={fee.id} className="border-t hover:bg-blue-50/50 transition">
                            <td className="p-3 font-medium">{fee.fee_type?.name || 'Fee'}</td>
                            <td className="p-3">MK {parseFloat(fee.total_amount).toLocaleString()}</td>
                            <td className="p-3">MK {parseFloat(fee.paid_amount).toLocaleString()}</td>
                            <td className="p-3">
                              MK {(parseFloat(fee.total_amount) - parseFloat(fee.paid_amount)).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                fee.status === 'paid' ? 'bg-green-100 text-green-800' :
                                fee.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {fee.status === 'paid' ? 'Paid' : fee.status === 'partial' ? 'Partial' : 'Pending'}
                              </span>
                            </td>
                            <td className="p-3 flex gap-2">
                              <button
                                onClick={() => handleDownload(`/api/fees/invoice/${fee.id}/download`, fee.id)}
                                disabled={downloading === fee.id}
                                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-sm"
                              >
                                {downloading === fee.id ? <FaSpinner className="animate-spin" /> : <FaFileInvoiceDollar />}
                                Invoice
                              </button>
                              {fee.status === 'paid' && (
                                <button
                                  onClick={() => handleDownload(`/api/fees/receipt/${fee.id}/download`, fee.id)}
                                  disabled={downloading === fee.id}
                                  className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm"
                                >
                                  <FaReceipt /> Receipt
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default ParentPayments;