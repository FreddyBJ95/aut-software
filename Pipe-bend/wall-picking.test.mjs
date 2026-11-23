import assert from 'node:assert/strict';
import {pickPipePart,pickWallSegment} from './wall-picking.mjs';
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const vector=(a,b)=>a.forEach((n,i)=>close(n,b[i]));
const vertical={straights:[{start:[100,20],end:[100,1020]}],arcs:[]};

// A screen-sized target must work for vertical/horizontal/sloping pipes, even
// though their actual drawn OD can be less than one pixel in the overview.
for(const angle of [0,Math.PI/2,.731,-2.14])for(const reverse of [false,true])for(const pixelsPerMm of [.08,1,64,256]){
  const P=([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle)+19,x*Math.sin(angle)+y*Math.cos(angle)-73];
  const straight=vertical.straights[0],a=P(reverse?straight.end:straight.start),b=P(reverse?straight.start:straight.end);
  const center=P([100,520]),normal=[Math.cos(angle),Math.sin(angle)];
  for(const offset of [-18,0,18]){
    const target=[center[0]+normal[0]*offset/pixelsPerMm,center[1]+normal[1]*offset/pixelsPerMm];
    const picked=pickPipePart({geometry:{straights:[{start:a,end:b}]},point:target,pixelsPerMm});
    assert.equal(picked?.type,'length');assert.equal(picked.index,0);close(picked.distancePx,Math.abs(offset),1e-7);vector(picked.point,center);
  }
  const tooFar=[center[0]+normal[0]*22.5/pixelsPerMm,center[1]+normal[1]*22.5/pixelsPerMm];
  assert.equal(pickPipePart({geometry:{straights:[{start:a,end:b}]},point:tooFar,pixelsPerMm}),null);
}

// Paint order must never select the more distant overlapping wide hit target.
const parallel={straights:[{start:[100,0],end:[100,1000]},{start:[112,0],end:[112,1000]}]};
assert.equal(pickPipePart({geometry:parallel,point:[102,500],pixelsPerMm:1,selected:{type:'length',index:1}}).index,0);
assert.equal(pickPipePart({geometry:parallel,point:[110,500],pixelsPerMm:1}).index,1);
assert.equal(pickPipePart({geometry:parallel,point:[106,500],pixelsPerMm:1,selected:{type:'length',index:1}}).index,1);
assert.equal(pickPipePart({geometry:parallel,point:[106,500],pixelsPerMm:1}).index,0);
assert.equal(pickPipePart({geometry:vertical,point:[100,-30],pixelsPerMm:1}),null,'Finite segment is not an infinite line');
assert.equal(pickPipePart({geometry:vertical,point:[105.9,500],pixelsPerMm:256,maxDistancePx:12*256/2+4}).index,0,'Visible OD remains selectable at detail zoom');
assert.equal(pickPipePart({geometry:vertical,point:[106.1,500],pixelsPerMm:256,maxDistancePx:12*256/2+4}),null);

// The bend is a circle arc, not the chord between its sparse sample endpoints.
const arc={center:[100,100],radius:38,turn:90,samples:[[100,62],[138,100]]};
const elbow={straights:[{start:[0,62],end:[100,62]},{start:[138,100],end:[138,300]}],arcs:[arc]};
const mid=[100+38*Math.SQRT1_2,100-38*Math.SQRT1_2];
let hit=pickPipePart({geometry:elbow,point:mid,pixelsPerMm:1});
assert.equal(hit.type,'turn');assert.equal(hit.index,0);close(hit.distancePx,0);close(hit.fraction,.5);vector(hit.point,mid);
hit=pickPipePart({geometry:elbow,point:[100+40*Math.SQRT1_2,100-40*Math.SQRT1_2],pixelsPerMm:10});
assert.equal(hit.type,'turn');close(hit.distancePx,20);vector(hit.point,mid);
assert.equal(pickPipePart({geometry:elbow,point:[100,62],pixelsPerMm:1}).type,'turn');
assert.equal(pickPipePart({geometry:elbow,point:[100,62],pixelsPerMm:1,selected:{type:'length',index:0}}).type,'length');
const otherSide={center:[0,0],radius:50,turn:-90,start:[50,0],end:[0,-50]};
hit=pickPipePart({geometry:{arcs:[otherSide]},point:[50*Math.SQRT1_2,-50*Math.SQRT1_2],pixelsPerMm:1});
assert.equal(hit.type,'turn');close(hit.fraction,.5);close(hit.distancePx,0);
assert.equal(pickPipePart({geometry:{arcs:[otherSide]},point:[0,50],pixelsPerMm:1}),null,'Arc must not become its full circle');

// Even an invalid radius draft keeps its explicit sharp bend selectable.
const draft={straights:[{start:[0,0],end:[100,0]},{start:[100,0],end:[100,100]}],arcs:[{vertex:[100,0],samples:[[100,0]]}]};
const draftBefore=structuredClone(draft);
hit=pickPipePart({geometry:draft,point:[100,0],pixelsPerMm:1});
assert.equal(hit.type,'turn');assert.equal(hit.index,0);vector(hit.point,[100,0]);close(hit.fraction,.5);
assert.equal(pickPipePart({geometry:draft,point:[98,1],pixelsPerMm:1}).type,'length','Closer straight beats the nearby draft bend');
assert.equal(pickPipePart({geometry:draft,point:[101,-1],pixelsPerMm:1}).type,'turn','Equidistant endpoints prefer the draft bend');
assert.equal(pickPipePart({geometry:draft,point:[100,0],pixelsPerMm:1,selected:{type:'length',index:1}}).index,1,'Existing selection resolves a true vertex tie');
hit.point[0]=-100;assert.deepEqual(draft,draftBefore,'Draft bend hit points are cloned');
for(const vertex of [[NaN,0],[100,Infinity],[,0],[100],null])assert.equal(pickPipePart({geometry:{arcs:[{vertex,samples:[vertex]}]},point:[100,0],pixelsPerMm:1}),null,'Malformed draft vertices are skipped');
assert.equal(pickPipePart({geometry:{arcs:[{samples:[[100,0]]}]},point:[100,0],pixelsPerMm:1}),null,'Point bends require an explicit vertex');
assert.equal(pickPipePart({geometry:{arcs:[{vertex:[100,0],samples:[[101,0]]}]},point:[100,0],pixelsPerMm:1}),null,'Draft samples must match the explicit vertex');

// Wall placement must use the nearest face and station, in either direction.
const walls=[{index:7,start:[100,20],end:[100,1020]},{index:9,start:[112,20],end:[112,1020]}];
hit=pickWallSegment({segments:walls,point:[102,400],pixelsPerMm:1});
assert.equal(hit.type,'wall');assert.equal(hit.index,7);close(hit.position,380);vector(hit.point,[100,400]);
hit=pickWallSegment({segments:[{...walls[0],start:walls[0].end,end:walls[0].start}],point:[102,400],pixelsPerMm:1});
close(hit.position,620);
assert.equal(pickWallSegment({segments:walls,point:[106,400],pixelsPerMm:1,selectedIndex:9}).index,9);
assert.equal(pickWallSegment({segments:walls,point:[500,400],pixelsPerMm:1}),null);

// Caller geometry is not mutated, and malformed data returns no accidental hit.
const before=structuredClone(elbow);pickPipePart({geometry:elbow,point:mid,pixelsPerMm:1});assert.deepEqual(elbow,before);
for(const options of [undefined,{}, {geometry:vertical,point:[NaN,1],pixelsPerMm:1},{geometry:vertical,point:[,1],pixelsPerMm:1},{geometry:vertical,point:[100,500],pixelsPerMm:0},{geometry:vertical,point:[100,500],pixelsPerMm:Infinity},{geometry:vertical,point:[100,500],pixelsPerMm:1,maxDistancePx:-1},{geometry:{straights:'bad'},point:[100,500],pixelsPerMm:1}])assert.equal(pickPipePart(options),null);
assert.equal(pickPipePart({geometry:{straights:[{start:[0,0],end:[0,0]}],arcs:[{...arc,radius:0}]},point:[0,0],pixelsPerMm:1}),null);
assert.equal(pickPipePart({geometry:{arcs:[{...arc,end:[138,120]}]},point:[138,120],pixelsPerMm:1}),null,'Malformed circle endpoints must not invent a hit');
assert.equal(pickWallSegment({segments:[{start:[0,0],end:[0,0]}],point:[0,0],pixelsPerMm:1}),null);
assert.equal(pickPipePart({geometry:vertical,point:[100,500],pixelsPerMm:1,maxDistancePx:0}).index,0);
console.log('Wall picking: orientation-independent touch targets, nearest overlapping part, exact arcs, finite stations and zoom256 PASS');
