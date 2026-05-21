// ============================================================
// MORPION DUEL — game.js
// ============================================================

// ------------------------------------------------------------
// CONSTANTES GLOBALES
// ------------------------------------------------------------

const GRID_SIZE       = 3;
const TOTAL_CELLS     = GRID_SIZE * GRID_SIZE;
const PLAYER_1        = 1;
const PLAYER_2        = 2;
const SYMBOL_X        = 'X';
const SYMBOL_O        = 'O';
const STATE_PLAYING   = 'playing';
const STATE_WIN       = 'win';
const STATE_DRAW      = 'draw';

// Alias requis par les fonctions avancées
const EMPTY      = null;
const BOARD_SIZE = TOTAL_CELLS;
const PLAYER1    = PLAYER_1;
const PLAYER2    = PLAYER_2;

const PLAYER_SYMBOLS = {
  [PLAYER_1]: SYMBOL_X,
  [PLAYER_2]: SYMBOL_O,
};

const PLAYER_NAMES = {
  [PLAYER_1]: 'Joueur 1',
  [PLAYER_2]: 'Joueur 2',
};

const WIN_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const CSS = {
  CELL:           'cell',
  CELL_X:         'cell--x',
  CELL_O:         'cell--o',
  CELL_WIN:       'cell--win',
  CELL_TAKEN:     'cell--taken',
  ACTIVE_PLAYER:  'player--active',
  OVERLAY_WIN:    'overlay--win',
  OVERLAY_DRAW:   'overlay--draw',
  OVERLAY_HIDDEN: 'overlay--hidden',
};

const EVENTS = {
  STATE_CHANGED: 'stateChanged',
  GAME_OVER:     'gameOver',
  TURN_CHANGED:  'turnChanged',
};

const MAX_LOG_ENTRIES = 20;

// ------------------------------------------------------------
// ÉTAT GLOBAL DU JEU
// ------------------------------------------------------------

let gameState = {
  board:         [],
  currentPlayer: PLAYER_1,
  status:        STATE_PLAYING,
  winner:        null,
  winningCells:  [],
  scores: {
    [PLAYER_1]: 0,
    [PLAYER_2]: 0,
    draws:       0,
  },
  moveCount:  0,
  log:        [],
  gameNumber: 0,
};

// ------------------------------------------------------------
// HELPERS PURS
// ------------------------------------------------------------

function idx(row, col) {
  return row * GRID_SIZE + col;
}

function pos(index) {
  return {
    row: Math.floor(index / GRID_SIZE),
    col: index % GRID_SIZE,
  };
}

function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < TOTAL_CELLS;
}

function opponent(player) {
  return player === PLAYER_1 ? PLAYER_2 : PLAYER_1;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getEmptyCells(board) {
  return board.reduce((acc, cell, i) => {
    if (cell === null) acc.push(i);
    return acc;
  }, []);
}

function isCellEmpty(board, index) {
  return isValidIndex(index) && board[index] === null;
}

function countOccupied(board) {
  return board.filter(cell => cell !== null).length;
}

function getSymbol(player) {
  return PLAYER_SYMBOLS[player] || '?';
}

function getPlayerName(player) {
  return PLAYER_NAMES[player] || `Joueur ${player}`;
}

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function cloneBoard(board) {
  return [...board];
}

// ------------------------------------------------------------
// JOURNALISATION
// ------------------------------------------------------------

function addLog(message) {
  const entry = {
    time:    getTimestamp(),
    message: String(message),
  };
  gameState.log.push(entry);
  if (gameState.log.length > MAX_LOG_ENTRIES) {
    gameState.log.shift();
  }
}

// ------------------------------------------------------------
// INITIALISATION
// ------------------------------------------------------------

function buildGrid() {
  return Array(TOTAL_CELLS).fill(null);
}

function buildScores(previousScores) {
  if (previousScores) {
    return {
      [PLAYER_1]: previousScores[PLAYER_1] || 0,
      [PLAYER_2]: previousScores[PLAYER_2] || 0,
      draws:       previousScores.draws      || 0,
    };
  }
  return {
    [PLAYER_1]: 0,
    [PLAYER_2]: 0,
    draws:       0,
  };
}

function initGame(resetScores = false) {
  const previousScores = resetScores ? null : gameState.scores;

  gameState = {
    board:         buildGrid(),
    currentPlayer: PLAYER_1,
    status:        STATE_PLAYING,
    winner:        null,
    winningCells:  [],
    scores:        buildScores(previousScores),
    moveCount:     0,
    log:           [],
    gameNumber:    (gameState.gameNumber || 0) + 1,
  };

  addLog(`Partie ${gameState.gameNumber} démarrée. ${getPlayerName(PLAYER_1)} commence (${getSymbol(PLAYER_1)}).`);
}

// ------------------------------------------------------------
// LOGIQUE DE JEU
// ------------------------------------------------------------

function findWinningCombination(board, player) {
  for (const combo of WIN_COMBINATIONS) {
    if (combo.every(i => board[i] === player)) {
      return { found: true, cells: combo };
    }
  }
  return { found: false, cells: [] };
}

/**
 * Alias de findWinningCombination pour compatibilité avec les fonctions avancées.
 */
function checkWinCondition(board, player) {
  return { win: findWinningCombination(board, player).found };
}

function isBoardFull(board) {
  return board.every(cell => cell !== null);
}

function checkVictory() {
  const result = findWinningCombination(gameState.board, gameState.currentPlayer);

  if (result.found) {
    gameState.status       = STATE_WIN;
    gameState.winner       = gameState.currentPlayer;
    gameState.winningCells = result.cells;
    gameState.scores[gameState.currentPlayer] += 1;

    addLog(
      `🏆 ${getPlayerName(gameState.currentPlayer)} (${getSymbol(gameState.currentPlayer)}) ` +
      `gagne la partie ${gameState.gameNumber} !`
    );

    return {
      status:       STATE_WIN,
      winner:       gameState.currentPlayer,
      winningCells: result.cells,
    };
  }

  if (isBoardFull(gameState.board)) {
    gameState.status = STATE_DRAW;
    gameState.winner = null;
    gameState.scores.draws += 1;

    addLog(`🤝 Match nul ! La grille est pleine sans alignement (partie ${gameState.gameNumber}).`);

    return {
      status:       STATE_DRAW,
      winner:       null,
      winningCells: [],
    };
  }

  return {
    status:       STATE_PLAYING,
    winner:       null,
    winningCells: [],
  };
}

function checkDeath(player) {
  return gameState.status === STATE_PLAYING;
}

/**
 * Effectue le coup du joueur courant.
 * Le passage de tour est géré exclusivement par endTurn() / handleCellClick().
 */
function movePlayer(cellIndex) {
  if (gameState.status !== STATE_PLAYING) {
    return { success: false, message: 'La partie est terminée.' };
  }

  if (!isValidIndex(cellIndex)) {
    return { success: false, message: `Index invalide : ${cellIndex}.` };
  }

  if (!isCellEmpty(gameState.board, cellIndex)) {
    const { row, col } = pos(cellIndex);
    return {
      success: false,
      message: `La case (${row + 1}, ${col + 1}) est déjà occupée.`,
    };
  }

  const player       = gameState.currentPlayer;
  const symbol       = getSymbol(player);
  const { row, col } = pos(cellIndex);

  gameState.board[cellIndex] = player;
  gameState.moveCount += 1;

  addLog(
    `${getPlayerName(player)} (${symbol}) joue en ` +
    `ligne ${row + 1}, colonne ${col + 1} (case ${cellIndex}).`
  );

  // Vérification victoire / match nul — PAS de passage de tour ici
  checkVictory();

  return { success: true, message: `Coup joué en case ${cellIndex}.` };
}

// ------------------------------------------------------------
// GESTION DES TOURS
// ------------------------------------------------------------

/**
 * Passe la main à l'adversaire si la partie est toujours en cours.
 */
function endTurn() {
  if (gameState.status === STATE_PLAYING) {
    gameState.currentPlayer = opponent(gameState.currentPlayer);
    addLog(
      `C'est au tour de ${getPlayerName(gameState.currentPlayer)} ` +
      `(${getSymbol(gameState.currentPlayer)}).`
    );
  }
}

// ------------------------------------------------------------
// RENDU DOM
// ------------------------------------------------------------

/**
 * Renvoie l'élément DOM d'une cellule par son index.
 */
function getCellElement(index) {
  return document.querySelector(`[data-index="${index}"]`);
}

/**
 * Met à jour l'affichage d'une cellule.
 */
function renderCell(index) {
  const cell   = getCellElement(index);
  if (!cell) return;

  const owner  = gameState.board[index];
  const isWin  = gameState.winningCells.includes(index);

  // Réinitialiser les classes
  cell.classList.remove(CSS.CELL_X, CSS.CELL_O, CSS.CELL_WIN, CSS.CELL_TAKEN);
  cell.innerHTML = '';

  if (owner === PLAYER_1) {
    cell.classList.add(CSS.CELL_X, CSS.CELL_TAKEN);
    const img = document.createElement('img');
    img.src = 'assets/symbol_x.svg';
    img.alt = 'X';
    cell.appendChild(img);
  } else if (owner === PLAYER_2) {
    cell.classList.add(CSS.CELL_O, CSS.CELL_TAKEN);
    const img = document.createElement('img');
    img.src = 'assets/symbol_o.svg';
    img.alt = 'O';
    cell.appendChild(img);
  }

  if (isWin) {
    cell.classList.add(CSS.CELL_WIN);
  }
}

/**
 * Redessine toutes les cellules.
 */
function renderBoard() {
  for (let i = 0; i < TOTAL_CELLS; i++) {
    renderCell(i);
  }
}

/**
 * Met à jour l'indicateur de joueur actif.
 */
function renderPlayerIndicator() {
  const p1El = document.getElementById('player1-indicator');
  const p2El = document.getElementById('player2-indicator');

  if (!p1El || !p2El) return;

  if (gameState.status !== STATE_PLAYING) {
    p1El.classList.remove(CSS.ACTIVE_PLAYER);
    p2El.classList.remove(CSS.ACTIVE_PLAYER);
    return;
  }

  if (gameState.currentPlayer === PLAYER_1) {
    p1El.classList.add(CSS.ACTIVE_PLAYER);
    p2El.classList.remove(CSS.ACTIVE_PLAYER);
  } else {
    p2El.classList.add(CSS.ACTIVE_PLAYER);
    p1El.classList.remove(CSS.ACTIVE_PLAYER);
  }
}

/**
 * Met à jour l'affichage des scores.
 */
function renderScores() {
  const s1 = document.getElementById('score-player1');
  const s2 = document.getElementById('score-player2');
  const sd = document.getElementById('score-draws');

  if (s1) s1.textContent = gameState.scores[PLAYER_1];
  if (s2) s2.textContent = gameState.scores[PLAYER_2];
  if (sd) sd.textContent = gameState.scores.draws;
}

/**
 * Affiche ou masque l'overlay de fin de partie.
 */
function renderOverlay() {
  const overlay = document.getElementById('game-overlay');
  if (!overlay) return;

  if (gameState.status === STATE_PLAYING) {
    overlay.classList.add(CSS.OVERLAY_HIDDEN);
    overlay.classList.remove(CSS.OVERLAY_WIN, CSS.OVERLAY_DRAW);
    return;
  }

  overlay.classList.remove(CSS.OVERLAY_HIDDEN);

  const bannerImg  = overlay.querySelector('#overlay-banner');
  const messageEl  = overlay.querySelector('#overlay-message');

  if (gameState.status === STATE_WIN) {
    overlay.classList.add(CSS.OVERLAY_WIN);
    overlay.classList.remove(CSS.OVERLAY_DRAW);
    if (bannerImg) bannerImg.src = 'assets/banner_win.svg';
    if (messageEl) messageEl.textContent =
      `${getPlayerName(gameState.winner)} (${getSymbol(gameState.winner)}) gagne !`;
  } else if (gameState.status === STATE_DRAW) {
    overlay.classList.add(CSS.OVERLAY_DRAW);
    overlay.classList.remove(CSS.OVERLAY_WIN);
    if (bannerImg) bannerImg.src = 'assets/banner_draw.svg';
    if (messageEl) messageEl.textContent = 'Match nul !';
  }
}

/**
 * Met à jour le journal affiché dans le panneau d'info.
 */
function renderLog() {
  const logEl = document.getElementById('game-log');
  if (!logEl) return;

  logEl.innerHTML = '';
  [...gameState.log].reverse().forEach(entry => {
    const line = document.createElement('li');
    // Correction : afficher correctement les objets { time, message }
    line.textContent = entry.time
      ? '[' + entry.time + '] ' + entry.message
      : entry.message;
    logEl.appendChild(line);
  });
}

/**
 * Met à jour l'indicateur de tour textuel.
 */
function renderTurnInfo() {
  const turnEl = document.getElementById('turn-info');
  if (!turnEl) return;

  if (gameState.status === STATE_PLAYING) {
    turnEl.textContent =
      `Tour de ${getPlayerName(gameState.currentPlayer)} (${getSymbol(gameState.currentPlayer)})`;
  } else if (gameState.status === STATE_WIN) {
    turnEl.textContent =
      `${getPlayerName(gameState.winner)} a gagné !`;
  } else {
    turnEl.textContent = 'Match nul !';
  }
}

/**
 * Redessine l'intégralité de l'interface.
 */
function renderAll() {
  renderBoard();
  renderPlayerIndicator();
  renderScores();
  renderOverlay();
  renderLog();
  renderTurnInfo();
}

// ------------------------------------------------------------
// GESTION DES ÉVÉNEMENTS
// ------------------------------------------------------------

/**
 * Gestionnaire de clic sur une cellule.
 */
function handleCellClick(event) {
  const cell  = event.currentTarget;
  const index = parseInt(cell.dataset.index, 10);

  const result = movePlayer(index);

  if (!result.success) {
    // Coup invalide : ne rien faire (ou afficher un feedback)
    return;
  }

  // Si la partie est toujours en cours, passer le tour
  if (gameState.status === STATE_PLAYING) {
    endTurn();
  }

  renderAll();
}

/**
 * Gestionnaire du bouton "Nouvelle partie".
 */
function handleNewGame() {
  initGame(false);
  renderAll();
}

/**
 * Gestionnaire du bouton "Réinitialiser les scores".
 */
function handleResetScores() {
  initGame(true);
  renderAll();
}

// ------------------------------------------------------------
// CONSTRUCTION DE LA GRILLE DOM
// ------------------------------------------------------------

/**
 * Génère les 9 cellules cliquables dans #game-board.
 */
function buildBoardDOM() {
  const boardEl = document.getElementById('game-board');
  if (!boardEl) return;

  boardEl.innerHTML = '';

  // Image de fond du plateau
  const boardBg = document.createElement('img');
  boardBg.src   = 'assets/board.svg';
  boardBg.alt   = 'Plateau de jeu';
  boardBg.id    = 'board-bg';
  boardEl.appendChild(boardBg);

  // Grille des cellules
  const grid = document.createElement('div');
  grid.id    = 'cell-grid';
  boardEl.appendChild(grid);

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cell        = document.createElement('div');
    cell.classList.add(CSS.CELL);
    cell.dataset.index = String(i);
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `Case ${i + 1}`);
    cell.addEventListener('click', handleCellClick);
    grid.appendChild(cell);
  }
}

/**
 * Attache les écouteurs aux boutons statiques du HTML.
 */
function bindStaticControls() {
  const btnNew   = document.getElementById('btn-new-game');
  const btnReset = document.getElementById('btn-reset-scores');
  const btnReplay = document.getElementById('btn-replay');

  if (btnNew)    btnNew.addEventListener('click', handleNewGame);
  if (btnReset)  btnReset.addEventListener('click', handleResetScores);
  if (btnReplay) btnReplay.addEventListener('click', handleNewGame);
}

// ------------------------------------------------------------
// CONSTRUCTION DU PANNEAU D'INFO
// ------------------------------------------------------------

/**
 * Génère les indicateurs de joueurs dans #info-panel si absents.
 */
function buildInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (!panel) return;

  // Indicateur Joueur 1
  let p1 = document.getElementById('player1-indicator');
  if (!p1) {
    p1    = document.createElement('div');
    p1.id = 'player1-indicator';
    p1.classList.add('player-indicator');
    const img  = document.createElement('img');
    img.src    = 'assets/indicator_player1.svg';
    img.alt    = 'Joueur 1';
    const span = document.createElement('span');
    span.textContent = 'Joueur 1 (X)';
    const score      = document.createElement('span');
    score.id         = 'score-player1';
    score.classList.add('score');
    score.textContent = '0';
    p1.appendChild(img);
    p1.appendChild(span);
    p1.appendChild(score);
    panel.appendChild(p1);
  }

  // Indicateur Joueur 2
  let p2 = document.getElementById('player2-indicator');
  if (!p2) {
    p2    = document.createElement('div');
    p2.id = 'player2-indicator';
    p2.classList.add('player-indicator');
    const img  = document.createElement('img');
    img.src    = 'assets/indicator_player2.svg';
    img.alt    = 'Joueur 2';
    const span = document.createElement('span');
    span.textContent = 'Joueur 2 (O)';
    const score      = document.createElement('span');
    score.id         = 'score-player2';
    score.classList.add('score');
    score.textContent = '0';
    p2.appendChild(img);
    p2.appendChild(span);
    p2.appendChild(score);
    panel.appendChild(p2);
  }

  // Compteur de matchs nuls
  let drawsEl = document.getElementById('score-draws-container');
  if (!drawsEl) {
    drawsEl    = document.createElement('div');
    drawsEl.id = 'score-draws-container';
    drawsEl.classList.add('draws-container');
    const label      = document.createElement('span');
    label.textContent = 'Nuls : ';
    const score      = document.createElement('span');
    score.id         = 'score-draws';
    score.textContent = '0';
    drawsEl.appendChild(label);
    drawsEl.appendChild(score);
    panel.appendChild(drawsEl);
  }

  // Info de tour
  let turnEl = document.getElementById('turn-info');
  if (!turnEl) {
    turnEl    = document.createElement('div');
    turnEl.id = 'turn-info';
    turnEl.classList.add('turn-info');
    panel.appendChild(turnEl);
  }

  // Journal
  let logContainer = document.getElementById('log-container');
  if (!logContainer) {
    logContainer    = document.createElement('div');
    logContainer.id = 'log-container';
    const title     = document.createElement('h3');
    title.textContent = 'Journal';
    const logList   = document.createElement('ul');
    logList.id      = 'game-log';
    logContainer.appendChild(title);
    logContainer.appendChild(logList);
    panel.appendChild(logContainer);
  }
}

// ------------------------------------------------------------
// OVERLAY DE FIN DE PARTIE
// ------------------------------------------------------------

/**
 * Crée l'overlay de fin de partie dans le DOM s'il est absent.
 */
function buildOverlay() {
  let overlay = document.getElementById('game-overlay');
  if (overlay) return;

  overlay    = document.createElement('div');
  overlay.id = 'game-overlay';
  overlay.classList.add(CSS.OVERLAY_HIDDEN);

  const banner      = document.createElement('img');
  banner.id         = 'overlay-banner';
  banner.alt        = 'Résultat';

  const message     = document.createElement('p');
  message.id        = 'overlay-message';

  const replayBtn   = document.createElement('button');
  replayBtn.id      = 'btn-replay';

  const replayImg   = document.createElement('img');
  replayImg.src     = 'assets/button_replay.svg';
  replayImg.alt     = 'Rejouer';
  replayBtn.appendChild(replayImg);
  replayBtn.addEventListener('click', handleNewGame);

  overlay.appendChild(banner);
  overlay.appendChild(message);
  overlay.appendChild(replayBtn);

  document.body.appendChild(overlay);
}

// ------------------------------------------------------------
// POINT D'ENTRÉE
// ------------------------------------------------------------

/**
 * Initialise tout le jeu au chargement de la page.
 */
function startApp() {
  buildBoardDOM();
  buildInfoPanel();
  buildOverlay();
  bindStaticControls();
  initGame(true);
  renderAll();
}

document.addEventListener('DOMContentLoaded', startApp);