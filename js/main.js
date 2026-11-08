(() => {
  'use strict';

  // ── Tuning knobs ────────────────────────────────────────────
  const CFG = {
    neighborAngle: 40,  // degrees around the orbit from the focus point to each neighbour (40 keeps them clear of the planet)
    tilt: 0.3,          // orbit minor/major axis ratio — lower = more edge-on
    scaleNear: 0.42,    // extra size when near
    scaleFar: 0.34,     // size reduction when far
    dimNear: 0.4,       // darkening when near — depth reads through size + dimming (no blur, keeps dots crisp)
    dimFar: 0.68,       // darkening when far (behind the planet)
    ease: 6,            // how snappy the orbit turns (higher = faster)
    entrySpin: 2.5,     // on load, asteroids sweep this many slots around the orbit into place (0 = off)
    entryEase: 1.8,     // how gently that entrance settles (lower = slower)
    direction: 1,       // 1 = next asteroid comes from behind the planet; -1 = from in front
    sway: 1,            // idle bob/tilt amount (0 = still)
    starDrift: [2, 4, 8], // px/sec drift per star layer (far → near)
    rockFeather: 0,     // soft fade at asteroid edges, as a fraction of rock size (0 = crisp edge)
    rockRim: 0.7,       // brightness of the thin rim light around each asteroid (0 = off, 1 = full)
    rockHalo: 0.06,     // soft shadow around each asteroid that fades what's behind it (fraction of rock size; 0 = off)
    rockHaloStrength: 0.65, // how dark that shadow is (0–1)
    rockRough: 0.09,    // asteroid edge roughness (0 = smooth outline, ~0.15 = very jagged)
    ditherMix: 0.82,    // asteroid dots: 1 = pure 1-bit dots, 0 = smooth shading (planet: DITHER_MIX in planet.js)
  };

  // ── Palette: monochrome gas giant + neutral rocks (accent colour lives in CSS) ──
  const PLANET = {
    C0: [0.86, 0.86, 0.84], C1: [0.64, 0.64, 0.63], C2: [0.42, 0.42, 0.42], C3: [0.24, 0.24, 0.25],
    Pole: [0.36, 0.36, 0.37], Dot: [0.9, 0.9, 0.92],
  };
  const ROCK_BOUNCE = [0.12, 0.12, 0.12];        // faint light bounced from the planet onto the rocks
  const DOT_RGB = PLANET.Dot.map((c) => Math.round(c * 255));

  const DATA = window.PORTFOLIO;
  const SECTIONS = DATA.sections;
  const N = SECTIONS.length;
  const HALF = N / 2;

  const $ = (sel, root = document) => root.querySelector(sel);
  const body = document.body;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqMobile = matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');   // keep in sync with styles.css
  let reduce = mqReduce.matches;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const mod = (n, m) => ((n % m) + m) % m;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const extAttrs = (href) => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '');

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Intro links + quick nav ─────────────────────────────────
  const LINKS = [
    DATA.links.resume && { label: 'Resume', href: DATA.links.resume, primary: true },
    { label: 'GitHub', href: DATA.links.github },
    { label: 'LinkedIn', href: DATA.links.linkedin },
    { label: 'Email', href: 'mailto:' + DATA.links.email },
  ].filter(Boolean);

  $('#links').innerHTML = LINKS.map((l) =>
    `<a class="btn${l.primary ? ' btn-primary' : ''}" href="${esc(l.href)}"${extAttrs(l.href)}>${esc(l.label)}</a>`
  ).join('');

  $('#quicknavList').innerHTML = SECTIONS.map((s, i) =>
    `<li><button type="button" data-i="${i}"><span class="qn-num">${pad(i + 1)}</span>${esc(s.label)}</button></li>`
  ).join('');
  const qnButtons = [...document.querySelectorAll('#quicknavList button')];
  qnButtons.forEach((b) => b.addEventListener('click', () => { goTo(+b.dataset.i); openPanel(); }));

  // ── Asteroid art: procedural, lit height-map rendered to canvas ──
  function makeNoise(seed) {
    const r = mulberry32(seed);
    const perm = new Uint8Array(512);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256).map(() => r());
    const h = (x, y) => val[perm[(perm[x & 255] + y) & 255]];
    const vnoise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
      const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
      return a + (b - a) * w;
    };
    return (x, y, oct = 5) => {           // fractal noise, 0..1
      let s = 0, amp = 0.5, f = 1, n = 0;
      for (let o = 0; o < oct; o++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
      return s / n;
    };
  }

  // Sun from the upper left (matches the planet); faint warm bounce light from the planet side.
  const SUN = (() => { const v = [-0.7, -0.55, 0.45]; const l = Math.hypot(...v); return v.map((c) => c / l); })();
  const BOUNCE = (() => { const v = [0.85, 0.4, 0.25]; const l = Math.hypot(...v); return v.map((c) => c / l); })();

  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function renderRock(canvas, sizePx, seed, layout) {
    const S = Math.max(48, Math.min(420, Math.round(sizePx)));
    if (canvas.width === S) return;
    canvas.width = canvas.height = S;
    const g = canvas.getContext('2d');
    const img = g.createImageData(S, S);
    const px = img.data;

    const r = mulberry32(seed * 7919 + 3);
    const noise = makeNoise(seed * 131 + 7);
    const harm = [0.15, 0.09, 0.05, 0.035].map((amp, k) => ({ k: k + 2, a: (r() - 0.5) * 2 * amp, p: r() * 6.283 }));
    const squash = 0.8 + r() * 0.14;
    const rot = r() * 6.283;
    const cr0 = Math.cos(rot), sr0 = Math.sin(rot);
    // Craters spread evenly around the body (not random): 3 at 120° apart, or 2 opposite each other.
    // One larger crater + smaller ones; each asteroid's pattern is rotated by its index so they differ.
    const count = layout.craters;
    const sizes = [0.21, 0.15, 0.12];
    const craters = Array.from({ length: count }, (_, k) => {
      const ang = layout.turn + (k / count) * Math.PI * 2;
      const cr = sizes[k];
      const dist = 0.56 - cr;                              // keeps every crater fully inside the outline
      return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * squash, r: cr, d: 0.09 };
    });
    const albedo = [0.44, 0.44, 0.44];

    const R0 = S * 0.36, c = S / 2;
    const H = new Float32Array(S * S);
    const COV = new Float32Array(S * S);
    const ALB = new Float32Array(S * S);

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const nx = (x + 0.5 - c) / R0, ny = (y + 0.5 - c) / R0;
        const qx = nx * cr0 + ny * sr0;
        const qy = (-nx * sr0 + ny * cr0) / squash;
        const th = Math.atan2(qy, qx);
        let rr = 1;
        for (const hm of harm) rr += hm.a * Math.cos(hm.k * th + hm.p);
        const ct = Math.cos(th), st = Math.sin(th);
        rr += (noise(ct * 1.6 + 50, st * 1.6 + 50, 2) - 0.5) * 0.08;    // broad unevenness
        // Roughness only changes the silhouette (rrEdge). The surface bulge below uses the smooth
        // shape (rr), otherwise every edge bump smears a streak of shading toward the centre.
        const rrEdge = rr
          + (noise(ct * 5 + 80, st * 5 + 80, 2) - 0.5) * CFG.rockRough            // knobs + chips
          + (noise(ct * 14 + 20, st * 14 + 20, 1) - 0.5) * CFG.rockRough * 0.3;    // fine grit
        const d = Math.hypot(qx, qy);
        const cov = Math.min(1, Math.max(0, (rrEdge - d) * R0 * squash + 0.5));
        const i = y * S + x;
        if (cov <= 0) continue;
        const t = Math.min(d / (rr + CFG.rockRough * 0.5), 1);    // smooth bulge that still covers the bumps
        let h = Math.sqrt(1 - t * t) * 0.85;
        h += (noise(nx * 2.2 + 10, ny * 2.2 + 10, 3) - 0.5) * 0.24;  // soft lumps
        let alb = 0.86 + 0.24 * noise(nx * 3 + 40, ny * 3 + 40, 3);   // gentle mottling
        for (const k of craters) {
          const dd = Math.hypot(nx - k.x, ny - k.y) / k.r;
          if (dd < 1.6) {
            if (dd < 1) { h -= k.d * (1 - dd * dd); alb *= 0.92; }
            h += k.d * 0.4 * Math.exp(-(((dd - 1) / 0.3) ** 2));
          }
        }
        H[i] = h; COV[i] = cov; ALB[i] = alb;
      }
    }

    const step = 2 / R0;
    const SUNL = new Float32Array(S * S);
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        const i = y * S + x;
        const cov = COV[i];
        if (cov <= 0) continue;
        let gx = -(H[i + 1] - H[i - 1]) / step, gy = -(H[i + S] - H[i - S]) / step, gz = 1;
        const l = Math.hypot(gx, gy, gz); gx /= l; gy /= l; gz /= l;
        let sun = Math.max(0, (gx * SUN[0] + gy * SUN[1] + gz * SUN[2] + 0.15) / 1.15);
        SUNL[i] = sun;
        // Soft cel-style banding: blend smooth light with gently stepped light
        const q = sun * 3, stepped = (Math.floor(q) + smoothstep(0.3, 0.7, q - Math.floor(q))) / 3;
        sun = sun * 0.5 + stepped * 0.5;
        const bounce = Math.max(0, gx * BOUNCE[0] + gy * BOUNCE[1] + gz * BOUNCE[2]) ** 2;
        const a = ALB[i];
        const o = i * 4;
        const bc = ROCK_BOUNCE;
        px[o]     = Math.min(255, 255 * (albedo[0] * a * (0.1 + sun * 1.25) + bounce * bc[0]));
        px[o + 1] = Math.min(255, 255 * (albedo[1] * a * (0.1 + sun * 1.22) + bounce * bc[1]));
        px[o + 2] = Math.min(255, 255 * (albedo[2] * a * (0.12 + sun * 1.18) + bounce * bc[2]));
        px[o + 3] = 255 * cov;
      }
    }
    ditherRock(g, img, S, COV);
  }

  // ── Dither pass for the asteroids (matches the planet shader) ──
  const BAYER8 = (() => {                 // 8×8 ordered-dither thresholds, 0..1
    let m = [[0]];
    for (let n = 1; n < 8; n *= 2) {
      const next = [];
      for (let y = 0; y < n * 2; y++) {
        next.push([]);
        for (let x = 0; x < n * 2; x++) {
          const q = [0, 2, 3, 1][(y >= n) * 2 + (x >= n)];
          next[y].push(4 * m[y % n][x % n] + q);
        }
      }
      m = next;
    }
    return m.map((row) => row.map((v) => (v + 0.5) / 64));
  })();

  // Box-blur a mask in place (separable, two passes) — used to feather asteroid edges
  function blurMask(m, S, r) {
    const tmp = new Float32Array(S * S), w = 2 * r + 1;
    for (let y = 0; y < S; y++) {                        // horizontal
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += m[y * S + clamp(x, 0, S - 1)];
      for (let x = 0; x < S; x++) {
        tmp[y * S + x] = acc / w;
        acc += m[y * S + Math.min(S - 1, x + r + 1)] - m[y * S + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < S; x++) {                        // vertical
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, S - 1) * S + x];
      for (let y = 0; y < S; y++) {
        m[y * S + x] = acc / w;
        acc += tmp[Math.min(S - 1, y + r + 1) * S + x] - tmp[Math.max(0, y - r) * S + x];
      }
    }
  }

  function ditherRock(g, img, S, COV) {
    const px = img.data;
    const cell = Math.max(1, Math.round(S / 150));      // ~1.5 CSS px dots
    const rimW = Math.max(1, Math.round(S / 160));      // rim-light thickness, ~1.5 CSS px

    // Feathered edge: blur the silhouette, then fade only inward so the outline stays put.
    // Keeps a front asteroid from cutting a hard line across the one behind it.
    const soft = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) soft[i] = COV[i] > 0.5 ? 1 : 0;
    const feather = CFG.rockFeather > 0;
    if (feather) {
      const r = Math.max(1, Math.round(S * CFG.rockFeather));
      blurMask(soft, S, r); blurMask(soft, S, r);        // two box blurs ≈ smooth gaussian falloff
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, o = i * 4;
        if (COV[i] <= 0) continue;
        const lum = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
        const th = BAYER8[Math.floor(y / cell) % 8][Math.floor(x / cell) % 8];
        const tone = Math.min(1, Math.pow(lum, 0.85) * 1.12);
        let v = tone * (1 - CFG.ditherMix) + (tone > th ? 1 : 0) * CFG.ditherMix;
        // Rim light: a thin edge lit by the planet behind, so the silhouette reads against the planet
        if (CFG.rockRim > 0) {
          const e = rimW;
          const out = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= S || yy >= S || COV[yy * S + xx] <= 0.5; };
          if (out(e, 0) || out(-e, 0) || out(0, e) || out(0, -e)) {
            const nx = (out(e, 0) ? 1 : 0) - (out(-e, 0) ? 1 : 0), ny = (out(0, e) ? 1 : 0) - (out(0, -e) ? 1 : 0);
            const toPlanet = Math.max(0, (nx * 0.85 + ny * 0.5) / (Math.hypot(nx, ny) || 1));   // planet is down-right
            v = Math.max(v, CFG.rockRim * (0.45 + 0.55 * toPlanet));
          }
        }
        px[o] = DOT_RGB[0] * v; px[o + 1] = DOT_RGB[1] * v; px[o + 2] = DOT_RGB[2] * v;
        const f = feather ? clamp((soft[i] - 0.5) * 2, 0, 1) : soft[i];   // 0 at the outline → 1 inside
        px[o + 3] = 255 * f * f * (3 - 2 * f);
      }
    }
    g.putImageData(img, 0, 0);
  }

  // ── Build asteroids ─────────────────────────────────────────
  const system = $('#system');
  const roids = SECTIONS.map((sec, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'roid';
    el.tabIndex = -1;                       // keyboard users use arrows / quick nav
    el.setAttribute('aria-label', sec.label);
    el.innerHTML = '<div class="roid-rock"><canvas aria-hidden="true"></canvas></div>';
    el.addEventListener('click', () => {
      if (i === current()) openPanel();
      else goTo(i);
    });


    system.append(el);

    return { el, rock: el.firstElementChild, canvas: el.querySelector('canvas'), seed: sec.seed ?? i + 1, size: sec.size || 1, filter: '', z: -1 };
  });

  // ── Orbit state ─────────────────────────────────────────────
  // `target` is an unbounded integer (so the orbit always turns the short way);
  // `pos` eases toward it every frame. Section index = target mod N.
  let target = 0;
  let pos = 0;
  const current = () => mod(target, N);
  const wrapK = (i, p) => mod(i - p + HALF, N) - HALF;   // signed slot offset, in (-N/2, N/2]

  function go(delta) {
    if (!delta) return;
    entryEase = null;                     // user took over: turn at normal speed
    target += delta;
    onTargetChange();
  }
  function goTo(i) { go(Math.round(wrapK(i, target))); }

  // Slot offset k → angle on the ellipse. k=0 is the focus point (left tip);
  // ±1 are the visible neighbours; |k| ≥ ~2 ends up off-screen / behind the planet.
  const P_EXP = Math.log(CFG.neighborAngle / 180) / Math.log(1 / HALF);
  function thetaFor(k) {
    const m = Math.min(Math.abs(k) / HALF, 1);
    return Math.PI + CFG.direction * Math.sign(k) * Math.PI * Math.pow(m, P_EXP);
  }

  // ── Layout ──────────────────────────────────────────────────
  const planet = $('#planet');
  const focusLabel = $('#focusLabel');
  const intro = $('#intro');
  let G = null;

  // WebGL dithered gas giant; falls back to a simple CSS planet if WebGL isn't available.
  const gasGiant = window.GasGiant?.create($('#planetGL'), PLANET) || null;
  body.classList.toggle('has-gl', !!gasGiant);

  let planetT = 0, planetLast = 0;

  // Width of the longest section name in the focus label (desktop size), for collision checks
  const measureCtx = document.createElement('canvas').getContext('2d');
  function widestLabelPx(fontPx) {
    measureCtx.font = `700 ${fontPx}px "Space Mono", ui-monospace, monospace`;
    return Math.max(...SECTIONS.map((s) => measureCtx.measureText(s.label).width)) + 28;   // + padding
  }

  let compact = false;

  function layout() {
    const W = innerWidth, H = innerHeight;

    // Desktop geometry first. The intro column ends at gutter + min(420px, 34vw) (see .intro in CSS);
    // the focus label sits left of the focused rock. Push the orbit right until the label clears the
    // intro — and if that would shove it too far into the planet, use the stacked (phone) layout.
    const gutter = clamp(W * 0.06, 24, 104);
    const introRight = gutter + Math.min(420, W * 0.34);
    const deskBase = clamp(H * 0.165, 96, 176);
    const needTipX = introRight + 20 + widestLabelPx(26) + deskBase * 0.5;
    const mobile = mqMobile.matches || needTipX > W * 0.74;   // stacked layout below ~880px wide
    body.classList.toggle('is-mobile', mobile);
    // Safety net: if the window is too short or narrow for the scene to fit (e.g. a phone held
    // sideways), hide the planet + asteroids and show a plain, scrollable intro + section list.
    compact = H < 520 || W < 320;
    body.classList.toggle('is-compact', compact);

    let R, cx, cy, tip, base;
    if (!mobile) {
      // Desktop: planet pushed into the bottom-right corner, about a third showing;
      // the focus point (left tip of the orbit) sits up and to the left of it.
      // When the orbit has to slide right to clear the intro, shrink the planet to match,
      // so the neighbour asteroids still sit in open space instead of on the planet.
      const push = Math.max(0, needTipX - W * 0.56);
      R = Math.max(H * 0.3, Math.min(H * 0.56, W * 0.42) - push * 0.9);
      cx = W + R * 0.18;
      cy = H * 0.8;
      tip = { x: Math.max(W * 0.56, needTipX), y: H * 0.4 };
      base = deskBase;                       // box size; the rock fills ~75% of it
    } else {
      // Phone / portrait: intro on top, planet rising from the bottom-right like a horizon,
      // focused asteroid in the open space between them.
      const introBottom = intro.getBoundingClientRect().bottom;
      base = clamp(W * 0.26, 76, 120);
      R = Math.min(W * 0.8, H * 0.42);
      cx = W * 0.95;
      cy = H + R * 0.22;
      tip = { x: W * 0.34, y: Math.max(H * 0.56, introBottom + base * 0.75 + 24) };
    }
    const dx = cx - tip.x, dy = cy - tip.y;
    const a = Math.hypot(dx, dy);
    const b = a * CFG.tilt;
    const phi = Math.atan2(dy, dx);

    G = { W, H, R, cx, cy, a, b, phi, cos: Math.cos(phi), sin: Math.sin(phi), tip, base, mobile };

    const d = 2 * R;
    Object.assign(planet.style, { width: d + 'px', height: d + 'px', left: cx - R + 'px', top: cy - R + 'px' });
    if (gasGiant) { gasGiant.resize({ cx, cy, R, W, H }); gasGiant.render(planetT); }

    // Orbit line: front half (near side) is drawn over the planet, back half under it.
    const deg = (phi * 180) / Math.PI;
    for (const id of ['orbitFrontG', 'orbitBackG']) $('#' + id).setAttribute('transform', `translate(${cx} ${cy}) rotate(${deg})`);
    $('#orbitFront').setAttribute('d', `M ${a} 0 A ${a} ${b} 0 0 1 ${-a} 0`);
    $('#orbitBack').setAttribute('d', `M ${-a} 0 A ${a} ${b} 0 0 1 ${a} 0`);

    roids.forEach((rd) => {
      const s = base * rd.size;
      rd.px = s;
      rd.el.style.width = rd.el.style.height = s + 'px';
      // Render at the largest on-screen size (near side) × pixel ratio, in ~40px buckets
      const want = s * (1 + CFG.scaleNear) * Math.min(2, devicePixelRatio || 1);
      const idx = roids.indexOf(rd);
      renderRock(rd.canvas, Math.ceil(want / 40) * 40, rd.seed, {
        craters: rd.size >= 1 ? 3 : 2,                     // bigger asteroids get 3, smaller ones 2
        turn: 0.6 + idx * 1.3,                             // rotate each asteroid's pattern differently
      });
    });

    // Label sits left of the focused rock on desktop, right of it on phones (left edge is too close)
    focusLabel.style.left = (mobile ? tip.x + base * 0.45 : tip.x - base * 0.5) + 'px';
    focusLabel.style.top = tip.y + 'px';

    // When the panel opens, pan the scene so the focused asteroid clears the panel.
    // (On phones the panel is a full-width sheet, so no pan.)
    const panelW = Math.min(560, W * 0.46);
    const panX = mobile ? 0 : Math.max(0, panelW + 300 - tip.x);   // leave room for the focus label
    system.style.setProperty('--pan-x', panX + 'px');

    resizeStars(W, H);
  }

  function pointAt(theta) {
    const lx = G.a * Math.cos(theta);
    const ly = G.b * Math.sin(theta);
    return {
      x: G.cx + lx * G.cos - ly * G.sin,
      y: G.cy + lx * G.sin + ly * G.cos,
      depth: Math.sin(theta),            // +1 nearest the viewer, −1 farthest
    };
  }

  // ── Stars ───────────────────────────────────────────────────
  const cvs = $('#stars');
  const ctx = cvs.getContext('2d');
  let stars = [];

  function resizeStars(W, H) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    cvs.width = W * dpr; cvs.height = H * dpr;
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = mulberry32(1234);
    const count = Math.round((W * H) / 2100);
    stars = Array.from({ length: count }, () => {
      const l = r() < 0.62 ? 0 : r() < 0.75 ? 1 : 2;
      return {
        x: r() * W, y: r() * H, l,
        r: [0.45, 0.75, 1.15][l] * (0.7 + r() * 0.6),
        a: [0.4, 0.6, 0.9][l] * (0.6 + r() * 0.4),
        tw: 0.3 + r() * 1.4, ph: r() * 6.283,
      };
    });
  }

  function drawStars(t, dt) {
    const { W, H } = G;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      if (!reduce) {
        s.x -= CFG.starDrift[s.l] * dt;
        if (s.x < -2) s.x += W + 4;
      }
      ctx.globalAlpha = reduce ? s.a : s.a * (0.65 + 0.35 * Math.sin(t * s.tw + s.ph));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Per-frame placement ─────────────────────────────────────
  function placeRoids(t) {
    roids.forEach((rd, i) => {
      const k = wrapK(i, pos);
      const ak = Math.abs(k);
      const th = thetaFor(k);
      const p = pointAt(th);
      const near = Math.max(0, p.depth), far = Math.max(0, -p.depth);

      const scale = 1 + CFG.scaleNear * near - CFG.scaleFar * far;
      // Depth without blur (blur smears the dots): neighbours shrink/grow and dim instead
      const bright = 1 - CFG.dimNear * near - CFG.dimFar * far;
      const op = clamp((2 - ak) / 0.45, 0, 1);       // fade anything past the neighbours

      const sw = reduce ? 0 : CFG.sway;
      const bob = Math.sin(t * 0.7 + i * 1.7) * 4 * sw;
      const tilt = Math.sin(t * 0.45 + i * 2.3) * 5 * sw;

      const half = rd.px / 2;
      rd.el.style.transform =
        `translate3d(${(p.x - half).toFixed(1)}px,${(p.y - half + bob).toFixed(1)}px,0) scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`;
      rd.el.style.opacity = op.toFixed(3);
      rd.el.style.pointerEvents = op > 0.5 ? '' : 'none';

      const halo = Math.round(rd.px * CFG.rockHalo);
      const filter = halo > 0
        ? `brightness(${bright.toFixed(2)}) drop-shadow(0 0 ${halo}px rgba(0,0,0,${CFG.rockHaloStrength}))`
        : `brightness(${bright.toFixed(2)})`;
      if (filter !== rd.filter) { rd.rock.style.filter = filter; rd.filter = filter; }

      // Layering: back orbit (5) < rocks behind the planet (10–19) < planet + front orbit (20)
      // < every other rock (25–35). A rock only drops under the planet when it is on the far side
      // AND actually overlapping the planet's disc; everywhere else it sits on top, and since rocks
      // are solid it simply hides the dotted line beneath it (no per-frame masking needed).
      const r = half * scale;
      const fromPlanet = Math.hypot(p.x - G.cx, p.y - G.cy);
      // (while the planet is still rising into place, treat every far-side rock as behind it)
      const behind = p.depth < 0 && (planetRising || fromPlanet < G.R + r);
      const z = behind ? 15 + Math.round(p.depth * 5) : 30 + Math.round(p.depth * 5);
      if (z !== rd.z) { rd.el.style.zIndex = z; rd.z = z; }

    });

    // Focus label fades while the orbit is turning
    const settle = clamp(1 - Math.abs(target - pos) * 2.2, 0, 1);
    focusLabel.style.opacity = settle.toFixed(3);
    focusLabel.style.pointerEvents = settle > 0.6 ? '' : 'none';
  }

  let last = performance.now();
  let entryEase = null;               // slower easing used only for the load-in sweep
  let planetRising = false;           // true during the reveal, while the planet slides into place
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pos = reduce ? target : pos + (target - pos) * (1 - Math.exp(-dt * (entryEase ?? CFG.ease)));
    if (Math.abs(target - pos) < 0.0005) pos = target;
    const t = now / 1000;
    drawStars(t, dt);
    if (!compact) placeRoids(t);
    // The planet changes slowly, so ~24fps is plenty and saves GPU
    if (gasGiant && !compact && !reduce && now - planetLast > (G.mobile ? 83 : 42)) {   // ~12fps on phones, ~24fps desktop
      planetT += Math.min(0.1, (now - planetLast) / 1000);
      planetLast = now;
      gasGiant.render(planetT);
    }
    requestAnimationFrame(frame);
  }

  // ── Focus label + controls ──────────────────────────────────
  function onTargetChange() {
    const i = current();
    const s = SECTIONS[i];
    $('#flName').textContent = s.label;
    focusLabel.setAttribute('aria-label', `Open ${s.label}`);
    qnButtons.forEach((b, k) => b.toggleAttribute('aria-current', k === i));
    roids.forEach((rd, k) => rd.el.classList.toggle('is-current', k === i));
    if (panelOpen) {
      render(i);
      history.replaceState(null, '', '#' + s.id);
    }
  }

  focusLabel.addEventListener('click', () => openPanel());

  // ── Panel ───────────────────────────────────────────────────
  const panel = $('#panel');
  const pContent = $('#panelContent');
  const pTitle = $('#panelTitle');
  const pEyebrow = $('#panelEyebrow');
  const pBody = $('#panelBody');
  const pScroll = $('#panelScroll');
  const pPrev = $('#panelPrev');
  const pNext = $('#panelNext');
  let panelOpen = false;
  let lastFocus = null;

  const tags = (items) => `<ul class="tags">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

  const RENDER = {
    projects: (s) => `
      <div class="proj-list">${s.featured.map((p, i) => `
        <article class="proj">
          <span class="proj-num">${pad(i + 1)}</span>
          <div>
            <h3><a href="${esc(p.code)}"${extAttrs(p.code)}>${esc(p.title)} <span aria-hidden="true">&gt;</span></a></h3>
            <p>${esc(p.desc)}</p>
            ${tags(p.stack)}
          </div>
        </article>`).join('')}
      </div>
      ${s.other?.length ? `
      <h3 class="p-sub">Other projects</h3>
      <ul class="other">${s.other.map((p) => `
        <li><a href="${esc(p.code)}"${extAttrs(p.code)}>${esc(p.title)}</a><span> - ${esc(p.desc)} <em>(${esc(p.stack)})</em></span></li>`).join('')}
      </ul>` : ''}`,

    experience: (s) => `
      <ol class="xp">${s.items.map((x) => `
        <li class="xp-item">
          <div class="xp-head">
            <div><h3>${esc(x.role)}</h3><p class="xp-org">${esc(x.org)}</p></div>
            <span class="xp-dates">${esc(x.dates)}</span>
          </div>
          <ul class="xp-bullets">${(x.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        </li>`).join('')}
      </ol>`,

    about: (s) => `
      ${(s.paragraphs || []).map((p, i) => `<p class="${i === 0 ? 'p-lede' : 'p-text'}">${esc(p)}</p>`).join('')}
      ${s.education ? `
      <h3 class="p-sub">Education</h3>
      <div class="edu">
        <div><strong>${esc(s.education.school)}</strong><p>${esc(s.education.degree)}</p></div>
        <span class="xp-dates">${esc(s.education.when)}</span>
      </div>` : ''}
      <h3 class="p-sub">Skills</h3>
      <div class="skills">${(s.skills || []).map((g) => `
        <div class="skill-group"><h4>${esc(g.group)}</h4>${tags(g.items)}</div>`).join('')}
      </div>`,

    arts: (s) => `
      ${(s.paragraphs || []).map((p, i) => `<p class="${i === 0 ? 'p-lede' : 'p-text'}">${esc(p)}</p>`).join('')}
      ${(s.groups || []).map((g) => `
        <h3 class="p-sub">${esc(g.title)}</h3>
        <ul class="plain-list">${g.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`).join('')}
      ${s.gallery?.length ? `
      <div class="gallery">${s.gallery.map((g) => `
        <figure><img src="${esc(g.src)}" alt="${esc(g.caption || '')}" loading="lazy">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}
      </div>` : ''}`,

    contact: (s) => `
      ${s.lede ? `<p class="p-lede">${esc(s.lede)}</p>` : ''}
      <a class="contact-email" href="mailto:${esc(DATA.links.email)}">${esc(DATA.links.email)}</a>
      <ul class="contact-list">
        ${LINKS.filter((l) => l.label !== 'Email').map((l) =>
          `<li><a href="${esc(l.href)}"${extAttrs(l.href)}><span>${esc(l.label)}</span><span aria-hidden="true">&gt;</span></a></li>`).join('')}
      </ul>`,
  };

  function render(i) {
    const s = SECTIONS[i];
    pEyebrow.textContent = `${pad(i + 1)} / ${pad(N)}`;
    pTitle.textContent = s.label;
    pBody.innerHTML = (RENDER[s.type] || (() => ''))(s);
    pPrev.innerHTML = `<span aria-hidden="true">&lt;</span> ${esc(SECTIONS[mod(i - 1, N)].label)}`;
    pNext.innerHTML = `${esc(SECTIONS[mod(i + 1, N)].label)} <span aria-hidden="true">&gt;</span>`;
    pScroll.scrollTop = 0;
    pContent.classList.remove('swap');
    void pContent.offsetWidth;          
    pContent.classList.add('swap');
  }

  function openPanel({ push = true } = {}) {
    const i = current();
    if (!panelOpen) lastFocus = document.activeElement;
    panelOpen = true;
    render(i);
    body.classList.add('panel-open');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
    intro.inert = true;
    const hash = '#' + SECTIONS[i].id;
    if (push && location.hash !== hash) history.pushState(null, '', hash);
    requestAnimationFrame(() => pTitle.focus({ preventScroll: true }));
  }

  function closePanel({ push = true } = {}) {
    if (!panelOpen) return;
    panelOpen = false;
    body.classList.remove('panel-open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    intro.inert = false;
    if (push && location.hash) history.pushState(null, '', location.pathname + location.search);
    if (lastFocus && lastFocus !== document.body && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function syncFromHash({ instant = false } = {}) {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = SECTIONS.findIndex((s) => s.id === id);
    if (i >= 0) {
      if (instant) { target = pos = i; onTargetChange(); }
      else goTo(i);
      openPanel({ push: false });
    } else {
      closePanel({ push: false });
    }
  }

  $('#panelClose').addEventListener('click', () => closePanel());
  $('#backdrop').addEventListener('click', () => closePanel());
  pPrev.addEventListener('click', () => go(-1));
  pNext.addEventListener('click', () => go(1));
  addEventListener('popstate', () => syncFromHash());

  // ── Input ───────────────────────────────────────────────────
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onControl = e.target.closest?.('button, a, input, textarea');
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown':
        if (compact && !panelOpen) return;          // let the page scroll
        e.preventDefault(); go(1); return;
      case 'ArrowLeft': case 'ArrowUp':
        if (compact && !panelOpen) return;
        e.preventDefault(); go(-1); return;
      case 'Escape': closePanel(); return;
      case 'Enter': case ' ':
        if (!onControl && !panelOpen) { e.preventDefault(); openPanel(); }
        return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= N) { goTo(n - 1); openPanel(); }
  });

  // Scroll / trackpad turns the orbit one step at a time (but scrolls the panel normally)
  let wheelAcc = 0, wheelLast = 0, wheelLock = 0;
  addEventListener('wheel', (e) => {
    if (compact || e.target.closest?.('.panel')) return;
    const now = performance.now();
    if (now - wheelLast > 250) wheelAcc = 0;   // new gesture
    wheelLast = now;
    if (now < wheelLock) return;               // one step per gesture-ish
    wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(wheelAcc) > 40) {
      go(Math.sign(wheelAcc));
      wheelAcc = 0;
      wheelLock = now + 550;
    }
  }, { passive: true });

  // Swipe left/right to turn the orbit on touch screens (panel scrolls normally)
  let touch0 = null;
  addEventListener('touchstart', (e) => {
    if (compact || e.touches.length !== 1 || e.target.closest?.('.panel')) { touch0 = null; return; }
    touch0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  addEventListener('touchend', (e) => {
    if (!touch0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch0.x, dy = t.clientY - touch0.y;
    touch0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  // ── Boot ────────────────────────────────────────────────────
  let resizeRaf = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  });
  mqReduce.addEventListener?.('change', (e) => { reduce = e.matches; });

  // ── Intro: hello → 你好 → bonjour, then the scene rises in ──
  // Add ?debug to the URL to see what the intro is doing, on screen
  const DEBUG = new URLSearchParams(location.search).has('debug');
  const dbgBox = DEBUG ? Object.assign(document.body.appendChild(document.createElement('pre')), {
    style: 'position:fixed;left:8px;bottom:8px;z-index:999;margin:0;padding:8px 10px;font:12px/1.4 monospace;color:#9f9;background:rgba(0,0,0,.8);border:1px solid #363;max-width:90vw;white-space:pre-wrap;pointer-events:none',
  }) : null;
  const t0 = performance.now();
  function dbg(msg) { if (dbgBox) dbgBox.textContent += `${Math.round(performance.now() - t0)}ms  ${msg}\n`; }
  if (DEBUG) {
    addEventListener('error', (e) => dbg('ERROR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
    dbg(`html class="${document.documentElement.className}"  hash="${location.hash}"  reducedMotion=${reduce}  webgl=${!!gasGiant}`);
  }

  function runHello() {
    const root = document.documentElement;
    const overlay = $('#hello');
    if (!root.classList.contains('is-intro')) { dbg('intro skipped (no is-intro class)'); overlay.remove(); return; }

    const word = $('#helloWord');
    const WORDS = [['hello', 'en', 1.05], ['你好', 'zh', 1.05], ['bonjour', 'fr', 1.15]];
    let i = 0, timer = 0, done = false;

    const show = () => {
      if (done) return;
      if (i >= WORDS.length) { finish(); return; }
      const [text, lang, dur] = WORDS[i++];
      word.textContent = text;
      word.lang = lang;
      word.style.setProperty('--dur', dur + 's');
      word.classList.remove('show');
      void word.offsetWidth;                  // restart the animation
      word.classList.add('show');
      dbg('word: ' + text);
      // Start the reveal while the last word is still racking out
      timer = setTimeout(show, i === WORDS.length ? dur * 840 : dur * 720);
    };

    // Any click, key, or scroll skips straight to the site
    const skip = (e) => { dbg('skipped by ' + e.type); e.stopImmediatePropagation(); if (e.type === 'keydown') e.preventDefault(); finish(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((t) => addEventListener(t, skip, { capture: true }));

    function finish() {
      if (done) return;
      done = true;
      dbg('reveal');
      clearTimeout(timer);
      events.forEach((t) => removeEventListener(t, skip, { capture: true }));
      overlay.classList.add('out');
      // Freeze the word where it is, then let it rack out of focus
      const cs = getComputedStyle(word);
      word.style.opacity = cs.opacity;
      word.style.filter = cs.filter;
      word.classList.remove('show');
      requestAnimationFrame(() => {
        word.style.transition = 'opacity .5s, filter .5s';
        word.style.opacity = '0';
        word.style.filter = 'blur(12px)';
      });
      root.classList.remove('is-intro');
      root.classList.add('is-reveal');
      // Asteroids sweep in along the orbit from behind the planet and settle into place
      if (!reduce && CFG.entrySpin) {
        pos = target - CFG.entrySpin;
        entryEase = CFG.entryEase;
        setTimeout(() => { entryEase = null; }, 3200);
      }
      if (!reduce) {
        planetRising = true;
        setTimeout(() => { planetRising = false; }, 2400);   // matches the 2.3s planet-rise animation
      }
      setTimeout(() => { root.classList.remove('is-reveal'); overlay.remove(); }, 2900);
    }

    // Wait for Space Mono (max 1.2s) so "hello" never appears in a fallback font and then jumps
    // Start once the font is ready, if the font fails, or after 1.2s, whichever comes first
    let started = false;
    const start = () => { if (started || done) return; started = true; dbg('words start'); timer = setTimeout(show, 120); };
    try { document.fonts.load('400 64px "Space Mono"').then(start, start); } catch (e) { start(); }
    setTimeout(start, 1200);
  }

  layout();
  document.fonts?.ready.then(layout);   // re-measure once the font has loaded (intro height can change)
  onTargetChange();
  syncFromHash({ instant: true });
  runHello();
  requestAnimationFrame(frame);
})();
