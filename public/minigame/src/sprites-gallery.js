(function () {
  const library = window.SPRITE_LIBRARY;
  const palette = window.PALETTE;

  if (!library || !palette) return;

  const app = document.getElementById('app');
  const scaleRange = document.getElementById('scale-range');
  const scaleValue = document.getElementById('scale-value');
  const bgButtons = Array.from(document.querySelectorAll('[data-bg]'));

  const state = {
    scale: parseInt(scaleRange.value, 10) || 8,
    bg: 'sky',
  };

  const previewRegistry = [];

  const canvasBackgrounds = {
    sky: function (ctx, width, height) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#8ad8ff');
      gradient.addColorStop(1, '#dff4ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    neutral: function (ctx, width, height) {
      ctx.fillStyle = '#f5f2ef';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ece6de';
      for (let y = 0; y < height; y += 16) {
        for (let x = (Math.floor(y / 16) % 2) * 8; x < width; x += 16) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    },
    night: function (ctx, width, height) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#20253f');
      gradient.addColorStop(1, '#0f1220');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
  };

  function renderSprite(grid, canvas, options) {
    const scale = options.scale;
    const padding = options.padding;
    const bg = options.bg;
    const width = grid[0].length;
    const height = grid.length;
    const totalWidth = (width + padding * 2) * scale;
    const totalHeight = (height + padding * 2) * scale;

    canvas.width = totalWidth;
    canvas.height = totalHeight;
    canvas.style.width = totalWidth + 'px';
    canvas.style.height = totalHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    canvasBackgrounds[bg](ctx, totalWidth, totalHeight);

    ctx.strokeStyle = bg === 'night' ? 'rgba(255,255,255,0.06)' : 'rgba(36,26,43,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      const px = (x + padding) * scale + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, padding * scale);
      ctx.lineTo(px, (height + padding) * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      const py = (y + padding) * scale + 0.5;
      ctx.beginPath();
      ctx.moveTo(padding * scale, py);
      ctx.lineTo((width + padding) * scale, py);
      ctx.stroke();
    }

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const key = grid[row][col];
        const color = palette[key];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect((col + padding) * scale, (row + padding) * scale, scale, scale);
      }
    }
  }

  function createFrameChip(frame) {
    const chip = document.createElement('div');
    chip.className = 'frame-chip';

    const chipHead = document.createElement('div');
    chipHead.className = 'frame-chip-head';
    chipHead.innerHTML = '<strong>' + frame.label + '</strong><span>' + frame.id + '</span>';
    chip.appendChild(chipHead);

    const canvas = document.createElement('canvas');
    canvas.className = 'sprite-canvas atomic';
    chip.appendChild(canvas);

    const meta = document.createElement('div');
    meta.className = 'frame-chip-meta';
    meta.textContent = frame.width + 'x' + frame.height;
    chip.appendChild(meta);

    chip._canvas = canvas;
    chip._frame = frame;
    return chip;
  }

  function createEntryCard(entry) {
    const card = document.createElement('article');
    card.className = 'sprite-card';

    const header = document.createElement('div');
    header.className = 'sprite-card-head';
    header.innerHTML =
      '<div><h3>' + entry.label + '</h3><p>' + entry.frames.length + ' atomic frame' + (entry.frames.length > 1 ? 's' : '') + '</p></div>' +
      '<div class="sprite-card-tag">' + (entry.animate ? 'Animated' : 'Static') + '</div>';
    card.appendChild(header);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'preview-wrap';
    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'sprite-canvas preview';
    previewWrap.appendChild(previewCanvas);
    card.appendChild(previewWrap);

    const atomics = document.createElement('div');
    atomics.className = 'atomics';
    for (const frame of entry.frames) {
      atomics.appendChild(createFrameChip(frame));
    }
    card.appendChild(atomics);

    card._previewCanvas = previewCanvas;
    card._entry = entry;
    previewRegistry.push(card);
    return card;
  }

  function createGroupSection(group) {
    const section = document.createElement('section');
    section.className = 'sprite-group';

    const head = document.createElement('div');
    head.className = 'sprite-group-head';
    head.innerHTML = '<h2>' + group.title + '</h2><p>' + group.description + '</p>';
    section.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'sprite-grid';
    for (const entry of group.entries) {
      grid.appendChild(createEntryCard(entry));
    }
    section.appendChild(grid);

    return section;
  }

  function rerenderAll() {
    scaleValue.textContent = state.scale + 'x';
    for (const card of previewRegistry) {
      const entry = card._entry;
      const previewFrame = entry.frames[card._frameIndex || 0];
      renderSprite(previewFrame.sprite, card._previewCanvas, {
        scale: state.scale,
        padding: 2,
        bg: state.bg,
      });
      const frameChips = card.querySelectorAll('.frame-chip');
      frameChips.forEach(function (chip) {
        renderSprite(chip._frame.sprite, chip._canvas, {
          scale: Math.max(4, state.scale - 2),
          padding: 1,
          bg: state.bg,
        });
      });
    }
  }

  function tick() {
    const now = performance.now();
    for (const card of previewRegistry) {
      const entry = card._entry;
      if (!entry.animate || entry.frames.length <= 1) {
        card._frameIndex = 0;
        continue;
      }
      const fps = entry.fps || 5;
      card._frameIndex = Math.floor(now / (1000 / fps)) % entry.frames.length;
    }
    rerenderAll();
    requestAnimationFrame(tick);
  }

  scaleRange.addEventListener('input', function () {
    state.scale = parseInt(scaleRange.value, 10) || 8;
    rerenderAll();
  });

  bgButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      state.bg = button.dataset.bg;
      bgButtons.forEach(function (item) {
        item.classList.toggle('active', item === button);
      });
      rerenderAll();
    });
  });

  for (const group of library.groups) {
    app.appendChild(createGroupSection(group));
  }

  rerenderAll();
  requestAnimationFrame(tick);
})();
