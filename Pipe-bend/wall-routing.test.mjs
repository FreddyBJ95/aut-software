import assert from 'node:assert/strict';
import {generateWallRoute,validateWallRoute,wallLayout,pointOnWall,wallObstaclePolygon,arcSegmentDistance} from './wall-routing.mjs';
import {geometry} from './geometry.mjs';
import {generateRoomRoute} from './room-routing.mjs';

const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const base={wall:{lengths:[2400],turns:[],heading:0,side:'left'},diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:90,
  start:{segment:0,position:200},end:{segment:0,position:2200},clips:[{id:'K1',segment:0,position:600},{id:'K2',segment:0,position:1800}],obstacles:[]};

const drawn=wallLayout({wall:base.wall});
assert.equal(drawn.ok,true);
assert.deepEqual(drawn.points,[[0,0],[2400,0]]);
assert.equal(drawn.segments[0].length,2400);
assert.deepEqual(drawn.segments[0].normal,[-0,1]);
assert.deepEqual(pointOnWall(base,{segment:0,position:100}),[100,56]);
assert.deepEqual(pointOnWall(base,{segment:0,position:100,gap:150}),[100,156]);
assert.deepEqual(wallObstaclePolygon(base,{id:'F1',segment:0,position:800,width:200,depth:300}).points,[[800,0],[1000,0],[1000,300],[800,300]]);

function checked(c,result=generateWallRoute(c)) {
  assert.equal(result.ok,true,result.error);
  assert.ok(result.turns.every(t=>Math.abs(t)<=c.maxAngle+1e-6));
  assert.ok(result.tangentLengths.every(t=>t>0));
  assert.ok(result.pathPoints.every(p=>p.every(Number.isFinite)));
  assert.equal(validateWallRoute(c,result.points).ok,true);
  const g=geometry({radius:c.radius,measurementMode:'vertex',heading:result.heading,lengths:result.lengths,turns:result.turns}),end=pointOnWall(c,c.end);
  close(g.end[0]+result.start[0],end[0]);close(g.end[1]+result.start[1],end[1]);close(g.used,result.geometricLength);
  return result;
}
const straight=checked(base);
assert.deepEqual(straight.points,[[200,56],[2200,56]]);
assert.deepEqual(straight.lengths,[2000]);assert.deepEqual(straight.turns,[]);
checked({...base,diameter:22,radius:80});
checked({...base,wallGap:0});

const beam={id:'bjælke',segment:0,position:1050,width:250,depth:250};
const beamConfig={...base,obstacles:[beam]};
for(const maxAngle of [90,60,45,30]) {
  const c={...beamConfig,maxAngle},route=checked(c);
  assert.ok(route.turns.length>=4);
  assert.ok(route.geometricLength>2000);
  // Independent dense interpolation of actual arc primitives checks the
  // outside-pipe distance to the beam, not only the theoretical corners.
  for(const arc of route.arcs) {
    const start=Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]);
    for(let i=0;i<=1000;i++) {
      const angle=start+arc.turn*Math.PI/180*i/1000,p=[arc.center[0]+arc.radius*Math.cos(angle),arc.center[1]+arc.radius*Math.sin(angle)];
      const dx=Math.max(beam.position-p[0],0,p[0]-beam.position-beam.width),dy=Math.max(-p[1],0,p[1]-beam.depth);
      assert.ok(Math.hypot(dx,dy)>=c.diameter/2+c.clearance-1e-6);
    }
  }
}
// Real user regression: a 120 mm obstacle, 10 mm wall gap and 10 mm
// clearance need a 120 mm rise. Radius padding must change the approach
// location, never raise the pipe from a 10 mm gap to 29 mm (R38 / 2 extra).
const exactGap={...base,wall:{lengths:[2200],turns:[],heading:0,side:'left'},wallGap:10,clearance:10,maxAngle:45,
  start:{segment:0,position:200},end:{segment:0,position:2000},clips:[],obstacles:[{id:'120-square',segment:0,position:1000,width:120,depth:120}]};
function physicalSamples(route) {
  const points=[];
  for(const straight of route.straights)for(let i=0;i<=80;i++)points.push(straight.start.map((v,k)=>v+(straight.end[k]-v)*i/80));
  for(const arc of route.arcs) {
    const start=Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]);
    for(let i=0;i<=720;i++){const angle=start+arc.turn*Math.PI/180*i/720;points.push([arc.center[0]+arc.radius*Math.cos(angle),arc.center[1]+arc.radius*Math.sin(angle)]);}
  }
  return points;
}
function exactTopClearance(c,route,obstacle) {
  // Independent measured-wall coordinates and dense physical primitives,
  // rather than checking the construction vertices or reusing its validator.
  const wall=wallLayout(c).segments[obstacle.segment];
  const local=p=>{const x=p[0]-wall.start[0],y=p[1]-wall.start[1];return[x*wall.unit[0]+y*wall.unit[1],x*wall.normal[0]+y*wall.normal[1]];};
  const points=physicalSamples(route).map(local),half=c.diameter/2;
  let minimum=Infinity;
  for(const [along,normal]of points) {
    const dx=Math.max(obstacle.position-along,0,along-obstacle.position-obstacle.width),dy=Math.max(-normal,0,normal-obstacle.depth);
    minimum=Math.min(minimum,Math.hypot(dx,dy)-half);
  }
  assert.ok(minimum>=c.clearance-1e-6,'Every actual arc and straight must retain the requested clearance');
  close(minimum,c.clearance);
  const target=obstacle.depth+c.clearance+half,midpoint=obstacle.position+obstacle.width/2;
  assert.ok(route.straights.some(line=>{
    const a=local(line.start),b=local(line.end);
    return Math.abs(a[1]-target)<1e-6&&Math.abs(b[1]-target)<1e-6&&Math.min(a[0],b[0])<=midpoint&&Math.max(a[0],b[0])>=midpoint;
  }),'The straight over the obstacle must have the requested outside-pipe gap exactly');
}
const approaches=[];
for(const [diameter,radius]of [[12,38],[12,45],[22,80]]) {
  const c={...exactGap,diameter,radius},route=checked(c);
  assert.deepEqual(route.turns,[45,-45,-45,45]);
  close(route.lengths[1],120*Math.SQRT2);close(route.lengths[3],120*Math.SQRT2);
  close(route.tangentLengths[1],120*Math.SQRT2-2*radius*Math.tan(Math.PI/8));
  exactTopClearance(c,route,c.obstacles[0]);approaches.push(route.points[1][0]);
  for(const [wallGap,clearance]of [[30,10],[10,30],[10,0]]) {
    const other={...c,wallGap,clearance},r=checked(other),rise=120+clearance-wallGap;
    close(r.lengths[1],rise*Math.SQRT2);close(r.lengths[3],rise*Math.SQRT2);exactTopClearance(other,r,other.obstacles[0]);
  }
}
assert.ok(approaches[2]<approaches[0],'A larger radius starts its approach earlier, without increasing the obstacle rise');
for(const c of [
  {...exactGap,wall:{...exactGap.wall,side:'right'}},
  {...exactGap,wall:{...exactGap.wall,heading:0.73}},
  {...exactGap,start:exactGap.end,end:exactGap.start},
  {...exactGap,clips:[{id:'before',segment:0,position:700},{id:'after',segment:0,position:1500}]},
])exactTopClearance(c,checked(c),c.obstacles[0]);
const separate={...exactGap,wall:{...exactGap.wall,lengths:[3200]},end:{segment:0,position:3000},
  obstacles:[{id:'first',segment:0,position:900,width:120,depth:120},{id:'second',segment:0,position:2100,width:120,depth:180}]};
const separateRoute=checked(separate);
for(const obstacle of separate.obstacles)exactTopClearance(separate,separateRoute,obstacle);
const alreadyClear={...exactGap,wallGap:150},flat=checked(alreadyClear);
assert.equal(flat.turns.length,0,'An already clear baseline needs no extra lift');

const changedGap={...base,clips:[{id:'dyb-klamme',segment:0,position:1100,gap:180}]};
const offset=checked(changedGap);
assert.ok(offset.turns.length>=4);
const clip=pointOnWall(changedGap,changedGap.clips[0]);
assert.ok(offset.straights.some(s=>Math.abs(s.start[1]-clip[1])<1e-6&&Math.abs(s.end[1]-clip[1])<1e-6&&clip[0]>=Math.min(s.start[0],s.end[0])&&clip[0]<=Math.max(s.start[0],s.end[0])));

const corner={...base,wall:{lengths:[2400,1600],turns:[90],heading:0,side:'left'},end:{segment:1,position:1400},clips:[{id:'K1',segment:0,position:600},{id:'K2',segment:1,position:1000}]};
for(const turn of [90,-90,55,-55,120,-120])for(const side of ['left','right'])for(const maxAngle of [90,45]) {
  checked({...corner,wall:{...corner.wall,turns:[turn],side},maxAngle});
}
for(const side of ['left','right'])checked({...corner,wall:{...corner.wall,side},obstacles:[beam],maxAngle:45});
const rotated={...corner,wall:{...corner.wall,heading:0.73}};
checked(rotated);
const reverse={...corner,start:corner.end,end:corner.start};
assert.equal(checked(reverse).direction,'reverse');
checked({...base,wall:{...base.wall,lengths:[1200,1200],turns:[0]},end:{segment:1,position:1000},clips:[{segment:0,position:600},{segment:1,position:600}]});
// Unused measured pieces need not be long enough to carry a bend: only the
// selected start-to-end section is proposed, while all walls remain barriers.
checked({...base,wall:{...base.wall,lengths:[2400,20],turns:[90]}});

// Real user drawing: two 120 mm wall protrusions along an eleven-piece wall.
// A proposal must leave the wall earlier, rather than copy every square edge
// with tightly packed bends or tell the user to edit nonexistent route points.
const notches={...base,wall:{lengths:[1000,1000,120,120,120,1000,1200,120,120,120,1200],turns:[90,90,-90,-90,90,90,90,-90,-90,90],heading:0,side:'left'},wallGap:10,clearance:10,maxAngle:45,start:{segment:0,position:200},end:{segment:10,position:1000},clips:[],obstacles:[]};
function sampledWallClearance(c,route) {
  const walls=wallLayout(c).segments;
  const pointDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
  const points=[];
  for(const straight of route.straights)for(let i=0;i<=40;i++)points.push(straight.start.map((v,k)=>v+(straight.end[k]-v)*i/40));
  for(const arc of route.arcs) {
    const start=Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]);
    for(let i=0;i<=240;i++){const a=start+arc.turn*Math.PI/180*i/240;points.push([arc.center[0]+arc.radius*Math.cos(a),arc.center[1]+arc.radius*Math.sin(a)]);}
  }
  for(const p of points)for(const wall of walls)assert.ok(pointDistance(p,wall.start,wall.end)>=c.diameter/2-1e-6,'Sampled pipe outside overlaps a measured wall');
}
for(const [diameter,radius]of [[12,38],[22,80],[22,120]])for(const maxAngle of [30,45,60,90]) {
  const c={...notches,diameter,radius,maxAngle},route=checked(c);
  sampledWallClearance(c,route);
  if(maxAngle===45){assert.ok(route.turns.length<=12,'Use ramps instead of twenty short bends');assert.ok(Math.min(...route.tangentLengths)>diameter*2,'Prefer a proposal with usable separation between bends');}
}
for(const c of [
  {...notches,wall:{...notches.wall,turns:notches.wall.turns.map(n=>-n),side:'right'}},
  {...notches,wall:{...notches.wall,heading:0.73}},
  {...notches,start:notches.end,end:notches.start},
])sampledWallClearance(c,checked(c));
for(const clip of [{id:'near-bump',segment:1,position:900},{id:'lateral-support',segment:2,position:60},{id:'front-support',segment:3,position:60},{id:'second-front',segment:8,position:60}]) {
  const c={...notches,clips:[clip]},route=checked(c),saved=route.clipPoints.find(a=>a.id===clip.id);
  assert.equal(saved.segment,clip.segment,'Return the original measured wall segment');
  saved.point.forEach((n,i)=>close(n,pointOnWall(c,clip)[i]));
  sampledWallClearance(c,route);
}
for(const obstacle of [{id:'original-front',segment:3,position:40,width:40,depth:40},{id:'original-baseline',segment:1,position:400,width:100,depth:60},{id:'original-last',segment:10,position:400,width:100,depth:100}])checked({...notches,obstacles:[obstacle]});
const noSpace=generateWallRoute({...notches,radius:2000});
assert.equal(noSpace.ok,false);
assert.ok(!/Flyt punkterne/.test(noSpace.error),'Do not instruct users to edit a route that was never proposed');

assert.equal(validateWallRoute(beamConfig,straight.points).code,'OBSTACLE_COLLISION');
const beamRoute=checked(beamConfig),edited=structuredClone(beamRoute.points);
edited[2][1]=beam.depth;
assert.equal(validateWallRoute(beamConfig,edited).ok,false);
assert.equal(validateWallRoute(changedGap,straight.points).code,'MISSED_CLIP');
assert.equal(validateWallRoute({...corner,maxAngle:45},checked(corner).points).code,'MAX_ANGLE');
assert.equal(validateWallRoute(base,[[0,0],[100,100]]).code,'ENDPOINT_MISMATCH');
assert.equal(validateWallRoute(base,[[200,56],[1e308,1e308],[2200,56]]).code,'INVALID_POINTS');
assert.equal(generateWallRoute({...base,clips:[{segment:0,position:100}]}).code,'CLIP_ORDER');
assert.equal(generateWallRoute({...base,start:{segment:1,position:100}}).code,'INVALID_ENDPOINT');
assert.equal(generateWallRoute({...base,end:base.start}).code,'IDENTICAL_ENDPOINTS');
assert.equal(generateWallRoute({...base,clips:[{segment:0,position:2500}]}).code,'INVALID_CLIP');
assert.equal(generateWallRoute({...beamConfig,start:{segment:0,position:1100}}).code,'BLOCKED_ANCHOR');
assert.equal(generateWallRoute({...base,obstacles:[{...beam,position:2350}]}).code,'INVALID_OBSTACLE');
for(const invalid of [{radius:6},{radius:Infinity},{diameter:NaN},{wallGap:-1},{clearance:-1},{maxAngle:0},{maxAngle:180}])assert.equal(generateWallRoute({...base,...invalid}).code,'INVALID_INPUT');
for(const wall of [{lengths:[],turns:[]},{lengths:[2400],turns:[90]},{lengths:[-1],turns:[]},{lengths:[Infinity],turns:[]},{lengths:[100,100],turns:[180]},{lengths:[100],turns:[],side:'back'}])assert.equal(wallLayout({wall}).code,'INVALID_WALL');
assert.equal(wallLayout({wall:{lengths:[200,200,200,300],turns:[90,90,90]}}).code,'WALL_SELF_INTERSECTION');

// Measuring a wall section does not create a physical doorway at either end.
// An edited route must not wrap around an unmeasured tip onto the back face.
const wrap=[[200,56],[-100,56],[-100,-100],[2500,-100],[2500,56],[2200,56]];
assert.equal(validateWallRoute({...base,clips:[]},wrap).code,'WALL_COLLISION');
const behind=[[200,56],[200,-100],[2200,-100],[2200,56]];
assert.equal(validateWallRoute({...base,clips:[]},behind).code,'WALL_COLLISION');
assert.equal(validateWallRoute({...base,wall:{...base.wall,side:'right'},clips:[]},wrap.map(([x,y])=>[x,-y])).code,'WALL_COLLISION');

// The minimum arc/wall gap lies between sampled angles on a rotated wall.
// A 0.001 mm physical overlap must be rejected; exact tangency is permitted.
for(const minimum of [5.999,6,6.001]) {
  const h=0.311,y=minimum-38,dx=(56-y)/Math.tan(Math.PI/3),rotate=([x,y])=>[x*Math.cos(h)-y*Math.sin(h),x*Math.sin(h)+y*Math.cos(h)];
  const c={...base,wall:{lengths:[1000],turns:[],heading:h,side:'left'},maxAngle:130,end:{segment:0,position:200+2*dx},clips:[]};
  const result=validateWallRoute(c,[[200,56],[200+dx,y],[200+2*dx,56]].map(rotate));
  assert.equal(result.ok,minimum>=6);
  if(minimum<6)assert.equal(result.code,'WALL_COLLISION');
}
const outsideCorner={...corner,wall:{...corner.wall,turns:[-90]},clips:[]},smallRadius=checked(outsideCorner);
assert.equal(validateWallRoute({...outsideCorner,radius:500},smallRadius.points).code,'WALL_COLLISION','A larger radius must be rechecked even if all tangent lengths remain positive');

// A tiny bend crossing a long unmeasured continuation ray must not disappear
// when squared world-coordinate values dwarf the bend radius.
const smallArc={center:[-100000000,0],radius:8.5,turn:90,samples:[135,225].map(angle=>[-100000000+8.5*Math.cos(angle*Math.PI/180),8.5*Math.sin(angle*Math.PI/180)])};
assert.equal(arcSegmentDistance(smallArc,[-1600000000,0],[0,0]),0);
const r=8.5,k=r*Math.SQRT2,v1=-1e8-k,v2=-2e8-k,y=v1-1000;
const largeWall={...base,wall:{lengths:Array(10).fill(1e7),turns:Array(9).fill(0),side:'left',heading:0},radius:r,clips:[]};
const distantCrossings=[[200,56],[200,500],[v1+500,500],[v1,0],[1000,y],[1000,y-1000],[v2+1000,y-1000],[v2+1000,-1000],[v2,0],[v2+1000,1000],[2200,1000],[2200,56]];
assert.equal(validateWallRoute(largeWall,distantCrossings).code,'WALL_COLLISION');

// Legacy rectangular plans form a closed chain; their unchanged valid points
// must survive migration, including paths crossing the drawing's seam.
const old={width:4000,height:3000,diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:90,start:{wall:'bottom',position:200},end:{wall:'bottom',position:3800},clips:[{id:'K',wall:'left',position:1000}],obstacles:[]};
const oldRoute=generateRoomRoute(old);assert.equal(oldRoute.ok,true,oldRoute.error);
const migrated={...old,wall:{lengths:[4000,3000,4000,3000],turns:[90,90,90],side:'left',heading:0},start:{segment:0,position:200},end:{segment:0,position:3800},clips:[{id:'K',segment:3,position:2000}]};
assert.equal(wallLayout(migrated).closed,true);
checked(migrated,validateWallRoute(migrated,oldRoute.points));
checked(migrated);

console.log('Measured wall routes: straight/open chains, both sides, corners, beams, clips, max angles, exact clearance, continuation and migration PASS');
