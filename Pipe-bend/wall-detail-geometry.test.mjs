import assert from 'node:assert/strict';
import {getWallClearanceDimensions,geometryToSvgPath} from './wall-detail-geometry.mjs';
import {arcSegmentDistance} from './wall-routing.mjs';

const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const vector=(a,b)=>a.forEach((n,i)=>close(n,b[i]));
const wall={index:0,id:'V1',start:[0,0],end:[200,0],normal:[0,1]};
const straight=(y=16)=>({straights:[{start:[20,y],end:[180,y],length:160}],arcs:[]});
const measure=(geometry=straight(),wallSegments=[wall],selected)=>getWallClearanceDimensions({geometry,wallSegments,diameter:12,selected});

// The 10 mm shown is the actual16 mm centerline offset minus6 mm tube radius.
const dimension=measure()[0];assert.equal(measure().length,1);close(dimension.gap,10);
vector(dimension.wallPoint,[100,0]);vector(dimension.centerPoint,[100,16]);vector(dimension.outsidePoint,[100,10]);
assert.equal(dimension.onFace,true);assert.equal(dimension.wrongSide,false);
for(const gap of [0,1.3,10,13.2,50,93.75]) {
  const actual=measure(straight(gap+6))[0];close(actual.gap,gap);vector(actual.outsidePoint,[100,gap]);
}
const collision=measure(straight(4))[0];close(collision.gap,-2);assert.equal(collision.wrongSide,false);
const wrongSide=measure(straight(-16))[0];assert.equal(wrongSide.wrongSide,true);close(wrongSide.gap,-22);close(wrongSide.physicalGap,10);
const rightSide=measure(straight(-16),[{...wall,normal:[0,-1]}])[0];close(rightSide.gap,10);vector(rightSide.outsidePoint,[100,-10]);

// World rotation, reversed pipe direction and reversed wall drawing direction
// retain the same finite wall face, side and true measurement.
for(const angle of [0,.731,Math.PI/2,-2.21])for(const reversePipe of [false,true])for(const reverseWall of [false,true]) {
  const rotate=([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
  const source=straight(19.2),s=source.straights[0];
  const geometry={straights:[{start:rotate(reversePipe?s.end:s.start),end:rotate(reversePipe?s.start:s.end)}],arcs:[]};
  const face={...wall,start:rotate(reverseWall?wall.end:wall.start),end:rotate(reverseWall?wall.start:wall.end),normal:rotate(wall.normal)};
  const actual=measure(geometry,[face])[0];close(actual.gap,13.2);vector(actual.wallPoint,rotate([100,0]));vector(actual.outsidePoint,rotate([100,13.2]));
}

// A finite short face cannot create a fictional normal foot on its extension.
const short=measure({straights:[{start:[100,16],end:[200,16]}],arcs:[]},[{...wall,end:[10,0]}])[0];
vector(short.wallPoint,[10,0]);vector(short.centerPoint,[100,16]);assert.equal(short.onFace,false);
close(short.gap,Math.hypot(90,16)-6);assert.ok(short.gap>80);
const shortOverlap=measure({straights:[{start:[9,16],end:[11,16]}],arcs:[]},[{...wall,end:[10,0]}])[0];
vector(shortOverlap.wallPoint,[9.5,0]);vector(shortOverlap.centerPoint,[9.5,16]);close(shortOverlap.gap,10);

// The selected bend uses exact circle geometry, even when its samples contain
// only endpoints and miss the nearest location in the middle of the arc.
const arc={center:[100,50],radius:34,turn:180,samples:[[66,50],[134,50]]};
const arcGeometry={straights:[{start:[40,50],end:[66,50]}],arcs:[arc]};
const arcDimension=measure(arcGeometry,[wall],{type:'turn',index:0})[0];
assert.equal(arcDimension.type,'turn');assert.equal(arcDimension.index,0);close(arcDimension.fraction,.5);
vector(arcDimension.centerPoint,[100,16]);vector(arcDimension.outsidePoint,[100,10]);close(arcDimension.gap,10);
close(arcDimension.centerDistance,arcSegmentDistance(arc,wall.start,wall.end));
assert.equal(measure(arcGeometry,[wall],{type:'length',index:0}).length,1);
assert.equal(measure(arcGeometry,[wall],{type:'turn',index:9}).length,0);
const crossing={center:[100,0],radius:34,turn:180,samples:[[66,0],[134,0]]};
close(measure({straights:[],arcs:[crossing]},[wall],{type:'turn',index:0})[0].gap,-6);
const finiteArc=measure({straights:[],arcs:[arc]},[{...wall,start:[200,0],end:[210,0]}],{type:'turn',index:0})[0];
close(finiteArc.centerDistance,arcSegmentDistance(arc,[200,0],[210,0]));

// Full paths have analytic SVG arc commands. A reflected uniform P transform
// changes both radius and sweep; it does not turn a bend into faceted lines.
const elbow={straights:[{start:[0,16],end:[100,16]},{start:[138,54],end:[138,150]}],arcs:[{center:[100,54],radius:38,turn:90,samples:[[100,16],[138,54]]}]};
const before=structuredClone(elbow),path=geometryToSvgPath(elbow);
assert.match(path,/^M 0 16 L 100 16 A 38 38 0 0 1 138 54 L 138 150$/);
const projected=geometryToSvgPath(elbow,{mapPoint:([x,y])=>[10+x*2,400-y*2],scale:2,flipY:true});
assert.match(projected,/A 76 76 0 0 0 286 292/);assert.deepEqual(elbow,before);
assert.match(geometryToSvgPath({arcs:[elbow.arcs[0]],straights:[]}),/^M 100 16 A 38 38 0 0 1 138 54$/);
assert.equal(geometryToSvgPath({straights:[elbow.straights[1]],arcs:[]}),'M 138 54 L 138 150');
const clockwise={...elbow.arcs[0],turn:-90,start:[100,16],end:[62,54]};
assert.match(geometryToSvgPath({arcs:[clockwise]}),/ 0 0 0 62 54$/);
assert.match(geometryToSvgPath({arcs:[clockwise]},{flipY:true}),/ 0 0 1 62 54$/);

for(const options of [undefined,{}, {geometry:straight(),wallSegments:[wall],diameter:0}, {geometry:straight(),wallSegments:[wall],diameter:NaN}, {geometry:straight(),wallSegments:[{...wall,end:[0,0]}],diameter:12}, {geometry:straight(),wallSegments:[wall],diameter:12,selected:{type:'length',index:-1}}])assert.deepEqual(getWallClearanceDimensions(options),[]);
assert.equal(geometryToSvgPath(null),'');assert.equal(geometryToSvgPath(elbow,{scale:NaN}),'');
assert.equal(geometryToSvgPath(elbow,{mapPoint:()=>[NaN,0]}),'');
assert.equal(geometryToSvgPath({arcs:[{...arc,radius:0}]}),'');
console.log('wall-detail-geometry tests passed');
