import {clone} from './model.mjs';
export function resizePlan(level,width,height,anchor={x:0,y:0}){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new Error('Level width and height must be finite and at least 1 pixel.');
  if(![0,.5,1].includes(anchor.x)||![0,.5,1].includes(anchor.y))throw new Error('Choose one of the nine resize anchors.');
  const dx=Math.round((width-level.width)*anchor.x),dy=Math.round((height-level.height)*anchor.y);
  return {width,height,dx,dy};
}
export function resizeLevel(level,catalog,width,height,anchor){
  const plan=resizePlan(level,width,height,anchor),next=clone(level);
  next.width=width;next.height=height;
  if(!plan.dx&&!plan.dy)return next;
  const shiftPosition=p=>({...p,x:p.x+plan.dx,y:p.y+plan.dy});
  function shiftProperties(values,definitions,camera=false){
    for(const [key,def]of Object.entries(definitions||{}))if(def.type==='position'&&(def.space==='world'||(camera&&key==='camera'))){const p=values[key]??def.default;if(p)values[key]=shiftPosition(p);}
  }
  shiftProperties(next.settings,catalog.levelProperties,true);
  if(next.settings.camera&&!catalog.levelProperties?.camera)next.settings.camera=shiftPosition(next.settings.camera);
  const types=new Map(catalog.elements.map(e=>[e.id,e]));
  for(const layer of next.layers){
    if(layer.kind==='tile')for(const tile of layer.tiles){tile.x+=plan.dx;tile.y+=plan.dy;}
    else for(const o of layer.objects){o.x+=plan.dx;o.y+=plan.dy;shiftProperties(o.properties,types.get(o.type)?.properties);}
  }
  return next;
}
