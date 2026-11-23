import {createWallViewport} from './wall-viewport.mjs?v=44';
import {mainPipeToSvgPath,pipeDetailStrokeWidths} from './main-pipe-detail.mjs?v=44';
import {layoutMainDetailAnnotations} from './main-detail-annotations.mjs?v=44';
import {placeDimensionLabels} from './dimension-layout.mjs?v=44';
import {referenceLayout,bestDrawingAngle,readableTextAngle,leaderCrossesPipe} from './labels.mjs?v=44';
import {bendVisual,bendBadgeLines,bendAccessibleLabel} from './bend-visuals.mjs?v=44';
import {jointMarkerPresentation} from './joint-visuals.mjs?v=44';

const NS='http://www.w3.org/2000/svg';
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const footprint=(a,b,padding)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length*padding,ny=dx/length*padding;return[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];};
const crosses=(a,b,c,d)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],w=[c[0]-a[0],c[1]-a[1]],det=u[0]*v[1]-u[1]*v[0];if(Math.abs(det)<1e-8)return false;const t=(w[0]*v[1]-w[1]*v[0])/det,q=(w[0]*u[1]-w[1]*u[0])/det;return t>1e-5&&t<1-1e-5&&q>1e-5&&q<1-1e-5;};
const hits=(a,b,polygon)=>{const inside=p=>{const signs=polygon.map((v,i)=>{const q=polygon[(i+1)%polygon.length];return(q[0]-v[0])*(p[1]-v[1])-(q[1]-v[1])*(p[0]-v[0]);});return signs.every(n=>n>=0)||signs.every(n=>n<=0);};return inside(a)||inside(b)||polygon.some((p,i)=>crosses(a,b,p,polygon[(i+1)%polygon.length]));};

// Clip only the annotation's station, never the actual pipe or its dimension.
// This keeps a long leg's value visible when its original midpoint is offscreen.
function visibleLine(a,b,width,height,padding=24){
 let first=0,last=1;const d=[b[0]-a[0],b[1]-a[1]];
 for(const [p,q]of [[-d[0],a[0]-padding],[d[0],width-padding-a[0]],[-d[1],a[1]-padding],[d[1],height-padding-a[1]]]){
  if(Math.abs(p)<1e-12){if(q<0)return null;continue;}const t=q/p;
  if(p<0)first=Math.max(first,t);else last=Math.min(last,t);if(first>last)return null;
 }
 return[[a[0]+d[0]*first,a[1]+d[1]*first],[a[0]+d[0]*last,a[1]+d[1]*last]];
}

/** The ordinary editor's camera changes physical geometry and screen labels
 * independently. A pan/zoom never rebuilds the tube or changes project data. */
export function createMainPipeDrawing({svg,zoomIn,zoomOut,fit,output,format=String,formatAngle=format,translate=s=>s,onEdit=()=>{},onEndpoint=()=>{},onJoint=()=>{}}){
 let frame=null;
 const viewport=createWallViewport({svg,zoomIn,zoomOut,fit,output,onChange:update,enabled:()=>!svg.hasAttribute('hidden')});
 function node(tag,attrs,parent,text){const item=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs||{}))item.setAttribute(key,String(value));if(text!==undefined)item.textContent=text;(parent||svg).append(item);return item;}
 function editable(item,type,index){item.setAttribute('role','button');item.setAttribute('tabindex','0');item.onclick=()=>onEdit(type,index);item.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onEdit(type,index);}};}
 function update(state){
  if(!frame)return;
  const {geometry:g,settings,P,scale,overview,outer,inner,center,bendBodies,bendInners,bendCenters,annotations,highlights}=frame;
  const density=state.pixelsPerUnit||1,boundsRect=svg.getBoundingClientRect?.(),width=Number(boundsRect?.width)||state.width,height=Number(boundsRect?.height)||state.height;
  const toScreen=p=>[(p[0]-state.x)*density+width/2,(p[1]-state.y)*density+height/2],project=p=>toScreen(P(p)),toBase=p=>[state.x+(p[0]-width/2)/density,state.y+(p[1]-height/2)/density];
  const stroke=pipeDetailStrokeWidths({diameter:settings.diameter,scale,pixelsPerUnit:density});
  svg.setAttribute('data-screen-density',String(density));svg.setAttribute('data-detail-zoom',String(state.zoom));
  overview.setAttribute('display',stroke.screenWidth<1.5?'inline':'none');outer.setAttribute('stroke-width',stroke.outerWidth);inner.setAttribute('stroke-width',stroke.innerWidth);inner.setAttribute('display',stroke.innerWidth>0?'inline':'none');center.setAttribute('display',stroke.showCenterline?'inline':'none');
  for(const body of bendBodies)body.setAttribute('stroke-width',stroke.outerWidth);
  for(const bendInner of bendInners){bendInner.setAttribute('stroke-width',stroke.innerWidth);bendInner.setAttribute('display',stroke.innerWidth>0?'inline':'none');}
  for(const bendCenter of bendCenters)bendCenter.setAttribute('display',stroke.showCenterline?'inline':'none');
  for(const highlight of highlights)highlight.setAttribute('stroke-width',stroke.outerWidth);
  const focused=document.activeElement,focusKey=annotations.contains?.(focused)?focused?.getAttribute?.('data-focus-key'):null;
  annotations.replaceChildren();
  // Everything in these layers is in screen pixels, converted back to the
  // camera's base units by one transform. Font and hit sizes stay constant.
  const topLeft=toBase([0,0]);annotations.setAttribute('transform',`translate(${topLeft[0]} ${topLeft[1]}) scale(${1/density})`);
  const guides=node('g',{'data-layer':'detail-guides','pointer-events':'none'},annotations),leaders=node('g',{'data-layer':'leaders','pointer-events':'none'},annotations),labels=node('g',{'data-layer':'labels'},annotations),ends=node('g',{'data-layer':'endpoints'},annotations);
  const inView=(p,margin=0)=>p[0]>=-margin&&p[0]<=width+margin&&p[1]>=-margin&&p[1]<=height+margin;
  const nearViewport=polygon=>Math.max(...polygon.map(p=>p[0]))>=-80&&Math.min(...polygon.map(p=>p[0]))<=width+80&&Math.max(...polygon.map(p=>p[1]))>=-80&&Math.min(...polygon.map(p=>p[1]))<=height+80;
  const pipe=[],halfWidth=Math.max(1,stroke.screenWidth/2+1);
  for(const line of g.lines){const polygon=footprint(project(line.start),project(line.end),halfWidth);if(nearViewport(polygon))pipe.push({polygon});}
  g.arcs.forEach((arc,index)=>{const sampleAngle=Math.abs(arc.turn)*Math.PI/180/Math.max(1,arc.samples.length-1),step=Math.max(1,Math.min(4,Math.floor(Math.sqrt(4/Math.max(1,settings.radius*scale*density))/sampleAngle)));for(let j=0;j<arc.samples.length-1;j+=step){const next=Math.min(j+step,arc.samples.length-1),bow=settings.radius*scale*density*(1-Math.cos(sampleAngle*(next-j)/2)),polygon=footprint(project(arc.samples[j]),project(arc.samples[next]),halfWidth+bow);if(nearViewport(polygon))pipe.push({index,polygon});}});
  const endpointObstacles=[project(g.start),project(g.end)].filter(p=>inView(p,30)).map(p=>rect(p[0]-23,p[1]-23,46,46));
  const anchors=g.arcs.map((arc,index)=>{const p=project(arc.samples[Math.floor((arc.samples.length-1)/2)]),centerPoint=arc.center?project(arc.center):p,radial=[p[0]-centerPoint[0],p[1]-centerPoint[1]],radialLength=Math.hypot(...radial)||1,id=arc.displayId||'B'+(index+1),visual=bendVisual(arc.turn);return{type:'angle',index,order:index,x:p[0],y:p[1],tagX:p[0]+radial[0]/radialLength*11,tagY:p[1]+radial[1]/radialLength*11,id,visual,accessible:bendAccessibleLabel(id,arc.turn,{format:formatAngle,special:translate('SPECIAL')})};}).filter(p=>inView([p.x,p.y],2));
  const specialAnchors=anchors.filter(anchor=>!anchor.visual.standard).map(anchor=>({...anchor,labelLines:bendBadgeLines(anchor.id,g.arcs[anchor.index].turn,{format:formatAngle,special:translate('SPECIAL')})}));
  const layout=referenceLayout(specialAnchors,{width,height,fontSize:13,obstacles:endpointObstacles,pipe,maxLeader:28});
  const obstacles=[...pipe.map(item=>item.polygon),...endpointObstacles,...layout.labels.map(item=>item.polygon),...layout.labels.map(item=>footprint(...item.leader,2))];
  const fontSize=14,metrics=document.createElement('canvas').getContext('2d');metrics.font=`600 ${fontSize}px ${getComputedStyle(svg).fontFamily}`;
  const items=g.lines.flatMap((line,index)=>{const visible=visibleLine(project(line.start),project(line.end),width,height);if(!visible)return[];const [a,b]=visible,text=format(line.dimension??line.length);return[{id:'L'+(index+1),index,a,b,text,width:Math.ceil(metrics.measureText(text).width)+14,height:fontSize+10,angle:readableTextAngle(b[0]-a[0],b[1]-a[1])}];});
  const dimensionLeader=dim=>{const start=[(dim.a[0]+dim.b[0])/2,(dim.a[1]+dim.b[1])/2],dx=start[0]-dim.x,dy=start[1]-dim.y,angle=dim.angle*Math.PI/180,lx=dx*Math.cos(angle)+dy*Math.sin(angle),ly=-dx*Math.sin(angle)+dy*Math.cos(angle),factor=Math.min(1,dim.width/2/Math.max(1e-8,Math.abs(lx)),dim.height/2/Math.max(1e-8,Math.abs(ly)));return[start,[dim.x+dx*factor,dim.y+dy*factor]];};
  const dimensionFits=(maxLeader,maxDistance,prior=[])=>(dim,accepted)=>{
   if(dim.box.x<10||dim.box.y<10||dim.box.x+dim.box.w>width-10||dim.box.y+dim.box.h>height-10)return false;
   const [start,finish]=dimensionLeader(dim),length=Math.hypot(start[0]-finish[0],start[1]-finish[1]);
   if(length>maxLeader+halfWidth||Math.hypot(start[0]-dim.x,start[1]-dim.y)>maxDistance+halfWidth||leaderCrossesPipe(start,finish,pipe))return false;
   return !layout.labels.some(p=>hits(start,finish,p.polygon))&&![...prior,...accepted].some(p=>hits(start,finish,p.polygon)||crosses(start,finish,...dimensionLeader(p)))&&!layout.labels.some(p=>crosses(start,finish,...p.leader));
  };
  const bounds={x:12,y:12,w:width-24,h:height-24},extraObstacles=dim=>[footprint(...dimensionLeader(dim),2)];
  const primary=placeDimensionLabels(items,obstacles,bounds,{allowOmissions:true,acceptCandidate:dimensionFits(42,66),extraObstacles}).map(dim=>({...dim,leader:dimensionLeader(dim)}));
  const missing=items.filter(item=>!primary.some(dim=>dim.id===item.id));
  const secondary=placeDimensionLabels(missing,[...obstacles,...primary.map(dim=>dim.polygon),...primary.flatMap(extraObstacles)],bounds,{allowOmissions:true,localFallback:items.length<=60,acceptCandidate:dimensionFits(64,100,primary),extraObstacles}).map(dim=>({...dim,leader:dimensionLeader(dim)}));
  const placed=[...primary,...secondary].sort((a,b)=>a.index-b.index);
  for(const dim of placed){
   node('line',{'data-length-leader':dim.id,x1:dim.leader[0][0],y1:dim.leader[0][1],x2:dim.leader[1][0],y2:dim.leader[1][1],stroke:'#8ca697','stroke-width':1},leaders);
   const group=node('g',{'data-length':dim.id,'data-focus-key':dim.id,transform:`translate(${dim.x} ${dim.y}) rotate(${dim.angle})`,class:'length-dimension','aria-label':dim.id+' · '+dim.text+' mm'},labels);
   node('title',{},group,dim.id+' · '+dim.text+' mm');node('rect',{x:-dim.width/2,y:-dim.height/2,width:dim.width,height:dim.height,rx:4,fill:'#fff'},group);node('text',{x:0,y:fontSize*.34,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':fontSize,'font-weight':600,fill:'#176748'},group,dim.text);editable(group,'length',dim.index);
  }
  for(const ref of layout.labels){
   const arc=g.arcs[ref.index],visual=bendVisual(arc.turn),accessible=bendAccessibleLabel(ref.id,arc.turn,{format:formatAngle,special:translate('SPECIAL')});
   node('line',{'data-bend-leader':ref.id,x1:ref.leader[0][0],y1:ref.leader[0][1],x2:ref.leader[1][0],y2:ref.leader[1][1],stroke:visual.stroke,'stroke-width':1.25},leaders);
   const badge=node('g',{'data-reference':ref.id,'data-bend-id':ref.id,'data-bend-code':visual.key,'data-bend-kind':visual.standard?'standard':'special','data-focus-key':ref.id,class:'reference-badge','aria-label':accessible},labels),box={x:ref.labelX-ref.width/2,y:ref.labelY-ref.height/2,width:ref.width,height:ref.height,rx:Math.min(12,ref.height/2),fill:visual.fill,stroke:visual.stroke,'stroke-width':visual.standard?1.2:1.8};if(visual.dash)box['stroke-dasharray']=visual.dash;node('rect',box,badge);
   const lineHeight=ref.fontSize*1.05,first=ref.labelY-(ref.labelLines.length-1)*lineHeight/2+ref.fontSize*.34;ref.labelLines.forEach((text,index)=>node('text',{x:ref.labelX,y:first+index*lineHeight,'font-family':'var(--app-font, sans-serif)','font-size':index?ref.fontSize*.88:ref.fontSize,'font-weight':index?600:700,'text-anchor':'middle',fill:visual.text},badge,text));node('title',{},badge,accessible);editable(badge,'angle',ref.index);
  }
  const placedSpecial=new Set(layout.labels.map(label=>label.index));
  for(const ref of anchors){const {visual,accessible}=ref,anchor=node('g',{'data-bend-id':ref.id,'data-bend-anchor':ref.id,'data-focus-key':'anchor:'+ref.id,'data-bend-code':visual.key,class:'bend-anchor','aria-label':accessible},labels);node('circle',{cx:ref.x,cy:ref.y,r:18,fill:'transparent'},anchor);if(visual.standard)node('text',{'data-bend-inline-label':ref.id,x:ref.tagX,y:ref.tagY+3.5,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':10,'font-weight':800,fill:visual.text,'paint-order':'stroke',stroke:'#fff','stroke-width':3,'stroke-linejoin':'round'},anchor,ref.id);else if(!placedSpecial.has(ref.index))node('text',{'data-bend-inline-label':ref.id,x:ref.tagX,y:ref.tagY+3.5,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':9.5,'font-weight':800,fill:visual.text,'paint-order':'stroke',stroke:'#fff','stroke-width':3,'stroke-linejoin':'round'},anchor,ref.id+' · '+translate('SPECIAL')+' '+formatAngle(Math.abs(g.arcs[ref.index].turn))+'°');else node('circle',{'data-bend':ref.id,cx:ref.x,cy:ref.y,r:3,fill:visual.stroke,stroke:'#fff','stroke-width':1.2},anchor);node('title',{},anchor,accessible);editable(anchor,'angle',ref.index);}
  for(const [jointIndex,joint]of (settings.joints||[]).entries()){
   const line=g.lines[joint.lineIndex];if(!line)continue;
   const fraction=joint.distance/line.length,world=line.start.map((value,index)=>value+(line.end[index]-value)*fraction),point=project(world);if(!inView(point,72))continue;
	  const a=project(line.start),b=project(line.end),length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,u=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-u[1],u[0]],presentation=jointMarkerPresentation(state.zoom),fullText=joint.workLabel||joint.id+' · '+translate('DELING'),text=presentation.compact?joint.id:fullText,pillHeight=presentation.compact?20:26,pillWidth=Math.max(presentation.compact?36:96,text.length*(presentation.compact?6:7)+(presentation.compact?14:20)),side=point[0]>width*.58?-1:1,lane=joint.workLane??jointIndex,laneOffset=(lane%2?-1:1)*((presentation.compact?21:30)+Math.floor(lane/2)*(presentation.compact?20:28)),labelX=Math.max(pillWidth/2+8,Math.min(width-pillWidth/2-8,point[0]+side*(pillWidth/2+(presentation.compact?14:26)))),labelY=Math.max(pillHeight/2+5,Math.min(height-pillHeight/2-5,point[1]-laneOffset)),accessible=fullText+' · L'+(joint.lineIndex+1)+' · '+format(joint.distance)+' mm',marker=node('g',{'data-joint':joint.id,'data-focus-key':'joint:'+joint.id,'data-joint-visual-scale':presentation.scale,'data-joint-label-mode':presentation.compact?'compact':'full',class:'joint-marker joint-division-marker',role:'button',tabindex:0,'aria-label':accessible},labels);
   node('rect',{x:point[0]-22,y:point[1]-22,width:44,height:44,fill:'transparent','pointer-events':'all'},marker);
	  const symbol=node('g',{'data-joint-visible-symbol':'','transform':`translate(${point[0]} ${point[1]}) scale(${presentation.scale}) translate(${-point[0]} ${-point[1]})`},marker);for(const offset of [-4,4]){const center=[point[0]+u[0]*offset,point[1]+u[1]*offset];node('line',{x1:center[0]-n[0]*24,y1:center[1]-n[1]*24,x2:center[0]+n[0]*24,y2:center[1]+n[1]*24,stroke:'#fff','stroke-width':7,'stroke-linecap':'round'},symbol);node('line',{'data-division-symbol':'cut-band',x1:center[0]-n[0]*24,y1:center[1]-n[1]*24,x2:center[0]+n[0]*24,y2:center[1]+n[1]*24,stroke:'#A73622','stroke-width':3,'stroke-linecap':'round'},symbol);}
	  node('line',{x1:point[0],y1:point[1],x2:labelX-side*pillWidth/2,y2:labelY,stroke:'#A73622','stroke-width':presentation.compact?1.2:1.5,'stroke-dasharray':'4 3'},marker);node('rect',{x:labelX-pillWidth/2,y:labelY-pillHeight/2,width:pillWidth,height:pillHeight,rx:pillHeight/2,fill:'#FFF0EB',stroke:'#A73622','stroke-width':presentation.compact?1.3:1.7},marker);node('text',{x:labelX,y:labelY+(presentation.compact?3.3:4),'text-anchor':'middle','font-size':presentation.compact?9.5:11,'font-weight':700,fill:'#702315'},marker,text);node('title',{},marker,accessible);
   marker.onclick=()=>onJoint(joint.sourceIndex);marker.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onJoint(joint.sourceIndex);}};
  }
  const detail=layoutMainDetailAnnotations({geometry:g,radius:settings.radius,diameter:settings.diameter,pixelsPerMm:scale*density,zoom:state.zoom,mapPoint:project,width,height,obstacles:[...obstacles,...placed.map(dim=>dim.polygon)],format});
  for(const dimension of detail.dimensions){
   const group=node('g',{'data-detail-dimension':dimension.kind,'data-detail-value':dimension.value,'pointer-events':'none'},guides);
   for(const line of dimension.lines)node('line',{x1:line.a[0],y1:line.a[1],x2:line.b[0],y2:line.b[1],stroke:'#648476','stroke-width':1,...(line.dashed?{'stroke-dasharray':'4 4'}:{})},group);
   for(const marker of dimension.markers)node('circle',{'data-detail-marker':marker.kind,cx:marker.point[0],cy:marker.point[1],r:marker.kind==='center'?2:2.5,fill:'#fff',stroke:'#648476','stroke-width':1},group);
   const label=node('g',{'data-detail-label':dimension.kind,'pointer-events':'none'},labels),box=dimension.label;node('rect',{x:box.x-box.width/2,y:box.y-box.height/2,width:box.width,height:box.height,rx:4,fill:'#fff',stroke:'#a1b7aa','stroke-width':.7},label);node('text',{x:box.x,y:box.y+4,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':12,'font-weight':600,fill:'#365f4e'},label,dimension.text);
  }
  for(const [letter,p]of [['A',g.start],['B',g.end]]){
   const q=project(p);if(!inView(q,24))continue;
   const endpoint=node('g',{class:'endpoint','data-endpoint':letter,'data-focus-key':'end:'+letter,role:'button',tabindex:0,'aria-label':translate('Tilføj buk ved ende ')+letter},ends);
   node('circle',{cx:q[0],cy:q[1],r:23,fill:'transparent'},endpoint);node('circle',{cx:q[0],cy:q[1],r:16,fill:letter===settings.end?'#16815d':'#183c36',stroke:'#fff','stroke-width':3},endpoint);node('text',{x:q[0],y:q[1]+5,fill:'#fff','font-size':14,'font-weight':700,'text-anchor':'middle'},endpoint,letter);endpoint.onclick=()=>onEndpoint(letter);endpoint.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onEndpoint(letter);}};
  }
  svg.setAttribute('data-inline-bends',String(anchors.length));svg.setAttribute('data-total-bends',String(g.arcs.length));
  if(focusKey){const next=[...annotations.querySelectorAll('[data-focus-key]')].find(item=>item.getAttribute('data-focus-key')===focusKey);(next||svg).focus?.({preventScroll:true});}
 }
 function draw(geometry,preview,settings){
  frame=null;svg.replaceChildren();
  const width=Math.max(280,svg.clientWidth||900),height=Math.max(430,Math.min(540,width*.65));svg.setAttribute('height',height);viewport.update(width,height);
  svg.setAttribute('data-world-diameter',String(settings.diameter));
  if(!geometry.lines.length){svg.removeAttribute('data-world-scale');return;}
  const plotWidth=width-112,plotHeight=height-112,angle=bestDrawingAngle(geometry.points,plotWidth,plotHeight),c=Math.cos(angle),s=Math.sin(angle),rotate=p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c],rotated=geometry.points.map(rotate),xs=rotated.map(p=>p[0]),ys=rotated.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),scale=Math.min(plotWidth/Math.max(1,maxx-minx+settings.diameter),plotHeight/Math.max(1,maxy-miny+settings.diameter));
  const P=p=>{const q=rotate(p);return[width/2+(q[0]-(minx+maxx)/2)*scale,height/2-(q[1]-(miny+maxy)/2)*scale];};
  svg.setAttribute('data-world-scale',String(scale));
  const pipes=node('g',{'data-layer':'pipe'}),path=(geo,attrs,delta)=>node('path',{d:mainPipeToSvgPath(geo,{radius:settings.radius,mapPoint:P,scale,flipY:true,delta}),fill:'none','stroke-linecap':'butt','stroke-linejoin':'round',...attrs},pipes);
  if(preview){let delta=[0,0];if(settings.end==='A'){const p=preview.lines[1].start;delta=[-p[0],-p[1]];}path(preview,{'data-pipe-preview':'',stroke:'#97c6b0','stroke-width':2,'stroke-dasharray':'8 8','vector-effect':'non-scaling-stroke',opacity:.6},delta);}
  const overview=path(geometry,{'data-pipe-overview':'',stroke:'#6d9685','stroke-width':1.25,'vector-effect':'non-scaling-stroke','pointer-events':'none'}),outer=path(geometry,{'data-pipe-body':'',stroke:'#9db6ab','stroke-width':settings.diameter*scale}),inner=path(geometry,{'data-pipe-inner':'',stroke:'#deeee7'}),center=path(geometry,{'data-pipe-centerline':'',stroke:'#487b69','stroke-width':.65,'stroke-dasharray':'4 5','vector-effect':'non-scaling-stroke'});
  const bendBodies=[],bendInners=[],bendCenters=[];
  for(const [index,arc]of geometry.arcs.entries()){
   const visual=bendVisual(arc.turn),id=arc.displayId||'B'+(index+1),accessible=bendAccessibleLabel(id,arc.turn,{format:formatAngle,special:translate('SPECIAL')}),points=arc.samples.map(P),d=points.map((point,i)=>(i?'L':'M')+point.join(' ')).join(' '),body=node('path',{'data-bend-color':visual.key,'data-bend-kind':visual.standard?'standard':'special','data-bend-id':id,'aria-label':accessible,d,fill:'none',stroke:visual.stroke,'stroke-width':settings.diameter*scale,'stroke-linecap':'butt','stroke-linejoin':'round','pointer-events':'none'},pipes);bendBodies.push(body);node('title',{},body,accessible);bendInners.push(node('path',{d,fill:'none',stroke:visual.tube,'stroke-linecap':'butt','stroke-linejoin':'round','pointer-events':'none'},pipes));bendCenters.push(node('path',{d,fill:'none',stroke:visual.stroke,'stroke-width':.65,'vector-effect':'non-scaling-stroke','stroke-dasharray':visual.dash||'4 5','stroke-linecap':'butt','pointer-events':'none'},pipes));
  }
  const highlights=geometry.lines.map((line,index)=>{const a=P(line.start),b=P(line.end);return node('line',{'data-length-id':'L'+(index+1),class:'reference-path',x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#278f70','stroke-width':settings.diameter*scale,'stroke-linecap':'butt','pointer-events':'none',opacity:0},pipes);});
  const annotations=node('g',{'data-layer':'annotations'});
  frame={geometry,settings:{...settings},P,scale,overview,outer,inner,center,bendBodies,bendInners,bendCenters,annotations,highlights};viewport.setOnChange(update);
 }
 return{draw,reset:()=>viewport.reset(),getState:()=>viewport.getState()};
}
