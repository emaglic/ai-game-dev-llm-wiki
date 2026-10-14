// Editor navigation/snap geometry. Tile dimensions are independent of level.grid.
export function editingGrid(level) {
  const stored=level.extensions?.editor2D?.grid;
  return {x:stored?.x??level.grid,y:stored?.y??level.grid};
}
export function snapCoordinate(value,step,enabled=true) {
  return Math.round(value/(enabled?step:1))*(enabled?step:1);
}
export function resizeEdges(object,point,tolerance) {
  if(point.x<object.x-tolerance||point.x>object.x+object.width+tolerance||point.y<object.y-tolerance||point.y>object.y+object.height+tolerance)return null;
  const edges={left:Math.abs(point.x-object.x)<=tolerance,right:Math.abs(point.x-object.x-object.width)<=tolerance,top:Math.abs(point.y-object.y)<=tolerance,bottom:Math.abs(point.y-object.y-object.height)<=tolerance};
  // Very small objects can be near both opposing edges: choose the nearest one.
  if(edges.left&&edges.right){edges.left=point.x<object.x+object.width/2;edges.right=!edges.left;}
  if(edges.top&&edges.bottom){edges.top=point.y<object.y+object.height/2;edges.bottom=!edges.top;}
  return Object.values(edges).some(Boolean)?edges:null;
}
export function resizeCursor(edges) {
  if(!edges)return 'default';
  if((edges.left&&edges.top)||(edges.right&&edges.bottom))return 'nwse-resize';
  if((edges.right&&edges.top)||(edges.left&&edges.bottom))return 'nesw-resize';
  return edges.left||edges.right?'ew-resize':'ns-resize';
}
export function resizeBounds(original,start,end,edges,grid,snapping) {
  const right=original.x+original.width,bottom=original.y+original.height;
  const dx=end.x-start.x,dy=end.y-start.y;
  let x=original.x,y=original.y,r=right,b=bottom;
  if(edges.left)x=Math.min(right-1,snapCoordinate(original.x+dx,grid.x,snapping));
  if(edges.right)r=Math.max(original.x+1,snapCoordinate(right+dx,grid.x,snapping));
  if(edges.top)y=Math.min(bottom-1,snapCoordinate(original.y+dy,grid.y,snapping));
  if(edges.bottom)b=Math.max(original.y+1,snapCoordinate(bottom+dy,grid.y,snapping));
  return {x,y,width:r-x,height:b-y};
}
