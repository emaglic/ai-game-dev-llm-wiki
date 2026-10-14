// No npm dependencies. Drive an installed Chromium browser with native CDP/WebSocket.
import {spawn} from 'node:child_process';
import {mkdtemp,cp,readFile,rm,access,writeFile,mkdir,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),temporary=await mkdtemp(join(tmpdir(),'editor-2d-test-'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){const end=Date.now()+15000;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch{}await wait(100);}throw new Error(message);}
let server,browser,ws;
try{
  await cp(join(root,'fixture'),join(temporary,'project'),{recursive:true});
  const candidates=[process.argv[2],process.env.CHROME_PATH,'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);
  let executable;for(const p of candidates){try{await access(p);executable=p;break;}catch{}}if(!executable)throw new Error('No Chromium executable found; pass its path as the first argument.');
  server=spawn('python',[join(root,'server.py'),'--project',join(temporary,'project/game.project.json'),'--port','0'],{windowsHide:true});let stdout='',serverErrors='';server.stdout.on('data',d=>stdout+=d);server.stderr.on('data',d=>serverErrors+=d);server.on('error',e=>serverErrors+=e.message);
  const url=await until(()=>stdout.match(/http:\/\/[^\s]+/)?.[0],`Server failed: ${serverErrors}`);
  browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${join(temporary,'profile')}`,'--window-size=1440,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
  const port=await until(async()=>Number((await readFile(join(temporary,'profile/DevToolsActivePort'),'utf8')).split('\n')[0]),'Browser did not expose CDP');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let serial=0;const pending=new Map(),runtimeErrors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const callbacks=pending.get(m.id);pending.delete(m.id);m.error?callbacks?.reject(new Error(JSON.stringify(m.error))):callbacks?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params.exceptionDetails.text+' '+(m.params.exceptionDetails.exception?.description||''));};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url});
  await until(()=>evaluate("document.getElementById('status')?.textContent==='Project loaded.'"),'Editor fixture did not load');
  assert.equal(await evaluate("document.getElementById('errors').textContent"),'');
  if(process.env.EDITOR_SCREENSHOT){const shot=await call('Page.captureScreenshot',{format:'png'});await mkdir(resolve(process.env.EDITOR_SCREENSHOT,'..'),{recursive:true});await writeFile(process.env.EDITOR_SCREENSHOT,Buffer.from(shot.data,'base64'));}
  assert.equal(await evaluate("document.getElementById('levels').options.length"),2);
  assert.ok(await evaluate("document.querySelector('input[aria-label=\"Game camera zoom\"]')"));
  async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
  async function change(selector,value){if(selector==='#tool'){await click(`#tools [data-tool="${value}"]`);return;}await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  assert.equal(await evaluate("document.getElementById('tool')"),null);assert.equal(await evaluate("document.querySelectorAll('#tools button').length"),5);await click('#tools [data-tool="paint"]');assert.equal(await evaluate("document.querySelectorAll('#tools [aria-pressed=true]').length"),1);await evaluate("document.querySelector('#tools [data-tool=paint]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");assert.equal(await evaluate("document.querySelector('#tools [data-tool=rectangle]').getAttribute('aria-pressed')"),'true');await click('#tools [data-tool="select"]');
  // Menu navigation, dismissals and modal cancellation do not change the project source.
  await click('#projectButton');assert.equal(await evaluate("document.getElementById('projectMenu').hidden"),false);
  await evaluate("document.getElementById('projectButton').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");assert.equal(await evaluate("document.getElementById('viewMenu').hidden"),false);assert.equal(await evaluate("document.getElementById('projectMenu').hidden"),true);
  await evaluate("document.getElementById('viewButton').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");assert.equal(await evaluate('document.activeElement.id'),'fit');
  await evaluate("document.getElementById('fit').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");assert.equal(await evaluate("document.getElementById('viewMenu').hidden"),true);assert.equal(await evaluate('document.activeElement.id'),'viewButton');
  const manifestBefore=await evaluate("document.getElementById('manifest').value");await click('#setManifest');await change('#manifest','invalid.json');await click('#closeSettings');assert.equal(await evaluate("document.getElementById('manifest').value"),manifestBefore);
  await click('#shortcutHelp');assert.equal(await evaluate("document.getElementById('helpDialog').open"),true);assert.match(await evaluate("document.getElementById('helpContent').textContent"),/Right-click/);await click('#closeHelp');
  assert.equal(await evaluate("document.getElementById('save').closest('nav')!==null"),true);
  console.log('Menus passed: exclusive opening, keyboard navigation, Escape, manifest cancellation and readable help.');
  assert.equal(await evaluate("document.querySelectorAll('.layer-header-state[data-state]').length"),6);assert.equal(await evaluate("document.querySelectorAll('.layer-controls input[type=checkbox]').length"),0);
  await click('#layers .layer-card[data-layer=ground] [data-state=visible]');assert.equal(await evaluate("document.querySelector('#layers .layer-card[data-layer=ground]').open"),false);assert.equal(await evaluate("document.querySelector('#layers .layer-card[data-layer=ground] [data-state=visible]').getAttribute('aria-pressed')"),'false');await click('#layers .layer-card[data-layer=ground] [data-state=visible]');await click('#undo');await click('#undo');
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#layers .layer-card'),e=>e.dataset.layer)"),['actors','decoration','ground']);
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Raise actors\"]').disabled"),true);assert.equal(await evaluate("document.querySelector('[aria-label=\"Lower ground\"]').disabled"),true);
  await click('[aria-label="Raise ground"]');assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#layers .layer-card'),e=>e.dataset.layer)"),['actors','ground','decoration']);await click('#undo');
  // Export captures a Blob without depending on a browser download folder.
  await evaluate("window.__blobs=[];window.__originalURL=URL.createObjectURL;URL.createObjectURL=b=>{window.__blobs.push(b);return window.__originalURL(b)}");
  async function bundle(){await evaluate("if(!window.__blobs){window.__blobs=[];window.__originalURL=URL.createObjectURL;URL.createObjectURL=b=>{window.__blobs.push(b);return window.__originalURL(b)}}");await click('#export');return JSON.parse(await evaluate('window.__blobs.at(-1).text()'));}
  let p=await bundle();assert.equal(p.levels.atrium.extensions.fixture,true);
  // Camera slider/input updates saved data, while wheel navigation remains transient.
  await change('[aria-label="Game camera zoom"]','2');p=await bundle();assert.equal(p.levels.atrium.settings.cameraZoom,2);
  await click('#undo');p=await bundle();assert.equal(p.levels.atrium.settings.cameraZoom,1);await click('#redo');
  await click('#save');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Saved 4')"),'Save did not complete');
  assert.equal(JSON.parse(await readFile(join(temporary,'project/data/levels/atrium.json'),'utf8')).settings.cameraZoom,2);
  await call('Page.reload');await until(()=>evaluate("document.getElementById('status')?.textContent==='Project loaded.'"),'Reload failed');assert.equal(await evaluate("document.querySelector('[aria-label=\"Game camera zoom\"]').value"),'2');
  // Force a known screen transform with Fit and derive coordinates from dimensions.
  async function screen(x,y){return evaluate(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect(),z=Math.max(.05,Math.min((r.width-60)/800,(r.height-60)/480));return{x:r.left+(r.width-800*z)/2+${x}*z,y:r.top+(r.height-480*z)/2+${y}*z};})()`);}
  async function drag(a,b){const start=await screen(...a),end=await screen(...b);await call('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});}
  await click('#fit');await click('#layers .layer-card[data-layer=decoration] .name');await change('#tool','select');await click('#snap');const beforePixels=await bundle();await drag([140,75],[153,80]);let pixelData=await bundle();const pixelTile=pixelData.levels.atrium.layers[1].tiles.find(t=>t.x===141&&t.y===69);assert.ok(pixelTile);assert.equal(pixelTile.width,32);assert.equal(pixelTile.height,32);assert.equal(await evaluate("document.querySelector('[aria-label=\"Tile X\"]').value"),'141');await drag([153,80],[153,80]);assert.deepEqual(await bundle(),pixelData);await click('#undo');assert.deepEqual(await bundle(),beforePixels);await click('#redo');assert.deepEqual(await bundle(),pixelData);await click('#undo');
  await change('#tool','paint');await drag([100,130],[100,130]);pixelData=await bundle();assert.ok(pixelData.levels.atrium.layers[1].tiles.some(t=>t.x===100&&t.y===130&&t.width===32));await click('#undo');assert.deepEqual(await bundle(),beforePixels);await click('#snap');
  console.log('Pixel tiles passed: unsnapped 1px drag/painting, independent dimensions, pixel inspector, selection without snapping, and undo/redo.');
  await click('#fit');await change('#tool','camera');const cameraBefore=await bundle();await drag([400,240],[432,272]);let cameraAfter=await bundle();assert.deepEqual(cameraAfter.levels.atrium.settings.camera,{x:448,y:288});assert.deepEqual(cameraAfter.levels.atrium.layers,cameraBefore.levels.atrium.layers);await click('#undo');assert.deepEqual(await bundle(),cameraBefore);await click('#redo');assert.deepEqual(await bundle(),cameraAfter);await click('#undo');
  await click('#snap');await drag([400,240],[413,247]);cameraAfter=await bundle();assert.deepEqual(cameraAfter.levels.atrium.settings.camera,{x:413,y:247});await click('#undo');await drag([100,100],[150,150]);assert.deepEqual(await bundle(),cameraBefore);await drag([400,240],[400,240]);assert.deepEqual(await bundle(),cameraBefore);await click('#snap');
  const cameraStart=await screen(400,240),cameraEnd=await screen(432,272);await call('Input.dispatchMouseEvent',{type:'mousePressed',...cameraStart,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',...cameraEnd,button:'left',buttons:1});await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...cameraEnd,button:'left',clickCount:1});assert.deepEqual(await bundle(),cameraBefore);
  assert.equal(await evaluate("document.querySelector('#tool option[value=erase]')"),null);assert.equal(await evaluate("document.getElementById('delete')"),null);console.log('Camera drag passed: relative movement, grid/1px snapping, click and outside-viewport protection, undo/redo and cancellation.');
  // Workspace controls change the view only, persist locally, and remain keyboard accessible.
  const workspaceBefore=await bundle();
  await click('#viewButton');assert.equal(await evaluate("document.getElementById('viewMenu').hidden"),false);
  await click('#labelsOverlay');await click('#rangesOverlay');await click('#referencesOverlay');await click('#cameraOverlay');
  const canvasWidth=await evaluate("document.getElementById('canvas').getBoundingClientRect().width");
  await click('#leftPanelArrow');assert.equal(await evaluate("document.getElementById('sidebar').hidden"),true);assert.ok(await evaluate("document.getElementById('canvas').getBoundingClientRect().width")>canvasWidth);
  assert.equal(await evaluate("document.getElementById('leftPanelArrow').getAttribute('aria-expanded')"),'false');assert.ok(await evaluate("document.getElementById('leftPanelArrow').getBoundingClientRect().width")>0);await click('#leftPanelArrow');
  await evaluate("document.getElementById('rightDivider').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
  assert.equal(await evaluate("document.getElementById('rightDivider').getAttribute('aria-valuenow')"),'300');
  assert.deepEqual(await bundle(),workspaceBefore);
  await call('Page.reload');await until(()=>evaluate("document.getElementById('status').textContent==='Project loaded.'"),'Workspace reload failed');
  assert.equal(await evaluate("document.getElementById('labelsOverlay').checked"),false);assert.equal(await evaluate("document.getElementById('rightDivider').getAttribute('aria-valuenow')"),'300');
  await click('#viewButton');for(const id of ['labelsOverlay','rangesOverlay','referencesOverlay','cameraOverlay'])await click('#'+id);
  await evaluate("document.getElementById('rightDivider').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
  await click('#viewButton');await click('#fit');
  await click('#leftPanelArrow');await click('#rightPanelArrow');assert.equal(await evaluate("document.getElementById('rightPanelArrow').getAttribute('aria-expanded')"),'false');await click('#resetWorkspace');assert.equal(await evaluate("document.getElementById('sidebar').hidden||document.getElementById('inspector').hidden"),false);assert.equal(await evaluate("document.getElementById('rightDivider').getAttribute('aria-valuenow')"),'290');assert.deepEqual(await bundle(),workspaceBefore);await click('#fit');
  console.log('Workspace passed: overlay toggles, panel collapse/resize, local persistence and unchanged project data.');
  assert.equal(await evaluate("document.querySelectorAll('#layers details[open]').length"),0);
  await click('#fit');await click('#layers .layer-card[data-layer=decoration] .name');assert.equal(await evaluate("document.querySelector('#layers .layer-card[data-layer=decoration]').open"),false);await click('#layers .layer-card[data-layer=decoration] .layer-toggle');assert.equal(await evaluate("document.querySelector('#layers .layer-card[data-layer=decoration]').open"),true);await change('#tool','rectangle');await drag([32,32],[90,90]);p=await bundle();assert.equal(p.levels.atrium.layers[1].tiles.filter(t=>t.x>=32&&t.x<=64&&t.y>=32&&t.y<=64).length,4);await click('#undo');p=await bundle();assert.equal(p.levels.atrium.layers[1].tiles.some(t=>t.x===32&&t.y===32),false);await click('#redo');
  await click('#layers .layer-card[data-layer=actors] .name');await change('#tool','select');await drag([370,210],[402,242]);p=await bundle();assert.equal(p.levels.atrium.layers[2].objects.find(o=>o.type==='trigger').x,384);
  await change('#tool','resize');await drag([410,240],[442,272]);p=await bundle();assert.equal(p.levels.atrium.layers[2].objects.find(o=>o.type==='trigger').width,96);
  // Layer locking blocks transforms and paints.
  await click('#layers .layer-card[data-layer=actors] .layer-toggle');await click('#layers [data-layer="actors"] [data-state="locked"]');await change('#tool','select');await drag([410,240],[506,336]);p=await bundle();assert.equal(p.levels.atrium.layers[2].objects.find(o=>o.type==='trigger').x,384);await click('#layers [data-layer="actors"] [data-state="locked"]');
  // Teleporter type-specific picker and cross-level canvas selection.
  await change('#tool','select');await drag([555,270],[555,270]);assert.equal(await evaluate("document.querySelector('[aria-label=\"Destination destination object\"]').options.length"),2);
  await change('[aria-label="Destination destination level"]','atrium');assert.equal(await evaluate("document.querySelector('[aria-label=\"Destination destination object\"]').options.length"),3);
  await evaluate("Array.from(document.querySelectorAll('#properties button')).find(b=>b.textContent==='Pick on canvas').click()");assert.equal(await evaluate("document.getElementById('pickNotice').hidden"),false);assert.equal(await evaluate("document.getElementById('canvas').style.cursor"),'crosshair');await change('#levels','garden');await click('#fit');await drag([235,270],[235,270]);p=await bundle();assert.deepEqual(p.levels.atrium.layers[2].objects[0].properties.destination,{level:'garden',object:'garden-portal'});assert.equal(await evaluate("document.getElementById('pickNotice').hidden"),true);
  // Deletion reports reference breakage; undo repairs it.
  await click('#layers .layer-card[data-layer=actors] .name');await change('#tool','select');await drag([235,270],[235,270]);await evaluate("document.getElementById('canvas').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46});assert.match(await evaluate("document.getElementById('errors').textContent"),/broken reference/);assert.equal(await evaluate("document.getElementById('save').disabled"),true);await click('#undo');assert.equal(await evaluate("document.getElementById('errors').textContent"),'');
  await click('#save');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Saved 4')"),'Second save failed');
  // Per-axis grid, automatic edge resizing, pixel increments, and one gesture per undo.
  await change('#gridX','16');await change('#gridY','24');p=await bundle();assert.deepEqual(p.levels.garden.extensions.editor2D.grid,{x:16,y:24});assert.equal(p.levels.garden.grid,32);
  await change('#tool','select');await drag([416,220],[448,220]);p=await bundle();assert.equal(p.levels.garden.layers[2].objects.find(o=>o.id==='garden-trigger').width,96);assert.equal(p.levels.garden.layers[2].objects.find(o=>o.id==='garden-trigger').x,352);
  await click('#undo');p=await bundle();assert.equal(p.levels.garden.layers[2].objects.find(o=>o.id==='garden-trigger').width,64);await click('#redo');
  await click('#snap');await drag([448,220],[451,220]);p=await bundle();assert.equal(p.levels.garden.layers[2].objects.find(o=>o.id==='garden-trigger').width,99);await click('#snap');
  // Space panning takes precedence over every normal left-click editing tool.
  for(const tool of ['paint','rectangle','select','resize','camera']){
    await change('#tool',tool);const before=await bundle(),picture=await evaluate("document.getElementById('canvas').toDataURL()");await evaluate("document.getElementById('canvas').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await drag([370,210],[420,260]);await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});assert.notEqual(await evaluate("document.getElementById('canvas').toDataURL()"),picture);assert.deepEqual(await bundle(),before);await click('#fit');
  }
  // Clicking a tile in the selected layer enables keyboard deletion and undo.
  await click('#layers .layer-card[data-layer=decoration] .name');await change('#tool','select');await drag([140,75],[140,75]);const beforeDelete=await bundle();await evaluate("document.getElementById('canvas').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46});p=await bundle();assert.equal(p.levels.garden.layers[1].tiles.length,beforeDelete.levels.garden.layers[1].tiles.length-1);await click('#undo');assert.deepEqual(await bundle(),beforeDelete);
  await click('#save');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Saved 4')"),'Grid metadata save failed');assert.deepEqual(JSON.parse(await readFile(join(temporary,'project/data/levels/garden.json'),'utf8')).extensions.editor2D.grid,{x:16,y:24});
  // Level dimensions are editable without pruning or scaling authored content.
  const beforeResize=await bundle();
  await change('[aria-label="Level width"]','960');await change('[aria-label="Level height"]','576');assert.equal((await bundle()).levels.garden.width,800);await click('#applyResize');
  let resized=await bundle();assert.equal(resized.levels.garden.width,960);assert.equal(resized.levels.garden.height,576);assert.deepEqual(resized.levels.garden.layers,beforeResize.levels.garden.layers);assert.deepEqual(resized.levels.garden.settings,beforeResize.levels.garden.settings);
  await change('[aria-label="Level width"]','64');await click('#applyResize');assert.equal(await evaluate("document.getElementById('boundsNotice').hidden"),false);assert.equal(await evaluate("document.getElementById('save').disabled"),false);await click('#undo');assert.equal((await bundle()).levels.garden.width,960);await click('#redo');assert.equal((await bundle()).levels.garden.width,64);await click('#undo');
  await change('[aria-label="Level height"]','0');assert.equal((await bundle()).levels.garden.height,576);assert.equal(await evaluate("document.getElementById('applyResize').disabled"),true);await change('[aria-label="Level height"]','576');
  const beforeAnchored=await bundle();await change('[aria-label="Level width"]','1024');await click('[aria-label="Top-right anchor"]');await click('#applyResize');const anchored=await bundle();assert.equal(anchored.levels.garden.width,1024);assert.equal(anchored.levels.garden.layers[0].tiles[0].x,beforeAnchored.levels.garden.layers[0].tiles[0].x+64);assert.equal(anchored.levels.garden.layers[2].objects[0].x,beforeAnchored.levels.garden.layers[2].objects[0].x+64);assert.equal(anchored.levels.garden.settings.camera.x,beforeAnchored.levels.garden.settings.camera.x+64);assert.equal(anchored.levels.garden.layers[2].objects[1].properties.facing.x,1);await click('#undo');assert.deepEqual(await bundle(),beforeAnchored);
  await click('[aria-label="Center anchor"]');await change('[aria-label="Level width"]','961');assert.equal(await evaluate("document.getElementById('applyResize').disabled"),false);assert.match(await evaluate("document.getElementById('resizePreview').textContent"),/1px X/);await change('[aria-label="Level width"]','960');await click('[aria-label="Top-left anchor"]');
  await click('#save');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Saved 4')"),'Resized level save failed');
  const resizedDisk=JSON.parse(await readFile(join(temporary,'project/data/levels/garden.json'),'utf8'));assert.equal(resizedDisk.width,960);assert.equal(resizedDisk.height,576);assert.deepEqual(resizedDisk.layers,beforeResize.levels.garden.layers);
  await call('Page.reload');await until(()=>evaluate("document.getElementById('status')?.textContent==='Project loaded.'"),'Resized level reload failed');await change('#levels','garden');assert.equal(await evaluate("document.querySelector('[aria-label=\"Level width\"]').value"),'960');assert.equal(await evaluate("document.querySelector('[aria-label=\"Level height\"]').value"),'576');
  console.log('Level resize passed: editable dimensions, content/camera preservation, bounds notice, undo/redo, invalid-input rejection and save/reload.');
  // Import/export works without the local write API and preserves extension values.
  const exported=await bundle();await evaluate(`(()=>{const input=document.getElementById('import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(exported))}],'roundtrip.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Bundle imported')"),'Bundle import failed');assert.deepEqual(await bundle(),exported);
  await click('#load');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Enter a project manifest URL')"),'Imported bundle should require a manifest URL for HTTP loading');
  await change('#manifest',url.split('?project=')[1]);await click('#load');await until(()=>evaluate("document.getElementById('status').textContent==='Project loaded.'"),'Server project reload after import failed');
  // Load the actual fixture runtime; it consumes the saved camera and world documents.
  const preview=await evaluate("document.getElementById('preview').href");await call('Page.navigate',{url:preview});await until(()=>evaluate("document.getElementById('levels')?.options.length===2"),'Runtime preview failed');assert.equal(await evaluate("document.getElementById('status').textContent"),'');assert.ok(await evaluate("document.getElementById('canvas').width>0"));
  // A server with no game manifest offers an explicit, read-only example.
  await rename(join(temporary,'project/game.project.json'),join(temporary,'project/game.project.json.backup'));
  await call('Page.navigate',{url:new URL('/editor/index.html',url).href});
  await until(()=>evaluate("document.getElementById('noProject')?.hidden===false"),'Missing-project prompt did not appear');
  assert.equal(await evaluate("document.getElementById('levels').options.length"),0);
  assert.equal(await evaluate("document.getElementById('save').disabled"),true);
  await click('#loadExample');
  await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Example project loaded')"),'Explicit example did not load');
  assert.equal(await evaluate("document.getElementById('projectMode').hidden"),false);
  assert.equal(await evaluate("document.getElementById('save').disabled"),true);
  await change('[aria-label="Game camera zoom"]','2');
  assert.equal(await evaluate("document.getElementById('save').disabled"),true);
  assert.match(await evaluate("document.getElementById('dirty').textContent"),/Example edits/);
  const example=await bundle();
  const rejected=await evaluate(`fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({manifestURL:location.origin+'/editor/fixture/game.project.json',project:${JSON.stringify(example)}})}).then(async r=>({status:r.status,text:await r.text()}))`);
  assert.equal(rejected.status,403);assert.match(rejected.text,/read-only/);
  await click('#setManifest');assert.equal(await evaluate("document.getElementById('editorSettings').open"),true);
  assert.equal(await evaluate("document.getElementById('manifest').closest('header')===null"),true);
  assert.ok(await evaluate("document.getElementById('manifest').getBoundingClientRect().width>0"));
  await click('#closeSettings');assert.equal(await evaluate("document.getElementById('editorSettings').open"),false);
  console.log('Dedicated-project flow passed: missing-game prompt, explicit example loading, persistent example label, disabled saving, server-side rejection, and editor settings.');
  assert.deepEqual(runtimeErrors,[]);
  console.log('Browser passed: accordion layers, per-axis grid persistence, edge resizing, Space panning across tools, tile deletion, fixture load, typed properties, undo/redo, references, import/export, save/reload and runtime preview.');
}finally{
  ws?.close();browser?.kill();server?.kill();await wait(500);
  try{await rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});}catch(e){console.warn(`Temporary browser profile cleanup failed: ${temporary}: ${e.message}`);}
}
