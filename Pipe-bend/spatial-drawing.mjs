import {spatialLayerSelection} from './spatial-layers.mjs?v=44';
import {createWallViewport} from './wall-viewport.mjs?v=44';
import {placeDimensionLabels} from './dimension-layout.mjs?v=44';
import {bendVisual,bendAccessibleLabel} from './bend-visuals.mjs?v=44';
import {jointMarkerPresentation} from './joint-visuals.mjs?v=44';

const NS='http://www.w3.org/2000/svg',EPS=1e-8;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=t=>Math.max(0,Math.min(1,t));
const selectedPart=(selected,type,index)=>selected?.type===type&&selected.index===index;
const lineId=(geometry,index)=>geometry.lines[index]?.displayId||'L'+(index+1);
const bendId=(geometry,index)=>geometry.arcs[index]?.displayId||'B'+(index+1);

/** Fixed orthographic axes: no fitting rotation changes a top/height drawing. */
export function projectSpatialPoint(p,view='top',orientation){
 if(!Array.isArray(p)||p.length!==3||!p.every(finite))throw new TypeError('Expected a finite spatial point.');
 const [x,y,z]=p;
 if(view==='top')return[x,y,z];
 if(view==='front')return[x,z,-y];
 if(view==='side')return[y,z,x];
 if(view==='iso'){
  const yaw=orientation?.yaw??Math.PI/4,pitch=orientation?.pitch??Math.atan(1/Math.SQRT2);
  if(!finite(yaw)||!finite(pitch))throw new TypeError('Expected finite orbit angles.');
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  return[x*cy-y*sy,-x*sp*sy-y*sp*cy+z*cp,x*cp*sy+y*cp*cy+z*sp];
 }
 throw new RangeError('Unknown pipe view.');
}

/** Exact circular basis is resampled according to the current screen sagitta.
 * The projected circle may be an ellipse or a line; its geometry never changes. */
export function spatialArcSamples(arc,pixelsPerMm=1){
 const raw=arc?.samples;
 if(!Array.isArray(raw)||raw.length<2)return[];
 if(!arc.tangent||!arc.normal||!finite(arc.radius)||arc.radius<=0||!finite(arc.turn))return raw;
 const radians=Math.abs(arc.turn)*Math.PI/180,screenRadius=Math.max(EPS,arc.radius*Math.max(EPS,pixelsPerMm));
 const maxStep=2*Math.acos(Math.max(-1,Math.min(1,1-.22/screenRadius)));
 const count=Math.min(2048,Math.max(8,Math.ceil(radians/Math.max(.0001,Math.min(Math.PI/24,maxStep)))));
 const origin=raw[0],sign=Math.sign(arc.turn);
 return Array.from({length:count+1},(_,i)=>{
  if(i===0)return origin;if(i===count)return raw.at(-1);
  const a=radians*i/count;
  return origin.map((value,j)=>value+arc.radius*Math.sin(a)*arc.tangent[j]+sign*arc.radius*(1-Math.cos(a))*arc.normal[j]);
 });
}

export function projectSpatialGeometry(geometry,view='top',pixelsPerMm=1,orientation){
 const P=p=>projectSpatialPoint(p,view,orientation);
 return{...geometry,view,lines:geometry.lines.map((line,index)=>({...line,index,start:P(line.start),end:P(line.end)})),
  arcs:geometry.arcs.map((arc,index)=>({...arc,index,samples:spatialArcSamples(arc,pixelsPerMm).map(P)})),
  points:geometry.points.map(P),start:P(geometry.start),end:P(geometry.end)};
}

function unionIntervals(intervals){
 const result=[];
 for(const [from,to]of intervals.filter(([a,b])=>b-a>EPS).sort((a,b)=>a[0]-b[0])){
  const last=result.at(-1);if(last&&from<=last[1]+EPS)last[1]=Math.max(last[1],to);else result.push([from,to]);
 }
 return result;
}

/** Portions of each projected straight obscured by a nearer straight. A
 * crossing only dashes the covered interval, not an entire distant pipe leg. */
export function spatialLineVisibility(lines,diameter){
 const radius=Math.max(0,diameter/2),hidden=lines.map(()=>[]);
 lines.forEach((line,i)=>{
  const a=line.start,b=line.end,u=[b[0]-a[0],b[1]-a[1]],length=Math.hypot(...u);if(length<EPS)return;
  lines.forEach((other,j)=>{
   if(i===j)return;
   const c=other.start,d=other.end,v=[d[0]-c[0],d[1]-c[1]],vLength=Math.hypot(...v);if(vLength<EPS)return;
   const w=[a[0]-c[0],a[1]-c[1]],cross=(p,q)=>p[0]*q[1]-p[1]*q[0];
   const crossU=cross(u,v),crossW=cross(w,v),alongU=(u[0]*v[0]+u[1]*v[1])/(vLength*vLength),alongW=(w[0]*v[0]+w[1]*v[1])/(vLength*vLength);
   let lo=0,hi=1;
   // Clip the lower centerline to the front straight's finite cylinder band.
   function clipLinear(offset,slope,min,max){
    if(Math.abs(slope)<EPS){if(offset<min-EPS||offset>max+EPS){lo=1;hi=0;}return;}
    const t1=(min-offset)/slope,t2=(max-offset)/slope;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
   }
   clipLinear(crossW,crossU,-radius*vLength,radius*vLength);clipLinear(alongW,alongU,0,1);
   if(hi-lo<=EPS)return;
   const depthOffset=c[2]+(d[2]-c[2])*alongW-a[2],depthSlope=(d[2]-c[2])*alongU-(b[2]-a[2]);
   if(Math.abs(depthSlope)<EPS){if(depthOffset<=EPS)return;}
   else{const at=(EPS-depthOffset)/depthSlope;if(depthSlope>0)lo=Math.max(lo,at);else hi=Math.min(hi,at);}
   if(hi-lo>EPS)hidden[i].push([clamp(lo),clamp(hi)]);
  });
 });
 return hidden.map((intervals,index)=>{const obscured=unionIntervals(intervals),visible=[];let cursor=0;for(const [from,to]of obscured){if(from-cursor>EPS)visible.push([cursor,from]);cursor=Math.max(cursor,to);}if(1-cursor>EPS)visible.push([cursor,1]);return{index,visible,hidden:obscured};});
}

function selectedLineVisibility(projected,diameter,selection){
 if(!selection)return spatialLineVisibility(projected.lines,diameter);
 const active=projected.lines.map((line,index)=>({line,index})).filter(part=>selection.lines[part.index]);
 const selected=spatialLineVisibility(active.map(part=>part.line),diameter),result=projected.lines.map((_,index)=>({index,visible:[],hidden:[]}));
 active.forEach((part,index)=>{result[part.index]={...selected[index],index:part.index};});return result;
}

function segmentHit(point,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den>EPS?clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/den):.5;return{distance:distance(point,[a[0]+dx*t,a[1]+dy*t]),fraction:t,depth:a[2]+(b[2]-a[2])*t};}

/** Labels describe only geometry that can be read in this projection. An
 * orthographic length is shown only in its true plane; an end-on vertical run
 * in the top view is the explicit height-transition exception. Hidden parts
 * remain selectable, but never produce a label through a nearer tube. */
export function classifySpatialProjection(geometry,{view='top',orientation,diameter=12,pixelsPerMm=1,projected,layerSelection=null,labelMode='all',selected=null}={}){
 const p=projected||projectSpatialGeometry(geometry,view,pixelsPerMm,orientation),visibility=selectedLineVisibility(p,diameter,layerSelection),radius=Math.max(0,diameter/2);
 const occluders=[];
 const add=(a,b,key)=>occluders.push({a,b,key,minX:Math.min(a[0],b[0])-radius,maxX:Math.max(a[0],b[0])+radius,minY:Math.min(a[1],b[1])-radius,maxY:Math.max(a[1],b[1])+radius});
 p.lines.forEach((line,index)=>{if(!layerSelection||layerSelection.lines[index])add(line.start,line.end,'L'+index);});
 // Bounds before segment-distance checks keep the ordinary long-pipe case
 // cheap. The sampled curves use the same precision as the visible path.
 geometry.arcs.forEach((arc,index)=>{if(layerSelection&&!layerSelection.arcs[index])return;const curve=spatialArcSamples(arc,.22/Math.max(EPS,diameter/24)).map(point=>projectSpatialPoint(point,view,orientation));for(let i=1;i<curve.length;i++)add(curve[i-1],curve[i],'B'+index);});
 // Occlusion precision is tied to tube width, not zoom. A bounded spatial grid
 // avoids scanning every adaptive bend segment for each visible annotation.
 let minX=0,maxX=0,minY=0,maxY=0;for(const part of occluders){minX=Math.min(minX,part.minX);maxX=Math.max(maxX,part.maxX);minY=Math.min(minY,part.minY);maxY=Math.max(maxY,part.maxY);}
 const cellSize=Math.max(EPS,diameter,(maxX-minX)/32,(maxY-minY)/32),grid=new Map(),cellKey=(x,y)=>x+','+y;
 for(const part of occluders)for(let x=Math.floor(part.minX/cellSize);x<=Math.floor(part.maxX/cellSize);x++)for(let y=Math.floor(part.minY/cellSize);y<=Math.floor(part.maxY/cellSize);y++){const key=cellKey(x,y);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(part);}
 function exposed(point,key){
  const excluded=Array.isArray(key)?key:[key];
  for(const part of grid.get(cellKey(Math.floor(point[0]/cellSize),Math.floor(point[1]/cellSize)))||[]){
   if(excluded.includes(part.key)||point[0]<part.minX||point[0]>part.maxX||point[1]<part.minY||point[1]>part.maxY)continue;
   const hit=segmentHit(point,part.a,part.b);
   if(hit.distance<=radius+EPS&&hit.depth>point[2]+Math.max(EPS,diameter*1e-7))return false;
  }
  return true;
 }
 const lines=p.lines.map((line,index)=>{
  if(layerSelection&&!layerSelection.lines[index])return{index,kind:'length',collapsed:false,trueLength:false,projectedLength:distance(line.start,line.end),visible:false,readable:false,annotate:false,anchorInterval:null};
  const original=geometry.lines[index],length=Math.hypot(...original.end.map((v,i)=>v-original.start[i])),projectedLength=distance(line.start,line.end),collapsed=projectedLength<=Math.max(EPS,length*1e-8),trueLength=Math.abs(line.end[2]-line.start[2])<=Math.max(EPS,length*1e-7);
  const rise=view==='top'&&collapsed&&Math.abs(original.end[2]-original.start[2])>EPS;
  const intervals=visibility[index].visible.slice().sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
  let anchorInterval=null;
  if(rise){const upper=line.start[2]>=line.end[2]?line.start:line.end;if(exposed(upper,['L'+index,'B'+(index-1),'B'+index]))anchorInterval=[0,1];}
  else for(const interval of intervals){if([.2,.5,.8].some(fraction=>exposed(mix(line.start,line.end,interval[0]+fraction*(interval[1]-interval[0])),'L'+index))){anchorInterval=interval;break;}}
  const readable=rise||(!collapsed&&(view==='iso'||trueLength));
  return{index,kind:rise?'rise':'length',collapsed,trueLength,projectedLength,visible:!!anchorInterval,readable,annotate:readable&&!!anchorInterval,anchorInterval};
 });
 const arcs=p.arcs.map((arc,index)=>{
  if(layerSelection&&!layerSelection.arcs[index])return{index,facing:0,readable:false,visible:false,annotate:false,anchor:null};
  const original=geometry.arcs[index],normal=original.binormal||[original.tangent[1]*original.normal[2]-original.tangent[2]*original.normal[1],original.tangent[2]*original.normal[0]-original.tangent[0]*original.normal[2],original.tangent[0]*original.normal[1]-original.tangent[1]*original.normal[0]];
  const facing=Math.abs(projectSpatialPoint(normal,view,orientation)[2])/Math.hypot(...normal);
  // Below this ellipse ratio the bend is practically edge-on: its badge would
  // suggest a readable corner where the drawing only shows a straight line.
  const readable=facing>=.15;
  const candidates=[.5,.4,.6,.3,.7,.2,.8,.1,.9].map(fraction=>arc.samples[Math.round(fraction*(arc.samples.length-1))]);
  const visible=readable&&candidates.some(point=>exposed(point,'B'+index));
  const anchor=readable?candidates.find(point=>exposed(point,'B'+index))||arc.samples[Math.floor(arc.samples.length/2)]:null;
  return{index,facing,readable,visible,annotate:readable&&visible,anchor};
 });
 if(labelMode==='tap'){
  for(const part of lines){const chosen=selectedPart(selected,'length',part.index)&&(!layerSelection||layerSelection.lines[part.index]);part.annotate=chosen;if(chosen){part.visible=true;part.readable=true;part.anchorInterval=part.anchorInterval||[0,1];}}
  for(const part of arcs){const chosen=selectedPart(selected,'angle',part.index)&&(!layerSelection||layerSelection.arcs[part.index]);part.annotate=chosen;if(chosen){part.visible=true;part.readable=true;part.anchor=part.anchor||p.arcs[part.index].samples[Math.floor(p.arcs[part.index].samples.length/2)];}}
 }
 return{view,lines,arcs,isExposed:exposed};
}

/** Screen point picking stays independent of SVG paint order and orientation. */
export function pickSpatialParts(projected,point,{pixelsPerMm=1,tolerance=22,diameter=0,layerSelection=null}={}){
 if(!projected||!Array.isArray(point)||!point.slice(0,2).every(finite)||!finite(pixelsPerMm)||pixelsPerMm<=0)return[];
 const hits=[],limit=Math.max(tolerance,diameter*pixelsPerMm/2+4);
 for(const [index,line]of projected.lines.entries()){if(layerSelection&&!layerSelection.lines[index])continue;const hit=segmentHit(point,line.start,line.end);if(hit.distance*pixelsPerMm<=limit)hits.push({type:'length',index,distancePx:hit.distance*pixelsPerMm,depth:hit.depth});}
 for(const [index,arc]of projected.arcs.entries()){
  if(layerSelection&&!layerSelection.arcs[index])continue;
  let best=null;for(let i=1;i<arc.samples.length;i++){const hit=segmentHit(point,arc.samples[i-1],arc.samples[i]);if(!best||hit.distance<best.distance)best=hit;}
  if(best&&best.distance*pixelsPerMm<=limit)hits.push({type:'angle',index,distancePx:best.distance*pixelsPerMm,depth:best.depth});
 }
 hits.sort((a,b)=>a.distancePx-b.distancePx||b.depth-a.depth||a.index-b.index);
 if(!hits.length)return[];
 // Offer alternatives only where their projections really compete, not every
 // neighbouring bend within a finger-sized touch target.
 return hits.filter(hit=>hit.distancePx<=hits[0].distancePx+3).sort((a,b)=>b.depth-a.depth||a.distancePx-b.distancePx);
}

/** Separate actual level rise from the input convention for a vertical leg.
 * Tangent lengths exclude the adjoining arcs; two horizontal levels include
 * their height contribution. Nothing is added to an obstacle clearance. */
export function spatialRiseLabelData(geometry,index){
 const line=geometry?.lines?.[index];if(!line)return null;
 const zero=geometry.start?.[2]??0,previous=geometry.lines[index-1],next=geometry.lines[index+1];
 const dimensionStart=(line.dimensionStart||line.start)[2]-zero,dimensionEnd=(line.dimensionEnd||line.end)[2]-zero;
 const vertical=Math.hypot(line.end[0]-line.start[0],line.end[1]-line.start[1])<1e-7;
 const horizontal=part=>part&&Math.abs(part.end[2]-part.start[2])<1e-7;
 const levelStart=vertical&&horizontal(previous)&&horizontal(next)?previous.end[2]-zero:dimensionStart;
 const levelEnd=vertical&&horizontal(previous)&&horizontal(next)?next.start[2]-zero:dimensionEnd;
 const rise=levelEnd-levelStart,dimension=line.dimension??line.length;
 return{start:levelStart,end:levelEnd,rise,dimension,showSeparateDimension:Math.abs(Math.abs(rise)-dimension)>1e-6};
}

function node(svg,tag,attrs,parent,text){const item=svg.ownerDocument.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs||{}))item.setAttribute(key,String(value));if(text!==undefined)item.textContent=text;(parent||svg).append(item);return item;}
function rect(x,y,w,h){return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];}
function footprint(a,b,r){const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<EPS)return rect(a[0]-r,a[1]-r,2*r,2*r);const nx=-dy/length*r,ny=dx/length*r;return[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];}
function polyline(points,map){return points.map((p,i)=>`${i?'L':'M'} ${map(p).slice(0,2).join(' ')}`).join(' ');}
function inView(p,width,height,margin=24){return p[0]>=-margin&&p[0]<=width+margin&&p[1]>=-margin&&p[1]<=height+margin;}
function clippedLine(a,b,width,height,padding=20){let from=0,to=1;const d=[b[0]-a[0],b[1]-a[1]];for(const [p,q]of [[-d[0],a[0]-padding],[d[0],width-padding-a[0]],[-d[1],a[1]-padding],[d[1],height-padding-a[1]]]){if(Math.abs(p)<EPS){if(q<0)return null;continue;}const t=q/p;if(p<0)from=Math.max(from,t);else to=Math.min(to,t);if(from>to)return null;}return[mix(a,b,from),mix(a,b,to)];}
function signedHeight(value,format){const rounded=Math.abs(value)<1e-7?0:value;return(rounded>0?'+':'')+format(rounded);}

function layoutFrame(svg,geometry,settings,width,height){
 const projected=projectSpatialGeometry(geometry,settings.view||'top',1,settings.orbit),diameter=settings.diameter||12,padding=64;
 const xs=projected.points.map(p=>p[0]),ys=projected.points.map(p=>p[1]);if(!xs.length){xs.push(0);ys.push(0);}
 const minx=Math.min(...xs)-diameter/2,maxx=Math.max(...xs)+diameter/2,miny=Math.min(...ys)-diameter/2,maxy=Math.max(...ys)+diameter/2;
 const scale=Math.min(Math.max(20,width-2*padding)/Math.max(diameter,maxx-minx),Math.max(20,height-2*padding)/Math.max(diameter,maxy-miny));
 const frame={svg,geometry,settings,projected,width,height,scale,center:[(minx+maxx)/2,(miny+maxy)/2]};
 frame.P=p=>[width/2+(p[0]-frame.center[0])*scale,height/2-(p[1]-frame.center[1])*scale,p[2]];return frame;
}

function paintTube(frame,group,pixelsPerUnit=1,preview=null){
 const {svg,geometry,settings,scale,P}=frame,projected=projectSpatialGeometry(geometry,settings.view||'top',scale*pixelsPerUnit,settings.orbit),diameter=settings.diameter||12;
 frame.projected=projected;
 const selection=settings.layerSelection,visibility=selectedLineVisibility(projected,diameter,selection),parts=[];
 for(const [i,line]of projected.lines.entries()){
  if(selection&&!selection.lines[i])continue;
  const visible=visibility[i].visible;
  if(distance(line.start,line.end)<EPS)parts.push({type:'length',index:i,points:[line.start,line.end],depth:(line.start[2]+line.end[2])/2,collapsed:true});
  else for(const interval of visible){const points=interval.map(t=>mix(line.start,line.end,t));parts.push({type:'length',index:i,points,depth:(points[0][2]+points[1][2])/2});}
 }
 for(const [i,arc]of projected.arcs.entries())if(!selection||selection.arcs[i])parts.push({type:'angle',index:i,points:arc.samples,depth:arc.samples.reduce((sum,p)=>sum+p[2],0)/arc.samples.length});
 parts.sort((a,b)=>a.depth-b.depth);
 const width=Math.max(diameter*scale,settings.overviewStroke||0),inner=Math.max(0,width-(settings.overviewStroke?4:2/Math.max(EPS,pixelsPerUnit)));
 if(preview){const projection=projectSpatialGeometry(preview,settings.view||'top',scale*pixelsPerUnit,settings.orbit);let delta=[0,0,0];
  if(settings.end==='A'&&preview.lines[1]){const anchor=preview.lines[1].dimensionStart||preview.lines[1].start,old=geometry.lines[0].dimensionStart||geometry.lines[0].start;delta=projectSpatialPoint(old.map((value,i)=>value-anchor[i]),settings.view||'top',settings.orbit);}
  const previewPoint=p=>P(p.map((value,i)=>value+delta[i]));
  for(const line of projection.lines)node(svg,'path',{d:polyline([line.start,line.end],previewPoint),fill:'none',stroke:'#8dbba8','stroke-width':1.5,'vector-effect':'non-scaling-stroke','stroke-dasharray':'6 5',opacity:.55,'data-spatial-preview':''},group);for(const arc of projection.arcs)node(svg,'path',{d:polyline(arc.samples,previewPoint),fill:'none',stroke:'#8dbba8','stroke-width':1.5,'vector-effect':'non-scaling-stroke','stroke-dasharray':'6 5',opacity:.55,'data-spatial-preview':''},group);}
 for(const part of parts){
	 const displayId=part.type==='length'?lineId(geometry,part.index):bendId(geometry,part.index),selected=selectedPart(settings.selected,part.type,part.index),visual=part.type==='angle'?bendVisual(geometry.arcs[part.index].turn):null,accessible=visual?bendAccessibleLabel(displayId,geometry.arcs[part.index].turn):null,attrs={'data-spatial-part':displayId,'data-length-id':part.type==='length'?displayId:undefined,'data-bend-id':part.type==='angle'?displayId:undefined,'data-bend-color':visual?.key,'data-bend-kind':visual?(visual.standard?'standard':'special'):undefined,'aria-label':accessible||undefined};for(const key of Object.keys(attrs))if(attrs[key]===undefined)delete attrs[key];
  if(part.collapsed){const p=P(part.points[0]);node(svg,'circle',{...attrs,cx:p[0],cy:p[1],r:width/2,fill:selected?'#f3d8ac':'#deeee7',stroke:selected?'#b56a12':'#699581','stroke-width':1,'vector-effect':'non-scaling-stroke'},group);continue;}
  const d=polyline(part.points,P);
  if(width*pixelsPerUnit<1.5)node(svg,'path',{d,fill:'none',stroke:visual?.stroke||'#699581','stroke-width':1.25,'vector-effect':'non-scaling-stroke'},group);
	 if(visual&&settings.compactOverview)node(svg,'path',{'data-bend-emphasis':displayId,d,fill:'none',stroke:visual.stroke,'stroke-width':width+6,'stroke-linejoin':'round','stroke-linecap':'round',opacity:.26},group);
  if(selected&&visual)node(svg,'path',{d,fill:'none',stroke:'#b56a12','stroke-width':width+4,'stroke-linejoin':'round','stroke-linecap':'butt'},group);
	 const body=node(svg,'path',{...attrs,d,fill:'none',stroke:visual?.stroke||(selected?'#b56a12':'#91ad9f'),'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'butt'},group);if(accessible)node(svg,'title',{},body,accessible);
	 if(inner>0)node(svg,'path',{d,fill:'none',stroke:visual?.tube||(selected?'#f5e4c9':'#deeee7'),'stroke-width':inner,'stroke-linejoin':'round','stroke-linecap':'butt'},group);
  if(width*pixelsPerUnit>=8)node(svg,'path',{d,fill:'none',stroke:visual?.stroke||'#477963','stroke-width':visual?1.2:.65,'vector-effect':'non-scaling-stroke','stroke-dasharray':visual?.dash||'4 5'},group);
 }
 // Hidden portions are a symbolic centreline over the upper tube. Keeping the
 // same coordinates is essential: a level change never shifts the plan drawing.
 for(const [i,entry]of visibility.entries())for(const interval of entry.hidden){node(svg,'path',{'data-spatial-hidden':'L'+(i+1),d:polyline(interval.map(t=>mix(projected.lines[i].start,projected.lines[i].end,t)),P),fill:'none',stroke:'#426b63','stroke-width':1.5,'vector-effect':'non-scaling-stroke','stroke-dasharray':'4 4'},group);}
}

function paintAnnotations(frame,group,camera,{format=String,formatAngle=format,translate=s=>s,onEdit=()=>{},onEndpoint=()=>{},onJoint=()=>{},interactive=true}={}){
 const {svg,geometry:g,settings,projected,P,scale}=frame,density=camera.pixelsPerUnit||1,width=camera.screenWidth||camera.width,height=camera.screenHeight||camera.height;
 const toScreen=p=>[(p[0]-camera.x)*density+width/2,(p[1]-camera.y)*density+height/2],project=p=>toScreen(P(p));
 const topLeft=[camera.x-width/2/density,camera.y-height/2/density];group.setAttribute('transform',`translate(${topLeft[0]} ${topLeft[1]}) scale(${1/density})`);
 const guides=node(svg,'g',{'data-layer':'spatial-guides','pointer-events':'none'},group),labels=node(svg,'g',{'data-layer':'spatial-labels'},group),ends=node(svg,'g',{'data-layer':'spatial-ends'},group);
	 const labelScale=settings.annotationScale||1,obstacles=[],pipeWidth=Math.max(1,(settings.diameter||12)*scale*density/2,(settings.overviewStroke||0)*density/2),items=[],inlineBends=[],heightZero=g.start[2],classification=classifySpatialProjection(g,{view:settings.view||'top',orientation:settings.orbit,diameter:settings.diameter||12,pixelsPerMm:scale*density,projected,layerSelection:settings.layerSelection,labelMode:settings.labelMode,selected:settings.selected});
 for(const [index,line]of projected.lines.entries()){if(settings.layerSelection&&!settings.layerSelection.lines[index])continue;const a=project(line.start),b=project(line.end);if(clippedLine(a,b,width,height,-pipeWidth))obstacles.push(footprint(a,b,pipeWidth+2));}
 for(const [index,arc]of projected.arcs.entries()){if(settings.layerSelection&&!settings.layerSelection.arcs[index])continue;const stride=Math.max(1,Math.floor(arc.samples.length/60));for(let i=1;i<arc.samples.length;i+=stride){const a=project(arc.samples[i-1]),b=project(arc.samples[Math.min(i+stride-1,arc.samples.length-1)]);if(clippedLine(a,b,width,height,-pipeWidth))obstacles.push(footprint(a,b,pipeWidth+2));}}
 const endpointPositions=projected.start&&projected.end?[settings.layerSelection&&!settings.layerSelection.startVisible?null:project(projected.start),settings.layerSelection&&!settings.layerSelection.endVisible?null:project(projected.end)]:[];
 for(const p of endpointPositions)if(p&&inView(p,width,height))obstacles.push(rect(p[0]-20,p[1]-20,40,40));
 let startReference=null;
 const startFrame=g.lineFrames?.[0]||g.lines[0]?.frame,startPoint=endpointPositions[0];
 if(startFrame&&startPoint&&inView(startPoint,width,height,0)){
  const projectedNormal=projectSpatialPoint(startFrame.normal,settings.view||'top',settings.orbit),normalLength=Math.hypot(projectedNormal[0],projectedNormal[1]);
  const u=normalLength>1e-6?[projectedNormal[0]/normalLength,-projectedNormal[1]/normalLength]:[1,0],origin=startPoint;
  const end=[origin[0]+u[0]*46,origin[1]+u[1]*46],label=[origin[0]+u[0]*58,origin[1]+u[1]*58];
  if(inView(label,width,height,-10)){
   startReference={origin,end,label,u,collapsed:normalLength<1e-6,depth:projectedNormal[2]};
   obstacles.push(rect(Math.min(origin[0],label[0])-15,Math.min(origin[1],label[1])-12,Math.abs(origin[0]-label[0])+30,Math.abs(origin[1]-label[1])+24));
  }
 }
 function editable(item,type,index){if(!interactive)return;item.setAttribute('role','button');item.setAttribute('tabindex','0');item.onclick=event=>{event.stopPropagation?.();onEdit(type,index);};item.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onEdit(type,index);}};}
 for(const [index,line]of projected.lines.entries()){
  const eligibility=classification.lines[index];if(!eligibility.annotate)continue;
  const interval=eligibility.anchorInterval||[0,1],a=project(mix(line.start,line.end,interval[0])),b=project(mix(line.start,line.end,interval[1]));let visible=clippedLine(a,b,width,height);if(!visible)continue;
  // Anchor a partially visible length on an exposed portion in this camera,
  // including when an arc rather than a straight is the nearer occluder.
  if(!eligibility.collapsed&&settings.labelMode!=='tap'){
   const fullA=project(line.start),fullB=project(line.end),probes=[.5,.2,.8].map(fraction=>mix(visible[0],visible[1],fraction)),anchor=probes.find(point=>{const fraction=segmentHit(point,[...fullA,line.start[2]],[...fullB,line.end[2]]).fraction;return classification.isExposed(mix(line.start,line.end,fraction),'L'+index);});
   if(!anchor)continue;
   const span=distance(...visible),u=span>EPS?[(visible[1][0]-visible[0][0])/span,(visible[1][1]-visible[0][1])/span]:[1,0],half=Math.min(distance(anchor,visible[0]),distance(anchor,visible[1]));visible=[[anchor[0]-u[0]*half,anchor[1]-u[1]*half],[anchor[0]+u[0]*half,anchor[1]+u[1]*half]];
  }
  const original=g.lines[index],displayId=lineId(g,index),riseData=spatialRiseLabelData(g,index),zStart=riseData.start,zEnd=riseData.end;
  const collapsed=eligibility.collapsed,delta=riseData.rise,base=((settings.showReferenceIds||selectedPart(settings.selected,'length',index))?displayId+' · ':'')+format(original.dimension??original.length)+' mm';
  let heightText=Math.abs(delta)<1e-6?'H '+signedHeight(zStart,format)+' mm':'H '+signedHeight(zStart,format)+' → '+signedHeight(zEnd,format)+' mm';
  if(settings.labelMode!=='tap'&&(settings.layerSelection||(settings.compactOverview&&Math.abs(delta)<1e-6&&Math.abs(zStart)<1e-6)))heightText=null;
  let text=base,dimensionText=null;
  if(collapsed&&settings.view==='top'&&Math.abs(delta)>1e-6){text=((settings.showReferenceIds||settings.labelMode==='tap')?displayId+' · ':'')+(delta>0?'⊙ ':'⊗ ')+translate(delta>0?'Op':'Ned')+' '+format(Math.abs(delta))+' mm';if(riseData.showSeparateDimension)dimensionText=displayId+' · '+format(riseData.dimension)+' mm';}
  const maxLength=Math.max(text.length,heightText?.length||0,dimensionText?.length||0),labelWidth=Math.min(width-24,Math.max(70*labelScale,maxLength*6.8*labelScale+16*labelScale));
  items.push({id:displayId,type:'length',index,a:visible[0],b:visible[1],text,heightText,dimensionText,width:labelWidth,height:(dimensionText?56:heightText?40:26)*labelScale,angle:0,collapsed,priority:selectedPart(settings.selected,'length',index)?0:collapsed?1:2});
  if(collapsed&&settings.view==='top'&&Math.abs(delta)>1e-6){const point=project(line.start),symbol=node(svg,'g',{'data-height-transition':displayId},labels);node(svg,'circle',{cx:point[0],cy:point[1],r:9,fill:'#fff',stroke:'#226d54','stroke-width':1.5},symbol);if(delta>0)node(svg,'circle',{cx:point[0],cy:point[1],r:3,fill:'#226d54'},symbol);else{node(svg,'path',{d:`M ${point[0]-3} ${point[1]-3} l 6 6 M ${point[0]-3} ${point[1]+3} l 6 -6`,stroke:'#226d54','stroke-width':1.5},symbol);}editable(symbol,'length',index);}
 }
 for(const [index,arc]of projected.arcs.entries()){
  const eligibility=classification.arcs[index];if(!eligibility.annotate)continue;
  let p=project(eligibility.anchor);if(settings.labelMode==='tap'&&!inView(p,width,height,0)){const visiblePoint=arc.samples.find(point=>inView(project(point),width,height,8));if(visiblePoint)p=project(visiblePoint);}if(!inView(p,width,height,0))continue;
  const id=bendId(g,index),detail=settings.labelMode==='tap',original=g.arcs[index],visual=bendVisual(original.turn),text=id,angleText=formatAngle(Math.abs(original.turn))+'°',bendText=visual.standard?angleText:translate('SPECIAL')+' · '+angleText,accessibleLabel=bendAccessibleLabel(id,original.turn,{format:formatAngle,special:translate('SPECIAL')});
	 if(visual.standard&&!detail){inlineBends.push({id,index,p,visual,accessibleLabel});obstacles.push(rect(p[0]-15*labelScale,p[1]-11*labelScale,30*labelScale,22*labelScale));continue;}
  const z0=original.samples[0][2]-heightZero,z1=original.samples.at(-1)[2]-heightZero,heightText=detail?'H '+signedHeight(z0,format)+(Math.abs(z1-z0)>1e-6?' → '+signedHeight(z1,format):'')+' mm':null;
  items.push({id,type:'angle',index,a:p,b:p,text,bendText,heightText,visual,accessibleLabel,width:Math.max(42,Math.max(text.length*8,bendText.length*6.8,heightText?heightText.length*6.8:0)+16)*labelScale,height:(heightText?58:42)*labelScale,angle:0,priority:selectedPart(settings.selected,'angle',index)?0:3});
 }

 for(const transition of settings.labelMode==='tap'?[]:settings.layerSelection?.transitions||[]){
  const point=project(projectSpatialPoint(transition.anchor,settings.view||'top',settings.orbit));if(!inView(point,width,height,0))continue;
  const originalBendId=bendId(g,transition.bendIndex),id=transition.id||originalBendId+':'+transition.pipeDirection,up=transition.direction==='up',glyph=node(svg,'g',{'data-layer-transition':id,'data-height-transition':id,'data-transition-from':transition.from,'data-transition-to':transition.to},labels);
  node(svg,'title',{},glyph,originalBendId+' · '+translate(up?'Op':'Ned')+' · H '+signedHeight(transition.from,format)+' → '+signedHeight(transition.to,format)+' mm');
  node(svg,'circle',{cx:point[0],cy:point[1],r:9,fill:'#fff',stroke:'#226d54','stroke-width':1.5},glyph);
  if(up)node(svg,'circle',{cx:point[0],cy:point[1],r:3,fill:'#226d54'},glyph);
  else node(svg,'path',{d:`M ${point[0]-3} ${point[1]-3} l 6 6 M ${point[0]-3} ${point[1]+3} l 6 -6`,stroke:'#226d54','stroke-width':1.5},glyph);
  const firstHeight=transition.viaHeight??transition.to,levels=[transition.from,...(transition.viaHeight!==undefined?[transition.viaHeight]:[]),transition.to,...(transition.returnTo!==undefined?[transition.returnTo]:[])];
  const text=(up?'⊙ ':'⊗ ')+translate(up?'Op':'Ned')+' '+format(Math.abs(firstHeight-transition.from))+' mm',heightText='H '+levels.map(height=>signedHeight(height,format)).join(' → ')+' mm';
  items.push({id:'T'+id,type:'transition',index:transition.bendIndex,accessibleId:originalBendId,a:point,b:point,text,heightText,width:Math.min(width-24,Math.max(70*labelScale,Math.max(text.length,heightText.length)*6.8*labelScale+16*labelScale)),height:40*labelScale,angle:0,priority:1});
 }
 items.sort((a,b)=>a.priority-b.priority||distance(b.a,b.b)-distance(a.a,a.b));
	const totalLabels=items.length+inlineBends.length;
 const placed=placeDimensionLabels(items,obstacles,{x:8,y:8,w:width-16,h:height-16},{allowOmissions:true,localFallback:items.length<45,acceptCandidate:c=>c.box.x>=8&&c.box.y>=8&&c.box.x+c.box.w<=width-8&&c.box.y+c.box.h<=height-8&&Math.hypot(c.x-(c.a[0]+c.b[0])/2,c.y-(c.a[1]+c.b[1])/2)<=110*labelScale});
 const heightDatumLabel=settings.heightDatumLabel??translate('Højde fra A');
	const placedIds=new Set(placed.map(label=>label.id));for(const item of items)if(item.type==='angle'&&!placedIds.has(item.id))inlineBends.push({id:item.id,index:item.index,p:item.a,visual:item.visual,accessibleLabel:item.accessibleLabel,labelText:item.id+' · '+item.bendText});
	for(const tag of inlineBends){const item=node(svg,'g',{'data-focus-key':tag.id,'data-bend-id':tag.id,'data-bend-code':tag.visual.key,'data-bend-kind':tag.visual.standard?'standard':'special','data-spatial-inline-bend':tag.id,'aria-label':tag.accessibleLabel},labels);node(svg,'title',{},item,tag.accessibleLabel);node(svg,'text',{x:tag.p[0],y:tag.p[1]+4*labelScale,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':(tag.visual.standard?10.5:9.5)*labelScale,'font-weight':800,fill:tag.visual.text,'paint-order':'stroke',stroke:'#fff','stroke-width':3.2*labelScale,'stroke-linejoin':'round'},item,tag.labelText||tag.id);editable(item,'angle',tag.index);}
 for(const label of placed){
  const isBend=label.type==='angle',visual=isBend?label.visual:null,anchor=[(label.a[0]+label.b[0])/2,(label.a[1]+label.b[1])/2],selected=selectedPart(settings.selected,label.type,label.index),dx=anchor[0]-label.x,dy=anchor[1]-label.y,factor=Math.min(1,label.width/2/Math.max(EPS,Math.abs(dx)),label.height/2/Math.max(EPS,Math.abs(dy)));
  node(svg,'line',{x1:anchor[0],y1:anchor[1],x2:label.x+dx*factor,y2:label.y+dy*factor,stroke:visual?.stroke||'#8ba699','stroke-width':isBend?1.25:1},guides);
  const labelName=isBend?label.accessibleLabel:label.type==='length'&&!settings.showReferenceIds?(label.accessibleId||label.id)+' · '+label.text:label.text,attrs={'data-focus-key':label.id,'data-reference':label.id,'data-spatial-label':label.id,'aria-label':labelName+(label.heightText?' · '+heightDatumLabel+' · '+label.heightText:'')};
  if(label.type==='length')attrs['data-length']=label.id;else if(label.type==='angle')attrs['data-bend-id']=label.id;else attrs['data-spatial-layer-transition-label']=label.id;
  if(isBend){attrs['data-bend-code']=visual.key;attrs['data-bend-kind']=visual.standard?'standard':'special';}
  const item=node(svg,'g',attrs,labels);node(svg,'title',{},item,attrs['aria-label']);const box={x:label.x-label.width/2,y:label.y-label.height/2,width:label.width,height:label.height,rx:isBend?12:5,fill:visual?.fill||'#fff',stroke:visual?.stroke||'#b7c9be','stroke-width':selected?2.4:isBend?1.2:.8};if(visual?.dash)box['stroke-dasharray']=visual.dash;node(svg,'rect',box,item);
  node(svg,'text',{x:label.x,y:label.y+(isBend?(label.heightText?-12:-4):(label.dimensionText?-11:label.heightText?-3:4.5))*labelScale,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':(isBend?13:12)*labelScale,'font-weight':isBend?700:600,fill:visual?.text||'#176748'},item,label.text);
  if(isBend)node(svg,'text',{'data-bend-angle':label.id,x:label.x,y:label.y+(label.heightText?5:13)*labelScale,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':10.5*labelScale,'font-weight':600,fill:visual.text},item,label.bendText);
  if(label.dimensionText)node(svg,'text',{'data-spatial-input-dimension':label.id,x:label.x,y:label.y+4*labelScale,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':11*labelScale,fill:'#176748'},item,label.dimensionText);
  if(label.heightText)node(svg,'text',{'data-height-label':label.id,'aria-label':heightDatumLabel+' · '+label.heightText,x:label.x,y:label.y+(isBend?21:label.dimensionText?19:12)*labelScale,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':10.5*labelScale,fill:'#55776a'},item,label.heightText);
  if(label.type!=='transition')editable(item,label.type,label.index);
 }
 for(const [index,letter]of ['A','B'].entries()){
  const displayLabel=settings.endpointLabels?.[index]||letter,staticEndpointLabel=displayLabel==='K'?'K · '+translate('fysisk kapende'):displayLabel.startsWith('S')?displayLabel+' · '+translate('DELING'):displayLabel;
	 if(!interactive&&displayLabel.startsWith('S'))continue;
  const p=endpointPositions[index];if(!p||!inView(p,width,height))continue;
  const same=endpointPositions.length===2&&endpointPositions.every(Boolean)&&distance(...endpointPositions)<35,offset=same?(index===0?-18:18):0;
  if(offset)node(svg,'line',{x1:p[0],y1:p[1],x2:p[0]+offset,y2:p[1],stroke:'#416b60','stroke-width':1},guides);
  const endpoint=node(svg,'g',{'data-endpoint':letter,'data-focus-key':'end:'+letter,'aria-label':interactive?translate('Tilføj buk ved ende ')+letter:staticEndpointLabel},ends);
  node(svg,'circle',{cx:p[0]+offset,cy:p[1],r:22,fill:'transparent'},endpoint);node(svg,'circle',{cx:p[0]+offset,cy:p[1],r:15,fill:letter===settings.end?'#16815d':'#183c36',stroke:'#fff','stroke-width':2.5},endpoint);node(svg,'text',{x:p[0]+offset,y:p[1]+4.5,'text-anchor':'middle',fill:'#fff','font-size':displayLabel.length>2?10:13,'font-weight':700},endpoint,displayLabel);
  if(interactive){endpoint.setAttribute('role','button');endpoint.setAttribute('tabindex','0');endpoint.onclick=event=>{event.stopPropagation?.();onEndpoint(letter);};endpoint.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onEndpoint(letter);}};}
 }
 for(const [jointIndex,joint]of (settings.joints||[]).entries()){
  if(settings.layerSelection&&!settings.layerSelection.lines[joint.lineIndex])continue;
  const originalLine=g.lines[joint.lineIndex],projectedLine=projected.lines[joint.lineIndex];if(!originalLine||!projectedLine)continue;
  const fraction=joint.distance/originalLine.length,projectedPoint=mix(projectedLine.start,projectedLine.end,fraction),point=project(projectedPoint);if(!inView(point,width,height,72))continue;
	 const a=project(projectedLine.start),b=project(projectedLine.end),projectedLength=Math.hypot(b[0]-a[0],b[1]-a[1]),collapsed=projectedLength<10,u=collapsed?[1,0]:[(b[0]-a[0])/projectedLength,(b[1]-a[1])/projectedLength],n=[-u[1],u[0]],presentation=jointMarkerPresentation(camera.zoom,{interactive}),fullText=joint.workLabel||joint.id+' · '+translate('DELING'),text=presentation.compact?joint.id:fullText,pillHeight=presentation.compact?20:26,pillWidth=Math.max(presentation.compact?36:96,text.length*(presentation.compact?6:7)+(presentation.compact?14:20)),side=point[0]>width*.58?-1:1,lane=joint.workLane??jointIndex,laneOffset=(lane%2?-1:1)*((presentation.compact?21:30)+Math.floor(lane/2)*(presentation.compact?20:28)),labelX=Math.max(pillWidth/2+8,Math.min(width-pillWidth/2-8,point[0]+side*(pillWidth/2+(presentation.compact?14:26)))),labelY=Math.max(pillHeight/2+5,Math.min(height-pillHeight/2-5,point[1]-laneOffset)),hidden=!classification.isExposed(projectedPoint,'L'+joint.lineIndex),reference=lineId(g,joint.lineIndex),accessible=fullText+' · '+reference+' · '+format(joint.distance)+' mm'+(hidden?' · '+translate('Skjult rørstykke'):''),marker=node(svg,'g',{'data-joint':joint.id,'data-focus-key':'joint:'+joint.id,'data-joint-anchor-x':point[0],'data-joint-anchor-y':point[1],'data-joint-visual-scale':presentation.scale,'data-joint-label-mode':presentation.compact?'compact':'full','data-joint-occluded':String(hidden),class:'joint-marker joint-division-marker','aria-label':accessible},labels);
  node(svg,'rect',{x:point[0]-22,y:point[1]-22,width:44,height:44,fill:'transparent','pointer-events':interactive?'all':'none'},marker);
	 const symbol=node(svg,'g',{'data-joint-visible-symbol':'','transform':`translate(${point[0]} ${point[1]}) scale(${presentation.scale}) translate(${-point[0]} ${-point[1]})`},marker);
  if(collapsed){
	  node(svg,'circle',{cx:point[0],cy:point[1],r:16,fill:'none',stroke:'#fff','stroke-width':7},symbol);node(svg,'circle',{'data-division-symbol':'end-on',cx:point[0],cy:point[1],r:16,fill:hidden?'#fff':'#FFF0EB',stroke:'#A73622','stroke-width':3,'stroke-dasharray':hidden?'3 2':'none'},symbol);node(svg,'path',{d:`M ${point[0]-7} ${point[1]-7} L ${point[0]+7} ${point[1]+7} M ${point[0]-7} ${point[1]+7} L ${point[0]+7} ${point[1]-7}`,stroke:'#A73622','stroke-width':2,fill:'none'},symbol);
	 }else for(const offset of [-4,4]){const center=[point[0]+u[0]*offset,point[1]+u[1]*offset];node(svg,'line',{x1:center[0]-n[0]*24,y1:center[1]-n[1]*24,x2:center[0]+n[0]*24,y2:center[1]+n[1]*24,stroke:'#fff','stroke-width':7,'stroke-linecap':'round'},symbol);node(svg,'line',{'data-division-symbol':'cut-band',x1:center[0]-n[0]*24,y1:center[1]-n[1]*24,x2:center[0]+n[0]*24,y2:center[1]+n[1]*24,stroke:'#A73622','stroke-width':3,'stroke-linecap':'round','stroke-dasharray':hidden?'3 2':'none'},symbol);}
	 node(svg,'line',{x1:point[0],y1:point[1],x2:labelX-side*pillWidth/2,y2:labelY,stroke:'#A73622','stroke-width':presentation.compact?1.2:1.5,'stroke-dasharray':'4 3'},marker);node(svg,'rect',{x:labelX-pillWidth/2,y:labelY-pillHeight/2,width:pillWidth,height:pillHeight,rx:pillHeight/2,fill:'#FFF0EB',stroke:'#A73622','stroke-width':presentation.compact?1.3:1.7},marker);node(svg,'text',{x:labelX,y:labelY+(presentation.compact?3.3:4),'text-anchor':'middle','font-size':presentation.compact?9.5:11,'font-weight':700,fill:'#702315'},marker,text);
  node(svg,'title',{},marker,marker.getAttribute('aria-label'));if(interactive){marker.setAttribute('role','button');marker.setAttribute('tabindex','0');marker.onclick=event=>{event.stopPropagation?.();onJoint(joint.sourceIndex);};marker.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onJoint(joint.sourceIndex);}};}
 }
 // The first bend's0° datum is physically anchored at A and projected
 // from its actual reference normal, including a tilted/prepended start.
 if(startReference){
  const {origin,end,label,u,collapsed,depth}=startReference,color='#ad722f';
  const reference=node(svg,'g',{'data-spatial-start-reference':'','data-reference-normal':startFrame.normal.join(' '),'pointer-events':'none'},group);
  node(svg,'title',{},reference,translate('Reference ved A'));
  if(collapsed){
   node(svg,'line',{x1:origin[0]+18,y1:origin[1],x2:end[0]-7,y2:end[1],stroke:color,'stroke-width':1,'stroke-dasharray':'3 3'},reference);
   node(svg,'circle',{cx:end[0],cy:end[1],r:6,fill:'#fff',stroke:color,'stroke-width':1.3},reference);
   if(depth>0)node(svg,'circle',{cx:end[0],cy:end[1],r:2,fill:color},reference);
   else node(svg,'path',{d:`M ${end[0]-2.5} ${end[1]-2.5} l 5 5 M ${end[0]-2.5} ${end[1]+2.5} l 5 -5`,stroke:color,'stroke-width':1.2},reference);
  }else{
   const n=[-u[1],u[0]],begin=[origin[0]+u[0]*18,origin[1]+u[1]*18];
   node(svg,'path',{d:`M ${begin.join(' ')} L ${end.join(' ')} M ${end[0]-u[0]*5+n[0]*3} ${end[1]-u[1]*5+n[1]*3} L ${end.join(' ')} L ${end[0]-u[0]*5-n[0]*3} ${end[1]-u[1]*5-n[1]*3}`,fill:'none',stroke:color,'stroke-width':1.4},reference);
  }
  node(svg,'rect',{x:label[0]-12,y:label[1]-9,width:24,height:17,rx:3,fill:'#fff',opacity:.95},reference);
  node(svg,'text',{x:label[0],y:label[1]+3.5,'text-anchor':'middle','font-size':10.5,'font-weight':600,fill:color},reference,'0°');
 }
	svg.setAttribute('data-label-mode',settings.labelMode==='tap'?'tap':'all');svg.setAttribute('data-spatial-placed-labels',String(placed.length+inlineBends.length));svg.setAttribute('data-spatial-total-labels',String(totalLabels));svg.setAttribute('data-spatial-eligible-lengths',classification.lines.filter(part=>part.annotate).map(part=>'L'+(part.index+1)).join(' '));svg.setAttribute('data-spatial-eligible-bends',classification.arcs.filter(part=>part.annotate).map(part=>'B'+(part.index+1)).join(' '));
}

/** Separate SVG from the planar editor: hidden views do not share a camera. */
export function createSpatialPipeDrawing({svg,zoomIn,zoomOut,fit,output,format=String,formatAngle=format,translate=s=>s,onEdit=()=>{},onEndpoint=()=>{},onJoint=()=>{},onPick,onSelect}={}){
 let frame=null,lastView=null,orbitMode=false;
 const orbit={yaw:Math.PI/4,pitch:Math.atan(1/Math.SQRT2)};
 const viewport=createWallViewport({svg,zoomIn,zoomOut,fit,output,onChange:update,onTap:tap,onSingleDrag:orbitDrag,enabled:()=>!svg.hasAttribute('hidden')});
 function orbitDrag({deltaX,deltaY}){
  if(!orbitMode||!frame||frame.settings.view!=='iso')return false;
  const points=frame.geometry.points,pivot=[0,1,2].map(index=>(Math.min(...points.map(p=>p[index]))+Math.max(...points.map(p=>p[index])))/2);
  const previous=projectSpatialPoint(pivot,'iso',orbit),anchor=frame.P(previous);
  orbit.yaw=((orbit.yaw+deltaX*.008+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  orbit.pitch=Math.max(-Math.PI*.47,Math.min(Math.PI*.47,orbit.pitch+deltaY*.008));
  frame.settings.orbit={...orbit};
  const next=projectSpatialPoint(pivot,'iso',orbit);
  frame.center[0]=next[0]+(frame.width/2-anchor[0])/frame.scale;
  frame.center[1]=next[1]-(frame.height/2-anchor[1])/frame.scale;
  viewport.setOnChange(update);
  svg.setAttribute('data-orbit-yaw',String(orbit.yaw));svg.setAttribute('data-orbit-pitch',String(orbit.pitch));
  return true;
 }
 function update(camera){
  if(!frame)return;
  const bounds=svg.getBoundingClientRect?.(),screenWidth=Number(bounds?.width)||camera.width,screenHeight=Number(bounds?.height)||camera.height;
  const focused=svg.ownerDocument.activeElement,focusKey=frame.annotations.contains?.(focused)?focused?.getAttribute?.('data-focus-key'):null;
  frame.pipes.replaceChildren();paintTube(frame,frame.pipes,camera.pixelsPerUnit,frame.preview);
  frame.annotations.replaceChildren();paintAnnotations(frame,frame.annotations,{...camera,screenWidth,screenHeight},{format,formatAngle,translate,onEdit,onEndpoint,onJoint});
  svg.setAttribute('data-detail-zoom',String(camera.zoom));svg.setAttribute('data-world-diameter',String(frame.settings.diameter));svg.setAttribute('data-world-scale',String(frame.scale));
  if(focusKey){const next=[...frame.annotations.querySelectorAll('[data-focus-key]')].find(item=>item.getAttribute('data-focus-key')===focusKey);(next||svg).focus?.({preventScroll:true});}
 }
 function tap(event){
  if(!frame)return false;
  // Label/endpoint buttons have their own keyboard and pointer actions.
  let target=event.target;while(target&&target!==svg){if(target.getAttribute?.('data-focus-key')||target.getAttribute?.('data-height-transition'))return false;target=target.parentNode;}
  const world=[(event.point.x-frame.width/2)/frame.scale+frame.center[0],-(event.point.y-frame.height/2)/frame.scale+frame.center[1]];
  const camera=viewport.getState(),bounds=svg.getBoundingClientRect?.(),density=Math.min((Number(bounds?.width)||camera.width)/camera.width,(Number(bounds?.height)||camera.height)/camera.height)*camera.zoom;
  const hits=pickSpatialParts(frame.projected,world,{pixelsPerMm:frame.scale*density,diameter:frame.settings.diameter});if(!hits.length){if(frame.settings.labelMode==='tap'&&typeof onSelect==='function'){onSelect(null);return true;}return false;}
  if(hits.length>1&&typeof onPick==='function')onPick(hits);else if(frame.settings.labelMode==='tap'&&typeof onSelect==='function')onSelect(hits[0].type,hits[0].index);else onEdit(hits[0].type,hits[0].index);return true;
 }
 function draw(geometry,preview,settings={}){
  const view=settings.view||'top',changed=view!==lastView;lastView=view;if(view!=='iso')orbitMode=false;settings={...settings,view,...(view==='iso'?{orbit:{...orbit}}:{})};
  svg.setAttribute('data-orbit-mode',String(orbitMode));svg.style.cursor=orbitMode?'grab':'';svg.setAttribute('data-orbit-yaw',String(orbit.yaw));svg.setAttribute('data-orbit-pitch',String(orbit.pitch));
  frame=null;svg.replaceChildren();const width=Math.max(280,svg.clientWidth||900),height=Math.max(430,Math.min(540,width*.65));svg.setAttribute('height',String(height));svg.setAttribute('data-spatial-view',view);viewport.update(width,height);
  if(!geometry?.lines?.length)return;
  frame=layoutFrame(svg,geometry,settings,width,height);frame.preview=preview;
  frame.pipes=node(svg,'g',{'data-layer':'spatial-pipe'});frame.annotations=node(svg,'g',{'data-layer':'spatial-annotations'});
  if(changed)viewport.reset();else viewport.setOnChange(update);
 }
 return{draw,reset:()=>viewport.reset(),getState:()=>viewport.getState(),setOrbitMode:value=>{orbitMode=!!value;svg.setAttribute('data-orbit-mode',String(orbitMode));svg.style.cursor=orbitMode?'grab':'';return orbitMode;},getOrbitMode:()=>orbitMode,getOrbitAngles:()=>({...orbit})};
}

function installWorkSelection(svg,frame,{labelMode,onSelect}){
 svg.onclick=null;
 if(labelMode!=='tap'||typeof onSelect!=='function')return;
 for(const part of svg.querySelectorAll('[data-spatial-part]')){
  const id=part.getAttribute('data-spatial-part'),match=/^([LB])(\d+)$/.exec(id||'');if(!match)continue;
  const type=match[1]==='L'?'length':'angle',index=Number(match[2])-1;
	 part.setAttribute('data-spatial-selectable',id);part.setAttribute('role','button');part.setAttribute('tabindex','0');part.setAttribute('aria-label',part.getAttribute('aria-label')||id);part.setAttribute('aria-pressed',String(selectedPart(frame.settings.selected,type,index)));
  part.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation?.();onSelect(type,index);}};
 }
 svg.onclick=event=>{
  let target=event.target;while(target&&target!==svg){if(target.getAttribute?.('data-focus-key')||target.getAttribute?.('data-endpoint')||target.getAttribute?.('data-layer-transition'))return;target=target.parentNode;}
  if(!finite(event.clientX)||!finite(event.clientY))return;
  const bounds=svg.getBoundingClientRect?.();if(!bounds||bounds.width<=0||bounds.height<=0)return;
  const raw=(svg.getAttribute('viewBox')||'').trim().split(/\s+/).map(Number);if(raw.length!==4||!raw.every(finite)||raw[2]<=0||raw[3]<=0)return;
  const density=Math.min(bounds.width/raw[2],bounds.height/raw[3]),left=bounds.left+(bounds.width-raw[2]*density)/2,top=bounds.top+(bounds.height-raw[3]*density)/2;
  const screen=[raw[0]+(event.clientX-left)/density,raw[1]+(event.clientY-top)/density],origin=frame.P([0,0,0]),world=[(screen[0]-origin[0])/frame.scale,-(screen[1]-origin[1])/frame.scale];
  const hits=pickSpatialParts(frame.projected,world,{pixelsPerMm:frame.scale*density,diameter:frame.settings.diameter,layerSelection:frame.settings.layerSelection});
  if(hits.length)onSelect(hits[0].type,hits[0].index);else onSelect(null);
 };
}

/** A single large workshop view preserves the old drawing's visual hierarchy.
 * Other projections are chosen explicitly, rather than compressed beside it.
 * Geometry stays exact; the overview line weight is deliberately legible. */
export function renderSpatialWorkDrawing(svg,geometry,{diameter=12,radius=38,format=String,formatAngle=format,translate=s=>s,view='iso',layerHeight=null,labelMode='all',selected=null,joints=[],endpointLabels=null,heightDatumLabel=null,showReferenceIds=false,onSelect,width=900,height=1200}={}){
 const layerSelection=view==='top'?spatialLayerSelection(geometry,layerHeight):null,focused=svg.ownerDocument.activeElement,focusId=svg.contains?.(focused)?focused?.getAttribute?.('data-spatial-selectable'):null;
 svg.replaceChildren();svg.removeAttribute('data-inline-bends');svg.removeAttribute('data-total-bends');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('data-spatial-work','true');svg.setAttribute('data-spatial-work-view',view);svg.setAttribute('data-spatial-work-layer',layerSelection?String(layerSelection.height):'all');
 const title=translate(view==='top'?'Ovenfra':view==='front'?'Forfra':view==='side'?'Fra siden':'3D-overblik');
 node(svg,'text',{'data-work-view-title':'',x:30,y:38,'font-family':'var(--app-font, sans-serif)','font-size':22,'font-weight':600,fill:'#183c36'},svg,title+(layerSelection?' · H '+signedHeight(layerSelection.height,format)+' mm':''));
 const frame=layoutFrame(svg,geometry,{diameter,radius,view,end:'B',annotationScale:1.5,overviewStroke:10,compactOverview:true,layerSelection,labelMode,selected,joints,endpointLabels,heightDatumLabel,showReferenceIds},width,height-56);
 frame.P=((original)=>p=>{const q=original(p);return[q[0],q[1]+56,q[2]];})(frame.P);
 const pipe=node(svg,'g',{'data-work-view':view}),annotations=node(svg,'g',{'data-work-view-annotations':view});paintTube(frame,pipe,1);paintAnnotations(frame,annotations,{x:width/2,y:height/2,width,height,pixelsPerUnit:1},{format,formatAngle,translate,interactive:false});installWorkSelection(svg,frame,{labelMode,onSelect});
 if(focusId){const focus=[...svg.querySelectorAll('[data-spatial-selectable]')].find(part=>part.getAttribute('data-spatial-selectable')===focusId);focus?.focus?.({preventScroll:true});}
}
