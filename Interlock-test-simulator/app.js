import { signalRanges, calculateFromField, generateSequence, isTripped, overallStatus } from './core.js';
import { setLocale, getLocale, t, translateDom } from './i18n.js';

const STORAGE_KEY = 'interlock-test-simulator-v1';
const defaultInstrument = {tag:'PT-101',description:'Tryktransmitter',location:'Proceslinje 1',signalType:'4-20mA',processMin:0,processMax:10,unit:'bar',rawMin:0,rawMax:27648,normalMin:2,normalMax:8,comment:''};
const defaultInterlock = {tag:'PSHH-101',level:'HH',direction:'rising',tripValue:9,resetValue:8.5,delaySeconds:2,resetMode:'manual',expectedAlarm:'Højt tryk — HH alarm',expectedActions:'Stop P-101, luk XV-101, blokér genstart',testDelta:1};

function initialState(){
  const base={instrument:{...defaultInstrument},interlock:{...defaultInterlock},points:[],safetyConfirmed:false,simulatorValue:9,locale:'da',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  base.points=generateSequence(base.instrument,base.interlock,1); base.instrumentSnapshot={...base.instrument}; base.interlockSnapshot={...base.interlock}; return base;
}
function load(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));return parsed?.instrument&&parsed?.interlock?{...initialState(),...parsed}:initialState()}catch{return initialState()}}
let state=load(); let updating=false; let toastTimer; let deferredInstall;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:0};
const fmt=(value,digits=2)=>Number(value).toLocaleString('da-DK',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const formatDate=value=>value?new Intl.DateTimeFormat(getLocale()==='en'?'en-GB':getLocale()==='no'?'nb-NO':'da-DK',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—';
const translateExpected=text=>t(text).replace('trip forventet',t('trip forventet')).replace('aktiv — handlinger udført',t('aktiv — handlinger udført')).replace('fortsat aktiv',t('fortsat aktiv'));

function save(){state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('saveState').textContent=t('Gemt lokalt');}
function showToast(message){$('toast').textContent=t(message);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400)}
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===id));if(id==='report')renderReport();window.scrollTo({top:0,behavior:'smooth'})}

const instrumentFields=['tag','description','location','signalType','processMin','processMax','unit','rawMin','rawMax','normalMin','normalMax'];
const interlockFields=['interlockTag','level','direction','tripValue','resetValue','delaySeconds','resetMode','expectedAlarm','expectedActions','testDelta'];
const numericFields=new Set(['processMin','processMax','rawMin','rawMax','normalMin','normalMax','tripValue','resetValue','delaySeconds','testDelta']);

function populateForms(){
  instrumentFields.forEach(id=>{const key=id;$(id).value=state.instrument[key]??''});$('instrumentComment').value=state.instrument.comment||'';
  interlockFields.forEach(id=>{const key=id==='interlockTag'?'tag':id;$(id).value=state.interlock[key]??''});$('safetyCheck').checked=!!state.safetyConfirmed;
}

function validateProfile(){
  const valid=state.instrument.tag&&state.instrument.processMax!==state.instrument.processMin&&state.interlock.tag;
  $('profileStatus').textContent=t(valid?'Profil klar':'Kontrollér profil'); return valid;
}

function bindForms(){
  instrumentFields.forEach(id=>$(id).addEventListener('input',()=>{if(updating)return;state.instrument[id]=numericFields.has(id)?n($(id).value):$(id).value;validateProfile();save();renderSimulator()}));
  $('instrumentComment').addEventListener('input',()=>{state.instrument.comment=$('instrumentComment').value;save()});
  interlockFields.forEach(id=>$(id).addEventListener('input',()=>{const key=id==='interlockTag'?'tag':id;state.interlock[key]=numericFields.has(id)?n($(id).value):$(id).value;validateProfile();save();renderSimulator()}));
  $('generateBtn').addEventListener('click',()=>{if(!validateProfile())return showToast('Udfyld instrument- og interlockdata først');state.points=generateSequence(state.instrument,state.interlock,state.interlock.testDelta);state.instrumentSnapshot={...state.instrument};state.interlockSnapshot={...state.interlock};state.safetyConfirmed=false;$('safetyCheck').checked=false;save();renderSequence();showView('sequence');showToast('Testsekvens genereret')});
}

function updateSimulator(field,value){
  const calc=calculateFromField(field,n(value),state.instrument); if(!Number.isFinite(calc.process))return;
  state.simulatorValue=calc.process; updating=true;
  $('processValue').value=Number(calc.process.toFixed(4));$('processSlider').value=calc.process;
  $('percentValue').value=Number(calc.percent.toFixed(2));$('signalValue').value=Number(calc.signal.toFixed(3));$('rawValue').value=Math.round(calc.raw);
  updating=false;save();renderSimulatorStatus(calc.process,calc.percent);
}

function renderSimulatorStatus(process,percent){
  const i=state.instrument,lock=state.interlock,range=signalRanges[i.signalType]||signalRanges['4-20mA'];
  $('simTag').textContent=i.tag;$('simInterlock').textContent=`${lock.tag} · ${lock.level}`;$('heroUnit').textContent=i.unit;$('signalUnit').textContent=range.unit;
  $('processSlider').min=i.processMin;$('processSlider').max=i.processMax;$('processSlider').step=Math.abs(i.processMax-i.processMin)/1000||.01;
  $('rangeMin').textContent=`${fmt(i.processMin)} ${i.unit}`;$('rangeMax').textContent=`${fmt(i.processMax)} ${i.unit}`;$('tripMarkerText').textContent=`${fmt(lock.tripValue)} ${i.unit}`;
  $('rawHint').textContent=`${Math.round(i.rawMin).toLocaleString('da-DK')}–${Math.round(i.rawMax).toLocaleString('da-DK')}`;
  $('percentHint').textContent=t(percent<0?'Underrange':percent>100?'Overrange':'Inden for måleområde');
  const tripped=isTripped(process,lock);$('interlockState').textContent=tripped?'TRIP':'NORMAL';$('interlockDetail').textContent=`${lock.level} ved ${fmt(lock.tripValue)} ${i.unit}`;$('interlockState').parentElement.classList.toggle('safe',!tripped);
}

function renderSimulator(){
  const i=state.instrument;let v=Number.isFinite(state.simulatorValue)?state.simulatorValue:i.processMin;const calc=calculateFromField('process',v,i);if(!Number.isFinite(calc.process))return;
  updating=true;$('processValue').value=Number(calc.process.toFixed(4));$('percentValue').value=Number(calc.percent.toFixed(2));$('signalValue').value=Number(calc.signal.toFixed(3));$('rawValue').value=Math.round(calc.raw);updating=false;renderSimulatorStatus(calc.process,calc.percent);
}

function bindSimulator(){
  [['processValue','process'],['percentValue','percent'],['signalValue','signal'],['rawValue','raw'],['processSlider','process']].forEach(([id,field])=>$(id).addEventListener('input',()=>{if(!updating)updateSimulator(field,$(id).value)}));
}

function renderSequence(){
  const completed=state.points.filter(p=>p.status!=='not-tested').length;$('progressText').textContent=`${completed} / ${state.points.length}`;$('safetyCheck').checked=!!state.safetyConfirmed;
  const range=signalRanges[state.instrumentSnapshot?.signalType||state.instrument.signalType]||signalRanges['4-20mA'];const unit=state.instrumentSnapshot?.unit||state.instrument.unit;
  $('testList').innerHTML=state.points.map((p,index)=>`<article class="test-item ${esc(p.status)}" data-id="${esc(p.id)}">
    <div class="test-summary" tabindex="0" role="button" aria-expanded="false"><span class="test-index">${p.status==='passed'?'✓':p.status==='failed'?'×':index+1}</span><div class="test-title"><b>${esc(t(p.label))}</b><span>${esc(translateExpected(p.expectedResult))}</span></div><div class="test-value">${fmt(p.processValue)} <small>${esc(unit)}</small><br><small>${fmt(p.signalValue)} ${esc(range.unit)}</small></div><span class="test-status">${t(p.status==='passed'?'Bestået':p.status==='failed'?'Fejlet':'Ikke testet')}</span></div>
    <div class="test-body"><div class="test-body-grid"><label>${t('Forventet resultat')}<textarea data-field="expectedResult">${esc(translateExpected(p.expectedResult))}</textarea></label><label>${t('Observeret resultat')}<textarea data-field="observedResult" placeholder="${t('Beskriv alarm, ventil, motor eller udgang…')}">${esc(p.observedResult)}</textarea></label><label>${t('Tekniker')}<input data-field="testedBy" value="${esc(p.testedBy)}" placeholder="${t('Navn eller initialer')}"></label><label>${t('Kommentar')}<input data-field="comment" value="${esc(p.comment)}" placeholder="${t('Valgfri bemærkning')}"></label></div><div class="test-controls"><small>${t('Testtid:')} ${formatDate(p.testedAt)}</small><div class="result-buttons"><button class="pass-btn ${p.status==='passed'?'selected':''}" data-status="passed">${t('Bestået')}</button><button class="fail-btn ${p.status==='failed'?'selected':''}" data-status="failed">${t('Fejlet')}</button></div></div></div>
  </article>`).join('');
  translateDom($('testList'));
}

function bindSequence(){
  $('safetyCheck').addEventListener('change',()=>{state.safetyConfirmed=$('safetyCheck').checked;save();if(state.safetyConfirmed)showToast('Teststart bekræftet')});
  $('testList').addEventListener('click',event=>{
    const item=event.target.closest('.test-item');if(!item)return;const point=state.points.find(p=>p.id===item.dataset.id);if(!point)return;
    const statusBtn=event.target.closest('[data-status]');
    if(statusBtn){event.preventDefault();if(!state.safetyConfirmed)return showToast('Bekræft sikkerhedskontrollen før registrering');point.status=statusBtn.dataset.status;point.testedAt=new Date().toISOString();item.querySelectorAll('[data-field]').forEach(el=>point[el.dataset.field]=el.value);save();renderSequence();return;}
    if(event.target.closest('.test-summary')){if(!state.safetyConfirmed)return showToast('Bekræft sikkerhedskontrollen før testen åbnes');document.querySelectorAll('.test-item.open').forEach(el=>{if(el!==item)el.classList.remove('open')});item.classList.toggle('open');item.querySelector('.test-summary').setAttribute('aria-expanded',item.classList.contains('open'));}
  });
  $('testList').addEventListener('input',event=>{const field=event.target.dataset.field;if(!field)return;const item=event.target.closest('.test-item');const point=state.points.find(p=>p.id===item.dataset.id);if(point){point[field]=event.target.value;save()}});
}

function statusLabel(status){return t(status==='passed'?'BESTÅET':status==='failed'?'FEJLET':'IKKE AFSLUTTET')}
function renderReport(){
  const i=state.instrumentSnapshot||state.instrument;const lock=state.interlockSnapshot||state.interlock;const status=overallStatus(state.points);const completed=state.points.filter(p=>p.status!=='not-tested').length;
  $('reportContent').innerHTML=`<div class="report-top"><div><p class="eyebrow">Interlock testprotokol</p><h2>${esc(i.tag)} · ${esc(lock.tag)}</h2><p>${esc(t(i.description))}${i.location?' — '+esc(t(i.location)):''}</p></div><span class="overall ${status}">${statusLabel(status)}</span></div>
  <div class="report-meta"><div><span>Signal</span><b>${esc(signalRanges[i.signalType]?.label||i.signalType)}</b></div><div><span>Måleområde</span><b>${fmt(i.processMin)}–${fmt(i.processMax)} ${esc(i.unit)}</b></div><div><span>PLC råområde</span><b>${Math.round(i.rawMin).toLocaleString('da-DK')}–${Math.round(i.rawMax).toLocaleString('da-DK')}</b></div><div><span>Gennemført</span><b>${completed} ${t('af')} ${state.points.length}</b></div></div>
  <div class="report-section"><h3>Interlockdefinition</h3><div class="report-meta"><div><span>Niveau / retning</span><b>${esc(lock.level)} · ${t(lock.direction==='rising'?'Stigende':'Faldende')}</b></div><div><span>Trip</span><b>${fmt(lock.tripValue)} ${esc(i.unit)}</b></div><div><span>Reset</span><b>${fmt(lock.resetValue)} ${esc(i.unit)}</b></div><div><span>Resettype</span><b>${t(lock.resetMode==='manual'?'Manuel':'Automatisk')}</b></div></div><p><b>${t('Forventet alarm')}:</b> ${esc(t(lock.expectedAlarm))}</p><p><b>${t('Forventede handlinger')}:</b> ${esc(t(lock.expectedActions))}</p></div>
  <div class="report-section"><h3>Testresultater</h3><table class="report-table"><thead><tr><th>Punkt</th><th>Input</th><th>Forventet</th><th>Observeret</th><th>Tekniker / tid</th><th>Status</th></tr></thead><tbody>${state.points.map(p=>`<tr><td><b>${esc(t(p.label))}</b></td><td>${fmt(p.processValue)} ${esc(i.unit)}<br>${fmt(p.signalValue)} ${esc(signalRanges[i.signalType]?.unit||'')}</td><td>${esc(translateExpected(p.expectedResult))}</td><td>${esc(p.observedResult)||'—'}${p.comment?'<br><small>'+esc(p.comment)+'</small>':''}</td><td>${esc(p.testedBy)||'—'}<br>${formatDate(p.testedAt)}</td><td><b>${statusLabel(p.status)}</b></td></tr>`).join('')}</tbody></table></div>
  `;
  translateDom($('reportContent'));
}

function bindReport(){
  $('printBtn').addEventListener('click',()=>{renderReport();window.print()});
  $('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`interlock-${state.instrument.tag}-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);showToast('Projekt eksporteret')});
  $('importInput').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data.instrument||!data.interlock||!Array.isArray(data.points))throw new Error();state={...initialState(),...data,updatedAt:new Date().toISOString()};save();populateForms();renderAll();showToast('Projekt importeret')}catch{showToast('Filen er ikke et gyldigt projekt')}event.target.value=''});
}

function bindInstall(){
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;$('installBtn').classList.remove('hidden')});
  $('installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').classList.add('hidden')});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

function localizePresetData(locale){
  const presets={
    description:{da:'Tryktransmitter',no:'Trykktransmitter',en:'Pressure transmitter'},
    location:{da:'Proceslinje 1',no:'Prosesslinje 1',en:'Process line 1'},
    expectedAlarm:{da:'Højt tryk — HH alarm',no:'Høyt trykk — HH-alarm',en:'High pressure — HH alarm'},
    expectedActions:{da:'Stop P-101, luk XV-101, blokér genstart',no:'Stopp P-101, lukk XV-101, blokker omstart',en:'Stop P-101, close XV-101, inhibit restart'}
  };
  for(const [field,values] of Object.entries(presets)){
    const target=field.startsWith('expected')?state.interlock:state.instrument;
    if(Object.values(values).includes(target[field]))target[field]=values[locale];
  }
}
function bindLanguage(){const picker=$('languageSelect');picker.value=state.locale||'da';setLocale(picker.value);picker.addEventListener('change',()=>{state.locale=picker.value;localizePresetData(state.locale);populateForms();setLocale(state.locale);save();renderAll()})}
function renderAll(){validateProfile();renderSimulator();renderSequence();renderReport();translateDom(document.body)}
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
populateForms();bindLanguage();bindForms();bindSimulator();bindSequence();bindReport();bindInstall();renderAll();
