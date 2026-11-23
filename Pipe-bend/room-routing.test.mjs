import assert from 'node:assert/strict';
import {generateRoomRoute,validateRoomRoute,pointOnRoomWall,roomObstacleRect} from './room-routing.mjs';
import {geometry} from './geometry.mjs';

const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const base={width:5000,height:3500,diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:90,
  start:{wall:'bottom',position:200},end:{wall:'bottom',position:4800},clips:[],obstacles:[]};

assert.deepEqual(pointOnRoomWall(base,{wall:'bottom',position:100}),[100,56]);
assert.deepEqual(pointOnRoomWall(base,{wall:'right',position:100}),[4944,100]);
assert.deepEqual(pointOnRoomWall(base,{wall:'top',position:100}),[100,3444]);
assert.deepEqual(pointOnRoomWall(base,{wall:'left',position:100,gap:100}),[106,100]);
assert.deepEqual(roomObstacleRect(base,{wall:'top',position:200,width:300,depth:400}),{x:200,y:3100,width:300,height:400});
assert.deepEqual(roomObstacleRect(base,{wall:'right',position:200,width:300,depth:400}),{x:4600,y:200,width:400,height:300});

const straight=generateRoomRoute(base);
assert.equal(straight.ok,true,straight.error);
assert.deepEqual(straight.points,[[200,56],[4800,56]]);
assert.deepEqual(straight.turns,[]);
assert.deepEqual(straight.lengths,[4600]);
close(straight.geometricLength,4600);

function checkGeometricRoundTrip(config,result) {
  assert.equal(result.ok,true,result.error);
  const g=geometry({radius:config.radius,heading:result.heading,measurementMode:'vertex',lengths:result.lengths,turns:result.turns});
  close(g.end[0]+result.start[0],pointOnRoomWall(config,config.end)[0]);
  close(g.end[1]+result.start[1],pointOnRoomWall(config,config.end)[1]);
  close(g.used,result.geometricLength);
  assert.ok(result.turns.every(v=>Math.abs(v)<=config.maxAngle+1e-6));
  assert.ok(result.tangentLengths.every(v=>v>0));
  assert.ok(result.pathPoints.every(p=>p.every(Number.isFinite)));
  assert.equal(validateRoomRoute(config,result.points).ok,true);
}

const beam={id:'bjælke',wall:'bottom',position:2200,width:300,depth:250};
const beamConfig={...base,obstacles:[beam],clips:[{id:'K1',wall:'bottom',position:700},{id:'K2',wall:'bottom',position:4300}]};
for(const maxAngle of [90,60,45,30]) {
  const config={...beamConfig,maxAngle},route=generateRoomRoute(config);
  checkGeometricRoundTrip(config,route);
  assert.equal(route.direction,'counterclockwise');
  assert.ok(route.geometricLength>4600,'The beam must force a real detour');
  assert.ok(route.turns.length>=(maxAngle>=90?4:8));
  // Independent point-to-rectangle distance verifies the full round route,
  // including its arcs, against the requested outside-pipe free clearance.
  for(const [x,y] of route.pathPoints) {
    const dx=Math.max(beam.position-x,0,x-(beam.position+beam.width));
    const dy=Math.max(-y,0,y-beam.depth);
    assert.ok(Math.hypot(dx,dy)>=config.diameter/2+config.clearance-0.01,'Sampled pipe must clear the beam');
  }
}

const roomCrossing={...base,end:{wall:'top',position:200}};
const shortest=generateRoomRoute(roomCrossing);
checkGeometricRoundTrip(roomCrossing,shortest);
assert.equal(shortest.direction,'clockwise','Auto selects the shorter checked wall direction');
const mandatory={...roomCrossing,clips:[{id:'bottom',wall:'bottom',position:1000},{id:'right',wall:'right',position:1800},{id:'top',wall:'top',position:2500}]};
for(const maxAngle of [90,45,30]) {
  const config={...mandatory,maxAngle},route=generateRoomRoute(config);
  checkGeometricRoundTrip(config,route);
  assert.equal(route.direction,'counterclockwise','All specified clips must be visited');
  assert.ok(route.geometricLength>10000);
}
assert.equal(generateRoomRoute({...mandatory,direction:'clockwise'}).ok,false,'A shorter route must not skip clips');

const varyingGap={...mandatory,clips:[{id:'long-bracket',wall:'right',position:1800,gap:150}]};
const offsetRoute=generateRoomRoute(varyingGap);
checkGeometricRoundTrip(varyingGap,offsetRoute);
assert.ok(offsetRoute.turns.every(n=>[45,-45,90,-90].includes(n)),'Large bracket offsets use exact allowed bend angles');
const clip=pointOnRoomWall(varyingGap,varyingGap.clips[0]);
assert.ok(offsetRoute.straights.some(s=>Math.abs(s.start[0]-clip[0])<1e-6&&Math.abs(s.end[0]-clip[0])<1e-6&&clip[1]>=Math.min(s.start[1],s.end[1])&&clip[1]<=Math.max(s.start[1],s.end[1])),'Clip lies on an actual straight section parallel to its wall');

const rightBeam={...mandatory,obstacles:[{id:'right-beam',wall:'right',position:1300,width:300,depth:500}]};
checkGeometricRoundTrip(rightBeam,generateRoomRoute(rightBeam));
const mergedBeams={...beamConfig,obstacles:[beam,{wall:'bottom',position:2450,width:400,depth:300}]};
checkGeometricRoundTrip(mergedBeams,generateRoomRoute(mergedBeams));

const unsafeDirect=validateRoomRoute(beamConfig,[pointOnRoomWall(base,base.start),pointOnRoomWall(base,base.end)]);
assert.equal(unsafeDirect.ok,false);
assert.equal(unsafeDirect.code,'OBSTACLE_COLLISION');
const outside=validateRoomRoute(base,[[200,56],[200,-20],[4800,-20],[4800,56]]);
assert.equal(outside.ok,false);
assert.equal(outside.code,'WALL_COLLISION');
const tooSharp=validateRoomRoute({...roomCrossing,maxAngle:45},[[200,56],[4944,56],[4944,3444],[200,3444]]);
assert.equal(tooSharp.ok,false);
assert.equal(tooSharp.code,'MAX_ANGLE');
const missed=validateRoomRoute(mandatory,shortest.points);
assert.equal(missed.ok,false);
assert.equal(missed.code,'MISSED_CLIP');
assert.equal(validateRoomRoute(base,[[0,0],[1,1]]).ok,false);
assert.equal(generateRoomRoute({...base,start:{wall:'bottom',position:2300},obstacles:[beam]}).code,'BLOCKED_ANCHOR');
assert.equal(generateRoomRoute({...base,clips:[{id:'blocked',wall:'bottom',position:2300}],obstacles:[beam]}).code,'BLOCKED_ANCHOR');
assert.equal(generateRoomRoute({...base,width:NaN}).code,'INVALID_INPUT');
assert.equal(generateRoomRoute({...base,wallGap:-1}).code,'INVALID_INPUT');
assert.equal(generateRoomRoute({...base,maxAngle:0}).code,'INVALID_INPUT');
assert.equal(generateRoomRoute({...base,radius:6}).code,'INVALID_INPUT');
assert.equal(generateRoomRoute({...base,end:base.start}).code,'IDENTICAL_ENDPOINTS');
assert.equal(generateRoomRoute({...base,obstacles:[{...beam,position:4900}]}).code,'INVALID_OBSTACLE');

const tiny={...base,width:1000,height:1000,radius:300,start:{wall:'bottom',position:200},end:{wall:'right',position:200}};
assert.equal(validateRoomRoute(tiny,[[200,56],[944,56],[944,200]]).code,'INSUFFICIENT_STRAIGHT');
const sketch=generateRoomRoute(beamConfig), edited=structuredClone(sketch.points);
edited[2][1]=beam.depth;
assert.equal(validateRoomRoute(beamConfig,edited).ok,false,'Moving an edited detour into the obstacle must disable it');

// Regression: long incoming/outgoing straights can cross far away from a very
// short intervening arc group. Comparing only their endpoint station gap used
// to skip the entire segment pair and accept this actual crossing.
const crossingConfig={width:1000,height:1000,diameter:12,radius:6.01,wallGap:0,clearance:0,maxAngle:110,
  start:{wall:'left',position:300},end:{wall:'left',position:132.62537289549465},clips:[],obstacles:[]};
const crossingPoints=[[6,300],[507.1624390914912,300],[504.6714771361622,314.12694725061675],[6,132.62537289549465]];
const crossing=validateRoomRoute(crossingConfig,crossingPoints);
assert.equal(crossing.ok,false);
assert.equal(crossing.code,'SELF_COLLISION');

// Regression: checking chord-to-chord distances against diameter alone can
// accept a real arc that protrudes just beyond the sampled chord envelope.
const trueGap=11.999,offset=(38+trueGap)*Math.SQRT2;
const nearArcPoints=[[262,100],[262,338],[900,338],[900,50],[100,50],[100,100+offset],[700,700+offset]];
const nearArcConfig={width:1000,height:1000,diameter:12,radius:38,wallGap:50,clearance:0,maxAngle:90,
  start:{wall:'bottom',position:262,gap:94},end:{wall:'bottom',position:700,gap:700+offset-6},clips:[],obstacles:[]};
const nearArc=validateRoomRoute(nearArcConfig,nearArcPoints);
assert.equal(nearArc.ok,false);
assert.equal(nearArc.code,'SELF_COLLISION');

assert.doesNotThrow(()=>validateRoomRoute(base,[[200,56],[1e308,1e308],[-1e308,-1e308],[4800,56]]));
assert.equal(validateRoomRoute(base,[[200,56],[1e308,1e308],[-1e308,-1e308],[4800,56]]).code,'INVALID_POINTS');

const serpentine=[];
for(let row=0;row<99;row++) {
  const y=200000+row*97000;
  serpentine.push(row%2?[9800000,y]:[200000,y],row%2?[200000,y]:[9800000,y]);
}
const complexConfig={width:1e7,height:1e7,diameter:12,radius:30000,wallGap:50,clearance:0,maxAngle:90,
  start:{wall:'left',position:serpentine[0][1],gap:serpentine[0][0]-6},
  end:{wall:'right',position:serpentine.at(-1)[1],gap:1e7-serpentine.at(-1)[0]-6},clips:[],obstacles:[]};
assert.equal(validateRoomRoute(complexConfig,serpentine).code,'TOO_COMPLEX','Path complexity must be bounded before quadratic checks');

console.log('Room routes: wall stand-off, whole-room directions, all clips, beams, actual fillets, max angles, edited-path checks and impossible constraints PASS');
