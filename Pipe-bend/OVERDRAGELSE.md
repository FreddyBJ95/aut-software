# Overdragelse: Pipe-bend

Dato: 22. november 2026.

Dette dokument er skrevet til den næste Codex-agent. Læs også `README.md`, og kontrollér den aktuelle kode, før du ændrer noget.

## Arbejdsform og seneste ønske

Brugeren ønsker nu at arbejde med hele projektet lokalt på sin computer og lade sin egen Codex-agent overtage. Denne overdragelse er særskilt godkendt til at blive lagt på Git. Fortsæt lokalt; udgiv ikke nye appændringer automatisk uden brugerens ønske. Slet ikke det eksisterende repository eller den offentlige app.

Den aktuelle udgave er **v44**, videreført fra v43-commit `6560436`. Version 44 gør samlingsmarkøren mindre ved oversigtszoom og fremhæver selve den farvede bukkebue i arbejdstegningen. Brugeren bad den 22. november 2026 om at få v44 committed og udgivet fra `main` gennem GitHub Pages-workflowet; kontrollér altid den konkrete Pages-kørsel, før udgivelsen meldes færdig.

- Repository: https://github.com/FreddyBJ95/Pipe-bend
- Offentlig app: https://freddybj95.github.io/Pipe-bend/
- Branch ved overdragelsen: `main`.
- Programmet er en statisk PWA med almindelig JavaScript og ES-moduler. Der kræves ingen npm-installation eller buildproces.
- Dansk, norsk og engelsk. Alle geometriske beregninger bruger mm.

## Hvad appen gør nu

1. Opretter rør fra A eller B med længder, bukkevinkler, diameter, godstykkelse og centerlinjeradius.
2. Understøtter både færdigmål til tænkte centerlinjehjørner og lige længder mellem tangentpunkter. Skift mellem måltyper bevarer den fysiske geometri.
3. Viser dokumenterede Swagelok-værktøjer, praktiske afsætningsmål fra A og fra forrige mærke samt kaplængde. Geometrisk centerlinjelængde er en særskilt størrelse.
4. Har Pythagoras, forskydningsberegner, lommeregner, redigering, Fortryd, projektfiler, arbejdsvisning, SVG og udskrift/PDF.
5. Tegner målte vægstykker, klammer og forhindringer og kan foreslå en kontrolleret 2D-rørføring. Brugeren kan rette forslaget med en generel geometrisk løser.
6. Understøtter rumlige rør med op/ned, flere højder, rotation mellem bukkeplaner og fortsættelse fra begge ender.
7. Har visninger ovenfra, forfra, fra siden og drejelig 3D samt zoom/panorering. Højder måles fra samme nulpunkt ved A.
8. Arbejdsvisningen viser én stor valgt projektion. Den valgte side bruges også til SVG og udskrift; fulde fremstillingsdata står nedenunder.
9. Ovenfra kan arbejdsvisningen vælge alle højder eller et bestemt **lag**. Overliggende rør skjuler dermed ikke et valgt lavere lag. L/B-numre og verdenskoordinater bevares. Op/ned-symboler viser forbindelser til andre højder.
10. De rumlige visninger har **Mål: Alle mål / Ved tryk**. Ved tryk vises kun det valgte rørs længde eller bukkets vinkel og højde. Tomt tryk skjuler data igen. I redigeringen kan den viste markering trykkes igen for at rette målet. Træk i 3D drejer modellen uden samtidig at vælge et mål.
11. Venstre/højre og de øvrige retningssymboler står samlet i én vandret række. På meget smalle skærme ruller rækken sidelæns; trykfladerne er fortsat 44 px.
12. Et sammenhængende træk kan opdeles i fysiske rør R1, R2 … med samlinger S1, S2 … på lige stykker. Samlinger kan placeres manuelt eller foreslås ud fra rå rørlængde, værktøjstabellens kaplængde og en brugerdefineret mindste afstand til buk. Tillæg før/efter samlingen understøtter indstik og overlap.
13. Arbejdsvisningen viser et samlet montageoverblik og derefter én A4-lignende arbejdstegning pr. fysisk rør. Hver R-side har lokal formtegning med de oprindelige L/B-numre, kaplængde/tillæg og et udfoldet rør med mål fra kapenden. S1/S2 vises ved den egentlige delelinje; ved overlap/indstik ligger S inde på røret, og `K` viser den fysiske kapende. Rumlige R-sider bruger lokale højder og drejninger fra den overførte reference ved R-start.
14. Printdialogen kan særskilt medtage eller fravælge montageoverblik, R-arbejdstegninger, rørdata, fysiske rør, afsætningsmål, referencelister, en ekstra detaljeret fladoversigt og geometriske bukkedata. Det ekstra flade bilag er fravalgt som standard, fordi R-siderne allerede indeholder den flade tegning. Printvalget gemmes lokalt og er ikke en del af projektfilen.
15. Samlinger bruger samme tydelige dobbeltlinje i live 2D, rumlige projektioner, arbejdsvisning og print. Liveoversigten viser en kompakt `S…`-label, som bliver til `S… · DELING` ved tæt zoom; arbejdsvisning og print viser altid den fulde label. End-on vises som ring/kryds. 3D-markøren beregnes fra den projicerede linje; brug ikke original XYZ direkte i skærmprojektøren.
16. Buk på 30°/45°/60°/90° er henholdsvis violet/blå/gul-okker/mørkegrøn. Andre vinkler er bordeaux og mærket `SPECIAL`; graden bevares altid som tekst i reference- og bukkedata. Visningsvalget `Rørtegning` er omdøbt til `Automatisk 2D`, fordi det er en automatisk drejet plantilpasning og ikke den faste Ovenfra-projektion.
17. Fra v43 bæres standardkoden af hele den farvede rørbue. Store B/vinkelbokse vises ikke længere for standardbuk; kun et lille ubokset B-nummer står ved buen. Den præcise grad findes fortsat i referencelister, fladtegninger og tabeller. `SPECIAL` har fortsat en eksplicit tekstlabel, og et valgt standardbuk kan vise detaljekortet i `Ved tryk`-tilstand.
18. Fra v44 skalerer den synlige samlingsmarkør i live 2D og 3D fra 40 % ved 100 % zoom til fuld størrelse ved 250 % zoom. I oversigten står kun `S1`; tættere på står `S1 · DELING`. Det transparente 44 × 44 px trykområde ændres ikke, og arbejdsvisning/print beholder fuld størrelse. Arbejdstegningens fysiske bukkebue får desuden en diskret farvet fremhævning langs nøjagtig samme SVG-bane, så formen ses tydeligt uden at ændre geometri eller mål.

De tre seneste brugerønsker om retningsrækken, lag og mål ved tryk er allerede implementeret og udgivet. Genimplementér dem ikke blot, fordi de er gentaget i samtalehistorikken. Hvis noget fortsat fejler, undersøg den konkrete kørsel, synlighed og indlæste version.

## Vigtige brugerpræferencer

- Både telefon og pc skal fungere. Brugeren tester især på telefon.
- Hold tegninger, topbjælke og indstillinger enkle. Brug ikoner til rotering/spejling og andre kompakte handlinger med meningsfulde tilgængelige navne.
- Fjern overflødig hjælpetekst fra det almindelige arbejdsflow, men behold målereferencer, enheder og relevante fejl.
- Rettelser skal være generelle. Brugerens eksempler er regressionstilfælde, ikke særlige produktionsgrene for bestemte mål, vinkler eller radier.
- Tegn kun mål og buk, der kan aflæses i den valgte projektion. Et aktivt valg i trykvisning må vise netop den valgte dels data.
- Ændr ikke vægge eller klammer for at gøre en rørrettelse mulig. Et umuligt forslag må ikke fremstå som kontrolleret.
- Foretræk fremdrift og konkrete rettelser frem for gentagne tilladelsesspørgsmål inden for den aftalte opgave.

## Find rundt i koden

| Fil/modul | Ansvar |
| --- | --- |
| `index.html`, `style.css` | Appens hovedstruktur og responsive layout. |
| `app.js` | Projektstate, formularer, redigering, historik, import/eksport og arbejdsvisning. |
| `geometry.mjs` | Den oprindelige plane geometri og forlængelse fra begge ender. |
| `measurements.mjs` | Målemetoder, tangentfradrag, validering og værktøjets afsætningsmål. |
| `benders.mjs` | Dokumenterede værktøjsprofiler og producentens tabelværdier. |
| `displayed-marks.mjs` | Afrunder absolutte mærker én gang og beregner synlige delmål som differencer. |
| `material-sections.mjs` | Validerer samlinger/tillæg, opdeler trækket i fysiske rør, bygger lokal 2D/3D-geometri pr. R-rør, beregner lokale bukkemærker og foreslår samlinger efter rå rørlængde. |
| `spatial-geometry.mjs` | Rumlige linjer/cirkelbuer, startframe, bukkeplaner og fysisk drejning. |
| `spatial-drawing.mjs` | Projektion, synlige/skjulte dele, relevante mål, lag, 3D-rotation og trykvalg. |
| `spatial-layers.mjs` | Finder faktiske konstante højder og masker med de oprindelige L/B-indekser. |
| `main-pipe-drawing.mjs`, `main-pipe-detail.mjs` | Den oprindelige rørtegning med præcise buer og zoomdetaljer. |
| `labels.mjs`, `dimension-layout.mjs`, `main-detail-annotations.mjs` | Placering af lokale referencer og læsbare mål. |
| `bend-visuals.mjs` | Fælles, afledt farve- og labelmodel for 30°/45°/60°/90° samt ikke-standard `SPECIAL`-buk. |
| `joint-visuals.mjs` | Fælles zoommodel for samlingsmarkørens synlige størrelse og kompakte/full label; statiske arbejdstegninger bruger altid fuld størrelse. |
| `room-planner.mjs`, `room-planner.css` | Selvstændig vægarbejdsflade, indstillinger og anvendelse af forslag. |
| `wall-routing.mjs` | Forslag langs vægge samt kontrol af radius, afstande og forhindringer. |
| `wall-pipe-solver.mjs`, `wall-pipe-edit.mjs` | Generelle koblede rettelser af rørmål under geometriske begrænsninger. |
| `wall-viewport.mjs`, `wall-picking.mjs` | Kamera, zoom, pan, berøringer og valg af geometri. |
| `wall-label-layout.mjs`, `wall-detail-geometry.mjs` | Vægtegningens referencer og detaljer. |
| `project-storage.mjs`, `wall-validation-status.mjs` | Projektidentitet, selvstændige vægudkast og sandfærdig kontrolstatus. |
| `blank-layout.mjs` | Læsbar afmærkning langs det udfoldede rør. |
| `i18n.mjs`, `ui-icons.mjs` | Oversættelser og SVG-ikoner med navne til tastatur/skærmlæser. |
| `share-app.mjs`, `share-qr.png` | Deling af den eksisterende offentlige app. |
| `sw.js`, `manifest.webmanifest`, `fonts/`, billedfiler | Offline/PWA og lokale aktiver. |

## Bevar disse kontrakter

### Geometri og mål

- `resolveMeasurements`, `convertMeasurementMode` og `bendMarkLayout` i `measurements.mjs` er fælles grundlag. Du må ikke indføre en anden fortolkning i en enkelt visning.
- Færdigmål omregnes til tangentlængder med `R × tan(|vinkel|/2)` ved de tilstødende buk. Buer bruger centerlinjeradius og faktisk vinkel.
- Afsætningsmål efter værktøjstabel og ideal geometrisk længde er forskellige metoder. Bland dem ikke sammen, og interpolér ikke udokumenterede værktøjsvinkler.
- Synlige delmål skal summere til den synlige kaplængde. Beregn dem fra de afrundede absolutte mærker, ikke ved at afrunde hver rå difference uafhængigt.
- Radius skal indgå i den faktiske rørgeometri og kollisionskontrol. Læg ikke et tilfældigt ekstra radiustillæg oven i den ønskede fri afstand til en forhindring.
- Værktøjsrettelser må ikke ændre færdigtegningen; de påvirker fremstillingsmål efter den dokumenterede metode.

### Rumlig model

Projektformatet er fortsat `version: 1`, med valgfrie `bendRotations` og `startFrame`. Ældre projekter uden disse felter beholder deres oprindelige plane form og tal.

- `bendRotations` har præcis én endelig vinkel mellem −180° og 180° pr. buk.
- `startFrame` indeholder vinkelrette enhedsvektorer `tangent` og `normal`.
- Fortegn på `turns` og drejning af bukkeplanet er to forskellige størrelser.
- `spatialBendRotations` beregner den fysiske drejning for et værktøj, der bukker i én retning; fortegnsskift kan give 180° drejning. Tilføj ikke derefter endnu en modstridende højre/venstre-instruktion.
- Drejninger læses fra A mod B, positiv med uret. Første reference vises som 0° ved A; resten relateres til forrige buk.
- `extendSpatial` bevarer de eksisterende dele ved forlængelse fra A. Sammenlign tænkte hjørner/efterfølgende geometri med den rette translation; et nyt buk kan forkorte det gamle yderste tangentstykke.
- Eksplicitte nul-drejninger skal stadig forlænges i takt med `turns`, selv om `hasSpatialPipe` returnerer falsk. Den eksisterende `extendCurrent` håndterer dette.
- Et tangentmål på en lodret lige del er ikke nødvendigvis det samlede højdeskift mellem de vandrette niveauer; tilstødende buer bidrager også. `spatialRiseLabelData` skelner mellem dem.

### SVG og brugerflade

En tidligere alvorlig fejl blev overset af et testmiljø: `svg.hidden = false` fjernede ikke SVG-elementets `hidden`-attribut i browseren. Den rumlige tegning forblev usynlig, selv om visningsstate skiftede korrekt.

- Brug `setAttribute('hidden', '')` / `removeAttribute('hidden')` og `hasAttribute('hidden')` til SVG-synlighed.
- Kameraerne skal kun reagere på den aktive tegnings fælles zoomknapper. Den skjulte tegning må ikke ændre zoomoutput eller kamera.
- Appen observerer nu bredden af tegningens container, så resizing også virker, når det oprindelige SVG er skjult.
- `room-planner.mjs` bruger `pipe-view` som ID for hovedsiden. Genbrug det ikke til visningsvælgere. De korrekte separate ID'er er bl.a. `spatial-view-select`, `work-view-select` og `work-layer-select`.
- Arbejdsvisningen skal bevare valgt side, lag og dataindstilling ved SVG, print og genåbning. Projektændring nulstiller relevante visningsvalg; et slettet højdeniveau falder tilbage til Alle lag.
- Fulde fremstillingsdata er uafhængige af synlige annotationer og må ikke filtreres væk, når man vælger et lag.
- SVG-eksport skal have den valgte projektion og lag i tegningen og må ikke indeholde døde interaktive knaphandlinger. Den eksisterende eksport renser relevante roller/tabindekser.

### Vægforløb

- Vægkontrollen er **2D**. Den må ikke godkende eller flade et rør med højdeskift ud. Den nuværende grænsebesked og blokering af Anvend skal bevares.
- Fri afstand til væg/forhindring måles til rørets **yderside**, ikke centerlinjen.
- Brugeren vælger selv vægforløbet ved at tegne målte stykker. Det er ikke et krav at tegne hele rummet.
- Den generelle detour-vinkel bruger den ønskede maksimale vinkel, når den fundne geometri tillader det; lavere vinkel skal forklares med den eksisterende fallback-besked. Der er ikke et særtilfælde for 120 × 120 mm.
- Den koblede redigeringsløser har begrænset søgetid og er ikke et bevis for, at alle mulige rørføringer kan findes.

## Lagring og flytning til en lokal app

Selve koden og browserens gemte projekter er to forskellige ting.

- Hovedprojekt: `localStorage['pipe-bend-v1']`.
- Vægudkast: egne nøgler pr. UUID, med præfiks `pipe-bend-wall-draft-v2:`.
- Ældre vægudkast migreres kun, hvis deres geometri passer til projektet. Bevar tombstones og projektidentitet.
- JSON-eksport kan indeholde det portable `wallDraft`, så vægge, klammer, forhindringer og igangværende arbejde kan følge med.
- Import validerer før mutation; ugyldige eller for store filer skal bevare det åbne projekt.
- Browserlager er knyttet til origin. GitHub Pages, `localhost:8123`, `localhost:8080` og `127.0.0.1:8123` er forskellige lagre. Brug samme adresse og port hver gang.
- Brug **Gem projekt** i den gamle app og **Åbn projekt** i den lokale app for at flytte en tegning. Rens ikke browserdata for at løse et versionsproblem.

Den lokale kopi ved overdragelsen har en startfil og en fast lokal adresse. Fra en almindelig klon kan du også køre følgende fra projektets rod og åbne http://localhost:8123/:

```sh
python3 -m http.server 8123 --bind 127.0.0.1
```

Åbn ikke bare `index.html` som en `file://`-fil: ES-moduler skal serveres over HTTP.

Den eksisterende Del appen/QR-kode peger fortsat på den offentlige app. Lokale rettelser bliver ikke synlige for kolleger via den gamle QR-kode. En telefon kan ikke åbne computerens `localhost`.

## Test og faktisk valideringsniveau

Der er **30** selvstændige Node-testsæt i den lokale v44-arbejdskopi. De består sammen med syntakskontrol af JavaScript og kontrol af alle **56** offlineaktiver.

Kør fra projektets rod:

```sh
node test.mjs
```

Alle testsæt kan køres uden npm:

```sh
python3 - <<'PYTEST'
from pathlib import Path
import subprocess
failures = []
for path in sorted(Path('.').glob('*test.mjs')):
    result = subprocess.run(['node', str(path)])
    if result.returncode:
        failures.append(str(path))
raise SystemExit(bool(failures))
PYTEST
```

Det eksisterende GitHub Actions-workflow udgiver appen, men kører ikke automatisk Node-tests. Kør derfor de relevante checks før en eventuel senere udgivelse.

Der er desuden kørt lokale scratch-tests af de faktiske event-handlere ved 280, 340 og 736 px: projektskift, begge ender, import/eksport, ugyldige filer, SVG-synlighed, lag, trykvalg, 3D-drejning, arbejdsvisning og udskriftens renderforløb. De scripts er ikke en del af det offentlige repository. Vigtige seneste navne er `native-spatial-app-smoke.mjs`, `work-height-layer-smoke.mjs` og `on-demand-label-smoke.mjs`.

Version 42 er desuden gennemgået i en rigtig lokal Chromium-browser: live Ovenfra og 3D-overblik viser samlingen på det projicerede rør, `S1 · DELING`, den blå 45°-kode og `SPECIAL · 37°`; montageoverblikket viser samme markante deling, og R1/R2-siderne blev genereret uden browserfejl. Der er ikke testet på en fysisk telefon eller udskrevet en fysisk PDF.

Version 43 er visuelt kontrolleret i samme browser med 45°/90°/60°/37°: live Automatisk 2D og Ovenfra viser hele rørbuen i blå/mørkegrøn/gul/bordeaux, standardbuk har kun små uboksede B-numre, og kun 37° får `SPECIAL`-label. Arbejdsvisningen bruger 14 px farvet rørkrop uden standardbokse; hvis speciallabel-layoutet ikke kan placeres, vises en kompakt `B… · SPECIAL …°`-tekst direkte ved buen. Ingen browserfejl blev observeret.

Version 44 er visuelt kontrolleret i lokal Chromium med et 5,5 m træk, 3 m rå rør, S1 og et 45°-buk. Ved 100 % viser live-tegningen `S1`, skala 0,4 og uændret 44 × 44 px trykområde; ved 246 % vises `S1 · DELING` næsten i fuld størrelse. Montage- og R2-arbejdstegningen viser en blå fremhævning på nøjagtig samme bane som den fysiske B1-bue, og 3D-arbejdsvisningen beholder både fremhævningen og den fulde samlingsmarkør. Ingen browserfejl eller advarsler blev observeret.

Ved nye ændringer bør du prioritere almindelige og rumlige rør, forskellige radier/vinkler, negative/flere højder, forlængelse fra A, smalle skærme og mindst ét tilfælde med sammenfaldende projektioner. Kontrollér faktiske synlige elementer, ikke blot et internt `data-*`-attribut.

## Hvis brugeren senere ønsker en ny udgivelse

Den eksisterende GitHub Pages-konfiguration kan stadig bruges, men lokal udvikling er nu det seneste ønske.

- Udgiv kun efter en relevant bestilling fra brugeren.
- Bevar relative stier; appen skal virke både lokalt og under `/Pipe-bend/`.
- Koordinér versionsquery i HTML/importer og `sw.js`-cache. Nye/ændrede runtime-moduler skal være i offlineaktivlisten med den præcise importsti.
- Cache- og importversionerne i arbejdskopien er v44. Bevar versionsnummeret samlet i HTML, importer og `sw.js` ved senere appændringer.
- Bevar eksisterende ændringer, undgå force-push, og kontrollér deployment-resultatet, før du melder en ændring udgivet.

## Anbefalet første skridt for den næste agent

1. Læs dette dokument og kontrollér projektmappen, dens instruktioner og ændringer.
2. Start den lokale app og behold den samme lokale adresse fremover.
3. Kør relevante tests; hvis du arbejder på UI, test også den faktiske synlighed og interaktion i en browser, når en browser er tilgængelig.
4. Version 44 er implementeret, testet og bestilt udgivet oven på v43. Kontrollér altid Git-status og den seneste GitHub Pages-kørsel, før en senere ændring meldes udgivet.
