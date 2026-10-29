// Temporary view state: authored visibility is never modified.
export class LayerView {
  solo = null;
  level = null;
  reset(){this.solo=null;this.level=null;}
  sync(level){if(this.level!==level.id){this.solo=null;this.level=level.id;}if(this.solo&&!level.layers.some(l=>l.id===this.solo))this.solo=null;}
  toggle(level,id){this.sync(level);if(level.layers.some(l=>l.id===id))this.solo=this.solo===id?null:id;}
  visible(layer){return !!layer&&(this.solo?layer.id===this.solo:layer.visible);}
}
