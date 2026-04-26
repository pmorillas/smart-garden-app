import httpClient from './httpClient'

export const fetchZones = () =>
  httpClient.get('/api/zones').then(r => r.data)

export const updateZone = (id, data) =>
  httpClient.put(`/api/zones/${id}`, data).then(r => r.data)

export const updateZoneConfig = (id, config) =>
  httpClient.put(`/api/zones/${id}/config`, config).then(r => r.data)

export const getZoneHistory = (id, hours = 24) =>
  httpClient.get(`/api/zones/${id}/history`, { params: { hours } }).then(r => r.data)
