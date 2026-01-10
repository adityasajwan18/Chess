const home = document.getElementById("home");
const boardScreen = document.getElementById("boardScreen");
const boardEl = document.getElementById("board");

const startBtn = document.getElementById("startGame");
const backBtn = document.getElementById("backBtn");
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

let board = JSON.parse(JSON.stringify(initialBoard));
let selected = null;

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
      square.onclick = () => handleMove(r, c);

      boardEl.appendChild(square);
    });
  });
}

function handleMove(r, c) {
  if (selected) {
    board[r][c] = board[selected.r][selected.c];
    board[selected.r][selected.c] = "";
    selected = null;
  } else if (board[r][c] !== "") {
    selected = { r, c };
  }

  renderBoard();
}

startBtn.onclick = () => {
  home.classList.add("hidden");
  boardScreen.classList.remove("hidden");
  renderBoard();
};

backBtn.onclick = () => {
  boardScreen.classList.add("hidden");
  home.classList.remove("hidden");
};

themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
};
