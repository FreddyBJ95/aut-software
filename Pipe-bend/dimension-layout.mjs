// Collision-free dimension callouts. All positions and dimensions are SVG units.
const GAP = 6;
const radians = degrees => degrees * Math.PI / 180;

export function rectPolygon(x, y, width, height, angle = 0) {
  const c = Math.cos(radians(angle)), s = Math.sin(radians(angle));
  return [[-width / 2, -height / 2], [width / 2, -height / 2],
    [width / 2, height / 2], [-width / 2, height / 2]]
    .map(([dx, dy]) => [x + dx * c - dy * s, y + dx * s + dy * c]);
}

function boundsOf(polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function shape(polygon) {
  const axes = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dx = q[0] - p[0], dy = q[1] - p[1], length = Math.hypot(dx, dy);
    if (length > 1e-12) axes.push([-dy / length, dx / length]);
  }
  return { polygon, box: boundsOf(polygon), axes };
}

function overlapShapes(a, b, gap) {
  if (a.box.x + a.box.w + gap <= b.box.x || b.box.x + b.box.w + gap <= a.box.x ||
      a.box.y + a.box.h + gap <= b.box.y || b.box.y + b.box.h + gap <= a.box.y) return false;
  for (const [x, y] of [...a.axes, ...b.axes]) {
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const p of a.polygon) { const v = p[0] * x + p[1] * y; amin = Math.min(amin, v); amax = Math.max(amax, v); }
    for (const p of b.polygon) { const v = p[0] * x + p[1] * y; bmin = Math.min(bmin, v); bmax = Math.max(bmax, v); }
    if (amax + gap <= bmin || bmax + gap <= amin) return false;
  }
  return true;
}

/** Convex polygon intersection with optional minimum separation, default 6 units. */
export function polygonsOverlap(a, b, gap = GAP) {
  return overlapShapes(shape(a), shape(b), gap);
}

function readableAngle(a, b) {
  let angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

/**
 * items: {id,index,a:[x,y],b:[x,y],text,width,height,angle?}[]
 * obstacles: convex polygons ([x,y][][]), or {polygon} objects.
 * Returns original items plus {x,y,angle,polygon,box,offset,along}.
 * Returned polygons have >=6 SVG units separation from all obstacles/labels.
 * Bounds are preferred, not clipped: if crowded, labels can expand outside them.
 */
export function placeDimensionLabels(items, obstacles = [], bounds = { x: 0, y: 0, w: 900, h: 540 }, options = {}) {
  const blocked = obstacles.map(o => shape(Array.isArray(o) ? o : o.polygon));
  const results = [];
  const centerX = bounds.x + bounds.w / 2, centerY = bounds.y + bounds.h / 2;
  let farRight = Math.max(bounds.x + bounds.w, ...blocked.map(p => p.box.x + p.box.w));
  const candidates = [28, -28, 48, -48, 72, -72, 100, -100, 136, -136, 180, -180, 232, -232];

  for (const item of items) {
    if (![...item.a, ...item.b, item.width, item.height].every(Number.isFinite) || item.width <= 0 || item.height <= 0) {
      throw new TypeError('Dimension endpoints and positive label dimensions must be finite.');
    }
    const dx = item.b[0] - item.a[0], dy = item.b[1] - item.a[1], length = Math.hypot(dx, dy);
    const ux = length > 1e-12 ? dx / length : 1, uy = length > 1e-12 ? dy / length : 0;
    const nx = -uy, ny = ux, mx = (item.a[0] + item.b[0]) / 2, my = (item.a[1] + item.b[1]) / 2;
    const angle = Number.isFinite(item.angle) ? item.angle : readableAngle(item.a, item.b);
    let best = null;

    function consider(x, y, offset, along) {
      const candidate = shape(rectPolygon(x, y, item.width, item.height, angle));
      if (blocked.some(obstacle => overlapShapes(candidate, obstacle, GAP))) return;
      const b = candidate.box;
      if (options.acceptCandidate && !options.acceptCandidate({...item,x,y,angle,polygon:candidate.polygon,box:b,offset,along},results)) return;
      const outside = Math.max(0, bounds.x - b.x) + Math.max(0, b.x + b.w - bounds.x - bounds.w) +
        Math.max(0, bounds.y - b.y) + Math.max(0, b.y + b.h - bounds.y - bounds.h);
      const score = (outside ? 1e7 + outside * 100 : 0) + Math.abs(offset) + Math.abs(along) * 1.35 +
        Math.hypot(x - centerX, y - centerY) * 0.002;
      if (!best || score < best.score) best = { x, y, angle, polygon: candidate.polygon, box: b, offset, along, score, shape: candidate };
    }

    const shifts = [0, 24, -24, 48, -48, 80, -80, 120, -120];
    for (const offset of candidates) for (const along of shifts) {
      consider(mx + nx * offset + ux * along, my + ny * offset + uy * along, offset, along);
    }

    // An optional second pass for omitted labels fills gaps between the coarse
    // offsets. Its caller supplies already placed labels as fixed obstacles,
    // so better local coverage never moves an otherwise good dimension.
    if (!best && options.localFallback) {
      const fineShifts = [0, 12, -12, 36, -36, 60, -60, 96, -96, 144, -144];
      for (let distance = 16; distance <= 144; distance += 8) {
        for (const offset of [distance, -distance]) for (const along of fineShifts) {
          consider(mx + nx * offset + ux * along, my + ny * offset + uy * along, offset, along);
        }
      }
    }

    // Broaden the search when no in-bounds placement is available. Each candidate
    // is still rejected on any collision; we never choose a colliding fallback.
    if ((!best || best.score >= 1e7) && !options.allowOmissions) {
      for (let ring = 1; ring <= 4; ring++) {
        const distance = 260 + ring * 100;
        for (const offset of [distance, -distance]) for (const along of [0, distance / 2, -distance / 2, distance, -distance]) {
          consider(mx + nx * offset + ux * along, my + ny * offset + uy * along, offset, along);
        }
        if (best && best.score < 1e7) break;
      }
    }

    if (!best && !options.allowOmissions) {
      // A finite set of finite polygons cannot block a point beyond its rightmost
      // bound. This provides deterministic termination for arbitrarily dense input.
      const extentX = (Math.abs(Math.cos(radians(angle))) * item.width + Math.abs(Math.sin(radians(angle))) * item.height) / 2;
      const x = farRight + GAP * 2 + extentX, y = my;
      consider(x, y, (x - mx) * nx + (y - my) * ny, (x - mx) * ux + (y - my) * uy);
    }
    if (!best && options.allowOmissions) continue;
    if (!best) throw new Error('Unable to place a finite dimension label.');
    blocked.push(best.shape);
    farRight = Math.max(farRight, best.box.x + best.box.w);
    const { score, shape: ignored, ...placement } = best;
    const result = { ...item, ...placement };
    results.push(result);
    for (const polygon of options.extraObstacles?.(result) || []) blocked.push(shape(polygon));
  }
  return results;
}
