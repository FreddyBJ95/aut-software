const PRESETS = Object.freeze([
  Object.freeze({angle:30,key:'30',stroke:'#6F4BAE',tube:'#9274C5',fill:'#F1EBFA',text:'#513482'}),
  Object.freeze({angle:45,key:'45',stroke:'#1565A8',tube:'#4B8FC2',fill:'#E8F2FB',text:'#0E4D82'}),
  Object.freeze({angle:60,key:'60',stroke:'#806000',tube:'#D0A91E',fill:'#FFF2C7',text:'#604800'}),
  Object.freeze({angle:90,key:'90',stroke:'#185C46',tube:'#43856D',fill:'#E4F2EC',text:'#104634'}),
]);

const SPECIAL = Object.freeze({key:'special',stroke:'#8A2D5C',tube:'#B15B84',fill:'#FBEAF2',text:'#672044',dash:'4 2'});
const EPSILON = 1e-6;

export const STANDARD_BEND_ANGLES = Object.freeze(PRESETS.map(preset=>preset.angle));

/** Presentation metadata only. Bend geometry and stored angles are untouched. */
export function bendVisual(angle){
 if(typeof angle!=='number'||!Number.isFinite(angle))throw new TypeError('Expected a finite bend angle.');
 const value=Math.abs(angle),preset=PRESETS.find(item=>Math.abs(item.angle-value)<=EPSILON);
 return preset?{...preset,value,standard:true}:{...SPECIAL,value,standard:false};
}

/** Compact two-line badge: the reference stays prominent and the angle is never color-only. */
export function bendBadgeLines(id,angle,{format=String,special='SPECIAL'}={}){
 const visual=bendVisual(angle),value=format(visual.value)+'°';
 return [String(id),visual.standard?value:String(special)+' · '+value];
}

export function bendAccessibleLabel(id,angle,{format=String,special='SPECIAL'}={}){
 return bendBadgeLines(id,angle,{format,special}).join(' · ');
}
