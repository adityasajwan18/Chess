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
  const backBtn = document.getElementById("backBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const exitBtn = document.getElementById("exitBtn");
  const themeToggle = document.getElementById("themeToggle");

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

  let board, selected = null, validMoves = [], whiteTurn = true, gameOver = false;

  function resetGame() {
    board = JSON.parse(JSON.stringify(initialBoard));
    selected = null;
    validMoves = [];
    whiteTurn = true;
    gameOver = false;
    statusEl.textContent = "White to move";
    notificationsEl.textContent = "";
    renderBoard();
  }

  function findKing(isWhiteKing) {
    const king = isWhiteKing ? "♔" : "♚";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === king) return { r, c };
      }
    }
    return null;
  }

  function isInCheck(isWhiteKing) {
    const king = findKing(isWhiteKing);
    if (!king) return false;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && isWhite(piece) !== isWhiteKing) {
          const moves = getLegalMoves(r, c);
          if (moves.some(m => m.r === king.r && m.c === king.c)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function hasLegalMoves(isWhitePlayer) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && isWhite(piece) === isWhitePlayer) {
          const moves = getLegalMoves(r, c);
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  function checkGameEnd() {
    // Check if a king is missing
    const whiteKing = findKing(true);
    const blackKing = findKing(false);
    
    if (!whiteKing) {
      gameOver = true;
      winnerTitle.textContent = "Game Over!";
      winnerMessage.textContent = "Black wins! White king captured!";
      return true;
    }
    
    if (!blackKing) {
      gameOver = true;
      winnerTitle.textContent = "Game Over!";
      winnerMessage.textContent = "White wins! Black king captured!";
      return true;
    }

    if (hasLegalMoves(whiteTurn)) {
      if (isInCheck(whiteTurn)) {
        notificationsEl.textContent = `⚠️ ${whiteTurn ? "White" : "Black"} is in CHECK!`;
      }
      return false;
    }

    gameOver = true;
    const inCheck = isInCheck(whiteTurn);

    if (inCheck) {
      winnerTitle.textContent = "Checkmate!";
      winnerMessage.textContent = `${!whiteTurn ? "White" : "Black"} wins!`;
    } else {
      winnerTitle.textContent = "Stalemate!";
      winnerMessage.textContent = "Draw game!";
    }

    return true;
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
    const piece = board[r][c];

    if (selected) {
      const move = validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        makeMove(selected.r, selected.c, r, c);
        selected = null;
        validMoves = [];
        renderBoard();

        if (checkGameEnd()) {
          winnerScreen.classList.remove("hidden");
          return;
        }

        if (!whiteTurn) {
          statusEl.textContent = "Black thinking...";
          setTimeout(aiMove, 500);
        }
        return;
      }
      
      // If clicking on a different piece of the same color, select that piece instead
      if (piece && isWhite(piece) === whiteTurn) {
        selected = { r, c };
        validMoves = getLegalMoves(r, c);
        renderBoard();
        return;
      }
      
      // Otherwise deselect
      selected = null;
      validMoves = [];
      renderBoard();
      return;
    }

    if (piece && isWhite(piece) === whiteTurn) {
      selected = { r, c };
      validMoves = getLegalMoves(r, c);
      renderBoard();
    }
  }

  function makeMove(sr, sc, tr, tc) {
    board[tr][tc] = board[sr][sc];
    board[sr][sc] = "";
    whiteTurn = !whiteTurn;
    statusEl.textContent = whiteTurn ? "White to move" : "Black to move";
  }

  function isWhite(p) { return "♙♖♘♗♕♔".includes(p); }
  function isBlack(p) { return "♟♜♞♝♛♚".includes(p); }

  function isSquareUnderAttack(testBoard, row, col, byWhite) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = testBoard[r][c];
        if (!piece) continue;
        if (isWhite(piece) !== byWhite) continue;

        const moves = getLegalMovesOnBoard(testBoard, r, c);
        if (moves.some(m => m.r === row && m.c === col)) return true;
      }
    }
    return false;
  }

  function wouldBeInCheck(fromR, fromC, toR, toC, isWhitePlayer) {
    const testBoard = board.map(row => [...row]);
    testBoard[toR][toC] = testBoard[fromR][fromC];
    testBoard[fromR][fromC] = "";
    
    const king = findKingOnBoard(testBoard, isWhitePlayer);
    if (!king) return false;
    
    return isSquareUnderAttack(testBoard, king.r, king.c, !isWhitePlayer);
  }

  function getLegalMoves(r, c) {
    const piece = board[r][c];
    const moves = [];

    const dirs = {
      rook: [[1,0],[-1,0],[0,1],[0,-1]],
      bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
      queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
    };

    function slide(directions) {
      directions.forEach(([dr, dc]) => {
        let nr = r + dr, nc = c + dc;
        while (nr>=0 && nr<8 && nc>=0 && nc<8) {
          if (!board[nr][nc]) moves.push({r:nr,c:nc});
          else {
            if (isWhite(piece) !== isWhite(board[nr][nc])) moves.push({r:nr,c:nc});
            break;
          }
          nr += dr; nc += dc;
        }
      });
    }

    if (piece === "♙") {
      if (r>0 && !board[r-1][c]) moves.push({r:r-1,c});
      if (r===6 && !board[r-2][c] && !board[r-1][c]) moves.push({r:r-2,c});
      [[-1,-1],[-1,1]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;
        if(board[nr]?.[nc] && isBlack(board[nr][nc])) moves.push({r:nr,c:nc});
      });
    }

    if (piece === "♟") {
      if (r<7 && !board[r+1][c]) moves.push({r:r+1,c});
      if (r===1 && !board[r+2][c] && !board[r+1][c]) moves.push({r:r+2,c});
      [[1,-1],[1,1]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;
        if(board[nr]?.[nc] && isWhite(board[nr][nc])) moves.push({r:nr,c:nc});
      });
    }

    if (piece === "♖" || piece === "♜") slide(dirs.rook);
    if (piece === "♗" || piece === "♝") slide(dirs.bishop);
    if (piece === "♕" || piece === "♛") slide(dirs.queen);

    if (piece === "♘" || piece === "♞") {
      [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;
        if(nr>=0&&nr<8&&nc>=0&&nc<8 && (!board[nr][nc] || isWhite(piece)!==isWhite(board[nr][nc])))
          moves.push({r:nr,c:nc});
      });
    }

    if (piece === "♔" || piece === "♚") {
      const isWhiteKing = isWhite(piece);
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
        if(dr||dc){
          const nr=r+dr,nc=c+dc;
          if(nr>=0&&nr<8&&nc>=0&&nc<8 && (!board[nr][nc] || isWhite(piece)!==isWhite(board[nr][nc]))){
            // Check if this square is safe (not under attack)
            const testBoard = board.map(row => [...row]);
            testBoard[nr][nc] = piece;
            testBoard[r][c] = "";
            if (!isSquareUnderAttack(testBoard, nr, nc, !isWhiteKing)) {
              moves.push({r:nr,c:nc});
            }
          }
        }
      }
    }

    // Filter out moves that would leave king in check (only for non-kings to avoid recursion)
    if (piece !== "♔" && piece !== "♚") {
      const isWhitePiece = isWhite(piece);
      moves = moves.filter(move => {
        const testBoard = board.map(row => [...row]);
        testBoard[move.r][move.c] = testBoard[r][c];
        testBoard[r][c] = "";
        
        const kingPos = findKingOnBoard(testBoard, isWhitePiece);
        if (!kingPos) return true;
        
        return !isSquareUnderAttack(testBoard, kingPos.r, kingPos.c, !isWhitePiece);
      });
    }

    return moves;
  }

  function pieceValue(p) {
    return {"♙":1,"♟":1,"♘":3,"♞":3,"♗":3,"♝":3,"♖":5,"♜":5,"♕":9,"♛":9,"♔":100,"♚":100}[p] || 0;
  }

  function evaluatePosition(testBoard, forWhite) {
    let score = 0;
    const centerSquares = [[3,3],[3,4],[4,3],[4,4],[2,2],[2,3],[2,4],[2,5],[3,2],[3,5],[4,2],[4,5],[5,2],[5,3],[5,4],[5,5]];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = testBoard[r][c];
        if (!piece) continue;

        const value = pieceValue(piece);
        const isWhitePiece = isWhite(piece);
        const sign = isWhitePiece === forWhite ? 1 : -1;

        score += sign * value * 100;

        // Bonus for center control
        if (centerSquares.some(sq => sq[0] === r && sq[1] === c)) {
          score += sign * 10;
        }

        // Pawn advancement bonus
        if (piece === "♟") score += sign * (7 - r) * 5;
        if (piece === "♙") score += sign * r * 5;

        // Bonus for piece activity (attacking squares)
        const moves = getLegalMovesOnBoard(testBoard, r, c);
        score += sign * moves.length * 2;
      }
    }

    // King safety bonus
    const blackKingPos = findKingOnBoard(testBoard, false);
    const whiteKingPos = findKingOnBoard(testBoard, true);
    
    if (blackKingPos) {
      const blackSafety = countDefenders(testBoard, blackKingPos.r, blackKingPos.c, false);
      score += (forWhite ? -1 : 1) * blackSafety * 8;
    }
    if (whiteKingPos) {
      const whiteSafety = countDefenders(testBoard, whiteKingPos.r, whiteKingPos.c, true);
      score += (forWhite ? 1 : -1) * whiteSafety * 8;
    }

    return score;
  }

  function findKingOnBoard(testBoard, isWhiteKing) {
    const king = isWhiteKing ? "♔" : "♚";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (testBoard[r][c] === king) return { r, c };
      }
    }
    return null;
  }

  function countDefenders(testBoard, r, c, isWhiteKing) {
    let count = 0;
    const targetColor = isWhiteKing;
    for (let tr = 0; tr < 8; tr++) {
      for (let tc = 0; tc < 8; tc++) {
        const piece = testBoard[tr][tc];
        if (piece && isWhite(piece) === targetColor) {
          const moves = getLegalMovesOnBoard(testBoard, tr, tc);
          if (moves.some(m => m.r === r && m.c === c)) count++;
        }
      }
    }
    return count;
  }

  function getLegalMovesOnBoard(testBoard, r, c) {
    const piece = testBoard[r][c];
    const moves = [];
    const dirs = {
      rook: [[1,0],[-1,0],[0,1],[0,-1]],
      bishop: [[1,1],[1,-1],[-1,1],[-1,-1]],
      queen: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
    };

    function slide(directions) {
      directions.forEach(([dr, dc]) => {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (!testBoard[nr][nc]) moves.push({r:nr,c:nc});
          else {
            if (isWhite(piece) !== isWhite(testBoard[nr][nc])) moves.push({r:nr,c:nc});
            break;
          }
          nr += dr; nc += dc;
        }
      });
    }

    if (piece === "♙") {
      if (r > 0 && !testBoard[r-1][c]) moves.push({r:r-1,c});
      if (r === 6 && !testBoard[r-2][c] && !testBoard[r-1][c]) moves.push({r:r-2,c});
      [[-1,-1],[-1,1]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;
        if(testBoard[nr]?.[nc] && isBlack(testBoard[nr][nc])) moves.push({r:nr,c:nc});
      });
    }

    if (piece === "♟") {
      if (r < 7 && !testBoard[r+1][c]) moves.push({r:r+1,c});
      if (r === 1 && !testBoard[r+2][c] && !testBoard[r+1][c]) moves.push({r:r+2,c});
      [[1,-1],[1,1]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;
        if(testBoard[nr]?.[nc] && isWhite(testBoard[nr][nc])) moves.push({r:nr,c:nc});
      });
    }

    if (piece === "♖" || piece === "♜") slide(dirs.rook);
    if (piece === "♗" || piece === "♝") slide(dirs.bishop);
    if (piece === "♕" || piece === "♛") slide(dirs.queen);

    if (piece === "♘" || piece === "♞") {
      [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;
        if(nr>=0&&nr<8&&nc>=0&&nc<8 && (!testBoard[nr][nc] || isWhite(piece)!==isWhite(testBoard[nr][nc])))
          moves.push({r:nr,c:nc});
      });
    }

    if (piece === "♔" || piece === "♚") {
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
        if(dr||dc){
          const nr=r+dr,nc=c+dc;
          if(nr>=0&&nr<8&&nc>=0&&nc<8 && (!testBoard[nr][nc] || isWhite(piece)!==isWhite(testBoard[nr][nc])))
            moves.push({r:nr,c:nc});
        }
      }
    }

    return moves;
  }

  function minimax(testBoard, depth, isMaximizing, alpha = -Infinity, beta = Infinity) {
    if (depth === 0) {
      return evaluatePosition(testBoard, false);
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (testBoard[r][c] && isBlack(testBoard[r][c])) {
            const moves = getLegalMovesOnBoard(testBoard, r, c);
            for (let move of moves) {
              const newBoard = testBoard.map(row => [...row]);
              newBoard[move.r][move.c] = newBoard[r][c];
              newBoard[r][c] = "";
              const eval_score = minimax(newBoard, depth - 1, false, alpha, beta);
              maxEval = Math.max(maxEval, eval_score);
              alpha = Math.max(alpha, eval_score);
              if (beta <= alpha) break;
            }
          }
        }
      }
      return maxEval === -Infinity ? 0 : maxEval;
    } else {
      let minEval = Infinity;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (testBoard[r][c] && isWhite(testBoard[r][c])) {
            const moves = getLegalMovesOnBoard(testBoard, r, c);
            for (let move of moves) {
              const newBoard = testBoard.map(row => [...row]);
              newBoard[move.r][move.c] = newBoard[r][c];
              newBoard[r][c] = "";
              const eval_score = minimax(newBoard, depth - 1, true, alpha, beta);
              minEval = Math.min(minEval, eval_score);
              beta = Math.min(beta, eval_score);
              if (beta <= alpha) break;
            }
          }
        }
      }
      return minEval === Infinity ? 0 : minEval;
    }
  }

  function aiMove() {
    const allMoves = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] && isBlack(board[r][c])) {
          const moves = getLegalMoves(r, c);
          moves.forEach(m => {
            const testBoard = board.map(row => [...row]);
            testBoard[m.r][m.c] = testBoard[r][c];
            testBoard[r][c] = "";
            const score = minimax(testBoard, 2, false);
            allMoves.push({sr:r, sc:c, tr:m.r, tc:m.c, score});
          });
        }
      }
    }

    if (allMoves.length === 0) {
      checkGameEnd();
      if (gameOver) {
        winnerScreen.classList.remove("hidden");
      }
      return;
    }

    allMoves.sort((a, b) => b.score - a.score);
    const move = allMoves[0];

    makeMove(move.sr, move.sc, move.tr, move.tc);
    renderBoard();

    if (checkGameEnd()) {
      winnerScreen.classList.remove("hidden");
    }
  }

  startBtn.onclick = () => {
    home.classList.add("hidden");
    boardScreen.classList.remove("hidden");
    winnerScreen.classList.add("hidden");
    resetGame();
  };

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
    boardScreen.classList.add("hidden");
    winnerScreen.classList.add("hidden");
    home.classList.remove("hidden");
  };

  themeToggle.onclick = () => {
    document.body.classList.toggle("dark");
  };
});
