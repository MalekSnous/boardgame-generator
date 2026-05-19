// ============================================================
// DÉS DU DESTIN — game.js
// ============================================================

const gameState = {
  numPlayers: 2,
  players: [],
  currentPlayerIndex: 0,
  crisisGauge: 0,
  maxCrisis: 10,
  threatDeck: [],
  activeThreat: null,
  shieldCards: [],
  shieldDeck: [],
  discardedThreats: [],
  neutralizedThreats: 0,
  targetNeutralized: 15,
  phase: 'setup',       // setup | threat | roll | reroll | combine | resolve | gameover
  rollCount: 0,
  selectedDiceForReroll: [],
  selectedCombination: null,
  offeredDice: [],      // dice offered by other players from reserve
  selectedOfferedDice: [],
  gameOver: false,
  winner: null,         // 'players' | 'crisis'
  log: [],
  blockedDiceSlots: [], // slots blocked by threat effects
  usedShieldThisTurn: false,
};

// ============================================================
// DATA — Threats & Shields
// ============================================================

const THREAT_DATA = [
  { id: 1,  name: 'Tempête de Grêle',    icon: '🌨', crisis: 1, effect: 'block',      desc: 'Bloque un dé du joueur actif (il ne peut relancer qu\'un dé au lieu de 3).',    catastrophe: false },
  { id: 2,  name: 'Vague de Chaleur',    icon: '🔥', crisis: 1, effect: 'none',       desc: 'La jauge de crise monte de 1.',                                                  catastrophe: false },
  { id: 3,  name: 'Inondation',          icon: '🌊', crisis: 2, effect: 'remove_res', desc: 'La jauge de crise monte de 2.',                                                  catastrophe: false },
  { id: 4,  name: 'Épidémie',            icon: '🦠', crisis: 1, effect: 'no_offer',   desc: 'Aucun joueur ne peut offrir de dé en réserve ce tour.',                          catastrophe: false },
  { id: 5,  name: 'Tremblement de Terre',icon: '🌍', crisis: 2, effect: 'block',      desc: 'Bloque un dé et monte la jauge de 2.',                                           catastrophe: false },
  { id: 6,  name: 'Tornade',             icon: '🌪', crisis: 1, effect: 'reroll_all', desc: 'Le joueur actif doit relancer tous ses dés (obligatoire, pas de choix).',        catastrophe: false },
  { id: 7,  name: 'Sécheresse',          icon: '☀️', crisis: 1, effect: 'none',       desc: 'La jauge de crise monte de 1.',                                                  catastrophe: false },
  { id: 8,  name: 'Avalanche',           icon: '🏔', crisis: 2, effect: 'block',      desc: 'Bloque un dé et monte la jauge de 2.',                                           catastrophe: false },
  { id: 9,  name: 'Tsunami',             icon: '☠',  crisis: 0, effect: 'catastrophe',desc: 'CATASTROPHE : Si aucun Bouclier disponible, la crise monte de 3.',               catastrophe: true  },
  { id: 10, name: 'Météorite',           icon: '☠',  crisis: 0, effect: 'catastrophe',desc: 'CATASTROPHE : Si aucun Bouclier disponible, la crise monte de 3.',               catastrophe: true  },
  { id: 11, name: 'Éruption Volcanique', icon: '🌋', crisis: 2, effect: 'none',       desc: 'La jauge de crise monte de 2.',                                                  catastrophe: false },
  { id: 12, name: 'Tempête Magnétique',  icon: '⚡', crisis: 1, effect: 'no_offer',   desc: 'Aucun joueur ne peut offrir de dé ce tour.',                                     catastrophe: false },
  { id: 13, name: 'Smog Toxique',        icon: '☁️', crisis: 1, effect: 'block',      desc: 'Bloque un dé du joueur actif.',                                                  catastrophe: false },
  { id: 14, name: 'Raz-de-Marée',       icon: '☠',  crisis: 0, effect: 'catastrophe',desc: 'CATASTROPHE : Si aucun Bouclier disponible, la crise monte de 3.',               catastrophe: true  },
  { id: 15, name: 'Fissure Tectonique',  icon: '🌐', crisis: 2, effect: 'none',       desc: 'La jauge de crise monte de 2.',                                                  catastrophe: false },
];

const SHIELD_DATA = [
  { id: 'S1',  name: 'Abri Renforcé',      icon: '🛡', effect: 'cancel_crisis',  desc: 'Annule +1 crise (à utiliser avant résolution).' },
  { id: 'S2',  name: 'Relance Magique',     icon: '🎲', effect: 'extra_reroll',   desc: 'Rejoue un dé supplémentaire après le reroll.' },
  { id: 'S3',  name: 'Miroir de Dés',       icon: '🔮', effect: 'copy_die',       desc: 'Copie la valeur d\'un dé d\'un autre joueur.' },
  { id: 'S4',  name: 'Pare-Catastrophe',    icon: '⛨',  effect: 'block_cata',    desc: 'Bloque une Catastrophe immédiatement.' },
  { id: 'S5',  name: 'Mur Protecteur',      icon: '🏰', effect: 'cancel_crisis',  desc: 'Annule +1 crise.' },
  { id: 'S6',  name: 'Second Souffle',      icon: '💨', effect: 'extra_reroll',   desc: 'Rejoue un dé supplémentaire.' },
  { id: 'S7',  name: 'Écho des Dés',        icon: '🔄', effect: 'copy_die',       desc: 'Copie la valeur d\'un dé d\'un autre joueur.' },
  { id: 'S8',  name: 'Bouclier Absolu',     icon: '✨', effect: 'block_cata',     desc: 'Bloque une Catastrophe.' },
  { id: 'S9',  name: 'Bastion',             icon: '🛡', effect: 'cancel_crisis',  desc: 'Annule +1 crise.' },
  { id: 'S10', name: 'Chance du Destin',    icon: '🍀', effect: 'extra_reroll',   desc: 'Rejoue un dé supplémentaire.' },
  { id: 'S11', name: 'Réflexion',           icon: '🔮', effect: 'copy_die',       desc: 'Copie la valeur d\'un dé d\'un autre joueur.' },
  { id: 'S12', name: 'Rempart Ultime',      icon: '⛨',  effect: 'block_cata',    desc: 'Bloque une Catastrophe.' },
  { id: 'S13', name: 'Forteresse',          icon: '🏰', effect: 'cancel_crisis',  desc: 'Annule +1 crise.' },
  { id: 'S14', name: 'Tourbillon Brisé',    icon: '💫', effect: 'extra_reroll',   desc: 'Rejoue un dé supplémentaire.' },
  { id: 'S15', name: 'Voile de Miroir',     icon: '🔮', effect: 'copy_die',       desc: 'Copie la valeur d\'un dé d\'un autre joueur.' },
  { id: 'S16', name: 'Égide Sacrée',        icon: '⛨',  effect: 'block_cata',    desc: 'Bloque une Catastrophe.' },
  { id: 'S17', name: 'Glacis',              icon: '🛡', effect: 'cancel_crisis',  desc: 'Annule +1 crise.' },
  { id: 'S18', name: 'Impulsion',           icon: '⚡', effect: 'extra_reroll',   desc: 'Rejoue un dé supplémentaire.' },
  { id: 'S19', name: 'Clone Dés',           icon: '🎲', effect: 'copy_die',       desc: 'Copie la valeur d\'un dé d\'un autre joueur.' },
  { id: 'S20', name: 'Bouclier de Fortune', icon: '🍀', effect: 'block_cata',     desc: 'Bloque une Catastrophe.' },
];

const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow'];
const PLAYER_NAMES  = ['Rouge', 'Bleu', 'Vert', 'Jaune'];
const PLAYER_EMOJIS = ['🔴', '🔵', '🟢', '🟡'];

// ============================================================
// UTILITIES
// ============================================================

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function addLog(msg) {
  gameState.log.unshift(msg);
  if (gameState.log.length > 30) gameState.log.pop();
}

// ============================================================
// COMBINATION DETECTION
// ============================================================

function detectCombination(values) {
  // values: array of numbers (3–4 values possible with offered dice)
  const sorted = [...values].sort((a, b) => a - b);

  // Check for brelan (3 of a kind) in any 3
  const counts = {};
  sorted.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const vals = Object.values(counts);

  // Full (3+2 or better in 5)
  if (sorted.length >= 5) {
    // Full: pair + brelan
    const hasPair   = vals.includes(2);
    const hasBrelan = vals.includes(3);
    if (hasPair && hasBrelan) return 'full';
  }

  // Brelan
  if (vals.includes(3)) return 'brelan';

  // Full in exactly 5 dice
  if (sorted.length === 5) {
    const hasPair   = vals.includes(2);
    const hasBrelan = vals.includes(3);
    if (hasPair && hasBrelan) return 'full';
  }

  // Suite (3 consecutive anywhere)
  const unique = [...new Set(sorted)];
  for (let i = 0; i <= unique.length - 3; i++) {
    if (unique[i+1] === unique[i]+1 && unique[i+2] === unique[i]+2) return 'suite';
  }

  // Pair
  if (vals.includes(2) || vals.includes(4)) return 'pair';

  return null;
}

function combinationLabel(combo) {
  switch(combo) {
    case 'pair':   return 'PAIRE — Jauge -1';
    case 'suite':  return 'SUITE — Neutralise la Menace';
    case 'full':   return 'FULL — Jauge -3 + Carte Bouclier';
    case 'brelan': return 'BRELAN — Neutralise + Jauge -2';
    default:       return 'Aucune combinaison';
  }
}

// ============================================================
// INIT
// ============================================================

function initGame(numPlayers) {
  gameState.numPlayers = numPlayers;
  gameState.players = [];
  for (let i = 0; i < numPlayers; i++) {
    gameState.players.push({
      index: i,
      name: PLAYER_NAMES[i],
      color: PLAYER_COLORS[i],
      emoji: PLAYER_EMOJIS[i],
      dice: [0, 0, 0],           // current roll
      reserveDie: null,           // die kept in reserve (value) from previous turn
      reserveDieUsed: false,
      blockedDieCount: 0,
    });
  }

  // Build threat deck
  const threats = shuffle([...THREAT_DATA]);
  gameState.threatDeck = threats.slice(0, 15);
  gameState.activeThreat = null;
  gameState.discardedThreats = [];
  gameState.neutralizedThreats = 0;

  // Build shield deck
  gameState.shieldDeck = shuffle([...SHIELD_DATA]);
  gameState.shieldCards = []; // shared pool

  gameState.currentPlayerIndex = 0;
  gameState.crisisGauge = 0;
  gameState.phase = 'threat';
  gameState.rollCount = 0;
  gameState.selectedDiceForReroll = [];
  gameState.selectedCombination = null;
  gameState.offeredDice = [];
  gameState.selectedOfferedDice = [];
  gameState.gameOver = false;
  gameState.winner = null;
  gameState.log = [];
  gameState.usedShieldThisTurn = false;

  addLog('🎮 Nouvelle partie démarrée !');
  renderAll();
  // Start first threat reveal
  setTimeout(() => revealThreat(), 300);
}

// ============================================================
// GAME FLOW
// ============================================================

function revealThreat() {
  if (gameState.gameOver) return;

  if (gameState.threatDeck.length === 0) {
    // All threats neutralized — check win
    checkWin();
    return;
  }

  gameState.phase = 'threat';
  const threat = gameState.threatDeck.shift();
  gameState.activeThreat = threat;
  addLog(`⚠️ Menace révélée : ${threat.icon} ${threat.name}`);

  // Apply threat effect
  applyThreatEffect(threat);

  if (gameState.gameOver) return;

  gameState.phase = 'roll';
  gameState.rollCount = 0;
  gameState.selectedDiceForReroll = [];
  gameState.selectedOfferedDice = [];
  gameState.offeredDice = [];
  gameState.usedShieldThisTurn = false;

  // Reset current player dice
  const cp = currentPlayer();
  cp.dice = [0, 0, 0];
  cp.blockedDieCount = 0;

  // Apply block effect
  if (threat.effect === 'block' || threat.effect === 'reroll_all') {
    if (threat.effect === 'block') cp.blockedDieCount = 1;
  }

  renderAll();
}

function applyThreatEffect(threat) {
  const cp = currentPlayer();

  if (threat.catastrophe) {
    // CATASTROPHE
    addLog(`☠️ CATASTROPHE : ${threat.name} !`);
    const blockShield = gameState.shieldCards.find(s => s.effect === 'block_cata');
    if (blockShield) {
      addLog(`🛡 Bouclier utilisé : ${blockShield.name} — Catastrophe bloquée !`);
      gameState.shieldCards.splice(gameState.shieldCards.indexOf(blockShield), 1);
    } else {
      addLog(`💥 Aucun Bouclier ! Crise +3`);
      increaseCrisis(3);
    }
    return;
  }

  // Normal crisis increase
  if (threat.crisis > 0) {
    addLog(`📈 Jauge de crise +${threat.crisis} (${threat.name})`);
    increaseCrisis(threat.crisis);
  }

  if (threat.effect === 'remove_res') {
    const toRemove = 1;
    for (let i = 0; i < gameState.numPlayers && i < toRemove; i++) {
      const p = gameState.players[i];
      if (p.reserveDie !== null) {
        p.reserveDie = null;
        addLog(`💧 Inondation : dé de réserve de ${p.name} perdu.`);
      }
    }
  }
  if (threat.effect === 'no_offer') {
    addLog(`🚫 Aucun dé ne peut être offert ce tour.`);
  }
  if (threat.effect === 'reroll_all') {
    addLog(`🌪 Tornade : relance obligatoire de tous les dés.`);
  }
  if (threat.effect === 'block') {
    addLog(`🔒 Un dé est bloqué pour ${cp.name}.`);
  }
}

function increaseCrisis(amount) {
  gameState.crisisGauge = Math.min(gameState.crisisGauge + amount, gameState.maxCrisis);
  if (gameState.crisisGauge >= gameState.maxCrisis) {
    triggerGameOver('crisis');
  }
}

function decreaseCrisis(amount) {
  gameState.crisisGauge = Math.max(0, gameState.crisisGauge - amount);
}

function triggerGameOver(reason) {
  gameState.gameOver = true;
  gameState.phase = 'gameover';
  gameState.winner = reason === 'crisis' ? 'crisis' : 'players';
  addLog(reason === 'crisis' ? '💀 DÉFAITE ! La jauge de crise a atteint 10.' : '🏆 VICTOIRE ! Toutes les menaces sont neutralisées !');
  renderAll();
}

function checkWin() {
  if (gameState.threatDeck.length === 0 && gameState.activeThreat === null && gameState.neutralizedThreats >= gameState.targetNeutralized) {
    gameState.gameOver = true;
    gameState.phase = 'gameover';
    gameState.winner = 'players';
    addLog(`🏆 VICTOIRE ! ${gameState.neutralizedThreats} menaces neutralisées !`);
    renderAll();
  }
}

function currentPlayer() {
  return gameState.players[gameState.currentPlayerIndex];
}

// ============================================================
// DICE ACTIONS
// ============================================================

function rollDice() {
  if (gameState.gameOver) return;
  if (gameState.phase !== 'roll') return;

  const cp = currentPlayer();
  const threat = gameState.activeThreat;

  if (threat && threat.effect === 'reroll_all' && gameState.rollCount === 0) {
    // Force all dice reroll
    cp.dice = [rollDie(), rollDie(), rollDie()];
    addLog(`🌪 Tornade : tous les dés relancés pour ${cp.emoji} ${cp.name}.`);
    gameState.rollCount = 1;
    // go straight to combine phase (no reroll choice)
    gameState.phase = 'combine';
    buildOfferedDice();
    renderAll();
    return;
  }

  // Normal roll
  const blockedCount = cp.blockedDieCount || 0;
  const rollableCount = 3 - blockedCount;

  cp.dice = [];
  for (let i = 0; i < 3; i++) {
    if (i < blockedCount) {
      cp.dice.push(0); // 0 = blocked
    } else {
      cp.dice.push(rollDie());
    }
  }

  addLog(`🎲 ${cp.emoji} ${cp.name} lance ses dés : ${cp.dice.filter(d=>d>0).join(' | ')}`);
  gameState.rollCount = 1;
  gameState.phase = 'reroll';
  gameState.selectedDiceForReroll = [];
  renderAll();
}

function toggleDieForReroll(index) {
  if (gameState.phase !== 'reroll') return;
  const cp = currentPlayer();
  if (cp.dice[index] === 0) return; // blocked

  const idx = gameState.selectedDiceForReroll.indexOf(index);
  if (idx === -1) {
    gameState.selectedDiceForReroll.push(index);
  } else {
    gameState.selectedDiceForReroll.splice(idx, 1);
  }
  renderAll();
}

function confirmReroll() {
  if (gameState.phase !== 'reroll') return;
  const cp = currentPlayer();
  const threat = gameState.activeThreat;

  // Check if extra reroll shield available
  const extraRerollShield = gameState.shieldCards.find(s => s.effect === 'extra_reroll');

  gameState.selectedDiceForReroll.forEach(i => {
    cp.dice[i] = rollDie();
  });

  if (gameState.selectedDiceForReroll.length > 0) {
    addLog(`🔁 ${cp.emoji} ${cp.name} relance : ${gameState.selectedDiceForReroll.map(i => cp.dice[i]).join(' | ')}`);
  } else {
    addLog(`✋ ${cp.emoji} ${cp.name} conserve ses dés.`);
  }

  // Keep one die in reserve for next players
  cp.reserveDie = cp.dice.filter(d => d > 0)[0] || null;
  cp.reserveDieUsed = false;

  gameState.phase = 'combine';
  buildOfferedDice();
  renderAll();
}

function skipReroll() {
  if (gameState.phase !== 'reroll') return;
  gameState.selectedDiceForReroll = [];
  confirmReroll();
}

function buildOfferedDice() {
  const threat = gameState.activeThreat;
  if (threat && (threat.effect === 'no_offer' || threat.effect === 'catastrophe')) {
    gameState.offeredDice = [];
    return;
  }

  gameState.offeredDice = [];
  gameState.players.forEach((p, i) => {
    if (i !== gameState.currentPlayerIndex && p.reserveDie !== null && !p.reserveDieUsed) {
      gameState.offeredDice.push({ playerIndex: i, value: p.reserveDie });
    }
  });
}

function toggleOfferedDie(offerIndex) {
  if (gameState.phase !== 'combine') return;
  const idx = gameState.selectedOfferedDice.indexOf(offerIndex);
  if (idx === -1) {
    // Max 2 offered dice
    if (gameState.selectedOfferedDice.length >= 2) return;
    gameState.selectedOfferedDice.push(offerIndex);
  } else {
    gameState.selectedOfferedDice.splice(idx, 1);
  }
  renderAll();
}

function useShield(shieldIndex) {
  if (gameState.gameOver) return;
  if (gameState.usedShieldThisTurn) {
    addLog('⚠️ Vous avez déjà utilisé un Bouclier ce tour.');
    return;
  }
  const shield = gameState.shieldCards[shieldIndex];
  if (!shield) return;

  if (shield.effect === 'cancel_crisis') {
    decreaseCrisis(1);
    addLog(`🛡 Bouclier utilisé : ${shield.name} — Crise -1.`);
    gameState.shieldCards.splice(shieldIndex, 1);
    gameState.usedShieldThisTurn = true;
  } else if (shield.effect === 'extra_reroll') {
    if (gameState.phase === 'combine') {
      // Allow one extra die reroll
      addLog(`🎲 Bouclier : ${shield.name} — Vous pouvez relancer un dé supplémentaire.`);
      gameState.phase = 'reroll';
      gameState.shieldCards.splice(shieldIndex, 1);
      gameState.usedShieldThisTurn = true;
      renderAll();
      return;
    } else {
      addLog('⚠️ Ce bouclier ne peut être utilisé que pendant la phase de combinaison.');
      return;
    }
  } else if (shield.effect === 'copy_die') {
    // Copy a die from another player's reserve
    const available = gameState.players.filter((p, i) => i !== gameState.currentPlayerIndex && p.reserveDie !== null);
    if (available.length === 0) {
      addLog('⚠️ Aucun dé en réserve à copier.');
      return;
    }
    const cp = currentPlayer();
    const target = available[0];
    // Add copied die to current player's dice (replace last die)
    cp.dice[2] = target.reserveDie;
    addLog(`🔮 Bouclier : ${shield.name} — Dé ${target.reserveDie} copié de ${target.name}.`);
    gameState.shieldCards.splice(shieldIndex, 1);
    gameState.usedShieldThisTurn = true;
  } else if (shield.effect === 'block_cata') {
    addLog(`⛨ Bouclier conservé pour bloquer une Catastrophe : ${shield.name}.`);
    return; // Keep it for auto-use
  }

  renderAll();
}

function getCombinedDiceValues() {
  const cp = currentPlayer();
  const myDice = cp.dice.filter(d => d > 0);
  const offeredValues = gameState.selectedOfferedDice.map(i => gameState.offeredDice[i].value);
  return [...myDice, ...offeredValues];
}

function resolveCombination() {
  if (gameState.phase !== 'combine') return;

  const allValues = getCombinedDiceValues();
  const combo = detectCombination(allValues);
  const cp = currentPlayer();

  // Mark offered dice as used
  gameState.selectedOfferedDice.forEach(i => {
    const offer = gameState.offeredDice[i];
    gameState.players[offer.playerIndex].reserveDieUsed = true;
    gameState.players[offer.playerIndex].reserveDie = null;
  });

  if (!combo) {
    addLog(`😔 ${cp.emoji} ${cp.name} n'a formé aucune combinaison → Crise +1`);
    increaseCrisis(1);
  } else {
    addLog(`✅ ${cp.emoji} ${cp.name} : ${combinationLabel(combo)} [${allValues.join(', ')}]`);
    applyCombination(combo);
  }

  if (gameState.gameOver) return;
  nextTurn();
}

function applyNoCombo() {
  if (gameState.phase !== 'combine') return;
  const cp = currentPlayer();
  addLog(`❌ ${cp.emoji} ${cp.name} passe sans combinaison → Crise +1`);
  increaseCrisis(1);
  if (gameState.gameOver) return;
  nextTurn();
}

function applyThreatNeutralization() {
  if (gameState.activeThreat) {
    addLog(`✨ Menace neutralisée : ${gameState.activeThreat.icon} ${gameState.activeThreat.name}`);
    gameState.discardedThreats.push(gameState.activeThreat);
    gameState.neutralizedThreats++;
    gameState.activeThreat = null;
  }
}

function applyDiscardThreat() {
  if (gameState.activeThreat) {
    gameState.discardedThreats.push(gameState.activeThreat);
    gameState.activeThreat = null;
  }
}

function applyShieldDraw() {
  if (gameState.shieldDeck.length > 0) {
    const card = gameState.shieldDeck.shift();
    gameState.shieldCards.push(card);
    addLog(`🛡 Carte Bouclier gagnée : ${card.icon} ${card.name}`);
  } else {
    addLog(`📭 Plus de cartes Bouclier disponibles.`);
  }
}

function applyNoCombination() {
  // nothing extra
}

function applyPair() {
  decreaseCrisis(1);
  addLog('📉 PAIRE : Jauge de crise -1');
  applyDiscardThreat();
}

function applySuite() {
  addLog('🎯 SUITE : Menace neutralisée');
  applyThreatNeutralization();
}

function applyFull() {
  decreaseCrisis(3);
  addLog('💥 FULL : Jauge de crise -3 + Carte Bouclier');
  applyThreatNeutralization();
  applyShieldDraw();
}

function applyBrelan() {
  decreaseCrisis(2);
  addLog('🔥 BRELAN : Menace neutralisée + Jauge -2');
  applyThreatNeutralization();
}

function applyNoneCombo() {
  increaseCrisis(1);
  applyDiscardThreat();
}

function applyFull_no_neut() {
  decreaseCrisis(3);
  applyShieldDraw();
  applyDiscardThreat();
}

function applyBrelan_no_neut() {
  decreaseCrisis(2);
  applyDiscardThreat();
}

function applyCombination(combo) {
  switch(combo) {
    case 'pair':   applyPair();   break;
    case 'suite':  applySuite();  break;
    case 'full':   applyFull();   break;
    case 'brelan': applyBrelan(); break;
  }
  // If threat not neutralized, discard it
  if (gameState.activeThreat) {
    gameState.discardedThreats.push(gameState.activeThreat);
    gameState.activeThreat = null;
  }
}

function nextTurn() {
  if (gameState.gameOver) return;

  // Check win
  if (gameState.threatDeck.length === 0 && !gameState.activeThreat) {
    checkWin();
    if (gameState.gameOver) return;
  }

  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.numPlayers;
  gameState.phase = 'threat';
  gameState.rollCount = 0;
  gameState.selectedDiceForReroll = [];
  gameState.selectedCombination = null;
  gameState.offeredDice = [];
  gameState.selectedOfferedDice = [];
  gameState.usedShieldThisTurn = false;
  const next = currentPlayer();
  addLog(`➡️ Tour de ${next.emoji} ${next.name}`);
  renderAll();
  setTimeout(() => revealThreat(), 400);
}

// Bug 3 : renderGame est attendue par render() — alias vers renderAll() défini dans index.html
function renderGame() { renderAll(); }
function render()     { renderAll(); }