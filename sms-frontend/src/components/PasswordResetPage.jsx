// src/components/PasswordResetPage.jsx
import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FaLock, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

// Password strength calculator
const calculateStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score; // 0-4
};

const strengthLabel = (score) => {
  switch (score) {
    case 0:
    case 1: return { text: 'Weak', color: 'bg-red-500' };
    case 2: return { text: 'Fair', color: 'bg-yellow-500' };
    case 3: return { text: 'Good', color: 'bg-blue-500' };
    case 4: return { text: 'Strong', color: 'bg-green-500' };
    default: return { text: '', color: '' };
  }
};

const PasswordResetPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => calculateStrength(password), [password]);
  const { text: strengthText, color: strengthColor } = strengthLabel(strength);
  const passwordsMatch = password && password === passwordConfirmation;
  const canSubmit = password.length >= 8 && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Password reset successfully.');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.message || 'Reset failed.');
      }
    } catch (err) {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-950 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Invalid Reset Link</h2>
          <p className="text-gray-600">The reset link is missing required parameters.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-950 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-blue-900 mb-4">Reset Password</h2>
        <p className="text-gray-600 mb-6">Choose a strong, new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="At least 8 characters"
              />
            </div>

            {/* Strength meter */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full ${
                        level <= strength ? strengthColor : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${
                  strength >= 3 ? 'text-green-600' : strength === 2 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {strengthText}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {passwordConfirmation && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {passwordsMatch ? (
                    <FaCheckCircle className="text-green-500" />
                  ) : (
                    <FaTimesCircle className="text-red-500" />
                  )}
                </span>
              )}
            </div>
            {passwordConfirmation && !passwordsMatch && (
              <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Messages */}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-500 text-sm">{message}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg transition text-white font-semibold ${
              canSubmit
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaLock />}
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline">
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default PasswordResetPage;