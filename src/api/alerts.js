import httpClient from './httpClient'

export const fetchAlerts = (resolved) =>
  httpClient.get('/api/alerts/', { params: resolved !== undefined ? { resolved } : {} }).then(r => r.data)

export const resolveAlert = (id) =>
  httpClient.post(`/api/alerts/${id}/resolve`).then(r => r.data)

export const deleteAlert = (id) =>
  httpClient.delete(`/api/alerts/${id}`)
