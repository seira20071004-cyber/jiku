import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSpaceLayout,spaceRoute} from '../src/space-layout.js';

const nodes=[
 {id:'root',parentId:null},
 {id:'galaxy-a',parentId:'root'},{id:'galaxy-b',parentId:'root'},
 {id:'star-a',parentId:'galaxy-a'},{id:'star-b',parentId:'galaxy-b'},
 {id:'planet-a',parentId:'star-a'},{id:'moon-a',parentId:'planet-a'}
];

test('地図で離れた枝を選んでも共通の親を通って段階的に移動する',()=>{
 const frames=createSpaceLayout(nodes,1280,650,24);
 assert.deepEqual(spaceRoute(frames,'moon-a','star-b'),['planet-a','star-a','galaxy-a','root','galaxy-b','star-b']);
 assert.deepEqual(spaceRoute(frames,'star-a','moon-a'),['planet-a','moon-a']);
 assert.deepEqual(spaceRoute(frames,'star-a','star-a'),[]);
});

test('横長でも縦長でも、下位の天体へ進むほど観察距離が短くなる',()=>{
 for(const [width,height] of [[1280,650],[390,780]]){
  const frames=createSpaceLayout(nodes,width,height,24);
  for(const id of ['galaxy-a','star-a','planet-a','moon-a']){
   const target=frames.get(id),parent=frames.get(target.node.parentId);
   assert.ok(target.distance>0&&target.distance<parent.distance);
   assert.ok(Number.isFinite(target.x)&&Number.isFinite(target.y)&&Number.isFinite(target.z));
   assert.ok(Math.hypot(target.x-parent.x,target.y-parent.y)>0);
  }
 }
});
