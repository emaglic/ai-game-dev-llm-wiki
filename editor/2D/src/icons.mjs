// Decorative local icons; keep names/accessible labels on their parent controls.
export function icon(name){const span=document.createElement('span');span.className=`material-icon icon-${name}`;span.setAttribute('aria-hidden','true');return span;}
