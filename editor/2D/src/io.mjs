import {validateDocument, assertProject, serialize} from './model.mjs';
let revision;
export function resolvePath(manifestURL,path){return new URL(path,manifestURL).href;}
export async function loadProject(url,fetcher=fetch){
  if(typeof url!=='string'||!url.trim())throw new Error('Enter a project manifest URL before loading.');
  const manifestURL=new URL(url,globalThis.location?.href||'http://localhost/').href;
  revision=undefined;
  try{const r=await fetcher('/api/revision',{cache:'no-store'});if(r.ok)revision=(await r.json()).revision;}catch{/* Static-server import/export remains available. */}
  async function read(path){const r=await fetcher(path,{cache:'no-store'});if(!r.ok)throw new Error(`Cannot load ${path}: HTTP ${r.status}`);try{return await r.json();}catch{throw new Error(`Invalid JSON in ${path}`);}}
  const manifest=await read(manifestURL),errors=validateDocument(manifest,'manifest');if(errors.length)throw new Error(errors.join('\n'));
  const [settings,catalog,levels]=await Promise.all([read(resolvePath(manifestURL,manifest.settings)),read(resolvePath(manifestURL,manifest.catalog)),Promise.all(manifest.levels.map(async l=>[l.id,await read(resolvePath(manifestURL,l.path))]))]);
  return {project:assertProject({manifest,settings,catalog,levels:Object.fromEntries(levels)}),manifestURL};
}
export async function saveProject(project,manifestURL,fetcher=fetch){
  assertProject(project);
  const response=await fetcher('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:serialize({manifestURL,project,revision})});
  if(!response.ok)throw new Error(await response.text());const result=await response.json();revision=result.revision;return result;
}
export function importBundle(text){const p=JSON.parse(text);return assertProject(p);}
