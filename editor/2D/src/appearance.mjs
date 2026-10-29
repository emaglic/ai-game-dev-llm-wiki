// Declarative art and collision bounds, shared by editor and fixture runtime.
export function validateAppearance(type,path='element'){
  const errors=[],plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),bad=(key,message)=>errors.push(`${path}.${key}: ${message}`);
  const visual=type.visual;if(visual!==undefined){if(!plain(visual))bad('visual','expected object');else{
    if(visual.asset!==undefined&&(typeof visual.asset!=='string'||!visual.asset))bad('visual.asset','expected asset filename');
    if(visual.fit!==undefined&&!['contain','stretch'].includes(visual.fit))bad('visual.fit','expected contain or stretch');
    if(visual.editorOnly!==undefined&&typeof visual.editorOnly!=='boolean')bad('visual.editorOnly','expected boolean');
    if(visual.bounds!==undefined){const b=visual.bounds;if(!plain(b)||['x','y','width','height'].some(k=>!Number.isFinite(b[k]))||b.width<=0||b.height<=0)bad('visual.bounds','expected finite normalized art bounds with positive size');}
    if(visual.frame!==undefined){const f=visual.frame;if(!plain(f))bad('visual.frame','expected source rectangle');else for(const k of ['x','y','width','height'])if(!Number.isInteger(f[k])||f[k]<(k==='x'||k==='y'?0:1))bad(`visual.frame.${k}`,'expected integer source pixels');if(!visual.asset&&!type.asset)bad('visual.frame','requires visual.asset or asset');}
  }}
  const collision=type.collision;if(collision!==undefined){if(!plain(collision))bad('collision','expected object');else{
    if(!['rectangle','ellipse','polygon'].includes(collision.shape))bad('collision.shape','unsupported collision shape');
    if(collision.shape==='polygon'&&(!Array.isArray(collision.points)||collision.points.length<3||collision.points.some(p=>!plain(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)))bad('collision.points','expected at least three normalized {x,y} points in 0..1');
  }}return errors;
}
export function collisionPath(ctx,o,type){
  ctx.beginPath();const shape=type?.collision?.shape||'rectangle';
  if(shape==='ellipse')ctx.ellipse(o.x+o.width/2,o.y+o.height/2,o.width/2,o.height/2,0,0,Math.PI*2);
  else if(shape==='polygon'){const points=type.collision.points;points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](o.x+p.x*o.width,o.y+p.y*o.height));ctx.closePath();}
  else ctx.rect(o.x,o.y,o.width,o.height);
}
export function containsPoint(o,type,p){
  const x=(p.x-o.x)/o.width,y=(p.y-o.y)/o.height;
  if(x<0||x>1||y<0||y>1)return false;
  if(type?.collision?.shape==='ellipse')return ((x-.5)*2)**2+((y-.5)*2)**2<=1;
  if(type?.collision?.shape==='polygon'){const points=type.collision.points;let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j],cross=(x-a.x)*(b.y-a.y)-(y-a.y)*(b.x-a.x);if(Math.abs(cross)<1e-9&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x)&&y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y))return true;if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
  return true;
}
export function frameError(type,image){const f=type.visual?.frame;if(f&&(f.x+f.width>image.naturalWidth||f.y+f.height>image.naturalHeight))return `${type.id}: sprite frame exceeds image dimensions`;return null;}
export function intersectsStroke(o,type,start,end){
  if(containsPoint(o,type,start)||containsPoint(o,type,end))return true;
  const a={x:(start.x-o.x)/o.width,y:(start.y-o.y)/o.height},b={x:(end.x-o.x)/o.width,y:(end.y-o.y)/o.height};
  if(type?.collision?.shape==='ellipse'){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((.5-a.x)*dx+(.5-a.y)*dy)/length)):0;return (a.x+t*dx-.5)**2+(a.y+t*dy-.5)**2<=.25;}
  const points=type?.collision?.shape==='polygon'?type.collision.points:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  for(let i=0;i<points.length;i++){const c=points[i],d=points[(i+1)%points.length];if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))continue;if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return true;}
  return false;
}
export function intersectsRectangle(o,type,r){
  // Mere contact with the selection boundary must not erase adjacent grid cells.
  if(o.x>=r.x+r.width||o.x+o.width<=r.x||o.y>=r.y+r.height||o.y+o.height<=r.y)return false;
  const epsilon=1e-7;r={x:r.x+epsilon,y:r.y+epsilon,width:r.width-2*epsilon,height:r.height-2*epsilon};
  const inside=p=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
  const corners=[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
  if(corners.some(p=>containsPoint(o,type,p)))return true;
  if(corners.some((p,i)=>intersectsStroke(o,type,p,corners[(i+1)%4])))return true;
  if(type?.collision?.shape==='ellipse')return inside({x:o.x+o.width/2,y:o.y+o.height/2});
  const points=type?.collision?.shape==='polygon'?type.collision.points:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  return points.some(p=>inside({x:o.x+p.x*o.width,y:o.y+p.y*o.height}));
}
// Stable type identity, independent of catalog order, render count, or level.
export function editorTypeColor(type){
  // Catalog colors are #rrggbb. Neutral/near-neutral colors lose region identity.
  if(/^#[0-9a-f]{6}$/i.test(type?.color||'')){
    const rgb=type.color.slice(1).match(/../g).map(v=>parseInt(v,16));
    if(Math.max(...rgb)-Math.min(...rgb)>=32)return type.color;
  }
  let hash=2166136261;for(const char of type?.id||'unknown')hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return `hsl(${hash%360} 72% 64%)`;
}
export function drawElement(ctx,o,type,images,{editor=true,selected=false,labels=true}={}){
  if(type?.visual?.editorOnly&&!editor)return;
  const region=type?.visual?.editorOnly,color=region?editorTypeColor(type):o.properties?.tint||type?.color||'#ff00ff';
  const asset=o.properties?.sprite||type?.visual?.asset||type?.asset,image=images.get(asset),frame=type?.visual?.frame;
  const validImage=image&&!frameError(type||{},image);
  if(validImage){
    const f=frame||{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
    const bounds=type?.visual?.bounds||{x:0,y:0,width:1,height:1},box={x:o.x+bounds.x*o.width,y:o.y+bounds.y*o.height,width:o.width*bounds.width,height:o.height*bounds.height};
    let w=box.width,h=box.height;if(type?.visual?.fit!=='stretch'){const scale=Math.min(w/f.width,h/f.height);w=f.width*scale;h=f.height*scale;}
    ctx.imageSmoothingEnabled=false;ctx.drawImage(image,f.x,f.y,f.width,f.height,box.x+(box.width-w)/2,box.y+(box.height-h)/2,w,h);
  }else{
    ctx.save();collisionPath(ctx,o,type);ctx.fillStyle=color;if(region)ctx.globalAlpha*=.5;ctx.fill('evenodd');ctx.restore();
  }
  if(editor&&region&&validImage){ctx.save();collisionPath(ctx,o,type);ctx.fillStyle=color;ctx.globalAlpha*=.5;ctx.fill('evenodd');ctx.restore();}
  if(editor&&(!validImage||selected||region)){
    collisionPath(ctx,o,type);ctx.strokeStyle=region?color:selected?'#fff':type?.color||'#92b4d0';ctx.lineWidth=selected?2:1;ctx.setLineDash(type?.visual?.editorOnly?[5,3]:[]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=region?color:'#fff';ctx.font='11px system-ui';if(labels||selected)ctx.fillText(type?.label||o.type,o.x+3,o.y+13);
  }
}
