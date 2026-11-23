import {initAppSharing} from './share-app.mjs?v=44';
import {SWAGELOK_BENDERS,getBender} from './benders.mjs';
import {measurementMode,validateMeasurements,convertMeasurementMode,bendMarkLayout} from './measurements.mjs';
import {roundDisplayedMarks} from './displayed-marks.mjs?v=44';
import {isProjectId} from './project-storage.mjs?v=44';
import {initRoomPlanner} from './room-planner.mjs?v=44';
import {renderOffsetVisualization} from './offset-visual.mjs';
import {initTypography} from './typography.mjs?v=44';
import {placeDimensionLabels} from './dimension-layout.mjs?v=44';
import {layoutBlankMarks} from './blank-layout.mjs?v=44';
import {bendReferenceLayout,bestDrawingAngle,readableTextAngle,leaderCrossesPipe} from './labels.mjs?v=44';
import {t,language,locales,captureTranslations,applyLanguage} from './i18n.mjs?v=44';
import{geometry,extend,triangle,practicalOffsetLength,calculate}from'./geometry.mjs';
import {wallValidationStatus} from './wall-validation-status.mjs?v=44';
import {createMainPipeDrawing} from './main-pipe-drawing.mjs?v=44';
import {geometry3D,extendSpatial,validateSpatialState,hasSpatialPipe,bendOrientation,spatialBendRotations} from './spatial-geometry.mjs?v=44';
import {spatialHeightLayers} from './spatial-layers.mjs?v=44';
import {createSpatialPipeDrawing,renderSpatialWorkDrawing} from './spatial-drawing.mjs?v=44';
import {setIconButton} from './ui-icons.mjs?v=44';
import {materialPlan,suggestMaterialJoints,validateMaterialJoints,jointPoint,pieceLayoutMarks,pieceWorkProject} from './material-sections.mjs?v=44';
import {bendVisual,bendBadgeLines,bendAccessibleLabel} from './bend-visuals.mjs?v=44';
const $=id=>document.getElementById(id),fmt=n=>Number.isFinite(n)?n.toLocaleString(locales[language],{maximumFractionDigits:getBender(state.benderId)?.nativeUnits==='in'?3:1}):'—',fmtAngle=n=>Number.isFinite(n)?n.toLocaleString(locales[language],{maximumFractionDigits:3}):'—';
function newDrawingNumber(){const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('');return 'PB-'+date+'-'+crypto.randomUUID().slice(0,6).toUpperCase();}
function normalizeProject(s){const name=s.name.trim()||t('Mit første rør');return {...s,projectId:isProjectId(s.projectId)?s.projectId:crypto.randomUUID(),name,configured:s.configured!==false,drawingNumber:s.drawingNumber?.trim()||name,jointClearance:s.jointClearance??50,joints:s.joints??[]};}
let triangleRotation=0,triangleMirror=false,editing=null,offsetRotation=0,offsetMirror=false,pipeSettingsMode='new';
let bendDirection='horizontal',pipeView='plan',selectedPipeItem=null,workView='auto',workViewProject=null,workLayer='all',labelMode='all';
const pipeGeometry=project=>hasSpatialPipe(project)?geometry3D(project):geometry(project);
let state={version:1,projectId:crypto.randomUUID(),configured:false,name:t('Mit første rør'),drawingNumber:newDrawingNumber(),stock:6000,jointClearance:50,joints:[],diameter:12,wall:1.5,radius:38,benderId:'swagelok-ms-htb-12m',measurementMode:'vertex',heading:0,lengths:[],turns:[]},end='B',sign=1,history=[],storageOK=true;
function valid(s){
 const base=s&&s.version===1&&typeof s.name==='string'&&s.name.length<=80&&(s.projectId===undefined||isProjectId(s.projectId))&&(s.drawingNumber===undefined||(typeof s.drawingNumber==='string'&&s.drawingNumber.trim().length>0&&s.drawingNumber.length<=80))&&['stock','diameter','wall','radius','heading'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k]))&&s.stock>0&&s.diameter>0&&s.wall>0&&s.wall<s.diameter/2&&s.radius>s.diameter/2&&Number.isFinite(s.jointClearance??50)&&(s.jointClearance??50)>=0&&Array.isArray(s.lengths)&&s.lengths.length<=200&&s.lengths.every(v=>Number.isFinite(v)&&v>0)&&Array.isArray(s.turns)&&s.turns.length===Math.max(0,s.lengths.length-1)&&s.turns.every(v=>Number.isFinite(v)&&Math.abs(v)>0&&Math.abs(v)<=179)&&(s.measurementMode===undefined||['tangent','vertex'].includes(s.measurementMode))&&(s.benderId===undefined||s.benderId===null||typeof s.benderId==='string')&&!validateMeasurements(s)&&!validateSpatialState(s);
 return !!base&&!validateMaterialJoints(s,pipeGeometry(s));
}
let bootEmbeddedDraft=null;
try{const s=JSON.parse(localStorage.getItem('pipe-bend-v1'));if(valid(s)){state=normalizeProject(s);bootEmbeddedDraft=s.wallDraft??null;}}catch{}
// Persist the project identity before any wall draft is created, including
// the first session and migration of a legacy project without an ID.
save();
function sync(){
 for(const k of ['name','stock','diameter','wall','radius'])$(k).value=state[k];
 $('joint-clearance').value=state.jointClearance??50;
 $('drawing-number').value=state.drawingNumber||state.name;
 if($('bender-select')){$('bender-select').value=state.benderId||'';$('measurement-mode').value=measurementMode(state);updateBenderFields();}
}
function save(){try{localStorage.setItem('pipe-bend-v1',JSON.stringify(state));}catch{storageOK=false;}}
function commit(n,roomApplied=false,replacingProject=false){
 const error=validateMeasurements(n)||validateSpatialState(n)||validateMaterialJoints(n,pipeGeometry(n));if(error)throw new RangeError(error);
 if(n.planner){
  if(hasSpatialPipe(n))n.planner={...n.planner,routeEdited:true};
  else{
   const geo=geometry(measurementMode(n)==='vertex'?n:convertMeasurementMode(n,'vertex'));
   const changed=!replacingProject&&!!state.planner&&!roomApplied&&JSON.stringify([state.lengths,state.turns,state.radius,state.diameter,state.heading,state.measurementMode,state.bendRotations,state.startFrame])!==JSON.stringify([n.lengths,n.turns,n.radius,n.diameter,n.heading,n.measurementMode,n.bendRotations,n.startFrame]);
   const start=n.placement?.start||n.planner.points?.[0]||[0,0],points=[geo.lines[0]?.dimensionStart||geo.start,...geo.lines.map(line=>line.dimensionEnd||line.end)].map(p=>[p[0]+start[0],p[1]+start[1]]);
   n.planner={...n.planner,routeEdited:roomApplied?false:(changed||!!n.planner.routeEdited),points,input:{...n.planner.input,diameter:n.diameter,radius:n.radius}};
  }
 }
 if(n.projectId!==state.projectId)selectedPipeItem=null;history.push(structuredClone(state));state=n;save();sync();render();
}
let orientationState=null,orientationEnd=null,orientationCache=new Map();
function orientationFor(direction){if(orientationState!==state||orientationEnd!==end){orientationState=state;orientationEnd=end;orientationCache=new Map();}if(!orientationCache.has(direction))orientationCache.set(direction,bendOrientation(state,end,direction));return orientationCache.get(direction);}
function nextOrientation(){
 if(bendDirection==='custom')return {available:Number.isFinite(Number($('bend-rotation').value)),turnSign:sign,rotation:Number($('bend-rotation').value)};
 return orientationFor(bendDirection==='horizontal'?(sign>0?'left':'right'):bendDirection);
}
function params(){
 const orientation=nextOrientation();return{length:Number($('length').value)*Number($('unit').value),turn:Number($('angle').value)*(orientation.turnSign??sign),rotation:orientation.rotation??0,available:orientation.available};
}
function extendCurrent(p){
 // Keep the old representation byte-for-byte for an ordinary planar pipe.
 const next=state.bendRotations!==undefined||state.startFrame!==undefined||Math.abs(p.rotation)>1e-8?extendSpatial(state,end,p.length,p.turn,p.rotation):extend(state,end,p.length,p.turn);
 if(end==='A'&&next.joints?.length)next.joints=next.joints.map(joint=>({...joint,lineIndex:joint.lineIndex+1}));
 return next;
}
function ready(){const p=params();return Number.isFinite(p.length)&&p.length>0&&(!state.lengths.length||(p.available&&Number.isFinite(p.rotation)&&Math.abs(p.rotation)<=180&&Number.isFinite(p.turn)&&Math.abs(p.turn)>0&&Math.abs(p.turn)<=179));}
function refreshSpatialControls(g){
 const has=state.lengths.length>0,spatial=hasSpatialPipe(state);
 $('spatial-bend-controls').hidden=!has;$('spatial-views').hidden=!has;$('drawing-label-control').hidden=!has||(!spatial&&pipeView==='plan');$('drawing-label-mode').value=labelMode;
 if(spatial&&pipeView==='plan')pipeView='top';
 $('spatial-view-select').value=pipeView;$('spatial-orbit').hidden=pipeView!=='iso';setIconButton($('spatial-orbit'),'rotate',t('Drej 3D-visning'),{pressed:spatialPipeDrawing.getOrbitMode()});$('spatial-view-select').querySelector('option[value="plan"]').disabled=spatial;
 for(const [id,dir,icon,label]of [['bend-horizontal','horizontal','horizontal','Vandret buk'],['bend-up','up','bend-up','Buk op'],['bend-down','down','bend-down','Buk ned'],['bend-forward','forward','horizontal','Buk frem'],['bend-back','back','back','Buk tilbage']]){
  const direction=dir==='horizontal'?(sign>0?'left':'right'):dir,available=orientationFor(direction).available;
  setIconButton($(id),icon,t(label),{pressed:bendDirection===dir});$(id).disabled=has&&!available;
  if(dir==='forward'||dir==='back')$(id).hidden=!has||!available;
 }
 const names={horizontal:sign>0?'Venstre':'Højre',up:'Op',down:'Ned',forward:'Frem',back:'Tilbage',custom:'Drejning'};
 const p=params();$('next-bend-direction').textContent=t(names[bendDirection])+(bendDirection==='custom'?' '+fmt(p.rotation)+'°':'');
 if(bendDirection!=='custom')$('bend-rotation').value=String(p.rotation);
 $('spatial-height-range').textContent='';
 if(spatial){const z=g.points.map(p=>p[2]),lo=Math.min(...z),hi=Math.max(...z),height=v=>(v>1e-7?'+':'')+fmt(Math.abs(v)<1e-7?0:v);$('spatial-height-range').textContent='H '+height(lo)+' … '+height(hi)+' mm';}
}
function bendLabel(arc){
 if(!arc.tangent)return t(arc.turn>0?'Venstre':'Højre');
 const p=arc.samples,dy=p.at(-1)[2]-p[0][2];
 return Math.abs(dy)>1e-7?t(dy>0?'Op':'Ned'):t('Vandret');
}
function rotationLabel(rotation){return (rotation>1e-7?'+':'')+fmt(Math.abs(rotation)<1e-7?0:rotation)+'°';}
function currentMaterialPlan(g=pipeGeometry(state)){return materialPlan(state,g,getBender(state.benderId));}

let editingJointIndex=null;
function renderMaterialPanel(plan,g){
 const status=$('joint-status'),jointList=$('joint-list'),pieceList=$('piece-list'),has=g.lines.length>0;jointList.replaceChildren();pieceList.replaceChildren();$('joint-add').disabled=!has;$('joint-suggest').disabled=!has;
 if(!has){status.textContent=t('Opret først et rør.');status.className='';return;}
 if(!plan.ok){status.textContent=t(plan.error);status.className='joint-warning';return;}
 status.textContent=plan.allFit?(plan.pieces.length===1?t('Ét fysisk rør er nok.'):t('{count} fysiske rør passer inden for rå rørlængden.',{count:plan.pieces.length})):t('Mindst ét fysisk rør er for langt. Placér eller foreslå flere samlinger.');
 status.className=plan.allFit?'joint-ok':'joint-warning';if(!plan.allFit)$('joint-panel').open=true;
 for(const joint of plan.joints){
  const row=document.createElement('div'),text=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span'),edit=document.createElement('button'),remove=document.createElement('button');row.className='joint-row';title.textContent=joint.id+' · L'+(joint.lineIndex+1);detail.textContent=fmt(joint.distance)+' mm '+t('fra stykkets start')+((joint.allowanceBefore||joint.allowanceAfter)?' · '+t('Tillæg')+' '+fmt(joint.allowanceBefore)+' / '+fmt(joint.allowanceAfter)+' mm':'');text.append(title,detail);edit.type='button';edit.textContent=t('Rediger');edit.onclick=()=>openJointDialog(joint.sourceIndex);remove.type='button';remove.className='danger';remove.textContent=t('Slet');remove.onclick=()=>{const next=structuredClone(state);next.joints.splice(joint.sourceIndex,1);commit(next);};row.append(text,edit,remove);jointList.append(row);
 }
 for(const piece of plan.pieces){const row=document.createElement('div'),text=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span'),remaining=document.createElement('strong');row.className='piece-row';title.textContent=piece.id+' · '+piece.from+' → '+piece.to;detail.textContent=t('Kaplængde')+' '+fmt(piece.cutLength)+' mm';remaining.textContent=(piece.fits?t('Rest'):t('For langt'))+' · '+fmt(Math.abs(piece.remaining))+' mm';if(!piece.fits)remaining.className='joint-warning';text.append(title,detail);row.append(text,remaining);pieceList.append(row);}
}

function openJointDialog(index=null){
 const g=pipeGeometry(state),clearance=state.jointClearance??50;editingJointIndex=Number.isInteger(index)?index:null;$('joint-line').replaceChildren();
 g.lines.forEach((line,lineIndex)=>{const option=document.createElement('option');option.value=String(lineIndex);option.textContent='L'+(lineIndex+1)+' · '+fmt(line.dimension??line.length)+' mm';option.disabled=line.length<=2*clearance+.01;$('joint-line').append(option);});
 const existing=editingJointIndex===null?null:state.joints[editingJointIndex],fallback=g.lines.findIndex(line=>line.length>2*clearance+.01),lineIndex=existing?.lineIndex??Math.max(0,fallback);$('joint-line').value=String(lineIndex);$('joint-distance').value=String(existing?.distance??Math.max(clearance,(g.lines[lineIndex]?.length??0)/2));$('joint-before').value=String(existing?.allowanceBefore??0);$('joint-after').value=String(existing?.allowanceAfter??0);$('joint-title').textContent=t(existing?'Rediger samling':'Tilføj samling');$('joint-error').textContent='';$('joint-dialog').showModal();$('joint-distance').focus();$('joint-distance').select();
}

function displayedPieceMeasurements(piece){
 const bender=getBender(state.benderId),digits=bender?.nativeUnits==='in'?3:1;
 return roundDisplayedMarks({supported:true,marks:piece.marks,endPosition:piece.cutLength},{digits});
}
function displayedFlatPieceMeasurements(piece){
 const bender=getBender(state.benderId),digits=bender?.nativeUnits==='in'?3:1;
 return roundDisplayedMarks({supported:true,marks:pieceLayoutMarks(piece),endPosition:piece.cutLength},{digits});
}

function renderWorkMaterial(plan){
 const container=$('work-material');container.replaceChildren();if(!plan.ok||!plan.pieces.length)return;
 const heading=document.createElement('h2');heading.textContent=t('Fysiske rør og samlinger');container.append(heading);
 for(const piece of plan.pieces){
  const card=document.createElement('article'),title=document.createElement('h3'),summary=document.createElement('p');card.className='work-piece';title.textContent=piece.id+' · '+piece.from+' → '+piece.to;summary.textContent=t('Kaplængde')+' '+fmt(piece.cutLength)+' mm · '+(piece.fits?t('Rest'):t('For langt'))+' '+fmt(Math.abs(piece.remaining))+' mm';card.append(title,summary);
  if(piece.allowanceStart||piece.allowanceEnd){const allowance=document.createElement('p');allowance.textContent=t('Samlingstillæg ved start/slut')+' · '+fmt(piece.allowanceStart)+' / '+fmt(piece.allowanceEnd)+' mm';card.append(allowance);}
  container.append(card);
 }
}

function appendPieceMarkTable(card,piece,sourceGeometry){
 const displayed=displayedPieceMeasurements(piece),reference=document.createElement('p');reference.className='hint';reference.textContent=t(piece.report.supported?'Mål efter valgt værktøjstabel.':'Geometriske referencepunkter — kontrollér målene mod dit bukkeværktøj.');card.append(reference);if(!displayed.ok)return;
 const spatial=hasSpatialPipe(state),work=spatial?pieceWorkProject(state,sourceGeometry,piece):null,rolls=spatial?spatialBendRotations(work):[],table=document.createElement('table'),head=document.createElement('tr'),body=document.createElement('tbody');for(const label of [t('Buk'),t('Vinkel'),...(spatial?[t('Drejning')]:[]),t('Fradrag'),t('Fra forrige mærke'),t('Mærke fra rørets start')]){const th=document.createElement('th');th.textContent=label;head.append(th);}const thead=document.createElement('thead');thead.append(head);table.append(thead,body);
 displayed.marks.forEach((mark,index)=>{const row=document.createElement('tr'),roll=rolls[index];for(const value of [mark.id,fmt(Math.abs(mark.angle))+'°',...(spatial?[roll?rotationLabel(roll.rotation):'—']:[]),Number.isFinite(mark.gainApplied)?fmt(mark.gainApplied)+' mm':'—',fmt(mark.displayedInterval)+' mm',fmt(mark.displayedPosition)+' mm']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);});
 const endGain=piece.report.supported&&Number.isFinite(piece.report.gains?.at(-1))?fmt(piece.report.gains.at(-1))+' mm':'—',endRow=document.createElement('tr');for(const value of [t('Rørslut'),'—',...(spatial?['—']:[]),endGain,fmt(displayed.displayedEndInterval)+' mm',fmt(displayed.displayedEndPosition)+' mm']){const cell=document.createElement('td');cell.textContent=value;endRow.append(cell);}body.append(endRow);card.append(table);
}

function renderWorkMarks(plan,g){
 const container=$('work-marks');if(!plan.ok||plan.pieces.length<=1){renderBenderMarks(container,state,g);return;}container.replaceChildren();
 const heading=document.createElement('h3'),intro=document.createElement('p');heading.textContent=t('Afsætningsmål pr. fysisk rør');intro.className='hint';intro.textContent=t('Alle mål starter ved det fysiske rørs kapende og inkluderer eventuelt samlingstillæg.');container.append(heading,intro);if(hasSpatialPipe(state)){const rollNote=document.createElement('p');rollNote.className='work-rotation-note';rollNote.textContent=t('Ved et nyt fysisk rør overføres 0°-referencen ved samlingen. Drejninger måles lokalt på røret; B-numrene følger den samlede montage fra A mod B.');container.append(rollNote);}
 for(const piece of plan.pieces){const card=document.createElement('article'),title=document.createElement('h3'),summary=document.createElement('p');card.className='work-piece work-piece-marks';title.textContent=piece.id+' · '+piece.from+' → '+piece.to;summary.textContent=t('Kaplængde')+' '+fmt(piece.cutLength)+' mm';card.append(title,summary);appendPieceMarkTable(card,piece,g);container.append(card);}
 const bender=getBender(state.benderId);if(bender){const source=document.createElement('a');source.className='bender-source';source.href=bender.source.url+'#page=23';source.target='_blank';source.rel='noopener noreferrer';source.textContent=t('Producentens tabel og mærkereference')+' · MS-13-43, '+bender.source.revision;container.append(source);}
}

$('joint-add').onclick=()=>openJointDialog();$('joint-cancel').onclick=()=>$('joint-dialog').close();
$('joint-suggest').onclick=()=>{const g=pipeGeometry(state),suggestion=suggestMaterialJoints(state,g,getBender(state.benderId));if(!suggestion.ok||!suggestion.plan?.allFit){$('joint-status').textContent=t(suggestion.error||'Der kunne ikke findes en samling på et lige stykke inden for den valgte rå rørlængde.');$('joint-status').className='joint-warning';$('joint-panel').open=true;return;}const next=structuredClone(state);next.joints=suggestion.joints;commit(next);$('joint-panel').open=true;};
$('joint-form').onsubmit=event=>{event.preventDefault();const joint={lineIndex:Number($('joint-line').value),distance:Number($('joint-distance').value),allowanceBefore:Number($('joint-before').value),allowanceAfter:Number($('joint-after').value)},next=structuredClone(state);next.joints=next.joints??[];if(editingJointIndex===null)next.joints.push(joint);else next.joints[editingJointIndex]=joint;const error=validateMaterialJoints(next,pipeGeometry(next));if(error){$('joint-error').textContent=t(error);return;}commit(next);$('joint-dialog').close();$('joint-panel').open=true;};
$('joint-line').onchange=()=>{if(editingJointIndex!==null)return;const line=pipeGeometry(state).lines[Number($('joint-line').value)],clearance=state.jointClearance??50;if(line)$('joint-distance').value=String(Math.max(clearance,line.length/2));};
function refreshActionIcons(){
 for(const [id,name,label]of [
  ['triangle-rotate','rotate','Drej 90°'],['triangle-reset','reset','Nulstil retning'],
  ['offset-rotate','rotate','Drej 90°'],['offset-reset','reset','Nulstil retning'],
  ['zoom-fit','fit','Tilpas visning'],['work-open','worksheet','Arbejdsvisning'],
  ['work-close','back','Tilbage til redigering'],['undo','undo','Fortryd'],['reset','new','Nyt rør'],
  ['calculator-open','calculator','Lommeregner'],['pyth-info','info','Info om Pythagoras'],['offset-info','info','Info om forskydning'],
 ])setIconButton($(id),name,t(label));
 setIconButton($('mirror'),sign>0?'bend-left':'bend-right',t('Spejlvend buk · {direction}',{direction:t(sign>0?'Venstre':'Højre')}),{pressed:sign<0&&bendDirection==='horizontal'});
 setIconButton($('triangle-mirror'),'mirror',t('Spejlvend'),{pressed:triangleMirror});
 setIconButton($('offset-mirror'),'mirror',t('Spejlvend'),{pressed:offsetMirror});
 setIconButton($('drawing-help').querySelector('summary'),'info',t('Info om tegningen'));
 $('triangle-reset').disabled=triangleRotation===0&&!triangleMirror;$('offset-reset').disabled=offsetRotation===0&&!offsetMirror;
}

function render(){
 const g=pipeGeometry(state),has=state.lengths.length>0,marks=bendMarkLayout(state,getBender(state.benderId)),material=marks.supported&&has?marks.endPosition:g.used,left=state.stock-material,plan=currentMaterialPlan(g);
 const split=has&&plan.ok&&plan.allFit&&plan.pieces.length>1,displayRemaining=split?plan.totalWaste:left,displayUsed=split?plan.totalCutLength:material,displayCapacity=split?state.stock*plan.pieces.length:state.stock;
 $('empty').style.display=has?'none':'flex';$('drawing-reference-details').hidden=!has;$('drawing-title').textContent=state.name;$('bend-fields').hidden=!has;$('angle').disabled=!has;
 $('editor-title').textContent=has?t('Fortsæt fra ende ')+end:t('Start med første stykke');
 $('add').textContent=!state.configured?t('Opret rør'):has?t('Tilføj buk & stykke'):t('Tilføj første stykke');
 refreshActionIcons();refreshSpatialControls(g);$('undo').disabled=!history.length;
 document.querySelector('.stock-card .eyebrow').textContent=t(split?'SAMLET REST':'TILBAGE AF RØRET');$('remaining').innerHTML=fmt(displayRemaining)+' <small>mm</small>';$('remaining').style.color=displayRemaining<0?'#b64235':'';
 $('used').textContent=split?fmt(displayUsed)+' mm · '+t('{count} fysiske rør',{count:plan.pieces.length}):fmt(material)+' mm · '+t(marks.supported&&has?'Kaplængde efter værktøjstabel':'Geometrisk rørlængde');$('total').textContent=split?t('af ') +plan.pieces.length+' × '+fmt(state.stock)+' mm':t('af ')+fmt(state.stock)+' mm';$('progress').max=displayCapacity;$('progress').value=displayUsed;
 $('material-status').textContent=plan.ok&&plan.allFit&&plan.pieces.length>1?t('{count} fysiske rør · samlet rest {waste} mm',{count:plan.pieces.length,waste:fmt(plan.totalWaste)}):left<0?t('Røret er ')+fmt(-left)+t(' mm for kort'):g.arcs.length+t(' buk · buelængder medregnet');
 let preview=null,previewError='';if(has&&ready()){const next=extendCurrent(params());previewError=validateMeasurements(next)||validateSpatialState(next)||'';if(!previewError)preview=pipeGeometry(next);}
 $('error').textContent=!storageOK?t('Automatisk lagring er utilgængelig. Gem projektet som fil.'):has&&!params().available?t('Vælg en anden bukkeretning. Røret peger allerede i denne retning.'):t(previewError);
 $('add').disabled=state.configured&&(!ready()||!!previewError);
 $('room-plan-status').textContent=state.planner&&hasSpatialPipe(state)?t('Vægkontrol: højdeskift ikke kontrolleret'):state.planner?.routeEdited?t('Vægkontrol: kræver ny kontrol'):'';
 $('drawing-mode').textContent=t(measurementMode(state)==='vertex'?'Mål til centerlinjehjørner':'Lige længder mellem tangentpunkter')+(getBender(state.benderId)?' · '+getBender(state.benderId).model:'');
 $('length-label').textContent=t(measurementMode(state)==='vertex'?'Færdigmål':'Lige stykke');
 renderMaterialPanel(plan,g);renderBenderMarks($('live-marks'),state,g);draw(g,preview);updateTools();
}

// Native disclosure controls keep explanations available without occupying
// the drawing or calculation flow. Close them before another action begins.
document.addEventListener('pointerdown',event=>{for(const help of document.querySelectorAll('details.inline-help'))if(help.open&&!help.contains(event.target))help.open=false;});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const opened=[...document.querySelectorAll('details.inline-help')].filter(help=>help.open);if(!opened.length)return;const focused=opened.find(help=>help.contains(document.activeElement));for(const help of opened)help.open=false;event.preventDefault();event.stopPropagation();focused?.querySelector('summary')?.focus({preventScroll:true});},true);

const mainPipeDrawing=createMainPipeDrawing({svg:$('drawing'),zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),fit:$('zoom-fit'),output:$('zoom-level'),format:n=>fmt(n),formatAngle:n=>fmtAngle(n),translate:t,onEdit:openEdit,onJoint:openJointDialog,onEndpoint:label=>{end=label;render();$('angle').scrollIntoView({behavior:'smooth',block:'center'});$('angle').focus({preventScroll:true});}});

const spatialPipeDrawing=createSpatialPipeDrawing({onSelect:(type,index)=>{selectedPipeItem=type?{type,index}:null;render();},svg:$('spatial-drawing'),zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),fit:$('zoom-fit'),output:$('zoom-level'),format:n=>fmt(n),formatAngle:n=>fmtAngle(n),translate:t,onEdit:openEdit,onJoint:openJointDialog,onEndpoint:label=>{end=label;render();$('angle').scrollIntoView({behavior:'smooth',block:'center'});$('angle').focus({preventScroll:true});},onPick:hits=>{
 const list=$('spatial-pick-options');list.replaceChildren();
 for(const hit of hits){const type=hit.type==='angle'?'angle':'length',index=hit.index,button=document.createElement('button');button.type='button';const geo=geometry3D(state),line=geo.lines[index];button.textContent=type==='length'?'L'+(index+1)+' · '+fmt(line.dimension)+' mm · H '+fmt(line.start[2])+' → '+fmt(line.end[2])+' mm':'B'+(index+1)+' · '+fmt(Math.abs(state.turns[index]))+'°';button.onclick=()=>{$('spatial-pick-dialog').close();if(labelMode==='tap'){selectedPipeItem={type,index};render();}else openEdit(type,index);};list.append(button);}
 $('spatial-pick-dialog').showModal();list.querySelector('button')?.focus();
}});
$('spatial-pick-close').onclick=()=>$('spatial-pick-dialog').close();
$('spatial-view-select').onchange=()=>{pipeView=$('spatial-view-select').value;if(pipeView==='iso')spatialPipeDrawing.setOrbitMode(true);mainPipeDrawing.reset();spatialPipeDrawing.reset();render();};
$('spatial-orbit').onclick=()=>{spatialPipeDrawing.setOrbitMode(!spatialPipeDrawing.getOrbitMode());render();};
for(const [id,direction]of [['bend-horizontal','horizontal'],['bend-up','up'],['bend-down','down'],['bend-forward','forward'],['bend-back','back']])$(id).onclick=()=>{bendDirection=direction;render();};
$('bend-rotation').oninput=()=>{bendDirection='custom';render();};

function draw(g,preview,target=$('drawing'),work=false,options={}){
 const project=options.project??state,plan=materialPlan(project,g,getBender(project.benderId)),baseJoints=options.joints??(plan.ok?plan.joints:[]),joints=work?baseJoints.map((joint,index)=>({...joint,workLane:joint.workLane??index,workLabel:joint.workLabel||joint.id+' · '+t('DELING')+(options.pieceDrawing?'':' · R'+(index+1)+' | R'+(index+2))})):baseJoints;
 if(!work){
  const spatial=hasSpatialPipe(state)||pipeView!=='plan';if(spatial){$('drawing').setAttribute('hidden','');$('spatial-drawing').removeAttribute('hidden');}else{$('drawing').removeAttribute('hidden');$('spatial-drawing').setAttribute('hidden','');}
  if(spatial){const geo=geometry3D(state);let next=null;if(preview&&ready())next=geometry3D(extendCurrent(params()));spatialPipeDrawing.draw(geo,next,{diameter:state.diameter,radius:state.radius,end,view:pipeView==='plan'?'top':pipeView,selected:selectedPipeItem,labelMode,joints});}
  else mainPipeDrawing.draw(g,preview,{diameter:state.diameter,radius:state.radius,end,joints});
  if($('drawing-references'))renderReferences(g,$('drawing-references'));return;
 }
 const chosenWorkView=options.view??(workView==='auto'?(hasSpatialPipe(project)?'iso':'plan'):workView);
 if(chosenWorkView!=='plan'){renderSpatialWorkDrawing(target,options.spatialGeometry??geometry3D(project),{diameter:project.diameter,radius:project.radius,format:fmt,formatAngle:fmtAngle,translate:t,view:chosenWorkView,layerHeight:options.pieceDrawing?null:(chosenWorkView==='top'&&workLayer!=='all'?Number(workLayer):null),labelMode:options.pieceDrawing?'all':labelMode,selected:options.pieceDrawing?null:selectedPipeItem,joints,endpointLabels:options.endpointLabels,heightDatumLabel:options.heightDatumLabel,showReferenceIds:!!options.showReferenceIds,onSelect:options.pieceDrawing?undefined:(type,index)=>{selectedPipeItem=type?{type,index}:null;renderWork();},width:options.width??900,height:options.height??1200});return;}
 const svg=target;svg.onclick=null;svg.replaceChildren();for(const name of ['data-spatial-work','data-spatial-work-view','data-spatial-work-layer','data-spatial-label-mode','data-label-mode','data-spatial-eligible-lines','data-spatial-eligible-lengths','data-spatial-eligible-bends','data-spatial-placed-labels','data-spatial-total-labels'])svg.removeAttribute(name);
 const width=work?(options.width??900):Math.max(280,svg.clientWidth||900),pageHeight=work?(options.height??1200):Math.max(430,Math.min(540,width*.65));
 if(!work)svg.setAttribute('height',String(pageHeight));
 const setBounds=()=>svg.setAttribute('viewBox',`0 0 ${width} ${pageHeight}`);
 if(!g.lines.length){setBounds();if(!work&&$('drawing-references'))renderReferences(g,$('drawing-references'));return;}
 const plotWidth=width-(work?150:112),plotHeight=pageHeight-(work?150:112),angle=bestDrawingAngle(g.points,plotWidth,plotHeight),c=Math.cos(angle),sn=Math.sin(angle),rotate=p=>[p[0]*c-p[1]*sn,p[0]*sn+p[1]*c],rotated=g.points.map(rotate),xs=rotated.map(p=>p[0]),ys=rotated.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),scale=Math.min(plotWidth/Math.max(1,maxx-minx),plotHeight/Math.max(1,maxy-miny));
 const P=p=>{const q=rotate(p);return[width/2+(q[0]-(minx+maxx)/2)*scale,pageHeight/2-(q[1]-(miny+maxy)/2)*scale];};
 function el(tag,attrs,parent=svg){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
 const pipes=el('g',{'data-layer':'pipe'}),leaders=el('g',{'data-layer':'leaders'}),labels=el('g',{'data-layer':'labels'}),ends=el('g',{'data-layer':'endpoints'});
 function path(geo,attrs,delta=[0,0]){let d='';const pp=p=>P([p[0]+delta[0],p[1]+delta[1]]).join(',');geo.lines.forEach((l,i)=>{if(!i)d+='M'+pp(l.start);d+='L'+pp(l.end);if(geo.arcs[i])for(const p of geo.arcs[i].samples)d+='L'+pp(p);});el('path',{d,fill:'none','stroke-linecap':'round','stroke-linejoin':'round',...attrs},pipes);}
 if(preview){let shift=[0,0];if(end==='A'){const p=preview.lines[1].start;shift=[-p[0],-p[1]];}path(preview,{stroke:'#97c6b0','stroke-width':2,'stroke-dasharray':'8 8',opacity:.6},shift);}
 path(g,{stroke:'#9db6ab','stroke-width':14});path(g,{stroke:'#deeee7','stroke-width':9});path(g,{stroke:'#487b69','stroke-width':1,'stroke-dasharray':'4 5'});
 for(const [index,arc]of g.arcs.entries()){
	 const visual=bendVisual(arc.turn),id=arc.displayId||'B'+(index+1),accessible=bendAccessibleLabel(id,arc.turn,{format:fmtAngle,special:t('SPECIAL')}),points=arc.samples.map(P),d=points.map((point,i)=>(i?'L':'M')+point.join(' ')).join(' ');if(work)el('path',{'data-bend-emphasis':id,d,fill:'none',stroke:visual.stroke,'stroke-width':22,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.26,'pointer-events':'none'},pipes);const outer=el('path',{'data-bend-color':visual.key,'data-bend-kind':visual.standard?'standard':'special','data-bend-id':id,'aria-label':accessible,d,fill:'none',stroke:visual.stroke,'stroke-width':14,'stroke-linecap':'butt','stroke-linejoin':'round','pointer-events':'none'},pipes);el('title',{},outer).textContent=accessible;el('path',{d,fill:'none',stroke:visual.tube,'stroke-width':9,'stroke-linecap':'butt','stroke-linejoin':'round','pointer-events':'none'},pipes);el('path',{d,fill:'none',stroke:visual.stroke,'stroke-width':1,'stroke-dasharray':visual.dash||'4 5','stroke-linecap':'butt','pointer-events':'none'},pipes);
 }
 if(!work)for(let index=0;index<g.lines.length;index++){const a=P(g.lines[index].start),b=P(g.lines[index].end);el('line',{'data-length-id':'L'+(index+1),class:'reference-path',x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#278f70','stroke-width':20,'stroke-linecap':'round','pointer-events':'none',opacity:0},pipes);}
 const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
 const footprint=(a,b,padding=8)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*padding,ny=dx/len*padding;return[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];};
 const pipe=[];
 for(const line of g.lines)pipe.push({polygon:footprint(P(line.start),P(line.end))});
 for(let index=0;index<g.arcs.length;index++){const arc=g.arcs[index];for(let j=0;j<arc.samples.length-1;j+=4)pipe.push({index,polygon:footprint(P(arc.samples[j]),P(arc.samples[Math.min(j+4,arc.samples.length-1)]))});}
 const endpointObstacles=[P(g.start),P(g.end)].map(p=>rect(p[0]-23,p[1]-23,46,46));
	const layout=bendReferenceLayout(g.arcs,P,{width,height:pageHeight,fontSize:work?18:13,obstacles:endpointObstacles,pipe,maxLeader:28,labelFor:(arc,index,id)=>bendVisual(arc.turn).standard?false:bendBadgeLines(id,arc.turn,{format:fmtAngle,special:t('SPECIAL')})});
 const obstacles=[...pipe.map(p=>p.polygon),...endpointObstacles,...layout.labels.map(p=>p.polygon),...layout.labels.map(p=>footprint(...p.leader,2))];
 const fontSize=work?18:14,metrics=document.createElement('canvas').getContext('2d');metrics.font=`600 ${fontSize}px ${getComputedStyle(svg).fontFamily}`;
 const items=g.lines.map((line,index)=>{const a=P(line.start),b=P(line.end),id=line.displayId||'L'+(index+1),text=(options.showReferenceIds?id+' · ':'')+fmt(line.dimension??line.length)+(work?' mm':'');return{id,index,a,b,text,width:Math.ceil(metrics.measureText(text).width)+14,height:fontSize+10,angle:readableTextAngle(b[0]-a[0],b[1]-a[1])};});
 const crosses=(a,b,c,d)=>{const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],w=[c[0]-a[0],c[1]-a[1]],det=u[0]*v[1]-u[1]*v[0];if(Math.abs(det)<1e-8)return false;const t=(w[0]*v[1]-w[1]*v[0])/det,q=(w[0]*u[1]-w[1]*u[0])/det;return t>1e-5&&t<1-1e-5&&q>1e-5&&q<1-1e-5;};
 const hits=(a,b,polygon)=>{const inside=p=>{const signs=polygon.map((v,i)=>{const q=polygon[(i+1)%polygon.length];return(q[0]-v[0])*(p[1]-v[1])-(q[1]-v[1])*(p[0]-v[0]);});return signs.every(n=>n>=0)||signs.every(n=>n<=0);};return inside(a)||inside(b)||polygon.some((p,i)=>crosses(a,b,p,polygon[(i+1)%polygon.length]));};
 const dimensionLeader=dim=>{const start=[(dim.a[0]+dim.b[0])/2,(dim.a[1]+dim.b[1])/2],dx=start[0]-dim.x,dy=start[1]-dim.y,angle=dim.angle*Math.PI/180,localX=dx*Math.cos(angle)+dy*Math.sin(angle),localY=-dx*Math.sin(angle)+dy*Math.cos(angle),factor=Math.min(1,dim.width/2/Math.max(1e-8,Math.abs(localX)),dim.height/2/Math.max(1e-8,Math.abs(localY)));return[start,[dim.x+dx*factor,dim.y+dy*factor]];};
 const dimensionFits=(maxLeader,maxDistance,prior=[])=>(dim,accepted)=>{
  if(dim.box.x<10||dim.box.y<10||dim.box.x+dim.box.w>width-10||dim.box.y+dim.box.h>pageHeight-10)return false;
  const [start,finish]=dimensionLeader(dim),length=Math.hypot(start[0]-finish[0],start[1]-finish[1]);
  if(length>maxLeader||Math.hypot(start[0]-dim.x,start[1]-dim.y)>maxDistance||leaderCrossesPipe(start,finish,pipe))return false;
  return !layout.labels.some(p=>hits(start,finish,p.polygon))&&![...prior,...accepted].some(p=>hits(start,finish,p.polygon)||crosses(start,finish,...dimensionLeader(p)))&&!layout.labels.some(p=>crosses(start,finish,...p.leader));
 };
 const dimensionBounds={x:12,y:12,w:width-24,h:pageHeight-24},dimensionFootprint=dim=>[footprint(...dimensionLeader(dim),2)];
 const primary=placeDimensionLabels(items,obstacles,dimensionBounds,{allowOmissions:true,acceptCandidate:dimensionFits(work?64:42,work?100:66),extraObstacles:dimensionFootprint}).map(dim=>({...dim,leader:dimensionLeader(dim)}));
 // Keep good local labels fixed, then give only the missing dimensions more
 // room. Every second-pass candidate still obeys bounds, pipe, label and
 // leader collision checks; the text is never dropped just for a short leg.
 const missing=items.filter(item=>!primary.some(dim=>dim.id===item.id));
 const secondary=placeDimensionLabels(missing,[...obstacles,...primary.map(dim=>dim.polygon),...primary.flatMap(dimensionFootprint)],dimensionBounds,{allowOmissions:true,localFallback:items.length<=60,acceptCandidate:dimensionFits(work?104:64,work?154:100,primary),extraObstacles:dimensionFootprint}).map(dim=>({...dim,leader:dimensionLeader(dim)}));
 const placed=[...primary,...secondary].sort((a,b)=>a.index-b.index);
 for(const dim of placed){
  const [a,b]=dim.leader;
  el('line',{'data-length-leader':dim.id,x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#8ca697','stroke-width':1},leaders);
  const group=el('g',{'data-length':dim.id,transform:`translate(${dim.x} ${dim.y}) rotate(${dim.angle})`,class:'length-dimension'},labels);
  el('title',{},group).textContent=(options.showReferenceIds?dim.text:dim.id+' · '+dim.text)+(work?'':' mm');
  el('rect',{x:-dim.width/2,y:-dim.height/2,width:dim.width,height:dim.height,rx:4,fill:'#ffffff'},group);
  el('text',{x:0,y:fontSize*.34,'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':fontSize,'font-weight':600,fill:'#176748'},group).textContent=dim.text;
  if(!work){makeEditable(group,'length',dim.index);group.setAttribute('aria-label',dim.id+' · '+dim.text+' mm');}
 }
 for(const ref of layout.labels){
  const arc=g.arcs[ref.index],visual=bendVisual(arc.turn),accessible=bendAccessibleLabel(ref.id,arc.turn,{format:fmtAngle,special:t('SPECIAL')}),[a,b]=ref.leader;el('line',{'data-bend-leader':ref.id,x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:visual.stroke,'stroke-width':1.25},leaders);
  const badge=el('g',{'data-reference':ref.id,'data-bend-id':ref.id,'data-bend-code':visual.key,'data-bend-kind':visual.standard?'standard':'special',class:'reference-badge','aria-label':accessible},labels),box={x:ref.labelX-ref.width/2,y:ref.labelY-ref.height/2,width:ref.width,height:ref.height,rx:Math.min(12,ref.height/2),fill:visual.fill,stroke:visual.stroke,'stroke-width':visual.standard?1.2:1.8};if(visual.dash)box['stroke-dasharray']=visual.dash;el('rect',box,badge);
  const lineHeight=ref.fontSize*1.05,first=ref.labelY-(ref.labelLines.length-1)*lineHeight/2+ref.fontSize*.34;ref.labelLines.forEach((text,index)=>{const line=el('text',{x:ref.labelX,y:first+index*lineHeight,'font-family':'var(--app-font, sans-serif)','font-size':index?ref.fontSize*.88:ref.fontSize,'font-weight':index?600:700,'text-anchor':'middle',fill:visual.text},badge);line.textContent=text;});
  el('title',{},badge).textContent=accessible+' · '+t(arc.turn>0?'Venstre':'Højre');
  if(!work)makeEditable(badge,'angle',ref.index);
 }
	const placedSpecial=new Set(layout.labels.map(label=>label.index));
	for(const ref of layout.anchors){
	 const arc=g.arcs[ref.index],visual=bendVisual(arc.turn),anchor=el('g',{'data-bend-id':ref.id,'data-bend-anchor':ref.id,'data-bend-code':visual.key,class:'bend-anchor'},labels);
  if(!work)el('circle',{cx:ref.x,cy:ref.y,r:10,fill:'transparent'},anchor);
	 const offset=work?13:10,x=ref.x+(ref.outward?.[0]||0)*offset,y=ref.y+(ref.outward?.[1]||0)*offset;if(visual.standard||!placedSpecial.has(ref.index)){const text=el('text',{'data-bend-inline-label':ref.id,x,y:y+(work?4.5:3.5),'text-anchor':'middle','font-family':'var(--app-font, sans-serif)','font-size':visual.standard?(work?13:10):(work?12:9.5),'font-weight':800,fill:visual.text,'paint-order':'stroke',stroke:'#fff','stroke-width':work?4:3,'stroke-linejoin':'round'},anchor);text.textContent=visual.standard?ref.id:ref.id+' · '+t('SPECIAL')+' '+fmtAngle(Math.abs(arc.turn))+'°';}else el('circle',{'data-bend':ref.id,cx:ref.x,cy:ref.y,r:3,fill:visual.stroke,stroke:'white','stroke-width':1.2},anchor);
  el('title',{},anchor).textContent=bendAccessibleLabel(ref.id,arc.turn,{format:fmtAngle,special:t('SPECIAL')});
  if(!work)makeEditable(anchor,'angle',ref.index);
 }
 for(const [jointIndex,joint]of joints.entries()){
  const line=g.lines[joint.lineIndex];if(!line)continue;
  const point=P(jointPoint(g,joint)),a=P(line.start),b=P(line.end),length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,u=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-u[1],u[0]],text=joint.workLabel||joint.id+' · '+t('DELING'),pillWidth=Math.max(96,text.length*7+20),side=point[0]>width*.58?-1:1,lane=joint.workLane??jointIndex,laneOffset=(lane%2?-1:1)*(30+Math.floor(lane/2)*28),labelX=Math.max(pillWidth/2+8,Math.min(width-pillWidth/2-8,point[0]+side*(pillWidth/2+26))),labelY=Math.max(18,Math.min(pageHeight-18,point[1]-laneOffset)),reference=line.displayId||'L'+(joint.lineIndex+1),accessible=text+' · '+reference+' · '+fmt(joint.distance)+' mm',marker=el('g',{'data-joint':joint.id,class:'joint-marker joint-division-marker','aria-label':accessible},labels);
  for(const offset of [-4,4]){const center=[point[0]+u[0]*offset,point[1]+u[1]*offset];el('line',{x1:center[0]-n[0]*25,y1:center[1]-n[1]*25,x2:center[0]+n[0]*25,y2:center[1]+n[1]*25,stroke:'#fff','stroke-width':7,'stroke-linecap':'round'},marker);el('line',{'data-division-symbol':'cut-band',x1:center[0]-n[0]*25,y1:center[1]-n[1]*25,x2:center[0]+n[0]*25,y2:center[1]+n[1]*25,stroke:'#A73622','stroke-width':3,'stroke-linecap':'round'},marker);}
  el('line',{x1:point[0],y1:point[1],x2:labelX-side*pillWidth/2,y2:labelY,stroke:'#A73622','stroke-width':1.5,'stroke-dasharray':'4 3'},marker);el('rect',{x:labelX-pillWidth/2,y:labelY-13,width:pillWidth,height:26,rx:13,fill:'#FFF0EB',stroke:'#A73622','stroke-width':1.7},marker);el('text',{x:labelX,y:labelY+4,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#702315'},marker).textContent=text;el('title',{},marker).textContent=accessible;
 }
 const endpointLabels=options.endpointLabels??['A','B'];
 for(const[index,p]of[g.start,g.end].entries()){
	 const label=endpointLabels[index]||['A','B'][index];if(work&&label.startsWith('S'))continue;const staticEndpointLabel=label==='K'?'K · '+t('fysisk kapende'):label,q=P(p),e=el('g',{class:'endpoint','aria-label':staticEndpointLabel},ends);el('circle',{cx:q[0],cy:q[1],r:23,fill:'transparent'},e);el('circle',{cx:q[0],cy:q[1],r:16,fill:['A','B'][index]===end?'#16815d':'#183c36',stroke:'white','stroke-width':3},e);el('text',{x:q[0],y:q[1]+5,fill:'white','font-size':label.length>2?10:14,'font-weight':700,'text-anchor':'middle'},e).textContent=label;
  if(work)continue;e.setAttribute('role','button');e.setAttribute('tabindex','0');e.setAttribute('aria-label',t('Tilføj buk ved ende ')+label);const select=()=>{end=label;render();$('angle').scrollIntoView({behavior:'smooth',block:'center'});$('angle').focus({preventScroll:true});};e.onclick=select;e.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();select();}};
 }
	svg.setAttribute('data-inline-bends',String(layout.anchors.length));svg.setAttribute('data-total-bends',String(g.arcs.length));
 setBounds();if(!work&&$('drawing-references'))renderReferences(g,$('drawing-references'));
}

function renderReferences(g,container,work=false){
 container.replaceChildren();
 function highlight(id){for(const selector of ['[data-bend-id]','[data-length-id]'])for(const node of $('drawing').querySelectorAll(selector))node.classList.toggle('reference-selected',(node.getAttribute('data-bend-id')||node.getAttribute('data-length-id'))===id);}
 for(const type of ['length','angle']){
  const col=document.createElement('section'),heading=document.createElement('h3');heading.textContent=t(type==='length'?'Længder':'Bukkevinkler');col.append(heading);
  const list=type==='length'?g.lines:g.arcs;
  for(let i=0;i<list.length;i++){
   const item=list[i],row=document.createElement(work?'div':'button');row.className='reference-row';
   const id=(type==='length'?'L':'B')+(i+1),ref=document.createElement('strong'),value=document.createElement('span');ref.className=type==='angle'?'bend-ref':'length-ref';ref.textContent=id;if(type==='angle'){const visual=bendVisual(item.turn);ref.style.color=visual.text;ref.style.background=visual.fill;ref.style.border='1px '+(visual.dash?'dashed ':'solid ')+visual.stroke;ref.dataset.bendCode=visual.key;value.textContent=(visual.standard?'':t('SPECIAL')+' · ')+fmtAngle(Math.abs(item.turn))+'° · '+bendLabel(item);}else value.textContent=fmt(item.dimension??item.length)+' mm';row.append(ref,value);row.setAttribute('data-reference-row',id);if(type==='length'&&hasSpatialPipe(state))value.textContent+=' · H '+fmt(item.dimensionStart[2])+' → '+fmt(item.dimensionEnd[2])+' mm';
   if(!work){row.type='button';row.setAttribute('aria-label',id+' · '+value.textContent);row.onfocus=()=>highlight(id);row.onmouseenter=()=>highlight(id);row.onclick=()=>{highlight(id);openEdit(type,i);};}
   col.append(row);
  }
  container.append(col);
 }
 container.hidden=!g.lines.length;
 if(!work&&$('drawing-reference-details'))$('drawing-reference-details').hidden=!g.lines.length;
}

function initBenderChoices(){
 const select=$('bender-select');
 for(const units of ['mm','in']){const group=document.createElement('optgroup');group.label=units==='mm'?'Swagelok · mm':'Swagelok · inch';for(const bender of SWAGELOK_BENDERS.filter(item=>item.nativeUnits===units)){const option=document.createElement('option');option.value=bender.id;option.textContent=bender.label;group.append(option);}select.append(group);}
 select.onchange=()=>{const bender=getBender(select.value);if(bender){$('diameter').value=bender.tubeODmm;$('radius').value=bender.radiusMm;if(Number($('wall').value)>=bender.tubeODmm/2)$('wall').value='0.8';}updateBenderFields();};
 $('measurement-mode').onchange=updateBenderFields;
}
function updateBenderFields(){
 const bender=getBender($('bender-select').value);
 $('diameter').disabled=!!bender;$('radius').disabled=!!bender;
 $('bender-info').textContent=bender?bender.model+' · Ø'+fmt(bender.tubeODmm)+' mm · R'+fmt(bender.radiusMm)+' mm. '+t('Afsætningsfradrag følger producentens tabel.'):t('Angiv rørdiameter og centerlinjeradius. Der vises geometriske mål uden værktøjstabel.');
 $('measurement-help').textContent=t($('measurement-mode').value==='vertex'?'Mål til de tænkte hjørner på rørets centerlinjer. Radius omregnes automatisk til de lige stykker.':'Mål kun det lige rør mellem buernes tangentpunkter. Skift af måltype omregner eksisterende mål og bevarer rørets form.');
 $('bender-source').hidden=!bender;if(bender)$('bender-source').href=bender.source.url+'#page=23';
}
function renderBenderMarks(container,project,g){
 container.replaceChildren();const bender=getBender(project.benderId),report=bendMarkLayout(project,bender),has=project.lengths.length>0;
 if(container.id==='live-marks'){$('bender-marks').hidden=!has;if(has&&bender&&!report.supported)$('bender-marks').open=true;}
 if(!has)return;
 const heading=document.createElement('h3');heading.textContent=t('Afsætningsmål på stangen');if(container.id==='work-marks')container.append(heading);
 const info=document.createElement('p');info.className='hint';
 if(!bender){info.textContent=t('Vælg en bukker under Rørindstillinger for at få afsætningsmærker efter værktøjstabel.');container.append(info);return;}
 info.textContent=bender.model+' · Ø'+fmt(bender.tubeODmm)+' mm · R'+fmt(bender.radiusMm)+' mm';container.append(info);
 if(!report.supported){const error=document.createElement('p');error.className='mark-unavailable';error.textContent=t('Ingen afsætningstabel for denne opsætning.')+' '+(report.error||report.reason);container.append(error);return;}
 const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr'),body=document.createElement('tbody');table.className='mark-table';
 const spatial=hasSpatialPipe(project),rolls=spatial?spatialBendRotations(project):[];
 for(const [label,title]of [['Buk','Buk'],['Vinkel','Vinkel'],...(spatial?[['Drejning','Drejning omkring røret · °']]:[]),['Fradrag','Fradrag fra forrige buk'],['Fra sidste','Fra forrige mærke'],['Fra A','Mærke fra A']]){const th=document.createElement('th');th.textContent=t(label);th.setAttribute('aria-label',t(title));th.setAttribute('title',t(title));header.append(th);}head.append(header);table.append(head,body);
 const displayed=roundDisplayedMarks(report,{digits:bender.nativeUnits==='in'?3:1});
 if(!displayed.ok){const error=document.createElement('p');error.className='mark-unavailable';error.textContent=t('Afsætningsmålene kunne ikke afrundes sikkert.');container.append(error);return;}
 for(const mark of displayed.marks){const row=document.createElement('tr'),visual=bendVisual(mark.angle),values=[mark.id,(visual.standard?'':t('SPECIAL')+' · ')+fmtAngle(Math.abs(mark.angle))+'°',...(spatial?[rotationLabel(rolls[mark.index].rotation)]:[]),fmt(mark.gainApplied)+' mm',fmt(mark.displayedInterval)+' mm',fmt(mark.displayedPosition)+' mm'];values.forEach((value,index)=>{const cell=document.createElement('td');cell.textContent=value;if(index===0){cell.style.color=visual.text;cell.style.background=visual.fill;cell.style.borderLeft='4px '+(visual.dash?'dashed ':'solid ')+visual.stroke;}row.append(cell);});body.append(row);}
 const endRow=document.createElement('tr');for(const value of [t('Rørslut'),'—',...(spatial?['—']:[]),report.gains.length?fmt(report.gains.at(-1))+' mm':'—',fmt(displayed.displayedEndInterval)+' mm',fmt(displayed.displayedEndPosition)+' mm']){const cell=document.createElement('td');cell.textContent=value;endRow.append(cell);}body.append(endRow);
 const scroll=document.createElement('div');scroll.className='mark-table-wrap';scroll.append(table);container.append(scroll);
 const help=document.createElement('details'),helpSummary=document.createElement('summary'),helpBody=document.createElement('div'),toolRow=document.createElement('div');help.id=container.id==='live-marks'?'live-mark-help':'work-mark-help';help.className='mark-help inline-help';helpBody.className='help-panel';setIconButton(helpSummary,'info',t('Om afsætningsmål'));help.append(helpSummary,helpBody);toolRow.className='mark-heading';container.insertBefore(toolRow,info);toolRow.append(info);
 const explanation=document.createElement('p');explanation.className='hint';explanation.textContent=t('Fra forrige mærke viser målet fra sidste mærke; første mål er fra ende A. Mærke fra A viser det samlede mål. Værktøjets fradrag er allerede indregnet.');helpBody.append(explanation);
 const roundingNote=document.createElement('p');roundingNote.className='hint';roundingNote.textContent=t('Delmålene beregnes fra de afrundede mærker fra A, så de stemmer med kaplængden.');helpBody.append(roundingNote);
 if(displayed.precisionLimited){if(container.id==='live-marks')$('bender-marks').open=true;const warning=document.createElement('p');warning.className='mark-unavailable';warning.textContent=t('Et delmål er mindre end visningens præcision. Brug de samlede mærker fra A.');container.append(warning);}
 const totals=document.createElement('div');totals.className='mark-totals';for(const [label,value,full]of [['Kaplængde',report.endPosition,'Kaplængde efter værktøjstabel'],['Geometrisk længde',g.used,'Geometrisk centerlinjelængde']]){const stat=document.createElement('div'),title=document.createElement('span'),number=document.createElement('strong');title.textContent=t(label);title.setAttribute('title',t(full));number.textContent=fmt(value)+' mm';stat.append(title,number);totals.append(stat);}container.append(totals);
 const note=document.createElement('p');note.className='hint';note.textContent=t('Værktøjstabellens kaplængde og den ideelle centerlinjelængde er forskellige beregningsmetoder. Brug kaplængden sammen med den valgte bukkers afsætningsmetode.');helpBody.append(note);
 const source=document.createElement('a');source.href=bender.source.url+'#page=23';source.target='_blank';source.rel='noopener noreferrer';source.textContent=t('Producentens tabel og mærkereference')+' · MS-13-43, '+bender.source.revision;helpBody.append(source);container.append(help);
}

$('add-form').onsubmit=e=>{e.preventDefault();if(!state.configured){openPipeSettings('new');return;}if(!ready())return;if(state.lengths.length>=200){alert(t('Maks. 200 stykker pr. projekt.'));return;}const next=extendCurrent(params()),error=validateMeasurements(next)||validateSpatialState(next);if(error){$('error').textContent=t(error);return;}if(bendDirection!=='custom'&&!bendOrientation(next,end,bendDirection==='horizontal'?(sign>0?'left':'right'):bendDirection).available)bendDirection=bendOrientation(next,end,'forward').available?'forward':'horizontal';commit(next);};$('mirror').onclick=()=>{sign*=-1;bendDirection='horizontal';render();};for(const k of['length','angle','unit'])$(k).oninput=render;$('undo').onclick=()=>{if(history.length){state=history.pop();save();sync();render();}};$('reset').onclick=()=>openPipeSettings('new');

let py=NaN,off=NaN;function updateTools(){py=triangle($('solve').value,+$('p1').value,+$('p2').value);$('pyth-result').textContent=fmt(py)+' mm';$('use-pyth').disabled=!Number.isFinite(py)||py<=0;$('pyth-angle').textContent=Number.isFinite(py)?'':t('Hypotenusen skal være større end den kendte katete.');$('pyth-angle').hidden=Number.isFinite(py);drawTriangle();const displacement=Number($('offset').value),bendAngle=Number($('offset-angle').value),factor=Number($('offset-factor').value),offsetUnit=$('offset-unit').value;
 off=bendAngle>0&&bendAngle<=90?practicalOffsetLength(displacement,factor):NaN;
 const formatOffset=n=>Number.isFinite(n)?n.toLocaleString(locales[language],{maximumFractionDigits:3}):'—';
 $('offset-result').textContent=formatOffset(off)+' '+offsetUnit;
 $('offset-formula').textContent=Number.isFinite(off)?'':t('Kontrollér forskydning, vinkel og faktor.');$('offset-formula').hidden=Number.isFinite(off);
 renderOffsetVisualization($('offset-svg'),{offset:displacement,angle:bendAngle,length:off,factor,unit:offsetUnit,rotation:offsetRotation,mirror:offsetMirror},t,formatOffset);
 refreshActionIcons();}$('solve').onchange=()=>{const m=$('solve').value;$('p1-label').firstChild.textContent=(m==='a'?'b':'a')+' · mm';$('p2-label').firstChild.textContent=(m==='c'?'b':'c')+' · mm';updateTools();};for(const k of['p1','p2','offset','offset-factor'])$(k).oninput=updateTools;$('offset-angle').oninput=()=>{const a=Number($('offset-angle').value);if(a>0&&a<=90)$('offset-factor').value=a===45?'1.4':String(Number((1/Math.sin(a*Math.PI/180)).toFixed(3)));updateTools();};let currentOffsetUnit='cm';$('offset-unit').onchange=()=>{const next=$('offset-unit').value;if(next!==currentOffsetUnit){$('offset').value=String(Number($('offset').value)*(next==='mm'?10:.1));currentOffsetUnit=next;}updateTools();};function use(v){$('length').value=Math.round(v*1000)/1000;$('unit').value='1';render();$('length').scrollIntoView({behavior:'smooth',block:'center'});$('length').focus({preventScroll:true});}$('use-pyth').onclick=()=>use(py);
const MAX_PROJECT_FILE_BYTES=2*1024*1024;
$('export').onclick=()=>{
 try{
  const project={...state};delete project.wallDraft;
  const draft=roomPlanner.exportDraft();if(draft)project.wallDraft=draft;
  const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
  if(blob.size>MAX_PROJECT_FILE_BYTES)throw new RangeError('Project file too large');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
  a.download=(state.name.replace(/[^a-zA-Z0-9æøåÆØÅ_-]/g,'_')||'pipe-bend')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch{alert(t('Projektet kunne ikke gemmes som fil. Kontrollér vægudkastet, og prøv igen.'));}
};
$('import').onclick=()=>$('file').click();
$('file').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>MAX_PROJECT_FILE_BYTES)throw new RangeError('Project file too large');
  const document=JSON.parse(await file.text());
  if(!document||typeof document!=='object'||Array.isArray(document))throw new TypeError('Invalid project');
  const {wallDraft,...rawProject}=document;
  if(!valid(rawProject))throw new TypeError('Invalid project');
  const next=normalizeProject(rawProject);if(!valid(next))throw new TypeError('Invalid project');
  const draft=wallDraft===undefined||wallDraft===null?null:roomPlanner.validateDraft(wallDraft);
  if(draft?.error){const error=new TypeError('Invalid wall draft');error.wallDraft=true;throw error;}
  const shape=pipeGeometry(next);if(!Number.isFinite(shape.used)||!shape.points.every(point=>point.every(Number.isFinite)))throw new TypeError('Invalid project geometry');
  let hasDraft=false;try{hasDraft=!!roomPlanner.exportDraft();}catch{hasDraft=true;}
  if((state.lengths.length||hasDraft)&&!confirm(t('Erstat det åbne projekt med filen?')))return;
  const wasOpen=roomPlanner.isOpen();try{roomPlanner.setDraft(next,draft);}catch{const error=new Error('Project storage unavailable');error.importWrite=true;throw error;}
  commit(next,false,true);if(wasOpen)roomPlanner.open();
 }catch(error){alert(t(error?.wallDraft?'Vægudkastet i filen er ugyldigt. Det åbne projekt er bevaret.':error?.importWrite?'Projektet kunne ikke indlæses. Det åbne projekt er bevaret. Kontrollér browserens lagring, og prøv igen.':'Filen er ikke et gyldigt Pipe-bend-projekt.'));}
 finally{event.target.value='';}
};
$('print').onclick=()=>openPrintOptions();
let calc=NaN;function calcUpdate(){try{calc=calculate($('expression').value);$('calc-result').textContent=fmt(calc);}catch{calc=NaN;$('calc-result').textContent=$('expression').value?t('Kontrollér regnestykket'):'0';}$('use-calc').disabled=!Number.isFinite(calc)||calc<=0;}for(const k of['7','8','9','÷','4','5','6','×','1','2','3','−','0',',','⌫','+','(',')','C','=']){const b=document.createElement('button');b.textContent=k;b.onclick=()=>{const f=$('expression');if(k==='C')f.value='';else if(k==='⌫')f.value=f.value.slice(0,-1);else if(k!=='=')f.value+=k==='−'?'-':k;calcUpdate();};$('keys').append(b);}$('expression').oninput=calcUpdate;$('calculator-open').onclick=()=>{$('calculator').showModal();calcUpdate();};$('use-calc').onclick=()=>{if(Number.isFinite(calc)&&calc>0){$('calculator').close();use(calc);}};let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else $('install-help').showModal();};if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{$('error').textContent=t('Offlinefunktionen kræver HTTPS eller localhost.');});initBenderChoices();initAppSharing();captureTranslations();applyLanguage(language);$('language').value=language;sync();render();

function drawTriangle(){
 const svg=$('triangle-svg'),mode=$('solve').value,p=+$('p1').value,q=+$('p2').value;
 svg.replaceChildren();
 refreshActionIcons();if(!Number.isFinite(py)||py<=0){svg.setAttribute('hidden','');$('triangle-help').textContent=t('Indtast to gyldige sidelængder for at se trekanten.');$('triangle-help').hidden=false;return;}
 svg.removeAttribute('hidden');
 const sides=mode==='c'?{a:p,b:q,c:py}:mode==='a'?{a:py,b:p,c:q}:{a:p,b:py,c:q};
 const angle=triangleRotation*Math.PI/180;
 const rotate=([x,y])=>{x*=triangleMirror?-1:1;return[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];};
 const raw=[[0,0],[sides.a,0],[0,-sides.b]].map(rotate);
 const xs=raw.map(p=>p[0]),ys=raw.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 const scale=Math.min(240/Math.max(maxx-minx,1e-12),160/Math.max(maxy-miny,1e-12));
 const project=p=>[210+(p[0]-(minx+maxx)/2)*scale,120+(p[1]-(miny+maxy)/2)*scale];
 const [A,B,C]=raw.map(project),center=[(A[0]+B[0]+C[0])/3,(A[1]+B[1]+C[1])/3];
 function el(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;}
 el('polygon',{points:[A,B,C].map(p=>p.join(',')).join(' '),fill:'#eaf5ef'});
 for(const [key,start,finish]of[['a',A,B],['b',A,C],['c',C,B]]){
  el('line',{x1:start[0],y1:start[1],x2:finish[0],y2:finish[1],stroke:key===mode?'#16815d':'#76988b','stroke-width':key===mode?4:2,'stroke-linecap':'round'});
  const dx=finish[0]-start[0],dy=finish[1]-start[1],len=Math.hypot(dx,dy)||1,mx=(start[0]+finish[0])/2,my=(start[1]+finish[1])/2;
  let nx=-dy/len,ny=dx/len;if(nx*(mx-center[0])+ny*(my-center[1])<0){nx=-nx;ny=-ny;}
  el('text',{x:mx+nx*30,y:my+ny*30,'text-anchor':'middle','dominant-baseline':'middle',fill:key===mode?'#16815d':'#274b44','font-size':14,'font-weight':key===mode?700:500},key+' = '+fmt(sides[key]));
 }
 const r=Math.min(14/scale,sides.a/3,sides.b/3),mark=[[0,-r],[r,-r],[r,0]].map(rotate).map(project);
 el('polyline',{points:mark.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#76988b','stroke-width':1.5});
 $('triangle-mirror').setAttribute('aria-pressed',String(triangleMirror));
 svg.setAttribute('aria-label',t('Retvinklet trekant: a {a} mm, b {b} mm, c {c} mm. Beregnet side {side}.',{a:fmt(sides.a),b:fmt(sides.b),c:fmt(sides.c),side:mode}));
 $('triangle-help').textContent='';$('triangle-help').hidden=true;
}
$('pyth-visual').addEventListener('toggle',()=>{$('pyth-visual').querySelector('summary').textContent=$('pyth-visual').open?t('Skjul trekant'):t('Vis trekant');});

$('triangle-rotate').onclick=()=>{triangleRotation=(triangleRotation+90)%360;drawTriangle();};
$('triangle-mirror').onclick=()=>{triangleMirror=!triangleMirror;drawTriangle();};
$('triangle-reset').onclick=()=>{triangleRotation=0;triangleMirror=false;drawTriangle();};

$('language').onchange=()=>{applyLanguage($('language').value);render();if(document.body.classList.contains('work-mode'))renderWork();$('pyth-visual').querySelector('summary').textContent=t($('pyth-visual').open?'Skjul trekant':'Vis trekant');$('offset-visual').querySelector('summary').textContent=t($('offset-visual').open?'Skjul forskydning':'Vis forskydning');if($('calculator').open)calcUpdate();updateBenderFields();roomPlanner.refresh();};

function makeEditable(node,type,index){node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',t(type==='length'?'Rediger stykke {n}':'Rediger buk {n}',{n:index+1}));node.onclick=()=>openEdit(type,index);node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openEdit(type,index);}};}
function openEdit(type,index){editing={type,index};selectedPipeItem={type,index};const angle=type==='angle';$('edit-rotation-label').hidden=!angle;$('edit-rotation-help').hidden=!angle;$('edit-rotation').value=String(state.bendRotations?.[index]??0);$('edit-title').textContent=t(angle?'Rediger vinkel':'Rediger længde')+' · '+(index+1);$('edit-label').textContent=t(angle?'Bukkevinkel · grader':'Længde · mm');$('edit-direction-label').hidden=!angle;$('edit-value').value=angle?Math.abs(state.turns[index]):state.lengths[index];$('edit-value').min=angle?'0.1':'0.1';if(angle)$('edit-value').max='179';else $('edit-value').removeAttribute('max');$('edit-direction').value=String(Math.sign(state.turns[index]||1));$('edit-direction').querySelector('option[value="1"]').textContent=t(hasSpatialPipe(state)?'Positiv i bukkeplanet':'Venstre');$('edit-direction').querySelector('option[value="-1"]').textContent=t(hasSpatialPipe(state)?'Negativ i bukkeplanet':'Højre');$('edit-error').textContent='';if(hasSpatialPipe(state)||pipeView!=='plan')render();$('edit-dialog').showModal();$('edit-value').focus();$('edit-value').select();}
$('edit-cancel').onclick=()=>$('edit-dialog').close();
$('edit-form').onsubmit=e=>{e.preventDefault();if(!editing)return;const n=structuredClone(state),value=Number($('edit-value').value);if(editing.type==='length')n.lengths[editing.index]=value;else {n.turns[editing.index]=value*Number($('edit-direction').value);const rotation=Number($('edit-rotation').value);if(n.bendRotations||rotation){n.bendRotations=n.bendRotations??n.turns.map(()=>0);n.bendRotations[editing.index]=rotation;}}if(!valid(n)){$('edit-error').textContent=t(validateMeasurements(n)||validateSpatialState(n)||validateMaterialJoints(n,pipeGeometry(n))||'Indtast en gyldig længde eller vinkel.');return;}if(n.planner)n.planner={...n.planner,routeEdited:true};commit(n);$('edit-dialog').close();editing=null;};

const drawing=$('drawing');
function ensureWorkPieceUI(){
 let container=$('work-piece-pages');
 if(!container){container=document.createElement('section');container.id='work-piece-pages';container.className='work-piece-pages';container.dataset.printSection='pieces';document.querySelector('.work-data').before(container);}container.setAttribute('aria-label',t('Arbejdstegninger pr. fysisk rør'));
 const form=$('print-options-form'),cover=form.elements.namedItem('cover'),coverOption=cover?.closest('.print-option');
 if(coverOption)coverOption.querySelector('span').textContent=t('Samlet montageoversigt');
 if(!form.elements.namedItem('pieces')&&coverOption){const option=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');option.className='print-option';input.type='checkbox';input.name='pieces';input.checked=true;option.append(input,text);coverOption.after(option);}const piecesOption=form.elements.namedItem('pieces')?.closest('.print-option');if(piecesOption)piecesOption.querySelector('span').textContent=t('Arbejdstegninger pr. fysisk rør');
 return container;
}

function workEndpointLabels(piece){return[piece.allowanceStart>0?'K':piece.from,piece.allowanceEnd>0?'K':piece.to];}

function renderWorkPiecePages(plan,sourceGeometry,chosenView){
 const container=ensureWorkPieceUI();container.replaceChildren();if(!plan.ok||!plan.pieces.length)return;
 for(const piece of plan.pieces){
  const work=pieceWorkProject(state,sourceGeometry,piece),project=work.project??work,article=document.createElement('article'),heading=document.createElement('div'),title=document.createElement('div'),eyebrow=document.createElement('p'),pageTitle=document.createElement('h1'),count=document.createElement('strong'),meta=document.createElement('div'),heightNote=document.createElement('p'),bendSummary=document.createElement('div'),drawingWrap=document.createElement('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),division=document.createElement('p'),flatHeading=document.createElement('h2'),flatWrap=document.createElement('div'),flatSvg=document.createElementNS('http://www.w3.org/2000/svg','svg'),number=document.createElement('div');
  const spatial=hasSpatialPipe(project),rolls=spatial?spatialBendRotations(project):[],heightDatumLabel=t('Højde fra {piece}-start',{piece:piece.id}),heightNoteText=t('Højder måles lokalt fra {piece}-start.',{piece:piece.id});
  article.className='work-page work-piece-page';article.dataset.pieceId=piece.id;pageTitle.id='work-piece-title-'+piece.id;article.setAttribute('aria-labelledby',pageTitle.id);heading.className='work-piece-page-heading';eyebrow.textContent=state.name+' · '+t('Tegningsnummer')+' '+(state.drawingNumber||state.name);pageTitle.textContent=piece.id+' · '+piece.from+' → '+piece.to;count.textContent=piece.id+' '+t('af')+' '+plan.pieces.length;title.append(eyebrow,pageTitle);heading.append(title,count);
  meta.className='work-piece-page-meta';for(const[label,value]of[[t('Kaplængde'),fmt(piece.cutLength)+' mm'],[t('Tillæg start / slut'),fmt(piece.allowanceStart)+' / '+fmt(piece.allowanceEnd)+' mm'],[piece.fits?t('Rest'):t('For langt'),fmt(Math.abs(piece.remaining))+' mm']]){const item=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');small.textContent=label;strong.textContent=value;item.append(small,strong);meta.append(item);}
  heightNote.className='work-piece-height-note';heightNote.hidden=!spatial;heightNote.textContent=heightNoteText;
  bendSummary.className='work-piece-bend-summary';if(!piece.turns.length)bendSummary.textContent=t('Ingen buk på dette rør.');else piece.turns.forEach((turn,index)=>{const originalIndex=piece.originalBendIndices[index],id='B'+(originalIndex+1),item=document.createElement('span'),visual=bendVisual(turn),details=[id,...(visual.standard?[]:[t('SPECIAL')]),fmtAngle(Math.abs(turn))+'°'];if(spatial)details.push(t('Drejning')+' '+rotationLabel(rolls[index].rotation));else details.push(t(turn>0?'Venstre':'Højre'));item.dataset.pieceBend=id;item.dataset.bendCode=visual.key;item.style.color=visual.text;item.style.background=visual.fill;item.style.borderColor=visual.stroke;item.style.borderStyle=visual.dash?'dashed':'solid';item.textContent=details.join(' · ');bendSummary.append(item);});
  drawingWrap.className='work-piece-drawing-wrap';svg.classList.add('work-piece-drawing');svg.setAttribute('role','img');svg.setAttribute('aria-label',piece.id+' · '+piece.from+' → '+piece.to+(spatial?' · '+heightNoteText:''));drawingWrap.append(svg);
  const divisionNotes=[];if(piece.allowanceStart>0)divisionNotes.push(piece.from+' · '+t('DELING')+' '+fmt(piece.allowanceStart)+' mm '+t('fra fysisk kapende'));if(piece.allowanceEnd>0)divisionNotes.push(piece.to+' · '+t('DELING')+' '+fmt(piece.allowanceEnd)+' mm '+t('før fysisk kapende'));if(!divisionNotes.length)divisionNotes.push((piece.from.startsWith('S')||piece.to.startsWith('S'))?t('Delingen ligger ved den viste kapende.'):t('Dette rør har ingen deling.'));division.className='work-piece-division-note';division.textContent=(piece.allowanceStart||piece.allowanceEnd?'K · '+t('fysisk kapende')+' · ':'')+divisionNotes.join(' · ');
  flatHeading.textContent=t('Røret lagt fladt · mål fra fysisk kapende');flatWrap.className='work-piece-flat-wrap';flatSvg.classList.add('work-piece-flat');flatSvg.setAttribute('role','img');flatWrap.append(flatSvg);
  number.className='work-drawing-number';const numberLabel=document.createElement('span'),numberValue=document.createElement('strong');numberLabel.textContent=t('Tegningsnummer');numberValue.textContent=(state.drawingNumber||state.name)+' · '+piece.id;number.append(numberLabel,numberValue);
  article.append(heading,meta,heightNote,bendSummary,drawingWrap,division,flatHeading,flatWrap,number);container.append(article);
  const g=pipeGeometry(project),lineIds=work.lineIds??project.lineIds??[],bendIds=work.bendIds??project.bendIds??[];g.lines.forEach((line,index)=>line.displayId=lineIds[index]||'L'+(piece.lineStart+index+1));g.arcs.forEach((arc,index)=>arc.displayId=bendIds[index]||'B'+(piece.lineStart+index+1));
  const joints=(work.joints??project.joints??[]).map(joint=>({...joint,workLabel:joint.id+' · '+t('DELING')}));draw(g,null,svg,true,{project,joints,view:chosenView,pieceDrawing:true,width:900,height:720,showReferenceIds:true,endpointLabels:workEndpointLabels(piece),heightDatumLabel,spatialGeometry:hasSpatialPipe(project)?g:undefined});
  const displayed=displayedFlatPieceMeasurements(piece);if(displayed.ok){const flatLayout=drawFlatPiece(flatSvg,piece,displayed);if(!flatLayout.showChain){flatWrap.after(makeFlatDimensionGrid(piece,displayed,'work-piece-flat-dimensions'));if(displayed.displayedIntervals.length>64)article.classList.add('work-piece-page-flow');}}else{flatWrap.remove();flatHeading.remove();}
 }
}

function renderWork(){
 if(workViewProject!==state.projectId){workViewProject=state.projectId;workView='auto';workLayer='all';}
 $('work-view-select').value=workView;
 const g=pipeGeometry(state),marks=bendMarkLayout(state,getBender(state.benderId)),material=marks.supported?marks.endPosition:g.used,plan=currentMaterialPlan(g);
 const layers=spatialHeightLayers(geometry3D(state)),chosenView=workView==='auto'?(hasSpatialPipe(state)?'iso':'plan'):workView;
 const selectedLayer=workLayer==='all'?null:layers.find(layer=>Math.abs(layer.height-Number(workLayer))<=1e-6);
 workLayer=selectedLayer?String(selectedLayer.height):'all';
 const layerSelect=$('work-layer-select');layerSelect.replaceChildren();
 for(const layer of [null,...layers]){const option=document.createElement('option');option.value=layer===null?'all':String(layer.height);option.textContent=layer===null?t('Alle lag'):'H '+(layer.height>1e-6?'+':'')+fmt(Math.abs(layer.height)<1e-6?0:layer.height)+' mm';layerSelect.append(option);}
 layerSelect.value=workLayer;$('work-layer-control').hidden=chosenView!=='top'||layers.length<2;$('work-label-control').hidden=chosenView==='plan';$('work-label-mode').value=labelMode;

 const wallStatus=wallValidationStatus(state);for(const id of ['work-wall-status','work-wall-status-data']){const node=$(id);node.hidden=wallStatus.status==='none';node.setAttribute('data-wall-status',wallStatus.status);node.classList.toggle('needs-check',wallStatus.status==='needs-check');node.textContent=wallStatus.status==='none'?'':t(wallStatus.messageKey)+(wallStatus.detailKey?' · '+t(wallStatus.detailKey):'');}
 const spatial=hasSpatialPipe(state),rolls=spatial?spatialBendRotations(state):[];$('work-rotation-heading').hidden=!spatial;$('work-rotation-note').hidden=!spatial;$('work-rotation-note').textContent=t('Drejninger læses fra A mod B: positiv er med uret. Første buk måles fra 0°-referencen ved A; resten fra det foregående buk. Højder måles fra A.');
 $('work-mode-note').textContent=t('Samlet montageoversigt')+' · '+t(measurementMode(state)==='vertex'?'Færdigmål til centerlinjehjørner':'Lige længder mellem tangentpunkter')+' · R'+fmt(state.radius)+' mm';
 $('work-blank-title').textContent=t('Fysiske rør lagt fladt · mål fra rørstart');
 $('work-blank-note').textContent=t(plan.pieces.every(piece=>piece.report.supported)?'Mærker og delmål følger den valgte værktøjstabel. Hvert rør måles fra sin egen start.':'Der mangler en værktøjstabel for mindst ét rør. De viste mærker er geometriske referencepunkter.');
 $('work-name').textContent=state.name;$('work-number').textContent=state.drawingNumber||state.name;
 document.querySelector('.work-data-number').textContent=t('Tegningsnummer')+' · '+(state.drawingNumber||state.name);
 $('work-empty').textContent=g.lines.length?'':t('Opret først et rør i redigeringen.');$('work-specs').replaceChildren();
 const specs=[['Udvendig diameter',state.diameter],['Godstykkelse',state.wall],['Bukkeradius',state.radius],['Geometrisk centerlinjelængde',g.used],[plan.ok&&plan.allFit&&plan.pieces.length>1?'Samlet rest':'Rest af helt rør',plan.ok&&plan.allFit&&plan.pieces.length>1?plan.totalWaste:state.stock-material]];
 if(marks.supported)specs.splice(3,0,['Kaplængde efter værktøjstabel',marks.endPosition]);
 for(const[key,value]of specs){const box=document.createElement('div'),label=document.createElement('span'),strong=document.createElement('strong');label.textContent=t(key);strong.textContent=fmt(value)+' mm';box.append(label,strong);$('work-specs').append(box);}
 renderWorkMaterial(plan);renderWorkMarks(plan,g);draw(g,null,$('work-drawing'),true);renderWorkPiecePages(plan,g,chosenView);renderReferences(g,$('work-references'),true);$('work-rows').replaceChildren();
 g.arcs.forEach((a,i)=>{const length=state.radius*Math.abs(a.turn)*Math.PI/180,row=document.createElement('tr'),visual=bendVisual(a.turn),values=['B'+(i+1),(visual.standard?'':t('SPECIAL')+' · ')+fmtAngle(Math.abs(a.turn))+'°',bendLabel(a),...(spatial?[rotationLabel(rolls[i].rotation)]:[]),fmt(a.position),fmt(a.position+length/2),fmt(a.position+length),fmt(length)];values.forEach((value,index)=>{const cell=document.createElement('td');cell.textContent=value;if(index===0){cell.style.color=visual.text;cell.style.background=visual.fill;cell.style.borderLeft='4px '+(visual.dash?'dashed ':'solid ')+visual.stroke;}row.append(cell);});$('work-rows').append(row);});
 if(!g.arcs.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=spatial?8:7;cell.textContent=t('Ingen buk endnu. Tilføj et buk i redigeringen.');row.append(cell);$('work-rows').append(row);}
 renderFlatPieces(plan);$('work-svg').disabled=!g.lines.length;
}

function drawFlatPiece(svg,piece,displayed){
 const ns='http://www.w3.org/2000/svg',entries=displayed.marks.map(mark=>{const labelText=mark.kind==='joint'?mark.id+' · '+t('DELING'):bendAccessibleLabel(mark.id,mark.angle,{format:fmtAngle,special:t('SPECIAL')});return{...mark,labelText,labelWidth:Math.max(34,labelText.length*7.4+12),valueText:fmt(mark.displayedPosition)+' mm'};}),layout=layoutBlankMarks(entries,{totalLength:piece.cutLength,width:900,margin:58,fontSize:14});
 const rawPositions=[0,...displayed.marks.map(mark=>mark.position),piece.cutLength],minimumGap=Math.min(...rawPositions.slice(1).map((position,index)=>(position-rawPositions[index])*layout.tube.width/piece.cutLength));
 const showChain=layout.mode==='labels'&&displayed.displayedIntervals.length<=10&&minimumGap>=58,chainY=layout.height+20,overallY=chainY+(showChain?54:12),height=overallY+30;
 svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${layout.width} ${height}`);svg.setAttribute('font-family','var(--app-font, sans-serif)');
	const el=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;svg.append(node);return node;},tube=layout.tube,scale=tube.width/piece.cutLength,startLabel=piece.allowanceStart>0?t('Rørstart'):piece.from,endLabel=piece.allowanceEnd>0?t('Rørslut'):piece.to,startDivision=piece.allowanceStart<=0&&piece.from.startsWith('S'),endDivision=piece.allowanceEnd<=0&&piece.to.startsWith('S'),displayEndpoint=label=>label.startsWith('S')?label+' · '+t('DELING'):label;
 el('rect',{x:tube.x,y:tube.y,width:tube.width,height:tube.height,rx:5,fill:'#e3ebe8',stroke:'#617e73','stroke-width':1.5});
 for(const [length,side]of [[piece.allowanceStart,'start'],[piece.allowanceEnd,'end']])if(length>0){const width=length*scale,x=side==='start'?tube.x:tube.x+tube.width-width;el('rect',{x,y:tube.y,width,height:tube.height,rx:3,fill:'#f4b56f',opacity:.8});if(width>=54)el('text',{x:x+width/2,y:tube.y+tube.height/2+4,'text-anchor':'middle','font-size':11,'font-weight':600,fill:'#6d3b12'},'+'+fmt(length));}
	for(const [active,x,inside,id]of [[startDivision,tube.x,1,piece.from],[endDivision,tube.x+tube.width,-1,piece.to]])if(active){for(const offset of [0,6]){const markX=x+inside*offset;el('line',{x1:markX,y1:tube.y-8,x2:markX,y2:tube.y+tube.height+8,stroke:'#fff','stroke-width':7,'stroke-linecap':'round'});el('line',{'data-endpoint-joint':id,'data-division-symbol':'cut-band',x1:markX,y1:tube.y-8,x2:markX,y2:tube.y+tube.height+8,stroke:'#A73622','stroke-width':3,'stroke-linecap':'round'});}}
	el('text',{x:tube.x,y:18,'font-size':14,'font-weight':600,fill:startDivision?'#702315':'#183037'},displayEndpoint(startLabel)+' · 0 mm');
	el('text',{x:tube.x+tube.width,y:18,'text-anchor':'end','font-size':14,'font-weight':600,fill:endDivision?'#702315':'#183037'},displayEndpoint(endLabel)+' · '+fmt(displayed.displayedEndPosition)+' mm');
 for(const tick of layout.ticks){const joint=tick.kind==='joint',visual=joint?null:bendVisual(tick.angle),color=joint?'#A73622':visual.stroke;if(joint){for(const offset of [-3,3]){el('line',{x1:tick.x+offset,y1:tick.y1,x2:tick.x+offset,y2:tick.y2,stroke:'#fff','stroke-width':6});el('line',{'data-mark':tick.id,'data-division-symbol':'cut-band',x1:tick.x+offset,y1:tick.y1,x2:tick.x+offset,y2:tick.y2,stroke:color,'stroke-width':2.5});}}else{const line=el('line',{'data-mark':tick.id,'data-bend-color':visual.key,x1:tick.x,y1:tick.y1,x2:tick.x,y2:tick.y2,stroke:color,'stroke-width':2,...(visual.dash?{'stroke-dasharray':visual.dash}:{})});const title=document.createElementNS(ns,'title');title.textContent=bendAccessibleLabel(tick.id,tick.angle,{format:fmtAngle,special:t('SPECIAL')})+' · '+tick.valueText;line.append(title);}}
 for(const label of layout.labels){const joint=label.kind==='joint',visual=joint?null:bendVisual(label.angle),color=joint?'#702315':visual.text,fill=joint?'#FFF0EB':visual.fill,stroke=joint?'#A73622':visual.stroke,[a,b]=label.leader;el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke,'stroke-width':1.2,'stroke-dasharray':joint?'4 3':'none'});el('rect',{x:label.box.x,y:label.box.y,width:label.box.width,height:label.box.height,rx:4,fill,stroke,'stroke-width':joint||visual.dash?1.3:.8,...(!joint&&visual.dash?{'stroke-dasharray':visual.dash}:{})});const text=el('text',{'data-mark-label':label.id,x:label.x,y:label.y+4.5,'font-size':layout.fontSize,'font-weight':700,'text-anchor':'middle',fill:color},label.labelText||label.id),title=document.createElementNS(ns,'title');title.textContent=(label.labelText||label.id)+' · '+label.valueText;text.append(title);}
 const dimension=(x1,x2,y,label,overall=false)=>{const color=overall?'#176748':'#526d64';el('line',{x1,y1:y,x2,y2:y,stroke:color,'stroke-width':overall?1.6:1});for(const[x,direction]of [[x1,1],[x2,-1]])el('path',{d:`M ${x+direction*7} ${y-4} L ${x} ${y} L ${x+direction*7} ${y+4}`,fill:'none',stroke:color,'stroke-width':overall?1.6:1});el('text',{x:(x1+x2)/2,y:y-5,'text-anchor':'middle','font-size':overall?13:12,'font-weight':overall?700:600,fill:color,'paint-order':'stroke',stroke:'#fff','stroke-width':4},label);};
 if(showChain)for(let index=0;index<displayed.displayedIntervals.length;index++){const x1=tube.x+rawPositions[index]*scale,x2=tube.x+rawPositions[index+1]*scale,y=chainY+(index%2)*22;el('line',{x1,y1:tube.y+tube.height+4,x2:x1,y2:y+4,stroke:'#9ab0a7','stroke-width':.7});el('line',{x1:x2,y1:tube.y+tube.height+4,x2,y2:y+4,stroke:'#9ab0a7','stroke-width':.7});dimension(x1,x2,y,fmt(displayed.displayedIntervals[index])+' mm');}
 el('line',{x1:tube.x,y1:tube.y+tube.height+4,x2:tube.x,y2:overallY+4,stroke:'#719187','stroke-width':.8});el('line',{x1:tube.x+tube.width,y1:tube.y+tube.height+4,x2:tube.x+tube.width,y2:overallY+4,stroke:'#719187','stroke-width':.8});dimension(tube.x,tube.x+tube.width,overallY,t('Kaplængde')+' '+fmt(displayed.displayedEndPosition)+' mm',true);
 svg.setAttribute('aria-label',t('{piece} lagt fladt fra {from} til {to}, kaplængde {length} mm.',{piece:piece.id,from:piece.from,to:piece.to,length:fmt(displayed.displayedEndPosition)}));
 return{mode:layout.mode,showChain};
}

function makeFlatDimensionGrid(piece,displayed,className='flat-dimension-grid'){
	const endpoint=label=>label.startsWith('S')?label+' · '+t('DELING'):label,startLabel=endpoint(piece.allowanceStart>0?t('Rørstart'):piece.from),endLabel=endpoint(piece.allowanceEnd>0?t('Rørslut'):piece.to),grid=document.createElement('div'),ids=[startLabel,...displayed.marks.map(mark=>mark.id),endLabel];grid.className=className;grid.setAttribute('aria-label',t('Delmål fra rørstart'));
 displayed.displayedIntervals.forEach((interval,index)=>{const item=document.createElement('div'),label=document.createElement('strong'),value=document.createElement('span');label.textContent=ids[index]+' → '+ids[index+1];value.textContent=fmt(interval)+' mm';item.append(label,value);grid.append(item);});return grid;
}

function renderFlatPieces(plan){
 const section=$('work-flat'),container=$('work-flat-pieces');container.replaceChildren();const pieces=plan.ok?plan.pieces:[];section.hidden=!pieces.length;if(!pieces.length)return;
 for(const piece of pieces){
  const displayed=displayedFlatPieceMeasurements(piece),card=document.createElement('article'),heading=document.createElement('h3'),meta=document.createElement('p');card.className='flat-piece';card.classList.toggle('flat-piece-dense',displayed.ok&&displayed.displayedIntervals.length>12);heading.textContent=piece.id+' · '+piece.from+' → '+piece.to;meta.className='flat-piece-meta';meta.textContent=t('Kaplængde')+' '+fmt(piece.cutLength)+' mm'+((piece.allowanceStart||piece.allowanceEnd)?' · '+t('Tillæg')+' '+fmt(piece.allowanceStart)+' / '+fmt(piece.allowanceEnd)+' mm':'');card.append(heading,meta);
  if(!displayed.ok){const error=document.createElement('p');error.className='mark-unavailable';error.textContent=t('Afsætningsmålene kunne ikke afrundes sikkert.');card.append(error);container.append(card);continue;}
  const overview=document.createElement('div'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');overview.className='flat-piece-overview';svg.setAttribute('role','img');overview.append(svg);card.append(overview);const layoutMode=drawFlatPiece(svg,piece,displayed).mode;
  card.append(makeFlatDimensionGrid(piece,displayed));
  if(layoutMode==='table'){const hint=document.createElement('p');hint.className='hint';hint.textContent=t('Mærkerne ligger tæt. Brug delmålene nedenfor.');card.append(hint);}
  if(displayed.precisionLimited){const warning=document.createElement('p');warning.className='mark-unavailable';warning.textContent=t('Et delmål er mindre end visningens præcision. Brug de samlede mærker fra rørets start.');card.append(warning);}
  container.append(card);
 }
}
function openWork(){renderWork();document.body.classList.add('work-mode');$('work-sheet').hidden=false;window.scrollTo(0,0);$('work-close').focus({preventScroll:true});}
const PRINT_OPTION_KEY='pipe-bend-print-options-v2',PRINT_SECTIONS=['cover','pieces','specs','material','marks','references','flat','bends'],DATA_PRINT_SECTIONS=['specs','material','marks','references','flat','bends'],DEFAULT_PRINT_OPTIONS={...Object.fromEntries(PRINT_SECTIONS.map(key=>[key,true])),flat:false};
let activePrintOptions={...DEFAULT_PRINT_OPTIONS},pendingPrintOptions=null,printHelpStates=[];
function loadPrintOptions(){
 try{const saved=JSON.parse(localStorage.getItem(PRINT_OPTION_KEY));if(saved&&PRINT_SECTIONS.every(key=>typeof saved[key]==='boolean')&&PRINT_SECTIONS.some(key=>saved[key]))return Object.fromEntries(PRINT_SECTIONS.map(key=>[key,saved[key]]));}catch{}
 return {...DEFAULT_PRINT_OPTIONS};
}
function savePrintOptions(options){try{localStorage.setItem(PRINT_OPTION_KEY,JSON.stringify(options));}catch{}}
function readPrintOptions(){const form=$('print-options-form');return Object.fromEntries(PRINT_SECTIONS.map(key=>[key,form.elements.namedItem(key).checked]));}
function syncPrintOptions(options){const form=$('print-options-form');for(const key of PRINT_SECTIONS){const input=form.elements.namedItem(key);input.checked=options[key];input.disabled=!printSectionAvailable(key);}}
function printSectionAvailable(key){if(key==='cover'||key==='specs')return true;if(key==='pieces')return $('work-piece-pages')?.childElementCount>0;if(key==='material'||key==='marks')return $(key==='material'?'work-material':'work-marks').childElementCount>0;if(key==='references')return !$('work-references').hidden&&$('work-references').childElementCount>0;if(key==='flat')return !$('work-flat').hidden&&$('work-flat-pieces').childElementCount>0;if(key==='bends')return state.turns.length>0;return false;}
function availablePrintOptions(options){const resolved=Object.fromEntries(PRINT_SECTIONS.map(key=>[key,!!options?.[key]]));if(!PRINT_SECTIONS.some(key=>resolved[key]&&printSectionAvailable(key)))resolved.cover=true;return resolved;}
function applyPrintOptions(options){
 const resolved=availablePrintOptions(options);for(const node of document.querySelectorAll('[data-print-section]')){const key=node.dataset.printSection;node.dataset.printSelected=String(resolved[key]&&printSectionAvailable(key));}
 const hasData=DATA_PRINT_SECTIONS.some(key=>resolved[key]&&printSectionAvailable(key)),hasCover=resolved.cover&&printSectionAvailable('cover'),hasPieces=resolved.pieces&&printSectionAvailable('pieces');document.querySelector('.work-data').dataset.printEmpty=String(!hasData);document.body.classList.toggle('print-without-cover',!hasCover&&hasPieces);document.body.classList.toggle('print-without-drawings',!hasCover&&!hasPieces&&hasData);return resolved;
}
function openPrintOptions(){if(!document.body.classList.contains('work-mode'))renderWork();activePrintOptions=availablePrintOptions(loadPrintOptions());syncPrintOptions(activePrintOptions);$('print-options-error').textContent='';$('print-options-dialog').showModal();}
function changeLabelMode(value){labelMode=value==='tap'?'tap':'all';selectedPipeItem=null;render();if(document.body.classList.contains('work-mode'))renderWork();}
$('drawing-label-mode').onchange=()=>changeLabelMode($('drawing-label-mode').value);
$('work-label-mode').onchange=()=>changeLabelMode($('work-label-mode').value);
$('work-view-select').onchange=()=>{workView=$('work-view-select').value;renderWork();};
$('work-layer-select').onchange=()=>{workLayer=$('work-layer-select').value;renderWork();};
$('work-open').onclick=openWork;$('work-close').onclick=()=>{document.body.classList.remove('work-mode');$('work-sheet').hidden=true;render();$('work-open').scrollIntoView({block:'center'});$('work-open').focus({preventScroll:true});};$('work-print').onclick=openPrintOptions;
$('print-options-cancel').onclick=()=>$('print-options-dialog').close();
$('print-options-form').onsubmit=event=>{event.preventDefault();const options=readPrintOptions();if(!PRINT_SECTIONS.some(key=>options[key]&&printSectionAvailable(key))){$('print-options-error').textContent=t('Vælg mindst én del til udskriften.');return;}activePrintOptions=applyPrintOptions(options);pendingPrintOptions=activePrintOptions;savePrintOptions(activePrintOptions);$('print-options-dialog').close();requestAnimationFrame(()=>window.print());};
window.addEventListener('beforeprint',()=>{const previous=new Map([...$('work-marks').querySelectorAll('details.mark-help')].map(help=>[help.id,help.open]));renderWork();activePrintOptions=applyPrintOptions(pendingPrintOptions??loadPrintOptions());document.body.classList.add('printing-work');$('work-sheet').hidden=false;printHelpStates=[...$('work-marks').querySelectorAll('details.mark-help')].map(help=>[help,previous.get(help.id)??help.open]);if(activePrintOptions.marks)for(const[help]of printHelpStates)help.open=true;});
window.addEventListener('afterprint',()=>{for(const[help,open]of printHelpStates)if(help.isConnected)help.open=open;pendingPrintOptions=null;printHelpStates=[];document.body.classList.remove('printing-work','print-without-cover','print-without-drawings');if(!document.body.classList.contains('work-mode'))$('work-sheet').hidden=true;});
$('work-svg').onclick=()=>{
 renderWork();
 const wallStatus=wallValidationStatus(state),svg=$('work-drawing').cloneNode(true),ns='http://www.w3.org/2000/svg';svg.setAttribute('xmlns',ns);svg.setAttribute('width','1200');
 for(const node of svg.querySelectorAll('[data-spatial-selectable]'))for(const attr of ['role','tabindex','aria-pressed','data-spatial-selectable'])node.removeAttribute(attr);
 const[vx,vy,vw,vh]=svg.getAttribute('viewBox').split(' ').map(Number),top=wallStatus.status==='none'?50:wallStatus.detailKey?104:84;
 svg.setAttribute('height',String((vh+top+10)*1200/vw));svg.setAttribute('viewBox',`${vx} ${vy-top} ${vw} ${vh+top+10}`);
 if(wallStatus.status!=='none'){
  const group=document.createElementNS(ns,'g'),warning=wallStatus.status==='needs-check',y=vy-top+12;group.setAttribute('data-wall-status',wallStatus.status);group.setAttribute('font-family','sans-serif');
  const box=document.createElementNS(ns,'rect');for(const[key,value]of Object.entries({x:vx+24,y,width:vw-48,height:wallStatus.detailKey?48:28,rx:4,fill:warning?'#fff4df':'#edf7f1',stroke:warning?'#9b4e19':'#477b64','stroke-width':1}))box.setAttribute(key,String(value));group.append(box);
  const line=(key,baseline,size,bold=false)=>{const node=document.createElementNS(ns,'text');for(const[name,value]of Object.entries({x:vx+34,y:baseline,'font-size':size,fill:warning?'#783d18':'#245840','font-weight':bold?600:400}))node.setAttribute(name,String(value));node.textContent=t(key);group.append(node);};
  line(wallStatus.messageKey,y+19,15,true);if(wallStatus.detailKey)line(wallStatus.detailKey,y+37,13);svg.append(group);
 }
 const title=document.createElementNS(ns,'text');title.setAttribute('x',String(vx+30));title.setAttribute('y',String(vy-20));title.setAttribute('font-size','22');title.textContent=t('Tegningsnummer')+' · '+(state.drawingNumber||state.name);svg.append(title);
 const style=document.createElementNS(ns,'style');style.textContent='.measure{font:14px sans-serif;fill:#274b44;paint-order:stroke;stroke:white;stroke-width:5px}.angle-label{font:bold 14px sans-serif;fill:#16815d;paint-order:stroke;stroke:white;stroke-width:5px}.joint-marker text{font:bold 14px sans-serif;fill:#7a3f0a}.joint-marker circle{fill:#fff4e8;stroke:#ae5c15;stroke-width:1.5}.joint-marker path{fill:none;stroke:#ae5c15;stroke-width:2}';svg.prepend(style);
 const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='pipe-bend-drawing.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

initTypography(()=>{render();if(document.body.classList.contains("work-mode"))renderWork();});

$('offset-visual').addEventListener('toggle',()=>{$('offset-visual').querySelector('summary').textContent=t($('offset-visual').open?'Skjul forskydning':'Vis forskydning');});
$('offset-rotate').onclick=()=>{offsetRotation=(offsetRotation+90)%360;updateTools();};
$('offset-mirror').onclick=()=>{offsetMirror=!offsetMirror;updateTools();};
$('offset-reset').onclick=()=>{offsetRotation=0;offsetMirror=false;updateTools();};

function openCalculationInfo(topic){
 const offset=topic==='offset';$('pyth-help-content').hidden=offset;$('offset-help-content').hidden=!offset;$('calculation-help-title').textContent=t(offset?'Om forskydning':'Om Pythagoras');
 if(offset){const angle=Number($('offset-angle').value),factor=Number($('offset-factor').value),format=n=>Number.isFinite(n)?n.toLocaleString(locales[language],{maximumFractionDigits:4}):'—';
  $('offset-info-factor').textContent=angle>0&&angle<=90?t('Ved {angle}° er den geometriske faktor ca. {exact}. Din valgte faktor er {chosen}.',{angle:format(angle),exact:format(1/Math.sin(angle*Math.PI/180)),chosen:format(factor)}):t('Kontrollér forskydning, vinkel og faktor.');
  $('offset-info-example').textContent=$('offset-formula').textContent;
 }
 $('calculation-help').showModal();
}
$('pyth-info').onclick=()=>openCalculationInfo('pyth');
$('offset-info').onclick=()=>openCalculationInfo('offset');

const appMenu=$('app-menu'),menuTrigger=appMenu.querySelector('summary');
appMenu.querySelector('.menu-panel').addEventListener('click',event=>{if(event.target.closest('button'))appMenu.open=false;});
$('language').addEventListener('change',()=>{appMenu.open=false;menuTrigger.focus();});
document.addEventListener('pointerdown',event=>{if(appMenu.open&&!appMenu.contains(event.target))appMenu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&appMenu.open){event.preventDefault();appMenu.open=false;menuTrigger.focus();}});
for(const id of ['font-dialog','install-help'])$(id).addEventListener('close',()=>menuTrigger.focus());

function openPipeSettings(mode){
 pipeSettingsMode=mode==='edit'&&state.configured?'edit':'new';sync();
 if(pipeSettingsMode==='new'){$('name').value=t('Nyt rør');$('drawing-number').value=newDrawingNumber();$('bender-select').value='swagelok-ms-htb-12m';$('measurement-mode').value='vertex';$('diameter').value=12;$('radius').value=38;$('wall').value=1.5;updateBenderFields();}
 $('pipe-settings-title').textContent=t(pipeSettingsMode==='new'?'Nyt rør':'Rørindstillinger');
 $('pipe-settings-save').textContent=t(pipeSettingsMode==='new'?'Opret rør':'Gem ændringer');
 $('pipe-settings-error').textContent='';$('pipe-settings').showModal();$('name').focus();$('name').select();
}
$('pipe-settings-open').onclick=()=>openPipeSettings('edit');
$('pipe-settings-cancel').onclick=()=>$('pipe-settings').close();
$('pipe-settings').addEventListener('close',()=>{sync();if(!appMenu.open)menuTrigger.focus();});
$('pipe-settings-form').addEventListener('input',()=>{$('pipe-settings-error').textContent='';});
$('pipe-settings-form').onsubmit=event=>{
 event.preventDefault();let next={...state,configured:true};
 for(const key of ['name','stock','diameter','wall','radius'])next[key]=key==='name'?$(key).value.trim():Number($(key).value);
 next.jointClearance=Number($('joint-clearance').value);
 next.drawingNumber=$('drawing-number').value.trim();next.benderId=$('bender-select').value||null;
 const nextMode=$('measurement-mode').value;
 if(pipeSettingsMode==='new'){next.projectId=crypto.randomUUID();next.lengths=[];next.turns=[];next.joints=[];next.heading=0;next.measurementMode=nextMode;delete next.planner;delete next.placement;delete next.bendRotations;delete next.startFrame;}else{try{if(nextMode!==measurementMode(state))next=convertMeasurementMode(next,nextMode);}catch(error){$('pipe-settings-error').textContent=error.message;return;}}
 if(!next.name||!valid(next)){const error=validateMeasurements(next)||validateMaterialJoints(next,pipeGeometry(next))||'Angiv et projektnavn og gyldige rørdimensioner. Godstykkelsen skal være under halvdelen af diameteren, og centerlinjeradius skal være større end halvdelen af diameteren.';$('pipe-settings-error').textContent=t(error);return;}
 const reopenWall=pipeSettingsMode==='new'&&roomPlanner.isOpen();
 if(pipeSettingsMode==='new'){try{roomPlanner.setDraft(next,null);}catch{$('pipe-settings-error').textContent=t('Projektet kunne ikke oprettes. Det aktuelle projekt er bevaret.');return;}}
 if(pipeSettingsMode==='new'){end='B';sign=1;bendDirection='horizontal';pipeView='plan';selectedPipeItem=null;$('bend-rotation').value='0';$('angle').value='90';$('length').value=$('length').getAttribute('value')||'35';$('unit').value='10';mainPipeDrawing.reset();spatialPipeDrawing.reset();}
 commit(next);if(reopenWall)roomPlanner.open();$('pipe-settings').close();$('length').scrollIntoView({block:'center',behavior:'smooth'});$('length').focus({preventScroll:true});
};
const roomPlanner=initRoomPlanner({getProject:()=>state,language:()=>language,t,onApply:route=>{
 if(hasSpatialPipe(state))throw new RangeError(t('Vægkontrollen gælder kun 2D. Rørets højdeskift er ikke kontrolleret mod vægge og forhindringer.'));
 const next={...structuredClone(state),configured:true,measurementMode:'vertex',lengths:route.lengths,turns:route.turns,heading:route.heading,placement:{start:route.start},planner:route.planner};
 next.joints=[];
 delete next.bendRotations;delete next.startFrame;
 if(!valid(next))throw new RangeError(validateMeasurements(next)||t('Rørforslaget har ugyldige mål.'));
 end='B';sign=1;bendDirection='horizontal';pipeView='plan';mainPipeDrawing.reset();spatialPipeDrawing.reset();commit(next,true);
 $('drawing').scrollIntoView({block:'center',behavior:'smooth'});
}});
// A file opened by an older app may have retained its portable draft in the
// main JSON. Migrate it without replacing an already newer per-project copy.
if(bootEmbeddedDraft){try{
 const draft=roomPlanner.validateDraft(bootEmbeddedDraft);
 if(draft?.error)throw new TypeError('Invalid embedded wall draft');
 if(!roomPlanner.exportDraft())roomPlanner.setDraft(state,draft);
 delete state.wallDraft;save();
}catch{}}
for(const id of ['room-open','room-open-menu'])$(id).onclick=()=>roomPlanner.open();
const drawingContainer=$('drawing').parentElement;
let drawingObservedWidth=drawingContainer.clientWidth;
if(typeof ResizeObserver==='function')new ResizeObserver(()=>{
 const width=drawingContainer.clientWidth;
 if(width>0&&Math.abs(width-drawingObservedWidth)>1){drawingObservedWidth=width;requestAnimationFrame(()=>render());}
}).observe(drawingContainer);
if(!state.configured)openPipeSettings('new');
