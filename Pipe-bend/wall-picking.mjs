// Pick the closest real part of a wall drawing, rather than the last SVG hit
// target painted over it. All geometry is in mm; the tolerance is in pixels.
const TAU=2*Math.PI,DEG=Math.PI/180,TIE_PX=1e-7;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const pointOK=p=>Array.isArray(p)&&p.length===2&&finite(p[0])&&finite(p[1]);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=t=>Math.max(0,Math.min(1,t));

function optionsOK(point,pixelsPerMm,maxDistancePx){return pointOK(point)&&finite(pixelsPerMm)&&pixelsPerMm>0&&finite(maxDistancePx)&&maxDistancePx>=0;}

function linePoint(p,line){
  if(!line||!pointOK(line.start)||!pointOK(line.end))return null;
  const a=line.start,b=line.end,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(!finite(length)||length<=0)return null;
  const ux=dx/length,uy=dy/length;
  const fraction=clamp(((p[0]-a[0])*ux+(p[1]-a[1])*uy)/length);
  return{point:[a[0]+dx*fraction,a[1]+dy*fraction],fraction,length};
}

function arcPoint(p,arc){
  // An invalid draft can still expose its sharp bend vertex for repair. This
  // explicit representation must not turn a malformed circular arc into a hit.
  if(arc?.vertex!==undefined){
    const vertex=arc.vertex,samples=arc.samples;
    if(!pointOK(vertex)||!Array.isArray(samples)||samples.length!==1||!pointOK(samples[0])||samples[0][0]!==vertex[0]||samples[0][1]!==vertex[1])return null;
    return{point:vertex.slice(),fraction:.5};
  }
  if(!arc||!pointOK(arc.center)||!finite(arc.radius)||arc.radius<=0||!finite(arc.turn)||!arc.turn||Math.abs(arc.turn)>360)return null;
  const start=arc.start??arc.samples?.[0],end=arc.end??arc.samples?.at(-1);
  if(!pointOK(start)||!pointOK(end))return null;
  const center=arc.center,sweep=arc.turn*DEG,startAngle=Math.atan2(start[1]-center[1],start[0]-center[0]);
  const tolerance=1e-7*Math.max(1,arc.radius),expectedEnd=[center[0]+arc.radius*Math.cos(startAngle+sweep),center[1]+arc.radius*Math.sin(startAngle+sweep)];
  if(Math.abs(distance(start,center)-arc.radius)>tolerance||distance(end,expectedEnd)>tolerance)return null;
  const radial=Math.hypot(p[0]-center[0],p[1]-center[1]);
  const at=fraction=>{
    if(fraction===0)return start.slice();if(fraction===1)return end.slice();
    const angle=startAngle+sweep*fraction;
    return[center[0]+arc.radius*Math.cos(angle),center[1]+arc.radius*Math.sin(angle)];
  };
  const fractions=[0,1];
  if(radial===0)fractions.push(.5);
  else {
    const angle=Math.atan2(p[1]-center[1],p[0]-center[0]);
    const relative=(((angle-startAngle)*Math.sign(sweep))%TAU+TAU)%TAU;
    if(relative<=Math.abs(sweep)+1e-12)fractions.push(clamp(relative/Math.abs(sweep)));
  }
  let best=null;
  for(const fraction of fractions){
    const q=at(fraction),d=distance(p,q);
    if(!finite(d))continue;
    if(!best||d<best.distance-1e-12||(Math.abs(d-best.distance)<=1e-12&&fraction>0&&fraction<1))best={point:q,fraction,distance:d};
  }
  return best;
}

function better(candidate,best,selected){
  if(!best||candidate.distancePx<best.distancePx-TIE_PX)return true;
  if(Math.abs(candidate.distancePx-best.distancePx)>TIE_PX)return false;
  const selectedCandidate=selected?.type===candidate.type&&selected.index===candidate.index;
  const selectedBest=selected?.type===best.type&&selected.index===best.index;
  if(selectedCandidate!==selectedBest)return selectedCandidate;
  // At a tangent junction both primitives are equally near. Prefer its bend
  // unless the user has already selected the adjoining straight.
  if(candidate.type!==best.type)return candidate.type==='turn';
  return candidate.index<best.index;
}

/**
 * selected:{type:'length'|'turn',index} resolves only numerical distance ties.
 * At detail zoom the caller can raise maxDistancePx to cover a visible tube
 * wider than the minimum touch area (for example OD*pixelsPerMm/2 + 4).
 * Invalid individual primitives are skipped so a partially editable draft can
 * still select a valid straight. Draft point bends use {vertex,samples:[vertex]}.
 * The returned point is an independent copy.
 */
export function pickPipePart({geometry,point,pixelsPerMm,maxDistancePx=22,selected}={}){
  if(!geometry||!optionsOK(point,pixelsPerMm,maxDistancePx))return null;
  const straights=geometry.straights??[],arcs=geometry.arcs??[];
  if(!Array.isArray(straights)||!Array.isArray(arcs)||straights.length>200||arcs.length>199)return null;
  let best=null;
  const consider=(hit,type,index)=>{
    if(!hit)return;
    const distancePx=distance(point,hit.point)*pixelsPerMm;
    if(!finite(distancePx)||distancePx>maxDistancePx+TIE_PX)return;
    const candidate={type,index,distancePx,point:hit.point,fraction:hit.fraction};
    if(better(candidate,best,selected))best=candidate;
  };
  straights.forEach((part,index)=>consider(linePoint(point,part),'length',index));
  arcs.forEach((part,index)=>consider(arcPoint(point,part),'turn',index));
  return best;
}

/** position is measured from the selected finite wall segment's start. */
export function pickWallSegment({segments,point,pixelsPerMm,maxDistancePx=22,selectedIndex}={}){
  if(!Array.isArray(segments)||segments.length>100||!optionsOK(point,pixelsPerMm,maxDistancePx))return null;
  let best=null;
  segments.forEach((segment,ordinal)=>{
    const hit=linePoint(point,segment);if(!hit)return;
    const index=Number.isInteger(segment.index)&&segment.index>=0?segment.index:ordinal;
    const distancePx=distance(point,hit.point)*pixelsPerMm;
    if(!finite(distancePx)||distancePx>maxDistancePx+TIE_PX)return;
    const candidate={type:'wall',index,distancePx,point:hit.point,fraction:hit.fraction,position:hit.length*hit.fraction};
    if(better(candidate,best,{type:'wall',index:selectedIndex}))best=candidate;
  });
  return best;
}
