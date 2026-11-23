import assert from 'node:assert/strict';
import {isProjectId,projectIdentity,projectGeometryKey,projectOpenKey,wallDraftStorageKey,readWallDraft,writeWallDraft,clearWallDraft} from './project-storage.mjs';
import {normalizeWallDraft,defaultWallPlanInput} from './room-planner.mjs';
const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),data};};
const planner={version:2,input:{wall:{lengths:[2400],turns:[],heading:0,side:'left'}},points:[]};
const project={version:1,projectId:'01234567-89ab-4cde-8f01-23456789abcd',name:'Rør1',drawingNumber:'T1',diameter:12,radius:38,lengths:[1000],turns:[],heading:0,measurementMode:'vertex',planner:structuredClone(planner)};
const db=storage(),draft=structuredClone(planner);draft.input.wall.lengths=[2500];
writeWallDraft(project,draft,db);
const renamed={...project,name:'Nyt navn',drawingNumber:'Andet nummer',stock:12000};
assert.equal(projectOpenKey(renamed),projectOpenKey(project));
assert.deepEqual(readWallDraft(renamed,db),draft,'Metadata changes retain the current wall measurement');
assert.deepEqual(readWallDraft({...renamed,radius:45},db),draft,'Independent walls survive dimension changes and are revalidated by the caller');
const changedPipe={...project,lengths:[1100],planner:{...planner,points:[[0,0],[1100,0]]}};
writeWallDraft(project,planner,db);
assert.equal(readWallDraft(changedPipe,db),null,'Unchanged applied copy does not mask edits in the main pipe');
assert.notEqual(projectOpenKey(changedPipe),projectOpenKey(project));
const roundedPlanner={...planner,points:[[0,0],[1000,.731]]},driftedProject={...project,planner:{...roundedPlanner,points:[[1e-13,-1e-13],[1000+1e-13,.731+1e-13]]}};
writeWallDraft(driftedProject,roundedPlanner,db);
assert.equal(JSON.parse(db.getItem(wallDraftStorageKey(project))).dirty,false,'Reconstructed floating coordinates are not independent wall edits');
assert.equal(readWallDraft({...driftedProject,lengths:[1010]},db),null,'A later main-pipe edit replaces a numerically unchanged applied copy');
assert.equal(projectOpenKey({...driftedProject,name:'Renamed'}),projectOpenKey({...project,planner:roundedPlanner}),'Metadata commits may rebuild points without resetting the wall session');
writeWallDraft(driftedProject,{...roundedPlanner,input:{wall:{lengths:[2400.01],turns:[],heading:0,side:'left'}}},db);
assert.equal(JSON.parse(db.getItem(wallDraftStorageKey(project))).dirty,true,'Real wall measurement changes remain independent');
writeWallDraft(project,{...draft,pipeEditPending:{type:'length',index:0,raw:'0',direction:1}},db);
assert.equal(readWallDraft(changedPipe,db).pipeEditPending.raw,'0','A pending target is a working copy, not an applied pipe');
const other={...project,projectId:'11111111-2222-4333-8444-555555555555'};
writeWallDraft(other,planner,db);assert.deepEqual(readWallDraft(other,db),planner);
clearWallDraft(project,db);assert.equal(readWallDraft(project,db),null);assert.deepEqual(readWallDraft(other,db),planner);

// A v30 working copy migrates once, even after project metadata was renamed.
const legacy=storage(),key=JSON.stringify([project.name,project.drawingNumber,project.diameter,project.radius,project.lengths,project.turns,project.heading,project.planner]);
legacy.setItem('pipe-bend-wall-draft-v1',JSON.stringify({projectKey:key,planner:draft}));
assert.deepEqual(readWallDraft(renamed,legacy),draft);
assert.equal(legacy.getItem('pipe-bend-wall-draft-v1'),null);
assert.ok(legacy.getItem(wallDraftStorageKey(project)));
const driftLegacy=storage(),driftLegacyKey=JSON.stringify([project.name,project.drawingNumber,project.diameter,project.radius,project.lengths,project.turns,project.heading,roundedPlanner]);
driftLegacy.setItem('pipe-bend-wall-draft-v1',JSON.stringify({projectKey:driftLegacyKey,planner:draft}));
assert.deepEqual(readWallDraft({...driftedProject,name:'Renamed before update'},driftLegacy),draft,'Legacy rename migration also tolerates reconstructed point drift');
const mismatched=storage();mismatched.setItem('pipe-bend-wall-draft-v1',JSON.stringify({projectKey:key,planner:draft}));
assert.equal(readWallDraft({...project,lengths:[999]},mismatched),null,'Legacy migration cannot claim a different main pipe');
assert.ok(mismatched.getItem('pipe-bend-wall-draft-v1'));
clearWallDraft(project,mismatched);assert.equal(readWallDraft(project,mismatched),null,'Explicitly imported no-draft file cannot reclaim a matching legacy draft');
const failing=storage();failing.setItem('pipe-bend-wall-draft-v1',JSON.stringify({projectKey:key,planner:draft}));failing.setItem=()=>{throw new Error('Full storage');};
assert.deepEqual(readWallDraft(project,failing),draft);assert.ok(failing.getItem('pipe-bend-wall-draft-v1'),'Failed migration retains its sole old copy');
assert.throws(()=>writeWallDraft(project,draft,failing));assert.throws(()=>clearWallDraft(project,failing));

assert.equal(projectIdentity({...project,projectId:project.projectId.toUpperCase()}),project.projectId);
for(const id of [null,undefined,'','../bad','__proto__','not-a-uuid'])assert.equal(isProjectId(id),false);
assert.equal(isProjectId(project.projectId),true);
assert.throws(()=>writeWallDraft({...project,projectId:undefined},draft,db));
assert.throws(()=>writeWallDraft(project,null,db));
const saved=JSON.stringify(project),savedDraft=JSON.stringify(draft);readWallDraft(project,db);projectGeometryKey(project);assert.equal(JSON.stringify(project),saved);assert.equal(JSON.stringify(draft),savedDraft);

// Portable drafts remain distinct from applied geometry: even empty or
// physically invalid measured plans must round-trip, while malformed bytes
// are rejected before the host changes a project or its private draft.
const empty={version:2,input:{...defaultWallPlanInput(),diameter:12,radius:38},points:[],pipeEdited:false,pipeEditPending:null,pipeAdjustments:[]};
const normalizedEmpty=normalizeWallDraft(empty);assert.equal(normalizedEmpty.error,undefined);assert.equal(normalizedEmpty.savedError,false);assert.deepEqual(normalizedEmpty.input,empty.input);
const measured={...empty,input:{...empty.input,wall:{lengths:[2400],turns:[],heading:0,side:'left'},start:{segment:0,position:200},end:{segment:0,position:2200}}};
assert.deepEqual(normalizeWallDraft(measured).input.wall.lengths,[2400]);
const pending={...measured,points:[[200,16],[2200,16]],pipeEdited:true,pipeEditPending:{type:'length',index:0,raw:'0',direction:1,code:'EDIT_INVALID_VALUE',error:'Indtast et mål.'},pipeAdjustments:[]};
const normalized=normalizeWallDraft(pending);assert.equal(normalized.error,undefined);assert.equal(normalized.pipeEditPending.raw,'0');assert.deepEqual(normalized.points,pending.points);
const physicallyInvalid={...measured,points:[[200,16],[2200,-20]]};assert.deepEqual(normalizeWallDraft(physicallyInvalid).points,physicallyInvalid.points);
for(const bad of [null,{}, {...measured,points:[[0,0]]},{...measured,points:[[0,0],[null,1]]},{...measured,points:[[0,0],[NaN,1]]},{...measured,points:[[0,0],[,1]]},{...pending,pipeEditPending:{...pending.pipeEditPending,index:9}},{...pending,pipeEditPending:{...pending.pipeEditPending,raw:1}},{...pending,pipeAdjustments:[{type:'length',index:2,from:1,to:2}]},{...measured,input:{...measured.input,wall:{...measured.input.wall,turns:[90]}}}])assert.ok(normalizeWallDraft(bad).error);
const portable=JSON.parse(JSON.stringify({...project,wallDraft:normalized}));
const imported={...portable,projectId:other.projectId};delete imported.wallDraft;
writeWallDraft(imported,normalizeWallDraft(portable.wallDraft),db);assert.deepEqual(readWallDraft(imported,db,normalizeWallDraft),normalized);
// A generated angle fallback is portable context, never a substitute for
// fresh physical route validation. Manual/pending/empty drafts drop it.
const fallbackDraft={...measured,points:[[200,16],[2200,16]],pipeDetourNotice:{requested:90,used:45}};
const fallbackBefore=structuredClone(fallbackDraft),fallbackCopy=normalizeWallDraft(fallbackDraft);
assert.deepEqual(fallbackCopy.pipeDetourNotice,{requested:90,used:45});
assert.deepEqual(fallbackDraft,fallbackBefore);
fallbackCopy.pipeDetourNotice.used=30;
assert.equal(fallbackDraft.pipeDetourNotice.used,45);
writeWallDraft(imported,normalizeWallDraft(fallbackDraft),db);
assert.deepEqual(readWallDraft(imported,db,normalizeWallDraft).pipeDetourNotice,{requested:90,used:45});
for(const edited of [
 {...fallbackDraft,pipeEdited:true},
 {...fallbackDraft,routeEdited:true},
 {...fallbackDraft,pipeEditPending:pending.pipeEditPending},
 {...fallbackDraft,points:[]},
])assert.equal(normalizeWallDraft(edited).pipeDetourNotice,undefined);
for(const pair of [true,[],{requested:90,used:90},{requested:90,used:0},{requested:90,used:NaN},{requested:60,used:45},{requested:180,used:45},{requested:'90',used:45}]){
 assert.ok(normalizeWallDraft({...fallbackDraft,pipeDetourNotice:pair}).error,'Malformed or mismatched angle context must not enter a portable draft');
}

// Spatial orientation is part of source geometry, while all old fingerprints
// stay byte-for-byte compatible with their existing private draft records.
const expectedLegacyKey=JSON.stringify([12,38,[1000],[],0,'vertex',null,{input:{wall:{heading:0,lengths:[2400],side:'left',turns:[]}},pipeEdited:false,routeEdited:false,version:2}]);
assert.equal(projectGeometryKey(project),expectedLegacyKey);
const flatPipe={...project,lengths:[1000,500],turns:[90]},raisedPipe={...flatPipe,bendRotations:[90]},framedPipe={...flatPipe,startFrame:{tangent:[1,0,0],normal:[0,0,1]}};
for(const oriented of [raisedPipe,framedPipe,{...flatPipe,bendRotations:[0]}])assert.notEqual(projectGeometryKey(oriented),projectGeometryKey(flatPipe));
assert.equal(projectGeometryKey({...raisedPipe,name:'Height route renamed'}),projectGeometryKey(raisedPipe));
const spatialDB=storage();writeWallDraft(flatPipe,planner,spatialDB);
assert.equal(readWallDraft(raisedPipe,spatialDB),null,'A prior applied XY copy must not mask a height-changing pipe');
writeWallDraft(raisedPipe,draft,spatialDB);
assert.deepEqual(readWallDraft({...raisedPipe,bendRotations:[-90]},spatialDB),draft,'Independent measured walls survive spatial pipe edits without replacing the main pipe');
const spatialLegacy=storage(),spatialLegacyKey=JSON.stringify([flatPipe.name,flatPipe.drawingNumber,flatPipe.diameter,flatPipe.radius,flatPipe.lengths,flatPipe.turns,flatPipe.heading,flatPipe.planner]);
spatialLegacy.setItem('pipe-bend-wall-draft-v1',JSON.stringify({projectKey:spatialLegacyKey,planner:draft}));
assert.equal(readWallDraft(raisedPipe,spatialLegacy),null,'A 2D legacy draft must not silently claim an otherwise matching spatial pipe');
assert.ok(spatialLegacy.getItem('pipe-bend-wall-draft-v1'),'Spatial migration guard preserves the sole legacy copy');
const orientationBefore=JSON.stringify(raisedPipe);projectGeometryKey(raisedPipe);readWallDraft(raisedPipe,spatialDB);assert.equal(JSON.stringify(raisedPipe),orientationBefore);

console.log('Project draft storage: stable identity, rename safety, independent copies, legacy migration, tombstones and atomic writes PASS');
