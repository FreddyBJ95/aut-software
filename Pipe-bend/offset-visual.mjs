/**
 * Practical mark-to-mark offset sketch. M = H × the user's bender factor.
 * The shape illustrates the selected angle; it is intentionally schematic and
 * does not imply that a rounded practical factor is exact trigonometry.
 */
export function renderOffsetVisualization(svg, values, t = text => text, fmt = n => String(n)) {
  const {offset, angle, length, factor, unit = 'mm', rotation = 0, mirror = false} = values;
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 480 280');
  svg.setAttribute('role', 'img');
  const doc = svg.ownerDocument || document;
  function element(tag, attributes, text, parent = svg) {
    const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    parent.append(node);
    return node;
  }
  function text(x, y, content, attrs = {}, parent = svg) {
    return element('text', {x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'var(--app-font, sans-serif)', 'font-size': 14, fill: '#274b44', ...attrs}, content, parent);
  }
  const valid = [offset, angle, length, factor, rotation].every(Number.isFinite) && offset > 0 &&
    angle > 0 && angle <= 90 && factor > 0 && length > 0 && ['mm', 'cm', 'm'].includes(unit) &&
    Math.abs(length - offset * factor) <= Math.max(1e-8, Math.abs(length) * 1e-8);
  if (!valid) {
    const message = t('Indtast en gyldig forskydning, vinkel og faktor.');
    svg.setAttribute('aria-label', message);
    text(240, 150, message, {'font-size': 14, fill: '#a04532'});
    return false;
  }

  const a = angle * Math.PI / 180;
  const run = angle === 90 ? 0 : offset / Math.tan(a);
  const lead = Math.max(offset, run) * .22;
  const bend0 = [0, 0], bend1 = [run, offset], start = [-lead, 0], end = [run + lead, offset];
  const dimX = end[0] + Math.max(offset, run + 2 * lead) * .12;
  const dimensionStart = [dimX, 0], dimensionEnd = [dimX, offset];
  const r = rotation * Math.PI / 180, cr = Math.cos(r), sr = Math.sin(r);
  const rotate = ([x, y]) => {x *= mirror ? -1 : 1; return [x * cr - y * sr, x * sr + y * cr];};
  const raw = [start, bend0, bend1, end, dimensionStart, dimensionEnd].map(rotate);
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs),
    minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(295 / Math.max(.000001, maxX - minX), 155 / Math.max(.000001, maxY - minY));
  const P = point => {const [x,y] = rotate(point); return [232 + (x - (minX + maxX) / 2) * scale, 140 - (y - (minY + maxY) / 2) * scale];};
  const center = P([run / 2, offset / 2]);
  const leaders = element('g', {}), shapes = element('g', {}), labels = element('g', {});
  function line(p, q, attrs = {}, layer = leaders) {
    return element('line', {x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: '#8ea69b', 'stroke-width': 1.2, ...attrs}, null, layer);
  }
  function polyline(points, attrs, layer = shapes) {
    return element('polyline', {points: points.map(p => p.join(',')).join(' '), fill: 'none', 'stroke-linecap': 'round', ...attrs}, null, layer);
  }
  const occupied = [];
  function label(point, content, attrs = {}) {
    const width = content.length * 7.2 + 12, height = 24;
    let [x, y] = point;
    x = Math.min(464 - width / 2, Math.max(16 + width / 2, x));
    y = Math.min(249, Math.max(28, y));
    let chosen = null;
    for (const dy of [0, 25, -25, 50, -50, 75, -75]) {
      const cy = Math.min(249, Math.max(28, y + dy));
      const box = {x: x - width / 2, y: cy - height / 2, w: width, h: height};
      if (!occupied.some(b => box.x < b.x + b.w + 4 && box.x + box.w + 4 > b.x && box.y < b.y + b.h + 4 && box.y + box.h + 4 > b.y)) {
        chosen = {x, y: cy, box}; break;
      }
    }
    if (!chosen) chosen = {x, y, box: {x: x - width / 2, y: y - height / 2, w: width, h: height}};
    occupied.push(chosen.box);
    element('rect', {x: chosen.box.x, y: chosen.box.y, width, height, rx: 4, fill: '#f7faf9', opacity: .98}, null, labels);
    text(chosen.x, chosen.y, content, attrs, labels);
    return [chosen.x, chosen.y];
  }
  function outwardNormal(p, q) {
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    const midpoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (nx * (midpoint[0] - center[0]) + ny * (midpoint[1] - center[1]) < 0) {nx = -nx; ny = -ny;}
    return {nx, ny, midpoint};
  }
  function ticks(p, q, color = '#8ea69b') {
    const {nx, ny} = outwardNormal(p, q);
    for (const v of [p,q]) line([v[0] - nx * 4, v[1] - ny * 4], [v[0] + nx * 4, v[1] + ny * 4], {stroke: color});
  }

  // Sharp corners are the two practical bender marks. End leads give context.
  polyline([P(start),P(bend0)], {stroke: '#839b90', 'stroke-width': 5, 'stroke-dasharray': '6 6'});
  polyline([P(bend1),P(end)], {stroke: '#839b90', 'stroke-width': 5, 'stroke-dasharray': '6 6'});
  const p0 = P(bend0), p1 = P(bend1);
  line(p0,p1,{stroke:'#16815d','stroke-width':8,'stroke-linecap':'round'},shapes);
  for (const p of [p0,p1]) element('circle',{cx:p[0],cy:p[1],r:4,fill:'#fff2df',stroke:'#bb742b','stroke-width':1.8},null,shapes);

  const h0 = P(dimensionStart), h1 = P(dimensionEnd);
  line(P(start), h0, {'stroke-dasharray': '4 4'});
  line(P(end), h1, {'stroke-dasharray': '4 4'});
  line(h0, h1, {stroke: '#c67b32', 'stroke-width': 1.5}); ticks(h0, h1, '#c67b32');
  const hn = outwardNormal(h0, h1);
  label([hn.midpoint[0] + hn.nx * 27, hn.midpoint[1] + hn.ny * 27], 'H = ' + fmt(offset) + ' ' + unit, {fill: '#a85c19', 'font-weight': 700});

  const mn = outwardNormal(p0,p1),mp=[p0[0]+mn.nx*18,p0[1]+mn.ny*18],mq=[p1[0]+mn.nx*18,p1[1]+mn.ny*18];
  line(p0,mp);line(p1,mq);line(mp,mq);ticks(mp,mq);
  label([mn.midpoint[0]+mn.nx*39,mn.midpoint[1]+mn.ny*39], 'M = '+fmt(length)+' '+unit, {fill:'#16815d','font-weight':700});

  // The guide arcs indicate changes of direction, not physical tube curves.
  const guide = 22 / scale;
  for (const [index,corner] of [bend0,bend1].entries()) {
    const samples=[];
    for(let j=0;j<=20;j++) {const v=a*j/20;samples.push(P([corner[0]+guide*Math.cos(v),corner[1]+guide*Math.sin(v)]));}
    polyline(samples,{stroke:'#8ba396','stroke-width':1.2},leaders);
    line(P(corner),P([corner[0]+guide*1.35,corner[1]]),{'stroke-dasharray':'2 3'});
    if(index===1)line(P(corner),P([corner[0]+guide*1.35*Math.cos(a),corner[1]+guide*1.35*Math.sin(a)]),{'stroke-dasharray':'2 3'});
    const labelPoint=P([corner[0]+guide*1.7*Math.cos(a/2),corner[1]+guide*1.7*Math.sin(a/2)]);
    label(labelPoint,fmt(angle)+'°',{fill:'#426b58'});
  }
  text(240, 270, 'M = H × '+fmt(factor), {'font-size':13,'font-weight':600,fill:'#617d70'});
  svg.setAttribute('aria-label', t('Forskydning {offset} {unit}, to buk på {angle}°, faktor {factor} og mærkeafstand M {length} {unit}.',
    {offset:fmt(offset),unit,angle:fmt(angle),factor:fmt(factor),length:fmt(length)}));
  return true;
}
