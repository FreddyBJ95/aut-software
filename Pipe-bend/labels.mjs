import {rectPolygon,polygonsOverlap} from './dimension-layout.mjs?v=44';

const bounds=polygon=>({minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minY:Math.min(...polygon.map(p=>p[1])),maxY:Math.max(...polygon.map(p=>p[1]))});
const inside=(polygon,width,height,padding)=>polygon.every(([x,y])=>x>=padding&&x<=width-padding&&y>=padding&&y<=height-padding);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const overlap=(a,b,gap=4)=>!(a.box.maxX+gap<=b.box.minX||b.box.maxX+gap<=a.box.minX||a.box.maxY+gap<=b.box.minY||b.box.maxY+gap<=a.box.minY)&&polygonsOverlap(a.polygon,b.polygon,gap);
function pointInside(point,polygon) {
 let odd=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
  const [x,y]=polygon[i],[px,py]=polygon[j];
  if((y>point[1])!==(py>point[1])&&point[0]<(px-x)*(point[1]-y)/(py-y)+x)odd=!odd;
 }
 return odd;
}
function segmentMeetsPolygon(a,b,polygon) {
 if(pointInside(a,polygon)||pointInside(b,polygon))return true;
 const cross=(u,v)=>u[0]*v[1]-u[1]*v[0],d=[b[0]-a[0],b[1]-a[1]];
 for(let i=0;i<polygon.length;i++) {
  const p=polygon[i],q=polygon[(i+1)%polygon.length],e=[q[0]-p[0],q[1]-p[1]],det=cross(d,e);
  if(Math.abs(det)<1e-10)continue;
  const v=[p[0]-a[0],p[1]-a[1]],t=cross(v,e)/det,u=cross(v,d)/det;
  if(t>1e-5&&t<1-1e-5&&u>=0&&u<=1)return true;
 }
 return false;
}

// Test the real centreline as well as the stroke footprint. Only the bend's
// small anchor dot may be shared with a leader leaving the pipe.
export function leaderCrossesPipe(a,b,pipe,anchorTolerance=2.5) {
 const d=[b[0]-a[0],b[1]-a[1]],length=Math.hypot(...d),cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
 if(length<1e-8)return false;
 for(const shape of pipe) {
  const p=shape.polygon||shape,c=[(p[0][0]+p[3][0])/2,(p[0][1]+p[3][1])/2],e=[(p[1][0]+p[2][0])/2,(p[1][1]+p[2][1])/2],v=[e[0]-c[0],e[1]-c[1]],delta=[c[0]-a[0],c[1]-a[1]],det=cross(d,v);
  if(Math.abs(det)>1e-9){const t=cross(delta,v)/det,u=cross(delta,d)/det;if(t*length>anchorTolerance&&t<1-1e-7&&u>=0&&u<=1)return true;}
  else if(Math.abs(cross(delta,d))/length<1e-6){const t0=(delta[0]*d[0]+delta[1]*d[1])/length,t1=t0+(v[0]*d[0]+v[1]*d[1])/length;if(Math.min(length,Math.max(t0,t1))>Math.max(anchorTolerance,Math.min(t0,t1))+1e-6)return true;}
 }
 return false;
}

/** Local numbered bend tags. Never stretch the drawing or create distant rails.
 * Crowded tags remain available through `unplaced` and the complete bend list.
 * `pipe` contains narrow polygons with their owning bend index, when applicable.
 */
export function referenceLayout(items,{width=900,height=540,fontSize=14,obstacles=[],pipe=[],maxLeader=28,padding=8,selectedIndex=-1}={}) {
 items=items.map((item,index)=>({...item,index:item.index??item.order??index,order:item.order??index}));
 const shape=p=>({polygon:p,box:bounds(p)}),fixed=obstacles.map(shape),pipeShapes=pipe.map(p=>({...shape(p.polygon||p),index:p.index})),occupied=[...fixed,...pipeShapes],labels=[],unplaced=[];
 const priority=item=>items.reduce((n,p)=>p.index===item.index?n:n+100/Math.max(8,distance([item.x,item.y],[p.x,p.y])),0)+fixed.reduce((n,p)=>n+160/Math.max(4,distance([item.x,item.y],[(p.box.minX+p.box.maxX)/2,(p.box.minY+p.box.maxY)/2])-Math.max(p.box.maxX-p.box.minX,p.box.maxY-p.box.minY)/2),0);
 const priorities=new Map(items.map(item=>[item,priority(item)]));
 const sorted=[...items].sort((a,b)=>(a.index===selectedIndex?-1:b.index===selectedIndex?1:0)||priorities.get(b)-priorities.get(a)||(a.order??a.index??0)-(b.order??b.index??0));
 const limit=items.length>80?60:items.length;
 let attempted=0;
 for(const item of sorted) {
  if(attempted++>=limit){unplaced.push({...item});continue;}
  const id=item.id||'B'+(item.index+1),labelLines=(Array.isArray(item.labelLines)&&item.labelLines.length?item.labelLines:[item.labelText||id]).map(String),badgeWidth=Math.max(fontSize*2.35,...labelLines.map(text=>text.length*fontSize*.64+10)),badgeHeight=fontSize*labelLines.length+8,origin=[item.x,item.y];
  const preferred=item.outward?Math.atan2(item.outward[1],item.outward[0]):-Math.PI/2;
  const fine=items.length<=32;
  const angles=fine?[0,...Array.from({length:15},(_,i)=>[(i+1)*Math.PI/16,-(i+1)*Math.PI/16]).flat(),Math.PI]:[0,Math.PI,-Math.PI/2,Math.PI/2,-Math.PI/4,Math.PI/4,-3*Math.PI/4,3*Math.PI/4,-Math.PI/8,Math.PI/8,-3*Math.PI/8,3*Math.PI/8,-5*Math.PI/8,5*Math.PI/8,-7*Math.PI/8,7*Math.PI/8];
  let best;
  for(const radius of (fine?[.95,1.1,1.25,1.4,1.6,1.8,1.95]:[.95,1.25,1.6,1.95]).map(n=>n*badgeHeight))for(const offset of angles) {
   const angle=preferred+offset,dx=Math.cos(angle),dy=Math.sin(angle),labelX=item.x+dx*radius,labelY=item.y+dy*radius;
   const polygon=rectPolygon(labelX,labelY,badgeWidth,badgeHeight),candidate=shape(polygon);
   if(!inside(polygon,width,height,padding)||occupied.some(p=>overlap(candidate,p)))continue;
   const edge=Math.min(badgeWidth/2/Math.max(1e-10,Math.abs(dx)),badgeHeight/2/Math.max(1e-10,Math.abs(dy))),end=[labelX-dx*edge,labelY-dy*edge],leaderLength=distance(origin,end);
   if(leaderLength>maxLeader||leaderLength<3)continue;
   // A leader may leave its own small bend footprint, but it must never cross
   // a different pipe leg or another reference/length label.
   const ownPipe=pipeShapes.filter(p=>p.index===item.index),otherPipe=pipeShapes.filter(p=>p.index!==item.index);
   const start=[origin[0]+dx*10,origin[1]+dy*10];
   if(leaderCrossesPipe(origin,end,pipeShapes))continue;
   if(otherPipe.some(p=>segmentMeetsPolygon(start,end,p.polygon))||fixed.some(p=>segmentMeetsPolygon(start,end,p.polygon))||labels.some(p=>segmentMeetsPolygon(start,end,p.polygon)))continue;
   let leavesOwn=true;
   for(const p of ownPipe)for(const t of [.45,.7,1]) {
    const q=[origin[0]+(end[0]-origin[0])*t,origin[1]+(end[1]-origin[1])*t];
    if(distance(origin,q)>10&&pointInside(q,p.polygon))leavesOwn=false;
   }
   if(!leavesOwn)continue;
   if(items.some(other=>other.index!==item.index&&distance([other.x,other.y],end)<4))continue;
   const score=radius+Math.abs(offset)*1.2;
   if(!best||score<best.score)best={...item,id,labelLines,labelX,labelY,width:badgeWidth,height:badgeHeight,fontSize,polygon,box:candidate.box,leader:[origin,end],leaderLength,score};
  }
  if(best){delete best.score;labels.push(best);occupied.push(shape(best.polygon));}else unplaced.push({...item});
 }
 labels.sort((a,b)=>(a.order??a.index)-(b.order??b.index));
 return {width,height,labels,unplaced};
}

export function bendReferenceLayout(arcs,project,options={}) {
 const {labelFor,...layoutOptions}=options;
 const refs=arcs.map((arc,index)=>{
  const midpoint=arc.samples[Math.floor((arc.samples.length-1)/2)],p=project(midpoint),center=arc.center?project(arc.center):null;
  const length=center?distance(p,center):0;
  const id=arc.displayId||'B'+(index+1),label=labelFor?.(arc,index,id);
  return {type:'angle',index,order:index,x:p[0],y:p[1],id,labelVisible:label!==false,...(Array.isArray(label)?{labelLines:label}:label?{labelText:String(label)}:{}),outward:length?[(p[0]-center[0])/length,(p[1]-center[1])/length]:undefined};
 });
 return {...referenceLayout(refs.filter(ref=>ref.labelVisible),layoutOptions),anchors:refs,project};
}
// Rotate only the view, never the pipe model. Prefer a wide, readable fit.
export function bestDrawingAngle(points,width=460,height=300){
 if(points.length<2)return 0;
 let best=0,bestScore=-Infinity;
 for(let degree=0;degree<180;degree++){
  const a=degree*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
  for(const [x,y]of points){const rx=x*c-y*s,ry=x*s+y*c;minx=Math.min(minx,rx);maxx=Math.max(maxx,rx);miny=Math.min(miny,ry);maxy=Math.max(maxy,ry);}
  const score=Math.min(width/Math.max(1,maxx-minx),height/Math.max(1,maxy-miny));
  if(score>bestScore*1.000001){bestScore=score;best=a;}
 }
 return best;
}
export function readableTextAngle(dx,dy){let degrees=Math.atan2(dy,dx)*180/Math.PI;if(degrees>90)degrees-=180;if(degrees< -90)degrees+=180;return degrees;}
