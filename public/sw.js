const CACHE_NAME = 'duty-scheduler-v2'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

// 웹 푸시 수신 → 헤드업(팝업) 시스템 알림 표시
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { return }

  const { title, body, data = {} } = payload
  // 알림마다 고유 tag → 메시지가 겹치지 않고 각각 헤드업 표시
  const tag = data.tag ?? ('duty-' + Date.now())

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon1-2-192.png',
      badge: '/icon1-2-192.png',
      data,
      vibrate: [200, 100, 200],
      tag,
      renotify: true,
      requireInteraction: false,
    })
  )
})

// 알림 클릭 → 해당 탭으로 랜딩
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('navigate' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
