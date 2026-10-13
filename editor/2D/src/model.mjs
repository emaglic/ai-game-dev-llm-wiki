// Shared by editor, fixture runtime, and future game runtimes. No DOM dependencies.
import {validateAppearance} from './appearance.mjs';
export const VERSION = 1;
export const LEVEL_VERSION = 2;
export const clone = value => structuredClone(value);
export const propertyTypes = new Set(['number','integer','boolean','string','enum','color','asset','position','objectRef']);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function validateDocument(doc, kind) {
  const errors = [], add = (p,m) => errors.push(`${kind}.${p}: ${m}`);
  if (!plain(doc)) return [`${kind}: expected an object`];
  const expected=kind==='level'?LEVEL_VERSION:VERSION;
  if(doc.version!==expected)add('version',`unsupported version ${doc.version}; expected ${expected}${kind==='level'&&doc.version===1?'. Convert with python editor/2D/migrate_levels.py --project PATH --apply':''}`);
  const str = (v,p) => { if(typeof v !== 'string' || !v) add(p,'expected nonempty string'); };
  const num = (v,p,min=0) => { if(!finite(v)||v<min) add(p,`expected finite number >= ${min}`); };
  const defs = (v,p) => {
    if(!plain(v)) {add(p,'expected property definitions object');return;}
    for(const [key,d] of Object.entries(v)) {
      if(!plain(d)) {add(`${p}.${key}`,'expected definition object');continue;}
      if(!propertyTypes.has(d.type)) add(`${p}.${key}.type`, `unsupported property type ${d.type}`);
      if(d.type==='enum' && (!Array.isArray(d.options)||!d.options.length||d.options.some(x=>typeof x!=='string'))) add(`${p}.${key}.options`,'expected nonempty string array');
      for(const name of ['min','max','step']) if(d[name]!==undefined && (!finite(d[name])||(name==='step'&&d[name]<=0))) add(`${p}.${key}.${name}`,'invalid numeric constraint');
      if(d.min!==undefined&&d.max!==undefined&&d.min>d.max) add(`${p}.${key}`,'min exceeds max');
      if(d.targets!==undefined&&(!Array.isArray(d.targets)||d.targets.some(x=>typeof x!=='string'))) add(`${p}.${key}.targets`,'expected type IDs');
      if(d.maxLength!==undefined&&(!Number.isInteger(d.maxLength)||d.maxLength<0))add(`${p}.${key}.maxLength`,'expected nonnegative integer');
      if(d.space!==undefined&&!['world','local'].includes(d.space))add(`${p}.${key}.space`,'expected world or local');
      if(d.default!==undefined) for(const e of validateValue(d.default,d,`${p}.${key}.default`)) add('',e);
      if(d.overlay!==undefined && (!plain(d.overlay)||!['radius','connection','box'].includes(d.overlay.kind))) add(`${p}.${key}.overlay`,'unsupported overlay kind');
    }
  };
  if(kind==='manifest') {
    str(doc.settings,'settings');str(doc.catalog,'catalog');str(doc.assets,'assets');
    if(doc.assetFiles!==undefined&&(!Array.isArray(doc.assetFiles)||doc.assetFiles.some(x=>typeof x!=='string'||!x)))add('assetFiles','expected asset filename array');
    if(!Array.isArray(doc.levels)||!doc.levels.length) add('levels','expected nonempty array');
    else {const ids=new Set();doc.levels.forEach((l,i)=>{if(!plain(l)){add(`levels[${i}]`,'expected object');return;}str(l.id,`levels[${i}].id`);str(l.path,`levels[${i}].path`);if(ids.has(l.id))add(`levels[${i}].id`,'duplicate');ids.add(l.id);});}
  } else if(kind==='settings') {
    num(doc.viewport?.width,'viewport.width',1);num(doc.viewport?.height,'viewport.height',1);
    defs(doc.properties,'properties');if(!plain(doc.values))add('values','expected object');
  } else if(kind==='catalog') {
    defs(doc.levelProperties,'levelProperties');
    if(!Array.isArray(doc.elements)) add('elements','expected array');
    else {const ids=new Set();doc.elements.forEach((e,i)=>{const p=`elements[${i}]`;if(!plain(e)){add(p,'expected object');return;}errors.push(...validateAppearance(e,`catalog.${p}`));str(e.id,`${p}.id`);if(ids.has(e.id))add(`${p}.id`,'duplicate');ids.add(e.id);if(!['tile','object'].includes(e.kind))add(`${p}.kind`,'expected tile or object');defs(e.properties,`${p}.properties`);if(e.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(e.color))add(`${p}.color`,'expected #rrggbb');if(e.asset!==undefined)str(e.asset,`${p}.asset`);if(e.size!==undefined){num(e.size?.width,`${p}.size.width`,1);num(e.size?.height,`${p}.size.height`,1);if(e.kind==='tile')for(const axis of ['width','height'])if(!Number.isInteger(e.size?.[axis]))add(`${p}.size.${axis}`,'tile placement sizes must be integer pixels');}if(e.resizable!==undefined&&typeof e.resizable!=='boolean')add(`${p}.resizable`,'expected boolean');});}
  } else if(kind==='level') {
    str(doc.id,'id');num(doc.width,'width',1);num(doc.height,'height',1);num(doc.grid,'grid',1);if(!Number.isInteger(doc.grid))add('grid','expected whole-pixel grid spacing');
    for(const axis of ['width','height'])if(!Number.isInteger(doc.tileSize?.[axis])||doc.tileSize[axis]<1)add(`tileSize.${axis}`,'expected positive integer pixel size');
    if(doc.extensions?.editor2D!==undefined){if(!plain(doc.extensions.editor2D))add('extensions.editor2D','expected editor metadata object');else if(doc.extensions.editor2D.grid!==undefined){const g=doc.extensions.editor2D.grid;if(!plain(g))add('extensions.editor2D.grid','expected {x,y} grid sizes');else for(const axis of ['x','y'])if(!Number.isInteger(g[axis])||g[axis]<1)add(`extensions.editor2D.grid.${axis}`,'expected positive integer pixels');}}
    if(!plain(doc.settings)) add('settings','expected object');
    if(!Array.isArray(doc.layers))add('layers','expected array');
    else {const layers=new Set(),objects=new Set();doc.layers.forEach((l,i)=>{
      const p=`layers[${i}]`;if(!plain(l)){add(p,'expected object');return;}str(l.id,`${p}.id`);if(layers.has(l.id))add(`${p}.id`,'duplicate');layers.add(l.id);
      if(!['tile','object'].includes(l.kind))add(`${p}.kind`,'unsupported layer kind');
      if(typeof l.visible!=='boolean'||typeof l.locked!=='boolean')add(p,'visible and locked must be boolean');
      if(!finite(l.opacity)||l.opacity<0||l.opacity>1)add(`${p}.opacity`,'expected 0..1');
      const key=l.kind==='tile'?'tiles':'objects';if(!Array.isArray(l[key])){add(`${p}.${key}`,'expected array');return;}
      const cells=new Set();l[key].forEach((o,j)=>{const q=`${p}.${key}[${j}]`;if(!plain(o)){add(q,'expected object');return;}str(o.type,`${q}.type`);
        for(const axis of ['x','y']) if(!finite(o[axis])||(l.kind==='tile'&&!Number.isInteger(o[axis])))add(`${q}.${axis}`,l.kind==='tile'?'expected integer pixel coordinate':'expected finite world coordinate');
        if(l.kind==='tile'){for(const axis of ['width','height'])if(!Number.isInteger(o[axis])||o[axis]<1)add(`${q}.${axis}`,'expected positive integer pixel size');const cell=`${o.x},${o.y}`;if(cells.has(cell))add(q,'duplicate tile origin');cells.add(cell);}
        else {str(o.id,`${q}.id`);if(objects.has(o.id))add(`${q}.id`,'duplicate object ID');objects.add(o.id);num(o.width,`${q}.width`,1);num(o.height,`${q}.height`,1);if(!plain(o.properties))add(`${q}.properties`,'expected object');}
      });
    });}
  } else add('',`unknown document kind ${kind}`);
  return errors;
}
export function validateValue(value, def, path) {
  const errors=[],bad=m=>errors.push(`${path}: ${m}`);
  if(value===undefined){if(def.required)bad('required value missing');return errors;}
  switch(def.type){
    case 'number':case 'integer':if(!finite(value)||(def.type==='integer'&&!Number.isInteger(value)))bad(`expected ${def.type}`);else{if(def.min!==undefined&&value<def.min)bad(`minimum ${def.min}`);if(def.max!==undefined&&value>def.max)bad(`maximum ${def.max}`);}break;
    case 'boolean':if(typeof value!=='boolean')bad('expected boolean');break;
    case 'string':case 'asset':if(typeof value!=='string')bad('expected string');else{if(def.maxLength!==undefined&&value.length>def.maxLength)bad('too long');}break;
    case 'color':if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))bad('expected #rrggbb');break;
    case 'enum':if(!def.options?.includes(value))bad('not an allowed option');break;
    case 'position':if(!plain(value)||!finite(value.x)||!finite(value.y))bad('expected {x,y} in world units');break;
    case 'objectRef':if(value!==null&&(!plain(value)||typeof value.level!=='string'||typeof value.object!=='string'))bad('expected null or {level,object}');break;
    default:bad(`unsupported property type ${def.type}`);
  }return errors;
}
export function defaults(definitions) {return Object.fromEntries(Object.entries(definitions).filter(([,d])=>d.default!==undefined).map(([k,d])=>[k,clone(d.default)]));}
export function objects(level){return level.layers.filter(l=>l.kind==='object').flatMap(l=>l.objects);}
export function referenceTargets(project,definition,levelId){const level=Object.hasOwn(project.levels,levelId)?project.levels[levelId]:null;return level&&Array.isArray(level.layers)?level.layers.filter(l=>plain(l)&&l.kind==='object'&&Array.isArray(l.objects)).flatMap(l=>l.objects).filter(o=>plain(o)&&(!definition.targets?.length||definition.targets.includes(o.type))):[];}
export function validateProject(project) {
  if(!plain(project))return ['project: expected an object'];
  const errors=[...validateDocument(project.manifest,'manifest'),...validateDocument(project.settings,'settings'),...validateDocument(project.catalog,'catalog')];
  if(errors.length)return errors;
  if(!plain(project.levels))return ['project.levels: expected an object keyed by manifest level IDs'];
  for(const id of Object.keys(project.levels))if(!project.manifest.levels.some(l=>l.id===id))errors.push(`project.levels.${id}: level is not listed in manifest; refusing to discard it on save`);
  const types=new Map(project.catalog.elements.map(e=>[e.id,e]));
  function values(vals,defs,path){for(const [k,d] of Object.entries(defs)){const v=vals[k]??(vals[k]===null?null:d.default);errors.push(...validateValue(v,d,`${path}.${k}`));if(d.type==='objectRef'&&v&&typeof v==='object'){const t=referenceTargets(project,d,v.level).find(o=>o.id===v.object);if(!t)errors.push(`${path}.${k}: broken reference ${v.level}/${v.object} or invalid target type`);}if(d.type==='asset'&&v&&!project.manifest.assetFiles?.includes(v))errors.push(`${path}.${k}: asset not listed in manifest.assetFiles: ${v}`);}}
  values(project.settings.values,project.settings.properties,'settings.values');
  for(const entry of project.manifest.levels){const l=project.levels[entry.id];const e=validateDocument(l,'level');errors.push(...e.map(x=>`${entry.id}: ${x}`));if(e.length)continue;if(l.id!==entry.id)errors.push(`${entry.id}: level ID differs from manifest`);values(l.settings,project.catalog.levelProperties,`${l.id}.settings`);if(l.settings.camera!==undefined)errors.push(...validateValue(l.settings.camera,{type:'position'},`${l.id}.settings.camera`));if(l.settings.cameraZoom!==undefined&&(!finite(l.settings.cameraZoom)||l.settings.cameraZoom<=0))errors.push(`${l.id}.settings.cameraZoom: expected positive game zoom`);for(const layer of l.layers)for(const o of layer.kind==='tile'?layer.tiles:layer.objects){const t=types.get(o.type);if(!t||t.kind!==layer.kind){errors.push(`${l.id}/${layer.id}: unknown ${layer.kind} type ${o.type}`);continue;}if(layer.kind==='object')values(o.properties,t.properties,`${l.id}/${o.id}`);}}
  return errors;
}
export function assertProject(p){const e=validateProject(p);if(e.length)throw new Error(e.join('\n'));return p;}
export function serialize(value){return JSON.stringify(value,null,2)+'\n';}
export class History {
  constructor(value){this.value=clone(value);this.past=[];this.future=[];}
  commit(next){if(serialize(next)===serialize(this.value))return false;this.past.push(clone(this.value));if(this.past.length>100)this.past.shift();this.value=clone(next);this.future=[];return true;}
  undo(){if(!this.past.length)return false;this.future.push(this.value);this.value=this.past.pop();return true;}
  redo(){if(!this.future.length)return false;this.past.push(this.value);this.value=this.future.pop();return true;}
}
const paintIndexes=new WeakMap();
export function paint(layer,x,y,type,size={width:32,height:32}){
  let cached=paintIndexes.get(layer);
  if(!cached||cached.tiles!==layer.tiles||cached.length!==layer.tiles.length){cached={tiles:layer.tiles,length:layer.tiles.length,index:new Map(layer.tiles.map(t=>[`${t.x},${t.y}`,t]))};paintIndexes.set(layer,cached);}
  const key=`${x},${y}`,existing=cached.index.get(key);
  if(existing){if(type)existing.type=type;else{layer.tiles.splice(layer.tiles.indexOf(existing),1);cached.index.delete(key);}}
  else if(type){const tile={x,y,type,width:size.width,height:size.height};layer.tiles.push(tile);cached.index.set(key,tile);}
  cached.length=layer.tiles.length;
}
export function newId(prefix='object'){return `${prefix}-${crypto.randomUUID()}`;}
export function tileMoveError(level,layerId,from,to){
  const layer=level.layers.find(l=>l.id===layerId&&l.kind==='tile');
  if(!layer||layer.locked||!layer.visible)return 'Tile layer is missing, locked or hidden.';
  if(!layer.tiles.some(t=>t.x===from.x&&t.y===from.y))return 'Source tile is missing.';
  if(to.x===from.x&&to.y===from.y)return null;
  if(!Number.isInteger(to.x)||!Number.isInteger(to.y)||!Number.isSafeInteger(to.x)||!Number.isSafeInteger(to.y))return 'Tile positions must be whole pixels.';
  if(layer.tiles.some(t=>t.x===to.x&&t.y===to.y))return 'A tile already starts at that pixel position. Overlap at other positions is allowed.';
  return null;
}
export function moveTile(level,layerId,from,to){
  const error=tileMoveError(level,layerId,from,to);if(error)return error;
  const layer=level.layers.find(l=>l.id===layerId),tile=layer.tiles.find(t=>t.x===from.x&&t.y===from.y);tile.x=to.x;tile.y=to.y;paintIndexes.delete(layer);return null;
}
