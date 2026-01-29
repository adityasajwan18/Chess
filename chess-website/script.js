document.addEventListener("DOMContentLoaded", () => {
  const home = document.getElementById("home");
  const boardScreen = document.getElementById("boardScreen");
  const winnerScreen = document.getElementById("winnerScreen");
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

  if (!boardEl || !startBtn) return;

  // --- Game State ---
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
  let gameOver = false;
  let isLocalMultiplayer = false;
  let difficulty = "medium";
  const difficultyDepth = { easy: 1, medium: 2, hard: 3 };

  // SPECIAL MOVE STATE
  // Tracks if kings/rooks have moved: { white: {k:true, q:true}, black: {k:true, q:true} }
  let castlingRights = { 
    white: { k: true, q: true }, 
    black: { k: true, q: true } 
  };
  
  // Tracks the square behind a pawn that just moved 2 spaces. Format: {r, c} or null
  let enPassantTarget = null; 

  // History stack for Undo functionality (stores board + special state)
  let gameHistory = []; 

  function resetGame() {
    board = JSON.parse(JSON.stringify(initialBoard));
    whiteTurn = true;
    selected = null;
    validMoves = [];
    moveHistory = [];
    gameHistory = [];
    gameOver = false;
    
    // Reset Special States
    castlingRights = { white: { k: true, q: true }, black: { k: true, q: true } };
    enPassantTarget = null;

    notificationsEl.textContent = "";
    updateStats();
    updateMoveHistory();
    renderBoard();
    updateStatus();
  }

  // --- Helpers ---
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

  // --- Logic: Attacks & Check ---
  function isSquareUnderAttack(testBoard, row, col, byWhiteAttacker) {
    // Check Pawn attacks
    const pawnDir = byWhiteAttacker ? -1 : 1; // White attacks UP (-1), Black DOWN (+1)
    // Attack coming from opposite direction of movement
    const attackerPawn = byWhiteAttacker ? "♙" : "♟";
    // Check diagonals "behind" the target square (relative to attacker movement)
    // Actually simpler: Look for pawns *at* the attacking positions
    // If I am at [row, col], is there a pawn at [row - dir][col ± 1]?
    // Wait, let's reverse it: Check if a knight is attacking me, check if rook is attacking me...
    
    // 1. Pawn Attacks
    // If byWhiteAttacker (White pawns are below, moving up). 
    // They attack [row, col] if they are at [row+1, col-1] or [row+1, col+1]
    const pRow = byWhiteAttacker ? row + 1 : row - 1;
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

    // 5. King Attacks (for adjacent kings)
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

  // --- Move Generation ---
  function getLegalMoves(r, c, checkSafety = true) {
    const piece = board[r][c];
    if (!piece) return [];
    
    const isWhitePiece = isWhite(piece);
    const moves = [];
    
    // Basic Directions
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

    // 1. Standard Moves
    if (piece === "♙") { // White Pawn
        if(r>0 && !board[r-1][c]) {
            moves.push({r:r-1, c:c}); // Push 1
            if(r===6 && !board[r-2][c]) moves.push({r:r-2, c:c}); // Push 2
        }
        // Captures
        if(r>0 && c>0 && board[r-1][c-1] && isBlack(board[r-1][c-1])) moves.push({r:r-1, c:c-1});
        if(r>0 && c<7 && board[r-1][c+1] && isBlack(board[r-1][c+1])) moves.push({r:r-1, c:c+1});
        
        // En Passant Capture
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

        // En Passant Capture
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
        
        // CASTLING LOGIC
        if (checkSafety) { // Only check castling if we aren't already simulating safety
            const rights = isWhitePiece ? castlingRights.white : castlingRights.black;
            const row = isWhitePiece ? 7 : 0;
            
            // Basic Requisites: King must be on starting square and rights available
            if (r === row && c === 4 && !isSquareUnderAttack(board, r, c, !isWhitePiece)) {
                
                // King Side (Short)
                if (rights.k) {
                    if (!board[row][5] && !board[row][6]) {
                        if (!isSquareUnderAttack(board, row, 5, !isWhitePiece) && 
                            !isSquareUnderAttack(board, row, 6, !isWhitePiece)) {
                            moves.push({r: row, c: 6, isCastle: "king"});
                        }
                    }
                }
                
                // Queen Side (Long)
                if (rights.q) {
                    if (!board[row][3] && !board[row][2] && !board[row][1]) {
                        if (!isSquareUnderAttack(board, row, 3, !isWhitePiece) && 
                            !isSquareUnderAttack(board, row, 2, !isWhitePiece)) {
                            moves.push({r: row, c: 2, isCastle: "queen"});
                        }
                    }
                }
            }
        }
    }

    if (!checkSafety) return moves;

    // 2. Safety Check (Prevent moving into check)
    return moves.filter(m => {
        const tempBoard = board.map(row => [...row]);
        
        // Simulate Move
        tempBoard[m.r][m.c] = piece;
        tempBoard[r][c] = "";
        
        // Handle En Passant in simulation (remove the captured pawn)
        if (m.isEnPassant) {
            const captureRow = isWhitePiece ? m.r + 1 : m.r - 1;
            tempBoard[captureRow][m.c] = "";
        }

        const myKing = findKing(tempBoard, isWhitePiece);
        if (!myKing) return false; // Should not happen
        return !isSquareUnderAttack(tempBoard, myKing.r, myKing.c, !isWhitePiece);
    });
  }

  // --- Execution ---
  function makeMove(sr, sc, tr, tc) {
    const moves = getLegalMoves(sr, sc);
    const moveData = moves.find(m => m.r === tr && m.c === tc);
    
    // Save history state
    gameHistory.push({
        board: board.map(row => [...row]),
        castlingRights: JSON.parse(JSON.stringify(castlingRights)),
        enPassantTarget: enPassantTarget,
        whiteTurn: whiteTurn,
        moveLog: null 
    });

    const piece = board[sr][sc];
    let captured = board[tr][tc] ? "x" : "";
    
    // 1. Move Piece
    board[tr][tc] = piece;
    board[sr][sc] = "";

    // 2. Handle Special Moves
    
    // En Passant Execution
    if (moveData && moveData.isEnPassant) {
        const captureRow = isWhite(piece) ? tr + 1 : tr - 1;
        board[captureRow][tc] = ""; // Remove the pawn behind
        captured = "x (ep)";
    }

    // Castling Execution
    if (moveData && moveData.isCastle) {
        const row = isWhite(piece) ? 7 : 0;
        if (moveData.isCastle === "king") {
            board[row][5] = board[row][7]; // Move Rook
            board[row][7] = "";
        } else {
            board[row][3] = board[row][0]; // Move Rook
            board[row][0] = "";
        }
    }

    // 3. Update State (Castling Rights & En Passant Target)
    
    // Reset En Passant Target (it only lasts one turn)
    const prevEnPassant = enPassantTarget;
    enPassantTarget = null;

    // Set new En Passant Target if Pawn moved 2 squares
    if ((piece === "♙" || piece === "♟") && Math.abs(sr - tr) === 2) {
        enPassantTarget = { r: (sr + tr) / 2, c: sc };
    }

    // Update Castling Rights
    const color = isWhite(piece) ? "white" : "black";
    const oppColor = isWhite(piece) ? "black" : "white";

    // If King moves, lose all rights
    if (piece === "♔") castlingRights.white = {k:false, q:false};
    if (piece === "♚") castlingRights.black = {k:false, q:false};

    // If Rook moves, lose side right
    if (piece === "♖") {
        if (sr===7 && sc===0) castlingRights.white.q = false;
        if (sr===7 && sc===7) castlingRights.white.k = false;
    }
    if (piece === "♜") {
        if (sr===0 && sc===0) castlingRights.black.q = false;
        if (sr===0 && sc===7) castlingRights.black.k = false;
    }

    // If Rook is captured, opponent loses side right
    if (tr===0 && tc===0) castlingRights.black.q = false;
    if (tr===0 && tc===7) castlingRights.black.k = false;
    if (tr===7 && tc===0) castlingRights.white.q = false;
    if (tr===7 && tc===7) castlingRights.white.k = false;

    // 4. Update Logs & Turn
    whiteTurn = !whiteTurn;
    const from = String.fromCharCode(97+sc) + (8-sr);
    const to = String.fromCharCode(97+tc) + (8-tr);
    const log = `${piece} ${from}${captured}${to}`;
    
    moveHistory.push(log);
    gameHistory[gameHistory.length-1].moveLog = log; // Save for undo

    updateMoveHistory();
    updateStats();
    updateStatus();
  }

  function undoLastMove() {
    if (gameHistory.length === 0 || gameOver) return;
    
    let steps = 1;
    if (!isLocalMultiplayer && gameHistory.length >= 2) steps = 2; // Undo AI + Player

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
    winnerScreen.classList.add("hidden");
    
    renderBoard();
    updateStats();
    updateMoveHistory();
    updateStatus();
    notificationsEl.textContent = "Undo ↶";
    setTimeout(()=>notificationsEl.textContent="", 1000);
  }

  // --- Board Interaction ---
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
    if (!isLocalMultiplayer && !whiteTurn) return;

    const piece = board[r][c];

    // Move existing selection
    if (selected) {
        const move = validMoves.find(m => m.r === r && m.c === c);
        if (move) {
            makeMove(selected.r, selected.c, r, c);
            selected = null;
            validMoves = [];
            renderBoard();
            
            checkGameEnd();
            if(!gameOver && !isLocalMultiplayer) {
                setTimeout(aiMakeMove, 100);
            }
            return;
        }
    }

    // Select new
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

  // --- AI (Simple Minimax) ---
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

  function aiMakeMove() {
    const depth = difficultyDepth[difficulty];
    
    // Gather all valid moves for Black
    let allMoves = [];
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            if(board[r][c] && isBlack(board[r][c])) {
                // AI gets legal moves, including castling/EP logic
                const moves = getLegalMoves(r, c);
                moves.forEach(m => allMoves.push({sr:r, sc:c, tr:m.r, tc:m.c, isEnPassant: m.isEnPassant, isCastle: m.isCastle}));
            }
        }
    }

    if(allMoves.length === 0) return;

    // Shuffle to add randomness to equal moves
    allMoves.sort(() => Math.random() - 0.5);

    let bestMove = null;
    let minEval = Infinity;

    for(let move of allMoves) {
        // Simulation: simplified (doesn't update deep state like castling rights for recursion speed)
        const prev = board[move.tr][move.tc];
        board[move.tr][move.tc] = board[move.sr][move.sc];
        board[move.sr][move.sc] = "";
        
        // Simple 1-step lookahead evaluation
        const eval = evaluateBoard(board);
        
        // Undo
        board[move.sr][move.sc] = board[move.tr][move.tc];
        board[move.tr][move.tc] = prev;

        if (eval < minEval) {
            minEval = eval;
            bestMove = move;
        }
    }

    if(bestMove) {
        makeMove(bestMove.sr, bestMove.sc, bestMove.tr, bestMove.tc);
        renderBoard();
        checkGameEnd();
    }
  }

  function checkGameEnd() {
    const whiteKing = findKing(board, true);
    const blackKing = findKing(board, false);
    
    if(!whiteKing || !blackKing) {
        gameOver = true;
        winnerScreen.classList.remove("hidden");
        winnerTitle.textContent = "Game Over";
        return;
    }
    
    // Checkmate detection (slow, so only running if check is likely or simple)
    // For this simple version, we rely on King Capture validation or simple check
    if (isSquareUnderAttack(board, whiteKing.r, whiteKing.c, false)) {
       notificationsEl.textContent = "Check!";
    } else {
       notificationsEl.textContent = "";
    }
  }

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

  // Listeners
  startBtn.onclick = () => { isLocalMultiplayer=false; home.classList.add("hidden"); boardScreen.classList.remove("hidden"); resetGame(); };
  if(startLocalMultiplayerBtn) startLocalMultiplayerBtn.onclick = () => { isLocalMultiplayer=true; home.classList.add("hidden"); boardScreen.classList.remove("hidden"); resetGame(); };
  backBtn.onclick = () => { boardScreen.classList.add("hidden"); home.classList.remove("hidden"); };
  playAgainBtn.onclick = () => { winnerScreen.classList.add("hidden"); resetGame(); };
  exitBtn.onclick = () => { winnerScreen.classList.add("hidden"); boardScreen.classList.add("hidden"); home.classList.remove("hidden"); };
  themeToggle.onclick = () => document.body.classList.toggle("dark");
  undoBtn.onclick = undoLastMove;
  difficultySelect.onchange = () => difficulty = difficultySelect.value;
});