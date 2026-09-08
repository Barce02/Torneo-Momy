// Configurazione iniziale per il Torneo Momy (tabelloni e iscritti vuoti, pronti all'uso)
const INITIAL_DATA = {
  tournament: {
    name: "Torneo Momy",
    club: "Circolo Tennis",
    address: "Sede del Torneo",
    dates: "Stagione 2025",
    director: "Direzione Torneo",
    referee: "Giudice Arbitro",
    rules: "Regolamento ufficiale giovanile: formula con 2 set su 3 ai 4 game (short sets) o tradizionali a discrezione dell'arbitro; tie-break ed eventuale super tie-break al 3° set.",
    courts: [
      "Campo 1",
      "Campo 2",
      "Campo 3"
    ],
    categories: [
      "Under 10 Misto",
      "Under 12 Maschile",
      "Under 14 Maschile",
      "Under 14 Femminile"
    ],
    adminPin: "1234"
  },
  // Inizia vuoto: l'admin inserisce i veri atleti
  players: [],
  registrations: [],
  brackets: {},
  groups: {}
};
