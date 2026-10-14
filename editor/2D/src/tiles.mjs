import {containsPoint,intersectsStroke} from './appearance.mjs';
export function tileAt(layer,point,types){return [...layer.tiles].reverse().find(t=>containsPoint(t,types.get(t.type),point));}
export function eraseTiles(layer,start,end,types){layer.tiles=layer.tiles.filter(t=>!intersectsStroke(t,types.get(t.type),start,end));}
export function brushPosition(point,grid,snap){return {x:Math.round(snap?Math.floor(point.x/grid.x)*grid.x:point.x),y:Math.round(snap?Math.floor(point.y/grid.y)*grid.y:point.y)};}
export function fillLayout(start,end,size){const x=Math.min(start.x,end.x),y=Math.min(start.y,end.y),columns=Math.floor(Math.abs(end.x-start.x)/size.width)+1,rows=Math.floor(Math.abs(end.y-start.y)/size.height)+1;return {x,y,columns,rows,width:columns*size.width,height:rows*size.height};}
export function fillTiles(layer,start,end,size,type,paint){const layout=fillLayout(start,end,size);for(let row=0;row<layout.rows;row++)for(let column=0;column<layout.columns;column++)paint(layer,layout.x+column*size.width,layout.y+row*size.height,type,size);}
