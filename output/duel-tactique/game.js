// game.js

const gameState = {
  board: [],
  currentPlayer: 1,
  actionPoints: 3,
  selectedCell: null,
  validMoves: [],
  log: [],
  gameOver: false,
  winner: null,
  phase: 'select', // 'select' | 'move'
};

const UNIT_TYPES = {
  GENERAL: 'General',
  SOLDIER: 'Soldier',
  KNIGHT: 'Knight',
  TOWER: 'Tower',
};

const UNIT_COSTS = {
  [UNIT_TYPES.GENERAL]: 1,
  [UNIT_TYPES.SOLDIER]: 1,
  [UNIT_TYPES.KNIGHT]: 1,
  [UNIT_TYPES.TOWER]: 2,
};

const UNIT_RANGE = {
  [UNIT_TYPES.GENERAL]: 1,
  [UNIT_TYPES.SOLDIER]: 1,
  [UNIT_TYPES.KNIGHT]: 2,
  [UNIT_TYPES.TOWER]: 3,
};

const UNIT_SYMBOLS = {
  [UNIT_TYPES.GENERAL]: '♔',
  [UNIT_TYPES.SOLDIER]: '♟',
  [UNIT_TYPES.KNIGHT]: '♞',
  [UNIT_TYPES.TOWER]: '♜',
};

function createUnit(type, player) {
  return { type, player, id: Math.random().toString(36).substr(2, 9) };
}

function initBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Player 2 (top, red) - row 0 and 1
  board[0][3] = createUnit(UNIT_TYPES.TOWER, 2);
  board[0][4] = createUnit(UNIT_TYPES.GENERAL, 2);
  board[0][5] = createUnit(UNIT_TYPES.TOWER, 2);
  board[0][2] = createUnit(UNIT_TYPES.KNIGHT, 2);
  board[0][6] = createUnit(UNIT_TYPES.KNIGHT, 2);
  for (let c = 1; c <= 6; c++) {
    board[1][c] = createUnit(UNIT_TYPES.SOLDIER, 2);
  }

  // Player 1 (bottom, blue) - row 7 and 6
  board[7][3] = createUnit(UNIT_TYPES.TOWER, 1);
  board[7][4] = createUnit(UNIT_TYPES.GENERAL, 1);
  board[7][5] = createUnit(UNIT_TYPES.TOWER, 1);
  board[7][2] = createUnit(UNIT_TYPES.KNIGHT, 1);
  board[7][6] = createUnit(UNIT_TYPES.KNIGHT, 1);
  for (let c = 1; c <= 6; c++) {
    board[6][c] = createUnit(UNIT_TYPES.SOLDIER, 1);
  }

  return board;
}

function addLog(message) {
  gameState.log.unshift(message);
  if (gameState.log.length > 5) gameState.log = gameState.log.slice(0, 5);
}

function getValidMoves(row, col) {
  const unit = gameState.board[row][col];
  if (!unit) return [];

  const moves = [];
  const range = UNIT_RANGE[unit.type];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    for (let step = 1; step <= range; step++) {
      const nr = row + dr * step;
      const nc = col + dc * step;

      if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;

      const target = gameState.board[nr][nc];
      if (target) {
        if (target.player !== unit.player) {
          moves.push({ row: nr, col: nc, capture: true });
        }
        break; // blocked
      } else {
        moves.push({ row: nr, col: nc, capture: false });
      }
    }
  }

  return moves;
}

function isGeneralEncircled(player) {
  let genRow = -1, genCol = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const u = gameState.board[r][c];
      if (u && u.type === UNIT_TYPES.GENERAL && u.player === player) {
        genRow = r; genCol = c;
      }
    }
  }
  if (genRow === -1) return false;

  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of directions) {
    const nr = genRow + dr;
    const nc = genCol + dc;
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
    const target = gameState.board[nr][nc];
    if (!target || target.player === player) return false;
  }
  return true;
}

function checkVictory() {
  // Check if general was captured
  for (let p = 1; p <= 2; p++) {
    let hasGeneral = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const u = gameState.board[r][c];
        if (u && u.type === UNIT_TYPES.GENERAL && u.player === p) {
          hasGeneral = true;
        }
      }
    }
    if (!hasGeneral) {
      gameState.gameOver = true;
      gameState.winner = p === 1 ? 2 : 1;
      return true;
    }
  }

  // Check encirclement at start of current player's turn
  if (isGeneralEncircled(gameState.currentPlayer)) {
    gameState.gameOver = true;
    gameState.winner = gameState.currentPlayer === 1 ? 2 : 1;
    return true;
  }

  return false;
}

function handleCellClick(row, col) {
  if (gameState.gameOver) return;

  const unit = gameState.board[row][col];

  if (gameState.phase === 'select') {
    if (unit && unit.player === gameState.currentPlayer) {
      const cost = UNIT_COSTS[unit.type];
      if (gameState.actionPoints < cost) {
        addLog(`Pas assez de PA pour activer ce ${unit.type}.`);
        render();
        return;
      }
      gameState.selectedCell = { row, col };
      gameState.validMoves = getValidMoves(row, col);
      gameState.phase = 'move';
      render();
    }
  } else if (gameState.phase === 'move') {
    // Deselect if clicking same cell
    if (gameState.selectedCell.row === row && gameState.selectedCell.col === col) {
      gameState.selectedCell = null;
      gameState.validMoves = [];
      gameState.phase = 'select';
      render();
      return;
    }

    // Check if valid move
    const move = gameState.validMoves.find(m => m.row === row && m.col === col);
    if (move) {
      executeMove(gameState.selectedCell.row, gameState.selectedCell.col, row, col, move.capture);
    } else if (unit && unit.player === gameState.currentPlayer) {
      // Select a different friendly unit
      const cost = UNIT_COSTS[unit.type];
      if (gameState.actionPoints < cost) {
        addLog(`Pas assez de PA pour activer ce ${unit.type}.`);
        gameState.selectedCell = null;
        gameState.validMoves = [];
        gameState.phase = 'select';
        render();
        return;
      }
      gameState.selectedCell = { row, col };
      gameState.validMoves = getValidMoves(row, col);
      render();
    } else {
      gameState.selectedCell = null;
      gameState.validMoves = [];
      gameState.phase = 'select';
      render();
    }
  }
}

function executeMove(fromRow, fromCol, toRow, toCol, capture) {
  const unit = gameState.board[fromRow][fromCol];
  const cost = UNIT_COSTS[unit.type];
  const targetUnit = gameState.board[toRow][toCol];

  gameState.actionPoints -= cost;

  if (capture && targetUnit) {
    const capturedSymbol = UNIT_SYMBOLS[targetUnit.type];
    addLog(`J${gameState.currentPlayer}: ${UNIT_SYMBOLS[unit.type]} capture ${capturedSymbol} en (${toRow + 1},${toCol + 1})`);
  } else {
    addLog(`J${gameState.currentPlayer}: ${UNIT_SYMBOLS[unit.type]} → (${toRow + 1},${toCol + 1})`);
  }

  gameState.board[toRow][toCol] = unit;
  gameState.board[fromRow][fromCol] = null;

  // Check victory after move
  if (checkVictory()) {
    gameState.selectedCell = null;
    gameState.validMoves = [];
    gameState.phase = 'select';
    render();
    return;
  }

  // After move, keep unit selected if player has PA to continue
  if (gameState.actionPoints >= cost) {
    gameState.selectedCell = { row: toRow, col: toCol };
    gameState.validMoves = getValidMoves(toRow, toCol);
    // If no valid moves or 0 AP, deselect
    if (gameState.validMoves.length === 0 || gameState.actionPoints === 0) {
      gameState.selectedCell = null;
      gameState.validMoves = [];
      gameState.phase = 'select';
    }
  } else {
    gameState.selectedCell = null;
    gameState.validMoves = [];
    gameState.phase = 'select';
  }

  if (gameState.actionPoints === 0) {
    endTurn();
    return;
  }

  render();
}

function endTurn() {
  addLog(`── Fin du tour du Joueur ${gameState.currentPlayer} ──`);
  gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
  gameState.actionPoints = 3;
  gameState.selectedCell = null;
  gameState.validMoves = [];
  gameState.phase = 'select';

  if (checkVictory()) {
    render();
    return;
  }

  render();
}

function newGame() {
  gameState.board = initBoard();
  gameState.currentPlayer = 1;
  gameState.actionPoints = 3;
  gameState.selectedCell = null;
  gameState.validMoves = [];
  gameState.log = [];
  gameState.gameOver = false;
  gameState.winner = null;
  gameState.phase = 'select';
  addLog('── Nouvelle partie ──');
  render();
}

function render() {
  renderBoard();
  renderInfoPanel();
  renderLog();
  renderVictoryScreen();
}

function renderBoard() {
  const boardEl = document.getElementById('game-board');
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      // Checkerboard
      if ((r + c) % 2 === 0) {
        cell.classList.add('cell-light');
      } else {
        cell.classList.add('cell-dark');
      }

      // Selected cell
      if (gameState.selectedCell && gameState.selectedCell.row === r && gameState.selectedCell.col === c) {
        cell.classList.add('cell-selected');
      }

      // Valid move highlight
      const isValidMove = gameState.validMoves.find(m => m.row === r && m.col === c);
      if (isValidMove) {
        cell.classList.add(isValidMove.capture ? 'cell-capture' : 'cell-valid');
      }

      // Coordinate label
      const coord = document.createElement('span');
      coord.className = 'cell-coord';
      coord.textContent = `${r + 1},${c + 1}`;
      cell.appendChild(coord);

      // Unit
      const unit = gameState.board[r][c];
      if (unit) {
        const unitEl = document.createElement('div');
        unitEl.className = `unit unit-p${unit.player} unit-${unit.type.toLowerCase()}`;
        if (unit.type === UNIT_TYPES.GENERAL) unitEl.classList.add('unit-general');

        const symbol = document.createElement('span');
        symbol.className = 'unit-symbol';
        symbol.textContent = UNIT_SYMBOLS[unit.type];
        unitEl.appendChild(symbol);

        const label = document.createElement('span');
        label.className = 'unit-label';
        label.textContent = unit.type === UNIT_TYPES.GENERAL ? 'Gén.' :
          unit.type === UNIT_TYPES.SOLDIER ? 'Sol.' :
          unit.type === UNIT_TYPES.KNIGHT ? 'Cav.' : 'Tour';
        unitEl.appendChild(label);

        // Show cost
        const costEl = document.createElement('span');
        costEl.className = 'unit-cost';
        costEl.textContent = `${UNIT_COSTS[unit.type]}PA`;
        unitEl.appendChild(costEl);

        cell.appendChild(unitEl);
      }

      cell.addEventListener('click', () => handleCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function renderInfoPanel() {
  const panel = document.getElementById('info-panel');

  const p1Active = gameState.currentPlayer === 1 && !gameState.gameOver;
  const p2Active = gameState.currentPlayer === 2 && !gameState.gameOver;

  panel.innerHTML = `
    <div class="turn-indicator ${p1Active ? 'active-p1' : ''} ${p2Active ? 'active-p2' : ''}">
      ${gameState.gameOver
        ? `🏆 Partie terminée`
        : `Tour du <strong>Joueur ${gameState.currentPlayer}</strong> (${gameState.currentPlayer === 1 ? 'Bleu' : 'Rouge'})`
      }
    </div>
    <div class="players-panel">
      <div class="player-card ${p1Active ? 'player-active' : ''}">
        <div class="player-header player-1-header">
          <span class="player-icon">♔</span>
          <span>Joueur 1 — Bleu</span>
          ${p1Active ? '<span class="active-badge">Actif</span>' : ''}
        </div>
        <div class="pa-display">
          <span class="pa-label">Points d'Action</span>
          <div class="pa-dots">
            ${[0,1,2].map(i => `<div class="pa-dot ${p1Active && i < gameState.actionPoints ? 'pa-dot-active' : ''}"></div>`).join('')}
          </div>
          ${p1Active ? `<span class="pa-count">${gameState.actionPoints}/3 PA</span>` : ''}
        </div>
      </div>
      <div class="player-card ${p2Active ? 'player-active' : ''}">
        <div class="player-header player-2-header">
          <span class="player-icon">♔</span>
          <span>Joueur 2 — Rouge</span>
          ${p2Active ? '<span class="active-badge">Actif</span>' : ''}
        </div>
        <div class="pa-display">
          <span class="pa-label">Points d'Action</span>
          <div class="pa-dots">
            ${[0,1,2].map(i => `<div class="pa-dot ${p2Active && i < gameState.actionPoints ? 'pa-dot-active-red' : ''}"></div>`).join('')}
          </div>
          ${p2Active ? `<span class="pa-count">${gameState.actionPoints}/3 PA</span>` : ''}
        </div>
      </div>
    </div>
    <div class="legend">
      <div class="legend-title">Légende des unités</div>
      <div class="legend-grid">
        <div class="legend-item"><span class="legend-sym">♔</span> Général — 1PA — 1 case</div>
        <div class="legend-item"><span class="legend-sym">♟</span> Soldat — 1PA — 1 case</div>
        <div class="legend-item"><span class="legend-sym">♞</span> Cavalier — 1PA — 2 cases</div>
        <div class="legend-item"><span class="legend-sym">♜</span> Tour — 2PA — 3 cases</div>
      </div>
    </div>
    <div class="actions-bar">
      ${!gameState.gameOver ? `<button id="btn-end-turn" class="btn-end-turn">Fin de tour</button>` : ''}
      <button id="btn-new-game" class="btn-new-game">Nouvelle partie</button>
    </div>
    <div class="phase-hint">
      ${gameState.gameOver ? '' :
        gameState.phase === 'select'
          ? '👆 Sélectionnez une de vos unités'
          : '➡️ Choisissez une destination (clic sur unité = resélectionner)'
      }
    </div>
  `;

  const btnEndTurn = document.getElementById('btn-end-turn');
  if (btnEndTurn) btnEndTurn.addEventListener('click', () => { if (!gameState.gameOver) endTurn(); });

  const btnNewGame = document.getElementById('btn-new-game');
  if (btnNewGame) btnNewGame.addEventListener('click', newGame);
}

function renderLog() {
  const logEl = document.getElementById('game-log');
  if (!logEl) return;
  logEl.innerHTML = gameState.log
    .map((entry, i) => `<div class="log-entry ${i === 0 ? 'log-latest' : ''}">${entry}</div>`)
    .join('');
}

function renderVictoryScreen() {
  let overlay = document.getElementById('victory-overlay');

  if (!gameState.gameOver) {
    if (overlay) overlay.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'victory-overlay';
    document.body.appendChild(overlay);
  }

  const winnerName = gameState.winner === 1 ? 'Joueur 1 (Bleu)' : 'Joueur 2 (Rouge)';
  const winnerClass = gameState.winner === 1 ? 'winner-blue' : 'winner-red';

  overlay.innerHTML = `
    <div class="victory-box ${winnerClass}">
      <div class="victory-trophy">🏆</div>
      <h2 class="victory-title">Victoire !</h2>
      <p class="victory-subtitle">${winnerName} remporte la partie !</p>
      <p class="victory-desc">Le Général adverse a été capturé ou encerclé.</p>
      <button class="victory-btn" id="victory-new-game">Nouvelle partie</button>
    </div>
  `;

  document.getElementById('victory-new-game').addEventListener('click', () => {
    newGame();
    overlay.remove();
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  newGame();
});