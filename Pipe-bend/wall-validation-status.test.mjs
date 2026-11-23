import assert from 'node:assert/strict';
import {wallValidationStatus} from './wall-validation-status.mjs';
import {generateWallRoute} from './wall-routing.mjs';
import {generateRoomRoute} from './room-routing.mjs';
import {convertMeasurementMode} from './measurements.mjs';

const config={wall:{lengths:[2400,1600],turns:[90],heading:0,side:'left'},diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:90,start:{segment:0,position:200},end:{segment:1,position:1400},clips:[{id:'K1',segment:0,position:600,gap:50}],obstacles:[]};
const route=generateWallRoute(config);assert.equal(route.ok,true,route.error);
const project={version:1,name:'Checked pipe',stock:6000,wall:1.5,diameter:12,radius:38,measurementMode:'vertex',lengths:route.lengths,turns:route.turns,heading:route.heading,placement:{start:route.start},planner:{version:2,input:config,points:route.points,routeEdited:false}};
const original=structuredClone(project);
assert.equal(wallValidationStatus(project).status,'checked');
assert.equal(wallValidationStatus(project).checked,true);
assert.equal(wallValidationStatus({...project,planner:undefined}).status,'none');

// Main-editor edits must not borrow the saved, still-safe planner point list.
const longer={...project,lengths:project.lengths.map((n,i)=>n+(i===0?10:0))};
assert.equal(wallValidationStatus(longer).status,'needs-check');
assert.equal(wallValidationStatus(longer).code,'ENDPOINT_MISMATCH');
assert.deepEqual(longer.planner.points,route.points);
assert.equal(wallValidationStatus({...project,planner:{...project.planner,routeEdited:true}}).code,'ROUTE_EDITED','Even a geometrically safe edit needs explicit planner confirmation');
assert.equal(wallValidationStatus({...project,diameter:24}).status,'needs-check','Current pipe dimensions replace stale planner dimensions');
assert.equal(wallValidationStatus({...project,radius:3000}).status,'needs-check','An oversized current radius cannot borrow the old planner radius');

// Changing the entry convention preserves physical validation and must not
// accidentally interpret tangent lengths as centerline-corner dimensions.
assert.equal(wallValidationStatus(convertMeasurementMode(project,'tangent')).status,'checked');
assert.equal(wallValidationStatus({...project,planner:{...project.planner,version:99}}).code,'SAVED_WALL_INVALID');
assert.equal(wallValidationStatus({...project,planner:{...project.planner,points:[[null,0],[1,0]]}}).code,'SAVED_WALL_INVALID');
assert.equal(wallValidationStatus({...project,lengths:[],turns:[]}).code,'EMPTY_PIPE');
assert.equal(wallValidationStatus({...project,lengths:[NaN,100]}).status,'needs-check');
assert.equal(wallValidationStatus({...project,placement:{start:[Infinity,0]}}).code,'INVALID_START');

// Older rectangular projects retain fresh validation through their measured
// wall migration rather than losing their status because of a format change.
const oldInput={width:4000,height:3000,diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:45,direction:'auto',start:{wall:'bottom',position:200},end:{wall:'right',position:2500},clips:[{id:'K1',wall:'bottom',position:600,gap:50}],obstacles:[]};
const oldRoute=generateRoomRoute(oldInput);assert.equal(oldRoute.ok,true,oldRoute.error);
const legacy={...project,lengths:oldRoute.lengths,turns:oldRoute.turns,heading:oldRoute.heading,placement:{start:oldRoute.start},planner:{version:1,input:oldInput,points:oldRoute.points}};
assert.equal(wallValidationStatus(legacy).status,'checked');
assert.deepEqual(project,original,'Status checks do not mutate measured walls, points or current project');
// A valid XY wall result is never proof that an out-of-plane pipe clears
// walls or obstacles. Those pipes retain the measured draft and need 3D checks.
const zeroRotations=project.turns.map(()=>0);
assert.equal(wallValidationStatus({...project,bendRotations:zeroRotations}).status,'checked','Explicit legacy-plane rotations keep the same physical route');
for(const roll of [90,-90,37.5,180]){
 const rotations=zeroRotations.slice();rotations[0]=roll;
 const status=wallValidationStatus({...project,bendRotations:rotations});
 assert.equal(status.code,'SPATIAL_PIPE_UNCHECKED');assert.equal(status.checked,false);assert.equal(status.status,'needs-check');assert.match(status.messageKey,/højdeskift/);assert.match(status.detailKey,/2D/);
}
assert.equal(wallValidationStatus({...project,startFrame:{tangent:[1,0,0],normal:[0,0,1]}}).code,'SPATIAL_PIPE_UNCHECKED');
assert.deepEqual(project,original,'Spatial status checks preserve original main pipe and planner data');

console.log('Wall validation status: current geometry, dirty flags, stale point lists, physical changes and legacy modes PASS');
