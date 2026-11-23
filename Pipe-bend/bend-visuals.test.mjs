import assert from 'node:assert/strict';
import {STANDARD_BEND_ANGLES,bendVisual,bendBadgeLines,bendAccessibleLabel,bendInlineLabelPlacement} from './bend-visuals.mjs';

assert.deepEqual(STANDARD_BEND_ANGLES,[30,45,60,90]);
for(const angle of STANDARD_BEND_ANGLES){
 const positive=bendVisual(angle),negative=bendVisual(-angle);
 assert.equal(positive.standard,true);assert.equal(positive.key,String(angle));assert.deepEqual(negative,positive);
}
assert.equal(bendVisual(45).stroke,'#1565A8');
assert.equal(bendVisual(45).tube,'#4B8FC2');
assert.equal(bendVisual(90).stroke,'#185C46');
assert.equal(bendVisual(60).tube,'#D0A91E');
assert.equal(bendVisual(37).standard,false);assert.equal(bendVisual(37).key,'special');
assert.equal(bendVisual(45+1e-7).standard,true);assert.equal(bendVisual(45.01).standard,false);
assert.deepEqual(bendBadgeLines('B3',45),['B3','45°']);
assert.deepEqual(bendBadgeLines('B3',37,{format:value=>value.toFixed(1),special:'SÆRLIG'}),['B3','SÆRLIG · 37.0°']);
assert.equal(bendAccessibleLabel('B8',-90),'B8 · 90°');
assert.equal(bendAccessibleLabel('B8',-42,{special:'SPECIAL'}),'B8 · SPECIAL · 42°');
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];},contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05);};
for(const angle of [...STANDARD_BEND_ANGLES,37]){const visual=bendVisual(angle);assert(contrast(visual.text,visual.fill)>=4.5,`${angle}° text must remain readable on its fill`);}
for(const invalid of [NaN,Infinity,-Infinity,'45',null,undefined])assert.throws(()=>bendVisual(invalid),TypeError);

for(let degrees=0;degrees<360;degrees+=15){
 const radians=degrees*Math.PI/180,outward=[Math.cos(radians),Math.sin(radians)],placement=bendInlineLabelPlacement([200,200],outward,{text:'B10',fontSize:10,pipeWidth:22,paintStroke:3,gap:4,width:400,height:400});
 assert.equal(placement.visible,true);assert(Math.abs(placement.distance-placement.radialExtent-placement.pipeWidth/2-placement.gap)<1e-9,`${degrees}° tag clearance`);
 assert(placement.box.x>=4&&placement.box.y>=4&&placement.box.x+placement.box.width<=396&&placement.box.y+placement.box.height<=396);
 assert(Math.hypot(placement.x-200,placement.y-200)>22/2,'The tag center must leave the work-bend halo');
}
const flipped=bendInlineLabelPlacement([12,100],[-1,0],{text:'B1',fontSize:10,pipeWidth:14,width:220,height:200});
assert.equal(flipped.visible,true);assert.equal(flipped.flipped,true);assert(flipped.x>12,'A tag at the edge moves to the safe side');
const shortTag=bendInlineLabelPlacement([100,100],[1,0],{text:'B1'}),specialTag=bendInlineLabelPlacement([100,100],[1,0],{text:'B3 · SPECIAL 37°'});
assert(specialTag.distance>shortTag.distance,'Long fallback labels reserve more radial space');
for(const args of [[null,[1,0]],[[0,0],[NaN,0]],[[0,0],[1,0],{fontSize:0}],[[0,0],[1,0],{pipeWidth:-1}]])assert.throws(()=>bendInlineLabelPlacement(...args),TypeError);

console.log('Bend colors and labels: palette, explicit special labels and bend-clearing inline placement PASS');
