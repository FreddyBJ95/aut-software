import assert from 'node:assert/strict';
import {renderOffsetVisualization} from './offset-visual.mjs';
class Node {
  constructor(name,doc){this.name=name;this.ownerDocument=doc;this.attributes={};this.children=[];this.textContent='';}
  setAttribute(k,v){this.attributes[k]=v;}
  append(child){if(child.parent)child.parent.children=child.parent.children.filter(n=>n!==child);this.children.push(child);child.parent=this;}
  replaceChildren(){this.children=[];}
}
const doc={createElementNS(ns,name){return new Node(name,doc);}};
const svg=new Node('svg',doc),fmt=n=>String(Math.round(n*1000)/1000),t=(s,v={})=>s.replace(/\{(\w+)\}/g,(_,k)=>v[k]);
const descend=node=>[node,...node.children.flatMap(descend)];
for(const angle of [15,45,90])for(const rotation of[0,90,180,270])for(const mirror of[false,true]){
  const factor=angle===45?1.4:Math.round(1000/Math.sin(angle*Math.PI/180))/1000;
  const length=12*factor;
  assert.equal(renderOffsetVisualization(svg,{offset:12,angle,length,factor,unit:'cm',rotation,mirror},t,fmt),true);
  const nodes=descend(svg);
  assert.ok(nodes.some(n=>n.name==='text'&&n.textContent==='H = 12 cm'));
  assert.ok(nodes.some(n=>n.name==='text'&&n.textContent==='M = '+fmt(length)+' cm'));
  assert.equal(nodes.filter(n=>n.name==='text'&&n.textContent===angle+'°').length,2);
  assert.ok(!nodes.some(n=>n.name==='text'&&/^R = |^L = /.test(n.textContent)));
  assert.ok(nodes.every(n=>Object.values(n.attributes).every(v=>!String(v).includes('NaN')&&!String(v).includes('Infinity'))));
}
assert.equal(renderOffsetVisualization(svg,{offset:12,angle:45,length:16.8,factor:1.4,unit:'cm'},t,fmt),true);
assert.ok(svg.attributes['aria-label'].includes('16.8 cm'));
for(const changes of [{offset:0},{angle:0},{angle:91},{length:NaN},{factor:-1},{length:12},{unit:'inch'}]){
  assert.equal(renderOffsetVisualization(svg,{offset:12,angle:45,length:16.8,factor:1.4,unit:'cm',...changes},t,fmt),false);
}
console.log('Practical offset sketch: mark spacing, rounded factor, orientations and invalid inputs PASS');
