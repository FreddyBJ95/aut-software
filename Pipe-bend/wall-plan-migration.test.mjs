import assert from 'node:assert/strict';
import {generateRoomRoute} from './room-routing.mjs';
import {validateWallRoute,pointOnWall,wallObstaclePolygon} from './wall-routing.mjs';
import {migrateRoomPlanner,roomPlannerError} from './room-planner.mjs';

// A previously accepted route traverses all four walls and detours around
// obstacles on the two walls whose local measurement directions change.
const input={width:4000,height:3000,diameter:12,radius:38,wallGap:50,clearance:10,maxAngle:90,direction:'counterclockwise',start:{wall:'bottom',position:200},end:{wall:'left',position:1000},clips:[{id:'K-right',wall:'right',position:1000,gap:50},{id:'K-top',wall:'top',position:3000,gap:50},{id:'K-left',wall:'left',position:2000,gap:50}],obstacles:[{id:'F-top',wall:'top',position:1500,width:300,depth:150},{id:'F-left',wall:'left',position:1400,width:250,depth:100}]};
const route=generateRoomRoute(input);
assert.equal(route.ok,true,route.error);
const legacy={version:1,input,points:route.points,routeEdited:true};
const original=structuredClone(legacy),next=migrateRoomPlanner(legacy);
assert.equal(next.version,2);
assert.equal(next.migrated,true);
assert.equal(next.routeEdited,true);
assert.deepEqual(next.input.wall,{lengths:[4000,3000,4000,3000],turns:[90,90,90],heading:0,side:'left'});
for(const key of ['diameter','radius','wallGap','clearance','maxAngle'])assert.equal(next.input[key],input[key]);
assert.deepEqual(next.points,route.points);
assert.equal(next.input.end.segment,3);
assert.equal(next.input.end.position,2000);
assert.equal(next.input.clips[1].segment,2);
assert.equal(next.input.clips[1].position,1000);
assert.equal(next.input.clips[2].segment,3);
assert.equal(next.input.clips[2].position,1000);
assert.equal(next.input.obstacles[0].position,2200);
assert.equal(next.input.obstacles[1].position,1350);
assert.deepEqual(next.input.clips.map(c=>c.id),input.clips.map(c=>c.id));
assert.deepEqual(next.input.obstacles.map(c=>c.id),input.obstacles.map(c=>c.id));
// These physical coordinates must survive local-coordinate conversion.
const near=(actual,expected)=>actual.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-8));
near(pointOnWall(next.input,next.input.clips[1]),[3000,2944]);
near(pointOnWall(next.input,next.input.clips[2]),[56,2000]);
near(pointOnWall(next.input,next.input.end),[56,1000]);
const top=wallObstaclePolygon(next.input,next.input.obstacles[0]).points;
near([Math.min(...top.map(p=>p[0])),Math.max(...top.map(p=>p[0])),Math.min(...top.map(p=>p[1])),Math.max(...top.map(p=>p[1]))],[1500,1800,2850,3000]);
const checked=validateWallRoute(next.input,next.points);
assert.equal(checked.ok,true,checked.error);
assert.deepEqual(legacy,original,'migration must not mutate saved data');
next.points[0][0]=999;
assert.deepEqual(legacy,original,'returned points must be independent copies');

// Individual gaps and endpoint overrides are part of the saved measurements.
const varied=structuredClone(legacy);
varied.input.start.gap=25;varied.input.end.gap=30;
varied.input.clips.forEach((clip,index)=>clip.gap=50+index*20);
const converted=migrateRoomPlanner(varied);
assert.equal(converted.input.start.gap,25);
assert.equal(converted.input.end.gap,30);
assert.deepEqual(converted.input.clips.map(c=>c.gap),[50,70,90]);
assert.deepEqual(converted.input.obstacles.map(c=>[c.width,c.depth]),[[300,150],[250,100]]);

const saved=migrateRoomPlanner(legacy),passthrough=migrateRoomPlanner(saved);
assert.deepEqual(passthrough,saved);
assert.notEqual(passthrough,saved);
assert.notEqual(passthrough.input.wall,saved.input.wall);
assert.equal(migrateRoomPlanner(undefined),null);
for(const bad of [true,[],{}, {version:1,input:null},{version:1,input:{width:null,height:3000,start:null,end:null}}, {version:1,input:{...input,clips:{}}},{version:2,input:{wall:null}},{version:2,input:{...saved.input,wall:{lengths:'2400',turns:[]}}},{version:2,input:{...saved.input,start:null}},{version:2,input:{...saved.input,clips:[null]}}]){
  let result;assert.doesNotThrow(()=>result=migrateRoomPlanner(bad));
  assert.ok(result?.error,'malformed data must produce a visible error result');
}
const badPoints=migrateRoomPlanner({...saved,points:[['invalid']]});
assert.equal(badPoints.savedError,true);
assert.deepEqual(badPoints.input,saved.input,'keep valid walls when saved route points are malformed');
assert.deepEqual(badPoints.points,[]);
for(const language of ['nb','en']){
  assert.ok(roomPlannerError({code:'INVALID_WALL',error:'Dansk fejl'},language).length>20);
  assert.ok(roomPlannerError({code:'CLIP_ORDER',error:'Dansk fejl'},language).length>20);
}
console.log('Wall-plan migration tests passed.');
