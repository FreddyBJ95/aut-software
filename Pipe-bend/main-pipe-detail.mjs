// The ordinary editor stores sampled bends for bounds and annotation layout.
// Its enlarged visible centerline uses the exact circular endpoints instead.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(finite);

/** mapPoint is a uniform similarity. scale is its absolute world-to-SVG scale;
 * flipY reports whether it reflects orientation, independently of rotation.
 * delta translates preview geometry in world units before mapPoint is used.
 */
export function mainPipeToSvgPath(geometry,{radius,mapPoint=p=>p,scale=1,flipY=false,delta=[0,0]}={}) {
  if(!geometry||!Array.isArray(geometry.lines)||!Array.isArray(geometry.arcs)||geometry.arcs.length>geometry.lines.length||!finite(radius)||radius<=0||!finite(scale)||scale<=0||typeof mapPoint!=='function'||!point(delta))return '';
  const scaledRadius=radius*scale;if(!finite(scaledRadius))return '';
  const parts=[];let cursor=null;
  const mapped=p=>{if(!point(p))throw new TypeError('Invalid centerline point');const q=mapPoint([p[0]+delta[0],p[1]+delta[1]]);if(!point(q))throw new TypeError('Invalid mapped centerline point');return q;};
  const move=p=>{if(!cursor||Math.hypot(cursor[0]-p[0],cursor[1]-p[1])>1e-8){const q=mapped(p);parts.push(`M ${q[0]} ${q[1]}`);}cursor=p;};
  try {
    for(let i=0;i<geometry.lines.length;i++) {
      const line=geometry.lines[i];if(!point(line?.start)||!point(line?.end))return '';
      move(line.start);const end=mapped(line.end);parts.push(`L ${end[0]} ${end[1]}`);cursor=line.end;
      const arc=geometry.arcs[i];if(!arc)continue;
      if(!finite(arc.turn)||!arc.turn||Math.abs(arc.turn)>360||!Array.isArray(arc.samples)||arc.samples.length<2||!point(arc.samples[0])||!point(arc.samples.at(-1)))return '';
      move(arc.samples[0]);const finish=mapped(arc.samples.at(-1)),r=scaledRadius,sweep=(arc.turn>0)!==!!flipY?1:0;
      if(Math.abs(arc.turn)===360){
        const middle=arc.samples[Math.floor(arc.samples.length/2)];if(!point(middle))return '';
        const q=mapped(middle);parts.push(`A ${r} ${r} 0 0 ${sweep} ${q[0]} ${q[1]}`);
        parts.push(`A ${r} ${r} 0 0 ${sweep} ${finish[0]} ${finish[1]}`);
      }else parts.push(`A ${r} ${r} 0 ${Math.abs(arc.turn)>180?1:0} ${sweep} ${finish[0]} ${finish[1]}`);
      cursor=arc.samples.at(-1);
    }
    return parts.join(' ');
  }catch{return '';}
}

/** Physical tube width stays in base SVG units. Only the visible outline
 * inset is kept in screen pixels, so enlargement reveals the true diameter.
 * insetPixels is the total reduction in inner stroke width (half per side).
 */
export function pipeDetailStrokeWidths({diameter,scale,pixelsPerUnit=1,insetPixels=2}={}) {
  if(!finite(diameter)||diameter<=0||!finite(scale)||scale<=0||!finite(pixelsPerUnit)||pixelsPerUnit<=0||!finite(insetPixels)||insetPixels<0)return null;
  const outerWidth=diameter*scale,screenWidth=outerWidth*pixelsPerUnit;
  if(!finite(outerWidth)||!finite(screenWidth))return null;
  return {outerWidth,innerWidth:Math.max(0,outerWidth-insetPixels/pixelsPerUnit),screenWidth,showCenterline:screenWidth>=8};
}
