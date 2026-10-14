import {setupWorkspace} from './workspace.mjs';
import {tileAt,eraseTiles,brushPosition,fillTiles,fillLayout} from './tiles.mjs';
import {resizePlan,resizeLevel} from './level-resize.mjs';
import {icon} from './icons.mjs';
import {drawElement,containsPoint,intersectsStroke} from './appearance.mjs';
import {clone,History,defaults,newId,paint,objects,validateProject,validateValue,serialize,tileMoveError,moveTile} from './model.mjs';
import {loadProject,saveProject,importBundle} from './io.mjs';
import {drawScene,loadImages,cameraViewport} from './render.mjs';
import {propertyPanel} from './controls.mjs';
import {editingGrid,snapCoordinate,resizeEdges,resizeCursor,resizeBounds} from './interactions.mjs';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let history,manifestURL,levelId,layerId,elementId,selected,selectedTile,images=new Map(),assetErrors=[],saved='',gesture,pick,spaceDown=false,view={x:40,y:40,zoom:1};
const expandedLayers=new Set();
let activeTool='select';
let workspace;
const toolButtons=[...document.querySelectorAll('#tools [data-tool]')];
function chooseTool(value){if(gesture)finish();activeTool=value;if(value!=='reference')pick=null;for(const b of toolButtons){const active=b.dataset.tool===(value==='reference'?'select':value);b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;} $('pickNotice').hidden=value!=='reference'||!pick;updateCursor();draw();}
for(const button of toolButtons){button.onclick=()=>chooseTool(button.dataset.tool);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=toolButtons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?toolButtons.length-1:(index+(e.key==='ArrowRight'?1:-1)+toolButtons.length)%toolButtons.length;chooseTool(toolButtons[next].dataset.tool);toolButtons[next].focus();};}
let resizeDraft,resizeAnchor={x:0,y:0};
let exampleMode=false,editorConfig={exampleURL:new URL('fixture/game.project.json',location.href).href};
const settings=$('editorSettings');
$('moreActions').onclick=()=>{$('settingsStatus').textContent='';settings.showModal();};
$('closeSettings').onclick=()=>settings.close();
settings.onkeydown=e=>{if(e.key==='Escape')e.stopPropagation();};
$('importAction').onclick=()=>$('import').click();
function isExample(url){if(!url)return false;const u=new URL(url,location.href);return u.pathname.startsWith('/editor/fixture/')||u.href===new URL(editorConfig.exampleURL,location.href).href||(editorConfig.readOnly&&editorConfig.projectURL&&u.href===new URL(editorConfig.projectURL,location.href).href);}
function activatePanelTab(tabs,tab){
  for(const button of tabs){const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;$(button.getAttribute('aria-controls')).hidden=!active;}
}
const inspectorTabs=[$('selectionTab'),$('levelTab')];
let inspectedSelection='';
for(const tabs of [[$('layersTab'),$('paletteTab')],inspectorTabs])for(const tab of tabs){
  tab.onclick=()=>activatePanelTab(tabs,tab);
  tab.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs.at(-1):tabs[1-tabs.indexOf(tab)];activatePanelTab(tabs,next);next.focus();};
}
const project=()=>history?.value,level=()=>project()?.levels[levelId],layer=()=>level()?.layers.find(l=>l.id===layerId),object=()=>level()&&objects(level()).find(o=>o.id===selected);
function status(message){$('status').textContent=message;if(settings.open)$('settingsStatus').textContent=message;}
function errors(){const list=project()?[...validateProject(project()),...assetErrors]:assetErrors;$('errors').replaceChildren(...list.map(s=>{const d=document.createElement('div');d.textContent=s;return d;}));$('save').disabled=exampleMode||!manifestURL||!project()||list.some(x=>!x.startsWith('Missing or unreadable image'));$('dirty').textContent=project()&&serialize(project())!==saved?exampleMode?'Example edits (not saved)':'Unsaved changes':'';}
function edit(fn){const p=clone(project());fn(p,p.levels[levelId]);history.commit(p);refresh();}
function setProperty(target,key,value,def){const e=validateValue(value,def,key);if(e.length){status(e.join('; '));refresh();return;}edit((p,l)=>{const vals=target==='global'?p.settings.values:target==='level'?l.settings:objects(l).find(o=>o.id===selected)?.properties;if(vals)vals[key]=value;});}
function refresh(){if(!project())return;const l=level();if(!l.layers.some(x=>x.id===layerId))layerId=l.layers[0]?.id;if(!object())selected=null;
  if(selectedTile&&!l.layers.find(x=>x.id===selectedTile.layer)?.tiles?.some(t=>t.x===selectedTile.x&&t.y===selectedTile.y))selectedTile=null;
  const selectionKey=selected?`${levelId}:object:${selected}`:selectedTile?`${levelId}:tile:${selectedTile.layer}:${selectedTile.x}:${selectedTile.y}`:'';
  if(selectionKey&&selectionKey!==inspectedSelection)activatePanelTab(inspectorTabs,$('selectionTab'));
  inspectedSelection=selectionKey;$('selectionHint').hidden=!!selectionKey;
  const grid=editingGrid(l);$('gridX').value=grid.x;$('gridY').value=grid.y;
  $('paletteLayer').textContent=layer()?`Active layer: ${layer().name||layerId}`:'Select a layer to see available elements.';
  $('levels').replaceChildren(...project().manifest.levels.map(e=>new Option(e.label||e.id,e.id)));$('levels').value=levelId;
  $('layers').replaceChildren();for(const lay of l.layers){
    const row=document.createElement('details');row.className='layer-card'+(lay.id===layerId?' active-layer':'');row.dataset.layer=lay.id;
    const key=`${levelId}/${lay.id}`;row.open=expandedLayers.has(key);
    const header=document.createElement('summary');header.tabIndex=-1;header.onclick=e=>e.preventDefault();
    const name=document.createElement('button');name.type='button';name.textContent=lay.name||lay.id;name.className='name';for(const [condition,symbol,label]of [[lay.locked,'lock','Locked'],[!lay.visible,'visibility_off','Hidden']])if(condition){const marker=icon(symbol);marker.classList.add('layer-state-marker');marker.title=label;name.append(marker);name.setAttribute('aria-label',`${lay.name||lay.id}${lay.locked?', locked':''}${!lay.visible?', hidden':''}`);}name.setAttribute('aria-pressed',String(lay.id===layerId));name.onclick=()=>{const focused=document.activeElement===name;layerId=lay.id;selected=null;selectedTile=null;refresh();if(focused)[...$('layers').children].find(r=>r.dataset.layer===lay.id)?.querySelector('.name').focus({preventScroll:true});};
    const toggle=document.createElement('button');toggle.type='button';toggle.className='layer-toggle';toggle.setAttribute('aria-controls',`layer-settings-${l.layers.indexOf(lay)}`);
    const updateToggle=()=>{toggle.textContent=row.open?'▾':'▸';toggle.setAttribute('aria-expanded',String(row.open));toggle.setAttribute('aria-label',`${row.open?'Collapse':'Expand'} ${lay.name||lay.id} settings`);};updateToggle();
    toggle.onclick=e=>{e.preventDefault();e.stopPropagation();row.open=!row.open;row.open?expandedLayers.add(key):expandedLayers.delete(key);updateToggle();};header.append(name,toggle);row.append(header);
    const controls=document.createElement('div');controls.className='layer-controls';controls.id=toggle.getAttribute('aria-controls');
    const toggles=document.createElement('div');toggles.className='layer-state-controls';for(const [prop,title]of [['visible','Visible'],['locked','Locked']]){const label=document.createElement('label');label.className='layer-state-toggle';label.title=prop==='visible'?(lay[prop]?'Hide layer':'Show layer'):(lay[prop]?'Unlock layer':'Lock layer');const check=document.createElement('input');check.type='checkbox';check.checked=lay[prop];check.setAttribute('aria-label',`${title} ${lay.id}`);check.onchange=()=>edit((p,l)=>{l.layers.find(x=>x.id===lay.id)[prop]=check.checked;});label.append(check,icon(prop==='visible'?(lay[prop]?'visibility':'visibility_off'):(lay[prop]?'lock':'lock_open')));toggles.append(label);}controls.append(toggles);
    const label=document.createElement('label');label.textContent='Opacity';const opacity=document.createElement('input');opacity.type='range';opacity.min=0;opacity.max=1;opacity.step=.1;opacity.value=lay.opacity;opacity.setAttribute('aria-label',`${lay.id} opacity`);opacity.onchange=()=>edit((p,l)=>{l.layers.find(x=>x.id===lay.id).opacity=Number(opacity.value);});label.append(opacity);controls.append(label);
    const order=document.createElement('div');order.className='row';for(const [text,delta]of [['Raise',1],['Lower',-1]]){const b=document.createElement('button');b.append(icon(delta>0?'arrow_upward':'arrow_downward'));b.title=`${text} layer`;b.setAttribute('aria-label',`${text} ${lay.id}`);b.onclick=()=>edit((p,l)=>{const i=l.layers.findIndex(x=>x.id===lay.id),j=i+delta;if(j>=0&&j<l.layers.length)[l.layers[i],l.layers[j]]=[l.layers[j],l.layers[i]];});order.append(b);}controls.append(order);row.append(controls);$('layers').append(row);
  }
  $('palette').replaceChildren();const palette=project().catalog.elements.filter(e=>e.kind===layer()?.kind);if(!palette.some(e=>e.id===elementId))elementId=palette[0]?.id;for(const e of palette){const b=document.createElement('button');const thumbnail=document.createElement('canvas');thumbnail.width=44;thumbnail.height=44;thumbnail.className='palette-thumbnail';thumbnail.setAttribute('aria-hidden','true');const size=e.size||(e.kind==='tile'?level().tileSize:{width:level().grid,height:level().grid}),context=thumbnail.getContext('2d'),scale=Math.min(40/size.width,40/size.height);context.translate((44-size.width*scale)/2,(44-size.height*scale)/2);context.scale(scale,scale);drawElement(context,{type:e.id,x:0,y:0,...size,properties:defaults(e.properties)},e,images,{editor:false});if(e.visual?.editorOnly)drawElement(context,{type:e.id,x:0,y:0,...size,properties:{}},e,images,{editor:true});b.append(thumbnail,document.createTextNode(e.label||e.id));b.style.borderLeft=`8px solid ${e.color||'#789'}`;if(e.id===elementId)b.className='active';b.onclick=()=>{elementId=e.id;chooseTool('paint');refresh();};$('palette').append(b);}
  const o=object(),t=project().catalog.elements.find(e=>e.id===o?.type);$('properties').replaceChildren();if(o){const id=document.createElement('small');id.textContent=`Stable ID: ${o.id}`;$('properties').append(id);const transform=document.createElement('div');propertyPanel(transform,{x:{type:'number'},y:{type:'number'},...(t.resizable?{width:{type:'number',min:1},height:{type:'number',min:1}}:{})},o,{project:project(),onChange:(k,v)=>{if(layer()?.locked)return; if(!Number.isFinite(v)||(['width','height'].includes(k)&&v<1)){status('Size must be positive; coordinates must be finite.');refresh();return;}edit((p,l)=>{objects(l).find(x=>x.id===selected)[k]=v;});}});$('properties').append(transform);const props=document.createElement('div');propertyPanel(props,t.properties,o.properties,{project:project(),onChange:(k,v)=>{if(!layer()?.locked)setProperty('object',k,v,t.properties[k]);},onPick:(key,def)=>{pick={level:levelId,object:o.id,key,def};chooseTool('reference');status('Choose a destination level, then click an allowed object.');}});$('properties').append(props);}
  if(selectedTile){const tile=l.layers.find(lay=>lay.id===selectedTile.layer)?.tiles?.find(t=>t.x===selectedTile.x&&t.y===selectedTile.y);if(tile)propertyPanel($('properties'),{x:{type:'integer',label:'Tile X'},y:{type:'integer',label:'Tile Y'},width:{type:'integer',label:'Tile width',min:1},height:{type:'integer',label:'Tile height',min:1}},tile,{project:project(),onChange:(key,value)=>{if(layer()?.locked)return;const d={type:'integer',...(['width','height'].includes(key)?{min:1}:{})},errors=validateValue(value,d,key);if(errors.length){status(errors.join('; '));refresh();return;}const from={x:tile.x,y:tile.y},to={...from,...(['x','y'].includes(key)?{[key]:value}:{})};const error=tileMoveError(level(),selectedTile.layer,from,to);if(error){status(error);refresh();return;}const id=selectedTile.layer;edit((p,l)=>{const target=l.layers.find(lay=>lay.id===id).tiles.find(t=>t.x===from.x&&t.y===from.y);target[key]=value;selectedTile={layer:id,...to};});}});}
  if(layer()?.locked)for(const control of $('properties').querySelectorAll('input,select,button'))control.disabled=true;
  if(!resizeDraft||resizeDraft.level!==levelId||resizeDraft.baseWidth!==l.width||resizeDraft.baseHeight!==l.height)resizeDraft={level:levelId,baseWidth:l.width,baseHeight:l.height,width:l.width,height:l.height};
  const dimensions=$('levelDimensions');dimensions.replaceChildren();
  for(const [key,labelText]of [['width','Level width'],['height','Level height']]){const label=document.createElement('label');label.className='field';label.textContent=labelText;const input=document.createElement('input');input.type='number';input.min=1;input.step=1;input.value=resizeDraft[key];input.setAttribute('aria-label',labelText);input.oninput=input.onchange=()=>{resizeDraft[key]=input.value===''?NaN:Number(input.value);updateResizePreview();};label.append(input);dimensions.append(label);}
  const label=document.createElement('p');label.className='resize-caption';label.textContent='Anchor - choose the part that stays fixed';dimensions.append(label);
  const anchors=document.createElement('div');anchors.className='resize-anchors';anchors.setAttribute('role','group');anchors.setAttribute('aria-label','Resize anchor');
  const names=['Top-left','Top-center','Top-right','Middle-left','Center','Middle-right','Bottom-left','Bottom-center','Bottom-right'];
  for(let i=0;i<9;i++){const x=(i%3)/2,y=Math.floor(i/3)/2,b=document.createElement('button');b.type='button';b.dataset.x=x;b.dataset.y=y;b.setAttribute('aria-label',names[i]+' anchor');b.title=names[i]+' stays fixed';b.onclick=()=>{resizeAnchor={x,y};updateResizePreview();};anchors.append(b);}dimensions.append(anchors);
  const preview=document.createElement('p');preview.id='resizePreview';preview.className='resize-caption';preview.setAttribute('role','status');dimensions.append(preview);
  const apply=document.createElement('button');apply.id='applyResize';apply.textContent='Apply resize';apply.onclick=()=>{try{const {width,height}=resizeDraft,anchor={...resizeAnchor};resizePlan(level(),width,height,anchor);finish();const next=resizeLevel(level(),project().catalog,width,height,anchor);selectedTile=null;resizeDraft=null;edit(p=>{p.levels[levelId]=next;});status('Level resized. Undo restores its size and all shifted content.');}catch(e){status(e.message);}};dimensions.append(apply);updateResizePreview();
  const outside=l.layers.flatMap(lay=>lay.kind==='tile'?lay.tiles:lay.objects).filter(o=>o.x<0||o.y<0||o.x+o.width>l.width||o.y+o.height>l.height).length;
  $('boundsNotice').hidden=!outside;$('boundsNotice').textContent=outside?`${outside} tile(s)/object(s) extend outside the level. Content is preserved; enlarge the level or reposition it.`:'';
  propertyPanel($('tileDefaults'),{width:{type:'integer',label:'Default tile width',min:1,help:'New tiles use this size unless their catalog defines a size.'},height:{type:'integer',label:'Default tile height',min:1}},l.tileSize,{project:project(),onChange:(key,value)=>{const errors=validateValue(value,{type:'integer',min:1},key);if(errors.length){status(errors.join('; '));refresh();return;}edit((p,l)=>{l.tileSize[key]=value;});}});
  const cameraDefs=Object.fromEntries(Object.entries(project().catalog.levelProperties).filter(([key])=>['camera','cameraZoom'].includes(key)));
  const otherDefs=Object.fromEntries(Object.entries(project().catalog.levelProperties).filter(([key])=>!['camera','cameraZoom'].includes(key)));
  propertyPanel($('cameraSettings'),cameraDefs,l.settings,{project:project(),onChange:(k,v)=>setProperty('level',k,v,cameraDefs[k])});
  $('cameraSettings').closest('.property-group').hidden=!Object.keys(cameraDefs).length;$('otherLevelGroup').hidden=!Object.keys(otherDefs).length;
  propertyPanel($('levelSettings'),otherDefs,l.settings,{project:project(),onChange:(k,v)=>setProperty('level',k,v,project().catalog.levelProperties[k])});
  propertyPanel($('globalSettings'),project().settings.properties,project().settings.values,{project:project(),onChange:(k,v)=>setProperty('global',k,v,project().settings.properties[k])});
  $('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;errors();draw();
}
function updateResizePreview(){
  const buttons=[...$('levelDimensions').querySelectorAll('.resize-anchors button')];
  buttons.forEach(b=>{const dx=Number(b.dataset.x)-resizeAnchor.x,dy=Number(b.dataset.y)-resizeAnchor.y,selected=dx===0&&dy===0;b.setAttribute('aria-pressed',String(selected));const marker=selected?document.createElement('span'):icon('arrow_upward');if(selected){marker.className='anchor-point';marker.setAttribute('aria-hidden','true');}else marker.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI+90}deg)`;b.replaceChildren(marker);});

  try{const plan=resizePlan(level(),resizeDraft.width,resizeDraft.height,resizeAnchor);$('resizePreview').textContent=`Content offset: ${plan.dx}px X, ${plan.dy}px Y. Content is preserved.`;$('applyResize').disabled=plan.width===level().width&&plan.height===level().height;}
  catch(e){$('resizePreview').textContent=e.message;$('applyResize').disabled=true;}
}
function draw(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0c141e';ctx.fillRect(0,0,r.width,r.height);if(!level())return;ctx.translate(view.x,view.y);ctx.scale(view.zoom,view.zoom);drawScene(ctx,project(),level(),images,{grid:$('grid').checked,gridSize:editingGrid(level()),selected,selectedTile,overlayOptions:workspace,cameraActive:activeTool==='camera',referenceActive:activeTool==='reference',hiddenTile:gesture?.tileMove?{layer:gesture.tileMove.layer,...gesture.tileMove.from}:null});if(gesture?.tileMove){const m=gesture.tileMove;{ctx.save();ctx.globalAlpha=layer()?.opacity??1;drawElement(ctx,{...m.tile,x:m.to.x,y:m.to.y},project().catalog.elements.find(t=>t.id===m.tile.type),images,{editor:false});ctx.globalAlpha=1;ctx.strokeStyle=tileMoveError(level(),m.layer,m.from,m.to)?'#ff8b88':'#64dec6';ctx.lineWidth=3/view.zoom;ctx.strokeRect(m.to.x,m.to.y,m.tile.width,m.tile.height);ctx.restore();}}if(gesture?.rectangle){const layout=rectangleLayout();ctx.fillStyle='#64dec622';ctx.fillRect(layout.x,layout.y,layout.width,layout.height);ctx.strokeStyle='#64dec6';ctx.lineWidth=2/view.zoom;ctx.strokeRect(layout.x,layout.y,layout.width,layout.height);}}
function rectangleLayout(){const grid=editingGrid(level()),snap=$('snap').checked;return fillLayout(brushPosition(gesture.start,grid,snap),brushPosition(gesture.end,grid,snap),brushSize());}
function fit(){if(!level())return;const r=canvas.getBoundingClientRect();view.zoom=Math.max(.05,Math.min((r.width-60)/level().width,(r.height-60)/level().height));view.x=(r.width-level().width*view.zoom)/2;view.y=(r.height-level().height*view.zoom)/2;draw();}
function world(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-view.x)/view.zoom,y:(e.clientY-r.top-view.y)/view.zoom};}
function snap(n,axis='x'){return snapCoordinate(n,editingGrid(level())[axis],$('snap').checked);}
function edgeHit(pos){if(!layer()||layer().locked||!layer().visible||layer().kind!=='object')return null;for(const o of [...layer().objects].reverse()){if(!project().catalog.elements.find(t=>t.id===o.type)?.resizable)continue;const edges=resizeEdges(o,pos,6/view.zoom);if(edges)return{object:o,edges};}return null;}
function updateCursor(pos){if(activeTool==='reference'&&pick&&!spaceDown&&!gesture?.pan){canvas.style.cursor='crosshair';return;}if(gesture?.tileMove||gesture?.cameraOriginal){canvas.style.cursor='grabbing';return;}if(spaceDown||gesture?.pan){canvas.style.cursor=gesture?.pan?'grabbing':'grab';return;}const edges=gesture?.edges||((activeTool==='select'||activeTool==='resize')&&pos?edgeHit(pos)?.edges:null);canvas.style.cursor=edges?resizeCursor(edges):'default';}
function hit(pos,all=false){for(const lay of [...level().layers].reverse()){if(lay.kind!=='object'||!lay.visible||(!all&&(lay.locked||lay.id!==layerId)))continue;for(const o of [...lay.objects].reverse())if(containsPoint(o,project().catalog.elements.find(t=>t.id===o.type),pos))return{object:o,layer:lay};}return null;}
function catalogTypes(){return new Map(project().catalog.elements.map(t=>[t.id,t]));}
function brushSize(){return project().catalog.elements.find(t=>t.id===elementId)?.size||level().tileSize;}
function applyPaint(pos){const l=layer();if(!l||l.locked||!l.visible)return;if(l.kind==='tile'){const p=brushPosition(pos,editingGrid(level()),$('snap').checked);paint(l,p.x,p.y,elementId,brushSize());}}
canvas.oncontextmenu=e=>e.preventDefault();
function eraseStroke(start,end){const active=layer();if(!active||active.locked||!active.visible)return;const types=catalogTypes();if(active.kind==='tile')eraseTiles(active,start,end,types);else active.objects=active.objects.filter(o=>!intersectsStroke(o,types.get(o.type),start,end));}
canvas.onpointerdown=e=>{
  if(!level())return;
  if(e.button===2){
    e.preventDefault();
    if(spaceDown||!layer()||layer().locked||!layer().visible)return;
    finish();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const pos=world(e);
    gesture={before:clone(project()),rightErase:true,last:pos};
    eraseStroke(pos,pos);draw();return;
  }
  if(e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const pos=world(e);if(spaceDown){gesture={pan:true,last:{x:e.clientX,y:e.clientY}};updateCursor();return;}const tool=activeTool;
  if(tool==='reference'&&!pick){status('Select an object, then use its destination property to pick a reference target.');return;}
  if(tool==='reference'&&pick){const sourceLayer=project().levels[pick.level]?.layers.find(l=>l.kind==='object'&&l.objects.some(o=>o.id===pick.object));if(!sourceLayer||sourceLayer.locked){status('Reference source is missing or its layer is locked.');pick=null;chooseTool('select');return;}const h=hit(pos,true);if(h&&(!pick.def.targets?.length||pick.def.targets.includes(h.object.type))){const destination={level:levelId,object:h.object.id};edit(p=>{const source=objects(p.levels[pick.level]).find(o=>o.id===pick.object);if(source)source.properties[pick.key]={...(source.properties[pick.key]||{}),...destination};});pick=null;chooseTool('select');status('Reference updated.');}return;}
  if(tool==='camera'){
    const definition=project().catalog.levelProperties.camera;
    if(definition?.type!=='position'){status('Catalog does not declare a camera position.');return;}
    const original=level().settings.camera??definition.default;
    if(!original){status('Set a camera center in Level settings first.');return;}
    const cameraSettings={...level().settings,camera:original,cameraZoom:level().settings.cameraZoom??project().catalog.levelProperties.cameraZoom?.default??1},bounds=cameraViewport(cameraSettings,project().settings.viewport);
    if(pos.x<bounds.x||pos.x>bounds.x+bounds.width||pos.y<bounds.y||pos.y>bounds.y+bounds.height){status('Drag inside the gold camera viewport to move it.');return;}
    gesture={before:clone(project()),start:pos,cameraOriginal:clone(original)};selected=null;selectedTile=null;updateCursor(pos);return;
  }
  if(!layer()||layer().locked||!layer().visible)return;
  if(tool==='select'||tool==='resize'){
    selectedTile=null;
    if(layer().kind==='tile'){selected=null;const tile=tileAt(layer(),pos,catalogTypes());if(tile){activatePanelTab(inspectorTabs,$('selectionTab'));const {x,y}=tile;selectedTile={layer:layerId,x,y};if(tool==='select')gesture={before:clone(project()),start:pos,tileMove:{layer:layerId,from:{x,y},to:{x,y},tile:clone(tile)}};}refresh();return;}
    const edge=edgeHit(pos),h=edge||hit(pos);selected=h?.object.id||null;
    if(h){activatePanelTab(inspectorTabs,$('selectionTab'));const resizable=project().catalog.elements.find(t=>t.id===h.object.type)?.resizable;const edges=edge?.edges||(tool==='resize'&&resizable?{right:true,bottom:true}:null);gesture={before:clone(project()),start:pos,original:clone(h.object),edges};if(tool==='resize'&&!resizable){gesture=null;status('This object type does not allow resizing.');}}
    refresh();updateCursor(pos);return;
  }
  if(tool==='rectangle'){if(layer().kind!=='tile')return;gesture={before:clone(project()),start:pos,end:pos,rectangle:true};return;}
  gesture={before:clone(project()),paint:true};
  if(layer().kind==='object'&&tool==='paint'){const t=project().catalog.elements.find(e=>e.id===elementId);if(!t)return;const o={id:newId(),type:t.id,x:snap(pos.x,'x'),y:snap(pos.y,'y'),width:t.size?.width||level().grid,height:t.size?.height||level().grid,properties:defaults(t.properties)};layer().objects.push(o);selected=o.id;selectedTile=null;gesture.paint=false;}else applyPaint(pos);draw();
};
canvas.onpointermove=e=>{const pos=level()?world(e):null;updateCursor(pos);if(!gesture)return;if(gesture.pan){view.x+=e.clientX-gesture.last.x;view.y+=e.clientY-gesture.last.y;gesture.last={x:e.clientX,y:e.clientY};draw();return;}if(gesture.cameraOriginal){updateCameraDrag(pos);}else if(gesture.tileMove){updateTileDrag(pos);}else if(gesture.rightErase){eraseStroke(gesture.last,pos);gesture.last=pos;}else if(gesture.rectangle)gesture.end=pos;else if(gesture.original){const o=object();if(!o)return;if(gesture.edges)Object.assign(o,resizeBounds(gesture.original,gesture.start,pos,gesture.edges,editingGrid(level()),$('snap').checked));else{o.x=snap(gesture.original.x+pos.x-gesture.start.x,'x');o.y=snap(gesture.original.y+pos.y-gesture.start.y,'y');}}else if(gesture.paint)applyPaint(pos);draw();};
function updateCameraDrag(pos){if(!gesture.cameraMoved&&Math.hypot(pos.x-gesture.start.x,pos.y-gesture.start.y)*view.zoom<3)return;gesture.cameraMoved=true;const original=gesture.cameraOriginal;level().settings.camera={...original,x:snap(original.x+pos.x-gesture.start.x,'x'),y:snap(original.y+pos.y-gesture.start.y,'y')};}
function updateTileDrag(pos){const m=gesture.tileMove;if(!m.moved&&Math.hypot(pos.x-gesture.start.x,pos.y-gesture.start.y)*view.zoom<3)return;m.moved=true;m.to={x:snap(m.from.x+pos.x-gesture.start.x,'x'),y:snap(m.from.y+pos.y-gesture.start.y,'y')};}
function finish(cancel=false){if(!gesture)return;if(gesture.before){if(cancel)history.value=gesture.before;else{if(gesture.tileMove){const m=gesture.tileMove,error=moveTile(level(),m.layer,m.from,m.to);if(error)status(error);else selectedTile={layer:m.layer,...m.to};}if(gesture.rectangle){const a=brushPosition(gesture.start,editingGrid(level()),$('snap').checked),b=brushPosition(gesture.end,editingGrid(level()),$('snap').checked);fillTiles(layer(),a,b,brushSize(),elementId,paint);}const next=clone(project());history.value=gesture.before;history.commit(next);}}gesture=null;refresh();}
canvas.onpointerup=e=>{if(gesture?.rectangle)gesture.end=world(e);if(gesture?.cameraOriginal)updateCameraDrag(world(e));if(gesture?.tileMove)updateTileDrag(world(e));if(gesture?.rightErase){eraseStroke(gesture.last,world(e));status('Erased targets on the active layer. Undo restores the entire stroke.');}finish();};canvas.onpointercancel=()=>finish(true);canvas.onlostpointercapture=()=>finish(true);
canvas.onwheel=e=>{e.preventDefault();const p=world(e),r=canvas.getBoundingClientRect();view.zoom=Math.max(.05,Math.min(12,view.zoom*Math.exp(-e.deltaY*.001)));view.x=e.clientX-r.left-p.x*view.zoom;view.y=e.clientY-r.top-p.y*view.zoom;draw();};
function deleteSelected(){
  if(!layer()||layer().locked||!layer().visible)return;
  finish();
  if(selectedTile&&selectedTile.layer===layerId){const tile={...selectedTile};edit((p,l)=>paint(l.layers.find(x=>x.id===tile.layer),tile.x,tile.y,null));status('Deleted selected tile.');return;}
  if(!object())return;
  edit((p,l)=>{const lay=l.layers.find(x=>x.id===layerId&&x.kind==='object');if(lay&&!lay.locked)lay.objects=lay.objects.filter(o=>o.id!==selected);});status('Deleted object. Any broken references are listed below.');
}
$('undo').onclick=()=>{finish();history?.undo();refresh();};$('redo').onclick=()=>{finish();history?.redo();refresh();};$('fit').onclick=fit;
$('levels').onchange=()=>{const next=$('levels').value;finish();levelId=next;layerId=level().layers[0]?.id;selected=null;selectedTile=null;refresh();fit();};
for(const [id,axis]of [['gridX','x'],['gridY','y']])$(id).onchange=()=>{if(!level())return;const value=Number($(id).value);if(!Number.isInteger(value)||value<1){status('Grid sizes must be positive whole pixels.');refresh();return;}finish();edit((p,l)=>{l.extensions??={};l.extensions.editor2D??={};l.extensions.editor2D.grid={...(l.extensions.editor2D.grid||{}),...editingGrid(l),[axis]:value};});};
for(const [id,kind]of [['addTile','tile'],['addObject','object']])$(id).onclick=()=>{if(!project())return;const name=prompt('Layer name',`${kind} layer`);if(!name)return;const id=newId('layer');edit((p,l)=>l.layers.push({id,name,kind,visible:true,locked:false,opacity:1,[kind==='tile'?'tiles':'objects']:[]}));layerId=id;refresh();};
async function install(p,url){inspectedSelection='';activatePanelTab(inspectorTabs,$('levelTab'));resizeDraft=null;resizeAnchor={x:0,y:0};exampleMode=isExample(url);$('noProject').hidden=true;$('levels').disabled=false;$('export').disabled=false;$('preview').hidden=!url;$('projectMode').hidden=!exampleMode;$('projectMode').textContent=exampleMode?'Example project - changes will not be saved':'';$('settingsProjectNote').textContent=exampleMode?'This is the example project. Saving its files is disabled.':url?'Saving writes to the project selected by the local server.':'Imported bundle. Export it to preserve changes; load a manifest for server-backed saving.';history=new History(p);manifestURL=url;levelId=p.manifest.levels[0].id;layerId=level().layers[0]?.id;selected=null;selectedTile=null;pick=null;spaceDown=false;expandedLayers.clear();assetErrors=[];images=new Map();saved=serialize(p);$('manifest').value=url||'';$('preview').href=`preview.html?project=${encodeURIComponent(url||'')}`;refresh();fit();if(url)images=await loadImages(p,url,e=>assetErrors.push(e));refresh();}
$('load').onclick=async()=>{if(project()&&serialize(project())!==saved&&!confirm('Discard unsaved changes?'))return;try{const loaded=await loadProject($('manifest').value);await install(loaded.project,loaded.manifestURL);status(exampleMode?'Example project loaded. Changes will not be saved.':'Project loaded.');if(settings.open)settings.close();}catch(e){status(e.message);}};
$('save').onclick=async()=>{try{if(exampleMode)throw new Error('Example project is read-only; changes cannot be saved.');finish();if(!manifestURL)throw new Error('Imported bundle has no disk destination. Load a server project before saving, or export the bundle.');const result=await saveProject(project(),manifestURL);saved=serialize(project());errors();status(`Saved ${result.files} files. Reload the runtime preview to see changes.`);}catch(e){status(e.message);}};
$('export').onclick=()=>{if(!project())return;finish();const blob=new Blob([serialize(project())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='project.bundle.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Bundle exported, including extension data.');};
$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(project()&&serialize(project())!==saved&&!confirm('Discard unsaved changes?'))return;try{await install(importBundle(await f.text()),null);status('Bundle imported. Export to save; assets need an HTTP manifest to resolve.');}catch(err){status(err.message);}e.target.value='';};
window.addEventListener('keydown',e=>{
  if(settings.open)return;
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;
  if(e.code==='Space'){e.preventDefault();if(!spaceDown&&gesture&&!gesture.pan)finish(true);spaceDown=true;updateCursor();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();finish();e.shiftKey?history?.redo():history?.undo();refresh();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}
  if(e.key==='Escape'){finish(true);pick=null;chooseTool('select');}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;updateCursor();}});
window.addEventListener('blur',()=>{spaceDown=false;finish(true);updateCursor();});
window.addEventListener('beforeunload',e=>{if(!exampleMode&&project()&&serialize(project())!==saved){e.preventDefault();e.returnValue='';}});
new ResizeObserver(draw).observe($('surface'));
$('loadExample').onclick=()=>{$('manifest').value=editorConfig.exampleURL;$('load').click();};
async function startEditor(){
  const requested=new URLSearchParams(location.search).get('project');
  try{const response=await fetch('/api/editor-config',{cache:'no-store'});if(response.ok)editorConfig=await response.json();}catch{/* Static server fallback below. */}
  let url=requested||editorConfig.projectURL;
  if(!url&&!Object.hasOwn(editorConfig,'projectURL')){const candidate=new URL('../../game/game.project.json',location.href).href;try{const r=await fetch(candidate,{cache:'no-store'});if(r.ok)url=candidate;}catch{}}
  if(url&&!isExample(url)){$('manifest').value=url;$('load').click();}
  else{$('noProject').hidden=false;status('No game project found. Load the example to explore the editor.');}
}
$('cancelPick').onclick=()=>chooseTool('select');
workspace=setupWorkspace(draw);
errors();startEditor();
