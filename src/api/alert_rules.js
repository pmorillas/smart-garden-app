import httpClient from './httpClient'

export const fetchAlertRules = () =>
  httpClient.get('/api/alert-rules/').then(r => r.data)

export const createAlertRule = (data) =>
  httpClient.post('/api/alert-rules/', data).then(r => r.data)

export const updateAlertRule = (id, patch) =>
  httpClient.put(`/api/alert-rules/${id}`, patch).then(r => r.data)

export const deleteAlertRule = (id) =>
  httpClient.delete(`/api/alert-rules/${id}`)
