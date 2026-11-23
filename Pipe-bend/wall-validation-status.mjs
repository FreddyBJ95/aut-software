import {hasSpatialPipe} from './spatial-geometry.mjs?v=44';
// A worksheet/export must describe the current pipe, not merely the planner's
// last saved point list. The explicit edited flag requires a new planner Apply.
import {geometry} from './geometry.mjs';
import {measurementMode,convertMeasurementMode} from './measurements.mjs';
import {migrateRoomPlanner} from './room-planner.mjs?v=44';
import {validateWallRoute} from './wall-routing.mjs?v=44';

const finitePoint=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite);
const messages={
  checked:'Vægkontrol: kontrolleret',
  needsCheck:'Vægkontrol: kræver ny kontrol',
  detail:'Åbn vægforløbet, og kontrollér røret igen.',
};
const unchecked=code=>({status:'needs-check',checked:false,code,messageKey:messages.needsCheck,detailKey:messages.detail});

export function wallValidationStatus(project) {
  if(!project?.planner)return {status:'none',checked:false,code:'NO_WALL_PLAN',messageKey:'',detailKey:''};
  if(hasSpatialPipe(project))return {status:'needs-check',checked:false,code:'SPATIAL_PIPE_UNCHECKED',messageKey:'Vægkontrol: højdeskift ikke kontrolleret',detailKey:'Vægkontrollen gælder kun 2D. Rørets højdeskift er ikke kontrolleret mod vægge og forhindringer.'};
  try {
    const planner=migrateRoomPlanner(project.planner);
    if(!planner||planner.error||planner.savedError)return unchecked('SAVED_WALL_INVALID');
    const model=measurementMode(project)==='vertex'?project:convertMeasurementMode(project,'vertex');
    const current=geometry(model);
    if(!current.lines.length)return unchecked('EMPTY_PIPE');
    const start=project.placement?.start??planner.points?.[0];
    if(!finitePoint(start))return unchecked('INVALID_START');
    const points=[current.lines[0].dimensionStart??current.start,...current.lines.map(line=>line.dimensionEnd??line.end)]
      .map(point=>[point[0]+start[0],point[1]+start[1]]);
    if(!points.every(finitePoint))return unchecked('INVALID_PIPE');
    const input={...planner.input,diameter:project.diameter,radius:project.radius};
    const checked=validateWallRoute(input,points);
    if(!checked.ok)return unchecked(checked.code||'WALL_VALIDATION_FAILED');
    if(planner.routeEdited)return unchecked('ROUTE_EDITED');
    return {status:'checked',checked:true,code:'WALL_VALIDATED',messageKey:messages.checked,detailKey:''};
  }catch{return unchecked('INVALID_PIPE');}
}
