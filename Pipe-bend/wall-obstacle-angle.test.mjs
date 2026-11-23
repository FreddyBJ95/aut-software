import assert from 'node:assert/strict';
import {generateWallRoute,validateWallRoute,wallLayout,pointOnWall} from './wall-routing.mjs';

const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-6,`${message??'Values differ'}: ${a} vs ${b}`);
const pointNear=(a,b)=>a.forEach((value,index)=>near(value,b[index]));
const base={wall:{lengths:[5000],turns:[],heading:0,side:'left'},diameter:12,radius:45,wallGap:10,clearance:10,maxAngle:90,
  start:{segment:0,position:200},end:{segment:0,position:4800},clips:[],obstacles:[{id:'feature',segment:0,position:2200,width:120,depth:120}]};

function sampleRoute(route){
  const points=[];
  for(const line of route.straights)for(let i=0;i<=40;i++)points.push(line.start.map((n,k)=>n+(line.end[k]-n)*i/40));
  for(const arc of route.arcs){const start=Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]);for(let i=0;i<=240;i++){const angle=start+arc.turn*Math.PI/180*i/240;points.push([arc.center[0]+arc.radius*Math.cos(angle),arc.center[1]+arc.radius*Math.sin(angle)]);}}
  return points;
}

function checked(config,{angle,fallback=false,exactTop=true}={}){
  const before=structuredClone(config),route=generateWallRoute(config);
  assert.deepEqual(config,before,'Planning must not rewrite the measured walls, obstacle dimensions or requested settings.');
  assert.equal(route.ok,true,route.error);assert.equal(validateWallRoute(config,route.points).ok,true,'The chosen angle still needs complete geometric validation.');
  pointNear(route.start,pointOnWall(config,config.start));pointNear(route.points.at(-1),pointOnWall(config,config.end));
  assert.ok(route.turns.every(turn=>Math.abs(turn)<=config.maxAngle+1e-6));
  near(route.requestedDetourAngle,Math.min(90,config.maxAngle));
  assert.equal(route.detourAngleFallback,fallback);
  assert.deepEqual(route.warnings,fallback?['DETOUR_ANGLE_FALLBACK']:[]);
  if(angle!==undefined)near(route.detourAngle,angle,'The reported detour angle matches the selected construction');
  const walls=wallLayout(config).segments,points=sampleRoute(route),half=config.diameter/2;
  for(const obstacle of config.obstacles){
    const wall=walls[obstacle.segment],local=p=>{const d=[p[0]-wall.start[0],p[1]-wall.start[1]];return[d[0]*wall.unit[0]+d[1]*wall.unit[1],d[0]*wall.normal[0]+d[1]*wall.normal[1]];};
    for(const point of points){const [s,n]=local(point),distance=Math.hypot(Math.max(obstacle.position-s,0,s-obstacle.position-obstacle.width),Math.max(-n,0,n-obstacle.depth));assert.ok(distance-half>=config.clearance-1e-6,'Independent arc sampling preserves outside-pipe obstacle clearance.');}
    if(exactTop){const target=obstacle.depth+config.clearance+half,station=obstacle.position+obstacle.width/2;assert.ok(route.straights.some(line=>{const a=local(line.start),b=local(line.end);return Math.abs(a[1]-target)<1e-6&&Math.abs(b[1]-target)<1e-6&&Math.min(a[0],b[0])<=station+1e-6&&Math.max(a[0],b[0])>=station-1e-6;}),'The horizontal pass must retain the requested exact top clearance, rather than adding radius to its height.');}
  }
  return route;
}

// The reported regression is only a test case; the production planner does
// not inspect any particular obstacle dimensions or pipe/tool model.
const reported=checked(base,{angle:90});assert.deepEqual(reported.turns,[90,-90,-90,90]);
for(const maxAngle of [30,45,60,90,52.5,130]){
  const route=checked({...base,maxAngle},{angle:Math.min(90,maxAngle)});
  assert.ok(route.turns.every(turn=>Math.abs(Math.abs(turn)-Math.min(90,maxAngle))<1e-6),'An unconstrained isolated detour uses the requested angle rather than a shorter 45° shape.');
}

// Distinct, non-square dimensions; several tools; arbitrary view orientations,
// both wall sides and construction from B back toward A.
for(const item of [
  {diameter:8,radius:20,wallGap:7,clearance:13,width:37,depth:83},
  {diameter:12,radius:38,wallGap:10,clearance:10,width:120,depth:120},
  {diameter:16,radius:60,wallGap:18,clearance:7,width:263,depth:185},
  {diameter:22,radius:80,wallGap:35,clearance:15,width:189,depth:260},
])for(const heading of [0,.37,Math.PI/2,-1.3])for(const side of ['left','right'])for(const reverse of [false,true]){
  const {width,depth,...dimensions}=item,c={...base,...dimensions,wall:{...base.wall,heading,side},obstacles:[{...base.obstacles[0],width,depth}],...(reverse?{start:base.end,end:base.start}:{})};
  const route=checked(c,{angle:90});assert.equal(route.turns.length,4);assert.ok(route.turns.every(turn=>Math.abs(turn)===90));
}

// A shallow offset cannot contain two 90° tangent setbacks at this radius.
// Prefer the next feasible angle and report that choice without raising it.
for(const [depth,angle]of [[70,60],[40,45],[15,30]]){
  assert.ok(depth<2*base.radius);
  const route=checked({...base,obstacles:[{...base.obstacles[0],depth}]},{angle,fallback:true});
  assert.deepEqual(route.turns,[angle,-angle,-angle,angle]);
}
checked({...base,maxAngle:60,obstacles:[{...base.obstacles[0],depth:40}]},{angle:45,fallback:true});
checked({...base,maxAngle:45,obstacles:[{...base.obstacles[0],depth:15}]},{angle:30,fallback:true});

// The requested 90° detour needs more lateral radius padding than the first
// valid 45° candidate. Searching the preferred tier across padding levels
// must happen before a shorter lower-angle candidate is considered.
const padded=checked(base,{angle:90});assert.ok(base.obstacles[0].position-padded.points[1][0]>base.clearance+base.diameter/2+base.radius*.5);

const multiple={...base,obstacles:[{id:'first',segment:0,position:1500,width:71,depth:170},{id:'second',segment:0,position:3100,width:263,depth:220}]};
const multiRoute=checked(multiple,{angle:90});assert.equal(multiRoute.turns.length,8);assert.ok(multiRoute.turns.every(turn=>Math.abs(turn)===90));

// Unrelated features retain independent angles: one shallow feature must not
// downgrade every other detour elsewhere along the measured wall.
for(const [radius,shallowDepth]of [[45,38],[55,47]])for(const heading of [0,.71,-1.1])for(const side of ['left','right'])for(const reverse of [false,true])for(const maxAngle of [60,90]){
  const c={...base,radius,maxAngle,wall:{...base.wall,heading,side},obstacles:[{id:'shallow',segment:0,position:1400,width:83,depth:shallowDepth},{id:'tall',segment:0,position:3300,width:217,depth:180}],...(reverse?{start:base.end,end:base.start}:{})},route=checked(c,{angle:45,fallback:true});
  assert.deepEqual(route.detourAngles,[maxAngle,45]);
  const wall=wallLayout(c).segments[0],anglesNear=obstacle=>route.arcs.filter(arc=>{const p=arc.samples[Math.floor(arc.samples.length/2)],along=(p[0]-wall.start[0])*wall.unit[0]+(p[1]-wall.start[1])*wall.unit[1];return along>=obstacle.position-500&&along<=obstacle.position+obstacle.width+500;}).map(arc=>Math.abs(arc.turn));
  const shallow=anglesNear(c.obstacles[0]),tall=anglesNear(c.obstacles[1]);assert.equal(shallow.length,4);assert.equal(tall.length,4);assert.ok(shallow.every(angle=>angle===45));assert.ok(tall.every(angle=>angle===maxAngle),'A separately feasible tall detour keeps its preferred angle.');
}
const merged={...base,obstacles:[{id:'low',segment:0,position:1700,width:180,depth:38},{id:'high',segment:0,position:1810,width:200,depth:180}]};
const mergedRoute=checked(merged,{angle:90,exactTop:false});assert.deepEqual(mergedRoute.detourAngles,[90]);assert.equal(mergedRoute.turns.length,4,'Overlapping obstruction envelopes use their merged height when choosing an angle.');
checked({...base,clips:[{id:'before',segment:0,position:2050},{id:'after',segment:0,position:2480}]},{angle:90});
const corner={...base,wall:{lengths:[5000,1800],turns:[90],heading:.2,side:'left'},end:{segment:1,position:1500},clips:[{id:'first',segment:0,position:600},{id:'next',segment:1,position:900}]};
const cornerRoute=checked(corner,{angle:90});assert.equal(cornerRoute.turns.length,5);assert.ok(cornerRoute.turns.every(turn=>Math.abs(turn)===90));

// Profile envelopes must be tried at the preferred angle too; a valid 90°
// original measured wall route is equally valid and must not force ramps.
const profile={...base,wall:{lengths:[1300,137,173,137,1800],turns:[90,-90,-90,90],heading:0,side:'left'},start:{segment:0,position:200},end:{segment:4,position:1500},obstacles:[]};
const profileRoute=checked(profile);assert.ok(profileRoute.turns.every(turn=>Math.abs(turn)===90));assert.equal(profileRoute.detourAngleFallback,false);

for(const config of [
  {...base,obstacles:[]},
  {...base,wallGap:200,obstacles:[{...base.obstacles[0],depth:71}]},
  {...base,obstacles:[{...base.obstacles[0],position:100}],start:{segment:0,position:600}},
  {...corner,obstacles:[]},
]){
  const route=checked(config,{exactTop:false});assert.equal(route.detourAngle,null,'Straight, off-route and fixed-corner geometry must not advertise an obstacle-angle fallback.');assert.deepEqual(route.detourAngles,[]);
}
const impossible=generateWallRoute({...base,obstacles:[{...base.obstacles[0],position:200,width:4600,depth:300}]});assert.equal(impossible.ok,false,'The preference never bypasses blocked endpoints or collision validation.');
console.log('Obstacle angles: requested tier, diverse sizes/tools/orientations, safe explicit fallback, exact clearance, profile and clip constraints PASS');
