import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const AUTO_LOGOUT_TIME = 15 * 60 * 1000; // 15 minutes

export default function useAutoLogout() {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  const logout = () => {
    // Clear local storage and redirect
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_roles');
    navigate('/login');
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(logout, AUTO_LOGOUT_TIME);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Start the timer on mount
    resetTimer();

    // Add event listeners
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Cleanup
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
}