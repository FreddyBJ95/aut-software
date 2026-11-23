import assert from 'node:assert/strict';
import {spatialLayerSelection} from './spatial-layers.mjs?v=44';
import {geometry3D} from './spatial-geometry.mjs?v=44';
import {projectSpatialPoint,projectSpatialGeometry,spatialArcSamples,spatialLineVisibility,pickSpatialParts,spatialRiseLabelData,classifySpatialProjection,renderSpatialWorkDrawing} from './spatial-drawing.mjs?v=44';

const close=(a,b,epsilon=1e-7)=>assert(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
assert.deepEqual(projectSpatialPoint([12,34,56],'top'),[12,34,56]);
assert.deepEqual(projectSpatialPoint([12,34,56],'front'),[12,56,-34]);
assert.deepEqual(projectSpatialPoint([12,34,56],'side'),[34,56,12]);
assert.throws(()=>projectSpatialPoint([0,0]),TypeError);
assert.throws(()=>projectSpatialPoint([0,0,NaN]),TypeError);
assert.throws(()=>projectSpatialPoint([0,0,0],'unknown'),RangeError);
// Isometric projection uses orthonormal screen axes. Its third value is depth.
const basis=[[1,0,0],[0,1,0],[0,0,1]].map(p=>projectSpatialPoint(p,'iso'));
for(let i=0;i<3;i++)for(let j=0;j<3;j++)close(basis[i].reduce((sum,value,k)=>sum+value*basis[j][k],0),i===j?1:0);
for(const yaw of [-2.7,-.2,0,.8,2.6])for(const pitch of [-1.4,-.7,0,.4,1.4]){
 const rotated=[[1,0,0],[0,1,0],[0,0,1]].map(p=>projectSpatialPoint(p,'iso',{yaw,pitch}));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)close(rotated[i].reduce((sum,value,k)=>sum+value*rotated[j][k],0),i===j?1:0);
}
assert.deepEqual(projectSpatialPoint([12,34,56],'iso',{yaw:0,pitch:0}),[12,56,34]);
assert.deepEqual(projectSpatialPoint([12,34,56],'top',{yaw:1,pitch:1}),[12,34,56],'Orbit never rotates orthographic views');
assert.throws(()=>projectSpatialPoint([0,0,0],'iso',{yaw:NaN,pitch:0}),TypeError);

const state={radius:38,heading:0,measurementMode:'vertex',lengths:[1000,500,1000,300,800],turns:[90,-90,90,-90],bendRotations:[90,0,0,0]};
const g=geometry3D(state),before=structuredClone(g),projected=projectSpatialGeometry(g,'top',200);
assert.deepEqual(g,before,'Projection must not mutate geometry');
close(projected.lines[0].start[1],projected.lines[0].end[1]);
close(projected.lines[1].start[0],projected.lines[1].end[0]);
close(projected.lines[1].start[1],projected.lines[1].end[1]);
close(g.lines[2].start[2],500);close(g.lines[4].start[2],800);
assert.deepEqual(spatialRiseLabelData(g,1),{start:0,end:500,rise:500,dimension:500,showSeparateDimension:false});
for(const radius of [12.5,38,67.25])for(const length of [150.5,500,934.75])for(const direction of [90,-90]){
 const tangent=geometry3D({radius,heading:.413,measurementMode:'tangent',lengths:[1234,length,876],turns:[90,-90],bendRotations:[direction,0]});
 const rise=spatialRiseLabelData(tangent,1),sign=Math.sign(direction);
 close(rise.start,0);close(rise.end,sign*(length+2*radius));close(rise.rise,sign*(length+2*radius));close(rise.dimension,length);assert(rise.showSeparateDimension,'Tangent leg stays distinct from actual total level rise');
}
assert.equal(spatialRiseLabelData(g,-1),null);
for(const view of ['top','front','side','iso']){
 const projection=projectSpatialGeometry(g,view,5);
 assert(projection.points.every(point=>point.every(Number.isFinite)));
 for(let i=0;i<g.lines.length;i++)close(projection.lines[i].dimension,g.lines[i].dimension);
}
for(const arc of g.arcs){
 const overview=spatialArcSamples(arc,.1),detail=spatialArcSamples(arc,300);
 assert(detail.length>overview.length,'Zoom refines projected bend curves');
 assert.deepEqual(detail[0],arc.samples[0]);assert.deepEqual(detail.at(-1),arc.samples.at(-1));
 for(const p of detail)close(Math.hypot(...p.map((v,i)=>v-arc.center[i])),arc.radius);
 const step=Math.abs(arc.turn)*Math.PI/180/(detail.length-1);
 assert(arc.radius*300*(1-Math.cos(step/2))<=.221,'Detail sampling bounds sagitta to0.22screenpx');
}

const overlap=[{start:[0,0,0],end:[100,0,0]},{start:[20,0,50],end:[80,0,50]}];
const visibility=spatialLineVisibility(overlap,12);
assert.equal(visibility[0].hidden.length,1);close(visibility[0].hidden[0][0],.2);close(visibility[0].hidden[0][1],.8);
assert.equal(visibility[0].visible.length,2);assert.deepEqual(visibility[1].visible,[[0,1]]);assert.deepEqual(visibility[1].hidden,[]);
const crossing=[{start:[0,0,-100],end:[100,0,-100]},{start:[50,-50,50],end:[50,50,50]}];
const crossingVisibility=spatialLineVisibility(crossing,12);
close(crossingVisibility[0].hidden[0][0],.44);close(crossingVisibility[0].hidden[0][1],.56);
assert.equal(crossingVisibility[1].hidden.length,0);
const sameLevel=spatialLineVisibility(overlap.map(line=>({...line,start:[...line.start.slice(0,2),0],end:[...line.end.slice(0,2),0]})),12);
assert(sameLevel.every(line=>line.hidden.length===0),'Same-height crossings are not invented hidden levels');
const slopeDepth=spatialLineVisibility([{start:[0,0,0],end:[100,0,100]},{start:[0,0,75],end:[100,0,25]}],12);
close(slopeDepth[0].hidden[0][1],.5);close(slopeDepth[1].hidden[0][0],.5);

const candidates=pickSpatialParts({lines:overlap,arcs:[]},[50,0]);
assert.equal(candidates.length,2);assert.equal(candidates[0].index,1);assert.equal(candidates[1].index,0);
assert.equal(pickSpatialParts({lines:overlap,arcs:[]},[10,0]).length,1);
assert.equal(pickSpatialParts({lines:overlap,arcs:[]},[10,50]).length,0);
const verticalHit=pickSpatialParts({lines:[{start:[0,0,0],end:[0,100,0]}],arcs:[]},[10,50],{pixelsPerMm:2});
assert.equal(verticalHit[0].type,'length');assert.equal(verticalHit[0].index,0);
const dotHit=pickSpatialParts({lines:[{start:[0,0,0],end:[0,0,500]}],arcs:[]},[0,0]);
assert.equal(dotHit[0].type,'length','Vertical top-view transition remains selectable');
console.log('Spatial orthographic projection, repeated elevations, adaptive bend precision, partial hidden spans and overlapping/vertical picking: PASS');

// Real projected features govern annotation eligibility, not just the presence
// of a physical part in the3D model. Hidden metadata stays in the full tables.
const planar=geometry3D({radius:38,heading:0,measurementMode:'vertex',lengths:[1000,500],turns:[90]});
const topXY=classifySpatialProjection(planar,{view:'top'}),frontXY=classifySpatialProjection(planar,{view:'front'}),sideXY=classifySpatialProjection(planar,{view:'side'});
assert(topXY.lines.every(line=>line.annotate));assert(topXY.arcs[0].annotate,'XY corner is visible from above');
assert.deepEqual(frontXY.lines.filter(line=>line.annotate).map(line=>line.index),[0]);assert(!frontXY.arcs[0].annotate,'XY corner is edge-on from front');
assert.deepEqual(sideXY.lines.filter(line=>line.annotate).map(line=>line.index),[1]);assert(!sideXY.arcs[0].annotate,'XY corner is edge-on from side');
const topXZ=classifySpatialProjection(g,{view:'top'}),frontXZ=classifySpatialProjection(g,{view:'front'}),sideXZ=classifySpatialProjection(g,{view:'side'});
assert.deepEqual(topXZ.lines.filter(line=>line.kind==='rise'&&line.annotate).map(line=>line.index),[1,3],'Both true up/down transitions remain explicit in plan');
assert(topXZ.arcs.every(arc=>!arc.annotate),'Height bends have no misleading plan corner badges');
assert(frontXZ.arcs.every(arc=>arc.annotate),'Height bends are readable in front elevation');
assert.deepEqual(sideXZ.lines.filter(line=>line.annotate).map(line=>line.index),[1,3],'Side elevation omits the three end-on horizontal runs');
assert(sideXZ.arcs.every(arc=>!arc.annotate),'Side elevation omits edge-on corners');
const slope=geometry3D({radius:29.4,heading:0,measurementMode:'vertex',lengths:[913.5,407.25],turns:[45],bendRotations:[90]});
assert(!classifySpatialProjection(slope,{view:'top'}).lines[1].annotate,'Foreshortened sloping length is not presented as a plan dimension');
assert(classifySpatialProjection(slope,{view:'front'}).lines[1].annotate,'Same true-length inclined run can be dimensioned in its own plane');
const stacked=geometry3D({radius:38,heading:0,measurementMode:'vertex',lengths:[1000,500,1000],turns:[90,90],bendRotations:[90,0]});
const stackTop=classifySpatialProjection(stacked,{view:'top'});
assert(!stackTop.lines[0].annotate,'A fully hidden lower run has no label through its upper run');assert(stackTop.lines[2].annotate,'The upper run remains dimensioned');
for(const heading of [.13,.61,1.4])for(const roll of [-71,-23,29,68]){
 const angled=geometry3D({radius:31.2,heading,measurementMode:'vertex',lengths:[932,481,743],turns:[63,-47],bendRotations:[roll,0]});
 for(const view of ['top','front','side']){
  const classification=classifySpatialProjection(angled,{view});
  for(const part of classification.lines)if(part.annotate&&part.kind!=='rise'){
   const line=angled.lines[part.index],a=projectSpatialPoint(line.start,view),b=projectSpatialPoint(line.end,view);
   close(Math.hypot(b[0]-a[0],b[1]-a[1]),line.length,1e-6);
  }
 }
}
console.log('Projection-aware annotations: readable XY/XZ corners, hidden and end-on parts, true lengths, arbitrary headings/rolls and explicit height transitions PASS');


// A selected lower layer is not occluded by the upper layer's equal plan
// footprint. Eligibility and IDs are still those of the original whole pipe.
const lowerSelection=spatialLayerSelection(stacked,0),upperSelection=spatialLayerSelection(stacked,500);
const lowerPlan=classifySpatialProjection(stacked,{view:'top',layerSelection:lowerSelection}),upperPlan=classifySpatialProjection(stacked,{view:'top',layerSelection:upperSelection});
assert.deepEqual(lowerPlan.lines.filter(part=>part.annotate).map(part=>part.index),[0]);
assert.deepEqual(upperPlan.lines.filter(part=>part.annotate).map(part=>part.index),[2]);
assert(lowerPlan.arcs.every(part=>!part.annotate));assert(upperPlan.arcs.every(part=>!part.annotate));
assert.deepEqual(classifySpatialProjection(stacked,{view:'top'}).lines.map(part=>part.annotate),stackTop.lines.map(part=>part.annotate),'All layers restores ordinary occlusion');
assert.deepEqual(lowerPlan.lines.map(part=>part.index),[0,1,2],'Selected dimensions must never be renumbered');
for(const height of [0,500,800]){
 const selected=spatialLayerSelection(g,height),top=classifySpatialProjection(g,{view:'top',layerSelection:selected});
 assert(top.lines.every((part,index)=>!part.annotate||selected.lines[index]));
 assert(top.arcs.every((part,index)=>!part.annotate||selected.arcs[index]));
}
assert.deepEqual(g,before,'Layer annotation selection never edits any geometry or original index');
console.log('Selected height-layer dimensions reveal lower overlaps, preserve original IDs, omit off-layer parts and restore full geometry: PASS');

// On-demand data is an explicit inspection request: no background labels,
// one selected original part, and strict layer isolation even for a bad input.
for(const view of ['top','front','side','iso']){
 const quiet=classifySpatialProjection(g,{view,labelMode:'tap'});
 assert(quiet.lines.every(part=>!part.annotate));assert(quiet.arcs.every(part=>!part.annotate));
 const oneLength=classifySpatialProjection(g,{view,labelMode:'tap',selected:{type:'length',index:2}});
 assert.deepEqual(oneLength.lines.filter(part=>part.annotate).map(part=>part.index),[2]);assert(oneLength.arcs.every(part=>!part.annotate));
 const oneBend=classifySpatialProjection(g,{view,labelMode:'tap',selected:{type:'angle',index:1}});
 assert.deepEqual(oneBend.arcs.filter(part=>part.annotate).map(part=>part.index),[1]);assert(oneBend.lines.every(part=>!part.annotate));assert(oneBend.arcs[1].anchor?.every(Number.isFinite));
}
const hiddenExplicit=classifySpatialProjection(stacked,{view:'top',labelMode:'tap',selected:{type:'length',index:0}});
assert(hiddenExplicit.lines[0].annotate,'Explicit inspection can reveal a selected hidden part without flooding the view');
const strictLayer=classifySpatialProjection(stacked,{view:'top',layerSelection:lowerSelection,labelMode:'tap',selected:{type:'length',index:2}});
assert(strictLayer.lines.every(part=>!part.annotate),'An off-layer selection can never leak a height into the selected layer');
const maskedHits=pickSpatialParts(projectSpatialGeometry(stacked,'top'),[500,0],{layerSelection:lowerSelection});
assert(maskedHits.length&&maskedHits.every(hit=>hit.type==='length'&&hit.index===0),'Layer hit testing preserves lower original indices');
assert.deepEqual(classifySpatialProjection(g,{view:'front',labelMode:'all'}).lines.map(part=>part.annotate),frontXZ.lines.map(part=>part.annotate),'All data keeps the previous projection-aware behavior');
console.log('On-demand labels: zero unselected labels, one original L/B selection, explicit edge-on inspection and strict layer picking: PASS');

// Exercise the actual static SVG renderer, including display IDs and a split
// on a line that collapses to a point in the top projection. This catches
// browser-only scope mistakes that the pure projection tests cannot see.
class FakeSvgNode{
 constructor(name,ownerDocument){this.name=name;this.ownerDocument=ownerDocument;this.attributes=new Map();this.children=[];this.textContent='';}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 getAttribute(name){return this.attributes.get(name)??null;}
 removeAttribute(name){this.attributes.delete(name);}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
 contains(){return false;}
 querySelectorAll(){return[];}
}
const fakeDocument={activeElement:null,createElementNS(namespace,name){return new FakeSvgNode(name,fakeDocument);}},staticSvg=new FakeSvgNode('svg',fakeDocument),endOnProject={radius:38,heading:0,measurementMode:'tangent',lengths:[500],turns:[],bendRotations:[],startFrame:{tangent:[0,0,1],normal:[1,0,0]}},endOnGeometry=geometry3D(endOnProject);
endOnGeometry.lines[0].displayId='L7';
renderSpatialWorkDrawing(staticSvg,endOnGeometry,{view:'top',joints:[{id:'S3',lineIndex:0,distance:500,workLabel:'S3 · DELING',atEndpoint:true}],endpointLabels:['K','S3'],showReferenceIds:true,width:900,height:720});
const rendered=[];for(const visit of staticSvg.children){const stack=[visit];while(stack.length){const item=stack.pop();rendered.push(item);stack.push(...item.children);}}
assert(rendered.some(item=>item.getAttribute('data-spatial-part')==='L7'),'Static renderer preserves original display IDs');
assert(rendered.some(item=>item.getAttribute('data-division-symbol')==='end-on'),'End-on split keeps a visible circle/cross symbol');
assert.deepEqual(Object.fromEntries(rendered.filter(item=>item.getAttribute('data-endpoint')).map(item=>[item.getAttribute('data-endpoint'),item.getAttribute('aria-label')])),{A:'K · fysisk kapende'},'A division endpoint uses the prominent split symbol instead of the generic green endpoint badge');
assert.match(rendered.find(item=>item.getAttribute('data-joint')==='S3').getAttribute('aria-label'),/S3 · DELING · L7 · 500 mm/);
console.log('Static spatial work SVG: original IDs, physical cut endpoint and prominent end-on split symbol PASS');

// A split on a true 3D line must be projected before its screen marker is
// placed. Check every fixed/ISO view and verify that the anchor lies on the
// rendered straight rather than merely existing somewhere in the viewport.
const rootNodes=root=>{const all=[],stack=[...root.children];while(stack.length){const item=stack.pop();all.push(item);stack.push(...item.children);}return all;};
const root6=Math.sqrt(6),root5=Math.sqrt(5),joint3D=geometry3D({radius:38,heading:0,measurementMode:'tangent',lengths:[600],turns:[],bendRotations:[],startFrame:{tangent:[2/root6,1/root6,1/root6],normal:[1/root5,-2/root5,0]}});
for(const view of ['top','front','side','iso']){
 const scene=new FakeSvgNode('svg',fakeDocument);renderSpatialWorkDrawing(scene,joint3D,{view,joints:[{id:'S1',lineIndex:0,distance:270}],width:900,height:720});const nodes=rootNodes(scene),marker=nodes.find(item=>item.getAttribute('data-joint')==='S1'),pipe=nodes.find(item=>item.getAttribute('data-spatial-part')==='L1');
 assert(marker,`${view}: split marker is not culled`);assert(nodes.some(item=>item.getAttribute('data-division-symbol')==='cut-band'),`${view}: split uses the prominent cut band`);
	 assert.equal(marker.getAttribute('data-joint-visual-scale'),'1');assert.equal(marker.getAttribute('data-joint-label-mode'),'full');const hit=marker.children.find(item=>item.name==='rect'&&item.getAttribute('width')==='44'&&item.getAttribute('height')==='44'),symbol=marker.children.find(item=>item.getAttribute('data-joint-visible-symbol')==='');assert(hit,`${view}: work split keeps its 44 px target`);assert.match(symbol.getAttribute('transform'),/scale\(1\)/);
 const point=[Number(marker.getAttribute('data-joint-anchor-x')),Number(marker.getAttribute('data-joint-anchor-y'))],numbers=(pipe.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number),a=numbers.slice(0,2),b=numbers.slice(-2),dx=b[0]-a[0],dy=b[1]-a[1],fraction=((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy),nearest=[a[0]+dx*fraction,a[1]+dy*fraction];
 close(Math.hypot(point[0]-nearest[0],point[1]-nearest[1]),0,1e-6);assert(point.every(Number.isFinite));assert(point[0]>=0&&point[0]<=900&&point[1]>=0&&point[1]<=720);
 assert.match(marker.getAttribute('aria-label'),/S1 · DELING · L1 · 270 mm/);
}
console.log('Static spatial split projection: top/front/side/ISO anchors stay on the real projected line with a prominent live/work marker PASS');

const colored=geometry3D({radius:38,heading:0,measurementMode:'tangent',lengths:[500,450,420,380],turns:[45,37,90],bendRotations:[0,0,0]}),colorSvg=new FakeSvgNode('svg',fakeDocument);
renderSpatialWorkDrawing(colorSvg,colored,{view:'top',formatAngle:value=>String(value),translate:value=>value,width:900,height:720});
const colorNodes=rootNodes(colorSvg),tokens=new Set(colorNodes.map(item=>item.getAttribute('data-bend-color')).filter(Boolean));
assert(tokens.has('45'));assert(tokens.has('90'));assert(tokens.has('special'));
const emphasis=colorNodes.filter(item=>item.getAttribute('data-bend-emphasis'));assert.equal(emphasis.length,colored.arcs.length,'Every work bend has a visible color emphasis');for(const halo of emphasis){const body=colorNodes.find(item=>item.getAttribute('data-spatial-part')===halo.getAttribute('data-bend-emphasis'));assert.equal(halo.getAttribute('d'),body.getAttribute('d'),'Emphasis follows the exact bend path');assert(Number(halo.getAttribute('stroke-width'))>Number(body.getAttribute('stroke-width')));}
assert(colorNodes.some(item=>item.getAttribute('data-spatial-inline-bend')==='B1'&&item.getAttribute('data-bend-code')==='45'));
assert(colorNodes.some(item=>item.getAttribute('data-spatial-inline-bend')==='B3'&&item.getAttribute('data-bend-code')==='90'));
assert(!colorNodes.some(item=>['B1','B3'].includes(item.getAttribute('data-spatial-label'))),'Standard bends use the colored tube and a small inline B tag, not a large label card');
assert(colorNodes.some(item=>item.getAttribute('data-bend-kind')==='special'));
assert(colorNodes.some(item=>item.getAttribute('data-bend-angle')==='B2'&&item.textContent==='SPECIAL · 37°'));
const tappedColorSvg=new FakeSvgNode('svg',fakeDocument);renderSpatialWorkDrawing(tappedColorSvg,colored,{view:'top',labelMode:'tap',selected:{type:'angle',index:0},formatAngle:value=>String(value),translate:value=>value,width:900,height:720});const tappedColorNodes=rootNodes(tappedColorSvg);
assert(tappedColorNodes.some(item=>item.getAttribute('data-spatial-label')==='B1'),'A tapped standard bend can still reveal its detailed card');
assert(tappedColorNodes.some(item=>item.getAttribute('data-bend-angle')==='B1'&&item.textContent==='45°'));
console.log('Static spatial bend colors: colored 45°/90° tube bodies, compact standard tags, tap details and explicit SPECIAL label PASS');
