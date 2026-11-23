# aut-software

Noter og små værktøjer til automatikteknikeruddannelsen i Norge. Repoet er bygget som en samling uafhængige, statiske webapps, der kan udgives samlet med GitHub Pages.

## Apps

| App | Formål | Offentlig adresse |
| --- | --- | --- |
| [Pipe-bend](./Pipe-bend/) | Planlægning, beregning og dokumentation af rørbuk | <https://freddybj95.github.io/aut-software/Pipe-bend/> |
| [Interlock Test Simulator](./Interlock-test-simulator/) | Signalberegning og dokumentation af interlock-tests | <https://freddybj95.github.io/aut-software/Interlock-test-simulator/> |

## Struktur

```text
aut-software/
├── index.html
├── Pipe-bend/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── README.md
├── Interlock-test-simulator/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── README.md
├── notes/
│   └── regulering-og-kalibrering/
└── .github/workflows/pages.yml
```

Hver ny app får sin egen mappe i roden og bruger kun relative filstier. Dermed bliver `Ny-app/` automatisk til `https://freddybj95.github.io/aut-software/Ny-app/` ved næste deploy.

## Lokal udvikling

Start én server fra repoets rod:

```sh
python3 -m http.server 8080
```

Åbn derefter:

- Samlingens forside: <http://localhost:8080/>
- Pipe-bend: <http://localhost:8080/Pipe-bend/>
- Interlock Test Simulator: <http://localhost:8080/Interlock-test-simulator/>

Kør Pipe-bend-testene med:

```sh
cd Pipe-bend
for test_file in *test.mjs; do node "$test_file" || exit 1; done
```

Kør Interlock Test Simulator-testene med:

```sh
cd Interlock-test-simulator
npm test
```

## Udgivelse

Repository-navnet skal være `aut-software`, og GitHub Pages skal bruge **GitHub Actions** som kilde. Workflowet udgiver hele repoet ved push til `main`; der er ingen byggeproces eller npm-afhængigheder.

