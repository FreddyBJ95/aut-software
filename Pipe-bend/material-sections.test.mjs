import assert from 'node:assert/strict';
import {geometry} from './geometry.mjs';
import {geometry3D,spatialBendRotations} from './spatial-geometry.mjs';
import {getBender} from './benders.mjs';
import {roundDisplayedMarks} from './displayed-marks.mjs';
import {materialPlan,suggestMaterialJoints,validateMaterialJoints,jointPoint,pieceLayoutMarks,pieceWorkProject} from './material-sections.mjs';

const close=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const bender=getBender('swagelok-ms-htb-12m');
const straight={version:1,stock:3000,diameter:12,radius:38,benderId:bender.id,measurementMode:'tangent',heading:0,lengths:[4500],turns:[],jointClearance:50};
let geo=geometry(straight),suggested=suggestMaterialJoints(straight,geo,bender);
assert.equal(suggested.ok,true);assert.equal(suggested.joints.length,1);close(suggested.joints[0].distance,3000,1e-3);
let plan=materialPlan({...straight,joints:suggested.joints},geo,bender);assert.equal(plan.allFit,true);assert.equal(plan.pieces.length,2);close(plan.pieces[0].cutLength,3000,1e-3);close(plan.pieces[1].cutLength,1500,1e-3);
const straightWork=pieceWorkProject({...straight,joints:suggested.joints},geo,plan.pieces[0]),straightWorkNext=pieceWorkProject({...straight,joints:suggested.joints},geo,plan.pieces[1]);assert.deepEqual(straightWork.lengths,[3000]);assert.deepEqual(straightWork.lineIds,['L1']);assert.deepEqual(straightWork.bendIds,[]);assert.deepEqual(straightWork.endpointLabels,{start:'A',end:'S1'});assert.deepEqual(straightWork.joints.map(({id,distance,side,atEndpoint})=>({id,distance,side,atEndpoint})),[{id:'S1',distance:3000,side:'end',atEndpoint:true}]);assert.deepEqual(straightWorkNext.joints.map(({id,distance,side,atEndpoint})=>({id,distance,side,atEndpoint})),[{id:'S1',distance:0,side:'start',atEndpoint:true}]);

const bent={...straight,lengths:[1800,1800,1200],turns:[90,-45],measurementMode:'tangent'};geo=geometry(bent);suggested=suggestMaterialJoints(bent,geo,bender);assert.equal(suggested.ok,true);assert.ok(suggested.joints.length>=1);plan=suggested.plan;assert.equal(plan.allFit,true);assert.ok(plan.pieces.every(piece=>piece.cutLength<=3000+1e-6));assert.deepEqual(plan.pieces.flatMap(piece=>piece.originalBendIndices),[0,1]);assert.deepEqual(plan.pieces.flatMap(piece=>piece.marks.map(mark=>mark.originalIndex)),[0,1]);

const manual={...bent,joints:[{lineIndex:1,distance:900,allowanceBefore:25,allowanceAfter:35}]};geo=geometry(manual);plan=materialPlan(manual,geo,bender);assert.equal(plan.ok,true);assert.equal(plan.pieces.length,2);assert.equal(plan.pieces[0].allowanceEnd,25);assert.equal(plan.pieces[1].allowanceStart,35);close(plan.totalCutLength,plan.pieces[0].baseLength+plan.pieces[1].baseLength+60);assert.deepEqual(jointPoint(geo,plan.joints[0]).length,2);
const firstLayout=pieceLayoutMarks(plan.pieces[0]),secondLayout=pieceLayoutMarks(plan.pieces[1]);assert.equal(firstLayout.at(-1).id,'S1');close(firstLayout.at(-1).position,plan.pieces[0].cutLength-25);assert.equal(secondLayout[0].id,'S1');close(secondLayout[0].position,35);assert.ok(firstLayout.find(mark=>mark.id==='B1')?.kind==='bend');assert.ok(secondLayout.find(mark=>mark.id==='B2')?.kind==='bend');
for(const piece of plan.pieces){const display=roundDisplayedMarks({supported:true,marks:piece.marks,endPosition:piece.cutLength});assert.equal(display.ok,true);close(display.displayedIntervals.reduce((sum,value)=>sum+value,0),display.displayedEndPosition,.05);}

const manualBefore=structuredClone(manual),manualGeometryBefore=structuredClone(geo),manualPiecesBefore=structuredClone(plan.pieces);
const firstWork=pieceWorkProject(manual,geo,plan.pieces[0]),secondWork=pieceWorkProject(manual,geo,plan.pieces[1]);
assert.equal(firstWork.measurementMode,'tangent');assert.deepEqual(firstWork.lengths,[1800,925]);assert.deepEqual(firstWork.turns,[90]);assert.deepEqual(firstWork.lineIds,['L1','L2']);assert.deepEqual(firstWork.bendIds,['B1']);assert.deepEqual(firstWork.endpointLabels,{start:'A',end:'Rørslut'});close(firstWork.heading,0);
assert.deepEqual(firstWork.joints.map(({id,workLabel,lineIndex,lineId,distance,side})=>({id,workLabel,lineIndex,lineId,distance,side})),[{id:'S1',workLabel:'S1 · DELING',lineIndex:1,lineId:'L2',distance:900,side:'end'}]);
assert.deepEqual(secondWork.lengths,[935,1200]);assert.deepEqual(secondWork.turns,[-45]);assert.deepEqual(secondWork.lineIds,['L2','L3']);assert.deepEqual(secondWork.bendIds,['B2']);assert.deepEqual(secondWork.endpointLabels,{start:'Rørstart',end:'B'});close(secondWork.heading,Math.PI/2);
assert.deepEqual(secondWork.joints.map(({id,workLabel,lineIndex,lineId,distance,side})=>({id,workLabel,lineIndex,lineId,distance,side})),[{id:'S1',workLabel:'S1 · DELING',lineIndex:0,lineId:'L2',distance:35,side:'start'}]);
close(geometry(firstWork).used,plan.pieces[0].geometricLength+25);close(geometry(secondWork).used,plan.pieces[1].geometricLength+35);
assert.deepEqual(manual,manualBefore);assert.deepEqual(geo,manualGeometryBefore);assert.deepEqual(plan.pieces,manualPiecesBefore);

const sameLine={...straight,stock:2000,lengths:[1800],joints:[{lineIndex:0,distance:500,allowanceBefore:10,allowanceAfter:20},{lineIndex:0,distance:1100,allowanceBefore:30,allowanceAfter:40}]};
const sameLineGeometry=geometry(sameLine),sameLinePlan=materialPlan(sameLine,sameLineGeometry,bender),middleWork=pieceWorkProject(sameLine,sameLineGeometry,sameLinePlan.pieces[1]);
assert.deepEqual(middleWork.lengths,[650]);assert.deepEqual(middleWork.lineIds,['L1']);assert.deepEqual(middleWork.bendIds,[]);assert.deepEqual(middleWork.endpointLabels,{start:'Rørstart',end:'Rørslut'});assert.deepEqual(middleWork.joints.map(({id,distance,side})=>({id,distance,side})),[{id:'S1',distance:20,side:'start'},{id:'S2',distance:620,side:'end'}]);

const vertex={...manual,measurementMode:'vertex'},vertexGeometry=geometry(vertex),vertexPlan=materialPlan(vertex,vertexGeometry,bender),vertexWork=pieceWorkProject(vertex,vertexGeometry,vertexPlan.pieces[1]);
assert.equal(vertexWork.measurementMode,'vertex');close(geometry(vertexWork).lines[0].length,vertexPlan.pieces[1].lengths[0]+35);assert.deepEqual(geometry(vertexWork).lines.map(line=>line.length),vertexPlan.pieces[1].lengths.map((length,index)=>length+(index===0?35:0)));assert.deepEqual(geometry(vertexWork).lines.map(line=>line.dimension),vertexWork.lengths);

const spatial={...straight,stock:4000,heading:.2,lengths:[1000,900,800],turns:[90,60],bendRotations:[90,-30],joints:[{lineIndex:1,distance:300,allowanceBefore:20,allowanceAfter:30}]};
const spatialGeometry=geometry3D(spatial),spatialPlan=materialPlan(spatial,spatialGeometry,bender),spatialPiece=spatialPlan.pieces[1],spatialWork=pieceWorkProject(spatial,spatialGeometry,spatialPiece),localSpatialGeometry=geometry3D(spatialWork);
assert.deepEqual(spatialWork.lineIds,['L2','L3']);assert.deepEqual(spatialWork.bendIds,['B2']);assert.deepEqual(spatialWork.bendRotations,[-30]);assert.deepEqual(spatialWork.startFrame,{tangent:spatialGeometry.lines[1].frame.tangent,normal:spatialGeometry.lines[1].frame.normal});
for(let axis=0;axis<3;axis++){close(localSpatialGeometry.lines[0].direction[axis],spatialGeometry.lines[1].direction[axis]);close(localSpatialGeometry.arcs[0].normal[axis],spatialGeometry.arcs[1].normal[axis]);}

const localRollSource={...straight,stock:4000,lengths:[1000,900,800],turns:[-90,90],bendRotations:[0,0],joints:[{lineIndex:1,distance:300,allowanceBefore:0,allowanceAfter:0}]},localRollGeometry=geometry3D(localRollSource),localRollPlan=materialPlan(localRollSource,localRollGeometry,bender),localRollWork=pieceWorkProject(localRollSource,localRollGeometry,localRollPlan.pieces[1]);
assert.equal(spatialBendRotations(localRollSource)[1].rotation,-180);assert.equal(spatialBendRotations(localRollWork)[0].rotation,0,'A new physical tube must use its transferred local 0° datum');assert.deepEqual(localRollWork.bendIds,['B2']);

const edge={...straight,stock:2500.001,lengths:[1500,2000],turns:[73]};geo=geometry(edge);suggested=suggestMaterialJoints(edge,geo,bender);assert.equal(suggested.ok,true);assert.equal(suggested.plan.allFit,true);assert.ok(suggested.plan.pieces.every(piece=>piece.cutLength<=edge.stock),'Automatic joints must never round beyond the stock length');

const geometric={...bent,benderId:null,joints:[]};geo=geometry(geometric);plan=materialPlan(geometric,geo,null);assert.equal(plan.ok,true);assert.equal(plan.pieces[0].report.supported,false);assert.deepEqual(plan.pieces[0].marks.map(mark=>mark.id),['B1','B2']);close(plan.pieces[0].marks[0].position,1800);close(plan.pieces[0].marks[1].position,1800+38*Math.PI/2+1800);assert.ok(plan.pieces[0].marks.every(mark=>mark.reference==='geometric'));

assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:10,allowanceBefore:0,allowanceAfter:0}]},geometry(straight)),/mindst 50 mm/);
assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:100,allowanceBefore:-1,allowanceAfter:0}]},geometry(straight)),/ugyldige/);
assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:100,allowanceBefore:0,allowanceAfter:101}]},geometry(straight)),/Starttillægget/);
assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:4400,allowanceBefore:101,allowanceAfter:0}]},geometry(straight)),/Sluttillægget/);
assert.equal(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:100,allowanceBefore:4400,allowanceAfter:100}]},geometry(straight)),null,'Allowances may reach, but not cross, the neighbouring bend or endpoint');
assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:1000,allowanceBefore:1001,allowanceAfter:0},{lineIndex:0,distance:2000,allowanceBefore:0,allowanceAfter:0}]},geometry(straight)),/næste samling/);
assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:1000,allowanceBefore:0,allowanceAfter:0},{lineIndex:0,distance:2000,allowanceBefore:0,allowanceAfter:1001}]},geometry(straight)),/forrige samling/);
assert.match(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:1000,allowanceBefore:600,allowanceAfter:0},{lineIndex:0,distance:2000,allowanceBefore:0,allowanceAfter:600}]},geometry(straight)),/overlapper hinanden/);
assert.equal(validateMaterialJoints({...straight,joints:[{lineIndex:0,distance:1000,allowanceBefore:500,allowanceAfter:0},{lineIndex:0,distance:2000,allowanceBefore:0,allowanceAfter:500}]},geometry(straight)),null,'Opposing allowances may meet, but not overlap');
console.log('Material sections: manual joints, allowances, per-piece work projects, 3D frames and automatic stock fitting PASS');
