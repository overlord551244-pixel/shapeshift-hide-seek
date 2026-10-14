// Shared basics for the client: the connection, screen switching, and pop-up messages.
// Other scripts use socket, $, showScreen and toast.

const socket = io();
const $ = (id) => document.getElementById(id);

let currentScreen = 'menu';

function showScreen(name) {
  if (name === currentScreen) return;
  currentScreen = name;
  for (const s of document.querySelectorAll('.screen')) {
    s.classList.toggle('hidden', s.id !== 'screen-' + name);
  }
  window.scrollTo(0, 0);
}

function toast(message, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = message;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

// The game controls (WASD, number keys...) should only work on the game screen.
// This script loads before the game script, so it gets first look at every key press.
for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, (e) => {
    if (currentScreen !== 'game') e.stopImmediatePropagation();
  });
}

socket.on('disconnect', () => {
  showScreen('menu');
  toast('Connection lost. Rejoin to keep playing.', 'bad');
});