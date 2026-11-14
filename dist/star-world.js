const hour=60*60*1000;
export const facilityCosts=[10,20,35];
export const storageHours=48;
export const starFriends=[
 {id:'lumi',name:'ルミ',cost:6,description:'星明かりを集める、小さな案内役。'},
 {id:'mio',name:'ミオ',cost:12,description:'光の泉のそばで眠る、星の旅人。'},
 {id:'nova',name:'ノヴァ',cost:24,description:'夜空にきらめく足跡を残す仲間。'}
];

export function starWorldSnapshot(saved,now=Date.now()){
 const level=Number.isInteger(saved?.level)&&saved.level>0&&saved.level<=facilityCosts.length?saved.level:0;
 const savedFriends=Array.isArray(saved?.friends)?saved.friends:[];
 const friends=starFriends.filter(friend=>savedFriends.includes(friend.id)).map(friend=>friend.id);
 const capacity=level*storageHours;
 const stored=Number.isSafeInteger(saved?.stored)?Math.min(capacity,Math.max(0,saved.stored)):0;
 const last=Number.isSafeInteger(saved?.last)&&saved.last>=0?saved.last:now;
 if(!level)return {level:0,stored:0,last:now,friends};
 const elapsedHours=Math.floor(Math.max(0,now-last)/hour);
 const available=Math.min(capacity,stored+elapsedHours*level);
 return {level,stored:available,last:available===capacity?Math.max(last,now):last+elapsedHours*hour,friends};
}

export function developStar(saved,balance,action,friendId,now=Date.now()){
 const world=starWorldSnapshot(saved,now);
 if(action==='facility'){
  const cost=facilityCosts[world.level];
  if(cost===undefined)throw Error('施設は最大レベルです。');
  if(balance<cost)throw Error('宇宙エネルギーが足りません。');
  return {world:{...world,level:world.level+1},balance:balance-cost};
 }
 const friend=starFriends.find(item=>item.id===friendId);
 if(action!=='friend'||!friend||world.friends.includes(friendId))throw Error('迎える仲間を選び直してください。');
 if(world.stored<friend.cost)throw Error('星のエネルギーが足りません。');
 return {world:{...world,stored:world.stored-friend.cost,friends:[...world.friends,friendId]},balance};
}
