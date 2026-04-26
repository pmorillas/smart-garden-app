import httpClient from './httpClient'

export const getVapidPublicKey = () =>
  httpClient.get('/api/push/vapid-public-key').then(r => r.data.public_key)

export const saveSubscription = (sub) => {
  const { endpoint, keys } = sub.toJSON()
  return httpClient.post('/api/push/subscribe', {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }).then(r => r.data)
}

export const deleteSubscription = (subId) =>
  httpClient.delete(`/api/push/subscribe/${subId}`)

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
