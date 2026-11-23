import assert from 'node:assert/strict';
import {createWallViewport} from './wall-viewport.mjs';

// A small event host keeps camera and gesture regressions independent of a
// browser renderer. Native SVG hit testing is covered by application review.
class Element {
  constructor(){
    this.events=new Map();this.attrs={};this.captured=new Set();
    this.disabled=false;this.textContent='';
  }
  addEventListener(type,fn,options){
    const listeners=this.events.get(type)||[];
    listeners.push({fn,capture:options===true});this.events.set(type,listeners);
  }
  setAttribute(key,value){this.attrs[key]=value;}
  getBoundingClientRect(){return{left:10,top:20,width:800,height:400};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  emit(type,extra={}){
    const event={type,target:this,detail:1,button:0,
      preventDefault(){this.prevented=true;},
      stopPropagation(){this.stopped=true;},
      stopImmediatePropagation(){this.immediate=true;},...extra};
    const listeners=this.events.get(type)||[];
    for(const {fn}of [...listeners.filter(n=>n.capture),...listeners.filter(n=>!n.capture)]){
      if(event.immediate)break;fn(event);
    }
    return event;
  }
}
const host=new Element(),svg=new Element(),zoomIn=new Element(),zoomOut=new Element(),fit=new Element(),output=new Element();
svg.ownerDocument={defaultView:host};
const viewport=createWallViewport({svg,zoomIn,zoomOut,fit,output});
const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-10,message);
const changes=[];
viewport.setOnChange(state=>{changes.push({...state});state.zoom=-1;});
assert.equal(changes.length,1,'A renderer can attach after camera construction');
assert.equal(viewport.getState().zoom,1,'Notifications expose a copy of camera state');
viewport.update(800,400);
assert.deepEqual(viewport.getState(),{zoom:1,x:400,y:200,width:800,height:400});
assert.equal(output.textContent,'100%');assert(zoomOut.disabled);
assert.equal(changes.at(-1).pixelsPerUnit,1);
assert.deepEqual(changes.at(-1).viewBox,{x:0,y:0,width:800,height:400});

// Wheel zoom must preserve the world point under the cursor.
const anchor=viewport.clientPoint(610,120);
let changeCount=changes.length;
svg.emit('wheel',{clientX:610,clientY:120,deltaY:-200});
assert(changes.length>changeCount,'Wheel zoom notifies the incremental renderer');
const after=viewport.clientPoint(610,120);
near(after.x,anchor.x);near(after.y,anchor.y);
assert(viewport.getState().zoom>1);
let old=viewport.getState();
changeCount=changes.length;
viewport.update(800,400);
assert.deepEqual(viewport.getState(),old,'Numeric redraw must preserve the camera');
assert(changes.length>changeCount,'Geometry updates notify without resetting the camera');

// Taps on selectable pipe pieces must not be retargeted by pointer capture.
svg.emit('pointerdown',{pointerId:1,clientX:210,clientY:120,target:{role:'button'}});
assert.equal(svg.captured.size,0);
svg.emit('pointermove',{pointerId:1,clientX:213,clientY:122});
assert.deepEqual(viewport.getState(),old,'Tap jitter must not pan');
svg.emit('pointerup',{pointerId:1});
assert(!svg.emit('click').prevented,'An ordinary target tap remains selectable');

svg.emit('pointerdown',{pointerId:1,clientX:210,clientY:120,target:{role:'button'}});
changeCount=changes.length;
svg.emit('pointermove',{pointerId:1,clientX:250,clientY:130});
assert(svg.captured.has(1));assert(viewport.getState().x<old.x);
assert(changes.length>changeCount,'Pan notifies without losing the active pointer');
svg.emit('pointerup',{pointerId:1});
assert(svg.emit('click').prevented,'Dragging must not select a pipe piece');
svg.emit('pointerdown',{pointerId:1,clientX:210,clientY:120});
svg.emit('pointerup',{pointerId:1});
assert(!svg.emit('click').prevented,'A fresh tap after dragging must work');

// Uncaptured taps can finish outside the SVG. Their stale IDs must not turn
// the next, differently numbered touch into an accidental two-finger pinch.
for(const end of ['pointerup','pointercancel']){
  fit.emit('click');
  svg.emit('pointerdown',{pointerId:70,clientX:210,clientY:120});
  host.emit(end,{pointerId:70,target:{outside:true}});
  svg.emit('pointerdown',{pointerId:71,clientX:310,clientY:120});
  assert.equal(svg.captured.size,0,`${end} outside must clear the old pointer`);
  svg.emit('pointermove',{pointerId:71,clientX:330,clientY:120});
  assert.equal(viewport.getState().zoom,1,'The remaining pointer must pan, not pinch');
  assert.equal(svg.captured.size,1);
  host.emit('pointerup',{pointerId:71,target:{outside:true}});
  assert.equal(svg.captured.size,0,'Global pointer end releases a captured drag');
}

fit.emit('click');
assert.equal(viewport.getState().zoom,1);assert.equal(viewport.getState().x,400);
svg.emit('pointerdown',{pointerId:1,clientX:210,clientY:220});
svg.emit('pointerdown',{pointerId:2,clientX:410,clientY:220});
const pinchAnchor=viewport.clientPoint(310,220);
svg.emit('pointermove',{pointerId:2,clientX:610,clientY:220});
const pinchAfter=viewport.clientPoint(410,220);
assert.equal(viewport.getState().zoom,2);
near(pinchAfter.x,pinchAnchor.x,'Pinch anchor follows the moving midpoint');
near(pinchAfter.y,pinchAnchor.y);
assert.equal(svg.captured.size,2);
svg.emit('pointerup',{pointerId:1});svg.emit('pointerup',{pointerId:2});
assert(svg.emit('click').prevented);

for(let i=0;i<30;i++)zoomIn.emit('click');
assert.equal(viewport.getState().zoom,256);assert(zoomIn.disabled);
assert.equal(output.textContent,'25600%');
assert.equal(changes.at(-1).pixelsPerUnit,256,'Annotation scale includes actual CSS pixel density');
// Even near the new detail-zoom limit, the wheel anchor is stable.
zoomOut.emit('click');
const detailAnchor=viewport.clientPoint(695,85);
svg.emit('wheel',{clientX:695,clientY:85,deltaY:-200});
const detailAfter=viewport.clientPoint(695,85);
assert.equal(viewport.getState().zoom,256);
near(detailAfter.x,detailAnchor.x);near(detailAfter.y,detailAnchor.y);
svg.emit('keydown',{key:'0'});assert.equal(viewport.getState().zoom,1);
old=viewport.getState();svg.emit('keydown',{key:'ArrowRight'});
assert.equal(viewport.getState().x,old.x+45);
svg.emit('keydown',{key:'+',target:{role:'button'}});
assert.equal(viewport.getState().zoom,1,'Part keyboard actions must not zoom');
assert(!svg.emit('click',{detail:0}).prevented,'Keyboard activation remains available');

// Letterboxed SVGs still need a stable wheel anchor after viewport resize.
viewport.reset();viewport.update(400,800);
assert.equal(viewport.getState().x,200);assert.equal(viewport.getState().y,400);
const letterboxAnchor=viewport.clientPoint(510,120);
svg.emit('wheel',{clientX:510,clientY:120,deltaY:-200});
const letterboxAfter=viewport.clientPoint(510,120);
near(letterboxAfter.x,letterboxAnchor.x);near(letterboxAfter.y,letterboxAnchor.y);
assert(svg.attrs.viewBox.split(' ').every(n=>Number.isFinite(Number(n))));
changeCount=changes.length;
fit.emit('click');assert.equal(output.textContent,'100%');assert(zoomOut.disabled);
assert(changes.length>changeCount,'Fit notifies annotation layout');
assert.equal(changes.at(-1).pixelsPerUnit,.5,'Annotation scale includes SVG letterboxing');
assert.deepEqual(changes.at(-1).viewBox,{x:0,y:0,width:400,height:800});
viewport.setOnChange(null);changeCount=changes.length;
zoomIn.emit('click');assert.equal(changes.length,changeCount,'The callback can be removed');

const deferred=[];
const other=createWallViewport({svg:new Element(),onChange:state=>deferred.push(state.zoom)});
assert.equal(deferred.length,0,'A constructor callback waits until construction completes');
other.update(500,300);assert.deepEqual(deferred,[1]);

// A finger can move slightly while tapping a thin vertical pipe. Keep the
// intended down point, tolerate touch jitter, and consume its synthetic click.
viewport.reset();viewport.update(800,400);
const taps=[];viewport.setOnTap(tap=>{taps.push(tap);return true;});
old=viewport.getState();const intended=viewport.clientPoint(410,220),tapTarget={part:'vertical'};
svg.emit('pointerdown',{pointerId:90,pointerType:'touch',clientX:410,clientY:220,target:tapTarget});
svg.emit('pointermove',{pointerId:90,pointerType:'touch',clientX:418,clientY:226});
assert.deepEqual(viewport.getState(),old,'10px finger jitter stays a tap');
host.emit('pointerup',{pointerId:90,pointerType:'touch',clientX:418,clientY:226});
assert.equal(taps.length,1);assert.equal(taps[0].target,tapTarget);assert.equal(taps[0].pointerType,'touch');
near(taps[0].point.x,intended.x);near(taps[0].point.y,intended.y);
assert(svg.emit('click').prevented,'A geometric tap must select exactly once');
assert(!svg.emit('click',{detail:0}).prevented,'A geometric tap does not block keyboard activation');
svg.emit('pointerdown',{pointerId:91,pointerType:'touch',clientX:410,clientY:220});
svg.emit('pointermove',{pointerId:91,pointerType:'touch',clientX:410,clientY:250});
host.emit('pointerup',{pointerId:91,pointerType:'touch',clientX:410,clientY:250});
assert.equal(taps.length,1,'A real vertical drag never selects');
svg.emit('pointerdown',{pointerId:92,pointerType:'touch',clientX:410,clientY:220});
host.emit('pointercancel',{pointerId:92,pointerType:'touch',clientX:410,clientY:220});
assert.equal(taps.length,1,'Cancelled pointers never select');
svg.emit('pointerdown',{pointerId:93,pointerType:'touch',clientX:11,clientY:220});
host.emit('pointerup',{pointerId:93,pointerType:'touch',clientX:9,clientY:220});
assert.equal(taps.length,1,'Releasing outside the SVG never selects');
svg.emit('pointerdown',{pointerId:94,pointerType:'touch',clientX:310,clientY:220});
svg.emit('pointerdown',{pointerId:95,pointerType:'touch',clientX:510,clientY:220});
svg.emit('pointerup',{pointerId:94});svg.emit('pointerup',{pointerId:95});
assert.equal(taps.length,1,'Two-finger gestures never become a tap');
viewport.setOnTap(()=>false);
svg.emit('pointerdown',{pointerId:96,clientX:410,clientY:220});svg.emit('pointerup',{pointerId:96});
assert(!svg.emit('click').prevented,'Annotation actions may keep their ordinary click');
viewport.setOnTap(null);

// A grouped wall reference focuses its actual geometry in one camera update.
viewport.reset();viewport.update(800,400);
assert.equal(viewport.fitBounds({minX:300,minY:150,maxX:400,maxY:250}),true);
near(viewport.getState().x,350);near(viewport.getState().y,200);near(viewport.getState().zoom,3.2);
assert.equal(viewport.fitBounds({x:350,y:200,width:0,height:0}),true);
assert.equal(viewport.getState().zoom,256);
const fitted=viewport.getState();assert.equal(viewport.fitBounds({x:0,y:0,width:-1,height:1}),false);
assert.deepEqual(viewport.getState(),fitted,'Invalid group bounds preserve the camera');
fit.emit('click');assert.equal(viewport.getState().zoom,1);

// The ordinary and spatial canvases share a toolbar. Hidden cameras neither
// consume those controls nor overwrite the active camera's zoom/button state.
const sharedHost=new Element(),canvasA=new Element(),canvasB=new Element(),sharedIn=new Element(),sharedOut=new Element(),sharedFit=new Element(),sharedOutput=new Element();
canvasA.ownerDocument=canvasB.ownerDocument={defaultView:sharedHost};
let active='A';
const cameraA=createWallViewport({svg:canvasA,zoomIn:sharedIn,zoomOut:sharedOut,fit:sharedFit,output:sharedOutput,enabled:()=>active==='A'});
const cameraB=createWallViewport({svg:canvasB,zoomIn:sharedIn,zoomOut:sharedOut,fit:sharedFit,output:sharedOutput,enabled:()=>active==='B'});
cameraA.update(800,400);cameraB.update(800,400);
sharedIn.emit('click');near(cameraA.getState().zoom,1.35);near(cameraB.getState().zoom,1);assert.equal(sharedOutput.textContent,'135%');assert.equal(sharedOut.disabled,false);
cameraB.reset();cameraB.update(800,400);assert.equal(sharedOutput.textContent,'135%');assert.equal(sharedOut.disabled,false,'A hidden reset cannot disable active zoom-out');
const hiddenBefore=cameraB.getState();
assert(!canvasB.emit('wheel',{clientX:410,clientY:220,deltaY:-400}).prevented,'Hidden wheel events are not consumed');
assert(!canvasB.emit('keydown',{key:'+'}).prevented);canvasB.emit('keydown',{key:'ArrowLeft'});assert.deepEqual(cameraB.getState(),hiddenBefore);
let inactiveTaps=0;cameraB.setOnTap(()=>{inactiveTaps++;return true;});
canvasB.emit('pointerdown',{pointerId:501,clientX:210,clientY:220});canvasB.emit('pointerdown',{pointerId:502,clientX:410,clientY:220});canvasB.emit('pointermove',{pointerId:502,clientX:610,clientY:220});sharedHost.emit('pointerup',{pointerId:501,clientX:210,clientY:220});sharedHost.emit('pointerup',{pointerId:502,clientX:610,clientY:220});
assert.equal(canvasB.captured.size,0);assert.equal(inactiveTaps,0);assert.deepEqual(cameraB.getState(),hiddenBefore);
active='B';cameraB.update(800,400);assert.equal(sharedOutput.textContent,'100%');assert.equal(sharedOut.disabled,true);
const savedA=cameraA.getState();sharedIn.emit('click');near(cameraB.getState().zoom,1.35);assert.deepEqual(cameraA.getState(),savedA,'Only the newly active camera receives shared zoom');
cameraB.fitBounds({x:350,y:200,width:0,height:0});assert.equal(sharedIn.disabled,true);assert.equal(sharedOutput.textContent,'25600%');cameraA.update(800,400);assert.equal(sharedIn.disabled,true);assert.equal(sharedOutput.textContent,'25600%','Hidden redraws cannot overwrite a detailed active camera');
sharedFit.emit('click');near(cameraB.getState().zoom,1);assert.deepEqual(cameraA.getState(),savedA,'Fit does not reset the hidden camera');
// Switching canvases during an active pinch releases old captures and does
// not turn the next single touch into a pinch or a stale selection.
canvasB.emit('pointerdown',{pointerId:503,clientX:210,clientY:220});canvasB.emit('pointerdown',{pointerId:504,clientX:410,clientY:220});assert.equal(canvasB.captured.size,2);
active='A';sharedHost.emit('pointerup',{pointerId:503,clientX:210,clientY:220});assert.equal(canvasB.captured.size,0);assert.equal(inactiveTaps,0);
active='B';canvasB.emit('pointerdown',{pointerId:505,clientX:310,clientY:220});assert.equal(canvasB.captured.size,0);canvasB.emit('pointerup',{pointerId:505,clientX:310,clientY:220});assert.equal(inactiveTaps,1);

// Optional 3D orbit consumes a single-pointer drag while retaining the
// normal capture, cancellation and synthetic-click suppression lifecycle.
const orbitSvg=new Element(),orbitHost=new Element();orbitSvg.ownerDocument={defaultView:orbitHost};
let orbitEnabled=true,orbitTapCount=0;const dragEvents=[];
const orbitCamera=createWallViewport({svg:orbitSvg,onTap:()=>{orbitTapCount++;return true;},onSingleDrag:drag=>{dragEvents.push({deltaX:drag.deltaX,deltaY:drag.deltaY,pointerType:drag.pointerType});return orbitEnabled;}});
orbitCamera.update(800,400);const orbitStart=orbitCamera.getState();
orbitSvg.emit('pointerdown',{pointerId:601,pointerType:'touch',clientX:210,clientY:120});orbitSvg.emit('pointermove',{pointerId:601,pointerType:'touch',clientX:215,clientY:122});assert.equal(dragEvents.length,0,'Tap jitter never orbits');
const orbitMove=orbitSvg.emit('pointermove',{pointerId:601,pointerType:'touch',clientX:250,clientY:140});assert(orbitMove.prevented);assert(orbitSvg.captured.has(601));assert.deepEqual(orbitCamera.getState(),orbitStart,'Consumed orbit does not pan the SVG camera');assert.deepEqual(dragEvents.at(-1),{deltaX:40,deltaY:20,pointerType:'touch'});
orbitSvg.emit('pointermove',{pointerId:601,pointerType:'touch',clientX:260,clientY:145});assert.deepEqual(dragEvents.at(-1),{deltaX:10,deltaY:5,pointerType:'touch'},'Orbit deltas advance after every consumed move');orbitHost.emit('pointerup',{pointerId:601,clientX:260,clientY:145});assert.equal(orbitTapCount,0);assert(orbitSvg.emit('click').prevented);assert.equal(orbitSvg.captured.size,0);
orbitEnabled=false;orbitSvg.emit('pointerdown',{pointerId:602,clientX:210,clientY:120});orbitSvg.emit('pointermove',{pointerId:602,clientX:250,clientY:130});assert(orbitCamera.getState().x<orbitStart.x,'A false callback keeps ordinary pan');orbitHost.emit('pointerup',{pointerId:602,clientX:250,clientY:130});
orbitCamera.reset();orbitEnabled=true;const beforePinchCalls=dragEvents.length;
orbitSvg.emit('pointerdown',{pointerId:603,clientX:210,clientY:220});orbitSvg.emit('pointerdown',{pointerId:604,clientX:410,clientY:220});orbitSvg.emit('pointermove',{pointerId:604,clientX:610,clientY:220});near(orbitCamera.getState().zoom,2);assert.equal(dragEvents.length,beforePinchCalls,'Pinch still zooms without orbit');orbitHost.emit('pointerup',{pointerId:603,clientX:210,clientY:220});const remainingBefore=orbitCamera.getState();orbitSvg.emit('pointermove',{pointerId:604,clientX:630,clientY:220});assert.equal(dragEvents.length,beforePinchCalls,'A remaining pinch finger cannot unexpectedly orbit');assert(orbitCamera.getState().x<remainingBefore.x);orbitHost.emit('pointerup',{pointerId:604,clientX:630,clientY:220});assert.equal(orbitTapCount,0);

console.log('Wall viewport detail zoom, callbacks, pan, pinch, pointer cleanup, redraw, keyboard and fit tests passed.');
