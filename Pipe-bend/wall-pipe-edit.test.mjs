import assert from 'node:assert/strict';
import {pipeModelFromPoints,editWallPipe,editAnchoredWallPipeLength} from './wall-pipe-edit.mjs';
import {generateWallRoute,validateWallRoute} from './wall-routing.mjs';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const vectorClose=(actual,expected,tolerance)=>actual.forEach((n,i)=>close(n,expected[i],tolerance));
const points=[[50,60],[1050,60],[1050,560],[850,560]], unchanged=structuredClone(points);
const model=pipeModelFromPoints(points);
assert.equal(model.ok,true);
assert.deepEqual(model.start,[50,60]);
assert.equal(model.heading,0);
assert.deepEqual(model.lengths,[1000,500,200]);
vectorClose(model.turns,[90,90]);

const longer=editWallPipe(points,{type:'length',index:0,value:1100});
assert.equal(longer.ok,true);
assert.deepEqual(longer.points,[[50,60],[1150,60],[1150,560],[950,560]]);
assert.deepEqual(longer.lengths,[1100,500,200]);
vectorClose(longer.turns,model.turns);
assert.equal(longer.heading,model.heading);

const shorter=editWallPipe(points,{type:'length',index:1,value:400});
assert.deepEqual(shorter.points,[[50,60],[1050,60],[1050,460],[850,460]]);
const bent=editWallPipe(points,{type:'turn',index:0,value:45});
assert.equal(bent.ok,true);
assert.deepEqual(bent.points.slice(0,2),points.slice(0,2),'A and selected corner remain fixed');
vectorClose(bent.lengths,model.lengths);
vectorClose(bent.turns,[45,90]);
vectorClose(bent.points[2],[1050+500/Math.SQRT2,60+500/Math.SQRT2]);
const collinear=editWallPipe(points,{type:'turn',index:0,value:0});
assert.equal(collinear.points.length,4,'Draft edits do not remove or renumber corners');
close(collinear.turns[0],0);
const reversedDraft=pipeModelFromPoints([[0,0],[100,0],[0,0]]);
assert.equal(reversedDraft.ok,true,'Invalid physical reversals remain numerically editable');
assert.equal(editWallPipe(reversedDraft.points,{type:'turn',index:0,value:90}).ok,true);

const straight=editWallPipe([[10,20],[1010,20]],{type:'length',index:0,value:1200});
assert.deepEqual(straight.points,[[10,20],[1210,20]]);
assert.deepEqual(straight.turns,[]);
assert.equal(editWallPipe(straight.points,{type:'turn',index:0,value:45}).ok,false);
const subnormal=editWallPipe([[0,0],[Number.MIN_VALUE,Number.MIN_VALUE]],{type:'length',index:0,value:1});
assert.equal(subnormal.ok,true);close(subnormal.lengths[0],1);
vectorClose(subnormal.points[1],[Math.SQRT1_2,Math.SQRT1_2]);

const fixture={wall:{lengths:[1000,1000,120,120,120,1000,1200,120,120,120,1200],turns:[90,90,-90,-90,90,90,90,-90,-90,90],heading:0,side:'left'},diameter:12,radius:38,wallGap:10,clearance:10,maxAngle:45,start:{segment:0,position:200},end:{segment:10,position:1000},clips:[],obstacles:[]};
const twelve=generateWallRoute(fixture);
assert.equal(twelve.ok,true,twelve.error);
assert.equal(twelve.turns.length,12);
for(const transform of [
  p=>p,
  ([x,y])=>[x*Math.cos(.731)-y*Math.sin(.731)+25,x*Math.sin(.731)+y*Math.cos(.731)-110],
])for(const reversed of [false,true]) {
  const input=twelve.points.map(transform);if(reversed)input.reverse();
  const before=structuredClone(input), data=pipeModelFromPoints(input);
  assert.equal(data.ok,true);
  for(const type of ['length','turn']) {
    const values=type==='length'?data.lengths:data.turns;
    for(let i=0;i<values.length;i++) {
      const same=editWallPipe(input,{type,index:i,value:values[i]});
      assert.deepEqual(same.points,input,'An unchanged field must preserve every coordinate exactly');
      assert.notEqual(same.points,input);assert.notEqual(same.points[0],input[0]);
    }
  }
  const edited=editWallPipe(input,{type:'length',index:2,value:data.lengths[2]+17.25});
  assert.equal(edited.ok,true);assert.deepEqual(edited.points.slice(0,3),input.slice(0,3));
  close(edited.lengths[2],data.lengths[2]+17.25);
  edited.lengths.forEach((n,i)=>{if(i!==2)close(n,data.lengths[i]);});
  vectorClose(edited.turns,data.turns);
  assert.equal(edited.heading,data.heading);
  assert.deepEqual(input,before);
}
const tinyLength=editWallPipe(points,{type:'length',index:0,value:1000+1e-7});
assert.notDeepEqual(tinyLength.points,points,'Small representable length edits must not be ignored');
const tinyTurn=editWallPipe(points,{type:'turn',index:0,value:model.turns[0]+1e-8});
assert.notDeepEqual(tinyTurn.points,points,'Small representable turn edits must not be ignored');
close(tinyTurn.turns[0],model.turns[0]+1e-8,1e-10);

for(const bad of [null,undefined,{},[],[[0,0]],[[0,0],[0,0]],[[0,0],[NaN,1]],[[0,0],[1,Infinity]],[[0,0],[1e308,1]],[[0,0],[]],[[0,0],[1,'2']],[[0,0],[,2]]]) {
  assert.doesNotThrow(()=>pipeModelFromPoints(bad));
  assert.equal(pipeModelFromPoints(bad).ok,false);
}
const limit=Array.from({length:201},(_,i)=>[i,0]);
assert.equal(pipeModelFromPoints(limit).ok,true);
assert.equal(pipeModelFromPoints([...limit,[201,0]]).code,'TOO_MANY_BENDS');
const sparse=Array(3);sparse[0]=[0,0];sparse[2]=[2,0];
assert.equal(pipeModelFromPoints(sparse).ok,false);
for(const edit of [null,{}, {type:'other',index:0,value:12}, {type:'length',index:-1,value:12},{type:'length',index:3,value:12},{type:'length',index:.5,value:12},
  ...[NaN,Infinity,-1,0,'100',undefined,1e308].map(value=>({type:'length',index:0,value})),
  ...[NaN,Infinity,179,-179,180,'45',null].map(value=>({type:'turn',index:0,value}))]) {
  assert.doesNotThrow(()=>editWallPipe(points,edit));
  assert.equal(editWallPipe(points,edit).ok,false);
}
assert.deepEqual(points,unchanged,'Neither valid nor invalid edits mutate the source pipe');

// Draft math never certifies physical geometry: all output must pass the same
// wall/obstacle/clip/radius/max-angle/endpoint checks used by generated routes.
const straightConfig={wall:{lengths:[2200],turns:[],heading:0,side:'left'},diameter:12,radius:10,wallGap:50,clearance:10,maxAngle:90,start:{segment:0,position:200},end:{segment:0,position:2000},clips:[],obstacles:[]};
const safe=[[200,56],[800,56],[800,300],[1400,300],[1400,56],[2000,56]];
assert.equal(validateWallRoute(straightConfig,safe).ok,true);
const configCopy=structuredClone(straightConfig);
let behind=safe;
for(const [index,value] of [[0,-90],[1,90],[2,90],[3,-90]]) {
  const edit=editWallPipe(behind,{type:'turn',index,value});assert.equal(edit.ok,true);behind=edit.points;
}
vectorClose(behind.at(-1),safe.at(-1));
assert.equal(validateWallRoute(straightConfig,behind).code,'WALL_COLLISION');

const beam={...straightConfig,obstacles:[{id:'beam',segment:0,position:1000,width:120,depth:120}]};
assert.equal(validateWallRoute(beam,safe).ok,true);
let tooLow=editWallPipe(safe,{type:'length',index:1,value:44}).points;
tooLow=editWallPipe(tooLow,{type:'length',index:3,value:44}).points;
vectorClose(tooLow.at(-1),safe.at(-1));
assert.equal(validateWallRoute(beam,tooLow).code,'OBSTACLE_COLLISION');

const clips={...straightConfig,clips:[{id:'K1',segment:0,position:500}]};
assert.equal(validateWallRoute(clips,safe).ok,true);
let missed=editWallPipe(safe,{type:'length',index:0,value:200}).points;
missed=editWallPipe(missed,{type:'length',index:4,value:1000}).points;
vectorClose(missed.at(-1),safe.at(-1));
assert.equal(validateWallRoute(clips,missed).code,'MISSED_CLIP');

const endMoved=editWallPipe(safe,{type:'length',index:4,value:700});
assert.equal(validateWallRoute(straightConfig,endMoved.points).code,'ENDPOINT_MISMATCH');
assert.equal(validateWallRoute({...straightConfig,end:{segment:0,position:2100}},endMoved.points).ok,true);
assert.equal(validateWallRoute(straightConfig,editWallPipe(safe,{type:'length',index:1,value:1}).points).code,'INSUFFICIENT_STRAIGHT');
const limited=generateWallRoute(fixture);assert.equal(limited.ok,true);
assert.equal(validateWallRoute(fixture,editWallPipe(limited.points,{type:'turn',index:0,value:60}).points).code,'MAX_ANGLE');
assert.deepEqual(straightConfig,configCopy,'Physical checks and draft edits do not change measured wall settings');

// A middle offset width must move both ramps equally, keeping the measured
// surroundings and both endpoints fixed. These are the user's actual L5
// wall-notch and L11 beam plateaus, rather than a synthetic axis-only case.
const localConfig={wall:{lengths:[1000,1000,120,120,120,1200,1800],turns:[90,90,-90,-90,90,90],heading:0,side:'left'},diameter:12,radius:38,wallGap:10,clearance:10,maxAngle:45,start:{segment:0,position:200},end:{segment:6,position:1600},clips:[{id:'lower',segment:1,position:500,gap:10},{id:'upper',segment:5,position:700,gap:10}],obstacles:[{id:'beam',segment:6,position:700,width:200,depth:180}]};
const localRoute=generateWallRoute(localConfig);
assert.equal(localRoute.ok,true,localRoute.error);
close(localRoute.lengths[4],190);close(localRoute.lengths[10],270);
const localSource=structuredClone(localRoute.points), localSettings=structuredClone(localConfig);
function checkLocal(source,index,delta) {
  const before=pipeModelFromPoints(source),value=before.lengths[index]+delta;
  const edited=editAnchoredWallPipeLength(source,{index,value});
  assert.equal(edited.ok,true,edited.error);assert.equal(edited.applicable,true);
  const ux=(source[index+1][0]-source[index][0])/before.lengths[index];
  const uy=(source[index+1][1]-source[index][1])/before.lengths[index];
  for(let i=0;i<source.length;i++) {
    const shift=i===index-1||i===index?-delta/2:i===index+1||i===index+2?delta/2:0;
    if(!shift)assert.deepEqual(edited.points[i],source[i],'All untouched vertices stay bit-exact');
    else vectorClose(edited.points[i],[source[i][0]+shift*ux,source[i][1]+shift*uy]);
  }
  assert.deepEqual(edited.points[0],source[0]);assert.deepEqual(edited.points.at(-1),source.at(-1));
  close(edited.lengths[index],value);
  for(let i=0;i<before.lengths.length;i++)close(edited.lengths[i],before.lengths[i]+(i===index?delta:i===index-2||i===index+2?-delta/2:0));
  vectorClose(edited.turns,before.turns);
  close(edited.lengths.reduce((a,b)=>a+b,0),before.lengths.reduce((a,b)=>a+b,0));
  const center=p=>[(p[index][0]+p[index+1][0])/2,(p[index][1]+p[index+1][1])/2];
  vectorClose(center(edited.points),center(source));
  assert.equal(edited.heading,before.heading);
  return edited;
}
for(const originalIndex of [4,10])for(const h of [0,.731,-1.4])for(const mirrored of [false,true])for(const reverse of [false,true]) {
  const transform=([x,y])=>{if(mirrored)y=-y;return[x*Math.cos(h)-y*Math.sin(h)+31,x*Math.sin(h)+y*Math.cos(h)-48];};
  const source=localRoute.points.map(transform);if(reverse)source.reverse();
  const index=reverse?source.length-2-originalIndex:originalIndex,before=structuredClone(source);
  for(const delta of [-20,60])checkLocal(source,index,delta);
  const same=editAnchoredWallPipeLength(source,{index,value:pipeModelFromPoints(source).lengths[index]});
  assert.equal(same.ok,true);assert.deepEqual(same.points,source);assert.notEqual(same.points,source);
  assert.deepEqual(source,before);
}
for(const index of [4,10]) {
  for(const delta of [-20,60])assert.equal(validateWallRoute(localConfig,checkLocal(localRoute.points,index,delta).points).ok,true);
  const data=pipeModelFromPoints(localRoute.points),consumed=data.lengths[index]+2*Math.min(data.lengths[index-2],data.lengths[index+2]);
  for(const value of [consumed,consumed+10]){
    const rejected=editAnchoredWallPipeLength(localRoute.points,{index,value});
    assert.equal(rejected.ok,false);assert.equal(rejected.applicable,true);assert.equal(rejected.code,'LOCAL_EDIT_SPACE');
  }
}
const notchTooNarrow=editAnchoredWallPipeLength(localRoute.points,{index:4,value:50});
assert.equal(notchTooNarrow.ok,true);
assert.equal(validateWallRoute(localConfig,notchTooNarrow.points).code,'WALL_COLLISION');
const beamTooNarrow=editAnchoredWallPipeLength(localRoute.points,{index:10,value:210});
assert.equal(beamTooNarrow.ok,true);
assert.equal(validateWallRoute(localConfig,beamTooNarrow.points).code,'OBSTACLE_COLLISION');
assert.deepEqual(localRoute.points,localSource);assert.deepEqual(localConfig,localSettings);

// The same rigid-pair construction works with unequal acute ramp angles.
const asymmetric=[[0,0],[100,0],[130,40],[230,40],[310,0],[410,0]];
for(const delta of [-10,50])checkLocal(asymmetric,2,delta);
for(const source of [
  [[0,-1],[100,0],[130,40],[230,40],[310,0],[410,0]],
  [[0,0],[100,0],[130,40],[230,40],[310,0],[410,1]],
  [[200,0],[100,0],[130,40],[230,40],[310,0],[410,0]],
  [[0,0],[140,0],[130,40],[230,40],[310,0],[410,0]],
]) {
  const unsupported=editAnchoredWallPipeLength(source,{index:2,value:120});
  assert.equal(unsupported.ok,false);assert.equal(unsupported.applicable,false);
  assert.equal(unsupported.code,'UNSUPPORTED_LOCAL_EDIT');
}
const endOnly=editAnchoredWallPipeLength(points,{index:0,value:1100});
assert.equal(endOnly.applicable,false,'Nonplateau start/end edits retain the established general editor');
assert.equal(editWallPipe(points,{type:'length',index:0,value:1100}).ok,true);
for(const edit of [{index:4,value:0},{index:4,value:NaN},{index:4,value:1e308},{index:-1,value:100},null]) {
  const invalid=editAnchoredWallPipeLength(localRoute.points,edit);
  assert.equal(invalid.ok,false);assert.equal(invalid.applicable,true,'Invalid edits must not trigger a downstream fallback');
}

console.log('Wall pipe editing: stable vertex math, exact no-op, downstream edits and unchanged strict constraints PASS');
console.log('Anchored offset widths: symmetric ramps, fixed A/B and surroundings, unchanged angles/depth/total, strict clearance and no unsafe fallback PASS');
