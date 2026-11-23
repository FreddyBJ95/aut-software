const PRESETS = Object.freeze([
  Object.freeze({angle:30,key:'30',stroke:'#6F4BAE',tube:'#9274C5',fill:'#F1EBFA',text:'#513482'}),
  Object.freeze({angle:45,key:'45',stroke:'#1565A8',tube:'#4B8FC2',fill:'#E8F2FB',text:'#0E4D82'}),
  Object.freeze({angle:60,key:'60',stroke:'#806000',tube:'#D0A91E',fill:'#FFF2C7',text:'#604800'}),
  Object.freeze({angle:90,key:'90',stroke:'#185C46',tube:'#43856D',fill:'#E4F2EC',text:'#104634'}),
]);

const SPECIAL = Object.freeze({key:'special',stroke:'#8A2D5C',tube:'#B15B84',fill:'#FBEAF2',text:'#672044',dash:'4 2'});
const EPSILON = 1e-6;
const point2=value=>Array.isArray(value)&&value.length===2&&value.every(item=>typeof item==='number'&&Number.isFinite(item));

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

/** Place a compact, unboxed B-tag outside the visible bend stroke.
 * The returned box includes the white text halo. If the preferred radial side
 * leaves the viewport, the opposite side is tried; an unsafe tag is omitted
 * rather than drawn on top of the bend. Geometry and the clickable arc anchor
 * stay unchanged. */
export function bendInlineLabelPlacement(anchor,outward,{text='B1',fontSize=10,pipeWidth=14,paintStroke=3,gap=4,width=Infinity,height=Infinity,padding=4}={}){
 if(!point2(anchor)||!point2(outward))throw new TypeError('Expected finite 2D anchor and outward direction.');
 for(const [name,value]of Object.entries({fontSize,pipeWidth,paintStroke,gap,padding}))if(typeof value!=='number'||!Number.isFinite(value)||value<0||(name==='fontSize'&&value===0))throw new TypeError(`Expected a valid ${name}.`);
 for(const [name,value]of Object.entries({width,height}))if(value!==Infinity&&(typeof value!=='number'||!Number.isFinite(value)||value<=0))throw new TypeError(`Expected a valid ${name}.`);
 const label=String(text),length=Math.hypot(...outward),preferred=length>EPSILON?[outward[0]/length,outward[1]/length]:[0,-1];
 // This deliberately overestimates short tags such as B1. The extra room is
 // useful at overview zoom, where a few white halo pixels can hide the arc.
 const glyphWidth=Math.max(fontSize*2.2,label.length*fontSize*.62),boxWidth=glyphWidth+paintStroke+4,boxHeight=fontSize+paintStroke+4;
 const candidate=(direction,flipped)=>{
  const radialExtent=Math.abs(direction[0])*boxWidth/2+Math.abs(direction[1])*boxHeight/2,distance=pipeWidth/2+gap+radialExtent,x=anchor[0]+direction[0]*distance,y=anchor[1]+direction[1]*distance;
  const box={x:x-boxWidth/2,y:y-boxHeight/2,width:boxWidth,height:boxHeight},fits=box.x>=padding&&box.y>=padding&&box.x+box.width<=width-padding&&box.y+box.height<=height-padding;
  const leaderStartDistance=pipeWidth/2+.75,leaderEndDistance=distance-radialExtent-.75;
  return{x,y,box,distance,radialExtent,outward:direction,leader:[[anchor[0]+direction[0]*leaderStartDistance,anchor[1]+direction[1]*leaderStartDistance],[anchor[0]+direction[0]*leaderEndDistance,anchor[1]+direction[1]*leaderEndDistance]],fits,flipped};
 };
 const first=candidate(preferred,false),second=candidate([-preferred[0],-preferred[1]],true),bounded=width!==Infinity||height!==Infinity,chosen=!bounded||first.fits?first:second.fits?second:first;
 return{...chosen,text:label,fontSize,pipeWidth,paintStroke,gap,visible:!bounded||chosen.fits};
}
