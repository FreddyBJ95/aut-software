import assert from 'node:assert/strict';
import {layoutBlankMarks} from './blank-layout.mjs';
import {bendMarkLayout} from './measurements.mjs';
import {getBender} from './benders.mjs';
import {polygonsOverlap,rectPolygon} from './dimension-layout.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const validate=layout=>{
  assert.equal(layout.entries.length,layout.ticks.length);
  assert.deepEqual(layout.entries.map(e=>e.id),layout.ticks.map(e=>e.id));
  for(const tick of layout.ticks)close(tick.x,layout.tube.x+tick.position/layout.totalLength*layout.tube.width);
  if(layout.mode==='table'){assert.deepEqual(layout.labels,[]);assert.ok(layout.height<120);return;}
  assert.deepEqual(layout.labels.map(e=>e.id),layout.entries.map(e=>e.id),'Every mark has its own visible reference');
  const polygons=layout.labels.map(l=>rectPolygon(l.x,l.y,l.width,l.height));
  layout.labels.forEach((label,index)=>{
    assert(label.box.x>=0&&label.box.x+label.box.width<=layout.width);
    assert(label.box.y>=0&&label.box.y+label.box.height<=layout.height);
    const tick=layout.ticks[index];close(label.x,tick.x);close(label.leader[0][0],tick.x);close(label.leader[1][0],tick.x);
    assert(Math.abs(label.leader[1][1]-label.leader[0][1])<90,'Local reference leaders remain short');
    for(let j=0;j<index;j++)assert.equal(polygonsOverlap(polygons[index],polygons[j],5),false,'Reference labels do not overlap');
    for(let j=0;j<layout.labels.length;j++)if(j!==index){
      const box=layout.labels[j].box,x=label.x,lo=Math.min(...label.leader.map(p=>p[1])),hi=Math.max(...label.leader.map(p=>p[1]));
      assert(!(x>box.x-1&&x<box.x+box.width+1&&hi>box.y-1&&lo<box.y+box.height+1),'A reference leader must not cross another label');
    }
  });
};

// The saved 12-bend wall-protrusion fixture, kept here so the test is portable.
const example={benderId:'swagelok-ms-htb-12m',measurementMode:'vertex',radius:38,diameter:12,heading:0,
  lengths:[735.0282538143907,69.25650762878142,761.0282538143907,196.57568516986024,190,196.5756851698603,761.0282538143911,69.25650762878121,961.0282538143908,196.57568516986004,190,196.57568516986004,826.0000000000001],
  turns:[45,45,45,-45,-45,45,45,45,45,-45,-45,45]};
const report=bendMarkLayout(example,getBender(example.benderId));assert(report.supported);
const fixture=report.marks.map(mark=>({id:mark.id,position:mark.position,valueText:mark.position.toFixed(1)+' mm'}));
for(const width of [720,900,1200]){
  const result=layoutBlankMarks(fixture,{totalLength:report.totalLength,width});
  assert.equal(result.mode,'labels','The 12-bend workshop fixture retains every label');
  assert.equal(result.labels.length,12);assert(result.height<260);validate(result);
}
const screenshot=[935,1001.3,1759.3,1952.9,2139.9,2333.5,3291.5,3357.8,3935.8,4242.5,4509.5,4816.2].map((position,i)=>({id:'B'+(i+1),position}));
for(const width of [720,900]){const layout=layoutBlankMarks(screenshot,{totalLength:5259.2,width});assert.equal(layout.mode,'labels');validate(layout);}

for(const width of [280,320,480,720,900])for(const count of [0,1,2,12,40,200]){
  const entries=Array.from({length:count},(_,i)=>({id:'B'+(i+1),position:(i+1)/(count+1)*6000}));
  const layout=layoutBlankMarks(entries,{totalLength:6000,width});validate(layout);
  assert(layout.height<270,'Overview height stays bounded');
}
const coincident=Array.from({length:200},(_,i)=>({id:'B'+(i+1),position:3000+i*.1}));
const dense=layoutBlankMarks(coincident,{totalLength:6000});assert.equal(dense.mode,'table');assert.equal(dense.entries.length,200);validate(dense);
const tiny=layoutBlankMarks([{id:'B1',position:100},{id:'B2',position:100.1}],{totalLength:6000});assert.equal(tiny.labels.length,2);validate(tiny);assert(tiny.ticks[1].x>tiny.ticks[0].x);
const ends=layoutBlankMarks([{id:'B1',position:0},{id:'B2',position:6000}],{totalLength:6000});validate(ends);close(ends.ticks[0].x,ends.tube.x);close(ends.ticks[1].x,ends.tube.x+ends.tube.width);
const original=[{id:'B2',position:3000},{id:'B1',position:100}];const before=JSON.stringify(original);const unsorted=layoutBlankMarks(original,{totalLength:6000});validate(unsorted);assert.equal(JSON.stringify(original),before);
for(const args of [()=>layoutBlankMarks([],{totalLength:0}),()=>layoutBlankMarks([{id:'B1',position:NaN}],{totalLength:6000}),()=>layoutBlankMarks([{id:'B1',position:6001}],{totalLength:6000}),()=>layoutBlankMarks([{id:'B1',position:1},{id:'B1',position:2}],{totalLength:6000})])assert.throws(args,RangeError);

console.log('Developed pipe: complete bend IDs, exact tick spacing, close pairs, bounded dense fallback and non-overlapping references PASS');
