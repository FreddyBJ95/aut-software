const translations = new Map([
  ['Anlægsgennemgang','Anleggsgjennomgang','Plant inspection'],
  ['Projekter','Prosjekter','Projects'],
  ['＋ Nyt projekt','＋ Nytt prosjekt','＋ New project'],
  ['Alle projekter','Alle prosjekter','All projects'],
  ['＋ Registrér fejl','＋ Registrer feil','＋ Log issue'],
  ['Etager og søjler','Etasjer og søyler','Floors and columns'],
  ['Etager','Etasjer','Floors'],
  ['Fx A12','F.eks. A12','E.g. A12'],
  ['Skriv søjlenummeret.','Skriv inn søylenummeret.','Enter the column number.'],
  ['Brug ét bogstav efterfulgt af et tal til hver søjle, fx A1 eller B12.','Bruk én bokstav etterfulgt av et tall for hver søyle, f.eks. A1 eller B12.','Use one letter followed by a number for each column, e.g. A1 or B12.'],
  ['Søjlenumre','Søylenumre','Column numbers'],
  ['Skriv én placering pr. linje.','Skriv én plassering per linje.','Enter one location per line.'],
  ['Gem placeringer','Lagre plasseringer','Save locations'],
  ['Firmalogo til rapporten','Firmalogo til rapporten','Company logo for the report'],
  ['Upload logo','Last opp logo','Upload logo'],
  ['Firmalogo','Firmalogo','Company logo'],
  ['Gem firmalogo','Lagre firmalogo','Save company logo'],
  ['Registrerede fejl','Registrerte feil','Logged issues'],
  ['Åbn fejlrapport','Åpne feilrapport','Open issue report'],
  ['Annullér','Avbryt','Cancel'],
  ['Nyt projekt','Nytt prosjekt','New project'],
  ['Bygning eller proces','Bygning eller prosess','Building or process'],
  ['Fx Neutraliseringsanlæg','F.eks. Nøytraliseringsanlegg','E.g. Neutralisation plant'],
  ['Skriv én placering pr. linje. Brug anlæggets egne betegnelser.','Skriv én plassering per linje. Bruk anleggets egne betegnelser.','Enter one location per line. Use the identifiers used at the plant.'],
  ['Opret projekt','Opprett prosjekt','Create project'],
  ['Registrér fejl','Registrer feil','Log issue'],
  ['Billeder','Bilder','Photos'],
  ['Nærbillede af fejlen','Nærbilde av feilen','Close-up of the issue'],
  ['Oversigtsbillede','Oversiktsbilde','Context photo'],
  ['Valgt nærbillede','Valgt nærbilde','Selected close-up'],
  ['Valgt oversigtsbillede','Valgt oversiktsbilde','Selected context photo'],
  ['Placering','Plassering','Location'],
  ['Etage','Etasje','Floor'],
  ['Søjlenummer','Søylenummer','Column number'],
  ['Skabs- eller følertag','Skap- eller følertag','Cabinet or sensor tag'],
  ['Fx SK-01 eller PT-201','F.eks. SK-01 eller PT-201','E.g. SK-01 or PT-201'],
  ['Maskine i nærheden','Maskin i nærheten','Nearby machine'],
  ['Fx ved pumpe P-201, på siden mod trappen','F.eks. ved pumpe P-201, på siden mot trappen','E.g. near pump P-201, on the side facing the stairs'],
  ['Fejltyper','Feiltyper','Issue types'],
  ['Ny fejltype','Ny feiltype','New issue type'],
  ['Fx Mangler blindprop','F.eks. Mangler blindplugg','E.g. Missing blanking plug'],
  ['Tilføj fejltype','Legg til feiltype','Add issue type'],
  ['Kommentar','Kommentar','Comment'],
  ['Beskriv fejlene ved placeringen','Beskriv feilene på stedet','Describe the issues at this location'],
  ['Gem registrering','Lagre registrering','Save issue'],
  ['Tilbage til projekt','Tilbake til prosjektet','Back to project'],
  ['Print / gem som PDF','Skriv ut / lagre som PDF','Print / save as PDF'],
  ['Handlingen kunne ikke gennemføres. Kontrollér browserens lagerplads og prøv igen.','Handlingen kunne ikke fullføres. Kontroller nettleserens lagringsplass og prøv igjen.','Could not complete the action. Check browser storage and try again.'],
  ['Skriv mindst ét søjlenummer.','Skriv minst ett søylenummer.','Enter at least one column number.'],
  ['etager','etasjer','floors'],
  ['søjler','søyler','columns'],
  ['Opret et projekt for den bygning eller proces, du skal gennemgå.','Opprett et prosjekt for bygningen eller prosessen du skal gå gjennom.','Create a project for the building or process you will inspect.'],
  ['Der er endnu ingen registrerede fejl.','Ingen feil er registrert ennå.','No issues logged yet.'],
  ['Nærbillede','Nærbilde','Close-up'],
  ['Vælg etage','Velg etasje','Select floor'],
  ['Vælg søjle','Velg søyle','Select column'],
  ['Skriv navnet på bygningen eller processen.','Skriv navnet på bygningen eller prosessen.','Enter the name of the building or process.'],
  ['Placeringer gemt.','Plasseringer lagret.','Locations saved.'],
  ['Vælg en fejltype, eller beskriv fejlen i kommentarfeltet.','Velg en feiltype, eller beskriv feilen i kommentarfeltet.','Select an issue type or describe the issue in the comment field.'],
  ['Registrering gemt.','Registrering lagret.','Issue saved.'],
  ['Fejl','Feil','Issue'],
  ['Søjle','Søyle','Column'],
  ['Firmalogo gemt.','Firmalogo lagret.','Company logo saved.'],
  ['Fejlrapport','Feilrapport','Issue report'],
  ['registrerede fejl','registrerte feil','logged issues'],
  ['Mangler kabelmærke','Mangler kabelmerking','Missing cable tag'],
  ['Mangler nippel','Mangler nippel','Missing cable gland'],
  ['Stue\n1. etage\n2. etage','Plan 0\n1. etasje\n2. etasje','Ground floor\nFloor 1\nFloor 2']
].map(([da, nb, en]) => [da, {da, nb, en}]));

const languageSelect = document.getElementById('language');
let language = localStorage.getItem('anlaegslog-language') || 'da';
const t = value => translations.get(value)?.[language] || value;
const staticLabels = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode;
  const label = node.textContent.trim();
  if (translations.has(label)) staticLabels.push([node, label]);
}
const staticAttributes = [...document.querySelectorAll('[placeholder], [alt]')].flatMap(node =>
  ['placeholder', 'alt'].filter(attr => translations.has(node.getAttribute(attr)))
    .map(attr => [node, attr, node.getAttribute(attr)])
);
function translatePage() {
  document.documentElement.lang = language;
  document.title = t('Anlægsgennemgang');
  languageSelect.value = language;
  for (const [node, label] of staticLabels) {
    const translated = t(label);
    if (node.parentElement instanceof HTMLTextAreaElement && node.parentElement.value === node.textContent) node.parentElement.value = translated;
    node.textContent = translated;
  }
  for (const [node, attr, value] of staticAttributes) node.setAttribute(attr, t(value));
}
translatePage();
