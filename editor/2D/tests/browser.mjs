// No npm dependencies. Drive an installed Chromium browser with native CDP/WebSocket.
import {spawn} from 'node:child_process';
import {mkdtemp,cp,readFile,rm,access,writeFile,mkdir} from 'node:fs/promises';
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
  async function change(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
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
  await click('#fit');await click('#layers .row:nth-child(2) .name');await change('#tool','rectangle');await drag([32,32],[90,90]);p=await bundle();assert.equal(p.levels.atrium.layers[1].tiles.filter(t=>t.x>=1&&t.x<=2&&t.y>=1&&t.y<=2).length,4);await click('#undo');p=await bundle();assert.equal(p.levels.atrium.layers[1].tiles.some(t=>t.x===1&&t.y===1),false);await click('#redo');
  await click('#layers .row:nth-child(3) .name');await change('#tool','select');await drag([370,210],[402,242]);p=await bundle();assert.equal(p.levels.atrium.layers[2].objects.find(o=>o.type==='trigger').x,384);
  await change('#tool','resize');await drag([410,240],[442,272]);p=await bundle();assert.equal(p.levels.atrium.layers[2].objects.find(o=>o.type==='trigger').width,96);
  // Layer locking blocks transforms and paints.
  await click('[aria-label="Locked actors"]');await change('#tool','select');await drag([410,240],[506,336]);p=await bundle();assert.equal(p.levels.atrium.layers[2].objects.find(o=>o.type==='trigger').x,384);await click('[aria-label="Locked actors"]');
  // Teleporter type-specific picker and cross-level canvas selection.
  await change('#tool','select');await drag([555,270],[555,270]);assert.equal(await evaluate("document.querySelector('[aria-label=\"Destination destination object\"]').options.length"),2);
  await change('[aria-label="Destination destination level"]','atrium');assert.equal(await evaluate("document.querySelector('[aria-label=\"Destination destination object\"]').options.length"),3);
  await evaluate("Array.from(document.querySelectorAll('#properties button')).find(b=>b.textContent==='Pick on canvas').click()");await change('#levels','garden');await click('#fit');await drag([235,270],[235,270]);p=await bundle();assert.deepEqual(p.levels.atrium.layers[2].objects[0].properties.destination,{level:'garden',object:'garden-portal'});
  // Deletion reports reference breakage; undo repairs it.
  await click('#layers .row:nth-child(3) .name');await change('#tool','select');await drag([235,270],[235,270]);await click('#delete');assert.match(await evaluate("document.getElementById('errors').textContent"),/broken reference/);assert.equal(await evaluate("document.getElementById('save').disabled"),true);await click('#undo');assert.equal(await evaluate("document.getElementById('errors').textContent"),'');
  await click('#save');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Saved 4')"),'Second save failed');
  // Import/export works without the local write API and preserves extension values.
  const exported=await bundle();await evaluate(`(()=>{const input=document.getElementById('import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(exported))}],'roundtrip.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Bundle imported')"),'Bundle import failed');assert.deepEqual(await bundle(),exported);
  await click('#load');await until(()=>evaluate("document.getElementById('status').textContent.startsWith('Enter a project manifest URL')"),'Imported bundle should require a manifest URL for HTTP loading');
  await change('#manifest',url.split('?project=')[1]);await click('#load');await until(()=>evaluate("document.getElementById('status').textContent==='Project loaded.'"),'Server project reload after import failed');
  // Load the actual fixture runtime; it consumes the saved camera and world documents.
  const preview=await evaluate("document.getElementById('preview').href");await call('Page.navigate',{url:preview});await until(()=>evaluate("document.getElementById('levels')?.options.length===2"),'Runtime preview failed');assert.equal(await evaluate("document.getElementById('status').textContent"),'');assert.ok(await evaluate("document.getElementById('canvas').width>0"));
  assert.deepEqual(runtimeErrors,[]);
  console.log('Browser passed: fixture load, typed camera edits, undo/redo, rectangle fill, move/resize, layer lock, cross-level picker, broken-reference feedback, save/reload, and runtime preview.');
}finally{
  ws?.close();browser?.kill();server?.kill();await wait(500);
  try{await rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:200});}catch(e){console.warn(`Temporary browser profile cleanup failed: ${temporary}: ${e.message}`);}
}
