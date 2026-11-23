window.IK_DATA = (() => {
  const firstLetters = [
    ['A','Analyse','Analysis'],['B','Brænder eller forbrænding','Burner / combustion'],['C','Ledningsevne','Conductivity'],
    ['D','Densitet','Density'],['E','Spænding','Voltage'],['F','Flow','Flow'],['G','Brugerdefineret','User-defined'],
    ['H','Håndbetjent','Hand / manual'],['I','Strøm','Current'],['J','Effekt','Power'],['K','Tid eller tidsplan','Time / schedule'],
    ['L','Niveau','Level'],['M','Fugtighed','Moisture / humidity'],['N','Brugerdefineret','User-defined'],
    ['O','Brugerdefineret','User-defined'],['P','Tryk eller vakuum','Pressure / vacuum'],['Q','Mængde eller hændelse','Quantity / event'],
    ['R','Stråling','Radiation'],['S','Hastighed eller frekvens','Speed / frequency'],['T','Temperatur','Temperature'],
    ['U','Flere variable','Multivariable'],['V','Vibration eller mekanisk analyse','Vibration / mechanical analysis'],
    ['W','Vægt eller kraft','Weight / force'],['X','Uklassificeret','Unclassified'],
    ['Y','Hændelse, tilstand eller tilstedeværelse','Event / state / presence'],['Z','Position eller dimension','Position / dimension']
  ];
  const functionLetters = [
    ['A','Alarm'],['C','Regulering eller controller'],['D','Differens'],['E','Følerelement'],['G','Skueglas eller lokal visning'],
    ['H','Høj'],['HH','Høj-høj'],['I','Indikering'],['L','Lav'],['LL','Lav-lav'],['O','Åben'],['R','Registrering'],
    ['S','Kontakt'],['T','Transmitter'],['V','Ventil, spjæld eller lamel'],['Y','Hjælpefunktion, relæ eller beregning'],['Z','Aktuator eller slutorgan']
  ];
  const variables = [
    ['A','Analyse','Analysis','Andre målinger'],['B','Forbrænding','Combustion','Andre målinger'],['C','Ledningsevne','Conductivity','Andre målinger'],
    ['D','Densitet','Density','Andre målinger'],['E','Spænding','Voltage','Andre målinger'],['F','Flow','Flow','Flow'],
    ['I','Strøm','Current','Andre målinger'],['J','Effekt','Power','Andre målinger'],['L','Niveau','Level','Niveau'],
    ['M','Fugtighed','Moisture / humidity','Andre målinger'],['P','Tryk','Pressure','Tryk'],['Q','Mængde','Quantity','Andre målinger'],
    ['R','Stråling','Radiation','Andre målinger'],['S','Hastighed','Speed / frequency','Andre målinger'],['T','Temperatur','Temperature','Temperatur'],
    ['U','Multivariabel','Multivariable','Andre målinger'],['V','Vibration','Vibration','Andre målinger'],['W','Vægt eller kraft','Weight / force','Andre målinger'],
    ['Z','Position','Position','Position']
  ];
  const functions = [
    ['I','indikator','Indicator','Indikering'],['T','transmitter','Transmitter','Transmitter'],['C','regulator','Controller','Regulering'],
    ['IC','visende regulator','Indicating Controller','Indikering og regulering'],['IR','visende registrering','Indicating Recorder','Indikering og registrering'],
    ['SL','kontakt lav','Switch Low','Kontakt ved lav grænse'],['SLL','kontakt lav-lav','Switch Low-Low','Kontakt ved kritisk lav grænse'],
    ['SH','kontakt høj','Switch High','Kontakt ved høj grænse'],['SHH','kontakt høj-høj','Switch High-High','Kontakt ved kritisk høj grænse'],
    ['AL','alarm lav','Alarm Low','Alarm ved lav grænse'],['ALL','alarm lav-lav','Alarm Low-Low','Alarm ved kritisk lav grænse'],
    ['AH','alarm høj','Alarm High','Alarm ved høj grænse'],['AHH','alarm høj-høj','Alarm High-High','Alarm ved kritisk høj grænse']
  ];
  const special = [
    {code:'PSV',da:'Tryksikkerhedsventil',en:'Pressure Safety Valve',category:'Sikkerhed',description:'Mekanisk sikkerhedsventil, der aflaster ved for højt tryk.',parts:[['P','Tryk'],['S','Sikkerhed'],['V','Ventil']]},
    {code:'SDV',da:'Nedlukningsventil',en:'Shutdown Valve',category:'Sikkerhed',description:'On/off-ventil, der bringer processen til en sikker tilstand ved nedlukning.',parts:[['SD','Nedlukning'],['V','Ventil']]},
    {code:'ESD',da:'Nødnedlukning',en:'Emergency Shutdown',category:'Sikkerhed',description:'Funktion eller system til kontrolleret nødnedlukning af et anlæg.',parts:[['E','Nød'],['SD','Nedlukning']]},
    {code:'HS',da:'Håndbetjent kontakt',en:'Hand Switch',category:'Operatør',description:'Kontakt eller betjening, som aktiveres manuelt af en operatør.',parts:[['H','Håndbetjent'],['S','Kontakt']]},
    {code:'HIC',da:'Håndbetjent visende regulator',en:'Hand Indicating Controller',category:'Operatør',description:'Manuel betjeningsfunktion med indikering og regulering.',parts:[['H','Håndbetjent'],['I','Indikering'],['C','Regulering']]},
    {code:'ZSO',da:'Positionskontakt åben',en:'Position Switch Open',category:'Position',description:'Tilbagemelding om åben position.',parts:[['Z','Position'],['S','Kontakt'],['O','Åben']]},
    {code:'ZSC',da:'Positionskontakt lukket',en:'Position Switch Closed',category:'Position',description:'Tilbagemelding om lukket position.',parts:[['Z','Position'],['S','Kontakt'],['C','Lukket']]},
    {code:'FCV',da:'Flowreguleringsventil',en:'Flow Control Valve',category:'Ventiler',description:'Reguleringsventil, der påvirker flowet.',parts:[['F','Flow'],['C','Regulering'],['V','Ventil']]},
    {code:'PCV',da:'Trykreguleringsventil',en:'Pressure Control Valve',category:'Ventiler',description:'Reguleringsventil, der påvirker trykket.',parts:[['P','Tryk'],['C','Regulering'],['V','Ventil']]},
    {code:'TCV',da:'Temperaturreguleringsventil',en:'Temperature Control Valve',category:'Ventiler',description:'Reguleringsventil, der påvirker temperaturen.',parts:[['T','Temperatur'],['C','Regulering'],['V','Ventil']]},
    {code:'LCV',da:'Niveaureguleringsventil',en:'Level Control Valve',category:'Ventiler',description:'Reguleringsventil, der påvirker niveauet.',parts:[['L','Niveau'],['C','Regulering'],['V','Ventil']]},
    {code:'HSV',da:'Projektbestemt kode',en:'Project-specific abbreviation',category:'Ventiler',description:'HSV har ikke én sikker, universel betydning.',parts:[['H','Kan betyde håndbetjent'],['S','Kan være kontakt, sikkerhed eller projektspecifik'],['V','Kan betyde ventil']],note:'Kontrollér altid kundens tegningsforklaring. HSV bruges forskelligt mellem projekter.',trainable:false}
  ];
  const map = new Map(special.map(item => [item.code,item]));
  variables.forEach(variable => functions.forEach(fn => {
    const code = variable[0] + fn[0];
    if (map.has(code)) return;
    const state = fn[0].slice(1);
    const threshold = state === 'L' ? 'Lav' : state === 'LL' ? 'Lav-lav' : state === 'H' ? 'Høj' : 'Høj-høj';
    const parts = fn[0] === 'IC' ? [['I','Indikering'],['C','Regulering']]
      : fn[0] === 'IR' ? [['I','Indikering'],['R','Registrering']]
      : fn[0].startsWith('S') ? [['S','Kontakt'],[state,threshold]]
      : fn[0].startsWith('A') ? [['A','Alarm'],[state,threshold]] : [[fn[0],fn[3]]];
    map.set(code,{code,da:variable[1]+fn[1],en:variable[2]+' '+fn[2],category:variable[3],description:`${fn[3]} for ${variable[1].toLocaleLowerCase('da')}.`,parts:[[variable[0],variable[1]],...parts]});
  }));
  const codes = [...map.values()].sort((a,b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  return {codes,firstLetters,functionLetters};
})();
