import assert from 'node:assert/strict';
import {geometry, extend} from './geometry.mjs';
import {getBender} from './benders.mjs';
import {measurementMode, tangentLengths, vertexLengths, validateMeasurements,
  convertMeasurementMode, bendMarkLayout} from './measurements.mjs';

const close = (actual, expected, message='') => assert.ok(Math.abs(actual-expected)<1e-8,
  `${message}: ${actual} != ${expected}`);
const vectorClose=(a,b,message='')=>a.forEach((value,index)=>close(value,b[index],message));
const profile = getBender('swagelok-ms-htb-12m');
assert(profile, 'The manufacturer catalog must contain the photographed 12 mm bender');
const sample={version:1,diameter:12,radius:38,heading:0,measurementMode:'vertex',
  benderId:profile.id,lengths:[100,200,200,300,600,1000],turns:[90,-90,-90,90,90],
  placement:{start:[400,200],room:{width:5000,height:3000}}};
const untouched=structuredClone(sample);

assert.equal(measurementMode({}), 'tangent', 'Old projects retain their input convention');
vectorClose(tangentLengths(sample),[62,124,124,224,524,962]);
assert.deepEqual(vertexLengths(sample),sample.lengths);
assert.equal(validateMeasurements(sample),null);
const g=geometry(sample);
close(g.used,2020+5*38*Math.PI/2, 'Ideal centerline material consumption');
close(g.used,2318.4513020910304);
for(let i=0;i<g.lines.length;i++){
  const line=g.lines[i];
  close(line.length,tangentLengths(sample)[i]);
  close(line.dimension,sample.lengths[i]);
  close(Math.hypot(line.dimensionEnd[0]-line.dimensionStart[0],line.dimensionEnd[1]-line.dimensionStart[1]),sample.lengths[i]);
  if(i<g.lines.length-1)vectorClose(line.dimensionEnd,g.lines[i+1].dimensionStart,'Adjacent dimension endpoints share the theoretical corner');
}

// Switching input convention keeps the centerline, arcs and both endpoints fixed.
for(const heading of [0,.4,-1.2]){
  const original={...sample,heading};
  const tangent=convertMeasurementMode(original,'tangent'), roundTrip=convertMeasurementMode(tangent,'vertex');
  assert.equal(tangent.measurementMode,'tangent');
  assert.deepEqual(tangent.placement,original.placement);
  assert.notEqual(tangent.placement,original.placement);
  vectorClose(roundTrip.lengths,original.lengths);
  const before=geometry(original),after=geometry(tangent);
  close(after.used,before.used);
  before.lines.forEach((line,index)=>{
    vectorClose(line.start,after.lines[index].start);
    vectorClose(line.end,after.lines[index].end);
  });
  before.arcs.forEach((arc,index)=>arc.samples.forEach((point,j)=>vectorClose(point,after.arcs[index].samples[j])));
}

const layout=bendMarkLayout(sample);
assert.equal(layout.supported,true);
assert.deepEqual(layout.marks.map(mark=>mark.position),[100,282,464,746,1328]);
assert.deepEqual(layout.marks.map(mark=>mark.gainApplied),[0,18,18,18,18]);
assert.deepEqual(layout.gains,[18,18,18,18,18]);
assert.deepEqual(layout.intervals,[100,182,182,282,582,982]);
assert.equal(layout.endPosition,2310);
assert.equal(layout.totalLength,2310);
assert.equal(layout.cutLength,2310);
assert(layout.endPosition<g.used,'Tool table layout must stay distinct from ideal centerline geometry');
assert.deepEqual(bendMarkLayout(convertMeasurementMode(sample,'tangent')).marks,layout.marks);
assert.equal(bendMarkLayout({...sample,benderId:undefined},profile.model).endPosition,2310);

const unsupported=bendMarkLayout({...sample,turns:[40,...sample.turns.slice(1)]});
assert.equal(unsupported.supported,false);
assert.equal(unsupported.reason,'unsupported-angle');
assert.equal(unsupported.unsupportedAngle,40);
assert.deepEqual(unsupported.marks,[]);
assert.equal(unsupported.endPosition,null);
for(const changed of [{diameter:10},{radius:40},{benderId:'not-a-bender'}]){
  const report=bendMarkLayout({...sample,...changed});
  assert.equal(report.supported,false);
  assert.equal(report.endPosition,null);
  assert.deepEqual(report.marks,[]);
}
const one={diameter:12,radius:38,lengths:[100],turns:[],benderId:profile.id};
assert.deepEqual(bendMarkLayout(one).marks,[]);
assert.equal(bendMarkLayout(one).endPosition,100);
assert.equal(bendMarkLayout({...one,lengths:[]}).supported,false);

for(const state of [
  {...sample,lengths:[0,...sample.lengths.slice(1)]},
  {...sample,lengths:[NaN,...sample.lengths.slice(1)]},
  {...sample,lengths:['100',...sample.lengths.slice(1)]},
  {...sample,radius:0},
  {...sample,heading:Infinity},
  {...sample,turns:[180,...sample.turns.slice(1)]},
  {...sample,turns:[NaN,...sample.turns.slice(1)]},
  {...sample,turns:[]},
  {...sample,measurementMode:'outside'},
  {...one,measurementMode:'vertex',lengths:[38,100],turns:[90]},
  {...one,measurementMode:'vertex',lengths:[100,76,100],turns:[90,90]},
]){
  assert.equal(typeof validateMeasurements(state),'string');
  assert.throws(()=>geometry(state),RangeError);
  assert.equal(bendMarkLayout(state,profile).supported,false);
}
assert.throws(()=>convertMeasurementMode(sample,'outside'),RangeError);
assert.deepEqual(sample,untouched,'No measurement or layout operation mutates the source project');

// Both-end editing still yields valid dimensions; the established tangent behavior
// is additionally covered by the original test.mjs regression suite.
for(const end of ['A','B']){
  const candidate=extend(sample,end,150,45);
  assert.equal(validateMeasurements(candidate),null);
  assert.equal(geometry(candidate).lines.length,sample.lengths.length+1);
}
assert.equal(validateMeasurements(extend({radius:38,lengths:[100],turns:[]},'A',150,45)),null,
  'An omitted start heading still defaults to zero when extending from A');
console.log('Vertex/tangent geometry, preserving mode conversion, exact tool marks and invalid layouts: PASS');
