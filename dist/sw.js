self.addEventListener('push',event=>{
 let message;
 try{message=event.data?.json()}catch{}
 event.waitUntil(self.registration.showNotification(message?.test?'Jikuのテスト通知':'Jiku',{
  body:message?.test?'通知を受け取れました。':'今日、残りの時間はどのペースでいけそう？',
  icon:'/icons/jiku-192.png',
  tag:message?.test?'jiku-test':'jiku-evening'
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL('/?evening=1#tree',self.location.origin).href;
 event.waitUntil(clients.openWindow(target));
});
