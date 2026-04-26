import httpClient from './httpClient'

export const fetchTanks = () => httpClient.get('/api/tanks/').then(r => r.data)
export const fetchTank  = (id) => httpClient.get(`/api/tanks/${id}`).then(r => r.data)
export const createTank = (data) => httpClient.post('/api/tanks/', data).then(r => r.data)
export const updateTank = (id, data) => httpClient.put(`/api/tanks/${id}`, data).then(r => r.data)
export const deleteTank = (id) => httpClient.delete(`/api/tanks/${id}`)
export const fetchTankReadings = (id, hours = 24) =>
  httpClient.get(`/api/tanks/${id}/readings`, { params: { hours } }).then(r => r.data)
export const calibrateTank = (id, level) =>
  httpClient.post(`/api/tanks/${id}/calibrate`, null, { params: { level } }).then(r => r.data)
