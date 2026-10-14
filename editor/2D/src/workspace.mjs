// Browser-local workspace preferences never enter a project bundle or undo history.
const key='editor2D.workspace';
export function setupWorkspace(draw){
  const $=id=>document.getElementById(id),main=document.querySelector('main');
  let stored={};try{stored=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  const state={left:230,right:290,leftHidden:false,rightHidden:false,labels:true,ranges:true,references:true,camera:true,grid:true};
  for(const name of Object.keys(state))if(typeof stored[name]===typeof state[name]&&(typeof stored[name]!=='number'||Number.isFinite(stored[name])))state[name]=stored[name];
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
  function layout(){
    state.left=Math.max(160,Math.min(400,state.left));state.right=Math.max(220,Math.min(440,state.right));
    const available=Math.max(0,main.clientWidth-172),total=(state.leftHidden?0:state.left)+(state.rightHidden?0:state.right),scale=Math.min(1,available/(total||1));
    main.style.setProperty('--left-panel',`${state.leftHidden?0:state.left*scale}px`);main.style.setProperty('--right-panel',`${state.rightHidden?0:state.right*scale}px`);
    $('sidebar').hidden=state.leftHidden;$('inspector').hidden=state.rightHidden;
    for(const side of ['left','right']){const hidden=state[side+'Hidden'];$(side+'Divider').hidden=hidden;$(side+'Divider').setAttribute('aria-valuemin',side==='left'?'160':'220');$(side+'Divider').setAttribute('aria-valuemax',side==='left'?'400':'440');$(side+'Divider').setAttribute('aria-valuenow',String(Math.round(state[side])));$(side+'Divider').setAttribute('aria-controls',side==='left'?'sidebar':'inspector');$(side+'PanelToggle').checked=!hidden;}
    draw();
  }
  for(const side of ['left','right']){
    const divider=$(side+'Divider');
    divider.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();divider.setPointerCapture(e.pointerId);};
    divider.onpointermove=e=>{if(!divider.hasPointerCapture(e.pointerId))return;const r=main.getBoundingClientRect();state[side]=side==='left'?e.clientX-r.left:r.right-e.clientX;layout();};
    divider.onpointerup=()=>save();divider.onpointercancel=()=>save();
    divider.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();state[side]=e.key==='Home'?(side==='left'?160:220):e.key==='End'?(side==='left'?400:440):state[side]+(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*10;layout();save();};
    $(side+'PanelToggle').onchange=e=>{state[side+'Hidden']=!e.target.checked;layout();save();};
  }
  for(const name of ['labels','ranges','references','camera','grid']){$(name==='grid'?'grid':name+'Overlay').checked=state[name];$(name==='grid'?'grid':name+'Overlay').onchange=e=>{state[name]=e.target.checked;save();draw();};}
  const menu=$('viewMenu'),button=$('viewButton');
  const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');};
  button.onclick=()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));};
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#viewControls'))close();});
  menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();button.focus();}};
  new ResizeObserver(layout).observe(main);
  layout();return state;
}
