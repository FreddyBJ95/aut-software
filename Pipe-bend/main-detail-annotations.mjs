import {rectPolygon,polygonsOverlap} from './dimension-layout.mjs?v=44';

// Optional engineering details for the ordinary pipe editor. Coordinates and
// annotation sizes are screen pixels; values remain the physical mm values.
const EPS=1e-8;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(finite);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,n)=>[a[0]*n,a[1]*n];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const bounds=p=>({minX:Math.min(...p.map(q=>q[0])),minY:Math.min(...p.map(q=>q[1])),maxX:Math.max(...p.map(q=>q[0])),maxY:Math.max(...p.map(q=>q[1]))});
const broad=(a,b,gap=3)=>a.minX<b.maxX+gap&&a.maxX>b.minX-gap&&a.minY<b.maxY+gap&&a.maxY>b.minY-gap;

function clip(a,b,width,height,padding=12){
  const d=sub(b,a);let lo=0,hi=1;
  for(const [p,q]of [[-d[0],a[0]-padding],[d[0],width-padding-a[0]],[-d[1],a[1]-padding],[d[1],height-padding-a[1]]]){
    if(Math.abs(p)<EPS){if(q<0)return null;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
  }
  return[add(a,mul(d,lo)),add(a,mul(d,hi))];
}

function arcCenter(arc,radius){
  const first=arc?.samples?.[0],last=arc?.samples?.at(-1),turn=arc?.turn;
  if(!point(first)||!point(last)||!finite(turn)||Math.abs(turn)<=EPS||Math.abs(turn)>=180)return null;
  const d=sub(last,first),chord=Math.hypot(...d),expected=2*radius*Math.sin(Math.abs(turn)*Math.PI/360);
  if(chord<=EPS||Math.abs(chord-expected)>Math.max(1,radius)*1e-6)return null;
  const offset=Math.sqrt(Math.max(0,radius*radius-chord*chord/4))*Math.sign(turn);
  return add(mul(add(first,last),.5),mul([-d[1]/chord,d[0]/chord],offset));
}

/**
 * mapPoint must be the current uniform world-to-screen transform (including
 * camera zoom). Pipe/endpoint/text footprints may be passed as obstacles.
 * dimensions contains at most one diameter and one radius, each with a
 * horizontal label, exact measurement lines and optional center/tangent dots.
 */
export function layoutMainDetailAnnotations({geometry,radius,diameter,pixelsPerMm,zoom,mapPoint,width,height,obstacles=[],format=String}={}){
  const result={dimensions:[]};
  if(!geometry||!Array.isArray(geometry.lines)||!Array.isArray(geometry.arcs)||!finite(radius)||radius<=0||!finite(diameter)||diameter<=0||!finite(pixelsPerMm)||pixelsPerMm<=0||!finite(zoom)||zoom<=1.05||typeof mapPoint!=='function'||typeof format!=='function'||!finite(width)||width<80||!finite(height)||height<60||!Array.isArray(obstacles))return result;
  const center=[width/2,height/2],inside=(p,padding=4)=>point(p)&&p[0]>=padding&&p[0]<=width-padding&&p[1]>=padding&&p[1]<=height-padding;
  const mapped=p=>{if(!point(p))return null;try{const q=mapPoint(p);return point(q)?q:null;}catch{return null;}};
  const blocked=obstacles.map(p=>Array.isArray(p)?p:p?.polygon).filter(p=>Array.isArray(p)&&p.length>=3&&p.every(point)).map(polygon=>({polygon,box:bounds(polygon)}));
  function label(text,candidates){
    const labelWidth=Math.max(62,text.length*7.4+18),labelHeight=22;
    for(const candidate of candidates){
      const [x,y]=candidate,polygon=rectPolygon(x,y,labelWidth,labelHeight),box=bounds(polygon);
      if(!polygon.every(p=>inside(p,6))||blocked.some(p=>broad(box,p.box)&&polygonsOverlap(polygon,p.polygon,3)))continue;
      blocked.push({polygon,box});return{x,y,width:labelWidth,height:labelHeight,polygon};
    }
    return null;
  }
  const edge=(p,l)=>{
    const d=sub(p,[l.x,l.y]),factor=Math.max(Math.abs(d[0])/(l.width/2),Math.abs(d[1])/(l.height/2));
    return factor>1?add([l.x,l.y],mul(d,1/factor)):[l.x,l.y];
  };

  if(diameter*pixelsPerMm>=14){
    const lines=geometry.lines.map((line,index)=>{
      const a=mapped(line?.start),b=mapped(line?.end);if(!a||!b||distance(a,b)<EPS)return null;
      const visible=clip(a,b,width,height);if(!visible)return null;
      const unit=mul(sub(b,a),1/distance(a,b)),normal=[-unit[1],unit[0]],visibleLength=distance(...visible);
      const station=clamp(dot(sub(center,visible[0]),unit),Math.min(18,visibleLength/2),Math.max(visibleLength/2,visibleLength-18)),anchor=add(visible[0],mul(unit,station));
      return{index,unit,normal,anchor,visible,score:distance(anchor,center)};
    }).filter(Boolean).sort((a,b)=>a.score-b.score||a.index-b.index);
    for(const line of lines){
      const text='Ø'+format(diameter)+' mm',r=diameter*pixelsPerMm/2,measure=[add(line.anchor,mul(line.normal,-r)),add(line.anchor,mul(line.normal,r))];
      if(!measure.every(p=>inside(p,8)))continue;
      const widthGuess=Math.max(62,text.length*7.4+18),support=Math.abs(line.normal[0])*widthGuess/2+Math.abs(line.normal[1])*11;
      const candidates=[];
      for(const along of [0,26,-26,48,-48])for(const side of [-1,1])candidates.push(add(add(line.anchor,mul(line.normal,side*(r+support+14))),mul(line.unit,along)));
      const box=label(text,candidates);if(!box)continue;
      const side=dot(sub([box.x,box.y],line.anchor),line.normal)<0?0:1,lines=[{a:measure[0],b:measure[1],kind:'measure'}];
      for(const p of measure)lines.push({a:add(p,mul(line.unit,-3)),b:add(p,mul(line.unit,3)),kind:'tick'});
      lines.push({a:measure[side],b:edge(measure[side],box),kind:'leader'});
      result.dimensions.push({kind:'diameter',index:line.index,value:diameter,text,label:box,lines,markers:[]});break;
    }
  }

  if(radius*pixelsPerMm>=36){
    const arcs=geometry.arcs.map((arc,index)=>{
      const worldCenter=arcCenter(arc,radius),worldMiddle=arc?.samples?.[Math.floor((arc.samples.length-1)/2)];
      if(!worldCenter||!point(worldMiddle))return null;
      const c=mapped(worldCenter),middle=mapped(worldMiddle),start=mapped(arc.samples[0]),end=mapped(arc.samples.at(-1));
      if(!c||!middle||!start||!end||!inside(c,10)||!inside(middle,10))return null;
      if(Math.abs(distance(c,middle)-radius*pixelsPerMm)>Math.max(1,radius*pixelsPerMm)*1e-6)return null;
      return{index,c,middle,start,end,score:distance(middle,center)};
    }).filter(Boolean).sort((a,b)=>a.score-b.score||a.index-b.index);
    for(const arc of arcs){
      const text='R'+format(radius)+' mm',radial=mul(sub(arc.middle,arc.c),1/distance(arc.c,arc.middle)),tangent=[-radial[1],radial[0]],r=diameter*pixelsPerMm/2,widthGuess=Math.max(62,text.length*7.4+18),support=Math.abs(radial[0])*widthGuess/2+Math.abs(radial[1])*11,candidates=[];
      const mid=mul(add(arc.c,arc.middle),.5);
      for(const along of [0,24,-24,44,-44])for(const side of [-1,1])candidates.push(add(add(mid,mul(tangent,side*25)),mul(radial,along)));
      for(const along of [0,24,-24])candidates.push(add(add(arc.middle,mul(radial,r+support+14)),mul(tangent,along)));
      // Existing L/B tags can occupy every tight local position. A small
      // fallback ring uses nearby empty space without moving good placements.
      const fallback=[];
      for(const origin of [mid,arc.c])for(const ring of [42,64,84])for(let i=0;i<8;i++){
        const angle=i*Math.PI/4;fallback.push(add(origin,[Math.cos(angle)*ring,Math.sin(angle)*ring]));
      }
      fallback.sort((a,b)=>distance(a,mid)-distance(b,mid));candidates.push(...fallback);
      const box=label(text,candidates);if(!box)continue;
      const lines=[{a:arc.c,b:arc.middle,kind:'measure'},{a:mid,b:edge(mid,box),kind:'leader'}];
      const markers=[{point:arc.c,kind:'center'}];
      for(const p of [arc.start,arc.end])if(inside(p,6)){lines.push({a:arc.c,b:p,kind:'tangent',dashed:true});markers.push({point:p,kind:'tangent'});}
      result.dimensions.push({kind:'radius',index:arc.index,value:radius,text,label:box,lines,markers});break;
    }
  }
  return result;
}
