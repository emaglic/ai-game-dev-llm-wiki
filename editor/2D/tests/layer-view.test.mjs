import test from 'node:test';
import assert from 'node:assert/strict';
import {LayerView} from '../src/layer-view.mjs';
import {drawScene} from '../src/render.mjs';
const fixture=()=>({id:'room',layers:[{id:'a',visible:true},{id:'b',visible:false},{id:'c',visible:true}]});
test('Solo hidden layer, switch isolation and restore mixed visibility without modifying data',()=>{
  const level=fixture(),before=JSON.stringify(level),view=new LayerView(),visibility=()=>level.layers.map(l=>view.visible(l));
  view.sync(level);assert.deepEqual(visibility(),[true,false,true]);
  view.toggle(level,'b');assert.deepEqual(visibility(),[false,true,false]);
  view.toggle(level,'c');assert.deepEqual(visibility(),[false,false,true]);
  view.toggle(level,'c');assert.deepEqual(visibility(),[true,false,true]);assert.equal(JSON.stringify(level),before);
});
test('layer addition/removal, deletion of solo target, level switch and reset reconcile view state',()=>{
  const level=fixture(),view=new LayerView();view.toggle(level,'b');
  level.layers.push({id:'new',visible:true});view.sync(level);assert.equal(view.visible(level.layers.at(-1)),false);
  level.layers=level.layers.filter(l=>l.id!=='a');view.sync(level);assert.equal(view.solo,'b');
  level.layers=level.layers.filter(l=>l.id!=='b');view.sync(level);assert.equal(view.solo,null);assert.equal(view.visible(level.layers.at(-1)),true);
  view.toggle(level,'c');view.sync({...fixture(),id:'other'});assert.equal(view.solo,null);
  view.toggle(level,'c');view.reset();view.sync(level);assert.equal(view.solo,null);
});
test('effective visibility controls scene drawing; default runtime still uses authored flags',()=>{
  const level={...fixture(),width:100,height:100,settings:{},grid:10};
  for(const l of level.layers){l.kind='tile';l.opacity=1;l.tiles=[{type:l.id,x:0,y:0,width:10,height:10}];}
  const project={catalog:{elements:level.layers.map(l=>({id:l.id,color:l.id})),levelProperties:{}},settings:{viewport:{width:100,height:100}}};
  const fills=[],ctx=new Proxy({globalAlpha:1},{get:(t,k)=>k in t?t[k]:(...args)=>{if(k==='fill')fills.push(t.fillStyle);},set:(t,k,v)=>(t[k]=v,true)});
  const view=new LayerView();view.toggle(level,'b');drawScene(ctx,project,level,new Map(),{overlays:false,layerVisible:l=>view.visible(l)});assert.deepEqual(fills,['b']);
  fills.length=0;drawScene(ctx,project,level,new Map(),{overlays:false});assert.deepEqual(fills,['a','c']);
});
