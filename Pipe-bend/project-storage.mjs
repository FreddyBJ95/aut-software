import {hasSpatialPipe} from './spatial-geometry.mjs?v=44';
// Stable project identity and independently stored wall working copies.
// A working copy is separate from the pipe that has actually been applied.
const PREFIX='pipe-bend-wall-draft-v2:';
const LEGACY_KEY='pipe-bend-wall-draft-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function isProjectId(value){return typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);}
export function projectIdentity(project){return isProjectId(project?.projectId)?project.projectId.toLowerCase():null;}
export function wallDraftStorageKey(project){const id=projectIdentity(project);return id?PREFIX+id:null;}

function ordered(value){
  if(Array.isArray(value))return value.map(ordered);
  if(record(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])]));
  return value;
}
/** Excludes names, stock and redundant reconstructed planner points. The main
 * lengths/turns/heading/placement already define that geometry, without the
 * ~1e-13 coordinate drift introduced when a metadata-only commit rebuilds it. */
export function projectGeometryKey(project){
  const planner=project?.planner;
  const parts=[project?.diameter,project?.radius,project?.lengths,project?.turns,project?.heading,project?.measurementMode??'tangent',project?.placement??null,planner?{version:planner.version,input:planner.input,routeEdited:!!planner.routeEdited,pipeEdited:!!planner.pipeEdited}:null];
  // Do not change legacy fingerprints: private drafts created before spatial
  // pipes must still match. Orientation is geometry when it is present.
  if(project?.bendRotations!==undefined||project?.startFrame!==undefined)parts.push({bendRotations:project.bendRotations??null,startFrame:project.startFrame??null});
  return JSON.stringify(ordered(parts));
}
export function projectOpenKey(project){return JSON.stringify([projectIdentity(project),projectGeometryKey(project)]);}

function legacyMatches(project,key){
  if(hasSpatialPipe(project))return false;
  try {
    const parts=JSON.parse(key);
    return Array.isArray(parts)&&parts.length===8&&sameData(parts.slice(2),[project?.diameter,project?.radius,project?.lengths,project?.turns,project?.heading,project?.planner]);
  }catch{return false;}
}
function sameData(a,b){
  if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7;
  if(a===b)return true;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>sameData(value,b[index]));
  if(record(a)&&record(b)){const keys=Object.keys(a),other=Object.keys(b);return keys.length===other.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&sameData(a[key],b[key]));}
  return false;
}
function independentDraft(project,planner,normalizeApplied){
  if(planner?.pipeEditPending||!project?.planner)return true;
  const applied=normalizeApplied(project.planner);
  return !applied||!!applied.error||applied.version!==planner.version||!sameData(applied.input,planner.input)||!sameData(applied.points,planner.points);
}

/** Storage errors deliberately propagate so import can fail before mutation. */
export function writeWallDraft(project,planner,storage=globalThis.localStorage,normalizeApplied=value=>value){
  const key=wallDraftStorageKey(project);if(!key)throw new TypeError('Projektet mangler et gyldigt projekt-ID.');
  if(!record(planner)||![1,2].includes(planner.version)||!record(planner.input)||!Array.isArray(planner.points))throw new TypeError('Vægudkastet er ikke gyldigt.');
  const next={version:2,projectId:projectIdentity(project),sourceKey:projectGeometryKey(project),dirty:independentDraft(project,planner,normalizeApplied),planner:clone(planner)};
  storage.setItem(key,JSON.stringify(next));
  return clone(next.planner);
}

/** A tombstone also prevents a plain import from claiming an old v1 draft. */
export function clearWallDraft(project,storage=globalThis.localStorage){
  const key=wallDraftStorageKey(project);if(!key)throw new TypeError('Projektet mangler et gyldigt projekt-ID.');
  storage.setItem(key,JSON.stringify({version:2,projectId:projectIdentity(project),sourceKey:projectGeometryKey(project),dirty:false,planner:null}));
}

/**
 * Read a private working copy. A changed main pipe replaces only an unchanged
 * copy of the applied pipe; independently edited walls are retained and must
 * be revalidated with current dimensions by the caller. Legacy drafts migrate
 * only when the original pipe geometry matches, ignoring mutable names.
 */
export function readWallDraft(project,storage=globalThis.localStorage,normalize=value=>clone(value)){
  const key=wallDraftStorageKey(project);if(!key)return null;
  const raw=storage.getItem(key);
  if(raw!==null){
    const saved=JSON.parse(raw);
    if(!record(saved)||saved.version!==2||saved.projectId!==projectIdentity(project))throw new TypeError('Det gemte vægudkast kunne ikke læses.');
    if(saved.planner===null)return null;
    if(!saved.dirty&&saved.sourceKey!==projectGeometryKey(project))return null;
    return normalize(saved.planner);
  }
  const legacyRaw=storage.getItem(LEGACY_KEY);if(legacyRaw===null)return null;
  const legacy=JSON.parse(legacyRaw);if(!record(legacy)||!legacyMatches(project,legacy.projectKey))return null;
  const planner=normalize(legacy.planner);if(!planner||planner.error)return planner;
  // Leave the only legacy copy intact if the new location cannot be written.
  try{writeWallDraft(project,planner,storage,normalize);storage.removeItem(LEGACY_KEY);}catch{}
  return clone(planner);
}
