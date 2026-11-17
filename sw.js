// Service worker Bencor Shop : installation de l'app + notifications push (Firebase Cloud Messaging)
importScripts('firebase-config.js');
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});

// Compteur sur l'icône : +1 à chaque notification reçue, remis à 0 quand l'app est ouverte (voir index.html)
async function bumpBadge(){
  try{
    const c=await caches.open('bencor-badge');
    const r=await c.match('n');
    const n=(r?parseInt(await r.text(),10)||0:0)+1;
    await c.put('n',new Response(String(n)));
    if(self.navigator&&self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
  }catch(e){}
}

if(FIREBASE_CONFIG.apiKey){
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging=firebase.messaging();
  // Les messages sont "data-only" : on affiche nous-mêmes la notification
  messaging.onBackgroundMessage(p=>{
    const d=p.data||{};
    // Même notification reçue deux fois (deux enregistrements du téléphone) : elle remplace la première, sans doubler le compteur
    return self.registration.getNotifications(d.tag?{tag:d.tag}:{}).then(deja=>{
      const doublon=!!d.tag&&deja.length>0;
      return Promise.all([doublon?null:bumpBadge(),self.registration.showNotification(d.title||'Bencor Shop',{body:d.body||'',icon:'icon-192.png',badge:'badge-96.png',tag:d.tag||undefined,renotify:false,data:{url:'./'}})]);
    });
  });
}
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){ if('focus' in c) return c.focus(); }
    return clients.openWindow('./');
  }));
});
