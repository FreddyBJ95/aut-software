import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSimulation,
  calculateFromField,
  calculateFromProcess,
  generateSequence,
  isTripped,
  overallStatus,
  validateProfile
} from '../core.js';

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

const rising = { level: 'HH', direction: 'rising', tripValue: 9, resetValue: 8.5 };

test('normal start is chosen on the reset side when the normal range overlaps trip', () => {
  const lowTrip = { ...rising, tripValue: 4, resetValue: 3.5 };
  const [baseline] = generateSequence(instrument, lowTrip);
  assert.equal(baseline.processValue, 2.75);
  assert.equal(isTripped(baseline.processValue, lowTrip, instrument), false);

  const highTrip = { ...rising, direction: 'falling', tripValue: 6, resetValue: 7 };
  const [fallingBaseline] = generateSequence(instrument, highTrip);
  assert.equal(fallingBaseline.processValue, 7.5);
  assert.equal(isTripped(fallingBaseline.processValue, highTrip, instrument), false);
});

test('sequence refuses invalid scaling, reset order, and out-of-range test points', () => {
  const invalidCases = [
    [{ ...instrument, processMax: 0 }, rising, 1, /Procesmaksimum/],
    [{ ...instrument, rawMax: 0 }, rising, 1, /PLC-råmaksimum/],
    [instrument, { ...rising, resetValue: 9.5 }, 1, /forkerte side/],
    [instrument, { ...rising, tripValue: 10 }, 1, /uden for måleområdet/],
    [instrument, rising, 0, /større end nul/],
    [instrument, rising, 1e-19, /for lille/]
  ];
  for (const [profile, interlock, distance, message] of invalidCases) {
    assert.match(validateProfile(profile, interlock, distance), message);
    assert.throws(() => generateSequence(profile, interlock, distance), message);
  }
  const points = generateSequence(instrument, rising, 10);
  assert.ok(points.every(point => point.signalValue >= 4 && point.signalValue <= 20));
  const approach = points.find(point => point.label === 'Tilbage mod reset');
  assert.ok(approach.processValue > rising.resetValue && approach.processValue < rising.tripValue);
});

test('digital contact state is binary, with opposite NO/NC states and no PLC raw scaling', () => {
  const no = { signalType: 'digital-no' };
  const nc = { signalType: 'digital-nc' };
  assert.deepEqual([0, 1].map(value => calculateFromProcess(value, no).signal), [0, 1]);
  assert.deepEqual([0, 1].map(value => calculateFromProcess(value, nc).signal), [1, 0]);
  assert.equal(calculateFromProcess(0, nc).raw, null);
  assert.ok(Number.isNaN(calculateFromProcess(0.5, nc).signal));
  assert.equal(calculateFromField('signal', 0, nc).process, 1);
  assert.ok(Number.isNaN(calculateFromField('raw', 1, no).process));
  for (const direction of ['rising', 'falling']) {
    const interlock = { direction, level: 'HH', resetMode: 'automatic' };
    const points = generateSequence(nc, interlock);
    const tripsOn = direction === 'rising' ? 1 : 0;
    assert.deepEqual(points.map(point => point.processValue), [1 - tripsOn, tripsOn, 1 - tripsOn]);
    assert.deepEqual(points.map(point => point.signalValue), [tripsOn, 1 - tripsOn, tripsOn]);
    assert.ok(points.every(point => point.rawValue === null));
  }
});

test('the live simulator honors trip delay, hysteresis and a separate manual reset', () => {
  const interlock = { ...rising, resetMode: 'manual', delaySeconds: 2 };
  const step = (state, value, now, requestReset = false) =>
    advanceSimulation(state, value, instrument, interlock, { now, requestReset });
  let state = step(null, 9, 0);
  assert.deepEqual(state, { phase: 'pending', pendingSince: 0, remainingSeconds: 2 });
  state = step(state, 8.9, 1900);
  assert.equal(state.phase, 'normal');
  state = step(state, 9, 2000);
  state = step(state, 9.1, 3999);
  assert.equal(state.phase, 'pending');
  state = step(state, 9.1, 4000);
  assert.equal(state.phase, 'tripped');
  state = step(state, 8.7, 4001, true);
  assert.equal(state.phase, 'tripped');
  state = step(state, 8.5, 4002);
  assert.equal(state.phase, 'ready-to-reset');
  state = step(state, 8.4, 4003, true);
  assert.equal(state.phase, 'normal');
});

test('automatic reset releases at the falling reset boundary', () => {
  const falling = { direction: 'falling', tripValue: 1, resetValue: 1.5, resetMode: 'automatic' };
  let state = advanceSimulation(null, 1, instrument, falling, { now: 0 });
  assert.equal(state.phase, 'tripped');
  state = advanceSimulation(state, 1.49, instrument, falling, { now: 1 });
  assert.equal(state.phase, 'tripped');
  state = advanceSimulation(state, 1.5, instrument, falling, { now: 2 });
  assert.equal(state.phase, 'normal');
});

test('simulation tolerates floating-point round-off at thresholds only', () => {
  const interlock = { ...rising, tripValue: 0.3, resetValue: 0.2 };
  assert.equal(isTripped(0.1 * 3, interlock, instrument), true);
  assert.equal(isTripped(0.3 - Number.EPSILON / 2, interlock, instrument), true);
  assert.equal(isTripped(0.2999999, interlock, instrument), false);
  const zeroBasedTrip = { ...interlock, tripValue: 0, resetValue: -0.2 };
  const bipolar = { ...instrument, processMin: -1, processMax: 2 };
  const signalAtTrip = calculateFromProcess(0, bipolar).signal;
  const inferredProcess = calculateFromField('signal', signalAtTrip, bipolar).process;
  assert.equal(isTripped(inferredProcess, zeroBasedTrip, bipolar), true);
  assert.equal(isTripped(-1e-7, zeroBasedTrip, bipolar), false);
});

test('plan separates the immediate trip condition, elapsed delay and manual reset', () => {
  const points = generateSequence(instrument, { ...rising, delaySeconds: 2, resetMode: 'manual' });
  const boundary = points.find(point => point.label === 'På tripgrænsen');
  const delayed = points.find(point => point.label === 'Trip efter forsinkelse');
  const ready = points.find(point => point.label === 'På resetgrænsen');
  assert.equal(boundary.processValue, delayed.processValue);
  assert.equal(boundary.expectedResult, 'Forsinkelse aktiv — intet trip endnu');
  assert.equal(delayed.holdSeconds, 2);
  assert.equal(delayed.expectedResult, 'HH trip forventet');
  assert.equal(ready.expectedResult, 'Reset mulig — afventer manuel reset');
  assert.equal(points.at(-1).label, 'Manuel reset');
  assert.equal(points.at(-1).expectedResult, 'Interlock reset');
});
