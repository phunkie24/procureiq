import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || err)
)

// ── Procurement APIs ──────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getPipelineData: () => api.get('/dashboard/pipeline'),
  getSpendData: () => api.get('/dashboard/spend'),
}

export const agentsApi = {
  getAll: () => api.get('/agents'),
  getById: (id) => api.get(`/agents/${id}`),
  getMetrics: (id) => api.get(`/agents/${id}/metrics`),
  triggerTask: (id, payload) => api.post(`/agents/${id}/tasks`, payload),
}

export const rfqApi = {
  getAll: (params) => api.get('/rfqs', { params }),
  getById: (id) => api.get(`/rfqs/${id}`),
  create: (data) => api.post('/rfqs', data),
  issue: (id) => api.post(`/rfqs/${id}/issue`),
}

export const bidsApi = {
  getByRFQ: (rfqId) => api.get(`/rfqs/${rfqId}/bids`),
  score: (rfqId) => api.post(`/rfqs/${rfqId}/evaluate`),
  award: (bidId, payload) => api.post(`/bids/${bidId}/award`, payload),
}

export const poApi = {
  getAll: (params) => api.get('/purchase-orders', { params }),
  getById: (id) => api.get(`/purchase-orders/${id}`),
  create: (awardId) => api.post('/purchase-orders', { awardId }),
}

export const contractsApi = {
  getAll: (params) => api.get('/contracts', { params }),
  getById: (id) => api.get(`/contracts/${id}`),
  monitor: () => api.post('/contracts/monitor'),
  draftAmendment: (id, changes) => api.post(`/contracts/${id}/amend`, { changes }),
}

export const vendorsApi = {
  getAll: (params) => api.get('/vendors', { params }),
  getById: (id) => api.get(`/vendors/${id}`),
  getScorecard: (id, period) => api.get(`/vendors/${id}/scorecard`, { params: { period } }),
  discover: (category) => api.post('/vendors/discover', { category }),
  onboard: (data) => api.post('/vendors/onboard', data),
}

export const hitlApi = {
  getQueue: () => api.get('/hitl'),
  resolve: (id, approved, notes) => api.post(`/hitl/${id}/resolve`, { approved, notes }),
}

export const auditApi = {
  getLog: (params) => api.get('/audit', { params }),
}

export default api
