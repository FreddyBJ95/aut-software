import { signalRanges } from './core.js';

const locales = ['da', 'no', 'en'];
const statuses = ['not-tested', 'passed', 'failed'];

function requireField(valid, field) {
  if (!valid) throw new TypeError(`Invalid project field: ${field}`);
}

function readRecord(value, field) {
  requireField(value !== null && typeof value === 'object' && !Array.isArray(value), field);
  return value;
}

function readTextFields(record, names, field) {
  for (const name of names) {
    requireField(typeof record[name] === 'string', `${field}.${name}`);
  }
}

function readNumericFields(record, names, field) {
  for (const name of names) {
    const value = record[name];
    requireField(value === null || Number.isFinite(value), `${field}.${name}`);
  }
}

function isDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function readInstrument(value, field) {
  const instrument = {
    description: '', location: '', unit: '', comment: '', normalMin: null, normalMax: null,
    ...readRecord(value, field)
  };
  readTextFields(instrument, ['tag', 'description', 'location', 'unit', 'comment'], field);
  requireField(typeof instrument.signalType === 'string' && Object.hasOwn(signalRanges, instrument.signalType), `${field}.signalType`);
  readNumericFields(instrument, ['processMin', 'processMax', 'rawMin', 'rawMax', 'normalMin', 'normalMax'], field);
  return instrument;
}

function readInterlock(value, field) {
  const interlock = { delaySeconds: null, expectedAlarm: '', expectedActions: '', ...readRecord(value, field) };
  readTextFields(interlock, ['tag', 'expectedAlarm', 'expectedActions'], field);
  requireField(['L', 'LL', 'H', 'HH'].includes(interlock.level), `${field}.level`);
  requireField(['rising', 'falling'].includes(interlock.direction), `${field}.direction`);
  requireField(['manual', 'automatic'].includes(interlock.resetMode), `${field}.resetMode`);
  readNumericFields(interlock, ['tripValue', 'resetValue', 'delaySeconds', 'testDelta'], field);
  return interlock;
}

function readPoints(value, digital) {
  requireField(Array.isArray(value), 'points');
  const ids = new Set();
  return value.map((entry, index) => {
    const field = `points[${index}]`;
    const point = { observedResult: '', comment: '', testedBy: '', testedAt: '', ...readRecord(entry, field) };
    readTextFields(point, ['id', 'label', 'expectedResult', 'observedResult', 'comment', 'testedBy'], field);
    requireField(point.id.trim() && !ids.has(point.id), `${field}.id`);
    ids.add(point.id);
    requireField(Number.isSafeInteger(point.order) && point.order > 0, `${field}.order`);
    requireField(Number.isFinite(point.processValue), `${field}.processValue`);
    requireField(Number.isFinite(point.signalValue), `${field}.signalValue`);
    requireField(Number.isFinite(point.rawValue) || (digital && point.rawValue === null), `${field}.rawValue`);
    if (point.rawValue === null) {
      requireField([0, 1].includes(point.processValue), `${field}.processValue`);
      requireField([0, 1].includes(point.signalValue), `${field}.signalValue`);
    }
    requireField(statuses.includes(point.status), `${field}.status`);
    requireField(point.testedAt === '' || isDate(point.testedAt), `${field}.testedAt`);
    if (Object.hasOwn(point, 'holdSeconds')) {
      requireField(Number.isFinite(point.holdSeconds) && point.holdSeconds > 0, `${field}.holdSeconds`);
    }
    return point;
  });
}

export function parseProject(jsonText) {
  const data = readRecord(JSON.parse(jsonText), 'project');
  const instrument = readInstrument(data.instrument, 'instrument');
  const interlock = readInterlock(data.interlock, 'interlock');
  const instrumentSnapshot = readInstrument(data.instrumentSnapshot ?? instrument, 'instrumentSnapshot');
  const interlockSnapshot = readInterlock(data.interlockSnapshot ?? interlock, 'interlockSnapshot');
  const points = readPoints(data.points, signalRanges[instrumentSnapshot.signalType].digital);
  const {
    safetyConfirmed = false,
    simulatorValue = instrument.processMin ?? 0,
    locale = 'da',
    createdAt = new Date().toISOString(),
    updatedAt = createdAt
  } = data;
  requireField(typeof safetyConfirmed === 'boolean', 'safetyConfirmed');
  requireField(Number.isFinite(simulatorValue) || simulatorValue === null, 'simulatorValue');
  requireField(locales.includes(locale), 'locale');
  requireField(isDate(createdAt), 'createdAt');
  requireField(isDate(updatedAt), 'updatedAt');
  if (Object.hasOwn(data, 'exportedAt')) requireField(isDate(data.exportedAt), 'exportedAt');

  return {
    ...data,
    instrument, interlock, instrumentSnapshot, interlockSnapshot, points,
    safetyConfirmed, simulatorValue, locale, createdAt, updatedAt
  };
}

export function importProject(jsonText, persist) {
  const project = parseProject(jsonText);
  project.updatedAt = new Date().toISOString();
  persist(project);
  return project;
}
