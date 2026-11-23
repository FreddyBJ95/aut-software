// Swagelok hand tube benders. Dimensions and adjustment values are transcribed
// from MS-13-43 Rev G, December 2022, pp.5–6 and23; model/radius mapping is also
// checked against the manufacturer's product specifications. Values are table
// adjustments for the manual's premeasure method, not an ideal arc-length gain.
const INCH_MM = 25.4;
const ANGLES = Object.freeze([30, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]);
const MANUAL_URL = 'https://www.swagelok.com/downloads/webcatalogs/en/ms-13-43.pdf';
const FITTING_STRAIGHT_MEANING = 'Straight tubing required next to a Swagelok tube fitting; not a minimum distance between bends.';

const sourceFor = model => Object.freeze({
  url: MANUAL_URL,
  title: 'Swagelok Hand Tube Bender Manual, MS-13-43',
  revision: 'Rev G, December 2022',
  pages: Object.freeze([5, 6, 21, 22, 23, 28, 29]),
  productUrl: `https://products.swagelok.com/en/c/hand-tube-bender/p/${model}`,
});

function profile(model, units, od, radius, straight, gains, displayOD, displayRadius) {
  const factor = units === 'in' ? INCH_MM : 1;
  const gainsNative = Object.freeze(Object.fromEntries(ANGLES.map((angle, index) => [angle, gains[index]])));
  return Object.freeze({
    id: `swagelok-${model.toLowerCase()}`,
    manufacturer: 'Swagelok',
    model,
    label: `${model} · Ø${displayOD} ${units} · R${displayRadius} ${units}`,
    tubeODmm: od * factor,
    radiusMm: radius * factor,
    nativeUnits: units,
    nativeTubeOD: od,
    nativeRadius: radius,
    nativeMinStraight: straight,
    tubeODLabel: `${displayOD} ${units}`,
    radiusLabel: `${displayRadius} ${units}`,
    gainsNative,
    gainsMm: Object.freeze(Object.fromEntries(ANGLES.map(angle => [angle, gainsNative[angle] * factor]))),
    gainAngles: ANGLES,
    minStraightMm: straight * factor,
    minStraightMeaning: FITTING_STRAIGHT_MEANING,
    maxBendAngle: 180,
    source: sourceFor(model),
  });
}

// Metric table, MS-13-43 p.23. Each row follows ANGLES above.
const metric = [
  profile('MS-HTB-3M',  'mm', 3,  15, 19, [0,1,1,1,2,2,3,3,4,5,6], '3', '15'),
  profile('MS-HTB-6M',  'mm', 6,  15, 21, [1,1,2,2,3,3,4,5,6,7,8], '6', '15'),
  profile('MS-HTB-8M',  'mm', 8,  24, 23, [1,2,2,3,3,4,5,6,8,10,12], '8', '24'),
  profile('MS-HTB-10M', 'mm', 10, 24, 25, [1,2,2,3,4,4,5,7,8,10,12], '10', '24'),
  profile('MS-HTB-12M', 'mm', 12, 38, 31, [1,3,3,4,5,7,8,10,12,15,18], '12', '38'),
];

// Fractional table, MS-13-43 p.23, stored as exact fractions of an inch.
// In particular4T uses R9/16in;4 uses R3/4in. They are different tools.
const sixteenths = numerators => numerators.map(value => value / 16);
const fractional = [
  profile('MS-HTB-2',  'in', 1/8,  9/16, 23/32, sixteenths([0,1,1,1,1,2,2,2,3,4,4]), '1/8', '9/16'),
  profile('MS-HTB-4T', 'in', 1/4,  9/16, 13/16, sixteenths([0,1,1,1,2,2,2,3,3,4,5]), '1/4', '9/16'),
  profile('MS-HTB-4',  'in', 1/4,  3/4,  13/16, sixteenths([0,1,1,1,1,2,2,3,3,4,5]), '1/4', '3/4'),
  profile('MS-HTB-5',  'in', 5/16, 15/16, 7/8,  sixteenths([0,1,1,2,2,3,3,4,5,6,7]), '5/16', '15/16'),
  profile('MS-HTB-6T', 'in', 3/8,  15/16, 15/16,sixteenths([0,1,1,1,2,2,3,4,5,6,7]), '3/8', '15/16'),
  profile('MS-HTB-8',  'in', 1/2,  1+1/2, 1+3/16,sixteenths([1,1,2,2,3,4,5,6,7,9,11]), '1/2', '1 1/2'),
];

export const SWAGELOK_BENDERS = Object.freeze([...metric, ...fractional]);

/** Return a verified profile by stable id or manufacturer model; otherwise null. */
export function getBender(id) {
  if (typeof id !== 'string') return null;
  const key = id.trim().toLowerCase();
  return SWAGELOK_BENDERS.find(bender => bender.id === key || bender.model.toLowerCase() === key) ?? null;
}

/**
 * Return a published adjustment in millimetres for either bend direction.
 * The tiny tolerance only absorbs floating-point angle roundoff; it does not
 * interpolate. Untabulated angles, including22.5° and angles above90°, are null.
 */
export function getBenderGain(benderOrId, angle) {
  if (typeof angle !== 'number' || !Number.isFinite(angle)) return null;
  const bender = getBender(typeof benderOrId === 'string' ? benderOrId : benderOrId?.id);
  if (!bender) return null;
  const key = ANGLES.find(value => Math.abs(value - Math.abs(angle)) <= 1e-7);
  return key === undefined ? null : bender.gainsMm[key];
}
