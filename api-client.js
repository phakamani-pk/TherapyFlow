window.TherapyFlowAPI = (() => {
  const baseUrl = window.THERAPYFLOW_API_URL || 'http://127.0.0.1:4174/api';
  let token = localStorage.getItem('therapyflow-api-token') || '';

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }

  return {
    async login(username, password) {
      const body = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      token = body.token;
      localStorage.setItem('therapyflow-api-token', token);
      return body;
    },
    async me() { return request('/me'); },
    async clients() { return request('/clients'); },
    async collection(clientId, collection) { return request(`/clients/${clientId}/${collection}`); },
    logout() { token = ''; localStorage.removeItem('therapyflow-api-token'); },
    connected() { return Boolean(token); }
  };
})();
