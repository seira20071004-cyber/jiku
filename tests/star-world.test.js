import {test} from 'node:test';
import assert from 'node:assert/strict';
import {developStar,starWorldSnapshot} from '../dist/star-world.js';

test('施設は記録のポイントで建ち、離れている間の生産で仲間を迎えられる',()=>{
 const start=1700000000000,hour=3600000;
 assert.throws(()=>developStar(undefined,9,'facility',null,start),/足りません/);
 const built=developStar(undefined,20,'facility',null,start);
 assert.equal(built.balance,10);
 assert.equal(starWorldSnapshot(built.world,start+hour-1).stored,0);
 const friend=developStar(built.world,built.balance,'friend','lumi',start+6*hour);
 assert.equal(friend.balance,10);
 assert.equal(friend.world.stored,0);
 assert.deepEqual(friend.world.friends,['lumi']);
 assert.throws(()=>developStar(friend.world,10,'friend','lumi',start+15*hour));
});
test('48時間分で貯蔵が止まり、使った直後に余剰分が復活しない',()=>{
 const hour=3600000,now=100*hour;
 const saved={level:1,stored:0,last:0,friends:[]};
 const result=developStar(saved,10,'friend','lumi',now);
 assert.equal(result.world.stored,42);
 assert.equal(starWorldSnapshot(result.world,now).stored,42);
 assert.equal(starWorldSnapshot(result.world,now+hour).stored,43);
});
