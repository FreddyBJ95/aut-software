// Independent camera for the wall workspace. Geometry and hit targets remain
// in the drawing's base coordinates; only the SVG viewBox changes.
export function createWallViewport({svg,zoomIn,zoomOut,fit,output,onChange,onTap,onSingleDrag,enabled=()=>true}) {
  const camera={zoom:1,x:450,y:270,width:900,height:540};
  const pointers=new Map();
  let gesture=null,dragging=false,suppressClick=false,suppressUntil=0;
  let changeHandler=typeof onChange==='function'?onChange:null,notifying=false;
  let tapHandler=typeof onTap==='function'?onTap:null;
  const clamp=value=>Math.min(256,Math.max(1,value));
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const isEnabled=typeof enabled==='function'?()=>enabled()!==false:()=>true;
  function notify(){
    if(!changeHandler||notifying)return;
    const width=camera.width/camera.zoom,height=camera.height/camera.zoom;
    const state={...camera,pixelsPerUnit:screen().scale,viewBox:{x:camera.x-width/2,y:camera.y-height/2,width,height}};
    notifying=true;try{changeHandler(state);}finally{notifying=false;}
  }
  function apply(notifyChange=true){
    const width=camera.width/camera.zoom,height=camera.height/camera.zoom;
    svg.setAttribute('viewBox',`${camera.x-width/2} ${camera.y-height/2} ${width} ${height}`);
    // Multiple drawings may share one toolbar. Only the active camera owns
    // its output and button states; hidden cameras may still redraw/reset.
    if(isEnabled()){
      if(output)output.textContent=Math.round(camera.zoom*100)+'%';
      if(zoomIn)zoomIn.disabled=camera.zoom>=256;
      if(zoomOut)zoomOut.disabled=camera.zoom<=1;
    }
    if(notifyChange)notify();
  }
  // Account for the SVG's default xMidYMid meet letterboxing as well as CSS
  // sizes, so wheel and pinch anchors stay under the user's fingers.
  function screen(){
    const rect=svg.getBoundingClientRect?.();
    const width=Number(rect?.width)||camera.width,height=Number(rect?.height)||camera.height;
    const left=Number(rect?.left)||0,top=Number(rect?.top)||0;
    const scale=Math.min(width/camera.width,height/camera.height)*camera.zoom;
    return{centerX:left+width/2,centerY:top+height/2,scale};
  }
  function point(clientX,clientY){
    const frame=screen();
    return{x:camera.x+(clientX-frame.centerX)/frame.scale,y:camera.y+(clientY-frame.centerY)/frame.scale};
  }
  function zoomTo(value,anchor){
    if(!finite(value))return;
    const old=camera.zoom;camera.zoom=clamp(value);
    if(anchor){const ratio=old/camera.zoom;camera.x=anchor.x+(camera.x-anchor.x)*ratio;camera.y=anchor.y+(camera.y-anchor.y)*ratio;}
    if(camera.zoom===1){camera.x=camera.width/2;camera.y=camera.height/2;}
    apply();
  }
  function reset(){camera.zoom=1;camera.x=camera.width/2;camera.y=camera.height/2;apply();}
  function capture(id){try{svg.setPointerCapture?.(id);}catch{}}
  function release(id){try{if(!svg.hasPointerCapture||svg.hasPointerCapture(id))svg.releasePointerCapture?.(id);}catch{}}
  function cancelGesture(){const ids=[...pointers.keys()];pointers.clear();gesture=null;dragging=false;suppressClick=false;suppressUntil=0;for(const id of ids)release(id);}
  function markDragged(){dragging=true;suppressClick=true;suppressUntil=Date.now()+650;}
  function startPinch(){
    const[a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    gesture={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:camera.zoom,anchor:point(mid.x,mid.y)};
    markDragged();for(const id of pointers.keys())capture(id);
  }
  zoomIn?.addEventListener('click',()=>{if(isEnabled())zoomTo(camera.zoom*1.35);});
  zoomOut?.addEventListener('click',()=>{if(isEnabled())zoomTo(camera.zoom/1.35);});
  fit?.addEventListener('click',()=>{if(isEnabled())reset();});
  svg.addEventListener('wheel',event=>{
    if(!isEnabled())return;
    if(!finite(event.clientX)||!finite(event.clientY)||!finite(event.deltaY))return;
    event.preventDefault();zoomTo(camera.zoom*Math.exp(-event.deltaY*.002),point(event.clientX,event.clientY));
  },{passive:false});
  svg.addEventListener('pointerdown',event=>{
    if(!isEnabled()){cancelGesture();return;}
    if((event.button!==undefined&&event.button!==0)||!finite(event.clientX)||!finite(event.clientY))return;
    if(!pointers.size){dragging=false;gesture=null;suppressClick=false;}
    const pointerType=event.pointerType||'mouse',slop=pointerType==='touch'?12:pointerType==='pen'?8:5;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,pointerType,slop,target:event.target,multi:false});
    // Delay capture for a single pointer: capturing on a pipe hit target would
    // otherwise retarget an ordinary tap away from that target's click action.
    if(pointers.size>=2){for(const entry of pointers.values())entry.multi=true;if(pointers.size===2)startPinch();}
  });
  svg.addEventListener('pointermove',event=>{
    if(!isEnabled()){cancelGesture();return;}
    const entry=pointers.get(event.pointerId);if(!entry||!finite(event.clientX)||!finite(event.clientY))return;
    entry.x=event.clientX;entry.y=event.clientY;
    if(pointers.size===2&&gesture){
      const[a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      camera.zoom=clamp(gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance);
      const frame=screen();camera.x=gesture.anchor.x-(mid.x-frame.centerX)/frame.scale;camera.y=gesture.anchor.y-(mid.y-frame.centerY)/frame.scale;
      if(camera.zoom===1){camera.x=camera.width/2;camera.y=camera.height/2;}
      markDragged();event.preventDefault();apply();
    }else if(pointers.size===1){
      if(!dragging&&Math.hypot(entry.x-entry.startX,entry.y-entry.startY)<=entry.slop)return;
      capture(event.pointerId);
      const deltaX=entry.x-entry.lastX,deltaY=entry.y-entry.lastY;
      // A renderer may use a fresh one-pointer drag to orbit its 3D model.
      // A remaining finger after a pinch continues panning, never orbiting.
      const consumed=!entry.multi&&typeof onSingleDrag==='function'&&onSingleDrag({deltaX,deltaY,clientX:entry.x,clientY:entry.y,pointerType:entry.pointerType,event})===true;
      if(!consumed){const frame=screen();camera.x-=deltaX/frame.scale;camera.y-=deltaY/frame.scale;}
      entry.lastX=entry.x;entry.lastY=entry.y;markDragged();event.preventDefault();apply();
    }
  });
  function endPointer(event){
    if(!isEnabled()){cancelGesture();return;}
    const entry=pointers.get(event.pointerId);if(!entry)return;
    const clientX=finite(event.clientX)?event.clientX:entry.x,clientY=finite(event.clientY)?event.clientY:entry.y;
    const moved=Math.hypot(clientX-entry.startX,clientY-entry.startY)>entry.slop;
    const tap=event.type==='pointerup'&&pointers.size===1&&!entry.multi&&!dragging&&!moved;
    pointers.delete(event.pointerId);release(event.pointerId);gesture=null;
    if(dragging||moved){suppressClick=true;suppressUntil=Date.now()+650;}
    if(pointers.size===1){const entry=pointers.values().next().value;entry.startX=entry.lastX=entry.x;entry.startY=entry.lastY=entry.y;}
    if(tap&&tapHandler){
      const bounds=svg.getBoundingClientRect?.();
      const inside=!bounds||(clientX>=bounds.left&&clientX<=bounds.left+bounds.width&&clientY>=bounds.top&&clientY<=bounds.top+bounds.height);
      if(inside&&tapHandler({point:point(entry.startX,entry.startY),clientX:entry.startX,clientY:entry.startY,pointerType:entry.pointerType,target:entry.target,event})===true){
        suppressClick=true;suppressUntil=Date.now()+650;event.preventDefault?.();
      }
    }
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(name,endPointer);
  // A tap is deliberately not captured, so its release can happen outside
  // the SVG. Clear that pointer globally before a later touch starts.
  const pointerHost=svg.ownerDocument?.defaultView??globalThis;
  for(const name of ['pointerup','pointercancel'])pointerHost.addEventListener?.(name,endPointer,true);
  svg.addEventListener('click',event=>{
    if(!isEnabled()){cancelGesture();return;}
    // Keyboard activation has no pointer click count and must remain usable.
    if(suppressClick&&Date.now()<=suppressUntil&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();suppressClick=false;}
  },true);
  svg.addEventListener('keydown',event=>{
    if(!isEnabled()||event.target!==svg)return;
    const step=45/camera.zoom;
    if(event.key==='+'||event.key==='=')zoomTo(camera.zoom*1.35);
    else if(event.key==='-'||event.key==='−')zoomTo(camera.zoom/1.35);
    else if(event.key==='0')reset();
    else if(event.key==='ArrowLeft')camera.x-=step;
    else if(event.key==='ArrowRight')camera.x+=step;
    else if(event.key==='ArrowUp')camera.y-=step;
    else if(event.key==='ArrowDown')camera.y+=step;
    else return;
    event.preventDefault();apply();
  });
  function update(width,height){
    if(finite(width)&&width>0&&finite(height)&&height>0){camera.x*=width/camera.width;camera.y*=height/camera.height;camera.width=width;camera.height=height;}
    apply();
  }
  function setOnChange(handler){changeHandler=typeof handler==='function'?handler:null;notify();}
  function setOnTap(handler){tapHandler=typeof handler==='function'?handler:null;}
  function fitBounds(bounds,paddingPixels=40){
    if(!bounds||!finite(paddingPixels)||paddingPixels<0)return false;
    const x=bounds.x??bounds.minX,y=bounds.y??bounds.minY;
    const width=bounds.width??bounds.maxX-x,height=bounds.height??bounds.maxY-y;
    if(![x,y,width,height].every(finite)||width<0||height<0)return false;
    const baseDensity=screen().scale/camera.zoom;
    const padding=Math.min(paddingPixels/baseDensity,camera.width/4,camera.height/4);
    camera.zoom=clamp(Math.min((camera.width-2*padding)/Math.max(width,1/baseDensity),(camera.height-2*padding)/Math.max(height,1/baseDensity)));
    camera.x=x+width/2;camera.y=y+height/2;apply();return true;
  }
  // Renderers may reference the returned camera in their callback. Avoid a
  // constructor callback before that reference can be assigned.
  apply(false);
  return{update,reset,getState:()=>({...camera}),clientPoint:point,setOnChange,setOnTap,fitBounds};
}
