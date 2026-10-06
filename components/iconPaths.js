// Desenhos dos ícones do sistema (traço fino, só contorno — mesmo estilo
// dos ícones do YouTube). Baseados no conjunto Feather (licença MIT).
//
// Todos usam um quadro de 24x24. Cada ícone é uma lista de formas SVG:
//   [tag, { atributos }]
// A cor, o tamanho e a espessura do traço são definidos em <Icon />.

const path = (d) => ["path", { d }];
const line = (x1, y1, x2, y2) => ["line", { x1, y1, x2, y2 }];
const polyline = (points) => ["polyline", { points }];
const circle = (cx, cy, r) => ["circle", { cx, cy, r }];

export const ICONS = {
  // ----- menu lateral -----
  home: [
    path("M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"),
    polyline("9 22 9 12 15 12 15 22"),
  ],
  package: [
    path("M16.5 9.4l-9-5.19"),
    path(
      "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
    ),
    polyline("3.27 6.96 12 12.01 20.73 6.96"),
    line("12", "22.08", "12", "12"),
  ],
  users: [
    path("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"),
    circle("9", "7", "4"),
    path("M23 21v-2a4 4 0 0 0-3-3.87"),
    path("M16 3.13a4 4 0 0 1 0 7.75"),
  ],
  layers: [
    ["polygon", { points: "12 2 2 7 12 12 22 7 12 2" }],
    polyline("2 17 12 22 22 17"),
    polyline("2 12 12 17 22 12"),
  ],
  repeat: [
    polyline("17 1 21 5 17 9"),
    path("M3 11V9a4 4 0 0 1 4-4h14"),
    polyline("7 23 3 19 7 15"),
    path("M21 13v2a4 4 0 0 1-4 4H3"),
  ],
  "file-text": [
    path("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"),
    polyline("14 2 14 8 20 8"),
    line("16", "13", "8", "13"),
    line("16", "17", "8", "17"),
    polyline("10 9 9 9 8 9"),
  ],
  "log-out": [
    path("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"),
    polyline("16 17 21 12 16 7"),
    line("21", "12", "9", "12"),
  ],

  // ----- barra superior / busca / fechar -----
  bell: [
    path("M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"),
    path("M13.73 21a2 2 0 0 1-3.46 0"),
  ],
  search: [circle("11", "11", "8"), line("21", "21", "16.65", "16.65")],
  x: [line("18", "6", "6", "18"), line("6", "6", "18", "18")],

  // ----- setas -----
  "arrow-right": [line("5", "12", "19", "12"), polyline("12 5 19 12 12 19")],
  "arrow-up": [line("12", "19", "12", "5"), polyline("5 12 12 5 19 12")],
  "arrow-down": [line("12", "5", "12", "19"), polyline("19 12 12 19 5 12")],

  // ----- notificações -----
  "alert-triangle": [
    path(
      "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
    ),
    line("12", "9", "12", "13"),
    line("12", "17", "12.01", "17"),
  ],
  clock: [circle("12", "12", "10"), polyline("12 6 12 12 16 14")],
  inbox: [
    polyline("22 12 16 12 14 15 10 15 8 12 2 12"),
    path(
      "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
    ),
  ],
  user: [path("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"), circle("12", "7", "4")],
  "check-circle": [
    path("M22 11.08V12a10 10 0 1 1-5.93-9.14"),
    polyline("22 4 12 14.01 9 11.01"),
  ],
  "x-circle": [
    circle("12", "12", "10"),
    line("15", "9", "9", "15"),
    line("9", "9", "15", "15"),
  ],
};
