import test from 'node:test';
import assert from 'node:assert/strict';
import {modifiedResize,resizeAnchor,handleAt} from '../src/selection.mjs';
const original={x:100,y:100,width:120,height:60},grid={x:1,y:1};
test('Alt expands symmetrically and Shift preserves the initial aspect ratio',()=>{
  const edges={right:true,bottom:true};
  assert.deepEqual(modifiedResize(original,{x:220,y:160},{x:250,y:175},edges,grid,false,{alt:true}),{x:70,y:85,width:180,height:90});
  const b=modifiedResize(original,{x:220,y:160},{x:250,y:170},edges,grid,false,{shift:true});assert.equal(b.width/b.height,2);assert.equal(b.x,100);assert.equal(b.y,100);
  const c=modifiedResize(original,{x:220,y:130},{x:250,y:130},{right:true},grid,false,{alt:true,shift:true});assert.equal(c.width/c.height,2);assert.equal(c.x+c.width/2,160);assert.equal(c.y+c.height/2,130);
});
test('Anchors, handle picking and minimum dimensions remain valid on inward drags',()=>{
  assert.deepEqual(resizeAnchor({left:true,top:true}),{x:1,y:1});assert.deepEqual(resizeAnchor({right:true},true),{x:.5,y:.5});
  assert.equal(handleAt(original,{x:220,y:130},3).right,true);assert.equal(handleAt(original,{x:160,y:130},3),undefined);
  const b=modifiedResize(original,{x:100,y:100},{x:500,y:500},{left:true,top:true},grid,false,{alt:true,shift:true});assert.ok(b.width>=1&&b.height>=1);
});
