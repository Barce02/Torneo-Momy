# 🎾 Torneo Momy - Tennis Ragazzi

Piattaforma web moderna e responsive creata per organizzare, gestire e condividere i tabelloni e i risultati del **Torneo Momy** per ragazzi (Under 10, Under 12, Under 14, Under 16).

Progettata per essere gestita con **GitHub Desktop** e pubblicata gratuitamente su **Vercel** in pochi click.

---

## 🌟 Funzionalità Principali

1. **📋 Tabellone a Eliminazione Diretta (Interactive Bracket)**:
   - Visualizzazione grafica ad albero con linee di turno (Quarti, Semifinali, Finale).
   - Generazione automatica del tabellone da 4, 8 o 16 giocatori con posizionamento delle teste di serie e gestione automatica dei turni di riposo (BYE).
   - Inserimento rapido dei punteggi (short-set 4-1 4-2, formule tradizionali o super tie-break al 3° set).
   - **Avanzamento automatico del vincitore** al turno successivo.
   - Animazione con coriandoli celebrativi all'assegnazione del titolo di Campione del Torneo!

2. **🔄 Fase a Gironi (Round Robin)**:
   - Perfetta per i tornei giovanili per consentire a ogni ragazzo di giocare più partite.
   - Calendario incontri del girone.
   - **Classifica in tempo reale** calcolata automaticamente: Partite giocate, vinte, perse, differenza set, differenza game e punti (2 per vittoria).

3. **🎾 Programma Campi & Orari (Order of Play)**:
   - Vista centralizzata di tutti gli incontri programmati per campo (Campo 1 Centrale, Campo 2 Terra, Campo 3...) e orario.
   - Badge di stato live: *In Programma*, *In Corso (LIVE)*, *Terminato*.
   - Filtro rapido per data e stato per le famiglie a bordo campo.

4. **👥 Gestione Iscritti & Atleti**:
   - Elenco partecipanti suddiviso per categoria, circolo di appartenenza, anno di nascita, classifica FITP e teste di serie.
   - Aggiunta, modifica ed eliminazione atleti da parte dell'organizzatore.

5. **📝 Modulo di Pre-iscrizione Online per Genitori**:
   - I genitori possono compilare la richiesta di iscrizione per il proprio figlio direttamente dal cellulare.
   - L'organizzatore visualizza le richieste nella tab *Pre-iscrizioni* e le convalida con un click.

6. **🔒 Modalità Organizzatore / Giudice Arbitro (PIN)**:
   - Modalità pubblica di sola lettura per evitare modifiche accidentali da parte degli utenti.
   - Accesso protetto da codice PIN (**PIN predefinito: `1234`**) per sbloccare la gestione completa.

7. **💾 Salvataggio Automatico, Backup & Stampa**:
   - Salvataggio automatico continuo nel `localStorage` del browser.
   - Esportazione e importazione file di backup `.json` con un click.
   - Foglio di stile ottimizzato per la **stampa su carta A4** da appendere alla bacheca del circolo tennis.

---

## 🚀 Come caricare con GitHub Desktop e fare il Push

1. Apri **GitHub Desktop** sul tuo Mac.
2. Vai nel menu in alto **File** → **Add Local Repository...** (oppure premi `Cmd + O`).
3. Clicca su **Choose...** e seleziona la cartella:
   `/Users/fabiobarcello/Documents/GitHub/Torneo-Momy`
4. Clicca su **Add Repository**.
5. In basso a sinistra vedrai i file pronti con il commit iniziale già pronto (oppure scrivi `Caricamento iniziale Torneo Momy` e clicca **Commit to main**).
6. Clicca sul pulsante blu in alto a destra: **Publish repository** oppure **Push origin**!
   - Se ti chiede il nome del repository remoto, assicurati che sia `Torneo-Momy`.
```
*(Sostituisci `TUO_USERNAME` con il tuo effettivo nome utente GitHub)*.

---

### 2️⃣ Deploy Istantaneo e Gratuito su Vercel

1. Vai su [vercel.com](https://vercel.com) e fai l'accesso con il tuo account **GitHub** (cliccando su *Continue with GitHub*).
2. Nella dashboard di Vercel, clicca sul pulsante **"Add New..."** in alto a destra e seleziona **"Project"**.
3. Vedrai la lista dei tuoi repository GitHub: individua `torneo-tennis-ragazzi` e clicca su **"Import"**.
4. Nelle impostazioni del progetto:
   - **Framework Preset**: Lascia `Other` (è già configurato `vercel.json` statico).
   - **Root Directory**: `./` (lascia invariato).
5. Clicca sul pulsante blu **"Deploy"**.

⏳ **Tempo stimato**: circa 15 secondi!  
Al termine, Vercel ti mostrerà una schermata con i fuochi d'artificio e il tuo link pubblico HTTPS attivo e funzionante (es. `https://torneo-tennis-ragazzi.vercel.app`), pronto da condividere sul gruppo WhatsApp dei genitori e dei maestri del circolo!

---

### 3️⃣ Aggiornamenti Futuri

Ogni volta che modificherai il sito e farai un nuovo push su GitHub:
```bash
git add .
git commit -m "Nuove modifiche al torneo"
git push
```
Vercel aggiornerà il sito pubblico **automaticamente** in tempo reale!

---

## 💻 Come Provargli in Locale sul tuo Mac

Puoi testare il sito subito sul tuo Mac in due modi:

1. **Con doppio click**: apri il file `index.html` direttamente con Safari o Chrome.
2. **Con il server web locale di Python**:
   ```bash
   cd /Users/fabiobarcello/torneo-tennis-ragazzi
   python3 -m http.server 3000
   ```
   Poi apri il browser su: `http://localhost:3000`

---

## 📁 Struttura del Progetto

```
torneo-tennis-ragazzi/
├── index.html           # Applicazione Single Page completa
├── css/
│   └── styles.css       # Stili personalizzati tennis e stampa bacheca A4
├── js/
│   ├── app.js           # Controller UI, eventi, modali e persistenza
│   ├── tournament.js    # Logica tabelloni, seeding tennistico, gironi e classifiche
│   └── mock-data.js     # Dati realistici pre-impostati per il test immediato
├── vercel.json          # Configurazione ottimizzata per il deploy su Vercel
├── .gitignore           # File esclusi da Git
└── README.md            # Questa guida
```

---

## 🔒 Credenziali Predefinite

- **PIN Giudice Arbitro**: `1234` (personalizzabile all'interno di `js/mock-data.js` o tramite l'applicazione).
