// ============================================================
// DUEL TACTIQUE — game.js  PARTIE 1/3
// État global, constantes, helpers, initialisation, logique
// ============================================================

// ─────────────────────────────────────────────────────────────
// CONSTANTES GLOBALES
// ─────────────────────────────────────────────────────────────

const BOARD_SIZE = 8;
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;

const PLAYER = {
  ONE: 1,
  TWO: 2,
};

const PIECE_TYPE = {
  FLAG:    'flag',
  SOLDIER: 'soldier',
  KNIGHT:  'knight',
  ROOK:    'rook',
  GENERAL: 'general',
};

const PIECE_DEF = {
  [PIECE_TYPE.FLAG]:    { label: 'Drapeau',  combat: 0, movable: false, count: 1 },
  [PIECE_TYPE.SOLDIER]: { label: 'Soldat',   combat: 1, movable: true,  count: 6 },
  [PIECE_TYPE.KNIGHT]:  { label: 'Cavalier', combat: 2, movable: true,  count: 3 },
  [PIECE_TYPE.ROOK]:    { label: 'Tour',     combat: 3, movable: true,  count: 2 },
  [PIECE_TYPE.GENERAL]: { label: 'Général',  combat: 4, movable: true,  count: 1 },
};

// Déplacements maximum par type (en nombre de cases)
const MOVE_RANGE = {
  [PIECE_TYPE.FLAG]:    0,
  [PIECE_TYPE.SOLDIER]: 1,
  [PIECE_TYPE.KNIGHT]:  3, // déplacement en L
  [PIECE_TYPE.ROOK]:    3, // ligne droite
  [PIECE_TYPE.GENERAL]: 1, // toutes directions
};

const CARD_TYPE = {
  SHIELD: 'shield',
  SPRINT: 'sprint',
  TRAP:   'trap',
};

const CARD_DEF = {
  [CARD_TYPE.SHIELD]: { label: 'Bouclier', count: 10, description: '+1 défense pendant ce combat' },
  [CARD_TYPE.SPRINT]: { label: 'Sprint',   count: 10, description: '+1 case de déplacement supplémentaire' },
  [CARD_TYPE.TRAP]:   { label: 'Piège',    count: 10, description: 'Pose un piège sur la case actuelle' },
};

const TERRAIN_TYPE = {
  NORMAL: 'normal',
  FOREST: 'forest',
  SWAMP:  'swamp',
};

const TERRAIN_DEF = {
  [TERRAIN_TYPE.NORMAL]: { label: 'Normal',  defBonus: 0, movePenalty: 0 },
  [TERRAIN_TYPE.FOREST]: { label: 'Forêt',   defBonus: 1, movePenalty: 0 },
  [TERRAIN_TYPE.SWAMP]:  { label: 'Marais',  defBonus: 0, movePenalty: 1 },
};

// 4 tuiles terrain spécial : 2 forêts + 2 marais
const TERRAIN_TILES_POOL = [
  TERRAIN_TYPE.FOREST,
  TERRAIN_TYPE.FOREST,
  TERRAIN_TYPE.SWAMP,
  TERRAIN_TYPE.SWAMP,
];

const HAND_SIZE = 3;

const PHASE = {
  DRAW:   'draw',
  SELECT: 'select',
  MOVE:   'move',
  ACTION: 'action',
  END:    'end',
};

const GAME_STATUS = {
  PLAYING: 'playing',
  OVER:    'over',
};

// IDs des événements utilisés par game.js pour la communication inter-modules
const EVT = {
  STATE_CHANGED:  'stateChanged',
  TURN_CHANGED:   'turnChanged',
  COMBAT_RESOLVED:'combatResolved',
  CARD_PLAYED:    'cardPlayed',
  GAME_OVER:      'gameOver',
  LOG_ADDED:      'logAdded',
};

// ─────────────────────────────────────────────────────────────
// ÉTAT GLOBAL
// ─────────────────────────────────────────────────────────────

let gameState = {
  status:        GAME_STATUS.PLAYING,
  currentPlayer: PLAYER.ONE,
  turn:          1,
  phase:         PHASE.DRAW,
  winner:        null,
  winReason:     '',

  // Plateau : tableau de TOTAL_CELLS objets Cell
  board: [],

  // Joueurs
  players: {
    [PLAYER.ONE]: null,
    [PLAYER.TWO]: null,
  },

  // Pioche commune
  deck: [],

  // Pièges posés : { cellIdx: { owner: playerId } }
  traps: {},

  // Sélection en cours
  selected: {
    pieceId:        null,
    validMoves:     [],
    cardToPlay:     null,
    sprintActive:   false,
    shieldActive:   false,
  },

  // Historique des actions
  log: [],
};

// ─────────────────────────────────────────────────────────────
// HELPERS PURS
// ─────────────────────────────────────────────────────────────

/** Convertit (row, col) en index linéaire */
function idx(row, col) {
  return row * BOARD_SIZE + col;
}

/** Convertit un index linéaire en {row, col} */
function pos(index) {
  return {
    row: Math.floor(index / BOARD_SIZE),
    col: index % BOARD_SIZE,
  };
}

/** Vérifie qu'une position (row, col) est dans les limites du plateau */
function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** Mélange un tableau (Fisher-Yates) — pur si on passe une copie */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Génère un ID unique pour une pièce */
let _pieceIdCounter = 0;
function newPieceId() {
  return `piece_${++_pieceIdCounter}`;
}

/** Retourne la cellule à l'index donné */
function getCell(cellIdx) {
  return gameState.board[cellIdx];
}

/** Retourne la pièce dont l'id correspond, ou null */
function getPieceById(pieceId) {
  for (const pid of [PLAYER.ONE, PLAYER.TWO]) {
    const piece = gameState.players[pid].pieces.find(p => p.id === pieceId);
    if (piece) return piece;
  }
  return null;
}

/** Retourne la pièce présente sur une cellule, ou null */
function getPieceAtCell(cellIdx) {
  for (const pid of [PLAYER.ONE, PLAYER.TWO]) {
    const piece = gameState.players[pid].pieces.find(p => p.cellIdx === cellIdx && p.alive);
    if (piece) return piece;
  }
  return null;
}

/** Distance de Manhattan entre deux cellules */
function manhattan(idxA, idxB) {
  const a = pos(idxA);
  const b = pos(idxB);
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/** Cases orthogonalement adjacentes (haut, bas, gauche, droite) */
function orthogonalNeighbors(cellIdx) {
  const { row, col } = pos(cellIdx);
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  return dirs
    .filter(([dr, dc]) => inBounds(row + dr, col + dc))
    .map(([dr, dc]) => idx(row + dr, col + dc));
}

/** Toutes les cases adjacentes (8 directions) */
function allNeighbors(cellIdx) {
  const { row, col } = pos(cellIdx);
  const dirs = [
    [-1,-1],[-1,0],[-1,1],
    [ 0,-1],       [ 0,1],
    [ 1,-1],[ 1,0],[ 1,1],
  ];
  return dirs
    .filter(([dr, dc]) => inBounds(row + dr, col + dc))
    .map(([dr, dc]) => idx(row + dr, col + dc));
}

/** Construit le deck complet mélangé */
function buildDeck() {
  const cards = [];
  for (const [type, def] of Object.entries(CARD_DEF)) {
    for (let i = 0; i < def.count; i++) {
      cards.push({ type, label: def.label, description: def.description });
    }
  }
  return shuffle(cards);
}

/** Pioche n cartes depuis le deck (modifie gameState.deck) */
function drawCards(playerId, n) {
  const player = gameState.players[playerId];
  const needed = Math.min(n, HAND_SIZE - player.hand.length);
  for (let i = 0; i < needed; i++) {
    if (gameState.deck.length === 0) break;
    player.hand.push(gameState.deck.pop());
  }
}

/**
 * Calcule le nombre de cases de déplacement effectif d'une pièce
 * en tenant compte du terrain (marais) et d'un éventuel sprint.
 */
function effectiveRange(piece, sprintBonus) {
  const base = MOVE_RANGE[piece.type];
  const cell = getCell(piece.cellIdx);
  const terrain = TERRAIN_DEF[cell.terrain] || TERRAIN_DEF[TERRAIN_TYPE.NORMAL];
  const bonus = sprintBonus ? 1 : 0;
  return Math.max(0, base - terrain.movePenalty + bonus);
}

// ─────────────────────────────────────────────────────────────
// CALCUL DES MOUVEMENTS LÉGAUX
// ─────────────────────────────────────────────────────────────

/**
 * Retourne la liste des cellIdx accessibles par une pièce donnée.
 * Prend en compte le type de mouvement, la portée et les obstacles.
 * @param {object} piece
 * @param {boolean} sprintBonus
 * @returns {number[]}
 */
function computeValidMoves(piece, sprintBonus) {
  if (!piece.alive || piece.type === PIECE_TYPE.FLAG) return [];

  const range = effectiveRange(piece, sprintBonus);
  if (range === 0) return [];

  const moves = [];
  const { row, col } = pos(piece.cellIdx);
  const owner = piece.owner;

  switch (piece.type) {
    // ── Soldat : orthogonal, 1 case ──────────────────────────
    case PIECE_TYPE.SOLDIER: {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const target = idx(nr, nc);
        const occupant = getPieceAtCell(target);
        if (!occupant || occupant.owner !== owner) {
          moves.push(target);
        }
      }
      break;
    }

    // ── Cavalier : déplacement en L ──────────────────────────
    case PIECE_TYPE.KNIGHT: {
      // L classique : 2+1 ou 1+2
      const lMoves = [
        [-2,-1],[-2,1],[-1,-2],[-1,2],
        [ 2,-1],[ 2,1],[ 1,-2],[ 1,2],
      ];
      for (const [dr, dc] of lMoves) {
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const target = idx(nr, nc);
        const occupant = getPieceAtCell(target);
        if (!occupant || occupant.owner !== owner) {
          moves.push(target);
        }
      }
      break;
    }

    // ── Tour : ligne droite jusqu'à `range` cases ────────────
    case PIECE_TYPE.ROOK: {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        for (let step = 1; step <= range; step++) {
          const nr = row + dr * step;
          const nc = col + dc * step;
          if (!inBounds(nr, nc)) break;
          const target = idx(nr, nc);
          const occupant = getPieceAtCell(target);
          if (occupant) {
            if (occupant.owner !== owner) moves.push(target); // capture possible
            break; // bloqué après
          }
          moves.push(target);
        }
      }
      break;
    }

    // ── Général : 1 case dans toutes les directions ──────────
    case PIECE_TYPE.GENERAL: {
      const dirs = [
        [-1,-1],[-1,0],[-1,1],
        [ 0,-1],       [ 0,1],
        [ 1,-1],[ 1,0],[ 1,1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const target = idx(nr, nc);
        const occupant = getPieceAtCell(target);
        if (!occupant || occupant.owner !== owner) {
          moves.push(target);
        }
      }
      break;
    }

    default:
      break;
  }

  return moves;
}

// ─────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────

/**
 * Construit le tableau des cellules du plateau.
 * Pose également les 4 tuiles de terrain spécial aléatoirement
 * sur les cases centrales (zones non de départ).
 */
function buildGrid() {
  const board = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    board.push({
      index:   i,
      terrain: TERRAIN_TYPE.NORMAL,
    });
  }

  // Zones réservées aux départs : rows 0-1 (J1) et rows 6-7 (J2)
  const reservedRows = new Set([0, 1, 6, 7]);
  const candidates = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const { row } = pos(i);
    if (!reservedRows.has(row)) candidates.push(i);
  }

  const shuffledCandidates = shuffle(candidates);
  const terrainPool = TERRAIN_TILES_POOL.slice();
  for (let t = 0; t < terrainPool.length; t++) {
    board[shuffledCandidates[t]].terrain = terrainPool[t];
  }

  return board;
}

/**
 * Construit l'état initial d'un joueur (pièces + main vide).
 * @param {number} playerId
 * @returns {object}
 */
function buildPlayerState(playerId) {
  const pieces = [];

  // Placement :
  // Joueur 1 occupe les rows 0 (row 0 = haut) et row 1
  // Joueur 2 occupe les rows 7 (bas) et row 6
  // Row de base (drapeau + arrière-garde) et row avancée (troupes)

  let backRow, frontRow, flagCol;
  if (playerId === PLAYER.ONE) {
    backRow  = 0;
    frontRow = 1;
    flagCol  = 3; // colonne centrale-gauche
  } else {
    backRow  = 7;
    frontRow = 6;
    flagCol  = 4; // colonne centrale-droite
  }

  // ── Drapeau ─────────────────────────────────────────────
  pieces.push({
    id:      newPieceId(),
    owner:   playerId,
    type:    PIECE_TYPE.FLAG,
    cellIdx: idx(backRow, flagCol),
    alive:   true,
  });

  // ── Général (1) — centre de la ligne arrière ─────────────
  const generalCol = playerId === PLAYER.ONE ? 4 : 3;
  pieces.push({
    id:      newPieceId(),
    owner:   playerId,
    type:    PIECE_TYPE.GENERAL,
    cellIdx: idx(backRow, generalCol),
    alive:   true,
  });

  // ── Tours (2) — aux extrémités de la ligne arrière ───────
  const rookCols = [0, 7];
  for (const c of rookCols) {
    pieces.push({
      id:      newPieceId(),
      owner:   playerId,
      type:    PIECE_TYPE.ROOK,
      cellIdx: idx(backRow, c),
      alive:   true,
    });
  }

  // ── Cavaliers (3) — ligne arrière colonnes 1,2,5 ou 2,5,6 ─
  const knightCols = playerId === PLAYER.ONE ? [1, 2, 5] : [2, 5, 6];
  for (const c of knightCols) {
    pieces.push({
      id:      newPieceId(),
      owner:   playerId,
      type:    PIECE_TYPE.KNIGHT,
      cellIdx: idx(backRow, c),
      alive:   true,
    });
  }

  // ── Soldats (6) — ligne avant ────────────────────────────
  const soldierCols = [1, 2, 3, 4, 5, 6];
  for (const c of soldierCols) {
    pieces.push({
      id:      newPieceId(),
      owner:   playerId,
      type:    PIECE_TYPE.SOLDIER,
      cellIdx: idx(frontRow, c),
      alive:   true,
    });
  }

  return {
    id:    playerId,
    label: playerId === PLAYER.ONE ? 'Joueur 1' : 'Joueur 2',
    pieces,
    hand:          [],
    capturedCount: 0,
  };
}

/**
 * Point d'entrée principal : réinitialise gameState et démarre une partie.
 */
function initGame() {
  // Reset du compteur de pièces pour des IDs propres
  _pieceIdCounter = 0;

  const board   = buildGrid();
  const player1 = buildPlayerState(PLAYER.ONE);
  const player2 = buildPlayerState(PLAYER.TWO);
  const deck    = buildDeck();

  gameState = {
    status:        GAME_STATUS.PLAYING,
    gameOver:      false,
    currentPlayer: PLAYER.ONE,
    turn:          1,
    turnCount:     1,
    phase:         PHASE.SELECT,
    winner:        null,
    winReason:     '',

    board,

    players: {
      [PLAYER.ONE]: player1,
      [PLAYER.TWO]: player2,
    },

    // Tableau plat de toutes les pièces (mêmes références que players[x].pieces)
    pieces: [...player1.pieces, ...player2.pieces],

    deck,
    discardPile:   [],

    traps:   {},
    terrain: {},

    selected: {
      pieceId:      null,
      cellIdx:      null,
      validMoves:   [],
      cardToPlay:   null,
      sprintActive: false,
      shieldActive: false,
      placingTrap:  false,
    },

    log: [],
  };

  // Distribution initiale des cartes (3 par joueur)
  drawCards(PLAYER.ONE, HAND_SIZE);
  drawCards(PLAYER.TWO, HAND_SIZE);

  addLog('system', 'Nouvelle partie démarrée — Joueur 1 commence.');
}

// ─────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────

/**
 * Ajoute une entrée dans le journal des actions.
 * @param {'p1'|'p2'|'system'|'combat'} category
 * @param {string} message
 */
function addLog(category, message) {
  gameState.log.unshift({
    id:        Date.now() + Math.random(),
    category,
    message,
    turn:      gameState.turn,
    timestamp: new Date().toLocaleTimeString(),
  });
  // On limite le journal à 50 entrées
  if (gameState.log.length > 50) {
    gameState.log.length = 50;
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIQUE DE JEU (manipulation de gameState uniquement)
// ─────────────────────────────────────────────────────────────

/**
 * Résoudre un combat entre deux pièces.
 * Retourne un objet décrivant le résultat.
 */
function resolveCombat(attacker, defender) {
  const atkCell = getCell(attacker.cellIdx);
  const defCell = getCell(defender.cellIdx);

  const atkTerrain = TERRAIN_DEF[atkCell.terrain] || TERRAIN_DEF[TERRAIN_TYPE.NORMAL];
  const defTerrain = TERRAIN_DEF[defCell.terrain] || TERRAIN_DEF[TERRAIN_TYPE.NORMAL];

  // Valeurs de base
  let atkVal = PIECE_DEF[attacker.type].combat;
  let defVal = PIECE_DEF[defender.type].combat;

  // Bonus terrain pour le défenseur
  defVal += defTerrain.defBonus;

  // Bonus bouclier si actif pour ce tour (stocké dans selected)
  if (gameState.selected.shieldActive && defender.owner === gameState.currentPlayer) {
    defVal += 1;
  }

  let result;
  if (atkVal > defVal) {
    result = 'attacker_wins';
  } else if (defVal > atkVal) {
    result = 'defender_wins';
  } else {
    result = 'draw';
  }

  return { attacker, defender, atkVal, defVal, result };
}

/**
 * Vérifie et applique la mort d'une pièce :
 * la retire visuellement du plateau (cellIdx = -1, alive = false).
 */
function killPiece(piece) {
  piece.alive   = false;
  piece.cellIdx = -1;
}

/**
 * Vérifie si la partie est terminée après chaque action.
 * Met à jour gameState.status / winner / winReason si besoin.
 * @returns {boolean} true si la partie est finie
 */
function checkVictory() {
  for (const pid of [PLAYER.ONE, PLAYER.TWO]) {
    const opponent = pid === PLAYER.ONE ? PLAYER.TWO : PLAYER.ONE;
    const opponentPlayer = gameState.players[opponent];

    // Condition 1 : le drapeau adverse est capturé
    const opFlag = opponentPlayer.pieces.find(p => p.type === PIECE_TYPE.FLAG);
    if (opFlag && !opFlag.alive) {
      gameState.status    = GAME_STATUS.OVER;
      gameState.gameOver  = true;
      gameState.winner    = pid;
      gameState.winReason = `${gameState.players[pid].label} a capturé le Drapeau adverse !`;
      addLog('system', `🏆 Victoire de ${gameState.players[pid].label} — ${gameState.winReason}`);
      return true;
    }

    // Condition 2 : toutes les pièces mobiles adverses sont éliminées
    const mobileOpponent = opponentPlayer.pieces.filter(
      p => p.alive && PIECE_DEF[p.type].movable
    );
    if (mobileOpponent.length === 0) {
      gameState.status    = GAME_STATUS.OVER;
      gameState.gameOver  = true;
      gameState.winner    = pid;
      gameState.winReason = `${gameState.players[pid].label} a éliminé toutes les pièces adverses !`;
      addLog('system', `🏆 Victoire de ${gameState.players[pid].label} — ${gameState.winReason}`);
      return true;
    }
  }

  // Condition 3 : blocage — le joueur actuel n'a aucune pièce mobile ET aucune carte
  const current = gameState.players[gameState.currentPlayer];
  const canMove = current.pieces.some(p => {
    if (!p.alive || !PIECE_DEF[p.type].movable) return false;
    return computeValidMoves(p, false).length > 0;
  });
  if (!canMove && current.hand.length === 0 && gameState.deck.length === 0) {
    const opponent = gameState.currentPlayer === PLAYER.ONE ? PLAYER.TWO : PLAYER.ONE;
    gameState.status    = GAME_STATUS.OVER;
    gameState.gameOver  = true;
    gameState.winner    = opponent;
    gameState.winReason = `${current.label} est bloqué et ne peut plus jouer !`;
    addLog('system', `🏆 Victoire de ${gameState.players[opponent].label} — ${gameState.winReason}`);
    return true;
  }

  return false;
}

/**
 * Déplace une pièce vers une cellule cible.
 * Gère : déclenchement de pièges, combats, victoire.
 * @param {string} pieceId
 * @param {number} targetIdx
 * @returns {{ ok: boolean, message: string }}
 */
function movePiece(pieceId, targetIdx) {
  const piece = getPieceById(pieceId);
  if (!piece || !piece.alive) {
    return { ok: false, message: 'Pièce invalide.' };
  }
  if (piece.owner !== gameState.currentPlayer) {
    return { ok: false, message: "Ce n'est pas votre pièce." };
  }

  const validMoves = gameState.selected.validMoves;
  if (!validMoves.includes(targetIdx)) {
    return { ok: false, message: 'Déplacement non autorisé.' };
  }

  const fromIdx = piece.cellIdx;
  const occupant = getPieceAtCell(targetIdx);
  const playerLabel = gameState.players[gameState.currentPlayer].label;
  const pieceLabel  = PIECE_DEF[piece.type].label;

  // ── Vérification piège sur la case cible ────────────────
  if (gameState.traps[targetIdx] !== undefined) {
    const trap = gameState.traps[targetIdx];
    if (trap.owner !== gameState.currentPlayer) {
      // La pièce tombe dans le piège : elle est détruite
      killPiece(piece);
      delete gameState.traps[targetIdx];
      addLog(
        gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
        `💥 ${playerLabel} — ${pieceLabel} est tombé dans un piège et est éliminé !`
      );
      checkVictory();
      return { ok: true, message: 'Piège déclenché, pièce éliminée.' };
    }
    // Piège appartenant au joueur actif : il peut traverser sans problème
  }

  // ── Cas 1 : case vide ────────────────────────────────────
  if (!occupant) {
    piece.cellIdx = targetIdx;
    addLog(
      gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
      `${playerLabel} — ${pieceLabel} déplacé en (${pos(targetIdx).row},${pos(targetIdx).col}).`
    );
    return { ok: true, message: 'Déplacement effectué.' };
  }

  // ── Cas 2 : combat ───────────────────────────────────────
  const combat = resolveCombat(piece, occupant);
  const defLabel = PIECE_DEF[occupant.type].label;
  const defPlayer = gameState.players[occupant.owner].label;

  let combatMsg = `⚔️ Combat : ${playerLabel}/${pieceLabel}(${combat.atkVal}) vs ${defPlayer}/${defLabel}(${combat.defVal}) → `;

  switch (combat.result) {
    case 'attacker_wins':
      killPiece(occupant);
      piece.cellIdx = targetIdx;
      gameState.players[gameState.currentPlayer].capturedCount++;
      combatMsg += `${pieceLabel} gagne et avance !`;
      break;

    case 'defender_wins':
      killPiece(piece);
      combatMsg += `${defLabel} défend avec succès !`;
      break;

    case 'draw':
      killPiece(piece);
      killPiece(occupant);
      combatMsg += 'Égalité — les deux pièces sont retirées !';
      break;
  }

  addLog('combat', combatMsg);

  // Reset du bouclier après usage
  gameState.selected.shieldActive = false;

  checkVictory();
  return { ok: true, message: combatMsg };
}

/**
 * Joue une carte Action depuis la main du joueur actif.
 * @param {number} handIndex
 * @returns {{ ok: boolean, message: string }}
 */
function playCard(handIndex) {
  if (gameState.phase !== PHASE.ACTION && gameState.phase !== PHASE.MOVE) {
    return { ok: false, message: 'Vous ne pouvez pas jouer de carte maintenant.' };
  }

  const current = gameState.players[gameState.currentPlayer];
  if (handIndex < 0 || handIndex >= current.hand.length) {
    return { ok: false, message: 'Carte invalide.' };
  }

  const card = current.hand[handIndex];
  current.hand.splice(handIndex, 1);

  const playerLabel = current.label;

  switch (card.type) {
    case CARD_TYPE.SHIELD:
      gameState.selected.shieldActive = true;
      addLog(
        gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
        `🛡️ ${playerLabel} active un Bouclier !`
      );
      break;

    case CARD_TYPE.SPRINT:
      gameState.selected.sprintActive = true;
      addLog(
        gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
        `🏃 ${playerLabel} active un Sprint !`
      );
      break;

    case CARD_TYPE.TRAP:
      gameState.selected.placingTrap = true;
      addLog(
        gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
        `🪤 ${playerLabel} pose un Piège — choisissez une case.`
      );
      break;
  }

  // Remettre la carte dans la défausse commune
  gameState.discardPile.push(card);

  return { ok: true, message: `Carte ${card.type} jouée.` };
}

/**
 * Place un piège sur une case cible (après avoir joué une carte Piège).
 * @param {number} cellIdx
 * @returns {{ ok: boolean, message: string }}
 */
function placeTrap(cellIdx) {
  if (!gameState.selected.placingTrap) {
    return { ok: false, message: 'Aucun piège à poser.' };
  }

  // On ne peut pas poser un piège sur une case occupée par une pièce
  const occupant = getPieceAtCell(cellIdx);
  if (occupant) {
    return { ok: false, message: 'Impossible de poser un piège sur une case occupée.' };
  }

  // On ne peut pas poser un piège sur son propre drapeau ou l'emplacement de départ du drapeau
  gameState.traps[cellIdx] = { owner: gameState.currentPlayer };
  gameState.selected.placingTrap = false;

  const p = pos(cellIdx);
  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `🪤 Piège posé en (${p.row},${p.col}) — invisible pour l'adversaire.`
  );

  return { ok: true, message: 'Piège posé.' };
}

// ─────────────────────────────────────────────────────────────
// ACTIONS DU JOUEUR
// ─────────────────────────────────────────────────────────────

/**
 * Collecte une carte Action depuis le deck commun et l'ajoute à la main
 * du joueur actif (max 3 cartes en main).
 * @returns {{ ok: boolean, message: string }}
 */
function actionCollect() {
  if (gameState.gameOver) {
    return { ok: false, message: 'La partie est terminée.' };
  }

  const current = gameState.players[gameState.currentPlayer];

  if (current.hand.length >= 3) {
    return { ok: false, message: 'Main pleine (3 cartes maximum).' };
  }

  if (gameState.deck.length === 0) {
    // Recycler la défausse
    if (gameState.discardPile.length === 0) {
      return { ok: false, message: 'Aucune carte disponible dans le deck ni la défausse.' };
    }
    gameState.deck = shuffle([...gameState.discardPile]);
    gameState.discardPile = [];
    addLog('system', '🔄 Deck reconstitué depuis la défausse.');
  }

  const card = gameState.deck.pop();
  current.hand.push(card);

  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `🃏 ${current.label} pioche une carte ${card.type}.`
  );

  return { ok: true, message: `Carte ${card.type} piochée.` };
}

/**
 * Action de soin : restaure une pièce blessée (marqueur shield retiré)
 * et la remet en état normal. Coûte une carte Bouclier de la main.
 * @param {number} pieceId  – identifiant de la pièce à soigner
 * @returns {{ ok: boolean, message: string }}
 */
function actionHeal(pieceId) {
  if (gameState.gameOver) {
    return { ok: false, message: 'La partie est terminée.' };
  }

  const current = gameState.players[gameState.currentPlayer];

  // Trouver la carte Bouclier dans la main
  const shieldIdx = current.hand.findIndex(c => c.type === CARD_TYPE.SHIELD);
  if (shieldIdx === -1) {
    return { ok: false, message: 'Vous n\'avez pas de carte Bouclier pour soigner.' };
  }

  // Trouver la pièce
  const piece = gameState.pieces.find(p => p.id === pieceId && p.owner === gameState.currentPlayer && p.alive);
  if (!piece) {
    return { ok: false, message: 'Pièce introuvable ou n\'appartient pas au joueur actif.' };
  }

  // Retirer le bouclier de la main et défausser
  const card = current.hand.splice(shieldIdx, 1)[0];
  gameState.discardPile.push(card);

  // Appliquer l'effet : la pièce gagne un bouclier temporaire (+1 défense au prochain combat)
  piece.shielded = true;

  const playerLabel = current.label;
  const pieceLabel  = PIECE_DEF[piece.type].label;

  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `💊 ${playerLabel} — ${pieceLabel} est renforcé par un bouclier (+1 défense au prochain combat).`
  );

  return { ok: true, message: `${pieceLabel} soigné / renforcé.` };
}

/**
 * Action de construction : pose une tuile Terrain spécial (Forêt ou Marais)
 * sur une case vide du plateau. Coûte une carte Sprint de la main.
 * @param {number} cellIdx   – case cible
 * @param {'forest'|'swamp'} terrainType
 * @returns {{ ok: boolean, message: string }}
 */
function actionBuild(cellIdx, terrainType) {
  if (gameState.gameOver) {
    return { ok: false, message: 'La partie est terminée.' };
  }

  const current = gameState.players[gameState.currentPlayer];

  // Vérifier disponibilité d'une carte Sprint
  const sprintIdx = current.hand.findIndex(c => c.type === CARD_TYPE.SPRINT);
  if (sprintIdx === -1) {
    return { ok: false, message: 'Vous n\'avez pas de carte Sprint pour construire un terrain.' };
  }

  // Limiter le nombre de tuiles posées
  const TERRAIN_LIMIT = 4;
  const totalTerrain = Object.keys(gameState.terrain).length;
  if (totalTerrain >= TERRAIN_LIMIT) {
    return { ok: false, message: `Limite de ${TERRAIN_LIMIT} tuiles terrain atteinte.` };
  }

  // La case ne doit pas être déjà occupée par une pièce ou un terrain
  if (getPieceAtCell(cellIdx)) {
    return { ok: false, message: 'Impossible de placer un terrain sur une case occupée par une pièce.' };
  }
  if (gameState.terrain[cellIdx]) {
    return { ok: false, message: 'Un terrain existe déjà sur cette case.' };
  }

  // Vérifier que le type est valide
  if (terrainType !== 'forest' && terrainType !== 'swamp') {
    return { ok: false, message: 'Type de terrain invalide (forest ou swamp).' };
  }

  // Consommer la carte Sprint
  const card = current.hand.splice(sprintIdx, 1)[0];
  gameState.discardPile.push(card);

  // Poser le terrain
  gameState.terrain[cellIdx] = { type: terrainType };

  const p = pos(cellIdx);
  const terrainLabel = terrainType === 'forest' ? 'Forêt (+1 défense)' : 'Marais (-1 déplacement)';
  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `🏗️ ${current.label} place une tuile ${terrainLabel} en (${p.row},${p.col}).`
  );

  return { ok: true, message: `Terrain ${terrainType} posé en case ${cellIdx}.` };
}

// ─────────────────────────────────────────────────────────────
// CAPACITÉS SPÉCIALES
// ─────────────────────────────────────────────────────────────

/**
 * Dispatcher central des capacités spéciales.
 * Délègue vers la fonction appropriée selon le type de pièce.
 * @param {Object} piece   – pièce qui active sa capacité
 * @param {*}      payload – données supplémentaires selon la capacité
 * @returns {{ ok: boolean, message: string }}
 */
function activateAbility(piece, payload) {
  if (gameState.gameOver) {
    return { ok: false, message: 'La partie est terminée.' };
  }
  if (!piece || !piece.alive) {
    return { ok: false, message: 'Pièce invalide ou éliminée.' };
  }
  if (piece.owner !== gameState.currentPlayer) {
    return { ok: false, message: 'Ce n\'est pas votre pièce.' };
  }
  if (piece.abilityUsed) {
    return { ok: false, message: 'Cette pièce a déjà utilisé sa capacité ce tour.' };
  }

  switch (piece.type) {
    case PIECE_TYPE.SOLDIER:
      return hunterTrap(piece, payload);

    case PIECE_TYPE.GENERAL:
      return healerHeal(piece, payload);

    case PIECE_TYPE.ROOK:
      return engineerPick(piece, payload);

    case PIECE_TYPE.KNIGHT:
      return scoutReveal(piece, payload);

    default:
      return { ok: false, message: `Aucune capacité spéciale pour ce type de pièce (${piece.type}).` };
  }
}

/**
 * Capacité Soldat — pose un piège invisible sur une case adjacente.
 * @param {Object} piece
 * @param {{ cellIdx: number }} payload
 * @returns {{ ok: boolean, message: string }}
 */
function hunterTrap(piece, payload) {
  if (!payload || payload.cellIdx === undefined) {
    return { ok: false, message: 'Précisez la case cible pour poser le piège.' };
  }

  const targetIdx = payload.cellIdx;
  const srcPos    = pos(piece.cellIdx);
  const tgtPos    = pos(targetIdx);

  // La case doit être adjacente (distance 1 orthogonale)
  const dr = Math.abs(srcPos.row - tgtPos.row);
  const dc = Math.abs(srcPos.col - tgtPos.col);
  if (dr + dc !== 1) {
    return { ok: false, message: 'Le piège doit être posé sur une case adjacente (1 case orthogonale).' };
  }

  // Vérifier case libre de pièce
  if (getPieceAtCell(targetIdx)) {
    return { ok: false, message: 'Impossible de poser un piège sur une case occupée.' };
  }

  // Vérifier qu'il n'y a pas déjà un piège
  if (gameState.traps[targetIdx] !== undefined) {
    return { ok: false, message: 'Un piège existe déjà sur cette case.' };
  }

  gameState.traps[targetIdx] = { owner: gameState.currentPlayer };
  piece.abilityUsed = true;

  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `🪤 Soldat pose un piège en (${tgtPos.row},${tgtPos.col}).`
  );

  return { ok: true, message: 'Piège posé par le Soldat.' };
}

/**
 * Capacité Général — soigne une pièce alliée adjacente (retire son statut blessé,
 * ou annule un malus de terrain sur sa case).
 * @param {Object} piece
 * @param {{ targetPieceId: number }} payload
 * @returns {{ ok: boolean, message: string }}
 */
function healerHeal(piece, payload) {
  if (!payload || payload.targetPieceId === undefined) {
    return { ok: false, message: 'Précisez l\'identifiant de la pièce à soigner.' };
  }

  const target = gameState.pieces.find(
    p => p.id === payload.targetPieceId && p.owner === gameState.currentPlayer && p.alive
  );

  if (!target) {
    return { ok: false, message: 'Pièce cible introuvable ou n\'appartient pas au joueur actif.' };
  }

  // Vérifier adjacence
  const srcPos = pos(piece.cellIdx);
  const tgtPos = pos(target.cellIdx);
  const dr = Math.abs(srcPos.row - tgtPos.row);
  const dc = Math.abs(srcPos.col - tgtPos.col);
  if (dr > 1 || dc > 1) {
    return { ok: false, message: 'Le Général ne peut soigner qu\'une pièce adjacente (1 case, toutes directions).' };
  }

  // Appliquer le soin
  target.shielded = true;
  target.healBonus = (target.healBonus || 0) + 1;
  piece.abilityUsed = true;

  const targetLabel = PIECE_DEF[target.type].label;
  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `💚 Général soigne ${targetLabel} en (${tgtPos.row},${tgtPos.col}) — +1 défense.`
  );

  return { ok: true, message: `${targetLabel} soigné par le Général.` };
}

/**
 * Capacité Tour — détruit un terrain adjacent (Forêt ou Marais).
 * @param {Object} piece
 * @param {{ cellIdx: number }} payload
 * @returns {{ ok: boolean, message: string }}
 */
function engineerPick(piece, payload) {
  if (!payload || payload.cellIdx === undefined) {
    return { ok: false, message: 'Précisez la case dont il faut retirer le terrain.' };
  }

  const targetIdx = payload.cellIdx;
  const srcPos    = pos(piece.cellIdx);
  const tgtPos    = pos(targetIdx);

  // Vérifier qu'un terrain existe bien sur la case cible
  if (!gameState.terrain[targetIdx]) {
    return { ok: false, message: 'Aucun terrain sur cette case.' };
  }

  // La case doit être à portée de la Tour (jusqu'à 3 cases en ligne droite)
  const dr = Math.abs(srcPos.row - tgtPos.row);
  const dc = Math.abs(srcPos.col - tgtPos.col);
  const inLine = (dr === 0 || dc === 0) && (dr + dc) <= 3 && (dr + dc) > 0;
  if (!inLine) {
    return { ok: false, message: 'La Tour peut retirer un terrain jusqu\'à 3 cases en ligne droite.' };
  }

  const terrainType = gameState.terrain[targetIdx].type;
  delete gameState.terrain[targetIdx];
  piece.abilityUsed = true;

  const terrainLabel = terrainType === 'forest' ? 'Forêt' : 'Marais';
  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    `🔨 Tour détruit le terrain ${terrainLabel} en (${tgtPos.row},${tgtPos.col}).`
  );

  return { ok: true, message: `Terrain ${terrainLabel} retiré.` };
}

/**
 * Capacité Cavalier — révèle les pièces adverses cachées (pièges) dans un rayon de 2 cases.
 * @param {Object} piece
 * @param {*} _payload  (non utilisé)
 * @returns {{ ok: boolean, message: string }}
 */
function scoutReveal(piece, _payload) {
  const srcPos = pos(piece.cellIdx);
  const revealed = [];

  // Chercher tous les pièges adverses dans un rayon de 2 cases (Chebyshev)
  for (const [idxStr, trap] of Object.entries(gameState.traps)) {
    if (trap.owner === gameState.currentPlayer) continue; // ignorer ses propres pièges
    const tgtPos = pos(Number(idxStr));
    const dr = Math.abs(srcPos.row - tgtPos.row);
    const dc = Math.abs(srcPos.col - tgtPos.col);
    if (Math.max(dr, dc) <= 2) {
      trap.revealed = true;
      revealed.push(`(${tgtPos.row},${tgtPos.col})`);
    }
  }

  // Révéler également les pièces adverses cachées à portée
  const hiddenPieces = gameState.pieces.filter(p => {
    if (p.owner === gameState.currentPlayer || !p.alive) return false;
    const pPos = pos(p.cellIdx);
    const dr = Math.abs(srcPos.row - pPos.row);
    const dc = Math.abs(srcPos.col - pPos.col);
    return Math.max(dr, dc) <= 2;
  });

  hiddenPieces.forEach(p => {
    p.revealed = true;
  });

  piece.abilityUsed = true;

  const revealCount = revealed.length + hiddenPieces.length;
  const msg = revealCount > 0
    ? `🔭 Cavalier révèle ${revealCount} élément(s) ennemi(s) à proximité.`
    : `🔭 Cavalier éclaire la zone — aucun élément ennemi caché détecté.`;

  addLog(
    gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
    msg
  );

  return { ok: true, message: msg };
}

// ─────────────────────────────────────────────────────────────
// GESTION DES ÉVÉNEMENTS
// ─────────────────────────────────────────────────────────────

/**
 * Avance le compteur d'événements et déclenche le tirage
 * si le seuil est atteint (tous les EVENT_INTERVAL tours).
 */
function advanceToEvent() {
  gameState.eventCounter = (gameState.eventCounter || 0) + 1;
  const EVENT_INTERVAL = 4; // déclenche un événement tous les 4 demi-tours
  if (gameState.eventCounter >= EVENT_INTERVAL) {
    gameState.eventCounter = 0;
    drawEvent();
  }
}

/**
 * Pioche et applique un événement aléatoire depuis la table d'événements.
 */
function drawEvent() {
  const events = [
    { id: 'wind',     label: 'Vent violent',    desc: 'Toutes les pièces Cavalier ne peuvent se déplacer que d\'1 case ce tour.' },
    { id: 'fog',      label: 'Brouillard épais', desc: 'Les positions des pièces adverses sont masquées pendant 1 tour.' },
    { id: 'quake',    label: 'Tremblement',      desc: 'Une tuile terrain aléatoire est détruite.' },
    { id: 'supply',   label: 'Ravitaillement',   desc: 'Chaque joueur pioche 1 carte Action supplémentaire.' },
    { id: 'morale',   label: 'Coup de moral',    desc: 'Le joueur actif peut effectuer 1 déplacement supplémentaire ce tour.' },
    { id: 'ambush',   label: 'Embuscade',        desc: 'Un piège aléatoire est placé sur une case libre au centre du plateau.' },
  ];

  const event = events[Math.floor(Math.random() * events.length)];
  gameState.activeEvent = { ...event, turnsLeft: 1 };

  addLog('system', `🌟 ÉVÉNEMENT : ${event.label} — ${event.desc}`);
  applyEvent(event);
}

/**
 * Applique les effets immédiats d'un événement.
 * @param {{ id: string }} event
 */
function applyEvent(event) {
  switch (event.id) {
    case 'wind':
      // Marquer tous les Cavaliers avec un malus de déplacement
      gameState.pieces.forEach(p => {
        if (p.alive && p.type === PIECE_TYPE.KNIGHT) {
          p.windPenalty = true;
        }
      });
      addLog('system', '💨 Vent : les Cavaliers sont limités à 1 case ce tour.');
      break;

    case 'fog':
      // Masquer les pièces adverses pour le joueur actif
      gameState.fogActive = true;
      gameState.fogOwner  = gameState.currentPlayer;
      addLog('system', '🌫️ Brouillard : positions adverses masquées.');
      break;

    case 'quake':
      // Détruire une tuile terrain aléatoire
      {
        const terrainKeys = Object.keys(gameState.terrain);
        if (terrainKeys.length > 0) {
          const rndKey = terrainKeys[Math.floor(Math.random() * terrainKeys.length)];
          const tType  = gameState.terrain[rndKey].type;
          delete gameState.terrain[rndKey];
          const p = pos(Number(rndKey));
          addLog('system', `🌍 Tremblement : tuile ${tType} en (${p.row},${p.col}) détruite.`);
        } else {
          addLog('system', '🌍 Tremblement : aucune tuile à détruire.');
        }
      }
      break;

    case 'supply':
      // Chaque joueur pioche 1 carte Action si sa main n'est pas pleine
      [PLAYER.ONE, PLAYER.TWO].forEach(playerIdx => {
        const player = gameState.players[playerIdx];
        if (player.hand.length < 3 && gameState.deck.length > 0) {
          const card = gameState.deck.pop();
          player.hand.push(card);
          addLog('system', `📦 Ravitaillement : ${player.label} pioche une carte ${card.type}.`);
        }
      });
      break;

    case 'morale':
      // Le joueur actif dispose d'un déplacement bonus ce tour
      gameState.players[gameState.currentPlayer].bonusMove = true;
      addLog('system', `🎖️ Coup de moral : ${gameState.players[gameState.currentPlayer].label} gagne 1 déplacement bonus.`);
      break;

    case 'ambush':
      // Poser un piège neutre sur une case libre au centre (zone 3–5 × 3–5)
      {
        const CENTER_CELLS = [];
        for (let r = 3; r <= 5; r++) {
          for (let c = 3; c <= 5; c++) {
            const cellI = r * BOARD_SIZE + c;
            if (!getPieceAtCell(cellI) && !gameState.traps[cellI]) {
              CENTER_CELLS.push(cellI);
            }
          }
        }
        if (CENTER_CELLS.length > 0) {
          const rndIdx = CENTER_CELLS[Math.floor(Math.random() * CENTER_CELLS.length)];
          // piège neutre : owner = -1 (blesse n'importe quel joueur)
          gameState.traps[rndIdx] = { owner: -1, neutral: true };
          const p = pos(rndIdx);
          addLog('system', `🕳️ Embuscade : piège neutre posé en (${p.row},${p.col}).`);
        }
      }
      break;

    default:
      addLog('system', `⚡ Événement ${event.id} : aucun effet immédiat.`);
      break;
  }
}

/**
 * Termine le tour du joueur actif et prépare le tour suivant.
 * @returns {{ ok: boolean, message: string }}
 */
function endTurn() {
  if (gameState.gameOver) {
    return { ok: false, message: 'La partie est terminée.' };
  }

  const current = gameState.players[gameState.currentPlayer];

  // ── Nettoyage des états temporaires du tour ──────────────
  // Réinitialiser les capacités spéciales utilisées
  gameState.pieces.forEach(p => {
    if (p.owner === gameState.currentPlayer) {
      p.abilityUsed = false;
      p.windPenalty = false;
    }
  });

  // Réinitialiser les bonus de sprint / shield du sélecteur
  gameState.selected = {
    pieceId:      null,
    cellIdx:      null,
    validMoves:   [],
    shieldActive: false,
    sprintActive: false,
    placingTrap:  false,
  };

  // Réinitialiser les bonus d'un tour
  current.bonusMove = false;

  // Retirer le brouillard si c'était le joueur actif qui en bénéficiait
  if (gameState.fogActive && gameState.fogOwner === gameState.currentPlayer) {
    gameState.fogActive = false;
    gameState.fogOwner  = null;
    addLog('system', '🌫️ Le brouillard se dissipe.');
  }

  // Révéler les pièces qui avaient été temporairement révélées par le Cavalier
  gameState.pieces.forEach(p => {
    if (p.revealed) p.revealed = false;
  });
  // Révéler les pièges temporairement révélés
  for (const trap of Object.values(gameState.traps)) {
    if (trap.revealed) trap.revealed = false;
  }

  // ── Piocher une carte si la main est vide ────────────────
  if (current.hand.length === 0 && gameState.deck.length > 0) {
    const card = gameState.deck.pop();
    current.hand.push(card);
    addLog(
      gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
      `🃏 ${current.label} pioche automatiquement une carte ${card.type} (main vide).`
    );
  }

  // ── Incrémenter le compteur de tours ────────────────────
  gameState.turnCount++;

  // ── Vérification blocage ────────────────────────────────
  const canMove = gameState.pieces.some(p =>
    p.owner === gameState.currentPlayer &&
    p.alive &&
    p.type !== PIECE_TYPE.FLAG &&
    computeValidMoves(p, false).length > 0
  );
  const hasCards = current.hand.length > 0;

  if (!canMove && !hasCards) {
    // Le joueur actuel est bloqué : il perd
    const loser  = gameState.currentPlayer;
    const winner = loser === PLAYER.ONE ? PLAYER.TWO : PLAYER.ONE;
    gameState.gameOver = true;
    gameState.winner   = winner;
    addLog('system', `🚫 ${current.label} est bloqué (aucune pièce mobile, aucune carte) — ${gameState.players[winner].label} remporte la partie !`);
    return { ok: true, message: 'Joueur bloqué — fin de partie.' };
  }

  // ── Changer de joueur ────────────────────────────────────
  const prevPlayer = gameState.currentPlayer;
  gameState.currentPlayer = prevPlayer === PLAYER.ONE ? PLAYER.TWO : PLAYER.ONE;

  // ── Phase ────────────────────────────────────────────────
  gameState.phase = PHASE.SELECT;

  // ── Avancer le compteur d'événements ────────────────────
  advanceToEvent();

  // ── Effacer l'événement actif après application ──────────
  if (gameState.activeEvent && gameState.activeEvent.turnsLeft <= 0) {
    gameState.activeEvent = null;
  } else if (gameState.activeEvent) {
    gameState.activeEvent.turnsLeft--;
  }

  const nextLabel = gameState.players[gameState.currentPlayer].label;
  addLog('system', `──────── Tour ${gameState.turnCount} — ${nextLabel} joue ────────`);

  return { ok: true, message: `Tour passé. C'est au tour de ${nextLabel}.` };
}

// === FIN PARTIE 2 ===

// === PARTIE 3/3 ===
//
// IDs HTML principaux utilisés dans cette partie :
//   #game-board          — conteneur principal du plateau + panneau
//   #board-grid          — grille 8×8 des cases
//   #info-panel          — panneau latéral d'information
//   #active-player-name  — nom du joueur actif
//   #active-player-avatar— avatar/couleur du joueur actif
//   #phase-label         — label de la phase courante
//   #action-buttons      — zone des boutons d'action
//   #btn-end-turn        — bouton "Fin de tour"
//   #btn-new-game        — bouton "Nouvelle partie"
//   #btn-draw-card       — bouton "Piocher une carte"
//   #hand-cards          — cartes en main du joueur actif
//   #inventory-slots     — 8 emplacements visuels d'inventaire
//   #players-list        — liste des deux joueurs avec PV
//   #last-event-box      — dernier événement actif
//   #turn-bar            — barre de progression des tours
//   #log-list            — journal des actions
//   #gameover-screen     — écran de fin de partie
//   #gameover-title      — titre de l'écran de fin
//   #gameover-msg        — message de fin
//   #context-message     — message d'aide contextuel
//   #fog-toggle          — bouton bascule brouillard de guerre

// ─────────────────────────────────────────────────────────
//  CONSTANTES DE RENDU
// ─────────────────────────────────────────────────────────
const PIECE_ASSETS = {
  [PIECE_TYPE.FLAG]:  'assets/piece_drapeau.svg',
  [PIECE_TYPE.SOLDIER]:   'assets/piece_soldat.svg',
  [PIECE_TYPE.KNIGHT]: 'assets/piece_cavalier.svg',
  [PIECE_TYPE.ROOK]:     'assets/piece_tour.svg',
  [PIECE_TYPE.GENERAL]:  'assets/piece_general.svg',
};

const CARD_ASSETS = {
  [CARD_TYPE.SHIELD]: 'assets/card_bouclier.svg',
  [CARD_TYPE.SPRINT]: 'assets/card_sprint.svg',
  [CARD_TYPE.TRAP]:   'assets/card_piege.svg',
};

const TERRAIN_ASSETS = {
  [TERRAIN_TYPE.FOREST]: 'assets/tile_foret.svg',
  [TERRAIN_TYPE.SWAMP]:  'assets/tile_marais.svg',
};

const PHASE_LABELS = {
  [PHASE.SELECT]: '🎯 Sélectionner une pièce',
  [PHASE.MOVE]:   '🚀 Déplacer la pièce',
  [PHASE.ACTION]: '🃏 Jouer une carte (optionnel)',
  [PHASE.DRAW]:   '🃏 Piocher une carte',
};

const MAX_TURNS_DISPLAY = 60;

// ─────────────────────────────────────────────────────────
//  RENDER — dispatcher principal
// ─────────────────────────────────────────────────────────
function render() {
  renderBoard();
  renderInfoPanel();
  if (gameState.gameOver) {
    renderGameOver();
  } else {
    hideGameOver();
  }
}

// ─────────────────────────────────────────────────────────
//  renderBoard — plateau 8×8 avec terrains, pions, highlights
// ─────────────────────────────────────────────────────────
function renderBoard() {
  const grid = document.getElementById('board-grid');
  if (!grid) return;

  // Mouvements valides
  const validMoveSet = new Set();
  if (gameState.phase === PHASE.MOVE && gameState.selected && gameState.selected.validMoves) {
    gameState.selected.validMoves.forEach(i => validMoveSet.add(i));
  }

  // Cases piégées (visibles au joueur actif)
  const trapSet = new Set(Object.keys(gameState.traps).map(Number));

  // Pièces par cellule
  const pieceByCell = {};
  gameState.pieces.forEach(p => {
    if (p.alive) pieceByCell[p.cellIdx] = p;
  });

  // Terrains spéciaux (depuis gameState.terrain)
  const terrainByCell = gameState.terrain || {};

  grid.innerHTML = '';

  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;

    const row = Math.floor(i / 8);
    const col = i % 8;

    // Damier — classes attendues par le CSS
    cell.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');

    // Terrain spécial
    if (terrainByCell[i]) {
      const t = terrainByCell[i];
      cell.classList.add(t.type === TERRAIN_TYPE.FOREST ? 'terrain-forest' : 'terrain-swamp');
      const tImg = document.createElement('img');
      tImg.src = TERRAIN_ASSETS[t.type] || '';
      tImg.alt = t.type;
      tImg.className = 'terrain-icon';
      cell.appendChild(tImg);
    }

    // Piège visible du joueur actif
    if (trapSet.has(i)) {
      cell.classList.add('has-trap');
    }

    // Pièce sélectionnée — case verte
    if (gameState.selected && gameState.selected.cellIdx === i && gameState.phase === PHASE.MOVE) {
      cell.classList.add('selected');
    }

    // Mouvement valide — bleu (movable) ou rouge (attackable si ennemi)
    if (validMoveSet.has(i)) {
      const occupant = pieceByCell[i];
      if (occupant && occupant.owner !== gameState.currentPlayer) {
        cell.classList.add('attackable');
      } else {
        cell.classList.add('movable');
      }
    }

    // Pièce sélectionnable en phase SELECT
    if (
      gameState.phase === PHASE.SELECT &&
      pieceByCell[i] &&
      pieceByCell[i].owner === gameState.currentPlayer &&
      pieceByCell[i].type !== PIECE_TYPE.FLAG
    ) {
      cell.classList.add('selectable');
    }

    // Rendu de la pièce (drapeaux inclus via piece-flag)
    if (pieceByCell[i]) {
      const piece = pieceByCell[i];
      const isCurrentPlayer = piece.owner === gameState.currentPlayer;
      const fogActive = gameState.fogEnabled && !isCurrentPlayer && piece.type !== PIECE_TYPE.FLAG;

      const pEl = document.createElement('div');
      pEl.className = `piece-wrapper player-${piece.owner}`;
      if (piece.type === PIECE_TYPE.FLAG) pEl.classList.add('piece-flag');
      if (piece.shielded) pEl.classList.add('piece-shielded');

      if (fogActive) {
        pEl.classList.add('piece-fog');
        const fogDiv = document.createElement('div');
        fogDiv.className = 'fog-overlay';
        fogDiv.textContent = '?';
        pEl.appendChild(fogDiv);
      } else {
        const pImg = document.createElement('img');
        pImg.src = PIECE_ASSETS[piece.type] || '';
        pImg.alt = piece.type;
        pEl.appendChild(pImg);

        const combatVal = PIECE_DEF[piece.type]?.combat;
        if (combatVal !== undefined && combatVal > 0) {
          const badge = document.createElement('span');
          badge.className = 'piece-badge';
          badge.textContent = combatVal;
          pEl.appendChild(badge);
        }
      }

      cell.appendChild(pEl);
    }

    cell.addEventListener('click', () => handleCellClick(i));
    grid.appendChild(cell);
  }

  renderContextMessage();
}

// ─────────────────────────────────────────────────────────
//  handleCellClick — gestion des clics sur le plateau
// ─────────────────────────────────────────────────────────
function handleCellClick(cellIdx) {
  if (gameState.gameOver) return;

  const result = (() => {
    switch (gameState.phase) {
      case PHASE.SELECT: {
        // Chercher une pièce appartenant au joueur actif sur cette case
        const piece = gameState.pieces.find(
          p => p.alive && p.cellIdx === cellIdx && p.owner === gameState.currentPlayer && p.type !== PIECE_TYPE.FLAG
        );
        if (!piece) {
          return { ok: false, message: 'Aucune pièce sélectionnable ici.' };
        }
        const moves = computeValidMoves(piece, gameState.selected.sprintActive || false);
        if (moves.length === 0) {
          return { ok: false, message: 'Cette pièce ne peut pas se déplacer.' };
        }
        gameState.selected = {
          ...gameState.selected,
          pieceId:    piece.id,
          cellIdx:    piece.cellIdx,
          validMoves: moves,
        };
        gameState.phase = PHASE.MOVE;
        addLog(
          gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
          `🎯 ${gameState.players[gameState.currentPlayer].label} sélectionne un ${piece.type}.`
        );
        return { ok: true, message: `${piece.type} sélectionné(e).` };
      }

      case PHASE.MOVE: {
        // Désélectionner si on re-clique sur la même pièce
        if (gameState.selected && gameState.selected.cellIdx === cellIdx) {
          gameState.selected = {
            pieceId:      null,
            cellIdx:      null,
            validMoves:   [],
            shieldActive: gameState.selected.shieldActive,
            sprintActive: gameState.selected.sprintActive,
            placingTrap:  gameState.selected.placingTrap,
          };
          gameState.phase = PHASE.SELECT;
          addLog('system', '↩️ Sélection annulée.');
          return { ok: true, message: 'Sélection annulée.' };
        }
        const moveResult = movePiece(gameState.selected.pieceId, cellIdx);
        if (moveResult.ok && !gameState.gameOver) {
          gameState.phase = PHASE.ACTION;
          gameState.selected = {
            pieceId:      null,
            cellIdx:      null,
            validMoves:   [],
            shieldActive: gameState.selected.shieldActive,
            sprintActive: false,
            placingTrap:  false,
          };
        }
        return moveResult;
      }

      case PHASE.ACTION: {
        // En phase action on ne clique pas les cellules pour se déplacer
        return { ok: false, message: 'Jouez une carte ou terminez votre tour.' };
      }

      default:
        return { ok: false, message: '' };
    }
  })();

  if (result && result.message) {
    setContextMessage(result.ok ? 'info' : 'error', result.message);
  }

  render();
}

// ─────────────────────────────────────────────────────────
//  setContextMessage
// ─────────────────────────────────────────────────────────
let _ctxMessage = { type: 'info', text: '' };

function setContextMessage(type, text) {
  _ctxMessage = { type, text };
}

// ─────────────────────────────────────────────────────────
//  renderContextMessage
// ─────────────────────────────────────────────────────────
function renderContextMessage() {
  const el = document.getElementById('context-message');
  if (!el) return;

  const phaseMsg = PHASE_LABELS[gameState.phase] || '';
  el.className = `context-message context-${_ctxMessage.type}`;

  if (_ctxMessage.text) {
    el.textContent = `${phaseMsg} — ${_ctxMessage.text}`;
  } else {
    el.textContent = phaseMsg;
  }
}

// ─────────────────────────────────────────────────────────
//  renderInfoPanel — dispatcher du panneau latéral
// ─────────────────────────────────────────────────────────
function renderInfoPanel() {
  renderActivePlayer();
  renderPhase();
  renderActions();
  renderInventory();
  renderAllPlayers();
  renderLastEvent();
  renderTurnBar();
  renderLog();
}

// ─────────────────────────────────────────────────────────
//  renderActivePlayer
// ─────────────────────────────────────────────────────────
function renderActivePlayer() {
  const nameEl   = document.getElementById('active-player-name');
  const avatarEl = document.getElementById('active-player-avatar');
  if (!nameEl || !avatarEl) return;

  const current = gameState.players[gameState.currentPlayer];
  nameEl.textContent = current.label;
  nameEl.className   = `player-name player-${gameState.currentPlayer}-color`;

  avatarEl.className = `player-avatar player-${gameState.currentPlayer}-avatar`;
  avatarEl.textContent = gameState.currentPlayer === PLAYER.ONE ? '👤' : '👥';
}

// ─────────────────────────────────────────────────────────
//  renderPhase
// ─────────────────────────────────────────────────────────
function renderPhase() {
  const el = document.getElementById('phase-label');
  if (!el) return;
  el.textContent = PHASE_LABELS[gameState.phase] || gameState.phase;
  el.className = `phase-label phase-${gameState.phase.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────
//  renderActions — boutons d'action et cartes en main
// ─────────────────────────────────────────────────────────
function renderActions() {
  const actionZone = document.getElementById('action-buttons');
  if (!actionZone) return;

  const current = gameState.players[gameState.currentPlayer];

  // ── Bouton Piocher
  const btnDraw = document.getElementById('btn-draw-card');
  if (btnDraw) {
    const canDraw =
      !gameState.gameOver &&
      current.hand.length < 3 &&
      gameState.deck.length > 0 &&
      (gameState.phase === PHASE.SELECT || gameState.phase === PHASE.ACTION);
    btnDraw.disabled = !canDraw;
    btnDraw.title = canDraw
      ? `Piocher une carte (${gameState.deck.length} restantes)`
      : 'Impossible de piocher maintenant';
  }

  // ── Bouton Fin de tour
  const btnEnd = document.getElementById('btn-end-turn');
  if (btnEnd) {
    btnEnd.disabled =
      gameState.gameOver ||
      gameState.phase === PHASE.MOVE; // doit d'abord déplacer
    btnEnd.title = gameState.phase === PHASE.MOVE
      ? 'Déplacez d\'abord votre pièce'
      : 'Terminer le tour';
  }

  // ── Cartes en main
  renderHandCards(current);
}

function renderHandCards(player) {
  const handEl = document.getElementById('hand-cards');
  if (!handEl) return;

  handEl.innerHTML = '';

  if (player.hand.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hand-empty';
    empty.textContent = 'Main vide';
    handEl.appendChild(empty);
    return;
  }

  player.hand.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'hand-card';
    cardEl.dataset.cardIdx = idx;
    cardEl.title = getCardDescription(card.type);

    const canPlay =
      !gameState.gameOver &&
      (gameState.phase === PHASE.ACTION || gameState.phase === PHASE.MOVE);

    if (!canPlay) cardEl.classList.add('card-disabled');

    const img = document.createElement('img');
    img.src = CARD_ASSETS[card.type] || '';
    img.alt = card.type;
    cardEl.appendChild(img);

    const label = document.createElement('span');
    label.className = 'card-label';
    label.textContent = getCardDisplayName(card.type);
    cardEl.appendChild(label);

    if (canPlay) {
      cardEl.addEventListener('click', () => {
        const res = playCard(idx);
        setContextMessage(res.ok ? 'info' : 'error', res.message);
        render();
      });
    }

    handEl.appendChild(cardEl);
  });
}

function getCardDisplayName(type) {
  switch (type) {
    case CARD_TYPE.SHIELD: return 'Bouclier';
    case CARD_TYPE.SPRINT: return 'Sprint';
    case CARD_TYPE.TRAP:   return 'Piège';
    default: return type;
  }
}

function getCardDescription(type) {
  switch (type) {
    case CARD_TYPE.SHIELD: return 'Bouclier : protège votre pièce sélectionnée en cas de combat ce tour.';
    case CARD_TYPE.SPRINT: return 'Sprint : double la portée de déplacement de la pièce sélectionnée ce tour.';
    case CARD_TYPE.TRAP:   return 'Piège : pose un piège invisible sur la case cible — détruit toute pièce ennemie qui y marche.';
    default: return '';
  }
}

// ─────────────────────────────────────────────────────────
//  renderInventory — 8 emplacements visuels de ressources
// ─────────────────────────────────────────────────────────
function renderInventory() {
  const slotsEl = document.getElementById('inventory-slots');
  if (!slotsEl) return;

  const current = gameState.players[gameState.currentPlayer];

  // On affiche : pièces en vie par type + cartes piochées + pièces capturées
  const pieceTypes = [
    PIECE_TYPE.SOLDIER,
    PIECE_TYPE.KNIGHT,
    PIECE_TYPE.ROOK,
    PIECE_TYPE.GENERAL,
  ];

  const slots = [];

  // Slots 0-3 : types de pièces vivantes du joueur actif
  pieceTypes.forEach(type => {
    const count = gameState.pieces.filter(
      p => p.owner === gameState.currentPlayer && p.type === type && p.alive
    ).length;
    slots.push({ label: getPieceShortName(type), value: count, asset: PIECE_ASSETS[type], type: 'piece' });
  });

  // Slot 4 : cartes en main
  slots.push({
    label: 'Cartes',
    value: `${current.hand.length}/3`,
    asset: 'assets/card_bouclier.svg',
    type: 'cards'
  });

  // Slot 5 : cartes dans le deck
  slots.push({
    label: 'Deck',
    value: gameState.deck.length,
    asset: 'assets/marker_premier_joueur.svg',
    type: 'deck'
  });

  // Slot 6 : pièces capturées par le joueur actif
  slots.push({
    label: 'Captures',
    value: current.capturedCount || 0,
    asset: 'assets/piece_soldat.svg',
    type: 'captures'
  });

  // Slot 7 : pièges posés
  const myTraps = Object.values(gameState.traps).filter(t => t.owner === gameState.currentPlayer).length;
  slots.push({
    label: 'Pièges',
    value: myTraps,
    asset: 'assets/card_piege.svg',
    type: 'traps'
  });

  slotsEl.innerHTML = '';
  slots.forEach(slot => {
    const slotEl = document.createElement('div');
    slotEl.className = `inventory-slot inventory-${slot.type}`;

    const img = document.createElement('img');
    img.src = slot.asset;
    img.alt = slot.label;
    slotEl.appendChild(img);

    const val = document.createElement('span');
    val.className = 'inventory-value';
    val.textContent = slot.value;
    slotEl.appendChild(val);

    const lbl = document.createElement('span');
    lbl.className = 'inventory-label';
    lbl.textContent = slot.label;
    slotEl.appendChild(lbl);

    slotsEl.appendChild(slotEl);
  });
}

function getPieceShortName(type) {
  switch (type) {
    case PIECE_TYPE.SOLDIER:   return 'Sold.';
    case PIECE_TYPE.KNIGHT: return 'Cav.';
    case PIECE_TYPE.ROOK:     return 'Tour';
    case PIECE_TYPE.GENERAL:  return 'Gén.';
    case PIECE_TYPE.FLAG:  return 'Flag';
    default: return type;
  }
}

// ─────────────────────────────────────────────────────────
//  renderAllPlayers — barres de PV / état des deux joueurs
// ─────────────────────────────────────────────────────────
function renderAllPlayers() {
  const listEl = document.getElementById('players-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  Object.entries(gameState.players).forEach(([pidStr, player]) => {
    const pid = Number(pidStr);
    const totalMobile = 12;
    const aliveMobile = gameState.pieces.filter(
      p => p.owner === pid && p.alive && p.type !== PIECE_TYPE.FLAG
    ).length;

    const li = document.createElement('li');
    if (pid === gameState.currentPlayer) li.classList.add('active-player');

    const avatar = document.createElement('div');
    avatar.className = `player-list-avatar p${pid}`;
    avatar.textContent = pid === PLAYER.ONE ? '👤' : '👥';
    li.appendChild(avatar);

    const name = document.createElement('span');
    name.className = `player-list-name p${pid}`;
    name.textContent = player.label;
    li.appendChild(name);

    const info = document.createElement('span');
    info.className = 'player-list-pieces';
    info.textContent = `${aliveMobile}/${totalMobile} · 🃏${player.hand.length} · 🏆${player.capturedCount || 0}`;
    li.appendChild(info);

    if (pid === gameState.currentPlayer) {
      const marker = document.createElement('img');
      marker.src = 'assets/marker_premier_joueur.svg';
      marker.alt = '▶';
      marker.className = 'player-first-marker';
      li.appendChild(marker);
    }

    listEl.appendChild(li);
  });
}

// ─────────────────────────────────────────────────────────
//  renderLastEvent
// ─────────────────────────────────────────────────────────
function renderLastEvent() {
  const box = document.getElementById('last-event-box');
  if (!box) return;

  if (gameState.activeEvent) {
    const ev = gameState.activeEvent;
    box.classList.remove('event-hidden');
    box.innerHTML = `
      <span class="event-icon">⚡</span>
      <span class="event-title">${ev.name}</span>
      <span class="event-desc">${ev.description}</span>
      <span class="event-turns">${ev.turnsLeft} tour(s) restant(s)</span>
    `;
  } else {
    box.classList.add('event-hidden');
    box.textContent = 'Aucun événement actif';
  }
}

// ─────────────────────────────────────────────────────────
//  renderTurnBar — barre de progression des tours
// ─────────────────────────────────────────────────────────
function renderTurnBar() {
  const fill  = document.getElementById('turn-bar-fill');
  const count = document.getElementById('turn-count');
  if (fill) {
    const pct = Math.min(100, Math.round((gameState.turnCount / MAX_TURNS_DISPLAY) * 100));
    fill.style.width = pct + '%';
  }
  if (count) {
    count.textContent = `Tour ${gameState.turnCount} · Deck : ${gameState.deck.length} cartes`;
  }
}

// ─────────────────────────────────────────────────────────
//  renderLog — journal des actions (dernieres 20 entrées)
// ─────────────────────────────────────────────────────────
function renderLog() {
  const logEl = document.getElementById('log-list');
  if (!logEl) return;

  logEl.innerHTML = '';

  const entries = gameState.log.slice(-20).reverse();
  entries.forEach(entry => {
    const li = document.createElement('li');
    li.className = `log-entry log-${entry.category}`;
    li.textContent = entry.message;
    logEl.appendChild(li);
  });
}

// ─────────────────────────────────────────────────────────
//  renderGameOver — écran de fin de partie
// ─────────────────────────────────────────────────────────
function renderGameOver() {
  const screen = document.getElementById('gameover-screen');
  const titleEl = document.getElementById('gameover-title');
  const msgEl = document.getElementById('gameover-msg');
  if (!screen) return;

  screen.classList.remove('hidden');

  if (gameState.winner !== null) {
    const winner = gameState.players[gameState.winner];
    const loser = gameState.players[gameState.winner === PLAYER.ONE ? PLAYER.TWO : PLAYER.ONE];

    if (titleEl) {
      titleEl.textContent = `🏆 ${winner.label} remporte la partie !`;
      titleEl.className = `gameover-title player-${gameState.winner}-color`;
    }

    if (msgEl) {
      const captures = winner.capturedCount || 0;
      const turns = gameState.turnCount;
      msgEl.innerHTML = `
        <p>${winner.label} a triomphé en <strong>${turns}</strong> tour(s).</p>
        <p>Captures réalisées : <strong>${captures}</strong></p>
        <p>${loser.label} a été vaincu.</p>
      `;
    }
  } else {
    if (titleEl) titleEl.textContent = '🤝 Match nul !';
    if (msgEl) msgEl.textContent = 'Les deux joueurs sont à égalité.';
  }
}

function hideGameOver() {
  const screen = document.getElementById('gameover-screen');
  if (screen) screen.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
//  attachListeners — tous les boutons et interactions
// ─────────────────────────────────────────────────────────
function attachListeners() {
  // ── Nouvelle Partie
  document.querySelectorAll('#btn-new-game, #btn-new-game-over').forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        initGame();
        _ctxMessage = { type: 'info', text: '' };
        render();
      });
    }
  });

  // ── Fin de Tour
  const btnEndTurn = document.getElementById('btn-end-turn');
  if (btnEndTurn) {
    btnEndTurn.addEventListener('click', () => {
      if (gameState.gameOver) return;
      if (gameState.phase === PHASE.MOVE) {
        setContextMessage('error', 'Vous devez déplacer votre pièce avant de terminer le tour.');
        render();
        return;
      }
      const res = endTurn();
      setContextMessage(res.ok ? 'info' : 'error', res.message);
      render();
    });
  }

  // ── Piocher une carte
  const btnDraw = document.getElementById('btn-draw-card');
  if (btnDraw) {
    btnDraw.addEventListener('click', () => {
      if (gameState.gameOver) return;
      const current = gameState.players[gameState.currentPlayer];
      if (current.hand.length >= 3) {
        setContextMessage('error', 'Votre main est déjà pleine (3/3).');
        render();
        return;
      }
      if (gameState.deck.length === 0) {
        setContextMessage('error', 'Le deck est vide.');
        render();
        return;
      }
      const card = gameState.deck.pop();
      current.hand.push(card);
      addLog(
        gameState.currentPlayer === PLAYER.ONE ? 'p1' : 'p2',
        `🃏 ${current.label} pioche une carte ${getCardDisplayName(card.type)}.`
      );
      setContextMessage('info', `Carte ${getCardDisplayName(card.type)} piochée.`);
      render();
    });
  }

  // ── Bascule Brouillard de Guerre
  // ── Bascule Brouillard de Guerre
  const btnFog = document.getElementById('fog-toggle');
  if (btnFog) {
    btnFog.addEventListener('click', () => {
      gameState.fogEnabled = !gameState.fogEnabled;
      btnFog.textContent = gameState.fogEnabled ? '👁 Brouillard ON' : '👁 Brouillard';
      render();
    });
  }
}

// ─────────────────────────────────────────────────────────
//  LANCEMENT
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  render();
  attachListeners();
});
