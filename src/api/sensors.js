import httpClient from './httpClient'

export const getLatestSensors = () =>
  httpClient.get('/api/sensors/latest').then(r => r.data)

export const getLatestAmbient = () =>
  httpClient.get('/api/sensors/ambient/latest').then(r => r.data)

export const getAmbientHistory = (hours = 24) =>
  httpClient.get('/api/sensors/ambient/history', { params: { hours } }).then(r => r.data)
