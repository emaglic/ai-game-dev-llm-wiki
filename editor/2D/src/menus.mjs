// Disclosure menus use native buttons and checkboxes, with optional arrow navigation.
export function setupMenus(){
  const $=id=>document.getElementById(id),bar=$('menuBar'),buttons=[...bar.querySelectorAll('[data-menu]')];
  let active;
  const items=button=>[...$(button.dataset.menu).querySelectorAll('button:not(:disabled),a:not([hidden]),input')].filter(e=>!e.hidden);
  function close(focus=false){const previous=active;for(const b of buttons){$(b.dataset.menu).hidden=true;b.setAttribute('aria-expanded','false');}active=null;if(focus)previous?.focus();}
  function open(button){close();active=button;$(button.dataset.menu).hidden=false;button.setAttribute('aria-expanded','true');}
  for(const button of buttons){
    button.onclick=()=>active===button?close():open(button);
    button.onpointerenter=()=>{if(active&&active!==button)open(button);};
  }
  bar.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}
    const trigger=e.target.closest('[data-menu]');
    if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const current=active||trigger||buttons[0],next=buttons[(buttons.indexOf(current)+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];if(active)open(next);next.focus();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(trigger&&!active)open(trigger);if(!active)return;const list=items(active);const i=list.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?list.length-1:i<0?(e.key==='ArrowDown'?0:list.length-1):(i+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;list[next]?.focus();}
  });
  bar.addEventListener('click',e=>{if(e.target.closest('.menu-popup button,.menu-popup a'))close();});
  document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target))close();});
  document.addEventListener('focusin',e=>{if(!bar.contains(e.target))close();});
  const dialog=$('helpDialog');
  function help(title,content){$('helpTitle').textContent=title;$('helpContent').innerHTML=content;dialog.showModal();}
  $('shortcutHelp').onclick=()=>help('Editing controls and shortcuts','<dl><dt>Select / move</dt><dd>Click an element on the active layer; drag to move it. Drag resizable object edges to change size.</dd><dt>Paint / place and Rectangle fill</dt><dd>Choose an element in Palette. Drag to paint tiles or fill a rectangle; click to place an object.</dd><dt>Navigation</dt><dd>Wheel to zoom. Space + left drag to pan. View → Fit level to reframe.</dd><dt>Remove</dt><dd>Right-click or right-drag to erase on the active layer. Delete/Backspace removes the selection.</dd><dt>Undo / redo</dt><dd>Ctrl/Cmd+Z to undo. Ctrl/Cmd+Shift+Z to redo.</dd><dt>Save</dt><dd>Ctrl/Cmd+S saves the project when saving is available.</dd><dt>Camera and references</dt><dd>Position camera: drag inside the gold viewport. Pick on canvas: click an allowed destination object.</dd><dt>Cancel</dt><dd>Escape cancels a gesture or reference pick. Locked/hidden layers cannot be edited.</dd><dt>Workspace</dt><dd>View controls overlays and panels. Drag panel dividers to resize; focus a divider and use arrows, Home or End. Reset workspace layout restores panel sizes and visibility.</dd></dl>');
  $('aboutEditor').onclick=()=>help('Example and runtime preview','<p>The example project is demonstration data. Edits stay in memory and cannot be saved to its fixture files.</p><p>Runtime preview is a minimal viewer for checking level data and references. It does not launch your actual game.</p><p>Export project creates one editor backup JSON bundle. Import bundle restores that data; assets are not embedded, and imported bundles have no filesystem save destination.</p>');
  $('closeHelp').onclick=()=>dialog.close();dialog.onkeydown=e=>{if(e.key==='Escape')e.stopPropagation();};
}
