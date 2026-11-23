import assert from 'node:assert/strict';
import {geometry,extend} from './geometry.mjs';
import {bendReferenceLayout,bestDrawingAngle,leaderCrossesPipe} from './labels.mjs';
import {polygonsOverlap} from './dimension-layout.mjs';
import {bendVisual,bendBadgeLines} from './bend-visuals.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const footprint=(a,b,pad=8)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length*pad,ny=dx/length*pad;return[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];};
function scene(state,work=false,width=900,labelFor){
 const g=geometry(state),original=structuredClone(g),height=work?1200:Math.max(430,Math.min(540,width*.65));
 const plotWidth=width-(work?150:112),plotHeight=height-(work?150:112),angle=bestDrawingAngle(g.points,plotWidth,plotHeight),c=Math.cos(angle),s=Math.sin(angle),rotate=([x,y])=>[x*c-y*s,x*s+y*c],rotated=g.points.map(rotate),xs=rotated.map(p=>p[0]),ys=rotated.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(plotWidth/Math.max(1,maxX-minX),plotHeight/Math.max(1,maxY-minY));
 const project=p=>{const [x,y]=rotate(p);return[width/2+(x-(minX+maxX)/2)*scale,height/2-(y-(minY+maxY)/2)*scale];};
 const pipe=g.lines.map(l=>({polygon:footprint(project(l.start),project(l.end))}));
 for(let index=0;index<g.arcs.length;index++){const arc=g.arcs[index];for(let j=0;j<arc.samples.length-1;j+=4)pipe.push({index,polygon:footprint(project(arc.samples[j]),project(arc.samples[Math.min(j+4,arc.samples.length-1)]))});}
 const obstacles=[project(g.start),project(g.end)].map(([x,y])=>rect(x-23,y-23,46,46));
 const layout=bendReferenceLayout(g.arcs,project,{width,height,fontSize:work?18:13,pipe,obstacles,maxLeader:28,labelFor});
 assert.equal(layout.height,height,'References may not stretch the drawing and shrink text');
 assert.equal(layout.project,project,'Label placement cannot shift the model projection');
 const labeled=layout.anchors.filter(anchor=>anchor.labelVisible);
 assert.equal(layout.labels.length+layout.unplaced.length,labeled.length,'Every requested bend label must remain accounted for');
 assert.deepEqual(new Set([...layout.labels,...layout.unplaced].map(p=>p.index)),new Set(labeled.map(item=>item.index)));
 assert.deepEqual(g,original,'Annotation layout must not alter physical pipe geometry');
 for(const anchor of layout.anchors){const p=project(g.arcs[anchor.index].samples[Math.floor((g.arcs[anchor.index].samples.length-1)/2)]);close(anchor.x,p[0]);close(anchor.y,p[1]);assert.equal(anchor.id,'B'+(anchor.index+1));}
 for(const label of layout.labels){
  const p=project(g.arcs[label.index].samples[16]);close(label.x,p[0]);close(label.y,p[1]);
  assert.equal(label.id,'B'+(label.index+1));assert(label.leaderLength<=28+1e-8,'No distant orange rails');
  assert(label.polygon.every(([x,y])=>x>=8&&x<=width-8&&y>=8&&y<=height-8));
  assert(!leaderCrossesPipe(...label.leader,pipe),'A local leader cannot cross another pipe centreline');
  for(const other of [...pipe.map(p=>p.polygon),...obstacles])assert(!polygonsOverlap(label.polygon,other,3.99),'B number cannot overlap the pipe or endpoint');
 }
 for(let i=0;i<layout.labels.length;i++)for(let j=i+1;j<layout.labels.length;j++)assert(!polygonsOverlap(layout.labels[i].polygon,layout.labels[j].polygon,3.99),'Local bend numbers must remain separate');
 return layout;
}
const old={radius:80,heading:0,lengths:[350,1142,169,270,169,950],turns:[45,45,-45,-45,45]};
const screenshot={radius:38,heading:0,measurementMode:'vertex',lengths:[935,69.3,761,196.6,190,196.6,961,69.3,581,309.7,270,309.7,446],turns:[45,45,45,-45,-45,45,45,45,45,-45,-45,45]};
const saved={"version": 1, "configured": true, "name": "Vægforløb med 120 mm fremspring", "drawingNumber": "PB-VAEG-120", "stock": 6000, "diameter": 12, "wall": 1.5, "radius": 38, "benderId": "swagelok-ms-htb-12m", "measurementMode": "vertex", "heading": -1.9333753010793143e-17, "lengths": [735.0282538143907, 69.25650762878142, 761.0282538143907, 196.57568516986024, 190, 196.5756851698603, 761.0282538143911, 69.25650762878121, 961.0282538143908, 196.57568516986004, 190, 196.57568516986004, 826.0000000000001], "turns": [45, 45, 45, -45, -45, 45, 45, 45, 45, -45, -45, 45], "placement": {"start": [200, 16]}, "planner": {"version": 2, "input": {"wall": {"lengths": [1000, 1000, 120, 120, 120, 1000, 1200, 120, 120, 120, 1200], "turns": [90, 90, -90, -90, 90, 90, 90, -90, -90, 90], "heading": 0, "side": "left"}, "diameter": 12, "radius": 38, "wallGap": 10, "clearance": 10, "maxAngle": 45, "start": {"segment": 0, "position": 200}, "end": {"segment": 10, "position": 1000}, "clips": [], "obstacles": []}, "points": [[200, 16], [935.0282538143907, 15.999999999999986], [983.9999999999999, 64.97174618560923], [984, 826], [845, 965], [845, 1155], [984.0000000000001, 1294], [984.0000000000001, 2055.028253814391], [935.028253814391, 2104], [-25.999999999999886, 2104], [-164.9999999999999, 1965.0000000000002], [-354.9999999999999, 1965.0000000000002], [-493.9999999999999, 2104], [-1320, 2104.0000000000005]]}};
for(const fixture of [old,screenshot,saved])for(const mirror of [1,-1]){
 const state={...fixture,turns:fixture.turns.map(n=>n*mirror)};
 for(const width of [304,320,390,736,900]){
  const layout=scene(state,false,width);
  assert.equal(layout.labels.length,state.turns.length,`Real workshop fixture ${fixture===old?'old':fixture===saved?'saved':'screenshot'} width ${width} mirror ${mirror}: ${layout.unplaced.map(p=>p.id)}`);
 }
 assert.equal(scene(state,true,900).labels.length,state.turns.length);
}
for(const turn of [-135,-45,45,90])for(const work of [false,true])scene(extend(old,'A',220,turn),work);
const dense={radius:80,heading:0,lengths:Array.from({length:201},(_,i)=>80+i%5*10),turns:Array.from({length:200},(_,i)=>i%2?-45:45)};
for(const work of [false,true]){const layout=scene(dense,work);assert(layout.unplaced.length>0,'A dense project uses the complete list rather than overlapping SVG labels');assert.equal(layout.anchors.length,200);}
const colored={radius:38,heading:0,measurementMode:'tangent',lengths:[500,420,460,380,520],turns:[30,45,37,90]},labelFor=(arc,index,id)=>bendVisual(arc.turn).standard?false:bendBadgeLines(id,arc.turn,{format:String,special:'SPECIAL'}),wideColored=scene(colored,false,900,labelFor),narrowColored=scene(colored,false,304,labelFor);
assert.equal(wideColored.anchors.length,colored.turns.length);assert.equal(wideColored.labels.length,1);assert.deepEqual(wideColored.labels[0].labelLines,['B3','SPECIAL · 37°']);
assert.equal(narrowColored.labels.length+narrowColored.unplaced.length,1);assert(narrowColored.labels.every(label=>label.labelLines.length===2));
// A leader may share its source dot, but no foreign centreline crossing.
assert(leaderCrossesPipe([0,0],[30,0],[{polygon:footprint([15,-10],[15,10])}]));
assert(!leaderCrossesPipe([0,0],[0,20],[{polygon:footprint([-10,0],[10,0])}]));
console.log('Compact bend tags: actual anchors, editor/work bounds, complete 12-bend fixtures, short safe leaders and dense-list fallback PASS');
