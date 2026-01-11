document.addEventListener("DOMContentLoaded", () => {
  const home = document.getElementById("home");
  const boardScreen = document.getElementById("boardScreen");
  const boardEl = document.getElementById("board");

  const startBtn = document.getElementById("startGame");
  const backBtn = document.getElementById("backBtn");
  const themeToggle = document.getElementById("themeToggle");

  if (!boardEl) {
    console.error("Board element not found. Check your HTML structure.");
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

  let board = JSON.parse(JSON.stringify(initialBoard));
  let selected = null;
  let playerTurn = true; // white moves

  function renderBoard() {
    boardEl.innerHTML = "";

    board.forEach((row, r) => {
      row.forEach((piece, c) => {
        const square = document.createElement("div");
        square.classList.add("square");

        if ((r + c) % 2 === 0) square.classList.add("light");
        else square.classList.add("dark-square");

        if (selected && selected.r === r && selected.c === c) {
          square.classList.add("selected");
        }

        square.textContent = piece;
        square.addEventListener("click", () => handleMove(r, c));

        boardEl.appendChild(square);
      });
    });
  }

  function handleMove(r, c) {
    if (!playerTurn) return;

    if (selected) {
      board[r][c] = board[selected.r][selected.c];
      board[selected.r][selected.c] = "";
      selected = null;
      renderBoard();

      // simple AI move after player
      setTimeout(aiMove, 400);
    } else if (board[r][c] !== "") {
      selected = { r, c };
      renderBoard();
    }
  }

  function aiMove() {
    playerTurn = false;

    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] !== "") {
          // naive random move target
          const tr = Math.floor(Math.random() * 8);
          const tc = Math.floor(Math.random() * 8);
          moves.push({ r, c, tr, tc });
        }
      }
    }

    if (moves.length > 0) {
      const move = moves[Math.floor(Math.random() * moves.length)];
      board[move.tr][move.tc] = board[move.r][move.c];
      board[move.r][move.c] = "";
    }

    playerTurn = true;
    renderBoard();
  }

  startBtn.addEventListener("click", () => {
    home.classList.add("hidden");
    boardScreen.classList.remove("hidden");
    board = JSON.parse(JSON.stringify(initialBoard));
    renderBoard();
  });

  backBtn.addEventListener("click", () => {
    boardScreen.classList.add("hidden");
    home.classList.remove("hidden");
  });

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });
});
