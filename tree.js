// A bonsai in its pot, drawn in text, its leaves moving in the wind. Every
// character is four rays cast into a small scene of spheres (leaves), capsules
// (wood) and boxes (the pot); whatever they hit is lit by a fixed sun and
// picked from RAMP. After the ringed planet on ascii.rest by bas3line.

const COLS = 72, FPS = 20;
const RAMP = " .,:-=+*#%@";
const ANGLE = 0.6;  // which side of the tree faces us
const PITCH = 0.22; // how far we look down on it
const WIND = 1;     // how hard it blows
const SEED = 17;    // change for a different tree

const unit = (v) => v.map((c) => c / Math.hypot(...v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const SUN = unit([-0.5, 0.7, 0.5]); // in view space

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- view ----------------------------------------------------------------

const cs = Math.cos(ANGLE), ss = Math.sin(ANGLE), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
// view space to tree space: undo the pitch, then the turn
const toTree = ([x, y, z]) => {
  const y1 = cp * y + sp * z, z1 = -sp * y + cp * z;
  return [cs * x - ss * z1, y1, ss * x + cs * z1];
};
// and back, for the screen position of a point on the tree
const toView = ([x, y, z]) => {
  const z1 = -ss * x + cs * z;
  return [cs * x + ss * z, cp * y - sp * z1, sp * y + cp * z1];
};
const X = toTree([1, 0, 0]), Y = toTree([0, 1, 0]), Z = toTree([0, 0, 1]);
const DIR = toTree([0, 0, -1]), SUNT = toTree(SUN);
const GUST = unit([X[0], 0, X[2]]); // the wind blows left to right across the screen

// ---- grow ----------------------------------------------------------------
// Tree space: y up, the soil at y = 0, one unit = one row of text.

const rand = mulberry32(SEED);
const pads = [];   // foliage pads: { c: [x, y, z], r, phase, at: c moved by the wind, leaves }
const wood = [];   // capsules: [ax, ay, az, bx, by, bz, r, then a bounding sphere: cx, cy, cz, R]
const boxes = [];  // the pot: [x0, y0, z0, x1, y1, z1]

// A domed pad of leaf spheres, thickest in the middle. Each leaf is
// [x, y, z, r, phase, then where the wind has it: x, y, z].
function pad(c, spread, lift, n, size) {
  const leaves = [[c[0], c[1] + lift * 0.6, c[2], size * 1.2]];
  for (let i = 1; i < n; i++) {
    const a = rand() * 2 * Math.PI, d = Math.sqrt(rand()) * spread;
    leaves.push([
      c[0] + Math.cos(a) * d,
      c[1] + (1 - d / spread) * lift + (rand() - 0.5) * 0.6,
      c[2] + Math.sin(a) * d,
      size * (0.65 + 0.5 * rand()),
    ]);
  }
  for (const s of leaves) s.push(rand() * 6.283, s[0], s[1], s[2]);
  const r = Math.max(...leaves.map(([x, y, z, s]) => Math.hypot(x - c[0], y - c[1], z - c[2]) + s));
  pads.push({ c, r: r + 0.4, phase: rand() * 6.283, at: [...c], leaves });
}

function branch(a, b, r) {
  const half = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2;
  wood.push([...a, ...b, r, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, half + r]);
}

// An S-curved trunk, thinning as it rises.
const trunk = [];
for (let i = 0; i <= 10; i++) {
  const h = i / 10;
  trunk.push([3.2 * Math.sin(h * 4.4), h * 24, 1.6 * Math.sin(h * 3.1), 1.4 - 0.9 * h]);
}
for (let i = 1; i < trunk.length; i++)
  branch(trunk[i - 1].slice(0, 3), trunk[i].slice(0, 3), (trunk[i - 1][3] + trunk[i][3]) / 2);

// A flared base and roots gripping the soil.
branch([0, 0, 0], [0, 1.5, 0], 1.9);
for (let k = 0; k < 5; k++) {
  const a = k * 1.3 + rand();
  branch([0, 0.4, 0], [Math.cos(a) * 4, 0, Math.sin(a) * 3], 0.6);
}

// Branches spiral up the trunk, each ending in a pad; the low ones reach furthest.
for (let i = 3; i <= 8; i++) {
  const a = i * 2.4 + rand() * 0.6;
  const L = 5 + (9 - i) * 0.9 + rand() * 1.5;
  const [x, y, z, r] = trunk[i];
  const b1 = [x + Math.cos(a) * L * 0.55, y + 0.5 + rand(), z + Math.sin(a) * L * 0.55];
  const b2 = [x + Math.cos(a) * L, b1[1] + 0.8 + rand(), z + Math.sin(a) * L];
  branch([x, y, z], b1, r * 0.6);
  branch(b1, b2, r * 0.4);
  pad([b2[0], b2[1] + 0.3, b2[2]], 2.6 + L * 0.28, 2, 12, 2.1);
  // long branches grow a second, smaller pad partway along
  if (L > 7) pad([b1[0], b1[1] + 0.8, b1[2]], 2, 1.4, 7, 1.7);
}
const crown = trunk[trunk.length - 1];
pad([crown[0], crown[1] + 0.4, crown[2]], 4.2, 3, 14, 2.3);

// A shallow rectangular pot on four feet, with soil inside the lip.
boxes.push([-8, -3.2, -5, 8, 0, 5], [-8.6, -0.6, -5.6, 8.6, 0.2, 5.6]);
for (const sx of [-1, 1]) for (const sz of [-1, 1])
  boxes.push([sx > 0 ? 5.5 : -7, -4, sz > 0 ? 3 : -4.4, sx > 0 ? 7 : -5.5, -3.2, sz > 0 ? 4.4 : -3]);
const POT = [-8.6, -4, -5.6, 8.6, 0.2, 5.6];
const SOIL = [7.8, 4.8]; // half sizes of the soil on top of the lip

// Fit the tree, with room for the leaves to blow about, into the grid.
let left = Infinity, right = -Infinity, above = -Infinity, below = Infinity, high = 0, reach = 8.6;
const extend = (p, r) => {
  const [x, y] = toView(p);
  (left = Math.min(left, x - r)), (right = Math.max(right, x + r));
  (below = Math.min(below, y - r)), (above = Math.max(above, y + r));
};
for (const p of pads)
  for (const s of p.leaves) {
    extend(s, s[3] + 1.6);
    high = Math.max(high, s[1] + s[3]);
    reach = Math.max(reach, Math.hypot(s[0], s[2]) + s[3] + 1.6);
  }
for (const b of boxes) for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) extend([x, y, z], 0);
const MID = (high + POT[1]) / 2;
const BOUND = Math.hypot(reach, (high - POT[1]) / 2 + 1);
const SCALE = (1.03 * (right - left)) / (COLS * 0.5);
const ROWS = Math.ceil((above - below) / SCALE) + 1;
const CX = (left + right) / 2, CY = (above + below) / 2;

// ---- trace ---------------------------------------------------------------

// Nearest hit along a ray: sets T, KIND (1 leaf, 2 wood, 3 pot) and the thing hit.
let T = 0, KIND = 0, HIT = null, FACE = 0;

function sphere(o, d, cx, cy, cz, r) {
  const lx = o[0] - cx, ly = o[1] - cy, lz = o[2] - cz;
  const b = lx * d[0] + ly * d[1] + lz * d[2];
  const h = b * b - (lx * lx + ly * ly + lz * lz - r * r);
  return h < 0 ? -1 : -b - Math.sqrt(h);
}

// Does the ray come within r of a point, ahead of its origin or around it?
function near(o, d, cx, cy, cz, r) {
  const lx = o[0] - cx, ly = o[1] - cy, lz = o[2] - cz;
  const b = lx * d[0] + ly * d[1] + lz * d[2], c = lx * lx + ly * ly + lz * lz - r * r;
  return b * b - c >= 0 && (b < 0 || c < 0);
}

// After Inigo Quilez's ray-capsule intersection.
function capsule(o, d, w) {
  const bax = w[3] - w[0], bay = w[4] - w[1], baz = w[5] - w[2];
  const oax = o[0] - w[0], oay = o[1] - w[1], oaz = o[2] - w[2];
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * d[0] + bay * d[1] + baz * d[2];
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d[0] * oax + d[1] * oay + d[2] * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const a = baba - bard * bard;
  const b = baba * rdoa - baoa * bard;
  const c = baba * oaoa - baoa * baoa - w[6] * w[6] * baba;
  const h = b * b - a * c;
  if (h < 0) return -1;
  const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard;
  if (y > 0 && y < baba) return t;
  return y <= 0 ? sphere(o, d, w[0], w[1], w[2], w[6]) : sphere(o, d, w[3], w[4], w[5], w[6]);
}

function box(o, d, b) {
  let lo = -Infinity, hi = Infinity, face = 0;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / d[i];
    const t0 = (b[i] - o[i]) * inv, t1 = (b[i + 3] - o[i]) * inv;
    const tn = t0 < t1 ? t0 : t1, tf = t0 < t1 ? t1 : t0;
    if (tn > lo) (lo = tn), (face = i);
    if (tf < hi) hi = tf;
  }
  FACE = face;
  return lo <= hi && hi > 0 ? lo : Infinity;
}

function cast(o, d, any) {
  T = Infinity;
  KIND = 0;
  for (const p of pads) {
    if (!near(o, d, p.at[0], p.at[1], p.at[2], p.r)) continue;
    for (const s of p.leaves) {
      const t = sphere(o, d, s[5], s[6], s[7], s[3]);
      if (t > 1e-3 && t < T) {
        (T = t), (KIND = 1), (HIT = s);
        if (any) return true;
      }
    }
  }
  for (const w of wood) {
    if (!near(o, d, w[7], w[8], w[9], w[10])) continue;
    const t = capsule(o, d, w);
    if (t > 1e-3 && t < T) {
      (T = t), (KIND = 2), (HIT = w);
      if (any) return true;
    }
  }
  if (box(o, d, POT) < T) {
    for (const b of boxes) {
      const t = box(o, d, b);
      if (t > 1e-3 && t < T) {
        (T = t), (KIND = 3), (HIT = FACE);
        if (any) return true;
      }
    }
  }
  return KIND > 0;
}

// Brightness 0..1 into SHADE, and what was hit (0 for empty space), for one ray.
let SHADE = 0;
function sample(o, d, sun) {
  if (!near(o, d, 0, MID, 0, BOUND) || !cast(o, d, false)) return 0;
  const kind = KIND, h = HIT;
  const P = [o[0] + d[0] * T, o[1] + d[1] * T, o[2] + d[2] * T];
  let N;
  if (kind === 1) N = [(P[0] - h[5]) / h[3], (P[1] - h[6]) / h[3], (P[2] - h[7]) / h[3]];
  else if (kind === 2) {
    const ba = [h[3] - h[0], h[4] - h[1], h[5] - h[2]], pa = [P[0] - h[0], P[1] - h[1], P[2] - h[2]];
    const u = Math.min(1, Math.max(0, dot(pa, ba) / dot(ba, ba)));
    N = [(pa[0] - u * ba[0]) / h[6], (pa[1] - u * ba[1]) / h[6], (pa[2] - u * ba[2]) / h[6]];
  } else {
    N = [0, 0, 0];
    N[h] = d[h] > 0 ? -1 : 1;
  }
  const lam = dot(N, sun);
  const lit = lam > 0 && !cast([P[0] + N[0] * 0.05, P[1] + N[1] * 0.05, P[2] + N[2] * 0.05], sun, true) ? lam : 0;
  if (kind === 1) {
    // leafy speckle, fixed to the leaf so it moves with it
    const q = [P[0] - h[5] + h[0], P[1] - h[6] + h[1], P[2] - h[7] + h[2]];
    const f = Math.sin(q[0] * 2.3 + Math.sin(q[2] * 1.9)) * Math.sin(q[1] * 3.1 + Math.sin(q[0] * 1.7)) * Math.sin(q[2] * 2.7 + q[1]);
    SHADE = (0.42 + 0.58 * lit) * (0.85 + 0.2 * f) * (0.85 - 0.15 * dot(N, d));
  } else if (kind === 2) SHADE = 0.3 + 0.55 * lit;
  else if (N[1] > 0 && Math.abs(P[0]) < SOIL[0] && Math.abs(P[2]) < SOIL[1]) {
    SHADE = (0.18 + 0.25 * lit) * (0.8 + 0.4 * Math.sin(P[0] * 7.1) * Math.sin(P[2] * 5.3));
    return 4;
  } else SHADE = 0.28 + 0.5 * lit;
  return kind;
}

// ---- wind ----------------------------------------------------------------

// Slow gusts lean every pad downwind, the higher ones further, in a wave that
// rolls across the tree; inside each pad the leaf clusters flutter on their own.
function blow(t) {
  const gust = WIND * (0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1));
  for (const p of pads) {
    const h = Math.max(0, p.c[1]) / high;
    const wave = Math.sin(t * 1.3 - toView(p.c)[0] * 0.18 + p.phase * 0.4);
    const lean = (0.25 + 0.75 * h) * (0.9 * gust + 0.35 * WIND * wave);
    const dx = GUST[0] * lean, dz = GUST[2] * lean, dy = -0.12 * Math.abs(lean);
    p.at[0] = p.c[0] + dx, p.at[1] = p.c[1] + dy, p.at[2] = p.c[2] + dz;
    for (const s of p.leaves) {
      const f = 0.22 * (0.4 + gust) * Math.sin(t * 4.3 + s[4]);
      s[5] = s[0] + dx + GUST[0] * f;
      s[6] = s[1] + dy + 0.12 * (0.4 + gust) * Math.sin(t * 3.1 + s[4] * 1.7);
      s[7] = s[2] + dz + GUST[2] * f;
    }
  }
}

// ---- draw ----------------------------------------------------------------

const CLASS = ["", "leaf", "wood", "pot", "soil"];

function frame(t) {
  blow(t);
  let html = "";
  const o = [0, 0, 0], count = [0, 0, 0, 0, 0];
  for (let r = 0; r < ROWS; r++) {
    let run = "";
    for (let c = 0; c < COLS; c++) {
      let sum = 0, hits = 0;
      count.fill(0);
      for (let k = 0; k < 4; k++) {
        const px = (c + 0.25 + 0.5 * (k & 1) - COLS / 2) * 0.5 * SCALE + CX;
        const py = (ROWS / 2 - r - 0.25 - 0.5 * (k >> 1)) * SCALE + CY;
        for (let i = 0; i < 3; i++) o[i] = px * X[i] + py * Y[i] + 100 * Z[i];
        const kind = sample(o, DIR, SUNT);
        if (kind) (sum += SHADE), hits++, count[kind]++;
      }
      let ch = " ", cls = run;
      if (hits >= 2) {
        const v = sum / hits;
        let i = Math.min(RAMP.length - 1, Math.max(1, Math.round(v * (RAMP.length - 1))));
        if (PAPER) i = Math.max(2, RAMP.length - i);
        ch = RAMP[i];
        let kind = 1;
        for (let i = 2; i < 5; i++) if (count[i] > count[kind]) kind = i;
        cls = kind === 1 && v > 0.55 ? "leaf2" : CLASS[kind];
      }
      if (cls !== run) {
        if (run) html += "</i>";
        if (cls) html += `<i class="${cls}">`;
        run = cls;
      }
      html += ch;
    }
    if (run) html += "</i>";
    html += "\n";
  }
  return html;
}

const el = document.getElementById("tree");
// Dark ink on a light page: dense characters read as shadow, so flip the ramp.
const PAPER = (() => {
  const [r, g, b] = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
})();
const still = matchMedia("(prefers-reduced-motion: reduce)");
let t = 0, last = 0, raf = 0;
const draw = () => (el.innerHTML = frame(t));
const tick = (now) => {
  raf = requestAnimationFrame(tick);
  const dt = now - last;
  if (dt < 1000 / FPS - 2) return;
  last = now;
  t += Math.min(dt, 100) / 1000;
  draw();
};
const run = () => {
  const go = !document.hidden && !still.matches;
  if (go && !raf) (last = performance.now()), (raf = requestAnimationFrame(tick));
  else if (!go && raf) cancelAnimationFrame(raf), (raf = 0);
};
draw();
run();
document.addEventListener("visibilitychange", run);
still.addEventListener("change", run);
