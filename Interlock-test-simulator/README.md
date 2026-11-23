# Interlock Test Simulator

Mobilvenlig PWA til beregning og dokumentation af interlock-tests.

## Funktioner

- Instrumentprofiler for analoge og digitale signaler
- Tovejsskalering mellem procesværdi, procent, fysisk signal og PLC-råværdi
- Automatisk testsekvens for stigende og faldende interlocks
- Lokal/offline lagring uden login
- Dansk, norsk og engelsk brugerflade
- JSON-import og -eksport samt udskriftsvenlig rapport

Appen er et beregnings- og dokumentationsværktøj. Den udsender ikke selv fysiske signaler.

## Offentlig adresse

<https://freddybj95.github.io/aut-software/Interlock-test-simulator/>

På mobil kan appen installeres fra browserens menu med **Føj til hjemmeskærm** eller **Installer app**.

## Lokal udvikling

Start en server fra repositoryets rod:

```sh
python3 -m http.server 8080
```

Åbn derefter <http://localhost:8080/Interlock-test-simulator/>.

Kør testene med:

```sh
cd Interlock-test-simulator
npm test
```
