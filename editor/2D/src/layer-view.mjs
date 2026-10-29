import {containsPoint} from './appearance.mjs';
// Temporary view state: authored visibility is never modified.
export class LayerView {
  solo = null;
  level = null;
  reset(){this.solo=null;this.level=null;}
  sync(level){if(this.level!==level.id){this.solo=null;this.level=level.id;}if(this.solo&&!level.layers.some(l=>l.id===this.solo))this.solo=null;}
  toggle(level,id){this.sync(level);if(level.layers.some(l=>l.id===id))this.solo=this.solo===id?null:id;}
  visible(layer){return !!layer&&(this.solo?layer.id===this.solo:layer.visible);}
}

// Array order matches drawing: later layers and records are frontmost.
export function topmostElement(level,point,types,{visible=l=>l.visible,pointForLayer=p=>p}={}){
  for(const layer of [...level.layers].reverse()){
    if(layer.locked||!visible(layer))continue;
    const local=pointForLayer(point,layer);
    for(const element of [...(layer.kind==='tile'?layer.tiles:layer.objects)].reverse()){
      if(containsPoint(element,types.get(element.type),local))return {layer,element};
    }
  }
  return null;
}
