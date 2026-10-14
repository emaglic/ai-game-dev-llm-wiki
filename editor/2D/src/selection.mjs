import {resizeBounds,snapCoordinate} from './interactions.mjs';
export function resizeAnchor(edges,center=false){return {x:center ? .5 : edges.left?1:edges.right?0:.5,y:center ? .5 : edges.top?1:edges.bottom?0:.5};}
export function modifiedResize(original,start,end,edges,grid,snapping,{alt=false,shift=false}={}){
  if(!alt&&!shift)return resizeBounds(original,start,end,edges,grid,snapping);
  const anchor=resizeAnchor(edges,alt),factor=alt?2:1;
  let width=original.width,height=original.height;
  if(edges.left||edges.right){const edge=edges.left?original.x:original.x+width;const movement=snapCoordinate(edge+end.x-start.x,grid.x,snapping)-edge;width=Math.max(1,width+movement*(edges.left?-1:1)*factor);}
  if(edges.top||edges.bottom){const edge=edges.top?original.y:original.y+height;const movement=snapCoordinate(edge+end.y-start.y,grid.y,snapping)-edge;height=Math.max(1,height+movement*(edges.top?-1:1)*factor);}
  if(shift){const sx=width/original.width,sy=height/original.height,scale=(edges.left||edges.right)&&(edges.top||edges.bottom)?(Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy):(edges.left||edges.right)?sx:sy;const safe=Math.max(scale,1/original.width,1/original.height);width=Math.max(1,Math.round(original.width*safe));height=Math.max(1,Math.round(original.height*safe));}
  return {x:Math.round(original.x+(original.width-width)*anchor.x),y:Math.round(original.y+(original.height-height)*anchor.y),width,height};
}
export function handlePoints(b){return [[0,0],[.5,0],[1,0],[0,.5],[1,.5],[0,1],[.5,1],[1,1]].map(([x,y])=>({x:b.x+x*b.width,y:b.y+y*b.height,edges:{left:x===0,right:x===1,top:y===0,bottom:y===1}}));}
export function handleAt(b,pos,tolerance){return handlePoints(b).find(p=>Math.abs(p.x-pos.x)<=tolerance&&Math.abs(p.y-pos.y)<=tolerance)?.edges;}
export function drawHandles(ctx,b,zoom,color='#64dec6'){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.5/zoom;ctx.setLineDash([]);ctx.strokeRect(b.x,b.y,b.width,b.height);for(const p of handlePoints(b)){ctx.fillStyle='#182430';ctx.fillRect(p.x-4/zoom,p.y-4/zoom,8/zoom,8/zoom);ctx.strokeRect(p.x-4/zoom,p.y-4/zoom,8/zoom,8/zoom);}ctx.restore();
}
