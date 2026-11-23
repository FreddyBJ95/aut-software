import {resolveMeasurements} from './measurements.mjs';

export function geometry(s){
 const measured=resolveMeasurements(s);
 let x=0,y=0,h=s.heading??0,used=0;
 const lines=[],arcs=[],points=[[0,0]];
 measured.tangentLengths.forEach((length,i)=>{
  const ux=Math.cos(h),uy=Math.sin(h),start=[x,y];
  x+=length*ux;y+=length*uy;
  const end=[x,y],vertex=measured.mode==='vertex',previous=measured.setbacks[i-1]??0,next=measured.setbacks[i]??0;
  lines.push({start,end,length,dimension:vertex?measured.vertexLengths[i]:length,
   dimensionStart:vertex?[start[0]-previous*ux,start[1]-previous*uy]:start.slice(),
   dimensionEnd:vertex?[end[0]+next*ux,end[1]+next*uy]:end.slice()});
  points.push(end);used+=length;
  if(i<s.turns.length){
   const turn=s.turns[i],a=turn*Math.PI/180,k=Math.sign(a),r=s.radius,cx=x-k*r*Math.sin(h),cy=y+k*r*Math.cos(h),samples=[],position=used;
   for(let j=0;j<=32;j++){const t=h+a*j/32;samples.push([cx+k*r*Math.sin(t),cy-k*r*Math.cos(t)]);}
   [x,y]=samples.at(-1);arcs.push({turn,samples,position});points.push(...samples);used+=r*Math.abs(a);h+=a;
  }
 });
 return {lines,arcs,points,used,start:[0,0],end:[x,y],measurementMode:measured.mode,
  tangentLengths:measured.tangentLengths,vertexLengths:measured.vertexLengths};
}
export function extend(s,end,length,turn){const n=structuredClone(s);if(!n.lengths.length)n.lengths=[length];else if(end==='B'){n.lengths.push(length);n.turns.push(turn);}else{n.lengths.unshift(length);n.turns.unshift(-turn);n.heading=(n.heading??0)+turn*Math.PI/180;}return n;}
export function triangle(mode,p,q){return p>0&&q>0?(mode==='c'?Math.hypot(p,q):q>p?Math.sqrt(q*q-p*p):NaN):NaN;}
export function offsetLength(o,v,r){if(o<=0||v<=0||v>90)return NaN;const a=v*Math.PI/180,l=(o-2*r*(1-Math.cos(a)))/Math.sin(a);return l>=-1e-9?Math.max(0,l):NaN;}
export function calculate(raw){const s=raw.replaceAll(',','.').replaceAll('×','*').replaceAll('÷','/').replace(/\s/g,'');let i=0;function num(){if(s[i]==='+'){i++;return num();}if(s[i]==='-'){i++;return -num();}if(s[i]==='('){i++;const v=expr();if(s[i++]!==')')throw Error();return v;}const m=s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);if(!m)throw Error();i+=m[0].length;return +m[0];}function term(){let v=num();while(s[i]==='*'||s[i]==='/'){const op=s[i++],n=num();v=op==='*'?v*n:v/n;}return v;}function expr(){let v=term();while(s[i]==='+'||s[i]==='-'){const op=s[i++],n=term();v=op==='+'?v+n:v-n;}return v;}if(s.length>200)throw Error();const v=expr();if(i!==s.length||!Number.isFinite(v))throw Error();return v;}

// Shop method: a mark-to-mark spacing, not a tangent-to-tangent pipe section.
export function practicalOffsetLength(offset,factor){return Number.isFinite(offset)&&Number.isFinite(factor)&&offset>0&&factor>0?offset*factor:NaN;}
