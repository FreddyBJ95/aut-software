const byId = id => document.getElementById(id);
const projectForm = byId('project-form');
const issueForm = byId('issue-form');
const typeInput = byId('type-input');
const floorNumbers = Array.from({length:51}, (_, index) => String(index));
const defaults = ['Mangler kabelmærke', 'Mangler nippel'];
let activeProject;
let lastFloor;
let draftTypes = [];
let view = 'home';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('anlaegsgennemgang', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('projects', {keyPath:'id'});
      db.createObjectStore('issues', {keyPath:'id'}).createIndex('projectId', 'projectId');
      db.createObjectStore('types', {keyPath:'key'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const database = openDatabase();
function transaction(db, stores, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const request = operation(tx);
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = () => reject(tx.error);
  });
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function show(id) {
  for (const screen of ['home','project','register','create','report']) byId(screen).hidden = id !== screen;
  if (view !== id) window.scrollTo(0, 0);
  view = id;
}

function notice(message) {
  byId('notice').textContent = t(message);
}

function run(task) {
  return async event => {
    event.preventDefault();
    const button = event.submitter || (event.currentTarget?.matches('button') ? event.currentTarget : null);
    if (button) button.disabled = true;
    notice('');
    try {
      await task(event);
    } catch (error) {
      console.error(error);
      notice('Handlingen kunne ikke gennemføres. Kontrollér browserens lagerplads og prøv igen.');
    } finally {
      if (button) button.disabled = false;
    }
  };
}

const urls = new Map();
function picture(img, blob) {
  if (urls.has(img)) URL.revokeObjectURL(urls.get(img));
  urls.delete(img);
  img.removeAttribute('src');
  img.hidden = !blob;
  if (blob) {
    const url = URL.createObjectURL(blob);
    urls.set(img, url);
    img.src = url;
  }
}

async function showProjects() {
  const db = await database;
  const projects = await transaction(db, ['projects'], 'readonly', tx => tx.objectStore('projects').getAll());
  activeProject = undefined;
  for (const img of byId('issues').querySelectorAll('img')) picture(img);
  byId('issues').replaceChildren();
  const list = byId('projects');
  list.replaceChildren();
  for (const project of projects.sort((a,b) => b.created - a.created)) {
    const button = element('button', '', 'card');
    button.append(element('strong', project.name));
    button.onclick = run(() => showProject(project));
    list.append(button);
  }
  if (!projects.length) list.append(element('p', t('Opret et projekt for den bygning eller proces, du skal gennemgå.'), 'empty'));
  show('home');
}

async function showProject(project) {
  const db = await database;
  const issues = await transaction(db, ['issues'], 'readonly', tx => tx.objectStore('issues').index('projectId').getAll(project.id));
  activeProject = project;
  issues.sort((a, b) => b.created - a.created);
  lastFloor = issues[0]?.floor;
  byId('project-name').textContent = project.name;
  picture(byId('logo-preview'), project.logo);
  byId('branding').reset();
  byId('report-button').disabled = !issues.length;
  const list = byId('issues');
  for (const img of list.querySelectorAll('img')) picture(img);
  list.replaceChildren();
  for (const issue of issues) {
    const card = element('details', '', 'card');
    card.append(element('summary', issueTitle(issue)));
    if (issue.landmark) card.append(element('p', t('Maskine i nærheden') + ' — ' + issue.landmark));
    if (issue.equipmentTag) card.append(element('p', t('Skabs- eller følertag') + ' — ' + issue.equipmentTag));
    card.append(element('p', issue.types.map(typeLabel).join(' · ') || t('Kommentar')));
    if (issue.comment) card.append(element('p', issue.comment, 'comment'));
    const gallery = element('div', '', 'grid photos');
    for (const [key, title] of [['close','Nærbillede'],['wide','Oversigtsbillede']]) {
      const figure = element('figure');
      const img = element('img');
      img.alt = t(title);
      img.loading = 'lazy';
      figure.append(element('figcaption', t(title)), img);
      gallery.append(figure);
      card.addEventListener('toggle', () => picture(img, card.open ? issue[key] : null));
    }
    card.append(gallery);
    list.append(card);
  }
  if (!issues.length) list.append(element('p', t('Der er endnu ingen registrerede fejl.'), 'empty'));
  show('project');
}

function fillSelect(select, entries, placeholder) {
  const empty = new Option(t(placeholder), '');
  empty.disabled = true;
  select.replaceChildren(empty, ...entries.map(value => new Option(value, value)));
  select.value = '';
}

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('da');
}

function addType(label, checked = false) {
  const existing = draftTypes.find(entry => normalize(entry.value) === normalize(label));
  if (existing) {
    if (checked) existing.checked = true;
    return;
  }
  const wrapper = element('label');
  const checkbox = element('input');
  checkbox.type = 'checkbox';
  checkbox.value = label;
  checkbox.checked = checked;
  wrapper.append(checkbox, document.createTextNode(typeLabel(label)));
  byId('types').append(wrapper);
  draftTypes.push(checkbox);
}

function clearIssue() {
  issueForm.reset();
  byId('types').replaceChildren();
  draftTypes = [];
  for (const img of issueForm.querySelectorAll('img')) picture(img);
}

async function register() {
  const db = await database;
  const types = await transaction(db, ['types'], 'readonly', tx => tx.objectStore('types').getAll());
  clearIssue();
  fillSelect(issueForm.elements.floor, floorNumbers, 'Vælg etage');
  const previous = lastFloor?.match(/\d+/)?.[0] ?? (lastFloor ? '0' : '');
  if (floorNumbers.includes(previous)) issueForm.elements.floor.value = previous;
  for (const label of [...defaults, ...types.map(type => type.label)]) addType(label);
  show('register');
}

byId('new-project').onclick = run(() => show('create'));
byId('back').onclick = run(showProjects);
byId('new-issue').onclick = run(register);
for (const button of document.querySelectorAll('.cancel')) {
  button.onclick = run(() => {
    if (view === 'register') clearIssue();
    show(activeProject ? 'project' : 'home');
  });
}
projectForm.onsubmit = run(async () => {
  const name = projectForm.elements.name.value.trim();
  if (!name) {
    notice('Skriv navnet på bygningen eller processen.');
    return;
  }
  const db = await database;
  const project = {id:crypto.randomUUID(), name, created:Date.now()};
  await transaction(db, ['projects'], 'readwrite', tx => tx.objectStore('projects').add(project));
  projectForm.reset();
  await showProject(project);
});
for (const name of ['close','wide']) {
  const input = issueForm.elements[name];
  input.addEventListener('change', () => picture(input.nextElementSibling, input.files[0]));
}
function addWrittenType() {
  const label = typeInput.value.trim().replace(/\s+/g, ' ');
  if (label) addType(label, true);
  typeInput.value = '';
}
byId('add-type').onclick = addWrittenType;
typeInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    addWrittenType();
  }
});
issueForm.onsubmit = run(async () => {
  addWrittenType();
  const data = new FormData(issueForm);
  const types = draftTypes.filter(entry => entry.checked).map(entry => entry.value);
  const comment = data.get('comment').trim();
  const column = data.get('column').trim();
  if (!column) {
    notice('Skriv søjlenummeret.');
    return;
  }
  if (!types.length && !comment) {
    notice('Vælg en fejltype, eller beskriv fejlen i kommentarfeltet.');
    return;
  }
  const db = await database;
  const issue = {
    id:crypto.randomUUID(), projectId:activeProject.id, created:Date.now(),
    floor:data.get('floor'), column, landmark:data.get('landmark').trim(), equipmentTag:data.get('equipmentTag').trim(), comment, types,
    close:data.get('close'), wide:data.get('wide')
  };
  await transaction(db, ['issues','types'], 'readwrite', tx => {
    for (const label of types) tx.objectStore('types').put({key:normalize(label), label});
    tx.objectStore('issues').add(issue);
  });
  clearIssue();
  await showProject(activeProject);
  notice('Registrering gemt.');
});
function updateNetwork() {
  byId('network').hidden = navigator.onLine;
}
window.addEventListener('online', updateNetwork);
window.addEventListener('offline', updateNetwork);
updateNetwork();
run(showProjects)(new Event('load'));
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

function issueTitle(issue) {
  return t('Fejl') + ' ' + issue.id.slice(0, 8).toUpperCase() + ' · ' + (floorNumbers.includes(issue.floor) ? t('Etage') + ' ' : '') + issue.floor + ' · ' + t('Søjle') + ' ' + issue.column;
}

byId('branding').onsubmit = run(async event => {
  const logo = event.currentTarget.elements.logo.files[0];
  const db = await database;
  const project = {...activeProject, logo};
  await transaction(db, ['projects'], 'readwrite', tx => tx.objectStore('projects').put(project));
  activeProject = project;
  picture(byId('logo-preview'), logo);
  event.target.reset();
  notice('Firmalogo gemt.');
});

function clearReport() {
  const content = byId('report-content');
  for (const img of content.querySelectorAll('img')) picture(img);
  content.replaceChildren();
}

byId('report-button').onclick = run(async () => {
  const db = await database;
  const project = activeProject;
  const issues = await transaction(db, ['issues'], 'readonly', tx => tx.objectStore('issues').index('projectId').getAll(project.id));
  clearReport();
  const content = byId('report-content');
  const orderedIssues = issues.sort((a, b) => a.created - b.created);
  const formatter = new Intl.DateTimeFormat(language);
  for (const [index, issue] of orderedIssues.entries()) {
    const card = element('article', '', 'report-issue');
    const header = element('div', '', 'report-header');
    const title = element('div');
    title.append(element('p', t('Fejlrapport'), 'report-label'), element('h2', project.name));
    header.append(title);
    if (project.logo) {
      const logo = element('img', '', 'logo');
      logo.alt = t('Firmalogo');
      picture(logo, project.logo);
      header.append(logo);
    }
    card.append(header);

    const details = element('dl', '', 'report-details');
    const fields = [
      ['Fejl', issue.id.slice(0, 8).toUpperCase()],
      ['Etage', issue.floor],
      ['Søjle', issue.column],
      ['Maskine i nærheden', issue.landmark],
      ['Skabs- eller følertag', issue.equipmentTag]
    ];
    for (const [label, value] of fields) {
      if (!value) continue;
      const field = element('div');
      field.append(element('dt', t(label)), element('dd', value));
      details.append(field);
    }
    card.append(details);
    const notes = element('div', '', 'report-notes');
    if (issue.types.length) notes.append(element('h3', t('Fejltyper')), element('p', issue.types.map(typeLabel).join(' · ')));
    if (issue.comment) notes.append(element('h3', t('Kommentar')), element('p', issue.comment, 'comment'));
    if (notes.childNodes.length) card.append(notes);
    const gallery = element('div', '', 'grid photos');
    for (const [key, caption] of [['wide', 'Oversigtsbillede'], ['close', 'Nærbillede af fejlen']]) {
      const figure = element('figure');
      const img = element('img');
      img.alt = t(caption);
      picture(img, issue[key]);
      figure.append(element('figcaption', t(caption)), img);
      gallery.append(figure);
    }
    const footer = element('div', '', 'report-footer');
    footer.append(element('span', formatter.format(new Date(issue.created))), element('span', (index + 1) + ' / ' + orderedIssues.length));
    card.append(gallery, footer);
    content.append(card);
  }
  show('report');
});
byId('report-back').onclick = run(() => {
  clearReport();
  show('project');
});
byId('print').onclick = run(async () => {
  await Promise.allSettled([...byId('report-content').querySelectorAll('img')].map(img => img.decode()));
  window.print();
});

function typeLabel(label) {
  return defaults.includes(label) ? t(label) : label;
}

languageSelect.addEventListener('change', run(async () => {
  language = languageSelect.value;
  localStorage.setItem('anlaegslog-language', language);
  const screen = view;
  translatePage();
  if (screen === 'home') await showProjects();
  if (screen === 'project') await showProject(activeProject);
  if (screen === 'report') byId('report-button').click();
  if (screen === 'register') {
    const fields = issueForm.elements;
    fields.floor.options[0].textContent = t('Vælg etage');
    for (const checkbox of draftTypes) checkbox.nextSibling.textContent = typeLabel(checkbox.value);
  }
}));
