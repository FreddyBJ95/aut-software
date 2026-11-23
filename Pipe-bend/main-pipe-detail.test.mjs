import assert from 'node:assert/strict';
import {geometry} from './geometry.mjs';
import {mainPipeToSvgPath,pipeDetailStrokeWidths} from './main-pipe-detail.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const state={lengths:[200,300,250],turns:[90,-45],radius:38,measurementMode:'tangent',heading:.31};
const g=geometry(state),before=structuredClone(g);
const radius=state.radius,scale=1.25,angle=.72,c=Math.cos(angle),s=Math.sin(angle);
const mapPoint=p=>[123+scale*(p[0]*c-p[1]*s),567-scale*(p[0]*s+p[1]*c)];
const path=mainPipeToSvgPath(g,{radius,scale,mapPoint,flipY:true});
assert.equal((path.match(/\bM /g)||[]).length,1,'A normal pipe is one connected path');
assert.equal((path.match(/\bL /g)||[]).length,3,'Sample vertices never become visible line tessellation');
assert.equal((path.match(/\bA /g)||[]).length,2,'Each bend has one exact circular command');
const commands=[...path.matchAll(/A ([\d.e+-]+) ([\d.e+-]+) 0 ([01]) ([01]) ([\d.e+-]+) ([\d.e+-]+)/g)];
for(let i=0;i<commands.length;i++){
  near(Number(commands[i][1]),radius*scale);near(Number(commands[i][2]),radius*scale);
  assert.equal(Number(commands[i][3]),0);assert.equal(Number(commands[i][4]),i===0?0:1);
  const end=mapPoint(g.arcs[i].samples.at(-1));near(Number(commands[i][5]),end[0]);near(Number(commands[i][6]),end[1]);
}
assert.deepEqual(g,before,'Rendering does not mutate project geometry');
const ordinary=mainPipeToSvgPath(g,{radius});
assert.match(ordinary,/A 38 38 0 0 1 /);assert.match(ordinary,/A 38 38 0 0 0 /);
const shifted=mainPipeToSvgPath(g,{radius,delta:[20,-50]});assert.match(shifted,/^M 20 -50 /);

// A near-zero tangent remains a valid visible bend connection. Also tolerate
// a point-line in geometry without dropping the entire rendering.
const touching=geometry({lengths:[50,76.0001,50],turns:[90,90],radius:38,measurementMode:'vertex',heading:0});
assert.equal((mainPipeToSvgPath(touching,{radius}).match(/\bA /g)||[]).length,2);
const pointLine=structuredClone(g);pointLine.lines[0].end=pointLine.lines[0].start.slice();
assert.equal((mainPipeToSvgPath(pointLine,{radius}).match(/\bA /g)||[]).length,2);
assert.equal(mainPipeToSvgPath({lines:[],arcs:[]},{radius}), '');
for(const options of [{radius:NaN},{radius:0},{radius,scale:-1},{radius:Number.MAX_VALUE,scale:2},{radius,delta:[0,NaN]},{radius,mapPoint:()=>[Infinity,0]}])assert.equal(mainPipeToSvgPath(g,options),'');
assert.equal(mainPipeToSvgPath({...g,arcs:[{turn:90,samples:[[0,0]]}]},{radius}),'');
assert.equal(mainPipeToSvgPath({...g,arcs:[{turn:0,samples:[[0,0],[1,1]]}]},{radius}),'');

// The physical width grows with zoom, but the outline remains one CSS pixel
// on each side, and the centerline appears only when the real tube is legible.
for(const density of [.5,1,8,64,256]){
  const widths=pipeDetailStrokeWidths({diameter:12,scale:.125,pixelsPerUnit:density});
  near(widths.outerWidth,1.5);near(widths.screenWidth,1.5*density);
  near((widths.outerWidth-widths.innerWidth)*density,Math.min(2,widths.screenWidth));
  assert.equal(widths.showCenterline,widths.screenWidth>=8);
}
near(pipeDetailStrokeWidths({diameter:25,scale:.5,pixelsPerUnit:16}).screenWidth,200);
assert.equal(pipeDetailStrokeWidths({diameter:0,scale:1}),null);
assert.equal(pipeDetailStrokeWidths({diameter:12,scale:Infinity}),null);
assert.equal(pipeDetailStrokeWidths({diameter:12,scale:1,pixelsPerUnit:0}),null);
assert.equal(pipeDetailStrokeWidths({diameter:12,scale:1,insetPixels:-1}),null);
console.log('Ordinary pipe detail: exact rotated/reflected/translated arcs, zero tangent legs, physical OD and screen outline PASS');
