// Push (FCM): a config chega pela URL de registro (?cfg=), definida no config.js
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp(JSON.parse(new URL(self.location).searchParams.get('cfg')));
  firebase.messaging().onBackgroundMessage(m => {
    const d = m.data || {};
    return self.registration.showNotification(d.title || 'Novo pedido', {
      body: d.body || '', icon: 'icon-192.png', badge: 'badge.png',
      tag: 'pedido-' + Date.now(),          // tag única: cada pedido gera um aviso novo, com som
      renotify: true, silent: false,         // garante o som padrão do sistema
      requireInteraction: true,              // fica na tela até você tocar (ignorado no iOS)
      vibrate: [300, 150, 300, 150, 500]
    });
  });
} catch (e) { console.error('SW push:', e); }

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL('admin.html', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    const w = l.find(x => x.url.includes('admin.html'));
    return w ? w.focus() : clients.openWindow(alvo);
  }));
});

// IMPORTANTE: troque o número da versão (v8 → v9...) sempre que publicar arquivos novos; isso apaga o cache antigo dos aparelhos.
const V = 'emporio-medonca-v9', SHELL = ['./', 'index.html', 'admin.html', 'style.css', 'app.js', 'extras.js', 'pagamentos.js', 'camera.js', 'totem.js', 'admin.js', 'admin-extras.js', 'catalogo-admin.js', 'fotos-admin.js', 'historico-admin.js', 'fiado-admin.js', 'config.js', 'pix.js', 'logo.png', 'logo-emblem.png', 'logo-full.png', 'icon-192.png', 'icon-512.png', 'badge.png'];
self.addEventListener('install', e => {
  // Se algum arquivo falhar, não derruba a instalação do service worker (o push continua funcionando)
  // cache: 'reload' busca direto no servidor, ignorando o cache do navegador (senão o cache novo já nasceria com arquivo velho)
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(err => console.warn('SW cache falhou:', u, err))))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;   // Firebase/CDN passam direto
  // Rede primeiro, sempre conferindo com o servidor (no-cache = usa o arquivo guardado só se ele confirmar que não mudou).
  // Sem internet, cai para o cache. Antes a rede podia devolver uma cópia velha do cache do navegador (~10 min no GitHub Pages).
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
});
