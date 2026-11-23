import assert from 'node:assert/strict';
import {solveWallPipeEdit} from './wall-pipe-solver.mjs';
import {pipeModelFromPoints} from './wall-pipe-edit.mjs';
import {validateWallRoute,generateWallRoute,arcSegmentDistance,wallLayout} from './wall-routing.mjs';
import {segmentDistance} from './room-routing.mjs';

const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const copy=value=>structuredClone(value);
const corner={wall:{lengths:[2400,1600],turns:[90],heading:0,side:'left'},diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:90,start:{segment:0,position:200},end:{segment:1,position:1400},clips:[{id:'K1',segment:0,position:600,gap:50}],obstacles:[]};
const cornerPoints=[[200,56],[2344,56],[2344,1400]];
const asymmetric={wall:{lengths:[2200],turns:[],heading:0,side:'left'},diameter:12,radius:38,wallGap:10,clearance:10,maxAngle:45,start:{segment:0,position:800},end:{segment:0,position:2000},clips:[{segment:0,position:810,gap:10}],obstacles:[{segment:0,position:1000,width:120,depth:120}]};
const asymmetricPoints=[[800,16],[845,16],[965,136],[1155,136],[1275,16],[2000,16]];
const beam={...copy(asymmetric),wallGap:50,maxAngle:90,start:{segment:0,position:200},clips:[{segment:0,position:300,gap:50},{segment:0,position:1900,gap:50}],obstacles:[{segment:0,position:1000,width:120,depth:150}]};
const beamPoints=[[200,56],[700,56],[900,256],[1300,256],[1500,56],[2000,56]];

// Independent clearance assertion: strict route validity alone would permit a
// solver to silently shrink the requested wall gap to bare physical clearance.
function assertPreservedWallGap(config,before,after) {
  const old=validateWallRoute(config,before),walls=wallLayout(config).segments;
  assert.equal(old.ok,true,old.error);
  for(const [oldPrimitives,newPrimitives,arc] of [[old.straights,after.straights,false],[old.arcs,after.arcs,true]]) {
    assert.equal(newPrimitives.length,oldPrimitives.length);
    oldPrimitives.forEach((primitive,index)=>walls.forEach(wall=>{
      const distance=p=>arc?arcSegmentDistance(p,wall.start,wall.end):segmentDistance(p.start,p.end,wall.start,wall.end);
      const required=Math.min(config.wallGap+config.diameter/2,distance(primitive));
      assert.ok(distance(newPrimitives[index])>=required-2e-7,'A primitive must preserve its original allowance or the requested wall gap');
    }));
  }
}
function checked(config,points,edit) {
  const oldConfig=copy(config),oldPoints=copy(points),result=solveWallPipeEdit(config,points,edit);
  assert.equal(result.ok,true,`${result.code}: ${result.reasonCode}: ${result.error}`);
  assert.deepEqual(config,oldConfig,'Measured walls, endpoints, clips and obstacles are fixed');
  assert.deepEqual(points,oldPoints,'The source draft is immutable');
  assert.deepEqual(result.points[0],points[0]);assert.deepEqual(result.points.at(-1),points.at(-1));
  assert.equal(result.points.length,points.length,'Selected indices remain stable');
  const physical=validateWallRoute(config,result.points);assert.equal(physical.ok,true,physical.error);
  near(edit.type==='length'?physical.lengths[edit.index]:physical.turns[edit.index],edit.value,edit.type==='length'?1e-6:1e-7);
  assertPreservedWallGap(config,points,result);
  const original=pipeModelFromPoints(points);
  for(const type of ['lengths','turns'])for(const adjustment of result.adjustments[type]) {
    near(adjustment.from,original[type][adjustment.index]);near(adjustment.to,result[type][adjustment.index]);
  }
  return result;
}

// These witnesses were calculated independently of the fitter. They prove
// feasible edits exist; the implementation need not choose their exact pivots.
for(const [type,index,value,witness] of [
  ['turn',0,80,[[200,56],[2107.016537927823,56],[2344,1400]]],
  ['turn',0,45,[[200,56],[1000,56],[2344,1400]]],
  ['length',0,2000,[[200,56],[2200,56],[2344,1400]]],
  ['length',1,1500,[[200,56],[1677.91892385386,56],[2344,1400]]],
]) {
  assert.equal(validateWallRoute(corner,witness).ok,true);
  checked(corner,cornerPoints,{type,index,value});
}
const asymmetricWitness=[[800,16],[845,16],[965,136],[1275,136],[1395,16],[2000,16]];
assert.equal(validateWallRoute(asymmetric,asymmetricWitness).ok,true);
const wider=checked(asymmetric,asymmetricPoints,{type:'length',index:2,value:310});
assert.ok(wider.lengths[0]>=25.7401,'The short left support still includes the fixed clip before its fillet');
assert.ok(wider.lengths[4]<asymmetricPoints[5][0]-asymmetricPoints[4][0]-100,'Available space on the right is used');
checked(beam,beamPoints,{type:'length',index:1,value:311.12698372208});
const shallower=checked(beam,beamPoints,{type:'turn',index:0,value:30});
assert.ok(shallower.adjustments.turns.some(a=>a.index===1),'Another bend adapts to keep the far clip on a straight');

// Neither A nor B direction is artificially locked. A downstream clip can
// require the first direction to rotate, including a two-leg length edit.
const lastClip={...copy(corner),clips:[{id:'K2',segment:1,position:1000,gap:50}]};
for(const edit of [{type:'length',index:0,value:2200},{type:'length',index:1,value:1300},{type:'turn',index:0,value:80}]) {
  const result=checked(lastClip,cornerPoints,edit);assert.ok(Math.abs(result.heading)>.01);
}
const tent={...copy(beam),wall:{lengths:[1600],turns:[],heading:0,side:'left'},start:{segment:0,position:200},end:{segment:0,position:1200},clips:[],obstacles:[]};
const tentPoints=[[200,56],[700,556],[1200,56]],longTent=checked(tent,tentPoints,{type:'length',index:0,value:900});
assert.ok(Math.abs(longTent.heading-Math.PI/4)>.1);near(longTent.turns[0],-90);

// Rotation and reversing A/B must not change physical edit semantics. The
// reversing index is calculated from the source, not a regenerated proposal.
for(const angle of [0,.731,-2.1])for(const reverse of [false,true]) {
  const config=copy(beam);config.wall.heading=angle;
  let points=beamPoints.map(([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)]);
  if(reverse){points.reverse();[config.start,config.end]=[config.end,config.start];}
  const lengthIndex=reverse?3:1,turnIndex=reverse?3:0;
  checked(config,points,{type:'length',index:lengthIndex,value:311.12698372208});
  checked(config,points,{type:'turn',index:turnIndex,value:reverse?-30:30});
}

// A real generated wall notch and beam cover a dense route with 12 bends.
const notch={wall:{lengths:[1000,1000,120,120,120,1200,1800],turns:[90,90,-90,-90,90,90],heading:0,side:'left'},diameter:12,radius:38,wallGap:10,clearance:10,maxAngle:45,start:{segment:0,position:200},end:{segment:6,position:1600},clips:[{segment:1,position:500,gap:10},{segment:5,position:700,gap:10}],obstacles:[{segment:6,position:700,width:200,depth:180}]};
const route=generateWallRoute(notch);assert.equal(route.ok,true,route.error);assert.equal(route.lengths.length,13);
checked(notch,route.points,{type:'length',index:4,value:250});
checked(notch,route.points,{type:'length',index:10,value:330});
const customGap={...copy(beam),maxAngle:45,clips:[{segment:0,position:1100,gap:10}],obstacles:[]};
const customRoute=generateWallRoute(customGap);assert.equal(customRoute.ok,true,customRoute.error);
checked(customGap,customRoute.points,{type:'length',index:0,value:customRoute.lengths[0]+10});

// Rejected drafts cannot move walls, lose clips, collapse a bend or silently
// reinterpret the chosen index. Invalid numeric input never produces NaNs.
const invalidEdits=[null,{type:'length',index:-1,value:100},{type:'length',index:99,value:100},{type:'length',index:0,value:NaN},{type:'length',index:0,value:Infinity},{type:'length',index:0,value:null},{type:'length',index:0,value:'-'},{type:'length',index:0,value:0},{type:'length',index:0,value:1e12},{type:'turn',index:0,value:180}];
for(const edit of invalidEdits) {
  const before=copy(beamPoints),config=copy(beam),result=solveWallPipeEdit(config,beamPoints,edit);
  assert.equal(result.ok,false);assert.deepEqual(config,beam);assert.deepEqual(beamPoints,before);
}
for(const edit of [{type:'turn',index:0,value:0},{type:'turn',index:0,value:100},{type:'length',index:2,value:2},{type:'length',index:2,value:100000}]) {
  const result=solveWallPipeEdit(asymmetric,asymmetricPoints,edit);assert.equal(result.ok,false);assert.equal(result.code,'EDIT_NO_SOLUTION');
}
const bothClips={...copy(corner),clips:[...copy(corner.clips),...copy(lastClip.clips)]};
assert.equal(solveWallPipeEdit(bothClips,cornerPoints,{type:'length',index:0,value:2000}).ok,false,'Two fixed straight clip directions cannot silently move to accommodate an incompatible pivot');
const invalidSource=copy(beamPoints);invalidSource[2]=[1050,10];
assert.equal(solveWallPipeEdit(beam,invalidSource,{type:'length',index:1,value:300}).ok,false);
assert.equal(solveWallPipeEdit(beam,Array.from({length:202},(_,i)=>[i,56]),{type:'length',index:0,value:2}).code,'TOO_MANY_BENDS');
assert.equal(solveWallPipeEdit(beam,[[NaN,56],[100,56]],{type:'length',index:0,value:2}).ok,false);

// No-op edits preserve binary coordinates; repeated focus/Apply cannot drift.
const source=pipeModelFromPoints(beamPoints);
for(const type of ['length','turn']) {
  const value=(type==='length'?source.lengths:source.turns)[1],result=checked(beam,beamPoints,{type,index:1,value});
  assert.deepEqual(result.points,beamPoints);assert.deepEqual(result.adjustments,{lengths:[],turns:[]});
}

// Maximum supported topology: a feasible local edit and a blocked large edit
// remain bounded. The generous bound detects accidental unbounded searches,
// rather than depending on a particular machine's millisecond timings.
const manyPoints=[[200,56]],headings=[0,Math.PI/6,0,-Math.PI/6];
for(let i=0;i<200;i++){const p=manyPoints.at(-1),h=headings[i%4];manyPoints.push([p[0]+400*Math.cos(h),p[1]+400*Math.sin(h)]);}
const many={...copy(beam),wall:{lengths:[80000],turns:[],heading:0,side:'left'},start:{segment:0,position:200},end:{segment:0,position:manyPoints.at(-1)[0]},clips:[{segment:0,position:300,gap:50}],obstacles:[]};
const started=performance.now();checked(many,manyPoints,{type:'length',index:100,value:430});
assert.equal(solveWallPipeEdit(many,manyPoints,{type:'length',index:100,value:200000}).ok,false);
assert.ok(performance.now()-started<4000,'The 200-leg solver search is bounded');
console.log('wall-pipe-solver tests passed');
