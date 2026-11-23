import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFromProcess, generateSequence, overallStatus } from '../core.js';

const instrument = {signalType:'4-20mA',processMin:0,processMax:10,rawMin:0,rawMax:27648,normalMin:2,normalMax:8};

test('9 bar maps to 90%, 18.4 mA and about 24883 raw', () => {
  const result = calculateFromProcess(9, instrument);
  assert.equal(result.percent, 90);
  assert.ok(Math.abs(result.signal - 18.4) < 1e-9);
  assert.equal(Math.round(result.raw), 24883);
});

test('rising HH sequence crosses trip then reset in the correct direction', () => {
  const points = generateSequence(instrument,{level:'HH',direction:'rising',tripValue:9,resetValue:8.5},1);
  assert.deepEqual(points.map(p=>Number(p.processValue.toFixed(1))),[5,8.9,9,9.1,8.6,8.5,8.4]);
});

test('falling LL sequence crosses trip then reset in the correct direction', () => {
  const points = generateSequence(instrument,{level:'LL',direction:'falling',tripValue:1,resetValue:1.5},1);
  assert.deepEqual(points.map(p=>Number(p.processValue.toFixed(1))),[5,1.1,1,.9,1.4,1.5,1.6]);
});

test('one failed point makes the overall report failed', () => {
  assert.equal(overallStatus([{status:'passed'},{status:'failed'},{status:'not-tested'}]),'failed');
});
