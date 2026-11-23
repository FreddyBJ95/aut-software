export const signalRanges = {
  '4-20mA': { min: 4, max: 20, unit: 'mA', label: '4–20 mA' },
  '0-20mA': { min: 0, max: 20, unit: 'mA', label: '0–20 mA' },
  '0-10V': { min: 0, max: 10, unit: 'V', label: '0–10 V' },
  '2-10V': { min: 2, max: 10, unit: 'V', label: '2–10 V' },
  'digital-no': { min: 0, max: 1, unit: 'kontakt', label: 'Digital NO', digital: true },
  'digital-nc': { min: 0, max: 1, unit: 'kontakt', label: 'Digital NC', digital: true }
};

export function linearScale(value, inputMin, inputMax, outputMin, outputMax) {
  if (![value,inputMin,inputMax,outputMin,outputMax].every(Number.isFinite) || inputMax === inputMin) return NaN;
  return outputMin + (value - inputMin) * (outputMax - outputMin) / (inputMax - inputMin);
}

export function calculateFromProcess(value, instrument) {
  const range = signalRanges[instrument.signalType] || signalRanges['4-20mA'];
  const percent = linearScale(value, instrument.processMin, instrument.processMax, 0, 100);
  return {
    process: value,
    percent,
    signal: range.digital ? (percent >= 50 ? 1 : 0) : linearScale(percent, 0, 100, range.min, range.max),
    raw: linearScale(percent, 0, 100, instrument.rawMin, instrument.rawMax)
  };
}

export function calculateFromField(field, value, instrument) {
  const range = signalRanges[instrument.signalType] || signalRanges['4-20mA'];
  let percent;
  if (field === 'process') percent = linearScale(value, instrument.processMin, instrument.processMax, 0, 100);
  if (field === 'percent') percent = value;
  if (field === 'signal') percent = linearScale(value, range.min, range.max, 0, 100);
  if (field === 'raw') percent = linearScale(value, instrument.rawMin, instrument.rawMax, 0, 100);
  return {
    process: linearScale(percent, 0, 100, instrument.processMin, instrument.processMax),
    percent,
    signal: range.digital ? (percent >= 50 ? 1 : 0) : linearScale(percent, 0, 100, range.min, range.max),
    raw: linearScale(percent, 0, 100, instrument.rawMin, instrument.rawMax)
  };
}

export function isTripped(value, interlock) {
  return interlock.direction === 'rising' ? value >= interlock.tripValue : value <= interlock.tripValue;
}

export function generateSequence(instrument, interlock, deltaPercent = 1) {
  const span = instrument.processMax - instrument.processMin;
  const d = Math.abs(span * deltaPercent / 100);
  const rising = interlock.direction === 'rising';
  const normal = Number.isFinite(instrument.normalMin) && Number.isFinite(instrument.normalMax)
    ? (instrument.normalMin + instrument.normalMax) / 2
    : (instrument.processMin + instrument.processMax) / 2;
  const values = rising
    ? [normal, interlock.tripValue-d, interlock.tripValue, interlock.tripValue+d, interlock.resetValue+d, interlock.resetValue, interlock.resetValue-d]
    : [normal, interlock.tripValue+d, interlock.tripValue, interlock.tripValue-d, interlock.resetValue-d, interlock.resetValue, interlock.resetValue+d];
  const labels = ['Normaltilstand','Lige før trip','På tripgrænsen','Lige efter trip','Tilbage mod reset','På resetgrænsen','Efter reset'];
  const states = ['Ingen alarm','Ingen alarm',`${interlock.level} trip forventet`,`${interlock.level} aktiv — handlinger udført`,`${interlock.level} fortsat aktiv`,'Resetbetingelse nået','Interlock reset'];
  return values.map((processValue, index) => {
    const calc = calculateFromProcess(processValue, instrument);
    return {
      id: `tp-${Date.now()}-${index}`,
      order: index + 1,
      label: labels[index],
      processValue,
      signalValue: calc.signal,
      rawValue: calc.raw,
      expectedResult: states[index],
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
