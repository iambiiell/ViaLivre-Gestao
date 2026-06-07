self.addEventListener('install', (event) => {
  console.info('[ViaLivre SW] Instalando Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.info('[ViaLivre SW] Service Worker ativado e controlando clientes.');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.group('[ViaLivre SW] Evento Push recebido!');
  
  let data = { title: 'ViaLivre', body: 'Nova notificação do sistema!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'ViaLivre', body: event.data.text() };
    }
  }
  
  console.log('Dados da Notificação:', data);
  console.groupEnd();

  const options = {
    body: data.body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    tag: data.tag || 'vialivre-notif',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: data,
    actions: [
      { action: 'open', title: 'Abrir Painel' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[ViaLivre SW] Notificação clicada:', event.notification);
  event.notification.close();

  // Redireciona ou abre a aba principal
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
