import assert from 'node:assert/strict';
import {roundDisplayedMarks} from './displayed-marks.mjs';
import {bendMarkLayout,convertMeasurementMode} from './measurements.mjs';
import {getBender} from './benders.mjs';

const metric=getBender('swagelok-ms-htb-12m');
const pipe=(count,profile=metric,length=100.049)=>({diameter:profile.tubeODmm,radius:profile.radiusMm,
  measurementMode:'vertex',heading:0,benderId:profile.id,lengths:Array(count).fill(length),
  turns:Array.from({length:count-1},(_,i)=>i%2?-45:45)});
const shown=(number,digits)=>Number(number.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:digits}));
function consistent(report,digits) {
  assert.equal(report.supported,true,report.error);
  const copy=structuredClone(report),display=roundDisplayedMarks(report,{digits});
  assert.equal(display.ok,true);
  assert.equal(display.positionTicks.length,report.marks.length+1);
  assert.equal(display.intervalTicks.reduce((sum,n)=>sum+n,0),display.positionTicks.at(-1),
    'Displayed intervals telescope in integer display units to the displayed cut');
  let total=0;
  display.marks.forEach((mark,index)=>{
    total+=display.intervalTicks[index];
    assert.equal(total,display.positionTicks[index]);
    assert.equal(mark.displayedPosition,shown(report.marks[index].position,digits));
    assert.equal(mark.position,report.marks[index].position,'Raw absolute positions remain unchanged');
    assert.equal(mark.interval,report.marks[index].interval,'Raw intervals remain unchanged');
    assert.equal(mark.gainApplied,report.marks[index].gainApplied,'Tool gain is not deducted a second time');
  });
  assert.equal(total+display.intervalTicks.at(-1),display.positionTicks.at(-1));
  assert.equal(display.displayedEndPosition,shown(report.endPosition,digits));
  assert.deepEqual(report,copy,'Display conversion does not mutate the manufacturer layout');
  return display;
}

// The audit reproduction: independent one-decimal intervals lose 0.9 mm on
// this ordinary valid 19-leg pipe, while the cut is shown as1846.9 mm.
const nineteen=bendMarkLayout(pipe(19));
const oldTicks=nineteen.intervals.reduce((sum,n)=>sum+Math.round(shown(n,1)*10),0);
const displayed=consistent(nineteen,1);
assert.equal(displayed.displayedEndPosition,1846.9);
assert.equal(oldTicks,18460);
assert.equal(displayed.intervalTicks.reduce((sum,n)=>sum+n,0),18469);
assert(displayed.marks.some(mark=>mark.displayedInterval!==shown(mark.interval,1)),
  'The regression must actually redistribute a rounding remainder');

// The same rule applies at the supported project-size limit and in either
// input convention; geometry conversion must not change tool mark positions.
consistent(bendMarkLayout(pipe(200)),1);
assert.deepEqual(roundDisplayedMarks(bendMarkLayout(convertMeasurementMode(pipe(19),'tangent'))),displayed);

const sample={...pipe(6),lengths:[1000,200,200,300,600,1000],turns:[90,-90,-90,90,90]};
const ordinary=consistent(bendMarkLayout(sample),1);
assert.deepEqual(ordinary.marks.map(mark=>mark.displayedPosition),[1000,1182,1364,1646,2228]);
assert.deepEqual(ordinary.displayedIntervals,[1000,182,182,282,582,982]);
assert.equal(ordinary.displayedEndPosition,3210);

// Fractional tools keep their existing three-decimal millimetre display,
// including half-thousandth table adjustments and the final cut interval.
const fractional=getBender('swagelok-ms-htb-4');
for(const count of [1,19,200])consistent(bendMarkLayout(pipe(count,fractional,100.0495)),3);
const fractionReport=bendMarkLayout(pipe(19,fractional,100.0495));
const fractionDisplay=roundDisplayedMarks(fractionReport,{digits:3});
assert.equal(fractionReport.gains[0],1.5875);
assert.equal(fractionDisplay.marks[1].gainApplied,1.5875);

// Presentation numbers are locale-independent; translating the text does not
// change the chosen ticks, and Intl decimal ties match the renderer's policy.
const tie=roundDisplayedMarks({supported:true,marks:[{id:'B1',position:1.15,interval:1.15,gainApplied:0}],endPosition:2.25});
assert.equal(tie.marks[0].displayedPosition,1.2);
assert.equal(tie.displayedEndPosition,2.3);
assert.equal(tie.displayedEndInterval,1.1);
for(const locale of ['da-DK','nb-NO','en-GB']) {
  const formatter=new Intl.NumberFormat(locale,{useGrouping:false,maximumFractionDigits:3});
  const rawAbsolute=fractionReport.marks.map(mark=>formatter.format(mark.position));
  assert.deepEqual(fractionDisplay.marks.map(mark=>formatter.format(mark.displayedPosition)),rawAbsolute);
}

const single=consistent(bendMarkLayout(pipe(1,metric,1000.049)),1);
assert.deepEqual(single.marks,[]);assert.deepEqual(single.displayedIntervals,[1000]);
const tiny=roundDisplayedMarks({supported:true,marks:[],endPosition:.01});
assert.equal(tiny.ok,true);assert.equal(tiny.precisionLimited,true);assert.equal(tiny.displayedEndInterval,0);

for(const report of [null,{}, {supported:false,marks:[],endPosition:null},
  {supported:true,marks:[],endPosition:0},{supported:true,marks:[],endPosition:-1},
  {supported:true,marks:[{position:0}],endPosition:10},
  {supported:true,marks:[{position:10},{position:9}],endPosition:20},
  {supported:true,marks:[{position:10}],endPosition:10},
  {supported:true,marks:[{position:NaN}],endPosition:10},
  {supported:true,marks:[],endPosition:Infinity},
  {supported:true,marks:[],endPosition:1e308}]) {
  const result=roundDisplayedMarks(report);assert.equal(result.ok,false);assert.deepEqual(result.marks,[]);
  assert.equal(result.displayedEndPosition,null,'Invalid layouts never expose a partial cut');
}
for(const digits of [-1,.5,7,NaN,'1'])assert.equal(roundDisplayedMarks(nineteen,{digits}).ok,false);
console.log('Displayed marks: consistent absolute/relative rounding, final cut, 200 legs, metric/fractional and Intl precision PASS');
