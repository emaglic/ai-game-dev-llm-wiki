import {icon} from './icons.mjs';
// Browser-local workspace preferences never enter a project bundle or undo history.
const key='editor2D.workspace';
export function setupWorkspace(draw){
  const $=id=>document.getElementById(id),main=document.querySelector('main');
  let stored={};try{stored=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  const state={left:290,right:290,leftHidden:false,rightHidden:false,labels:true,ranges:true,references:true,camera:true,grid:true,gridLinked:false,gridColor:"#ffffff",gridOpacity:13,toolbarHistory:true,toolbarTools:true,toolbarGrid:true,toolbarLayers:true,toolbarPalette:true,toolbarLevel:true,layerHoverPreview:true,autoSelectLayer:false};
  for(const name of Object.keys(state))if(typeof stored[name]===typeof state[name]&&(typeof stored[name]!=='number'||Number.isFinite(stored[name])))state[name]=stored[name];
  if(!/^#[0-9a-f]{6}$/i.test(state.gridColor))state.gridColor='#ffffff';state.gridOpacity=Math.max(0,Math.min(100,state.gridOpacity));
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
  function layout(){
    state.left=Math.max(290,Math.min(400,state.left));state.right=Math.max(290,Math.min(440,state.right));
    main.style.setProperty('--left-panel',`${state.leftHidden?0:state.left}px`);main.style.setProperty('--right-panel',`${state.rightHidden?0:state.right}px`);
    $('sidebar').hidden=state.leftHidden;$('inspector').hidden=state.rightHidden;
    for(const side of ['left','right']){const hidden=state[side+'Hidden'];$(side+'Divider').hidden=hidden;$(side+'Divider').setAttribute('aria-valuemin','290');$(side+'Divider').setAttribute('aria-valuemax',side==='left'?'400':'440');$(side+'Divider').setAttribute('aria-valuenow',String(Math.round(state[side])));$(side+'Divider').setAttribute('aria-controls',side==='left'?'sidebar':'inspector');$(side+'PanelToggle').checked=!hidden;const arrow=$(side+'PanelArrow');const chevron=icon('chevron_right');if((side==='left'&&!hidden)||(side==='right'&&hidden))chevron.style.transform='rotate(180deg)';arrow.replaceChildren(chevron);arrow.setAttribute('aria-expanded',String(!hidden));arrow.title=`${hidden?'Show':'Hide'} ${side==='left'?'Layers / Palette':'Properties'} panel`;arrow.setAttribute('aria-label',arrow.title);}
    draw();
  }
  for(const side of ['left','right']){
    const divider=$(side+'Divider');
    divider.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();divider.setPointerCapture(e.pointerId);};
    divider.onpointermove=e=>{if(!divider.hasPointerCapture(e.pointerId))return;const r=main.getBoundingClientRect();state[side]=side==='left'?e.clientX-r.left:r.right-e.clientX;layout();};
    divider.onpointerup=()=>save();divider.onpointercancel=()=>save();
    divider.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();state[side]=e.key==='Home'?290:e.key==='End'?(side==='left'?400:440):state[side]+(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*10;layout();save();};
    $(side+'PanelArrow').onclick=()=>{state[side+'Hidden']=!state[side+'Hidden'];layout();save();};
    $(side+'PanelToggle').onchange=e=>{state[side+'Hidden']=!e.target.checked;layout();save();};
  }
  for(const name of ['labels','ranges','references','camera','grid']){$(name==='grid'?'grid':name+'Overlay').checked=state[name];$(name==='grid'?'grid':name+'Overlay').onchange=e=>{state[name]=e.target.checked;save();draw();};}
  function updateGridLink(){const b=$('gridLink');b.setAttribute('aria-pressed',String(state.gridLinked));b.replaceChildren(icon(state.gridLinked?'link':'link_off'));b.title=state.gridLinked?'Unlink grid sizes':'Link grid sizes proportionally';b.setAttribute('aria-label',b.title);}
  $('gridLink').onclick=()=>{state.gridLinked=!state.gridLinked;updateGridLink();save();};updateGridLink();
  $('gridColor').value=state.gridColor;$('gridOpacity').value=state.gridOpacity;$('gridOpacityValue').textContent=state.gridOpacity+'%';
  $('gridColor').oninput=e=>{state.gridColor=e.target.value;save();draw();};$('gridOpacity').oninput=e=>{state.gridOpacity=Number(e.target.value);$('gridOpacityValue').textContent=state.gridOpacity+'%';save();draw();};
  const options=$('gridOptionsMenu'),optionsButton=$('gridOptionsButton');const closeOptions=()=>{options.hidden=true;optionsButton.setAttribute('aria-expanded','false');};
  optionsButton.onclick=()=>{options.hidden=!options.hidden;optionsButton.setAttribute('aria-expanded',String(!options.hidden));};
  options.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeOptions();optionsButton.focus();}};
  document.addEventListener('pointerdown',e=>{if(!$('gridAppearance').contains(e.target))closeOptions();});document.addEventListener('focusin',e=>{if(!$('gridAppearance').contains(e.target))closeOptions();});
  const toolbarGroups=[['History','historyTools','historyToolbarToggle'],['Tools','tools','toolsToolbarToggle'],['Grid','gridControls','gridToolbarToggle'],['Layers','layerPicker','layersToolbarToggle'],['Palette','palettePicker','paletteToolbarToggle'],['Level','levelNavigation','levelToolbarToggle']];
  function updateToolbar(){for(const [name,id,toggle]of toolbarGroups){$(id).hidden=!state['toolbar'+name];$(toggle).checked=state['toolbar'+name];}}
  for(const [name,id,toggle]of toolbarGroups)$(toggle).onchange=e=>{state['toolbar'+name]=e.target.checked;if(!e.target.checked)for(const b of $(id).querySelectorAll('[aria-expanded=true]')){const popup=$(b.getAttribute('aria-controls'));if(popup)popup.hidden=true;b.setAttribute('aria-expanded','false');}updateToolbar();save();};
  $('resetToolbar').onclick=()=>{for(const [name]of toolbarGroups)state['toolbar'+name]=true;updateToolbar();save();};updateToolbar();
  $('layerHoverPreview').checked=state.layerHoverPreview;$('layerHoverPreview').onchange=e=>{state.layerHoverPreview=e.target.checked;save();draw();};
  $('autoSelectLayer').checked=state.autoSelectLayer;
  $('autoSelectLayer').onchange=e=>{state.autoSelectLayer=e.target.checked;save();draw();};
  for(const [group,buttonId,menuId,inputId] of [
    ['selectOptions','selectOptionsButton','selectOptionsMenu','autoSelectLayer'],
    ['cameraOptions','cameraOptionsButton','cameraOptionsMenu','showCameraElement']
  ]){
    const menu=$(menuId),button=$(buttonId);
    const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');};
    const open=()=>{menu.hidden=false;button.setAttribute('aria-expanded','true');};
    button.onclick=()=>menu.hidden?open():close();
    button.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();open();$(inputId).focus();}};
    menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();button.focus();}};
    document.addEventListener('pointerdown',e=>{if(!$(group).contains(e.target))close();});
    document.addEventListener('focusin',e=>{if(!$(group).contains(e.target))close();});
  }
  $('showCameraElement').checked=state.camera;
  $('showCameraElement').onchange=e=>{$('cameraOverlay').checked=e.target.checked;$('cameraOverlay').dispatchEvent(new Event('change'));};
  const cameraChange=$('cameraOverlay').onchange;
  $('cameraOverlay').onchange=e=>{$('showCameraElement').checked=e.target.checked;cameraChange(e);};
  $('viewGrid').checked=state.grid;
  $('viewGrid').onchange=e=>{$('grid').checked=e.target.checked;$('grid').dispatchEvent(new Event('change'));};
  const gridChange=$('grid').onchange;$('grid').onchange=e=>{gridChange(e);$('viewGrid').checked=state.grid;};
  $('resetWorkspace').onclick=()=>{Object.assign(state,{left:290,right:290,leftHidden:false,rightHidden:false});layout();save();};
  new ResizeObserver(layout).observe(main);
  layout();return state;
}
