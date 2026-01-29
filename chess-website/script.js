document.addEventListener("DOMContentLoaded", () => {
  const home = document.getElementById("home");
  const boardScreen = document.getElementById("boardScreen");
  const winnerScreen = document.getElementById("winnerScreen");
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const notificationsEl = document.getElementById("notifications");
  const winnerTitle = document.getElementById("winnerTitle");
  const winnerMessage = document.getElementById("winnerMessage");

  const startBtn = document.getElementById("startGame");
  const startLocalMultiplayerBtn = document.getElementById("startLocalMultiplayer");
  const backBtn = document.getElementById("backBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const exitBtn = document.getElementById("exitBtn");
  const themeToggle = document.getElementById("themeToggle");
  const undoBtn = document.getElementById("undoBtn");
  const difficultySelect = document.getElementById("difficulty");
  const statsEl = document.getElementById("stats");
  const moveHistoryEl = document.getElementById("moveHistory");

  if (!boardEl || !startBtn) {
    console.error("Critical DOM elements missing.");
    return;
  }

  const initialBoard = [
    ["♜","♞","♝","♛","♚","♝","♞","♜"],
    ["♟","♟","♟","♟","♟","♟","♟","♟"],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["♙","♙","♙","♙","♙","♙","♙","♙"],
    ["♖","♘","♗","♕","♔","♗","♘","♖"],
  ];

  let board, selected = null, validMoves = [], whiteTurn = true, gameOver = false, isLocalMultiplayer = false;
  let moveHistory = [];
  let boardHistory = [];
  let difficulty = "medium";
  
  // Depth: Easy = 1 (dumb), Medium = 2 (okay), Hard = 3 (slow but decent)
  const difficultyDepth = { easy: 1, medium: 2, hard: 3 };

  function resetGame() {
    board = JSON.parse(JSON.stringify(initialBoard));
    selected = null;
    validMoves = [];
    whiteTurn = true;
    gameOver = false;
    moveHistory = [];
    boardHistory = [];
    notificationsEl.textContent = "";
    updateStats();
    updateMoveHistory();
    renderBoard();
    updateStatus();
  }

  // --- Helper Functions ---
  function isWhite(p) { return "♙♖♘♗♕♔".includes(p); }
  function isBlack(p) { return "♟♜♞♝♛♚".includes(p); }

  function findKingOnBoard(testBoard, isWhiteKing) {
    const king = isWhiteKing ? "♔" : "♚";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (testBoard[r][c] === king) return { r, c };
      }
    }
    return null;
  }

  function pieceValue(p) {
    // Standard chess piece values
    const map = {"♙":10, "♟":10, "♘":30, "♞":30, "♗":30, "♝":30, "♖":50, "♜":50, "♕":90, "♛":90, "♔":900, "♚":900};
    return map[p] || 0;
  }

  // --- Move Validation Logic ---
  
  function getLegalMovesOnBoard(testBoard, r, c) {
    const piece = testBoard[r][c];
    if (!piece) return [];
    
    const moves = [];
    const isWhitePiece = isWhite(piece);
    
    const dirs = {
      rook: [[1,0],[-1,0],[0,1],[0,-1]],
      bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
      queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
      knight: [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]
    };

    function addMoveIfValid(nr, nc) {
      if (nr>=0 && nr<8 && nc>=0 && nc<8) {
        const target = testBoard[nr][nc];
        // Empty or enemy
        if (!target || isWhite(target) !== isWhitePiece) {
          moves.push({r: nr, c: nc});
        }
      }
    }

    function slide(directions) {
      directions.forEach(([dr, dc]) => {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = testBoard[nr][nc];
          if (!target) {
            moves.push({r: nr, c: nc});
          } else {
            if (isWhite(target) !== isWhitePiece) moves.push({r: nr, c: nc});
            break; // Blocked
          }
          nr += dr; nc += dc;
        }
      });
    }

    // Pawn Logic
    if (piece === "♙") {
      if (r>0 && !testBoard[r-1][c]) moves.push({r:r-1,c});
      if (r===6 && !testBoard[r-1][c] && !testBoard[r-2][c]) moves.push({r:r-2,c});
      // Captures
      if(r>0 && c>0 && testBoard[r-1][c-1] && isBlack(testBoard[r-1][c-1])) moves.push({r:r-1,c:c-1});
      if(r>0 && c<7 && testBoard[r-1][c+1] && isBlack(testBoard[r-1][c+1])) moves.push({r:r-1,c:c+1});
    }
    else if (piece === "♟") {
      if (r<7 && !testBoard[r+1][c]) moves.push({r:r+1,c});
      if (r===1 && !testBoard[r+1][c] && !testBoard[r+2][c]) moves.push({r:r+2,c});
      // Captures
      if(r<7 && c>0 && testBoard[r+1][c-1] && isWhite(testBoard[r+1][c-1])) moves.push({r:r+1,c:c-1});
      if(r<7 && c<7 && testBoard[r+1][c+1] && isWhite(testBoard[r+1][c+1])) moves.push({r:r+1,c:c+1});
    }
    // Other pieces
    else if (piece === "♖" || piece === "♜") slide(dirs.rook);
    else if (piece === "♗" || piece === "♝") slide(dirs.bishop);
    else if (piece === "♕" || piece === "♛") slide(dirs.queen);
    else if (piece === "♘" || piece === "♞") {
      dirs.knight.forEach(([dr, dc]) => addMoveIfValid(r+dr, c+dc));
    }
    else if (piece === "♔" || piece === "♚") {
      dirs.queen.forEach(([dr, dc]) => addMoveIfValid(r+dr, c+dc));
    }

    return moves;
  }

  function isSquareUnderAttack(testBoard, row, col, byWhiteAttacker) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = testBoard[r][c];
        if (p && isWhite(p) === byWhiteAttacker) {
          const rawMoves = getLegalMovesOnBoard(testBoard, r, c); // Warning: this can cause recursion if not careful, but for attack check we just need raw moves
          if (rawMoves.some(m => m.r === row && m.c === col)) return true;
        }
      }
    }
    return false;
  }

  // Get Valid Moves (Checking for Check)
  function getLegalMoves(r, c) {
    const rawMoves = getLegalMovesOnBoard(board, r, c);
    const piece = board[r][c];
    const isWhitePiece = isWhite(piece);

    // Filter moves that leave king in check
    return rawMoves.filter(m => {
      // Simulate move
      const savedPiece = board[m.r][m.c];
      board[m.r][m.c] = piece;
      board[r][c] = "";
      
      const myKing = findKingOnBoard(board, isWhitePiece);
      let inCheck = false;
      if (myKing) {
        inCheck = isSquareUnderAttack(board, myKing.r, myKing.c, !isWhitePiece);
      }
      
      // Undo simulation
      board[r][c] = piece;
      board[m.r][m.c] = savedPiece;
      
      return !inCheck;
    });
  }

  function isInCheck(isWhiteTurn) {
    const king = findKingOnBoard(board, isWhiteTurn);
    if (!king) return true; // technically lost if king gone
    return isSquareUnderAttack(board, king.r, king.c, !isWhiteTurn);
  }

  function hasAnyLegalMoves(isWhiteTurn) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && isWhite(p) === isWhiteTurn) {
          if (getLegalMoves(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  // --- Game Flow ---

  function checkGameEnd() {
    const whiteKing = findKingOnBoard(board, true);
    const blackKing = findKingOnBoard(board, false);

    if (!whiteKing) { triggerWin(false); return true; }
    if (!blackKing) { triggerWin(true); return true; }

    if (!hasAnyLegalMoves(whiteTurn)) {
      if (isInCheck(whiteTurn)) {
        triggerWin(!whiteTurn); // Checkmate
      } else {
        triggerWin(null); // Stalemate
      }
      return true;
    }
    
    // Check warning
    if (isInCheck(whiteTurn)) {
      notificationsEl.textContent = "⚠️ Check!";
    } else {
      notificationsEl.textContent = "";
    }
    return false;
  }

  function triggerWin(whiteWon) {
    gameOver = true;
    winnerScreen.classList.remove("hidden");
    if (whiteWon === null) {
      winnerTitle.textContent = "Stalemate";
      winnerMessage.textContent = "It's a draw!";
    } else {
      winnerTitle.textContent = whiteWon ? "White Wins!" : "Black Wins!";
      winnerMessage.textContent = whiteWon ? "Checkmate!" : "Checkmate! The AI wins.";
    }
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    board.forEach((row, r) => {
      row.forEach((piece, c) => {
        const sq = document.createElement("div");
        sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark-square");
        
        if (selected && selected.r === r && selected.c === c) sq.classList.add("selected");
        if (validMoves.some(m => m.r === r && m.c === c)) sq.classList.add("valid");

        sq.textContent = piece;
        sq.onclick = () => onSquareClick(r, c);
        boardEl.appendChild(sq);
      });
    });
  }

  function onSquareClick(r, c) {
    if (gameOver) return;
    if (!isLocalMultiplayer && !whiteTurn) return; // Wait for AI

    const piece = board[r][c];
    
    // Move existing selection
    if (selected) {
      const move = validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        makeMove(selected.r, selected.c, r, c);
        selected = null;
        validMoves = [];
        renderBoard();
        
        if (checkGameEnd()) return;

        if (!isLocalMultiplayer && !whiteTurn) {
          statusEl.textContent = "AI is thinking...";
          setTimeout(aiMakeMove, 100);
        }
        return;
      }
    }

    // Select new piece
    if (piece && isWhite(piece) === whiteTurn) {
      selected = { r, c };
      validMoves = getLegalMoves(r, c);
      renderBoard();
      updateStatus();
    } else {
      selected = null;
      validMoves = [];
      renderBoard();
    }
  }

  function makeMove(sr, sc, tr, tc) {
    // Push history
    boardHistory.push(board.map(row => [...row]));
    
    const piece = board[sr][sc];
    const target = board[tr][tc];
    const capture = target ? "x" : "";
    
    board[tr][tc] = piece;
    board[sr][sc] = "";
    
    whiteTurn = !whiteTurn;
    
    // Log
    const from = String.fromCharCode(97+sc) + (8-sr);
    const to = String.fromCharCode(97+tc) + (8-tr);
    moveHistory.push(`${piece} ${from}${capture}${to}`);
    
    updateMoveHistory();
    updateStats();
    updateStatus();
  }

  function updateStatus() {
    if (gameOver) return;
    const turnName = whiteTurn ? "White" : "Black";
    statusEl.textContent = `${turnName}'s Turn`;
  }

  function updateStats() {
    let wVal = 0, bVal = 0;
    board.flat().forEach(p => {
      if(p && isWhite(p)) wVal += pieceValue(p);
      if(p && isBlack(p)) bVal += pieceValue(p);
    });
    statsEl.innerHTML = `
      <div>White Value: ${wVal}</div>
      <div>Black Value: ${bVal}</div>
      <div>Moves: ${moveHistory.length}</div>
    `;
  }

  function updateMoveHistory() {
    if (!moveHistoryEl) return;
    moveHistoryEl.innerHTML = moveHistory.map((m, i) => 
      `<div class="move-item">${i+1}. ${m}</div>`
    ).join('');
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
  }

  function undoLastMove() {
    if (boardHistory.length === 0 || gameOver) return;
    
    // In AI mode, undo 2 moves (AI + Player)
    if (!isLocalMultiplayer && boardHistory.length >= 2) {
      boardHistory.pop(); // Remove AI move
      board = boardHistory.pop(); // Revert to before Player move
      moveHistory.pop();
      moveHistory.pop();
    } else {
      board = boardHistory.pop();
      moveHistory.pop();
      whiteTurn = !whiteTurn;
    }
    
    selected = null;
    validMoves = [];
    renderBoard();
    updateStats();
    updateMoveHistory();
    updateStatus();
    notificationsEl.textContent = "Undo!";
    setTimeout(()=>notificationsEl.textContent="", 1000);
  }

  // --- AI LOGIC (Minimax) ---

  function evaluateBoard(testBoard) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = testBoard[r][c];
        if (!p) continue;
        const val = pieceValue(p);
        
        // Simple position weighting (encourage center)
        let posBonus = 0;
        if ((r===3||r===4) && (c===3||c===4)) posBonus = 2;

        if (isWhite(p)) score += (val + posBonus);
        else score -= (val + posBonus);
      }
    }
    return score;
  }

  function minimax(testBoard, depth, isMaximizing, alpha, beta) {
    if (depth === 0) return evaluateBoard(testBoard);

    if (isMaximizing) {
      let maxEval = -Infinity;
      // White Turn (Maximizing)
      for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
          if(testBoard[r][c] && isWhite(testBoard[r][c])) {
            const moves = getLegalMovesOnBoard(testBoard, r, c); // Use raw moves for speed
            for(let m of moves) {
              const prev = testBoard[m.r][m.c];
              testBoard[m.r][m.c] = testBoard[r][c];
              testBoard[r][c] = "";
              
              const eval = minimax(testBoard, depth-1, false, alpha, beta);
              
              testBoard[r][c] = testBoard[m.r][m.c];
              testBoard[m.r][m.c] = prev;

              maxEval = Math.max(maxEval, eval);
              alpha = Math.max(alpha, eval);
              if (beta <= alpha) break;
            }
          }
        }
      }
      return maxEval === -Infinity ? evaluateBoard(testBoard) : maxEval;
    } else {
      // Black Turn (Minimizing)
      let minEval = Infinity;
      for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
          if(testBoard[r][c] && isBlack(testBoard[r][c])) {
            const moves = getLegalMovesOnBoard(testBoard, r, c);
            for(let m of moves) {
              const prev = testBoard[m.r][m.c];
              testBoard[m.r][m.c] = testBoard[r][c];
              testBoard[r][c] = "";
              
              const eval = minimax(testBoard, depth-1, true, alpha, beta);
              
              testBoard[r][c] = testBoard[m.r][m.c];
              testBoard[m.r][m.c] = prev;

              minEval = Math.min(minEval, eval);
              beta = Math.min(beta, eval);
              if (beta <= alpha) break;
            }
          }
        }
      }
      return minEval === Infinity ? evaluateBoard(testBoard) : minEval;
    }
  }

  function aiMakeMove() {
    const depth = difficultyDepth[difficulty] || 2;
    let bestMove = null;
    let minEval = Infinity;
    
    // Find all Black pieces
    const allMoves = [];
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        if(board[r][c] && isBlack(board[r][c])) {
          const valid = getLegalMoves(r, c); // Must use safe moves for root
          valid.forEach(m => {
             allMoves.push({sr:r, sc:c, tr:m.r, tc:m.c});
          });
        }
      }
    }

    if(allMoves.length === 0) return;

    // Evaluate
    for(let move of allMoves) {
       // Simulate
       const prev = board[move.tr][move.tc];
       board[move.tr][move.tc] = board[move.sr][move.sc];
       board[move.sr][move.sc] = "";
       
       const eval = minimax(board, depth-1, true, -Infinity, Infinity);
       
       // Undo
       board[move.sr][move.sc] = board[move.tr][move.tc];
       board[move.tr][move.tc] = prev;

       // AI wants smallest score
       if (eval < minEval) {
         minEval = eval;
         bestMove = move;
       }
    }

    if (bestMove) {
      makeMove(bestMove.sr, bestMove.sc, bestMove.tr, bestMove.tc);
      renderBoard();
      checkGameEnd();
    } else {
      // Stalemate or Checkmate logic handles this, but just in case
      console.log("AI has no moves");
    }
  }

  // --- Buttons ---
  startBtn.onclick = () => {
    isLocalMultiplayer = false;
    home.classList.add("hidden");
    boardScreen.classList.remove("hidden");
    resetGame();
  };

  if (startLocalMultiplayerBtn) {
    startLocalMultiplayerBtn.onclick = () => {
      isLocalMultiplayer = true;
      home.classList.add("hidden");
      boardScreen.classList.remove("hidden");
      resetGame();
    };
  }

  backBtn.onclick = () => {
    boardScreen.classList.add("hidden");
    home.classList.remove("hidden");
    winnerScreen.classList.add("hidden");
  };

  playAgainBtn.onclick = () => {
    winnerScreen.classList.add("hidden");
    resetGame();
  };
  
  exitBtn.onclick = () => {
    winnerScreen.classList.add("hidden");
    boardScreen.classList.add("hidden");
    home.classList.remove("hidden");
  };

  themeToggle.onclick = () => document.body.classList.toggle("dark");
  undoBtn.onclick = undoLastMove;
  difficultySelect.onchange = () => difficulty = difficultySelect.value;});