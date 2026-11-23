import assert from 'node:assert/strict';
import { SWAGELOK_BENDERS, getBender, getBenderGain } from './benders.mjs';

const angles = [30,45,50,55,60,65,70,75,80,85,90];
const close = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-10, `${actual} != ${expected}`);
assert.equal(SWAGELOK_BENDERS.length,11);
assert.equal(new Set(SWAGELOK_BENDERS.map(b=>b.id)).size,11);
assert.equal(SWAGELOK_BENDERS.filter(b=>b.nativeUnits==='mm').length,5);
assert.equal(SWAGELOK_BENDERS.filter(b=>b.nativeUnits==='in').length,6);

const expectedMetric = {
  'MS-HTB-3M': [3,15,19,[0,1,1,1,2,2,3,3,4,5,6]],
  'MS-HTB-6M': [6,15,21,[1,1,2,2,3,3,4,5,6,7,8]],
  'MS-HTB-8M': [8,24,23,[1,2,2,3,3,4,5,6,8,10,12]],
  'MS-HTB-10M': [10,24,25,[1,2,2,3,4,4,5,7,8,10,12]],
  'MS-HTB-12M': [12,38,31,[1,3,3,4,5,7,8,10,12,15,18]],
};
for(const [model,[od,radius,straight,gains]] of Object.entries(expectedMetric)) {
  const b=getBender(model);
  assert(b,model); assert.equal(b.tubeODmm,od); assert.equal(b.radiusMm,radius); assert.equal(b.minStraightMm,straight);
  assert.deepEqual(angles.map(a=>getBenderGain(b,a)),gains);
}

// Native-inch data is checked separately: metric tools with similar dimensions
// must not substitute for fractional tools or round away a fraction of an inch.
const expectedFractional = {
  'MS-HTB-2': [1/8,9/16,23/32,[0,1,1,1,1,2,2,2,3,4,4]],
  'MS-HTB-4T': [1/4,9/16,13/16,[0,1,1,1,2,2,2,3,3,4,5]],
  'MS-HTB-4': [1/4,3/4,13/16,[0,1,1,1,1,2,2,3,3,4,5]],
  'MS-HTB-5': [5/16,15/16,7/8,[0,1,1,2,2,3,3,4,5,6,7]],
  'MS-HTB-6T': [3/8,15/16,15/16,[0,1,1,1,2,2,3,4,5,6,7]],
  'MS-HTB-8': [1/2,1.5,1+3/16,[1,1,2,2,3,4,5,6,7,9,11]],
};
for(const [model,[od,radius,straight,numerators]] of Object.entries(expectedFractional)) {
  const b=getBender(model);
  assert(b,model); close(b.tubeODmm,od*25.4); close(b.radiusMm,radius*25.4); close(b.minStraightMm,straight*25.4);
  for(let i=0;i<angles.length;i++)close(getBenderGain(b,angles[i]),numerators[i]/16*25.4);
}
close(getBender('MS-HTB-4').radiusMm,19.05);
close(getBender('MS-HTB-4T').radiusMm,14.2875);
assert.notEqual(getBenderGain('MS-HTB-4',60),getBenderGain('MS-HTB-4T',60));

for(const b of SWAGELOK_BENDERS) {
  assert.equal(getBender(b.id),b);
  assert.equal(getBender(` ${b.model.toLowerCase()} `),b);
  assert(b.source.url.startsWith('https://www.swagelok.com/'));
  assert(b.source.productUrl.includes(b.model));
  assert(b.source.pages.includes(23));
  assert.match(b.source.revision,/Rev G/);
  assert.match(b.minStraightMeaning,/not a minimum distance between bends/);
  assert.equal(b.maxBendAngle,180);
  assert.deepEqual(Object.keys(b.gainsMm).map(Number),angles);
  let previous=-Infinity;
  for(const angle of angles) {
    const gain=getBenderGain(b,angle);
    assert(Number.isFinite(gain)&&gain>=0&&gain>=previous);
    assert.equal(getBenderGain(b,-angle),gain);
    previous=gain;
  }
}
const twelve=getBender('swagelok-ms-htb-12m');
assert.equal(getBenderGain(twelve,90),18);
assert.equal(getBenderGain(twelve,45),3);
assert.equal(getBenderGain(twelve,45+1e-10),3);
for(const angle of [NaN,Infinity,-Infinity,0,22.5,29.9,44,45.01,46,91,135,180,'90',null,undefined])assert.equal(getBenderGain(twelve,angle),null);
for(const invalid of ['',null,undefined,{},'not-a-tool'])assert.equal(getBender(invalid),null);
assert.equal(getBenderGain('not-a-tool',90),null);
assert.equal(getBenderGain({id:'not-a-tool',gainsMm:{90:99}},90),null);
assert(Object.isFrozen(SWAGELOK_BENDERS)&&Object.isFrozen(twelve)&&Object.isFrozen(twelve.gainsMm));
console.log('Swagelok catalog:11 verified hand benders, exact metric/fractional gain tables, source metadata and unsupported-angle handling PASS');
