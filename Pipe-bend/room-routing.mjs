// Deterministic, perimeter-following room proposals. All distances are millimetres.
// The returned vertices are theoretical centreline corners. The actual route
// always includes the requested constant-radius fillets before it is accepted.
const EPS = 1e-7;
const ARC_ERROR = 0.05;
const CLIP_TOLERANCE = 0.25;
const MAX_PATH_POINTS = 12000;
const MAX_SWEEP_PAIRS = 2000000;
const WALLS = ['bottom', 'right', 'top', 'left'];
const add = (a,b) => [a[0]+b[0],a[1]+b[1]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
const mul = (a,k) => [a[0]*k,a[1]*k];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const left = a => [-a[1],a[0]];
const radians = n => n*Math.PI/180;
const degrees = n => n*180/Math.PI;
const finite = n => typeof n==='number'&&Number.isFinite(n);
const fail = (error,code='NO_ROUTE') => ({ok:false,error,code});

export function pointOnRoomWall(config,anchor,gap=anchor.gap??config.wallGap) {
  const offset=Number(gap)+Number(config.diameter)/2, p=Number(anchor.position);
  switch(anchor.wall) {
    case 'bottom':return [p,offset];
    case 'right':return [Number(config.width)-offset,p];
    case 'top':return [p,Number(config.height)-offset];
    case 'left':return [offset,p];
    default:throw new RangeError('Ukendt væg.');
  }
}

export function roomObstacleRect(config,obstacle) {
  const p=Number(obstacle.position), w=Number(obstacle.width), d=Number(obstacle.depth);
  switch(obstacle.wall) {
    case 'bottom':return {x:p,y:0,width:w,height:d};
    case 'right':return {x:Number(config.width)-d,y:p,width:d,height:w};
    case 'top':return {x:p,y:Number(config.height)-d,width:w,height:d};
    case 'left':return {x:0,y:p,width:d,height:w};
    default:throw new RangeError('Ukendt væg.');
  }
}

function wallLength(c,wall) {return wall==='bottom'||wall==='top'?c.width:c.height;}
function wallDepth(c,wall) {return wall==='bottom'||wall==='top'?c.height:c.width;}
function fromLocal(c,wall,s,d) {
  switch(wall) {
    case 'bottom':return [s,d];
    case 'right':return [c.width-d,s];
    case 'top':return [c.width-s,c.height-d];
    case 'left':return [d,c.height-s];
  }
}
function toLocal(c,wall,p) {
  switch(wall) {
    case 'bottom':return [p[0],p[1]];
    case 'right':return [p[1],c.width-p[0]];
    case 'top':return [c.width-p[0],c.height-p[1]];
    case 'left':return [c.height-p[1],p[0]];
  }
}
function expandRect(r,d) {return {x:r.x-d,y:r.y-d,width:r.width+2*d,height:r.height+2*d};}
function insideRect(p,r) {return p[0]>r.x+EPS&&p[0]<r.x+r.width-EPS&&p[1]>r.y+EPS&&p[1]<r.y+r.height-EPS;}

function normalizedConfig(raw) {
  if(!raw||typeof raw!=='object')return fail('Angiv rummets mål.','INVALID_INPUT');
  const c={...raw,wallGap:raw.wallGap??50,clearance:raw.clearance??10,maxAngle:raw.maxAngle??90,
    direction:raw.direction??'auto',clips:raw.clips??[],obstacles:raw.obstacles??[]};
  for(const key of ['width','height','diameter','radius','wallGap','clearance','maxAngle']) {
    if(!finite(c[key]))return fail('Alle mål og vinkler skal være endelige tal.','INVALID_INPUT');
  }
  if(c.width<=0||c.height<=0||c.width>1e7||c.height>1e7||c.diameter<=0||c.radius<=c.diameter/2||c.radius>1e5||c.wallGap<0||c.clearance<0||c.maxAngle<=0||c.maxAngle>=180) {
    return fail('Kontrollér rummets mål, diameter, bukkeradius, vægafstand og maksimal vinkel.','INVALID_INPUT');
  }
  if(!['auto','clockwise','counterclockwise'].includes(c.direction))return fail('Vælg en gyldig retning langs væggene.','INVALID_INPUT');
  if(!Array.isArray(c.clips)||!Array.isArray(c.obstacles)||c.clips.length>100||c.obstacles.length>40)return fail('Der kan bruges op til 100 klammer og 40 forhindringer.','INVALID_INPUT');
  function anchor(a,isClip=false) {
    if(!a||!WALLS.includes(a.wall)||!finite(a.position)||a.position<0||a.position>wallLength(c,a.wall))return false;
    if(a.gap!==undefined&&(!finite(a.gap)||a.gap<0))return false;
    const p=pointOnRoomWall(c,a);
    if(p[0]<c.diameter/2-EPS||p[0]>c.width-c.diameter/2+EPS||p[1]<c.diameter/2-EPS||p[1]>c.height-c.diameter/2+EPS)return false;
    return !isClip||!a.id||typeof a.id==='string';
  }
  if(!anchor(c.start)||!anchor(c.end))return fail('Start og slut skal ligge inden for væggene med plads til røret.','INVALID_ENDPOINT');
  if(c.clips.some(a=>!anchor(a,true)))return fail('En klamme ligger uden for rummet eller har en ugyldig vægafstand.','INVALID_CLIP');
  for(const o of c.obstacles) {
    if(!o||!WALLS.includes(o.wall)||!['position','width','depth'].every(k=>finite(o[k]))||o.position<0||o.width<=0||o.depth<=0||o.position+o.width>wallLength(c,o.wall)+EPS||o.depth>wallDepth(c,o.wall)+EPS) {
      return fail('En forhindring har ugyldige mål eller ligger uden for sin væg.','INVALID_OBSTACLE');
    }
  }
  c.startPoint=pointOnRoomWall(c,c.start);
  c.endPoint=pointOnRoomWall(c,c.end);
  if(distance(c.startPoint,c.endPoint)<EPS)return fail('Start og slut skal være forskellige punkter.','IDENTICAL_ENDPOINTS');
  c.clipPoints=c.clips.map((a,index)=>({...a,id:a.id||`K${index+1}`,point:pointOnRoomWall(c,a)}));
  c.obstacleRects=c.obstacles.map((o,index)=>({...roomObstacleRect(c,o),id:o.id||`F${index+1}`,wall:o.wall}));
  const clearance=c.diameter/2+c.clearance;
  for(const a of [{id:'Start',point:c.startPoint},{id:'Slut',point:c.endPoint},...c.clipPoints]) {
    if(c.obstacleRects.some(r=>insideRect(a.point,expandRect(r,clearance))))return fail(`${a.id} ligger for tæt på en forhindring. Flyt punktet eller øg vægafstanden.`,'BLOCKED_ANCHOR');
  }
  return {ok:true,config:c};
}

function pointSegmentDistance(p,a,b) {
  const d=sub(b,a),denom=dot(d,d);
  const t=denom>EPS?Math.max(0,Math.min(1,dot(sub(p,a),d)/denom)):0;
  return distance(p,add(a,mul(d,t)));
}

function segmentHitsRect(a,b,r) {
  // Liang–Barsky clipping against an open rectangle. Its strict interior is
  // blocked; ARC_ERROR added by the caller covers the arc/chord deviation.
  const inset=EPS;
  const x0=r.x+inset,x1=r.x+r.width-inset,y0=r.y+inset,y1=r.y+r.height-inset;
  const dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1;
  for(const [p,q] of [[-dx,a[0]-x0],[dx,x1-a[0]],[-dy,a[1]-y0],[dy,y1-a[1]]]) {
    if(Math.abs(p)<EPS){if(q<0)return false;continue;}
    const t=q/p;
    if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    if(lo>hi)return false;
  }
  return hi>=0&&lo<=1;
}

function cleanPoints(raw) {
  if(!Array.isArray(raw)||raw.length<2||raw.length>400||raw.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))return null;
  const points=[];
  for(const point of raw) {
    const p=[...point];
    if(points.length&&distance(points.at(-1),p)<EPS)continue;
    points.push(p);
    while(points.length>=3) {
      const [a,b,d]=points.slice(-3),u=sub(b,a),v=sub(d,b);
      if(Math.abs(cross(u,v))>EPS*Math.max(1,distance(a,b)*distance(b,d))||dot(u,v)<=0)break;
      points.splice(-2,1);
    }
  }
  return points.length>=2?points:null;
}

function filletModel(c,rawPoints) {
  const coordinateLimit=4*Math.max(c.width,c.height,c.radius);
  if(Array.isArray(rawPoints)&&rawPoints.some(p=>Array.isArray(p)&&p.some(n=>finite(n)&&Math.abs(n)>coordinateLimit)))return fail('Et hjørne ligger for langt uden for rummet. Kontrollér koordinaterne.','INVALID_POINTS');
  const points=cleanPoints(rawPoints);
  if(!points)return fail('Rørføringen skal bestå af mindst to gyldige punkter.','INVALID_POINTS');
  if(points.length>201)return fail('Forslaget kræver flere end 200 lige stykker. Brug større bukkevinkler.','TOO_MANY_BENDS');
  const lengths=[],units=[],turns=[],setbacks=[];
  for(let i=0;i<points.length-1;i++) {
    const length=distance(points[i],points[i+1]);
    if(!Number.isFinite(length))return fail('Et hjørne har ugyldige koordinater.','INVALID_POINTS');
    if(length<=EPS)return fail('To hjørner ligger i samme punkt.','ZERO_LENGTH');
    lengths.push(length);units.push(mul(sub(points[i+1],points[i]),1/length));
  }
  for(let i=1;i<points.length-1;i++) {
    const angle=Math.atan2(cross(units[i-1],units[i]),dot(units[i-1],units[i]));
    const measured=degrees(angle),integer=Math.round(measured);
    const value=Math.abs(measured-integer)<1e-8?integer:measured;
    if(Math.abs(value)>=179)return fail('Rørføringen vender direkte tilbage i et hjørne.','REVERSAL');
    if(Math.abs(value)>c.maxAngle+1e-6)return fail(`Et buk på ${Math.abs(value).toFixed(1)}° overstiger den maksimale vinkel på ${c.maxAngle}°.`,'MAX_ANGLE');
    turns.push(value);setbacks.push(c.radius*Math.tan(Math.abs(angle)/2));
  }
  const tangentLengths=lengths.map((length,i)=>length-(i?setbacks[i-1]:0)-(i<setbacks.length?setbacks[i]:0));
  if(tangentLengths.some(n=>n<=0.01))return fail('Der er ikke plads til bukkeradius mellem hjørnerne. Flyt punkterne eller brug en mindre radius.','INSUFFICIENT_STRAIGHT');
  const pathPoints=[[...points[0]]],straights=[],arcs=[];
  let cursor=[...points[0]],geometricLength=0;
  for(let i=0;i<lengths.length;i++) {
    const end=i<turns.length?sub(points[i+1],mul(units[i],setbacks[i])):[...points[i+1]];
    straights.push({start:[...cursor],end:[...end],length:tangentLengths[i]});
    pathPoints.push(end);geometricLength+=tangentLengths[i];
    cursor=end;
    if(i>=turns.length)continue;
    const theta=radians(turns[i]),sign=Math.sign(theta),h=Math.atan2(units[i][1],units[i][0]);
    const center=add(end,mul(left(units[i]),sign*c.radius));
    const maxStep=Math.min(Math.PI/90,2*Math.acos(Math.max(-1,1-ARC_ERROR/c.radius)));
    const count=Math.max(2,Math.ceil(Math.abs(theta)/maxStep));
    if(pathPoints.length+count+8>MAX_PATH_POINTS)return fail('Rørføringen er for omfattende til at kontrollere her. Brug færre hjørner eller en mindre radius.','TOO_COMPLEX');
    const fractions=Array.from({length:count+1},(_,j)=>j/count);
    // Cardinal extrema make the room-boundary check exact, independent of the
    // sampling resolution used for obstacle clearance.
    for(let k=-8;k<=8;k++) {
      const t=(k*Math.PI/2-h)/theta;
      if(t>EPS&&t<1-EPS)fractions.push(t);
    }
    fractions.sort((a,b)=>a-b);
    const samples=[];
    for(const t of fractions) {
      const heading=h+theta*t;
      const p=[center[0]+sign*c.radius*Math.sin(heading),center[1]-sign*c.radius*Math.cos(heading)];
      if(!samples.length||distance(samples.at(-1),p)>EPS)samples.push(p);
    }
    pathPoints.push(...samples.slice(1));cursor=samples.at(-1);
    arcs.push({center,turn:turns[i],radius:c.radius,samples});
    geometricLength+=Math.abs(theta)*c.radius;
  }
  return {ok:true,points,lengths,tangentLengths,turns,pathPoints,straights,arcs,geometricLength,
    start:[...points[0]],heading:Math.atan2(units[0][1],units[0][0])};
}

function segmentDistance(a,b,c,d) {
  const ab=sub(b,a),cd=sub(d,c),det=cross(ab,cd);
  if(Math.abs(det)>EPS) {
    const ac=sub(c,a),t=cross(ac,cd)/det,u=cross(ac,ab)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1)return 0;
  }
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}

function separatedSegmentDistance(a,b,separation) {
  // Minimise distance over the portions whose stations differ by at least the
  // locality exclusion. A long segment must never be discarded just because
  // its endpoint is close in station to the next arc.
  if(b.end-a.start<separation-EPS)return Infinity;
  if(b.start-a.end>=separation-EPS)return segmentDistance(a.a,a.b,b.a,b.b);
  const av=sub(a.b,a.a),bv=sub(b.b,b.a),al=a.end-a.start,bl=b.end-b.start;
  const stationDelta=b.start-a.start;
  let best=Infinity;
  const consider=(t,u)=> {
    if(t< -EPS||t>1+EPS||u< -EPS||u>1+EPS||stationDelta+u*bl-t*al<separation-EPS)return;
    best=Math.min(best,distance(add(a.a,mul(av,t)),add(b.a,mul(bv,u))));
  };
  for(const t of [0,1]) {
    const minimum=Math.max(0,(separation-stationDelta+t*al)/bl);
    if(minimum>1+EPS)continue;
    const p=add(a.a,mul(av,t));
    consider(t,Math.max(minimum,Math.min(1,dot(sub(p,b.a),bv)/(bl*bl))));
  }
  for(const u of [0,1]) {
    const maximum=Math.min(1,(stationDelta+u*bl-separation)/al);
    if(maximum< -EPS)continue;
    const p=add(b.a,mul(bv,u));
    consider(Math.max(0,Math.min(maximum,dot(sub(p,a.a),av)/(al*al))),u);
  }
  // On the station-separation boundary u is affine in t, reducing the
  // remaining constrained edge to one ordinary point/segment projection.
  const lo=Math.max(0,(stationDelta-separation)/al);
  const hi=Math.min(1,(bl+stationDelta-separation)/al);
  if(lo<=hi+EPS) {
    const constant=(separation-stationDelta)/bl;
    const origin=sub(sub(a.a,b.a),mul(bv,constant));
    const direction=sub(av,mul(bv,al/bl));
    const denominator=dot(direction,direction);
    const t=denominator>EPS?Math.max(lo,Math.min(hi,-dot(origin,direction)/denominator)):lo;
    consider(t,constant+t*al/bl);
  }
  const det=cross(av,bv);
  if(Math.abs(det)>EPS) {
    const delta=sub(b.a,a.a);
    consider(cross(delta,bv)/det,cross(delta,av)/det);
  }
  return best;
}

function validateModel(c,model) {
  const half=c.diameter/2;
  if(model.pathPoints.some(p=>p[0]<half-EPS||p[0]>c.width-half+EPS||p[1]<half-EPS||p[1]>c.height-half+EPS))return fail('Rørets yderside kommer uden for rummet. Flyt hjørnerne ind fra væggene.','WALL_COLLISION');
  const blocked=c.obstacleRects.map(r=>expandRect(r,half+c.clearance+ARC_ERROR));
  for(let i=0;i<model.pathPoints.length-1;i++) {
    if(blocked.some(r=>segmentHitsRect(model.pathPoints[i],model.pathPoints[i+1],r)))return fail('Røret rammer en forhindring eller har for lille fri afstand.','OBSTACLE_COLLISION');
  }
  for(const clip of c.clipPoints) {
    const horizontal=clip.wall==='bottom'||clip.wall==='top';
    const supported=model.straights.some(s=> {
      const axis=horizontal?Math.abs(s.end[1]-s.start[1]):Math.abs(s.end[0]-s.start[0]);
      return axis<EPS&&pointSegmentDistance(clip.point,s.start,s.end)<=CLIP_TOLERANCE;
    });
    if(!supported)return fail(`Røret passer ikke gennem klamme ${clip.id} på et lige stykke langs væggen.`,'MISSED_CLIP');
  }
  return validateRouteSelfCollision(model,c.diameter);
}

/** Shared physical-path check for room and open-wall planners. */
export function validateRouteSelfCollision(model,diameter) {
  // Reject non-local crossings/close passes. Nearby portions of the same pipe
  // are excluded by their distance along the route, not just array adjacency.
  const segments=[];let station=0;
  for(let i=0;i<model.pathPoints.length-1;i++) {
    const a=model.pathPoints[i],b=model.pathPoints[i+1],length=distance(a,b);
    if(length<EPS)continue;
    segments.push({a,b,start:station,end:station+length,minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minY:Math.min(a[1],b[1]),maxY:Math.max(a[1],b[1])});
    station+=length;
  }
  const gap=diameter+2*ARC_ERROR;
  const ordered=segments.map((s,index)=>({...s,index})).sort((a,b)=>a.minX-b.minX);
  let active=[],pairs=0;
  for(const current of ordered) {
    active=active.filter(s=>s.maxX+gap>=current.minX);
    for(const previous of active) {
      if(++pairs>MAX_SWEEP_PAIRS)return fail('Rørføringen er for omfattende til at kontrollere her. Brug færre hjørner eller en mindre radius.','TOO_COMPLEX');
      const [a,b]=previous.index<current.index?[previous,current]:[current,previous];
      if(a.maxY+gap<b.minY||b.maxY+gap<a.minY)continue;
      // A real centreline crossing is invalid even within the otherwise
      // excluded local neighbourhood. Only consecutive pieces may share ends.
      if(b.index>a.index+1&&segmentDistance(a.a,a.b,b.a,b.b)<EPS)return fail('Rørføringen krydser sig selv eller kommer for tæt på sig selv.','SELF_COLLISION');
      // Both arcs may lie ARC_ERROR beyond their sampled chords.
      if(separatedSegmentDistance(a,b,diameter*2)<gap-EPS)return fail('Rørføringen krydser sig selv eller kommer for tæt på sig selv.','SELF_COLLISION');
    }
    active.push(current);
  }
  return {ok:true};
}

// The open-wall planner uses the same fillets and approximation bounds.
export {filletModel as buildRouteGeometry,splitCorners as splitRouteCorners,pointSegmentDistance,segmentDistance};

/** Validate user-edited theoretical vertices without changing their layout. */
export function validateRoomRoute(input,points) {
  const parsed=normalizedConfig(input);
  if(!parsed.ok)return parsed;
  const c=parsed.config,model=filletModel(c,points);
  if(!model.ok)return model;
  if(distance(model.start,c.startPoint)>CLIP_TOLERANCE||distance(model.points.at(-1),c.endPoint)>CLIP_TOLERANCE)return fail('Rørføringens ender skal passe til de valgte start- og slutpunkter.','ENDPOINT_MISMATCH');
  const checked=validateModel(c,model);
  if(!checked.ok)return checked;
  return {...model,ok:true,measurementMode:'vertex',direction:'manual',warnings:[],
    clipPoints:c.clipPoints.map(a=>({id:a.id,point:[...a.point],wall:a.wall})),
    obstacleRects:c.obstacleRects.map(r=>({...r})),
    model:{width:c.width,height:c.height,diameter:c.diameter,radius:c.radius,wallGap:c.wallGap,clearance:c.clearance,maxAngle:c.maxAngle}};
}

function buildSegments(c,padding) {
  const standOff=c.wallGap+c.diameter/2,extra=c.diameter/2+c.clearance;
  if(c.width<=2*standOff||c.height<=2*standOff)return null;
  const segments=[];
  for(const wall of WALLS) {
    const length=wallLength(c,wall),groups=[];
    for(const o of c.obstacles.filter(o=>o.wall===wall)) {
      if(o.depth+extra<=standOff+EPS)continue;
      const position=wall==='top'||wall==='left'?length-o.position-o.width:o.position;
      const event={a:position-extra-padding,b:position+o.width+extra+padding,top:o.depth+extra+padding};
      // A corner obstacle may require the opposite perimeter direction. Keep
      // that wall's baseline here; the final collision validator still checks
      // it and refuses any unsafe route through the unresolved region.
      if(event.a<standOff||event.b>length-standOff)continue;
      groups.push(event);
    }
    groups.sort((a,b)=>a.a-b.a);
    const merged=[];
    for(const g of groups) {
      const prev=merged.at(-1);
      if(prev&&g.a<=prev.b+EPS){prev.b=Math.max(prev.b,g.b);prev.top=Math.max(prev.top,g.top);}
      else merged.push({...g});
    }
    const local=[[standOff,standOff]];
    for(const g of merged)local.push([g.a,standOff],[g.a,g.top],[g.b,g.top],[g.b,standOff]);
    local.push([length-standOff,standOff]);
    for(let i=0;i<local.length-1;i++) {
      const a=fromLocal(c,wall,...local[i]),b=fromLocal(c,wall,...local[i+1]);
      if(distance(a,b)>EPS)segments.push({a,b,wall});
    }
  }
  return segments;
}

function insertClipWindows(c,original) {
  let segments=original.map(s=>({...s,a:[...s.a],b:[...s.b]}));
  const endpointWindows=[c.start,c.end].filter(a=>a.gap!==undefined&&Math.abs(a.gap-c.wallGap)>EPS)
    .map((a,index)=>({...a,id:index?'Slut':'Start',point:pointOnRoomWall(c,a)}));
  const clips=[...c.clipPoints,...endpointWindows].sort((a,b)=>WALLS.indexOf(a.wall)-WALLS.indexOf(b.wall)||a.position-b.position);
  for(const clip of clips) {
    const local=toLocal(c,clip.wall,clip.point),[position,depth]=local;
    const matching=s=>s.wall===clip.wall&&Math.abs(toLocal(c,clip.wall,s.a)[1]-toLocal(c,clip.wall,s.b)[1])<EPS;
    if(segments.some(s=>matching(s)&&pointSegmentDistance(clip.point,s.a,s.b)<EPS))continue;
    let inserted=false;
    const theta=radians(Math.min(45,c.maxAngle));
    const halfWindow=Math.max(c.radius*0.75,c.diameter*1.5,5);
    for(let i=0;i<segments.length;i++) {
      const s=segments[i];if(!matching(s))continue;
      const a=toLocal(c,clip.wall,s.a),b=toLocal(c,clip.wall,s.b),base=a[1];
      const transition=halfWindow+Math.max(Math.abs(depth-base)/Math.tan(theta),c.radius*0.5);
      if(position-transition<a[0]-EPS||position+transition>b[0]+EPS)continue;
      const nodes=[a,[position-transition,base],[position-halfWindow,depth],[position+halfWindow,depth],[position+transition,base],b].map(p=>fromLocal(c,clip.wall,...p));
      const replacement=[];
      for(let j=0;j<nodes.length-1;j++)if(distance(nodes[j],nodes[j+1])>EPS)replacement.push({a:nodes[j],b:nodes[j+1],wall:clip.wall});
      segments.splice(i,1,...replacement);inserted=true;break;
    }
    if(!inserted)return null;
  }
  return segments;
}

function cutCycle(segments,start,end,direction) {
  const nodes=[];
  for(const segment of segments) {
    const v=sub(segment.b,segment.a),len2=dot(v,v),insert=[];
    for(const p of [start,end])if(pointSegmentDistance(p,segment.a,segment.b)<EPS) {
      const t=dot(sub(p,segment.a),v)/len2;
      if(t>EPS&&t<1-EPS)insert.push({p,t});
    }
    insert.sort((a,b)=>a.t-b.t);
    nodes.push(segment.a,...insert.map(p=>p.p));
  }
  const index=p=>nodes.findIndex(n=>distance(n,p)<EPS);
  let i=index(start);const stop=index(end);
  if(i<0||stop<0||i===stop)return null;
  const points=[[...nodes[i]]];
  for(let n=0;n<nodes.length;n++) {
    i=(i+direction+nodes.length)%nodes.length;points.push([...nodes[i]]);
    if(i===stop)return cleanPoints(points);
  }
  return null;
}

function splitCorners(raw,radius,maxAngle,factor) {
  const points=cleanPoints(raw);if(!points)return null;
  const result=[[...points[0]]];
  for(let i=1;i<points.length-1;i++) {
    const u=mul(sub(points[i],points[i-1]),1/distance(points[i],points[i-1]));
    const v=mul(sub(points[i+1],points[i]),1/distance(points[i+1],points[i]));
    const theta=Math.atan2(cross(u,v),dot(u,v)),n=Math.ceil((Math.abs(degrees(theta))-1e-7)/maxAngle);
    if(n<=1){result.push([...points[i]]);continue;}
    if(n>100||Math.abs(theta)>=Math.PI-1e-6)return null;
    const sign=Math.sign(theta),bigRadius=radius*factor,delta=theta/n;
    const start=sub(points[i],mul(u,bigRadius*Math.tan(Math.abs(theta)/2)));
    const center=add(start,mul(left(u),sign*bigRadius));
    const h=Math.atan2(u[1],u[0]),step=bigRadius*Math.tan(Math.abs(delta)/2);
    for(let j=0;j<n;j++) {
      const angle=h+j*delta,dir=[Math.cos(angle),Math.sin(angle)];
      const tangent=sub(center,mul(left(dir),sign*bigRadius));
      result.push(add(tangent,mul(dir,step)));
    }
  }
  result.push([...points.at(-1)]);return cleanPoints(result);
}

/** Propose a checked path along one of the room's two perimeter directions. */
export function generateRoomRoute(input) {
  const parsed=normalizedConfig(input);if(!parsed.ok)return parsed;
  const c=parsed.config,candidates=[],errors=[];
  const directions=c.direction==='auto'?[1,-1]:[c.direction==='counterclockwise'?1:-1];
  const factors=c.maxAngle>=90?[1]:[1.25,1.6,2.2];
  for(const padFactor of [0.5,1,1.5,2.5,4]) {
    const base=buildSegments(c,c.radius*padFactor);if(!base)continue;
    const segments=insertClipWindows(c,base);if(!segments){errors.push(fail('Der er ikke plads til klammernes vægafstande mellem forhindringerne.','CLIP_SPACE'));continue;}
    for(const direction of directions) {
      const nominal=cutCycle(segments,c.startPoint,c.endPoint,direction);
      if(!nominal){errors.push(fail('Start eller slut ligger for tæt ved et hjørne eller en forhindring til dette vægforløb.','ENDPOINT_SPACE'));continue;}
      for(const factor of factors) {
        const points=splitCorners(nominal,c.radius,c.maxAngle,factor);
        if(!points){errors.push(fail('Der er ikke plads til den valgte maksimale bukkevinkel.','MAX_ANGLE_SPACE'));continue;}
        const result=validateRoomRoute(c,points);
        if(result.ok)candidates.push({...result,direction:direction===1?'counterclockwise':'clockwise',
          proposal:'wall-perimeter',score:result.geometricLength+result.turns.length*c.radius*0.01});
        else if(result.code==='TOO_COMPLEX')return result;
        else errors.push(result);
      }
    }
    // The smallest feasible safety envelope keeps a proposal close to the wall.
    if(candidates.length)break;
  }
  if(!candidates.length) {
    const priority=['BLOCKED_ANCHOR','MISSED_CLIP','OBSTACLE_COLLISION','INSUFFICIENT_STRAIGHT','MAX_ANGLE_SPACE','CLIP_SPACE','ENDPOINT_SPACE'];
    errors.sort((a,b)=>priority.indexOf(a.code)-priority.indexOf(b.code));
    const specific=errors[0]?.error;
    return fail(specific?`Intet kontrolleret vægforløb fundet. ${specific}`:'Rummet er for lille til den valgte vægafstand og bukkeradius.','NO_ROUTE');
  }
  candidates.sort((a,b)=>a.score-b.score||a.turns.length-b.turns.length);
  const {score,...result}=candidates[0];return result;
}
