/** Aéroport issu du jeu OurAirports (lib/data/airports.json). */
export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  size: "L" | "M";
}

/** Aéroport accessible autour d'une ville de départ, avec distance et temps d'accès estimé. */
export interface NearbyAirport {
  iata: string;
  name: string;
  city: string;
  km: number;
  minutes: number;
}

/** Nom, ville et position d'un aéroport cité par une ville de départ. */
export interface AirportPoint {
  name: string;
  city: string;
  lat: number;
  lon: number;
}

/** Ville de départ résolue : ses aéroports principaux, ses gares, et les aéroports à ~2 h. */
export interface DeparturePoint {
  id: string;
  label: string;
  en: string;
  lat: number;
  lon: number;
  airports: string[];
  stations: string[];
  nearby: NearbyAirport[];
  /** Détail de chaque aéroport cité (principaux et voisins), par code IATA : évite d'embarquer le jeu complet côté client. */
  points: Record<string, AirportPoint>;
}

export type TransportMode = "plane" | "train" | "bus" | "car";
export type GroundMode = Exclude<TransportMode, "plane">;
export type DurationPreset = "weekend" | "long" | "week";
export type DateMode = "flex" | "fixed";
export type VibeId =
  | "sun"
  | "chill"
  | "culture"
  | "party"
  | "city"
  | "beach"
  | "nature"
  | "food"
  | "love"
  | "friends"
  | "shop"
  | "exotic";
export type SortKey = "total" | "transport" | "temp" | "name";
export type ViewMode = "grid" | "swipe" | "map";

/** Paramètres d'une recherche, tels que saisis dans le formulaire. */
export interface SearchParams {
  departures: DeparturePoint[];
  includeNearby: boolean;
  /** Codes IATA d'aéroports voisins décochés dans les réglages. */
  excludedNearby: string[];
  dateMode: DateMode;
  /** Mois « YYYY-MM » en dates flexibles. */
  month: string;
  duration: DurationPreset;
  /** Dates « YYYY-MM-DD » en dates fixes. */
  dateOut: string;
  dateIn: string;
  travelers: number;
  /** Budget maximum par personne, transport et nuits compris. */
  budget: number;
  modes: Record<TransportMode, boolean>;
  directOnly: boolean;
  vibes: VibeId[];
}

/** Une fenêtre de dates candidate (un week-end donné, une semaine donnée…). */
export interface DateWindow {
  out: string;
  ret: string;
  nights: number;
  /** Mois calendaire du départ, 0 = janvier. */
  monthIndex: number;
  key: string;
}

export type PaletteId = "sunset" | "peach" | "gold" | "teal" | "dusk" | "cool" | "lagoon";

/** Recette du paysage illustré d'une destination. */
export interface SceneSpec {
  p: PaletteId;
  far: "none" | "hills" | "mountains" | "alps" | "volcano";
  mid: "none" | "city" | "domes" | "spires" | "canalhouses" | "dunes";
  near: "sea" | "beach" | "river" | "canal" | "ground";
}

/** Tarif de référence d'un vol A/R par personne, hors saison, depuis un aéroport d'origine. */
export interface BaseFare {
  origin: string;
  airline: string;
  price: number;
  duration: string;
  direct: boolean;
}

/** Fourchette estimée d'un trajet terrestre A/R par personne. */
export interface GroundEstimate {
  min: number;
  max?: number;
  duration: string;
}

export interface Destination {
  id: string;
  city: string;
  en: string;
  country: string;
  iata: string;
  lat: number;
  lon: number;
  /** Température moyenne par mois calendaire, 12 valeurs de janvier à décembre. */
  temps: number[];
  /** Prix indicatif d'une chambre double par nuit, hors saison. */
  stay: number;
  vibes: VibeId[];
  scene: SceneSpec;
  /** Paysages associés, trois courtes mentions. */
  land: string[];
  /** Tarifs de référence (mode mock, ou repli quand le fournisseur ne répond pas). */
  fares: BaseFare[];
  /** Alternatives terrestres connues, par identifiant de ville de départ. */
  ground?: Record<string, Partial<Record<GroundMode, GroundEstimate>>>;
}

/** Tarif renvoyé par un fournisseur de prix pour une origine, une destination et une fenêtre de dates. */
export interface Fare {
  origin: string;
  destId: string;
  windowKey: string;
  price: number;
  airline: string;
  duration: string;
  direct: boolean;
  /** Lien de réservation fourni par le fournisseur, s'il en donne un. */
  link?: string;
}

export interface TransportCandidate {
  mode: TransportMode;
  /** Prix A/R par personne (minimum de la fourchette pour le terrestre). */
  price: number;
  max?: number;
  duration: string;
  depId: string;
  originLabel: string;
  origin?: string;
  originCity?: string;
  airline?: string;
  direct?: boolean;
  viaNearby?: boolean;
  nearbyMinutes?: number;
  /** Faux quand le mode est décoché : on le montre dans la fiche mais il ne compte pas dans le prix. */
  enabled: boolean;
  link?: string;
}

/** Tranches d'âge présentes dans le groupe. */
export type AgeBand = "kids" | "teens" | "young" | "adults" | "seniors";
/** Composition du groupe. */
export type GroupType = "solo" | "couple" | "friends" | "family";
export type DaySlot = "morning" | "afternoon" | "evening";
export type ActivityKind =
  | "sight"
  | "museum"
  | "walk"
  | "viewpoint"
  | "beach"
  | "nature"
  | "food"
  | "market"
  | "nightlife"
  | "bar"
  | "shop"
  | "spa"
  | "boat"
  | "sport"
  | "daytrip"
  | "show";

/** Une activité du catalogue éditorial, rattachée à une destination. */
export interface Activity {
  id: string;
  destId: string;
  name: string;
  /** Une phrase : pourquoi y aller, comment. */
  blurb: string;
  kind: ActivityKind;
  vibes: VibeId[];
  /** Tranches d'âge pour lesquelles l'activité convient ; une tranche présente et absente d'ici exclut l'activité. */
  ages: AgeBand[];
  /** Compositions de groupe pour lesquelles elle brille (bonus, pas exclusion). */
  groups: GroupType[];
  slots: DaySlot[];
  hours: number;
  /** 0 gratuit · 1 ~10 € · 2 ~25 € · 3 ~60 € par personne. */
  price: 0 | 1 | 2 | 3;
  /** Vrai quand une réservation ou un billet est habituel : on propose un lien de réservation. */
  bookable?: boolean;
  /** Requête Google Maps si le nom seul est ambigu. */
  query?: string;
}

/** Qui part : sert à adapter le programme. */
export interface TravelProfile {
  group: GroupType;
  ages: AgeBand[];
  vibes: VibeId[];
  travelers: number;
}

export interface PlanSlot {
  slot: DaySlot;
  activity: Activity;
}

export interface PlanDay {
  index: number;
  date: string;
  /** « Vendredi soir · arrivée », « Samedi », « Dimanche matin · avant le retour ». */
  label: string;
  slots: PlanSlot[];
  /** Créneaux restés libres faute d'activité adaptée : on les affiche comme tels, avec une suggestion. */
  free: DaySlot[];
}

/** Programme composé pour une escapade et un profil. */
export interface Itinerary {
  days: PlanDay[];
  /** Jours non détaillés (séjours longs) : nombre de journées libres. */
  freeDays: number;
  leftovers: Activity[];
  /** Estimation des activités retenues, par personne. */
  costPerPerson: number;
  seed: number;
}

/** Une escapade chiffrée : destination, dates retenues, transport le moins cher et budget du séjour. */
export interface TripOption {
  destination: Destination;
  window: DateWindow;
  best: TransportCandidate;
  candidates: TransportCandidate[];
  nightly: number;
  rooms: number;
  stayTotal: number;
  transportTotal: number;
  total: number;
  perPerson: number;
  temp: number;
  alternatives: { window: DateWindow; perPerson: number }[];
}
