import {containsPoint,intersectsStroke} from './appearance.mjs';
export function tileAt(layer,point,types){return [...layer.tiles].reverse().find(t=>containsPoint(t,types.get(t.type),point));}
export function eraseTiles(layer,start,end,types){layer.tiles=layer.tiles.filter(t=>!intersectsStroke(t,types.get(t.type),start,end));}
export function brushPosition(point,grid,snap){return {x:Math.round(snap?Math.floor(point.x/grid.x)*grid.x:point.x),y:Math.round(snap?Math.floor(point.y/grid.y)*grid.y:point.y)};}
export function fillTiles(layer,start,end,size,type,paint){const left=Math.min(start.x,end.x),top=Math.min(start.y,end.y),right=Math.max(start.x,end.x),bottom=Math.max(start.y,end.y);for(let y=top;y<=bottom;y+=size.height)for(let x=left;x<=right;x+=size.width)paint(layer,x,y,type,size);}
