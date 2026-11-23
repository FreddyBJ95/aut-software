import assert from 'node:assert/strict';
import {fitPipeLengths} from './linear-pipe-fit.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
// An edited detour width must be taken from the two fixed-end supports.
const initial=[45,190,725],sum={a:[1,1,1],b:960},target={a:[0,1,0],b:310};
let result=fitPipeLengths({initial,lowerBounds:[20,20,20],equalities:[sum,target]});
assert.equal(result.ok,true);close(result.values[0],20);close(result.values[1],310);close(result.values[2],630);
// Weighted preference changes the distribution without changing the target.
result=fitPipeLengths({initial:[100,200,300],weights:[100,1,1],lowerBounds:[10,10,10],equalities:[{a:[1,1,1],b:600},{a:[0,1,0],b:230}]});
assert.equal(result.ok,true);close(result.values[0],100-30/101);close(result.values[2],300-3000/101);
// Endpoint and clip equations may be redundant, but cannot contradict.
const base={initial:[100,200,300],equalities:[{a:[1,1,1],b:600},{a:[2,2,2],b:1200},{a:[0,1,0],b:220}]};
result=fitPipeLengths(base);assert.equal(result.ok,true);close(result.values[0],90);close(result.values[2],290);
assert.equal(fitPipeLengths({...base,equalities:[...base.equalities,{a:[1,1,1],b:601}]}).ok,false);
assert.equal(fitPipeLengths({initial:[100],equalities:[{a:[1],b:200},{a:[1],b:100}]}).ok,false);
assert.equal(fitPipeLengths({initial:[100],equalities:[{a:[1],b:200}],inequalities:[{a:[-1],b:-150}]}).ok,false);
result=fitPipeLengths({initial:[100,100],weights:[1e-12,1e12],equalities:[{a:[1,1],b:300},{a:[1,0],b:100}]});
assert.equal(result.ok,true);close(result.values[0],100);close(result.values[1],200);
result=fitPipeLengths({initial:[0,0],weights:[100,.01],inequalities:[{a:[1,1],b:100},{a:[1,-1],b:100}]});
assert.equal(result.ok,true);close(result.values[0],100);close(result.values[1],0);
// A two-dimensional closure and a clip plane must hold together with bounds.
result=fitPipeLengths({initial:[100,100,100,100],lowerBounds:[25,25,25,25],equalities:[{a:[1,0,-1,0],b:0},{a:[0,1,0,-1],b:0},{a:[1,0,0,0],b:120}],inequalities:[{a:[0,1,0,0],b:130}]});
assert.equal(result.ok,true);[120,130,120,130].forEach((n,i)=>close(result.values[i],n));
// Dimension limits must remain responsive and keep every equality precise.
const many=Array(200).fill(100),a=many.map((_,i)=>i%2?1:-1),b=many.map((_,i)=>i===57?1:0);
result=fitPipeLengths({initial:many,lowerBounds:many.map(()=>10),equalities:[{a,b:0},{a:b,b:150}]});
assert.equal(result.ok,true);close(result.values[57],150);close(result.values.reduce((sum,v,i)=>sum+v*a[i],0),0);
for(const options of [null,{}, {initial:[]},{initial:[NaN]},{initial:[1],weights:[0]},{initial:[1],equalities:[{a:[NaN],b:0}]},{initial:[1],equalities:[{a:[0],b:1}]},{initial:[1],inequalities:[{a:[0],b:1}]}])assert.equal(fitPipeLengths(options).ok,false);
const copy=structuredClone(base);fitPipeLengths(base);assert.deepEqual(base,copy);
console.log('Linear pipe fitting: weighted redistribution, active limits, redundant constraints, infeasibility and200variables PASS');
