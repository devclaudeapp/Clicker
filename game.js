'use strict';

(() => {
  const SAVE_KEY = 'croissant-dor.sauvegarde.v1';
  const DEFAULT_NAME = "Au Croissant d'Or";
  const PRICE_GROWTH = 1.15;
  const OFFLINE_CAP_S = 3 * 3600;
  const OFFLINE_RATE = 0.5;

  // ---------------------------------------------------------------------------
  // Données du jeu
  // ---------------------------------------------------------------------------

  const BUILDINGS = [
    { id: 'apprenti', name: 'Apprenti', plural: 'Les apprentis', letter: 'A', base: 15, cps: 0.1,
      desc: 'Façonne les croissants à la main, un par un.' },
    { id: 'petrin', name: 'Pétrin', plural: 'Les pétrins', letter: 'P', base: 100, cps: 1,
      desc: 'Pétrin mécanique pour la détrempe du matin.' },
    { id: 'four', name: 'Four à sole', plural: 'Les fours à sole', letter: 'F', base: 1100, cps: 8,
      desc: 'Cuisson sur pierre, dix-huit plaques par fournée.' },
    { id: 'labo', name: 'Laboratoire', plural: 'Les laboratoires', letter: 'L', base: 12000, cps: 47,
      desc: 'Laminoir, tour réfrigéré et chambre de pousse.' },
    { id: 'moulin', name: 'Moulin', plural: 'Les moulins', letter: 'M', base: 130000, cps: 260,
      desc: 'Farine T45 moulue sur meule de pierre.' },
    { id: 'beurrerie', name: 'Beurrerie', plural: 'Les beurreries', letter: 'B', base: 1.4e6, cps: 1400,
      desc: 'Beurre de tourage à 82 % de matière grasse.' },
    { id: 'succursale', name: 'Succursale', plural: 'Les succursales', letter: 'S', base: 2e7, cps: 7800,
      desc: 'Une boutique de plus dans chaque quartier.' },
    { id: 'halles', name: 'Pavillon des Halles', plural: 'Les pavillons', letter: 'H', base: 3.3e8, cps: 44000,
      desc: 'Un pavillon entier, ouvert dès quatre heures du matin.' },
    { id: 'export', name: 'Comptoir export', plural: 'Les comptoirs export', letter: 'E', base: 5.1e9, cps: 260000,
      desc: 'Des croissants surgelés crus pour Tokyo et New York.' },
  ];
  const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

  const TIERS = [
    { need: 1, costMul: 10, roman: 'I' },
    { need: 5, costMul: 50, roman: 'II' },
    { need: 25, costMul: 500, roman: 'III' },
  ];

  const TIER_UPGRADES = {
    apprenti: [
      ['Tablier en lin', 'Épais, lavé à 90 °C, il ne craint ni la farine ni le beurre.'],
      ['CAP Boulanger', 'Deux ans d’alternance et un diplôme encadré au-dessus du pétrin.'],
      ['Brevet de maîtrise', 'Le niveau au-dessus : on peut enfin former les autres.'],
    ],
    petrin: [
      ['Pétrin à spirale', 'Un frasage court, un pétrissage régulier.'],
      ['Bras plongeants', 'Le mouvement lent qui respecte la pâte.'],
      ['Température de base', 'Farine, eau, fournil : la somme doit faire 54.'],
    ],
    four: [
      ['Pierre réfractaire', 'Elle garde la chaleur d’une fournée à l’autre.'],
      ['Coup de buée', 'Un nuage de vapeur à l’enfournement, et la croûte brille.'],
      ['Four à bois', 'Plus lent à chauffer, impossible à égaler.'],
    ],
    labo: [
      ['Laminoir', 'Abaisser la pâte au millimètre, sans rouleau.'],
      ['Tour réfrigéré', 'Un plan de travail à 4 °C pour ne jamais faire fondre le beurre.'],
      ['Chambre de pousse', '27 °C, 75 % d’humidité, deux heures de patience.'],
    ],
    moulin: [
      ['Meule de pierre', 'Le grain écrasé lentement garde son goût.'],
      ['Blé de Beauce', 'Des champs à perte de vue, à une heure du fournil.'],
      ['Farine de tradition', 'Sans additif, comme l’exige le décret de 1993.'],
    ],
    beurrerie: [
      ['Baratte en chêne', 'La crème tourne jusqu’à ce que le beurre se sépare.'],
      ['Beurre de tourage', 'Plus ferme, il se laisse étaler en feuille sans casser.'],
      ['AOP Charentes-Poitou', 'Le beurre des grandes maisons, et désormais le vôtre.'],
    ],
    succursale: [
      ['Enseigne à la feuille d’or', 'Posée au pinceau, lettre par lettre.'],
      ['Livraison à vélo', 'Les croissants arrivent encore tièdes au bureau.'],
      ['Ouvert le dimanche', 'Le jour où tout le quartier fait la queue.'],
    ],
    halles: [
      ['Pavillon Baltard', 'Fonte, verre et une verrière pleine de lumière.'],
      ['Carreau du matin', 'Les restaurateurs passent commande avant l’aube.'],
      ['Criée de l’aube', 'Les prix se fixent à la voix, et les vôtres montent.'],
    ],
    export: [
      ['Fret aérien', 'Paris–Tokyo en treize heures, en soute réfrigérée.'],
      ['Chaîne du froid', 'Surgelés crus à −18 °C, cuits sur place à l’arrivée.'],
      ['Boutique à Tokyo', 'Une file d’attente de deux heures dès l’ouverture.'],
    ],
  };

  const UPGRADES = [];

  UPGRADES.push(
    { id: 'rouleau', kind: 'click', mult: 2, cost: 100, name: 'Rouleau en buis',
      target: 'Clic', effect: 'Chaque clic rapporte 2 × plus.',
      flavor: 'Tourné dans du buis, patiné par trois générations.',
      unlock: (s) => s.totalBaked >= 50 },
    { id: 'roulette', kind: 'click', mult: 2, cost: 500, name: 'Roulette à croissants',
      target: 'Clic', effect: 'Chaque clic rapporte 2 × plus.',
      flavor: 'Elle découpe six triangles d’un seul passage.',
      unlock: (s) => s.totalBaked >= 300 },
    { id: 'geste', kind: 'clickPct', pct: 0.01, cost: 10000, name: 'Geste sûr',
      target: 'Clic', effect: 'Chaque clic rapporte en plus 1 % de la production par seconde.',
      flavor: 'Enrouler, serrer, poser. Sans regarder.',
      unlock: (s) => s.totalBaked >= 5000 },
    { id: 'col', kind: 'clickPct', pct: 0.01, cost: 1e6, name: 'Col bleu-blanc-rouge',
      target: 'Clic', effect: 'Chaque clic rapporte en plus 1 % de la production par seconde.',
      flavor: 'Le col des Meilleurs Ouvriers de France.',
      unlock: (s) => s.totalBaked >= 5e5 },
    { id: 'doigts', kind: 'clickPct', pct: 0.01, cost: 1e8, name: 'Doigts de fée',
      target: 'Clic', effect: 'Chaque clic rapporte en plus 1 % de la production par seconde.',
      flavor: 'Les clients viennent regarder à travers la vitre du fournil.',
      unlock: (s) => s.totalBaked >= 5e7 },
  );

  for (const b of BUILDINGS) {
    TIERS.forEach((tier, i) => {
      const [name, flavor] = TIER_UPGRADES[b.id][i];
      UPGRADES.push({
        id: `${b.id}-${i + 1}`, kind: 'building', building: b.id, mult: 2,
        cost: b.base * tier.costMul, name, flavor,
        target: `${b.name} · ${tier.roman}`,
        effect: `${b.plural} produisent 2 × plus.`,
        unlock: (s) => s.owned[b.id] >= tier.need,
      });
    });
  }

  UPGRADES.push(
    { id: 'detrempe', kind: 'global', mult: 1.1, cost: 55000, name: 'Détrempe reposée',
      target: 'Savoir-faire', effect: 'Toute la production + 10 %.',
      flavor: 'Une nuit au froid, et la pâte se détend.',
      unlock: (s) => s.totalBaked >= 20000 },
    { id: 'tours', kind: 'global', mult: 1.1, cost: 5.5e6, name: 'Trois tours simples',
      target: 'Savoir-faire', effect: 'Toute la production + 10 %.',
      flavor: 'Vingt-sept couches de beurre, pas une de plus.',
      unlock: (s) => s.totalBaked >= 2e6 },
    { id: 'dorure', kind: 'global', mult: 1.1, cost: 5.5e8, name: 'Dorure à l’œuf',
      target: 'Savoir-faire', effect: 'Toute la production + 10 %.',
      flavor: 'Jaune, lait, une pincée de sel. Deux couches au pinceau.',
      unlock: (s) => s.totalBaked >= 2e8 },
    { id: 'froid', kind: 'global', mult: 1.1, cost: 5.5e10, name: 'Beurre froid, pâte froide',
      target: 'Savoir-faire', effect: 'Toute la production + 10 %.',
      flavor: 'La règle d’or du tourage.',
      unlock: (s) => s.totalBaked >= 2e10 },
  );

  const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

  const totalOwned = (s) => BUILDINGS.reduce((sum, b) => sum + s.owned[b.id], 0);

  const ACHIEVEMENTS = [
    { id: 'premier', name: 'Première fournée', cond: 'Cuire un premier croissant.', test: (s) => s.totalBaked >= 1 },
    { id: 'plaque', name: 'Une plaque pleine', cond: 'Cuire 100 croissants.', test: (s) => s.totalBaked >= 100 },
    { id: 'millefeuille', name: 'Mille-feuille', cond: 'Cuire 1 000 croissants.', test: (s) => s.totalBaked >= 1000 },
    { id: 'centmille', name: 'Boulangerie de quartier', cond: 'Cuire 100 000 croissants.', test: (s) => s.totalBaked >= 1e5 },
    { id: 'million', name: 'Le million', cond: 'Cuire 1 million de croissants.', test: (s) => s.totalBaked >= 1e6 },
    { id: 'milliard', name: 'Le milliard', cond: 'Cuire 1 milliard de croissants.', test: (s) => s.totalBaked >= 1e9 },
    { id: 'main', name: 'Petite main', cond: 'Cliquer 100 fois sur le croissant.', test: (s) => s.clicks >= 100 },
    { id: 'poignet', name: 'Poignet de boulanger', cond: 'Cliquer 1 000 fois.', test: (s) => s.clicks >= 1000 },
    { id: 'tendinite', name: 'Tendinite', cond: 'Cliquer 5 000 fois.', test: (s) => s.clicks >= 5000 },
    { id: 'brigade', name: 'Brigade complète', cond: 'Employer 10 apprentis.', test: (s) => s.owned.apprenti >= 10 },
    { id: 'fourchaud', name: 'Four chaud', cond: 'Acheter un four à sole.', test: (s) => s.owned.four >= 1 },
    { id: 'filiere', name: 'Toute la filière', cond: 'Posséder au moins un bâtiment de chaque sorte.',
      test: (s) => BUILDINGS.every((b) => s.owned[b.id] >= 1) },
    { id: 'cinquante', name: 'Entreprise familiale', cond: 'Posséder 50 bâtiments en tout.', test: (s) => totalOwned(s) >= 50 },
    { id: 'cadence', name: 'Cadence', cond: 'Produire 10 croissants par seconde.', test: (_s, cps) => cps >= 10 },
    { id: 'industriel', name: 'Industriel', cond: 'Produire 1 000 croissants par seconde.', test: (_s, cps) => cps >= 1000 },
    { id: 'empire', name: 'Empire du beurre', cond: 'Produire 1 million de croissants par seconde.', test: (_s, cps) => cps >= 1e6 },
    { id: 'dore1', name: 'Croissant doré', cond: 'Attraper un croissant doré.', test: (s) => s.goldenClicks >= 1 },
    { id: 'dore7', name: 'Chasseur d’or', cond: 'Attraper 7 croissants dorés.', test: (s) => s.goldenClicks >= 7 },
    { id: 'aube', name: 'Levé avant l’aube', cond: 'Travailler une heure au fournil.', test: (s) => s.playTime >= 3600 },
  ];
  const ACHIEVEMENT_BONUS = 0.01;

  // ---------------------------------------------------------------------------
  // Formatage (échelle longue française : million, milliard, billion…)
  // ---------------------------------------------------------------------------

  const NF0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const NF1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const NF3 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
  const NF3_FIXED = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const SCALE = ['million', 'milliard', 'billion', 'billiard', 'trillion', 'trilliard',
    'quadrillion', 'quadrilliard', 'quintillion', 'quintilliard', 'sextillion', 'sextilliard'];

  // `fixed` garde trois décimales pour que le grand compteur ne saute pas.
  function fmt(n, decimals = false, fixed = false) {
    if (!Number.isFinite(n)) return '∞';
    if (n < 1e6) {
      if (decimals && n < 100 && n % 1 !== 0) return NF1.format(Math.floor(n * 10) / 10);
      return NF0.format(Math.floor(n));
    }
    const group = Math.floor(Math.log10(n) / 3) - 2;
    if (group >= SCALE.length) return n.toExponential(3).replace('.', ',').replace('e+', ' × 10^');
    const value = n / Math.pow(1000, group + 2);
    return `${(fixed ? NF3_FIXED : NF3).format(value)} ${SCALE[group]}${value >= 2 ? 's' : ''}`;
  }

  function fmtDuration(seconds) {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
    if (m > 0) return `${m} min ${String(r).padStart(2, '0')} s`;
    return `${r} s`;
  }

  const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

  // ---------------------------------------------------------------------------
  // État
  // ---------------------------------------------------------------------------

  function freshState() {
    return {
      croissants: 0,
      totalBaked: 0,
      clicks: 0,
      handBaked: 0,
      goldenClicks: 0,
      owned: Object.fromEntries(BUILDINGS.map((b) => [b.id, 0])),
      upgrades: new Set(),
      achievements: new Set(),
      name: DEFAULT_NAME,
      startedAt: Date.now(),
      playTime: 0,
    };
  }

  let state = freshState();
  let lot = 1;
  const buffs = { frenzyUntil: 0, rushUntil: 0 };
  const derived = { baseCps: 0, perBuilding: {}, clickBase: 1, clickPct: 0 };

  function recalc() {
    let global = 1;
    let clickBase = 1;
    let clickPct = 0;
    const bMult = Object.fromEntries(BUILDINGS.map((b) => [b.id, 1]));
    for (const id of state.upgrades) {
      const u = UPGRADE_BY_ID[id];
      if (!u) continue;
      if (u.kind === 'building') bMult[u.building] *= u.mult;
      else if (u.kind === 'global') global *= u.mult;
      else if (u.kind === 'click') clickBase *= u.mult;
      else if (u.kind === 'clickPct') clickPct += u.pct;
    }
    const achMult = 1 + ACHIEVEMENT_BONUS * state.achievements.size;
    let total = 0;
    for (const b of BUILDINGS) {
      const each = b.cps * bMult[b.id] * global * achMult;
      derived.perBuilding[b.id] = each;
      total += each * state.owned[b.id];
    }
    derived.baseCps = total;
    derived.clickBase = clickBase;
    derived.clickPct = clickPct;
  }

  const now = () => Date.now();
  const frenzyOn = () => buffs.frenzyUntil > now();
  const rushOn = () => buffs.rushUntil > now();
  const cps = () => derived.baseCps * (frenzyOn() ? 7 : 1);
  const clickValue = () => (derived.clickBase + cps() * derived.clickPct) * (rushOn() ? 77 : 1);

  function earn(amount) {
    state.croissants += amount;
    state.totalBaked += amount;
  }

  function costFor(b, n) {
    const owned = state.owned[b.id];
    return Math.ceil(b.base * Math.pow(PRICE_GROWTH, owned) * (Math.pow(PRICE_GROWTH, n) - 1) / (PRICE_GROWTH - 1));
  }

  // ---------------------------------------------------------------------------
  // Dessin du croissant (SVG généré)
  // ---------------------------------------------------------------------------

  // Bandes du croissant, des pointes vers le centre (le centre est dessiné en dernier, par-dessus).
  const CROISSANT_SEGMENTS = [
    { a: -18, rx: 20, ry: 22 }, { a: -162, rx: 20, ry: 22 },
    { a: -40, rx: 31, ry: 38 }, { a: -140, rx: 31, ry: 38 },
    { a: -64, rx: 40, ry: 51 }, { a: -116, rx: 40, ry: 51 },
    { a: -90, rx: 46, ry: 60 },
  ];

  function croissantSVG(prefix, colors) {
    const [light, mid, dark, edge] = colors;
    const cx = 150;
    const cy = 232;
    const R = 118;
    const segs = CROISSANT_SEGMENTS.map((s) => {
      const t = (s.a * Math.PI) / 180;
      const x = (cx + R * Math.cos(t)).toFixed(1);
      const y = (cy + R * Math.sin(t)).toFixed(1);
      return `<g transform="translate(${x} ${y}) rotate(${s.a + 90})">`
        + `<ellipse rx="${s.rx}" ry="${s.ry}" fill="url(#${prefix}-pate)" stroke="${edge}" stroke-width="2.5"/>`
        + `<ellipse cx="${(-s.rx * 0.32).toFixed(1)}" cy="${(-s.ry * 0.12).toFixed(1)}" rx="${(s.rx * 0.16).toFixed(1)}" ry="${(s.ry * 0.52).toFixed(1)}" fill="#fff" opacity="0.16"/>`
        + '</g>';
    }).join('');
    return `<svg viewBox="0 0 300 235" aria-hidden="true" focusable="false">`
      + '<defs>'
      + `<radialGradient id="${prefix}-pate" cx="38%" cy="30%" r="80%">`
      + `<stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>`
      + '</radialGradient>'
      + `<radialGradient id="${prefix}-ombre" cx="50%" cy="50%" r="50%">`
      + '<stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/>'
      + '</radialGradient>'
      + '</defs>'
      + `<ellipse cx="150" cy="224" rx="142" ry="12" fill="url(#${prefix}-ombre)"/>`
      + segs
      + '</svg>';
  }

  // ---------------------------------------------------------------------------
  // Éléments
  // ---------------------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const el = {
    shopName: $('shop-name'),
    shopFounded: $('shop-founded'),
    vitrine: $('vitrine'),
    flour: $('flour'),
    count: $('count'),
    countUnit: $('count-unit'),
    cps: $('cps'),
    buffs: $('buffs'),
    croissant: $('croissant'),
    floaters: $('floaters'),
    golden: $('golden'),
    buildings: $('buildings'),
    upgrades: $('upgrades'),
    upgradesEmpty: $('upgrades-empty'),
    upgradesBadge: $('upgrades-badge'),
    upgradesOwned: $('upgrades-owned'),
    ownedTitle: $('owned-title'),
    achievements: $('achievements'),
    achievementsSummary: $('achievements-summary'),
    shopInput: $('shop-input'),
    ticketHead: $('ticket-head'),
    stats: $('stats'),
    saveNow: $('save-now'),
    reset: $('reset'),
    toasts: $('toasts'),
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  function toast(title, text, mark = '✦') {
    const node = document.createElement('div');
    node.className = 'toast';
    const medal = document.createElement('span');
    medal.className = 'medaillon';
    medal.setAttribute('aria-hidden', 'true');
    medal.textContent = mark;
    const body = document.createElement('div');
    const h = document.createElement('p');
    h.className = 'toast__titre';
    h.textContent = title;
    const p = document.createElement('p');
    p.className = 'toast__texte';
    p.textContent = text;
    body.append(h, p);
    node.append(medal, body);
    el.toasts.append(node);
    while (el.toasts.children.length > 4) el.toasts.firstElementChild.remove();
    setTimeout(() => {
      node.classList.add('sort');
      setTimeout(() => node.remove(), 320);
    }, 4500);
  }

  // ---------------------------------------------------------------------------
  // Bâtiments
  // ---------------------------------------------------------------------------

  const rows = {};

  function buildBuildingRows() {
    el.buildings.textContent = '';
    for (const b of BUILDINGS) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bat';
      btn.dataset.id = b.id;
      btn.innerHTML = '<span class="medaillon" aria-hidden="true"></span>'
        + '<span class="bat__corps"><span class="bat__nom"></span><span class="bat__desc"></span><span class="bat__prod"></span></span>'
        + '<span class="bat__cote"><span class="bat__nb"></span><span class="prix"></span></span>';
      btn.addEventListener('click', () => buyBuilding(b.id, btn));
      li.append(btn);
      el.buildings.append(li);
      rows[b.id] = {
        li, btn,
        medal: btn.querySelector('.medaillon'),
        name: btn.querySelector('.bat__nom'),
        desc: btn.querySelector('.bat__desc'),
        prod: btn.querySelector('.bat__prod'),
        nb: btn.querySelector('.bat__nb'),
        price: btn.querySelector('.prix'),
      };
    }
  }

  function renderBuildings() {
    let mysteryShown = false;
    BUILDINGS.forEach((b, i) => {
      const r = rows[b.id];
      const owned = state.owned[b.id];
      const known = i === 0 || owned > 0 || state.totalBaked >= b.base;
      const mystery = !known && !mysteryShown;
      if (mystery) mysteryShown = true;
      r.li.hidden = !known && !mystery;
      if (r.li.hidden) return;

      const price = costFor(b, lot);
      const affordable = state.croissants >= price;
      r.btn.classList.toggle('mystere', mystery);
      r.btn.classList.toggle('cher', !affordable);
      r.btn.setAttribute('aria-disabled', affordable ? 'false' : 'true');
      setText(r.medal, mystery ? '?' : b.letter);
      setText(r.name, mystery ? '???' : b.name);
      setText(r.desc, mystery ? 'Continuez à cuire pour découvrir la suite.' : b.desc);
      setText(r.prod, mystery ? '' : `${fmt(derived.perBuilding[b.id], true)}/s chacun · ${fmt(derived.perBuilding[b.id] * owned, true)}/s au total`);
      r.prod.hidden = mystery;
      setText(r.nb, String(owned));
      r.nb.classList.toggle('zero', owned === 0);
      const label = lot > 1 ? `${lot} pour ${fmt(price)}` : fmt(price);
      setText(r.price, label);
      const aria = mystery
        ? `Bâtiment inconnu, ${fmt(price)} croissants`
        : `Acheter ${lot} ${b.name}, ${fmt(price)} croissants. Possédés : ${owned}`;
      if (r.btn.getAttribute('aria-label') !== aria) r.btn.setAttribute('aria-label', aria);
    });
  }

  function shake(node) {
    if (reducedMotion.matches) return;
    node.classList.remove('secoue');
    void node.offsetWidth;
    node.classList.add('secoue');
  }

  function buyBuilding(id, btn) {
    const b = BUILDING_BY_ID[id];
    const price = costFor(b, lot);
    if (state.croissants < price) {
      shake(btn);
      return;
    }
    state.croissants -= price;
    state.owned[id] += lot;
    recalc();
    render();
  }

  // ---------------------------------------------------------------------------
  // Améliorations
  // ---------------------------------------------------------------------------

  let upgradesKey = '';
  let upgradeButtons = [];

  function availableUpgrades() {
    return UPGRADES
      .filter((u) => !state.upgrades.has(u.id) && u.unlock(state))
      .sort((a, b) => a.cost - b.cost);
  }

  function renderUpgrades() {
    const available = availableUpgrades();
    const key = `${available.map((u) => u.id).join(',')}|${state.upgrades.size}`;
    if (key !== upgradesKey) {
      upgradesKey = key;
      el.upgrades.textContent = '';
      upgradeButtons = available.map((u) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'amelio';
        btn.dataset.id = u.id;
        const text = document.createElement('span');
        text.className = 'amelio__texte';
        const parts = [['amelio__cible', u.target], ['amelio__nom', u.name], ['amelio__effet', u.effect], ['amelio__saveur', u.flavor]];
        for (const [cls, content] of parts) {
          const span = document.createElement('span');
          span.className = cls;
          span.textContent = content;
          text.append(span);
        }
        const price = document.createElement('span');
        price.className = 'prix';
        price.textContent = fmt(u.cost);
        btn.append(text, price);
        btn.setAttribute('aria-label', `${u.name} : ${u.effect} Prix : ${fmt(u.cost)} croissants.`);
        btn.addEventListener('click', () => buyUpgrade(u.id, btn));
        li.append(btn);
        el.upgrades.append(li);
        return { u, btn };
      });
      el.upgradesEmpty.hidden = available.length > 0;

      el.upgradesOwned.textContent = '';
      const owned = UPGRADES.filter((u) => state.upgrades.has(u.id));
      el.ownedTitle.hidden = owned.length === 0;
      for (const u of owned) {
        const li = document.createElement('li');
        li.className = 'acquise';
        li.textContent = u.name;
        li.title = u.effect;
        el.upgradesOwned.append(li);
      }
    }

    let affordableCount = 0;
    for (const { u, btn } of upgradeButtons) {
      const ok = state.croissants >= u.cost;
      if (ok) affordableCount += 1;
      btn.classList.toggle('cher', !ok);
      btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }
    el.upgradesBadge.hidden = affordableCount === 0;
    setText(el.upgradesBadge, String(affordableCount));
  }

  function buyUpgrade(id, btn) {
    const u = UPGRADE_BY_ID[id];
    if (!u || state.upgrades.has(id)) return;
    if (state.croissants < u.cost) {
      shake(btn);
      return;
    }
    state.croissants -= u.cost;
    state.upgrades.add(id);
    recalc();
    render();
    toast(u.name, u.effect, '✓');
  }

  // ---------------------------------------------------------------------------
  // Succès
  // ---------------------------------------------------------------------------

  let achievementsKey = '';

  function checkAchievements() {
    let gained = false;
    const current = derived.baseCps;
    for (const a of ACHIEVEMENTS) {
      if (!state.achievements.has(a.id) && a.test(state, current)) {
        state.achievements.add(a.id);
        gained = true;
        toast(`Succès : ${a.name}`, `${a.cond} Production + 1 %.`, '★');
      }
    }
    if (gained) recalc();
  }

  function renderAchievements() {
    const key = [...state.achievements].join(',');
    if (key === achievementsKey && el.achievements.childElementCount) return;
    achievementsKey = key;
    el.achievements.textContent = '';
    for (const a of ACHIEVEMENTS) {
      const li = document.createElement('li');
      const got = state.achievements.has(a.id);
      li.className = `plaque${got ? ' obtenu' : ''}`;
      const name = document.createElement('span');
      name.className = 'plaque__nom';
      name.textContent = a.name;
      const cond = document.createElement('span');
      cond.className = 'plaque__condition';
      cond.textContent = got ? a.cond : `À obtenir : ${a.cond.charAt(0).toLowerCase()}${a.cond.slice(1)}`;
      li.append(name, cond);
      el.achievements.append(li);
    }
    const n = state.achievements.size;
    setText(el.achievementsSummary,
      `${n} sur ${ACHIEVEMENTS.length} obtenus. Chaque succès augmente toute la production de 1 % (actuellement + ${n} %).`);
  }

  // ---------------------------------------------------------------------------
  // Registre (statistiques)
  // ---------------------------------------------------------------------------

  const STAT_ROWS = [
    ['Croissants en stock', () => fmt(state.croissants)],
    ['Cuits depuis l’ouverture', () => fmt(state.totalBaked)],
    ['Production par seconde', () => fmt(cps(), true)],
    ['Par clic', () => fmt(clickValue(), true)],
    ['Clics sur le croissant', () => fmt(state.clicks)],
    ['Façonnés à la main', () => fmt(state.handBaked)],
    ['Croissants dorés attrapés', () => fmt(state.goldenClicks)],
    ['Bâtiments', () => fmt(totalOwned(state))],
    ['Améliorations', () => `${state.upgrades.size} / ${UPGRADES.length}`],
    ['Succès', () => `${state.achievements.size} / ${ACHIEVEMENTS.length}`],
    ['Temps au fournil', () => fmtDuration(state.playTime)],
    ['Ouverture', () => DATE_FMT.format(new Date(state.startedAt))],
  ];
  const statCells = [];

  function buildStats() {
    el.stats.textContent = '';
    for (const [label] of STAT_ROWS) {
      const row = document.createElement('div');
      row.className = 'ticket__ligne';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      row.append(dt, dd);
      el.stats.append(row);
      statCells.push(dd);
    }
  }

  function renderStats() {
    STAT_ROWS.forEach(([, value], i) => setText(statCells[i], value()));
  }

  // ---------------------------------------------------------------------------
  // Enseigne et compteur
  // ---------------------------------------------------------------------------

  function renderSign() {
    setText(el.shopName, state.name);
    setText(el.ticketHead, state.name);
    setText(el.shopFounded, `Maison fondée en ${new Date(state.startedAt).getFullYear()}`);
    if (document.activeElement !== el.shopInput) el.shopInput.value = state.name;
  }

  let lastBuffsKey = '';

  function renderCounter() {
    setText(el.count, fmt(state.croissants, false, true));
    setText(el.countUnit, state.croissants >= 2 ? 'croissants' : 'croissant');
    setText(el.cps, fmt(cps(), true));

    const t = now();
    const chips = [];
    if (buffs.frenzyUntil > t) chips.push(`Fournée dorée ×7 · ${Math.ceil((buffs.frenzyUntil - t) / 1000)} s`);
    if (buffs.rushUntil > t) chips.push(`Coup de feu : clic ×77 · ${Math.ceil((buffs.rushUntil - t) / 1000)} s`);
    const key = chips.join('|');
    if (key !== lastBuffsKey) {
      lastBuffsKey = key;
      el.buffs.textContent = '';
      for (const c of chips) {
        const li = document.createElement('li');
        li.className = 'effet';
        li.textContent = c;
        el.buffs.append(li);
      }
    }
  }

  let activeTab = 'production';
  let lastTitle = '';

  function render() {
    renderCounter();
    renderBuildings();
    renderUpgrades();
    if (activeTab === 'achievements') renderAchievements();
    if (activeTab === 'ledger') renderStats();
    const title = `${fmt(state.croissants)} croissants · ${state.name}`;
    if (title !== lastTitle) {
      lastTitle = title;
      document.title = title;
    }
  }

  // ---------------------------------------------------------------------------
  // Clic sur le croissant
  // ---------------------------------------------------------------------------

  function localPoint(e, fallbackNode) {
    const box = el.vitrine.getBoundingClientRect();
    if (e && e.detail > 0 && (e.clientX || e.clientY)) {
      return { x: e.clientX - box.left, y: e.clientY - box.top };
    }
    const r = fallbackNode.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height * 0.3 - box.top };
  }

  function floater(text, x, y, gold = false) {
    if (el.floaters.childElementCount > 40) el.floaters.firstElementChild.remove();
    const node = document.createElement('span');
    node.className = `flottant${gold ? ' flottant--or' : ''}`;
    node.textContent = text;
    node.style.left = `${x + (Math.random() * 24 - 12)}px`;
    node.style.top = `${y}px`;
    el.floaters.append(node);
    setTimeout(() => node.remove(), 1100);
  }

  function pop() {
    if (reducedMotion.matches || !el.croissant.animate) return;
    el.croissant.animate(
      [{ transform: 'scale(0.93)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }],
      { duration: 180, easing: 'ease-out' },
    );
  }

  function onCroissantClick(e) {
    const value = clickValue();
    earn(value);
    state.clicks += 1;
    state.handBaked += value;
    const p = localPoint(e, el.croissant);
    floater(`+${fmt(value, true)}`, p.x, p.y);
    crumbs(p.x, p.y);
    pop();
    renderCounter();
  }

  // ---------------------------------------------------------------------------
  // Croissant doré
  // ---------------------------------------------------------------------------

  const golden = { visible: false, until: 0, next: 0 };
  const rand = (min, max) => min + Math.random() * (max - min);

  function scheduleGolden(first = false) {
    golden.next = now() + (first ? rand(40, 90) : rand(60, 150)) * 1000;
  }

  function spawnGolden() {
    golden.visible = true;
    golden.until = now() + 13000;
    el.golden.classList.remove('part');
    el.golden.style.left = `${rand(6, 78)}%`;
    el.golden.style.top = `${rand(30, 70)}%`;
    el.golden.hidden = false;
  }

  function hideGolden() {
    golden.visible = false;
    el.golden.classList.add('part');
    setTimeout(() => {
      if (!golden.visible) el.golden.hidden = true;
    }, 500);
    scheduleGolden();
  }

  function onGoldenClick(e) {
    if (!golden.visible) return;
    const p = localPoint(e, el.golden);
    state.goldenClicks += 1;
    hideGolden();

    const roll = Math.random();
    const base = derived.baseCps;
    if (roll < 0.15) {
      buffs.rushUntil = now() + 13000;
      toast('Coup de feu !', 'Pendant 13 secondes, chaque clic rapporte 77 × plus.', '!');
      floater('Coup de feu !', p.x, p.y, true);
    } else if (roll < 0.6 && base >= 1) {
      buffs.frenzyUntil = now() + 77000;
      toast('Fournée dorée', 'La production est multipliée par 7 pendant 77 secondes.', '×7');
      floater('Fournée dorée !', p.x, p.y, true);
    } else {
      const gain = Math.min(state.croissants * 0.15, Math.max(base, 1) * 900) + 13;
      earn(gain);
      toast('Pourboire d’un habitué', `+${fmt(gain)} croissants, d’un coup.`, '+');
      floater(`+${fmt(gain)}`, p.x, p.y, true);
    }
    checkAchievements();
    render();
  }

  // ---------------------------------------------------------------------------
  // Farine et miettes (canvas)
  // ---------------------------------------------------------------------------

  const ctx = el.flour.getContext('2d');
  let canvasW = 0;
  let canvasH = 0;
  const flour = [];
  const flakes = [];
  const FLAKE_COLORS = ['#f6c77a', '#e0953f', '#b8672a', '#fbe2a8'];

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = el.vitrine.getBoundingClientRect();
    canvasW = r.width;
    canvasH = r.height;
    el.flour.width = Math.round(canvasW * dpr);
    el.flour.height = Math.round(canvasH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function crumbs(x, y) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < 5; i += 1) {
      flakes.push({
        x, y,
        vx: rand(-110, 110),
        vy: rand(-220, -60),
        size: rand(2, 4.5),
        rot: rand(0, Math.PI),
        vr: rand(-8, 8),
        life: 0,
        max: rand(0.7, 1.1),
        color: FLAKE_COLORS[Math.floor(Math.random() * FLAKE_COLORS.length)],
      });
    }
    if (flakes.length > 160) flakes.splice(0, flakes.length - 160);
  }

  function newFlour(anywhere) {
    return {
      x: rand(0, canvasW),
      y: anywhere ? rand(0, canvasH) : -6,
      vy: rand(8, 22),
      phase: rand(0, Math.PI * 2),
      size: rand(0.8, 2.2),
      alpha: rand(0.12, 0.38),
    };
  }

  let lastFrame = performance.now();

  function frame(t) {
    const dt = Math.min((t - lastFrame) / 1000, 0.1);
    lastFrame = t;
    ctx.clearRect(0, 0, canvasW, canvasH);

    if (!reducedMotion.matches) {
      const target = Math.min(70, Math.round(6 + 9 * Math.log10(1 + cps())));
      while (flour.length < target) flour.push(newFlour(flour.length < 3));
      if (flour.length > target) flour.length = target;
      ctx.fillStyle = '#f2e9d6';
      for (let i = 0; i < flour.length; i += 1) {
        const f = flour[i];
        f.y += f.vy * dt;
        f.phase += dt;
        const x = f.x + Math.sin(f.phase) * 8;
        if (f.y > canvasH + 6) flour[i] = newFlour(false);
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = flakes.length - 1; i >= 0; i -= 1) {
      const p = flakes[i];
      p.life += dt;
      if (p.life >= p.max) {
        flakes.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Sauvegarde
  // ---------------------------------------------------------------------------

  function serialize() {
    return {
      v: 1,
      croissants: state.croissants,
      totalBaked: state.totalBaked,
      clicks: state.clicks,
      handBaked: state.handBaked,
      goldenClicks: state.goldenClicks,
      owned: { ...state.owned },
      upgrades: [...state.upgrades],
      achievements: [...state.achievements],
      name: state.name,
      startedAt: state.startedAt,
      playTime: state.playTime,
      savedAt: Date.now(),
    };
  }

  function readStorage() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function save(manual = false) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
      if (manual) toast('Partie sauvegardée', 'Vous la retrouverez en rouvrant cette page dans ce navigateur.', '✓');
    } catch {
      if (manual) toast('Sauvegarde impossible', 'Ce navigateur bloque le stockage local : la partie continue mais ne sera pas conservée.', '!');
    }
  }

  const num = (v, fallback = 0) => (Number.isFinite(v) && v >= 0 ? v : fallback);

  function applySave(data) {
    const s = freshState();
    if (!data || typeof data !== 'object') return { state: s, savedAt: 0 };
    s.croissants = num(data.croissants);
    s.totalBaked = Math.max(num(data.totalBaked), s.croissants);
    s.clicks = Math.floor(num(data.clicks));
    s.handBaked = num(data.handBaked);
    s.goldenClicks = Math.floor(num(data.goldenClicks));
    for (const b of BUILDINGS) s.owned[b.id] = Math.floor(num(data.owned && data.owned[b.id]));
    if (Array.isArray(data.upgrades)) data.upgrades.filter((id) => UPGRADE_BY_ID[id]).forEach((id) => s.upgrades.add(id));
    const achIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    if (Array.isArray(data.achievements)) data.achievements.filter((id) => achIds.has(id)).forEach((id) => s.achievements.add(id));
    if (typeof data.name === 'string' && data.name.trim()) s.name = data.name.trim().slice(0, 32);
    s.startedAt = num(data.startedAt, Date.now()) || Date.now();
    s.playTime = num(data.playTime);
    return { state: s, savedAt: num(data.savedAt) };
  }

  // ---------------------------------------------------------------------------
  // Interface : onglets, lot, registre
  // ---------------------------------------------------------------------------

  const TABS = [
    { id: 'production', tab: $('tab-production'), panel: $('panel-production') },
    { id: 'upgrades', tab: $('tab-upgrades'), panel: $('panel-upgrades') },
    { id: 'achievements', tab: $('tab-achievements'), panel: $('panel-achievements') },
    { id: 'ledger', tab: $('tab-ledger'), panel: $('panel-ledger') },
  ];

  function selectTab(id, focus = false) {
    activeTab = id;
    for (const t of TABS) {
      const on = t.id === id;
      t.tab.setAttribute('aria-selected', String(on));
      t.tab.tabIndex = on ? 0 : -1;
      t.panel.hidden = !on;
      if (on && focus) t.tab.focus();
    }
    if (id === 'achievements') renderAchievements();
    if (id === 'ledger') renderStats();
    const scroller = TABS[0].panel.parentElement;
    scroller.scrollTop = 0;
  }

  function bindUi() {
    el.croissant.innerHTML = croissantSVG('cr', ['#fbd68e', '#e0953f', '#a5581f', '#7a3a12']);
    el.golden.innerHTML = croissantSVG('or', ['#fff6c8', '#f2c84b', '#b8861e', '#8a5e0c']);
    el.croissant.addEventListener('click', onCroissantClick);
    el.golden.addEventListener('click', onGoldenClick);

    TABS.forEach((t, i) => {
      t.tab.addEventListener('click', () => selectTab(t.id));
      t.tab.addEventListener('keydown', (e) => {
        let next = -1;
        if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = TABS.length - 1;
        if (next >= 0) {
          e.preventDefault();
          selectTab(TABS[next].id, true);
        }
      });
    });

    document.querySelectorAll('.lot__choix').forEach((btn) => {
      btn.addEventListener('click', () => {
        lot = Number(btn.dataset.lot) || 1;
        document.querySelectorAll('.lot__choix').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        renderBuildings();
      });
    });

    el.shopInput.addEventListener('input', () => {
      const name = el.shopInput.value.trim().slice(0, 32);
      state.name = name || DEFAULT_NAME;
      renderSign();
    });
    el.shopInput.addEventListener('blur', () => {
      el.shopInput.value = state.name;
    });

    el.saveNow.addEventListener('click', () => save(true));

    let armTimer = 0;
    el.reset.addEventListener('click', () => {
      if (!el.reset.classList.contains('arme')) {
        el.reset.classList.add('arme');
        el.reset.textContent = 'Confirmer : tout effacer';
        armTimer = setTimeout(() => {
          el.reset.classList.remove('arme');
          el.reset.textContent = 'Remettre à zéro';
        }, 4000);
        return;
      }
      clearTimeout(armTimer);
      el.reset.classList.remove('arme');
      el.reset.textContent = 'Remettre à zéro';
      state = freshState();
      buffs.frenzyUntil = 0;
      buffs.rushUntil = 0;
      upgradesKey = '';
      achievementsKey = '';
      recalc();
      save();
      renderSign();
      renderAchievements();
      render();
      toast('Boutique remise à zéro', 'Un nouveau départ, un premier croissant à cuire.', '↺');
    });

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(el.vitrine);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });
    window.addEventListener('pagehide', () => save());
  }

  // ---------------------------------------------------------------------------
  // Boucle principale
  // ---------------------------------------------------------------------------

  let lastTick = Date.now();

  function tick() {
    const t = Date.now();
    const dt = Math.min(Math.max((t - lastTick) / 1000, 0), 3600);
    lastTick = t;
    earn(cps() * dt);
    state.playTime += dt;

    if (golden.visible && t >= golden.until) hideGolden();
    else if (!golden.visible && t >= golden.next) spawnGolden();

    checkAchievements();
    render();
  }

  function start(hotData) {
    const fromHot = hotData && hotData.save;
    const { state: loaded, savedAt } = applySave(fromHot || readStorage());
    state = loaded;
    recalc();
    bindUi();
    buildBuildingRows();
    buildStats();
    renderSign();

    if (!fromHot && savedAt > 0) {
      const away = (Date.now() - savedAt) / 1000;
      const gain = derived.baseCps * Math.min(away, OFFLINE_CAP_S) * OFFLINE_RATE;
      if (away > 30 && gain >= 1) {
        earn(gain);
        toast('Bon retour au fournil', `Le four a tourné pendant votre absence (${fmtDuration(Math.min(away, OFFLINE_CAP_S))}) : +${fmt(gain)} croissants.`, '☼');
      }
    }

    scheduleGolden(true);
    resizeCanvas();
    lastTick = Date.now();
    render();
    setInterval(tick, 100);
    setInterval(() => save(), 10000);
    requestAnimationFrame(frame);
  }

  const hot = window.claude && window.claude.hot;
  try {
    if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ save: serialize() }));
  } catch {
    // Rechargement à chaud indisponible : la sauvegarde locale suffit.
  }
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})();
