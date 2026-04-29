import httpClient from './httpClient'

const base = (deviceId) => `/api/devices/${deviceId}/peripherals`

export const fetchPeripherals = (deviceId) =>
  httpClient.get(`${base(deviceId)}/`).then(r => r.data)

export const createPeripheral = (deviceId, data) =>
  httpClient.post(`${base(deviceId)}/`, data).then(r => r.data)

export const updatePeripheral = (deviceId, peripheralId, data) =>
  httpClient.put(`${base(deviceId)}/${peripheralId}`, data).then(r => r.data)

export const deletePeripheral = (deviceId, peripheralId) =>
  httpClient.delete(`${base(deviceId)}/${peripheralId}`)

export const assignZoneSoil = (deviceId, data) =>
  httpClient.post(`${base(deviceId)}/assign-zone-soil`, data).then(r => r.data)

export const assignZoneRelay = (deviceId, data) =>
  httpClient.post(`${base(deviceId)}/assign-zone-relay`, data).then(r => r.data)

export const assignTankPeripheral = (deviceId, data) =>
  httpClient.post(`${base(deviceId)}/assign-tank`, data).then(r => r.data)

export const pushHardwareConfig = (deviceId) =>
  httpClient.post(`/api/devices/${deviceId}/push-hardware-config`).then(r => r.data)

export const readPeripheralLive = (deviceId, peripheralId) =>
  httpClient.post(`${base(deviceId)}/${peripheralId}/read`).then(r => r.data)
