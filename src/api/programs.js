import httpClient from './httpClient'

export const fetchPrograms = (zoneId) => {
  const params = zoneId != null ? { zone_id: zoneId } : {}
  return httpClient.get('/api/programs', { params }).then(r => r.data)
}

export const createProgram = (data) =>
  httpClient.post('/api/programs', data).then(r => r.data)

export const updateProgram = (id, data) =>
  httpClient.put(`/api/programs/${id}`, data).then(r => r.data)

export const deleteProgram = (id) =>
  httpClient.delete(`/api/programs/${id}`)
