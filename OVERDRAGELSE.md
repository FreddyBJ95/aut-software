# Overdragelse: aut-software

Opdateret: 23. november 2026.

Dette dokument er indgangen for nye Codex-chats, der skal bygge eller vedligeholde software i repoet. Læs også [README.md](./README.md) og den enkelte apps egen dokumentation, før du ændrer kode.

## Formål

`aut-software` er Frederiks fælles repository til:

- små apps og PWA'er, der gør arbejdet lettere under automatikteknikeruddannelsen i Norge;
- beregning, regulering, kalibrering, montage og fejlfinding;
- faglige noter, procedurer og tjeklister.

- Repository: <https://github.com/FreddyBJ95/aut-software>
- Offentlig forside: <https://freddybj95.github.io/aut-software/>
- Standardbranch: `main`

## Vigtigt om den lokale mappe

Repoets lokale rod kan stadig ligge i en ydre mappe, der hedder `Pipe-bend`:

```text
/Users/frederik/Documents/GitHub/Pipe-bend/   ← repoets rod
├── .git/
├── README.md
├── OVERDRAGELSE.md
├── index.html
├── Pipe-bend/                                ← én app
└── notes/
```

En Codex-chat til dette repo skal tilknyttes **repoets rod**, altså mappen med `.git`, dette dokument og den fælles `index.html`. Hvis en chat kun åbnes med den indre `Pipe-bend/`-mappe, kan den ikke se eller oprette de andre apps på den rigtige placering.

Den foretrukne langsigtede lokale placering er:

```text
/Users/frederik/Documents/GitHub/aut-software/
```

Hvis repoet klones på ny dér, skal Codex-projektets primære mappe ændres til den nye repo-rod.

## Arbejdsform: én chat pr. app

Brug ét lokalt Codex-projekt for hele `aut-software`, men start en separat chat for hvert stykke software. Eksempler:

- `Pipe-bend`
- `4–20 mA-beregner`
- `PID-regulator`
- `Kalibreringsrapport`

Hver chat arbejder primært i sin egen appmappe. Den må gerne opdatere den fælles forside og README, når en ny app tilføjes, men skal undgå uvedkommende ændringer i andre apps.

Ved parallelle chats:

1. Kontrollér `git status` før ændringer.
2. Bevar alle eksisterende ændringer, som chatten ikke selv har lavet.
3. Commit kun filer, der hører til den aktuelle opgave.
4. Undgå at omdøbe, nulstille eller slette andre appmapper.

## Nuværende struktur

```text
aut-software/
├── .github/workflows/pages.yml   # udgiver hele repoet på GitHub Pages
├── index.html                    # fælles offentlig appoversigt
├── README.md                     # kort repo- og udvikleroversigt
├── OVERDRAGELSE.md               # dette dokument
├── Pipe-bend/                    # selvstændig PWA
│   ├── README.md
│   ├── OVERDRAGELSE.md           # detaljeret appoverdragelse
│   ├── index.html
│   ├── manifest.webmanifest
│   └── sw.js
└── notes/
    └── regulering-og-kalibrering/
```

## Tilføj en ny app

En ny app skal ligge direkte i sin egen mappe i repoets rod:

```text
aut-software/
└── Ny-app/
    ├── index.html
    ├── README.md
    └── ...
```

Mappenavnet bliver en del af den offentlige, versalfølsomme URL:

```text
https://freddybj95.github.io/aut-software/Ny-app/
```

Når en app tilføjes:

1. Brug relative filstier, så appen virker under `/aut-software/App-navn/`.
2. Tilføj appen på den fælles `index.html`.
3. Tilføj den til app-tabellen i `README.md`.
4. Opret en kort `README.md` i appmappen med formål, lokal start og testkommandoer.
5. Hvis den er en PWA, brug et relativt `start_url`, `scope`, ikoner og service-worker-stier.
6. Giv service-worker-cachen et navn, der er unikt for appen og dens version.
7. Test både lokalt og på den endelige undermappe-URL.

Der er normalt ingen grund til at ændre `.github/workflows/pages.yml`; workflowet udgiver hele repoet ved push til `main`.

## Lokal udvikling

Start en statisk server fra repoets rod:

```sh
python3 -m http.server 8080
```

Åbn:

- Fælles forside: <http://localhost:8080/>
- Pipe-bend: <http://localhost:8080/Pipe-bend/>
- Ny app: `http://localhost:8080/App-mappe/`

Start ikke serveren inde i en enkelt appmappe, når du tester repoets fælles struktur og undermappeadresser.

## Git og udgivelse

Den primære remote er:

```text
origin  https://github.com/FreddyBJ95/aut-software.git
```

Det tidligere selvstændige Pipe-bend-repo kan være bevaret lokalt som remote `pipe-bend`. Nye ændringer skal normalt pushes til `origin`, ikke til den gamle remote.

GitHub Pages bruger workflowet `.github/workflows/pages.yml`. Efter et push til `main` skal den relevante Actions-kørsel være grøn, og de offentlige URL'er skal kontrolleres. En lokal test alene beviser ikke, at Pages-deployet virker.

## Eksisterende Pipe-bend-app

Pipe-bend er allerede flyttet ind som selvstændig PWA under `Pipe-bend/`:

- App: <https://freddybj95.github.io/aut-software/Pipe-bend/>
- Kort dokumentation: [Pipe-bend/README.md](./Pipe-bend/README.md)
- Detaljeret teknisk overdragelse: [Pipe-bend/OVERDRAGELSE.md](./Pipe-bend/OVERDRAGELSE.md)

Læs appens egen overdragelse før ændringer. Dens geometri, målemetoder, PWA-cache, oversættelser og omfattende tests har egne kontrakter, som ikke bør duplikeres i dette roddokument.

## Noter

Faglige noter ligger under `notes/`. Hold dem adskilt fra appkode, men link gerne til relevante noter fra en app eller dens README. Noter om regulering og kalibrering starter i:

```text
notes/regulering-og-kalibrering/
```

