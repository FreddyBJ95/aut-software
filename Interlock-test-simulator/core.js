export const signalRanges = {
  '4-20mA': { min: 4, max: 20, unit: 'mA', label: '4–20 mA' },
  '0-20mA': { min: 0, max: 20, unit: 'mA', label: '0–20 mA' },
  '0-10V': { min: 0, max: 10, unit: 'V', label: '0–10 V' },
  '2-10V': { min: 2, max: 10, unit: 'V', label: '2–10 V' },
  'digital-no': { min: 0, max: 1, unit: 'kontakt', label: 'Digital NO', digital: true },
  'digital-nc': { min: 0, max: 1, unit: 'kontakt', label: 'Digital NC', digital: true }
};

export function linearScale(value, inputMin, inputMax, outputMin, outputMax) {
  if (![value, inputMin, inputMax, outputMin, outputMax].every(Number.isFinite) || inputMax === inputMin) return NaN;
  return outputMin + ((value - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin);
}

function isDigital(instrument) {
  return Boolean(signalRanges[instrument?.signalType]?.digital);
}

function digitalResult(actuation, instrument) {
  const active = actuation === 1;
  return {
    process: actuation,
    percent: actuation * 100,
    signal: Number(instrument.signalType === 'digital-nc' ? !active : active),
    raw: null
  };
}

export function calculateFromProcess(value, instrument) {
  if (isDigital(instrument)) {
    return value === 0 || value === 1
      ? digitalResult(value, instrument)
      : { process: NaN, percent: NaN, signal: NaN, raw: null };
  }
  const range = signalRanges[instrument.signalType];
  const percent = linearScale(value, instrument.processMin, instrument.processMax, 0, 100);
  return {
    process: value,
    percent,
    signal: linearScale(percent, 0, 100, range?.min, range?.max),
    raw: linearScale(percent, 0, 100, instrument.rawMin, instrument.rawMax)
  };
}

export function calculateFromField(field, value, instrument) {
  if (field === 'process') return calculateFromProcess(value, instrument);
  if (isDigital(instrument)) {
    // A digital input reports a contact position, while the process input is actuation.
    if (field === 'signal' && (value === 0 || value === 1)) {
      const actuation = instrument.signalType === 'digital-nc' ? 1 - value : value;
      return digitalResult(actuation, instrument);
    }
    return { process: NaN, percent: NaN, signal: NaN, raw: null };
  }
  const range = signalRanges[instrument.signalType];
  let percent;
  if (field === 'percent') percent = value;
  if (field === 'signal') percent = linearScale(value, range?.min, range?.max, 0, 100);
  if (field === 'raw') percent = linearScale(value, instrument.rawMin, instrument.rawMax, 0, 100);
  return {
    process: linearScale(percent, 0, 100, instrument.processMin, instrument.processMax),
    percent,
    signal: linearScale(percent, 0, 100, range?.min, range?.max),
    raw: linearScale(percent, 0, 100, instrument.rawMin, instrument.rawMax)
  };
}

function compare(left, right, span = 0) {
  // Tolerate only round-off from inverse scaling, not the UI's display rounding.
  const tolerance = Math.max(Math.abs(left), Math.abs(right), span) * Number.EPSILON * 4;
  return Math.abs(left - right) <= tolerance ? 0 : Math.sign(left - right);
}

function processSpan(instrument) {
  return instrument ? instrument.processMax - instrument.processMin : 0;
}

function tripActuation(interlock) {
  return interlock.direction === 'rising' ? 1 : 0;
}

export function isTripped(value, interlock, instrument) {
  if (isDigital(instrument)) return value === tripActuation(interlock);
  const comparison = compare(value, interlock.tripValue, processSpan(instrument));
  return interlock.direction === 'rising' ? comparison >= 0 : comparison <= 0;
}

function canReset(value, interlock, instrument) {
  if (isDigital(instrument)) return value === 1 - tripActuation(interlock);
  const comparison = compare(value, interlock.resetValue, processSpan(instrument));
  return interlock.direction === 'rising' ? comparison <= 0 : comparison >= 0;
}

export function validateInstrument(instrument) {
  if (!instrument || !Object.hasOwn(signalRanges, instrument.signalType)) return 'Vælg en gyldig signaltype';
  if (isDigital(instrument)) return null;
  const { processMin, processMax, rawMin, rawMax } = instrument;
  if (!Number.isFinite(processMax - processMin) || !(processMin < processMax)
    || ![processMin, processMax].every(Number.isFinite)) {
    return 'Procesmaksimum skal være større end procesminimum';
  }
  if (![rawMin, rawMax].every(Number.isSafeInteger) || rawMax <= rawMin) {
    return 'PLC-råmaksimum skal være større end PLC-råminimum';
  }
  return null;
}

export function validateInterlock(instrument, interlock) {
  if (!interlock || !['rising', 'falling'].includes(interlock.direction)
    || !['automatic', 'manual'].includes(interlock.resetMode ?? 'automatic')) {
    return 'Vælg en gyldig tripretning og resettype';
  }
  const delay = interlock.delaySeconds ?? 0;
  if (!Number.isFinite(delay) || !Number.isFinite(delay * 1000) || delay < 0) return 'Forsinkelsen må ikke være negativ';
  if (isDigital(instrument)) return null;
  const { processMin, processMax } = instrument;
  const { tripValue, resetValue } = interlock;
  const inRange = value => Number.isFinite(value) && value >= processMin && value <= processMax;
  if (!inRange(tripValue) || !inRange(resetValue)) return 'Trip- og resetgrænsen skal ligge inden for måleområdet';
  if (isTripped(resetValue, interlock, instrument)) return 'Resetgrænsen ligger på den forkerte side af tripgrænsen';
  return null;
}

function sequenceValues(instrument, interlock, deltaPercent) {
  const { processMin, processMax } = instrument;
  const normalMin = instrument.normalMin ?? processMin;
  const normalMax = instrument.normalMax ?? processMax;
  const { tripValue, resetValue } = interlock;
  const rising = interlock.direction === 'rising';
  const sign = rising ? 1 : -1;
  const offset = processSpan(instrument) * (deltaPercent / 100);
  const resetApproach = Math.min(offset, Math.abs(tripValue - resetValue) / 2);
  const safeMin = rising ? normalMin : Math.max(normalMin, resetValue);
  const safeMax = rising ? Math.min(normalMax, resetValue) : normalMax;
  return {
    safeMin,
    safeMax,
    normal: safeMin + (safeMax - safeMin) / 2,
    beforeTrip: tripValue - sign * offset,
    afterTrip: tripValue + sign * offset,
    beforeReset: resetValue + sign * resetApproach,
    afterReset: resetValue - sign * offset
  };
}

export function validateProfile(instrument, interlock, deltaPercent = 1) {
  const configError = validateInstrument(instrument) || validateInterlock(instrument, interlock);
  if (configError || isDigital(instrument)) return configError;
  const { processMin, processMax, normalMin, normalMax } = instrument;
  const { tripValue, resetValue } = interlock;
  if (![normalMin, normalMax].every(value => value == null || (
    Number.isFinite(value) && value >= processMin && value <= processMax
  )) || (normalMin ?? processMin) > (normalMax ?? processMax)) {
    return 'Kontrollér det normale procesområde';
  }
  if (!Number.isFinite(deltaPercent) || deltaPercent <= 0) return 'Indtast en afstand større end nul';
  const { safeMin, safeMax, beforeTrip, afterTrip, beforeReset, afterReset } = sequenceValues(instrument, interlock, deltaPercent);
  if (safeMin > safeMax) return 'Det normale procesområde skal indeholde en værdi på resetsiden';
  if ([beforeTrip, afterTrip, beforeReset, afterReset].some(value =>
    !Number.isFinite(value) || compare(value, processMin) < 0 || compare(value, processMax) > 0
  )) return 'Testpunkterne ligger uden for måleområdet. Justér grænserne eller testafstanden';
  const span = processSpan(instrument);
  if (compare(beforeTrip, tripValue, span) === 0 || compare(afterTrip, tripValue, span) === 0
    || compare(beforeReset, resetValue, span) === 0 || compare(afterReset, resetValue, span) === 0
    || isTripped(beforeReset, interlock, instrument)) {
    return 'Testafstanden er for lille til at skelne testpunkterne';
  }
  return null;
}

export function advanceSimulation(previous, process, instrument, interlock, options = {}) {
  const now = options.now ?? Date.now();
  const delayMs = (interlock.delaySeconds ?? 0) * 1000;
  const pendingSince = previous?.phase === 'pending' ? previous.pendingSince : now;
  const elapsed = Math.max(0, now - pendingSince);
  const latched = previous?.phase === 'tripped' || previous?.phase === 'ready-to-reset'
    || (previous?.phase === 'pending' && elapsed >= delayMs);

  // Once the trip is latched, the reset condition and mode govern its release.
  if (latched) {
    if (!canReset(process, interlock, instrument)) return { phase: 'tripped', pendingSince: null, remainingSeconds: 0 };
    if (interlock.resetMode === 'manual' && !options.requestReset) {
      return { phase: 'ready-to-reset', pendingSince: null, remainingSeconds: 0 };
    }
  } else if (isTripped(process, interlock, instrument)) {
    if (elapsed < delayMs) return { phase: 'pending', pendingSince, remainingSeconds: (delayMs - elapsed) / 1000 };
    return { phase: 'tripped', pendingSince: null, remainingSeconds: 0 };
  }
  return { phase: 'normal', pendingSince: null, remainingSeconds: 0 };
}

export function generateSequence(instrument, interlock, deltaPercent = 1) {
  const error = validateProfile(instrument, interlock, deltaPercent);
  if (error) throw new RangeError(error);
  const digital = isDigital(instrument);
  const trip = digital ? tripActuation(interlock) : interlock.tripValue;
  const automatic = interlock.resetMode !== 'manual';
  const delaySeconds = interlock.delaySeconds ?? 0;
  const expectedTrip = `${interlock.level} trip forventet`;
  const expectedReset = automatic ? 'Interlock reset' : 'Reset mulig — afventer manuel reset';
  const values = digital
    ? { normal: 1 - trip, afterReset: 1 - trip }
    : sequenceValues(instrument, interlock, deltaPercent);
  const entries = [
    { value: values.normal, label: 'Normaltilstand', expectedResult: 'Ingen alarm' }
  ];
  if (!digital) entries.push({ value: values.beforeTrip, label: 'Lige før trip', expectedResult: 'Ingen alarm' });
  entries.push({
    value: trip,
    label: digital ? 'Skift til triptilstand' : 'På tripgrænsen',
    expectedResult: delaySeconds ? 'Forsinkelse aktiv — intet trip endnu' : expectedTrip
  });
  if (delaySeconds) {
    entries.push({ value: trip, label: 'Trip efter forsinkelse', expectedResult: expectedTrip, holdSeconds: delaySeconds });
  }
  if (!digital) entries.push(
    { value: values.afterTrip, label: 'Lige efter trip', expectedResult: `${interlock.level} aktiv — handlinger udført` },
    { value: values.beforeReset, label: 'Tilbage mod reset', expectedResult: `${interlock.level} fortsat aktiv` },
    { value: interlock.resetValue, label: 'På resetgrænsen', expectedResult: expectedReset }
  );
  entries.push({
    value: values.afterReset,
    label: digital ? 'Tilbage til normal kontaktposition' : automatic ? 'Efter reset' : 'Forbi resetgrænsen',
    expectedResult: expectedReset
  });
  if (!automatic) entries.push({ value: values.afterReset, label: 'Manuel reset', expectedResult: 'Interlock reset' });

  const timestamp = Date.now();
  return entries.map(({ value, label, expectedResult, holdSeconds }, index) => {
    // Clamp round-off at the nominal span endpoints, after validating every offset.
    const processValue = digital ? value : Math.min(instrument.processMax, Math.max(instrument.processMin, value));
    const calc = calculateFromProcess(processValue, instrument);
    return {
      id: `tp-${timestamp}-${index}`,
      order: index + 1,
      label,
      processValue,
      signalValue: calc.signal,
      rawValue: calc.raw,
      expectedResult,
      ...(holdSeconds === undefined ? {} : { holdSeconds }),
      observedResult: '',
      status: 'not-tested',
      comment: '',
      testedBy: '',
      testedAt: ''
    };
  });
}

export function overallStatus(points) {
  if (points.some(point => point.status === 'failed')) return 'failed';
  if (points.length && points.every(point => point.status === 'passed')) return 'passed';
  return 'not-tested';
}
