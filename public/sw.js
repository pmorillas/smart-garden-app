self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Smart Garden', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Smart Garden', {
      body: data.body || '',
      tag: data.tag || 'smart-garden',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      renotify: true,
      data: { url: '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(event.notification.data?.url || '/')
    })
  )
})
