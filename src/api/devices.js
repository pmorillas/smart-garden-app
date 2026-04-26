import httpClient from './httpClient'

export const fetchDevices = () =>
  httpClient.get('/api/devices').then(r => r.data)

export const updateDevice = (id, data) =>
  httpClient.put(`/api/devices/${id}`, data).then(r => r.data)

export const deleteDevice = (id) =>
  httpClient.delete(`/api/devices/${id}`)

export const assignZoneDevice = (zoneId, deviceId) =>
  httpClient.put(`/api/zones/${zoneId}/device`, { device_id: deviceId }).then(r => r.data)
