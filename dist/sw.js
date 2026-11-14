self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('push',event=>{
 let message;
 try{message=event.data?.json()}catch{}
 const kind=message?.kind==='morning'?'morning':'evening';
 event.waitUntil(self.registration.showNotification(message?.test?'Jikuのテスト通知':'Jiku',{
  body:message?.test?'通知を受け取れました。':kind==='morning'?'今日はどんな1日にする？':'今日、残りの時間はどのペースでいけそう？',
  icon:'/icons/jiku-192.png',
  tag:message?.test?'jiku-test':'jiku-'+kind,
  data:{kind}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const kind=event.notification.data?.kind==='morning'?'morning':'evening';
 const target=new URL('/?'+kind+'=1#tree',self.location.origin).href;
 event.waitUntil(clients.openWindow(target));
});
