/**
 * Catálogo fictício (LOCAL): artistas, álbuns e músicas inventados.
 *
 * Toda faixa herda os artistas e os gêneros do álbum; `feat` acrescenta
 * artistas convidados. Durações em segundos.
 */

export interface Track {
  name: string;
  seconds: number;
  feat?: readonly string[];
}

export interface Release {
  artists: readonly string[];
  genres: readonly string[];
}

export interface Album extends Release {
  name: string;
  tracks: readonly Track[];
}

export const ARTISTS = [
  "Maré Alta",
  "Lia Moraes",
  "Trio Cerrado",
  "DJ Ponto Zero",
  "Rua Dezesseis",
  "Clara Vento",
  "Quarteto Bossa Leve",
  "MC Faísca",
  "Os Vagalumes",
  "Nina Sol",
  "Roda de Bamba",
  "Tomás Lago",
] as const;

export const ALBUMS: readonly Album[] = [
  {
    name: "Ondas de Concreto",
    artists: ["Maré Alta"],
    genres: ["Rock"],
    tracks: [
      { name: "Ressaca", seconds: 214 },
      { name: "Asfalto Molhado", seconds: 247 },
      { name: "Farol Apagado", seconds: 198 },
      { name: "Sal na Pele", seconds: 231 },
      { name: "Última Onda", seconds: 305 },
    ],
  },
  {
    name: "Varanda",
    artists: ["Lia Moraes"],
    genres: ["MPB"],
    tracks: [
      { name: "Café na Varanda", seconds: 192 },
      { name: "Rede de Dormir", seconds: 236 },
      { name: "Janela Aberta", seconds: 205 },
      { name: "Chuva de Caju", seconds: 221 },
      { name: "Cantiga do Quintal", seconds: 179 },
    ],
  },
  {
    name: "Estrada de Terra",
    artists: ["Trio Cerrado"],
    genres: ["Sertanejo"],
    tracks: [
      { name: "Poeira Vermelha", seconds: 188 },
      { name: "Porteira", seconds: 201 },
      { name: "Saudade de Ipê", seconds: 226 },
      { name: "Viola Cansada", seconds: 243 },
      { name: "Lua no Curral", seconds: 197 },
    ],
  },
  {
    name: "Frequência Noturna",
    artists: ["DJ Ponto Zero"],
    genres: ["Eletrônica"],
    tracks: [
      { name: "Pulso", seconds: 312 },
      { name: "Estática", seconds: 287 },
      { name: "Metrô 3h", seconds: 341 },
      { name: "Néon", seconds: 296 },
      { name: "Fim de Pista", seconds: 358 },
    ],
  },
  {
    name: "Concreto e Verso",
    artists: ["Rua Dezesseis"],
    genres: ["Hip-Hop"],
    tracks: [
      { name: "Quebrada Sincera", seconds: 224 },
      { name: "Caderno de Rima", seconds: 198 },
      { name: "Busão Lotado", seconds: 211, feat: ["MC Faísca"] },
      { name: "Laje", seconds: 183 },
      { name: "Microfone Aberto", seconds: 249 },
    ],
  },
  {
    name: "Cartas ao Vento",
    artists: ["Clara Vento"],
    genres: ["Pop"],
    tracks: [
      { name: "Remetente", seconds: 203 },
      { name: "Papel Dobrado", seconds: 189 },
      { name: "Selo Azul", seconds: 215 },
      { name: "Endereço Antigo", seconds: 232 },
      { name: "Pós-escrito", seconds: 176 },
    ],
  },
  {
    name: "Bossa de Domingo",
    artists: ["Quarteto Bossa Leve"],
    genres: ["Jazz", "MPB"],
    tracks: [
      { name: "Domingo Lento", seconds: 264 },
      { name: "Maresia", seconds: 238 },
      { name: "Contraponto", seconds: 291 },
      { name: "Sétima Menor", seconds: 255 },
      { name: "Ipanema às Seis", seconds: 247 },
    ],
  },
  {
    name: "Baile do Faísca",
    artists: ["MC Faísca"],
    genres: ["Funk"],
    tracks: [
      { name: "Tamborzão", seconds: 168 },
      { name: "Paredão", seconds: 174 },
      { name: "Passinho Novo", seconds: 159 },
      { name: "Chama no Grave", seconds: 181 },
      { name: "Fim de Semana", seconds: 192, feat: ["Rua Dezesseis"] },
    ],
  },
  {
    name: "Luz de Garagem",
    artists: ["Os Vagalumes"],
    genres: ["Indie", "Rock"],
    tracks: [
      { name: "Lâmpada", seconds: 209 },
      { name: "Amplificador", seconds: 236 },
      { name: "Vizinho Reclamou", seconds: 187 },
      { name: "Pirilampo", seconds: 222 },
      { name: "Fita Cassete", seconds: 254 },
    ],
  },
  {
    name: "Solstício",
    artists: ["Nina Sol"],
    genres: ["Pop", "Eletrônica"],
    tracks: [
      { name: "Equinócio", seconds: 213 },
      { name: "Órbita", seconds: 246, feat: ["DJ Ponto Zero"] },
      { name: "Eclipse", seconds: 228 },
      { name: "Aurora", seconds: 199 },
      { name: "Meio-dia", seconds: 207 },
    ],
  },
  {
    name: "Quintal do Samba",
    artists: ["Roda de Bamba"],
    genres: ["Samba"],
    tracks: [
      { name: "Pagode no Quintal", seconds: 233 },
      { name: "Cavaco Choroso", seconds: 218 },
      { name: "Feijoada", seconds: 241 },
      { name: "Pandeiro de Couro", seconds: 205 },
      { name: "Roda Aberta", seconds: 262 },
    ],
  },
  {
    // Álbum em parceria: dois artistas em album_artist e em cada faixa.
    name: "Encontros",
    artists: ["Lia Moraes", "Roda de Bamba"],
    genres: ["MPB", "Samba"],
    tracks: [
      { name: "Ponte", seconds: 226 },
      { name: "Abraço", seconds: 214 },
      { name: "Encruzilhada", seconds: 251 },
      { name: "Mesa Posta", seconds: 238 },
      { name: "Despedida", seconds: 272 },
    ],
  },
];

/** Músicas fora de álbum (album_music é opcional para uma música). */
export const SINGLES: readonly (Track & Release)[] = [
  { name: "Lago Parado", seconds: 219, artists: ["Tomás Lago"], genres: ["Indie"] },
  { name: "Pedra na Água", seconds: 196, artists: ["Tomás Lago"], genres: ["Indie"] },
  { name: "Margem", seconds: 241, artists: ["Tomás Lago"], genres: ["Indie"], feat: ["Os Vagalumes"] },
];
