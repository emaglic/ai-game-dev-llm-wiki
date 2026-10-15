import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundOffset,backgroundErrors} from '../src/backgrounds.mjs';
import {resizeLevel} from '../src/level-resize.mjs';
test('parallax uses camera top-left and foreground factors can exceed one',()=>{
  assert.deepEqual(backgroundOffset({parallax:{x:0,y:.5}},{x:100,y:80}),{x:100,y:40});
  assert.deepEqual(backgroundOffset({parallax:{x:1,y:1.5}},{x:100,y:80}),{x:0,y:-40});
});
test('anchored level resizing shifts authored backgrounds proportionally, preserving screen composition',()=>{
  const level={version:3,width:100,height:100,settings:{camera:{x:50,y:50}},layers:[0,.5,1,1.5].map((p,i)=>({id:String(i),kind:'background',locked:true,parallax:{x:p,y:p},objects:[{id:String(i),x:10,y:20}]}))};
  const resized=resizeLevel(level,{levelProperties:{},elements:[]},140,120,{x:1,y:1});
  assert.deepEqual(resized.layers.map(l=>[l.objects[0].x,l.objects[0].y]),[[10,20],[30,30],[50,40],[70,50]]);
  assert.deepEqual(level.layers[0].objects[0],{id:'0',x:10,y:20});
});
test('background scales must be positive and flip/repeat flags boolean',()=>{
  const o={type:'background-image',properties:{scaleX:1,scaleY:2,flipX:true,repeat:true}};
  assert.deepEqual(backgroundErrors(o),[]);
  for(const scale of [0,-1,Infinity,'1'])assert.ok(backgroundErrors({...o,properties:{...o.properties,scaleX:scale}}).length);
  assert.ok(backgroundErrors({...o,properties:{repeat:'true'}}).length);
});
