import assert from 'node:assert/strict';
import {geometry3D,bendOrientation,extendSpatial} from './spatial-geometry.mjs?v=44';
import {spatialHeightLayers,spatialLayerSelection} from './spatial-layers.mjs?v=44';

const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const pointClose=(a,b)=>a.forEach((value,index)=>close(value,b[index]));
const base={radius:38,heading:0,measurementMode:'vertex',lengths:[1000,500,1000,300,800],turns:[90,-90,90,-90],bendRotations:[90,0,0,0]};
const g=geometry3D(base),before=structuredClone(g);
assert.deepEqual(spatialHeightLayers(g),[{height:0,lineIndices:[0],arcIndices:[]},{height:500,lineIndices:[2],arcIndices:[]},{height:800,lineIndices:[4],arcIndices:[]}]);
for(const [height,index]of [[0,0],[500,2],[800,4]]){
 const layer=spatialLayerSelection(g,height);
 assert.deepEqual(layer.lines,g.lines.map((_,i)=>i===index));assert(layer.arcs.every(selected=>!selected));
 assert.equal(layer.startVisible,height===0);assert.equal(layer.endVisible,height===800);
 assert(layer.transitions.every(marker=>marker.bendIndex===marker.index&&marker.anchor.length===3));
 for(const marker of layer.transitions){close(marker.anchor[2],height);close(marker.from,height);assert.notEqual(marker.to,marker.from);}
}
assert.deepEqual(spatialLayerSelection(g,500).transitions.map(t=>[t.id,t.direction,t.from,t.to,t.pipeDirection]),[['B2-A','down',500,0,'toward-A'],['B3-B','up',500,800,'toward-B']]);
for(const all of [null,undefined,'all'])assert.equal(spatialLayerSelection(g,all),null);
for(const invalid of [1,499,NaN,Infinity,-Infinity,'500',{},[]])assert.throws(()=>spatialLayerSelection(g,invalid),RangeError);
close(spatialLayerSelection(g,500+2e-7).height,500);
assert.deepEqual(g,before,'Layer discovery and selection must not mutate the physical pipe');

// A lower run directly underneath an upper run keeps its original L1 identity.
const stacked=geometry3D({...base,lengths:[1000,500,1000],turns:[90,90],bendRotations:[90,0]});
assert.deepEqual(spatialLayerSelection(stacked,0).lines,[true,false,false]);
assert.deepEqual(spatialLayerSelection(stacked,500).lines,[false,false,true]);
close(stacked.lines[0].start[1],stacked.lines[2].end[1]);
assert.equal(spatialLayerSelection(stacked,0).transitions[0].bendIndex,0);
assert.equal(spatialLayerSelection(stacked,500).transitions[0].bendIndex,1);

// The same layer can contain several separated pipe portions after a return.
const returnPipe=geometry3D({...base,lengths:[1000,500,700,500,800],turns:[90,-90,-90,90]});
assert.deepEqual(spatialHeightLayers(returnPipe).map(l=>l.lineIndices),[[0,4],[2]]);
const ground=spatialLayerSelection(returnPipe,0);
assert.deepEqual(ground.lines,[true,false,false,false,true]);
assert.deepEqual(ground.transitions.map(t=>[t.lineIndex,t.direction,t.to]),[[0,'up',500],[4,'up',500]]);

// A pitched bridge can leave a layer and return to it without a horizontal
// roof section. Boundary arrows still describe the excursion instead of
// silently connecting both ground sections across the missing height path.
for(const roll of [90,-90]){
 const roof=geometry3D({radius:38,heading:.71,measurementMode:'vertex',lengths:[1000,500,500,1000],turns:[45,-90,45],bendRotations:[roll,0,0]});
 const layers=spatialHeightLayers(roof);assert.equal(layers.length,1);close(layers[0].height,0);
 const selection=spatialLayerSelection(roof,0),sign=Math.sign(roll);
 assert.deepEqual(selection.lines,[true,false,false,true]);assert.equal(selection.transitions.length,2);
 const peak=sign>0?Math.max(...roof.points.map(p=>p[2])):Math.min(...roof.points.map(p=>p[2]));
 for(const marker of selection.transitions){assert.equal(marker.direction,sign>0?'up':'down');close(marker.to,peak);close(marker.returnTo,0);assert.equal(marker.viaHeight,undefined);}
}

// The first movement need not have the same sign as the eventual next level.
// Preserve that initial direction and expose viaHeight for an honest caption.
const crossingBridge=geometry3D({radius:38,heading:.23,measurementMode:'vertex',lengths:[1000,500,1500,1000],turns:[45,-90,45],bendRotations:[90,0,0]});
const crossingLayers=spatialHeightLayers(crossingBridge);assert.equal(crossingLayers.length,2);
close(crossingLayers[0].height,-1000*Math.SQRT1_2);close(crossingLayers[1].height,0);
const crossing=spatialLayerSelection(crossingBridge,0).transitions[0];
assert.equal(crossing.direction,'up');close(crossing.to,-1000*Math.SQRT1_2);assert(crossing.viaHeight>0);close(crossing.viaHeight,Math.max(...crossingBridge.points.map(p=>p[2])));

// Real horizontal corners remain B1 and B4; out-of-plane boundary bends are
// represented separately instead of renumbering the bends in the drawing.
let route={radius:31.25,heading:.413,measurementMode:'vertex',lengths:[450],turns:[]};
for(const [direction,length]of [['left',500],['up',600],['forward',700],['right',800]]){
 const orientation=bendOrientation(route,'B',direction);assert(orientation.available);
 route=extendSpatial(route,'B',length,90*orientation.turnSign,orientation.rotation);
}
const corners=geometry3D(route),cornerLayers=spatialHeightLayers(corners);
assert.deepEqual(cornerLayers.map(l=>[l.lineIndices,l.arcIndices]),[[[0,1],[0]],[[3,4],[3]]]);
assert.deepEqual(spatialLayerSelection(corners,0).arcs,[true,false,false,false]);
assert.deepEqual(spatialLayerSelection(corners,600).arcs,[false,false,false,true]);

// Arbitrary headings, radii, dimensions, negative levels and both measurement
// conventions derive their levels from actual centerline geometry.
for(const radius of [12.5,38,67.25])for(const heading of [0,.27,1.43,Math.PI])for(const sign of [-1,1]){
 const state={...base,radius,heading,lengths:[917.4,531.6,773.2,302.7,658.9],bendRotations:[90*sign,0,0,0]};
 const shape=geometry3D(state),layers=spatialHeightLayers(shape);
 const expected=[0,sign*531.6,sign*(531.6+302.7)].sort((a,b)=>a-b);
 assert.equal(layers.length,3);layers.forEach((layer,i)=>close(layer.height,expected[i]));
 for(const layer of layers){const selected=spatialLayerSelection(shape,layer.height);assert.equal(selected.lines.filter(Boolean).length,1);for(const marker of selected.transitions)close(marker.anchor[2],layer.height);}
 const tangent=geometry3D({...state,measurementMode:'tangent'}),actual=spatialHeightLayers(tangent),first=sign*(531.6+2*radius),second=first+sign*(302.7+2*radius);
 [0,first,second].sort((a,b)=>a-b).forEach((height,i)=>close(actual[i].height,height));
}

// No synthetic floor is created for an inclined pipe or a curved excursion
// whose endpoints share z while the bend itself leaves that plane.
const inclined=geometry3D({radius:20,heading:0,measurementMode:'tangent',lengths:[1000],turns:[],startFrame:{tangent:[Math.SQRT1_2,0,Math.SQRT1_2],normal:[0,1,0]}});
assert.deepEqual(spatialHeightLayers(inclined),[]);assert.throws(()=>spatialLayerSelection(inclined,0),RangeError);
const a=85*Math.PI/180;
const bowed=geometry3D({radius:20,heading:0,measurementMode:'tangent',lengths:[1000,1000],turns:[170],bendRotations:[0],startFrame:{tangent:[Math.cos(a),0,-Math.sin(a)],normal:[Math.sin(a),0,Math.cos(a)]}});
close(bowed.arcs[0].samples[0][2],bowed.arcs[0].samples.at(-1)[2]);
assert.deepEqual(spatialHeightLayers(bowed),[],'Arc endpoints alone cannot define a constant-height bend');

// Translate a complete world-space drawing: displayed heights retain A=0,
// while the transition anchors retain their translated real coordinates.
const shifted=structuredClone(g),delta=[123.4,-57.8,234.5],shift=p=>p.map((value,i)=>value+delta[i]);
shifted.start=shift(shifted.start);shifted.end=shift(shifted.end);shifted.points=shifted.points.map(shift);
for(const line of shifted.lines)for(const key of ['start','end','dimensionStart','dimensionEnd'])line[key]=shift(line[key]);
for(const arc of shifted.arcs){for(const key of ['start','end','center'])arc[key]=shift(arc[key]);arc.samples=arc.samples.map(shift);}
assert.deepEqual(spatialHeightLayers(shifted),spatialHeightLayers(g));
for(const height of [0,500,800]){
 const selected=spatialLayerSelection(shifted,height),original=spatialLayerSelection(g,height);
 assert.deepEqual(selected.lines,original.lines);assert.deepEqual(selected.arcs,original.arcs);
 selected.transitions.forEach((marker,i)=>pointClose(marker.anchor,shift(original.transitions[i].anchor)));
}

// Reverse A/B without changing the physical path: layer datum and original
// indexes follow the reversed pipe sequence rather than special case floors.
const origin=g.end,reversePoint=p=>p.map((v,i)=>v-origin[i]);
const reversed={start:[0,0,0],end:reversePoint(g.start),lines:g.lines.slice().reverse().map(line=>({start:reversePoint(line.end),end:reversePoint(line.start)})),arcs:g.arcs.slice().reverse().map(arc=>({samples:arc.samples.slice().reverse().map(reversePoint)}))};
const reverseLayers=spatialHeightLayers(reversed);[-800,-300,0].forEach((height,i)=>close(reverseLayers[i].height,height));
assert.deepEqual(spatialLayerSelection(reversed,0).lines,[true,false,false,false,false]);
assert.deepEqual(spatialLayerSelection(reversed,-800).lines,[false,false,false,false,true]);
assert(spatialLayerSelection(reversed,0).transitions.every(t=>t.direction==='down'));

// Plane noise groups within tolerance, and planar projects remain one layer.
const flat=geometry3D({radius:38,heading:.23,measurementMode:'vertex',lengths:[1000,500,1000],turns:[90,-90]});
assert.deepEqual(spatialHeightLayers(flat),[{height:0,lineIndices:[0,1,2],arcIndices:[0,1]}]);
const explicit=geometry3D({...base,lengths:[1000,500,1000],turns:[90,-90],bendRotations:[0,0],startFrame:{tangent:[1,0,0],normal:[0,1,0]}});
assert.equal(spatialHeightLayers(explicit).length,1);
const noisy=structuredClone(flat);noisy.lines[1].start[2]+=4e-7;noisy.lines[1].end[2]+=4e-7;
assert.equal(spatialHeightLayers(noisy).length,1);assert(spatialLayerSelection(noisy,0).lines.every(Boolean));
assert.throws(()=>spatialHeightLayers({}),TypeError);
assert.throws(()=>spatialHeightLayers({...g,start:[0,0]}),TypeError);
assert.throws(()=>spatialHeightLayers({...g,lines:[{start:[0,0,0],end:[0,0,NaN]}]}),TypeError);
console.log('Height layers: overlapping runs, stable references, boundary transitions, repeated/negative levels, arbitrary headings/radii, tangent heights, inclined arcs, translated/reversed A datum and no mutation PASS');
