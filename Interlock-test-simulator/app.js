import {
  signalRanges, calculateFromField, generateSequence, validateInstrument,
  validateInterlock, validateProfile as validateSequence, advanceSimulation, overallStatus
} from './core.js';
import { setLocale, getLocale, t, translateDom } from './i18n.js';
import { importProject, parseProject } from './project.js';

const STORAGE_KEY = 'interlock-test-simulator-v1';
const defaultInstrument = {tag:'PT-101',description:'Tryktransmitter',location:'Proceslinje 1',signalType:'4-20mA',processMin:0,processMax:10,unit:'bar',rawMin:0,rawMax:27648,normalMin:2,normalMax:8,comment:''};
const defaultInterlock = {tag:'PSHH-101',level:'HH',direction:'rising',tripValue:9,resetValue:8.5,delaySeconds:2,resetMode:'manual',expectedAlarm:'Højt tryk — HH alarm',expectedActions:'Stop P-101, luk XV-101, blokér genstart',testDelta:1};

function initialState(){
  const base={instrument:{...defaultInstrument},interlock:{...defaultInterlock},points:[],safetyConfirmed:false,simulatorValue:9,locale:'da',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  base.points=generateSequence(base.instrument,base.interlock,1); base.instrumentSnapshot={...base.instrument}; base.interlockSnapshot={...base.interlock}; return base;
}
function load(){
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? initialState() : parseProject(saved);
  } catch {
    return initialState();
  }
}
let state=load();
let simulation = null;
let simulatorValuePending = false;
let simulationTimer;
let toastTimer;
let deferredInstall;
let importAttempt = 0;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const numericValue = input => Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
const numberLocale = () => ({ da: 'da-DK', no: 'nb-NO', en: 'en-GB' })[getLocale()];
const fmt=(value,digits=2,maxDigits=digits)=>Number.isFinite(value)
  ? value.toLocaleString(numberLocale(), {minimumFractionDigits:digits,maximumFractionDigits:maxDigits})
  : '—';
const formatDate=value=>value?new Intl.DateTimeFormat(numberLocale(),{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—';
const translateExpected=text=>t(text).replace('trip forventet',t('trip forventet')).replace('aktiv — handlinger udført',t('aktiv — handlinger udført')).replace('fortsat aktiv',t('fortsat aktiv'));

function persistProject(project) {
  project.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

function save() {
  try {
    persistProject(state);
    $('saveState').textContent = t('Gemt lokalt');
  } catch {
    $('saveState').textContent = t('Kunne ikke gemme lokalt');
    showToast('Kunne ikke gemme lokalt');
  }
}
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
  const error = state.instrument.tag.trim() && state.interlock.tag.trim()
    ? validateSequence(state.instrument, state.interlock, state.interlock.testDelta)
    : 'Udfyld instrument- og interlockdata først';
  $('profileStatus').textContent = t(error ? 'Kontrollér profil' : 'Profil klar');
  $('profileFeedback').textContent = t(error || 'Ændringer her regenererer først testpunkterne, når du trykker på knappen.');
  $('profileFeedback').classList.toggle('profile-error', Boolean(error));
  return error;
}

const simulationSettings = new Set([
  'signalType', 'processMin', 'processMax', 'rawMin', 'rawMax',
  'direction', 'tripValue', 'resetValue', 'resetMode', 'delaySeconds'
]);

function bindSetting(id, target, key = id) {
  const input = $(id);
  input.addEventListener('input', () => {
    const value = numericFields.has(id) ? numericValue(input) : input.value;
    if (state[target][key] === value) return;
    const wasDigital = isDigital();
    state[target][key] = value;
    if (id === 'signalType' && wasDigital !== isDigital()) {
      state.simulatorValue = isDigital()
        ? Number(state.interlock.direction === 'falling')
        : state.instrument.processMin ?? 0;
    }
    if (simulationSettings.has(id)) {
      simulation = null;
      simulatorValuePending = false;
    }
    validateProfile();
    save();
    renderSimulator();
  });
}

function bindForms() {
  instrumentFields.forEach(id => bindSetting(id, 'instrument'));
  bindSetting('instrumentComment', 'instrument', 'comment');
  interlockFields.forEach(id => bindSetting(id, 'interlock', id === 'interlockTag' ? 'tag' : id));
  $('generateBtn').addEventListener('click', () => {
    const error = validateProfile();
    if (error) return showToast(error);
    state.points = generateSequence(state.instrument, state.interlock, state.interlock.testDelta);
    state.instrumentSnapshot = { ...state.instrument };
    state.interlockSnapshot = { ...state.interlock };
    state.safetyConfirmed = false;
    save();
    renderSequence();
    showView('sequence');
    showToast('Testsekvens genereret');
  });
}

const isDigital = () => Boolean(signalRanges[state.instrument.signalType]?.digital);
const actuationLabel = value => t(value === 1 ? 'Aktiv' : 'Inaktiv');
const contactLabel = value => t(value === 1 ? 'Lukket' : 'Åben');
const simulatorInputs = {
  processValue: 'process',
  percentValue: 'percent',
  signalValue: 'signal',
  rawValue: 'raw',
  processSlider: 'process',
  actuationValue: 'process'
};

function refreshInterlock(process, requestReset = false) {
  clearTimeout(simulationTimer);
  const { instrument, interlock } = state;
  const resetButton = $('manualResetBtn');
  const output = $('interlockState');
  let label = '—';
  let detail = '—';
  let phase;
  const error = validateInstrument(instrument) || validateInterlock(instrument, interlock);
  if (error) {
    detail = t(error);
  } else if (Number.isFinite(process) && !simulatorValuePending) {
    simulation = advanceSimulation(simulation, process, instrument, interlock, {
      now: performance.now(),
      requestReset
    });
    phase = simulation.phase;
    label = {
      normal: 'NORMAL',
      pending: 'Afventer trip',
      tripped: 'TRIP',
      'ready-to-reset': 'Afventer manuel reset'
    }[phase];
    if (phase === 'pending') {
      detail = t('Trip om {seconds} sek.').replace('{seconds}', fmt(Math.ceil(simulation.remainingSeconds * 10) / 10, 1));
      simulationTimer = setTimeout(() => refreshInterlock(process), 100);
    } else if (phase === 'ready-to-reset') {
      detail = t('Resetbetingelse nået');
    } else {
      detail = isDigital()
        ? t(interlock.direction === 'rising' ? 'Trip ved aktivering' : 'Trip ved deaktivering')
        : `${interlock.level} · ${t('Tripgrænse')}: ${fmt(interlock.tripValue)} ${instrument.unit}`;
    }
  }
  if (output.textContent !== t(label)) output.textContent = t(label);
  $('interlockDetail').textContent = detail;
  output.parentElement.classList.toggle('safe', phase === 'normal');
  resetButton.classList.toggle('hidden', interlock.resetMode !== 'manual');
  resetButton.disabled = phase !== 'ready-to-reset';
}

function renderSimulator(source) {
  const { instrument, interlock } = state;
  const digital = isDigital();
  const validInstrument = !validateInstrument(instrument);
  const process = digital && ![0, 1].includes(state.simulatorValue)
    ? Number(interlock.direction === 'falling')
    : state.simulatorValue;
  const calc = validInstrument && !simulatorValuePending
    ? calculateFromField('process', process, instrument)
    : null;
  document.querySelectorAll('[data-analog-profile], [data-analog-simulator]').forEach(element => {
    element.classList.toggle('hidden', digital);
  });
  ['digitalSimulator', 'contactCard', 'digitalDirectionHint'].forEach(id => {
    $(id).classList.toggle('hidden', !digital);
  });
  $('simTag').textContent = instrument.tag;
  $('simInterlock').textContent = `${interlock.tag} · ${interlock.level}`;
  if (digital) {
    $('actuationValue').value = String(process);
    $('contactState').textContent = calc ? contactLabel(calc.signal) : '—';
  } else {
    $('heroUnit').textContent = instrument.unit;
    $('signalUnit').textContent = signalRanges[instrument.signalType]?.unit ?? '';
    $('processSlider').disabled = !validInstrument;
    if (validInstrument) {
      $('processSlider').min = instrument.processMin;
      $('processSlider').max = instrument.processMax;
      $('processSlider').step = 'any';
    }
    $('rangeMin').textContent = `${fmt(instrument.processMin)} ${instrument.unit}`;
    $('rangeMax').textContent = `${fmt(instrument.processMax)} ${instrument.unit}`;
    $('tripMarkerText').textContent = `${fmt(interlock.tripValue)} ${instrument.unit}`;
    $('rawHint').textContent = `${fmt(instrument.rawMin, 0)}–${fmt(instrument.rawMax, 0)}`;
    $('percentHint').textContent = calc
      ? t(calc.percent < 0 ? 'Underrange' : calc.percent > 100 ? 'Overrange' : 'Inden for måleområde')
      : '—';
    const values = { processValue: calc?.process, processSlider: calc?.process,
      percentValue: calc?.percent, signalValue: calc?.signal, rawValue: calc?.raw };
    for (const [id, value] of Object.entries(values)) {
      if (id === source || (id === 'processSlider' && !Number.isFinite(value))) continue;
      const displayValue = id === 'rawValue' ? Math.round(value) : Number(value?.toPrecision(12));
      $(id).value = Number.isFinite(value) ? String(displayValue) : '';
    }
  }
  refreshInterlock(calc?.process);
}

function bindSimulator() {
  for (const [id, field] of Object.entries(simulatorInputs)) {
    $(id).addEventListener('input', event => {
      const value = id === 'actuationValue' ? Number(event.target.value) : numericValue(event.target);
      const calc = value === null || validateInstrument(state.instrument)
        ? null : calculateFromField(field, value, state.instrument);
      simulatorValuePending = !Number.isFinite(calc?.process);
      if (simulatorValuePending) {
        if (simulation?.phase === 'pending') simulation = null;
      } else {
        state.simulatorValue = calc.process;
        save();
      }
      renderSimulator(id);
    });
  }
  $('manualResetBtn').addEventListener('click', () => refreshInterlock(state.simulatorValue, true));
}

function pointInput(point, instrument) {
  const digital = signalRanges[instrument.signalType]?.digital;
  const values = digital && point.rawValue === null
    ? `${actuationLabel(point.processValue)} · ${contactLabel(point.signalValue)}`
    : `${fmt(point.processValue, 2, 10)} ${esc(instrument.unit)}<br><small>${fmt(point.signalValue, 2, 10)} ${esc(t(signalRanges[instrument.signalType]?.unit || ''))}</small>`;
  const hold = point.holdSeconds
    ? `<br><small>${t('Hold signalet i {seconds} sek.').replace('{seconds}', fmt(point.holdSeconds, 0, 10))}</small>`
    : '';
  return values + hold;
}

function renderSequence(){
  const completed=state.points.filter(p=>p.status!=='not-tested').length;$('progressText').textContent=`${completed} / ${state.points.length}`;$('safetyCheck').checked=!!state.safetyConfirmed;
  const instrument = state.instrumentSnapshot || state.instrument;
  $('testList').innerHTML=state.points.map((p,index)=>`<article class="test-item ${esc(p.status)}" data-id="${esc(p.id)}">
    <div class="test-summary" tabindex="0" role="button" aria-expanded="false"><span class="test-index">${p.status==='passed'?'✓':p.status==='failed'?'×':index+1}</span><div class="test-title"><b>${esc(t(p.label))}</b><span>${esc(translateExpected(p.expectedResult))}</span></div><div class="test-value">${pointInput(p,instrument)}</div><span class="test-status">${t(p.status==='passed'?'Bestået':p.status==='failed'?'Fejlet':'Ikke testet')}</span></div>
    <div class="test-body"><div class="test-body-grid"><label>${t('Forventet resultat')}<textarea data-field="expectedResult">${esc(translateExpected(p.expectedResult))}</textarea></label><label>${t('Observeret resultat')}<textarea data-field="observedResult" placeholder="${t('Beskriv alarm, ventil, motor eller udgang…')}">${esc(p.observedResult)}</textarea></label><label>${t('Tekniker')}<input data-field="testedBy" value="${esc(p.testedBy)}" placeholder="${t('Navn eller initialer')}"></label><label>${t('Kommentar')}<input data-field="comment" value="${esc(p.comment)}" placeholder="${t('Valgfri bemærkning')}"></label></div><div class="test-controls"><small>${t('Testtid:')} ${formatDate(p.testedAt)}</small><div class="result-buttons"><button class="pass-btn ${p.status==='passed'?'selected':''}" data-status="passed">${t('Bestået')}</button><button class="fail-btn ${p.status==='failed'?'selected':''}" data-status="failed">${t('Fejlet')}</button></div></div></div>
  </article>`).join('');
  translateDom($('testList'));
}

function bindSequence(){
  $('safetyCheck').addEventListener('change',()=>{state.safetyConfirmed=$('safetyCheck').checked;save();if(state.safetyConfirmed)showToast('Teststart bekræftet')});
  $('testList').addEventListener('click',event=>{
    const item=event.target.closest('.test-item');if(!item)return;const point=state.points.find(p=>p.id===item.dataset.id);if(!point)return;
    const statusBtn=event.target.closest('[data-status]');
    if(statusBtn){event.preventDefault();if(!state.safetyConfirmed)return showToast('Bekræft sikkerhedskontrollen før registrering');point.status=statusBtn.dataset.status;point.testedAt=new Date().toISOString();save();renderSequence();return;}
    if(event.target.closest('.test-summary')){if(!state.safetyConfirmed)return showToast('Bekræft sikkerhedskontrollen før testen åbnes');document.querySelectorAll('.test-item.open').forEach(el=>{if(el!==item)el.classList.remove('open')});item.classList.toggle('open');item.querySelector('.test-summary').setAttribute('aria-expanded',item.classList.contains('open'));}
  });
  $('testList').addEventListener('input',event=>{const field=event.target.dataset.field;if(!field)return;const item=event.target.closest('.test-item');const point=state.points.find(p=>p.id===item.dataset.id);if(point){point[field]=event.target.value;save()}});
}

function statusLabel(status){return t(status==='passed'?'BESTÅET':status==='failed'?'FEJLET':'IKKE AFSLUTTET')}
function renderReport(){
  const i=state.instrumentSnapshot||state.instrument;const lock=state.interlockSnapshot||state.interlock;const status=overallStatus(state.points);const completed=state.points.filter(p=>p.status!=='not-tested').length;
  const digital = signalRanges[i.signalType]?.digital && state.points.every(point => point.rawValue === null);
  const limitSummary = digital
    ? `<div><span>Trip</span><b>${actuationLabel(Number(lock.direction === 'rising'))}</b></div><div><span>Reset</span><b>${actuationLabel(Number(lock.direction === 'falling'))}</b></div>`
    : `<div><span>Trip</span><b>${fmt(lock.tripValue, 2, 10)} ${esc(i.unit)}</b></div><div><span>Reset</span><b>${fmt(lock.resetValue, 2, 10)} ${esc(i.unit)}</b></div>`;
  const rangeSummary = digital ? '' : `<div><span>Måleområde</span><b>${fmt(i.processMin, 2, 10)}–${fmt(i.processMax, 2, 10)} ${esc(i.unit)}</b></div><div><span>PLC råområde</span><b>${fmt(i.rawMin, 0)}–${fmt(i.rawMax, 0)}</b></div>`;
  $('reportContent').innerHTML=`<div class="report-top"><div><p class="eyebrow">Interlock testprotokol</p><h2>${esc(i.tag)} · ${esc(lock.tag)}</h2><p>${esc(t(i.description))}${i.location?' — '+esc(t(i.location)):''}</p></div><span class="overall ${status}">${statusLabel(status)}</span></div>
  <div class="report-meta"><div><span>Signal</span><b>${esc(signalRanges[i.signalType]?.label||i.signalType)}</b></div>${rangeSummary}<div><span>Gennemført</span><b>${completed} ${t('af')} ${state.points.length}</b></div></div>
  <div class="report-section"><h3>Interlockdefinition</h3><div class="report-meta"><div><span>Niveau / retning</span><b>${esc(lock.level)} · ${t(lock.direction==='rising'?'Stigende':'Faldende')}</b></div>${limitSummary}<div><span>Resettype</span><b>${t(lock.resetMode==='manual'?'Manuel':'Automatisk')}</b></div><div><span>Forsinkelse (sek.)</span><b>${fmt(lock.delaySeconds, 0, 10)}</b></div></div><p><b>${t('Forventet alarm')}:</b> ${esc(t(lock.expectedAlarm))}</p><p><b>${t('Forventede handlinger')}:</b> ${esc(t(lock.expectedActions))}</p></div>
  <div class="report-section"><h3>Testresultater</h3><table class="report-table"><thead><tr><th>Punkt</th><th>Input</th><th>Forventet</th><th>Observeret</th><th>Tekniker / tid</th><th>Status</th></tr></thead><tbody>${state.points.map(p=>`<tr><td><b>${esc(t(p.label))}</b></td><td>${pointInput(p,i)}</td><td>${esc(translateExpected(p.expectedResult))}</td><td>${esc(p.observedResult)||'—'}${p.comment?'<br><small>'+esc(p.comment)+'</small>':''}</td><td>${esc(p.testedBy)||'—'}<br>${formatDate(p.testedAt)}</td><td><b>${statusLabel(p.status)}</b></td></tr>`).join('')}</tbody></table></div>
  `;
  translateDom($('reportContent'));
}

function bindReport(){
  $('printBtn').addEventListener('click',()=>{renderReport();window.print()});
  $('exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`interlock-${state.instrument.tag}-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);showToast('Projekt eksporteret')});
  $('importInput').addEventListener('change', async event => {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;
    input.value = '';
    const attempt = ++importAttempt;
    let project;
    let saving = false;
    try {
      const json = await file.text();
      if (attempt !== importAttempt) return;
      project = importProject(json, candidate => {
        saving = true;
        persistProject(candidate);
      });
    } catch {
      if (attempt === importAttempt) {
        showToast(saving ? 'Kunne ikke gemme lokalt' : 'Filen er ikke et gyldigt projekt');
      }
      return;
    }
    state = project;
    simulation = null;
    simulatorValuePending = false;
    $('languageSelect').value = state.locale;
    setLocale(state.locale);
    $('saveState').textContent = t('Gemt lokalt');
    populateForms();
    renderAll();
    showToast('Projekt importeret');
  });
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
