// Dati di esempio per la struttura del Torneo Momy
const INITIAL_DATA = {
  tournament: {
    name: "Torneo Momy",
    club: "Circolo Tennis Ospitante",
    address: "Via del Tennis, 1",
    dates: "Maggio 2025",
    director: "Direzione Torneo",
    referee: "Giudice Arbitro Ufficiale",
    rules: "Partite Under 10 e 12: 2 set su 3 ai 4 game (short sets) con tie-break sul 4 pari; eventuale 3° set super tie-break a 10 punti. Partite Under 14 e 16: formula tradizionale al meglio dei 3 set con tie-break a 7 punti.",
    courts: [
      "Campo 1 (Centrale - Terra Rossa)",
      "Campo 2 (Terra Rossa)",
      "Campo 3 (Sintetico)"
    ],
    categories: [
      "Under 10 Misto",
      "Under 12 Maschile",
      "Under 14 Maschile",
      "Under 14 Femminile"
    ],
    adminPin: "1234"
  },
  players: [
    // Under 12 Maschile (Tabellone a 8 giocatori)
    { id: "p1", name: "Giocatore 1", birthYear: 2013, category: "Under 12 Maschile", club: "Club A", ranking: "4.3", seed: 1, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p2", name: "Giocatore 2", birthYear: 2013, category: "Under 12 Maschile", club: "Club B", ranking: "4.4", seed: 2, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p3", name: "Giocatore 3", birthYear: 2014, category: "Under 12 Maschile", club: "Club C", ranking: "4.5", seed: 3, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p4", name: "Giocatore 4", birthYear: 2013, category: "Under 12 Maschile", club: "Club D", ranking: "4.5", seed: 4, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p5", name: "Giocatore 5", birthYear: 2013, category: "Under 12 Maschile", club: "Club A", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p6", name: "Giocatore 6", birthYear: 2014, category: "Under 12 Maschile", club: "Club E", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p7", name: "Giocatore 7", birthYear: 2013, category: "Under 12 Maschile", club: "Club F", ranking: "4.NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p8", name: "Giocatore 8", birthYear: 2014, category: "Under 12 Maschile", club: "Club A", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },

    // Under 14 Maschile
    { id: "p9", name: "Giocatore A", birthYear: 2011, category: "Under 14 Maschile", club: "Club C", ranking: "3.5", seed: 1, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p10", name: "Giocatore B", birthYear: 2011, category: "Under 14 Maschile", club: "Club A", ranking: "4.1", seed: 2, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p11", name: "Giocatore C", birthYear: 2012, category: "Under 14 Maschile", club: "Club B", ranking: "4.2", seed: 3, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p12", name: "Giocatore D", birthYear: 2011, category: "Under 14 Maschile", club: "Club D", ranking: "4.2", seed: 4, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p13", name: "Giocatore E", birthYear: 2012, category: "Under 14 Maschile", club: "Club E", ranking: "4.3", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p14", name: "Giocatore F", birthYear: 2011, category: "Under 14 Maschile", club: "Club F", ranking: "4.4", seed: null, parentName: "", parentPhone: "", status: "confermato" },

    // Under 14 Femminile
    { id: "p15", name: "Giocatrice 1", birthYear: 2011, category: "Under 14 Femminile", club: "Club A", ranking: "4.1", seed: 1, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p16", name: "Giocatrice 2", birthYear: 2012, category: "Under 14 Femminile", club: "Club B", ranking: "4.2", seed: 2, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p17", name: "Giocatrice 3", birthYear: 2012, category: "Under 14 Femminile", club: "Club C", ranking: "4.3", seed: 3, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p18", name: "Giocatrice 4", birthYear: 2011, category: "Under 14 Femminile", club: "Club D", ranking: "4.4", seed: 4, parentName: "", parentPhone: "", status: "confermato" },

    // Under 10 Misto (Girone all'italiana)
    { id: "p19", name: "Atleta 1", birthYear: 2015, category: "Under 10 Misto", club: "Club A", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p20", name: "Atleta 2", birthYear: 2015, category: "Under 10 Misto", club: "Club B", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p21", name: "Atleta 3", birthYear: 2016, category: "Under 10 Misto", club: "Club C", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" },
    { id: "p22", name: "Atleta 4", birthYear: 2015, category: "Under 10 Misto", club: "Club A", ranking: "NC", seed: null, parentName: "", parentPhone: "", status: "confermato" }
  ],
  registrations: [
    {
      id: "reg-1",
      name: "Nuova Iscrizione (Esempio)",
      birthYear: 2013,
      category: "Under 12 Maschile",
      club: "Circolo Tennis Esempio",
      ranking: "NC",
      parentName: "Genitore Esempio",
      parentPhone: "",
      parentEmail: "",
      notes: "Richiesta inviata dal modulo online",
      timestamp: "2025-05-10T14:30:00Z",
      status: "in_attesa"
    }
  ],
  brackets: {
    "Under 12 Maschile": {
      category: "Under 12 Maschile",
      rounds: [
        {
          name: "Quarti di Finale",
          matches: [
            {
              id: "u12-q1",
              player1Id: "p1", // Giocatore 1 [1]
              player2Id: "p5", // Giocatore 5
              scores: "4-1 4-2",
              winnerId: "p1",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-17T15:00",
              status: "completato"
            },
            {
              id: "u12-q2",
              player1Id: "p4", // Giocatore 4 [4]
              player2Id: "p6", // Giocatore 6
              scores: "4-2 2-4 [10-6]",
              winnerId: "p4",
              court: "Campo 2 (Terra Rossa)",
              dateTime: "2025-05-17T15:00",
              status: "completato"
            },
            {
              id: "u12-q3",
              player1Id: "p7", // Giocatore 7
              player2Id: "p3", // Giocatore 3 [3]
              scores: "1-4 2-4",
              winnerId: "p3",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-17T16:30",
              status: "completato"
            },
            {
              id: "u12-q4",
              player1Id: "p8", // Giocatore 8
              player2Id: "p2", // Giocatore 2 [2]
              scores: "0-4 1-4",
              winnerId: "p2",
              court: "Campo 2 (Terra Rossa)",
              dateTime: "2025-05-17T16:30",
              status: "completato"
            }
          ]
        },
        {
          name: "Semifinali",
          matches: [
            {
              id: "u12-s1",
              player1Id: "p1", // Giocatore 1
              player2Id: "p4", // Giocatore 4
              scores: "4-1 4-0",
              winnerId: "p1",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-18T10:30",
              status: "completato"
            },
            {
              id: "u12-s2",
              player1Id: "p3", // Giocatore 3
              player2Id: "p2", // Giocatore 2
              scores: "2-4 4-2 [7-10]",
              winnerId: "p2",
              court: "Campo 2 (Terra Rossa)",
              dateTime: "2025-05-18T10:30",
              status: "completato"
            }
          ]
        },
        {
          name: "Finale",
          matches: [
            {
              id: "u12-f1",
              player1Id: "p1", // Giocatore 1 [1]
              player2Id: "p2", // Giocatore 2 [2]
              scores: "",
              winnerId: null,
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-19T16:00",
              status: "in_programma"
            }
          ]
        }
      ]
    },
    "Under 14 Maschile": {
      category: "Under 14 Maschile",
      rounds: [
        {
          name: "Semifinali",
          matches: [
            {
              id: "u14m-s1",
              player1Id: "p9",
              player2Id: "p12",
              scores: "6-2 6-3",
              winnerId: "p9",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-18T14:30",
              status: "completato"
            },
            {
              id: "u14m-s2",
              player1Id: "p11",
              player2Id: "p10",
              scores: "",
              winnerId: null,
              court: "Campo 2 (Terra Rossa)",
              dateTime: "2025-05-18T14:30",
              status: "in_corso"
            }
          ]
        },
        {
          name: "Finale",
          matches: [
            {
              id: "u14m-f1",
              player1Id: "p9",
              player2Id: null,
              scores: "",
              winnerId: null,
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-19T17:30",
              status: "in_programma"
            }
          ]
        }
      ]
    }
  },
  groups: {
    "Under 10 Misto": [
      {
        name: "Girone A",
        category: "Under 10 Misto",
        playerIds: ["p19", "p20", "p21", "p22"],
        matches: [
          { id: "u10-m1", p1: "p19", p2: "p20", scores: "4-2 4-1", winnerId: "p19", court: "Campo 3 (Sintetico)", dateTime: "2025-05-17T10:00", status: "completato" },
          { id: "u10-m2", p1: "p21", p2: "p22", scores: "1-4 4-2 [10-8]", winnerId: "p21", court: "Campo 3 (Sintetico)", dateTime: "2025-05-17T11:00", status: "completato" },
          { id: "u10-m3", p1: "p19", p2: "p21", scores: "4-0 4-1", winnerId: "p19", court: "Campo 3 (Sintetico)", dateTime: "2025-05-18T10:00", status: "completato" },
          { id: "u10-m4", p1: "p20", p2: "p22", scores: "4-2 4-3", winnerId: "p20", court: "Campo 3 (Sintetico)", dateTime: "2025-05-18T11:00", status: "completato" },
          { id: "u10-m5", p1: "p19", p2: "p22", scores: "", winnerId: null, court: "Campo 3 (Sintetico)", dateTime: "2025-05-19T14:30", status: "in_programma" },
          { id: "u10-m6", p1: "p20", p2: "p21", scores: "", winnerId: null, court: "Campo 3 (Sintetico)", dateTime: "2025-05-19T15:30", status: "in_programma" }
        ]
      }
    ]
  }
};
