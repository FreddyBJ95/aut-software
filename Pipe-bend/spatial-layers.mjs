// Height layers are display selections, never edited copies of the pipe.
// Every mask retains the original L/B indexes and every height is relative
// to the same A datum, including projects whose world origin is translated.
const EPS=1e-6;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>Array.isArray(p)&&p.length===3&&p.every(finite);
const near=(a,b)=>Math.abs(a-b)<=EPS;
const zero=n=>Math.abs(n)<=EPS?0:n;

function checkGeometry(g){
 if(!g||!Array.isArray(g.lines)||!Array.isArray(g.arcs)||!point(g.start)||!point(g.end))throw new TypeError('Height layers require finite spatial pipe geometry.');
 for(const line of g.lines)if(!point(line?.start)||!point(line?.end))throw new TypeError('A height layer contains an invalid straight section.');
 for(const arc of g.arcs)if(!Array.isArray(arc?.samples)||arc.samples.length<2||!arc.samples.every(point))throw new TypeError('A height layer contains an invalid bend.');
}

/** Exact height range for a circular bend, with sampled-data fallback for
 * other geometry consumers. Endpoints alone cannot detect a tilted arc that
 * leaves a height plane and comes back to it. */
function arcRange(arc){
 const values=arc.samples.map(p=>p[2]);
 if(point(arc.tangent)&&point(arc.normal)&&finite(arc.radius)&&arc.radius>0&&finite(arc.turn)){
  const theta=Math.abs(arc.turn)*Math.PI/180,sign=Math.sign(arc.turn),a=arc.tangent[2],b=sign*arc.normal[2],base=arc.samples[0][2];
  const at=t=>base+arc.radius*(a*Math.sin(t)+b*(1-Math.cos(t)));
  const critical=Math.atan2(-a,b);
  for(let k=-2;k<=2;k++){const t=critical+k*Math.PI;if(t>0&&t<theta)values.push(at(t));}
 }
 return[Math.min(...values),Math.max(...values)];
}

function geometryHeights(g){
 checkGeometry(g);const datum=g.start[2];
 const lines=g.lines.map(line=>near(line.start[2],line.end[2])?zero((line.start[2]+line.end[2])/2-datum):null);
 const arcs=g.arcs.map(arc=>{const [lo,hi]=arcRange(arc);return near(lo,hi)?zero((lo+hi)/2-datum):null;});
 return{datum,lines,arcs};
}

/** Sorted constant-height portions of the real centerline. Sloping sections
 * do not create a new "floor" for every sampled intermediate height. */
export function spatialHeightLayers(geometry){
 const heights=geometryHeights(geometry),entries=[];
 heights.lines.forEach((height,index)=>{if(height!==null)entries.push({height,type:'line',index});});
 heights.arcs.forEach((height,index)=>{if(height!==null)entries.push({height,type:'arc',index});});
 entries.sort((a,b)=>a.height-b.height||a.index-b.index);
 const layers=[];
 for(const entry of entries){
  let layer=layers.at(-1);
  if(!layer||!near(layer.height,entry.height)){layer={height:entry.height,lineIndices:[],arcIndices:[]};layers.push(layer);}
  (entry.type==='line'?layer.lineIndices:layer.arcIndices).push(entry.index);
 }
 for(const layer of layers){layer.lineIndices.sort((a,b)=>a-b);layer.arcIndices.sort((a,b)=>a-b);}
 return layers;
}

function boundaryTransition(g,heights,lineIndex,step,selectedHeight){
 const bendIndex=step>0?lineIndex:lineIndex-1;
 if(bendIndex<0||bendIndex>=g.arcs.length||heights.arcs[bendIndex]!==null&&near(heights.arcs[bendIndex],selectedHeight))return null;
 const anchor=(step>0?g.lines[lineIndex].end:g.lines[lineIndex].start).slice();
 const samples=[],ranges=[];
 let nextLineIndex=null;
 for(let i=lineIndex;step>0?i<g.lines.length-1:i>0;i+=step){
  const arcIndex=step>0?i:i-1,arc=g.arcs[arcIndex];
  if(arc){const points=step>0?arc.samples:arc.samples.slice().reverse();samples.push(...points);ranges.push(arcRange(arc));}
  const j=i+step,line=g.lines[j];if(!line)break;
  samples.push(...(step>0?[line.start,line.end]:[line.end,line.start]));ranges.push([Math.min(line.start[2],line.end[2]),Math.max(line.start[2],line.end[2])]);
  if(heights.lines[j]!==null){nextLineIndex=j;break;}
 }
 const initial=samples.find(p=>!near(p[2]-heights.datum,selectedHeight));if(!initial)return null;
 const sign=initial[2]-heights.datum>selectedHeight?1:-1,direction=sign>0?'up':'down';
 const endpoint=step>0?g.end:g.start;
 let to=nextLineIndex===null?endpoint[2]-heights.datum:heights.lines[nextLineIndex],returnTo=null;
 const extreme=sign>0?Math.max(...ranges.map(r=>r[1]))-heights.datum:Math.min(...ranges.map(r=>r[0]))-heights.datum;
 if(near(to,selectedHeight)){returnTo=zero(to);to=extreme;}
 return{index:bendIndex,id:'B'+(bendIndex+1)+(step>0?'-B':'-A'),bendIndex,lineIndex,nextLineIndex,
  anchor,direction,from:selectedHeight,to:zero(to),pipeDirection:step>0?'toward-B':'toward-A',
  ...(returnTo===null?{}:{returnTo}),...(sign*(to-selectedHeight)<-EPS?{viaHeight:zero(extreme)}:{})};
}

/** null/'all' means the ordinary complete pipe drawing. A selected layer
 * contains only coplanar geometry; off-layer bends are represented by boundary
 * transitions instead of ink that could hide the chosen lower run again. */
export function spatialLayerSelection(geometry,height){
 if(height===null||height===undefined||height==='all')return null;
 if(!finite(height))throw new RangeError('Vælg en eksisterende højde i røret.');
 const heights=geometryHeights(geometry),layers=spatialHeightLayers(geometry),layer=layers.find(layer=>near(layer.height,height));
 if(!layer)throw new RangeError('Vælg en eksisterende højde i røret.');
 const selectedHeight=layer.height,lineSet=new Set(layer.lineIndices),arcSet=new Set(layer.arcIndices);
 const lines=heights.lines.map((_,index)=>lineSet.has(index)),arcs=heights.arcs.map((_,index)=>arcSet.has(index)),transitions=[];
 for(let i=0;i<lines.length;i++)if(lines[i])for(const step of [-1,1]){
  const boundary=boundaryTransition(geometry,heights,i,step,selectedHeight);if(boundary)transitions.push(boundary);
 }
 return{height:selectedHeight,lines,arcs,transitions,startVisible:near(geometry.start[2]-heights.datum,selectedHeight),endVisible:near(geometry.end[2]-heights.datum,selectedHeight)};
}
