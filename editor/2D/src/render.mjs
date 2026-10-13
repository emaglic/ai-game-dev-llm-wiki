import {drawElement,frameError} from './appearance.mjs';
import {objects} from './model.mjs';
export function cameraViewport(settings,viewport){const c=settings.camera||{x:0,y:0},z=settings.cameraZoom??1;return{x:c.x-viewport.width/z/2,y:c.y-viewport.height/z/2,width:viewport.width/z,height:viewport.height/z};}
export function drawScene(ctx,project,level,images,{grid=false,gridSize={x:level.grid,y:level.grid},selected=null,selectedTile=null,hiddenTile=null,overlays=true}={}){
  const types=new Map(project.catalog.elements.map(e=>[e.id,e]));
  ctx.fillStyle=level.settings.background||'#14202c';ctx.fillRect(0,0,level.width,level.height);
  const shape=(o,t)=>drawElement(ctx,o,t,images,{editor:overlays,selected:o.id===selected});
  for(const l of level.layers){if(!l.visible)continue;ctx.save();ctx.globalAlpha=l.opacity;
    if(l.kind==='tile')for(const t of l.tiles){if(hiddenTile?.layer===l.id&&hiddenTile.x===t.x&&hiddenTile.y===t.y)continue;shape(t,types.get(t.type));if(selectedTile?.layer===l.id&&selectedTile.x===t.x&&selectedTile.y===t.y){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(t.x,t.y,t.width,t.height);}}
    else for(const o of l.objects){const t=types.get(o.type);shape(o,t);
      if(overlays)for(const [key,d]of Object.entries(t?.properties||{})){const v=o.properties[key]??d.default;if(!d.overlay||v===undefined||v===null)continue;ctx.strokeStyle=d.overlay.color||'#a2fff0';ctx.lineWidth=2;ctx.setLineDash([5,4]);const cx=o.x+o.width/2,cy=o.y+o.height/2;
        if(d.overlay.kind==='radius'&&typeof v==='number'){ctx.beginPath();ctx.arc(cx,cy,Math.max(0,v),0,Math.PI*2);ctx.stroke();}
        if(d.overlay.kind==='box'&&v&&typeof v.x==='number'){ctx.strokeRect(v.x,v.y,d.overlay.width||level.grid,d.overlay.height||level.grid);}
        if(d.overlay.kind==='connection'&&v?.object){const target=project.levels[v.level]&&objects(project.levels[v.level]).find(x=>x.id===v.object);if(target&&v.level===level.id){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(target.x+target.width/2,target.y+target.height/2);ctx.stroke();}else{ctx.fillStyle=target?'#a2fff0':'#ff8b88';ctx.fillText(`${target?'→':'Broken →'} ${v.level}/${v.object}`,cx,cy-10);}}
        ctx.setLineDash([]);
      }
    }ctx.restore();
  }
  if(grid){ctx.strokeStyle='#ffffff20';ctx.lineWidth=.5;ctx.beginPath();for(let x=0;x<=level.width;x+=gridSize.x){ctx.moveTo(x,0);ctx.lineTo(x,level.height);}for(let y=0;y<=level.height;y+=gridSize.y){ctx.moveTo(0,y);ctx.lineTo(level.width,y);}ctx.stroke();}
  ctx.strokeStyle='#6d91ac';ctx.lineWidth=2;ctx.strokeRect(0,0,level.width,level.height);
  if(overlays&&level.settings.camera&&level.settings.cameraZoom){const r=cameraViewport(level.settings,project.settings.viewport);ctx.strokeStyle='#ffdf85';ctx.lineWidth=2;ctx.setLineDash([10,5]);ctx.strokeRect(r.x,r.y,r.width,r.height);ctx.setLineDash([]);ctx.fillStyle='#ffdf85';ctx.fillText('Game camera viewport',r.x+4,r.y-6);}
}
export async function loadImages(project,manifestURL,onError){const images=new Map();const files=new Set([...(project.manifest.assetFiles||[]),...project.catalog.elements.flatMap(e=>[e.asset,e.visual?.asset]).filter(Boolean)]);await Promise.all([...files].map(async file=>{const url=new URL(file,new URL(project.manifest.assets,manifestURL));try{const image=new Image();image.src=url.href;await image.decode();images.set(file,image);}catch{onError(`Missing or unreadable image: ${url.href}`);}}));for(const type of project.catalog.elements){const image=images.get(type.visual?.asset||type.asset);if(image){const error=frameError(type,image);if(error)onError(error);}}return images;}
