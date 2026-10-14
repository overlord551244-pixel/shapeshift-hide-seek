// Preparation panel: disguise picker (hiders) and item picker (everyone)
(function () {
  let entityOptions = null;
  let selectedEntity = null;
  let selectedColor = null;
  let itemSlots = 0;
  let prepTime = 20;
  let collapsed = false;

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function formatTime(total) {
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  function itemName(key) {
    return Icons.INFO[key] ? Icons.INFO[key].name : key;
  }

  // ---------- Little pictures of each entity ----------

  function preview(entity, colorName, px) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = px * dpr;
    c.height = px * dpr;
    c.style.width = px + 'px';
    c.style.height = px + 'px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);

    const d = Sprites.dims(entity);
    const fit = (px - 10) / Math.max(d.w * 2, d.top + d.ground);
    const s = Math.min(fit, 2.4);
    g.translate(px / 2, px / 2);
    g.scale(s, s);
    // The sprite spans from "top" above its center to "ground" below it. Center that span.
    Sprites.draw(g, entity, colorName, 12, 0, -(d.ground - d.top) / 2, 1, false, 0);
    return c;
  }

  function pickBox(label, previewCanvas, selected, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (selected ? ' sel' : '');
    b.title = label;
    const t = document.createElement('span');
    t.textContent = label;
    b.append(previewCanvas, t);
    b.onclick = onClick;
    return b;
  }

  // ---------- Disguise picker ----------

  function updateChoiceText() {
    const el = $('choiceText');
    if (!selectedEntity) {
      el.textContent = 'Nothing picked yet. If time runs out, you get a random disguise.';
    } else if (!selectedColor) {
      el.textContent = 'Now pick a color for your ' + selectedEntity + '. Without one, you get a random color.';
    } else {
      el.textContent = "You'll be: " + cap(selectedEntity) + ' (' + selectedColor + '). You can change until time runs out.';
    }
    $('colorLabel').classList.toggle('hidden', !selectedEntity);
  }

  function buildColorPicker() {
    const box = $('colorPicker');
    box.innerHTML = '';
    if (!selectedEntity) return;
    for (const color of entityOptions[selectedEntity]) {
      box.appendChild(pickBox(cap(color), preview(selectedEntity, color, 64), color === selectedColor, () => {
        selectedColor = color;
        socket.emit('chooseEntity', selectedEntity, color);
        buildColorPicker();
        updateChoiceText();
      }));
    }
  }

  function buildEntityPicker() {
    const box = $('entityPicker');
    box.innerHTML = '';
    for (const key of Object.keys(entityOptions)) {
      const shown = key === selectedEntity && selectedColor ? selectedColor : entityOptions[key][0];
      box.appendChild(pickBox(cap(key), preview(key, shown, 64), key === selectedEntity, () => {
        if (selectedEntity === key) return;
        selectedEntity = key;
        selectedColor = null;
        socket.emit('chooseEntity', key, null);
        buildEntityPicker();
        buildColorPicker();
        updateChoiceText();
      }));
    }
  }

  // ---------- Item picker ----------

  function checkedItems() {
    return [...$('itemPicker').querySelectorAll('input:checked')].map((i) => i.value);
  }

  // Once you've picked as many as you're allowed, the rest are grayed out
  function refreshItemLocks() {
    const picked = checkedItems().length;
    const full = picked >= itemSlots;
    for (const cb of $('itemPicker').querySelectorAll('input')) {
      cb.disabled = full && !cb.checked;
    }
    $('slotUsed').textContent = picked;
  }

  function itemCard(key) {
    const info = Icons.INFO[key] || { name: key, type: 'active', text: '', stats: '' };

    const card = document.createElement('label');
    card.className = 'item-card';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = key;
    cb.addEventListener('change', () => {
      refreshItemLocks();
      socket.emit('pickItems', checkedItems());
    });

    const body = document.createElement('div');
    body.className = 'item-text';

    const title = document.createElement('div');
    title.className = 'item-title';
    const name = document.createElement('span');
    name.textContent = info.name;
    const tag = document.createElement('span');
    tag.className = 'item-tag ' + info.type;
    tag.textContent = info.type;
    title.append(name, tag);

    const desc = document.createElement('div');
    desc.className = 'item-desc';
    desc.textContent = info.text;

    const stats = document.createElement('div');
    stats.className = 'item-stats';
    stats.textContent = info.stats;

    body.append(title, desc, stats);
    card.append(cb, Icons.canvas(key, 52), body);
    return card;
  }

  function buildItemPicker(options) {
    const box = $('itemPicker');
    box.innerHTML = '';
    $('slotUsed').textContent = '0';
    if (itemSlots === 0) {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'No item slots this round.';
      box.appendChild(p);
      return;
    }
    for (const key of options) box.appendChild(itemCard(key));
  }

  // ---------- Collapse button ----------

  function applyCollapsed() {
    $('prepBody').classList.toggle('hidden', collapsed);
    $('collapseBtn').textContent = collapsed ? 'Show' : 'Hide';
  }
  $('collapseBtn').onclick = () => {
    collapsed = !collapsed;
    applyCollapsed();
  };

  // ---------- Round events ----------

  socket.on('roundStart', (info) => {
    $('prepPanel').classList.remove('hidden');
    $('finalText').textContent = '';
    selectedEntity = null;
    selectedColor = null;
    itemSlots = info.itemSlots;
    prepTime = info.prepTime;
    collapsed = false;
    applyCollapsed();

    const badge = $('roleBadge');
    badge.textContent = info.role.toUpperCase();
    badge.className = 'badge ' + info.role;
    $('mapName').textContent = info.mapName;
    $('slotCount').textContent = info.itemSlots;
    $('timer').textContent = formatTime(info.prepTime);
    $('phase').textContent = 'PREPARATION';

    $('timeFill').style.transition = 'none';
    $('timeFill').style.width = '100%';
    void $('timeFill').offsetWidth;   // make the browser apply the reset before animating again
    $('timeFill').style.transition = '';
    document.querySelector('.timebar').classList.remove('urgent');

    const isSeeker = info.role === 'seeker';
    $('entityBox').classList.toggle('hidden', isSeeker);
    $('prepTitle').textContent = isSeeker ? 'Get ready' : 'Choose your disguise';
    $('prepHint').textContent = isSeeker
      ? 'You will spawn when preparation ends.'
      : 'You can walk around while you choose. You are stuck with it when the timer ends.';
    $('itemHint').textContent = isSeeker
      ? 'Slot 1 is always your gun. Use items with the number keys (2, 3, ...) or by clicking them.'
      : 'Use items with the number keys (1, 2, ...) or by clicking them.';

    if (info.entities) {
      entityOptions = info.entities;
      buildEntityPicker();
      buildColorPicker();
      updateChoiceText();
    }
    buildItemPicker(info.itemOptions);
    $('itemSection').classList.toggle('hidden', itemSlots === 0 && !isSeeker);
  });

  socket.on('timer', (t) => {
    $('phase').textContent = t.phase === 'prep' ? 'PREPARATION' : 'HUNT';
    $('timer').textContent = formatTime(t.secondsLeft);
    if (t.phase === 'prep') {
      // The bar slides down over the next second, so it ends exactly when the next tick arrives
      const next = Math.max(0, t.secondsLeft - 1);
      $('timeFill').style.width = (next / prepTime) * 100 + '%';
      document.querySelector('.timebar').classList.toggle('urgent', t.secondsLeft <= 5);
    }
  });

  socket.on('locked', (d) => {
    $('prepPanel').classList.add('hidden');
    const names = (d.items || []).map(itemName);
    let text = '';
    if (d.entity) text += "You're locked in as: " + cap(d.entity) + ' (' + d.color + '). ';
    text += names.length ? 'Items: ' + names.join(', ') + '.' : 'No items.';
    $('finalText').textContent = text;
    if (d.entity) toast('Locked in as ' + cap(d.entity) + ' (' + d.color + ')', 'good');
  });
})();