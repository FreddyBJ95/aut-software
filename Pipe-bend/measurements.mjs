import {getBender, getBenderGain} from './benders.mjs';

const EPSILON = 1e-8;
const MODES = new Set(['tangent', 'vertex']);

function invalid(code, message, details = {}) {
  const error = new RangeError(message);
  Object.assign(error, {code, ...details});
  return error;
}

/** Older projects omit the mode and continue to use tangent-to-tangent lengths. */
export function measurementMode(state) {
  const mode = state?.measurementMode ?? 'tangent';
  if (!MODES.has(mode)) throw invalid('measurement-mode', 'Vælg en gyldig målemetode.');
  return mode;
}

/**
 * Resolve entered leg dimensions into geometric straight sections and theoretical
 * centerline-vertex dimensions. Throws a RangeError with code/index details when
 * the input cannot describe a finite pipe with positive straight sections.
 */
export function resolveMeasurements(state) {
  if (!state || !Array.isArray(state.lengths) || !Array.isArray(state.turns)) {
    throw invalid('measurement-arrays', 'Længder og bukkevinkler skal være lister.');
  }
  const mode = measurementMode(state), lengths = state.lengths.slice(), turns = state.turns;
  if (turns.length !== Math.max(0, lengths.length - 1)) {
    throw invalid('measurement-count', 'Der skal være ét buk mellem hvert par af stykker.');
  }
  if (state.heading !== undefined && !Number.isFinite(state.heading)) {
    throw invalid('measurement-heading', 'Rørets startretning skal være et endeligt tal.');
  }
  for (let index = 0; index < lengths.length; index++) {
    if (!Number.isFinite(lengths[index]) || lengths[index] <= 0) {
      throw invalid('measurement-length', `Stykke ${index + 1} skal have en positiv, endelig længde.`, {index});
    }
  }
  if (turns.length && (!Number.isFinite(state.radius) || state.radius <= 0)) {
    throw invalid('measurement-radius', 'Bukkeradius skal være et positivt, endeligt tal.');
  }
  const setbacks = turns.map((turn, index) => {
    if (!Number.isFinite(turn) || Math.abs(turn) <= 0 || Math.abs(turn) >= 180) {
      throw invalid('measurement-angle', `Buk ${index + 1} skal være større end 0° og mindre end 180°.`, {index});
    }
    const setback = state.radius * Math.tan(Math.abs(turn) * Math.PI / 360);
    if (!Number.isFinite(setback)) throw invalid('measurement-setback', 'Bukkeradius og vinkel giver et for stort fradrag.', {index});
    return setback;
  });
  const tangent = [], vertex = [];
  for (let index = 0; index < lengths.length; index++) {
    const previous = setbacks[index - 1] ?? 0, next = setbacks[index] ?? 0;
    const totalSetback = previous + next;
    const straight = mode === 'vertex' ? lengths[index] - totalSetback : lengths[index];
    const corner = mode === 'vertex' ? lengths[index] : lengths[index] + totalSetback;
    if (!Number.isFinite(totalSetback) || !Number.isFinite(straight) || !Number.isFinite(corner)) {
      throw invalid('measurement-overflow', `Stykke ${index + 1} giver en for stor længde.`, {index});
    }
    if (straight <= EPSILON) {
      throw invalid('measurement-short-leg',
        `Stykke ${index + 1} er for kort til bukkene. Målet skal være større end ${Number(totalSetback.toFixed(3))} mm.`,
        {index, minimumLength: totalSetback});
    }
    tangent.push(straight);
    vertex.push(corner);
  }
  return {mode, tangentLengths: tangent, vertexLengths: vertex, setbacks};
}

export function tangentLengths(state) {
  return resolveMeasurements(state).tangentLengths;
}

export function vertexLengths(state) {
  return resolveMeasurements(state).vertexLengths;
}

/** Returns null for valid measurements, otherwise the user-facing error text. */
export function validateMeasurements(state) {
  try { resolveMeasurements(state); return null; }
  catch (error) { return error.message; }
}

/** Change the input convention without changing the physical pipe geometry. */
export function convertMeasurementMode(state, nextMode) {
  if (!MODES.has(nextMode)) throw invalid('measurement-mode', 'Vælg en gyldig målemetode.');
  const resolved = resolveMeasurements(state), next = structuredClone(state);
  next.measurementMode = nextMode;
  next.lengths = (nextMode === 'vertex' ? resolved.vertexLengths : resolved.tangentLengths).slice();
  return next;
}

/**
 * Manufacturer premeasure layout. A mark is the tool's bend reference, not a
 * geometric tangent point. End/cut positions use the tool's adjustment table;
 * they may differ from geometry().used, which is ideal centerline arc length.
 * Unsupported input returns no partial sequence and null end/cut positions.
 */
export function bendMarkLayout(state, bender) {
  const selected = bender ?? state?.benderId ?? state?.profileId;
  const profile = typeof selected === 'string' ? getBender(selected) : selected;
  let vertices = [];
  const fail = (reason, error, details = {}) => ({
    supported: false, reason, error, marks: [], intervals: [], gains: [],
    endPosition: null, totalLength: null, cutLength: null,
    vertexLengths: vertices.slice(), source: profile?.source ?? null,
    benderId: profile?.id ?? null, method: 'premeasure', ...details,
  });
  try { vertices = vertexLengths(state); }
  catch (error) { return fail(error.code ?? 'invalid-measurements', error.message, {index: error.index}); }
  if (!vertices.length) return fail('empty-pipe', 'Tilføj et rør, før afsætningsmærker beregnes.');
  if (!profile) return fail('missing-bender', 'Vælg en bukker med dokumenterede afsætningsdata.');
  if (!Number.isFinite(state.diameter) || !Number.isFinite(state.radius) ||
      !Number.isFinite(profile.tubeODmm) || !Number.isFinite(profile.radiusMm) ||
      Math.abs(state.diameter - profile.tubeODmm) > 1e-6 || Math.abs(state.radius - profile.radiusMm) > 1e-6) {
    return fail('profile-mismatch', 'Rørets diameter og bukkeradius skal passe til den valgte bukker.');
  }
  const gains = [];
  for (let index = 0; index < state.turns.length; index++) {
    const angle = state.turns[index], gain = getBenderGain(profile, angle);
    if (!Number.isFinite(gain) || gain < 0) {
      return fail('unsupported-angle', `Buk ${index + 1}: Der findes ingen tabelværdi for ${Math.abs(angle)}° på denne bukker.`,
        {index, unsupportedAngle: Math.abs(angle)});
    }
    gains.push(gain);
  }
  const intervals = vertices.map((length, index) => length - (gains[index - 1] ?? 0));
  for (let index = 0; index < intervals.length; index++) {
    if (!Number.isFinite(intervals[index]) || intervals[index] <= EPSILON) {
      return fail('invalid-mark-spacing', `Afsætningsmærkerne ved stykke ${index + 1} kan ikke placeres i rækkefølge.`, {index});
    }
  }
  let position = 0;
  const marks = state.turns.map((angle, index) => {
    position += intervals[index];
    return {index, id: `B${index + 1}`, position, angle,
      gainApplied: gains[index - 1] ?? 0, gainForBend: gains[index], gain: gains[index], interval: intervals[index]};
  });
  const endPosition = position + intervals.at(-1);
  if (!Number.isFinite(endPosition)) return fail('mark-overflow', 'Afsætningsmålene giver en for stor længde.');
  return {
    supported: true, reason: null, error: null, marks, intervals, gains,
    endPosition, totalLength: endPosition, cutLength: endPosition,
    vertexLengths: vertices.slice(), source: profile.source ?? null,
    benderId: profile.id ?? null, method: 'premeasure',
  };
}
