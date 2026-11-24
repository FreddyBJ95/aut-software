import test from 'node:test';
import assert from 'node:assert/strict';
import { importProject, parseProject } from '../project.js';

const timestamp = '2026-11-24T10:30:00.000Z';

function legacyProject() {
  const instrument = {
    tag: 'PT-101', description: 'Tryktransmitter', location: 'Proceslinje 1', unit: 'bar',
    signalType: '4-20mA', processMin: 0, processMax: 10, rawMin: 0, rawMax: 27648,
    normalMin: 2, normalMax: 8, comment: ''
  };
  const interlock = {
    tag: 'PSHH-101', level: 'HH', direction: 'rising', tripValue: 9, resetValue: 8.5,
    delaySeconds: 2, resetMode: 'manual', expectedAlarm: 'HH alarm',
    expectedActions: 'Stop P-101', testDelta: 1
  };
  return {
    instrument, interlock, instrumentSnapshot: { ...instrument }, interlockSnapshot: { ...interlock },
    points: [{
      id: 'tp-1', order: 1, label: 'På tripgrænsen', processValue: 9, signalValue: 18.4,
      rawValue: 24883.2, expectedResult: 'HH trip forventet', observedResult: 'P-101 stopped',
      status: 'passed', comment: '', testedBy: 'AB', testedAt: timestamp
    }],
    safetyConfirmed: true, simulatorValue: 9, locale: 'no', createdAt: timestamp, updatedAt: timestamp
  };
}

test('parses an existing project without altering its results or settings', () => {
  const project = legacyProject();
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
});

test('copies missing snapshots from the imported configuration', () => {
  const project = legacyProject();
  delete project.instrumentSnapshot;
  delete project.interlockSnapshot;
  project.instrument.tag = 'PT-202';
  project.interlock.tag = 'PSHH-202';

  const parsed = parseProject(JSON.stringify(project));
  assert.deepEqual(parsed.instrumentSnapshot, parsed.instrument);
  assert.deepEqual(parsed.interlockSnapshot, parsed.interlock);
  assert.notEqual(parsed.instrumentSnapshot, parsed.instrument);
  assert.notEqual(parsed.interlockSnapshot, parsed.interlock);
});

test('preserves incomplete draft fields and older measurements with out-of-range values', () => {
  const project = legacyProject();
  project.instrument.processMin = null;
  project.interlock.tripValue = null;
  project.points[0].signalValue = 20.16;
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
});

test('accepts null digital raw values and positive hold times', () => {
  const project = legacyProject();
  project.instrument.signalType = 'digital-nc';
  project.instrumentSnapshot.signalType = 'digital-no';
  Object.assign(project.points[0], { processValue: 1, signalValue: 1, rawValue: null, holdSeconds: 2 });
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
});

test('rejects malformed project data before writing or replacing the existing project', () => {
  const saved = JSON.stringify(legacyProject());
  let stored = saved;
  let active = parseProject(stored);
  const rejectedChanges = [
    project => { project.points = [null]; },
    project => { project.points[0].rawValue = null; },
    project => {
      project.instrumentSnapshot.signalType = 'digital-no';
      Object.assign(project.points[0], { processValue: 1, signalValue: 2, rawValue: null });
    },
    project => { project.points[0].status = 'unfinished'; },
    project => { project.points[0].testedAt = 'not a date'; },
    project => { project.points[0].signalValue = '18.4'; },
    project => { project.points[0].holdSeconds = -1; },
    project => { project.points.push({ ...project.points[0] }); },
    project => { project.instrumentSnapshot = []; },
    project => { project.instrument.signalType = 'constructor'; }
  ];

  for (const change of rejectedChanges) {
    const project = legacyProject();
    change(project);
    assert.throws(() => {
      active = importProject(JSON.stringify(project), candidate => { stored = JSON.stringify(candidate); });
    }, TypeError);
    assert.equal(stored, saved);
    assert.deepEqual(active, legacyProject());
  }
});

test('returns the replacement only after persistence succeeds', () => {
  let active = legacyProject();
  const replacement = legacyProject();
  replacement.instrument.tag = 'PT-202';
  const jsonText = JSON.stringify(replacement);

  assert.throws(() => {
    active = importProject(jsonText, () => { throw new Error('Storage unavailable'); });
  }, /Storage unavailable/);
  assert.equal(active.instrument.tag, 'PT-101');

  let stored;
  active = importProject(jsonText, candidate => {
    assert.equal(active.instrument.tag, 'PT-101');
    stored = JSON.stringify(candidate);
  });
  assert.equal(active.instrument.tag, 'PT-202');
  assert.deepEqual(parseProject(stored), active);
});
