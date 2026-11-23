// Small, consistent interface symbols. Labels stay on the real button so
// keyboard and assistive-technology actions use its existing native behavior.
const shapes={
  fit:[['path',{d:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5'}],['rect',{x:7,y:7,width:10,height:10,rx:1}]],
  back:[['path',{d:'M19 12H5m6-6-6 6 6 6'}]],
  undo:[['path',{d:'M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7v2'}]],
  reset:[['path',{d:'M3 10a9 9 0 1 1 2 8M3 4v6h6'}]],
  rotate:[['path',{d:'M20 9a8 8 0 1 0 0 7M20 3v6h-6M9 10v5h5'}]],
  mirror:[['path',{d:'M12 3v18','stroke-dasharray':'2 3'}],['path',{d:'M8 6 3 18h5ZM16 6l5 12h-5Z'}]],
  'bend-left':[['path',{d:'M18 21V12a6 6 0 0 0-6-6H4m4-4L4 6l4 4'}]],
  'bend-right':[['path',{d:'M6 21V12a6 6 0 0 1 6-6h8m-4-4 4 4-4 4'}]],
  'bend-up':[['path',{d:'M3 18h7a5 5 0 0 0 5-5V3m-4 4 4-4 4 4'}]],
  'bend-down':[['path',{d:'M3 6h7a5 5 0 0 1 5 5v10m-4-4 4 4 4-4'}]],
  horizontal:[['path',{d:'M3 12h18m-4-4 4 4-4 4'}]],
  new:[['path',{d:'M14 3H5v18h14V8ZM14 3v5h5M8 14h8M12 10v8'}]],
  worksheet:[['path',{d:'M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h8'}]],
  calculator:[['rect',{x:5,y:2,width:14,height:20,rx:2}],['path',{d:'M8 6h8M8 11h1m3 0h1m3 0h.01M8 15h1m3 0h1m3 0h.01M8 19h1m3 0h1m3 0h.01'}]],
  info:[['circle',{cx:12,cy:12,r:9}],['path',{d:'M12 11v6M12 7h.01'}]],
};

export function setIconButton(button,name,label,{pressed}={}){
  if(!button||!shapes[name]||typeof label!=='string'||!label.trim())throw new TypeError('An icon button needs an element, known symbol and accessible label.');
  const doc=button.ownerDocument||document,svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value]of Object.entries({viewBox:'0 0 24 24',width:22,height:22,fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,String(value));
  for(const [tag,attrs]of shapes[name]){const node=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));svg.append(node);}
  button.replaceChildren(svg);button.classList.add('icon-button');button.setAttribute('data-icon',name);button.setAttribute('aria-label',label);button.setAttribute('title',label);
  if(typeof pressed==='boolean')button.setAttribute('aria-pressed',String(pressed));
  return button;
}
