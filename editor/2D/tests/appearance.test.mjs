import test from 'node:test';
import assert from 'node:assert/strict';
import {containsPoint,drawElement,frameError,validateAppearance} from '../src/appearance.mjs';
const object={x:10,y:20,width:40,height:80};
test('collision picking matches ellipses and polygon regions rather than their boxes',()=>{assert.equal(containsPoint(object,{collision:{shape:'ellipse'}},{x:11,y:21}),false);assert.equal(containsPoint(object,{collision:{shape:'ellipse'}},{x:30,y:60}),true);const t={collision:{shape:'polygon',points:[{x:0,y:0},{x:1,y:0},{x:.5,y:1}]}};assert.equal(containsPoint(object,t,{x:12,y:98}),false);assert.equal(containsPoint(object,t,{x:30,y:90}),true);assert.equal(containsPoint(object,t,{x:10,y:20}),true);});
test('invalid source rectangles, shapes and normalized geometry reject usefully',()=>{assert.match(validateAppearance({visual:{frame:{x:-1,y:0,width:0,height:16}}}).join(),/source pixels/);assert.match(validateAppearance({collision:{shape:'polygon',points:[{x:0,y:0}]}}).join(),/three normalized/);assert.match(validateAppearance({collision:{shape:'future'}}).join(),/unsupported/);assert.deepEqual(validateAppearance({visual:{asset:'hero.png',frame:{x:16,y:0,width:16,height:24}},collision:{shape:'ellipse'}}),[]);assert.match(frameError({id:'hero',visual:{frame:{x:32,y:0,width:32,height:48}}},{naturalWidth:48,naturalHeight:48}),/exceeds/);});
test('sprite crop retains aspect ratio and art offsets; invisible regions are editor-only',()=>{const calls=[];const ctx=new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(...args)=>calls.push([key,...args]),set:(t,k,v)=>(t[k]=v,true)});const image={naturalWidth:64,naturalHeight:48},type={visual:{asset:'hero.svg',frame:{x:32,y:0,width:32,height:48},bounds:{x:-.5,y:0,width:2,height:1}}};drawElement(ctx,object,type,new Map([['hero.svg',image]]),{editor:false});const draw=calls.find(c=>c[0]==='drawImage');assert.deepEqual(draw.slice(2,6),[32,0,32,48]);assert.ok(Math.abs(draw[8]/draw[9]-32/48)<1e-12);calls.length=0;drawElement(ctx,object,{visual:{editorOnly:true}},new Map(),{editor:false});assert.equal(calls.length,0);drawElement(ctx,object,{visual:{editorOnly:true},collision:{shape:'ellipse'}},new Map());assert.ok(calls.some(c=>c[0]==='ellipse'));});

 test('rectangle deletion uses collision shapes and excludes boundary-only contact',async()=>{
  const {intersectsRectangle}=await import('../src/appearance.mjs');const o={x:10,y:10,width:100,height:100};
  assert.equal(intersectsRectangle(o,{}, {x:0,y:0,width:10,height:10}),false);
  assert.equal(intersectsRectangle(o,{collision:{shape:'ellipse'}},{x:10,y:10,width:5,height:5}),false);
  assert.equal(intersectsRectangle(o,{collision:{shape:'ellipse'}},{x:0,y:0,width:120,height:120}),true);
  assert.equal(intersectsRectangle(o,{collision:{shape:'ellipse'}},{x:55,y:55,width:2,height:2}),true);
  const triangle={collision:{shape:'polygon',points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]}};
  assert.equal(intersectsRectangle(o,triangle,{x:90,y:90,width:5,height:5}),false);
  assert.equal(intersectsRectangle(o,triangle,{x:0,y:0,width:120,height:120}),true);
 });

test('a grid rectangle erases its interior cells without touching neighboring rows/columns',async()=>{
  const {intersectsRectangle}=await import('../src/appearance.mjs');const r={x:32,y:32,width:64,height:64},hits=[];
  for(let y=0;y<128;y+=32)for(let x=0;x<128;x+=32)if(intersectsRectangle({x,y,width:32,height:32},{},r))hits.push([x,y]);
  assert.deepEqual(hits,[[32,32],[64,32],[32,64],[64,64]]);
});

test('invisible types get stable broad colors, accurate shapes and editor-only feedback',async()=>{
  const {editorTypeColor}=await import('../src/appearance.mjs');
  const colors=['trigger','boundary','spawn','collision','zone','portal'].map(id=>editorTypeColor({id}));
  assert.ok(new Set(colors).size>=5);assert.equal(editorTypeColor({id:'trigger'}),colors[0]);assert.equal(editorTypeColor({id:'trigger',color:'#123456'}),'#123456');
  for(const shape of ['rectangle','ellipse','polygon']){
    const calls=[],ctx=new Proxy({globalAlpha:1},{get:(t,k)=>k in t?t[k]:(...a)=>calls.push([k,...a]),set:(t,k,v)=>(calls.push(['set',k,v]),t[k]=v,true)});
    const type={id:'boundary',visual:{editorOnly:true},collision:{shape,points:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]}};
    drawElement(ctx,object,type,new Map(),{editor:false});assert.equal(calls.length,0);
    drawElement(ctx,object,type,new Map(),{selected:true,labels:false});assert.ok(calls.some(c=>c[0]==='fill'));assert.ok(calls.some(c=>c[0]==='stroke'));assert.ok(calls.some(c=>c[0]==='fillText'));assert.ok(calls.some(c=>c[0]===(shape==='rectangle'?'rect':shape==='ellipse'?'ellipse':'lineTo')));assert.ok(calls.some(c=>c[0]==='set'&&c[1]==='globalAlpha'&&c[2]<1));
  }
});

test('invisible region fill, border and label share a chromatic type color',async()=>{
  const {editorTypeColor}=await import('../src/appearance.mjs');
  for(const color of ['#ffffff','#000000','#808080','#f0f1f2','#101112'])assert.equal(editorTypeColor({id:'region',color}),editorTypeColor({id:'region'}));
  for(const selected of [false,true]){
    const calls=[],ctx={globalAlpha:1,save(){this.alpha=this.globalAlpha;},restore(){this.globalAlpha=this.alpha;},beginPath(){},rect(){},setLineDash(){},fill(){calls.push(['fill',this.fillStyle,this.globalAlpha]);},stroke(){calls.push(['stroke',this.strokeStyle,this.globalAlpha]);},fillText(){calls.push(['label',this.fillStyle,this.globalAlpha]);}};
    drawElement(ctx,object,{id:'region',color:'#e050a0',visual:{editorOnly:true}},new Map(),{selected});
    assert.deepEqual(calls,[['fill','#e050a0',.5],['stroke','#e050a0',1],['label','#e050a0',1]]);
  }
});
