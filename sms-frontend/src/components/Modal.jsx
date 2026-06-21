import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaTimes } from 'react-icons/fa';

const Modal = ({ isOpen, type = 'success', message, onClose, autoClose = true }) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <FaTimes />
        </button>
        <div className="flex items-center gap-4">
          {type === 'success' ? (
            <FaCheckCircle className="text-green-500 text-3xl" />
          ) : (
            <FaExclamationCircle className="text-red-500 text-3xl" />
          )}
          <p className="text-gray-800 text-lg">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default Modal;