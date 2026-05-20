// ============================================================
// ÎLE MAUDITE — game.js
// ============================================================

const GRID_SIZE = 7;
const MAX_TURNS = 20;
const MAX_INVENTORY = 8;
const WIN_FOOD = 3, WIN_WOOD = 3, WIN_METAL = 3;

const TERRAIN_TYPES = {
  BEACH:  { label: 'Plage',   emoji: '🏖️',  color: '#f5deb3', resource: null },
  FOREST: { label: 'Forêt',   emoji: '🌲',  color: '#228b22', resource: 'wood' },
  PLAIN:  { label: 'Plaine',  emoji: '🌾',  color: '#9acd32', resource: 'food' },
  RUIN:   { label: 'Ruine',   emoji: '🏚️',  color: '#8b7355', resource: 'metal' },
  SWAMP:  { label: 'Marais',  emoji: '🌿',  color: '#556b2f', resource: null, trap: true },
  VOLCANO:{ label: 'Volcan',  emoji: '🌋',  color: '#8b0000', resource: null, blocked: true },
};

const CLASSES = {
  HUNTER:   { name: 'Chasseur',   emoji: '🏹', maxHp: 8,  color: '#e74c3c', abilityName: 'Piéger',              abilityDesc: 'Posez un piège sur une case adjacente. La prochaine Attaque de Bête sur cette case est annulée.' },
  HEALER:   { name: 'Soigneur',   emoji: '💊', maxHp: 10, color: '#3498db', abilityName: 'Herbes médicinales',  abilityDesc: 'Soignez 3 PV à un joueur sur la même case sans dépenser de Nourriture.' },
  ENGINEER: { name: 'Ingénieur',  emoji: '⚙️', maxHp: 7,  color: '#2ecc71', abilityName: 'Optimisation',       abilityDesc: 'La prochaine construction nécessite 1 ressource de moins dans une catégorie au choix (une fois par partie).' },
  SCOUT:    { name: 'Éclaireur',  emoji: '🔭', maxHp: 7,  color: '#f39c12', abilityName: 'Exploration rapide', abilityDesc: 'Révélez 2 tuiles adjacentes sans vous déplacer sur la seconde.' },
};

const EVENT_DECK_COMPOSITION = [
  ...Array(12).fill('STORM'),
  ...Array(12).fill('BEAST'),
  ...Array(10).fill('CURSE'),
  ...Array(6).fill('CALM'),
];

const EVENT_INFO = {
  STORM: { name: 'Tempête',         emoji: '⛈️',  desc: '2 cases adjacentes sont bloquées pendant 1 tour.' },
  BEAST: { name: 'Attaque de Bête', emoji: '🐗',  desc: 'Les joueurs en Forêt perdent 2 PV.' },
  CURSE: { name: 'Malédiction',     emoji: '💀',  desc: "1 ressource est retirée de l'inventaire." },
  CALM:  { name: 'Accalmie',        emoji: '🌤️',  desc: 'Aucun effet négatif. Cases bloquées libérées.' },
};

const TILE_ASSETS = {
  BEACH:   'assets/tile_plage.svg',
  FOREST:  'assets/tile_foret.svg',
  PLAIN:   'assets/tile_plaine.svg',
  RUIN:    'assets/tile_ruine.svg',
  SWAMP:   'assets/tile_marais.svg',
  VOLCANO: 'assets/tile_volcan.svg',
};
const TILE_BACK = 'assets/tile_back.svg';

const EVENT_CARD_ASSETS = {
  STORM: 'assets/card_tempete.svg',
  BEAST: 'assets/card_attaque_bete.svg',
  CURSE: 'assets/card_malediction.svg',
  CALM:  'assets/card_accalmie.svg',
};

let gameState = {};

// ============================================================
// HELPERS
// ============================================================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function idx(r, c) { return r * GRID_SIZE + c; }
function pos(i) { return { r: Math.floor(i / GRID_SIZE), c: i % GRID_SIZE }; }

function adjacent(r, c) {
  return [
    { r: r - 1, c },
    { r: r + 1, c },
    { r, c: c - 1 },
    { r, c: c + 1 },
  ].filter(p => p.r >= 0 && p.r < GRID_SIZE && p.c >= 0 && p.c < GRID_SIZE);
}

function totalInventory() {
  const inv = gameState.inventory;
  return inv.food + inv.wood + inv.metal;
}

function classInfo(cls) { return CLASSES[cls]; }

// ============================================================
// INITIALISATION
// ============================================================
function buildGrid() {
  const beachIdx   = idx(6, 3);
  const volcanoIdx = idx(0, 6);

  const terrainPool = [
    ...Array(12).fill('FOREST'),
    ...Array(10).fill('PLAIN'),
    ...Array(8).fill('RUIN'),
    ...Array(4).fill('SWAMP'),
    ...Array(13).fill('PLAIN'),
  ];
  const shuffled = shuffle(terrainPool);

  const grid = [];
  let poolIdx = 0;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    if (i === beachIdx) {
      grid.push({ type: 'BEACH', revealed: true, hasResource: false, blocked: false, trap: false });
    } else if (i === volcanoIdx) {
      grid.push({ type: 'VOLCANO', revealed: true, hasResource: false, blocked: true, trap: false });
    } else {
      const type = shuffled[poolIdx++];
      const hasResource = (type === 'FOREST' || type === 'PLAIN' || type === 'RUIN');
      grid.push({ type, revealed: false, hasResource, blocked: false, trap: false });
    }
  }
  return grid;
}

function buildPlayers(count) {
  const classKeys = Object.keys(CLASSES);
  const beachIdx = idx(6, 3);
  const colors = ['red', 'blue', 'green', 'yellow'];
  return Array.from({ length: count }, (_, i) => {
    const cls = classKeys[i % classKeys.length];
    const info = classInfo(cls);
    return {
      id: i,
      name: info.name,
      class: cls,
      color: colors[i],
      hp: info.maxHp,
      maxHp: info.maxHp,
      pos: beachIdx,
      abilityUsedThisTurn: false,
      engineerBonusUsed: false,
      trapPlaced: false,
    };
  });
}

function initGame(playerCount) {
  playerCount = playerCount || 2;
  gameState = {
    grid: buildGrid(),
    players: buildPlayers(playerCount),
    currentPlayerIdx: 0,
    turn: 1,
    inventory: { food: 0, wood: 0, metal: 0 },
    eventDeck: shuffle([...EVENT_DECK_COMPOSITION]),
    lastEvent: null,
    phase: 'MOVE',
    message: '',
    blockedCells: [],
    trapCells: [],
    gameOver: false,
    victory: false,
    engineerDiscount: null,
    scoutRevealing: false,
    pendingScoutReveal: 0,
    log: [],
    actionDone: false,
    moveDone: false,
    healTarget: null,
    abilityMode: null,
  };
  addLog("🏝️ Bienvenue sur l'Île Maudite ! Coopérez pour survivre et construire le radeau.", 'info');
  render();
}

// ============================================================
// LOGGING
// ============================================================
function addLog(msg, type = 'normal') {
  gameState.log.unshift({ msg, type, turn: gameState.turn });
  if (gameState.log.length > 30) gameState.log.pop();
}

// ============================================================
// GAME LOGIC
// ============================================================
function currentPlayer() {
  return gameState.players[gameState.currentPlayerIdx];
}

function revealCell(cellIdx) {
  const cell = gameState.grid[cellIdx];
  if (cell.revealed) return;
  cell.revealed = true;
  const info = TERRAIN_TYPES[cell.type];
  addLog(`🗺️ Case révélée : ${info.emoji} ${info.label}`, 'explore');
}

function applyTrapEffect(player) {
  addLog(`⚠️ ${player.name} est tombé dans un Marais ! -1 PV`, 'danger');
  player.hp = Math.max(0, player.hp - 1);
  checkDeath(player);
}

function checkDeath(player) {
  if (player.hp <= 0 && !gameState.gameOver) {
    gameState.gameOver = true;
    gameState.victory = false;
    addLog(`💀 ${player.name} est mort ! DÉFAITE collective.`, 'danger');
    render();
  }
}

function checkVictory() {
  if (gameState.gameOver) return false;
  const inv = gameState.inventory;
  const beach = idx(6, 3);
  const allOnBeach = gameState.players.every(p => p.pos === beach);
  const enough = inv.food >= WIN_FOOD && inv.wood >= WIN_WOOD && inv.metal >= WIN_METAL;
  return allOnBeach && enough;
}

function movePlayer(player, targetIdx) {
  if (gameState.gameOver || gameState.moveDone) return false;
  const from = pos(player.pos);
  const to = pos(targetIdx);
  const dr = Math.abs(from.r - to.r);
  const dc = Math.abs(from.c - to.c);
  if (dr + dc !== 1) {
    addLog('❌ Déplacement invalide : case non adjacente.', 'warn');
    return false;
  }

  const cell = gameState.grid[targetIdx];

  if (cell.blocked || cell.type === 'VOLCANO') {
    addLog('❌ Cette case est bloquée ou interdite !', 'warn');
    return false;
  }

  const evBlocked = gameState.blockedCells.find(b => b.idx === targetIdx && b.turnsLeft > 0);
  if (evBlocked) {
    addLog('❌ Cette case est bloquée par la Tempête !', 'warn');
    return false;
  }

  player.pos = targetIdx;
  if (!cell.revealed) revealCell(targetIdx);

  if (cell.type === 'SWAMP') {
    applyTrapEffect(player);
    if (gameState.gameOver) return true;
  }

  addLog(`🚶 ${player.name} se déplace vers (${to.r},${to.c}) ${TERRAIN_TYPES[cell.type].emoji}`, 'normal');
  gameState.moveDone = true;
  gameState.phase = 'ACTION';
  render();
  return true;
}

function actionCollect(player) {
  if (gameState.actionDone) { addLog('❌ Action déjà effectuée ce tour.', 'warn'); return; }
  const cell = gameState.grid[player.pos];
  if (!cell.hasResource) { addLog('❌ Pas de ressource sur cette case.', 'warn'); return; }
  if (totalInventory() >= MAX_INVENTORY) { addLog('❌ Inventaire plein (8/8) !', 'warn'); return; }
  const rtype = TERRAIN_TYPES[cell.type].resource;
  if (!rtype) { addLog("❌ Cette case n'a pas de ressource collectible.", 'warn'); return; }

  gameState.inventory[rtype]++;
  cell.hasResource = false;
  const labels = { food: '🍖 Nourriture', wood: '🪵 Bois', metal: '⚙️ Métal' };
  addLog(`✅ ${player.name} collecte 1 ${labels[rtype]}. Inventaire: N${gameState.inventory.food} B${gameState.inventory.wood} M${gameState.inventory.metal}`, 'success');
  gameState.actionDone = true;
  advanceToEvent();
}

function actionHeal(player, targetPlayerId) {
  if (gameState.actionDone) { addLog('❌ Action déjà effectuée ce tour.', 'warn'); return; }
  if (gameState.inventory.food < 1) { addLog("❌ Pas de Nourriture dans l'inventaire !", 'warn'); return; }
  const target = gameState.players.find(p => p.id === targetPlayerId);
  if (!target) { addLog('❌ Joueur introuvable.', 'warn'); return; }
  if (target.pos !== player.pos) { addLog('❌ Le joueur doit être sur la même case.', 'warn'); return; }
  if (target.hp >= target.maxHp) { addLog('❌ Le joueur est déjà à plein PV.', 'warn'); return; }

  gameState.inventory.food--;
  const healed = Math.min(2, target.maxHp - target.hp);
  target.hp += healed;
  addLog(`💊 ${player.name} soigne ${target.name} (+${healed} PV). PV: ${target.hp}/${target.maxHp}`, 'success');
  gameState.actionDone = true;
  advanceToEvent();
}

function actionBuild(player) {
  if (gameState.actionDone) { addLog('❌ Action déjà effectuée ce tour.', 'warn'); return; }
  const beach = idx(6, 3);
  if (!gameState.players.every(p => p.pos === beach)) {
    addLog('❌ Tous les joueurs doivent être sur la Plage pour construire !', 'warn');
    return;
  }
  const inv = gameState.inventory;
  let needFood = WIN_FOOD, needWood = WIN_WOOD, needMetal = WIN_METAL;
  if (gameState.engineerDiscount) {
    if (gameState.engineerDiscount === 'food')  needFood  = Math.max(0, needFood  - 1);
    if (gameState.engineerDiscount === 'wood')  needWood  = Math.max(0, needWood  - 1);
    if (gameState.engineerDiscount === 'metal') needMetal = Math.max(0, needMetal - 1);
  }

  if (inv.food < needFood || inv.wood < needWood || inv.metal < needMetal) {
    addLog(`❌ Ressources insuffisantes ! Besoin: N${needFood} B${needWood} M${needMetal}`, 'warn');
    return;
  }

  gameState.gameOver = true;
  gameState.victory = true;
  addLog("🎉 VICTOIRE ! Le radeau est construit ! Vous quittez l'Île Maudite !", 'success');
  gameState.actionDone = true;
  render();
}

// ============================================================
// SPECIAL ABILITIES
// ============================================================
function activateAbility(player) {
  if (gameState.actionDone) { addLog('❌ Action déjà effectuée ce tour.', 'warn'); return; }
  if (player.abilityUsedThisTurn) { addLog('❌ Capacité déjà utilisée ce tour.', 'warn'); return; }

  switch (player.class) {
    case 'HUNTER':
      gameState.abilityMode = 'HUNTER_TRAP';
      addLog('🏹 Chasseur : Cliquez sur une case adjacente pour poser un piège.', 'info');
      render();
      break;
    case 'HEALER':
      gameState.abilityMode = 'HEALER_HEAL';
      addLog('💊 Soigneur : Cliquez sur un explorateur dans la liste pour soigner 3 PV.', 'info');
      render();
      break;
    case 'ENGINEER':
      if (player.engineerBonusUsed) {
        addLog('❌ Optimisation déjà utilisée cette partie.', 'warn');
        return;
      }
      gameState.abilityMode = 'ENGINEER_PICK';
      addLog('⚙️ Ingénieur : Choisissez la ressource à réduire (dans le panneau).', 'info');
      render();
      break;
    case 'SCOUT':
      gameState.abilityMode = 'SCOUT_REVEAL';
      addLog("🔭 Éclaireur : Cliquez sur une case adjacente pour révéler sans s'y déplacer.", 'info');
      render();
      break;
  }
}

function hunterTrap(cellIdx) {
  const player = currentPlayer();
  const adj = adjacent(pos(player.pos).r, pos(player.pos).c).map(p => idx(p.r, p.c));
  if (!adj.includes(cellIdx)) { addLog('❌ Case non adjacente.', 'warn'); return; }
  const cell = gameState.grid[cellIdx];
  if (cell.type === 'VOLCANO') { addLog('❌ Impossible sur le Volcan.', 'warn'); return; }

  if (!gameState.trapCells.find(t => t.idx === cellIdx)) {
    gameState.trapCells.push({ idx: cellIdx });
  }
  player.abilityUsedThisTurn = true;
  addLog(`🏹 Piège posé sur la case (${pos(cellIdx).r},${pos(cellIdx).c}).`, 'success');
  gameState.abilityMode = null;
  gameState.actionDone = true;
  advanceToEvent();
}

function healerHeal(targetPlayerId) {
  const player = currentPlayer();
  const target = gameState.players.find(p => p.id === targetPlayerId);
  if (!target || target.pos !== player.pos) { addLog('❌ Joueur invalide ou pas sur la même case.', 'warn'); return; }
  if (target.hp >= target.maxHp) { addLog('❌ PV déjà maximum.', 'warn'); return; }

  const healed = Math.min(3, target.maxHp - target.hp);
  target.hp += healed;
  player.abilityUsedThisTurn = true;
  addLog(`💊 Herbes médicinales : ${target.name} gagne ${healed} PV (${target.hp}/${target.maxHp}).`, 'success');
  gameState.abilityMode = null;
  gameState.actionDone = true;
  advanceToEvent();
}

function engineerPick(resource) {
  const player = currentPlayer();
  if (player.engineerBonusUsed) { addLog('❌ Déjà utilisé.', 'warn'); return; }
  gameState.engineerDiscount = resource;
  player.engineerBonusUsed = true;
  player.abilityUsedThisTurn = true;
  const labels = { food: 'Nourriture', wood: 'Bois', metal: 'Métal' };
  addLog(`⚙️ Optimisation : 1 ${labels[resource]} de moins pour la construction.`, 'success');
  gameState.abilityMode = null;
  gameState.actionDone = true;
  advanceToEvent();
}

function scoutReveal(cellIdx) {
  const player = currentPlayer();
  const adj = adjacent(pos(player.pos).r, pos(player.pos).c).map(p => idx(p.r, p.c));
  if (!adj.includes(cellIdx)) { addLog('❌ Case non adjacente.', 'warn'); return; }
  if (gameState.grid[cellIdx].revealed) { addLog('❌ Case déjà révélée.', 'warn'); return; }

  revealCell(cellIdx);
  player.abilityUsedThisTurn = true;
  addLog('🔭 Éclaireur : Case adjacente révélée sans déplacement.', 'success');
  gameState.abilityMode = null;
  gameState.actionDone = true;
  advanceToEvent();
}

// ============================================================
// EVENTS
// ============================================================
function advanceToEvent() {
  gameState.phase = 'EVENT';
  render();
}

function drawEvent() {
  if (gameState.eventDeck.length === 0) {
    gameState.eventDeck = shuffle([...EVENT_DECK_COMPOSITION]);
    addLog('♻️ Paquet Événement mélangé à nouveau.', 'info');
  }
  const evt = gameState.eventDeck.pop();
  gameState.lastEvent = evt;
  applyEvent(evt);
  endTurn();
}

function applyEvent(evt) {
  const info = EVENT_INFO[evt];
  addLog(`📋 Événement : ${info.emoji} ${info.name} — ${info.desc}`, 'event');

  switch (evt) {
    case 'STORM': {
      gameState.blockedCells = gameState.blockedCells.filter(b => b.turnsLeft > 0);
      const player = currentPlayer();
      const adjCells = adjacent(pos(player.pos).r, pos(player.pos).c)
        .map(p => idx(p.r, p.c))
        .filter(i => gameState.grid[i].type !== 'VOLCANO' && gameState.grid[i].type !== 'BEACH');
      const shuffledAdj = shuffle(adjCells).slice(0, Math.min(2, adjCells.length));
      shuffledAdj.forEach(i => {
        if (!gameState.blockedCells.find(b => b.idx === i)) {
          gameState.blockedCells.push({ idx: i, turnsLeft: 1 });
          addLog(`⛈️ Case (${pos(i).r},${pos(i).c}) bloquée 1 tour.`, 'danger');
        }
      });
      break;
    }
    case 'BEAST': {
      gameState.players.forEach(p => {
        const cell = gameState.grid[p.pos];
        if (cell.type === 'FOREST') {
          const trapped = gameState.trapCells.find(t => t.idx === p.pos);
          if (trapped) {
            gameState.trapCells = gameState.trapCells.filter(t => t.idx !== p.pos);
            addLog(`🏹 Piège du Chasseur ! Attaque annulée sur (${pos(p.pos).r},${pos(p.pos).c}).`, 'success');
            return;
          }
          p.hp = Math.max(0, p.hp - 2);
          addLog(`🐗 ${p.name} attaqué en Forêt ! -2 PV (${p.hp}/${p.maxHp})`, 'danger');
          checkDeath(p);
        }
      });
      break;
    }
    case 'CURSE': {
      const inv = gameState.inventory;
      const total = totalInventory();
      if (total === 0) {
        addLog('💀 Malédiction : inventaire vide, aucun effet.', 'warn');
      } else {
        const available = [];
        if (inv.food > 0) available.push('food');
        if (inv.wood > 0) available.push('wood');
        if (inv.metal > 0) available.push('metal');
        const pick = available[Math.floor(Math.random() * available.length)];
        inv[pick]--;
        const labels = { food: '🍖 Nourriture', wood: '🪵 Bois', metal: '⚙️ Métal' };
        addLog(`💀 Malédiction : 1 ${labels[pick]} perdue.`, 'danger');
      }
      break;
    }
    case 'CALM': {
      gameState.blockedCells = [];
      addLog('🌤️ Accalmie : toutes les cases bloquées sont libérées.', 'success');
      break;
    }
  }
}

function endTurn() {
  if (gameState.gameOver) { render(); return; }

  gameState.blockedCells = gameState.blockedCells
    .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter(b => b.turnsLeft > 0);

  gameState.turn++;
  if (gameState.turn > MAX_TURNS) {
    gameState.gameOver = true;
    gameState.victory = false;
    addLog('⏰ Tour 20 atteint ! DÉFAITE collective.', 'danger');
    render();
    return;
  }

  gameState.currentPlayerIdx = (gameState.currentPlayerIdx + 1) % gameState.players.length;
  currentPlayer().abilityUsedThisTurn = false;
  gameState.moveDone = false;
  gameState.actionDone = false;
  gameState.phase = 'MOVE';
  gameState.abilityMode = null;
  gameState.lastEvent = null;

  addLog(`--- Tour ${gameState.turn} — ${currentPlayer().name} joue ---`, 'turn');
  render();
}

// ============================================================
// RENDER — dispatcher
// ============================================================
function render() {
  renderBoard();
  renderInfoPanel();
  renderGameOver();
}

// ============================================================
// renderBoard — grille 7×7 avec brouillard, terrains, pions
// ============================================================
function renderBoard() {
  const board = document.getElementById('game-board');
  board.innerHTML = '';

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const i = idx(r, c);
      const cell = gameState.grid[i];
      const terrain = TERRAIN_TYPES[cell.type];
      const div = document.createElement('div');
      div.className = 'grid-cell';
      div.dataset.idx = i;

      const isBlocked = gameState.blockedCells.find(b => b.idx === i);
      const hasTrap   = gameState.trapCells.find(t => t.idx === i);
      const playersHere = gameState.players.filter(p => p.pos === i);

      if (!cell.revealed) {
        div.classList.add('fog');
        const fogImg = document.createElement('img');
        fogImg.src = TILE_BACK;
        fogImg.className = 'tile-img';
        fogImg.alt = '?';
        div.appendChild(fogImg);
      } else {
        div.style.background = terrain.color;
        div.classList.add('revealed');
        if (cell.type === 'VOLCANO') div.classList.add('volcano');
        if (isBlocked) div.classList.add('storm-blocked');

        const terrainEl = document.createElement('div');
        terrainEl.className = 'cell-terrain';
        const tileImg = document.createElement('img');
        tileImg.src = TILE_ASSETS[cell.type] || '';
        tileImg.className = 'tile-img';
        tileImg.alt = terrain.label;
        terrainEl.appendChild(tileImg);
        div.appendChild(terrainEl);

        if (cell.hasResource) {
          const resEl = document.createElement('div');
          resEl.className = 'cell-resource';
          const icons = { food: '🍖', wood: '🪵', metal: '⚙️' };
          resEl.textContent = icons[terrain.resource] || '';
          div.appendChild(resEl);
        }

        if (hasTrap) {
          const trapEl = document.createElement('div');
          trapEl.className = 'cell-trap';
          trapEl.textContent = '🪤';
          div.appendChild(trapEl);
        }

        if (isBlocked) {
          const stormEl = document.createElement('div');
          stormEl.className = 'cell-storm';
          stormEl.textContent = '🌀';
          div.appendChild(stormEl);
        }

        if (playersHere.length > 0) {
          const pawnsEl = document.createElement('div');
          pawnsEl.className = 'cell-pawns';
          playersHere.forEach(p => {
            const pawn = document.createElement('span');
            pawn.className = `pawn pawn-${p.color}`;
            pawn.textContent = classInfo(p.class).emoji;
            pawn.title = `${p.name} — ${p.hp}/${p.maxHp} PV`;
            if (p.id === gameState.currentPlayerIdx) pawn.classList.add('active-pawn');
            pawnsEl.appendChild(pawn);
          });
          div.appendChild(pawnsEl);
        }
      }

      // ---- Highlight logic ----
      const cp      = currentPlayer();
      const cpPos   = pos(cp.pos);
      const adjIdxs = adjacent(cpPos.r, cpPos.c).map(p => idx(p.r, p.c));

      if (!gameState.gameOver && !gameState.moveDone && gameState.phase === 'MOVE') {
        if (adjIdxs.includes(i) && !cell.blocked && cell.type !== 'VOLCANO') {
          const evBlk = gameState.blockedCells.find(b => b.idx === i);
          if (!evBlk) div.classList.add('move-target');
        }
      }

      if (!gameState.gameOver && gameState.abilityMode === 'HUNTER_TRAP') {
        if (adjIdxs.includes(i) && cell.type !== 'VOLCANO') {
          div.classList.add('ability-target');
        }
      }

      if (!gameState.gameOver && gameState.abilityMode === 'SCOUT_REVEAL') {
        if (adjIdxs.includes(i) && !cell.revealed) {
          div.classList.add('ability-target');
        }
      }

      div.addEventListener('click', () => handleCellClick(i));
      board.appendChild(div);
    }
  }
}

function handleCellClick(cellIdx) {
  if (gameState.gameOver) return;
  switch (gameState.abilityMode) {
    case 'HUNTER_TRAP':  hunterTrap(cellIdx);  return;
    case 'SCOUT_REVEAL': scoutReveal(cellIdx); return;
  }
  if (gameState.phase === 'MOVE' && !gameState.moveDone) {
    movePlayer(currentPlayer(), cellIdx);
  }
}

// ============================================================
// renderInfoPanel — dispatche vers les sous-renderers
// ============================================================
function renderInfoPanel() {
  renderActivePlayer();
  renderPhase();
  renderActions();
  renderInventory();
  renderAllPlayers();
  renderLastEvent();
  renderTurnBar();
  renderLog();
  renderContextMessage();
}

// ---- Joueur actif ----
function renderActivePlayer() {
  const cp   = currentPlayer();
  const info = classInfo(cp.class);

  document.getElementById('active-player-emoji').textContent = info.emoji;
  document.getElementById('active-player-name').textContent  = cp.name;
  document.getElementById('active-player-class').textContent = info.name;

  const hpPct = Math.max(0, (cp.hp / cp.maxHp) * 100);
  const hpBar = document.getElementById('active-player-hp-bar');
  hpBar.style.width = hpPct + '%';
  hpBar.className   = 'hp-bar-fill'
    + (hpPct <= 25 ? ' hp-critical' : hpPct <= 50 ? ' hp-low' : '');

  document.getElementById('active-player-hp-text').textContent = `${cp.hp} / ${cp.maxHp} PV`;
  document.getElementById('ability-name').textContent = info.abilityName;
  document.getElementById('ability-desc').textContent = info.abilityDesc;
}

// ---- Indicateur de phase ----
function renderPhase() {
  const PHASE_DATA = {
    MOVE:   { icon: '🚶', text: 'Déplacement', hint: 'Cliquez sur une case adjacente surlignée pour vous déplacer.' },
    ACTION: { icon: '⚡', text: 'Action',      hint: 'Collectez, soignez, construisez, ou utilisez votre capacité.' },
    EVENT:  { icon: '📋', text: 'Événement',   hint: 'Piochez une carte Événement pour clore le tour.' },
    END:    { icon: '✅', text: 'Fin de tour', hint: '' },
  };
  const data = PHASE_DATA[gameState.phase] || PHASE_DATA.MOVE;
  document.getElementById('phase-icon').textContent = data.icon;
  document.getElementById('phase-text').textContent = data.text;
  document.getElementById('phase-hint').textContent = data.hint;
}

// ---- Boutons d'action ----
function renderActions() {
  const cp       = currentPlayer();
  const isAction = gameState.phase === 'ACTION' && !gameState.actionDone && !gameState.gameOver;
  const isEvent  = gameState.phase === 'EVENT'  && !gameState.gameOver;

  document.getElementById('btn-collect').disabled = !isAction;
  document.getElementById('btn-heal').disabled    = !isAction;
  document.getElementById('btn-build').disabled   = !isAction;
  document.getElementById('btn-ability').disabled = !isAction || cp.abilityUsedThisTurn;

  document.getElementById('btn-draw-event').classList.toggle('hidden', !isEvent);
  document.getElementById('btn-pass').classList.toggle('hidden', !isAction);

  // Engineer pick sub-menu
  document.getElementById('engineer-pick-menu')
    .classList.toggle('hidden', gameState.abilityMode !== 'ENGINEER_PICK');
}

// ---- Inventaire commun ----
function renderInventory() {
  const inv      = gameState.inventory;
  const total    = totalInventory();
  const discount = gameState.engineerDiscount;

  const needFood  = discount === 'food'  ? Math.max(0, WIN_FOOD  - 1) : WIN_FOOD;
  const needWood  = discount === 'wood'  ? Math.max(0, WIN_WOOD  - 1) : WIN_WOOD;
  const needMetal = discount === 'metal' ? Math.max(0, WIN_METAL - 1) : WIN_METAL;

  document.getElementById('inv-food-val').textContent   = inv.food;
  document.getElementById('inv-wood-val').textContent   = inv.wood;
  document.getElementById('inv-metal-val').textContent  = inv.metal;
  document.getElementById('inv-food-needed').textContent  = `/${needFood}`;
  document.getElementById('inv-wood-needed').textContent  = `/${needWood}`;
  document.getElementById('inv-metal-needed').textContent = `/${needMetal}`;
  document.getElementById('inventory-count').textContent  = `(${total}/8)`;

  document.getElementById('inv-food').classList.toggle('inv-complete',  inv.food  >= needFood);
  document.getElementById('inv-wood').classList.toggle('inv-complete',  inv.wood  >= needWood);
  document.getElementById('inv-metal').classList.toggle('inv-complete', inv.metal >= needMetal);

  // 8 emplacements visuels
  const allRes = [
    ...Array(inv.food).fill({ icon: '🍖', cls: 'slot-food' }),
    ...Array(inv.wood).fill({ icon: '🪵', cls: 'slot-wood' }),
    ...Array(inv.metal).fill({ icon: '⚙️', cls: 'slot-metal' }),
  ];
  for (let i = 0; i < MAX_INVENTORY; i++) {
    const slot = document.getElementById(`inv-vis-${i}`);
    if (!slot) continue;
    if (allRes[i]) {
      slot.textContent = allRes[i].icon;
      slot.className   = `inv-visual-slot ${allRes[i].cls} filled`;
    } else {
      slot.textContent = '';
      slot.className   = 'inv-visual-slot empty';
    }
  }

  const badge = document.getElementById('engineer-discount-badge');
  if (discount) {
    badge.classList.remove('hidden');
    const labels = { food: '🍖 Nourriture', wood: '🪵 Bois', metal: '⚙️ Métal' };
    document.getElementById('engineer-discount-resource').textContent = labels[discount];
  } else {
    badge.classList.add('hidden');
  }
}

// ---- Liste de tous les explorateurs ----
function renderAllPlayers() {
  const container = document.getElementById('all-players-list');
  container.innerHTML = '';

  gameState.players.forEach(p => {
    const info     = classInfo(p.class);
    const isActive = p.id === gameState.currentPlayerIdx;
    const hpPct    = Math.max(0, (p.hp / p.maxHp) * 100);

    const div = document.createElement('div');
    div.className = 'player-row' + (isActive ? ' is-active' : '');
    div.dataset.playerId = p.id;
    div.innerHTML = `
      <span class="player-row-emoji">${info.emoji}</span>
      <div class="player-row-info">
        <div class="player-row-name">${p.name}${isActive ? ' ◀' : ''}</div>
        <div class="player-row-hp-bar-bg">
          <div class="player-row-hp-bar" style="width:${hpPct}%"></div>
        </div>
        <div class="player-row-hp-text">${p.hp}/${p.maxHp} PV</div>
      </div>`;

    // Capacité Soigneur : clic sur un joueur pour soigner
    if (gameState.abilityMode === 'HEALER_HEAL' && p.pos === currentPlayer().pos) {
      div.classList.add('heal-target-option');
      div.addEventListener('click', () => healerHeal(p.id));
    }

    container.appendChild(div);
  });
}

// ---- Dernier événement ----
function renderLastEvent() {
  const evt = gameState.lastEvent;
  const display = document.getElementById('last-event-display');
  let cardImg = document.getElementById('last-event-card-img');
  if (!cardImg) {
    cardImg = document.createElement('img');
    cardImg.id = 'last-event-card-img';
    cardImg.className = 'event-card-img';
    display.prepend(cardImg);
  }
  if (!evt) {
    document.getElementById('last-event-emoji').textContent = '—';
    document.getElementById('last-event-name').textContent  = 'Aucun';
    document.getElementById('last-event-desc').textContent  = '';
    cardImg.style.display = 'none';
    return;
  }
  const info = EVENT_INFO[evt];
  document.getElementById('last-event-emoji').textContent = info.emoji;
  document.getElementById('last-event-name').textContent  = info.name;
  document.getElementById('last-event-desc').textContent  = info.desc;
  if (EVENT_CARD_ASSETS[evt]) {
    cardImg.src = EVENT_CARD_ASSETS[evt];
    cardImg.alt = info.name;
    cardImg.style.display = 'block';
  } else {
    cardImg.style.display = 'none';
  }
}

// ---- Barre de progression des tours ----
function renderTurnBar() {
  document.getElementById('turn-current').textContent = gameState.turn;
  const pct = Math.min(100, ((gameState.turn - 1) / MAX_TURNS) * 100);
  const bar = document.getElementById('turn-bar');
  bar.style.width = pct + '%';
  bar.className   = 'turn-bar-fill'
    + (pct >= 75 ? ' turn-critical' : pct >= 50 ? ' turn-warning' : '');
}

// ---- Journal ----
function renderLog() {
  const list = document.getElementById('log-list');
  list.innerHTML = '';
  gameState.log.forEach(entry => {
    const div = document.createElement('div');
    div.className   = `log-entry log-${entry.type || 'normal'}`;
    div.textContent = entry.msg;
    list.appendChild(div);
  });
}

// ---- Message contextuel (mode capacité) ----
function renderContextMessage() {
  const ctxDiv = document.getElementById('context-message');
  const MODE_MSGS = {
    HUNTER_TRAP:   '🏹 Cliquez sur une case adjacente pour poser le piège.',
    SCOUT_REVEAL:  '🔭 Cliquez sur une case adjacente pour la révéler.',
    HEALER_HEAL:   '💊 Cliquez sur un explorateur dans la liste pour le soigner.',
  };
  const msg = gameState.abilityMode ? MODE_MSGS[gameState.abilityMode] : null;
  if (msg) {
    ctxDiv.classList.remove('hidden');
    document.getElementById('context-message-text').textContent = msg;
  } else {
    ctxDiv.classList.add('hidden');
  }
}

// ============================================================
// renderGameOver — écran de fin de partie
// ============================================================
function renderGameOver() {
  const screen = document.getElementById('game-over-screen');
  if (!gameState.gameOver) {
    screen.classList.add('hidden');
    return;
  }
  screen.classList.remove('hidden');

  document.getElementById('game-over-icon').textContent  = gameState.victory ? '🎉' : '💀';
  document.getElementById('game-over-title').textContent = gameState.victory ? 'VICTOIRE !' : 'DÉFAITE';

  let reason;
  if (gameState.victory) {
    reason = "Le radeau est construit ! Vous quittez l'Île Maudite !";
  } else if (gameState.turn > MAX_TURNS) {
    reason = "Vous n'avez pas réussi à vous échapper avant le tour 20.";
  } else {
    reason = "Un explorateur est mort. L'île vous a eus.";
  }
  document.getElementById('game-over-reason').textContent = reason;
  document.getElementById('stat-turns').textContent = gameState.turn;
  document.getElementById('stat-food').textContent  = gameState.inventory.food;
  document.getElementById('stat-wood').textContent  = gameState.inventory.wood;
  document.getElementById('stat-metal').textContent = gameState.inventory.metal;

  const playersDiv = document.getElementById('game-over-players');
  playersDiv.innerHTML = '';
  gameState.players.forEach(p => {
    const info = classInfo(p.class);
    const div  = document.createElement('div');
    div.className = 'game-over-player';
    div.innerHTML = `<span>${info.emoji} ${p.name}</span><span>${p.hp}/${p.maxHp} PV</span>`;
    playersDiv.appendChild(div);
  });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function showStartScreen() {
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
}

function attachListeners() {
  // Sélection du nombre de joueurs — démarre la partie immédiatement
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.dataset.count, 10);
      document.getElementById('start-screen').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      initGame(count);
    });
  });

  // Bouton commencer (fallback)
  document.getElementById('start-btn').addEventListener('click', () => {
    const active = document.querySelector('.count-btn.active');
    const count  = active ? parseInt(active.dataset.count, 10) : 2;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initGame(count);
  });

  // Nouvelle partie (header + game-over)
  document.getElementById('new-game-btn').addEventListener('click', showStartScreen);
  document.getElementById('game-over-new-btn').addEventListener('click', showStartScreen);

  // Collecter
  document.getElementById('btn-collect').addEventListener('click', () => {
    actionCollect(currentPlayer());
  });

  // Soigner (action standard : affiche le menu de cible)
  document.getElementById('btn-heal').addEventListener('click', () => {
    if (gameState.actionDone) { addLog('❌ Action déjà effectuée ce tour.', 'warn'); render(); return; }
    if (gameState.inventory.food < 1) { addLog("❌ Pas de Nourriture dans l'inventaire !", 'warn'); render(); return; }
    const cp      = currentPlayer();
    const targets = gameState.players.filter(p => p.pos === cp.pos && p.hp < p.maxHp);
    if (targets.length === 0) { addLog('❌ Aucun joueur à soigner sur cette case.', 'warn'); render(); return; }

    const list = document.getElementById('heal-target-list');
    list.innerHTML = '';
    targets.forEach(p => {
      const btn = document.createElement('button');
      btn.className   = 'heal-target-btn';
      btn.textContent = `${classInfo(p.class).emoji} ${p.name} (${p.hp}/${p.maxHp} PV)`;
      btn.addEventListener('click', () => {
        document.getElementById('heal-target-menu').classList.add('hidden');
        actionHeal(cp, p.id);
      });
      list.appendChild(btn);
    });
    document.getElementById('heal-target-menu').classList.remove('hidden');
  });

  document.getElementById('heal-cancel-btn').addEventListener('click', () => {
    document.getElementById('heal-target-menu').classList.add('hidden');
  });

  // Construire le radeau
  document.getElementById('btn-build').addEventListener('click', () => {
    actionBuild(currentPlayer());
  });

  // Capacité spéciale
  document.getElementById('btn-ability').addEventListener('click', () => {
    activateAbility(currentPlayer());
  });

  // Ingénieur — choix de la ressource à réduire
  document.querySelectorAll('.eng-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => engineerPick(btn.dataset.resource));
  });
  document.getElementById('engineer-cancel-btn').addEventListener('click', () => {
    gameState.abilityMode = null;
    render();
  });

  // Passer l'action (quand aucune action n'est disponible)
  document.getElementById('btn-pass').addEventListener('click', () => {
    if (gameState.phase === 'ACTION' && !gameState.actionDone && !gameState.gameOver) {
      addLog(`⏭️ ${currentPlayer().name} passe son action.`, 'normal');
      advanceToEvent();
    }
  });

  // Piocher un événement
  document.getElementById('btn-draw-event').addEventListener('click', () => {
    if (gameState.phase === 'EVENT') drawEvent();
  });

  // Annuler un mode capacité (message contextuel)
  document.getElementById('context-cancel-btn').addEventListener('click', () => {
    gameState.abilityMode = null;
    render();
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  attachListeners();
});
