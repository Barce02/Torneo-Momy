// Dati per il Torneo Momy di Tennis per Ragazzi
const INITIAL_DATA = {
  tournament: {
    name: "Torneo Momy 2025",
    club: "Tennis Club Momy",
    address: "Via dello Sport 15",
    dates: "16 - 24 Maggio 2025",
    director: "Maestro Marco Ferri (Tel. 333 1234567)",
    referee: "Giudice Arbitro: Roberto Rossi",
    rules: "Partite Under 10 e 12: 2 set su 3 ai 4 game (short sets) con tie-break sul 4 pari; eventuale 3° set super tie-break a 10 punti. Partite Under 14 e 16: formula tradizionale al meglio dei 3 set con tie-break a 7 punti.",
    courts: [
      "Campo 1 (Centrale - Terra Rossa)",
      "Campo 2 (Terra Rossa)",
      "Campo 3 (Play-it Sintetico)"
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
    // Under 12 Maschile
    { id: "p1", name: "Leonardo Conti", birthYear: 2013, category: "Under 12 Maschile", club: "TC Primavera", ranking: "4.3", seed: 1, parentName: "Alessandro Conti", parentPhone: "348 1112233", status: "confermato" },
    { id: "p2", name: "Gabriele Moretti", birthYear: 2013, category: "Under 12 Maschile", club: "Sporting Club", ranking: "4.4", seed: 2, parentName: "Elena Moretti", parentPhone: "349 2223344", status: "confermato" },
    { id: "p3", name: "Tommaso Riva", birthYear: 2014, category: "Under 12 Maschile", club: "Tennis Academy", ranking: "4.5", seed: 3, parentName: "Stefano Riva", parentPhone: "347 3334455", status: "confermato" },
    { id: "p4", name: "Federico Villa", birthYear: 2013, category: "Under 12 Maschile", club: "Junior TC", ranking: "4.5", seed: 4, parentName: "Paolo Villa", parentPhone: "340 4445566", status: "confermato" },
    { id: "p5", name: "Mattia Galli", birthYear: 2013, category: "Under 12 Maschile", club: "TC Primavera", ranking: "NC", seed: null, parentName: "Giulia Galli", parentPhone: "338 5556677", status: "confermato" },
    { id: "p6", name: "Diego Sala", birthYear: 2014, category: "Under 12 Maschile", club: "Park Tennis", ranking: "NC", seed: null, parentName: "Fabrizio Sala", parentPhone: "331 6667788", status: "confermato" },
    { id: "p7", name: "Lorenzo Colombo", birthYear: 2013, category: "Under 12 Maschile", club: "Oasi Tennis", ranking: "4.NC", seed: null, parentName: "Laura Colombo", parentPhone: "345 7778899", status: "confermato" },
    { id: "p8", name: "Samuele Marchesi", birthYear: 2014, category: "Under 12 Maschile", club: "TC Primavera", ranking: "NC", seed: null, parentName: "Claudio Marchesi", parentPhone: "339 8889900", status: "confermato" },

    // Under 14 Maschile
    { id: "p9", name: "Andrea Fontana", birthYear: 2011, category: "Under 14 Maschile", club: "Tennis Academy", ranking: "3.5", seed: 1, parentName: "Davide Fontana", parentPhone: "335 1239874", status: "confermato" },
    { id: "p10", name: "Simone Bellini", birthYear: 2011, category: "Under 14 Maschile", club: "TC Primavera", ranking: "4.1", seed: 2, parentName: "Chiara Bellini", parentPhone: "333 4567891", status: "confermato" },
    { id: "p11", name: "Pietro Santoro", birthYear: 2012, category: "Under 14 Maschile", club: "Sporting Club", ranking: "4.2", seed: 3, parentName: "Mario Santoro", parentPhone: "348 7654321", status: "confermato" },
    { id: "p12", name: "Luca Ferretti", birthYear: 2011, category: "Under 14 Maschile", club: "Junior TC", ranking: "4.2", seed: 4, parentName: "Giorgio Ferretti", parentPhone: "347 9876543", status: "confermato" },
    { id: "p13", name: "Jacopo Rinaldi", birthYear: 2012, category: "Under 14 Maschile", club: "TC Valle", ranking: "4.3", seed: null, parentName: "Francesca Rinaldi", parentPhone: "320 1122334", status: "confermato" },
    { id: "p14", name: "Filippo Basso", birthYear: 2011, category: "Under 14 Maschile", club: "Park Tennis", ranking: "4.4", seed: null, parentName: "Andrea Basso", parentPhone: "334 2233445", status: "confermato" },

    // Under 14 Femminile
    { id: "p15", name: "Giulia Rossi", birthYear: 2011, category: "Under 14 Femminile", club: "TC Primavera", ranking: "4.1", seed: 1, parentName: "Martina Rossi", parentPhone: "340 9988776", status: "confermato" },
    { id: "p16", name: "Camilla Bernardi", birthYear: 2012, category: "Under 14 Femminile", club: "Sporting Club", ranking: "4.2", seed: 2, parentName: "Enrico Bernardi", parentPhone: "347 8877665", status: "confermato" },
    { id: "p17", name: "Emma Gatti", birthYear: 2012, category: "Under 14 Femminile", club: "Tennis Academy", ranking: "4.3", seed: 3, parentName: "Simona Gatti", parentPhone: "338 7766554", status: "confermato" },
    { id: "p18", name: "Alice De Luca", birthYear: 2011, category: "Under 14 Femminile", club: "Oasi Tennis", ranking: "4.4", seed: 4, parentName: "Francesco De Luca", parentPhone: "339 6655443", status: "confermato" },

    // Under 10 Misto (Gironi)
    { id: "p19", name: "Riccardo Costa", birthYear: 2015, category: "Under 10 Misto", club: "TC Primavera", ranking: "NC", seed: null, parentName: "Marco Costa", parentPhone: "349 1010101", status: "confermato" },
    { id: "p20", name: "Beatrice Poli", birthYear: 2015, category: "Under 10 Misto", club: "Junior TC", ranking: "NC", seed: null, parentName: "Anna Poli", parentPhone: "348 2020202", status: "confermato" },
    { id: "p21", name: "Davide Neri", birthYear: 2016, category: "Under 10 Misto", club: "Sporting Club", ranking: "NC", seed: null, parentName: "Carlo Neri", parentPhone: "347 3030303", status: "confermato" },
    { id: "p22", name: "Ginevra Greco", birthYear: 2015, category: "Under 10 Misto", club: "TC Primavera", ranking: "NC", seed: null, parentName: "Silvia Greco", parentPhone: "346 4040404", status: "confermato" }
  ],
  registrations: [
    {
      id: "reg-1",
      name: "Christian Marchetti",
      birthYear: 2013,
      category: "Under 12 Maschile",
      club: "Tennis Club Rho",
      ranking: "4.NC",
      parentName: "Massimo Marchetti",
      parentPhone: "333 9988112",
      parentEmail: "massimo.marchetti@example.com",
      notes: "Disponibile preferibilmente nel weekend",
      timestamp: "2025-05-10T14:30:00Z",
      status: "in_attesa"
    },
    {
      id: "reg-2",
      name: "Noemi Caruso",
      birthYear: 2012,
      category: "Under 14 Femminile",
      club: "Polisportiva Ovest",
      ranking: "NC",
      parentName: "Carla Caruso",
      parentPhone: "345 5544332",
      parentEmail: "carla.caruso@example.com",
      notes: "Tessera agonistica FITP rinnovata",
      timestamp: "2025-05-11T09:15:00Z",
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
              player1Id: "p1",
              player2Id: "p5",
              scores: "4-1 4-2",
              winnerId: "p1",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-17T15:00",
              status: "completato"
            },
            {
              id: "u12-q2",
              player1Id: "p4",
              player2Id: "p6",
              scores: "4-2 2-4 [10-6]",
              winnerId: "p4",
              court: "Campo 2 (Terra Rossa)",
              dateTime: "2025-05-17T15:00",
              status: "completato"
            },
            {
              id: "u12-q3",
              player1Id: "p7",
              player2Id: "p3",
              scores: "1-4 2-4",
              winnerId: "p3",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-17T16:30",
              status: "completato"
            },
            {
              id: "u12-q4",
              player1Id: "p8",
              player2Id: "p2",
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
              player1Id: "p1",
              player2Id: "p4",
              scores: "4-1 4-0",
              winnerId: "p1",
              court: "Campo 1 (Centrale - Terra Rossa)",
              dateTime: "2025-05-18T10:30",
              status: "completato"
            },
            {
              id: "u12-s2",
              player1Id: "p3",
              player2Id: "p2",
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
              player1Id: "p1",
              player2Id: "p2",
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
        name: "Girone Azzurro",
        category: "Under 10 Misto",
        playerIds: ["p19", "p20", "p21", "p22"],
        matches: [
          { id: "u10-m1", p1: "p19", p2: "p20", scores: "4-2 4-1", winnerId: "p19", court: "Campo 3 (Play-it Sintetico)", dateTime: "2025-05-17T10:00", status: "completato" },
          { id: "u10-m2", p1: "p21", p2: "p22", scores: "1-4 4-2 [10-8]", winnerId: "p21", court: "Campo 3 (Play-it Sintetico)", dateTime: "2025-05-17T11:00", status: "completato" },
          { id: "u10-m3", p1: "p19", p2: "p21", scores: "4-0 4-1", winnerId: "p19", court: "Campo 3 (Play-it Sintetico)", dateTime: "2025-05-18T10:00", status: "completato" },
          { id: "u10-m4", p1: "p20", p2: "p22", scores: "4-2 4-3", winnerId: "p20", court: "Campo 3 (Play-it Sintetico)", dateTime: "2025-05-18T11:00", status: "completato" },
          { id: "u10-m5", p1: "p19", p2: "p22", scores: "", winnerId: null, court: "Campo 3 (Play-it Sintetico)", dateTime: "2025-05-19T14:30", status: "in_programma" },
          { id: "u10-m6", p1: "p20", p2: "p21", scores: "", winnerId: null, court: "Campo 3 (Play-it Sintetico)", dateTime: "2025-05-19T15:30", status: "in_programma" }
        ]
      }
    ]
  }
};
