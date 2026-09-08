# Torneo Momy - Tennis Giovanile

Piattaforma web per organizzare, gestire e condividere i tabelloni, i gironi e i risultati del **Torneo Momy** per ragazzi (Under 10, Under 12, Under 14, Under 16).

Progettata per essere gestita con **GitHub Desktop** e pubblicata gratuitamente su **Vercel** in pochi passaggi.

---

## Funzionalità Principali

1. **Tabellone a Eliminazione Diretta (Interactive Bracket)**:
   - Visualizzazione grafica ad albero (Quarti, Semifinali, Finale).
   - Generazione automatica del tabellone da 4, 8 o 16 giocatori con posizionamento delle teste di serie e gestione automatica dei turni di riposo (BYE).
   - Inserimento rapido dei punteggi (short-set 4-1 4-2, formule tradizionali o super tie-break al 3° set).
   - **Avanzamento automatico del vincitore** al turno successivo.

2. **Fase a Gironi (Round Robin)**:
   - Calendario incontri del girone.
   - **Classifica in tempo reale** calcolata automaticamente: partite giocate, vinte, perse, differenza set, differenza game e punti (2 per vittoria).

3. **Programma Campi & Orari (Order of Play)**:
   - Vista centralizzata di tutti gli incontri programmati per campo (Campo 1 Centrale, Campo 2 Terra, Campo 3) e orario.
   - Badge di stato: *In Programma*, *In Corso*, *Terminato*.
   - Filtro rapido per data e stato per le famiglie a bordo campo.

4. **Gestione Iscritti & Atleti**:
   - Elenco partecipanti suddiviso per categoria, circolo di appartenenza, anno di nascita, classifica FITP e teste di serie.
   - Aggiunta, modifica ed eliminazione atleti da parte dell'organizzatore.

5. **Modulo di Pre-iscrizione Online per Genitori**:
   - I genitori possono compilare la richiesta di iscrizione per il proprio figlio direttamente dallo smartphone.
   - L'organizzatore visualizza le richieste nella tab *Richieste Iscrizione* e le convalida con un click.

6. **Modalità Organizzatore / Giudice Arbitro (PIN)**:
   - Modalità pubblica di sola lettura per evitare modifiche accidentali da parte degli utenti.
   - Accesso protetto da codice PIN (**PIN predefinito: `1234`**) per sbloccare la gestione completa.

7. **Salvataggio Automatico, Backup & Stampa**:
   - Salvataggio automatico continuo nel `localStorage` del browser.
   - Esportazione e importazione file di backup `.json` con un click.
   - Foglio di stile ottimizzato per la **stampa su carta A4** da appendere alla bacheca del circolo tennis.

---

## Come caricare con GitHub Desktop e fare il Push

1. Apri **GitHub Desktop** sul tuo Mac.
2. In alto a destra clicca sul pulsante **"Publish repository"**.
3. Nella finestra che compare:
   - **Name**: `Torneo-Momy`
   - Clicca sul pulsante blu **"Publish repository"**.
4. GitHub Desktop creerà il repository su GitHub ed effettuerà il push di tutti i file.

---

## Deploy su Vercel

1. Vai su [vercel.com](https://vercel.com) e accedi con il tuo account **GitHub**.
2. Clicca su **"Add New..."** -> **"Project"**.
3. Seleziona il repository **`Torneo-Momy`** e clicca su **"Import"**.
4. Clicca su **"Deploy"**.
5. In circa 15 secondi il sito del **Torneo Momy** sarà attivo online con link HTTPS gratuito.

---

## Struttura del Progetto

```
Torneo-Momy/
├── index.html           # Applicazione Single Page completa
├── css/
│   └── styles.css       # Stili personalizzati e stampa bacheca A4
├── js/
│   ├── app.js           # Controller interfaccia, orari e punteggi live
│   ├── tournament.js    # Motore tabelloni a eliminazione e gironi
│   └── mock-data.js     # Struttura dati iniziale per il torneo
├── vercel.json          # Configurazione per il deploy su Vercel
├── .gitignore           # File esclusi da Git
└── README.md            # Documentazione del progetto
```
