import {clone,referenceTargets} from './model.mjs';
// Register controls by definition.control without changing the serialization contract.
export const customControls=new Map();
export function propertyPanel(container,definitions,values,{project,onChange,onPick}){
  container.replaceChildren();
  for(const [key,d]of Object.entries(definitions)){
    const label=document.createElement('label');label.className='field';label.dataset.property=key;const title=document.createElement('span');title.textContent=d.label||key;label.append(title);
    let value=values[key]===undefined?clone(d.default):values[key];const change=v=>onChange(key,v);
    if(d.control&&customControls.has(d.control)){label.append(customControls.get(d.control)({definition:d,value,onChange:change,project}));}
    else if(d.type==='position'){
      const row=document.createElement('div');row.className='position-fields';for(const axis of ['x','y']){const field=document.createElement('span');field.className='position-axis';const caption=document.createElement('span');caption.textContent=axis.toUpperCase();const n=document.createElement('input');n.type='number';n.setAttribute('aria-label',`${d.label||key} ${axis}`);n.value=value?.[axis]??0;n.step=d.step||1;n.onchange=()=>change({...value,[axis]:Number(n.value)});field.append(caption,n);row.append(field);}label.append(row);
    }else if(d.type==='objectRef'){
      const levels=document.createElement('select');levels.setAttribute('aria-label',`${d.label||key} destination level`);for(const l of project.manifest.levels)levels.add(new Option(l.label||l.id,l.id));levels.value=value?.level||project.manifest.levels[0].id;
      const search=document.createElement('input');search.type='search';search.placeholder='Search objects';search.setAttribute('aria-label',`${d.label||key} search`);
      const targets=document.createElement('select');targets.setAttribute('aria-label',`${d.label||key} destination object`);
      function populate(){targets.replaceChildren(new Option('No destination',''));const list=referenceTargets(project,d,levels.value).filter(o=>`${o.id} ${o.type}`.toLowerCase().includes(search.value.toLowerCase()));for(const o of list)targets.add(new Option(`${o.type} · ${o.id}`,o.id));if(value?.level===levels.value&&value?.object&&!list.some(o=>o.id===value.object))targets.add(new Option(`Missing / filtered: ${value.object}`,value.object));targets.value=value?.level===levels.value?value.object||'':'';}
      populate();levels.onchange=populate;search.oninput=populate;targets.onchange=()=>change(targets.value?{...(value||{}),level:levels.value,object:targets.value}:null);
      label.append(levels,search,targets);if(onPick){const b=document.createElement('button');b.type='button';b.textContent='Pick on canvas';b.onclick=e=>{e.preventDefault();onPick(key,d);};label.append(b);}
    }else{
      let input;
      if(d.type==='enum'||d.type==='asset'){input=document.createElement('select');const choices=d.type==='enum'?d.options:['',...(project.manifest.assetFiles||[])];for(const x of choices)input.add(new Option(x||'None',x));if(value&&!choices.includes(value))input.add(new Option(`Missing: ${value}`,value));input.value=value??'';}
      else{input=document.createElement('input');input.type=d.type==='boolean'?'checkbox':d.type==='color'?'color':['number','integer'].includes(d.type)?d.control==='slider'?'range':'number':'text';if(d.type==='boolean')input.checked=value??false;else input.value=value??'';for(const a of ['min','max','step','maxLength'])if(d[a]!==undefined)input[a]=d[a];if(d.type==='integer'&&!d.step)input.step=1;}
      input.setAttribute('aria-label',d.label||key);input.onchange=()=>change(d.type==='boolean'?input.checked:['number','integer'].includes(d.type)?Number(input.value):input.value);if(d.type==='boolean'){label.classList.add('boolean-field');label.prepend(input);}else label.append(input);
    }
    if(d.help){const help=document.createElement('small');help.textContent=d.help;label.append(help);}container.append(label);
  }
  compactFieldPairs(container);
}

// Pair known related numeric fields; leave verbose/custom controls full-width.
export function compactFieldPairs(container){
  for(const [a,b]of [['x','y'],['width','height']]){
    const first=container.querySelector(`:scope > [data-property="${a}"]`),second=container.querySelector(`:scope > [data-property="${b}"]`);
    const compact=field=>field&&field.textContent.trim().length<=14&&!field.querySelector('small')&&field.querySelector('input[type=number]')?.value.length<=10;
    if(!compact(first)||!compact(second)||first.nextElementSibling!==second)continue;
    const row=document.createElement('div');row.className='compact-field-pair';first.before(row);row.append(first,second);
  }
}
