const API_BASE = 'https://laravel.moyorise.com';

const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_roles');
    window.location.href = '/login'; // force a full redirect to avoid React state conflicts
    return; // never resolves further, so the caller won't get a response
  }

  return response;
};

export default apiFetch; 