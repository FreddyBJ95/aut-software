// Coupled edits of a pipe inside a fixed measured wall chain. Numerical fits
// only propose candidates; the existing physical validator remains decisive.
import {validateWallRoute,wallLayout,arcSegmentDistance} from './wall-routing.mjs?v=44';
import {buildRouteGeometry,pointSegmentDistance,segmentDistance} from './room-routing.mjs?v=44';
import {pipeModelFromPoints} from './wall-pipe-edit.mjs?v=44';
import {fitPipeLengths} from './linear-pipe-fit.mjs?v=44';

const EPS=1e-7,DEG=Math.PI/180;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const dist=(a,b)=>Math.hypot(...sub(a,b)),clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const finite=n=>typeof n==='number'&&Number.isFinite(n),copy=p=>p.map(v=>v.slice());
const failure=(code,error,extra={})=>({ok:false,code,error,...extra});
const noSolution=reasonCode=>failure('EDIT_NO_SOLUTION','Der blev ikke fundet en kontrolleret rørføring med det valgte mål. Prøv en mindre ændring.',{reasonCode});
const closest=(p,a,b)=>{const v=sub(b,a),t=clamp(dot(sub(p,a),v)/dot(v,v));return add(a,mul(v,t));};
const primitives=m=>[...m.straights.map((p,index)=>({p,index,arc:false})),...m.arcs.map((p,index)=>({p,index,arc:true}))];
const primitiveDistance=(q,a,b)=>q.arc?arcSegmentDistance(q.p,a,b):segmentDistance(q.p.start,q.p.end,a,b);

function arcPoint(arc,t) {
  const start=Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]);
  const angle=start+arc.turn*DEG*t;
  return add(arc.center,[arc.radius*Math.cos(angle),arc.radius*Math.sin(angle)]);
}
const primitivePoint=(q,t)=>q.arc?arcPoint(q.p,t):add(q.p.start,mul(sub(q.p.end,q.p.start),t));
function fractionAtAngle(arc,angle) {
  const start=Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]),sweep=arc.turn*DEG;
  const relative=(((angle-start)*Math.sign(sweep))%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
  return relative<=Math.abs(sweep)+1e-9?clamp(relative/Math.abs(sweep)):null;
}
// The critical fractions supplement the exact distance check with a linear
// supporting plane at its minimizer, including crossings between arc samples.
function nearestFraction(q,a,b) {
  const candidates=[0,1],v=sub(b,a),length=Math.hypot(...v),u=mul(v,1/length);
  if(q.arc) {
    const arc=q.p,ca=sub(a,arc.center),normal=[-u[1],u[0]];
    const angleCandidate=p=>{const t=fractionAtAngle(arc,Math.atan2(p[1]-arc.center[1],p[0]-arc.center[0]));if(t!==null)candidates.push(t);};
    angleCandidate(a);angleCandidate(b);
    for(const sign of [-1,1])angleCandidate(add(arc.center,mul(normal,sign*arc.radius)));
    const perpendicular=cross(u,ca),disc=arc.radius**2-perpendicular**2;
    if(disc>=-EPS)for(const root of [-Math.sqrt(Math.max(0,disc)),Math.sqrt(Math.max(0,disc))]) {
      const station=-dot(ca,u)+root;
      if(station>=-EPS&&station<=length+EPS)angleCandidate(add(add(arc.center,mul(normal,perpendicular)),mul(u,root)));
    }
  }else {
    const d=sub(q.p.end,q.p.start),denom=dot(d,d),det=cross(d,v);
    for(const p of [a,b])candidates.push(clamp(dot(sub(p,q.p.start),d)/denom));
    if(Math.abs(det)>1e-12) {
      const s=sub(a,q.p.start),t=cross(s,v)/det,z=cross(s,d)/det;
      if(t>=0&&t<=1&&z>=0&&z<=1)candidates.push(t);
    }
  }
  let best=Infinity,result=0;
  for(const t of candidates){const d=pointSegmentDistance(primitivePoint(q,t),a,b);if(d<best){best=d;result=t;}}
  return result;
}
function insidePolygon(p,polygon) {
  let sign=0;
  for(let j=0;j<polygon.length;j++) {
    const value=cross(sub(polygon[(j+1)%polygon.length],polygon[j]),sub(p,polygon[j]));
    if(Math.abs(value)<EPS)continue;
    if(sign&&Math.sign(value)!==sign)return false;sign=Math.sign(value);
  }
  return true;
}
function nearestPolygonPoint(p,polygon) {
  let best=null,distance=Infinity;
  for(let j=0;j<polygon.length;j++) {
    const q=closest(p,polygon[j],polygon[(j+1)%polygon.length]),d=dist(p,q);
    if(d<distance){best=q;distance=d;}
  }
  return best;
}

function headingsFor(model,turns,initialHeading=model.heading) {
  let heading=initialHeading;
  return model.lengths.map((_,i)=>{if(i)heading+=turns[i-1]*DEG;return [Math.cos(heading),Math.sin(heading)];});
}
function reconstruct(start,end,units,lengths) {
  const points=[start.slice()];
  for(let i=0;i<lengths.length;i++)points.push(add(points.at(-1),mul(units[i],lengths[i])));
  // Closure is solved to numerical precision before the exact anchors are
  // restored. Neither endpoint is moved using the validator's 0.25 mm slack.
  if(dist(points.at(-1),end)>1e-6)return null;
  points[points.length-1]=end.slice();return points;
}
function prefixRow(units,index,normal,fraction=0) {
  return units.map((u,j)=>j<index?dot(u,normal):j===index?fraction*dot(u,normal):0);
}
function buildFit(context,turns,heading) {
  const {source,edit,c,layout,clipLegs}=context,n=source.lengths.length,units=headingsFor(source,turns,heading);
  const setbacks=turns.map(t=>c.radius*Math.tan(Math.abs(t)*DEG/2));
  const lowerBounds=source.lengths.map((_,i)=>(setbacks[i-1]??0)+(setbacks[i]??0)+.0101);
  const delta=sub(source.points.at(-1),source.start),equalities=[{a:units.map(u=>u[0]),b:delta[0]},{a:units.map(u=>u[1]),b:delta[1]}],inequalities=[];
  if(edit.type==='length'){const a=Array(n).fill(0);a[edit.index]=1;equalities.push({a,b:edit.value});}
  for(const {clip,index} of clipLegs) {
    const wall=layout.segments[clip.segment],u=units[index];
    if(Math.abs(cross(u,wall.unit))>1e-8)return null;
    const normal=[-u[1],u[0]],relative=sub(clip.point,source.start);
    equalities.push({a:prefixRow(units,index,normal),b:dot(relative,normal)});
    const before=prefixRow(units,index,u),after=prefixRow(units,index+1,u);
    inequalities.push({a:before.map(x=>-x),b:-dot(relative,u)+(setbacks[index-1]??0)});
    inequalities.push({a:after,b:dot(relative,u)+(setbacks[index]??0)});
  }
  // Keep source baseline straights at their established standoff when their
  // direction survives this candidate. Raised bypasses remain free to move.
  const nominal=c.wallGap+c.diameter/2;
  for(let i=0;i<n;i++)for(const wall of layout.segments) {
    if(Math.abs(cross(units[i],wall.unit))>1e-8)continue;
    const straight=context.valid.straights[i];
    if(Math.abs(dot(sub(straight.start,wall.start),wall.normal)-nominal)>1e-6||Math.abs(dot(sub(straight.end,wall.start),wall.normal)-nominal)>1e-6)continue;
    if(Math.max(dot(sub(straight.start,wall.start),wall.unit),dot(sub(straight.end,wall.start),wall.unit))<0||Math.min(dot(sub(straight.start,wall.start),wall.unit),dot(sub(straight.end,wall.start),wall.unit))>wall.length)continue;
    equalities.push({a:prefixRow(units,i,wall.normal),b:dot(sub(source.points[i],source.start),wall.normal)});
  }
  const weights=source.lengths.map((_,i)=>1+15*Math.min(1,(Math.abs(i-edit.index)/8)**2));
  return {initial:source.lengths,weights,lowerBounds,equalities,inequalities,units,setbacks,maxIterations:n>80?400:1200};
}

function geometryConfig(c,layout) {
  const extents=layout.points.flat().map(Math.abs);
  const width=Math.max(1,...extents,c.wallGap,...[c.start,c.end,...c.clips].map(a=>a.gap??0),...c.obstacles.map(o=>o.depth))+c.radius+1;
  return {...c,width,height:width};
}
function clearanceSetup(context) {
  const {layout,c,geometry}=context,original=primitives(context.valid),nominal=c.wallGap+c.diameter/2;
  const walls=layout.segments.map(w=>({...w,nominal}));
  if(!layout.closed) {
    const first=layout.segments[0],last=layout.segments.at(-1),reach=16*geometry.width;
    walls.push({start:sub(first.start,mul(first.unit,reach)),end:first.start,nominal:c.diameter/2},
      {start:last.end,end:add(last.end,mul(last.unit,reach)),nominal:c.diameter/2});
  }
  return {original,walls,targets:original.map(q=>walls.map(w=>Math.min(w.nominal,primitiveDistance(q,w.start,w.end))))};
}
function affinePlane(q,t,normal,bound,lengths,fit) {
  const point=primitivePoint(q,t),index=q.index;
  const a=prefixRow(fit.units,q.arc?index+1:index,normal,q.arc?0:t);
  let constant=dot(point,normal);for(let i=0;i<a.length;i++)constant-=a[i]*lengths[i];
  return {a,b:bound-constant};
}
function checkClearance(context,model,lengths,fit,addConstraints) {
  const {original,walls,targets}=context.clearance,now=primitives(model),rows=[];
  let violation=false,reasonCode;
  const plane=(q,q0,t,nearest,target)=>{
    if(!addConstraints)return;
    const p0=primitivePoint(q0,t),normalVector=sub(p0,nearest),distance=Math.hypot(...normalVector);
    if(distance<1e-9)return;
    const normal=mul(normalVector,1/distance);
    rows.push(affinePlane(q,t,normal,dot(nearest,normal)+target,lengths,fit));
  };
  for(let k=0;k<now.length;k++) {
    const q=now[k],q0=original[k];
    for(let j=0;j<walls.length;j++) {
      const w=walls[j],target=targets[k][j];
      if(primitiveDistance(q,w.start,w.end)>=target-EPS)continue;
      violation=true;reasonCode='WALL_GAP';
      const t=nearestFraction(q,w.start,w.end),p0=primitivePoint(q0,t);
      plane(q,q0,t,closest(p0,w.start,w.end),target);
    }
    for(const obstacle of context.valid.obstaclePolygons) {
      const polygon=obstacle.points,target=context.c.diameter/2+context.c.clearance;
      let best=Infinity,t=0;
      if(insidePolygon(primitivePoint(q,0),polygon))best=0;
      else for(let j=0;j<4;j++) {
        const a=polygon[j],b=polygon[(j+1)%4],d=primitiveDistance(q,a,b);
        if(d<best){best=d;t=nearestFraction(q,a,b);}
      }
      if(best>=target-EPS)continue;
      violation=true;reasonCode='OBSTACLE_COLLISION';
      const p0=primitivePoint(q0,t);plane(q,q0,t,nearestPolygonPoint(p0,polygon),target);
    }
    if(rows.length>=80)break;
  }
  return {ok:!violation,rows,reasonCode};
}

function adjustmentSummary(before,after,edit) {
  const lengths=[],turns=[];
  before.lengths.forEach((from,index)=>{const to=after.lengths[index];if(Math.abs(to-from)>1e-6)lengths.push({index,from,to});});
  before.turns.forEach((from,index)=>{const to=after.turns[index];if(Math.abs(to-from)>1e-7)turns.push({index,from,to});});
  return {lengths,turns};
}
function accepted(context,model) {
  const {source,edit,c}=context;
  if(model.points.length!==source.points.length||model.lengths.length!==source.lengths.length||model.turns.length!==source.turns.length)return null;
  const target=edit.type==='length'?model.lengths[edit.index]:model.turns[edit.index];
  if(Math.abs(target-edit.value)>(edit.type==='length'?1e-6:1e-7))return null;
  const checked=validateWallRoute(c,model.points);if(!checked.ok)return null;
  if(checked.points.length!==source.points.length)return null;
  const finalTarget=edit.type==='length'?checked.lengths[edit.index]:checked.turns[edit.index];
  if(Math.abs(finalTarget-edit.value)>(edit.type==='length'?1e-6:1e-7))return null;
  return {...checked,points:copy(model.points),adjustments:adjustmentSummary(source,checked,edit),edited:{...edit}};
}

function angleCandidates(context) {
  const {source,edit,c}=context,candidates=[],seen=new Set(),n=source.lengths.length;
  const push=(turns,heading=source.heading)=>{
    if(turns.some(t=>!finite(t)||Math.abs(t)<1e-5||Math.abs(t)>c.maxAngle+1e-7||Math.abs(t)>=179))return;
    const key=heading.toFixed(10)+':'+turns.map(t=>t.toFixed(8)).join(',');if(seen.has(key))return;seen.add(key);candidates.push({turns,heading});
  };
  const aligned=turns=>{
    push(turns);
    for(const {index} of context.clipLegs) {
      const original=source.heading+source.turns.slice(0,index).reduce((sum,t)=>sum+t,0)*DEG;
      push(turns,original-turns.slice(0,index).reduce((sum,t)=>sum+t,0)*DEG);
    }
    const units=headingsFor(source,turns),sum=units.reduce((p,u,i)=>add(p,mul(u,source.lengths[i])),[0,0]),end=sub(source.points.at(-1),source.start);
    if(Math.hypot(...sum)>1e-7)push(turns,source.heading+Math.atan2(cross(sum,end),dot(sum,end)));
  };
  if(edit.type==='turn') {
    const base=source.turns.slice(),delta=edit.value-base[edit.index];base[edit.index]=edit.value;aligned(base);
    const other=base.map((_,i)=>i).filter(i=>i!==edit.index).sort((a,b)=>Math.abs(a-edit.index)-Math.abs(b-edit.index));
    for(const index of other){const turns=base.slice();turns[index]-=delta;aligned(turns);}
  }else {
    push(source.turns.slice());
    // An exact one-hinge/two-length construction supplies useful angle
    // variants when fixed headings alone have no endpoint-closing solution.
    const lengths=source.lengths.slice();lengths[edit.index]=edit.value;
    const units=headingsFor(source,source.turns),points=[source.start.slice()];
    for(let i=0;i<n;i++)points.push(add(points.at(-1),mul(units[i],lengths[i])));
    const hinges=source.turns.map((_,i)=>i).sort((a,b)=>Math.abs(a-edit.index)-Math.abs(b-edit.index));
    const free=lengths.map((_,i)=>i).filter(i=>i!==edit.index).sort((a,b)=>Math.abs(a-edit.index)-Math.abs(b-edit.index));
    // If no clip fixes the first direction, rotating the whole candidate can
    // preserve all bend angles. Solve one remaining length against |B-A|,
    // then align the complete vector with the fixed endpoint displacement.
    const sum=sub(points.at(-1),source.start),end=sub(source.points.at(-1),source.start);
    for(const index of free.slice(0,n>40?8:32)) {
      const u=units[index],linear=dot(sum,u),disc=linear**2+dot(end,end)-dot(sum,sum);
      if(disc<-EPS)continue;
      for(const change of [-linear+Math.sqrt(Math.max(0,disc)),-linear-Math.sqrt(Math.max(0,disc))]) {
        if(lengths[index]+change<=.01)continue;
        const vector=add(sum,mul(u,change));
        push(source.turns.slice(),source.heading+Math.atan2(cross(vector,end),dot(vector,end)));
      }
    }
    let combinations=0;
    outer:for(const hinge of hinges)for(const index of free) {
      if(++combinations>(n>40?24:96))break outer;
      const pivot=points[hinge+1],r=sub(points.at(-1),pivot),d=sub(source.points.at(-1),pivot),u=units[index];
      const base=index>hinge?r:d,desired=index>hinge?Math.hypot(...d):Math.hypot(...r);
      const linear=dot(base,u)*(index>hinge?1:-1),disc=linear**2+desired**2-dot(base,base);
      if(disc<-EPS)continue;
      const roots=[-linear+Math.sqrt(Math.max(0,disc)),-linear-Math.sqrt(Math.max(0,disc))].sort((a,b)=>Math.abs(a)-Math.abs(b));
      for(const change of roots) {
        if(lengths[index]+change<=.01)continue;
        const from=index>hinge?add(r,mul(u,change)):r,to=index>hinge?d:sub(d,mul(u,change));
        const delta=Math.atan2(cross(from,to),dot(from,to))/DEG,turns=source.turns.slice();turns[hinge]+=delta;push(turns);
      }
    }
    // Repeat the analytic constructions from B. A clip near B may fix the
    // final direction while the first direction must be free to rotate.
    if(!context.reversed) {
      const reverseSource=pipeModelFromPoints(copy(source.points).reverse());
      const reverseEdit={...edit,index:n-1-edit.index};
      for(const candidate of angleCandidates({...context,source:reverseSource,edit:reverseEdit,reversed:true})) {
        const turns=candidate.turns.slice().reverse().map(t=>-t);
        const heading=candidate.heading+candidate.turns.reduce((sum,t)=>sum+t,0)*DEG+Math.PI;
        push(turns,Math.atan2(Math.sin(heading),Math.cos(heading)));
      }
    }
  }
  return candidates;
}

/** Fit a selected vertex length or signed turn without moving A, B or walls. */
export function solveWallPipeEdit(config,points,edit) {
  const source=pipeModelFromPoints(points);if(!source.ok)return source;
  if(!edit||!['length','turn'].includes(edit.type)||!Number.isInteger(edit.index)||edit.index<0||edit.index>=(edit.type==='length'?source.lengths.length:source.turns.length))return failure('INVALID_EDIT','Vælg et gyldigt rørstykke eller buk.');
  if(!finite(edit.value)||edit.type==='length'&&(edit.value<=0||edit.value>1e8)||edit.type==='turn'&&Math.abs(edit.value)>=179)return failure('INVALID_INPUT','Indtast et gyldigt mål eller en gyldig bukkevinkel.');
  const valid=validateWallRoute(config,points);if(!valid.ok)return valid;
  if(valid.points.length!==points.length)return failure('INVALID_POINTS','Fjern overflødige punkter, før rørstykket redigeres.');
  const c={...config,wallGap:config.wallGap??50,clearance:config.clearance??10,maxAngle:config.maxAngle??90,clips:config.clips??[],obstacles:config.obstacles??[]};
  const layout=wallLayout(c),clipLegs=[];
  for(const clip of valid.clipPoints) {
    const wall=layout.segments[clip.segment];
    const index=valid.straights.findIndex(s=>Math.abs(cross(sub(s.end,s.start),wall.unit))<=EPS*Math.max(1,s.length)&&pointSegmentDistance(clip.point,s.start,s.end)<=.25);
    if(index<0)return noSolution('MISSED_CLIP');clipLegs.push({clip,index});
  }
  const context={source,edit:{type:edit.type,index:edit.index,value:edit.value},c,valid,layout,clipLegs,geometry:geometryConfig(c,layout)};
  context.clearance=clearanceSetup(context);
  if(edit.value===(edit.type==='length'?source.lengths[edit.index]:source.turns[edit.index]))return {...valid,points:copy(points),adjustments:{lengths:[],turns:[]},edited:{...context.edit}};
  if(edit.type==='turn'&&Math.abs(edit.value)<1e-5)return noSolution('EDIT_TOPOLOGY');
  if(edit.type==='turn'&&Math.abs(edit.value)>c.maxAngle+1e-7)return noSolution('MAX_ANGLE');
  const started=Date.now(),large=source.lengths.length>80,maxFits=large?16:96;
  let fits=0,reason='EDIT_CONSTRAINTS';
  for(const {turns,heading} of angleCandidates(context)) {
    if(Date.now()-started>450||fits>=maxFits)break;
    const fit=buildFit(context,turns,heading);if(!fit)continue;
    for(let pass=0;pass<(large?5:10);pass++) {
      if(++fits>maxFits||Date.now()-started>450)break;
      let fitted=fitPipeLengths(fit);
      if(!fitted.ok)fitted=fitPipeLengths({...fit,weights:fit.weights.map(()=>1)});
      if(!fitted.ok){reason=fitted.code;break;}
      const next=reconstruct(source.start,source.points.at(-1),fit.units,fitted.values);if(!next){reason='ENDPOINT_MISMATCH';break;}
      const model=buildRouteGeometry(context.geometry,next);
      if(!model.ok||model.points.length!==points.length){reason=model.code??'EDIT_TOPOLOGY';break;}
      const clearance=checkClearance(context,model,fitted.values,fit,true);
      if(clearance.ok) {
        const result=accepted(context,model);if(result)return result;
        reason=validateWallRoute(c,next).code??'EDIT_TARGET';break;
      }
      reason=clearance.reasonCode;
      if(!clearance.rows.length)break;
      fit.inequalities.push(...clearance.rows);
    }
  }
  return noSolution(reason);
}
