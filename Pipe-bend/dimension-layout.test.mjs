import assert from 'node:assert/strict';
import {placeDimensionLabels, rectPolygon, polygonsOverlap} from './dimension-layout.mjs';
import {geometry} from './geometry.mjs';
import {bestDrawingAngle} from './labels.mjs';

function verify(items, obstacles, name) {
  const start = performance.now();
  const placed = placeDimensionLabels(items, obstacles);
  assert.equal(placed.length, items.length);
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    assert.ok([p.x,p.y,p.angle,p.offset,p.along,...p.polygon.flat(),...Object.values(p.box)].every(Number.isFinite));
    for (const other of placed.slice(0, i)) assert.equal(polygonsOverlap(p.polygon, other.polygon), false, `${name}: ${p.id} overlaps ${other.id}`);
    for (const obstacle of obstacles) assert.equal(polygonsOverlap(p.polygon, obstacle), false, `${name}: ${p.id} overlaps pipe`);
  }
  console.log(`${name}: PASS (${Math.round(performance.now()-start)} ms)`);
  return placed;
}
function pipeObstacle(a,b) { return rectPolygon((a[0]+b[0])/2,(a[1]+b[1])/2,Math.hypot(b[0]-a[0],b[1]-a[1]),14,Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI); }

const points=[[100,350],[600,350],[600,120],[550,120],[550,300],[500,300],[500,140]];
const items=points.slice(1).map((p,i)=>({id:'L'+(i+1),index:i,a:points[i],b:p,text:String(350+i),width:55,height:25}));
verify(items,points.slice(1).map((p,i)=>pipeObstacle(points[i],p)),'Dense six-section near-U');

const fixture=geometry({radius:80,heading:0,lengths:[350,3400,473,400,340,3400],turns:[90,-45,-45,-45,-45]});
const angle=bestDrawingAngle(fixture.points),c=Math.cos(angle),s=Math.sin(angle),raw=fixture.points.map(([x,y])=>[x*c-y*s,x*s+y*c]);
const xs=raw.map(p=>p[0]),ys=raw.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),scale=Math.min(600/(maxx-minx),340/(maxy-miny));
const project=([x,y])=>[450+(x*c-y*s-(minx+maxx)/2)*scale,270-(x*s+y*c-(miny+maxy)/2)*scale];
const fixtureItems=fixture.lines.map((l,i)=>({id:'L'+(i+1),index:i,a:project(l.start),b:project(l.end),text:String(l.length),width:58,height:25}));
const fixtureObstacles=fixture.lines.map(l=>pipeObstacle(project(l.start),project(l.end)));
for(const arc of fixture.arcs) for(let i=1;i<arc.samples.length;i++)fixtureObstacles.push(pipeObstacle(project(arc.samples[i-1]),project(arc.samples[i])));
verify(fixtureItems,fixtureObstacles,'Actual GUI fixture, sampled arcs');

const repeated=Array.from({length:50},(_,i)=>({id:'L'+i,index:i,a:[400,260],b:[450,280],text:'3400',width:70,height:24,angle:21.8}));
verify(repeated,[rectPolygon(425,270,60,18,21.8)],'50 identical anchors');
assert.ok(polygonsOverlap(rectPolygon(0,0,20,20),rectPolygon(5,5,20,20)));
assert.ok(!polygonsOverlap(rectPolygon(0,0,20,20),rectPolygon(100,0,20,20)));
assert.throws(()=>placeDimensionLabels([{a:[0,0],b:[1,1],width:NaN,height:10}]));

// Reject unsuitable local candidates before reserving any label space. A
// rejected/omitted dimension must not push later accepted labels to distant rails.
const boundedItems=[{id:'omit',a:[100,100],b:[200,100],width:70,height:24},{id:'keep',a:[100,100],b:[200,100],width:70,height:24}];
const bounded=placeDimensionLabels(boundedItems,[],{x:0,y:0,w:300,h:300},{allowOmissions:true,acceptCandidate:p=>p.id==='keep'&&Math.abs(p.x-150)<1e-8&&Math.abs(p.y-128)<1e-8});
assert.equal(bounded.length,1);assert.equal(bounded[0].id,'keep');assert.equal(bounded[0].x,150);assert.equal(bounded[0].y,128);
console.log('Local candidate rejection does not reserve phantom dimension space: PASS');

// A real free label slot can fall between the coarse normal offsets. The
// fallback must find that slot rather than assume the whole area is crowded.
const slotItem={id:'L11',index:10,a:[100,100],b:[200,100],text:'270 mm',width:40,height:18};
const slotWalls=[rectPolygon(61,150,122,300),rectPolygon(239,150,122,300),rectPolygon(150,74.5,300,149),rectPolygon(150,239.5,300,121)];
const slotBounds={x:0,y:0,w:300,h:300};
const inSlotView=p=>p.box.x>=0&&p.box.y>=0&&p.box.x+p.box.w<=300&&p.box.y+p.box.h<=300;
assert.equal(placeDimensionLabels([slotItem],slotWalls,slotBounds,{allowOmissions:true,acceptCandidate:inSlotView}).length,0);
const slotted=placeDimensionLabels([slotItem],slotWalls,slotBounds,{allowOmissions:true,localFallback:true,acceptCandidate:inSlotView});
assert.equal(slotted.length,1,'270 mm must use available local whitespace');
assert.equal(slotted[0].x,150);assert.equal(slotted[0].y,164);
for(const obstacle of slotWalls)assert.equal(polygonsOverlap(slotted[0].polygon,obstacle),false);

// Retrying an omitted short-leg dimension must keep already-good labels fixed.
const good={id:'L1',index:0,a:[450,400],b:[750,400],text:'1.000 mm',width:90,height:28};
const short={id:'L11',index:10,a:[150,100],b:[150,180],text:'270 mm',width:76,height:28};
const obstacles=[rectPolygon(60,140,160,250),rectPolygon(180,100,50,28),rectPolygon(180,180,50,28),rectPolygon(150,140,16,80)];
const view={x:0,y:0,w:900,h:1200},within=limit=>p=>Math.hypot(p.x-(p.a[0]+p.b[0])/2,p.y-(p.a[1]+p.b[1])/2)<=limit;
const primary=placeDimensionLabels([good,short],obstacles,view,{allowOmissions:true,acceptCandidate:within(78)});
assert.deepEqual(primary.map(p=>p.id),['L1']);const primaryBefore=structuredClone(primary);
const recovered=placeDimensionLabels([short],[...obstacles,...primary.map(p=>p.polygon)],view,{allowOmissions:true,localFallback:true,acceptCandidate:within(118)});
assert.equal(recovered.length,1,'The short vertical 270 mm callout has room beyond the first leader limit');
for(const fixed of [...obstacles,...primary.map(p=>p.polygon)])assert.equal(polygonsOverlap(recovered[0].polygon,fixed),false);
assert.deepEqual(primary,primaryBefore,'Retrying a missing label must not move an existing one');
console.log('Missing270 dimension: fine whitespace search and fixed first-pass labels PASS');
