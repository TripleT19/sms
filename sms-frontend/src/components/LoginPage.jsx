// src/components/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaArrowLeft,
  FaGraduationCap,
} from 'react-icons/fa';

// 🔁 Replace with your actual Laravel API URL
const API_BASE = 'https://sturdy-spoon-x5qpgx9gq67j297x-8000.app.github.dev';

const LoginPage = () => {
  const navigate = useNavigate();

  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loginData, setLoginData] = useState({
    identifier: '', // email or username
    password: '',
  });

  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---------- Login ----------
  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token and user roles (needed for sidebar & route guards)
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_roles', JSON.stringify(data.user.roles || []));
        navigate('/dashboard');
      } else {
        alert(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Forgot Password ----------
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      if (response.ok) {
        setResetSent(true);
        setTimeout(() => {
          setResetSent(false);
          setIsForgotPassword(false);
          setResetEmail('');
        }, 3000);
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to send reset link.');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      alert('Network error, please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-950 p-4">
      {/* Main Card */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Side – Branding */}
        <div className="md:w-1/2 bg-gradient-to-b from-blue-900 to-blue-950 text-white p-10 flex flex-col justify-center items-center text-center">
          <FaGraduationCap className="text-6xl mb-6 text-blue-300" />
          <h1 className="text-4xl font-bold mb-2">EduManage</h1>
          <p className="text-lg text-blue-200 mb-6">School Management System</p>
          <div className="hidden md:block mt-4">
            <img
              src="https://via.placeholder.com/220x180?text=School+Illustration"
              alt="School illustration"
              className="rounded-lg opacity-90"
            />
          </div>
          <p className="mt-6 text-sm text-blue-300">
            Empowering teachers, students & parents
          </p>
        </div>

        {/* Right Side – Form */}
        <div className="md:w-1/2 p-8 md:p-12">
          {!isForgotPassword ? (
            <>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h2>
              <p className="text-gray-500 mb-8">Sign in to your account</p>

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                {/* Identifier – Email or Username */}
                <div className="relative">
                  <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="identifier"
                    value={loginData.identifier}
                    onChange={handleLoginChange}
                    required
                    placeholder="Email or Username"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                </div>

                {/* Password + Eye Toggle */}
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    required
                    placeholder="Password"
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Forgot Password */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => setIsForgotPassword(true)}
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  Forgot Password?
                </button>
              </div>
            </>
          ) : (
            /* Forgot Password View */
            <>
              <button
                onClick={() => setIsForgotPassword(false)}
                className="mb-6 text-blue-600 hover:text-blue-800 transition flex items-center gap-2"
              >
                <FaArrowLeft /> Back to login
              </button>

              <h2 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h2>
              <p className="text-gray-500 mb-8">
                Enter your email and we’ll send you a link to reset your password.
              </p>

              {resetSent ? (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  ✅ Password reset link sent! Check your inbox.
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-5">
                  <div className="relative">
                    <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="Email address"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;