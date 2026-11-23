import assert from 'node:assert/strict';
import {geometry,extend} from './geometry.mjs';
import {convertMeasurementMode} from './measurements.mjs';
import {geometry3D,extendSpatial,validateSpatialState,hasSpatialPipe,bendOrientation,spatialBendRotations,normalizeSpatialAngle} from './spatial-geometry.mjs?v=44';
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const pointNear=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const copy=a=>structuredClone(a);

// Every old 2D project remains exactly the same shape and developed length.
for(const mode of ['tangent','vertex'])for(const heading of [0,.36,-1.93])for(const turns of [[90,-45],[35,-110,72.5],[]]){
 const s={radius:38,heading,measurementMode:mode,lengths:Array(turns.length+1).fill(480),turns},before=JSON.stringify(s),flat=geometry(s),space=geometry3D(s);
 near(space.used,flat.used);pointNear(space.end,[...flat.end,0]);assert.equal(hasSpatialPipe(s),false);
 flat.lines.forEach((line,i)=>{for(const key of ['start','end','dimensionStart','dimensionEnd'])pointNear(space.lines[i][key],[...line[key],0]);near(space.lines[i].dimension,line.dimension);});
 flat.arcs.forEach((arc,i)=>arc.samples.forEach((p,j)=>pointNear(space.arcs[i].samples[j],[...p,0])));
 assert.equal(JSON.stringify(s),before);
}

// A multi-level route rises 500 mm, resumes along the original wall, then
// rises another300 mm. Values are theoretical centerline-vertex dimensions.
let levels={radius:45,heading:0,measurementMode:'vertex',lengths:[1000],turns:[]};
for(const [direction,length]of [['up',500],['forward',600],['up',300],['forward',1000]]){
 const orientation=bendOrientation(levels,'B',direction);assert.equal(orientation.available,true);
 levels=extendSpatial(levels,'B',length,orientation.turnSign*90,orientation.rotation);
}
const levelGeo=geometry3D(levels);
near(levelGeo.lines[0].direction[2],0);near(levelGeo.lines[1].direction[2],1);near(levelGeo.lines[2].start[2],500);near(levelGeo.lines[2].end[2],500);near(levelGeo.lines[4].start[2],800);near(levelGeo.end[2],800);near(levelGeo.lines[4].direction[0],1);assert.equal(hasSpatialPipe(levels),true);
assert.equal(bendOrientation(extendSpatial({radius:45,heading:0,lengths:[1000],turns:[]},'B',500,90,90),'B','up').available,false,'A vertical tangent cannot be bent toward its own direction');
assert.equal(bendOrientation(extendSpatial({radius:45,heading:0,lengths:[1000],turns:[]},'B',500,90,90),'B','down').available,false,'An antiparallel direction does not define a unique plane');
const below=extendSpatial({radius:30,heading:0,lengths:[300],turns:[]},'B',250,90,-90);assert.ok(geometry3D(below).end[2]<0);

// Independent radius/plane/endpoint/tangent checks across diverse signed
// angles, radii, headings, and roll combinations. No supplied-example branch.
let seed=19283;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(let trial=0;trial<80;trial++){
 const turns=Array.from({length:2+trial%5},()=>((random()<.5?-1:1)*(5+random()*150))),s={radius:8+random()*100,heading:random()*Math.PI*2,lengths:Array(turns.length+1).fill(4000),turns,bendRotations:turns.map(()=>random()*360-180)},before=JSON.stringify(s),g=geometry3D(s);
 let expectedUsed=s.lengths.reduce((sum,n)=>sum+n,0);
 g.arcs.forEach((arc,index)=>{
  expectedUsed+=Math.abs(arc.angle)*s.radius;
  near(Math.hypot(...arc.tangent),1);near(Math.hypot(...arc.normal),1);near(dot(arc.tangent,arc.normal),0);
  for(const p of arc.samples){const radial=sub(p,arc.center);near(Math.hypot(...radial),s.radius);near(dot(radial,arc.binormal),0);}
  pointNear(arc.samples[0],g.lines[index].end);pointNear(arc.samples.at(-1),g.lines[index+1].start);
  const expectedTangent=arc.tangent.map((v,k)=>Math.cos(arc.angle)*v+Math.sin(arc.angle)*arc.normal[k]);pointNear(g.lines[index+1].direction,expectedTangent);
 });near(g.used,expectedUsed);
 const converted=geometry3D(convertMeasurementMode(s,'vertex'));pointNear(converted.end,g.end);near(converted.used,g.used);
 for(const end of ['A','B']){
  const turn=(random()<.5?-1:1)*(10+random()*145),roll=random()*360-180,next=extendSpatial(s,end,1300,turn,roll),added=geometry3D(next);
  assert.equal(validateSpatialState(next),null);near(added.used,g.used+1300+s.radius*Math.abs(turn)*Math.PI/180);
  const delta=end==='A'?sub(added.lines[1].start,g.lines[0].start):[0,0,0];
  g.lines.forEach((line,i)=>{for(const key of ['start','end'])pointNear(sub(added.lines[i+(end==='A'?1:0)][key],delta),line[key]);});
  g.arcs.forEach((arc,i)=>arc.samples.forEach((p,j)=>pointNear(sub(added.arcs[i+(end==='A'?1:0)].samples[j],delta),p)));
 }
 assert.equal(JSON.stringify(s),before,'Geometry, conversion and extension may not mutate input');
}

// Repeated prepend/export/reload/append cycles must retain a full arbitrary
// start frame, rather than flattening it or accumulating frame-roll errors.
let cycled={radius:27,heading:.7,lengths:[550,700],turns:[63],bendRotations:[-41]};
for(let i=0;i<12;i++){
 const oldGeo=geometry3D(cycled),end=i%3?'A':'B';
 const next=JSON.parse(JSON.stringify(extendSpatial(cycled,end,650,35+i*7,-160+i*23))),nextGeo=geometry3D(next);
 const delta=end==='A'?sub(nextGeo.lines[1].start,oldGeo.lines[0].start):[0,0,0];
 oldGeo.lines.forEach((line,j)=>{for(const key of ['start','end'])pointNear(sub(nextGeo.lines[j+(end==='A'?1:0)][key],delta),line[key]);});
 // Derive physical roll independently from actual signed plane normals.
 const reported=spatialBendRotations(next);
 nextGeo.arcs.forEach((arc,j)=>{
  const reference=j?nextGeo.arcs[j-1].endFrame.normal.map(v=>v*Math.sign(nextGeo.arcs[j-1].turn)):nextGeo.lineFrames[0].normal;
  const target=arc.normal.map(v=>v*Math.sign(arc.turn));
  const cross=[reference[1]*target[2]-reference[2]*target[1],reference[2]*target[0]-reference[0]*target[2],reference[0]*target[1]-reference[1]*target[0]];
  const expected=normalizeSpatialAngle(Math.atan2(dot(arc.tangent,cross),dot(reference,target))*180/Math.PI);
  near(reported[j].rotation,expected);
 });
 cycled=next;
}

// Prepends preserve the signed legacy convention if no spatial data exists.
for(const turn of [-90,-45,35,125]){
 const s={radius:38,heading:.4,lengths:[350,250],turns:[45]},a=extend(s,'A',600,turn),b=extendSpatial(s,'A',600,turn,0);
 near(b.heading,a.heading);assert.deepEqual({...b,heading:0},{...a,heading:0});
}

// Direction helpers produce bends toward their actual requested world vector
// from both ends, including oblique tilted runs and the vertical singularity.
for(const s of [levels,below,{radius:32,heading:.38,lengths:[400,600,800],turns:[47,-61],bendRotations:[32,-93]}])for(const end of ['A','B'])for(const direction of ['left','right','up','down','forward','back']){
 const orientation=bendOrientation(s,end,direction);if(!orientation.available)continue;
 const g=geometry3D(s),n=geometry3D(extendSpatial(s,end,900,orientation.turnSign*55,orientation.rotation));
 const before=end==='A'?g.lines[0].direction.map(v=>-v):g.lines.at(-1).direction;
 const after=end==='A'?n.lines[0].direction.map(v=>-v):n.lines.at(-1).direction;
 pointNear(after,before.map((v,i)=>v*Math.cos(55*Math.PI/180)+orientation.direction[i]*Math.sin(55*Math.PI/180)));
}

// A fixed frame can describe any initial orientation, including a straight
// vertical pipe. Default arrays remain optional/backward compatible.
const framed={radius:38,heading:0,lengths:[500,400],turns:[90],startFrame:{tangent:[0,0,1],normal:[1,0,0]},bendRotations:[0]};
assert.equal(validateSpatialState(framed),null);assert.equal(hasSpatialPipe(framed),true);pointNear(geometry3D(framed).lines[0].direction,[0,0,1]);
assert.equal(hasSpatialPipe({...framed,startFrame:{tangent:[1,0,0],normal:[0,1,0]}}),false);
assert.equal(hasSpatialPipe({...framed,bendRotations:[180]}),true);
for(const patch of [
 {bendRotations:null},{bendRotations:[NaN]},{bendRotations:[Infinity]},{bendRotations:[181]},{bendRotations:[]},{bendRotations:['90']},
 {startFrame:null},{startFrame:{tangent:[0,0,2],normal:[1,0,0]}},{startFrame:{tangent:[1,0,0],normal:[1,0,0]}},
 {startFrame:{tangent:[1,0],normal:[0,1,0]}},{startFrame:{tangent:[1,0,0],normal:[0,NaN,0]}},
]){const bad={...framed,...patch};assert.equal(typeof validateSpatialState(bad),'string');assert.throws(()=>geometry3D(bad));}
assert.throws(()=>extendSpatial(framed,'Z',200,90));assert.throws(()=>extendSpatial(framed,'B',200,90,Infinity));

// Fabrication rolls are physical rotations for a one-direction bender. An
// opposite signed bend in the same plane needs180° rather than an extra
// mirrored-bend instruction. Rotations are always viewed incoming A→B.
assert.deepEqual(spatialBendRotations({turns:[90,-90,90],bendRotations:[90,0,45]}).map(row=>row.rotation),[90,-180,-135]);
assert.deepEqual(spatialBendRotations({turns:[-45,-45],bendRotations:[0,90]}).map(row=>row.rotation),[-180,90]);
assert.equal(spatialBendRotations({turns:[90]})[0].first,true);assert.equal(spatialBendRotations({turns:[90,90]})[1].first,false);assert.equal(spatialBendRotations({turns:[90]})[0].view,'A→B');
for(const angle of [-180,-120,0,90,180])near(normalizeSpatialAngle(angle+720),normalizeSpatialAngle(angle));
console.log('Spatial geometry: legacy XY, multi-level heights, exact circular bends, both-end preservation, direction singularities, portable validation and fabrication rolls PASS');
