// Exact developed-pipe tick positions with compact, complete bend references.
// All coordinates are SVG units. The input positions are never spread out to
// make labels fit: only the label rows change.
const EPS=1e-9;
const intersects=(a,b,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
const leaderHits=(leader,box,gap=2)=>{
  const [a,b]=leader,x=a[0],lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);
  return x>box.x-gap&&x<box.x+box.width+gap&&hi>box.y-gap&&lo<box.y+box.height+gap;
};

/**
 * entries: [{id,position,valueText?,labelWidth?,...}], in millimetres from A.
 * Labels use short vertical leaders on alternate sides of the tube. If every
 * ID cannot be shown safely, mode='table' asks the caller to render the complete
 * entries list directly below the overview; a misleading partial set is never
 * returned. `entries` and `ticks` retain the input ordering and exact positions.
 */
export function layoutBlankMarks(entries,{totalLength,width=900,margin=40,fontSize=14,maxRows=4}={}) {
  if(!Array.isArray(entries)||entries.length>1000||!Number.isFinite(totalLength)||totalLength<=0||!Number.isFinite(width)||width<240||!Number.isFinite(margin)||margin<12||margin*2>=width||!Number.isFinite(fontSize)||fontSize<10||fontSize>24||!Number.isInteger(maxRows)||maxRows<1||maxRows>6)throw new RangeError('Invalid developed-pipe layout.');
  const tolerance=EPS*Math.max(1,totalLength),ids=new Set(),normal=entries.map((entry,index)=>{
    if(!entry||typeof entry.id!=='string'||!entry.id||ids.has(entry.id)||!Number.isFinite(entry.position)||entry.position< -tolerance||entry.position>totalLength+tolerance)throw new RangeError('Bend marks need unique IDs and positions within the pipe.');
    ids.add(entry.id);
    const position=entry.position<0?0:entry.position>totalLength?totalLength:entry.position;
    const labelWidth=entry.labelWidth??Math.max(28,entry.id.length*fontSize*.64+12);
    if(!Number.isFinite(labelWidth)||labelWidth<=0)throw new RangeError('Invalid bend label width.');
    return {...entry,index,position,labelWidth,valueText:entry.valueText??String(position)+' mm'};
  });
  const tubeWidth=width-2*margin,tubeHeight=22,labelHeight=fontSize+8,rowPitch=labelHeight+6,near=24;
  const raw=[],options=Array.from({length:maxRows},(_,i)=>({side:i%2===0?'above':'below',row:Math.floor(i/2)}));
  let complete=true;
  for(const entry of [...normal].sort((a,b)=>a.position-b.position||a.index-b.index)) {
    const x=margin+entry.position/totalLength*tubeWidth;
    let placement;
    for(const {side,row}of options) {
      const y=side==='above'?-near-row*rowPitch:tubeHeight+near+row*rowPitch;
      const box={x:x-entry.labelWidth/2,y:y-labelHeight/2,width:entry.labelWidth,height:labelHeight};
      const leader=side==='above'?[[x,-6],[x,box.y+box.height]]:[[x,tubeHeight+6],[x,box.y]];
      if(box.x<4||box.x+box.width>width-4||raw.some(other=>intersects(box,other.box,6)||leaderHits(leader,other.box)||leaderHits(other.leader,box)))continue;
      placement={...entry,x,y,width:entry.labelWidth,height:labelHeight,text:entry.id,side,row,box,leader};break;
    }
    if(!placement){complete=false;break;}
    raw.push(placement);
  }
  const mode=complete?'labels':'table',above=complete?Math.max(0,...raw.filter(p=>p.side==='above').map(p=>p.row+1)):0,below=complete?Math.max(0,...raw.filter(p=>p.side==='below').map(p=>p.row+1)):0;
  const tubeY=mode==='table'?40:34+above*rowPitch;
  const labels=complete?raw.map(label=>({...label,y:label.y+tubeY,box:{...label.box,y:label.box.y+tubeY},leader:label.leader.map(([x,y])=>[x,y+tubeY])})).sort((a,b)=>a.index-b.index):[];
  const ticks=normal.map(entry=>({...entry,x:margin+entry.position/totalLength*tubeWidth,y1:tubeY-6,y2:tubeY+tubeHeight+6}));
  const height=Math.max(94,tubeY+tubeHeight+(below?near+(below-1)*rowPitch+labelHeight/2:14)+12);
  return {mode,width,height,totalLength,fontSize,entries:normal,tube:{x:margin,y:tubeY,width:tubeWidth,height:tubeHeight},ticks,labels,tableColumns:Math.max(1,Math.floor(width/145))};
}
