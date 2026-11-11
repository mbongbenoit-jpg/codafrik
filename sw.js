// Service worker Bencor Shop : installation de l'app + notifications push (Firebase Cloud Messaging)
importScripts('firebase-config.js');
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});

if(FIREBASE_CONFIG.apiKey){
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging=firebase.messaging();
  // Les messages sont "data-only" : on affiche nous-mêmes la notification
  messaging.onBackgroundMessage(p=>{
    const d=p.data||{};
    return self.registration.showNotification(d.title||'Bencor Shop',{body:d.body||'',icon:'icon-192.png',badge:'badge-96.png',tag:d.tag||undefined,data:{url:'./'}});
  });
}
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){ if('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
