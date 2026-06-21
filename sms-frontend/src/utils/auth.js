const TOKEN_KEY = 'auth_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const isAuthenticated = () => {
  const token = getToken();
  // Token might be expired – we’ll verify by a call to /api/user later
  return !!token;
};