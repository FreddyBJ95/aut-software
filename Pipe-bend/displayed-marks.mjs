// Presentation-only premeasure values. Quantize absolute positions once, then
// subtract integer ticks so the displayed step measurements reach the displayed
// cut position exactly. Manufacturer corrections remain in bendMarkLayout.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const failed=reason=>({ok:false,reason,marks:[],displayedIntervals:[],
  displayedEndPosition:null,displayedEndInterval:null,positionTicks:[],intervalTicks:[]});

export function roundDisplayedMarks(report,{digits=1}={}) {
  if(!Number.isInteger(digits)||digits<0||digits>6)return failed('invalid-display-precision');
  if(report?.supported!==true)return failed('unsupported-layout');
  if(!Array.isArray(report.marks)||report.marks.length>200||!finite(report.endPosition))return failed('invalid-mark-layout');
  const positions=[];
  let previous=0;
  for(const mark of report.marks) {
    if(!mark||!finite(mark.position)||mark.position<=previous)return failed('invalid-mark-layout');
    positions.push(mark.position);previous=mark.position;
  }
  if(report.endPosition<=previous)return failed('invalid-mark-layout');
  positions.push(report.endPosition);

  // Match the app's Intl formatting at decimal ties. toFixed rounds some
  // binary representations differently (for example 1.15 at one decimal).
  // The fixed locale is only an internal decimal-to-integer conversion;
  // callers still format the returned numbers in the selected UI language.
  const formatter=new Intl.NumberFormat('en-US',{useGrouping:false,
    minimumFractionDigits:digits,maximumFractionDigits:digits});
  const factor=10**digits;
  const positionTicks=positions.map(position=>Number(formatter.format(position).replace('.','')));
  if(positionTicks.some(ticks=>!Number.isSafeInteger(ticks)||ticks<0))return failed('display-overflow');
  const intervalTicks=positionTicks.map((ticks,index)=>ticks-(positionTicks[index-1]??0));
  if(intervalTicks.some(ticks=>ticks<0))return failed('invalid-mark-layout');
  const displayedIntervals=intervalTicks.map(ticks=>ticks/factor);
  return {ok:true,digits,factor,precisionLimited:intervalTicks.some(ticks=>ticks===0),
    marks:report.marks.map((mark,index)=>({...mark,
      displayedPosition:positionTicks[index]/factor,displayedInterval:displayedIntervals[index]})),
    displayedIntervals,displayedEndPosition:positionTicks.at(-1)/factor,
    displayedEndInterval:displayedIntervals.at(-1),positionTicks,intervalTicks};
}
