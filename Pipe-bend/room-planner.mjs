import {hasSpatialPipe} from './spatial-geometry.mjs?v=44';
import {generateWallRoute,validateWallRoute,wallLayout,pointOnWall,wallObstaclePolygon} from './wall-routing.mjs?v=44';
import {layoutLocalWallLabels,wallSegmentFootprint,wallDirectionArrow} from './wall-label-layout.mjs?v=44';
import {rectPolygon} from './dimension-layout.mjs?v=44';
import {pipeModelFromPoints} from './wall-pipe-edit.mjs?v=44';
import {solveWallPipeEdit} from './wall-pipe-solver.mjs?v=44';
import {buildRouteGeometry} from './room-routing.mjs?v=44';
import {createWallViewport} from './wall-viewport.mjs?v=44';
import {geometryToSvgPath,getWallClearanceDimensions} from './wall-detail-geometry.mjs?v=44';
import {pickPipePart,pickWallSegment} from './wall-picking.mjs?v=44';
import {setIconButton} from './ui-icons.mjs?v=44';
import {projectIdentity,projectOpenKey,readWallDraft,writeWallDraft,clearWallDraft} from './project-storage.mjs?v=44';

const words={
  title:['Tegn vægforløb','Tegn veggforløp','Draw the wall path'],
  intro:['Tegn kun den væg, røret skal følge · alle mål i mm','Tegn bare veggen røret skal følge · alle mål i mm','Draw only the wall the pipe will follow · all dimensions in mm'],
  close:['Tilbage til røret','Tilbake til røret','Back to the pipe'],wallStage:['1 · Tegn væggen','1 · Tegn veggen','1 · Draw the wall'],
  zoomIn:['Zoom ind','Zoom inn','Zoom in'],zoomOut:['Zoom ud','Zoom ut','Zoom out'],zoomFit:['Tilpas visning','Tilpass visning','Fit drawing'],panHint:['Træk for at flytte · Brug + / − eller to fingre til zoom','Dra for å flytte · Bruk + / − eller to fingre for zoom','Drag to pan · Use + / − or two fingers to zoom'],pipePart:['Vælg rørstykke eller buk','Velg rørstykke eller bøy','Choose pipe section or bend'],wallOverview:['Vægmål og oversigt','Veggmål og oversikt','Wall dimensions and overview'],
  settingsTabs:['Vægindstillinger','Vegginnstillinger','Wall settings'],tabWalls:['Vægge','Vegger','Walls'],tabPlacement:['Placering','Plassering','Placement'],tabClips:['Klammer','Klammer','Clips'],tabObstacles:['Forhindringer','Hindringer','Obstacles'],
  angleInfo:['Om bukkevinkler','Om bøyevinkler','About bend angles'],
  measuredGap:['Fri afstand','Fri avstand','Clear gap'],zoomWallGroup:['Zoom ind på vægstykkerne','Zoom inn på veggstykkene','Zoom into these wall segments'],
  wallHint:['Byg væggen med længder og vinkler, ligesom du tegner røret. Væggen behøver ikke slutte, hvor den starter.','Bygg veggen med lengder og vinkler, som når du tegner røret. Veggen trenger ikke ende der den starter.','Build the wall with lengths and turns, just like drawing the pipe. The wall does not need to form a closed room.'],
  wall:['Væg','Vegg','Wall'],wallLength:['Væglængde · mm','Vegglengde · mm','Wall length · mm'],nextLength:['Næste vægstykke · mm','Neste veggstykke · mm','Next wall segment · mm'],
  turn:['Drejning · °','Sving · °','Turn · °'],direction:['Drej mod','Sving mot','Turn toward'],left:['Venstre','Venstre','Left'],right:['Højre','Høyre','Right'],
  addWall:['Tilføj vægstykke','Legg til veggstykke','Add wall segment'],firstWall:['Tilføj første vægstykke','Legg til første veggstykke','Add first wall segment'],
  side:['Røret skal sidde på','Røret skal sitte på','Place the pipe on'],sideLeft:['Venstre side af tegneretningen','Venstre side av tegneretningen','Left side of the drawing direction'],sideRight:['Højre side af tegneretningen','Høyre side av tegneretningen','Right side of the drawing direction'],
  sideHint:['Pilene viser væggens tegneretning. Vælg, hvilken side røret skal følge.','Pilene viser veggens tegneretning. Velg hvilken side røret skal følge.','Arrows show the wall drawing direction. Choose which side the pipe should follow.'],
  selected:['Valgt vægstykke','Valgt veggstykke','Selected wall segment'],selectWall:['Vælg vægstykke','Velg veggstykke','Choose wall segment'],
  selectionHint:['Tryk på et vægstykke i tegningen for at placere klammer og forhindringer på det.','Trykk på et veggstykke i tegningen for å plassere klammer og hindringer der.','Select a wall segment in the drawing to place clips and obstacles on it.'],
  pipe:['2 · Rør og ender','2 · Rør og ender','2 · Pipe and endpoints'],diameter:['Rørdiameter','Rørdiameter','Tube diameter'],radius:['Centerlinjeradius','Senterlinjeradius','Centerline radius'],
  toolHint:['Diameter og radius følger rørindstillingerne.','Diameter og radius følger rørinnstillingene.','Diameter and radius come from pipe settings.'],
  gap:['Fri afstand: væg → rørets yderside','Fri avstand: vegg → rørets utside','Clear distance: wall → outside of pipe'],
  clearance:['Fri afstand til forhindringer','Fri avstand til hindringer','Clearance from obstacles'],maxAngle:['Største vinkel pr. buk','Største vinkel per bøy','Maximum angle per bend'],
  angleSplitHint:['Ved forhindringer prøves {angle}° først. Højst {angle}° pr. buk betyder mindst {count} buk i et 90°-hjørne. Tillad 90°-buk, hvis hjørnet skal kunne laves med ét buk. Radius og plads kontrolleres stadig.','Ved hindringer prøves {angle}° først. Maks {angle}° per bøy betyr minst {count} bøyer i et 90°-hjørne. Tillat 90°-bøy hvis hjørnet skal kunne lages med én bøy. Radius og plass kontrolleres fortsatt.','For obstacles, {angle}° is tried first. A {angle}° limit means at least {count} bends at a 90° corner. Allow 90° bends to permit a single bend. Radius and available space are still checked.'],
  angleSingleHint:['Ved forhindringer prøves 90° først. Et 90°-hjørne kan laves med ét 90°-buk, når radius og plads tillader det. Omveje ved forhindringer kan stadig bruge flere mindre buk.','Ved hindringer prøves 90° først. Et 90°-hjørne kan lages med én 90°-bøy når radius og plass tillater det. Omveier ved hindringer kan fortsatt bruke flere mindre bøyer.','For obstacles, 90° is tried first. A 90° corner can use one 90° bend when the radius and available space permit it. Detours around obstacles may still use several smaller bends.'],
  angleAlternatives:['Søgningen kan prøve mindre vinkler ({angles}); den konkrete vinkel vises ved tegningen.','Søket kan prøve mindre vinkler ({angles}); den faktiske vinkelen vises ved tegningen.','The search may try smaller angles ({angles}); the actual angle is shown beside the drawing.'],
  detourFallback:['Den valgte vinkel på {requested}° kunne ikke bruges ved alle forhindringer i det fundne forslag. Der bruges også buk på {used}°.','Den valgte vinkelen på {requested}° kunne ikke brukes ved alle hindringer i forslaget som ble funnet. Det brukes også bøyer på {used}°.','The selected {requested}° angle could not be used at every obstacle in the proposal found. The proposal also uses {used}° bends.'],
  allow90:['Tillad 90°-buk og lav nyt forslag','Tillat 90°-bøy og lag nytt forslag','Allow 90° bends and recalculate'],
  start:['Start A','Start A','Start A'],end:['Slut B','Slutt B','End B'],position:['Fra vægstykkets start · mm','Fra veggstykkets start · mm','From segment start · mm'],
  positionsHint:['Placeringer måles fra starten af det valgte vægstykke, i pilens retning.','Plasseringer måles fra starten av valgt veggstykke, i pilens retning.','Measure positions from the start of the selected wall segment, in the arrow direction.'],
  placements:['3 · Klammer og forhindringer','3 · Klammer og hindringer','3 · Clips and obstacles'],clips:['Klammer','Klammer','Pipe clips'],addClip:['Tilføj klamme','Legg til klammer','Add clip'],clip:['Klamme','Klammer','Clip'],
  obstacles:['Forhindringer på væggen','Hindringer på veggen','Wall obstacles'],addObstacle:['Tilføj forhindring','Legg til hindring','Add obstacle'],obstacle:['Forhindring','Hindring','Obstacle'],
  obstacleWidth:['Bredde langs væg · mm','Bredde langs vegg · mm','Width along wall · mm'],obstacleDepth:['Fremspring fra væg · mm','Fremspring fra vegg · mm','Projection from wall · mm'],
  remove:['Fjern','Fjern','Remove'],generate:['Foreslå rørføring','Foreslå rørføring','Propose pipe route'],preview:['Dit vægforløb','Ditt veggforløp','Your wall path'],
  previewEmpty:['Tilføj et vægstykke for at begynde.','Legg til et veggstykke for å begynne.','Add a wall segment to begin.'],
  wallMeasurements:['Vægmål · tryk for at vælge','Veggmål · trykk for å velge','Wall dimensions · select a segment'],
  compactHint:['Små vægstykker har nummerhenvisninger. Alle mål står i listen nedenfor.','Små veggstykker har nummerhenvisninger. Alle mål står i listen nedenfor.','Small wall segments use numbered callouts. Every dimension is listed below.'],
  previewHint:['Væggen vises, mens du tegner. Tilføj mål og placeringer, og vælg derefter Foreslå rørføring.','Veggen vises mens du tegner. Legg til mål og plasseringer, og velg deretter Foreslå rørføring.','The wall appears as you draw. Add dimensions and placements, then choose Propose pipe route.'],
  geometryHint:['Forslaget kontrolleres med den valgte radius, klammer, vægge og forhindringer.','Forslaget kontrolleres med valgt radius, klammer, vegger og hindringer.','The proposal is checked against the selected radius, clips, walls and obstacles.'],
  pipeEdit:['Rediger rør','Rediger rør','Edit pipe'],pipeEditHint:['Ret rørets længder og vinkler her. Væggen ligger fast. Rettelser kontrolleres mod radius, vægge, klammer og forhindringer.','Endre rørets lengder og vinkler her. Veggen ligger fast. Endringer kontrolleres mot radius, vegger, klammer og hindringer.','Edit pipe lengths and bend angles here. The wall stays fixed. Edits are checked against radius, walls, clips and obstacles.'],
  autoAdjusted:['Automatisk tilpasset','Automatisk tilpasset','Adjusted automatically'],
  pipeLength:['Færdigmål til centerlinjehjørne · mm','Ferdigmål til senterlinjehjørne · mm','Finished centerline-corner length · mm'],pipeAngle:['Bukkevinkel · °','Bøyevinkel · °','Bend angle · °'],pipeDirection:['Buk mod','Bøy mot','Bend toward'],selectPipe:['Rør','Rør','Pipe'],selectWallMode:['Væg','Vegg','Wall'],modeHint:['Vælg Rør for at trykke på et rørstykke eller buk. Vælg Væg for at rette væggen og placeringerne.','Velg Rør for å trykke på et rørstykke eller en bøy. Velg Vegg for å endre veggen og plasseringene.','Choose Pipe to select a pipe section or bend. Choose Wall to edit walls and placements.'],
  pipeConstraints:['Dit valgte mål fastholdes. Andre længder og vinkler kan tilpasses automatisk, mens A, B, vægge, klammer og forhindringer ligger fast. Se tilpasningerne, før du bruger forslaget.','Det valgte målet beholdes. Andre lengder og vinkler kan tilpasses automatisk, mens A, B, vegger, klammer og hindringer ligger fast. Se tilpasningene før du bruker forslaget.','Your selected dimension stays fixed. Other lengths and angles may adjust automatically while A, B, walls, clips and obstacles stay fixed. Review the adjustments before applying.'],
  undoPipe:['Fortryd rørrettelse','Angre rørendring','Undo pipe edit'],restorePipe:['Gendan seneste gyldige rør','Gjenopprett siste gyldige rør','Restore last valid pipe'],advanced:['Avanceret · hjørnepunkter X/Y','Avansert · hjørnepunkter X/Y','Advanced · corner coordinates X/Y'],unsafePipe:['Rettelsen er ikke gyldig og kan ikke bruges.','Endringen er ikke gyldig og kan ikke brukes.','This edit is invalid and cannot be applied.'],
  route:['Ret forslagets hjørner','Endre forslagets hjørner','Edit proposed corners'],routeHint:['Rettelser skal kontrolleres før brug. Du kan også rette længder og vinkler i appen bagefter.','Endringer må kontrolleres før bruk. Du kan også endre lengder og vinkler i appen etterpå.','Validate edits before use. You can also edit lengths and angles in the app afterward.'],
  point:['Punkt','Punkt','Point'],addPoint:['Indsæt punkt før slut','Sett inn punkt før slutt','Insert point before end'],validate:['Kontrollér rettelser','Kontroller endringer','Validate edits'],
  apply:['Brug rørforslaget','Bruk rørforslaget','Use proposed pipe'],cancel:['Annuller','Avbryt','Cancel'],
  validated:['Rørføringen er kontrolleret.','Rørføringen er kontrollert.','The pipe route has been validated.'],edited:['Forslaget er ændret. Kontrollér rettelserne før brug.','Forslaget er endret. Kontroller endringene før bruk.','The proposal has changed. Validate the edits before use.'],
  changed:['Væg eller placeringer er ændret. Lav et nyt forslag.','Vegg eller plasseringer er endret. Lag et nytt forslag.','The wall or placements changed. Generate a new proposal.'],
  invalid:['Kontrollér de indtastede mål.','Kontroller målene du har skrevet inn.','Check the entered dimensions.'],unexpected:['Forslaget kunne ikke beregnes. Kontrollér mål og placeringer.','Forslaget kunne ikke beregnes. Kontroller mål og plasseringer.','The route could not be calculated. Check dimensions and positions.'],
  rejected:['Rørforslaget kunne ikke bruges.','Rørforslaget kunne ikke brukes.','The proposed pipe could not be applied.'],bends:['buk','bøy','bends'],length:['Geometrisk længde','Geometrisk lengde','Geometric length'],
  wallLegend:['Væg','Vegg','Wall'],clipLegend:['Klamme','Klammer','Clip'],obstacleLegend:['Forhindring','Hindring','Obstacle'],routeLegend:['Kontrolleret rør','Kontrollert rør','Validated pipe'],pipeSide:['Rørside','Rørside','Pipe side'],
  legacy:['Din tidligere rumplan er åbnet som fire vægstykker. Mål, placeringer og rørforslag er bevaret. Du kan nu redigere vægstykkerne.','Den tidligere romplanen er åpnet som fire veggstykker. Mål, plasseringer og rørforslag er beholdt. Du kan nå redigere veggstykkene.','Your previous room plan is open as four wall segments. Dimensions, placements and the pipe route are preserved. You can now edit the wall segments.'],
  invalidSaved:['De gemte vægdata kunne ikke åbnes. Det eksisterende rør er bevaret. Kontrollér vægforløbet og lav et nyt forslag.','De lagrede veggdataene kunne ikke åpnes. Det eksisterende røret er beholdt. Kontroller veggforløpet og lag et nytt forslag.','The saved wall data could not be opened. The existing pipe is preserved. Check the wall path and generate a new proposal.'],
  spatialBoundary:['Vægudkastet er 2D. Røret med højdeskift bevares og kan ikke kontrolleres eller erstattes her. Opret et nyt rør, hvis du vil bruge vægforslaget.','Veggutkastet er 2D. Røret med høydeforskjeller beholdes og kan ikke kontrolleres eller erstattes her. Opprett et nytt rør hvis du vil bruke veggforslaget.','The wall draft is 2D. The pipe with height changes is preserved and cannot be checked or replaced here. Create a new pipe to use the wall proposal.'],
  noWalls:['Tilføj et vægstykke først.','Legg til et veggstykke først.','Add a wall segment first.'],
};
const clone=value=>JSON.parse(JSON.stringify(value));

/** Preserve the measured rectangle and route when opening a saved version-one plan. */
export function migrateRoomPlanner(planner) {
  if(planner===undefined||planner===null)return null;
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const invalid=()=>({error:'De gemte vægdata kunne ikke åbnes. Det eksisterende rør er bevaret. Tegn vægforløbet igen, eller åbn projektfilen med gyldige vægdata.'});
  try {
    if(!record(planner)||!record(planner.input)||![1,2].includes(planner.version))return invalid();
    let next;
    if(planner.version===2)next=clone(planner);
    else {
      const c=clone(planner.input),w=c.width,h=c.height;
      if(!finite(w)||!finite(h)||w<=0||h<=0||!record(c.start)||!record(c.end)||!Array.isArray(c.clips??[])||!Array.isArray(c.obstacles??[]))return invalid();
      const indexes={bottom:0,right:1,top:2,left:3};
      const anchor=a=>{if(!record(a)||!(a.wall in indexes)||!finite(a.position))throw new TypeError('Invalid saved wall anchor.');return {...a,segment:indexes[a.wall],position:a.wall==='top'?w-a.position:a.wall==='left'?h-a.position:a.position};};
      const obstacles=(c.obstacles||[]).map(a=>({...anchor(a),position:a.wall==='top'?w-a.position-a.width:a.wall==='left'?h-a.position-a.width:a.position}));
      const input={wall:{lengths:[w,h,w,h],turns:[90,90,90],heading:0,side:'left'},diameter:c.diameter,radius:c.radius,wallGap:c.wallGap??50,clearance:c.clearance??10,maxAngle:c.maxAngle??90,start:anchor(c.start),end:anchor(c.end),clips:(c.clips||[]).map(anchor),obstacles};
      next={version:2,input,points:clone(planner.points||[]),migrated:true,routeEdited:!!planner.routeEdited};
    }
    const c=next.input,w=c.wall;
    if(!record(w)||!Array.isArray(w.lengths)||!Array.isArray(w.turns)||w.lengths.length>100||!w.lengths.every(finite)||!w.turns.every(finite)||!finite(w.heading??0)||!['left','right'].includes(w.side??'left')||!['wallGap','clearance','maxAngle'].every(key=>finite(c[key]))||!record(c.start)||!record(c.end)||!Array.isArray(c.clips??[])||!Array.isArray(c.obstacles??[])||(c.clips?.length??0)>100||(c.obstacles?.length??0)>40)return invalid();
    const validAnchor=a=>record(a)&&Number.isInteger(a.segment)&&finite(a.position)&&(a.gap===undefined||finite(a.gap));
    if(!validAnchor(c.start)||!validAnchor(c.end)||!(c.clips||[]).every(validAnchor)||!(c.obstacles||[]).every(a=>validAnchor(a)&&finite(a.width)&&finite(a.depth)))return invalid();
    if(!Array.isArray(next.points)||next.points.length<2||next.points.length>400||!next.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite))){next.points=[];next.savedError=true;}
    return next;
  }catch{return invalid();}
}

/** Portable working copies may be physically invalid, but their data must be
 * finite and editable. Empty walls/points and a rejected numeric target are
 * legitimate drafts; malformed coordinates or metadata are rejected. */
export function normalizeWallDraft(planner) {
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const invalid=()=>({error:'Vægudkastet har ugyldige data. Projektet er ikke ændret.'});
  if(!record(planner)||!Array.isArray(planner.points)||planner.points.length===1||planner.points.length>400||!Array.from(planner.points).every(p=>Array.isArray(p)&&p.length===2&&finite(p[0])&&finite(p[1])))return invalid();
  const next=migrateRoomPlanner(planner);if(!next||next.error)return invalid();
  const input=next.input,wall=input.wall;
  if(wall.turns.length!==Math.max(0,wall.lengths.length-1))return invalid();
  if(![input.start,input.end,...(input.clips||[]),...(input.obstacles||[])].every(a=>a.id===undefined||typeof a.id==='string'&&a.id.length<=256))return invalid();
  for(const key of ['pipeEdited','routeEdited'])if(next[key]!==undefined&&typeof next[key]!=='boolean')return invalid();
  if(next.pipeEditPending!==undefined&&next.pipeEditPending!==null){
    const pending=next.pipeEditPending,count=next.points.length;
    if(!record(pending)||!['length','turn'].includes(pending.type)||!Number.isInteger(pending.index)||pending.index<0||pending.index>=(pending.type==='length'?count-1:count-2)||typeof pending.raw!=='string'||pending.raw.length>100||(pending.direction!==undefined&&![1,-1].includes(pending.direction))||(pending.code!==undefined&&(typeof pending.code!=='string'||pending.code.length>100))||(pending.error!==undefined&&(typeof pending.error!=='string'||pending.error.length>2000)))return invalid();
    next.pipeEditPending={type:pending.type,index:pending.index,raw:pending.raw,direction:pending.direction===-1?-1:1,code:pending.code||'EDIT_NO_SOLUTION',error:pending.error||'Rettelsen kunne ikke tilpasses. Røret er ikke ændret.'};
  }
  if(next.pipeAdjustments!==undefined&&(!Array.isArray(next.pipeAdjustments)||next.pipeAdjustments.length>400||!next.pipeAdjustments.every(change=>record(change)&&['length','turn'].includes(change.type)&&Number.isInteger(change.index)&&change.index>=0&&change.index<(change.type==='length'?next.points.length-1:next.points.length-2)&&finite(change.from)&&finite(change.to))))return invalid();
  if(next.pipeDetourNotice!==undefined&&next.pipeDetourNotice!==null){const notice=next.pipeDetourNotice;if(!validDetourPair(notice,input))return invalid();next.pipeDetourNotice={requested:notice.requested,used:notice.used};if(next.pipeEdited||next.routeEdited||next.pipeEditPending||next.points.length<2)delete next.pipeDetourNotice;}else delete next.pipeDetourNotice;
  if(planner.points.length===0)next.savedError=false;
  return next;
}

function validDetourPair(notice,data){return notice!==null&&typeof notice==='object'&&!Array.isArray(notice)&&typeof notice.requested==='number'&&Number.isFinite(notice.requested)&&typeof notice.used==='number'&&Number.isFinite(notice.used)&&notice.used>0&&notice.used<notice.requested&&notice.requested<=90&&typeof data?.maxAngle==='number'&&Number.isFinite(data.maxAngle)&&data.maxAngle>0&&Math.abs(notice.requested-Math.min(90,data.maxAngle))<=1e-7;}
function sameDetourContext(a,b){if(typeof a==='number'||typeof b==='number')return typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7;if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a),other=Object.keys(b);return keys.length===other.length&&keys.every(key=>Object.hasOwn(b,key)&&sameDetourContext(a[key],b[key]));}

const routeErrors={
  INVALID_WALL:['Kontroller veggstykkene, lengdene og vinklene. Bruk positive lengder og svinger mindre enn 180°.','Check wall segments, lengths and turns. Use positive lengths and turns below 180°.'],
  WALL_SELF_INTERSECTION:['Veggforløpet krysser seg selv. Rett veggstykkene.','The wall path crosses itself. Correct the wall segments.'],
  CLIP_ORDER:['Klammernes rekkefølge passer ikke mellom start og slutt. Flytt endepunkter eller klammer.','The clip order does not fit between start and end. Move endpoints or clips.'],
  CORNER_SPACE:['Det er ikke plass til røret ved et vegghjørne. Flytt endepunkter eller klammer lenger fra hjørnet, eller reduser radiusen.','There is not enough room at a wall corner. Move endpoints or clips farther from the corner, or reduce the radius.'],
  INVALID_INPUT:['Kontroller veggmål, rørdiameter, bøyeradius, veggavstand og maksimal vinkel. Bruk gyldige tall, høyst 100 klammer og 40 hindringer.','Check the wall dimensions, tube diameter, bend radius, wall gap and maximum angle. Use finite numbers, at most 100 clips and 40 obstacles.'],
  INVALID_ENDPOINT:['Start og slutt må ligge på en gyldig vegg, med plass til rørets utside. Kontroller vegg og plassering.','Start and end must be on valid walls with room for the outside of the pipe. Check their walls and positions.'],
  INVALID_CLIP:['Et klammer ligger utenfor veggforløpet eller har ugyldig veggavstand. Kontroller klammernes vegger, plasseringer og avstander.','A clip is outside the wall path or has an invalid wall gap. Check the clips’ walls, positions and gaps.'],
  INVALID_OBSTACLE:['En hindring har ugyldige mål eller ligger utenfor veggen. Kontroller plassering, bredde og fremspring.','An obstacle has invalid dimensions or extends past its wall. Check its position, width and projection.'],
  IDENTICAL_ENDPOINTS:['Start og slutt ligger i samme punkt. Flytt ett av endepunktene.','Start and end are the same point. Move one of the endpoints.'],
  BLOCKED_ANCHOR:['{id} ligger for nær en vegg eller hindring. Flytt punktet eller øk veggavstanden.','{id} is too close to a wall or obstacle. Move the point or increase its wall gap.'],
  INVALID_POINTS:['Rørføringen må ha minst to gyldige punkter. Kontroller punktenes X- og Y-mål.','The route needs at least two valid points. Check the points’ X and Y coordinates.'],
  TOO_MANY_BENDS:['Forslaget krever mer enn 200 rette stykker. Bruk større bukkevinkler eller færre hjørner.','The proposal needs more than 200 straight sections. Use larger bend angles or fewer corners.'],
  ZERO_LENGTH:['To hjørner ligger i samme punkt. Flytt eller fjern ett av punktene.','Two corners are at the same point. Move or remove one of them.'],
  REVERSAL:['Rørføringen snur rett tilbake i et hjørne. Flytt eller fjern dette hjørnet.','The route doubles directly back at a corner. Move or remove that corner.'],
  MAX_ANGLE:['En bøy på {angle}° overstiger maksimal vinkel på {limit}°. Flytt hjørnet eller øk den tillatte vinkelen.','A {angle}° bend exceeds the {limit}° maximum. Move the corner or increase the allowed angle.'],
  LOCAL_EDIT_SPACE:['Det er ikke plass til denne lengden mellom de faste rørstykkene. Velg en kortere lengde.','There is not enough room for this length between the fixed pipe sections. Choose a shorter length.'],
  EDIT_NO_SOLUTION:['Endringen kunne ikke tilpasses med de faste endene, veggene, klammerne og hindringene. Røret er ikke endret. Prøv et annet mål eller en annen vinkel.','This edit could not be fitted with the fixed endpoints, walls, clips and obstacles. The pipe has not changed. Try another dimension or angle.'],
  EDIT_INVALID_VALUE:['Skriv inn en gyldig positiv lengde eller bøyevinkel under 179°.','Enter a valid positive length or bend angle below 179°.'],
  INSUFFICIENT_STRAIGHT:['Det er ikke plass til bøyeradiusen mellom hjørnene. Flytt punktene lenger fra hverandre eller bruk mindre radius.','There is not enough straight length for the bend radius between corners. Move the points farther apart or use a smaller radius.'],
  WALL_COLLISION:['Røret kommer for nær eller krysser en tegnet vegg. Flytt hjørnene til riktig side av veggen.','The pipe is too close to or crosses a drawn wall. Move the corners to the selected pipe side.'],
  OBSTACLE_COLLISION:['Røret treffer en hindring eller har for liten fri avstand. Flytt hjørnene lenger fra hindringen.','The pipe hits an obstacle or has insufficient clearance. Move the corners farther from the obstacle.'],
  MISSED_CLIP:['Røret går ikke gjennom klammer {id} på et rett stykke langs veggen. Flytt hjørnene eller klammeret.','The pipe does not pass through clip {id} on a straight section parallel to the wall. Move the corners or the clip.'],
  SELF_COLLISION:['Rørføringen krysser seg selv eller kommer for nær seg selv. Flytt eller fjern hjørner.','The route crosses itself or passes too close to itself. Move or remove corners.'],
  ENDPOINT_MISMATCH:['Rørføringens ender passer ikke til valgt start og slutt. Gjenopprett endepunktene eller endre start- og sluttplasseringen.','The route ends do not match the selected start and end. Restore the endpoints or change the start/end positions.'],
  CLIP_SPACE:['Det er ikke plass til klammernes veggavstander mellom hindringene. Flytt klammer eller hindringer, eller reduser avstandene.','There is not enough space for the clips’ wall gaps between obstacles. Move clips or obstacles, or reduce the gaps.'],
  ENDPOINT_SPACE:['Start eller slutt ligger for nær et hjørne eller en hindring. Flytt endepunktet lenger langs veggen.','Start or end is too close to a corner or obstacle. Move the endpoint farther along the wall.'],
  MAX_ANGLE_SPACE:['Det er ikke plass til den valgte maksimale bukkevinkelen. Prøv større vinkel, mindre radius eller mer plass.','There is not enough space for the selected maximum bend angle. Try a larger angle, a smaller radius or more space.'],
  NO_ROUTE:['Fant ingen kontrollert rørføring langs veggene. Kontroller veggmål, klammer, hindringer, veggavstand og bøyeradius.','No validated route along the walls was found. Check the wall path dimensions, clips, obstacles, wall gap and bend radius.'],
  ROUTE_COMPLEXITY:['Rørføringen er for komplisert å kontrollere. Bruk færre punkter, klammer eller hindringer, eller større bukkevinkler.','The route is too complex to validate. Use fewer points, clips or obstacles, or larger bend angles.'],
};

/** Keep detailed source errors in Danish, and provide actionable translated errors elsewhere. */
export function roomPlannerError(result,language='da') {
  const fallback=language==='en'?'The route could not be calculated. Check dimensions and positions.':language==='nb'?'Rørføringen kunne ikke beregnes. Kontroller mål og plasseringer.':'Rørføringen kunne ikke beregnes. Kontrollér mål og placeringer.';
  if(language!=='nb'&&language!=='en')return result?.code==='EDIT_NO_SOLUTION'?'Rettelsen kunne ikke tilpasses med de faste ender, vægge, klammer og forhindringer. Røret er ikke ændret. Prøv et andet mål eller en anden vinkel.':result?.error||fallback;
  if(!result?.code)return result?.error||fallback;
  const source=String(result.error||'');
  const id=result.anchorId??result.clipId??result.id??(result.code==='BLOCKED_ANCHOR'?source.match(/^(.+?) ligger for tæt på/)?.[1]:source.match(/klamme (.+?) på et lige stykke/)?.[1]);
  const pointName=id==='Start'?'Start A':id==='Slut'?(language==='en'?'End B':'Slutt B'):id|| (language==='en'?'the selected point':'det valgte punktet');
  const angles=source.match(/Et buk på ([\d.,]+)° overstiger den maksimale vinkel på ([\d.,]+)°/);
  const values={id:pointName,angle:result.angle??angles?.[1]??'?',limit:result.maxAngle??angles?.[2]??'?'};
  const translated=code=>(routeErrors[code==='TOO_COMPLEX'?'ROUTE_COMPLEXITY':code]||routeErrors.NO_ROUTE)[language==='en'?1:0].replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
  let message=translated(result.code);
  if(result.code==='NO_ROUTE') {
    const detail=[['BLOCKED_ANCHOR',/ligger for tæt på/],['MISSED_CLIP',/passer ikke gennem klamme/],['OBSTACLE_COLLISION',/rammer en forhindring/],['INSUFFICIENT_STRAIGHT',/ikke plads til bukkeradius/],['MAX_ANGLE_SPACE',/ikke plads til den valgte maksimale bukkevinkel/],['CLIP_SPACE',/klammernes vægafstande/],['ENDPOINT_SPACE',/Start eller slut ligger for tæt/]].find(([,pattern])=>pattern.test(source));
    if(detail)message+=' '+translated(detail[0]);
  }
  return message;
}


/** New wall drafts allow ordinary corners in one bend; saved choices are not changed. */
export function defaultWallPlanInput() {
  return {wall:{lengths:[],turns:[],heading:0,side:'left'},wallGap:50,clearance:10,maxAngle:90,start:{segment:-1,position:0},end:{segment:-1,position:0},clips:[],obstacles:[]};
}

export function wallBendAngleHint(maxAngle,language='da') {
  if(!Number.isFinite(maxAngle)||maxAngle<=0)return '';
  const languageIndex={da:0,nb:1,en:2}[language]??0,key=maxAngle<90?'angleSplitHint':'angleSingleHint';
  const base=words[key][languageIndex].replaceAll('{angle}',String(maxAngle)).replace('{count}',String(Math.ceil(90/maxAngle))),smaller=[60,45,30].filter(angle=>angle<Math.min(90,maxAngle));return base+(smaller.length?' '+words.angleAlternatives[languageIndex].replace('{angles}',smaller.map(angle=>angle+'°').join(', ')):'');
}

/** The host commits a checked pipe; this workspace owns the measured wall draft. */
export function initRoomPlanner({getProject,onApply,language}) {
  let wall={lengths:[],turns:[],heading:0,side:'left'},draftPoints=[],result=null,returnFocus=null,seq=1,activeWall=-1,activePosition=null,opened=false,projectKey='',migrated=false;
  let selectMode='wall',selectedPipe=null,pipeUndo=[],lastSafe=null,numericPipeInvalid=false,manualPipe=false,pendingPipeEdit=null,autoAdjustments=[];
  let detailFrame=null,cameraState=null,activeSettingsTab='walls',selectedPlacement=null,detourNoticeContext=null;
  const dialog=document.createElement('main');dialog.id='room-planner';dialog.className='room-planner';dialog.hidden=true;dialog.open=false;dialog.setAttribute('aria-labelledby','rp-title');
  const pipeView=document.querySelector('body > main');if(pipeView&&!pipeView.id)pipeView.id='pipe-view';
  let previousHash='',pushedView=false,pipeViewHidden=false,returnScroll=0;
  const languageValue=()=>typeof language==='function'?language():language||document.documentElement.lang||'da';
  const tr=key=>words[key]?.[{da:0,nb:1,en:2}[languageValue()]??0]??key;
  const el=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const [name,value]of Object.entries(attrs)){if(name==='class')node.className=value;else node.setAttribute(name,String(value));}if(text!==undefined)node.textContent=text;return node;};
  const translated=(tag,key,attrs={})=>el(tag,{'data-rp-text':key,...attrs},tr(key));
  const button=(key,action,attrs={})=>{const node=translated('button',key,{type:'button',...attrs});node.addEventListener('click',action);return node;};
  const iconButton=(key,name,action,attrs={})=>{const node=button(key,action,attrs);node.removeAttribute('data-rp-text');node.dataset.rpIconLabel=key;node.dataset.rpIconName=name;return setIconButton(node,name,tr(key));};
  const q=id=>dialog.querySelector('#'+id);
  const fieldValue=field=>field.value===field.dataset.shownValue?Number(field.dataset.originalValue):Number(field.value);
  const value=id=>fieldValue(q(id));
  const fingerprint=()=>projectOpenKey(getProject());
  function draftSnapshot(){const notice=detourNoticePair();return{version:2,input:input(),points:clone(draftPoints),pipeEdited:manualPipe,pipeEditPending:pendingPipeEdit?clone(pendingPipeEdit):null,pipeAdjustments:clone(autoAdjustments),...(notice?{pipeDetourNotice:notice}:{})};}
  function persistDraft(){try{writeWallDraft(getProject(),draftSnapshot(),localStorage,normalizeWallDraft);}catch{}}
  function storedDraft(){try{return readWallDraft(getProject(),localStorage,normalizeWallDraft);}catch{return {error:tr('invalidSaved')};}}
  function exportDraft(){
    const draft=opened&&projectKey===fingerprint()?normalizeWallDraft(draftSnapshot()):storedDraft();
    if(draft?.error)throw new RangeError(draft.error);
    return draft?clone(draft):null;
  }
  function setDraft(project,planner){
    const next=planner===null?null:normalizeWallDraft(planner);if(next?.error)throw new RangeError(next.error);
    // Flush the other currently open project before switching identities. For
    // a same-ID import the incoming copy deliberately replaces this draft.
    if(opened&&projectKey===fingerprint()&&projectIdentity(project)!==projectIdentity(getProject()))writeWallDraft(getProject(),draftSnapshot(),localStorage,normalizeWallDraft);
    if(next===null)clearWallDraft(project,localStorage);else writeWallDraft(project,next,localStorage,normalizeWallDraft);
    // Do not close/persist the old DOM after this write: the host commits its
    // new project next and can call open() to reload an already visible view.
    opened=false;projectKey='';
    return next?clone(next):null;
  }
  function numberField(parent,id,key,initial,min=0) {const label=translated('label',key,{for:id}),input=el('input',{id,type:'number',step:'any',required:''});if(min!==null)input.setAttribute('min',min);input.value=String(initial);label.append(input);parent.append(label);return input;}
  function wallName(index){return tr('wall')+' '+(index+1)+' · '+format(wall.lengths[index])+' mm';}
  function segmentSelect(index,id) {const select=el('select',{'data-wall-choice':'',...(id?{id}:{})});fillSegmentSelect(select,index);return select;}
  function fillSegmentSelect(select,index) {select.replaceChildren();if(index<0||index>=wall.lengths.length)select.append(el('option',{value:-1},tr('selectWall')));wall.lengths.forEach((_,i)=>select.append(el('option',{value:i},wallName(i))));select.value=String(index>=0&&index<wall.lengths.length?index:-1);}
  function updateSegmentChoices(map=index=>index) {for(const select of dialog.querySelectorAll('[data-wall-choice]'))fillSegmentSelect(select,map(Number(select.value)));activeWall=Number(q('rp-active-wall').value);q('rp-add-clip').disabled=activeWall<0;q('rp-add-obstacle').disabled=activeWall<0;}
  const heading=el('div',{class:'rp-heading'}),titleWrap=el('div');titleWrap.append(translated('h1','title',{id:'rp-title',tabindex:-1}));heading.append(iconButton('close','back',()=>closeView(),{id:'rp-back'}),titleWrap);
  const form=el('form',{id:'rp-form'});form.addEventListener('submit',event=>event.preventDefault());
  const columns=el('div',{class:'rp-columns'}),settings=el('div',{class:'rp-settings panel'}),visual=el('div',{class:'rp-visual drawing-panel'});
  const settingsTabs=el('div',{id:'rp-settings-tabs',class:'rp-settings-tabs',role:'tablist','aria-label':tr('settingsTabs')}),settingsPanels={};settings.append(settingsTabs);
  const settingsKeys=['walls','placement','clips','obstacles'];
  for(const key of settingsKeys){const label={walls:'tabWalls',placement:'tabPlacement',clips:'tabClips',obstacles:'tabObstacles'}[key],tab=button(label,()=>setSettingsTab(key),{id:'rp-tab-'+key,role:'tab','aria-controls':'rp-panel-'+key,'aria-selected':key==='walls',tabindex:key==='walls'?0:-1}),panel=el('section',{id:'rp-panel-'+key,class:'rp-settings-panel',role:'tabpanel','aria-labelledby':'rp-tab-'+key,tabindex:0});panel.hidden=key!=='walls';settingsTabs.append(tab);settingsPanels[key]=panel;settings.append(panel);tab.addEventListener('keydown',event=>{const current=settingsKeys.indexOf(key),next=event.key==='ArrowRight'?(current+1)%4:event.key==='ArrowLeft'?(current+3)%4:event.key==='Home'?0:event.key==='End'?3:-1;if(next>=0){event.preventDefault();setSettingsTab(settingsKeys[next],true);}});}
  function fieldset(key,panel){const section=el('fieldset',{class:'rp-section'});section.append(translated('legend',key));settingsPanels[panel].append(section);return section;}
  const wallSection=fieldset('wallStage','walls');wallSection.append(el('div',{id:'rp-walls',class:'rp-wall-list'}));
  const wallBuilder=el('div',{id:'rp-wall-builder',class:'rp-wall-builder'});numberField(wallBuilder,'rp-wall-length','wallLength',1000,0.1);
  const turnFields=el('div',{id:'rp-wall-turn',class:'rp-fields'});numberField(turnFields,'rp-wall-angle','turn',90,0);qBuilderMax();
  function qBuilderMax(){turnFields.querySelector('input').setAttribute('max','179');}
  const turnLabel=translated('label','direction',{for:'rp-wall-direction'}),turnDirection=el('select',{id:'rp-wall-direction'});turnDirection.append(translated('option','left',{value:1}),translated('option','right',{value:-1}));turnLabel.append(turnDirection);turnFields.append(turnLabel);wallBuilder.append(turnFields,button('firstWall',appendWall,{id:'rp-add-wall',class:'rp-add-wall'}));wallSection.append(wallBuilder);
  const sideLabel=translated('label','side',{for:'rp-side'}),side=el('select',{id:'rp-side'});side.append(translated('option','sideLeft',{value:'left'}),translated('option','sideRight',{value:'right'}));sideLabel.append(side);wallSection.append(sideLabel);
  const pipe=fieldset('pipe','placement'),pipeMeta=el('div',{class:'rp-placement-meta'});pipeMeta.append(el('p',{id:'rp-tool-summary',class:'rp-tool-summary'}));pipe.append(pipeMeta);numberField(pipe,'rp-gap','gap',50);
  const pipeFields=el('div',{class:'rp-fields'});pipe.append(pipeFields);numberField(pipeFields,'rp-clearance','clearance',10);
  const angleLabel=translated('label','maxAngle',{for:'rp-max-angle'}),angle=el('select',{id:'rp-max-angle','aria-describedby':'rp-angle-hint'});for(const n of [30,45,60,90])angle.append(el('option',{value:n},n+'°'));angle.value='90';angleLabel.append(angle);pipeFields.append(angleLabel);
  const angleHelp=el('details',{class:'rp-angle-help'}),angleInfo=el('summary',{id:'rp-angle-info','data-rp-icon-label':'angleInfo','data-rp-icon-name':'info'}),angleHelpContent=el('div',{class:'rp-help-content'});setIconButton(angleInfo,'info',tr('angleInfo'));angleHelpContent.append(el('p',{id:'rp-angle-hint',class:'rp-hint'}),button('allow90',()=>{angleHelp.open=false;angle.value='90';invalidate(true);if(wall.lengths.length)generate();},{id:'rp-allow-90'}));angleHelp.append(angleInfo,angleHelpContent);pipeMeta.append(angleHelp);
  const endFields=el('div',{class:'rp-end-fields'});pipe.append(endFields);
  for(const key of ['start','end']){const block=el('div');block.append(translated('h3',key));const label=translated('label','wall',{for:'rp-'+key+'-wall'});label.append(segmentSelect(-1,'rp-'+key+'-wall'));block.append(label);numberField(block,'rp-'+key+'-position','position',0);endFields.append(block);}
  const placementContext=el('div',{class:'rp-placement-context'}),selectedLabel=translated('label','selected',{for:'rp-active-wall'});selectedLabel.append(segmentSelect(-1,'rp-active-wall'));placementContext.append(selectedLabel);
  const clipSection=fieldset('clips','clips'),obstacleSection=fieldset('obstacles','obstacles');clipSection.append(placementContext);
  const clipAction=button('addClip',()=>{if(activeWall<0)return;const row=addClip({segment:activeWall,position:placementPosition(),gap:value('rp-gap')});selectedPlacement={kind:'clip',id:row.dataset.rpId};markPlacementRows();invalidate(true);},{id:'rp-add-clip'}),obstacleAction=button('addObstacle',()=>{if(activeWall<0)return;const length=wall.lengths[activeWall],width=Math.min(200,length/4),position=Math.max(0,Math.min(length-width,placementPosition())),row=addObstacle({segment:activeWall,position,width,depth:200});selectedPlacement={kind:'obstacle',id:row.dataset.rpId};markPlacementRows();invalidate(true);},{id:'rp-add-obstacle'});
  clipSection.append(clipAction,el('div',{id:'rp-clips',class:'rp-list'}));obstacleSection.append(obstacleAction,el('div',{id:'rp-obstacles',class:'rp-list'}));
  settingsPanels.placement.append(button('generate',generate,{id:'rp-generate',class:'primary'}));
  const drawingTop=el('div',{class:'drawing-top rp-workspace-toolbar'}),modes=el('div',{class:'rp-selection-modes',role:'group'});modes.append(button('selectWallMode',()=>setSelectMode('wall'),{id:'rp-select-wall','aria-pressed':'true'}),button('selectPipe',()=>setSelectMode('pipe'),{id:'rp-select-pipe','aria-pressed':'false',disabled:''}));const zoomFit=iconButton('zoomFit','fit',()=>{}, {id:'rp-zoom-fit'});drawingTop.append(modes,zoomFit);visual.append(drawingTop,el('p',{id:'rp-angle-notice',class:'rp-angle-notice',role:'status','aria-live':'polite',hidden:''}));
  const canvas=el('div',{class:'canvas-wrap'}),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='rp-svg';svg.setAttribute('role','group');svg.setAttribute('tabindex','0');svg.setAttribute('aria-keyshortcuts','+ - 0 ArrowLeft ArrowRight ArrowUp ArrowDown');canvas.append(svg);visual.append(canvas);
  const viewport=createWallViewport({svg,fit:zoomFit});
  viewport.setOnChange(state=>{cameraState=state;updateDetailAnnotations(state);});
  viewport.setOnTap(tap=>{
    if(!detailFrame)return false;const target=tap.target;if(target?.closest?.('[data-wall-group]')||target?.closest?.('[data-wall-label]')||target?.closest?.('[data-pipe-callout]'))return false;
    const frame=detailFrame,point=[frame.cx+(tap.point.x-frame.width/2)/frame.scale,frame.cy-(tap.point.y-frame.height/2)/frame.scale],pixelsPerMm=frame.scale*(Number(cameraState?.pixelsPerUnit)||1);
    if(selectMode==='pipe'){const picked=pickPipePart({geometry:frame.pickGeometry,point,pixelsPerMm,maxDistancePx:Math.max(22,frame.data.diameter*pixelsPerMm/2+4),selected:selectedPipe});if(!picked)return false;selectPipe(picked.type,picked.index);return true;}
    if(pickDrawingSetting(frame,point,pixelsPerMm))return true;
    const picked=pickWallSegment({segments:frame.layout.segments,point,pixelsPerMm,maxDistancePx:22,selectedIndex:activeWall});if(!picked)return false;selectWall(picked.index,picked.position,true,true);return true;
  });
  const wallOverview=el('details',{id:'rp-wall-overview',class:'drawing-reference-details rp-wall-overview'});wallOverview.append(translated('summary','wallOverview'),translated('h4','wallMeasurements',{id:'rp-dimensions-title',hidden:''}),el('div',{id:'rp-wall-dimensions',class:'rp-wall-dimensions'}));visual.append(wallOverview);
  const legend=el('div',{class:'rp-legend'});for(const [cls,key]of [['wall','wallLegend'],['clip','clipLegend'],['obstacle','obstacleLegend'],['route','routeLegend']]){const item=el('span');item.append(el('i',{class:'rp-key rp-key-'+cls,'aria-hidden':'true'}),translated('span',key));legend.append(item);}wallOverview.append(legend);visual.append(el('p',{id:'rp-summary',class:'rp-summary','aria-live':'polite'}));
  const routeEditor=el('section',{id:'rp-route-editor',class:'rp-route-editor',hidden:''});
  const pipeEditor=el('section',{id:'rp-pipe-editor',class:'rp-pipe-editor'}),partLabel=translated('label','pipePart',{for:'rp-pipe-part'}),partSelect=el('select',{id:'rp-pipe-part'});partLabel.append(partSelect);partSelect.addEventListener('change',()=>{const [type,index]=partSelect.value.split(':');selectPipe(type,Number(index),false);});const pipeToolbar=el('div',{class:'rp-pipe-toolbar'});pipeToolbar.append(partLabel);pipeEditor.append(pipeToolbar,el('div',{id:'rp-pipe-fields',class:'rp-pipe-fields'}));
  const pipeActions=el('div',{class:'rp-edit-actions rp-pipe-utilities'});pipeActions.append(iconButton('undoPipe','undo',undoPipeEdit,{id:'rp-pipe-undo',disabled:''}),iconButton('restorePipe','reset',restoreSafePipe,{id:'rp-pipe-restore',disabled:''}));pipeToolbar.append(pipeActions);pipeEditor.append(el('p',{id:'rp-pipe-feedback',class:'rp-pipe-feedback',role:'status','aria-live':'polite'}));
  const adjustmentDetails=el('details',{id:'rp-pipe-adjustments',class:'rp-pipe-adjustments',hidden:''});adjustmentDetails.append(el('summary'),el('ul'));pipeEditor.append(adjustmentDetails);routeEditor.append(pipeEditor);
  const advanced=el('details',{id:'rp-advanced',class:'rp-advanced'});advanced.append(translated('summary','advanced'));routeEditor.append(advanced);
  const tableWrap=el('div',{class:'rp-table-wrap'}),table=el('table'),thead=el('thead'),headerRow=el('tr');headerRow.append(translated('th','point'),el('th',{},'X · mm'),el('th',{},'Y · mm'),el('th',{},''));thead.append(headerRow);table.append(thead,el('tbody',{id:'rp-points'}));tableWrap.append(table);advanced.append(tableWrap);
  const editActions=el('div',{class:'rp-edit-actions'});editActions.append(button('addPoint',addPoint,{id:'rp-add-point'}),button('validate',validate,{id:'rp-validate'}));advanced.append(editActions);visual.append(routeEditor);columns.append(settings,visual);form.append(columns);
  const spatialNotice=translated('p','spatialBoundary',{id:'rp-spatial-notice',class:'rp-legacy',role:'status',hidden:''});
  const legacyNotice=translated('p','legacy',{id:'rp-legacy',class:'rp-legacy',hidden:''}),status=el('p',{id:'rp-status',class:'rp-status',role:'status','aria-live':'polite'}),error=el('p',{id:'rp-error',class:'rp-error',role:'alert'}),actions=el('div',{class:'rp-actions'});actions.append(button('apply',apply,{id:'rp-apply',class:'primary',disabled:''}));dialog.append(heading,spatialNotice,legacyNotice,form,status,error,actions);document.body.append(dialog);
  form.addEventListener('input',onFormInput);form.addEventListener('change',event=>{if(event.target.tagName==='SELECT')onFormInput(event);});
  function onFormInput(event){
    const target=event.target;if(target.closest('#rp-wall-builder'))return;
    if(target.closest('#rp-pipe-fields')){editPipeField(target);return;}
    if(target.id==='rp-pipe-part')return;
    if(target.closest('#rp-points')){if(![...q('rp-points').querySelectorAll('input')].every(fieldOK)){clearDetourNotice();manualPipe=true;numericPipeInvalid=true;result=null;q('rp-apply').disabled=true;showError(tr('invalid'));pipeFeedback(false,tr('invalid'));draw();return;}rememberPipe();clearDetourNotice();pendingPipeEdit=null;autoAdjustments=[];readPoints();numericPipeInvalid=false;manualPipe=true;selectMode='pipe';renderPipeFields();checkDraft();return;}
    const placementRow=target.closest('[data-rp-id]'),placementKind=target.closest('#rp-clips')?'clip':target.closest('#rp-obstacles')?'obstacle':null;if(placementRow&&placementKind){selectedPlacement={kind:placementKind,id:placementRow.dataset.rpId};activeWall=Number(placementRow.querySelector('[data-rp-field="segment"]').value);activePosition=Number(placementRow.querySelector('[data-rp-field="position"]').value);q('rp-active-wall').value=String(activeWall);markSelected();markPlacementRows();}
    if(target.closest('#rp-walls')){readWallRows();updateSegmentChoices();selectMode='wall';}
    if(target.id==='rp-side')wall.side=target.value;
    if(target.id==='rp-active-wall'){activeWall=Number(target.value);activePosition=null;q('rp-add-clip').disabled=activeWall<0;q('rp-add-obstacle').disabled=activeWall<0;markSelected();setSelectMode('wall');return;}
    invalidate(true);
  }

  function setSettingsTab(key,focus=false){
    if(!settingsKeys.includes(key))return;activeSettingsTab=key;
    for(const name of settingsKeys){const selected=name===key,tab=q('rp-tab-'+name);tab.setAttribute('aria-selected',String(selected));tab.setAttribute('tabindex',selected?'0':'-1');settingsPanels[name].hidden=!selected;}
    if(key==='clips'||key==='obstacles'){const section=key==='clips'?clipSection:obstacleSection;section.insertBefore(placementContext,section.querySelector('button'));}
    if(focus)q('rp-tab-'+key).focus({preventScroll:true});
  }
  function markPlacementRows(){for(const [kind,id]of [['clip','rp-clips'],['obstacle','rp-obstacles']])for(const row of q(id).children){const selected=selectedPlacement?.kind===kind&&selectedPlacement.id===row.dataset.rpId;row.classList.toggle('rp-entry-selected',selected);row.setAttribute('data-selected',String(selected));}}
  function selectPlacement(kind,id,focus=false){
    const row=[...q(kind==='clip'?'rp-clips':'rp-obstacles').children].find(item=>item.dataset.rpId===id);if(!row)return;
    selectedPlacement={kind,id};activeWall=Number(row.querySelector('[data-rp-field="segment"]').value);activePosition=Number(row.querySelector('[data-rp-field="position"]').value);q('rp-active-wall').value=String(activeWall);q('rp-add-clip').disabled=activeWall<0;q('rp-add-obstacle').disabled=activeWall<0;selectMode='wall';setSettingsTab(kind==='clip'?'clips':'obstacles');markSelected();markPlacementRows();draw();
    if(focus)row.querySelector('[data-rp-field="position"]').focus({preventScroll:true});row.scrollIntoView?.({block:'nearest'});
  }
  function selectAnchor(key,focus=false){selectMode='wall';selectedPlacement=null;setSettingsTab('placement');markPlacementRows();draw();if(focus)q('rp-'+key+'-position').focus({preventScroll:true});}
  function pickDrawingSetting(frame,point,pixelsPerMm){
    const nearby=[];for(const key of ['start','end'])try{const p=pointOnWall(frame.data,frame.data[key]);nearby.push({kind:'anchor',key,distance:Math.hypot(p[0]-point[0],p[1]-point[1])*pixelsPerMm});}catch{}
    for(const clip of frame.data.clips)try{const p=pointOnWall(frame.data,clip);nearby.push({kind:'clip',id:clip.id,distance:Math.hypot(p[0]-point[0],p[1]-point[1])*pixelsPerMm});}catch{}
    nearby.sort((a,b)=>a.distance-b.distance);if(nearby[0]?.distance<=14){const item=nearby[0];if(item.kind==='anchor')selectAnchor(item.key);else selectPlacement('clip',item.id);return true;}
    const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
    for(const item of frame.polygons){const polygon=item.points;let inside=false,distance=Infinity;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[j],b=polygon[i];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;distance=Math.min(distance,segmentDistance(point,a,b));}if(inside||distance*pixelsPerMm<=6){selectPlacement('obstacle',item.id);return true;}}
    return false;
  }
  function detourNoticePair(){if(!detourNoticeContext||manualPipe||pendingPipeEdit)return null;const data=input();if(!validDetourPair(detourNoticeContext,data)||!sameDetourContext(detourNoticeContext.input,data)||!sameDetourContext(detourNoticeContext.points,draftPoints)){detourNoticeContext=null;return null;}return{requested:detourNoticeContext.requested,used:detourNoticeContext.used};}
  function renderDetourNotice(){const node=q('rp-angle-notice');if(!node)return;const notice=detourNoticePair();node.hidden=!notice;const message=notice?tr('detourFallback').replace('{requested}',format(notice.requested)).replace('{used}',format(notice.used)):'';if(node.textContent!==message)node.textContent=message;if(notice){node.setAttribute('data-requested-angle',String(notice.requested));node.setAttribute('data-used-angle',String(notice.used));}else{node.removeAttribute('data-requested-angle');node.removeAttribute('data-used-angle');}}
  function clearDetourNotice(){detourNoticeContext=null;renderDetourNotice();}
  function showView(){
    if(!dialog.open){pipeViewHidden=!!pipeView?.hidden;returnScroll=Number(globalThis.scrollY)||0;previousHash=globalThis.location?.hash||'';if(previousHash!=='#wall-planner'&&globalThis.history?.pushState){globalThis.history.pushState({wallPlanner:true},'','#wall-planner');pushedView=true;}else pushedView=previousHash==='#wall-planner'&&globalThis.history?.state?.wallPlanner===true;}
    if(pipeView)pipeView.hidden=true;document.body.classList.add('wall-planner-active');dialog.hidden=false;dialog.open=true;globalThis.scrollTo?.(0,0);
  }
  function closeView(navigate=true){
    if(!dialog.open)return;persistDraft();projectKey=fingerprint();dialog.open=false;dialog.hidden=true;document.body.classList.remove('wall-planner-active');if(pipeView)pipeView.hidden=pipeViewHidden;
    if(navigate&&globalThis.location?.hash==='#wall-planner'){if(pushedView&&globalThis.history?.back)globalThis.history.back();else globalThis.history?.replaceState?.(null,'',(globalThis.location?.pathname||'')+(globalThis.location?.search||'')+(previousHash==='#wall-planner'?'':previousHash));}
    pushedView=false;globalThis.scrollTo?.(0,returnScroll);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }
  dialog.close=()=>closeView();
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(angleHelp.open){angleHelp.open=false;angleInfo.focus({preventScroll:true});}else closeView();}});
  globalThis.addEventListener?.('hashchange',()=>{if(globalThis.location?.hash==='#wall-planner'){if(!dialog.open)open();}else closeView(false);});
  globalThis.addEventListener?.('popstate',()=>{if(globalThis.location?.hash==='#wall-planner'){if(!dialog.open)open();}else closeView(false);});
  function rowField(row,key,n){const label=translated('label',key),input=el('input',{type:'number',step:'any',min:0,required:'','data-rp-field':key});input.value=String(n);label.append(input);row.append(label);return input;}
  function rowId(prefix,provided){const used=new Set([...dialog.querySelectorAll('[data-rp-id]')].map(n=>n.dataset.rpId));if(provided&&!used.has(provided))return provided;let id;do{id=prefix+'-'+seq++;}while(used.has(id));return id;}
  function rowWall(row,index){const label=translated('label','wall'),select=segmentSelect(index);select.dataset.rpField='segment';label.append(select);row.append(label);return select;}
  function addClip(data){const row=el('div',{class:'rp-entry','data-rp-id':rowId('clip',data.id)});row.append(translated('strong','clip',{class:'rp-entry-title'}));rowWall(row,data.segment??activeWall);rowField(row,'position',data.position??0);rowField(row,'gap',data.gap??value('rp-gap'));row.append(button('remove',()=>{row.remove();invalidate(true);},{class:'rp-remove'}));q('rp-clips').append(row);return row;}
  function addObstacle(data){const row=el('div',{class:'rp-entry rp-obstacle-entry','data-rp-id':rowId('obstacle',data.id)});row.append(translated('strong','obstacle',{class:'rp-entry-title'}));rowWall(row,data.segment??activeWall);rowField(row,'position',data.position??0);rowField(row,'obstacleWidth',data.width??200);rowField(row,'obstacleDepth',data.depth??200);row.append(button('remove',()=>{row.remove();invalidate(true);},{class:'rp-remove'}));q('rp-obstacles').append(row);return row;}
  function rowData(row){return Object.fromEntries([...row.querySelectorAll('[data-rp-field]')].map(field=>[field.dataset.rpField,Number(field.value)]));}
  function input(){const project=getProject();return {wall:clone(wall),diameter:Number(project.diameter),radius:Number(project.radius),wallGap:value('rp-gap'),clearance:value('rp-clearance'),maxAngle:value('rp-max-angle'),start:{segment:value('rp-start-wall'),position:value('rp-start-position')},end:{segment:value('rp-end-wall'),position:value('rp-end-position')},clips:[...q('rp-clips').children].map(row=>({id:row.dataset.rpId,...rowData(row)})),obstacles:[...q('rp-obstacles').children].map(row=>{const d=rowData(row);return{id:row.dataset.rpId,segment:d.segment,position:d.position,width:d.obstacleWidth,depth:d.obstacleDepth};})};}
  function writeInput(data){wall=clone(data.wall);side.value=wall.side||'left';activeWall=wall.lengths.length?0:-1;activePosition=null;for(const [id,key]of [['rp-gap','wallGap'],['rp-clearance','clearance'],['rp-max-angle','maxAngle']])q(id).value=String(data[key]);q('rp-clips').replaceChildren();q('rp-obstacles').replaceChildren();renderWallRows();for(const key of ['start','end']){fillSegmentSelect(q('rp-'+key+'-wall'),data[key].segment);q('rp-'+key+'-position').value=String(data[key].position);}fillSegmentSelect(q('rp-active-wall'),activeWall);(data.clips||[]).forEach(addClip);(data.obstacles||[]).forEach(addObstacle);for(const field of settings.querySelectorAll('input,select')){delete field.dataset.originalValue;delete field.dataset.shownValue;}q('rp-add-clip').disabled=activeWall<0;q('rp-add-obstacle').disabled=activeWall<0;}
  function renderWallRows(){
    const rows=q('rp-walls'),expanded=new Set([...rows.children].filter(row=>row.open).map(row=>Number(row.dataset.wallRow)));rows.replaceChildren();
    wall.lengths.forEach((length,index)=>{
      const row=el('details',{class:'rp-wall-entry','data-wall-row':index}),summary=el('summary',{},wallName(index)+(index?' · '+format(Math.abs(wall.turns[index-1]))+'° '+tr(wall.turns[index-1]<0?'right':'left'):''));row.open=expanded.has(index);summary.addEventListener('click',()=>selectWall(index,null,false));row.append(summary);
      const content=el('div',{class:'rp-wall-fields'}),lengthLabel=translated('label','wallLength'),lengthInput=el('input',{type:'number',step:'any',min:0.1,required:'','data-wall-index':index,'data-wall-field':'length'});lengthInput.value=String(length);lengthLabel.append(lengthInput);content.append(lengthLabel);
      if(index>0){const fields=el('div',{class:'rp-wall-turn-row'}),label=translated('label','turn'),angleInput=el('input',{type:'number',step:'any',min:0,max:179,required:'','data-wall-index':index,'data-wall-field':'angle'});angleInput.value=String(Math.abs(wall.turns[index-1]));label.append(angleInput);const directionLabel=translated('label','direction'),selectDirection=el('select',{'data-wall-index':index,'data-wall-field':'direction'});selectDirection.append(translated('option','left',{value:1}),translated('option','right',{value:-1}));selectDirection.value=String(Math.sign(wall.turns[index-1])||1);directionLabel.append(selectDirection);fields.append(label,directionLabel);content.append(fields);}
      content.append(button('remove',()=>removeWall(index),{class:'rp-remove','aria-label':tr('remove')+' '+wallName(index)}));row.append(content);rows.append(row);
    });markSelected();q('rp-wall-turn').hidden=!wall.lengths.length;const key=wall.lengths.length?'addWall':'firstWall';q('rp-add-wall').dataset.rpText=key;q('rp-add-wall').textContent=tr(key);const lengthLabel=q('rp-wall-length').parentNode;lengthLabel.dataset.rpText=wall.lengths.length?'nextLength':'wallLength';lengthLabel.firstChild.nodeValue=tr(lengthLabel.dataset.rpText);
  }
  function readWallRows(){const rows=[...q('rp-walls').children];wall.lengths=rows.map(row=>Number(row.querySelector('[data-wall-field="length"]').value));wall.turns=rows.slice(1).map(row=>Number(row.querySelector('[data-wall-field="angle"]').value)*Number(row.querySelector('[data-wall-field="direction"]').value));rows.forEach((row,index)=>{row.querySelector('summary').textContent=wallName(index)+(index?' · '+format(Math.abs(wall.turns[index-1]))+'° '+tr(wall.turns[index-1]<0?'right':'left'):'');});}
  function markSelected(){for(const row of q('rp-walls').children)row.classList.toggle('rp-wall-selected',Number(row.dataset.wallRow)===activeWall);}
  function selectWall(index,position=null,expand=true,keepPlacementTab=false){selectMode='wall';if(!keepPlacementTab||!['clips','obstacles'].includes(activeSettingsTab))setSettingsTab('walls');selectedPlacement=null;markPlacementRows();if(expand){const row=q('rp-walls').children[index];if(row)row.open=true;}activeWall=index;activePosition=position;q('rp-active-wall').value=String(index);q('rp-add-clip').disabled=index<0;q('rp-add-obstacle').disabled=index<0;markSelected();draw();}
  function placementPosition(){const length=wall.lengths[activeWall];return activePosition===null?length/2:Math.max(0,Math.min(length,activePosition));}
  function appendWall(){const lengthInput=q('rp-wall-length'),angleInput=q('rp-wall-angle');if(!lengthInput.reportValidity()||(wall.lengths.length&&!angleInput.reportValidity())){showError(tr('invalid'));return;}const length=Number(lengthInput.value),turn=Number(angleInput.value)*Number(q('rp-wall-direction').value);if(!Number.isFinite(length)||length<=0||!Number.isFinite(turn)||Math.abs(turn)>=180){showError(tr('invalid'));return;}const first=!wall.lengths.length;if(!first)wall.turns.push(turn);wall.lengths.push(length);renderWallRows();updateSegmentChoices();if(first){fillSegmentSelect(q('rp-start-wall'),0);q('rp-start-position').value=String(Math.min(200,length/4));}fillSegmentSelect(q('rp-end-wall'),wall.lengths.length-1);q('rp-end-position').value=String(length-Math.min(200,length/4));selectWall(wall.lengths.length-1,null,false);invalidate(true);}
  function removeWall(index){wall.lengths.splice(index,1);if(wall.turns.length)wall.turns.splice(index===0?0:index-1,1);updateSegmentChoices(i=>i===index?-1:i>index?i-1:i);activeWall=Number(q('rp-active-wall').value);activePosition=null;renderWallRows();invalidate(true);}
  function showError(message){error.textContent=message||'';}
  function invalidate(clear){
    clearDetourNotice();updateAngleHelp();result=null;q('rp-apply').disabled=true;showError('');status.textContent=tr(clear?'changed':'edited');status.hidden=false;q('rp-summary').textContent='';
    if(clear&&!manualPipe){draftPoints=[];lastSafe=null;pipeUndo=[];selectedPipe=null;numericPipeInvalid=false;renderPoints();}
    else if(draftPoints.length>=2&&manualPipe){checkDraft();return;}
    else renderPoints();
    draw();persistDraft();
  }
  function accept(next){
    if(!next?.ok){clearDetourNotice();result=null;q('rp-apply').disabled=true;showError(roomPlannerError(next,languageValue()));status.textContent='';renderPoints();pipeFeedback(false,error.textContent);draw();persistDraft();return false;}
    result=next;draftPoints=clone(next.points);numericPipeInvalid=false;q('rp-apply').disabled=hasSpatialPipe(getProject());showError('');status.textContent=tr('validated');status.hidden=true;q('rp-summary').textContent=next.turns.length+' '+tr('bends')+' · '+tr('length')+': '+format(next.geometricLength)+' mm';lastSafe=pipeSnapshot();renderPoints();pipeFeedback(true,tr('validated'));draw();persistDraft();return true;
  }
  function pipeSnapshot(){return{points:clone(draftPoints),start:clone(input().start),end:clone(input().end),selected:selectedPipe?{...selectedPipe}:null,adjustments:clone(autoAdjustments),manual:manualPipe,detourContext:detourNoticePair()?clone(detourNoticeContext):null};}
  function writeAnchor(key,data){fillSegmentSelect(q('rp-'+key+'-wall'),data.segment);setNumericField(q('rp-'+key+'-position'),data.position);}
  function restoreSnapshot(saved){q('rp-select-pipe').focus({preventScroll:true});pendingPipeEdit=null;autoAdjustments=clone(saved.adjustments||[]);numericPipeInvalid=false;draftPoints=clone(saved.points);writeAnchor('start',saved.start);writeAnchor('end',saved.end);selectedPipe=saved.selected?{...saved.selected}:null;manualPipe=saved.manual===false?false:true;detourNoticeContext=saved.detourContext?clone(saved.detourContext):null;selectMode='pipe';renderPoints();checkDraft();}
  function rememberPipe(){if(draftPoints.length<2)return;pipeUndo.push(pipeSnapshot());if(pipeUndo.length>50)pipeUndo.shift();}
  function undoPipeEdit(){const previous=pipeUndo.pop();if(previous)restoreSnapshot(previous);}
  function restoreSafePipe(){if(lastSafe){rememberPipe();restoreSnapshot(lastSafe);}}
  function setNumericField(field,n){if(numericPipeInvalid&&!fieldOK(field))return;const shown=String(Math.round(n*1000)/1000);if(document.activeElement===field&&Number(field.value)!==n)return;if(document.activeElement!==field)field.value=shown;field.dataset.originalValue=String(n);field.dataset.shownValue=field.value;}
  function pendingMessage(){return pendingPipeEdit?roomPlannerError(pendingPipeEdit,languageValue()):tr('invalid');}
  function renderAdjustments(){
    adjustmentDetails.hidden=!autoAdjustments.length;const summary=adjustmentDetails.querySelector('summary'),list=adjustmentDetails.querySelector('ul');list.replaceChildren();
    const number=n=>Number(n).toLocaleString({da:'da-DK',nb:'nb-NO',en:'en-GB'}[languageValue()]||'da-DK',{maximumFractionDigits:6});
    const lines=autoAdjustments.map(change=>(change.type==='length'?'L':'B')+(change.index+1)+': '+number(change.from)+' → '+number(change.to)+(change.type==='length'?' mm':'°'));
    summary.textContent=tr('autoAdjusted')+': '+lines.slice(0,2).join(' · ')+(lines.length>2?' (+'+(lines.length-2)+')':'');for(const line of lines)list.append(el('li',{},line));
  }
  function pipeFeedback(valid,message){q('rp-pipe-feedback').textContent=message||'';q('rp-pipe-feedback').hidden=valid||!message;q('rp-pipe-feedback').classList.toggle('rp-feedback-invalid',!valid);q('rp-pipe-undo').disabled=!pipeUndo.length;q('rp-pipe-restore').disabled=!lastSafe||!!result?.ok;renderAdjustments();}
  function checkDraft(){
    updateAngleHelp();result=null;q('rp-apply').disabled=true;
    if(pendingPipeEdit){status.textContent='';showError(pendingMessage());renderPoints();pipeFeedback(false,pendingMessage());draw();persistDraft();return false;}
    if(numericPipeInvalid||![...settings.querySelectorAll('input,select')].filter(field=>!field.closest('#rp-wall-builder')).every(fieldOK)||![...q('rp-pipe-fields').querySelectorAll('input,select'),...q('rp-points').querySelectorAll('input')].every(fieldOK)){showError(tr('invalid'));pipeFeedback(false,tr('invalid'));draw();persistDraft();return false;}
    try{return accept(validateWallRoute(input(),draftPoints));}catch{return accept({ok:false,error:tr('unexpected')});}
  }
  function setSelectMode(mode){selectMode=mode==='pipe'&&draftPoints.length>=2?'pipe':'wall';draw();}
  function selectPipe(type,index,focus=true){selectMode='pipe';selectedPipe={type,index};markPipeFields();draw();if(focus){const list=q('rp-pipe-fields'),field=list.querySelector('[data-pipe-type="'+type+'"][data-pipe-index="'+index+'"]'),wrap=field?.closest('[data-pipe-ref]');if(wrap&&list.getBoundingClientRect&&wrap.getBoundingClientRect){const box=list.getBoundingClientRect(),part=wrap.getBoundingClientRect();if(part.top<box.top)list.scrollTop-=box.top-part.top;else if(part.bottom>box.bottom)list.scrollTop+=part.bottom-box.bottom;}field?.focus({preventScroll:true});field?.select?.();}}
  function markPipeFields(){for(const field of q('rp-pipe-fields').querySelectorAll('[data-pipe-ref]')){const selected=field.dataset.pipeRef===(selectedPipe?(selectedPipe.type==='length'?'L':'B')+(selectedPipe.index+1):'');field.classList.toggle('rp-pipe-field-selected',selected);field.hidden=!selected;}for(const row of q('rp-pipe-fields').children)row.hidden=![...row.children].some(field=>!field.hidden);if(selectedPipe)partSelect.value=selectedPipe.type+':'+selectedPipe.index;}
  function editPipeField(target){
    const type=target.dataset.pipeDirection!==undefined?'turn':target.dataset.pipeType,index=Number(target.dataset.pipeDirection??target.dataset.pipeIndex);
    if(!['length','turn'].includes(type)||!Number.isInteger(index))return;
    selectedPipe={type,index};selectMode='pipe';
    const field=q('rp-pipe-fields').querySelector('[data-pipe-type="'+type+'"][data-pipe-index="'+index+'"]');
    const raw=field?.value||'',direction=type==='turn'?Number(q('rp-pipe-fields').querySelector('[data-pipe-direction="'+index+'"]')?.value):1;
    const reject=failed=>{clearDetourNotice();pendingPipeEdit={type,index,raw,direction,code:failed.code||'EDIT_NO_SOLUTION',error:failed.error||'Rettelsen kunne ikke tilpasses. Røret er ikke ændret. Prøv et andet mål eller en anden vinkel.'};numericPipeInvalid=true;manualPipe=true;result=null;status.textContent='';q('rp-apply').disabled=true;renderPipeFields();showError(pendingMessage());pipeFeedback(false,pendingMessage());draw();persistDraft();};
    if(!field||!field.reportValidity()||!Number.isFinite(Number(field.value))){reject({code:'EDIT_INVALID_VALUE',error:'Indtast en gyldig positiv længde eller bukkevinkel under 179°.'});return;}
    let nextValue=fieldValue(field);if(type==='turn')nextValue=Math.abs(nextValue)*direction;
    let changed;try{changed=solveWallPipeEdit(input(),draftPoints,{type,index,value:nextValue});}catch{changed={ok:false,code:'EDIT_NO_SOLUTION'};}
    if(!changed.ok){reject(changed);return;}
    const different=JSON.stringify(changed.points)!==JSON.stringify(draftPoints);
    if(different){rememberPipe();autoAdjustments=[...(changed.adjustments?.lengths||[]).filter(change=>type!=='length'||change.index!==index).map(change=>({...change,type:'length'})),...(changed.adjustments?.turns||[]).filter(change=>type!=='turn'||change.index!==index).map(change=>({...change,type:'turn'}))];}
    clearDetourNotice();pendingPipeEdit=null;draftPoints=clone(changed.points);numericPipeInvalid=false;manualPipe=true;renderPoints();checkDraft();
  }
  function renderPipeFields(){
    const model=pipeModelFromPoints(draftPoints),fields=q('rp-pipe-fields');q('rp-select-pipe').disabled=!model.ok;
    if(!model.ok){fields.replaceChildren();delete fields.dataset.signature;return;}
    if(!selectedPipe||selectedPipe.index<0||selectedPipe.index>=(selectedPipe.type==='turn'?model.turns:model.lengths).length)selectedPipe={type:'length',index:0};
    partSelect.replaceChildren();for(let i=0;i<model.lengths.length;i++){partSelect.append(el('option',{value:'length:'+i},'L'+(i+1)+' · '+format(model.lengths[i])+' mm'));if(i<model.turns.length)partSelect.append(el('option',{value:'turn:'+i},'B'+(i+1)+' · '+format(Math.abs(model.turns[i]))+'° '+tr(model.turns[i]<0?'right':'left')));}
    const signature=model.lengths.length+':'+model.turns.length;
    if(fields.dataset.signature!==signature){
      fields.replaceChildren();fields.dataset.signature=signature;
      for(let index=0;index<model.lengths.length;index++){
        const row=el('div',{class:'rp-pipe-leg','data-pipe-row':index});
        for(const type of (index<model.turns.length?['length','turn']:['length'])){
          const ref=(type==='length'?'L':'B')+(index+1),wrap=el('div',{class:'rp-pipe-field'+(type==='turn'?' rp-pipe-field-turn':''),'data-pipe-ref':ref});wrap.append(el('strong',{},ref));
          const label=translated('label',type==='length'?'pipeLength':'pipeAngle'),field=el('input',{type:'number',step:'any',min:type==='length'?0.1:0.1,required:'','data-pipe-type':type,'data-pipe-index':index,'aria-label':ref+' · '+tr(type==='length'?'pipeLength':'pipeAngle')});if(type==='turn')field.setAttribute('max','178.999999');label.append(field);wrap.append(label);
          field.addEventListener('focus',()=>{if(selectedPipe?.type!==type||selectedPipe?.index!==index)selectPipe(type,index,false);});
          if(type==='turn'){const directionLabel=translated('label','pipeDirection'),direction=el('select',{'data-pipe-direction':index,'aria-label':ref+' · '+tr('pipeDirection')});direction.append(translated('option','left',{value:1}),translated('option','right',{value:-1}));directionLabel.append(direction);wrap.append(directionLabel);}
          row.append(wrap);
        }
        fields.append(row);
      }
    }
    for(const field of fields.querySelectorAll('[data-pipe-type]')){const index=Number(field.dataset.pipeIndex),n=field.dataset.pipeType==='length'?model.lengths[index]:Math.abs(model.turns[index]);field.setAttribute('aria-label',(field.dataset.pipeType==='length'?'L':'B')+(index+1)+' · '+tr(field.dataset.pipeType==='length'?'pipeLength':'pipeAngle'));setNumericField(field,n);}
    for(const field of fields.querySelectorAll('[data-pipe-direction]')){field.value=String(Math.sign(model.turns[Number(field.dataset.pipeDirection)])||1);field.setAttribute('aria-label','B'+(Number(field.dataset.pipeDirection)+1)+' · '+tr('pipeDirection'));}
    if(pendingPipeEdit){const field=fields.querySelector('[data-pipe-type="'+pendingPipeEdit.type+'"][data-pipe-index="'+pendingPipeEdit.index+'"]');if(field){field.value=pendingPipeEdit.raw;if(pendingPipeEdit.type==='turn')fields.querySelector('[data-pipe-direction="'+pendingPipeEdit.index+'"]').value=String(pendingPipeEdit.direction);}}
    markPipeFields();
  }

  function fieldOK(field){if(field.disabled)return true;if(field.validity)return field.validity.valid;if(field.hasAttribute('required')&&field.value==='')return false;if(field.getAttribute('type')==='number'){const n=Number(field.value);return field.value!==''&&Number.isFinite(n)&&(!field.hasAttribute('min')||n>=Number(field.getAttribute('min')))&&(!field.hasAttribute('max')||n<=Number(field.getAttribute('max')));}return true;}
  function validPipeFields(){return[...q('rp-pipe-fields').querySelectorAll('input,select'),...q('rp-points').querySelectorAll('input')].every(field=>field.reportValidity());}
  function validSettings(){for(const field of [...settings.querySelectorAll('input,select')].filter(field=>!field.closest('#rp-wall-builder'))){if(fieldOK(field))continue;const panel=field.closest('[role="tabpanel"]');if(panel){selectMode='wall';setSettingsTab(panel.id.replace('rp-panel-',''));const row=field.closest('[data-wall-row]');if(row)row.open=true;draw();}field.reportValidity();field.focus?.({preventScroll:false});return false;}return true;}
  function generate(){clearDetourNotice();if(!wall.lengths.length){showError(tr('noWalls'));return;}if(!validSettings()){showError(tr('invalid'));return;}try{const data=input(),proposal=generateWallRoute(data);if(proposal.ok){pipeUndo=[];lastSafe=null;selectedPipe=null;pendingPipeEdit=null;autoAdjustments=[];manualPipe=false;numericPipeInvalid=false;selectMode='pipe';const pair={requested:proposal.requestedDetourAngle,used:proposal.detourAngle};if(proposal.detourAngleFallback&&validDetourPair(pair,data))detourNoticeContext={...pair,input:clone(data),points:clone(proposal.points)};}accept(proposal);}catch{accept({ok:false,error:tr('unexpected')});}}
  function validate(){if(pendingPipeEdit){showError(pendingMessage());return;}if(numericPipeInvalid||!validSettings()||!validPipeFields()){showError(tr('invalid'));return;}try{readPoints();accept(validateWallRoute(input(),draftPoints));}catch{accept({ok:false,error:tr('unexpected')});}}
  function readPoints(){const coordinate=field=>field.value===field.dataset.shownValue?Number(field.dataset.originalValue):Number(field.value);draftPoints=[...q('rp-points').children].map(row=>[coordinate(row.querySelector('[data-axis="x"]')),coordinate(row.querySelector('[data-axis="y"]'))]);}
  function renderPoints(){
    q('rp-route-editor').hidden=draftPoints.length<2;renderPipeFields();const body=q('rp-points');
    if(body.children.length!==draftPoints.length){
      body.replaceChildren();draftPoints.forEach((point,index)=>{
        const row=el('tr');row.append(el('th',{scope:'row'},index===0?'A':index===draftPoints.length-1?'B':String(index)));
        for(const axis of ['x','y']){const cell=el('td'),field=el('input',{type:'number',step:'any',required:'','data-axis':axis,'aria-label':tr('point')+' '+(index+1)+' · '+axis.toUpperCase()+' mm'});cell.append(field);row.append(cell);}
        const last=el('td');if(index>0&&index<draftPoints.length-1)last.append(button('remove',()=>{rememberPipe();clearDetourNotice();pendingPipeEdit=null;autoAdjustments=[];readPoints();draftPoints.splice(index,1);numericPipeInvalid=false;manualPipe=true;checkDraft();},{class:'rp-remove'}));row.append(last);body.append(row);
      });
    }
    [...body.children].forEach((row,index)=>{row.querySelector('th').textContent=index===0?'A':index===draftPoints.length-1?'B':String(index);for(const [axis,n]of [['x',0],['y',1]])setNumericField(row.querySelector('[data-axis="'+axis+'"]'),draftPoints[index][n]);});
  }

  function addPoint(){if(draftPoints.length<2||pendingPipeEdit||!validPipeFields())return;rememberPipe();clearDetourNotice();autoAdjustments=[];readPoints();const a=draftPoints.at(-2),b=draftPoints.at(-1);draftPoints.splice(draftPoints.length-1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);manualPipe=true;numericPipeInvalid=false;result=null;q('rp-apply').disabled=true;showError('');status.textContent=tr('edited');status.hidden=false;renderPoints();pipeFeedback(false,tr('edited'));draw();persistDraft();}
  async function apply(){if(hasSpatialPipe(getProject())){q('rp-apply').disabled=true;showError(tr('spatialBoundary'));return;}if(!result?.ok||numericPipeInvalid||!validSettings()||!validPipeFields())return;try{readPoints();const data=input(),checked=validateWallRoute(data,draftPoints);if(!accept(checked))return;q('rp-apply').disabled=true;await onApply({lengths:clone(checked.lengths),turns:clone(checked.turns),heading:checked.heading,start:clone(checked.start),planner:{version:2,input:clone(data),points:clone(checked.points),pipeEdited:manualPipe,...(detourNoticePair()?{pipeDetourNotice:detourNoticePair()}:{})}});dialog.close();}catch(exception){showError(exception?.message||tr('rejected'));q('rp-apply').disabled=hasSpatialPipe(getProject())||!result?.ok;}}
  function format(n){return Number(n).toLocaleString({da:'da-DK',nb:'nb-NO',en:'en-GB'}[languageValue()]||'da-DK',{maximumFractionDigits:1});}
  function updateAngleHelp(){renderDetourNotice();const limit=value('rp-max-angle');q('rp-angle-hint').textContent=wallBendAngleHint(limit,languageValue());q('rp-allow-90').hidden=!Number.isFinite(limit)||limit<=0||limit>=90;}
  function refresh(){updateAngleHelp();settingsTabs.setAttribute('aria-label',tr('settingsTabs'));for(const node of dialog.querySelectorAll('[data-rp-icon-label]'))setIconButton(node,node.dataset.rpIconName,tr(node.dataset.rpIconLabel));for(const node of dialog.querySelectorAll('[data-rp-text]')){const key=node.dataset.rpText;if(node.tagName==='LABEL'){const first=node.firstChild;if(first?.nodeType===3)first.nodeValue=tr(key);else node.prepend(document.createTextNode(tr(key)));}else node.textContent=tr(key);}const p=getProject();spatialNotice.hidden=!hasSpatialPipe(p);if(!spatialNotice.hidden)q('rp-apply').disabled=true;q('rp-tool-summary').textContent=tr('diameter')+': '+format(p.diameter)+' mm · '+tr('radius')+': '+format(p.radius)+' mm';if(opened){renderWallRows();updateSegmentChoices();renderPipeFields();}markPlacementRows();renderAdjustments();if(pendingPipeEdit){showError(pendingMessage());pipeFeedback(false,pendingMessage());}if(dialog.open)draw();}
  function defaultInput(){return defaultWallPlanInput();}
  function open(){
    let savedIssue=false;const active=document.activeElement;if(!dialog.open)returnFocus=active?.closest('#app-menu')?document.querySelector('#app-menu > summary'):active;const key=fingerprint(),reuse=opened&&key===projectKey;
    if(!reuse){detourNoticeContext=null;activeSettingsTab='walls';selectedPlacement=null;selectMode='wall';setSettingsTab('walls');pipeUndo=[];lastSafe=null;selectedPipe=null;manualPipe=false;numericPipeInvalid=false;pendingPipeEdit=null;autoAdjustments=[];const stored=storedDraft()||migrateRoomPlanner(getProject().planner);savedIssue=!!(stored?.error||stored?.savedError);migrated=!!stored?.migrated;manualPipe=!!stored?.pipeEdited||!!stored?.routeEdited;writeInput(stored?.input?{...defaultInput(),...clone(stored.input)}:defaultInput());draftPoints=stored&&Array.isArray(stored.points)?clone(stored.points):[];
      if(!manualPipe&&validDetourPair(stored?.pipeDetourNotice,input())&&sameDetourContext(stored.input,input()))detourNoticeContext={...stored.pipeDetourNotice,input:clone(input()),points:clone(draftPoints)};
      const pending=stored?.pipeEditPending,model=pipeModelFromPoints(draftPoints);if(model.ok&&pending&&['length','turn'].includes(pending.type)&&Number.isInteger(pending.index)&&pending.index>=0&&pending.index<(pending.type==='length'?model.lengths:model.turns).length&&typeof pending.raw==='string'&&pending.raw.length<100){pendingPipeEdit={type:pending.type,index:pending.index,raw:pending.raw,direction:pending.direction===-1?-1:1,code:String(pending.code||'EDIT_NO_SOLUTION'),error:String(pending.error||'Rettelsen kunne ikke tilpasses. Røret er ikke ændret.')};selectedPipe={type:pending.type,index:pending.index};numericPipeInvalid=true;manualPipe=true;}
      autoAdjustments=Array.isArray(stored?.pipeAdjustments)?stored.pipeAdjustments.filter(change=>['length','turn'].includes(change.type)&&Number.isInteger(change.index)&&change.index>=0&&Number.isFinite(change.from)&&Number.isFinite(change.to)).slice(0,400):[];result=null;q('rp-apply').disabled=true;status.textContent='';showError('');q('rp-summary').textContent='';viewport.reset();
    }
    opened=true;projectKey=key;if(draftPoints.length>=2)selectMode='pipe';legacyNotice.hidden=!migrated;showView();refresh();renderPoints();draw();
    if(!lastSafe){try{const applied=migrateRoomPlanner(getProject().planner);if(applied?.input&&applied.points?.length>=2){const candidate={...input(),start:applied.input.start,end:applied.input.end},checked=validateWallRoute(candidate,applied.points);if(checked.ok)lastSafe={points:clone(checked.points),start:clone(candidate.start),end:clone(candidate.end),selected:null,adjustments:[]};}}catch{}}
    if(draftPoints.length>=2){try{const checked=validateWallRoute(input(),draftPoints);if(pendingPipeEdit){if(checked.ok)lastSafe=pipeSnapshot();checkDraft();}else accept(checked);}catch{showError(tr('unexpected'));}}if(savedIssue)showError(tr('invalidSaved'));q('rp-title').focus({preventScroll:true});
  }
  function previewGeometry(){
    if(result?.ok)return result;
    if(draftPoints.length<2||draftPoints.some(p=>!Array.isArray(p)||!p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8)))return null;
    const extent=Math.max(1,...draftPoints.flat().map(Math.abs),getProject().radius);
    try{const geometry=buildRouteGeometry({radius:Number(getProject().radius),maxAngle:178.999999,width:extent,height:extent},draftPoints);return geometry.ok?geometry:null;}catch{return null;}
  }
  function updateLocalAnnotations(state){
    const frame=detailFrame;if(!frame?.localLayer||!state)return;const density=Number(state.pixelsPerUnit)||1,inverse=1/density,rect=svg.getBoundingClientRect?.(),width=Number(rect?.width)||state.width,height=Number(rect?.height)||state.height;
    const toScreen=p=>[(p[0]-state.x)*density+width/2,(p[1]-state.y)*density+height/2],toBase=p=>[state.x+(p[0]-width/2)*inverse,state.y+(p[1]-height/2)*inverse],worldScreen=p=>toScreen(frame.P(p)),layer=frame.localLayer;
    const focused=document.activeElement,focusKey=layer.contains?.(focused)?focused?.getAttribute?.('data-local-key'):null;layer.replaceChildren();
    const node=(tag,attrs,text,parent=layer)=>{const child=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))child.setAttribute(key,String(value));if(text!==undefined)child.textContent=text;parent.append(child);return child;};
    const line=(points,cls='rp-local-wall-dimension-line')=>{const a=toBase(points[0]),b=toBase(points[1]);return node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:cls,'vector-effect':'non-scaling-stroke','pointer-events':'none'});};
    const group=(x,y,angle,key,attrs={})=>{const p=toBase([x,y]);return node('g',{'data-screen-constant':'','data-local-key':key,transform:`translate(${p[0]} ${p[1]}) rotate(${angle||0}) scale(${inverse})`,...attrs});};
    const activate=(element,action)=>{element.addEventListener('click',action);element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}});};
    if(selectMode==='pipe'){

      const selected=selectedPipe,part=selected&&(selected.type==='length'?frame.pickGeometry?.straights:frame.pickGeometry?.arcs)?.[selected.index],model=frame.model;
      if(part&&model?.ok){
        const worldCenter=[frame.cx+(state.x-frame.width/2)/frame.scale,frame.cy-(state.y-frame.height/2)/frame.scale],picked=pickPipePart({geometry:selected.type==='length'?{straights:[part],arcs:[]}:{straights:[],arcs:[part]},point:worldCenter,pixelsPerMm:frame.scale*density,maxDistancePx:1e12}),anchor=picked?worldScreen(picked.point):part.samples?.length?worldScreen(part.samples[Math.floor(part.samples.length/2)]):null;
        if(anchor&&anchor[0]>=0&&anchor[0]<=width&&anchor[1]>=0&&anchor[1]<=height){
          const value=(selected.type==='length'?model.lengths:model.turns)[selected.index],text=(selected.type==='length'?'L':'B')+(selected.index+1)+' · '+format(Math.abs(value))+(selected.type==='length'?' mm':'°'),boxWidth=Math.max(66,text.length*7+18),measured=frame.dimensions.find(item=>item.type===selected.type&&item.index===selected.index);
          let normal=measured?[measured.normal[0],-measured.normal[1]]:[0,-1];if(!measured&&selected.type==='length'){const a=worldScreen(part.start),b=worldScreen(part.end),length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length)normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length];if(normal[1]>0)normal=normal.map(n=>-n);}
          const avoid=[];for(const end of [frame.data.start,frame.data.end])try{const p=worldScreen(pointOnWall(frame.data,end));avoid.push({x:p[0],y:p[1],width:28,height:28});}catch{}for(const clip of frame.data.clips)try{const p=worldScreen(pointOnWall(frame.data,clip));avoid.push({x:p[0],y:p[1],width:18,height:18},{x:p[0]+22,y:p[1]-10,width:34,height:22});}catch{}for(const item of frame.gapLabelObstacles||[]){const p=toScreen([item.x,item.y]);avoid.push({...item,x:p[0],y:p[1]});}
          const tangent=[-normal[1],normal[0]],distance=Math.min(Math.abs(normal[0])>1e-8?boxWidth/2/Math.abs(normal[0]):Infinity,Math.abs(normal[1])>1e-8?11/Math.abs(normal[1]):Infinity)+26,candidates=[];
          for(const side of [1,-1])for(const along of [0,24,-24,44,-44]){const x=Math.max(boxWidth/2+4,Math.min(width-boxWidth/2-4,anchor[0]+normal[0]*distance*side+tangent[0]*along)),y=Math.max(15,Math.min(height-15,anchor[1]+normal[1]*distance*side+tangent[1]*along)),overlaps=avoid.filter(box=>Math.abs(x-box.x)<(boxWidth+box.width)/2+3&&Math.abs(y-box.y)<(22+box.height)/2+3).length,dx=x-anchor[0],dy=y-anchor[1],factor=Math.max(Math.abs(dx)/(boxWidth/2),Math.abs(dy)/11),leader=factor>1?Math.hypot(dx,dy)*(1-1/factor):0;if(leader<=35)candidates.push({x,y,score:overlaps*10000+Math.hypot(dx,dy)+(side<0?2:0)});}
          if(!candidates.length)candidates.push({x:Math.max(boxWidth/2+4,Math.min(width-boxWidth/2-4,anchor[0])),y:Math.max(15,Math.min(height-15,anchor[1])),score:0});
          candidates.sort((a,b)=>a.score-b.score);const {x,y}=candidates[0],dx=x-anchor[0],dy=y-anchor[1],factor=Math.max(Math.abs(dx)/(boxWidth/2),Math.abs(dy)/11);
          if(factor>1)line([anchor,[x-dx/factor,y-dy/factor]],'rp-pipe-callout-leader');
          const marker=group(anchor[0],anchor[1],0,'pipe-point');node('circle',{cx:0,cy:0,r:3,class:'rp-selected-point'},undefined,marker);
          const label=group(x,y,0,'pipe:'+selected.type+':'+selected.index,{class:'rp-selected-callout','data-pipe-callout':selected.type+':'+selected.index,'data-part-value':value,role:'button',tabindex:0,'aria-label':text});node('rect',{x:-boxWidth/2,y:-11,width:boxWidth,height:22,rx:6,class:'rp-selected-badge'},undefined,label);node('text',{x:0,y:4,'text-anchor':'middle',class:'rp-selected-label'},text,label);activate(label,()=>selectPipe(selected.type,selected.index));
        }
      }
    }else{
      const obstacles=frame.polygons.map(item=>item.points.map(worldScreen));
      for(const anchor of [frame.data.start,frame.data.end])try{const point=worldScreen(pointOnWall(frame.data,anchor));obstacles.push(rectPolygon(...point,28,28));}catch{}
      frame.data.clips.forEach((clip,index)=>{try{const point=worldScreen(pointOnWall(frame.data,clip));obstacles.push(rectPolygon(...point,18,18),rectPolygon(point[0]+20,point[1]-10,30,22));}catch{}});
      const tubeWidth=frame.data.diameter*frame.scale*density;for(const part of frame.geometry?.straights||[])obstacles.push(wallSegmentFootprint(worldScreen(part.start),worldScreen(part.end),Math.max(2,tubeWidth+3)));
      for(const item of frame.gapLabelObstacles||[]){const point=toScreen([item.x,item.y]);obstacles.push(rectPolygon(...point,item.width,item.height));}
      let labels;try{labels=layoutLocalWallLabels({segments:frame.layout.segments.map(segment=>({index:segment.index,a:worldScreen(segment.start),b:worldScreen(segment.end),outward:[-segment.normal[0],segment.normal[1]],text:wallName(segment.index),dimensionText:format(segment.length)+' mm'})),width,height,obstacles,selectedIndex:activeWall});}catch{labels={dimensions:[],badges:[],groups:[],unplaced:[]};}

      for(const item of [...labels.dimensions,...labels.badges,...labels.groups]){
        if(item.dimensionLine)line(item.dimensionLine);for(const points of [...(item.extensionLines||[]),...(item.ticks||[])])line(points);
        if(item.leader)line(item.leader,'rp-wall-leader rp-local-wall-leader');
        const isGroup=item.kind==='group',key=isGroup?'group:'+item.indices.join(','):'wall:'+item.index,attrs={class:'rp-wall-callout rp-local-wall-label'+(isGroup?' rp-wall-group':'')+(item.kind==='dimension'?' rp-wall-selected-dimension':'')+(item.selected?' rp-callout-selected':''),role:'button',tabindex:0,'aria-label':isGroup?item.text+' · '+tr('zoomWallGroup'):wallName(item.index),'aria-pressed':item.selected};attrs[isGroup?'data-wall-group':'data-wall-label']=isGroup?item.indices.join(','):item.index;
        const label=group(item.x,item.y,item.angle,key,attrs);node('rect',{x:-item.width/2,y:-item.height/2,width:item.width,height:item.height,rx:isGroup?7:5},undefined,label);node('text',{x:0,y:4,'text-anchor':'middle'},item.text,label);node('title',{},attrs['aria-label'],label);
        activate(label,()=>{if(isGroup){const a=toBase([item.extent.minX,item.extent.minY]),b=toBase([item.extent.maxX,item.extent.maxY]);viewport.fitBounds({minX:a[0],minY:a[1],maxX:b[0],maxY:b[1]},40);}else selectWall(item.index);});
      }
    }
    if(focusKey){const next=[...layer.querySelectorAll('[data-local-key]')].find(item=>item.getAttribute('data-local-key')===focusKey);(next||svg).focus?.({preventScroll:true});}
  }
  function updateDetailAnnotations(state){
    const frame=detailFrame;if(!frame||!state)return;const density=Number(state.pixelsPerUnit)||Number(state.zoom)||1,inverse=1/density;
    svg.setAttribute('data-screen-density',String(density));
    if(frame.lastDensity!==density){
    for(const item of frame.screenGroups){const x=item.anchor[0]+item.offset[0]*inverse,y=item.anchor[1]+item.offset[1]*inverse;item.node.setAttribute('transform',`translate(${x} ${y}) rotate(${item.angle}) scale(${inverse})`);if(item.leader){item.leader.setAttribute('x2',String(x));item.leader.setAttribute('y2',String(y));}}
    for(const item of frame.backings){const d=8*inverse,n=item.normal;item.node.setAttribute('points',[item.a,item.b,[item.b[0]-n[0]*d,item.b[1]-n[1]*d],[item.a[0]-n[0]*d,item.a[1]-n[1]*d]].map(p=>p.join(',')).join(' '));}
    for(const item of frame.physicalInsets){const width=Math.max(0,item.width-item.inset*inverse);item.node.setAttribute('style','stroke-width:'+width);item.node.setAttribute('display',width>0?'inline':'none');}
    for(const item of frame.screenRadii)item.node.setAttribute('r',String(item.radius*inverse));
    for(const node of frame.centerlines)node.setAttribute('display',frame.data.diameter*frame.scale*density>=8?'inline':'none');
    frame.lastDensity=density;
    }
    const layer=frame.gapLayer;layer.replaceChildren();frame.gapLabelObstacles=[];const box=state.viewBox||{x:state.x-state.width/state.zoom/2,y:state.y-state.height/state.zoom/2,width:state.width/state.zoom,height:state.height/state.zoom};
    const centerWorld=[frame.cx+(state.x-frame.width/2)/frame.scale,frame.cy-(state.y-frame.height/2)/frame.scale];
    const adjusted=record=>{
      const wall=frame.layout.segments[record.wallIndex],part=record.type==='length'?frame.geometry?.straights?.[record.index]:null;if(!wall||!part||!record.onFace)return record;
      const dx=part.end[0]-part.start[0],dy=part.end[1]-part.start[1],length=Math.hypot(dx,dy);if(Math.abs(dx*wall.unit[1]-dy*wall.unit[0])>1e-8*length)return record;
      const station=p=>(p[0]-wall.start[0])*wall.unit[0]+(p[1]-wall.start[1])*wall.unit[1],lo=Math.max(0,Math.min(station(part.start),station(part.end))),hi=Math.min(wall.length,Math.max(station(part.start),station(part.end)));if(hi<lo)return record;
      const at=Math.max(lo,Math.min(hi,station(centerWorld))),wallPoint=[wall.start[0]+wall.unit[0]*at,wall.start[1]+wall.unit[1]*at],shift=[wallPoint[0]-record.wallPoint[0],wallPoint[1]-record.wallPoint[1]];
      return{...record,wallPoint,centerPoint:[record.centerPoint[0]+shift[0],record.centerPoint[1]+shift[1]],outsidePoint:[record.outsidePoint[0]+shift[0],record.outsidePoint[1]+shift[1]]};
    };
    const candidates=frame.dimensions.map(adjusted).map(record=>{const a=frame.P(record.wallPoint),b=frame.P(record.outsidePoint),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],selected=selectedPipe?.type===record.type&&selectedPipe.index===record.index;return{record,a,b,mid,selected,distance:Math.hypot(mid[0]-state.x,mid[1]-state.y)};}).filter(item=>item.record.onFace&&Math.abs(item.record.gap)*frame.scale*density>=4&&item.mid[0]>=box.x&&item.mid[0]<=box.x+box.width&&item.mid[1]>=box.y&&item.mid[1]<=box.y+box.height).sort((a,b)=>Number(b.selected)-Number(a.selected)||a.distance-b.distance);
    const shown=[];
    const node=(tag,attrs,text,parent=layer)=>{const child=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))child.setAttribute(key,String(value));if(text!==undefined)child.textContent=text;parent.append(child);return child;};
    for(const item of candidates){if(shown.length===3)break;if(shown.length&&!item.selected&&Math.abs(item.record.gap)*frame.scale*density<10)continue;if(shown.some(other=>Math.hypot(item.mid[0]-other.mid[0],item.mid[1]-other.mid[1])*density<60&&Math.abs(item.record.gap-other.record.gap)<0.1))continue;shown.push(item);
      const {record,a,b}=item,n=[record.normal[0],-record.normal[1]],t=[-n[1],n[0]],group=node('g',{class:'rp-gap-dimension','data-gap-mm':record.gap,'data-wall-index':record.wallIndex,'data-primitive-type':record.type,'data-primitive-index':record.index,'data-wall-x':record.wallPoint[0],'data-wall-y':record.wallPoint[1],'data-outside-x':record.outsidePoint[0],'data-outside-y':record.outsidePoint[1],'data-projected-gap':Math.abs(record.gap)*frame.scale*density});
      node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'rp-gap-line','vector-effect':'non-scaling-stroke'},undefined,group);
      for(const p of [a,b])node('line',{x1:p[0]-t[0]*3*inverse,y1:p[1]-t[1]*3*inverse,x2:p[0]+t[0]*3*inverse,y2:p[1]+t[1]*3*inverse,class:'rp-gap-line','vector-effect':'non-scaling-stroke'},undefined,group);
      const text=format(record.gap)+' mm',width=Math.max(48,text.length*7+14),halfWidth=(width/2+4)*inverse,halfHeight=15*inverse;
      const choices=[-1,1].map(side=>side<0?[a[0]+(-n[0]*45+t[0]*18)*inverse,a[1]+(-n[1]*45+t[1]*18)*inverse]:[b[0]+n[0]*(frame.data.diameter*frame.scale+45*inverse)+t[0]*18*inverse,b[1]+n[1]*(frame.data.diameter*frame.scale+45*inverse)+t[1]*18*inverse]);
      const inside=p=>p[0]-halfWidth>=box.x&&p[0]+halfWidth<=box.x+box.width&&p[1]-halfHeight>=box.y&&p[1]+halfHeight<=box.y+box.height;
      const preferred=choices.find(inside)||choices[0],x=Math.max(box.x+halfWidth,Math.min(box.x+box.width-halfWidth,preferred[0])),y=Math.max(box.y+halfHeight,Math.min(box.y+box.height-halfHeight,preferred[1]));
      node('line',{x1:a[0],y1:a[1],x2:x,y2:y,class:'rp-gap-witness','vector-effect':'non-scaling-stroke'},undefined,group);
      frame.gapLabelObstacles.push({x,y,width,height:22});
      const label=node('g',{class:'rp-gap-label','data-screen-constant':'',transform:`translate(${x} ${y}) scale(${inverse})`},undefined,group);node('rect',{x:-width/2,y:-11,width,height:22,rx:4},undefined,label);node('text',{x:0,y:4,'text-anchor':'middle'},text,label);node('title',{},tr('measuredGap')+': '+text,group);
    }
    updateLocalAnnotations(state);
  }
  function draw(){
    if(!dialog.open)return;renderDetourNotice();detailFrame=null;
    const focused=document.activeElement,focusAttribute=['data-wall-reference','data-wall-label','data-segment','data-pipe-length','data-pipe-bend'].find(key=>focused?.hasAttribute?.(key)),focusIndex=focusAttribute?focused.getAttribute(focusAttribute):null;
    const data=input(),layout=wallLayout(data),width=Math.max(280,visual.clientWidth||600),height=Math.min(width<480?310:430,Math.max(180,Math.floor((Number(globalThis.innerHeight)||1100)*0.42))),margin=Math.min(72,Math.max(42,height/5));
    dialog.setAttribute('data-select-mode',selectMode);settings.hidden=selectMode==='pipe';wallOverview.hidden=selectMode==='pipe';q('rp-route-editor').hidden=selectMode!=='pipe'||draftPoints.length<2;
    svg.setAttribute('data-select-mode',selectMode);svg.setAttribute('data-pipe-valid',String(!!result?.ok));q('rp-select-wall').setAttribute('aria-pressed',String(selectMode==='wall'));q('rp-select-pipe').setAttribute('aria-pressed',String(selectMode==='pipe'));svg.setAttribute('height',String(height));viewport.update(width,height);svg.setAttribute('aria-label',tr('preview'));svg.replaceChildren();q('rp-wall-dimensions').replaceChildren();q('rp-dimensions-title').hidden=!wall.lengths.length||selectMode==='pipe';q('rp-wall-dimensions').hidden=selectMode==='pipe';
    function s(tag,attrs,text,parent=svg){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,val]of Object.entries(attrs))node.setAttribute(key,String(val));if(text!==undefined)node.textContent=text;parent.append(node);return node;}
    if(!layout.ok){s('text',{x:width/2,y:height/2,'text-anchor':'middle',class:'rp-svg-label'},wall.lengths.length?tr('invalid'):tr('previewEmpty'));return;}
    const polygons=[];for(const item of data.obstacles){try{const polygon=wallObstaclePolygon(data,item);if(polygon?.points?.every(p=>p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8)))polygons.push(polygon);}catch{}}
    const preview=previewGeometry(),samples=preview?.pathPoints||draftPoints;
    const frameSamples=result?.ok?samples:(lastSafe?.points||[]);
    const all=[...layout.points,...polygons.flatMap(o=>o.points),...frameSamples.filter(p=>p?.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8))];
    for(const anchor of [data.start,data.end,...data.clips]){try{const point=pointOnWall(data,anchor);if(point?.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8))all.push(point);}catch{}}
    for(const segment of layout.segments){const d=Math.max(50,Number(data.wallGap)||0)+data.diameter/2;all.push([segment.start[0]+segment.normal[0]*d,segment.start[1]+segment.normal[1]*d],[segment.end[0]+segment.normal[0]*d,segment.end[1]+segment.normal[1]*d]);}
    const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min((width-2*margin)/Math.max(100,maxX-minX),(height-2*margin)/Math.max(100,maxY-minY)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    if(!Number.isFinite(scale)||scale<=0)return;
    const P=p=>[width/2+(p[0]-cx)*scale,height/2-(p[1]-cy)*scale];
    const pointString=points=>points.map(P).map(p=>p.join(',')).join(' ');
    svg.setAttribute('data-world-scale',String(scale));svg.setAttribute('data-world-diameter',String(data.diameter));
    const screenGroups=[],backings=[],physicalInsets=[],screenRadii=[],centerlines=[];
    function screenGroup(anchor,offset=[0,0],angle=0){const node=s('g',{'data-screen-constant':'','data-screen-anchor-x':anchor[0],'data-screen-anchor-y':anchor[1]});screenGroups.push({node,anchor,offset,angle});return node;}
    const analytic=geometry=>geometryToSvgPath(geometry,{mapPoint:P,scale,flipY:true});
    const physicalWidth=data.diameter*scale;

    for(const segment of layout.segments){const item=el('button',{type:'button','data-wall-reference':segment.index,'aria-pressed':segment.index===activeWall},wallName(segment.index));item.addEventListener('click',()=>selectWall(segment.index));q('rp-wall-dimensions').append(item);}
    for(const seg of layout.segments){const a=P(seg.start),b=P(seg.end),normal=[seg.normal[0],-seg.normal[1]],node=s('polygon',{class:'rp-wall-backing','data-wall-backing':seg.index});backings.push({node,a,b,normal});}
    for(const item of polygons){const polygon=s('polygon',{points:pointString(item.points),class:'rp-obstacle'+(selectedPlacement?.kind==='obstacle'&&selectedPlacement.id===item.id?' rp-obstacle-selected':''),'vector-effect':'non-scaling-stroke','data-rp-obstacle-id':item.id,role:'button',tabindex:selectMode==='wall'?0:-1,'aria-label':tr('obstacle')}),title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=tr('obstacle')+' '+(item.id||'');polygon.append(title);polygon.addEventListener('click',event=>{if(selectMode==='wall'&&(event.detail===0||!Number.isFinite(event.detail)))selectPlacement('obstacle',item.id);});polygon.addEventListener('keydown',event=>{if(selectMode==='wall'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectPlacement('obstacle',item.id,true);}});}
    for(const seg of layout.segments){const a=P(seg.start),b=P(seg.end),selected=seg.index===activeWall;s('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'rp-wall-line rp-wall-face'+(selected?' rp-wall-active':''),'data-wall-face':seg.index,'vector-effect':'non-scaling-stroke',style:'stroke-width:1px'});const arrow=wallDirectionArrow(a,b,selected);if(arrow){const anchor=[(a[0]+b[0])/2,(a[1]+b[1])/2],group=screenGroup(anchor);s('polygon',{points:arrow.map(p=>(p[0]-anchor[0])+','+(p[1]-anchor[1])).join(' '),class:'rp-wall-arrow'},undefined,group);}}
    layout.points.forEach((p,index)=>{const group=screenGroup(P(p));s('circle',{cx:0,cy:0,r:index===0?4:3,class:'rp-wall-node'},undefined,group);});
    if(samples?.length>1&&samples.every(p=>p?.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8))){
      const d=preview?analytic(preview):samples.map((p,index)=>(index?'L':'M')+P(p).join(' ')).join(' '),stateClass=result?.ok?'rp-pipe-route':'rp-pipe-draft rp-pipe-invalid';
      s('path',{d,class:'rp-pipe-body '+stateClass,'data-world-diameter':data.diameter,'data-world-scale':scale,style:'stroke-width:'+physicalWidth});
      const inner=s('path',{d,class:'rp-pipe-body-inner '+(!result?.ok?'rp-pipe-inner-invalid':''),'data-physical-width':physicalWidth,'data-inset-pixels':2});physicalInsets.push({node:inner,width:physicalWidth,inset:2});
      const center=s('path',{d,class:'rp-pipe-centerline','vector-effect':'non-scaling-stroke'});centerlines.push(center);
    }
    data.clips.forEach((clip,index)=>{try{const wp=pointOnWall(data,clip),point=P(wp),seg=layout.segments[clip.segment];if(!seg||!point.every(Number.isFinite))return;const base=P([seg.start[0]+seg.unit[0]*clip.position,seg.start[1]+seg.unit[1]*clip.position]);s('line',{x1:base[0],y1:base[1],x2:point[0],y2:point[1],class:'rp-clip-stem','vector-effect':'non-scaling-stroke'});const group=screenGroup(point);for(const [key,value]of Object.entries({'data-rp-clip-id':clip.id,role:'button',tabindex:selectMode==='wall'?0:-1,'aria-label':tr('clip')+' '+(index+1),'data-selected':selectedPlacement?.kind==='clip'&&selectedPlacement.id===clip.id}))group.setAttribute(key,String(value));s('circle',{cx:0,cy:0,r:5,class:'rp-clip'},undefined,group);s('text',{x:9,y:-8,class:'rp-svg-label'},'K'+(index+1),group);group.addEventListener('click',event=>{if(selectMode==='wall'&&(event.detail===0||!Number.isFinite(event.detail)))selectPlacement('clip',clip.id);});group.addEventListener('keydown',event=>{if(selectMode==='wall'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectPlacement('clip',clip.id,true);}});}catch{}});
    for(const [key,letter]of [['start','A'],['end','B']]){try{const point=P(pointOnWall(data,data[key]));if(!point.every(Number.isFinite))continue;const group=screenGroup(point);for(const [name,value]of Object.entries({'data-rp-anchor':key,role:'button',tabindex:selectMode==='wall'?0:-1,'aria-label':tr(key)}))group.setAttribute(name,String(value));s('circle',{cx:0,cy:0,r:11,class:'rp-end'},undefined,group);s('text',{x:0,y:4,'text-anchor':'middle',class:'rp-end-label'},letter,group);group.addEventListener('click',event=>{if(selectMode==='wall'&&(event.detail===0||!Number.isFinite(event.detail)))selectAnchor(key);});group.addEventListener('keydown',event=>{if(selectMode==='wall'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectAnchor(key,true);}});}catch{}}
    for(const seg of layout.segments){const a=P(seg.start),b=P(seg.end),hit=s('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'rp-wall-hit','vector-effect':'non-scaling-stroke','data-segment':seg.index,tabindex:selectMode==='wall'?0:-1,role:'button','aria-label':tr('selected')+': '+wallName(seg.index),'aria-pressed':seg.index===activeWall});hit.addEventListener('click',event=>{if(Number.isFinite(event.detail)&&event.detail!==0)return;let position=seg.length/2;if(Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)){const bounds=svg.getBoundingClientRect?.();if(bounds?.width&&bounds?.height){const cameraPoint=viewport.clientPoint(event.clientX,event.clientY),screen=[cameraPoint.x,cameraPoint.y],world=[cx+(screen[0]-width/2)/scale,cy-(screen[1]-height/2)/scale];position=Math.max(0,Math.min(seg.length,(world[0]-seg.start[0])*seg.unit[0]+(world[1]-seg.start[1])*seg.unit[1]));}}selectWall(seg.index,position,true,true);});hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectWall(seg.index,null,true,true);}});}

    let pickGeometry=preview;
    if(draftPoints.length>=2&&draftPoints.every(p=>p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e8))){
      const lengthPieces=preview?.straights?.length===draftPoints.length-1?preview.straights:draftPoints.slice(0,-1).map((p,index)=>({start:p,end:draftPoints[index+1]}));
      const bendPieces=preview?.arcs?.length===draftPoints.length-2?preview.arcs:draftPoints.slice(1,-1).map(p=>({vertex:p,samples:[p]}));
      pickGeometry={straights:lengthPieces,arcs:bendPieces};
      const hitAction=(hit,type,index)=>{hit.addEventListener('click',event=>{if(event.detail===0||!Number.isFinite(event.detail))selectPipe(type,index);});hit.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPipe(type,index);}});};
      function selectedPath(d){s('path',{d,class:'rp-pipe-selected',style:'stroke-width:'+physicalWidth});const inner=s('path',{d,class:'rp-pipe-selection-inner','data-physical-width':physicalWidth,'data-inset-pixels':4});physicalInsets.push({node:inner,width:physicalWidth,inset:4});const center=s('path',{d,class:'rp-pipe-centerline','vector-effect':'non-scaling-stroke'});centerlines.push(center);}
      for(let index=0;index<lengthPieces.length;index++){
        const part=lengthPieces[index],a=P(part.start),b=P(part.end),selected=selectedPipe?.type==='length'&&selectedPipe.index===index,d='M'+a.join(' ')+'L'+b.join(' ');
        if(selected)selectedPath(d);
        const hit=s('path',{d,class:'rp-pipe-hit','vector-effect':'non-scaling-stroke','data-pipe-length':index,role:'button',tabindex:selectMode==='pipe'?0:-1,'aria-label':'L'+(index+1)+' · '+tr('pipeLength'),'aria-pressed':selected});hitAction(hit,'length',index);
      }
      for(let index=0;index<bendPieces.length;index++){
        const part=bendPieces[index],points=part.samples,selected=selectedPipe?.type==='turn'&&selectedPipe.index===index,d=points.length>1?analytic({straights:[],arcs:[part]}):'';
        if(selected&&d)selectedPath(d);
        const anchor=P(points[Math.floor(points.length/2)]),hit=d?s('path',{d,class:'rp-pipe-hit','vector-effect':'non-scaling-stroke','data-pipe-bend':index,role:'button',tabindex:selectMode==='pipe'?0:-1,'aria-label':'B'+(index+1)+' · '+tr('pipeAngle'),'aria-pressed':selected}):s('circle',{cx:anchor[0],cy:anchor[1],r:12,class:'rp-pipe-point-hit','data-screen-radius':12,'vector-effect':'non-scaling-stroke','data-pipe-bend':index,role:'button',tabindex:selectMode==='pipe'?0:-1,'aria-label':'B'+(index+1)+' · '+tr('pipeAngle'),'aria-pressed':selected});if(!d)screenRadii.push({node:hit,radius:12});hitAction(hit,'turn',index);
      }
    }

    const gapLayer=s('g',{id:'rp-gap-details','aria-label':tr('measuredGap'),'pointer-events':'none'}),localLayer=s('g',{id:'rp-local-annotations'});
    let dimensions=[];if(preview)try{dimensions=getWallClearanceDimensions({geometry:preview,wallSegments:layout.segments,diameter:data.diameter});}catch{}
    detailFrame={P,scale,cx,cy,width,height,data,layout,geometry:preview,pickGeometry,model:pipeModelFromPoints(draftPoints),polygons,localLayer,screenGroups,backings,physicalInsets,screenRadii,centerlines,gapLayer,dimensions};updateDetailAnnotations(cameraState);

    if(focusAttribute&&/^\d+$/.test(focusIndex))dialog.querySelector('['+focusAttribute+'="'+focusIndex+'"]')?.focus?.({preventScroll:true});
  }
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>draw()).observe(visual);
  globalThis.addEventListener?.('resize',()=>{if(dialog.open)draw();});
  refresh();
  if(globalThis.location?.hash==='#wall-planner')queueMicrotask(()=>open());
  return {open,refresh,exportDraft,setDraft,validateDraft:normalizeWallDraft,isOpen:()=>!!dialog.open};
}
