import {LayerView,topmostElement} from './layer-view.mjs';
import {backgroundTypes,backgroundOffset,shiftedBackground} from './backgrounds.mjs';
import {modifiedResize,resizeAnchor as gestureAnchor,handleAt,drawHandles} from './selection.mjs';
import {setupMenus} from './menus.mjs';
import {setupWorkspace} from './workspace.mjs';
import {tileAt,eraseTiles,brushPosition,fillTiles,fillLayout} from './tiles.mjs';
import {resizePlan,resizeLevel} from './level-resize.mjs';
import {icon} from './icons.mjs';
import {drawElement,containsPoint,intersectsStroke,intersectsRectangle} from './appearance.mjs';
import {clone,History,defaults,newId,paint,objects,validateProject,validateValue,serialize,tileMoveError,moveTile} from './model.mjs';
import {loadProject,saveProject,importBundle} from './io.mjs';
import {drawScene,loadImages,cameraViewport} from './render.mjs';
import {propertyPanel,compactFieldPairs} from './controls.mjs';
import {editingGrid,snapCoordinate,resizeEdges,resizeCursor} from './interactions.mjs';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
let history,manifestURL,levelId,layerId,elementId,selected,selectedTile,images=new Map(),assetErrors=[],saved='',gesture,pick,spaceDown=false,view={x:40,y:40,zoom:1};
const expandedLayers=new Set();
const layerView=new LayerView();
const visible=lay=>layerView.visible(lay);
let activeTool='select';
let backgroundScaleLinked=true;
let workspace,selectedTarget=null,linkedGridBase=null,hoveredLayer=null;
const toolButtons=[...document.querySelectorAll('#tools [data-tool]')];
function chooseTool(value){if(gesture)finish();activeTool=value;if(value!=='reference')pick=null;for(const b of toolButtons){const active=b.dataset.tool===(value==='reference'?'select':value);b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;} $('pickNotice').hidden=value!=='reference'||!pick;updateCursor();draw();}
for(const button of toolButtons){button.onclick=()=>chooseTool(button.dataset.tool);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=toolButtons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?toolButtons.length-1:(index+(e.key==='ArrowRight'?1:-1)+toolButtons.length)%toolButtons.length;chooseTool(toolButtons[next].dataset.tool);toolButtons[next].focus();};}
let resizeDraft,resizeAnchor={x:0,y:0};
let exampleMode=false,editorConfig={exampleURL:new URL('fixture/game.project.json',location.href).href};
const renameDialog=$('renameLayerDialog');let renameTarget;
function focusLayerName(id){[...$('layers').children].find(row=>row.dataset.layer===id)?.querySelector('.name').focus({preventScroll:true});}
function openRename(id){finish();const lay=level()?.layers.find(l=>l.id===id);if(!lay)return;renameTarget={level:levelId,id};$('layerName').value=lay.name||lay.id;$('renameError').textContent='';$('layerName').removeAttribute('aria-invalid');renameDialog.showModal();$('layerName').focus();$('layerName').select();}
$('renameLayerForm').onsubmit=e=>{e.preventDefault();const name=$('layerName').value.trim();if(!name){$('renameError').textContent='Enter a layer name.';$('layerName').setAttribute('aria-invalid','true');$('layerName').focus();return;}const target=renameTarget,lay=project()?.levels[target.level]?.layers.find(l=>l.id===target.id);if(!lay){renameDialog.close();return;}if(lay.name!==name)edit(p=>{p.levels[target.level].layers.find(l=>l.id===target.id).name=name;});renameDialog.close();status('Layer renamed. Undo restores the previous name.');focusLayerName(target.id);};
$('cancelRename').onclick=()=>renameDialog.close();renameDialog.onclose=()=>{if(renameTarget?.level===levelId)focusLayerName(renameTarget.id);renameTarget=null;};renameDialog.onkeydown=e=>{if(e.key==='Escape')e.stopPropagation();};
const settings=$('editorSettings');
$('setManifest').onclick=()=>{$('manifest').value=manifestURL||'';$('settingsStatus').textContent='';settings.showModal();};
$('closeSettings').onclick=()=>{$('manifest').value=manifestURL||'';settings.close();};settings.oncancel=()=>{$('manifest').value=manifestURL||'';};settings.onclose=()=>{$('manifest').value=manifestURL||'';};
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
function previewLayer(id){if(hoveredLayer===id)return;hoveredLayer=id;draw();}
function closeLayerPicker(){ $('layerPickerMenu').hidden=true;$('layerPickerSelect').setAttribute('aria-expanded','false');previewLayer(null); }
function activateLayer(id){finish(true);layerId=id;closeLayerPicker();closePalettePicker();selectedTarget=null;selected=null;selectedTile=null;refresh();}
$('layers').onpointerover=e=>{const row=e.target.closest('.layer-card');previewLayer(row?.dataset.layer||null);};$('layers').onpointerleave=()=>previewLayer(null);
$('layerPickerSelect').onclick=()=>{if($('layerPickerMenu').hidden){closePalettePicker();$('layerPickerMenu').hidden=false;$('layerPickerSelect').setAttribute('aria-expanded','true');}else closeLayerPicker();};
$('layerPickerSelect').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();$('layerPickerMenu').hidden=false;$('layerPickerSelect').setAttribute('aria-expanded','true');$('layerPickerMenu').querySelector('[aria-pressed=true]')?.focus();}};
$('layerPickerMenu').onpointerleave=()=>previewLayer(null);
$('layerPickerMenu').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeLayerPicker();$('layerPickerSelect').focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const options=[...$('layerPickerMenu').children],i=options.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus();}};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#layerPicker')&&!$('layerPickerMenu').hidden)closeLayerPicker();});document.addEventListener('focusin',e=>{if(!e.target.closest('#layerPicker')&&!$('layerPickerMenu').hidden)closeLayerPicker();});
function closePalettePicker(){ $('palettePickerMenu').hidden=true;$('palettePickerButton').setAttribute('aria-expanded','false'); }
$('palettePickerButton').onclick=()=>{const menu=$('palettePickerMenu');menu.hidden=!menu.hidden;$('palettePickerButton').setAttribute('aria-expanded',String(!menu.hidden));};
$('palettePickerButton').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();$('palettePickerMenu').hidden=false;$('palettePickerButton').setAttribute('aria-expanded','true');$('palettePickerMenu').querySelector('[aria-pressed=true]')?.focus();}};
$('palettePickerMenu').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePalettePicker();$('palettePickerButton').focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const options=[...$('palettePickerMenu').children],i=options.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus();}};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#palettePicker'))closePalettePicker();});document.addEventListener('focusin',e=>{if(!e.target.closest('#palettePicker'))closePalettePicker();});
const project=()=>history?.value,level=()=>project()?.levels[levelId],layer=()=>level()?.layers.find(l=>l.id===layerId),object=()=>level()&&objects(level()).find(o=>o.id===selected);
function elementTypes(){return layer()?.kind==='background'?backgroundTypes:project().catalog.elements;}
function layerOffset(lay=layer()){return lay?.kind==='background'?backgroundOffset(lay,cameraBounds()||{x:-project().settings.viewport.width/2,y:-project().settings.viewport.height/2}):{x:0,y:0};}
function objectPoint(pos,lay=layer()){const offset=layerOffset(lay);return{x:pos.x-offset.x,y:pos.y-offset.y};}
function displayObject(o){return layer()?.kind==='background'?shiftedBackground(o,layerOffset()):o;}
function status(message){$('status').textContent=message;if(settings.open)$('settingsStatus').textContent=message;}
function errors(){const list=project()?[...validateProject(project()),...assetErrors]:assetErrors;$('errors').replaceChildren(...list.map(s=>{const d=document.createElement('div');d.textContent=s;return d;}));$('save').disabled=exampleMode||!manifestURL||!project()||list.some(x=>!x.startsWith('Missing or unreadable image'));$('reloadProject').disabled=!manifestURL;$('dirty').textContent=project()&&serialize(project())!==saved?exampleMode?'Example edits (not saved)':'Unsaved changes':'';}
function edit(fn){const p=clone(project());fn(p,p.levels[levelId]);history.commit(p);refresh();}
function setProperty(target,key,value,def){const e=validateValue(value,def,key);if(e.length){status(e.join('; '));refresh();return;}edit((p,l)=>{const vals=target==='global'?p.settings.values:target==='level'?l.settings:objects(l).find(o=>o.id===selected)?.properties;if(vals)vals[key]=value;});}
function refresh({rebuildLayers=true}={}){if(!project())return;const l=level();layerView.sync(l);if(!visible(layer())){selected=null;selectedTile=null;}if(!l.layers.some(x=>x.id===layerId))layerId=l.layers[0]?.id;if(!object())selected=null;
  if(selectedTile&&!l.layers.find(x=>x.id===selectedTile.layer)?.tiles?.some(t=>t.x===selectedTile.x&&t.y===selectedTile.y))selectedTile=null;
  if(selected||selectedTile)selectedTarget=null;
  $('selectionHeading').textContent=selectedTarget==='camera'?'Camera':selectedTarget==='level'?'Level dimensions':selected?'Object':selectedTile?'Tile':'Selected object / tile';
  $('targetNotice').hidden=!selectedTarget;$('targetNotice').textContent=selectedTarget?`${selectedTarget==='level'?'Level dimensions':'Camera'} selected - drag handles to resize; Alt: center; Shift: aspect ratio; Esc: cancel`:'';
  const selectionKey=selected?`${levelId}:object:${selected}`:selectedTile?`${levelId}:tile:${selectedTile.layer}:${selectedTile.x}:${selectedTile.y}`:selectedTarget?`${levelId}:${selectedTarget}`:'';
  if(selectionKey&&selectionKey!==inspectedSelection)activatePanelTab(inspectorTabs,$('selectionTab'));
  inspectedSelection=selectionKey;$('selectionHint').hidden=!!selectionKey;
  const grid=editingGrid(l);$('gridX').value=grid.x;$('gridY').value=grid.y;
  if(hoveredLayer&&!l.layers.some(lay=>lay.id===hoveredLayer))hoveredLayer=null;
  const layerSelect=$('layerPickerSelect'),layerMenu=$('layerPickerMenu');layerMenu.replaceChildren();layerSelect.disabled=!l.layers.length;
  const layerTypeIcon=lay=>{const marker=document.createElement('span');marker.className=`layer-type-icon ${lay.kind}`;marker.title=lay.kind==='tile'?'Tile layer':lay.kind==='background'?'Background layer':'Object layer';marker.setAttribute('aria-hidden','true');return marker;};
  const currentLayer=$('layerPickerCurrent');currentLayer.replaceChildren();if(layer())currentLayer.append(layerTypeIcon(layer()),document.createTextNode(layer().name||layerId));else currentLayer.textContent='No layers';
  for(const lay of [...l.layers].reverse()){const button=document.createElement('button');button.type='button';button.append(layerTypeIcon(lay),document.createTextNode(lay.name||lay.id));button.setAttribute('aria-label',`${lay.name||lay.id}, ${lay.kind} layer`);button.dataset.layer=lay.id;button.setAttribute('aria-pressed',String(lay.id===layerId));button.onclick=()=>{activateLayer(lay.id);$('layerPickerSelect').focus();};button.onpointerenter=button.onfocus=()=>previewLayer(lay.id);layerMenu.append(button);}
  $('paletteLayer').textContent=layer()?`Active layer: ${layer().name||layerId}`:'Select a layer to see available elements.';
  $('levels').replaceChildren(...project().manifest.levels.map(e=>new Option(e.label||e.id,e.id)));$('levels').value=levelId;
  if(rebuildLayers){$('layers').replaceChildren();for(const lay of [...l.layers].reverse()){
    const row=document.createElement('details');row.className='layer-card'+(lay.id===layerId?' active-layer':'');row.dataset.layer=lay.id;
    const key=`${levelId}/${lay.id}`;row.open=expandedLayers.has(key);
    const header=document.createElement('summary');header.tabIndex=-1;header.onclick=e=>e.preventDefault();
    const name=document.createElement('button');name.type='button';name.className='name';const typeIcon=document.createElement('span');typeIcon.className=`layer-type-icon ${lay.kind}`;typeIcon.title=lay.kind==='tile'?'Tile layer':lay.kind==='background'?'Background layer':'Object layer';typeIcon.setAttribute('aria-hidden','true');const nameText=document.createElement('span');nameText.className='layer-name-text';nameText.textContent=lay.name||lay.id;name.append(typeIcon,nameText);name.setAttribute('aria-label',`${lay.name||lay.id}, ${lay.kind} layer`);name.title=`${lay.kind==='tile'?'Tile':lay.kind==='background'?'Background':'Object'} layer - double-click to rename`;name.setAttribute('aria-pressed',String(lay.id===layerId));name.onclick=()=>{finish(true);const focused=document.activeElement===name;layerId=lay.id;closeLayerPicker();closePalettePicker();selectedTarget=null;selected=null;selectedTile=null;refresh({rebuildLayers:false});if(focused)name.focus({preventScroll:true});};name.ondblclick=e=>{e.preventDefault();openRename(lay.id);};
    const toggle=document.createElement('button');toggle.type='button';toggle.className='layer-toggle';toggle.setAttribute('aria-controls',`layer-settings-${l.layers.indexOf(lay)}`);
    const updateToggle=()=>{toggle.textContent=row.open?'▾':'▸';toggle.setAttribute('aria-expanded',String(row.open));toggle.setAttribute('aria-label',`${row.open?'Collapse':'Expand'} ${lay.name||lay.id} settings`);};updateToggle();
    toggle.onclick=e=>{e.preventDefault();e.stopPropagation();row.open=!row.open;row.open?expandedLayers.add(key):expandedLayers.delete(key);updateToggle();};const states=document.createElement('div');states.className='layer-header-states';
    for(const prop of ['visible','solo','locked']){const b=document.createElement('button');b.type='button';b.className='layer-header-state';const action=prop==='solo'?(layerView.solo===lay.id?'Unsolo':'Solo'):prop==='visible'?(lay.visible?'Hide':'Show'):(lay.locked?'Unlock':'Lock');b.title=prop==='solo'?`${action} layer (temporary isolation)`:prop==='visible'&&layerView.solo?`${action} layer (exits Solo first)`:`${action} layer`;b.setAttribute('aria-label',`${action} ${lay.name||lay.id} layer`);b.setAttribute('aria-pressed',String(prop==='solo'?layerView.solo===lay.id:lay[prop]));if(prop==='solo')b.textContent='S';else b.append(icon(prop==='visible'?(lay.visible?'visibility':'visibility_off'):(lay.locked?'lock':'lock_open')));b.dataset.state=prop;b.onclick=e=>{e.preventDefault();e.stopPropagation();finish(true);if(prop==='solo'){layerView.toggle(level(),lay.id);selected=null;selectedTile=null;hoveredLayer=null;refresh();}else{if(prop==='visible')layerView.reset();edit((p,l)=>{l.layers.find(x=>x.id===lay.id)[prop]=!lay[prop];});}[...$('layers').children].find(r=>r.dataset.layer===lay.id)?.querySelector(`[data-state=${prop}]`).focus({preventScroll:true});};states.append(b);}
    for(const [text,delta]of [['Raise',1],['Lower',-1]]){const b=document.createElement('button');b.type='button';b.className='layer-header-state';b.append(icon(delta>0?'arrow_upward':'arrow_downward'));b.title=`${text} layer`;b.setAttribute('aria-label',`${text} ${lay.id}`);const index=l.layers.indexOf(lay);b.disabled=index+delta<0||index+delta>=l.layers.length;b.onclick=e=>{e.preventDefault();e.stopPropagation();edit((p,l)=>{const i=l.layers.findIndex(x=>x.id===lay.id),j=i+delta;if(j>=0&&j<l.layers.length)[l.layers[i],l.layers[j]]=[l.layers[j],l.layers[i]];});[...$('layers').children].find(r=>r.dataset.layer===lay.id)?.querySelector(`[aria-label="${text} ${lay.id}"]`)?.focus({preventScroll:true});};states.append(b);}
    header.append(name,states,toggle);row.append(header);
    const controls=document.createElement('div');controls.className='layer-controls';controls.id=toggle.getAttribute('aria-controls');const typeLabel=document.createElement('small');typeLabel.className='panel-context';typeLabel.textContent=`Type: ${lay.kind==='tile'?'Tile':lay.kind==='background'?'Background':'Object'}`;controls.append(typeLabel);const rename=document.createElement('button');rename.type='button';rename.textContent='Rename layer...';rename.onclick=()=>openRename(lay.id);
    if(lay.kind==='tile'){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=lay.solid!==false;check.dataset.layerSolid=lay.id;check.setAttribute('aria-label',`Solid ${lay.name||lay.id}`);check.onchange=()=>{edit((p,l)=>{l.layers.find(x=>x.id===lay.id).solid=check.checked;});[...$('layers').children].find(r=>r.dataset.layer===lay.id)?.querySelector('[data-layer-solid]')?.focus({preventScroll:true});};label.append(check,document.createTextNode('Solid'));controls.append(label);}
    if(lay.kind==='background'){const panel=document.createElement('div');propertyPanel(panel,{x:{type:'number',label:'Parallax X',min:0,step:.1},y:{type:'number',label:'Parallax Y',min:0,step:.1}},lay.parallax||{x:1,y:1},{project:project(),onChange:(axis,value)=>{if(!Number.isFinite(value)||value<0){status('Parallax must be nonnegative.');refresh();return;}const c=cameraBounds()||{x:-project().settings.viewport.width/2,y:-project().settings.viewport.height/2};edit((p,l)=>{const target=l.layers.find(x=>x.id===lay.id),old=target.parallax||{x:1,y:1};for(const o of target.objects)o[axis]+=(value-old[axis])*c[axis];target.parallax={...old,[axis]:value};});}});controls.append(panel);}
    const label=document.createElement('label');label.textContent='Opacity';const opacity=document.createElement('input');opacity.type='range';opacity.min=0;opacity.max=1;opacity.step=.1;opacity.value=lay.opacity;opacity.setAttribute('aria-label',`${lay.id} opacity`);opacity.onchange=()=>edit((p,l)=>{l.layers.find(x=>x.id===lay.id).opacity=Number(opacity.value);});label.append(opacity);controls.append(label);
controls.append(rename);row.append(controls);$('layers').append(row);
  }
  }else for(const row of $('layers').children){row.classList.toggle('active-layer',row.dataset.layer===layerId);row.querySelector('.name').setAttribute('aria-pressed',String(row.dataset.layer===layerId));}
  $('palette').replaceChildren();const palette=elementTypes().filter(e=>e.kind===layer()?.kind);if(!palette.some(e=>e.id===elementId))elementId=palette[0]?.id;for(const e of palette){const b=document.createElement('button');const thumbnail=document.createElement('canvas');thumbnail.width=44;thumbnail.height=44;thumbnail.className='palette-thumbnail';thumbnail.setAttribute('aria-hidden','true');const size=e.size||(e.kind==='tile'?level().tileSize:{width:level().grid,height:level().grid}),context=thumbnail.getContext('2d'),scale=Math.min(40/size.width,40/size.height);context.translate((44-size.width*scale)/2,(44-size.height*scale)/2);context.scale(scale,scale);drawElement(context,{type:e.id,x:0,y:0,...size,properties:defaults(e.properties)},e,images,{editor:false});if(e.visual?.editorOnly)drawElement(context,{type:e.id,x:0,y:0,...size,properties:{}},e,images,{editor:true});b.append(thumbnail,document.createTextNode(e.label||e.id));b.style.borderLeft=`8px solid ${e.color||'#789'}`;if(e.id===elementId)b.className='active';b.onclick=()=>{elementId=e.id;chooseTool('paint');refresh();};$('palette').append(b);}
  const menu=$('palettePickerMenu'),current=$('palettePickerCurrent');menu.replaceChildren();current.replaceChildren();
  const copyThumbnail=source=>{const thumbnail=document.createElement('canvas');thumbnail.width=source.width;thumbnail.height=source.height;thumbnail.className='palette-thumbnail';thumbnail.setAttribute('aria-hidden','true');thumbnail.getContext('2d').drawImage(source,0,0);return thumbnail;};
  for(const [i,element]of palette.entries()){const source=$('palette').children[i].querySelector('canvas'),b=document.createElement('button');b.type='button';b.append(copyThumbnail(source),document.createTextNode(element.label||element.id));b.setAttribute('aria-pressed',String(element.id===elementId));b.onclick=()=>{elementId=element.id;chooseTool('paint');closePalettePicker();refresh();$('palettePickerButton').focus();};menu.append(b);if(element.id===elementId)current.append(copyThumbnail(source),document.createTextNode(element.label||element.id));}
  $('palettePickerButton').disabled=!palette.length;if(!palette.length){current.textContent='No palette elements';closePalettePicker();}
  const o=object(),t=elementTypes().find(e=>e.id===o?.type);$('properties').replaceChildren();if(o){const id=document.createElement('small');id.textContent=`Stable ID: ${o.id}`;$('properties').append(id);const transform=document.createElement('div');propertyPanel(transform,{x:{type:'number'},y:{type:'number'},...(t.resizable?{width:{type:'number',min:1},height:{type:'number',min:1}}:{})},o,{project:project(),onChange:(k,v)=>{if(layer()?.locked)return; if(!Number.isFinite(v)||(['width','height'].includes(k)&&v<1)){status('Size must be positive; coordinates must be finite.');refresh();return;}edit((p,l)=>{objects(l).find(x=>x.id===selected)[k]=v;});}});$('properties').append(transform);const props=document.createElement('div');propertyPanel(props,t.properties,o.properties,{project:project(),onChange:(k,v)=>{if(!layer()?.locked){if(layer()?.kind==='background'&&['scaleX','scaleY'].includes(k)&&backgroundScaleLinked){const other=k==='scaleX'?'scaleY':'scaleX',ratio=(o.properties[other]??1)/(o.properties[k]??1);if(!Number.isFinite(v)||v<.001||!Number.isFinite(v*ratio)||v*ratio<.001){status('Scale must be at least 0.001.');refresh();return;}edit((p,l)=>{const target=objects(l).find(x=>x.id===selected);target.properties[k]=v;target.properties[other]=v*ratio;});}else setProperty('object',k,v,t.properties[k]);}},onPick:(key,def)=>{pick={level:levelId,object:o.id,key,def};chooseTool('reference');status('Choose a destination level, then click an allowed object.');}});$('properties').append(props);if(layer()?.kind==='background'&&o.type==='background-image'){const link=document.createElement('button');link.type='button';link.className='background-scale-link';link.append(icon(backgroundScaleLinked?'link':'link_off'));link.title='Link image scale';link.setAttribute('aria-label','Link image scale');link.setAttribute('aria-pressed',String(backgroundScaleLinked));link.onclick=()=>{backgroundScaleLinked=!backgroundScaleLinked;refresh();};const scaleX=props.querySelector('[data-property=scaleX]'),scaleY=props.querySelector('[data-property=scaleY]'),row=document.createElement('div');row.className='background-scale-row';scaleX.before(row);row.append(scaleX,link,scaleY);}}
  if(selectedTile){const tile=l.layers.find(lay=>lay.id===selectedTile.layer)?.tiles?.find(t=>t.x===selectedTile.x&&t.y===selectedTile.y);if(tile)propertyPanel($('properties'),{x:{type:'integer',label:'Tile X'},y:{type:'integer',label:'Tile Y'},width:{type:'integer',label:'Tile width',min:1},height:{type:'integer',label:'Tile height',min:1}},tile,{project:project(),onChange:(key,value)=>{if(layer()?.locked)return;const d={type:'integer',...(['width','height'].includes(key)?{min:1}:{})},errors=validateValue(value,d,key);if(errors.length){status(errors.join('; '));refresh();return;}const from={x:tile.x,y:tile.y},to={...from,...(['x','y'].includes(key)?{[key]:value}:{})};const error=tileMoveError(level(),selectedTile.layer,from,to);if(error){status(error);refresh();return;}const id=selectedTile.layer;edit((p,l)=>{const target=l.layers.find(lay=>lay.id===id).tiles.find(t=>t.x===from.x&&t.y===from.y);target[key]=value;selectedTile={layer:id,...to};});}});}
  if(layer()?.locked)for(const control of $('properties').querySelectorAll('input,select,button'))control.disabled=true;
  if(!resizeDraft||resizeDraft.level!==levelId||resizeDraft.baseWidth!==l.width||resizeDraft.baseHeight!==l.height)resizeDraft={level:levelId,baseWidth:l.width,baseHeight:l.height,width:l.width,height:l.height};
  function renderDimensions(dimensions,prefix=''){dimensions.replaceChildren();dimensions.classList.add('dimension-controls');
  for(const [key,labelText]of [['width','Level width'],['height','Level height']]){const label=document.createElement('label');label.className='field';label.textContent=labelText;label.dataset.property=key;const input=document.createElement('input');input.type='number';input.min=1;input.step=1;input.value=resizeDraft[key];input.setAttribute('aria-label',labelText);input.dataset.dimension=key;input.oninput=input.onchange=()=>{resizeDraft[key]=input.value===''?NaN:Number(input.value);updateResizePreview();};label.append(input);dimensions.append(label);}
  compactFieldPairs(dimensions);
  const label=document.createElement('p');label.className='resize-caption';label.textContent='Anchor - choose the part that stays fixed';dimensions.append(label);
  const anchors=document.createElement('div');anchors.className='resize-anchors';anchors.setAttribute('role','group');anchors.setAttribute('aria-label','Resize anchor');
  const names=['Top-left','Top-center','Top-right','Middle-left','Center','Middle-right','Bottom-left','Bottom-center','Bottom-right'];
  for(let i=0;i<9;i++){const x=(i%3)/2,y=Math.floor(i/3)/2,b=document.createElement('button');b.type='button';b.dataset.x=x;b.dataset.y=y;b.setAttribute('aria-label',names[i]+' anchor');b.title=names[i]+' stays fixed';b.onclick=()=>{resizeAnchor={x,y};updateResizePreview();};anchors.append(b);}dimensions.append(anchors);
  const preview=document.createElement('p');preview.id=prefix+'resizePreview';preview.dataset.resizePreview='';preview.className='resize-caption';preview.setAttribute('role','status');dimensions.append(preview);
  const apply=document.createElement('button');apply.id=prefix+'applyResize';apply.dataset.applyResize='';apply.textContent='Apply resize';apply.onclick=()=>{try{const {width,height}=resizeDraft,anchor={...resizeAnchor};resizePlan(level(),width,height,anchor);finish();const next=resizeLevel(level(),project().catalog,width,height,anchor);selectedTile=null;resizeDraft=null;edit(p=>{p.levels[levelId]=next;});status('Level resized. Undo restores its size and all shifted content.');}catch(e){status(e.message);}};dimensions.append(apply);}
  renderDimensions($('levelDimensions'));
  if(selectedTarget==='level'){const dimensions=document.createElement('div');$('properties').append(dimensions);renderDimensions(dimensions,'selection-');}
  updateResizePreview();
  const outside=l.layers.filter(lay=>lay.kind!=='background').flatMap(lay=>lay.kind==='tile'?lay.tiles:lay.objects).filter(o=>o.x<0||o.y<0||o.x+o.width>l.width||o.y+o.height>l.height).length;
  $('boundsNotice').hidden=!outside;$('boundsNotice').textContent=outside?`${outside} tile(s)/object(s) extend outside the level. Content is preserved; enlarge the level or reposition it.`:'';
  propertyPanel($('tileDefaults'),{width:{type:'integer',label:'Default tile width',min:1,help:'New tiles use this size unless their catalog defines a size.'},height:{type:'integer',label:'Default tile height',min:1}},l.tileSize,{project:project(),onChange:(key,value)=>{const errors=validateValue(value,{type:'integer',min:1},key);if(errors.length){status(errors.join('; '));refresh();return;}edit((p,l)=>{l.tileSize[key]=value;});}});
  const cameraDefs=Object.fromEntries(Object.entries(project().catalog.levelProperties).filter(([key])=>['camera','cameraZoom'].includes(key)));
  const otherDefs=Object.fromEntries(Object.entries(project().catalog.levelProperties).filter(([key])=>!['camera','cameraZoom'].includes(key)));
  if(selectedTarget==='camera')propertyPanel($('properties'),cameraDefs,l.settings,{project:project(),onChange:(k,v)=>setProperty('level',k,v,cameraDefs[k])});
  propertyPanel($('cameraSettings'),cameraDefs,l.settings,{project:project(),onChange:(k,v)=>setProperty('level',k,v,cameraDefs[k])});
  $('cameraSettings').closest('.property-group').hidden=!Object.keys(cameraDefs).length;$('otherLevelGroup').hidden=!Object.keys(otherDefs).length;
  propertyPanel($('levelSettings'),otherDefs,l.settings,{project:project(),onChange:(k,v)=>setProperty('level',k,v,project().catalog.levelProperties[k])});
  propertyPanel($('globalSettings'),project().settings.properties,project().settings.values,{project:project(),onChange:(k,v)=>setProperty('global',k,v,project().settings.properties[k])});
  $('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;errors();draw();
}
function updateResizePreview(){
  const buttons=[...document.querySelectorAll('.dimension-controls .resize-anchors button')];for(const input of document.querySelectorAll('.dimension-controls [data-dimension]'))if(input!==document.activeElement)input.value=Number.isFinite(resizeDraft[input.dataset.dimension])?resizeDraft[input.dataset.dimension]:'';
  buttons.forEach(b=>{const dx=Number(b.dataset.x)-resizeAnchor.x,dy=Number(b.dataset.y)-resizeAnchor.y,selected=dx===0&&dy===0;b.setAttribute('aria-pressed',String(selected));const marker=selected?document.createElement('span'):icon('arrow_upward');if(selected){marker.className='anchor-point';marker.setAttribute('aria-hidden','true');}else marker.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI+90}deg)`;b.replaceChildren(marker);});

  try{const plan=resizePlan(level(),resizeDraft.width,resizeDraft.height,resizeAnchor);for(const preview of document.querySelectorAll('[data-resize-preview]'))preview.textContent=`Content offset: ${plan.dx}px X, ${plan.dy}px Y. Content is preserved.`;for(const button of document.querySelectorAll('[data-apply-resize]'))button.disabled=plan.width===level().width&&plan.height===level().height;}
  catch(e){for(const preview of document.querySelectorAll('[data-resize-preview]'))preview.textContent=e.message;for(const button of document.querySelectorAll('[data-apply-resize]'))button.disabled=true;}
}
function cameraBounds(){const l=level();if(!l)return null;const camera=l.settings.camera??project().catalog.levelProperties.camera?.default;if(!camera)return null;return cameraViewport({...l.settings,camera,cameraZoom:l.settings.cameraZoom??project().catalog.levelProperties.cameraZoom?.default??1},project().settings.viewport);}
function targetBounds(){return selectedTarget==='level'?{x:0,y:0,width:level().width,height:level().height}:selectedTarget==='camera'?cameraBounds():null;}
function selectTarget(target){finish();chooseTool('select');selected=null;selectedTile=null;selectedTarget=target;if(target==='camera'&&!$('cameraOverlay').checked){$('cameraOverlay').checked=true;$('cameraOverlay').dispatchEvent(new Event('change'));}activatePanelTab(inspectorTabs,$('selectionTab'));refresh();$('selectionPanel').scrollTop=0;}
$('selectCameraToolbar').onclick=()=>$('selectCameraBounds').click();
$('selectLevelBounds').onclick=()=>{if(level())selectTarget('level');};$('selectCameraBounds').onclick=()=>{if(cameraBounds())selectTarget('camera');else status('Set a camera center first.');};
function targetResize(pos,e){const g=gesture;if(Math.hypot(pos.x-g.start.x,pos.y-g.start.y)*view.zoom<3&&!g.targetMoved)return;g.targetMoved=true;const center=e.altKey,grow=modifiedResize(g.original,g.start,pos,g.edges,editingGrid(level()),$('snap').checked,{alt:center,shift:e.shiftKey||g.target==='camera'});g.preview=grow;g.anchor=gestureAnchor(g.edges,center);if(g.target==='camera'){const def=project().catalog.levelProperties.cameraZoom;const zoom=Math.max(def?.min??.01,Math.min(def?.max??100,project().settings.viewport.width/grow.width));const width=project().settings.viewport.width/zoom,height=project().settings.viewport.height/zoom;const anchor=g.anchor,x=g.original.x+(g.original.width-width)*anchor.x,y=g.original.y+(g.original.height-height)*anchor.y;level().settings.camera={...(level().settings.camera??{}),x:Math.round(x+width/2),y:Math.round(y+height/2)};level().settings.cameraZoom=zoom;g.preview=cameraBounds();}}
function draw(){$('selectCameraToolbar').setAttribute('aria-pressed',String(activeTool==='select'&&selectedTarget==='camera'));const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0c141e';ctx.fillRect(0,0,r.width,r.height);if(!level())return;ctx.translate(view.x,view.y);ctx.scale(view.zoom,view.zoom);drawScene(ctx,project(),level(),images,{layerVisible:visible,grid:$('grid').checked,gridSize:editingGrid(level()),gridBounds:{x:-view.x/view.zoom,y:-view.y/view.zoom,width:r.width/view.zoom,height:r.height/view.zoom},gridZoom:view.zoom,gridColor:workspace?.gridColor,gridOpacity:(workspace?.gridOpacity??13)/100,selected,selectedTile,overlayOptions:workspace,cameraActive:selectedTarget==='camera',referenceActive:activeTool==='reference',hoveredLayer:workspace?.layerHoverPreview===false?null:hoveredLayer,hiddenTile:gesture?.tileMove?{layer:gesture.tileMove.layer,...gesture.tileMove.from}:null});if(gesture?.tileMove){const m=gesture.tileMove;{ctx.save();ctx.globalAlpha=layer()?.opacity??1;drawElement(ctx,{...m.tile,x:m.to.x,y:m.to.y},elementTypes().find(t=>t.id===m.tile.type),images,{editor:false});ctx.globalAlpha=1;ctx.strokeStyle=tileMoveError(level(),m.layer,m.from,m.to)?'#ff8b88':'#64dec6';ctx.lineWidth=3/view.zoom;ctx.strokeRect(m.to.x,m.to.y,m.tile.width,m.tile.height);ctx.restore();}}if(gesture?.rectangle){const layout=rectangleLayout();ctx.fillStyle=gesture.rectangleErase?'#ff6b6b22':'#64dec622';ctx.fillRect(layout.x,layout.y,layout.width,layout.height);ctx.strokeStyle=gesture.rectangleErase?'#ff6b6b':'#64dec6';ctx.lineWidth=2/view.zoom;ctx.strokeRect(layout.x,layout.y,layout.width,layout.height);}const bounds=activeTool==='select'?(gesture?.target==='level'?gesture.preview||gesture.original:targetBounds()):null;if(bounds){drawHandles(ctx,bounds,view.zoom,selectedTarget==='camera'?'#ffdf85':'#64dec6');if(gesture?.target==='level'){ctx.fillStyle='#fff';ctx.font=`${12/view.zoom}px system-ui`;ctx.fillText(`${bounds.width} x ${bounds.height}`,bounds.x+10/view.zoom,bounds.y+20/view.zoom);}}else if(object()&&elementTypes().find(t=>t.id===object().type)?.resizable&&!layer()?.locked&&visible(layer())&&(activeTool==='select'||activeTool==='paint'))drawHandles(ctx,displayObject(object()),view.zoom);}
function rectangleLayout(){const grid=editingGrid(level()),snap=$('snap').checked,a=brushPosition(gesture.start,grid,snap),b=brushPosition(gesture.end,grid,snap);if(gesture.rectangleErase)return snap?fillLayout(a,b,{width:grid.x,height:grid.y}):{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.max(1,Math.abs(b.x-a.x)),height:Math.max(1,Math.abs(b.y-a.y))};return fillLayout(a,b,brushSize());}
function fit(){if(!level())return;const r=canvas.getBoundingClientRect();view.zoom=Math.max(.05,Math.min((r.width-60)/level().width,(r.height-60)/level().height));view.x=(r.width-level().width*view.zoom)/2;view.y=(r.height-level().height*view.zoom)/2;draw();}
function world(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-view.x)/view.zoom,y:(e.clientY-r.top-view.y)/view.zoom};}
function snap(n,axis='x'){return snapCoordinate(n,editingGrid(level())[axis],$('snap').checked);}
function selectedHandle(pos){const o=object();if(!o||layer()?.locked||!visible(layer())||!elementTypes().find(t=>t.id===o.type)?.resizable)return null;const edges=handleAt(o,objectPoint(pos),6/view.zoom);return edges?{object:o,edges}:null;}
function edgeHit(pos){if(object()&&activeTool==='select'&&!layer()?.locked&&visible(layer())&&elementTypes().find(t=>t.id===object().type)?.resizable){const edges=handleAt(object(),objectPoint(pos),6/view.zoom);if(edges)return{object:object(),edges};}if(!layer()||layer().locked||!visible(layer())||!['object','background'].includes(layer().kind))return null;for(const o of [...layer().objects].reverse()){if(!elementTypes().find(t=>t.id===o.type)?.resizable)continue;const edges=resizeEdges(o,objectPoint(pos),6/view.zoom);if(edges)return{object:o,edges};}return null;}
function updateCursor(pos){if(activeTool==='select'&&pos&&selectedTarget&&!spaceDown&&!gesture?.pan){const b=targetBounds(),edges=b&&handleAt(b,pos,6/view.zoom);if(edges){canvas.style.cursor=resizeCursor(edges);return;}}if(activeTool==='reference'&&pick&&!spaceDown&&!gesture?.pan){canvas.style.cursor='crosshair';return;}if(gesture?.tileMove||gesture?.cameraOriginal){canvas.style.cursor='grabbing';return;}if(spaceDown||gesture?.pan){canvas.style.cursor=gesture?.pan?'grabbing':'grab';return;}const edges=gesture?.edges||(pos?(activeTool==='select'?(workspace?.autoSelectLayer?selectedHandle(pos):edgeHit(pos))?.edges:activeTool==='paint'?selectedHandle(pos)?.edges:null):null);canvas.style.cursor=edges?resizeCursor(edges):'default';}
function hit(pos,all=false){for(const lay of [...level().layers].reverse()){if((lay.kind!=='object'&&lay.kind!=='background')||(all&&lay.kind==='background')||!visible(lay)||(!all&&(lay.locked||lay.id!==layerId)))continue;for(const o of [...lay.objects].reverse())if(containsPoint(o,elementTypes().find(t=>t.id===o.type),objectPoint(pos,lay)))return{object:o,layer:lay};}return null;}
function catalogTypes(){return new Map(elementTypes().map(t=>[t.id,t]));}
function brushSize(){return elementTypes().find(t=>t.id===elementId)?.size||level().tileSize;}
function applyPaint(pos){const l=layer();if(!l||l.locked||!visible(l))return;if(l.kind==='tile'){const p=brushPosition(pos,editingGrid(level()),$('snap').checked);paint(l,p.x,p.y,elementId,brushSize());}}
canvas.oncontextmenu=e=>e.preventDefault();
function eraseStroke(start,end){const active=layer();if(!active||active.locked||!visible(active))return;const types=catalogTypes();if(active.kind==='tile')eraseTiles(active,start,end,types);else active.objects=active.objects.filter(o=>!intersectsStroke(active.kind==='background'?shiftedBackground(o,layerOffset(active)):o,types.get(o.type),start,end));}
canvas.onpointerdown=e=>{
  if(!level())return;
  if(e.button===2){
    e.preventDefault();
    if(spaceDown||!layer()||layer().locked||!visible(layer()))return;
    finish();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const pos=world(e);
    if(activeTool==='rectangle'){gesture={before:clone(project()),start:pos,end:pos,rectangle:true,rectangleErase:true,layer:layerId};draw();return;}
    gesture={before:clone(project()),rightErase:true,last:pos};
    eraseStroke(pos,pos);draw();return;
  }
  if(e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const pos=world(e);if(spaceDown){gesture={pan:true,last:{x:e.clientX,y:e.clientY}};updateCursor();return;}const tool=activeTool;
  if(tool==='reference'&&!pick){status('Select an object, then use its destination property to pick a reference target.');return;}
  if(tool==='reference'&&pick){const sourceLayer=project().levels[pick.level]?.layers.find(l=>l.kind==='object'&&l.objects.some(o=>o.id===pick.object));if(!sourceLayer||sourceLayer.locked){status('Reference source is missing or its layer is locked.');pick=null;chooseTool('select');return;}const h=hit(pos,true);if(h&&(!pick.def.targets?.length||pick.def.targets.includes(h.object.type))){const destination={level:levelId,object:h.object.id};edit(p=>{const source=objects(p.levels[pick.level]).find(o=>o.id===pick.object);if(source)source.properties[pick.key]={...(source.properties[pick.key]||{}),...destination};});pick=null;chooseTool('select');status('Reference updated.');}return;}
  if(tool==='select'){
    const b=targetBounds(),edges=b&&handleAt(b,pos,6/view.zoom);
    if(edges){gesture={before:clone(project()),start:pos,original:clone(b),edges,target:selectedTarget};return;}
    if(selectedTarget==='camera'&&b&&pos.x>b.x&&pos.x<b.x+b.width&&pos.y>b.y&&pos.y<b.y+b.height){gesture={before:clone(project()),start:pos,cameraOriginal:clone(level().settings.camera??project().catalog.levelProperties.camera.default)};return;}
  }
  if(tool==='select'&&workspace.autoSelectLayer){
    // Keep explicit selected resize handles usable; otherwise pick the frontmost interior.
    const handle=selectedHandle(pos);
    const found=handle?{layer:layer(),element:handle.object}:topmostElement(level(),pos,new Map([...project().catalog.elements,...backgroundTypes].map(t=>[t.id,t])),{visible,pointForLayer:objectPoint});
    if(found){
      layerId=found.layer.id;selectedTarget=null;hoveredLayer=null;selected=null;selectedTile=null;
      const item=found.element;
      if(found.layer.kind==='tile'){
        selectedTile={layer:layerId,x:item.x,y:item.y};
        gesture={before:clone(project()),start:pos,tileMove:{layer:layerId,from:{x:item.x,y:item.y},to:{x:item.x,y:item.y},tile:clone(item)}};
      }else{
        selected=item.id;
        gesture={before:clone(project()),start:objectPoint(pos),original:clone(item),edges:handle?.edges,moveThreshold:true};
      }
      activatePanelTab(inspectorTabs,$('selectionTab'));refresh();updateCursor(pos);return;
    }
  }
  if(tool==='select'){
    // Explicit handles take priority; outline clicks do not steal object interiors.
    const camera=workspace?.camera!==false?cameraBounds():null,levelEdge=resizeEdges({x:0,y:0,width:level().width,height:level().height},pos,4/view.zoom),cameraEdge=camera&&resizeEdges(camera,pos,4/view.zoom);
    const content=!workspace.autoSelectLayer&&layer()?.kind!=='tile'?(edgeHit(pos)||hit(pos)):null;
    if(!content&&(cameraEdge||levelEdge)){selectTarget(cameraEdge?'camera':'level');return;}
    selectedTarget=null;
    if(workspace.autoSelectLayer){selected=null;selectedTile=null;refresh();return;}
  }
  if(!layer()||layer().locked||!visible(layer()))return;
  if(tool==='paint'&&layer().kind==='tile'&&!e.altKey){
    const tile=tileAt(layer(),pos,catalogTypes());if(tile){selectedTarget=null;selected=null;const {x,y}=tile;selectedTile={layer:layerId,x,y};gesture={before:clone(project()),start:pos,tileMove:{layer:layerId,from:{x,y},to:{x,y},tile:clone(tile)}};activatePanelTab(inspectorTabs,$('selectionTab'));refresh();return;}
  }
  if(tool==='paint'&&layer().kind!=='tile'){
    const h=selectedHandle(pos)||(!e.altKey&&hit(pos));
    if(h){selectedTarget=null;selectedTile=null;selected=h.object.id;gesture={before:clone(project()),start:objectPoint(pos),original:clone(h.object),edges:h.edges,moveThreshold:true};activatePanelTab(inspectorTabs,$('selectionTab'));refresh();updateCursor(pos);return;}
  }
  if(tool==='select'){
    selectedTile=null;
    if(layer().kind==='tile'){selected=null;const tile=tileAt(layer(),pos,catalogTypes());if(tile){activatePanelTab(inspectorTabs,$('selectionTab'));const {x,y}=tile;selectedTile={layer:layerId,x,y};if(tool==='select')gesture={before:clone(project()),start:pos,tileMove:{layer:layerId,from:{x,y},to:{x,y},tile:clone(tile)}};}refresh();return;}
    const edge=edgeHit(pos),h=edge||hit(pos);selected=h?.object.id||null;
    if(h){activatePanelTab(inspectorTabs,$('selectionTab'));const edges=edge?.edges||null;gesture={before:clone(project()),start:objectPoint(pos),original:clone(h.object),edges};}
    refresh();updateCursor(pos);return;
  }
  if(tool==='rectangle'){if(layer().kind!=='tile')return;gesture={before:clone(project()),start:pos,end:pos,rectangle:true};return;}
  gesture={before:clone(project()),paint:true};
  if(layer().kind!=='tile'&&tool==='paint'){const t=elementTypes().find(e=>e.id===elementId);if(!t)return;const o={id:newId(),type:t.id,x:snap(objectPoint(pos).x,'x'),y:snap(objectPoint(pos).y,'y'),width:t.size?.width||level().grid,height:t.size?.height||level().grid,properties:defaults(t.properties)};layer().objects.push(o);selected=o.id;selectedTile=null;gesture.paint=false;}else applyPaint(pos);draw();
};
canvas.onpointermove=e=>{const pos=level()?world(e):null;updateCursor(pos);if(!gesture)return;if(gesture.pan){view.x+=e.clientX-gesture.last.x;view.y+=e.clientY-gesture.last.y;gesture.last={x:e.clientX,y:e.clientY};draw();return;}if(gesture.target){targetResize(pos,e);}else if(gesture.cameraOriginal){updateCameraDrag(pos);}else if(gesture.tileMove){updateTileDrag(pos);}else if(gesture.rightErase){eraseStroke(gesture.last,pos);gesture.last=pos;}else if(gesture.rectangle)gesture.end=pos;else if(gesture.original){updateObjectDrag(objectPoint(pos),e);}else if(gesture.paint)applyPaint(pos);draw();};
function updateObjectDrag(pos,e){const o=object();if(!o)return;if(gesture.edges){if(Math.hypot(pos.x-gesture.start.x,pos.y-gesture.start.y)>=.5)Object.assign(o,modifiedResize(gesture.original,gesture.start,pos,gesture.edges,editingGrid(level()),$('snap').checked,{alt:e.altKey,shift:e.shiftKey}));}else{if(gesture.moveThreshold&&!gesture.objectMoved&&Math.hypot(pos.x-gesture.start.x,pos.y-gesture.start.y)*view.zoom<3)return;gesture.objectMoved=true;o.x=snap(gesture.original.x+pos.x-gesture.start.x,'x');o.y=snap(gesture.original.y+pos.y-gesture.start.y,'y');}}
function updateCameraDrag(pos){if(!gesture.cameraMoved&&Math.hypot(pos.x-gesture.start.x,pos.y-gesture.start.y)*view.zoom<3)return;gesture.cameraMoved=true;const original=gesture.cameraOriginal;level().settings.camera={...original,x:snap(original.x+pos.x-gesture.start.x,'x'),y:snap(original.y+pos.y-gesture.start.y,'y')};}
function updateTileDrag(pos){const m=gesture.tileMove;if(!m.moved&&Math.hypot(pos.x-gesture.start.x,pos.y-gesture.start.y)*view.zoom<3)return;m.moved=true;m.to={x:snap(m.from.x+pos.x-gesture.start.x,'x'),y:snap(m.from.y+pos.y-gesture.start.y,'y')};}
function finish(cancel=false){if(!gesture)return;if(gesture.before){if(cancel)history.value=gesture.before;else{if(gesture.target==='level'&&gesture.targetMoved){const b=gesture.preview;const nextLevel=resizeLevel(level(),project().catalog,b.width,b.height,gesture.anchor);const plan=resizePlan(level(),b.width,b.height,gesture.anchor);history.value.levels[levelId]=nextLevel;view.x-=plan.dx*view.zoom;view.y-=plan.dy*view.zoom;resizeDraft=null;}if(gesture.tileMove){const m=gesture.tileMove,error=moveTile(level(),m.layer,m.from,m.to);if(error)status(error);else selectedTile={layer:m.layer,...m.to};}if(gesture.rectangleErase){const active=level().layers.find(l=>l.id===gesture.layer);if(active&&!active.locked&&visible(active)){const area=rectangleLayout(),types=catalogTypes(),key=active.kind==='tile'?'tiles':'objects',before=active[key].length;active[key]=active[key].filter(o=>!intersectsRectangle(active.kind==='background'?shiftedBackground(o,layerOffset(active)):o,types.get(o.type),area));status(`Deleted ${before-active[key].length} element(s) touching the rectangle. Undo restores them.`);}}else if(gesture.rectangle){const a=brushPosition(gesture.start,editingGrid(level()),$('snap').checked),b=brushPosition(gesture.end,editingGrid(level()),$('snap').checked);fillTiles(layer(),a,b,brushSize(),elementId,paint);}const next=clone(project());history.value=gesture.before;history.commit(next);}}gesture=null;refresh();}
canvas.onpointerup=e=>{if(gesture?.original&&!gesture.target&&object()&&(gesture.edges||gesture.moveThreshold))updateObjectDrag(objectPoint(world(e)),e);if(gesture?.target)targetResize(world(e),e);if(gesture?.rectangle)gesture.end=world(e);if(gesture?.cameraOriginal)updateCameraDrag(world(e));if(gesture?.tileMove)updateTileDrag(world(e));if(gesture?.rightErase){eraseStroke(gesture.last,world(e));status('Erased targets on the active layer. Undo restores the entire stroke.');}finish();};canvas.onpointercancel=()=>finish(true);canvas.onlostpointercapture=()=>finish(true);
canvas.onwheel=e=>{e.preventDefault();const p=world(e),r=canvas.getBoundingClientRect();view.zoom=Math.max(.05,Math.min(12,view.zoom*Math.exp(-e.deltaY*.001)));view.x=e.clientX-r.left-p.x*view.zoom;view.y=e.clientY-r.top-p.y*view.zoom;draw();};
function deleteSelected(){
  if(!layer()||layer().locked||!visible(layer()))return;
  finish();
  if(selectedTile&&selectedTile.layer===layerId){const tile={...selectedTile};edit((p,l)=>paint(l.layers.find(x=>x.id===tile.layer),tile.x,tile.y,null));status('Deleted selected tile.');return;}
  if(!object())return;
  edit((p,l)=>{const lay=l.layers.find(x=>x.id===layerId&&x.kind!=='tile');if(lay&&!lay.locked)lay.objects=lay.objects.filter(o=>o.id!==selected);});status('Deleted object. Any broken references are listed below.');
}
$('undo').onclick=()=>{finish();history?.undo();refresh();};$('redo').onclick=()=>{finish();history?.redo();refresh();};$('fit').onclick=fit;$('fitToolbar').onclick=fit;

$('levels').onchange=()=>{const next=$('levels').value;finish();levelId=next;layerView.reset();hoveredLayer=null;closeLayerPicker();selectedTarget=null;layerId=level().layers[0]?.id;selected=null;selectedTile=null;refresh();fit();};
$('gridLink').addEventListener('click',()=>{linkedGridBase=level()?{level:levelId,...editingGrid(level())}:null;});
for(const [id,axis]of [['gridX','x'],['gridY','y']])$(id).onchange=()=>{
  if(!level())return;const value=Number($(id).value);if(!Number.isInteger(value)||value<1){status('Grid sizes must be positive whole pixels.');refresh();return;}finish();const next={...editingGrid(level()),[axis]:value};
  if(workspace.gridLinked){if(!linkedGridBase||linkedGridBase.level!==levelId)linkedGridBase={level:levelId,...editingGrid(level())};const other=axis==='x'?'y':'x';next[other]=Math.max(1,Math.round(value*linkedGridBase[other]/linkedGridBase[axis]));}
  else linkedGridBase=null;
  if(!Number.isSafeInteger(next.x)||!Number.isSafeInteger(next.y)){status('Grid sizes are too large.');refresh();return;}
  edit((p,l)=>{l.extensions??={};l.extensions.editor2D??={};l.extensions.editor2D.grid={...(l.extensions.editor2D.grid||{}),...next};});
};
for(const axis of ['X','Y']){
  const input=$('grid'+axis),button=$('grid'+axis+'Presets'),list=$('grid'+axis+'PresetList');
  const close=()=>{list.hidden=true;button.setAttribute('aria-expanded','false');};
  const open=()=>{for(const other of ['X','Y'])if(other!==axis){$('grid'+other+'PresetList').hidden=true;$('grid'+other+'Presets').setAttribute('aria-expanded','false');}list.hidden=false;button.setAttribute('aria-expanded','true');};
  for(const value of [8,16,24,32,48,64,96,128]){const option=document.createElement('button');option.type='button';option.textContent=String(value);option.onclick=e=>{e.preventDefault();input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));close();input.focus();};list.append(option);}
  button.onclick=e=>{e.preventDefault();list.hidden?open():close();};
  button.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();open();list.firstElementChild.focus();}};
  list.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();button.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const options=[...list.children],i=options.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}};
  document.addEventListener('pointerdown',e=>{if(!button.parentElement.contains(e.target))close();});document.addEventListener('focusin',e=>{if(!button.parentElement.contains(e.target))close();});
}
for(const [id,kind]of [['addTile','tile'],['addObject','object'],['addBackground','background']])$(id).onclick=()=>{if(!project())return;const name=prompt('Layer name',`${kind} layer`);if(!name)return;const id=newId('layer');edit((p,l)=>{if(kind==='background')l.version=3;l.layers.push({id,name,kind,visible:true,locked:false,opacity:1,...(kind==='tile'?{solid:true}:{}),...(kind==='background'?{parallax:{x:1,y:1}}:{}),[kind==='tile'?'tiles':'objects']:[]});});layerId=id;refresh();};
async function install(p,url){finish(true);layerView.reset();hoveredLayer=null;closeLayerPicker();linkedGridBase=null;selectedTarget=null;inspectedSelection='';activatePanelTab(inspectorTabs,$('levelTab'));resizeDraft=null;resizeAnchor={x:0,y:0};exampleMode=isExample(url);$('noProject').hidden=true;$('levels').disabled=false;$('export').disabled=false;$('preview').hidden=!url;$('projectMode').hidden=!exampleMode;$('projectMode').textContent=exampleMode?'Example project - changes will not be saved':'';$('settingsProjectNote').textContent=exampleMode?'This is the example project. Saving its files is disabled.':url?'Saving writes to the project selected by the local server.':'Imported bundle. Export it to preserve changes; load a manifest for server-backed saving.';history=new History(p);manifestURL=url;levelId=p.manifest.levels[0].id;layerId=level().layers[0]?.id;selected=null;selectedTile=null;pick=null;spaceDown=false;expandedLayers.clear();assetErrors=[];images=new Map();saved=serialize(p);$('manifest').value=url||'';$('preview').href=`preview.html?project=${encodeURIComponent(url||'')}`;refresh();fit();if(url)images=await loadImages(p,url,e=>assetErrors.push(e));refresh();}
$('load').onclick=async()=>{if(project()&&serialize(project())!==saved&&!confirm('Discard unsaved changes?'))return;try{const loaded=await loadProject($('manifest').value);await install(loaded.project,loaded.manifestURL);status(exampleMode?'Example project loaded. Changes will not be saved.':'Project loaded.');if(settings.open)settings.close();}catch(e){status(e.message);}};
$('save').onclick=async()=>{try{if(exampleMode)throw new Error('Example project is read-only; changes cannot be saved.');finish();if(!manifestURL)throw new Error('Imported bundle has no disk destination. Load a server project before saving, or export the bundle.');const result=await saveProject(project(),manifestURL);saved=serialize(project());errors();status(`Saved ${result.files} files. Reload the runtime preview to see changes.`);}catch(e){status(e.message);}};
$('export').onclick=()=>{if(!project())return;finish();const blob=new Blob([serialize(project())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='project.bundle.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Bundle exported, including extension data.');};
$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(project()&&serialize(project())!==saved&&!confirm('Discard unsaved changes?'))return;try{await install(importBundle(await f.text()),null);status('Bundle imported. Export to save; assets need an HTTP manifest to resolve.');}catch(err){status(err.message);}e.target.value='';};
window.addEventListener('keydown',e=>{
  if(renameDialog.open||settings.open||$('helpDialog').open||e.target.closest('#menuBar'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!$('save').disabled)$('save').click();return;}
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;
  if(e.code==='Space'){e.preventDefault();if(!spaceDown&&gesture&&!gesture.pan)finish(true);spaceDown=true;updateCursor();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();finish();e.shiftKey?history?.redo():history?.undo();refresh();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected();}
  if(e.key==='Escape'){finish(true);selectedTarget=null;pick=null;refresh();chooseTool('select');}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;updateCursor();}});
window.addEventListener('blur',()=>{previewLayer(null);spaceDown=false;finish(true);updateCursor();});
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
workspace=setupWorkspace(draw);setupMenus();
$('cameraOverlay').addEventListener('change',()=>{if(!$('cameraOverlay').checked&&selectedTarget==='camera'){finish(true);selectedTarget=null;refresh();}});
$('reloadProject').onclick=()=>{$('manifest').value=manifestURL||'';$('load').click();};
errors();startEditor();
