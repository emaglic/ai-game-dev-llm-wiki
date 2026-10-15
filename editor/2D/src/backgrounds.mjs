// Shared coordinate/rendering contract for non-colliding Background layers.
export const backgroundTypes=[
  {id:'background-image',kind:'background',label:'Image',resizable:true,color:'#829bae',size:{width:256,height:256},properties:{asset:{type:'asset',label:'Image',default:''},scaleX:{type:'number',label:'Scale X',default:1,min:.001,step:.1},scaleY:{type:'number',label:'Scale Y',default:1,min:.001,step:.1},flipX:{type:'boolean',label:'Flip horizontal',default:false},flipY:{type:'boolean',label:'Flip vertical',default:false},repeat:{type:'boolean',label:'Repeat',default:false}}},
  {id:'background-color',kind:'background',label:'Color',resizable:true,color:'#829bae',size:{width:256,height:256},properties:{color:{type:'color',label:'Color',default:'#334d62'}}}
];
export function backgroundOffset(layer,cameraOrigin){const p=layer.parallax||{x:1,y:1};return{x:(1-p.x)*cameraOrigin.x,y:(1-p.y)*cameraOrigin.y};}
export function shiftedBackground(o,offset){return {...o,x:o.x+offset.x,y:o.y+offset.y};}
export function drawBackground(ctx,o,images,{editor=false,selected=false}={}){
  const p=o.properties||{};ctx.save();ctx.beginPath();ctx.rect(o.x,o.y,o.width,o.height);ctx.clip();
  if(o.type==='background-color'){ctx.fillStyle=p.color||'#334d62';ctx.fillRect(o.x,o.y,o.width,o.height);}
  else {const image=images.get(p.asset);if(image){const f=p.frame||{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
    // Build one source-sized, flipped stamp; pattern transforms scale it without allocating scaled images.
    const key=[p.asset,f.x,f.y,f.width,f.height,!!p.flipX,!!p.flipY].join('|');let cached=stamps.get(image);if(!cached){cached=new Map();stamps.set(image,cached);}let stamp=cached.get(key);
    if(f.x<0||f.y<0||f.x+f.width>image.naturalWidth||f.y+f.height>image.naturalHeight){ctx.restore();return;}
    if(!p.frame&&!p.flipX&&!p.flipY)stamp=image;
    if(!stamp){stamp=document.createElement('canvas');stamp.width=f.width;stamp.height=f.height;const c=stamp.getContext('2d');c.translate(p.flipX?f.width:0,p.flipY?f.height:0);c.scale(p.flipX?-1:1,p.flipY?-1:1);c.drawImage(image,f.x,f.y,f.width,f.height,0,0,f.width,f.height);if([...cached.values()].reduce((sum,c)=>sum+c.width*c.height,0)+stamp.width*stamp.height>16777216)cached.clear();cached.set(key,stamp);}
    const sx=p.scaleX??1,sy=p.scaleY??1;
    if(p.repeat){const pattern=ctx.createPattern(stamp,'repeat');pattern.setTransform(new DOMMatrix().translate(o.x,o.y).scale(sx,sy));ctx.fillStyle=pattern;ctx.fillRect(o.x,o.y,o.width,o.height);}
    else ctx.drawImage(stamp,o.x,o.y,f.width*sx,f.height*sy);
  }else if(editor){ctx.fillStyle='#829bae33';ctx.fillRect(o.x,o.y,o.width,o.height);}}
  ctx.restore();if(editor&&(selected||!images.get(p.asset)&&o.type==='background-image')){ctx.strokeStyle=selected?'#fff':'#829bae';ctx.strokeRect(o.x,o.y,o.width,o.height);}
}
const stamps=new WeakMap();
export function backgroundErrors(o,path='background'){
  const errors=[],p=o.properties;if(!p||typeof p!=='object'||Array.isArray(p))return [`${path}: expected properties`];
  if(!['background-image','background-color'].includes(o.type))errors.push(`${path}: unknown background type`);
  if(p.color!==undefined&&(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color)))errors.push(`${path}.color: expected #rrggbb`);
  {
    if(p.asset!==undefined&&typeof p.asset!=='string')errors.push(`${path}.asset: expected filename`);
    for(const k of ['scaleX','scaleY'])if(p[k]!==undefined&&(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<.001))errors.push(`${path}.${k}: expected scale >= 0.001`);
    for(const k of ['repeat','flipX','flipY'])if(p[k]!==undefined&&typeof p[k]!=='boolean')errors.push(`${path}.${k}: expected boolean`);
    if(p.frame!==undefined)for(const k of ['x','y','width','height'])if(!Number.isInteger(p.frame?.[k])||p.frame[k]<(k==='x'||k==='y'?0:1))errors.push(`${path}.frame.${k}: invalid source pixel rectangle`);
  }
  return errors;
}
