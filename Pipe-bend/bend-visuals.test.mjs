import assert from 'node:assert/strict';
import {STANDARD_BEND_ANGLES,bendVisual,bendBadgeLines,bendAccessibleLabel} from './bend-visuals.mjs';

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

console.log('Bend colors: shared 30/45/60/90 palette, signed angles and explicit special labels PASS');
