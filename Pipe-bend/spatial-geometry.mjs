import {resolveMeasurements} from './measurements.mjs';

// Project roll angles are right-handed around the incoming A→B tangent.
// The first roll is relative to startFrame.normal (default: left in XY).
// Later rolls are relative to the previous bend plane transported along the
// pipe. Signed turns retain the old left/right convention in that plane.
const EPS=1e-10, FRAME_TOLERANCE=1e-6, RAD=Math.PI/180;
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const magnitude=a=>Math.hypot(...a);
const unit=a=>mul(a,1/magnitude(a));
const vector=a=>Array.isArray(a)&&a.length===3&&a.every(v=>typeof v==='number'&&Number.isFinite(v));
const close=(a,b)=>Math.abs(a-b)<=FRAME_TOLERANCE;
const clean=a=>a.map(v=>Math.abs(v)<1e-12?0:v);
export const normalizeSpatialAngle=value=>{const n=((value+180)%360+360)%360-180;return Math.abs(n)<1e-10?0:n;};
function frame(tangent,normal){const t=unit(tangent),n=unit(add(normal,mul(t,-dot(normal,t))));return{tangent:clean(t),normal:clean(n),binormal:clean(unit(cross(t,n)))};}
function initialFrame(state){const h=state.heading??0;return state.startFrame?frame(state.startFrame.tangent,state.startFrame.normal):frame([Math.cos(h),Math.sin(h),0],[-Math.sin(h),Math.cos(h),0]);}
function rotateNormal(f,degrees){const a=degrees*RAD;return add(mul(f.normal,Math.cos(a)),mul(f.binormal,Math.sin(a)));}
function afterBend(f,turn,rotation){const a=turn*RAD,n=rotateNormal(f,rotation);return frame(add(mul(f.tangent,Math.cos(a)),mul(n,Math.sin(a))),add(mul(f.tangent,-Math.sin(a)),mul(n,Math.cos(a))));}

export function validateSpatialState(state){
 if(!state||typeof state!=='object')return 'Rørprojektet mangler.';
 if(state.bendRotations!==undefined&&(!Array.isArray(state.bendRotations)||!Array.isArray(state.turns)||state.bendRotations.length!==state.turns.length||state.bendRotations.some(a=>typeof a!=='number'||!Number.isFinite(a)||Math.abs(a)>180)))return 'Der skal være én endelig drejning mellem −180° og 180° for hvert buk.';
 if(state.startFrame!==undefined){const f=state.startFrame;if(!f||typeof f!=='object'||!vector(f.tangent)||!vector(f.normal)||!close(magnitude(f.tangent),1)||!close(magnitude(f.normal),1)||Math.abs(dot(f.tangent,f.normal))>FRAME_TOLERANCE)return 'Rørets startretning og reference skal være vinkelrette enhedsvektorer.';}
 return null;
}

/** Structural rather than height-only detection: a 180° roll or a rotated
 * XY start frame also changes the shape versus legacy geometry(). */
export function hasSpatialPipe(state){
 if(validateSpatialState(state))return true;
 if(state.bendRotations?.some(a=>Math.abs(a)>EPS))return true;
 if(state.startFrame){const h=state.heading??0,t=[Math.cos(h),Math.sin(h),0],n=[-Math.sin(h),Math.cos(h),0];return state.startFrame.tangent.some((v,i)=>Math.abs(v-t[i])>EPS)||state.startFrame.normal.some((v,i)=>Math.abs(v-n[i])>EPS);}
 return false;
}

export function geometry3D(state){
 const error=validateSpatialState(state);if(error)throw new RangeError(error);
 const measured=resolveMeasurements(state),lines=[],arcs=[],points=[[0,0,0]],lineFrames=[];
 let p=[0,0,0],f=initialFrame(state),used=0;
 for(let i=0;i<measured.tangentLengths.length;i++){
  const length=measured.tangentLengths[i],start=p.slice(),previous=measured.setbacks[i-1]??0,next=measured.setbacks[i]??0;
  p=add(p,mul(f.tangent,length));const end=p.slice(),vertex=measured.mode==='vertex';
  lines.push({start,end,length,dimension:vertex?measured.vertexLengths[i]:length,dimensionStart:vertex?add(start,mul(f.tangent,-previous)):start.slice(),dimensionEnd:vertex?add(end,mul(f.tangent,next)):end.slice(),direction:f.tangent.slice(),frame:structuredClone(f)});
  lineFrames.push(structuredClone(f));points.push(end);used+=length;
  if(i>=state.turns.length)continue;
  const turn=state.turns[i],rotation=state.bendRotations?.[i]??0,angle=turn*RAD,radius=state.radius,normal=rotateNormal(f,rotation),k=Math.sign(turn),center=add(p,mul(normal,k*radius)),samples=[],arcStart=p.slice();
  for(let j=0;j<=32;j++){const a=Math.abs(angle)*j/32;samples.push(clean(add(arcStart,add(mul(f.tangent,radius*Math.sin(a)),mul(normal,k*radius*(1-Math.cos(a)))))));}
  const endFrame=afterBend(f,turn,rotation);
  arcs.push({turn,rotation,angle,radius,start:arcStart,end:samples.at(-1).slice(),samples,position:used,center:clean(center),tangent:f.tangent.slice(),normal:clean(normal),binormal:clean(cross(f.tangent,normal)),endFrame:structuredClone(endFrame)});
  p=samples.at(-1).slice();points.push(...samples);used+=radius*Math.abs(angle);f=endFrame;
 }
 return{lines,arcs,points,used,start:[0,0,0],end:clean(p),measurementMode:measured.mode,tangentLengths:measured.tangentLengths,vertexLengths:measured.vertexLengths,lineFrames,finalFrame:structuredClone(f)};
}

function outwardFrame(state,end,geo=geometry3D(state)){
 const f=end==='A'?(geo.lineFrames[0]??initialFrame(state)):geo.finalFrame;
 return end==='A'?frame(mul(f.tangent,-1),mul(f.normal,-1)):structuredClone(f);
}

/** Choose a global bend direction. 'forward'/'back' use the last horizontal
 * bearing, so a vertical run can continue along the original wall direction.
 * A direction parallel to the current tangent cannot define a bend plane. */
export function bendOrientation(state,end,direction){
 const geo=geometry3D(state),f=outwardFrame(state,end,geo),ordered=end==='A'?geo.lines:geo.lines.slice().reverse();
 let bearing=null;
 for(const line of ordered){const d=end==='A'?mul(line.direction,-1):line.direction;if(Math.hypot(d[0],d[1])>1e-7){bearing=unit([d[0],d[1],0]);break;}}
 if(!bearing){const h=state.heading??0;bearing=[Math.cos(h)*(end==='A'?-1:1),Math.sin(h)*(end==='A'?-1:1),0];}
 const horizontal=Math.hypot(f.tangent[0],f.tangent[1])>1e-7?unit([f.tangent[0],f.tangent[1],0]):bearing;
 const left=cross([0,0,1],horizontal),targets={left,right:mul(left,-1),up:[0,0,1],down:[0,0,-1],forward:bearing,back:mul(bearing,-1)};
 if(!targets[direction])return{available:false,turnSign:null,rotation:null,direction:null,frame:f};
 const target=targets[direction],projected=add(target,mul(f.tangent,-dot(target,f.tangent)));
 if(magnitude(projected)<1e-7)return{available:false,turnSign:null,rotation:null,direction:null,frame:f};
 const d=unit(projected);let rotation=normalizeSpatialAngle(Math.atan2(dot(d,f.binormal),dot(d,f.normal))/RAD),turnSign=1;
 if(rotation>90+EPS){rotation-=180;turnSign=-1;}else if(rotation<-90-EPS){rotation+=180;turnSign=-1;}
 return{available:true,turnSign,rotation:normalizeSpatialAngle(rotation),direction:clean(d),frame:f};
}

/** Extend from either end. At A the first existing roll is compensated for
 * the new incoming bend plane; old bends keep their positions/orientations
 * relative to the preserved old run rather than being reinterpreted in XY. */
export function extendSpatial(state,end,length,turn,rotation=0){
 const error=validateSpatialState(state);if(error)throw new RangeError(error);
 if(!Number.isFinite(rotation)||Math.abs(rotation)>180)throw new RangeError('Drejningen skal være mellem −180° og 180°.');
 if(end!=='A'&&end!=='B')throw new RangeError('Vælg ende A eller B.');
 const next=structuredClone(state);
 if(!next.lengths.length){next.lengths=[length];return next;}
 const hasFields=state.bendRotations!==undefined||state.startFrame!==undefined||Math.abs(rotation)>EPS;
 if(end==='B'){
  next.lengths.push(length);next.turns.push(turn);
  if(hasFields)next.bendRotations=[...(state.bendRotations??state.turns.map(()=>0)),normalizeSpatialAngle(rotation)];
  return next;
 }
 const geo=geometry3D(state),outward=outwardFrame(state,'A',geo),out=afterBend(outward,turn,rotation),start=frame(mul(out.tangent,-1),mul(out.normal,-1));
 next.lengths.unshift(length);next.turns.unshift(-turn);
 next.heading=Math.atan2(start.tangent[1],start.tangent[0]);
 if(hasFields){
  next.startFrame={tangent:start.tangent,normal:start.normal};
  const rolls=(state.bendRotations??state.turns.map(()=>0)).slice();if(rolls.length)rolls[0]=normalizeSpatialAngle(rolls[0]+rotation);
  next.bendRotations=[0,...rolls];
 }else next.heading=(state.heading??0)+turn*RAD;
 return next;
}

/** Physical one-way-bender rotation around the incoming tangent, looking
 * from A toward B. The viewing convention is stored with every report row.
 * First row is relative to the defined starting reference, not another bend. */
export function spatialBendRotations(state){
 const error=validateSpatialState(state);if(error)throw new RangeError(error);
 return state.turns.map((turn,index)=>({index,id:'B'+(index+1),rotation:normalizeSpatialAngle((state.bendRotations?.[index]??0)+(turn<0?180:0)-(index&&state.turns[index-1]<0?180:0)),first:index===0,view:'A→B'}));
}
