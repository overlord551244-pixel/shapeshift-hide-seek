// Menu screen and lobby screen
(function () {
  // Settings shown in the lobby. The server also enforces these limits.
  const SETTINGS = [
    { group: 'Round', items: [
      { key: 'prepTime', label: 'Preparation time', unit: 's', min: 5, max: 60, step: 1, hint: 'How long hiders get to pick a disguise' },
      { key: 'roundTime', label: 'Hunt time', unit: 's', min: 30, max: 900, step: 5, hint: 'How long the seeker has to find everyone' },
      { key: 'seekerCount', label: 'Seekers', min: 1, max: 4, step: 1, hint: 'There is always at least one hider' }
    ]},
    { group: 'Seeker', items: [
      { key: 'seekerHearts', label: 'Hearts', min: 1, max: 30, step: 1, hint: 'Lost when the seeker shoots an NPC' },
      { key: 'seekerSpeedMultiplier', label: 'Speed', unit: '\u00D7', min: 0.5, max: 3, step: 0.1, hint: 'Compared to hiders and NPCs' },
      { key: 'gunCooldown', label: 'Gun reload', unit: 's', min: 0.5, max: 10, step: 0.5, hint: 'Time between shots' },
      { key: 'seekerItemSlots', label: 'Hotbar slots', min: 1, max: 6, step: 1, hint: 'Slot 1 is always the gun' }
    ]},
    { group: 'Hiders', items: [
      { key: 'hiderItemSlots', label: 'Item slots', min: 0, max: 3, step: 1, hint: 'How many items a hider can carry' }
    ]},
    { group: 'Movement', items: [
      { key: 'baseSpeed', label: 'Walking speed', min: 60, max: 300, step: 10, hint: 'Shared by hiders and NPCs' },
      { key: 'sprintMultiplier', label: 'Sprint speed', unit: '\u00D7', min: 1, max: 3, step: 0.1, hint: 'Hold Shift (players only)' },
      { key: 'cornSlowdown', label: 'Corn slowdown', min: 0, max: 0.9, step: 0.05, hint: 'Corn Maze only. 0.75 = 75% slower' }
    ]}
  ];

  const MAP_INFO = {
    city:     { icon: '\uD83C\uDFD9\uFE0F', text: 'Tall buildings, streets, a park and parked cars. Very crowded.', who: 'Humans, birds, rats, squirrels' },
    farm:     { icon: '\uD83D\uDE9C', text: 'A barn, pens, fences and rolling fields. Medium crowd.', who: 'Chickens, pigs, sheep, cows, horses, goats' },
    mall:     { icon: '\uD83D\uDECD\uFE0F', text: 'Shops and shoppers in every direction. Very crowded.', who: 'Humans' },
    cornMaze: { icon: '\uD83C\uDF3D', text: 'A giant cornfield maze. Corn walls are slow and rustle.', who: 'Humans, birds, squirrels' }
  };

  let lastLobby = null;
  let myRole = null;

  // ---------- Menu ----------

  function getName() {
    const name = $('nameInput').value.trim();
    if (!name) {
      toast('Enter a name first.', 'bad');
      $('nameInput').focus();
      return null;
    }
    try { localStorage.setItem('shapeshift.name', name); } catch (e) { /* ignore */ }
    return name;
  }

  function reply(res) {
    if (res && res.error) toast(res.error, 'bad');
  }

  function createLobby() {
    const name = getName();
    if (!name) return;
    socket.emit('createLobby', name, reply);
  }

  function joinLobby() {
    const name = getName();
    if (!name) return;
    const code = $('codeInput').value.trim().toUpperCase();
    if (code.length !== 4) {
      toast('Enter the 4-letter lobby code.', 'bad');
      $('codeInput').focus();
      return;
    }
    socket.emit('joinLobby', code, name, reply);
  }

  function leaveLobby() {
    socket.emit('leaveLobby');
    lastLobby = null;
    $('resultBanner').classList.add('hidden');
    showScreen('menu');
  }

  $('createBtn').onclick = createLobby;
  $('joinBtn').onclick = joinLobby;
  $('leaveBtn').onclick = leaveLobby;
  $('leaveGameBtn').onclick = leaveLobby;

  $('codeInput').addEventListener('input', () => {
    $('codeInput').value = $('codeInput').value.toUpperCase().replace(/[^A-Z]/g, '');
  });
  $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinLobby(); });
  $('nameInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if ($('codeInput').value.trim().length === 4) joinLobby();
    else createLobby();
  });

  $('copyLinkBtn').onclick = async () => {
    const link = location.origin + '/?code=' + $('lobbyCode').textContent;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied!', 'good');
    } catch (e) {
      toast(link);
    }
  };

  $('startBtn').onclick = () => {
    socket.emit('startGame', reply);
  };

  // Remembered name, and a code from an invite link (?code=ABCD)
  try { $('nameInput').value = localStorage.getItem('shapeshift.name') || ''; } catch (e) { /* ignore */ }
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) $('codeInput').value = urlCode.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (!$('nameInput').value) $('nameInput').focus();

  // ---------- Settings (built once) ----------

  function buildSettings() {
    const root = $('settings');
    for (const group of SETTINGS) {
      const h = document.createElement('h4');
      h.textContent = group.group;
      root.appendChild(h);

      for (const s of group.items) {
        const row = document.createElement('label');
        row.className = 'setting';

        const text = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'setting-name';
        name.textContent = s.label;
        const hint = document.createElement('div');
        hint.className = 'setting-hint';
        hint.textContent = s.hint;
        text.append(name, hint);

        const box = document.createElement('div');
        box.className = 'setting-input';
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'set_' + s.key;
        input.min = s.min;
        input.max = s.max;
        input.step = s.step;
        input.addEventListener('change', () => {
          if (input.value === '') {
            if (lastLobby) input.value = lastLobby.settings[s.key];
            return;
          }
          input.dataset.pending = '1';
          socket.emit('updateSettings', { [s.key]: input.value });
        });
        box.appendChild(input);
        const unit = document.createElement('span');
        unit.className = 'unit';
        unit.textContent = s.unit || '';
        box.appendChild(unit);

        row.append(text, box);
        root.appendChild(row);
      }
    }
  }
  buildSettings();

  // ---------- Lobby ----------

  function hueFor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return h;
  }

  function badge(text, kind) {
    const b = document.createElement('span');
    b.className = 'badge ' + kind;
    b.textContent = text;
    return b;
  }

  function announceChanges(lobby) {
    if (!lastLobby || lastLobby.code !== lobby.code) return;
    const before = new Map(lastLobby.players.map((p) => [p.id, p.name]));
    const now = new Map(lobby.players.map((p) => [p.id, p.name]));
    for (const [id, name] of now) if (!before.has(id)) toast(name + ' joined');
    for (const [id, name] of before) if (!now.has(id)) toast(name + ' left');
    if (lastLobby.hostId !== lobby.hostId && lobby.hostId === socket.id) toast('You are now the host', 'good');
  }

  function renderPlayers(lobby) {
    $('playerCount').textContent = '(' + lobby.players.length + '/' + lobby.maxPlayers + ')';
    const ul = $('players');
    ul.innerHTML = '';
    for (const p of lobby.players) {
      const li = document.createElement('li');
      const av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = (p.name.charAt(0) || '?').toUpperCase();
      av.style.background = 'hsl(' + hueFor(p.id) + ' 55% 42%)';
      const nm = document.createElement('span');
      nm.className = 'pname';
      nm.textContent = p.name;
      li.append(av, nm);
      if (p.id === lobby.hostId) li.appendChild(badge('HOST', 'host'));
      if (p.id === socket.id) li.appendChild(badge('YOU', 'you'));
      ul.appendChild(li);
    }
  }

  function renderMaps(lobby, isHost) {
    const box = $('maps');
    box.innerHTML = '';
    for (const m of lobby.maps) {
      const info = MAP_INFO[m.key] || { icon: '\uD83D\uDDFA\uFE0F', text: '', who: '' };
      const card = document.createElement('div');
      card.className = 'map-card' + (m.key === lobby.map ? ' selected' : '') + (isHost ? '' : ' locked');

      const icon = document.createElement('div');
      icon.className = 'map-icon';
      icon.textContent = info.icon;
      const name = document.createElement('div');
      name.className = 'map-name';
      name.textContent = m.name;
      const desc = document.createElement('div');
      desc.className = 'map-desc';
      desc.textContent = info.text;
      const who = document.createElement('div');
      who.className = 'map-who';
      who.textContent = info.who;
      card.append(icon, name, desc, who);

      card.onclick = () => {
        if (isHost && m.key !== lobby.map) socket.emit('setMap', m.key);
      };
      box.appendChild(card);
    }
  }

  function renderSettings(lobby, isHost) {
    for (const key of Object.keys(lobby.settings)) {
      const input = $('set_' + key);
      if (!input) continue;
      // Don't overwrite what someone is typing, unless they just submitted it
      if (input.dataset.pending === '1' || document.activeElement !== input) {
        input.value = lobby.settings[key];
        delete input.dataset.pending;
      }
      input.disabled = !isHost;
    }
    $('hostNote').textContent = isHost
      ? 'You are the host. Change anything you like.'
      : 'Only the host can change these.';
  }

  function renderStartBar(lobby, isHost) {
    const enough = lobby.players.length >= 2;
    $('startBtn').classList.toggle('hidden', !isHost);
    $('startBtn').disabled = !enough;
    if (isHost) $('startHint').textContent = enough ? '' : 'You need at least 2 players to start.';
    else $('startHint').textContent = 'Waiting for the host to start the game...';
  }

  socket.on('lobbyUpdate', (lobby) => {
    const isHost = lobby.hostId === socket.id;
    announceChanges(lobby);

    $('lobbyCode').textContent = lobby.code;
    renderPlayers(lobby);
    renderMaps(lobby, isHost);
    renderSettings(lobby, isHost);
    renderStartBar(lobby, isHost);

    lastLobby = lobby;
    showScreen(lobby.state === 'lobby' ? 'lobby' : 'game');
  });

  // ---------- Round results ----------

  socket.on('roundStart', (info) => {
    myRole = info.role;
    $('resultBanner').classList.add('hidden');
  });

  socket.on('roundEnd', (d) => {
    const won = d.winner === (myRole === 'seeker' ? 'seekers' : 'hiders');
    const banner = $('resultBanner');
    banner.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = won ? 'Victory!' : 'Defeat';
    const sub = document.createElement('div');
    sub.textContent = d.reason;
    banner.append(title, sub);
    banner.className = 'banner ' + (won ? 'win' : 'lose');
  });

  socket.on('disconnect', () => { lastLobby = null; });
})();