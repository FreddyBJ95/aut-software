import {rectPolygon,polygonsOverlap} from './dimension-layout.mjs?v=44';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const middle=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const boxOf=polygon=>({minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minY:Math.min(...polygon.map(p=>p[1])),maxY:Math.max(...polygon.map(p=>p[1]))});
const inside=(polygon,b)=>polygon.every(([x,y])=>x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY);

/** A conservative screen-space wall footprint, including its round end caps. */
export function wallSegmentFootprint(a,b,width=14) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
  return rectPolygon(...middle(a,b),length+width,width,angle);
}

/**
 * Place readable wall labels in SVG screen units. Long dimensions stay aligned
 * to their wall where space permits. Small or crowded pieces use numbered side
 * callouts; their full measurements belong in the accompanying selectable list.
 * No label is allowed to collide or escape the viewport. Very large drawings
 * may omit some SVG callouts (listed in `unplaced`); the selected one has priority.
 */
export function layoutWallLabels({segments,width,height,obstacles=[],selectedIndex=-1}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<160||height<100||!Array.isArray(segments)||segments.length>100)throw new RangeError('Invalid wall label viewport.');
  const outer={minX:4,minY:8,maxX:width-4,maxY:height-8};
  const body={minX:50,minY:10,maxX:width-50,maxY:height-10};
  const walls=segments.map(item=>{
    if(!finitePoint(item.a)||!finitePoint(item.b))throw new TypeError('Wall endpoints must be finite screen positions.');
    const anchor=middle(item.a,item.b),length=Math.hypot(item.b[0]-item.a[0],item.b[1]-item.a[1]);
    return {...item,anchor,length,width:Number.isFinite(item.width)?item.width:String(item.text).length*8+12};
  });
  const blocked=[...segments.map(s=>wallSegmentFootprint(s.a,s.b)),...obstacles.filter(p=>Array.isArray(p)&&p.length>=3&&p.every(finitePoint))];
  const dimensions=[],references=[];
  for(const item of [...walls].sort((a,b)=>b.length-a.length||a.index-b.index)) {
    if(item.length<item.width+18){references.push(item);continue;}
    const ux=(item.b[0]-item.a[0])/item.length,uy=(item.b[1]-item.a[1])/item.length;
    const preferred=finitePoint(item.outward)?item.outward:[-uy,ux];
    let angle=Math.atan2(uy,ux)*180/Math.PI;
    if(angle>90)angle-=180;if(angle<-90)angle+=180;
    let best;
    for(const offset of [24,-24,42,-42,62,-62,84,-84])for(const along of [0,20,-20,40,-40]) {
      if(Math.abs(along)>item.length/4)continue;
      const x=item.anchor[0]+preferred[0]*offset+ux*along,y=item.anchor[1]+preferred[1]*offset+uy*along;
      const polygon=rectPolygon(x,y,item.width,20,angle);
      if(!inside(polygon,body)||blocked.some(p=>polygonsOverlap(polygon,p,4)))continue;
      const score=Math.abs(offset)+Math.abs(along)*2+(offset<0?0.1:0);
      if(!best||score<best.score)best={...item,x,y,angle,polygon,box:boxOf(polygon),kind:'dimension',score,leader:Math.abs(offset)>24||along!==0?[item.anchor,[x,y]]:null};
    }
    if(best){delete best.score;dimensions.push(best);blocked.push(best.polygon);}else references.push(item);
  }

  const rowGap=28,minY=22,maxY=height-22,capacity=Math.max(1,Math.floor((maxY-minY)/rowGap)+1);
  const rails=[[],[]],unplaced=[];
  // Reserve the active wall before admitting other compact SVG references.
  for(const item of references.sort((a,b)=>(a.index===selectedIndex?-1:b.index===selectedIndex?1:0)||a.index-b.index)) {
    const preferred=item.anchor[0]<width/2?0:1;
    const side=rails[preferred].length<capacity?preferred:rails[1-preferred].length<capacity?1-preferred:-1;
    if(side<0)unplaced.push(item.index);else rails[side].push(item);
  }
  const badges=[];
  for(let side=0;side<2;side++) {
    const items=rails[side].sort((a,b)=>a.anchor[1]-b.anchor[1]||a.index-b.index);
    const ys=items.map(item=>clamp(item.anchor[1],minY,maxY));
    for(let i=1;i<ys.length;i++)ys[i]=Math.max(ys[i],ys[i-1]+rowGap);
    if(ys.at(-1)>maxY){ys[ys.length-1]=maxY;for(let i=ys.length-2;i>=0;i--)ys[i]=Math.min(ys[i],ys[i+1]-rowGap);}
    for(let i=0;i<items.length;i++) {
      const item=items[i],text=String(item.index+1),x=side?width-24:24,y=ys[i],badgeWidth=Math.max(26,text.length*7.4+12),polygon=rectPolygon(x,y,badgeWidth,22);
      if(!inside(polygon,outer)||blocked.some(p=>polygonsOverlap(polygon,p,4))){unplaced.push(item.index);continue;}
      badges.push({...item,text,width:badgeWidth,x,y,angle:0,polygon,box:boxOf(polygon),kind:'reference',leader:[item.anchor,[x+(side?-badgeWidth/2:badgeWidth/2),y]]});
      blocked.push(polygon);
    }
  }
  return {dimensions,badges,unplaced};
}

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const pointDistance=(a,b)=>Math.hypot(...subtract(a,b));
const boxesMayOverlap=(a,b,gap=0)=>!(a.maxX+gap<=b.minX||b.maxX+gap<=a.minX||a.maxY+gap<=b.minY||b.maxY+gap<=a.minY);
function polygonContains(p,polygon) {
  let sign=0;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],value=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    if(Math.abs(value)<1e-8)continue;
    if(sign&&Math.sign(value)!==sign)return false;sign=Math.sign(value);
  }
  return true;
}
function visiblePart(a,b,bounds) {
  const d=subtract(b,a);let low=0,high=1;
  for(const [p,q] of [[-d[0],a[0]-bounds.minX],[d[0],bounds.maxX-a[0]],[-d[1],a[1]-bounds.minY],[d[1],bounds.maxY-a[1]]]) {
    if(Math.abs(p)<1e-10){if(q<0)return null;continue;}
    const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);
    if(low>high)return null;
  }
  return [[a[0]+d[0]*low,a[1]+d[1]*low],[a[0]+d[0]*high,a[1]+d[1]*high]];
}
function edgeLeader(anchor,x,y,width,height,angle=0) {
  const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),dx=x-anchor[0],dy=y-anchor[1];
  const local=[dx*c+dy*s,-dx*s+dy*c],factor=Math.max(Math.abs(local[0])/(width/2),Math.abs(local[1])/(height/2));
  if(factor<=1)return null;
  return [anchor.slice(),[x-dx/factor,y-dy/factor]];
}

/**
 * Local, constant-screen-size wall annotations. Inputs must already be in
 * current viewport pixels, so another call after zoom dissolves small-feature
 * groups naturally. Each wall is represented by a badge/group, the selected
 * full dimension, or its index in unplaced (the accompanying wall list).
 * No viewport-edge rail is used; every leader is at most35 screen pixels.
 */
export function layoutLocalWallLabels({segments,width,height,obstacles=[],selectedIndex=-1}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<80||height<60||!Array.isArray(segments)||segments.length>100)throw new RangeError('Invalid local wall label viewport.');
  const bounds={minX:4,minY:4,maxX:width-4,maxY:height-4};
  const walls=segments.map((item,arrayIndex)=>{
    if(!finitePoint(item.a)||!finitePoint(item.b))throw new TypeError('Wall endpoints must be finite screen positions.');
    const index=item.index??arrayIndex;
    if(!Number.isInteger(index)||index<0)throw new TypeError('Wall indices must be nonnegative integers.');
    const length=pointDistance(item.a,item.b),unit=length>1e-10?[(item.b[0]-item.a[0])/length,(item.b[1]-item.a[1])/length]:[1,0];
    const visible=visiblePart(item.a,item.b,bounds),anchor=visible?middle(...visible):middle(item.a,item.b);
    const proposed=finitePoint(item.outward)?item.outward:[-unit[1],unit[0]],normalLength=Math.hypot(...proposed),outward=normalLength>1e-10?proposed.map(n=>n/normalLength):[-unit[1],unit[0]];
    return {...item,index,length,unit,outward,anchor,visible,extent:boxOf([item.a,item.b])};
  }).sort((a,b)=>a.index-b.index);
  if(new Set(walls.map(w=>w.index)).size!==walls.length)throw new TypeError('Wall indices must be unique.');
  const wallBlocks=walls.map(w=>{const polygon=wallSegmentFootprint(w.a,w.b);return {indices:[w.index],polygon,box:boxOf(polygon)};});
  const shapeBlocks=obstacles.map(p=>Array.isArray(p)?p:p?.polygon).filter(p=>Array.isArray(p)&&p.length>=3&&p.every(finitePoint));
  const shapeRecords=shapeBlocks.map(polygon=>({polygon,box:boxOf(polygon)}));
  const blocked=[...wallBlocks,...shapeRecords],placed=[];
  const dimensions=[],badges=[],groups=[],unplaced=[];

  function place(item,kind) {
    const dimension=kind==='dimension',indices=item.indices??[item.index],selected=indices.includes(selectedIndex);
    const text=dimension?String(item.dimensionText??item.text??`V${item.index+1}`):kind==='group'?`V${indices[0]+1}–V${indices.at(-1)+1}`:`V${item.index+1}`;
    const labelWidth=dimension?(Number.isFinite(item.width)&&item.width>0?item.width:text.length*7.4+14):Math.max(30,text.length*7+14),labelHeight=22;
    let angle=dimension?Math.atan2(item.unit[1],item.unit[0])*180/Math.PI:0;
    if(angle>90)angle-=180;if(angle<-90)angle+=180;
    const anchors=item.members??[item];let best=null;
    for(const source of anchors) {
      if(!source.visible)continue;
      for(const offset of [24,-24,32,-32,40,-40,46,-46])for(const along of [0,12,-12,22,-22]) {
        const x=source.anchor[0]+source.outward[0]*offset+source.unit[0]*along,y=source.anchor[1]+source.outward[1]*offset+source.unit[1]*along;
        const polygon=rectPolygon(x,y,labelWidth,labelHeight,angle),box=boxOf(polygon),leader=edgeLeader(source.anchor,x,y,labelWidth,labelHeight,angle);
        if(!leader||pointDistance(...leader)>35+1e-8||!inside(polygon,bounds)||blocked.some(p=>boxesMayOverlap(box,p.box,3)&&polygonsOverlap(polygon,p.polygon,3)))continue;
        const length=pointDistance(...leader),trim=Math.min(8,length),direction=subtract(leader[1],leader[0]);
        const start=length>0?[leader[0][0]+direction[0]*trim/length,leader[0][1]+direction[1]*trim/length]:leader[0];
        const leaderFootprint=wallSegmentFootprint(start,leader[1],1),leaderBox=boxOf(leaderFootprint);
        // A pointer may leave its own wall/feature or an anchor bubble. It
        // cannot cross another wall, pipe body, obstacle or existing label.
        if(wallBlocks.some(p=>!p.indices.some(i=>indices.includes(i))&&boxesMayOverlap(leaderBox,p.box)&&polygonsOverlap(leaderFootprint,p.polygon,0))||
          shapeRecords.some(p=>boxesMayOverlap(leaderBox,p.box)&&!polygonContains(source.anchor,p.polygon)&&polygonsOverlap(leaderFootprint,p.polygon,0))||placed.some(p=>boxesMayOverlap(leaderBox,p.box)&&polygonsOverlap(leaderFootprint,p.polygon,0)))continue;
        const score=Math.abs(offset)+Math.abs(along)*.6+(offset<0?2:0)+pointDistance(source.anchor,item.anchor)*.15;
        if(!best||score<best.score)best={...item,index:item.index,indices:indices.slice(),text,x,y,width:labelWidth,height:labelHeight,angle,polygon,box,kind,leader,anchor:source.anchor.slice(),selected,score,offset,along};
      }
    }
    if(!best)return null;
    delete best.score;blocked.push({polygon:best.polygon,box:best.box});placed.push(best);
    if(dimension) {
      const shift=[best.x-item.anchor[0],best.y-item.anchor[1]],normalOffset=dot(shift,item.outward);
      const a=[item.a[0]+item.outward[0]*normalOffset,item.a[1]+item.outward[1]*normalOffset],b=[item.b[0]+item.outward[0]*normalOffset,item.b[1]+item.outward[1]*normalOffset];
      best.dimensionLine=inside([a,b],bounds)?[a,b]:null;
      best.extensionLines=best.dimensionLine&&inside([item.a,item.b],bounds)?[[item.a.slice(),a],[item.b.slice(),b]]:[];
      best.ticks=best.dimensionLine?[a,b].map(p=>[[p[0]-item.outward[0]*3,p[1]-item.outward[1]*3],[p[0]+item.outward[0]*3,p[1]+item.outward[1]*3]]):[];
    }
    return best;
  }

  const selected=walls.find(w=>w.index===selectedIndex);
  if(selected){const label=place(selected,'dimension');if(label)dimensions.push(label);}
  const items=[];
  for(let i=0;i<walls.length;) {
    const run=[walls[i]],first=walls[i];let extent={...first.extent};
    while(run.at(-1).length<44&&i+run.length<walls.length) {
      const previous=run.at(-1),next=walls[i+run.length];
      if(next.index!==previous.index+1||next.length>=44||pointDistance(previous.b,next.a)>2)break;
      const proposed={minX:Math.min(extent.minX,next.extent.minX),maxX:Math.max(extent.maxX,next.extent.maxX),minY:Math.min(extent.minY,next.extent.minY),maxY:Math.max(extent.maxY,next.extent.maxY)};
      if(Math.max(proposed.maxX-proposed.minX,proposed.maxY-proposed.minY)>120||run.length>=8)break;
      run.push(next);extent=proposed;
    }
    if(run.length>1) {
      const center=[(extent.minX+extent.maxX)/2,(extent.minY+extent.maxY)/2];
      const members=run.slice().sort((a,b)=>Number(b.index===selectedIndex)-Number(a.index===selectedIndex)||pointDistance(a.anchor,center)-pointDistance(b.anchor,center));
      items.push({...members[0],indices:run.map(w=>w.index),members,extent,anchor:center});
    }else items.push({...first,indices:[first.index]});
    i+=run.length;
  }
  items.sort((a,b)=>Number(b.indices.includes(selectedIndex))-Number(a.indices.includes(selectedIndex))||a.index-b.index);
  for(const item of items) {
    if(item.indices.length===1&&dimensions.some(d=>d.index===item.index))continue;
    const group=item.indices.length>1,label=place(item,group?'group':'reference');
    if(label)(group?groups:badges).push(label);
    else unplaced.push(...item.indices.filter(index=>!dimensions.some(d=>d.index===index)));
  }
  return {dimensions,badges,groups,unplaced:unplaced.sort((a,b)=>a-b)};
}

/** Small pieces stay legible without a fixed-size arrow obscuring their nodes. */
export function wallDirectionArrow(a,b,selected=false) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<(selected?14:40))return null;
  const u=[dx/length,dy/length],n=[-u[1],u[0]],half=Math.min(6,length/8),middle=[a[0]+dx*.7,a[1]+dy*.7];
  return [[middle[0]+u[0]*half,middle[1]+u[1]*half],[middle[0]-u[0]*half*.5+n[0]*half*.5,middle[1]-u[1]*half*.5+n[1]*half*.5],[middle[0]-u[0]*half*.5-n[0]*half*.5,middle[1]-u[1]*half*.5-n[1]*half*.5]];
}
