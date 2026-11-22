// Projeto Jula · "Por dentro da Jula"
// Cena 3D guiada pela rolagem: caminho da força, motor 6 em linha,
// caixa de marcha e diferencial (aberto x blocante).
// Modelo ilustrativo, fora de escala. Os números com fonte ficam no HTML.
import * as THREE from 'three';


/* ---------- geometria ---------- */
const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = x => x * x * (3 - 2 * x);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// caixa arredondada: w em x, h em y, d em z
function rbox(w, h, d, b = 0.025) {
  const r = Math.min(b * 1.5, (Math.min(w, h) - 2 * b) * 0.45);
  const g = new THREE.ExtrudeGeometry(roundRect(w - 2 * b, h - 2 * b, Math.max(r, 0.001)),
    { depth: Math.max(d - 2 * b, 0.001), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 6 });
  g.center(); return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, s = 32, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
// engrenagem reta, eixo z
function gearGeo(r, teeth, thick, th = 0.016, hole = 0) {
  const s = new THREE.Shape(), ro = r + th * 0.5, ri = r - th * 0.5, da = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * da;
    [[ri, a], [ri, a + da * 0.12], [ro, a + da * 0.3], [ro, a + da * 0.55], [ri, a + da * 0.72]]
      .forEach(([rr, aa], k) => { const x = rr * Math.cos(aa), y = rr * Math.sin(aa); (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  s.closePath();
  if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 1, curveSegments: 16 });
  g.translate(0, 0, -thick / 2); return g;
}
// engrenagem cônica (tronco com dentes), eixo y, raio r1 no topo
function bevelGeo(r1, r2, h, teeth) {
  const segs = teeth * 2, g = new THREE.CylinderGeometry(r1, r2, h, segs, 1, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); if (Math.hypot(x, z) < 1e-5) continue;
    const k = Math.round(Math.atan2(z, x) / TAU * segs);
    if (((k % 2) + 2) % 2 === 1) { p.setX(i, x * 0.84); p.setZ(i, z * 0.84); }
  }
  g.computeVertexNormals(); return g;
}
function coilGeo(r, h, turns, wire) {
  const pts = []; for (let i = 0; i <= turns * 24; i++) { const a = i / 24 * TAU; pts.push(V(r * Math.cos(a), i / (turns * 24) * h - h / 2, r * Math.sin(a))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, wire, 6, false);
}

/* ---------- texturas ---------- */
function cobbles() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#1c1a18'; g.fillRect(0, 0, 512, 512);
  const tones = ['#45413c', '#4f4a44', '#3b3834', '#58524b', '#403c37'];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 16; row++) {
    let x = row % 2 ? -20 : 0;
    while (x < 512) {
      const w = 26 + rnd() * 18;
      g.fillStyle = tones[(rnd() * tones.length) | 0];
      g.beginPath(); g.roundRect(x + 2, row * 32 + 2, w - 4, 28, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 6, row * 32 + 5, w - 14, 4);
      x += w;
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function finsTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#8d949b'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) { g.fillStyle = x % 8 ? '#c3c9cf' : '#6f767d'; g.fillRect(x, 0, 2, 256); }      // aletas
  for (let y = 0; y < 256; y += 32) { g.fillStyle = '#dfe3e7'; g.fillRect(0, y, 256, 7); g.fillStyle = '#5b6168'; g.fillRect(0, y + 7, 256, 2); } // tubos
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,190,150,.9)'); gr.addColorStop(1, 'rgba(255,60,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ color: 0x1d1a17, side: THREE.BackSide })));
  const L = (w, h, p, k, col = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); s.add(m);
  };
  L(6, 1.4, [0.01, 3.4, 0], 7); L(2.4, 3.5, [-5.9, 0.6, 1.5], 3.2, 0xffe6cc);
  L(2.4, 3.5, [5.9, 0.6, -1.5], 2.2, 0xd9e6ff); L(4, 1.2, [0, 1.2, -5.9], 2.6, 0xff8f70);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.04).texture; pm.dispose(); return tex;
}

/* ---------- cena ---------- */
function boot(sec) {
  const stage = sec.querySelector('.mech-stage');
  const canvas = stage.querySelector('canvas');
  const labelsBox = stage.querySelector('.mech-labels');
  const N = sec.querySelectorAll('.mstep').length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { sec.classList.add('no-webgl'); return; }
  const mobile = Math.min(screen.width, screen.height) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x121110);
  scene.background = BG; scene.fog = new THREE.Fog(BG, 16, 42);
  scene.environment = makeEnv(renderer); scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 90);

  scene.add(new THREE.HemisphereLight(0xfff4e8, 0x1a1410, 0.45));
  const sun = new THREE.DirectionalLight(0xfff1e0, 2.4); sun.position.set(5, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff6a4a, 1.0); rim.position.set(-7, 3, -5); scene.add(rim);

  const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const M = {
    steel: std(0xb4b9bf, 0.9, 0.3), alu: std(0xd2d5d8, 0.75, 0.35), iron: std(0x34373b, 0.55, 0.55),
    black: std(0x161616, 0.4, 0.5), rubber: std(0x111111, 0, 0.92), chrome: std(0xf0f0f0, 1, 0.1),
    rust: std(0x6b5446, 0.5, 0.7), ceramic: std(0xeeeae2, 0, 0.4),
    red: new THREE.MeshPhysicalMaterial({ color: 0xc4161c, metalness: 0.2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }),
  };
  let ASM = 'chao';
  const add = (geo, mat, parent = scene, pos, rot) => {
    const m = new THREE.Mesh(geo, mat); m.userData.asm = ASM; if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const shell = base => { const m = base.clone(); m.transparent = false; return m; };
  const setOpacity = (m, o) => { const t = o < 0.995; m.opacity = o; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.depthWrite = !t; };

  const FX0 = 2.4;
  /* chão de paralelepípedo */
  const groundTex = cobbles(); groundTex.repeat.set(20, 20);
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = add(new THREE.PlaneGeometry(60, 60), std(0xffffff, 0, 0.92, { map: groundTex }), scene, [0, 0, 0], [-PI / 2, 0, 0]);
  ground.castShadow = false;

  /* chassi */
  ASM = 'chassi';
  const RAIL_Z = 0.62;
  for (const z of [-RAIL_Z, RAIL_Z]) add(rbox(7.5, 0.16, 0.08, 0.015), M.black, scene, [-0.55, 0.98, z]);
  // travessas retas só onde não há motor, caixa ou cardã por baixo
  for (const x of [3.17, -0.9, -3.4, -4.2]) add(box(0.08, 0.1, RAIL_Z * 2), M.black, scene, [x, 0.98, 0]);
  // travessa dianteira (agregado da suspensão), baixa, por baixo do cárter
  ASM = 'chassi';
  add(rbox(0.16, 0.08, RAIL_Z * 2 + 0.08, 0.01), M.black, scene, [FX0, 0.5, 0]);
  for (const z of [-RAIL_Z, RAIL_Z]) add(box(0.12, 0.38, 0.08), M.black, scene, [FX0, 0.73, z]);
  // travessa da caixa, sob o prolongamento traseiro
  add(rbox(0.1, 0.05, RAIL_Z * 2, 0.01), M.black, scene, [0.22, 0.7, 0]);
  for (const z of [-RAIL_Z, RAIL_Z]) add(box(0.08, 0.24, 0.06), M.black, scene, [0.22, 0.81, z]);

  /* rodas */
  const R = 0.6;
  const WR = shell(M.rubber), WB = shell(M.black);
  function wheel(side) {
    const prev = ASM; ASM = 'roda';
    const g = new THREE.Group();
    add(cyl(R, R, 0.34, 48), WR, g, [0, 0, 0], [PI / 2, 0, 0]);
    const tread = box(0.07, 0.035, 0.3);
    for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; add(tread, WR, g, [Math.cos(a) * R, Math.sin(a) * R, 0], [0, 0, a]); }
    add(cyl(0.4, 0.4, 0.35, 40), WB, g, [0, 0, 0], [PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.33, 0.012, 8, 48), M.red, g, [0, 0, side * 0.176]);
    add(cyl(0.15, 0.17, 0.05, 32), M.chrome, g, [0, 0, side * 0.19], [PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; add(cyl(0.018, 0.018, 0.04, 8), M.chrome, g, [Math.cos(a) * 0.22, Math.sin(a) * 0.22, side * 0.18], [PI / 2, 0, 0]); }
    ASM = prev; return g;
  }
  const FX = 2.4, TRACK = 1.25;
  const discMat = std(0xb4b9bf, 0.9, 0.35, { emissive: 0xff4a10, emissiveIntensity: 0 }), calipers = [];
  const front = [-1, 1].map(s => {
    const g = wheel(s); g.position.set(FX, R, s * TRACK); scene.add(g);
    // freio a disco e pinça (ficha: freios a disco)
    ASM = 'freio';
    add(cyl(0.27, 0.27, 0.025, 40), discMat, g, [0, 0, -s * 0.26], [PI / 2, 0, 0]);
    for (let h = 0; h < 6; h++) { const a = h / 6 * TAU; add(cyl(0.012, 0.012, 0.03, 8), M.black, g, [Math.cos(a) * 0.2, Math.sin(a) * 0.2, -s * 0.26], [PI / 2, 0, 0]); }
    const cz = s * (TRACK - 0.26);
    for (const side of [-1, 1]) calipers.push({ m: add(rbox(0.12, 0.17, 0.03, 0.01), M.red, scene, [FX - 0.2, R + 0.13, cz + side * 0.04]), base: cz + side * 0.04, side });
    add(rbox(0.12, 0.03, 0.12, 0.01), M.red, scene, [FX - 0.23, R + 0.24, cz]);
    // suspensão independente: bandejas, manga de eixo e mola
    ASM = 'suspensao';
    add(rbox(0.06, 0.4, 0.05, 0.01), M.black, scene, [FX + 0.1, 0.65, s * 0.9]);              // manga de eixo
    add(rbox(0.06, 0.05, 0.22, 0.01), M.black, scene, [FX + 0.1, 0.6, s * 0.96]);             // ponta de eixo
    add(rbox(0.06, 0.05, 0.25, 0.01), M.black, scene, [FX + 0.1, 0.47, s * 0.75]);            // bandeja inferior
    add(rbox(0.06, 0.05, 0.2, 0.01), M.black, scene, [FX + 0.1, 0.83, s * 0.77]);             // bandeja superior
    add(coilGeo(0.06, 0.3, 5, 0.012), M.black, scene, [FX + 0.1, 0.66, s * 0.72]);
    ASM = 'roda';
    return g;
  });

  /* motor 261 · seis em linha */
  ASM = 'motor';
  const EX = 2.0, CY = 0.85, CR = 0.09, CL = 0.26;
  const cylX = i => EX + (3.5 - i) * 0.2;              // cilindro 1 na frente
  const PHASE = { 1: 0, 2: 240, 3: 120, 4: 120, 5: 240, 6: 0 }; // moentes: pares 1-6, 2-5, 3-4
  const FIRE = { 1: 0, 5: 120, 3: 240, 6: 360, 2: 480, 4: 600 }; // ordem 1-5-3-6-2-4
  const engine = new THREE.Group(); scene.add(engine);
  const shellE = shell(M.iron);
  add(rbox(1.36, 0.6, 0.44, 0.03), shellE, engine, [EX, 1.1, 0]);
  add(rbox(1.2, 0.18, 0.36, 0.04), shellE, engine, [EX, 0.71, 0]);
  const linerMat = std(0x8a8f96, 0.8, 0.35, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const crank = new THREE.Group(); crank.position.set(EX, CY, 0); engine.add(crank);
  add(cyl(0.035, 0.035, 1.52, 16), M.steel, crank, [0, 0, 0], [0, 0, PI / 2]);
  add(cyl(0.26, 0.26, 0.05, 48), M.steel, crank, [-0.72, 0, 0], [0, 0, PI / 2]);   // volante
  add(cyl(0.09, 0.09, 0.05, 32), M.black, crank, [0.78, 0, 0], [0, 0, PI / 2]);    // polia
  const pistons = [], rods = [], glows = [];
  for (let i = 1; i <= 6; i++) {
    const x = cylX(i);
    const th = new THREE.Group(); th.position.x = x - EX; th.rotation.x = PHASE[i] * DEG; crank.add(th);
    add(cyl(0.03, 0.03, 0.1, 16), M.steel, th, [0, CR, 0], [0, 0, PI / 2]);
    for (const s of [-1, 1]) add(rbox(0.026, CR + 0.17, 0.11, 0.008), M.iron, th, [s * 0.062, CR / 2 - 0.05, 0]);
    add(cyl(0.078, 0.078, 0.52, 28, true), linerMat, engine, [x, 1.12, 0]);
    pistons.push(add(cyl(0.072, 0.072, 0.1, 28), M.alu, engine, [x, 1.1, 0]));
    rods.push(add(rbox(0.028, CL, 0.04, 0.008), M.steel, engine, [x, 1, 0]));
    const gm = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const gl = add(new THREE.SphereGeometry(0.075, 16, 8), gm, engine, [x, 1.36, 0]); gl.scale.y = 0.5; gl.castShadow = false; glows.push(gl);
  }
  const fan = new THREE.Group(); fan.position.set(2.86, 1.2, 0); engine.add(fan);
  // hélice de aço, 6 pás, fixação de 4 furos (anúncio indicado pelo dono); diâmetro a confirmar
  const fanSteel = std(0x2c2f33, 0.75, 0.4);
  add(cyl(0.085, 0.085, 0.012, 32), fanSteel, fan, [0, 0, 0], [0, 0, PI / 2]);            // aranha central
  add(cyl(0.05, 0.05, 0.05, 24), M.iron, fan, [-0.03, 0, 0], [0, 0, PI / 2]);              // cubo da bomba d'água
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; add(cyl(0.011, 0.011, 0.02, 6), M.chrome, fan, [0.012, Math.cos(a) * 0.055, Math.sin(a) * 0.055], [0, 0, PI / 2]); }
  const bladeShape = new THREE.Shape(); bladeShape.moveTo(-0.032, 0.07); bladeShape.lineTo(0.032, 0.07);
  bladeShape.quadraticCurveTo(0.06, 0.25, 0.058, 0.36); bladeShape.quadraticCurveTo(0, 0.375, -0.058, 0.36); bladeShape.quadraticCurveTo(-0.06, 0.25, -0.032, 0.07);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.006, bevelEnabled: false, curveSegments: 10 }).rotateY(PI / 2);
  for (let i = 0; i < 6; i++) { const arm = new THREE.Group(); arm.rotation.x = i / 6 * TAU; fan.add(arm); add(bladeGeo, fanSteel, arm, [0, 0, 0], [0, 0.45, 0]); }
  // cabeçote, tampa vermelha, carburador, filtro cromado, velas
  const head = new THREE.Group(); engine.add(head);
  add(rbox(1.36, 0.14, 0.42, 0.025), M.iron, head, [EX, 1.47, 0]);
  add(rbox(1.24, 0.11, 0.28, 0.04), M.red, head, [EX, 1.595, -0.03]);
  for (let i = 0; i < 4; i++) add(cyl(0.014, 0.014, 0.02, 8), M.chrome, head, [EX - 0.45 + i * 0.3, 1.655, -0.03]);
  add(cyl(0.055, 0.065, 0.14, 20), M.iron, head, [EX, 1.6, 0.27]);
  add(cyl(0.2, 0.2, 0.09, 40), M.chrome, head, [EX, 1.74, 0.2]);
  add(cyl(0.05, 0.05, 0.02, 16), M.chrome, head, [EX, 1.795, 0.2]);
  const exh = add(cyl(0.04, 0.04, 1.2, 16), M.rust, head, [EX, 1.36, 0.27], [0, 0, PI / 2]);
  for (let i = 1; i <= 6; i++) add(cyl(0.032, 0.032, 0.1, 12), M.rust, head, [cylX(i), 1.38, 0.23], [PI / 2, 0, 0]);
  const dist = V(1.58, 1.56, -0.3);
  add(cyl(0.05, 0.05, 0.16, 16), M.black, head, [dist.x, dist.y, dist.z]);
  const wireMat = std(0x0c0c0c, 0, 0.6);
  for (let i = 1; i <= 6; i++) {
    const p = V(cylX(i), 1.44, -0.25);
    add(cyl(0.013, 0.013, 0.07, 10), M.ceramic, head, [p.x, p.y, p.z], [PI / 2, 0, 0]);
    const curve = new THREE.CatmullRomCurve3([V(p.x, p.y, p.z - 0.04), V(p.x, 1.62, -0.33), V(dist.x + 0.02 * (i - 3.5), dist.y + 0.09, dist.z)]);
    add(new THREE.TubeGeometry(curve, 16, 0.007, 6), wireMat, head);
  }

  /* radiador de alumínio */
  ASM = 'arrefecimento';
  const RX = 3.06, alu = std(0xd3d8dc, 0.92, 0.28);
  const coreTex = finsTex(); coreTex.repeat.set(4, 2);
  const coreMat = std(0xffffff, 0.85, 0.4, { map: coreTex });
  const radMat = [alu, coreMat];
  add(box(0.07, 0.56, 0.98), coreMat, scene, [RX, 1.25, 0]);                               // colmeia
  add(rbox(0.1, 0.09, 1.02, 0.015), alu, scene, [RX, 1.575, 0]);                           // tanque superior
  add(rbox(0.1, 0.09, 1.02, 0.015), alu, scene, [RX, 0.925, 0]);                           // tanque inferior
  for (const z of [-0.515, 0.515]) add(box(0.09, 0.74, 0.025), alu, scene, [RX, 1.25, z]); // laterais
  add(cyl(0.035, 0.035, 0.03, 20), M.chrome, scene, [RX, 1.635, -0.3]);                    // tampa
  const hose = (pts, r = 0.028) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), 24, r, 10), M.rubber);
  add(cyl(0.035, 0.035, 0.06, 16), alu, scene, [RX - 0.07, 1.55, 0.15], [0, 0, PI / 2]);   // bico superior
  add(cyl(0.035, 0.035, 0.06, 16), alu, scene, [RX - 0.07, 0.95, -0.4], [0, 0, PI / 2]);   // bico inferior
  add(cyl(0.04, 0.045, 0.08, 16), M.iron, scene, [2.725, 1.34, 0.15], [0, 0, PI / 2]);      // carcaça da válvula termostática
  hose([[2.76, 1.34, 0.15], [2.79, 1.5, 0.15], [2.86, 1.6, 0.15], [RX - 0.1, 1.56, 0.15]]);   // por cima do ventilador                  // mangueira superior
  add(cyl(0.035, 0.035, 0.06, 16), M.iron, scene, [2.715, 0.98, -0.12], [0, 0, PI / 2]);    // bomba d'água
  hose([[2.745, 0.98, -0.12], [2.76, 0.86, -0.3], [2.93, 0.9, -0.41], [RX - 0.1, 0.95, -0.4]]);   // por fora do giro da hélice                // mangueira inferior

  /* bateria */
  ASM = 'eletrica';
  const BX = 2.82, BZ = 0.86, BY = 1.1;
  add(rbox(0.48, 0.03, 0.34, 0.008), M.black, scene, [BX, BY - 0.015, BZ]);                // bandeja
  add(box(0.04, 0.1, 0.04), M.black, scene, [BX - 0.18, BY - 0.07, 0.68]);                 // suportes no chassi
  add(box(0.04, 0.1, 0.04), M.black, scene, [BX + 0.18, BY - 0.07, 0.68]);
  add(rbox(0.43, 0.33, 0.29, 0.015), std(0x1b1b1b, 0.05, 0.55), scene, [BX, BY + 0.165, BZ]);  // caixa
  add(rbox(0.44, 0.03, 0.3, 0.01), std(0x3a3d40, 0.05, 0.5), scene, [BX, BY + 0.34, BZ]);      // tampa
  add(box(0.03, 0.012, 0.32), M.black, scene, [BX, BY + 0.361, BZ]);                         // barra de fixação
  const TP = V(BX - 0.15, BY + 0.38, BZ - 0.08), TN = V(BX + 0.15, BY + 0.38, BZ - 0.08);
  add(cyl(0.022, 0.025, 0.045, 16), M.steel, scene, [TP.x, TP.y, TP.z]); add(new THREE.TorusGeometry(0.03, 0.008, 8, 20), M.red, scene, [TP.x, TP.y - 0.015, TP.z], [PI / 2, 0, 0]);
  add(cyl(0.022, 0.025, 0.045, 16), M.steel, scene, [TN.x, TN.y, TN.z]); add(new THREE.TorusGeometry(0.03, 0.008, 8, 20), M.black, scene, [TN.x, TN.y - 0.015, TN.z], [PI / 2, 0, 0]);
  const starter = add(cyl(0.065, 0.065, 0.24, 20), M.black, scene, [1.43, 0.8, 0.32], [0, 0, PI / 2]);   // motor de partida
  add(cyl(0.035, 0.035, 0.16, 14), M.steel, scene, [1.45, 0.89, 0.32], [0, 0, PI / 2]);                  // automático
  const redCable = std(0xb3121a, 0.1, 0.5), blkCable = std(0x101010, 0.1, 0.5);
  const wire = (pts, mat) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), 48, 0.014, 8), mat);
  wire([[TP.x, TP.y + 0.01, TP.z], [TP.x - 0.08, TP.y + 0.06, TP.z - 0.06], [2.45, 1.12, 0.52], [1.7, 1.0, 0.44], [1.47, 0.92, 0.36]], redCable);  // + ao motor de partida
  wire([[TN.x, TN.y + 0.01, TN.z], [TN.x + 0.04, TN.y + 0.03, TN.z - 0.12], [3.0, 1.2, 0.66], [2.95, 1.07, 0.62]], blkCable);                 // − ao chassi

  /* caixa de marcha (ilustrativa) */
  ASM = 'caixa';
  const GY = 0.85, GCY = 0.66;
  const gb = new THREE.Group(); scene.add(gb);
  const shellG = shell(std(0x6f7378, 0.6, 0.45));
  add(rbox(0.64, 0.46, 0.34, 0.03), shellG, gb, [0.665, 0.76, 0]);
  add(cyl(0.2, 0.3, 0.3, 40), shellG, gb, [1.13, GY, 0], [0, 0, PI / 2]);
  add(cyl(0.065, 0.1, 0.26, 24), shellG, gb, [0.22, GY, 0], [0, 0, PI / 2]);
  const gearBase = std(0xbfc3c8, 0.85, 0.32, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  const mkGear = (parent, x, r, mat) => add(gearGeo(r, Math.round(r * 230), 0.045, 0.016, 0.02).rotateY(PI / 2), mat, parent, [x, 0, 0]);
  const shaftAt = (y) => { const g = new THREE.Group(); g.position.set(0, y, 0); gb.add(g); return g; };
  const inputS = shaftAt(GY), outputS = shaftAt(GY), counterS = shaftAt(GCY);
  add(cyl(0.022, 0.022, 0.44, 12), M.steel, inputS, [1.08, 0, 0], [0, 0, PI / 2]);
  add(cyl(0.022, 0.022, 0.8, 12), M.steel, outputS, [0.47, 0, 0], [0, 0, PI / 2]);
  add(cyl(0.022, 0.022, 0.56, 12), M.steel, counterS, [0.68, 0, 0], [0, 0, PI / 2]);
  // pares: [x, raio principal, raio intermediário]; distância entre eixos 0,19
  const PAIRS = { in: [0.9, 0.07, 0.12], 2: [0.72, 0.095, 0.095], 1: [0.54, 0.12, 0.07], R: [0.4, 0.1, 0.05] };
  const gearMats = {}, mainGears = {};
  for (const k of Object.keys(PAIRS)) {
    const [x, rm, rc] = PAIRS[k]; const mm = gearBase.clone(), mc = gearBase.clone(); gearMats[k] = [mm, mc];
    if (k === 'in') mkGear(inputS, x, rm, mm);
    else { const g = shaftAt(GY); mkGear(g, x, rm, mm); mainGears[k] = g; }
    mkGear(counterS, x, rc, mc);
  }
  const collarMat = gearBase.clone();
  const collarA = add(cyl(0.05, 0.05, 0.04, 24), collarMat, outputS, [0.47, 0, 0], [0, 0, PI / 2]);
  const collarB = add(cyl(0.05, 0.05, 0.04, 24), collarMat, outputS, [0.81, 0, 0], [0, 0, PI / 2]);
  // engrenagem intermediária da ré
  const idler = new THREE.Group(); idler.position.set(0, GCY + 0.06, 0.13); gb.add(idler);
  add(gearGeo(0.04, 9, 0.045, 0.016, 0.015).rotateY(PI / 2), gearBase.clone(), idler, [0.4, 0, 0]);
  const kIn = PAIRS.in[1] / PAIRS.in[2];
  const RATIO = { 1: kIn * PAIRS[1][2] / PAIRS[1][1], 2: kIn * PAIRS[2][2] / PAIRS[2][1], 3: 1 };
  ASM = 'alavancas';
  const lever = new THREE.Group(); lever.position.set(0.62, 0.99, 0); scene.add(lever);
  add(cyl(0.014, 0.016, 0.95, 12), M.chrome, lever, [0, 0.475, 0]);
  add(new THREE.SphereGeometry(0.048, 24, 16), M.black, lever, [0, 0.96, 0]);
  add(cyl(0.07, 0.05, 0.08, 20), M.black, lever, [0, 0.04, 0]);
  // padrão da bola: R e 2 para a frente, 1 e 3 para trás; R/1 à esquerda, 2/3 à direita
  const H = { 0: [0, 0], R: [1, -1], 1: [-1, -1], 2: [1, 1], 3: [-1, 1] };

  /* cardã */
  ASM = 'carda';
  const DS = V(0.06, GY, 0), DE = V(-2.12, 0.6, 0), dsDir = DE.clone().sub(DS), dsLen = dsDir.length(); dsDir.normalize();
  const dsG = new THREE.Group(); dsG.position.copy(DS); dsG.quaternion.setFromUnitVectors(V(1, 0, 0), dsDir); scene.add(dsG);
  const dsSpin = new THREE.Group(); dsG.add(dsSpin);
  add(cyl(0.045, 0.045, dsLen - 0.12, 24), M.black, dsSpin, [dsLen / 2, 0, 0], [0, 0, PI / 2]);
  for (const x of [0.04, dsLen - 0.04]) { add(box(0.05, 0.1, 0.022), M.steel, dsSpin, [x, 0, 0]); add(box(0.05, 0.022, 0.1), M.steel, dsSpin, [x, 0, 0]); }

  /* eixo traseiro e diferencial */
  ASM = 'eixo';
  const C = V(-2.5, R, 0);
  const shellD = shell(M.black);
  const housing = add(new THREE.SphereGeometry(0.3, 40, 24), shellD, scene, [C.x, C.y, 0]); housing.scale.set(1, 0.95, 0.78);
  add(cyl(0.26, 0.26, 0.05, 40), shellD, scene, [C.x - 0.27, C.y, 0], [0, 0, PI / 2]);
  add(cyl(0.1, 0.14, 0.28, 28), shellD, scene, [C.x + 0.36, C.y, 0], [0, 0, -PI / 2]);
  for (const s of [-1, 1]) {
    add(cyl(0.075, 0.075, 0.72, 24), shellD, scene, [C.x, C.y, s * 0.58], [PI / 2, 0, 0]);
    // feixe de molas
    [1.5, 1.2, 0.9].forEach((l, i) => add(rbox(l, 0.026, 0.07, 0.008), M.black, scene, [C.x, C.y + 0.1 + i * 0.026, s * RAIL_Z]));
    for (const dx of [-0.75, 0.75]) add(box(0.04, 0.2, 0.05), M.black, scene, [C.x + dx, 0.82, s * RAIL_Z]);
  }
  const ringZ = -0.075;
  const pinion = new THREE.Group(); pinion.position.set(C.x + 0.15, C.y, ringZ + 0.058); scene.add(pinion);
  const pinMat = gearBase.clone();
  add(bevelGeo(0.045, 0.065, 0.07, 11).rotateZ(PI / 2), pinMat, pinion);
  add(cyl(0.022, 0.022, 0.3, 12), M.steel, pinion, [0.18, 0, 0], [0, 0, PI / 2]);
  const carrier = new THREE.Group(); carrier.position.copy(C); scene.add(carrier);
  const ringMat = std(0xc9a24a, 0.9, 0.3, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  add(gearGeo(0.2, 41, 0.035, 0.02, 0.12), ringMat, carrier, [0, 0, ringZ]);
  add(new THREE.TorusGeometry(0.1, 0.015, 10, 40), M.steel, carrier);
  add(cyl(0.014, 0.014, 0.2, 10), M.steel, carrier);
  const spiderMat = std(0xbfc3c8, 0.85, 0.32, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  const spiders = [1, -1].map(s => {
    const flip = new THREE.Group(); flip.rotation.x = s > 0 ? 0 : PI; carrier.add(flip);
    const spin = new THREE.Group(); flip.add(spin);
    add(bevelGeo(0.048, 0.03, 0.035, 10), spiderMat, spin, [0, 0.07, 0]);
    return spin;
  });
  const drumMat = shell(M.iron);
  // lado da lama: +z (perto da câmera); lado firme: -z
  const halves = [1, -1].map(s => {
    const g = new THREE.Group(); g.position.copy(C); scene.add(g);
    add(bevelGeo(0.032, 0.056, 0.035, 14).rotateX(-s * PI / 2), M.steel, g, [0, 0, s * 0.078]);
    add(cyl(0.028, 0.028, 1.15, 12), M.steel, g, [0, 0, s * 0.67], [PI / 2, 0, 0]);
    { const p = ASM; ASM = 'freio';
    add(cyl(0.3, 0.3, 0.12, 36, true), drumMat, g, [0, 0, s * (TRACK - 0.245)], [PI / 2, 0, 0]);
    add(cyl(0.3, 0.3, 0.012, 36), drumMat, g, [0, 0, s * (TRACK - 0.18)], [PI / 2, 0, 0]); ASM = p; }
    const w = wheel(s); w.position.z = s * TRACK; g.add(w);
    return g;
  });
  const [mudHalf, gripHalf] = halves;
  // sapatas (paradas) dentro de cada tambor
  const arcGeo = (r1, r2, a0, a1, d) => { const sh = new THREE.Shape(); sh.absarc(0, 0, r2, a0, a1, false); sh.absarc(0, 0, r1, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 20 }); g.translate(0, 0, -d / 2); return g; };
  const liningMat = std(0x6b5a48, 0.05, 0.85), shoes = [];
  for (const s of [-1, 1]) {
    ASM = 'freio';
    const z = s * (TRACK - 0.25);
    add(cyl(0.29, 0.29, 0.012, 36), M.black, scene, [C.x, R, s * (TRACK - 0.315)], [PI / 2, 0, 0]);
    for (const up of [1, -1]) {
      const g = new THREE.Group(); g.position.set(C.x, R, z); scene.add(g);
      const a0 = up > 0 ? 0.35 : PI + 0.35, a1 = up > 0 ? PI - 0.35 : TAU - 0.35;
      add(arcGeo(0.25, 0.275, a0, a1, 0.07), liningMat, g); add(arcGeo(0.215, 0.25, a0, a1, 0.08), M.steel, g);
      shoes.push({ g, up });
    }
    add(cyl(0.025, 0.025, 0.14, 12), M.red, scene, [C.x + 0.24, R, z], [0, 0, PI / 2]);
  }
  // freio de mão: alavanca no assoalho, à esquerda do câmbio; cabo até os tambores
  ASM = 'alavancas';
  const floorLever = (x, z, len, grip) => {
    const base = add(rbox(0.12, 0.05, 0.08, 0.01), M.black, scene, [x, 1.11, z]);
    const g = new THREE.Group(); g.position.set(x + 0.04, 1.14, z); scene.add(g);
    add(rbox(len, 0.03, 0.03, 0.008), M.black, g, [-len / 2, 0, 0]);
    add(cyl(0.022, 0.022, 0.12, 14), grip, g, [-len + 0.03, 0, 0], [0, 0, PI / 2]);
    return g;
  };
  const hand = floorLever(0.5, -0.16, 0.42, M.black);
  // trava do diferencial: alavanca menor, à direita do câmbio
  const lockLever = floorLever(0.58, 0.16, 0.26, M.red);
  ASM = 'cabos';
  const cableMat = std(0x222222, 0.6, 0.4, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  const cable = pts => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), 48, 0.01, 6), cableMat);
  cable([[0.5, 1.1, -0.16], [0.47, 1.08, -0.3], [0.42, 0.95, -0.38], [0.1, 0.84, -0.4], [-0.8, 0.84, -0.4], [-1.4, 0.8, -0.3]]);
  const lockCableMat = std(0x222222, 0.6, 0.4, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0.58, 1.1, 0.16], [0.55, 1.08, 0.3], [0.5, 0.95, 0.38], [0.1, 0.84, 0.4], [-1.6, 0.84, 0.4], [-2.25, 0.88, 0.3], [C.x + 0.05, C.y + 0.27, 0.12]].map(p => V(...p))), 64, 0.009, 6), lockCableMat);
  cable([[-1.4, 0.8, -0.3], [-2.0, 0.66, -0.75], [C.x + 0.12, 0.62, -1.0]]);
  cable([[-1.4, 0.8, -0.3], [-1.85, 0.9, 0], [-2.15, 0.82, 0.55], [C.x + 0.12, 0.62, 1.0]]);   // passa por cima do cardã
  add(rbox(0.08, 0.05, 0.1, 0.01), M.steel, scene, [-1.4, 0.8, -0.3]);
  const lockMat = std(0xbfc3c8, 0.85, 0.3, { emissive: 0xff2a1a, emissiveIntensity: 0 });
  const lockCollar = add(gearGeo(0.062, 12, 0.05, 0.018, 0.03), lockMat, mudHalf, [0, 0, 0.27]);
  add(gearGeo(0.062, 12, 0.02, 0.018, 0.03), lockMat, carrier, [0, 0, 0.145]);

  /* lama */
  ASM = 'lama';
  const mudMat = std(0x3d2716, 0, 0.25, { transparent: true, opacity: 0, depthWrite: false });
  const mud = add(new THREE.CircleGeometry(1, 40), mudMat, scene, [C.x, 0.006, TRACK], [-PI / 2, 0, 0]); mud.scale.set(1.6, 0.8, 1); mud.castShadow = false;
  const MUDN = 90;
  const mudBits = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 6, 5), std(0x4a301b, 0, 0.4), MUDN);
  mudBits.frustumCulled = false; scene.add(mudBits);
  const bits = Array.from({ length: MUDN }, () => ({ p: V(0, -9, 0), v: V(), life: 0 }));
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = V(1, 1, 1);

  /* silhueta da C10 (linhas) */
  ASM = 'carroceria';
  const body = new THREE.Group(); scene.add(body);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.6, depthWrite: false });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xc4161c, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const W = 1.45;
  function ghost(geo, pos) {
    const m = new THREE.Mesh(geo, fillMat); m.position.set(...pos); body.add(m);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), lineMat); l.position.set(...pos); body.add(l);
  }
  const prof = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; };
  const ext = (pts, d) => { const g = new THREE.ExtrudeGeometry(prof(pts), { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g; };
  ghost(ext([[-0.6, 1.08], [1.42, 1.08], [1.42, 1.92], [0.95, 2.98], [-0.45, 3.02], [-0.6, 1.92]], 2.0), [0, 0, 0]);
  ghost(ext([[1.42, 1.08], [3.58, 1.08], [3.6, 1.78], [1.42, 1.92]], W * 2), [0, 0, 0]);
  ghost(box(3.9, 0.82, W * 2), [-2.65, 1.49, 0]);
  ghost(box(0.12, 0.16, W * 2 + 0.1), [3.66, 1.0, 0]);
  ghost(box(0.12, 0.16, W * 2 + 0.1), [-4.66, 1.0, 0]);
  const loop = (cx, cy, z, r, a0, a1, rotY = 0) => {
    const pts = []; for (let i = 0; i <= 40; i++) { const a = a0 + (a1 - a0) * i / 40; pts.push(V(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat); l.position.set(cx, cy, z); l.rotation.y = rotY; body.add(l);
  };
  for (const s of [-1, 1]) {
    loop(FX, R, s * W, 0.76, 0, PI); loop(C.x, R, s * W, 0.76, 0, PI);
    loop(3.61, 1.45, s * 0.85, 0.15, 0, TAU, PI / 2);                     // faróis redondos
  }

  /* caminho da força */
  const pathMain = new THREE.CatmullRomCurve3([V(EX, 1.2, 0), V(1.3, CY, 0), V(0.65, GY, 0), V(0.1, GY, 0), V(-1.0, 0.72, 0), V(C.x, C.y, 0)]);
  const pathL = new THREE.LineCurve3(V(C.x, C.y, 0), V(C.x, C.y, TRACK)), pathR = new THREE.LineCurve3(V(C.x, C.y, 0), V(C.x, C.y, -TRACK));
  const sprMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xff5a3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
  const pulses = [];
  const addPulses = (curve, n, scale) => { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(sprMat); s.scale.setScalar(scale); s.renderOrder = 10; scene.add(s); pulses.push({ s, curve, off: i / n }); } };
  addPulses(pathMain, 22, 0.32); addPulses(pathL, 5, 0.26); addPulses(pathR, 5, 0.26);

  /* rótulos */
  const L = [];
  const label = (text, step, pos) => { const el = document.createElement('span'); el.className = 'mlab'; el.textContent = text; labelsBox.appendChild(el); L.push({ el, step, pos }); return L[L.length - 1]; };
  label('Motor', 1, V(EX, 2.0, 0)); label('Radiador', 0, V(RX, 1.75, 0)); label('Bateria', 0, V(BX, 1.6, BZ)); label('Embreagem', 1, V(1.28, 1.25, 0.3)); label('Caixa', 1, V(0.65, 1.15, 0.2));
  label('Cardã', 1, V(-1.0, 0.95, 0)); label('Diferencial', 1, V(C.x, 1.05, 0)); label('Rodas', 1, V(C.x, 1.4, TRACK));
  label('Cabeçote', 2, V(EX - 0.2, 2.15, 0)); label('Cilindro 1', 2, V(cylX(1), 1.5, -0.3)); label('Virabrequim', 2, V(1.55, 0.72, -0.35)); label('Hélice 6 pás', 2, V(2.86, 0.86, -0.12)); label('Radiador de alumínio', 2, V(RX, 1.66, -0.42)); label('Bateria', 2, V(BX, 1.55, BZ));
  const engagedLab = label('Engatada', 3, V()); label('Alavanca', 3, V(0.62, 2.02, 0)); label('Ré', 3, V(0.36, 1.08, 0.2)); label('Freio de mão', 3, V(0.3, 1.3, -0.2)); label('Trava do diferencial', 3, V(0.4, 1.3, 0.3)); label('Eixo intermediário', 3, V(0.62, 0.55, 0.2));
  label('Coroa', 4, V(C.x, C.y + 0.3, -0.12)); const lockLab = label('Trava solta', 4, V(C.x + 0.08, C.y - 0.17, 0.3)); label('Satélites', 4, V(C.x - 0.05, C.y + 0.16, 0.15));
  label('Roda na lama', 4, V(C.x, 1.4, TRACK)); label('Chão firme', 4, V(C.x, 1.4, -TRACK));
  label('Disco e pinça', 5, V(FX - 0.1, R + 0.5, -1.05)); label('Tambor e sapatas', 5, V(C.x, R + 0.5, -1.05));
  label('Freio de mão', 5, V(0.3, 1.32, -0.16)); label('Cabo', 5, V(-0.6, 1.0, -0.68));

  /* roteiro: câmera e camadas por etapa */
  const CAM = [
    [[7.6, 4.6, 8.6], [-0.4, 1.1, 0]],
    [[3.0, 8.4, 8.2], [-0.8, 0.7, 0]],
    [[4.9, 2.4, -2.5], [2.25, 1.25, 0.05]],
    [[1.75, 1.95, 2.35], [0.6, 0.98, 0]],
    [[-5.1, 2.7, 2.5], [-2.5, 0.5, 0.35]],
    [[-5.8, 3.1, -4.9], [-0.2, 0.72, -0.9]],
    [[-7.8, 3.8, 7.6], [-0.3, 1.15, 0]],
  ].map(([p, t]) => [V(...p), V(...t)]);
  // no celular, os freios são vistos ao longo da lateral (tambor perto, disco ao fundo)
  const CAMN = CAM.map((c, i) => i === 5 ? [V(-7.4, 2.9, -2.7), V(0.6, 0.75, -1.05)] : c);
  const LAYER = {
    body: [1, 0.35, 0.05, 0.05, 0.08, 0.12, 1],
    eng: [0, 0, 1, 0, 0, 0, 0],
    gb: [0, 0, 0, 1, 0, 0, 0],
    diff: [0, 0, 0, 0, 1, 0, 0],
    path: [0, 1, 0, 0, 0, 0, 0],
    brk: [0, 0, 0, 0, 0, 1, 0],
  };

  /* HUD */
  const hud = k => stage.querySelector(`[data-hud="${k}"]`);
  const hudFire = hud('fire'), hudGear = hud('gear'), hudDiff = hud('diff');
  const fireDots = [...hudFire.querySelectorAll('li')];
  const knob = hudGear.querySelector('.knob'), gearName = hudGear.querySelector('b');
  const barMud = hudDiff.querySelector('[data-bar="mud"]'), barGrip = hudDiff.querySelector('[data-bar="grip"]');
  const valMud = hudDiff.querySelector('[data-val="mud"]'), valGrip = hudDiff.querySelector('[data-val="grip"]'), diffState = hudDiff.querySelector('[data-val="state"]');
  const rail = [...sec.querySelectorAll('.mech-rail button')];
  rail.forEach((b, i) => b.addEventListener('click', () => {
    const top = sec.getBoundingClientRect().top + scrollY + i * stage.clientHeight;
    scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* aberto x blocante */
  let lock = 0, lockTarget = 0, mudDist = 0, groundDist = 0;
  const btns = [...sec.querySelectorAll('[data-diff]')], status = sec.querySelector('.mstatus');
  const MSG = [
    'Aberto: a roda na lama gira em dobro e a do chão firme fica parada. A C10 não sai.',
    'Blocado: as duas rodas giram juntas, a do chão firme puxa e a C10 sai da lama.',
  ];
  const toggle = stage.querySelector('.mlock'), toggleTxt = toggle.querySelector('span');
  function setLock(v) {
    lockTarget = v; if (!v) mudDist = 0;
    btns.forEach(x => { x.setAttribute('aria-pressed', String(+x.dataset.diff === v)); x.classList.remove('nudge'); });
    toggle.setAttribute('aria-pressed', String(!!v)); toggle.classList.remove('nudge');
    toggleTxt.textContent = v ? 'Diferencial blocado' : 'Blocar diferencial';
    if (status) status.textContent = MSG[v];
  }
  btns.forEach(b => b.addEventListener('click', () => setLock(+b.dataset.diff)));
  toggle.addEventListener('click', () => setLock(lockTarget ? 0 : 1));

  /* freios: pedal e freio de mão */
  const VCRUISE = 1.6; let pedal = 0, handOn = 0, vel = VCRUISE, fp = 0, rp = 0, hp2 = 0, heat = 0;
  const bBtns = [...sec.querySelectorAll('[data-brake]')], bStatus = sec.querySelector('[data-bstatus]');
  const BMSG = {
    '00': 'Rodando. Toque em Frear ou puxe o freio de mão.',
    '10': 'Pedal: as pastilhas apertam o disco na frente e as sapatas abrem nos tambores atrás.',
    '01': 'Freio de mão: o cabo abre só as sapatas de trás. Serve para segurar a C10 parada.',
    '11': 'Pedal e freio de mão juntos: a C10 para e fica segura.',
  };
  bBtns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.brake === 'pedal') pedal = pedal ? 0 : 1; else handOn = handOn ? 0 : 1;
    bBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.brake === 'pedal' ? !!pedal : !!handOn)));
    if (bStatus) bStatus.textContent = BMSG['' + pedal + handOn];
  }));

  /* tamanho e enquadramento */
  let VW = 1, VH = 1, narrow = false;
  // o 3D ocupa só a sua janela; o painel de texto fica fora dela
  const view = stage.querySelector('.mech-view');
  function layout() {
    VW = Math.max(1, view.clientWidth); VH = Math.max(1, view.clientHeight); narrow = stage.clientWidth < 900;
    renderer.setSize(VW, VH, false);
    camera.clearViewOffset(); camera.aspect = VW / VH; camera.updateProjectionMatrix();
  }
  new ResizeObserver(layout).observe(view); layout();
  const cards = [...sec.querySelectorAll('.mcard')], count = sec.querySelector('.mech-count');
  let shown = -1;

  /* estado de animação */
  const ang = { crank: 0, counter: 0, out: 0, carrier: 0, mud: 0, grip: 0, front: 0, spider: 0, m1: 0, m2: 0, mR: 0, idl: 0 };
  let ts = 0, prevTs = 0, time = 0, last = performance.now(), visible = false, raf = 0, nudgeT = 0;
  let lev = [0, 0], knobXY = [60, 45];
  const progress = () => clamp(-sec.getBoundingClientRect().top / Math.max(1, stage.clientHeight), 0, N - 1);
  ts = prevTs = progress();
  const cp = V(), ct = V(), tmp = V();

  function frame(now) {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const dt = clamp((now - last) / 1000, 0, 0.05); last = Math.max(last, now); time += dt;
    const t = progress(); ts += (t - ts) * Math.min(1, dt * 7);
    const k = clamp(Math.floor(ts), 0, N - 2), f = smooth(clamp((ts - k - 0.3) / 0.4, 0, 1));
    const Wt = Array.from({ length: N }, (_, i) => i === k ? 1 - f : i === k + 1 ? f : 0);
    const lay = a => a[k] * (1 - f) + a[k + 1] * f;
    const brk = lay(LAYER.brk), engOpen = lay(LAYER.eng), gbOpen = lay(LAYER.gb), diffW = lay(LAYER.diff), pathW = lay(LAYER.path), bodyW = lay(LAYER.body);

    // marcha: direta antes da caixa, 1ª a 4ª ao rolar pela caixa, 1ª no diferencial
    const gear = ts < 2.55 ? 3 : ts < 3.45 ? clamp(Math.floor((ts - 2.55) / 0.3) + 1, 1, 3) : 1;

    // giro do motor: rolagem + marcha lenta (+ força extra na cena da lama)
    const dTheta = (ts - prevTs) * 6 * PI + ((reduce ? 0 : 2.2) + Wt[4] * 14) * dt; prevTs = ts;
    const ratio = RATIO[gear];
    ang.crank += dTheta; ang.counter -= dTheta * kIn; ang.out += dTheta * ratio;
    for (const g of [1, 2]) ang['m' + g] += dTheta * kIn * PAIRS[g][2] / PAIRS[g][1];
    ang.idl += dTheta * kIn * PAIRS.R[2] / 0.04; ang.mR -= dTheta * kIn * PAIRS.R[2] / PAIRS.R[1];
    const dC = dTheta * ratio / 2.5;
    lock += (lockTarget - lock) * Math.min(1, dt * 3);
    const lk = 1 - diffW * (1 - lock);                       // fora da cena da lama, as duas rodas iguais
    const vT = (pedal || handOn) ? 0 : VCRUISE, rate = vel > vT ? (pedal ? 2.4 : 1.1) : 0.9;
    vel = vel > vT ? Math.max(vT, vel - rate * dt) : Math.min(vT, vel + rate * dt);
    fp += (pedal - fp) * Math.min(1, dt * 10); rp += ((pedal || handOn ? 1 : 0) - rp) * Math.min(1, dt * 10); hp2 += (handOn - hp2) * Math.min(1, dt * 8);
    heat = clamp(heat + (pedal ? vel * 0.55 : 0) * dt - heat * 0.5 * dt, 0, 1);
    const roll = brk * vel * dt / R, drv = 1 - brk;
    ang.carrier += dC * drv; ang.mud += dC * (2 - lk) * drv + roll; ang.grip += dC * lk * drv + roll; ang.spider += dC * (1 - lk) * (0.056 / 0.048) * drv;
    groundDist += brk * vel * dt; ang.front += roll;
    const travel = diffW * dC * lk * R;
    mudDist += travel; groundDist += travel; ang.front += travel / R;

    // motor
    crank.rotation.x = ang.crank; fan.rotation.x = ang.crank * 1.1;
    const thDeg = ((ang.crank / DEG) % 720 + 720) % 720;
    for (let i = 1; i <= 6; i++) {
      const a = ang.crank + PHASE[i] * DEG, sy = CR * Math.sin(a), cy = CR * Math.cos(a);
      const pinY = CY + Math.sqrt(CL * CL - sy * sy) + cy;
      pistons[i - 1].position.y = pinY + 0.03;
      const rod = rods[i - 1]; rod.position.y = (CY + cy + pinY) / 2; rod.position.z = sy / 2; rod.rotation.x = Math.atan2(-sy, pinY - CY - cy);
      const d = ((thDeg - FIRE[i]) % 720 + 720) % 720, fl = d < 70 ? 1 - d / 70 : 0;
      glows[i - 1].material.opacity = fl * engOpen; glows[i - 1].position.y = 1.37 + engOpen * 0.02;
      fireDots[[1, 5, 3, 6, 2, 4].indexOf(i)].classList.toggle('on', fl > 0.25);
    }
    head.position.y = engOpen * 0.55;
    for (const m of radMat) setOpacity(m, 1 - 0.65 * engOpen);
    setOpacity(shellE, 1 - 0.9 * engOpen); linerMat.opacity = engOpen * 0.28;

    // caixa
    inputS.rotation.x = ang.crank; counterS.rotation.x = ang.counter; outputS.rotation.x = ang.out;
    for (const g of [1, 2]) mainGears[g].rotation.x = gear === g ? ang.out : ang['m' + g];
    mainGears.R.rotation.x = ang.mR; idler.rotation.x = ang.idl;
    setOpacity(shellG, 1 - 0.88 * gbOpen);
    for (const key of Object.keys(gearMats)) {
      const on = (key == gear) || (gear === 3 && key === 'in');
      gearMats[key].forEach(m => { m.emissiveIntensity += ((on ? 0.9 * gbOpen : 0) - m.emissiveIntensity) * Math.min(1, dt * 8); });
    }
    collarMat.emissiveIntensity = gear === 3 ? 0.9 * gbOpen : 0;
    collarA.position.x = 0.47 + (gear === 1 ? 0.03 : 0);
    collarB.position.x = 0.81 + (gear === 2 ? -0.03 : gear === 3 ? 0.03 : 0);
    const hp = H[gear]; lev[0] += (hp[0] - lev[0]) * Math.min(1, dt * 10); lev[1] += (hp[1] - lev[1]) * Math.min(1, dt * 10);
    lever.rotation.set(lev[1] * 0.16, 0, -lev[0] * 0.18);
    const kx = { 0: 60, R: 30, 1: 30, 2: 90, 3: 90 }[gear], ky = { 0: 45, R: 15, 1: 75, 2: 15, 3: 75 }[gear];
    knobXY[0] += (kx - knobXY[0]) * Math.min(1, dt * 10); knobXY[1] += (ky - knobXY[1]) * Math.min(1, dt * 10);
    knob.setAttribute('cx', knobXY[0].toFixed(1)); knob.setAttribute('cy', knobXY[1].toFixed(1));
    gearName.textContent = gear + 'ª';
    engagedLab.pos.set(gear === 3 ? 0.85 : PAIRS[gear][0], GY + (gear === 3 ? 0.1 : PAIRS[gear][1]) + 0.06, 0.12);
    engagedLab.el.textContent = gear + 'ª engatada';

    // cardã e diferencial
    dsSpin.rotation.x = ang.out; pinion.rotation.x = ang.out;
    carrier.rotation.z = -ang.carrier; mudHalf.rotation.z = -ang.mud; gripHalf.rotation.z = -ang.grip;
    spiders[0].rotation.y = ang.spider; spiders[1].rotation.y = ang.spider;
    front.forEach(w => { w.rotation.z = -ang.front; });
    setOpacity(shellD, 1 - 0.88 * diffW);
    ringMat.emissiveIntensity = 0.25 * diffW; spiderMat.emissiveIntensity = 0.9 * diffW * (1 - lock);
    groundTex.offset.x = groundDist / 3;
    mudMat.opacity = diffW * clamp(1 - mudDist / 6, 0, 1); mud.position.x = C.x - mudDist;
    // respingos: só quando a roda patina dentro da lama
    const slip = Math.max(0, dC * (2 - lk) - travel / R) / Math.max(dt, 1e-3);
    const onMud = mudDist < 1.2 ? 1 : 0;
    let spawn = reduce ? 0 : slip * diffW * onMud * 9 * dt;
    for (let i = 0; i < MUDN; i++) {
      const b = bits[i];
      if (b.life <= 0 && spawn > Math.random()) {
        spawn -= 1; b.life = 0.9 + Math.random() * 0.5;
        b.p.set(C.x - 0.42 - Math.random() * 0.1, 0.12 + Math.random() * 0.1, TRACK + (Math.random() - 0.5) * 0.3);
        b.v.set(-1.4 - Math.random() * 1.6, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8);
      }
      if (b.life > 0) { b.life -= dt; b.v.y -= 7 * dt; b.p.addScaledVector(b.v, dt); if (b.p.y < 0.012) { b.p.y = 0.012; b.v.set(0, 0, 0); b.life = Math.min(b.life, 0.25); } }
      tmpS.setScalar(b.life > 0 ? Math.min(1, b.life * 3) : 0);
      tmpM.compose(b.p, tmpQ, tmpS); mudBits.setMatrixAt(i, tmpM);
    }
    mudBits.instanceMatrix.needsUpdate = true;

    // HUD do diferencial
    const mudX = 2 - lk, gripX = lk;
    barMud.style.width = (mudX / 2 * 100).toFixed(1) + '%'; barGrip.style.width = (gripX / 2 * 100).toFixed(1) + '%';
    valMud.textContent = mudX.toFixed(1).replace('.', ',') + '×'; valGrip.textContent = gripX.toFixed(1).replace('.', ',') + '×';
    diffState.textContent = lock > 0.5 ? 'A C10 anda' : 'A C10 está parada';
    if (Wt[4] > 0.8 && lockTarget === 0) { nudgeT += dt; if (nudgeT > 4) { toggle.classList.add('nudge'); btns[1] && btns[1].classList.add('nudge'); } } else nudgeT = 0;
    lockCollar.position.z = 0.27 - 0.1 * lock; lockLever.rotation.z = -(0.25 + 0.65 * lock); lockCableMat.emissiveIntensity = 0.9 * lock * Math.max(diffW, Wt[3]); lockMat.emissiveIntensity = 0.95 * lock * diffW;
    lockLab.el.textContent = lock > 0.5 ? 'Trava engatada' : 'Trava solta';

    // freios
    setOpacity(WR, 1 - 0.78 * brk); setOpacity(WB, 1 - 0.78 * brk); setOpacity(drumMat, 1 - 0.85 * brk);
    discMat.emissiveIntensity = heat * 1.6 * brk;
    for (const c of calipers) c.m.position.z = c.base - c.side * 0.014 * fp;
    for (const sh of shoes) sh.g.position.y = R + sh.up * 0.018 * rp;
    hand.rotation.z = -(0.25 + 0.65 * hp2); cableMat.emissiveIntensity = 0.9 * hp2 * brk;

    // silhueta e caminho da força
    lineMat.opacity = 0.62 * bodyW; fillMat.opacity = 0.05 * bodyW; body.visible = bodyW > 0.01;
    sprMat.opacity = pathW;
    for (const p of pulses) { const u = (((p.off + time * (reduce ? 0.06 : 0.22)) % 1) + 1) % 1; p.curve.getPoint(u, p.s.position); p.s.visible = pathW > 0.01; }

    // câmera
    const CK = narrow ? CAMN : CAM;
    cp.lerpVectors(CK[k][0], CK[k + 1][0], f); ct.lerpVectors(CK[k][1], CK[k + 1][1], f);
    const DM = narrow ? [1.6, 1.45, 1.12, 1.1, 1.3, 1.1, 1.6] : [1.2, 1.12, 1.0, 1.0, 1.05, 0.95, 1.2];
    const drift = (ts - Math.round(ts)) * 0.35, dist = DM[k] * (1 - f) + DM[k + 1] * f;
    tmp.subVectors(cp, ct).applyAxisAngle(V(0, 1, 0), drift).multiplyScalar(dist);
    camera.position.copy(ct).add(tmp); camera.lookAt(ct);
    camera.updateMatrixWorld();

    // HUD e rótulos
    const active = clamp(Math.round(ts), 0, N - 1);
    if (active !== shown) {
      shown = active;
      cards.forEach((c, i) => c.classList.toggle('on', i === active));
      rail.forEach((b, i) => b.setAttribute('aria-current', i === active ? 'step' : 'false'));
      if (count) count.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(N).padStart(2, '0');
    }
    for (const l of L) {
      const o = clamp((Wt[l.step] - 0.55) * 3, 0, 1);
      if (o <= 0) { if (l.el.style.opacity !== '0') l.el.style.opacity = '0'; continue; }
      tmp.copy(l.pos).project(camera);
      if (tmp.z > 1) { l.el.style.opacity = '0'; continue; }
      l.el.style.opacity = o.toFixed(2);
      l.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * VW).toFixed(1)}px,${((-tmp.y * 0.5 + 0.5) * VH).toFixed(1)}px) translate(-50%,calc(-100% - 19px))`;
    }

    renderer.render(scene, camera);
  }

  new IntersectionObserver(es => {
    visible = es.some(e => e.isIntersecting);
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }).observe(sec);
  if (/debug/.test(location.search)) window.__julaAudit = () => {
    scene.updateMatrixWorld(true);
    const items = []; scene.traverse(o => { if (o.isMesh && o.userData.asm && !['chao', 'carroceria', 'lama'].includes(o.userData.asm)) items.push({ o, b: new THREE.Box3().setFromObject(o, true) }); });
    const ok = new Set(['caixa|motor', 'caixa|carda', 'carda|eixo', 'eixo|freio', 'eixo|roda', 'freio|roda', 'roda|suspensao', 'freio|suspensao', 'chassi|suspensao', 'alavancas|caixa', 'cabos|freio', 'cabos|eixo', 'alavancas|cabos', 'chassi|eixo']);
    const inside = (A, B) => {   // quantos vértices de A caem dentro da caixa local de B
      const gb = B.o.geometry; if (gb.type === 'TubeGeometry') return 0; if (!gb.boundingBox) gb.computeBoundingBox();
      const bb = gb.boundingBox.clone().expandByScalar(-0.004), inv = B.o.matrixWorld.clone().invert(), pa = A.o.geometry.attributes.position, v = V();
      const step = Math.max(1, Math.floor(pa.count / 400)); let n = 0;
      for (let i = 0; i < pa.count; i += step) { v.fromBufferAttribute(pa, i).applyMatrix4(A.o.matrixWorld).applyMatrix4(inv); if (bb.containsPoint(v)) n++; }
      return n;
    };
    const hits = {};
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const A = items[i], B = items[j], a = A.o.userData.asm, b = B.o.userData.asm; if (a === b) continue;
      const key = [a, b].sort().join('|'); if (ok.has(key)) continue;
      const I = A.b.clone().intersect(B.b); if (I.isEmpty()) continue;
      const sz = I.getSize(V()); if (Math.min(sz.x, sz.y, sz.z) < 0.004) continue;
      const n = inside(A, B) + inside(B, A); if (!n) continue;
      const c = I.getCenter(V()); (hits[key] ||= []).push([+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), +sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3), a + ':' + A.o.geometry.type, b + ':' + B.o.geometry.type, n]);
    }
    return hits;
  };
  sec.classList.add('ready');
  // primeiro quadro, mesmo antes de entrar na tela
  frame(performance.now()); cancelAnimationFrame(raf); raf = 0;
}

/* início (depois de todas as definições) */
const sec = document.getElementById('mecanica');
if (sec && !sec.dataset.ready) {
  sec.dataset.ready = '1';
  try { boot(sec); } catch (e) { console.error(e); sec.classList.add('no-webgl'); }
}
