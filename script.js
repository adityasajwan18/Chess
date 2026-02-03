document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const home = document.getElementById("home");
  const boardScreen = document.getElementById("boardScreen");
  const winnerScreen = document.getElementById("winnerScreen");
  const promotionModal = document.getElementById("promotionModal");
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const notificationsEl = document.getElementById("notifications");
  const winnerTitle = document.getElementById("winnerTitle");
  const winnerMessage = document.getElementById("winnerMessage");

  // Buttons
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
    console.error("Critical DOM elements missing");
    return;
  }

  // --- Game Variables ---
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

  let board;
  let whiteTurn = true;
  let selected = null;
  let validMoves = [];
  let moveHistory = [];
  let gameHistory = []; // For Undo
  let gameOver = false;
  let isLocalMultiplayer = false;
  
  // Special State
  let castlingRights = { white: { k: true, q: true }, black: { k: true, q: true } };
  let enPassantTarget = null; 
  let pendingPromotion = null; // Stores move while waiting for user to pick piece

  let difficulty = "medium";
  const difficultyDepth = { easy: 1, medium: 2, hard: 3 };

  // --- Initialization ---
  function resetGame() {
    board = JSON.parse(JSON.stringify(initialBoard));
    whiteTurn = true;
    selected = null;
    validMoves = [];
    moveHistory = [];
    gameHistory = [];
    gameOver = false;
    castlingRights = { white: { k: true, q: true }, black: { k: true, q: true } };
    enPassantTarget = null;
    pendingPromotion = null;

    notificationsEl.textContent = "";
    promotionModal.classList.add("hidden");
    winnerScreen.classList.add("hidden");
    
    updateStats();
    updateMoveHistory();
    renderBoard();
    updateStatus();
  }

  // --- Helper Functions ---
  function isWhite(p) { return "♙♖♘♗♕♔".includes(p); }
  function isBlack(p) { return "♟♜♞♝♛♚".includes(p); }
  function pieceValue(p) {
    const map = {"♙":10, "♟":10, "♘":30, "♞":30, "♗":30, "♝":30, "♖":50, "♜":50, "♕":90, "♛":90, "♔":900, "♚":900};
    return map[p] || 0;
  }
  function findKing(testBoard, isWhiteKing) {
    const king = isWhiteKing ? "♔" : "♚";
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        if(testBoard[r][c] === king) return {r, c};
      }
    }
    return null;
  }

  // --- Move Validation Logic ---
  
  // Check if a square is being attacked
  function isSquareUnderAttack(testBoard, row, col, byWhiteAttacker) {
    // 1. Pawn Attacks
    const pRow = byWhiteAttacker ? row + 1 : row - 1;
    const attackerPawn = byWhiteAttacker ? "♙" : "♟";
    if (pRow >= 0 && pRow < 8) {
        if (col > 0 && testBoard[pRow][col-1] === attackerPawn) return true;
        if (col < 7 && testBoard[pRow][col+1] === attackerPawn) return true;
    }

    // 2. Knight Attacks
    const knights = byWhiteAttacker ? "♘" : "♞";
    const kMoves = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    for(let m of kMoves) {
        const nr = row + m[0], nc = col + m[1];
        if(nr>=0 && nr<8 && nc>=0 && nc<8 && testBoard[nr][nc] === knights) return true;
    }

    // 3. Sliding Attacks (Rook/Queen)
    const orth = [[1,0],[-1,0],[0,1],[0,-1]];
    const rooks = byWhiteAttacker ? "♖♕" : "♜♛";
    for(let d of orth) {
        let nr = row + d[0], nc = col + d[1];
        while(nr>=0 && nr<8 && nc>=0 && nc<8) {
            const p = testBoard[nr][nc];
            if(p) {
                if(rooks.includes(p)) return true;
                break;
            }
            nr += d[0]; nc += d[1];
        }
    }

    // 4. Diagonal Attacks (Bishop/Queen)
    const diag = [[1,1],[1,-1],[-1,1],[-1,-1]];
    const bishops = byWhiteAttacker ? "♗♕" : "♝♛";
    for(let d of diag) {
        let nr = row + d[0], nc = col + d[1];
        while(nr>=0 && nr<8 && nc>=0 && nc<8) {
            const p = testBoard[nr][nc];
            if(p) {
                if(bishops.includes(p)) return true;
                break;
            }
            nr += d[0]; nc += d[1];
        }
    }

    // 5. King Attacks
    const king = byWhiteAttacker ? "♔" : "♚";
    for(let i=-1; i<=1; i++) {
        for(let j=-1; j<=1; j++) {
            if(i===0 && j===0) continue;
            const nr = row+i, nc = col+j;
            if(nr>=0 && nr<8 && nc>=0 && nc<8 && testBoard[nr][nc] === king) return true;
        }
    }
    return false;
  }

  // Get all legal moves for a piece at (r, c)
  function getLegalMoves(r, c, checkSafety = true) {
    const piece = board[r][c];
    if (!piece) return [];
    
    const isWhitePiece = isWhite(piece);
    const moves = [];
    
    const dirs = {
        rook: [[1,0],[-1,0],[0,1],[0,-1]],
        bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
        queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],
        knight: [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]],
        king: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
    };

    function add(nr, nc) {
        if(nr>=0 && nr<8 && nc>=0 && nc<8) {
            const target = board[nr][nc];
            if(!target || isWhite(target) !== isWhitePiece) moves.push({r:nr, c:nc});
        }
    }

    function slide(directions) {
        directions.forEach(([dr, dc]) => {
            let nr = r + dr, nc = c + dc;
            while(nr>=0 && nr<8 && nc>=0 && nc<8) {
                const target = board[nr][nc];
                if(!target) { moves.push({r:nr, c:nc}); }
                else {
                    if(isWhite(target) !== isWhitePiece) moves.push({r:nr, c:nc});
                    break;
                }
                nr += dr; nc += dc;
            }
        });
    }

    if (piece === "♙") { // White Pawn
        if(r>0 && !board[r-1][c]) {
            moves.push({r:r-1, c:c});
            if(r===6 && !board[r-2][c]) moves.push({r:r-2, c:c});
        }
        if(r>0 && c>0 && board[r-1][c-1] && isBlack(board[r-1][c-1])) moves.push({r:r-1, c:c-1});
        if(r>0 && c<7 && board[r-1][c+1] && isBlack(board[r-1][c+1])) moves.push({r:r-1, c:c+1});
        // En Passant
        if (enPassantTarget && enPassantTarget.r === r-1 && Math.abs(enPassantTarget.c - c) === 1) {
            moves.push({r: enPassantTarget.r, c: enPassantTarget.c, isEnPassant: true});
        }
    }
    else if (piece === "♟") { // Black Pawn
        if(r<7 && !board[r+1][c]) {
            moves.push({r:r+1, c:c});
            if(r===1 && !board[r+2][c]) moves.push({r:r+2, c:c});
        }
        if(r<7 && c>0 && board[r+1][c-1] && isWhite(board[r+1][c-1])) moves.push({r:r+1, c:c-1});
        if(r<7 && c<7 && board[r+1][c+1] && isWhite(board[r+1][c+1])) moves.push({r:r+1, c:c+1});
        // En Passant
        if (enPassantTarget && enPassantTarget.r === r+1 && Math.abs(enPassantTarget.c - c) === 1) {
            moves.push({r: enPassantTarget.r, c: enPassantTarget.c, isEnPassant: true});
        }
    }
    else if (piece === "♖" || piece === "♜") slide(dirs.rook);
    else if (piece === "♗" || piece === "♝") slide(dirs.bishop);
    else if (piece === "♕" || piece === "♛") slide(dirs.queen);
    else if (piece === "♘" || piece === "♞") dirs.knight.forEach(([dr, dc]) => add(r+dr, c+dc));
    else if (piece === "♔" || piece === "♚") {
        dirs.king.forEach(([dr, dc]) => add(r+dr, c+dc));
        // Castling Logic
        if (checkSafety) {
            const rights = isWhitePiece ? castlingRights.white : castlingRights.black;
            const row = isWhitePiece ? 7 : 0;
            if (r === row && c === 4 && !isSquareUnderAttack(board, r, c, !isWhitePiece)) {
                // Kingside
                if (rights.k && !board[row][5] && !board[row][6] && 
                    !isSquareUnderAttack(board, row, 5, !isWhitePiece) && !isSquareUnderAttack(board, row, 6, !isWhitePiece)) {
                    moves.push({r: row, c: 6, isCastle: "king"});
                }
                // Queenside
                if (rights.q && !board[row][3] && !board[row][2] && !board[row][1] &&
                    !isSquareUnderAttack(board, row, 3, !isWhitePiece) && !isSquareUnderAttack(board, row, 2, !isWhitePiece)) {
                    moves.push({r: row, c: 2, isCastle: "queen"});
                }
            }
        }
    }

    if (!checkSafety) return moves;

    // Filter moves that leave King in Check
    return moves.filter(m => {
        const tempBoard = board.map(row => [...row]);
        tempBoard[m.r][m.c] = piece;
        tempBoard[r][c] = "";
        
        // Handle En Passant in simulation
        if (m.isEnPassant) {
            const captureRow = isWhitePiece ? m.r + 1 : m.r - 1;
            tempBoard[captureRow][m.c] = "";
        }
        
        const myKing = findKing(tempBoard, isWhitePiece);
        if (!myKing) return false;
        return !isSquareUnderAttack(tempBoard, myKing.r, myKing.c, !isWhitePiece);
    });
  }

  // --- Move Execution ---
  function makeMove(sr, sc, tr, tc, special = null) {
    // 1. Save State for Undo
    gameHistory.push({
        board: board.map(row => [...row]),
        castlingRights: JSON.parse(JSON.stringify(castlingRights)),
        enPassantTarget: enPassantTarget,
        whiteTurn: whiteTurn,
        moveLog: null 
    });

    const piece = board[sr][sc];
    let captured = board[tr][tc] ? "x" : "";
    
    // 2. Perform Basic Move
    board[tr][tc] = piece;
    board[sr][sc] = "";

    // 3. Handle Special Moves
    
    // En Passant Capture
    if (special && special.isEnPassant) {
        const captureRow = isWhite(piece) ? tr + 1 : tr - 1;
        board[captureRow][tc] = "";
        captured = "x (ep)";
    }

    // Castling
    if (special && special.isCastle) {
        const row = isWhite(piece) ? 7 : 0;
        if (special.isCastle === "king") {
            board[row][5] = board[row][7]; board[row][7] = ""; // Move Rook
        } else {
            board[row][3] = board[row][0]; board[row][0] = ""; // Move Rook
        }
    }

    // Promotion
    if (special && special.promoteTo) {
        const isWhitePiece = isWhite(piece);
        const map = {
            'q': isWhitePiece ? "♕" : "♛",
            'r': isWhitePiece ? "♖" : "♜",
            'b': isWhitePiece ? "♗" : "♝",
            'n': isWhitePiece ? "♘" : "♞"
        };
        board[tr][tc] = map[special.promoteTo];
        captured += "(prom)";
    }

    // 4. Update Game State
    
    // En Passant Target
    const prevEnPassant = enPassantTarget;
    enPassantTarget = null;
    if ((piece === "♙" || piece === "♟") && Math.abs(sr - tr) === 2) {
        enPassantTarget = { r: (sr + tr) / 2, c: sc };
    }

    // Castling Rights (Loss logic)
    if (piece === "♔") castlingRights.white = {k:false, q:false};
    if (piece === "♚") castlingRights.black = {k:false, q:false};
    
    // Rook moved
    if (piece === "♖") {
        if (sr===7 && sc===0) castlingRights.white.q = false;
        if (sr===7 && sc===7) castlingRights.white.k = false;
    }
    if (piece === "♜") {
        if (sr===0 && sc===0) castlingRights.black.q = false;
        if (sr===0 && sc===7) castlingRights.black.k = false;
    }
    // Rook captured
    if (tr===0 && tc===0) castlingRights.black.q = false;
    if (tr===0 && tc===7) castlingRights.black.k = false;
    if (tr===7 && tc===0) castlingRights.white.q = false;
    if (tr===7 && tc===7) castlingRights.white.k = false;

    // 5. Finalize
    whiteTurn = !whiteTurn;
    
    const from = String.fromCharCode(97+sc) + (8-sr);
    const to = String.fromCharCode(97+tc) + (8-tr);
    const log = `${piece} ${from}${captured}${to}`;
    
    moveHistory.push(log);
    gameHistory[gameHistory.length-1].moveLog = log;

    updateMoveHistory();
    updateStats();
    updateStatus();
  }

  // --- Interaction & Rendering ---

  function renderBoard() {
    boardEl.innerHTML = "";
    board.forEach((row, r) => {
      row.forEach((piece, c) => {
        const sq = document.createElement("div");
        sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark-square");
        
        // Highlight Selected
        if (selected && selected.r === r && selected.c === c) {
            sq.classList.add("selected");
        }
        
        // Highlight Valid Moves
        const move = validMoves.find(m => m.r === r && m.c === c);
        if (move) {
            sq.classList.add("valid");
            if (board[r][c] || move.isEnPassant) sq.classList.add("capture");
        }

        if (piece) {
            sq.textContent = piece;
            // Add Color Class for CSS
            sq.classList.add(isWhite(piece) ? "white-piece" : "black-piece");
        }
        
        sq.onclick = () => onSquareClick(r, c);
        boardEl.appendChild(sq);
      });
    });
  }

  function onSquareClick(r, c) {
    if (gameOver || pendingPromotion) return; // Wait if promoting
    if (!isLocalMultiplayer && !whiteTurn) return; // Wait for AI

    const piece = board[r][c];

    // 1. Execute Move if Valid
    if (selected) {
        const move = validMoves.find(m => m.r === r && m.c === c);
        if (move) {
            const movingPiece = board[selected.r][selected.c];
            
            // --- Detect Promotion ---
            const isPawn = movingPiece === "♙" || movingPiece === "♟";
            const lastRank = isWhite(movingPiece) ? 0 : 7;
            
            if (isPawn && r === lastRank) {
                // Show Promotion Modal
                pendingPromotion = { sr: selected.r, sc: selected.c, tr: r, tc: c, special: move };
                promotionModal.classList.remove("hidden");
                // Update Button Icons
                const icons = isWhite(movingPiece) ? ["♕","♖","♗","♘"] : ["♛","♜","♝","♞"];
                const btns = promotionModal.querySelectorAll("button");
                btns.forEach((b, i) => b.textContent = icons[i]);
                return;
            }

            // Execute Normal Move
            makeMove(selected.r, selected.c, r, c, move);
            selected = null;
            validMoves = [];
            renderBoard();
            
            if (!checkGameEnd() && !isLocalMultiplayer && !whiteTurn) {
                setTimeout(aiMakeMove, 800);
            }
            return;
        }
    }

    // 2. Select Piece
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

  // --- Exposed Function for HTML Buttons ---
  window.selectPromotion = function(type) {
    if (!pendingPromotion) return;
    
    promotionModal.classList.add("hidden");
    
    // Add promotion type to the move
    const finalMove = { ...pendingPromotion.special, promoteTo: type };
    
    makeMove(pendingPromotion.sr, pendingPromotion.sc, pendingPromotion.tr, pendingPromotion.tc, finalMove);
    
    pendingPromotion = null;
    selected = null;
    validMoves = [];
    renderBoard();
    
    if (!checkGameEnd() && !isLocalMultiplayer && !whiteTurn) {
        setTimeout(aiMakeMove, 1000);
    }
  };

  // --- AI (Minimax) ---
  function aiMakeMove() {
    const depth = difficultyDepth[difficulty];
    let allMoves = [];
    
    // Collect all valid Black moves
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if(board[r][c] && isBlack(board[r][c])) {
                const moves = getLegalMoves(r, c);
                moves.forEach(m => {
                    // Auto-Promote to Queen for AI
                    if (board[r][c] === "♟" && m.r === 7) m.promoteTo = 'q';
                    allMoves.push({sr:r, sc:c, tr:m.r, tc:m.c, special: m});
                });
            }
        }
    }

    if(allMoves.length === 0) return;
    
    allMoves.sort(() => Math.random() - 0.5); // Shuffle for variety

    let bestMove = null;
    let minEval = Infinity; // AI (Black) wants lowest score

    // Simple 1-step Lookahead
    for(let move of allMoves) {
        const prev = board[move.tr][move.tc];
        const piece = board[move.sr][move.sc];
        
        board[move.tr][move.tc] = piece;
        board[move.sr][move.sc] = "";
        
        if (move.special.promoteTo) board[move.tr][move.tc] = "♛";

        const eval = evaluateBoard(board);
        
        // Undo
        board[move.sr][move.sc] = piece;
        board[move.tr][move.tc] = prev;

        if (eval < minEval) {
            minEval = eval;
            bestMove = move;
        }
    }

    if(bestMove) {
        makeMove(bestMove.sr, bestMove.sc, bestMove.tr, bestMove.tc, bestMove.special);
        renderBoard();
        checkGameEnd();
    }
  }

  function evaluateBoard(testBoard) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = testBoard[r][c];
        if (!p) continue;
        const val = pieceValue(p);
        const posBonus = ((r===3||r===4) && (c===3||c===4)) ? 2 : 0;
        if (isWhite(p)) score += (val + posBonus);
        else score -= (val + posBonus);
      }
    }
    return score;
  }

  // --- Game End Logic ---
  function hasAnyLegalMoves(forWhiteTurn) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && isWhite(piece) === forWhiteTurn) {
          if (getLegalMoves(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  function checkGameEnd() {
    const whiteKing = findKing(board, true);
    const blackKing = findKing(board, false);
    
    if (!whiteKing) { showGameOver("Black Wins!", "White King Captured"); return true; }
    if (!blackKing) { showGameOver("White Wins!", "Black King Captured"); return true; }

    const hasMoves = hasAnyLegalMoves(whiteTurn);
    const kingPos = whiteTurn ? whiteKing : blackKing;
    const kingInCheck = isSquareUnderAttack(board, kingPos.r, kingPos.c, !whiteTurn);

    if (!hasMoves) {
      if (kingInCheck) {
        const winner = !whiteTurn ? "White" : "Black";
        showGameOver(`${winner} Wins!`, "Checkmate!");
        return true;
      } else {
        showGameOver("Draw", "Stalemate");
        return true;
      }
    }
    if (kingInCheck) notificationsEl.textContent = "⚠️ Check!";
    else notificationsEl.textContent = "";
    return false;
  }
  function showGameOver(title, message) {
    gameOver = true;
    winnerTitle.textContent = title;
    winnerMessage.textContent = message;
    winnerScreen.classList.remove("hidden");
  }
  function undoLastMove() {
    if (gameHistory.length === 0 || gameOver) return;
    
    // If AI mode, undo 2 moves (AI + Player) to return to Player turn
    let steps = (!isLocalMultiplayer && gameHistory.length >= 2) ? 2 : 1;
    
    for(let i=0; i<steps; i++) {
        const state = gameHistory.pop();
        if (!state) break;
        
        board = state.board;
        castlingRights = state.castlingRights;
        enPassantTarget = state.enPassantTarget;
        whiteTurn = state.whiteTurn;
        moveHistory.pop();
    }
    
    selected = null;
    validMoves = [];
    gameOver = false;
    pendingPromotion = null;
    winnerScreen.classList.add("hidden");
    promotionModal.classList.add("hidden");
    
    renderBoard();
    updateStats();
    updateMoveHistory();
    updateStatus();
    notificationsEl.textContent = "Undo ↶";
    setTimeout(() => notificationsEl.textContent="", 800);
  }

  // --- UI Utilities ---
  function updateStatus() {
    if(!gameOver) statusEl.textContent = whiteTurn ? "White's Turn" : "Black's Turn";
  }

  function updateStats() {
    statsEl.innerHTML = `Moves: ${moveHistory.length}`;
  }

  function updateMoveHistory() {
    moveHistoryEl.innerHTML = moveHistory.map((m, i) => `<div class="move-item">${i+1}. ${m}</div>`).join('');
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
  }

  // --- Event Listeners ---
  startBtn.onclick = () => { isLocalMultiplayer=false; home.classList.add("hidden"); boardScreen.classList.remove("hidden"); resetGame(); };
  if(startLocalMultiplayerBtn) startLocalMultiplayerBtn.onclick = () => { isLocalMultiplayer=true; home.classList.add("hidden"); boardScreen.classList.remove("hidden"); resetGame(); };
  backBtn.onclick = () => { boardScreen.classList.add("hidden"); home.classList.remove("hidden"); };
  playAgainBtn.onclick = () => { winnerScreen.classList.add("hidden"); resetGame(); };
  exitBtn.onclick = () => { winnerScreen.classList.add("hidden"); boardScreen.classList.add("hidden"); home.classList.remove("hidden"); };
  themeToggle.onclick = () => document.body.classList.toggle("dark");
  undoBtn.onclick = undoLastMove;
  difficultySelect.onchange = () => difficulty = difficultySelect.value;
});