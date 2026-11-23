(() => {
  'use strict';
  const STORAGE_KEY = 'ik-instrumentkoder-v1';
  const DATA = window.IK_DATA;
  const defaultCustomer = { id: crypto.randomUUID(), name: 'Egen virksomhed', note: 'Interne og fælles projektkoder' };
  const defaultState = { version: 1, customers: [defaultCustomer], activeCustomerId: defaultCustomer.id, customerCodes: { [defaultCustomer.id]: [] }, progress: { wrong: [] } };
  let state = loadState();
  let activeTab = 'lookup';
  let selectedCode = 'TI';
  let quiz = [];
  let quizIndex = 0;
  let quizScore = 0;
  let quizStreak = 0;
  let quizAnswered = false;
  let deferredInstall = null;
  let language = localStorage.getItem('ik-language') || 'da';

  const I18N = {
    da: { brandTagline:'opslag · kunder · træning',language:'Sprog',activeCustomer:'Aktiv kunde',install:'Installer app',installTitle:'Installer på mobilen',installIOS:'iPhone/iPad: Åbn siden i Safari, tryk Del og vælg “Føj til hjemmeskærm”.',installAndroid:'Android: Åbn siden i Chrome, åbn browsermenuen og vælg “Installer app”.',installOffline:'Efter første åbning kan appen også bruges offline.',lookupTab:'Opslag',trainingTab:'Træning',customersTab:'Kunder og egne koder',lettersTab:'Bogstavnøgle',library:'Kodebibliotek',findCode:'Find en instrumentkode',search:'Søg',searchPlaceholder:'Fx TI, tryk, alarm eller ventil',category:'Kategori',customerOnly:'Kun kundekoder',practice:'Øvelse',trainCodes:'Træn koderne',questions:'Spørgsmål',includeCustomer:'Medtag kundekoder',newQuiz:'Ny quiz',customerLibraries:'Kundebiblioteker',newCustomer:'Ny kunde',customers:'Kunder',edit:'Redigér',delete:'Slet',addCode:'Tilføj kode',backup:'Sikkerhedskopi',backupHelp:'Eksportér alle kunder og koder som JSON, eller indlæs en tidligere sikkerhedskopi.',exportData:'Eksportér data',importData:'Importér data',reference:'Reference',checkLegend:'Kontrollér altid kundens tegningsforklaring.',firstLetter:'Første bogstav',functionLetters:'Funktionsbogstaver',codeExplanation:'Kodeforklaring',close:'Luk',allCategories:'Alle kategorier',mixed:'Blandet',commonLibrary:'Fælles bibliotek',customerCode:'Kundekode',important:'Vigtigt',noMatches:'Ingen koder matcher søgningen.',chooseCode:'Vælg eller søg efter en kode.',foundOne:'kode fundet',foundMany:'koder fundet',commonCodes:'fælles koder',codesFor:'koder for',question:'Spørgsmål',correct:'Rigtige',streak:'Serie',whatMeans:'Hvad betyder koden?',chooseAnswer:'Vælg et svar.',right:'Rigtigt.',notQuite:'Ikke helt.',next:'Næste spørgsmål',result:'Se resultat',quizDone:'Quiz afsluttet',strong:'Stærkt resultat',good:'Godt på vej',again:'Tag en runde mere',repeat:'Prøv igen',notEnough:'Der er ikke nok koder i den valgte kategori.',wrongPriority:'Koder, du svarede forkert på, prioriteres i næste quiz.',customDefined:'Kundedefineret kode',noNote:'Ingen note' },
    en: { brandTagline:'lookup · customers · training',language:'Language',activeCustomer:'Active customer',install:'Install app',installTitle:'Install on your phone',installIOS:'iPhone/iPad: Open the page in Safari, tap Share, then choose “Add to Home Screen”.',installAndroid:'Android: Open the page in Chrome, open the browser menu, then choose “Install app”.',installOffline:'After the first visit, the app also works offline.',lookupTab:'Lookup',trainingTab:'Training',customersTab:'Customers and custom codes',lettersTab:'Letter key',library:'Code library',findCode:'Find an instrument code',search:'Search',searchPlaceholder:'E.g. TI, pressure, alarm or valve',category:'Category',customerOnly:'Customer codes only',practice:'Practice',trainCodes:'Train the codes',questions:'Questions',includeCustomer:'Include customer codes',newQuiz:'New quiz',customerLibraries:'Customer libraries',newCustomer:'New customer',customers:'Customers',edit:'Edit',delete:'Delete',addCode:'Add code',backup:'Backup',backupHelp:'Export all customers and codes as JSON, or load an earlier backup.',exportData:'Export data',importData:'Import data',reference:'Reference',checkLegend:"Always check the customer's drawing legend.",firstLetter:'First letter',functionLetters:'Function letters',codeExplanation:'Code explanation',close:'Close',allCategories:'All categories',mixed:'Mixed',commonLibrary:'Common library',customerCode:'Customer code',important:'Important',noMatches:'No codes match the search.',chooseCode:'Choose or search for a code.',foundOne:'code found',foundMany:'codes found',commonCodes:'common codes',codesFor:'codes for',question:'Question',correct:'Correct',streak:'Streak',whatMeans:'What does the code mean?',chooseAnswer:'Choose an answer.',right:'Correct.',notQuite:'Not quite.',next:'Next question',result:'View result',quizDone:'Quiz complete',strong:'Strong result',good:'Good progress',again:'Take another round',repeat:'Try again',notEnough:'There are not enough codes in the selected category.',wrongPriority:'Codes answered incorrectly are prioritised in the next quiz.',customDefined:'Customer-defined code',noNote:'No note' },
    no: { brandTagline:'oppslag · kunder · trening',language:'Språk',activeCustomer:'Aktiv kunde',install:'Installer app',installTitle:'Installer på mobilen',installIOS:'iPhone/iPad: Åpne siden i Safari, trykk Del og velg “Legg til på Hjem-skjermen”.',installAndroid:'Android: Åpne siden i Chrome, åpne nettlesermenyen og velg “Installer app”.',installOffline:'Etter første åpning kan appen også brukes uten nett.',lookupTab:'Oppslag',trainingTab:'Trening',customersTab:'Kunder og egne koder',lettersTab:'Bokstavnøkkel',library:'Kodebibliotek',findCode:'Finn en instrumentkode',search:'Søk',searchPlaceholder:'F.eks. TI, trykk, alarm eller ventil',category:'Kategori',customerOnly:'Bare kundekoder',practice:'Øvelse',trainCodes:'Tren på kodene',questions:'Spørsmål',includeCustomer:'Ta med kundekoder',newQuiz:'Ny quiz',customerLibraries:'Kundebiblioteker',newCustomer:'Ny kunde',customers:'Kunder',edit:'Rediger',delete:'Slett',addCode:'Legg til kode',backup:'Sikkerhetskopi',backupHelp:'Eksporter alle kunder og koder som JSON, eller last inn en tidligere sikkerhetskopi.',exportData:'Eksporter data',importData:'Importer data',reference:'Referanse',checkLegend:'Kontroller alltid kundens tegningsforklaring.',firstLetter:'Første bokstav',functionLetters:'Funksjonsbokstaver',codeExplanation:'Kodeforklaring',close:'Lukk',allCategories:'Alle kategorier',mixed:'Blandet',commonLibrary:'Felles bibliotek',customerCode:'Kundekode',important:'Viktig',noMatches:'Ingen koder samsvarer med søket.',chooseCode:'Velg eller søk etter en kode.',foundOne:'kode funnet',foundMany:'koder funnet',commonCodes:'felles koder',codesFor:'koder for',question:'Spørsmål',correct:'Riktige',streak:'Serie',whatMeans:'Hva betyr koden?',chooseAnswer:'Velg et svar.',right:'Riktig.',notQuite:'Ikke helt.',next:'Neste spørsmål',result:'Se resultat',quizDone:'Quiz fullført',strong:'Sterkt resultat',good:'Godt på vei',again:'Ta en runde til',repeat:'Prøv igjen',notEnough:'Det er ikke nok koder i valgt kategori.',wrongPriority:'Koder du svarte feil på, prioriteres i neste quiz.',customDefined:'Kundedefinert kode',noNote:'Ingen merknad' }
  };

  const t = key => I18N[language]?.[key] || I18N.da[key] || key;
  const noReplacements = [['Tryksikkerhedsventil','Trykksikkerhetsventil'],['Nedlukningsventil','Nedstengningsventil'],['Nødnedlukning','Nødstans'],['Fugtighed','Fuktighet'],['fugtighed','fuktighet'],['Hastighed','Hastighet'],['hastighed','hastighet'],['Mængde','Mengde'],['mængde','mengde'],['Vægt','Vekt'],['vægt','vekt'],['Tryk','Trykk'],['tryk','trykk'],['Høj-høj','Høy-høy'],['høj-høj','høy-høy'],['Høj','Høy'],['høj','høy'],['Nedlukning','Nedstengning'],['nedlukning','nedstengning'],['Indikering','Indikasjon'],['indikering','indikasjon'],['Registrering','Registrering'],['Regulering','Regulering'],['Brugerdefineret','Brukerdefinert'],['Uklassificeret','Uklassifisert'],['Hændelse','Hendelse'],['tilstedeværelse','tilstedeværelse'],['eller','eller']];
  function norwegian(value) { return noReplacements.reduce((text,[from,to]) => text.replaceAll(from,to), String(value || '')); }
  function meaning(item) { return language === 'en' ? (item.en || item.da) : language === 'no' ? (item.no || norwegian(item.da)) : item.da; }
  function secondaryMeaning(item) { return language === 'da' ? item.en : item.da; }
  function description(item) {
    if (item.source === 'customer') return item.description || t('customDefined');
    if (language === 'da') return item.description || '';
    if (language === 'en') return item.descriptionEn || `Instrument function: ${item.en || item.da}.`;
    return item.descriptionNo || `Instrumentfunksjon: ${item.no || norwegian(item.da)}.`;
  }
  function categoryName(value) {
    const names = { en:{'Andre målinger':'Other measurements','Niveau':'Level','Sikkerhed':'Safety','Temperatur':'Temperature','Tryk':'Pressure','Ventiler':'Valves','Operatør':'Operator','Position':'Position','Flow':'Flow'}, no:{'Andre målinger':'Andre målinger','Niveau':'Nivå','Sikkerhed':'Sikkerhet','Temperatur':'Temperatur','Tryk':'Trykk','Ventiler':'Ventiler','Operatør':'Operatør','Position':'Posisjon','Flow':'Flow'} };
    return names[language]?.[value] || value;
  }
  function localizedPart(value) {
    if (language === 'da') return value;
    const en = {'Analyse':'Analysis','Forbrænding':'Combustion','Ledningsevne':'Conductivity','Densitet':'Density','Spænding':'Voltage','Flow':'Flow','Strøm':'Current','Effekt':'Power','Niveau':'Level','Fugtighed':'Moisture / humidity','Tryk':'Pressure','Mængde':'Quantity','Stråling':'Radiation','Hastighed':'Speed / frequency','Temperatur':'Temperature','Multivariabel':'Multivariable','Vibration':'Vibration','Vægt eller kraft':'Weight / force','Position':'Position','Indikering':'Indication','Regulering':'Control','Registrering':'Recording','Kontakt':'Switch','Alarm':'Alarm','Høj':'High','Høj-høj':'High-high','Lav':'Low','Lav-lav':'Low-low','Sikkerhed':'Safety','Ventil':'Valve','Nedlukning':'Shutdown','Nød':'Emergency','Håndbetjent':'Hand / manual','Lukket':'Closed','Åben':'Open'};
    return language === 'en' ? (en[value] || value) : norwegian(value);
  }
  function applyLanguage() {
    document.documentElement.lang = language;
    $('#language-select').value = language;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    renderLookup(); renderLetters(); buildQuiz();
    if (activeTab === 'customers') renderCustomers();
  }

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const activeCustomer = () => state.customers.find(customer => customer.id === state.activeCustomerId) || state.customers[0];
  const activeCustomerCodes = () => state.customerCodes[state.activeCustomerId] || [];

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.customers) || !parsed.customers.length) return structuredClone(defaultState);
      parsed.customerCodes ||= {};
      parsed.progress ||= { wrong: [] };
      if (!parsed.customers.some(customer => customer.id === parsed.activeCustomerId)) parsed.activeCustomerId = parsed.customers[0].id;
      parsed.customers.forEach(customer => { parsed.customerCodes[customer.id] ||= []; });
      return parsed;
    } catch { return structuredClone(defaultState); }
  }

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function mergedCodes(includeCustomer = true) {
    const map = new Map(DATA.codes.map(item => [item.code, { ...item, source: 'standard' }]));
    if (includeCustomer) activeCustomerCodes().forEach(item => map.set(item.code, { ...item, source: 'customer', customerName: activeCustomer().name, parts: [[item.code, t('customDefined')]] }));
    return [...map.values()].sort((a,b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  }

  function setTab(tab) {
    activeTab = tab;
    $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
    $$('.panel').forEach(panel => { panel.hidden = panel.id !== `${tab}-panel`; panel.classList.toggle('active', panel.id === `${tab}-panel`); });
    if (tab === 'lookup') renderLookup();
    if (tab === 'customers') renderCustomers();
    if (tab === 'letters') renderLetters();
  }

  function renderCustomerPicker() {
    const select = $('#customer-select');
    select.innerHTML = state.customers.map(customer => `<option value="${safe(customer.id)}">${safe(customer.name)}</option>`).join('');
    select.value = state.activeCustomerId;
  }

  function categoriesFor(codes) { return ['', ...new Set(codes.map(code => code.category).sort((a,b) => categoryName(a).localeCompare(categoryName(b),language)))]; }
  function fillCategorySelect(select, codes, mixedLabel = t('allCategories')) {
    const current = select.value;
    select.innerHTML = categoriesFor(codes).map((category,index) => `<option value="${index ? safe(category) : 'all'}">${index ? safe(categoryName(category)) : mixedLabel}</option>`).join('');
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function filteredLookupCodes() {
    const query = $('#search-input').value.trim().toLocaleLowerCase(language);
    const category = $('#category-filter').value;
    const customerOnly = $('#customer-only').checked;
    return mergedCodes().filter(item => {
      const haystack = [item.code,item.da,item.en,item.no,norwegian(item.da),item.category,categoryName(item.category),item.description].join(' ').toLocaleLowerCase(language);
      return (!query || haystack.includes(query)) && (category === 'all' || item.category === category) && (!customerOnly || item.source === 'customer');
    });
  }

  function renderLookup() {
    const allCodes = mergedCodes();
    fillCategorySelect($('#category-filter'), allCodes);
    const items = filteredLookupCodes();
    if (!items.some(item => item.code === selectedCode)) selectedCode = items[0]?.code || '';
    $('#library-summary').textContent = `${DATA.codes.length} ${t('commonCodes')} · ${activeCustomerCodes().length} ${t('codesFor')} ${activeCustomer().name}`;
    $('#result-count').textContent = `${items.length} ${items.length === 1 ? t('foundOne') : t('foundMany')}`;
    $('#code-grid').innerHTML = items.length ? items.map(item => `<button type="button" class="code-chip ${item.source === 'customer' ? 'customer-code' : ''} ${item.code === selectedCode ? 'active' : ''}" data-code="${safe(item.code)}" aria-pressed="${item.code === selectedCode}">${safe(item.code)}</button>`).join('') : `<p class="empty">${t('noMatches')}</p>`;
    $$('#code-grid [data-code]').forEach(button => button.addEventListener('click', () => {
      selectedCode = button.dataset.code;
      renderLookup();
      if (matchMedia('(max-width: 820px)').matches) {
        $('#detail-dialog').hidden = false;
        document.body.classList.add('detail-open');
      }
    }));
    renderCodeDetail(items.find(item => item.code === selectedCode) || mergedCodes().find(item => item.code === selectedCode));
  }

  function renderCodeDetail(item) {
    const markup = item ? `
      <div class="detail-head"><div><p class="eyebrow">${item.source === 'customer' ? safe(item.customerName) : t('commonLibrary')}</p><div class="detail-code">${safe(item.code)}</div></div><div class="badges"><span class="badge">${safe(categoryName(item.category))}</span>${item.source === 'customer' ? `<span class="badge customer">${t('customerCode')}</span>` : ''}</div></div>
      <h2>${safe(meaning(item))}</h2><p class="muted">${safe(secondaryMeaning(item) || '')}</p><p>${safe(description(item))}</p>
      <div class="breakdown">${(item.parts || [[item.code,'Code']]).map(part => `<div class="letter-row"><span class="letter-box">${safe(part[0])}</span><span>${safe(localizedPart(part[1]))}</span></div>`).join('')}</div>
      ${item.note ? `<p class="warning"><strong>${t('important')}:</strong> ${safe(language === 'da' ? item.note : language === 'en' ? "Always check the customer's drawing legend. HSV is used differently between projects." : 'Kontroller alltid kundens tegningsforklaring. HSV brukes forskjellig mellom prosjekter.')}</p>` : ''}
      ${item.source === 'customer' ? `<button class="button secondary edit-selected-code" type="button">${t('edit')} ${t('customerCode').toLocaleLowerCase(language)}</button>` : ''}` : `<p class="empty">${t('chooseCode')}</p>`;
    ['#code-detail', '#mobile-code-detail'].forEach(selector => {
      const detail = $(selector);
      if (!detail) return;
      detail.innerHTML = markup;
      detail.querySelector('.edit-selected-code')?.addEventListener('click', () => openCodeDialog(item.code));
    });
  }

  function renderCustomers() {
    renderCustomerPicker();
    $('#customer-list').innerHTML = state.customers.map(customer => `<button type="button" class="customer-item ${customer.id === state.activeCustomerId ? 'active' : ''}" data-customer="${safe(customer.id)}"><span><strong>${safe(customer.name)}</strong><small>${safe(customer.note || t('noNote'))}</small></span><b>${(state.customerCodes[customer.id] || []).length}</b></button>`).join('');
    $$('#customer-list [data-customer]').forEach(button => button.addEventListener('click', () => switchCustomer(button.dataset.customer)));
    const customer = activeCustomer();
    const codes = activeCustomerCodes();
    $('#customer-code-title').textContent = customer.name;
    $('#customer-code-count').textContent = `${codes.length} egne ${codes.length === 1 ? 'kode' : 'koder'}`;
    $('#customer-code-table').innerHTML = codes.length ? `<table><thead><tr><th>Code</th><th>${language === 'en' ? 'Meaning' : language === 'no' ? 'Betydning' : 'Betydning'}</th><th>${t('category')}</th><th></th></tr></thead><tbody>${codes.slice().sort((a,b)=>a.code.localeCompare(b.code)).map(code => `<tr><td><code>${safe(code.code)}</code></td><td><strong>${safe(meaning(code))}</strong><br><span class="muted">${safe(code.description || '')}</span></td><td>${safe(categoryName(code.category))}</td><td><div class="row-actions"><button class="button secondary small" type="button" data-edit-code="${safe(code.code)}">${t('edit')}</button><button class="button danger small" type="button" data-delete-code="${safe(code.code)}">${t('delete')}</button></div></td></tr>`).join('')}</tbody></table>` : `<p class="empty">${language === 'en' ? 'This customer has no custom codes yet.' : language === 'no' ? 'Denne kunden har ingen egne koder ennå.' : 'Denne kunde har endnu ingen egne koder.'}</p>`;
    $$('[data-edit-code]').forEach(button => button.addEventListener('click', () => openCodeDialog(button.dataset.editCode)));
    $$('[data-delete-code]').forEach(button => button.addEventListener('click', () => deleteCode(button.dataset.deleteCode)));
  }

  function switchCustomer(id) {
    if (!state.customers.some(customer => customer.id === id)) return;
    state.activeCustomerId = id;
    saveState();
    renderCustomerPicker();
    if (activeTab === 'customers') renderCustomers();
    if (activeTab === 'lookup') renderLookup();
    buildQuiz();
    showToast(`Aktiv kunde: ${activeCustomer().name}`);
  }

  function openCustomerDialog(customerId = '') {
    const customer = state.customers.find(item => item.id === customerId);
    $('#customer-id').value = customer?.id || '';
    $('#customer-name').value = customer?.name || '';
    $('#customer-note').value = customer?.note || '';
    $('#customer-dialog-title').textContent = customer ? 'Redigér kunde' : 'Ny kunde';
    $('#customer-error').textContent = '';
    $('#customer-dialog').showModal();
    $('#customer-name').focus();
  }

  function saveCustomer(event) {
    event.preventDefault();
    const id = $('#customer-id').value;
    const name = $('#customer-name').value.trim();
    const note = $('#customer-note').value.trim();
    if (!name) { $('#customer-error').textContent = 'Skriv et kundenavn.'; return; }
    if (state.customers.some(customer => customer.id !== id && customer.name.toLocaleLowerCase('da') === name.toLocaleLowerCase('da'))) { $('#customer-error').textContent = 'Kunden findes allerede.'; return; }
    if (id) {
      const customer = state.customers.find(item => item.id === id);
      customer.name = name; customer.note = note;
    } else {
      const customer = { id: crypto.randomUUID(), name, note };
      state.customers.push(customer); state.customerCodes[customer.id] = []; state.activeCustomerId = customer.id;
    }
    saveState(); $('#customer-dialog').close(); renderCustomerPicker(); renderCustomers(); showToast('Kunden er gemt');
  }

  function deleteCustomer() {
    if (state.customers.length === 1) { showToast('Der skal være mindst én kunde'); return; }
    const customer = activeCustomer();
    if (!confirm(`Slet ${customer.name} og alle kundens egne koder?`)) return;
    state.customers = state.customers.filter(item => item.id !== customer.id);
    delete state.customerCodes[customer.id];
    state.activeCustomerId = state.customers[0].id;
    saveState(); renderCustomerPicker(); renderCustomers(); renderLookup(); buildQuiz(); showToast(`${customer.name} er slettet`);
  }

  function openCodeDialog(code = '') {
    const item = activeCustomerCodes().find(entry => entry.code === code);
    $('#edit-code-original').value = item?.code || '';
    $('#custom-code').value = item?.code || '';
    $('#custom-category').value = item?.category || '';
    $('#custom-da').value = item?.da || '';
    $('#custom-en').value = item?.en || '';
    $('#custom-no').value = item?.no || '';
    $('#custom-description').value = item?.description || '';
    $('#code-dialog-title').textContent = item ? `Redigér ${item.code}` : `Ny kode til ${activeCustomer().name}`;
    $('#code-error').textContent = '';
    $('#code-dialog').showModal();
    $('#custom-code').focus();
  }

  function saveCode(event) {
    event.preventDefault();
    const original = $('#edit-code-original').value;
    const code = $('#custom-code').value.trim().toUpperCase().replace(/\s+/g,'');
    const category = $('#custom-category').value.trim();
    const da = $('#custom-da').value.trim();
    const en = $('#custom-en').value.trim();
    const no = $('#custom-no').value.trim();
    const description = $('#custom-description').value.trim();
    if (!/^[A-Z0-9-]{1,12}$/.test(code)) { $('#code-error').textContent = 'Koden må indeholde 1–12 bogstaver, tal eller bindestreg.'; return; }
    if (!category || !da) { $('#code-error').textContent = 'Udfyld kategori og dansk betydning.'; return; }
    const codes = activeCustomerCodes();
    if (codes.some(item => item.code === code && item.code !== original)) { $('#code-error').textContent = 'Koden findes allerede hos denne kunde.'; return; }
    const item = { code, category, da, en: en || da, no: no || norwegian(da), description: description || 'Kundedefineret kode.', trainable: true };
    const index = codes.findIndex(entry => entry.code === original);
    if (index >= 0) codes[index] = item; else codes.push(item);
    selectedCode = code;
    saveState(); $('#code-dialog').close(); renderCustomers(); renderLookup(); showToast(`${code} er gemt for ${activeCustomer().name}`);
  }

  function deleteCode(code) {
    if (!confirm(`Slet ${code} fra ${activeCustomer().name}?`)) return;
    state.customerCodes[state.activeCustomerId] = activeCustomerCodes().filter(item => item.code !== code);
    if (selectedCode === code) selectedCode = 'TI';
    saveState(); renderCustomers(); renderLookup(); showToast(`${code} er slettet`);
  }

  function buildQuiz() {
    const includeCustomer = $('#training-customer').checked;
    const category = $('#training-category').value;
    const count = Number($('#training-count').value || 10);
    const all = mergedCodes(includeCustomer).filter(item => item.trainable !== false);
    fillCategorySelect($('#training-category'), all, t('mixed'));
    let pool = all.filter(item => category === 'all' || item.category === category);
    if (pool.length < 4) pool = all;
    const wrong = new Set(state.progress.wrong || []);
    const prioritized = shuffle(pool.filter(item => wrong.has(item.code)));
    const rest = shuffle(pool.filter(item => !wrong.has(item.code)));
    const selected = [...prioritized,...rest].slice(0,Math.min(count,pool.length));
    quiz = selected.map(answer => {
      const sameCategory = shuffle(all.filter(item => item.code !== answer.code && item.category === answer.category));
      const others = shuffle(all.filter(item => item.code !== answer.code && !sameCategory.some(candidate => candidate.code === item.code)));
      return { answer, options: shuffle([answer,...sameCategory,...others].slice(0,4)) };
    });
    quizIndex = 0; quizScore = 0; quizStreak = 0; quizAnswered = false;
    renderQuiz();
  }

  function shuffle(items) {
    const result = items.slice();
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  }

  function renderQuiz() {
    const total = quiz.length;
    $('#quiz-stats').innerHTML = `<div class="stat"><span>${t('question')}</span><strong>${Math.min(quizIndex+1,total)}/${total}</strong></div><div class="stat"><span>${t('correct')}</span><strong>${quizScore}</strong></div><div class="stat"><span>${t('streak')}</span><strong>${quizStreak}</strong></div>`;
    const card = $('#quiz-card');
    if (!total) { card.innerHTML = `<p class="empty">${t('notEnough')}</p>`; return; }
    if (quizIndex >= total) {
      const percent = Math.round(quizScore/total*100);
      card.innerHTML = `<p class="eyebrow">${t('quizDone')}</p><div class="quiz-code">${quizScore}/${total}</div><h2>${percent >= 90 ? t('strong') : percent >= 70 ? t('good') : t('again')}</h2><p class="muted">${t('wrongPriority')}</p><button id="repeat-quiz" class="button" type="button">${t('repeat')}</button>`;
      $('#repeat-quiz').addEventListener('click', buildQuiz); return;
    }
    quizAnswered = false;
    const question = quiz[quizIndex];
    const progress = Math.round((quizIndex+1)/total*100);
    card.innerHTML = `<div class="detail-head"><p class="eyebrow">${t('whatMeans')}</p><span class="badge">${safe(categoryName(question.answer.category))}</span></div><div class="progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><div class="quiz-code">${safe(question.answer.code)}</div><div class="quiz-options">${question.options.map(option => `<button class="quiz-option" type="button" data-answer="${safe(option.code)}">${safe(meaning(option))}</button>`).join('')}</div><div id="quiz-feedback" class="quiz-feedback"><span class="muted">${t('chooseAnswer')}</span></div>`;
    $$('.quiz-option').forEach(button => button.addEventListener('click', () => answerQuiz(button.dataset.answer)));
  }

  function answerQuiz(code) {
    if (quizAnswered) return;
    quizAnswered = true;
    const question = quiz[quizIndex];
    const correct = code === question.answer.code;
    $$('.quiz-option').forEach(button => { button.disabled = true; if (button.dataset.answer === question.answer.code) button.classList.add('correct'); if (button.dataset.answer === code && !correct) button.classList.add('wrong'); });
    const wrong = new Set(state.progress.wrong || []);
    if (correct) { quizScore++; quizStreak++; wrong.delete(question.answer.code); } else { quizStreak=0; wrong.add(question.answer.code); }
    state.progress.wrong = [...wrong].slice(-60); saveState();
    $('#quiz-stats').children[1].querySelector('strong').textContent = quizScore;
    $('#quiz-stats').children[2].querySelector('strong').textContent = quizStreak;
    $('#quiz-feedback').innerHTML = `<span>${correct ? t('right') : `${t('notQuite')} ${safe(question.answer.code)} = ${safe(meaning(question.answer))}.`}</span><button id="next-question" class="button" type="button">${quizIndex+1===quiz.length?t('result'):t('next')}</button>`;
    $('#next-question').addEventListener('click', () => { quizIndex++; renderQuiz(); });
  }

  function renderLetters() {
    $('#first-letter-grid').innerHTML = DATA.firstLetters.map(item => `<div class="letter-key"><b>${safe(item[0])}</b><span>${safe(language === 'en' ? item[2] : language === 'no' ? norwegian(item[1]) : item[1])}${language === 'da' ? `<small>${safe(item[2])}</small>` : ''}</span></div>`).join('');
    $('#function-letter-grid').innerHTML = DATA.functionLetters.map(item => `<div class="letter-key"><b>${safe(item[0])}</b><span>${safe(language === 'en' ? localizedPart(item[1]) : language === 'no' ? norwegian(item[1]) : item[1])}</span></div>`).join('');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `instrumentkoder-${new Date().toISOString().slice(0,10)}.json`; anchor.click();
    URL.revokeObjectURL(url); showToast('Sikkerhedskopi oprettet');
  }

  async function importData(file) {
    try {
      const imported = JSON.parse(await file.text());
      if (imported.version !== 1 || !Array.isArray(imported.customers) || !imported.customers.length || typeof imported.customerCodes !== 'object') throw new Error('Ugyldig fil');
      state = imported;
      if (!state.customers.some(customer => customer.id === state.activeCustomerId)) state.activeCustomerId = state.customers[0].id;
      saveState(); renderCustomerPicker(); renderCustomers(); renderLookup(); buildQuiz(); showToast('Data er importeret');
    } catch { showToast('Filen kunne ikke importeres'); }
    $('#import-data').value = '';
  }

  function init() {
    renderCustomerPicker();
    $('#language-select').value = language;
    applyLanguage();
    fillCategorySelect($('#training-category'), mergedCodes(), t('mixed'));
    buildQuiz();
    $$('.tab').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
    $('#customer-select').addEventListener('change', event => switchCustomer(event.target.value));
    $('#language-select').addEventListener('change', event => { language = event.target.value; localStorage.setItem('ik-language', language); applyLanguage(); });
    $('#search-input').addEventListener('input', renderLookup);
    $('#category-filter').addEventListener('change', renderLookup);
    $('#customer-only').addEventListener('change', renderLookup);
    $('#new-quiz').addEventListener('click', buildQuiz);
    $('#training-category').addEventListener('change', buildQuiz);
    $('#training-count').addEventListener('change', buildQuiz);
    $('#training-customer').addEventListener('change', buildQuiz);
    $('#add-customer').addEventListener('click', () => openCustomerDialog());
    $('#edit-customer').addEventListener('click', () => openCustomerDialog(activeCustomer().id));
    $('#delete-customer').addEventListener('click', deleteCustomer);
    $('#customer-form').addEventListener('submit', saveCustomer);
    $('#add-code').addEventListener('click', () => openCodeDialog());
    $('#code-form').addEventListener('submit', saveCode);
    $('#close-detail-dialog').addEventListener('click', () => {
      $('#detail-dialog').hidden = true;
      document.body.classList.remove('detail-open');
    });
    $('#close-install-help').addEventListener('click', () => {
      $('#install-help').hidden = true;
      document.body.classList.remove('detail-open');
    });
    $$('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
    $('#export-data').addEventListener('click', exportData);
    $('#import-data').addEventListener('change', event => event.target.files[0] && importData(event.target.files[0]));
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
    $('#install-button').addEventListener('click', async () => {
      if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; return; }
      $('#install-help').hidden = false;
      document.body.classList.add('detail-open');
    });
    window.addEventListener('appinstalled', () => showToast('Appen er installeret'));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    const hash = location.hash.replace('#','');
    if (['opslag','lookup'].includes(hash)) setTab('lookup');
  }

  init();
})();
