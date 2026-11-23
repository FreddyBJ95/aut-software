// World-unit geometry for an enlarged pipe/wall detail. Dimensions are taken
// from the actual tangent straights/arcs and finite wall faces, never settings.
const EPS=1e-8,DEG=Math.PI/180,TAU=2*Math.PI;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(finite);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const distance=(a,b)=>Math.hypot(...sub(a,b)),clamp=t=>Math.max(0,Math.min(1,t));
const closest=(p,a,b)=>{const v=sub(b,a),t=clamp(dot(sub(p,a),v)/dot(v,v));return add(a,mul(v,t));};
const straightOK=s=>s&&point(s.start)&&point(s.end)&&distance(s.start,s.end)>EPS;
function arcData(arc) {
  if(!arc||!point(arc.center)||!finite(arc.radius)||arc.radius<=0||!finite(arc.turn)||!arc.turn||Math.abs(arc.turn)>360)return null;
  const start=arc.start??arc.samples?.[0],end=arc.end??arc.samples?.at(-1);
  if(!point(start)||!point(end))return null;
  return {start,end,angle:Math.atan2(start[1]-arc.center[1],start[0]-arc.center[0]),sweep:arc.turn*DEG};
}
function arcPoint(arc,data,t) {
  if(t===0)return data.start.slice();if(t===1)return data.end.slice();
  const angle=data.angle+data.sweep*t;
  return add(arc.center,[arc.radius*Math.cos(angle),arc.radius*Math.sin(angle)]);
}
function arcFraction(data,angle) {
  const relative=(((angle-data.angle)*Math.sign(data.sweep))%TAU+TAU)%TAU;
  return relative<=Math.abs(data.sweep)+EPS?clamp(relative/Math.abs(data.sweep)):null;
}

/**
 * True circular SVG centerline path. mapPoint must be a uniform similarity;
 * scale is its absolute scale and flipY reports a reflection of orientation.
 * A single selected primitive can use {straights:[s],arcs:[]} or its inverse.
 */
export function geometryToSvgPath(geometry,{mapPoint=p=>p,scale=1,flipY=false}={}) {
  if(!geometry||!Array.isArray(geometry.straights??[])||!Array.isArray(geometry.arcs??[])||typeof mapPoint!=='function'||!finite(scale)||scale<=0)return '';
  const straights=geometry.straights??[],arcs=geometry.arcs??[],parts=[];
  let cursor=null;
  const mapped=p=>{const result=mapPoint(p);if(!point(result))throw new TypeError('Invalid mapped point');return result;};
  const move=p=>{if(!cursor||distance(cursor,p)>EPS){const m=mapped(p);parts.push(`M ${m[0]} ${m[1]}`);}cursor=p;};
  const line=s=>{if(!straightOK(s))throw new TypeError('Invalid straight');move(s.start);const end=mapped(s.end);parts.push(`L ${end[0]} ${end[1]}`);cursor=s.end;};
  const curve=arc=>{
    const data=arcData(arc);if(!data)throw new TypeError('Invalid arc');move(data.start);
    const end=mapped(data.end),radius=arc.radius*scale,sweep=(arc.turn>0)!==!!flipY?1:0;
    // A complete circle needs two SVG arcs because equal endpoints otherwise
    // describe an empty path. Normal app bends are all smaller than 179°.
    if(Math.abs(arc.turn)===360) {
      const middle=mapped(arcPoint(arc,data,.5));parts.push(`A ${radius} ${radius} 0 0 ${sweep} ${middle[0]} ${middle[1]}`);
      parts.push(`A ${radius} ${radius} 0 0 ${sweep} ${end[0]} ${end[1]}`);
    }else parts.push(`A ${radius} ${radius} 0 ${Math.abs(arc.turn)>180?1:0} ${sweep} ${end[0]} ${end[1]}`);
    cursor=data.end;
  };
  try {
    for(let i=0;i<straights.length;i++){line(straights[i]);if(arcs[i])curve(arcs[i]);}
    for(let i=straights.length;i<arcs.length;i++)curve(arcs[i]);
    return parts.join(' ');
  }catch{return '';}
}

function closestStraightPair(straight,wall) {
  const a=straight.start,b=straight.end,c=wall.start,d=wall.end;
  const u=sub(b,a),v=sub(d,c),wallLength=Math.hypot(...v),unit=mul(v,1/wallLength),det=cross(u,v);
  // Mid-face placement on parallel runs makes a dimension easy to read and
  // avoids inventing an extension beyond a short measured wall face.
  if(Math.abs(det)<=EPS*Math.hypot(...u)*wallLength) {
    const sa=dot(sub(a,c),unit),sb=dot(sub(b,c),unit),lo=Math.max(0,Math.min(sa,sb)),hi=Math.min(wallLength,Math.max(sa,sb));
    if(hi>=lo-EPS) {
      const station=(lo+hi)/2,t=clamp((station-sa)/(sb-sa));
      return {centerPoint:add(a,mul(u,t)),wallPoint:add(c,mul(unit,station)),fraction:t,onFace:true};
    }
  }else {
    const ac=sub(c,a),t=cross(ac,v)/det,s=cross(ac,u)/det;
    if(t>=0&&t<=1&&s>=0&&s<=1){const p=add(a,mul(u,t));return {centerPoint:p,wallPoint:p.slice(),fraction:t,onFace:true};}
  }
  const candidates=[
    {centerPoint:a.slice(),wallPoint:closest(a,c,d),fraction:0},
    {centerPoint:b.slice(),wallPoint:closest(b,c,d),fraction:1},
    ...[c,d].map(wallPoint=>{const centerPoint=closest(wallPoint,a,b);return {centerPoint,wallPoint:wallPoint.slice(),fraction:clamp(dot(sub(centerPoint,a),u)/dot(u,u))};}),
  ];
  candidates.sort((p,q)=>distance(p.centerPoint,p.wallPoint)-distance(q.centerPoint,q.wallPoint));
  const result=candidates[0],station=dot(sub(result.wallPoint,c),unit);
  return {...result,onFace:station>EPS&&station<wallLength-EPS};
}

function closestArcPair(arc,wall) {
  const data=arcData(arc),a=wall.start,b=wall.end,v=sub(b,a),length=Math.hypot(...v),unit=mul(v,1/length),normal=[-unit[1],unit[0]],fractions=[0,1];
  const addAngle=p=>{const t=arcFraction(data,Math.atan2(p[1]-arc.center[1],p[0]-arc.center[0]));if(t!==null)fractions.push(t);};
  addAngle(a);addAngle(b);
  for(const sign of [-1,1])addAngle(add(arc.center,mul(normal,sign*arc.radius)));
  // Circle-relative intersection avoids catastrophic cancellation on a long
  // finite face. The same critical cases cover interior and endpoint minima.
  const ca=sub(a,arc.center),perpendicular=cross(unit,ca),disc=arc.radius**2-perpendicular**2;
  if(disc>=-EPS)for(const root of [-Math.sqrt(Math.max(0,disc)),Math.sqrt(Math.max(0,disc))]) {
    const station=-dot(ca,unit)+root;
    if(station>=-EPS&&station<=length+EPS)addAngle(add(add(arc.center,mul(normal,perpendicular)),mul(unit,root)));
  }
  let best=null,bestDistance=Infinity;
  for(const fraction of fractions) {
    const centerPoint=arcPoint(arc,data,fraction),wallPoint=closest(centerPoint,a,b),d=distance(centerPoint,wallPoint);
    if(d<bestDistance){bestDistance=d;const station=dot(sub(wallPoint,a),unit);best={centerPoint,wallPoint,fraction,onFace:station>EPS&&station<length-EPS};}
  }
  return best;
}

/**
 * Closest actual OD-to-finite-wall dimension for each selected primitive.
 * selected is {type:'length'|'turn',index}; omit it for every straight and arc.
 * Positive gap means free space on the wall's chosen pipe side. A negative
 * gap marks overlap or a wrong-side pipe; physicalGap remains unsigned-side
 * center distance minus OD/2. normal/outsidePoint use the signed side axis.
 */
export function getWallClearanceDimensions({geometry,wallSegments,diameter,selected}={}) {
  if(!geometry||!Array.isArray(wallSegments)||!finite(diameter)||diameter<=0||!Array.isArray(geometry.straights??[])||!Array.isArray(geometry.arcs??[]))return [];
  if(selected&&(!['length','turn'].includes(selected.type)||!Number.isInteger(selected.index)||selected.index<0))return [];
  const walls=wallSegments.map((wall,index)=>{
    if(!straightOK(wall))return null;
    const vector=sub(wall.end,wall.start),length=Math.hypot(...vector),unit=mul(vector,1/length);
    let normal=wall.normal;
    if(!point(normal)||Math.hypot(...normal)<EPS)normal=[-unit[1],unit[0]];
    else normal=mul(normal,1/Math.hypot(...normal));
    return {...wall,index:wall.index??index,unit,normal,length};
  }).filter(Boolean);
  const entries=[...(geometry.straights??[]).map((p,index)=>({p,index,type:'length'})),...(geometry.arcs??[]).map((p,index)=>({p,index,type:'turn'}))];
  const dimensions=[];
  for(const entry of entries) {
    if(selected&&(entry.type!==selected.type||entry.index!==selected.index))continue;
    if(entry.type==='length'?!straightOK(entry.p):!arcData(entry.p))continue;
    let best=null,bestDistance=Infinity;
    for(const wall of walls) {
      const pair=entry.type==='length'?closestStraightPair(entry.p,wall):closestArcPair(entry.p,wall);
      const vector=sub(pair.centerPoint,pair.wallPoint),centerDistance=Math.hypot(...vector);
      if(centerDistance>=bestDistance-EPS)continue;
      const wrongSide=dot(sub(pair.centerPoint,wall.start),wall.normal)<-EPS,sign=wrongSide?-1:1;
      const normal=centerDistance>EPS?mul(vector,sign/centerDistance):wall.normal.slice();
      const outsidePoint=sub(pair.centerPoint,mul(normal,diameter/2));
      bestDistance=centerDistance;
      best={type:entry.type,index:entry.index,primitiveIndex:entry.index,wallIndex:wall.index,wallId:wall.id,
        centerPoint:pair.centerPoint,wallPoint:pair.wallPoint,outsidePoint,normal,fraction:pair.fraction,onFace:pair.onFace,
        centerDistance,signedCenterDistance:sign*centerDistance,physicalGap:centerDistance-diameter/2,
        gap:sign*centerDistance-diameter/2,wrongSide};
    }
    if(best)dimensions.push(best);
  }
  return dimensions;
}
