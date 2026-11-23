import assert from 'node:assert/strict';
import {geometry} from './geometry.mjs';
import {rectPolygon,polygonsOverlap} from './dimension-layout.mjs';
import {layoutMainDetailAnnotations} from './main-detail-annotations.mjs';

const model={lengths:[60,60],turns:[90],radius:38,heading:0,measurementMode:'tangent'};
const g=geometry(model),before=structuredClone(g);
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} should equal ${b}`);
function scene({angle=0,mirror=1,width=736,height=430,pixelsPerMm=2,zoom=4,geometry:g2=g,obstacles=[]}={}){
  const c=Math.cos(angle),s=Math.sin(angle),rotate=p=>[(p[0]-49)*c-(p[1]-49)*s,mirror*((p[0]-49)*s+(p[1]-49)*c)];
  return{geometry:g2,radius:38,diameter:12,pixelsPerMm,zoom,width,height,obstacles,mapPoint:p=>{const q=rotate(p);return[width/2+q[0]*pixelsPerMm,height/2-q[1]*pixelsPerMm];}};
}
function checked(input){
  const result=layoutMainDetailAnnotations(input),boxes=[];
  assert.ok(result.dimensions.filter(d=>d.kind==='diameter').length<=1);
  assert.ok(result.dimensions.filter(d=>d.kind==='radius').length<=1);
  for(const d of result.dimensions){
    assert.equal(d.value,d.kind==='diameter'?input.diameter:input.radius);
    assert.equal(d.label.height,22,'Text size is independent of zoom.');
    assert.ok(d.label.polygon.every(([x,y])=>x>=6&&x<=input.width-6&&y>=6&&y<=input.height-6));
    for(const obstacle of [...input.obstacles,...boxes])assert.ok(!polygonsOverlap(d.label.polygon,obstacle,3),'Detail text stays clear of all obstacle and detail text boxes.');
    boxes.push(d.label.polygon);
    const measure=d.lines.find(line=>line.kind==='measure');
    near(length(measure.a,measure.b),d.value*input.pixelsPerMm);
    for(const p of d.markers.map(m=>m.point).concat(d.lines.flatMap(l=>[l.a,l.b])))assert.ok(p.every(Number.isFinite));
    if(d.kind==='radius'){
      const arc=input.geometry.arcs[d.index],center=d.markers.find(m=>m.kind==='center').point;
      for(const marker of d.markers.filter(m=>m.kind==='tangent'))near(length(center,marker.point),input.radius*input.pixelsPerMm);
      assert.ok(d.markers.filter(m=>m.kind==='tangent').every(m=>[arc.samples[0],arc.samples.at(-1)].some(p=>length(m.point,input.mapPoint(p))<1e-6)));
    }
  }
  return result;
}

for(const width of [340,736])for(const angle of [0,.41,Math.PI/2,-2.4])for(const mirror of [-1,1]){
  const result=checked(scene({width,angle,mirror}));
  assert.equal(result.dimensions.length,2,'An uncluttered enlarged bend shows both physical dimensions.');
}
assert.deepEqual(g,before,'Overlay creation never changes the pipe geometry.');
for(const turn of [45,-45,135,-135,179,-179]){
  const geometry2=geometry({...model,turns:[turn],heading:.73}),xs=geometry2.points.map(p=>p[0]),ys=geometry2.points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const rotated=checked({...scene(),geometry:geometry2,width:736,height:600,mapPoint:p=>[368+(p[0]-cx)*2,300-(p[1]-cy)*2]});
  assert.ok(rotated.dimensions.some(d=>d.kind==='radius'),'Signed, rotated and nearly semicircular bends retain their exact center.');
}
assert.deepEqual(layoutMainDetailAnnotations(scene({zoom:1})),{dimensions:[]},'Fit overview stays uncluttered.');
assert.deepEqual(layoutMainDetailAnnotations(scene({pixelsPerMm:.4})),{dimensions:[]},'Unresolvable physical sizes stay hidden.');
assert.deepEqual(checked(scene({pixelsPerMm:.95})).dimensions.map(d=>d.kind),['radius'],'Radius can become legible before the OD span.');

const basic=scene(),initial=checked(basic);
const occupied=initial.dimensions.map(d=>d.label.polygon);
checked({...basic,obstacles:occupied});
const localClutter=rectPolygon(434,281,134,134),arcOnly={lines:[],arcs:g.arcs};
const fallback=checked({...basic,geometry:arcOnly,obstacles:[localClutter]});
assert.ok(fallback.dimensions.some(d=>d.kind==='radius'),'A radius label uses nearby free space when existing annotations fill its tight local positions.');
const radiusLeader=fallback.dimensions[0].lines.find(line=>line.kind==='leader');
assert.ok(length(radiusLeader.a,radiusLeader.b)<=84,'The fallback remains a short, bounded local reference.');
assert.deepEqual(checked({...basic,obstacles:[rectPolygon(basic.width/2,basic.height/2,basic.width,basic.height)]}).dimensions,[],'A fully occupied viewport omits optional detail labels.');
assert.deepEqual(checked({...basic,mapPoint:p=>[p[0]*2+3000,p[1]*2+3000]}).dimensions,[],'Offscreen geometry produces no detached details.');
const giantLine={lines:[{start:[-10000,0],end:[10000,0]}],arcs:[]};
const longDetail=checked({...basic,geometry:giantLine,mapPoint:p=>[p[0]*2+basic.width/2,p[1]*2+basic.height/2]});
assert.equal(longDetail.dimensions[0].kind,'diameter','A long line receives its detail on the visible portion, even when its endpoints are far away.');
near(longDetail.dimensions[0].lines[0].a[0],basic.width/2);
assert.equal(checked({...basic,geometry:{lines:[null,{start:[0,0],end:[0,0]},g.lines[0]],arcs:[null]}}).dimensions[0].index,2,'Invalid individual primitives are skipped.');
const fractional=checked({...basic,diameter:12.7,radius:38.1,geometry:geometry({...model,radius:38.1}),format:n=>String(n).replace('.',',')});
assert.ok(fractional.dimensions.some(d=>d.text==='Ø12,7 mm'));assert.ok(fractional.dimensions.some(d=>d.text==='R38,1 mm'));
for(const invalid of [undefined,{}, {...basic,width:NaN},{...basic,pixelsPerMm:0},{...basic,mapPoint:null},{...basic,geometry:{lines:[],arcs:null}}])assert.deepEqual(layoutMainDetailAnnotations(invalid),{dimensions:[]});
console.log('Main detail overlays: exact physical OD/radius, rotated and mirrored views, screen size, visible stations, collisions and zoom thresholds PASS');
