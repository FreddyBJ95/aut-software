// Measured, open wall chains. All lengths are mm, turns are signed degrees,
// heading is radians. The pipe is checked with its real constant-radius arcs.
import {buildRouteGeometry,splitRouteCorners,validateRouteSelfCollision,pointSegmentDistance,segmentDistance} from './room-routing.mjs?v=44';

const EPS=1e-7,CLIP_TOLERANCE=0.25;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),finite=n=>typeof n==='number'&&Number.isFinite(n);
const fail=(error,code='NO_ROUTE')=>({ok:false,error,code});
const radians=n=>n*Math.PI/180;

/** Drawn segments only: no closed-room bounds are inferred. */
export function wallLayout(config) {
  const wall=config?.wall;
  if(!wall||!Array.isArray(wall.lengths)||!Array.isArray(wall.turns)||!wall.lengths.length||wall.lengths.length>100||wall.turns.length!==wall.lengths.length-1)return fail('Tegn mindst ét vægstykke med længde og en vinkel mellem hvert stykke.','INVALID_WALL');
  if(wall.lengths.some(n=>!finite(n)||n<=0||n>1e7)||wall.turns.some(n=>!finite(n)||Math.abs(n)>=179)||!finite(wall.heading??0)||!['left','right'].includes(wall.side??'left'))return fail('Kontrollér væglængder, vinkler og den valgte side af væggen.','INVALID_WALL');
  const segments=[],points=[[0,0]],side=wall.side??'left',sign=side==='left'?1:-1;
  let heading=wall.heading??0,station=0;
  for(let i=0;i<wall.lengths.length;i++) {
    const unit=[Math.cos(heading),Math.sin(heading)],normal=[-unit[1]*sign,unit[0]*sign],length=wall.lengths[i];
    const start=[...points.at(-1)],end=add(start,mul(unit,length));
    segments.push({index:i,id:`V${i+1}`,start,end,length,heading,unit,normal,startStation:station,endStation:station+length});
    points.push(end);station+=length;heading+=radians(wall.turns[i]??0);
  }
  if(station>1e8)return fail('Vægforløbet er for langt. Kontrollér enhederne.','INVALID_WALL');
  const closed=points.length>=4&&distance(points[0],points.at(-1))<EPS;
  for(let i=0;i<segments.length;i++)for(let j=i+2;j<segments.length;j++) {
    if(closed&&i===0&&j===segments.length-1)continue;
    if(segmentDistance(segments[i].start,segments[i].end,segments[j].start,segments[j].end)<EPS)return fail('Vægforløbet krydser eller rører sig selv. Ret vægstykkerne.','WALL_SELF_INTERSECTION');
  }
  return {ok:true,points,segments,totalLength:station,side,closed};
}

const localPoint=(segment,position,depth)=>add(segment.start,add(mul(segment.unit,position),mul(segment.normal,depth)));
const localCoordinates=(segment,p)=>{const d=sub(p,segment.start);return [dot(d,segment.unit),dot(d,segment.normal)];};

/** Centreline position; wall gap is measured to the outside of the tube. */
export function pointOnWall(config,anchor,gap=anchor?.gap??config.wallGap??50) {
  const layout=wallLayout(config),segment=layout.ok&&layout.segments[anchor?.segment];
  if(!segment||!finite(anchor?.position)||!finite(gap)||!finite(config.diameter))throw new RangeError('Punktet skal høre til et gyldigt vægstykke.');
  return localPoint(segment,anchor.position,gap+config.diameter/2);
}

export function wallObstaclePolygon(config,obstacle) {
  const layout=wallLayout(config),segment=layout.ok&&layout.segments[obstacle?.segment];
  if(!segment||!['position','width','depth'].every(k=>finite(obstacle?.[k])))throw new RangeError('Forhindringen skal høre til et gyldigt vægstykke.');
  const {position:p,width:w,depth:d}=obstacle;
  return {id:obstacle.id,segment:obstacle.segment,points:[[p,0],[p+w,0],[p+w,d],[p,d]].map(([s,n])=>localPoint(segment,s,n))};
}

function normalize(raw) {
  const layout=wallLayout(raw);if(!layout.ok)return layout;
  const c={...raw,wallGap:raw.wallGap??50,clearance:raw.clearance??10,maxAngle:raw.maxAngle??90,clips:raw.clips??[],obstacles:raw.obstacles??[],layout};
  if(!['diameter','radius','wallGap','clearance','maxAngle'].every(k=>finite(c[k]))||c.diameter<=0||c.diameter>1e5||c.radius<=c.diameter/2||c.radius>1e5||c.wallGap<0||c.wallGap>1e7||c.clearance<0||c.clearance>1e7||c.maxAngle<=0||c.maxAngle>=179)return fail('Kontrollér diameter, bukkeradius, vægafstand, fri afstand og maksimal bukkevinkel.','INVALID_INPUT');
  if(!Array.isArray(c.clips)||!Array.isArray(c.obstacles)||c.clips.length>100||c.obstacles.length>40)return fail('Der kan bruges op til 100 klammer og 40 forhindringer.','INVALID_INPUT');
  const anchorOK=a=>a&&Number.isInteger(a.segment)&&layout.segments[a.segment]&&finite(a.position)&&a.position>=0&&a.position<=layout.segments[a.segment].length&&(a.gap===undefined||(finite(a.gap)&&a.gap>=0&&a.gap<=1e7));
  if(!anchorOK(c.start)||!anchorOK(c.end))return fail('Start og slut skal ligge på et af de tegnede vægstykker.','INVALID_ENDPOINT');
  if(c.clips.some(a=>!anchorOK(a)||(a.id!==undefined&&typeof a.id!=='string')))return fail('En klamme ligger uden for sit vægstykke eller har en ugyldig vægafstand.','INVALID_CLIP');
  for(const o of c.obstacles) {
    if(!o||!Number.isInteger(o.segment)||!layout.segments[o.segment]||!['position','width','depth'].every(k=>finite(o[k]))||o.position<0||o.width<=0||o.depth<=0||o.depth>1e7||o.position+o.width>layout.segments[o.segment].length+EPS)return fail('En forhindring har ugyldige mål eller ligger uden for sit vægstykke.','INVALID_OBSTACLE');
  }
  const anchorPoint=a=>localPoint(layout.segments[a.segment],a.position,(a.gap??c.wallGap)+c.diameter/2);
  c.startPoint=anchorPoint(c.start);c.endPoint=anchorPoint(c.end);
  if(distance(c.startPoint,c.endPoint)<EPS)return fail('Start og slut skal være forskellige punkter.','IDENTICAL_ENDPOINTS');
  c.clipPoints=c.clips.map((a,i)=>({...a,id:a.id||`K${i+1}`,point:anchorPoint(a)}));
  c.obstaclePolygons=c.obstacles.map((o,i)=>({id:o.id||`F${i+1}`,segment:o.segment,points:[[o.position,0],[o.position+o.width,0],[o.position+o.width,o.depth],[o.position,o.depth]].map(([s,n])=>localPoint(layout.segments[o.segment],s,n))}));
  const extents=layout.points.flat().map(Math.abs);
  c.width=c.height=Math.max(1,...extents,c.wallGap,...[c.start,c.end,...c.clips].map(a=>a.gap??0),...c.obstacles.map(o=>o.depth))+c.radius+1;
  c.collisionWalls=[...layout.segments];
  if(!layout.closed) {
    // The user measured a relevant portion, not the physical end of a wall.
    // Continue both open ends beyond the permitted route-coordinate envelope
    // so an edited pipe cannot wrap behind the wall around an unmeasured tip.
    const first=layout.segments[0],last=layout.segments.at(-1),reach=16*c.width;
    c.collisionWalls.push({start:sub(first.start,mul(first.unit,reach)),end:first.start,continuation:true},{start:last.end,end:add(last.end,mul(last.unit,reach)),continuation:true});
  }
  for(const anchor of [{id:'Start',point:c.startPoint},{id:'Slut',point:c.endPoint},...c.clipPoints]) {
    if(c.collisionWalls.some(s=>pointSegmentDistance(anchor.point,s.start,s.end)<c.diameter/2-EPS))return fail(`${anchor.id} ligger for tæt på et vægstykke eller dets fortsættelse. Flyt punktet eller øg vægafstanden.`,'BLOCKED_ANCHOR');
    if(c.obstacles.some(o=>pointObstacleDistance(c,anchor.point,o)<c.diameter/2+c.clearance-EPS))return fail(`${anchor.id} ligger for tæt på en forhindring. Flyt punktet eller øg vægafstanden.`,'BLOCKED_ANCHOR');
  }
  return {ok:true,config:c};
}

function angleOnArc(angle,start,sweep) {
  const tau=2*Math.PI,relative=((angle-start)*(sweep<0?-1:1)%tau+tau)%tau;
  return relative<=Math.abs(sweep)+1e-9||tau-relative<1e-9;
}
function arcData(arc) {return {start:arc.samples[0],end:arc.samples.at(-1),angle:Math.atan2(arc.samples[0][1]-arc.center[1],arc.samples[0][0]-arc.center[0]),sweep:radians(arc.turn)};}
function pointArcDistance(p,arc,data=arcData(arc)) {
  const delta=sub(p,arc.center),angle=Math.atan2(delta[1],delta[0]);
  return angleOnArc(angle,data.angle,data.sweep)?Math.abs(Math.hypot(...delta)-arc.radius):Math.min(distance(p,data.start),distance(p,data.end));
}
// Analytic arc/segment distance avoids accepting an overlap between samples,
// and also permits exact tangency when the user chooses zero wall gap.
export function arcSegmentDistance(arc,a,b) {
  const data=arcData(arc),v=sub(b,a),len=Math.hypot(...v),u=mul(v,1/len),normal=[-u[1],u[0]],ca=sub(a,arc.center);
  let best=Math.min(pointSegmentDistance(data.start,a,b),pointSegmentDistance(data.end,a,b),pointArcDistance(a,arc,data),pointArcDistance(b,arc,data));
  // Work relative to the circle. Subtracting two squared distances from the
  // far end of a long wall ray can erase the entire small-radius circle.
  const linear=dot(ca,u),perpendicular=cross(u,ca),disc=arc.radius*arc.radius-perpendicular*perpendicular;
  if(disc>=-EPS)for(const root of [-Math.sqrt(Math.max(0,disc)),Math.sqrt(Math.max(0,disc))]) {
    const t=-linear+root;
    if(t>=-EPS&&t<=len+EPS) {
      const p=add(add(arc.center,mul(normal,perpendicular)),mul(u,root));
      if(angleOnArc(Math.atan2(p[1]-arc.center[1],p[0]-arc.center[0]),data.angle,data.sweep))return 0;
    }
  }
  for(const sign of [-1,1]) {
    const p=add(arc.center,mul(normal,sign*arc.radius)),t=dot(sub(p,a),u);
    if(t>=-EPS&&t<=len+EPS&&angleOnArc(Math.atan2(p[1]-arc.center[1],p[0]-arc.center[0]),data.angle,data.sweep))best=Math.min(best,Math.abs(cross(u,sub(p,a))));
  }
  return best;
}
function pointObstacleDistance(c,p,o) {
  const segment=c.layout.segments[o.segment],[s,n]=localCoordinates(segment,p);
  return Math.hypot(Math.max(o.position-s,0,s-o.position-o.width),Math.max(-n,0,n-o.depth));
}
function primitiveSegmentDistance(primitive,isArc,a,b) {return isArc?arcSegmentDistance(primitive,a,b):segmentDistance(primitive.start,primitive.end,a,b);}

/** Validate edited theoretical corners against every drawn wall and obstacle. */
export function validateWallRoute(input,points) {
  const parsed=normalize(input);if(!parsed.ok)return parsed;
  const c=parsed.config,model=buildRouteGeometry(c,points);if(!model.ok)return model;
  if(distance(model.start,c.startPoint)>CLIP_TOLERANCE||distance(model.points.at(-1),c.endPoint)>CLIP_TOLERANCE)return fail('Rørføringens ender skal passe til de valgte start- og slutpunkter.','ENDPOINT_MISMATCH');
  const primitives=[...model.straights.map(p=>[p,false]),...model.arcs.map(p=>[p,true])];
  for(const [primitive,isArc] of primitives) {
    for(const wall of c.collisionWalls)if(primitiveSegmentDistance(primitive,isArc,wall.start,wall.end)<c.diameter/2-EPS)return fail(wall.continuation?'Røret krydser væggens fortsættelse og kommer om bag væggen. De målte ender er ikke fysiske vægender.':'Rørets yderside rammer et af de tegnede vægstykker. Flyt punkterne væk fra væggen.','WALL_COLLISION');
    for(let i=0;i<c.obstacles.length;i++) {
      const obstacle=c.obstacles[i],polygon=c.obstaclePolygons[i].points,start=isArc?primitive.samples[0]:primitive.start;
      if(pointObstacleDistance(c,start,obstacle)<c.diameter/2+c.clearance-EPS)return fail('Røret rammer en forhindring eller har for lille fri afstand.','OBSTACLE_COLLISION');
      for(let j=0;j<4;j++)if(primitiveSegmentDistance(primitive,isArc,polygon[j],polygon[(j+1)%4])<c.diameter/2+c.clearance-EPS)return fail('Røret rammer en forhindring eller har for lille fri afstand.','OBSTACLE_COLLISION');
    }
  }
  for(const clip of c.clipPoints) {
    const wall=c.layout.segments[clip.segment];
    if(!model.straights.some(s=>Math.abs(cross(sub(s.end,s.start),wall.unit))<=EPS*Math.max(1,s.length)&&pointSegmentDistance(clip.point,s.start,s.end)<=CLIP_TOLERANCE))return fail(`Røret passer ikke gennem klamme ${clip.id} på et lige stykke langs væggen.`,'MISSED_CLIP');
  }
  const self=validateRouteSelfCollision(model,c.diameter);if(!self.ok)return self;
  return {...model,measurementMode:'vertex',direction:'manual',warnings:[],clipPoints:c.clipPoints.map(a=>({id:a.id,point:[...a.point],segment:a.segment})),obstaclePolygons:c.obstaclePolygons,wallPoints:c.layout.points,wallSegments:c.layout.segments};
}

function offsetIntersection(a,b,depth) {
  const pa=add(a.end,mul(a.normal,depth)),pb=add(b.start,mul(b.normal,depth)),det=cross(a.unit,b.unit);
  if(Math.abs(det)<EPS)return distance(pa,pb)<EPS?pa:null;
  return add(pa,mul(a.unit,cross(sub(pb,pa),b.unit)/det));
}
function cleanSegments(nodes,segment) {
  const result=[];
  for(let i=0;i<nodes.length-1;i++)if(distance(nodes[i],nodes[i+1])>EPS)result.push({a:nodes[i],b:nodes[i+1],segment});
  return result;
}
function obstacleAngleTiers(maxAngle) {
  const requested=Math.min(90,maxAngle),squareAngle=90/Math.ceil((90-EPS)/maxAngle);
  return [requested,...[60,45,30,squareAngle].filter(angle=>angle<requested-EPS)].filter((angle,index,list)=>list.findIndex(other=>Math.abs(other-angle)<EPS)===index).sort((a,b)=>b-a);
}
function buildSegments(c,padding,ramps=false,detourAngle=Math.min(90,c.maxAngle)) {
  const depth=c.wallGap+c.diameter/2,extra=c.diameter/2+c.clearance,segments=[];
  const lowSegment=Math.min(c.start.segment,c.end.segment),highSegment=Math.max(c.start.segment,c.end.segment);
  const walls=c.layout.closed?c.layout.segments:c.layout.segments.slice(lowSegment,highSegment+1);
  const joins=walls.slice(0,-1).map((w,i)=>offsetIntersection(w,walls[i+1],depth));
  const seam=c.layout.closed?offsetIntersection(walls.at(-1),walls[0],depth):null;
  if(joins.some(p=>!p)||(c.layout.closed&&!seam))return null;
  for(let i=0;i<walls.length;i++) {
    const wall=walls[i],first=i?joins[i-1]:(seam??localPoint(wall,0,depth)),last=i<joins.length?joins[i]:(seam??localPoint(wall,wall.length,depth));
    const a=localCoordinates(wall,first)[0],b=localCoordinates(wall,last)[0];if(b<=a+EPS)return null;
    const groups=[];
    const localBounds=c.layout.closed?[-Infinity,Infinity]:[i===0?(c.start.segment===wall.index&&c.end.segment===wall.index?Math.min(c.start.position,c.end.position):(c.start.segment===wall.index?c.start.position:c.end.position)):-Infinity,i===walls.length-1?(c.start.segment===wall.index&&c.end.segment===wall.index?Math.max(c.start.position,c.end.position):(c.start.segment===wall.index?c.start.position:c.end.position)):Infinity];
    for(const obstacle of c.obstacles.filter(o=>o.segment===wall.index&&o.position+o.width>=localBounds[0]-EPS&&o.position<=localBounds[1]+EPS)) {
      if(obstacle.depth+extra<=depth+EPS)continue;
      // Radius room belongs along the wall. Raising the top would silently
      // change the requested outside-pipe clearance by the padding amount.
      const event={a:obstacle.position-extra-padding,b:obstacle.position+obstacle.width+extra+padding,top:obstacle.depth+extra};
      if(event.a<a-EPS||event.b>b+EPS)return null;
      groups.push(event);
    }
    const availableAngles=obstacleAngleTiers(c.maxAngle);
    const angleFor=g=>detourAngle==='adaptive'?availableAngles.find(angle=>{
      const theta=radians(angle);
      return (g.top-depth)/Math.sin(theta)-2*c.radius*Math.tan(theta/2)>0.01;
    })??availableAngles.at(-1):detourAngle;
    const run=g=>ramps?(g.top-depth)/Math.tan(radians(angleFor(g))):0;
    groups.sort((x,y)=>x.a-y.a);const merged=[];
    for(const g of groups) {
      merged.push({...g});
      while(merged.length>1) {
        const current=merged.at(-1),previous=merged.at(-2);
        if(current.a-run(current)>previous.b+run(previous)+EPS)break;
        merged.splice(-2,2,{a:Math.min(previous.a,current.a),b:Math.max(previous.b,current.b),top:Math.max(previous.top,current.top)});
      }
    }
    const nodes=[[a,depth]],edgeAngles=[];
    const append=(point,angle=null)=>{edgeAngles.push(angle);nodes.push(point);};
    for(const g of merged) {
      const ramp=run(g),angle=angleFor(g);
      if(g.a-ramp<a-EPS||g.b+ramp>b+EPS)return null;
      append([g.a-ramp,depth]);append([g.a,g.top],angle);append([g.b,g.top],angle);append([g.b+ramp,depth],angle);
    }
    append([b,depth]);
    for(let j=0;j<nodes.length-1;j++){
      const start=localPoint(wall,...nodes[j]),end=localPoint(wall,...nodes[j+1]);
      if(distance(start,end)>EPS)segments.push({a:start,b:end,segment:wall.index,detourAngle:edgeAngles[j]});
    }
  }
  return segments;
}
function insertClipWindows(c,original) {
  const segments=original.map(s=>({...s,a:[...s.a],b:[...s.b]}));
  const anchors=[...c.clipPoints,...[c.start,c.end].filter(a=>a.gap!==undefined&&Math.abs(a.gap-c.wallGap)>EPS).map(a=>({...a,point:pointOnWall(c,a)}))].sort((a,b)=>a.segment-b.segment||a.position-b.position);
  for(const anchor of anchors) {
    const wall=c.layout.segments[anchor.segment],[position,depth]=localCoordinates(wall,anchor.point),matching=s=>s.segment===anchor.segment&&Math.abs(dot(sub(s.b,s.a),wall.normal))<EPS;
    if(segments.some(s=>matching(s)&&pointSegmentDistance(anchor.point,s.a,s.b)<EPS))continue;
    let inserted=false;const half=Math.max(c.radius*0.75,c.diameter*1.5,5),theta=radians(Math.min(45,c.maxAngle));
    for(let i=0;i<segments.length;i++) {
      const s=segments[i];if(!matching(s))continue;
      const a=localCoordinates(wall,s.a),b=localCoordinates(wall,s.b),base=a[1],transition=half+Math.max(Math.abs(depth-base)/Math.tan(theta),c.radius*0.5);
      if(position-transition<a[0]-EPS||position+transition>b[0]+EPS)continue;
      const nodes=[a,[position-transition,base],[position-half,depth],[position+half,depth],[position+transition,base],b].map(([p,d])=>localPoint(wall,p,d));
      segments.splice(i,1,...cleanSegments(nodes,anchor.segment).map(part=>({...part,detourAngle:s.detourAngle??null})));inserted=true;break;
    }
    if(!inserted)return null;
  }
  return segments;
}
function cutPath(segments,start,end,closed,direction) {
  const nodes=[];
  for(const segment of segments) {
    const length=distance(segment.a,segment.b),unit=mul(sub(segment.b,segment.a),1/length),insert=[];
    nodes.push(segment.a);
    for(const p of [start,end])if(pointSegmentDistance(p,segment.a,segment.b)<EPS) {
      const position=dot(sub(p,segment.a),unit);
      if(position>EPS&&position<length-EPS)insert.push({p,position});
    }
    insert.sort((a,b)=>a.position-b.position);nodes.push(...insert.map(a=>a.p));
  }
  if(!closed)nodes.push(segments.at(-1).b);
  let i=nodes.findIndex(p=>distance(p,start)<EPS);const stop=nodes.findIndex(p=>distance(p,end)<EPS);
  if(i<0||stop<0||i===stop||(!closed&&(stop-i)*direction<=0))return null;
  const points=[[...nodes[i]]];
  for(let n=0;n<nodes.length;n++) {
    i+=direction;if(closed)i=(i+nodes.length)%nodes.length;
    if(i<0||i>=nodes.length)return null;
    points.push([...nodes[i]]);if(i===stop)return points;
  }
  return null;
}

// A short rectangular wall protrusion is one obstacle to pass, rather than
// four pipe bends that must copy its sharp corners. This envelope is used for
// proposal construction only: every result is checked against the original
// measured walls, obstacles, endpoints and clip directions afterward.
function wallProfileEnvelope(c) {
  let pieces=c.layout.segments.map(s=>({...s,mappings:[{segment:s.index,offset:0,depth:0}],features:[]})),changed=false;
  const constrained=new Set([c.start,c.end,...c.clips,...c.obstacles].map(a=>a.segment));
  const aligned=(a,b)=>dot(a,b)>1-1e-8&&Math.abs(cross(a,b))<1e-8;
  for(let i=0;i+4<pieces.length;) {
    const [a,b,d,e,f]=pieces.slice(i,i+5),connectors=[...b.mappings,...e.mappings];
    const rectangular=aligned(a.unit,d.unit)&&aligned(a.unit,f.unit)&&aligned(b.unit,mul(e.unit,-1))&&Math.abs(dot(a.unit,b.unit))<1e-8&&Math.abs(b.length-e.length)<=EPS*Math.max(1,b.length,e.length);
    // A clip on a lateral connector needs a perpendicular straight pipe.
    // Keep that measured geometry instead of erasing its required support.
    const supported=connectors.some(m=>constrained.has(m.segment))||b.features.length||e.features.length;
    const depth=dot(sub(d.start,a.end),a.normal),length=a.length+d.length+f.length;
    const faceFits=d.mappings.every(m=>!constrained.has(m.segment)||(c.wallGap+m.depth+depth>=0));
    if(!rectangular||supported||!faceFits) {i++;continue;}
    const mappings=[...a.mappings,...d.mappings.map(m=>({...m,offset:m.offset+a.length,depth:m.depth+depth})),...f.mappings.map(m=>({...m,offset:m.offset+a.length+d.length}))];
    const features=[...a.features,...d.features.map(o=>({...o,position:o.position+a.length,depth:o.depth+depth})),...f.features.map(o=>({...o,position:o.position+a.length+d.length}))];
    if(depth>EPS)features.push({id:`wall-profile-${a.index}-${f.index}`,position:a.length,width:d.length,depth});
    pieces.splice(i,5,{...a,end:[...f.end],length,mappings,features});changed=true;i=Math.max(0,i-4);
  }
  if(!changed)return null;
  const mappings=new Map();pieces.forEach((piece,index)=>piece.mappings.forEach(m=>mappings.set(m.segment,{...m,index})));
  function anchor(a) {
    const m=mappings.get(a.segment);if(!m)return null;
    const gap=(a.gap??c.wallGap)+m.depth;
    return gap<0?null:{...a,segment:m.index,position:a.position+m.offset,gap};
  }
  const start=anchor(c.start),end=anchor(c.end),clips=c.clips.map(anchor);
  if(!start||!end||clips.some(a=>!a))return null;
  const obstacles=c.obstacles.map(o=>{const m=mappings.get(o.segment);return m?{...o,segment:m.index,position:o.position+m.offset,depth:o.depth+m.depth}:null;});
  if(obstacles.some(o=>!o||o.depth<=0))return null;
  pieces.forEach((piece,segment)=>piece.features.forEach(o=>{if(o.depth>EPS)obstacles.push({...o,segment});}));
  if(obstacles.length>40)return null;
  const turns=pieces.slice(1).map((p,i)=>Math.atan2(cross(pieces[i].unit,p.unit),dot(pieces[i].unit,p.unit))*180/Math.PI);
  return {wall:{lengths:pieces.map(p=>p.length),turns,heading:c.wall.heading??0,side:c.wall.side??'left'},diameter:c.diameter,radius:c.radius,wallGap:c.wallGap,clearance:c.clearance,maxAngle:c.maxAngle,start,end,clips,obstacles};
}

const routeScore=(route,radius)=>route.geometricLength+route.turns.length*radius*2;

/** Follow only the wall chain the user measured; never invent room dimensions. */
export function generateWallRoute(input) {return generateWallRouteInternal(input,true);}

function detourChoice(route,angles,requested) {
  const used=route.turns.length?angles.filter((angle,index,list)=>list.findIndex(other=>Math.abs(other-angle)<EPS)===index).sort((a,b)=>b-a):[];
  const angle=used.length?Math.min(...used):null,fallback=angle!==null&&angle<requested-EPS;
  return {...route,requestedDetourAngle:requested,detourAngles:used,detourAngle:angle,detourAngleFallback:fallback,warnings:fallback?['DETOUR_ANGLE_FALLBACK']:[]};
}
function pathDetourAngles(segments,points) {
  const detours=segments.filter(segment=>finite(segment.detourAngle)),angles=[];
  for(let index=0;index<points.length-1;index++){
    const midpoint=mul(add(points[index],points[index+1]),.5);
    for(const segment of detours)if(pointSegmentDistance(midpoint,segment.a,segment.b)<EPS)angles.push(segment.detourAngle);
  }
  return angles;
}
function generateWallRouteInternal(input,allowProfile,forcedAngle=null) {
  const parsed=normalize(input);if(!parsed.ok)return parsed;
  const c=parsed.config,errors=[],requested=Math.min(90,c.maxAngle);
  // The selected limit is also the first obstacle angle to try. Smaller
  // detours cannot win merely because their diagonal route uses less tube.
  // A split square is another construction for its actual resulting angle.
  const squareAngle=90/Math.ceil((90-EPS)/c.maxAngle);
  const tiers=forcedAngle===null?['adaptive',...obstacleAngleTiers(c.maxAngle)]:[forcedAngle];
  const station=a=>c.layout.segments[a.segment].startStation+a.position;
  const forward=station(c.end)>station(c.start),directions=c.layout.closed?[1,-1]:[forward?1:-1];
  if(!c.layout.closed&&c.clips.some(a=>station(a)<Math.min(station(c.start),station(c.end))-EPS||station(a)>Math.max(station(c.start),station(c.end))+EPS))return fail('En klamme ligger uden for strækningen mellem rørets start og slut. Flyt klammen eller endepunkterne.','CLIP_ORDER');
  const envelope=allowProfile?wallProfileEnvelope(c):null;
  // Split corners need a larger construction circle than the real tool
  // radius, otherwise the new neighbouring bends leave zero straight tube.
  const factors=[1.25,1.6,2.2,1.05,1.01];
  for(const angle of tiers) {
    const candidates=[];
    for(const padFactor of [0.5,1,1.5,2.5,4]) {
      const modes=angle!=='adaptive'&&Math.abs(angle-squareAngle)<EPS?[true,false]:[true];
      for(const ramps of modes) {
        const base=buildSegments(c,c.radius*padFactor,ramps,angle);
        if(!base){errors.push(fail('Der er for lidt plads ved et væghjørne eller en forhindring. Flyt forhindringen eller øg vægafstanden.','CORNER_SPACE'));continue;}
        const segments=insertClipWindows(c,base);
        if(!segments){errors.push(fail('Der er ikke plads til klammernes vægafstande mellem hjørner og forhindringer.','CLIP_SPACE'));continue;}
        for(const direction of directions) {
          const nominal=cutPath(segments,c.startPoint,c.endPoint,c.layout.closed,direction);
          if(!nominal){errors.push(fail('Start eller slut ligger for tæt ved et hjørne eller en forhindring. Flyt endepunktet længere ind på vægstykket.','ENDPOINT_SPACE'));continue;}
          const angles=pathDetourAngles(segments,nominal);
          for(const factor of factors) {
            const points=splitRouteCorners(nominal,c.radius,c.maxAngle,factor);
            if(!points){errors.push(fail('Der er ikke plads til den valgte maksimale bukkevinkel.','MAX_ANGLE_SPACE'));continue;}
            const result=validateWallRoute(c,points);
            if(result.ok)candidates.push({...detourChoice(result,angles,requested),direction:direction===1?'forward':'reverse',proposal:'measured-wall',score:routeScore(result,c.radius)});
            else if(result.code==='TOO_COMPLEX')return result;else errors.push(result);
          }
        }
      }
      if(candidates.length)break;
    }
    // Profile construction obeys the same angle tier and is validated against
    // the original measured geometry before lower obstacle angles are tried.
    if(envelope) {
      const proposal=generateWallRouteInternal(envelope,false,angle);
      if(proposal.ok) {
        const checked=validateWallRoute(c,proposal.points);
        if(checked.ok)candidates.push({...detourChoice(checked,proposal.detourAngles,requested),direction:proposal.direction,proposal:'measured-wall-profile',score:routeScore(checked,c.radius)});
        else errors.push(checked);
      }else errors.push(proposal);
    }
    if(candidates.length) {
      // Angle fulfillment outranks shorter tube, including when a profile
      // candidate and a direct wall candidate use different local angles.
      const minimum=route=>route.detourAngle??requested;
      const maximum=route=>route.detourAngles.length?Math.max(...route.detourAngles):requested;
      candidates.sort((a,b)=>Number(a.detourAngleFallback)-Number(b.detourAngleFallback)||minimum(b)-minimum(a)||maximum(b)-maximum(a)||a.score-b.score||a.turns.length-b.turns.length);
      const {score,...result}=candidates[0];return result;
    }
  }
  {
    const specific=errors.find(e=>['MISSED_CLIP','OBSTACLE_COLLISION','INSUFFICIENT_STRAIGHT','WALL_COLLISION'].includes(e.code))??errors[0];
    const suggestions={
      WALL_COLLISION:'Der er for lidt plads ved et væghjørne med den valgte radius og vægafstand. Prøv større vægafstand, mindre radius eller en anden placering af start, slut og klammer.',
      INSUFFICIENT_STRAIGHT:'Der er ikke plads til bukkeradius mellem hjørner, klammer eller forhindringer. Prøv mindre radius, større tilladt bukkevinkel eller mere afstand mellem placeringerne.',
      MAX_ANGLE:'Der kunne ikke findes en rørføring med den valgte maksimale bukkevinkel. Prøv større tilladt vinkel, mindre radius eller mere plads ved hjørnerne.',
      REVERSAL:'De korte vægstykker og den valgte radius gav ikke et brugbart forslag. Prøv mindre radius eller mere plads ved hjørnerne.',
      SELF_COLLISION:'Forslagene kom for tæt på andre dele af samme rør. Prøv mindre radius eller en anden placering af klammer og ender.',
    };
    const details=suggestions[specific?.code]??specific?.error;
    return {...fail(details?`Intet kontrolleret rørforslag fundet. ${details}`:'Der er ikke plads til et rørforslag langs væggen.','NO_ROUTE'),reasonCode:specific?.code};
  }
}
