// === Moteur de rendu du personnage — extrait de nothing-pet/simulator ===
// (primitives + drawCreature + tous les accessoires). NE PAS éditer à la main :
// c'est un copié du simulateur, garde les deux synchro.

const N = 25;
const R = 12.4;
const CENTER = (N - 1) / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

// ---------- 2. Renderer : primitives ------------------------------------

const buf = new Float32Array(N * N);
const idx = (x, y) => y * N + x;
const clearBuf = () => buf.fill(0);

function px(x, y, v) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = idx(x, y);
  buf[i] = Math.max(buf[i], Math.min(1, v));
}
function hole(cx, cy, rad) {
  for (let y = Math.floor(cy-rad-1); y <= Math.ceil(cy+rad+1); y++)
    for (let x = Math.floor(cx-rad-1); x <= Math.ceil(cx+rad+1); x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const a = Math.max(0, Math.min(1, rad + 0.5 - Math.hypot(x-cx, y-cy)));
      if (a > 0) buf[idx(x, y)] *= (1 - a);
    }
}
function holeLine(x1, y1, x2, y2, w) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2-x1, y2-y1) * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    hole(x1 + (x2-x1)*t, y1 + (y2-y1)*t, w);
  }
}
function disc(cx, cy, rad, v) {
  for (let y = Math.floor(cy-rad-1); y <= Math.ceil(cy+rad+1); y++)
    for (let x = Math.floor(cx-rad-1); x <= Math.ceil(cx+rad+1); x++) {
      const a = Math.max(0, Math.min(1, rad + 0.5 - Math.hypot(x-cx, y-cy)));
      if (a > 0) px(x, y, a * v);
    }
}
function ellipse(cx, cy, rx, ry, v) {
  for (let y = Math.floor(cy-ry-1); y <= Math.ceil(cy+ry+1); y++)
    for (let x = Math.floor(cx-rx-1); x <= Math.ceil(cx+rx+1); x++) {
      const d = Math.hypot((x-cx)/rx, (y-cy)/ry);
      const a = Math.max(0, Math.min(1, (1 - d) * Math.max(rx, ry)));
      if (a > 0) px(x, y, Math.min(1, a) * v);
    }
}
function line(x1, y1, x2, y2, v) { strokeLine(x1, y1, x2, y2, 0.55, v); }
function strokeLine(x1, y1, x2, y2, w, v) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2-x1, y2-y1) * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x1 + (x2-x1)*t, y1 + (y2-y1)*t, w, v);
  }
}
const wave = (t, hz = 1) => Math.sin(t * Math.PI * 2 * hz);

// ---------- 2b. Renderer : le personnage --------------------------------

// Le perso est TOUJOURS centré. cx/cy fixes ; seules les couches 3/4
// s'autorisent à le déplacer.
const BX = CENTER, BY = CENTER;

let renderStyle = 'face';
const cosmetics = { hat:'none', eyes:'none', mouth:'none', beard:'none', neck:'none' };

function drawCreature(s, t) {
  const carve = renderStyle === 'body';
  const { layer, pose, phase, mode, energy } = s;

  // --- effondrement : les traits tombent (physique) ---
  if (pose === 'collapse') { drawCollapse(s, t, carve); return; }
  // --- platine vinyle : le perso n'apparaît pas ---
  if (pose === 'vinyl') { drawGramophone(s, t); return; }

  let cx = BX, cy = BY;
  let bodyW = 8.6, bodyH = 8.0;
  let tilt = 0, lookH = 0, lookV = 0;
  let eyeStyle = 'dot', eyeOpen = 1, mouth = 'smile';
  let blush = false;
  let bright = 1;
  let scene = null;
  let hideEyes = false;
  let shades = null;         // lunettes (scène 'shades')
  let heli = null;           // casquette hélico (scène 'heli')
  let discordMorph = 0;      // notif 'discord'
  let mouthBeat = 0;         // waveform de bouche (émote 'beatbop')
  let heartBeat = 0;         // battement des yeux-cœur (émote 'love')
  const extras = [];

  // --- pose de repos selon l'heure (couche 1, base de tout) ---
  if (mode === 'night') { eyeStyle = 'sleep'; mouth = 'none'; bright = 0.5; }
  else if (mode === 'eve') { eyeStyle = 'calm'; mouth = 'line'; bright = 0.85; }

  // --- couche 1.5 : scène "téléphone posé" ---
  if (pose.startsWith('scene:')) {
    scene = pose.slice(6);
    if (scene !== 'shades' && (t % 4.2) > 4.0) eyeStyle = 'sleep';
    if (scene === 'pipe') {
      cy = BY + 3;                                     // tout l'emote descend
      eyeStyle = 'calm'; mouth = 'none';
      tilt = Math.sin(t * 0.4) * 0.05;
    } else if (scene === 'shades') {
      // chute → regard stylé G/D → secoue → glisse d'un œil (retenue par l'autre) → tombe
      const p = phase;
      mouth = 'flat'; eyeStyle = 'dot';
      if (p < 0.18) {                                  // les lunettes tombent du ciel
        const q = p / 0.18;
        const drop = -22 * (1 - q * q);
        const bounce = q > 0.85 ? Math.sin((q - 0.85) / 0.15 * Math.PI) * 1.4 : 0;
        shades = { y: drop - bounce };
      } else if (p < 0.55) {                           // regard stylé gauche/droite
        const lp = (p - 0.18) / 0.37;
        lookH = Math.sin(lp * Math.PI * 2) * 3.8;
        tilt = Math.sin(lp * Math.PI * 2) * 0.14;
        shades = { y: 0 }; hideEyes = true;
      } else if (p < 0.63) {                           // il se secoue
        const q = (p - 0.55) / 0.08;
        tilt = Math.sin(q * Math.PI * 10) * 0.3;
        shades = { y: Math.sin(q * Math.PI * 10) * 0.6 }; hideEyes = true;
      } else if (p < 0.86) {                           // glissent, retenues par l'œil droit
        const q = Math.min(1, (p - 0.63) / 0.18);
        shades = { y: 0, slip: q * q }; hideEyes = true;
      } else if (p < 0.98) {                           // puis tombent complètement
        shades = { y: 0, slip: 1, fall: (p - 0.86) / 0.12 };
      } else {
        shades = null;                                 // c'est fini
      }
    } else if (scene === 'snow') {
      mouth = 'smile'; eyeStyle = 'dot';
      tilt = Math.sin(t * 0.3) * 0.05;
      lookV = -0.5 + Math.sin(t * 0.5) * 0.7;            // regarde vaguement en l'air
    } else if (scene === 'leaves') {
      mouth = 'smile'; eyeStyle = 'dot';
      tilt = Math.sin(t * 0.35) * 0.08;
      lookH = Math.sin(t * 0.4) * 1.5;                   // suit les feuilles du regard
    } else if (scene === 'heli') {
      // tombe sur la tête → se pose → hélice s'emballe → s'envole
      const p = phase;
      mouth = 'smile'; eyeStyle = 'dot';
      const spin = t * (p > 0.55 ? 30 : 6);
      if (p < 0.15) {                                    // chute du ciel
        const q = p / 0.15;
        heli = { y: -19 * (1 - q * q), x: 0, spin, fast: false };
        lookV = -1.1;
      } else if (p < 0.55) {                             // posée, le perso la regarde
        heli = { y: 0, x: 0, spin, fast: false };
        lookV = -0.4 + Math.sin(t * 1.2) * 0.3;
        eyeStyle = 'sparkle';
      } else if (p < 0.72) {                             // l'hélice s'emballe
        heli = { y: 0, x: 0, spin, fast: true };
        cy += Math.sin((p - 0.55) / 0.17 * Math.PI) * 0.7;   // se tasse
        lookV = -0.6; eyeStyle = 'wide';
      } else if (p < 0.96) {                             // décollage
        const q = (p - 0.72) / 0.24;
        heli = { y: -q * q * 24, x: Math.sin(q * 7) * 2, spin, fast: true };
        lookV = -1.4; mouth = 'o';
      } else {
        heli = null;                                     // parti
      }
    }
  }

  // --- couche 2 : micro-animations ---
  if (layer === 2) {
    const p = phase, sp = Math.sin(p * Math.PI);
    switch (pose) {
      case 'blink':  eyeStyle = sp > 0.35 ? 'calm' : eyeStyle; break;
      case 'twitch': tilt = Math.sin(p * Math.PI * 3) * 0.15; break;
      case 'lookL':  lookH = -3.0 * sp; eyeStyle = 'dot'; break;
      case 'lookR':  lookH =  3.0 * sp; eyeStyle = 'dot'; break;
      case 'lookU':  lookV = -2.2 * sp; eyeStyle = 'dot'; break;
      case 'lookD':  lookV =  2.2 * sp; eyeStyle = 'dot'; break;
      case 'yawn':   mouth = 'o'; eyeStyle = 'calm';
                     bodyH = 8.0 + sp * 0.6; break;
      case 'zzz':    eyeStyle = 'sleep'; mouth = 'none';
                     extras.push({ kind:'z', x: cx + 6 + (p*3)%3, y: cy - 4.5 - ((p*6)%3)*1.8, s: 1 + p });
                     break;
    }
  }

  // --- couche 3 : réactions ---
  if (layer === 3) {
    eyeStyle = 'dot'; bright = 1;
    switch (pose) {
      case 'dizzy':
        // corps immobile, seuls les yeux tourbillonnent
        eyeStyle = 'spiral'; mouth = 'wobble';
        extras.push({ kind:'stars', t }); break;
      case 'ears':
        eyeStyle = 'squint'; bodyW = 9.8; mouth = 'wobble';
        extras.push({ kind:'hands-ears' }); break;
      case 'panic':
        tilt = wave(t, 6) * 0.6; bodyH = 6.8; bodyW = 8.2;
        eyeStyle = 'wide'; mouth = 'o';
        extras.push({ kind:'excl' }, { kind:'armsup', t }); break;
      case 'bounce': {
        const b = Math.abs(wave(t, 2.6));
        cy -= b * 3.2; bodyH = 8.0 - b*1.1; bodyW = 8.6 + b*1.0;
        eyeStyle = 'arc'; mouth = 'grin'; blush = true; break;
      }
      case 'dance': {
        const sway = wave(t, 2);
        cx += sway * 2.6; tilt = sway * 0.7; cy -= Math.abs(wave(t, 4)) * 1.6;
        eyeStyle = 'arc'; mouth = 'o';
        extras.push({ kind:'note', x: cx + 7 + wave(t,1), y: cy - 5.5 - ((t*1.2)%3.5) }); break;
      }
      case 'beatbop': {
        // la "bouche" est une waveform horizontale qui réagit aux basses
        const bass = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2)), 0.5);
        cy -= bass * 1.2; tilt = Math.sin(t * Math.PI * 2 * 4.5) * 0.08;
        eyeStyle = 'arc';
        mouth = 'wave'; mouthBeat = bass;
        for (let i = 0; i < 2; i++)
          extras.push({ kind:'note', x: cx + 6 + i * 3 + wave(t + i, 1),
                        y: cy - 5 - ((t * 1.4 + i * 1.1) % 3) * 2.6 });
        break;
      }
      case 'happy': {
        const b = Math.abs(wave(t, 3));
        cy -= b * 1.8; eyeStyle = 'heart'; mouth = 'grin'; blush = true;
        extras.push({ kind:'heart', x: cx, y: cy - bodyH - 1.5 - b }); break;
      }
      case 'greet': {
        const b = Math.abs(wave(t, 2));
        cy -= b * 1.6; eyeStyle = 'arc'; mouth = 'smile'; blush = true;
        extras.push({ kind:'hand', y: -1 - b*2 }); break;
      }
      case 'grumpywake':
        eyeStyle = 'angry'; mouth = 'flat';
        tilt = wave(t, 0.6) * 0.15; bright = 0.8; break;
      case 'lowbat':
        // énervé : batterie faible
        eyeStyle = 'angry'; mouth = 'flat';
        tilt = wave(t, 3) * 0.06;
        cy -= Math.abs(wave(t, 0.7)) * 0.4;
        bright = 0.8;
        extras.push({ kind:'steam', t });
        if ((t % 1.4) < 1.0) extras.push({ kind:'lowbatt' });
        break;
      case 'alert': {
        const j = Math.abs(wave(t, 2.2));
        cy -= j * 2.2; eyeStyle = 'wide'; mouth = 'o';
        extras.push({ kind:'excl' }); break;
      }
      case 'sad':
        eyeStyle = 'calm'; mouth = 'flat'; lookV = 1.2;
        cy += Math.sin(t * 1.5) * 0.3; break;

      // ---- interactions ----
      case 'purr':                                     // CLIC : on le caresse — yeux fermés, il ronronne
        eyeStyle = 'arc'; mouth = 'cat'; blush = true;
        cx += Math.sin(t * 26) * 0.32;                 // ronronnement
        cy += Math.sin(t * 13) * 0.12;
        tilt = Math.sin(t * 3) * 0.05;
        extras.push({ kind:'pat', t });                // une main le caresse sur la tête
        if ((t % 0.85) > 0.5) extras.push({ kind:'heart', x: cx + 5.5, y: cy - bodyH - 1 - ((t * 2) % 3) });
        break;
      case 'smitten': {                                // CLICS RÉPÉTÉS : gaga, cœurs qui tournent
        const b = Math.abs(wave(t, 2));
        cy -= b * 1.6;
        eyeStyle = 'heart'; mouth = 'grin'; blush = true;
        tilt = Math.sin(t * 4) * 0.1;
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + i * 2.1;
          extras.push({ kind:'heart', x: cx + Math.cos(a) * (bodyW + 2), y: cy - bodyH + Math.sin(a) * 2.4 });
        }
        break;
      }
      case 'spin': {                                   // DOUBLE-CLIC : pirouette — tour complet
        const p = (t % 1.1) / 1.1;
        tilt = p * Math.PI * 2;
        eyeStyle = 'sparkle'; mouth = 'grin';
        cy -= Math.sin(p * Math.PI) * 3;               // petit saut pendant la vrille
        extras.push({ kind:'whirl', t });
        break;
      }
      case 'flip': {                                   // DOUBLE-CLIC : salto arrière
        const p = (t % 1.3) / 1.3;
        const jump = Math.sin(Math.min(1, p / 0.78) * Math.PI);
        cy -= jump * 8;
        tilt = (p < 0.78 ? p / 0.78 : 1) * Math.PI * 2;
        eyeStyle = p < 0.7 ? 'wide' : 'arc'; mouth = 'o';
        break;
      }
      case 'wiggle': {                                 // DOUBLE-CLIC : petite danse des hanches
        eyeStyle = 'arc'; mouth = 'grin'; blush = true;
        cx += Math.sin(t * 12) * 1.7;
        tilt = Math.sin(t * 12) * 0.18;
        cy += Math.abs(Math.sin(t * 6)) * -0.6;
        if ((t % 0.5) > 0.3) extras.push({ kind:'note', x: cx + 6, y: cy - bodyH - 1 - ((t * 2) % 3) });
        break;
      }
      case 'nom': {                                    // FRIANDISE : il mange
        const chomp = (t * 9) % 1;
        eyeStyle = 'arc'; mouth = chomp < 0.5 ? 'o' : 'grin';
        cy += Math.abs(Math.sin(t * 9)) * -0.5;
        blush = true;
        if ((t % 0.7) > 0.4) extras.push({ kind:'crumb', t });
        if ((t % 1.6) > 1.3) extras.push({ kind:'heart', x: cx, y: cy - bodyH - 1.5 });
        break;
      }
      case 'stuffed':                                  // FRIANDISE (trop) : bien rond, repu
        eyeStyle = 'half'; eyeOpen = 0.5; mouth = 'smile';
        bodyW = 10.4; bodyH = 8.8;
        tilt = Math.sin(t * 1.4) * 0.09;
        cy += Math.sin(t * 1.4) * 0.2;
        if ((t % 2) > 1.8) { mouth = 'o'; extras.push({ kind:'burp', t }); }   // petit rot
        break;

      // ---- friandises : une dégustation par type ----
      case 'nibble': {                                 // 🍓 fraise : petites bouchées délicates
        const bite = (t * 5) % 1;
        eyeStyle = 'arc'; mouth = bite < 0.35 ? 'o' : 'cat'; blush = true;
        cy += Math.sin(t * 5) * 0.18;
        tilt = Math.sin(t * 2.2) * 0.06;
        if ((t % 1.1) > 0.7) extras.push({ kind:'heart', x: cx + 4.5, y: cy - bodyH - 1 - ((t * 1.6) % 3) });
        if ((t % 0.9) > 0.6) extras.push({ kind:'crumb', t });
        break;
      }
      case 'gnaw': {                                   // 🦴 os : il le ronge, la tête secoue comme un chiot
        eyeStyle = 'squint'; mouth = 'grin';
        tilt = Math.sin(t * 16) * 0.22;                // secoue vivement
        cx += Math.sin(t * 16) * 0.7;
        cy += Math.abs(Math.sin(t * 8)) * -0.5;
        extras.push({ kind:'bonebit', t });
        if ((t % 1.4) > 1.1) extras.push({ kind:'crumb', t });
        break;
      }
      case 'gulp': {                                   // 🐟 poisson : gobé d'un coup, façon chat
        const p = (t % 1.6) / 1.6;
        eyeStyle = p < 0.55 ? 'dot' : 'arc';
        mouth = p < 0.4 ? 'o' : p < 0.6 ? 'grin' : 'cat';
        tilt = p < 0.5 ? -p * 0.5 : -(1 - p) * 0.5;    // renverse la tête puis revient
        cy += (p < 0.5 ? -p : -(1 - p)) * 1.6;
        blush = true;
        if (p > 0.6 && (t % 0.5) > 0.3) extras.push({ kind:'heart', x: cx, y: cy - bodyH - 1.6 });
        break;
      }
      case 'sugarrush': {                              // 🍬 bonbon : shot de sucre, il part en vrille
        const p = t % 2.4;
        if (p < 0.5) { eyeStyle = 'wide'; mouth = 'o'; cy += Math.abs(Math.sin(t * 12)) * -0.4; }
        else {
          eyeStyle = 'spiral'; mouth = 'grin';
          tilt = (t * 6) % (Math.PI * 2);
          cx += Math.sin(t * 22) * 0.9;
          cy -= Math.abs(wave(t, 5)) * 1.8;
        }
        for (let i = 0; i < 3; i++) {
          const a = t * 5 + i * 2.1;
          extras.push({ kind:'star4', x: cx + Math.cos(a) * (bodyW + 2), y: cy - bodyH + Math.sin(a) * 2.4, ph: t * 4 });
        }
        break;
      }
      case 'crunch': {                                 // 🥕 carotte : croque net, énergique et déterminé
        const chomp = (t * 12) % 1;
        eyeStyle = 'squint'; mouth = chomp < 0.5 ? 'line' : 'o';
        cy += Math.abs(Math.sin(t * 12)) * -0.55;
        tilt = Math.sin(t * 12) * 0.04;
        if (chomp < 0.15) extras.push({ kind:'crumb', t }, { kind:'crunchmark', t });
        break;
      }
      case 'spicy': {                                  // 🌶 piment : une bouchée… puis ça brûle
        const p = t % 2.6;
        if (p < 0.5) { eyeStyle = 'dot'; mouth = 'o'; }              // il croque, tranquille
        else {                                                      // ça monte
          eyeStyle = 'wide'; mouth = 'o';
          tilt = wave(t, 9) * 0.4; cx += wave(t, 9) * 1.2;
          bodyH = 7.2;
          extras.push({ kind:'steam', t }, { kind:'excl' });
          if (p > 1.9) { blush = true; extras.push({ kind:'sweat', t }); } // fin : soulagé mais rouge
        }
        break;
      }
      case 'recharge': {                               // 🔋 pile : c'est un robot — il se recharge
        const p = Math.min(1, (t % 3) / 2.4);          // jauge qui se remplit
        bright = 0.45 + p * 0.7;
        eyeStyle = p < 0.4 ? 'half' : p < 0.85 ? 'dot' : 'wide';
        eyeOpen = p < 0.4 ? 0.4 : 1;
        mouth = p < 0.85 ? 'line' : 'grin';
        cy += (1 - p) * 1.4;                           // avachi -> se redresse
        if ((t % 0.4) < 0.2) extras.push({ kind:'bolt', t });
        extras.push({ kind:'chargebar', p });
        break;
      }

      // ---- humeurs "PC" (tenues tant qu'on est dans l'appli) ----
      case 'focus':        // code / terminal : concentré
        eyeStyle = 'dot'; mouth = 'line'; lookV = 0.7;
        cy += Math.sin(t * 3.2) * 0.18;                 // petits hochements (il "tape")
        if ((t % 6) > 5.7) extras.push({ kind:'excl' });   // idée !
        break;
      case 'matrix':       // code : yeux "matrice", scan de lignes (pluie ajoutée par pet.js)
        eyeStyle = 'dot'; mouth = 'line';
        lookH = Math.sin(t * 0.9) * 1.4;                // scanne le code
        cy += Math.sin(t * 4) * 0.12;
        break;
      case 'volup': {      // le son monte
        const b = Math.abs(wave(t, 3));
        cy -= b * 1.6; eyeStyle = 'wide'; mouth = 'o';
        extras.push({ kind:'chev', dir:-1, off:0 }, { kind:'chev', dir:-1, off:1.7 });
        break;
      }
      case 'voldown': {    // le son baisse
        const b = Math.abs(wave(t, 3));
        cy += 1.0 + b * 0.5; eyeStyle = 'half'; eyeOpen = 0.45; mouth = 'flat';
        extras.push({ kind:'chev', dir:1, off:0 }, { kind:'chev', dir:1, off:1.7 });
        break;
      }
      case 'mute':         // coupé
        eyeStyle = 'wide'; mouth = 'flat'; bodyW = 9.6;
        extras.push({ kind:'hands-ears' }, { kind:'muteX' });
        break;
      // ---- outils d'IA / de création (teinte gérée par pet.js) ----
      case 'claude':       // discute avec Claude : chaleureux, il écoute et hoche
        eyeStyle = 'sparkle'; mouth = 'smile'; blush = true;
        tilt = Math.sin(t * 0.7) * 0.07;
        cy += Math.sin(t * 1.6) * 0.32;
        lookH = Math.sin(t * 0.33) * 1.1;                    // le regard dérive doucement
        lookV = Math.sin(t * 0.47) * 0.35;
        if ((t % 5.4) > 5.1) eyeStyle = 'calm';              // clignement lent
        if ((t % 4) > 3.55) extras.push({ kind:'star4', x: cx + bodyW + 1.6, y: cy - bodyH + 1, ph: t });
        break;
      case 'claudelook':   // attente : il regarde autour de lui, curieux
        eyeStyle = 'dot'; mouth = 'smile';
        lookH = Math.sin(t * 1.05) * 2.7;
        lookV = Math.sin(t * 0.7) * 0.9;
        tilt = Math.sin(t * 0.9) * 0.13;
        if ((t % 3.2) > 3.0) eyeStyle = 'calm';
        break;
      case 'claudehum': {  // attente : il fredonne, se balance, content
        eyeStyle = 'arc'; mouth = 'smile'; blush = true;
        cx += Math.sin(t * 1.7) * 1.5;
        tilt = Math.sin(t * 1.7) * 0.15;
        cy += Math.abs(Math.sin(t * 3.4)) * -0.4;
        if ((t % 1.7) > 0.85)
          extras.push({ kind:'note', x: cx + 5.5 + wave(t, 1), y: cy - bodyH - 1 - ((t * 1.3) % 3.5) });
        break;
      }
      case 'clauderead': { // attente : il lit en patientant (le regard balaye les lignes)
        eyeStyle = 'dot'; mouth = 'line';
        lookV = 0.7;
        const lp = t % 1.7;                                  // une "ligne" toutes les 1,7 s
        lookH = lp < 1.45 ? -1.9 + (lp / 1.45) * 3.8 : -1.9; // gauche → droite puis retour
        tilt = 0.03;
        extras.push({ kind:'page' });
        break;
      }
      case 'claudeidea': { // attente : petite étincelle d'idée
        const p = t % 2.4;
        const pop = p < 0.3 ? p / 0.3 : p < 1.5 ? 1 : Math.max(0, 1 - (p - 1.5) / 0.9);
        eyeStyle = pop > 0.55 ? 'wide' : 'sparkle';
        mouth = 'grin'; blush = true;
        cy -= pop * 0.9;
        if (pop > 0.12)
          extras.push({ kind:'star4', x: cx, y: cy - bodyH - 2.2, ph: t * 4 });
        break;
      }
      case 'claudethink': {   // Claude réfléchit / rédige : bouche = chargement (•, ••, •••, vide)
        eyeStyle = 'dot'; mouth = 'none';
        lookV = -0.5 + Math.sin(t * 0.5) * 0.25;         // le regard part en l'air
        lookH = Math.sin(t * 0.4) * 0.7;
        tilt = Math.sin(t * 0.55) * 0.05;
        const c = t % 2.0;                                 // •(0.4s) ••(0.4s) •••(0.4s) puis pause
        extras.push({ kind:'loaddots', n: c < 0.4 ? 1 : c < 0.8 ? 2 : c < 1.2 ? 3 : 0 });
        break;
      }
      case 'claudedone': {    // Claude a fini : "!" de contentement, puis retour à l'attente
        const j = Math.abs(wave(t, 3));
        cy -= j * 1.4;
        eyeStyle = 'arc'; mouth = 'grin'; blush = true;
        extras.push({ kind:'excl' });
        break;
      }
      // ---- ChatGPT : l'assistant appliqué — neutre, propre, il structure tout,
      //      réponses qui se "streament", listes à puces, toujours poli ----
      case 'chatgpt':      // base : posture neutre, "•••" de réflexion
        eyeStyle = 'ring'; mouth = 'line';
        lookH = Math.sin(t * 1.2) * 0.9;
        cy += Math.sin(t * 2.6) * 0.12;
        extras.push({ kind:'dots', ph: t });
        break;
      case 'chatgptthink': {   // il rédige : "•••" qui pulse posément, regard en l'air
        eyeStyle = 'ring'; mouth = 'line';
        lookV = -0.3 + Math.sin(t * 0.6) * 0.2;
        tilt = Math.sin(t * 0.5) * 0.03;
        const c = t % 1.8;
        extras.push({ kind:'loaddots', n: c < 0.45 ? 1 : c < 0.9 ? 2 : c < 1.35 ? 3 : 0 });
        break;
      }
      case 'chatgpttype': {    // il "streame" une réponse : les lignes se construisent
        eyeStyle = 'dot'; mouth = 'line';
        lookV = 0.5; lookH = Math.sin(t * 3) * 0.5;
        cy += Math.sin(t * 5) * 0.1;
        extras.push({ kind:'answerlines', ph: t });
        break;
      }
      case 'chatgptlist': {    // il structure : une liste à puces apparaît point par point
        eyeStyle = 'dot'; mouth = 'smile';
        lookV = 0.3; tilt = 0.02;
        extras.push({ kind:'listbullets', ph: t });
        break;
      }
      case 'chatgptnod': {     // « bien sûr ! » — hochement courtois
        eyeStyle = 'arc'; mouth = 'smile'; blush = true;
        cy += Math.sin(t * 4) * 0.7;
        tilt = Math.sin(t * 4) * 0.04;
        break;
      }
      // ---- Gemini : le jumeau show-off — pétille, multimodal, son étoile
      //      tourne autour de lui, clins d'œil, il joue ----
      case 'gemini':       // base : joueur, pétille, deux étoiles qui scintillent
        eyeStyle = 'sparkle'; mouth = 'grin';
        tilt = Math.sin(t * 1.1) * 0.1;
        cy += Math.abs(wave(t, 1.6)) * 0.7;
        extras.push({ kind:'star4', x: cx + bodyW + 1.4, y: cy - bodyH + 1.5, ph: t },
                    { kind:'star4', x: cx - bodyW - 1.4, y: cy - bodyH + 3.5, ph: t + 1.7 });
        break;
      case 'geminispark': {    // éclat : une gerbe d'étincelles, ravi, il rebondit
        const b2 = Math.abs(wave(t, 2.4));
        cy -= b2 * 1.6;
        eyeStyle = 'sparkle'; mouth = 'grin'; blush = true;
        extras.push({ kind:'twinkle', ph: t });
        break;
      }
      case 'geminiswirl': {    // son étoile fait le tour de sa tête, il la suit des yeux
        eyeStyle = 'dot'; mouth = 'smile';
        const a = t * 2.2;
        lookH = Math.cos(a) * 2.2; lookV = Math.sin(a) * 0.8;
        tilt = Math.cos(a) * 0.08;
        extras.push({ kind:'orbitstar', ph: t });
        break;
      }
      case 'geminiwink': {     // clin d'œil malicieux
        const p = t % 2.2;
        eyeStyle = p < 0.35 ? 'wink' : 'sparkle';
        mouth = 'grin'; blush = true;
        tilt = Math.sin(t * 3) * 0.06;
        if (p < 0.35) extras.push({ kind:'star4', x: cx + bodyW + 1.4, y: cy - bodyH + 1, ph: t * 5 });
        break;
      }
      case 'geminimuse': {     // créatif : il regarde en l'air, une idée pétillante se forme
        eyeStyle = 'sparkle'; mouth = 'smile';
        lookV = -0.7 + Math.sin(t * 0.7) * 0.3;
        lookH = Math.sin(t * 0.5) * 1.2;
        tilt = Math.sin(t * 0.6) * 0.1;
        cy += Math.sin(t * 1.4) * 0.3;
        if ((t % 2.6) > 2.2) extras.push({ kind:'twinkle', ph: t });
        break;
      }
      // ---- Affinity : l'artiste minutieux (perso : concentration "langue tirée",
      //      il bosse sur sa planche, recule pour admirer, redessine) ----
      case 'affinity': {   // base : il crayonne, traits de construction, langue tirée
        eyeStyle = 'squint'; mouth = 'cat';                 // œil qui vise + langue de concentration
        lookV = 0.7; lookH = Math.sin(t * 2.4) * 0.9;       // la main va-et-vient
        tilt = 0.06 + Math.sin(t * 0.5) * 0.03;
        cy += Math.sin(t * 4.5) * 0.12;                     // petits coups de crayon
        extras.push({ kind:'sketch', ph: t });
        break;
      }
      case 'affinitypaint': { // il se peint lui-même son sourire au pinceau (signature)
        const cyc = 3.4, u = (t % cyc) / cyc;
        const draw = Math.min(1, u / 0.62);
        eyeStyle = 'dot'; mouth = 'none';
        lookH = (draw - 0.5) * 1.5; lookV = 0.7;
        tilt = 0.035 + Math.sin(t * 0.6) * 0.025;
        extras.push({ kind:'canvas', u, draw, ph: t });
        break;
      }
      case 'affinitypen': {  // outil plume : il pose des points de courbe, ultra précis
        eyeStyle = 'dot'; eyeOpen = 0.8; mouth = 'line';
        lookV = 0.6;
        const seg = Math.floor(t / 0.8) % 4;
        lookH = [-2, -0.5, 1, 2.2][seg] + Math.sin(t * 8) * 0.12;   // saccades nœud à nœud
        extras.push({ kind:'bezier', ph: t });
        break;
      }
      case 'affinitycolor': { // il choisit une couleur : nuancier qui défile, œil qui accroche
        eyeStyle = 'sparkle'; mouth = 'cat';
        lookH = Math.sin(t * 3) * 1.6;
        tilt = Math.sin(t * 0.7) * 0.05;
        extras.push({ kind:'swatches', ph: t });
        break;
      }
      case 'affinityzoom': {  // zoom pixel : un seul gros œil, micro-ajustements
        eyeStyle = 'dot'; mouth = 'line'; hideEyes = true;
        extras.push({ kind:'bigeye', ph: t });
        cy += Math.sin(t * 12) * 0.06;                      // main très fine
        break;
      }
      case 'affinitystep': {  // il recule et penche la tête pour juger son travail
        eyeStyle = 'dot'; mouth = 'line';
        const p = (t % 3) / 3;
        cy += (p < 0.5 ? p : 1 - p) * 2.4;                  // recule (descend) puis revient
        tilt = Math.sin(t * 1.1) * 0.22;                    // penche la tête, hmm
        lookV = -0.2;
        if (p > 0.7) { mouth = 'smile'; eyeStyle = 'arc'; } // satisfait
        break;
      }
      // ---- VS Code : l'ingénieur méthodique — posé, rangé, il avance par petites
      //      étapes (autocomplete, squiggle à corriger, breakpoint, sauvegarde) ----
      case 'vscode': {          // base : concentré, il tape, curseur qui clignote
        eyeStyle = 'dot'; mouth = 'line';
        lookV = 0.5; lookH = Math.sin(t * 1.3) * 0.5;
        cy += Math.sin(t * 4.2) * 0.14;                     // frappe régulière
        tilt = Math.sin(t * 0.4) * 0.02;
        if ((t % 4.6) > 4.4) eyeStyle = 'calm';             // clignement
        extras.push({ kind:'caret', t });
        if ((t % 7) > 6.7) extras.push({ kind:'star4', x: cx, y: cy - bodyH - 2.2, ph: t * 4 }); // IntelliSense
        break;
      }
      case 'vscodetype': {      // autocomplete : une liste déroule, il choisit
        eyeStyle = 'dot'; mouth = 'line';
        lookV = 0.4 + Math.sin(t * 4) * 0.5;                // parcourt la liste
        const p = (t % 2.4) / 2.4;
        if (p > 0.8) { mouth = 'smile'; eyeStyle = 'arc'; } // il valide
        extras.push({ kind:'menu', ph: t });
        break;
      }
      case 'vscodelint': {      // un squiggle rouge : il fronce, se penche, puis corrige
        const p = (t % 3.4) / 3.4;
        if (p < 0.65) {
          eyeStyle = 'angry'; mouth = 'flat'; lookV = 0.7;
          tilt = 0.05 + Math.sin(t * 6) * 0.03;
          extras.push({ kind:'squiggle', bad: true });
        } else {                                            // résolu
          eyeStyle = 'arc'; mouth = 'smile'; blush = true;
          extras.push({ kind:'check', t });
        }
        break;
      }
      case 'vscodedebug': {     // débogage : breakpoint, il avance pas à pas, prudent
        eyeStyle = 'dot'; eyeOpen = 0.85; mouth = 'line';
        lookV = 0.8;
        const step = Math.floor(t / 0.9) % 4;
        lookH = [-1.4, -0.4, 0.6, 1.6][step];               // il "step over" ligne à ligne
        cy += Math.sin(t * 1.5) * 0.1;
        extras.push({ kind:'bp', t });
        break;
      }
      case 'vscodesave': {      // ⌘S : petit check, hochement satisfait
        const j = Math.abs(wave(t, 3));
        cy -= j * 1.2;
        eyeStyle = 'arc'; mouth = 'smile'; blush = true;
        extras.push({ kind:'check', t });
        break;
      }
      // ---- Canva : le compositeur express — templates, glisser-déposer, repères
      //      magnétiques ; rapide et joyeux, l'inverse du perfectionnisme d'Affinity ----
      case 'canva': {           // base : il pioche dans les templates, ça va vite
        eyeStyle = 'sparkle'; mouth = 'grin';
        lookH = Math.sin(t * 3.4) * 1.6;                    // survole les vignettes
        cy += Math.abs(Math.sin(t * 4)) * -0.4;
        tilt = Math.sin(t * 1.6) * 0.05;
        extras.push({ kind:'tiles', ph: t });
        break;
      }
      case 'canvadrag': {       // il glisse un élément, ça claque sur le repère magnétique
        const p = (t % 1.8) / 1.8;
        eyeStyle = 'dot'; mouth = 'line';
        lookH = (p - 0.5) * 3.2;
        if (p > 0.82) { mouth = 'grin'; eyeStyle = 'arc'; }  // snap !
        extras.push({ kind:'snapguide', p });
        break;
      }
      case 'canvatemplate': {   // un template entier apparaît d'un coup, il valide
        const j = Math.abs(wave(t, 2.4));
        cy -= j * 1.2;
        eyeStyle = 'sparkle'; mouth = 'grin'; blush = true;
        extras.push({ kind:'tiles', ph: t, big: true });
        break;
      }
      case 'canvapop': {        // palette multicolore qui défile vite
        eyeStyle = 'sparkle'; mouth = 'cat';
        lookH = Math.sin(t * 5) * 1.4;
        tilt = Math.sin(t * 0.8) * 0.05;
        extras.push({ kind:'popswatch', ph: t });
        break;
      }
      // ---- Git / GitHub : le gardien de l'histoire — il archive, surveille le
      //      graphe des branches, valide chaque instantané avec soin ----
      case 'git': {             // base : posé, il regarde le graphe des commits défiler
        eyeStyle = 'dot'; mouth = 'line';
        lookV = 0.2 + Math.sin(t * 0.6) * 0.25;
        tilt = Math.sin(t * 0.35) * 0.03;
        if ((t % 3.4) > 3.2) eyeStyle = 'calm';
        extras.push({ kind:'commitline', ph: t });
        break;
      }
      case 'gitcommit': {       // un instantané : un nœud se pose sur la ligne + coche
        const j = Math.abs(wave(t, 3));
        cy -= j * 1.1;
        eyeStyle = 'arc'; mouth = 'smile'; blush = true;
        extras.push({ kind:'commitline', ph: t }, { kind:'check', t });
        break;
      }
      case 'gitbranch': {       // le graphe fourche, il penche la tête pour suivre
        eyeStyle = 'dot'; mouth = 'line';
        tilt = Math.sin(t * 0.9) * 0.2;
        lookH = Math.sin(t * 0.9) * 1.8;
        extras.push({ kind:'commitline', ph: t, fork: true });
        break;
      }
      case 'gitdiff': {         // il relit un diff : lignes rouges / vertes, regard qui scanne
        eyeStyle = 'squint'; mouth = 'line';
        lookV = 0.6;
        const lp = t % 1.5;
        lookH = lp < 1.25 ? -1.9 + (lp / 1.25) * 3.8 : -1.9;
        extras.push({ kind:'difflines', ph: t });
        break;
      }
      case 'gitpush': {         // push : une flèche part vers le haut, whoosh
        const p = (t % 1.4) / 1.4;
        eyeStyle = 'wide'; mouth = 'o';
        cy -= Math.sin(Math.min(1, p / 0.6) * Math.PI) * 1.6;
        extras.push({ kind:'pusharrow', p });
        break;
      }
      case 'curious':      // navigation web : le regard se balade
        eyeStyle = 'dot'; mouth = 'smile';
        lookH = Math.sin(t * 0.7) * 2.4;
        tilt = Math.sin(t * 0.5) * 0.1;
        break;
      case 'creative':     // design : yeux qui brillent, regarde en l'air
        eyeStyle = 'sparkle'; mouth = 'smile';
        tilt = Math.sin(t * 0.9) * 0.09;
        lookV = -0.4 + Math.sin(t * 0.6) * 0.5;
        break;
      case 'chill':        // média : détendu, il regarde
        eyeStyle = 'calm'; mouth = 'smile';
        cx += Math.sin(t * 0.6) * 1.2; tilt = Math.sin(t * 0.6) * 0.12;
        break;
      case 'social':       // chat : coucou, rougit
        eyeStyle = 'arc'; mouth = 'smile'; blush = true;
        cy -= Math.abs(wave(t, 1.4)) * 1.0;
        if ((t % 4) > 3.5) extras.push({ kind:'hand', y: -2 });
        break;
      case 'bored':        // inactif un moment : s'ennuie
        eyeStyle = 'half'; eyeOpen = 0.5; mouth = 'flat';
        lookH = Math.sin(t * 0.35) * 2.6;
        cy += 0.6 + Math.sin(t * 0.9) * 0.3;
        break;
      case 'love': {
        // yeux en cœur qui battent (lub-dub) + grand sourire
        eyeStyle = 'heart'; mouth = 'grin';
        const c = t % 1.0;
        heartBeat = c < 0.14 ? Math.sin(c / 0.14 * Math.PI)
                  : c < 0.40 ? Math.sin((c - 0.26) / 0.14 * Math.PI) * 0.65
                  : 0;
        break;
      }
      // ---- Discord : le gremlin hyper-social — jamais au repos, happé par le
      //      chat qui défile, sursaute à chaque message, répond du tac au tac ----
      case 'discord': {          // base : les yeux suivent le chat qui défile vite
        eyeStyle = 'wide';                                 // toujours en alerte
        const msg = Math.sin(t * 3.2);
        lookH = msg * 2.6;                                 // ping-pong rapide gauche/droite
        lookV = 0.3 + Math.sin(t * 5) * 0.3;
        mouth = (t % 1.4) > 1.1 ? 'o' : 'line';            // "ah !" à chaque message
        cy += Math.abs(Math.sin(t * 4)) * -0.3;            // petits sursauts
        tilt = msg * 0.06;
        break;
      }
      case 'discordtype': {      // il tape une réponse à toute vitesse
        eyeStyle = 'wide'; mouth = 'line';
        lookV = 0.9;                                       // regarde le clavier
        cy += Math.abs(Math.sin(t * 14)) * -0.4;           // pianote vite
        tilt = Math.sin(t * 12) * 0.05;
        extras.push({ kind:'loaddots', n: 1 + Math.floor((t * 3) % 3) });   // "..." il écrit
        break;
      }
      case 'discordscan': {      // trop de salons ouverts, la tête part dans tous les sens
        eyeStyle = 'wide'; mouth = 'wobble';
        lookH = Math.sin(t * 6) * 3.0;
        lookV = Math.cos(t * 5) * 1.4;
        tilt = Math.sin(t * 7) * 0.14;
        if ((t % 1.2) > 0.9) extras.push({ kind:'excl' });
        break;
      }
      case 'discordpile': {      // beaucoup de non-lus : un peu débordé mais ça va
        eyeStyle = 'wide'; mouth = 'flat';
        tilt = Math.sin(t * 2) * 0.06;
        cy += Math.sin(t * 3) * 0.2;
        extras.push({ kind:'notifpile', t }, { kind:'sweat', t });
        break;
      }
      case 'discordping': {      // ACTION : nouvelle mention / DM — flash logo + rebond
        const p = Math.min(1, (t % 1.3) / 1.3);
        const j = Math.abs(wave(t, 4));
        cy -= j * 2.0;
        discordMorph = p < 0.30 ? p / 0.30
                     : p < 0.62 ? 1
                     : p < 0.85 ? 1 - (p - 0.62) / 0.23
                     : 0;
        bright *= (1 - discordMorph);
        if (discordMorph > 0.05) { hideEyes = true; mouth = 'none'; }
        else { eyeStyle = 'wide'; mouth = 'o'; extras.push({ kind:'excl' }); }
        break;
      }
      case 'discordzero': {      // ACTION : il vient de rattraper son retard de notifs
        const b = Math.abs(wave(t, 1.6));
        cy -= b * 1.4;
        eyeStyle = 'arc'; mouth = 'grin'; blush = true;
        if ((t % 1.2) > 0.7) extras.push({ kind:'star4', x: cx, y: cy - bodyH - 2.2, ph: t * 4 });
        break;
      }
      case 'discordring': {      // ACTION : appel entrant — ça sonne, il sursaute
        const s = wave(t, 9);
        eyeStyle = 'wide'; mouth = 'o';
        tilt = s * 0.2; cx += s * 0.8;
        extras.push({ kind:'ringwaves', s }, { kind:'excl' });
        break;
      }
      case 'discordcall': {      // ÉTAT : appel privé (DM) — casque, discussion posée
        eyeStyle = 'arc'; mouth = 'smile';
        cy += Math.sin(t * 5) * 0.28;
        tilt = Math.sin(t * 2.5) * 0.05;
        if ((t % 1.3) > 0.65) mouth = 'o';                 // il parle à tour de rôle
        extras.push({ kind:'headset' }, { kind:'bubble', side: ((t % 2.6) < 1.3 ? -1 : 1) });
        break;
      }
      case 'discordvoiceserver': { // ÉTAT : salon vocal d'un serveur — ambiance, ça bouge
        eyeStyle = 'arc'; mouth = 'grin'; blush = true;
        cy += Math.abs(Math.sin(t * 7)) * -0.6;            // bounce énergique
        tilt = Math.sin(t * 5) * 0.12;
        for (let i = 0; i < 2; i++)
          extras.push({ kind:'note', x: cx + (i ? 6 : -6) + wave(t + i, 1.2),
                        y: cy - bodyH - 0.5 - ((t * 1.4 + i * 1.7) % 4) });
        extras.push({ kind:'headset' });
        break;
      }
      case 'discordvideo': {     // ÉTAT : quelqu'un a la cam / partage l'écran
        eyeStyle = 'sparkle'; mouth = 'smile';
        lookV = 0.3; cy += Math.sin(t * 4) * 0.15;
        extras.push({ kind:'headset' }, { kind:'screen', t });
        break;
      }

      // ---- YouTube : le zombie hypnotisé par l'écran — regard vitreux figé,
      //      la lueur de l'écran bat sur son visage, avachi, happé par l'autoplay ----
      case 'youtube': {          // base : il fixe l'écran, les miniatures le happent
        eyeStyle = 'wide'; mouth = 'o';
        bright *= 0.82 + 0.18 * Math.abs(Math.sin(t * 4.5));   // battement d'écran
        // le regard essaie de bouger puis est ré-aspiré au centre
        lookH = Math.sin(t * 0.5) * 1.4 * Math.max(0, 1 - (t % 3) / 1.2);
        lookV = 0.35;
        cy += 0.5 + Math.sin(t * 0.7) * 0.15;                  // avachi
        if ((t % 6) > 5.85) eyeStyle = 'calm';                 // cligne à peine
        extras.push({ kind:'screenglow', t });
        break;
      }
      case 'youtubescroll': {    // « la prochaine est peut-être mieux » — il scrolle en boucle
        eyeStyle = 'wide'; mouth = 'o';
        bright *= 0.82 + 0.18 * Math.abs(Math.sin(t * 4.5));
        const lp = t % 0.9;
        lookV = lp < 0.7 ? -1.0 + (lp / 0.7) * 2.2 : -1.0;     // défile, saute, défile
        cy += 0.4;
        extras.push({ kind:'screenglow', t });
        break;
      }
      case 'youtuberabbithole': { // 3 h du mat', « encore une »… il tient à peine
        eyeStyle = 'half'; eyeOpen = 0.35; mouth = 'flat';
        bright *= 0.8 + 0.15 * Math.abs(Math.sin(t * 4.5));
        lookV = 0.6;
        cy += 1.1 + Math.sin(t * 0.7) * 0.3;                   // vraiment avachi
        tilt = Math.sin(t * 0.35) * 0.16;                      // la tête qui tombe
        if ((t % 4) > 3.4) { eyeOpen = 0.08; tilt = 0.3; }     // micro-sommeil
        extras.push({ kind:'screenglow', t });
        break;
      }
      case 'youtubewatch': {     // ÉTAT : une vidéo joue — absorption totale, il ne bouge plus
        eyeStyle = 'wide'; mouth = 'o';
        bright *= 0.78 + 0.28 * Math.abs(Math.sin(t * 6));     // fort scintillement
        cy += 0.5 + Math.sin(t * 0.9) * 0.06;                  // quasi immobile
        if ((t % 8) > 7.5) { mouth = 'grin'; eyeStyle = 'arc'; cy -= 0.6; }  // éclat de rire
        extras.push({ kind:'popcorn', t }, { kind:'screenglow', t }, { kind:'playbar', t });
        break;
      }
    }
  }

  // --- couche 4 : poche ---
  if (layer === 4 && pose === 'hide') {
    cy += 4.5; bodyH = 3.6; bodyW = 11; eyeStyle = 'sleep';
    mouth = 'none'; bright = 0.4;
  }

  bright *= 0.6 + 0.4 * energy;

  // --- cosmétiques équipés ---
  const cos = (typeof petCosmetics === 'function') ? petCosmetics() : cosmetics;
  if (!carve && cos.mouth === 'cat' &&
      (mouth === 'smile' || mouth === 'line' || mouth === 'flat')) mouth = 'cat';
  else if (!carve && cos.mouth === 'pacifier' && mouth !== 'none') mouth = 'pacifier';
  const lashesOn = !carve && cos.eyes === 'lashes';

  // --- tracé ---
  const co = Math.cos(tilt), si = Math.sin(tilt);
  const rot = (dx, dy) => [cx + dx*co - dy*si, cy + dx*si + dy*co];

  if (carve) {
    ellipse(cx, cy, bodyW, bodyH, 0.9 * bright);
    ellipse(cx, cy, bodyW + 0.9, bodyH + 0.9, 0.22 * bright);
  }

  // Géométrie du visage. Le mode "visage seul" a sa propre échelle :
  // yeux plus gros, plus écartés, bouche plus basse.
  let eyeDX, eyeY, mouthY, feat, faceBright;
  if (carve) {
    eyeDX = bodyW * 0.33; eyeY = -bodyH * 0.20; mouthY = bodyH * 0.32;
    feat = 1; faceBright = bright;
  } else {
    eyeDX = 4.2; eyeY = -2.6; mouthY = 4.2;
    feat = 1.45; faceBright = Math.max(bright, 0.92);
  }

  if (!hideEyes) {
    for (const sg of [-1, 1]) {
      const [ex, ey] = rot(sg * eyeDX + lookH * 0.7, eyeY + lookV * 0.7);
      drawEye(ex, ey, eyeStyle, eyeOpen, sg, t, faceBright, carve, feat * (1 + heartBeat * 0.45), lashesOn);
    }
  }

  if (mouth !== 'none') {
    const [mx, my] = rot(0, mouthY);
    drawMouth(mx, my, mouth, t, faceBright, carve, feat, mouthBeat);
  }

  if (blush && !carve) {
    // rougissement façon animé : petits traits obliques sur les joues
    for (const sg of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        const [x1, y1] = rot(sg * eyeDX * 1.15 + i * 0.95, mouthY - 0.7);
        strokeLine(x1 - 0.35, y1 + 0.8, x1 + 0.35, y1 - 0.8, 0.26, faceBright * 0.8);
      }
    }
  }

  for (const e of extras) drawExtra(e, cx, cy, bodyW, bodyH, t, bright, rot);

  // --- accessoires de scène ---
  if (scene === 'pipe') {
    const [hx, hy] = rot(0, eyeY - 4.0);
    drawTopHat(hx, hy, faceBright, tilt);
    drawPipe(cx + 1.5, cy + mouthY - 0.4, faceBright, t);
  } else if (scene === 'shades' && shades) {
    drawSunglasses(cx, cy + eyeY + (shades.y || 0), eyeDX, faceBright, shades);
  } else if (scene === 'heli' && heli) {
    const [hx, hy] = rot(heli.x, eyeY - 3.4 + heli.y);
    drawHeliCap(hx, hy, heli.spin, heli.fast, faceBright);
  }

  // --- logo Discord (notif) ---
  if (discordMorph > 0.02) drawDiscord(BX, BY, discordMorph, Math.max(0.9, 0.6 + 0.4 * energy), t);

  // --- cosmétiques équipés (sinon décor saisonnier) ---
  if (!carve && scene !== 'pipe') {
    const P = rot;
    switch (cos.hat) {
      case 'tophat':  { const [hx, hy] = P(0, eyeY - 4.0); drawTopHat(hx, hy, faceBright, tilt); break; }
      case 'witch':   drawWitchHat(cx, cy + eyeY - 2.2, faceBright); break;
      case 'catears': drawCatEars(cx, cy + eyeY - 2.4, faceBright); break;
      case 'cap':     drawCapStraight(cx, cy + eyeY - 2.5, faceBright); break;
    }
    if (cos.eyes === 'glasses') drawSpecs(P, eyeDX, faceBright, false);
    else if (cos.eyes === 'monocle') drawSpecs(P, eyeDX, faceBright, true);
    if (cos.beard === 'tache')   drawStache(cx, cy, mouthY, faceBright, false);
    else if (cos.beard === 'italian') drawStache(cx, cy, mouthY, faceBright, true);
    else if (cos.beard === 'full')    drawBeard(cx, cy, mouthY, faceBright);
    if (cos.neck === 'bowtie') drawBowtie(P, mouthY, faceBright);
  } else if (s.decor === 'noel') {
    drawSantaHat(cx, cy - bodyH * 0.78, bright);
  }
}

// ---- cosmétiques -----------------------------------------------------

// casquette droite : demi-dôme + visière de face (deux rangées)
function drawCapStraight(cx, browY, b) {
  const domeCY = browY - 0.4, rx = 5.0, ry = 3.9;
  ellipse(cx, domeCY, rx, ry, b * 0.55);
  hole(cx, domeCY + ry * 0.55, rx + 1);                     // coupe la moitié basse
  for (let a = Math.PI * 1.03; a <= Math.PI * 1.97; a += 0.09)
    disc(cx + Math.cos(a) * rx, domeCY + Math.sin(a) * ry, 0.5, b);   // arête haute
  for (let x = -5.4; x <= 5.4; x += 0.38) disc(cx + x, browY + Math.abs(x) * 0.05, 0.5, b);
  for (let x = -4.6; x <= 4.6; x += 0.4) disc(cx + x, browY + 0.95 + Math.abs(x) * 0.05, 0.42, b * 0.8);
  disc(cx, domeCY - ry + 0.4, 0.45, b);                     // bouton
}

// binocle rond / monocle — verres larges, on voit l'œil dedans
function drawSpecs(P, dx, b, monocle) {
  const eyeYLocal = -2.6;
  const rad = 2.75;
  const ring = (ox) => {
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      const [x, y] = P(ox + Math.cos(a) * rad, eyeYLocal + Math.sin(a) * rad);
      disc(x, y, 0.42, b);
    }
  };
  ring(dx);
  if (!monocle) {
    ring(-dx);
    const p1 = P(-dx + rad - 0.3, eyeYLocal - 0.2), p2 = P(dx - rad + 0.3, eyeYLocal - 0.2);
    strokeLine(p1[0], p1[1], p2[0], p2[1], 0.36, b);
    const g1 = P(-dx - rad + 0.2, eyeYLocal - 0.4), g1b = P(-dx - rad - 2.0, eyeYLocal - 1.2);
    const g2 = P(dx + rad - 0.2, eyeYLocal - 0.4), g2b = P(dx + rad + 2.0, eyeYLocal - 1.2);
    strokeLine(g1[0], g1[1], g1b[0], g1b[1], 0.34, b);
    strokeLine(g2[0], g2[1], g2b[0], g2b[1], 0.34, b);
  } else {
    const c1 = P(dx + rad - 0.4, eyeYLocal + rad - 0.6), c2 = P(dx + rad + 0.6, eyeYLocal + 4.8);
    strokeLine(c1[0], c1[1], c2[0], c2[1], 0.3, b);
  }
}

// petit nœud papillon, bas (au "cou")
function drawBowtie(P, mouthY, b) {
  const y = mouthY + 4.7;
  for (const s of [-1, 1]) {
    for (let k = 0; k <= 1.001; k += 0.16) {
      const w = 0.25 + 1.15 * k;
      const a = P(s * (0.35 + k * 1.7), y - w), c = P(s * (0.35 + k * 1.7), y + w);
      strokeLine(a[0], a[1], c[0], c[1], 0.3, b);
    }
  }
  const nk = P(0, y); disc(nk[0], nk[1], 0.55, b);
}

// casquette hélicoptère (scène 'heli')
function drawHeliCap(cx, y, spin, fast, b) {
  // calotte
  ellipse(cx, y, 3.2, 1.9, b * 0.55);
  hole(cx, y + 1.5, 3.7);
  for (let a = Math.PI * 1.04; a <= Math.PI * 1.96; a += 0.1)
    disc(cx + Math.cos(a) * 3.0, y + Math.sin(a) * 2.0, 0.45, b);
  // tige + moyeu
  strokeLine(cx, y - 1.7, cx, y - 3.1, 0.35, b);
  disc(cx, y - 3.1, 0.45, b);
  // hélice
  const blades = fast ? 6 : 2;
  for (let i = 0; i < blades; i++) {
    const a = spin + i * Math.PI * 2 / blades;
    strokeLine(cx, y - 3.2, cx + Math.cos(a) * 3.7, y - 3.2 + Math.sin(a) * 1.2, 0.35,
               b * (fast ? 0.55 : 1));
  }
  if (fast)
    for (let a = 0; a < Math.PI * 2; a += 0.3)
      disc(cx + Math.cos(a) * 3.5, y - 3.2 + Math.sin(a) * 1.15, 0.3, b * 0.18);
}

// moustache : carrée (toothbrush) ou italienne (guidon)
function drawStache(cx, cy, mouthY, b, italian) {
  const my = cy + mouthY - 1.9;
  if (!italian) {
    for (let x = -1.4; x <= 1.4; x += 0.32)
      for (let y = -0.75; y <= 0.75; y += 0.32)
        disc(cx + x, my + y, 0.3, b);
    return;
  }
  for (const s of [-1, 1]) {
    let prev = null;
    for (let u = 0; u <= 1.0001; u += 0.09) {
      const px = cx + s * (0.4 + u * 2.5);
      const py = my + 0.3 + Math.sin(u * Math.PI) * 0.7 - u * u * 1.8;   // descend puis remonte
      const p = [px, py];
      if (prev) strokeLine(prev[0], prev[1], p[0], p[1], 0.4, b);
      prev = p;
    }
    disc(cx + s * 2.9, my - 1.5, 0.42, b);                                // boucle du bout
  }
}

// barbe + moustache qui entoure la bouche
function drawBeard(cx, cy, mouthY, b) {
  const my = cy + mouthY;
  // moustache
  for (const s of [-1, 1]) strokeLine(cx + s * 0.5, my - 1.9, cx + s * 2.9, my - 0.9, 0.42, b);
  // barbe : bande en U qui remonte sur les côtés
  for (let x = -4.4; x <= 4.4; x += 0.26) {
    const tt = x / 4.4;
    const yOut = my + 4.0 - tt * tt * 2.0;
    const yIn  = my + 0.7 - tt * tt * 2.6;
    if (yIn < yOut) strokeLine(cx + x, yIn, cx + x, yOut, 0.28, b);
  }
}

// chapeau de sorcière : large bord + cône pointu penché
function drawWitchHat(cx, brimY, b) {
  for (let x = -6.0; x <= 6.0; x += 0.35) {
    const dip = Math.abs(x) * 0.1;
    disc(cx + x, brimY + dip, 0.5, b);
  }
  const baseY = brimY - 0.6;
  const blX = cx - 2.7, brX = cx + 2.5;
  const tipX = cx + 2.4, tipY = brimY - 7.6;
  for (let s = 0; s <= 1.0001; s += 0.025) {
    const cv = Math.sin(s * Math.PI) * 0.5;               // léger galbe
    const lx = blX + (tipX - blX) * s - cv;
    const rx = brX + (tipX - brX) * s - cv * 0.4;
    const yy = baseY + (tipY - baseY) * s;
    strokeLine(lx, yy, rx, yy, 0.4, b * (0.45 + 0.55 * s));
  }
  disc(tipX, tipY, 0.55, b);
  // bandeau + boucle
  for (let x = blX + 0.3; x <= brX - 0.3; x += 0.4) disc(x + 0.2, baseY - 1.2, 0.38, b);
  disc(cx, baseY - 1.2, 0.7, b); hole(cx, baseY - 1.2, 0.3);
}

// oreilles de chat sur le haut de la tête
function drawCatEars(cx, topY, b) {
  for (const s of [-1, 1]) {
    const ex = cx + s * 3.3;
    for (let k = 0; k <= 1.0001; k += 0.07) {
      const w = 2.1 * (1 - k);
      strokeLine(ex - w, topY - k * 4.6, ex + w, topY - k * 4.6, 0.4, b);
    }
    // intérieur creusé
    hole(ex + s * 0.2, topY - 1.7, 1.0);
  }
}

// ---- accessoires -------------------------------------------------------

// chapeau haut-de-forme (scène pipe) — grand
function drawTopHat(cx, y, b, tilt = 0) {
  const co = Math.cos(tilt), si = Math.sin(tilt);
  const P = (dx, dy) => [cx + dx * co - dy * si, y + dx * si + dy * co];
  const w = 3.4, h = 6.2;
  const bl = P(-w, -0.2), br = P(w, -0.2);
  const tl = P(-w + 0.5, -h), tr = P(w - 0.5, -h);
  strokeLine(...P(-5.6, 0.2), ...P(5.6, 0.2), 0.55, b);     // bord
  strokeLine(bl[0], bl[1], tl[0], tl[1], 0.5, b);           // calotte gauche
  strokeLine(br[0], br[1], tr[0], tr[1], 0.5, b);           // droite
  strokeLine(tl[0], tl[1], tr[0], tr[1], 0.5, b);           // dessus
  strokeLine(...P(-w - 0.2, -1.5), ...P(w + 0.2, -1.5), 0.5, b * 0.6); // ruban
}

// lunettes de soleil (scène 'shades')
// g = { y, slip, fall } : slip = bascule autour de l'œil droit (le côté gauche
// tombe, encore retenu à droite) ; fall = chute complète.
function drawSunglasses(cx, cyEye, dx, b, g) {
  const ang = -(g.slip || 0) * 0.62;                  // < 0 : côté gauche vers le bas
  const fall = g.fall || 0;
  const fy = fall * fall * 32, fx = -fall * 3.5;
  const bb = b * (1 - fall * 0.5);
  const pvx = cx + dx, pvy = cyEye;                   // pivot = œil droit
  const co = Math.cos(ang), si = Math.sin(ang);
  const R = (x, y) => [
    pvx + (x - pvx) * co - (y - pvy) * si + fx,
    pvy + (x - pvx) * si + (y - pvy) * co + fy,
  ];
  // verres (anneaux épais)
  for (const lx of [cx - dx, cx + dx]) {
    const [x, y] = R(lx, cyEye);
    disc(x, y, 2.3, bb); hole(x, y, 1.5);
  }
  // pont + branches
  const p1 = R(cx - dx + 1.9, cyEye - 0.4), p2 = R(cx + dx - 1.9, cyEye - 0.4);
  strokeLine(p1[0], p1[1], p2[0], p2[1], 0.42, bb);
  const a1 = R(cx - dx - 2.1, cyEye - 0.6), a1b = R(cx - dx - 4.0, cyEye - 1.3);
  const a2 = R(cx + dx + 2.1, cyEye - 0.6), a2b = R(cx + dx + 4.0, cyEye - 1.3);
  strokeLine(a1[0], a1[1], a1b[0], a1b[1], 0.4, bb);
  strokeLine(a2[0], a2[1], a2b[0], a2b[1], 0.4, bb);
}

function drawNote(x, y, sc, b) {
  disc(x, y, 0.7 * sc, b);
  strokeLine(x + 0.7 * sc, y, x + 0.7 * sc, y - 2.4 * sc, 0.35, b);
  strokeLine(x + 0.7 * sc, y - 2.4 * sc, x + 1.7 * sc, y - 1.9 * sc, 0.35, b);
}

// --- primitives "peinture" (écrasent le pixel : permet noir sur blanc) ---
function gpx(x, y, v) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  buf[idx(x, y)] = Math.max(0, Math.min(1, v));
}
function gDisc(cx, cy, r, v) {
  for (let y = Math.round(cy - r - 1); y <= Math.round(cy + r + 1); y++)
    for (let x = Math.round(cx - r - 1); x <= Math.round(cx + r + 1); x++)
      if (Math.hypot(x - cx, y - cy) <= r + 0.4) gpx(x, y, v);
}
function gEllipse(cx, cy, rx, ry, v) {
  for (let y = Math.round(cy - ry - 1); y <= Math.round(cy + ry + 1); y++)
    for (let x = Math.round(cx - rx - 1); x <= Math.round(cx + rx + 1); x++)
      if (Math.hypot((x - cx) / rx, (y - cy) / ry) <= 1.04) gpx(x, y, v);
}
function gRing(cx, cy, rx, ry, v) {
  for (let k = 0; k < Math.PI * 2; k += 0.1)
    gpx(cx + Math.cos(k) * rx, cy + Math.sin(k) * ry, v);
}
function gSeg(x1, y1, x2, y2, w, v) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2));
  for (let i = 0; i <= n; i++) gDisc(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, w, v);
}

// platine vinyle — le perso n'apparaît pas ; le pavillon pulse au rythme
function drawGramophone(s, t) {
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2)), 0.5);
  const K = { black: 0.10, dark: 0.24, mid: 0.42, lite: 0.66, white: 1.0 };
  const cx = BX, cy = BY;

  // ===== pavillon (grand, incliné haut-gauche) — dessiné en premier (arrière) =====
  const sc = 1 + beat * 0.09;
  const throat = [cx + 3.6, cy - 3.2];
  const mc = [cx - 3.6, cy - 5.4];
  const rx = 4.7 * sc, ry = 5.3 * sc;
  gEllipse(mc[0], mc[1], rx, ry, K.mid);                    // corps
  gEllipse(mc[0] + 0.6, mc[1] + 0.4, rx * 0.66, ry * 0.66, K.dark);  // creux
  gEllipse(mc[0] + 1.4, mc[1] + 1.1, rx * 0.34, ry * 0.34, K.black); // fond
  gSeg(throat[0], throat[1], mc[0] + rx * 0.72, mc[1] + ry * 0.6, 0.5, K.lite);
  gSeg(throat[0], throat[1], mc[0] + rx * 0.1, mc[1] - ry * 0.95, 0.5, K.lite);
  gRing(mc[0], mc[1], rx, ry, K.white);                     // rebord brillant
  gRing(mc[0], mc[1], rx - 0.9, ry - 0.9, K.lite);

  // tube coudé laiton
  gSeg(throat[0], throat[1], cx + 4.4, cy - 1.4, 0.55, K.lite);
  gSeg(cx + 4.4, cy - 1.4, cx + 3.4, cy + 0.6, 0.55, K.lite);
  gDisc(cx + 3.4, cy + 0.6, 0.7, K.mid);                    // pivot

  // ===== caisse en bois (dégradé vertical) =====
  const bx0 = cx - 6.5, bx1 = cx + 6.5, by0 = cy + 2.4, by1 = cy + 8.8;
  for (let y = Math.round(by0); y <= Math.round(by1); y++) {
    const g = 1 - (y - by0) / (by1 - by0);
    for (let x = Math.round(bx0); x <= Math.round(bx1); x++)
      gpx(x, y, K.dark + (K.mid - K.dark) * g);
  }
  for (let y = Math.round(by0); y <= Math.round(by1); y++) { gpx(bx0, y, K.black); gpx(bx1, y, K.black); }
  for (let x = Math.round(bx0); x <= Math.round(bx1); x++) { gpx(x, by0, K.lite); gpx(x, by1, K.black); }
  for (let x = Math.round(bx0 + 1.5); x <= Math.round(bx1 - 1.5); x++) gpx(x, by0 + 3.4, K.black); // tiroir
  gDisc(cx + 2.6, by0 + 5.6, 0.55, K.lite);                 // bouton

  // ===== plateau + disque =====
  const py = by0 - 0.3;
  gEllipse(cx - 0.4, py, 5.7, 1.9, K.lite);                 // plateau
  gEllipse(cx - 0.4, py, 4.7, 1.5, K.black);                // vinyle
  for (let rr = 4.0; rr >= 1.9; rr -= 1.0) gRing(cx - 0.4, py, rr, rr * 0.32, K.dark); // sillons
  gEllipse(cx - 0.4, py, 1.0, 0.5, K.lite);                 // étiquette
  const a = t * 5;
  gDisc(cx - 0.4 + Math.cos(a) * 3.3, py + Math.sin(a) * 1.05, 0.4, K.white); // repère

  // ===== bras de lecture =====
  gSeg(cx + 5.4, py - 2.8, cx + 0.4, py, 0.4, K.lite);
  gDisc(cx + 5.6, py - 3.0, 0.7, K.mid);
  gDisc(cx + 0.2, py + 0.4, 0.5, K.lite);

  // ===== notes =====
  for (let i = 0; i < 4; i++) {
    const pp = ((t * 0.5) + i / 4) % 1;
    const nx = mc[0] - 1 - pp * 4 + Math.sin(pp * 5 + i) * 1.4;
    const ny = mc[1] - 2 - pp * 11;
    if (ny > -3) drawNote(nx, ny, 0.9 - pp * 0.3, (1 - pp) * 0.95);
  }
}

// logo Discord (émote de notif) — corps arrondi + yeux en pilule + bosses/pieds
function drawDiscord(cx, cy, k, b, t) {
  if (k <= 0.02) return;
  const w = 6.6 * k, h = 5.4 * k;
  ellipse(cx, cy + 0.3, w, h, b * 0.95);
  for (const s of [-1, 1]) disc(cx + s * w * 0.55, cy - h * 0.75, 1.15 * k, b * 0.9); // "cornes"
  for (const o of [-1, 0, 1]) disc(cx + o * w * 0.48, cy + h * 0.78, 1.0 * k, b * 0.9); // pieds
  // yeux : pilules verticales (trous), regard qui glisse
  const gaze = Math.sin(t * 1.6) * 0.7 * k;
  for (const s of [-1, 1]) {
    const ex = cx + s * 2.2 * k + gaze;
    for (let i = -1.1; i <= 1.1; i += 0.4) hole(ex, cy - 0.2 * k + i * k, 0.9 * k);
  }
}

function drawPipe(mx, my, b, t) {
  const ex = mx + 3.2, ey = my + 2.2;
  strokeLine(mx, my, ex, ey, 0.5, b);                        // tuyau
  disc(ex + 0.8, ey - 0.2, 1.15, b); hole(ex + 0.8, ey - 0.2, 0.5);   // fourneau
  // fumée : profondeur = de plus en plus pâle en montant
  for (let i = 0; i < 4; i++) {
    const pp = ((t * 0.45) + i / 4) % 1;
    const sx = ex + 0.8 + Math.sin(pp * 6 + i * 1.7) * 1.6;
    const sy = ey - 0.6 - pp * 10;
    disc(sx, sy, 0.6 + pp * 1.0, b * 0.32 * (1 - pp));
  }
}

// ---- effondrement (les traits tombent avec la gravité) ---------------

let collapseSim = null;
function drawCollapse(s, t, carve) {
  const b = Math.max(0.6 + 0.4 * s.energy, 0.9);
  const g = 46, floorMargin = 1.3;
  const targets = [
    [CENTER - 4.2, CENTER - 2.6], [CENTER + 4.2, CENTER - 2.6], [CENTER, CENTER + 4.4],
  ];

  if (!collapseSim || collapseSim.key !== s.collapseStart) {
    collapseSim = {
      key: s.collapseStart, tPrev: t,
      parts: targets.map((p, i) => ({
        x: p[0], y: p[1],
        vx: rnd(-3, 3), vy: rnd(-5, -1.5),
        r: i < 2 ? 1.35 : 1.8, kind: i < 2 ? 'eye' : 'mouth',
      })),
    };
  }
  const sim = collapseSim;
  const dt = Math.min(0.05, Math.max(0, t - sim.tPrev));
  sim.tPrev = t;

  if (s.phase < 0.76) {
    for (const p of sim.parts) {
      p.vy += g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const dx = p.x - CENTER;
      const inR = Math.sqrt(Math.max(0, (R - floorMargin) ** 2 - dx * dx));
      const floorY = CENTER + inR;
      if (p.y > floorY - p.r) {
        p.y = floorY - p.r; p.vy *= -0.3; p.vx *= 0.62;
        if (Math.abs(p.vy) < 3.5) p.vy = 0;
      }
      if (Math.abs(dx) > R - 1.6) { p.x = CENTER + Math.sign(dx) * (R - 1.6); p.vx *= -0.4; }
    }
  } else {
    const k = (s.phase - 0.76) / 0.24;
    sim.parts.forEach((p, i) => {
      p.x += (targets[i][0] - p.x) * (0.2 + k * 0.55);
      p.y += (targets[i][1] - p.y) * (0.2 + k * 0.55);
    });
  }

  if (carve) ellipse(CENTER, CENTER, 8.6, 8.0, 0.85 * b);      // corps figé en mode "corps"
  for (const p of sim.parts) {
    if (p.kind === 'eye') { disc(p.x, p.y, p.r, b); }
    else strokeLine(p.x - 1.7, p.y, p.x + 1.7, p.y, 0.5, b);
  }
  if (s.phase < 0.28) {                                        // "!" de surprise
    strokeLine(CENTER, CENTER - 4, CENTER, CENTER - 2, 0.5, b);
    disc(CENTER, CENTER - 1, 0.5, b);
  }
}

// Style "kawaii" : traits fins, yeux et bouche petits.
// carve = true → creusé en négatif dans le corps ; false → dessiné en blanc.
// k = échelle des traits (1 en mode corps, ~1.5 en mode visage).
function drawEye(x, y, style, open, side, t, bright, carve = true, k = 1, lashesOn = false) {
  const fill = carve ? (dx, dy, r) => hole(x + dx*k, y + dy*k, r*k)
                     : (dx, dy, r) => disc(x + dx*k, y + dy*k, r*k, bright);
  const cut  = carve ? (dx, dy, r) => disc(x + dx*k, y + dy*k, r*k, bright)   // "creuse" = éclaire dans le trou
                     : (dx, dy, r) => hole(x + dx*k, y + dy*k, r*k);
  const seg  = carve ? (ax, ay, bx, by, w) => holeLine(x+ax*k, y+ay*k, x+bx*k, y+by*k, w*k)
                     : (ax, ay, bx, by, w) => strokeLine(x+ax*k, y+ay*k, x+bx*k, y+by*k, w*k + 0.05, bright);
  // arc courbe : sign=+1 → ∩ (yeux rieurs), sign=-1 → ‿ (yeux doux/endormis)
  const arc = (sign, hw = 1.35, amp = 1.15, w = 0.4) => {
    let prev = null;
    for (let i = -hw; i <= hw + 1e-6; i += hw / 4) {
      const p = [i, sign * amp * ((i / hw) * (i / hw) - 0.5)];
      if (prev) seg(prev[0], prev[1], p[0], p[1], w);
      prev = p;
    }
  };
  // cils (cosmétique) : deux traits au coin haut-externe de l'œil
  const lashes = () => {
    if (!lashesOn) return;
    const o = side;
    seg(o * 0.5, -1.0, o * 1.9, -2.1, 0.22);
    seg(o * 1.0, -0.7, o * 2.3, -1.5, 0.22);
  };

  switch (style) {
    case 'dot':                                   // œil ouvert : petit disque plein
      if (open > 0.35) { fill(0, 0, 1.05); lashes(); }
      else seg(-1.1, 0, 1.1, 0, 0.38);
      break;
    case 'ring':                                  // cercle creux (sceptique / surpris)
      fill(0, 0, 1.3); cut(0, 0, 0.78); lashes();
      break;
    case 'wide':                                  // grand cercle + pupille (panique / notif)
      fill(0, 0, 1.6); cut(0, 0, 0.78); lashes();
      break;
    case 'sparkle': {                             // œil brillant kawaii
      fill(0, 0, 1.25);
      cut(-0.4, -0.4, 0.34);
      lashes();
      break;
    }
    case 'heart': {                               // yeux en cœur (gros)
      fill(-0.62, -0.28, 0.72);
      fill(0.62, -0.28, 0.72);
      for (let s = 0; s <= 1; s += 0.14) fill(0, s * 1.5, 0.85 * (1 - s) + 0.12);
      break;
    }
    case 'arc':   arc(+1); break;                 // ∩  rieur
    case 'calm':  arc(-1); break;                 // ‿  doux / endormi léger
    case 'wink':  side < 0 ? arc(+1) : (fill(0, 0, 1.4), cut(0, 0, 0.62)); break;
    case 'sleep':  seg(-1.15, 0, 1.15, 0, 0.42); break;
    case 'squint': seg(-1.0, 0, 1.0, 0, 0.4); break;
    case 'half':
      seg(-1.2, -0.2, 1.2, -0.2, 0.4);
      if (open > 0.4) cut(0, 0.55, 0.5);
      break;
    case 'angry':
      seg(-side * 1.0, -0.7, side * 0.9, 0.35, 0.42);
      fill(side * 0.15, 0.55, 0.45);
      break;
    case 'spiral': {
      const ph = t * 7 + side * 3;
      for (let a = 0; a < Math.PI * 2.6; a += 0.45) {
        const rr = 0.1 + a * 0.17;
        fill(Math.cos(a + ph) * rr, Math.sin(a + ph) * rr, 0.34);
      }
      break;
    }
  }
}

function drawMouth(x, y, kind, t, bright = 1, carve = true, k = 1, beat = 0) {
  const seg = carve ? (ax, ay, bx, by, w) => holeLine(x+ax*k, y+ay*k, x+bx*k, y+by*k, w*k)
                    : (ax, ay, bx, by, w) => strokeLine(x+ax*k, y+ay*k, x+bx*k, y+by*k, w*k + 0.05, bright);
  // arc de bouche : curv > 0 = sourire (creux au centre, coins relevés)
  const curve = (halfW, curv, w = 0.4) => {
    let prev = null;
    for (let i = -halfW; i <= halfW + 1e-6; i += halfW / 4) {
      const p = [i, -0.15 + curv * (1 - (i / halfW) * (i / halfW))];
      if (prev) seg(prev[0], prev[1], p[0], p[1], w);
      prev = p;
    }
  };
  switch (kind) {
    case 'smile': curve(1.5, 0.75); break;
    case 'grin':  curve(1.9, 1.25, 0.45); break;
    case 'cat':                                   // ω : deux petites cuvettes
      for (const s of [-1, 1]) {
        let prev = null;
        for (let i = -0.85; i <= 0.85 + 1e-6; i += 0.425) {
          const p = [s * 0.85 + i, 0.1 + 0.55 * (1 - (i / 0.85) * (i / 0.85))];
          if (prev) seg(prev[0], prev[1], p[0], p[1], 0.4);
          prev = p;
        }
      }
      break;
    case 'o':
      if (carve) hole(x, y * 1 + 0.1 * k, 0.85 * k);
      else { disc(x, y + 0.1 * k, 0.85 * k, bright); hole(x, y + 0.1 * k, 0.4 * k); }
      break;
    case 'line': seg(-1.0, 0, 1.0, 0, 0.4); break;
    case 'pacifier': {                            // tétine (cosmétique)
      disc(x, y * 1, 0.9 * k, bright); hole(x, y, 0.45 * k);         // téterelle
      seg(-1.9, 0.1, 1.9, 0.1, 0.5);                                 // collerette
      disc(x, y + 2.6 * k, 0.95 * k, bright); hole(x, y + 2.6 * k, 0.55 * k); // anneau
      break;
    }
    case 'wave': {                                // waveform horizontale (musique)
      const amp = 0.35 + beat * 1.7;
      const half = 2.4;
      let prev = null;
      for (let i = -half; i <= half + 1e-6; i += half / 7) {
        const env = Math.cos((i / half) * Math.PI / 2);        // bords qui s'éteignent
        const p = [i, Math.sin(i * 2.6 + t * 16) * amp * env];
        if (prev) seg(prev[0], prev[1], p[0], p[1], 0.32);
        prev = p;
      }
      break;
    }
    case 'flat': {                                // ~ légère ondulation (sceptique)
      const w = 0.28;
      seg(-1.3, w, -0.1, -w, 0.4);
      seg(-0.1, -w, 1.1, w, 0.4);
      break;
    }
    case 'wobble': {
      const w = wave(t, 5) * 0.5;
      seg(-1.4, -w, 0, w, 0.42);
      seg(0, w, 1.4, -w, 0.42);
      break;
    }
  }
}

function drawExtra(e, cx, cy, bw, bh, t, b, rot) {
  switch (e.kind) {
    case 'z': {
      const s = e.s;
      line(e.x-0.8*s, e.y-0.8*s, e.x+0.8*s, e.y-0.8*s, b);
      line(e.x+0.8*s, e.y-0.8*s, e.x-0.8*s, e.y+0.8*s, b);
      line(e.x-0.8*s, e.y+0.8*s, e.x+0.8*s, e.y+0.8*s, b);
      break;
    }
    case 'hand': {
      const [hx, hy] = rot(bw * 0.95, e.y ?? -1);
      disc(hx, hy, 1.4, b); break;
    }
    case 'stars':
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * 2.1;
        disc(cx + Math.cos(a) * (bw + 1.8), cy - bh + Math.sin(a) * 2.5, 0.6, b);
      }
      break;
    case 'hands-ears':
      disc(cx - bw - 0.3, cy - 0.5, 1.8, b * 0.9);
      disc(cx + bw + 0.3, cy - 0.5, 1.8, b * 0.9);
      break;
    case 'excl':
      line(cx, cy - bh - 4.0, cx, cy - bh - 2.0, b);
      disc(cx, cy - bh - 1.1, 0.6, b);
      break;
    case 'armsup': {
      const w = wave(t, 8);
      line(cx - bw*0.8, cy, cx - bw*1.3, cy - 2.5 + w, b);
      line(cx + bw*0.8, cy, cx + bw*1.3, cy - 2.5 - w, b);
      break;
    }
    case 'note':
      disc(e.x, e.y, 0.7, b);
      line(e.x + 0.6, e.y, e.x + 0.6, e.y - 2, b);
      line(e.x + 0.6, e.y - 2, e.x + 1.5, e.y - 1.6, b);
      break;
    case 'heart':
      disc(e.x - 0.7, e.y, 0.8, b);
      disc(e.x + 0.7, e.y, 0.8, b);
      disc(e.x, e.y + 0.9, 1.1, b);
      break;
    case 'steam':
      for (const s of [-1, 1]) {
        const pp = ((t * 0.9) + (s > 0 ? 0.5 : 0)) % 1;
        disc(cx + s * (bw + 1), cy - bh + 1 - pp * 4, 0.5 + pp * 0.4, b * 0.45 * (1 - pp));
      }
      break;
    case 'lowbatt': {
      const yb = cy - bh - 2.6;
      strokeLine(cx - 2, yb - 1, cx + 2, yb - 1, 0.3, b);
      strokeLine(cx - 2, yb + 1, cx + 2, yb + 1, 0.3, b);
      strokeLine(cx - 2, yb - 1, cx - 2, yb + 1, 0.3, b);
      strokeLine(cx + 2, yb - 1, cx + 2, yb + 1, 0.3, b);
      disc(cx + 2.7, yb, 0.35, b);            // borne
      disc(cx - 1.1, yb, 0.4, b);             // un seul "trait" de charge
      break;
    }
    case 'chev': {                            // chevrons (dir -1 : monte, +1 : baisse)
      const d = e.dir || 1, o = e.off || 0;
      const y0 = d < 0 ? cy - bh - 1.6 - o : cy + bh + 1.6 + o;
      strokeLine(cx - 1.5, y0 + d * 1.1, cx, y0, 0.38, b);
      strokeLine(cx, y0, cx + 1.5, y0 + d * 1.1, 0.38, b);
      break;
    }
    case 'muteX': {                           // gros × sur les oreilles bouchées
      strokeLine(cx - bw - 1.6, cy - 1.8, cx - bw + 1.0, cy + 0.8, 0.4, b);
      strokeLine(cx - bw + 1.0, cy - 1.8, cx - bw - 1.6, cy + 0.8, 0.4, b);
      strokeLine(cx + bw - 1.0, cy - 1.8, cx + bw + 1.6, cy + 0.8, 0.4, b);
      strokeLine(cx + bw + 1.6, cy - 1.8, cx + bw - 1.0, cy + 0.8, 0.4, b);
      break;
    }
    case 'loaddots': {                        // points de chargement à hauteur de bouche (Claude réfléchit)
      for (let i = 0; i < e.n; i++)
        disc(cx - 2.0 + i * 2.0, cy + 2.6, 0.55, b);
      break;
    }
    case 'page': {                            // 2 "lignes de texte" discrètes devant soi (Claude lit)
      const y0 = cy + bh - 1.0;
      for (let i = 0; i < 2; i++) {
        const yy = y0 + i * 2.0;
        strokeLine(cx - 2.6, yy, cx - 0.4, yy, 0.22, b * 0.4);
        strokeLine(cx + 0.4, yy, cx + 2.2, yy, 0.22, b * 0.4);
      }
      break;
    }
    case 'notifpile': {                       // petits badges qui s'empilent au-dessus (Discord débordé)
      for (let i = 0; i < 5; i++) {
        const a = (e.t || t) * 0.8 + i * 1.4;
        const px = cx - 3.5 + i * 1.8 + Math.sin(a) * 0.5;
        const py = cy - bh - 1.5 - Math.abs(Math.cos(a)) * 1.6 - i * 0.2;
        disc(px, py, 0.65, b);
        hole(px, py, 0.28);
      }
      break;
    }
    case 'sweat': {                           // goutte de sueur (débordé)
      const p = ((e.t || t) * 0.8) % 1;
      disc(cx + bw + 0.6, cy - bh + 1 + p * 4, 0.45 + p * 0.25, b * 0.6 * (1 - p));
      break;
    }
    case 'headset': {                         // casque audio (Discord vocal)
      const y = cy - bh * 0.15;                // à hauteur d'oreille
      strokeLine(cx - bw - 0.6, y, cx, cy - bh - 1.6, 0.35, b);
      strokeLine(cx, cy - bh - 1.6, cx + bw + 0.6, y, 0.35, b);
      disc(cx - bw - 0.9, y + 0.6, 1.2, b);
      disc(cx + bw + 0.9, y + 0.6, 1.2, b);
      strokeLine(cx + bw + 0.9, y + 1.6, cx + bw - 0.6, cy + 1.8, 0.3, b);  // tige micro
      break;
    }
    case 'ringwaves': {                       // ondes sonores de part et d'autre (ça sonne)
      const k = 0.6 + Math.abs(e.s || 0) * 0.8;
      for (const d of [-1, 1]) {
        for (let i = 1; i <= 3; i++) {
          const r = i * 1.5 * k, xx = cx + d * (bw + 0.5), yy = cy - bh * 0.15;
          strokeLine(xx + d * r, yy - r * 0.8, xx + d * r, yy + r * 0.8, 0.28, b * (1 - i * 0.22));
        }
      }
      break;
    }
    case 'bubble': {                          // bulle de dialogue (appel DM)
      const d = e.side || 1, x = cx + d * (bw + 2.2), y = cy - bh * 0.2;
      strokeLine(x - 1.4, y - 1.0, x + 1.4, y - 1.0, 0.28, b);
      strokeLine(x - 1.4, y + 1.0, x + 1.4, y + 1.0, 0.28, b);
      strokeLine(x - 1.4, y - 1.0, x - 1.4, y + 1.0, 0.28, b);
      strokeLine(x + 1.4, y - 1.0, x + 1.4, y + 1.0, 0.28, b);
      disc(x - 0.6, y, 0.22, b); disc(x, y, 0.22, b); disc(x + 0.6, y, 0.22, b);
      break;
    }
    case 'grouphead': {                       // 2 petites "têtes" (autres membres du salon)
      for (let i = 0; i < 2; i++) {
        const px = cx + (i ? bw + 2.4 : -bw - 2.4), py = cy + bh - 1 + Math.sin((e.t || t) * 3 + i) * 0.5;
        disc(px, py, 1.0, b * 0.7); hole(px, py + 0.3, 0.5);
      }
      break;
    }
    case 'popcorn': {                         // pot de popcorn (YouTube : il regarde)
      const px = cx + bw + 1.2, py = cy + bh - 1.5;
      strokeLine(px - 1.6, py + 2.2, px + 1.6, py + 2.2, 0.3, b);      // fond
      strokeLine(px - 1.6, py + 2.2, px - 2.0, py - 1.0, 0.3, b);      // paroi G
      strokeLine(px + 1.6, py + 2.2, px + 2.0, py - 1.0, 0.3, b);      // paroi D
      for (let i = 0; i < 3; i++) {
        const a = (e.t || t) * 3 + i * 2;
        disc(px + Math.sin(a) * 1.4, py - 1.6 - Math.abs(Math.cos(a)) * 1.2, 0.45, b);
      }
      break;
    }
    case 'screenglow': {                      // lueur d'écran qui remonte sur le bas du visage
      const fl = 0.3 + 0.25 * Math.abs(Math.sin((e.t || t) * 5.5));
      for (let i = -3; i <= 3; i++)
        disc(cx + i * 1.5, cy + bh + 1.2, 0.35, b * fl * (1 - Math.abs(i) / 5));
      break;
    }
    case 'sketch': {                          // traits de crayon rapides + langue (Affinity base)
      const p = e.ph ?? t;
      for (let i = 0; i < 4; i++) {
        const a = p * 6 + i * 1.7, x0 = cx - 3 + (i % 2) * 5;
        strokeLine(x0, cy + bh + 1 + i * 0.9, x0 + Math.cos(a) * 2.4, cy + bh + 1 + i * 0.9 + Math.sin(a) * 0.8,
                   0.22, b * 0.4);
      }
      // pointe du crayon qui griffonne
      const hx = cx + bw + 0.5 + Math.sin(p * 9) * 1.2, hy = cy + bh - 1 + Math.cos(p * 9) * 1.0;
      disc(hx, hy, 0.4, b);
      strokeLine(hx + 0.4, hy - 0.6, hx + 2.6, hy - 3.4, 0.4, b);
      break;
    }
    case 'bezier': {                          // tracé plume : nœuds + poignées (Affinity plume)
      const p = e.ph ?? t, y0 = cy + bh - 0.5;
      const nodes = [[cx - 3, y0 + 1], [cx - 0.8, y0 - 1.6], [cx + 1.6, y0 + 1.2], [cx + 3.4, y0 - 0.8]];
      const cur = Math.floor(p / 0.8) % 4;
      for (let i = 0; i < 4; i++) {
        if (i > cur) break;
        const [nx, ny] = nodes[i];
        if (i < cur) { strokeLine(...nodes[i - 1 < 0 ? 0 : i - 1], nx, ny, 0.26, b * 0.7); }
        // nœud carré
        disc(nx, ny, i === cur ? 0.5 : 0.32, b);
        if (i === cur) {                        // poignées de courbe
          strokeLine(nx - 1.6, ny - 0.6, nx + 1.6, ny + 0.6, 0.2, b * 0.6);
          disc(nx - 1.6, ny - 0.6, 0.22, b * 0.6); disc(nx + 1.6, ny + 0.6, 0.22, b * 0.6);
        }
      }
      break;
    }
    case 'swatches': {                        // nuancier qui défile (Affinity couleur)
      const p = e.ph ?? t, off = (p * 3) % 1;
      for (let i = -2; i <= 3; i++) {
        const yy = cy + bh + 0.5, xx = cx - 4 + (i + off) * 2.2;
        if (xx < cx - 5 || xx > cx + 5) continue;
        const sel = Math.abs(xx - cx) < 1.1;
        disc(xx, yy, sel ? 0.75 : 0.5, b * (sel ? 1 : 0.45));
        if (sel) { strokeLine(xx - 1, yy - 1, xx + 1, yy - 1, 0.18, b); }  // liseré "sélection"
      }
      break;
    }
    case 'bigeye': {                          // un seul œil géant + main fine (Affinity zoom)
      const p = e.ph ?? t;
      disc(cx, cy - 1, 4.6, b * 0.16);                          // globe
      disc(cx + Math.sin(p * 0.8) * 0.5, cy - 1 + Math.cos(p * 0.8) * 0.4, 1.7, b);  // pupille
      hole(cx + Math.sin(p * 0.8) * 0.5 + 0.6, cy - 1.6, 0.6);  // reflet
      const hx = cx + 3 + Math.sin(p * 14) * 0.3;
      strokeLine(hx, cy + bh - 1, hx + 1.6, cy + bh + 2.5, 0.3, b);   // stylet précis
      break;
    }
    case 'crumb': {                           // miettes qui sautent quand il mange
      const p = e.t || t;
      for (let i = 0; i < 3; i++) {
        const a = p * 11 + i * 2.1;
        disc(cx + Math.cos(a) * (bw * 0.7), cy + 1.5 + Math.abs(Math.sin(a)) * -2, 0.32, b * 0.7);
      }
      break;
    }
    case 'pat': {                             // une main qui le caresse sur la tête
      const p = e.t || t;
      const y = cy - bh - 1.4 + Math.abs(Math.sin(p * 7)) * 1.8;
      disc(cx, y + 1.0, 1.4, b);                                    // paume
      for (let i = -1; i <= 1; i++) disc(cx + i * 1.15, y - 0.5, 0.5, b);   // doigts
      break;
    }
    case 'whirl': {                           // traînée de vitesse autour du perso (pirouette)
      const p = e.t || t;
      for (let i = 0; i < 6; i++) {
        const a = -p * 13 - i * 0.42;
        strokeLine(cx + Math.cos(a) * (bw + 1.2), cy + Math.sin(a) * (bh + 1.2),
                   cx + Math.cos(a + 0.5) * (bw + 1.2), cy + Math.sin(a + 0.5) * (bh + 1.2),
                   0.32, b * (0.55 - i * 0.08));
      }
      break;
    }
    case 'burp': {                            // petit nuage de rot
      const p = ((e.t || t) * 1.4) % 1;
      disc(cx + bw * 0.6, cy - bh + 0.5 - p * 3, 0.5 + p * 0.4, b * 0.4 * (1 - p));
      break;
    }
    case 'bonebit': {                         // l'os tenu dans la gueule (émote 🦴)
      const p = e.t || t;
      const y = cy + 2.4, x = cx + Math.sin(p * 16) * 0.7;
      disc(x - 1.6, y - 0.5, 0.5, b); disc(x - 1.6, y + 0.5, 0.5, b);   // bout gauche
      strokeLine(x - 1.4, y, x + 1.4, y, 0.5, b);                       // tige
      disc(x + 1.6, y - 0.5, 0.5, b); disc(x + 1.6, y + 0.5, 0.5, b);   // bout droit
      break;
    }
    case 'crunchmark': {                      // éclats nets quand il croque (🥕)
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + (e.t || t) * 3;
        strokeLine(cx, cy + 2.4, cx + Math.cos(a) * 2.6, cy + 2.4 + Math.sin(a) * 2.0, 0.24, b * 0.7);
      }
      break;
    }
    case 'bolt': {                            // éclair de recharge (🔋)
      const p = e.t || t, s = (p * 3) % 1;
      const x = cx + bw + 1.4, y0 = cy - bh - 1;
      strokeLine(x, y0, x - 1.1, y0 + 2.2, 0.3, b);
      strokeLine(x - 1.1, y0 + 2.2, x + 0.6, y0 + 2.4, 0.3, b);
      strokeLine(x + 0.6, y0 + 2.4, x - 0.5, y0 + 5.0, 0.3, b);
      disc(x - 0.5 + Math.sin(s * 6) * 0.4, y0 + 5.0, 0.3, b * (1 - s));
      break;
    }
    case 'chargebar': {                       // jauge de batterie qui se remplit (🔋)
      const p = e.p ?? 0;
      const x0 = cx - 3.4, w = 6.8, yy = cy + bh + 2.6;
      strokeLine(x0, yy - 1, x0 + w, yy - 1, 0.2, b * 0.4);
      strokeLine(x0, yy + 1, x0 + w, yy + 1, 0.2, b * 0.4);
      strokeLine(x0, yy - 1, x0, yy + 1, 0.2, b * 0.4);
      strokeLine(x0 + w, yy - 1, x0 + w, yy + 1, 0.2, b * 0.4);
      disc(x0 + w + 0.7, yy, 0.35, b * 0.5);                            // borne +
      for (let i = 0; i < 4; i++)
        if (i / 4 < p) disc(x0 + 0.9 + i * 1.6, yy, 0.5, b);
      break;
    }
    case 'caret': {                           // curseur texte qui clignote (VS Code)
      if (((e.t || t) % 1) < 0.55) strokeLine(cx + 2.6, cy + 1.4, cx + 2.6, cy + 3.4, 0.3, b);
      break;
    }
    case 'menu': {                            // liste d'autocomplétion qui déroule (VS Code)
      const p = e.ph ?? t;
      const x0 = cx - 1.5, y0 = cy + bh + 0.5;
      const sel = Math.floor(p * 2) % 4;
      for (let i = 0; i < 4; i++) {
        const yy = y0 + i * 1.5;
        if (i === sel) strokeLine(x0 - 0.5, yy, x0 + 4.5, yy, 0.55, b * 0.5);   // surbrillance
        strokeLine(x0, yy, x0 + 2 + (i % 2) * 1.6, yy, 0.24, b * (i === sel ? 1 : 0.55));
        disc(x0 - 1.2, yy, 0.3, b * 0.7);                                        // icône
      }
      break;
    }
    case 'squiggle': {                        // soulignement ondulé rouge sous une "ligne" (VS Code)
      const y0 = cy + bh + 1.4;
      let prev = null;
      for (let i = -3; i <= 3; i += 0.5) {
        const p = [cx + i, y0 + Math.sin(i * 3 + t * 6) * 0.4];
        if (prev) strokeLine(prev[0], prev[1], p[0], p[1], 0.3, b * (e.bad ? 1 : 0.4));
        prev = p;
      }
      break;
    }
    case 'bp': {                              // point d'arrêt + flèche d'exécution (VS Code debug)
      const y0 = cy + bh + 1.2;
      disc(cx - 3.4, y0, 0.6, b);                                     // breakpoint
      const ax = cx - 1.6 + Math.sin((e.t || t) * 3) * 0.3;           // flèche "ligne courante"
      strokeLine(ax, y0, ax + 1.4, y0, 0.3, b);
      strokeLine(ax + 0.6, y0 - 0.7, ax + 1.4, y0, 0.3, b);
      strokeLine(ax + 0.6, y0 + 0.7, ax + 1.4, y0, 0.3, b);
      break;
    }
    case 'check': {                           // coche verte "sauvegardé / résolu" (VS Code)
      const p = Math.min(1, ((e.t || t) % 1.6) / 0.4);
      const x0 = cx - 1.4, y0 = cy - bh - 2.0;
      strokeLine(x0, y0, x0 + 1.0 * Math.min(p, 0.5) * 2, y0 + 1.4 * Math.min(p, 0.5) * 2, 0.4, b);
      if (p > 0.5) strokeLine(x0 + 1.0, y0 + 1.4, x0 + 1.0 + 2.4 * (p - 0.5) * 2, y0 + 1.4 - 3.0 * (p - 0.5) * 2, 0.4, b);
      break;
    }
    case 'tiles': {                           // vignettes de templates (Canva)
      const p = e.ph ?? t, sc = e.big ? 1.5 : 1;
      const y0 = cy + bh + 1.2;
      for (let i = 0; i < 3; i++) {
        const x = cx - 4 + i * 3.4, jig = Math.sin(p * 3 + i * 2) * 0.3;
        const w = 2.2 * sc, h = 1.6 * sc;
        strokeLine(x, y0 + jig, x + w, y0 + jig, 0.24, b * 0.6);
        strokeLine(x, y0 + jig + h, x + w, y0 + jig + h, 0.24, b * 0.6);
        strokeLine(x, y0 + jig, x, y0 + jig + h, 0.24, b * 0.6);
        strokeLine(x + w, y0 + jig, x + w, y0 + jig + h, 0.24, b * 0.6);
        if ((Math.floor(p * 2) + i) % 3 === 0) disc(x + w / 2, y0 + jig + h / 2, 0.4, b);
      }
      break;
    }
    case 'snapguide': {                       // repères magnétiques + élément qui claque (Canva)
      const p = e.p ?? 0;
      const gx = cx + (p - 0.5) * 5;
      strokeLine(gx, cy - bh - 1, gx, cy + bh + 3, 0.18, b * (p > 0.82 ? 0.9 : 0.3));  // guide vertical
      strokeLine(cx - 5, cy + bh + 1, cx + 5, cy + bh + 1, 0.18, b * 0.25);            // guide horizontal
      disc(gx, cy + bh + 1, 0.7, b);                                                   // l'élément
      if (p > 0.82) for (let i = 0; i < 4; i++) {                                      // "clac"
        const a = i * 1.6; strokeLine(gx, cy + bh + 1, gx + Math.cos(a) * 1.6, cy + bh + 1 + Math.sin(a) * 1.6, 0.2, b * 0.6);
      }
      break;
    }
    case 'popswatch': {                       // nuancier multicolore rapide (Canva) — points serrés
      const p = e.ph ?? t, off = (p * 5) % 1;
      for (let i = -2; i <= 4; i++) {
        const x = cx - 4.5 + (i + off) * 1.7, y = cy + bh + 1.6;
        if (x < cx - 5.2 || x > cx + 5.2) continue;
        const sel = Math.abs(x - cx) < 0.9;
        disc(x, y, sel ? 0.8 : 0.55, b * (sel ? 1 : 0.5));
      }
      break;
    }
    case 'commitline': {                      // graphe de commits qui défile (Git)
      const p = e.ph ?? t;
      const x0 = cx - 3.4, sc = (p * 1.6) % 2.4;
      strokeLine(x0, cy - bh - 1, x0, cy + bh + 3, 0.22, b * 0.4);   // la branche principale
      for (let i = -1; i < 5; i++) {
        const y = cy + bh + 2 - i * 2.4 - sc;
        if (y < cy - bh - 1 || y > cy + bh + 3) continue;
        disc(x0, y, 0.55, b);                                        // un commit
        if (e.fork && i === 2) {                                     // une bifurcation
          strokeLine(x0, y, x0 + 2.4, y - 1.4, 0.2, b * 0.7);
          disc(x0 + 2.4, y - 1.4, 0.45, b * 0.8);
        }
      }
      break;
    }
    case 'difflines': {                       // diff : lignes ajoutées / retirées (Git)
      const p = e.ph ?? t, y0 = cy + bh + 0.6;
      const kinds = [1, -1, 1, 1, -1];
      for (let i = 0; i < 5; i++) {
        const yy = y0 + i * 1.35, sign = kinds[i];
        disc(cx - 4.6, yy, 0.28, b * (sign > 0 ? 1 : 0.45));         // + plein / − discret
        if (sign > 0) strokeLine(cx - 4.9, yy, cx - 4.3, yy, 0.2, b);
        strokeLine(cx - 3.8, yy, cx - 3.8 + (2.5 + (i % 2) * 1.5), yy, 0.24, b * (sign > 0 ? 0.7 : 0.35));
      }
      break;
    }
    case 'pusharrow': {                       // flèche de push vers le haut (Git)
      const p = e.p ?? 0;
      const y = cy - bh - 1 - p * 4, a = b * (1 - p * 0.7);
      strokeLine(cx, y + 3, cx, y, 0.34, a);
      strokeLine(cx, y, cx - 1.2, y + 1.4, 0.34, a);
      strokeLine(cx, y, cx + 1.2, y + 1.4, 0.34, a);
      break;
    }
    case 'answerlines': {                     // réponse qui se "streame" ligne par ligne (ChatGPT)
      const p = e.ph ?? t, y0 = cy + bh + 0.8, prog = (p % 3) / 3;
      let li = 0, lw = 0;
      for (let i = 0; i < 3; i++) {
        const full = Math.max(0, Math.min(1, prog * 3 - i));
        if (full <= 0) break;
        const wid = (i === 2 ? 3.2 : 4.4) * full;
        strokeLine(cx - 4.4, y0 + i * 1.7, cx - 4.4 + wid, y0 + i * 1.7, 0.28, b * 0.55);
        li = i; lw = wid;
      }
      if ((p * 3 % 1) < 0.5)                                          // curseur au bout
        strokeLine(cx - 4.4 + lw + 0.35, y0 + li * 1.7 - 0.7, cx - 4.4 + lw + 0.35, y0 + li * 1.7 + 0.7, 0.3, b);
      break;
    }
    case 'listbullets': {                     // liste à puces qui apparaît (ChatGPT)
      const p = e.ph ?? t, y0 = cy + bh + 0.8, n = 1 + Math.floor((p % 3) / 0.7);
      for (let i = 0; i < Math.min(4, n); i++) {
        const yy = y0 + i * 1.6;
        disc(cx - 4.2, yy, 0.32, b);
        strokeLine(cx - 3.3, yy, cx - 3.3 + (i % 2 ? 3.0 : 4.0), yy, 0.26, b * 0.55);
      }
      break;
    }
    case 'twinkle': {                          // gerbe d'étincelles autour de lui (Gemini)
      const p = e.ph ?? t;
      for (let i = 0; i < 5; i++) {
        const a = p * 2 + i * 1.7, r = (bw + 1) + ((p * 3 + i) % 2) * 1.6;
        const x = cx + Math.cos(a) * r, y = cy - bh * 0.4 + Math.sin(a) * r * 0.7;
        const s = 0.5 + Math.abs(Math.sin(p * 4 + i)) * 0.9;
        strokeLine(x - s, y, x + s, y, 0.24, b);
        strokeLine(x, y - s, x, y + s, 0.24, b);
      }
      break;
    }
    case 'orbitstar': {                        // une étoile 4 branches en orbite (Gemini)
      const p = e.ph ?? t, a = p * 2.2;
      const x = cx + Math.cos(a) * (bw + 2.4), y = cy - bh * 0.3 + Math.sin(a) * (bh + 1.2);
      const s = 1.0 + Math.abs(Math.sin(p * 5)) * 0.7;
      strokeLine(x - s, y, x + s, y, 0.32, b);
      strokeLine(x, y - s, x, y + s, 0.32, b);
      strokeLine(x - s * 0.5, y - s * 0.5, x + s * 0.5, y + s * 0.5, 0.2, b * 0.6);
      strokeLine(x - s * 0.5, y + s * 0.5, x + s * 0.5, y - s * 0.5, 0.2, b * 0.6);
      break;
    }
    case 'playbar': {                         // barre de progression de la vidéo (YouTube)
      const p = ((e.ph ?? t) * 0.06) % 1;
      const x0 = cx - 5, x1 = cx + 5, yy = cy + bh + 2.6;
      strokeLine(x0, yy, x1, yy, 0.2, b * 0.3);
      strokeLine(x0, yy, x0 + (x1 - x0) * p, yy, 0.34, b);
      disc(x0 + (x1 - x0) * p, yy, 0.55, b);
      break;
    }
    case 'screen': {                          // petit écran devant lui (cam / partage)
      const x0 = cx - 3.4, x1 = cx + 3.4, y0 = cy + bh - 1.8, y1 = cy + bh + 2.2;
      strokeLine(x0, y0, x1, y0, 0.3, b * 0.7);
      strokeLine(x0, y1, x1, y1, 0.3, b * 0.7);
      strokeLine(x0, y0, x0, y1, 0.3, b * 0.7);
      strokeLine(x1, y0, x1, y1, 0.3, b * 0.7);
      // "signal" qui scintille dedans
      const k = Math.floor((e.t || t) * 4) % 3;
      for (let i = 0; i <= k; i++) disc(x0 + 1.2 + i * 1.8, (y0 + y1) / 2, 0.4, b);
      break;
    }
    case 'star4': {                           // étincelle 4 branches (Claude / Gemini)
      const p = e.ph ?? t;
      const s = 0.7 + Math.abs(Math.sin(p * 3)) * 1.0;
      strokeLine(e.x - s, e.y, e.x + s, e.y, 0.3, b);
      strokeLine(e.x, e.y - s, e.x, e.y + s, 0.3, b);
      break;
    }
    case 'dots': {                            // "•••" réflexion en cours (ChatGPT)
      const p = e.ph ?? t;
      const n = Math.floor(p * 2.5) % 4;      // 0..3
      for (let i = 0; i < 3; i++)
        disc(cx - 2 + i * 2, cy + bh + 2.4, i < n ? 0.55 : 0.32, i < n ? b : b * 0.4);
      break;
    }
    case 'canvas': {                          // trait de pinceau (bas du visage) qui se construit puis s'efface — Affinity
      const u = e.u, draw = e.draw, p = e.ph ?? t;
      const x0 = cx - 3.6, span = 7.2, y0 = cy + bh - 2.4;
      // le trait dessine un sourire (∪) à hauteur de bouche
      const path = (uu) => [x0 + uu * span, y0 + Math.sin(uu * Math.PI) * 2.4];
      const fade = u < 0.86 ? 1 : Math.max(0, 1 - (u - 0.86) / 0.14);

      if (fade > 0)
        for (let uu = 0; uu <= draw + 1e-3; uu += 0.025) {
          const [x, y] = path(Math.min(uu, 1));
          disc(x, y, 0.55, b * 0.8 * fade);
        }

      if (draw < 1) {
        const jig = Math.sin(p * 18) * 0.22;
        const [hx, hy] = path(draw);
        disc(hx + jig, hy, 0.8, b);                                   // touffe large
        disc(hx + jig + 0.9, hy - 0.9, 0.5, b);                        // virole
        strokeLine(hx + jig + 1.4, hy - 1.6, hx + jig + 3.6, hy - 4.4, 0.5, b);  // manche fin
      }
      break;
    }
  }
}

// météo : flocons de neige / feuilles d'automne qui tombent en fond
let fallParticles = null;
function spawnFall(isLeaf) {
  return {
    x: rnd(-1, N + 1), y: rnd(-8, 0),
    spd: isLeaf ? rnd(2.4, 4.8) : rnd(3.5, 7.5),
    drift: rnd(-0.8, 0.8), r: isLeaf ? rnd(0.9, 1.5) : rnd(0.28, 0.6),
    ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-2.4, 2.4),
    swf: isLeaf ? rnd(0.8, 1.5) : rnd(1.2, 1.8),
  };
}
function drawLeaf(x, y, rot, r, b) {
  const co = Math.cos(rot), si = Math.sin(rot);
  const w = 0.35 + Math.abs(Math.cos(rot)) * 0.9;      // "tourbillon" : s'aplatit
  strokeLine(x - si * r * 1.3, y + co * r * 1.3, x + si * r * 1.3, y - co * r * 1.3, w, b);
}
function drawFalling(t, kind) {
  if (fallParticles && kind && fallParticles.kind !== kind) fallParticles = null;
  if (!fallParticles) {
    if (!kind) return;
    fallParticles = { kind, tPrev: t, parts: [] };
  }
  const fp = fallParticles;
  const dt = Math.min(0.06, Math.max(0, t - fp.tPrev));
  fp.tPrev = t;
  const isLeaf = fp.kind === 'leaves';
  const target = kind ? (isLeaf ? 9 : 16) : 0;
  while (fp.parts.length < target) fp.parts.push(spawnFall(isLeaf));
  const keep = [];
  for (const p of fp.parts) {
    p.y += p.spd * dt;
    p.rot += p.vr * dt;
    p.x += (p.drift + Math.sin(t * p.swf + p.ph) * (isLeaf ? 1.7 : 0.9)) * dt;
    if (p.y < N + 3) {
      keep.push(p);
      if (Math.hypot(p.x - CENTER, p.y - CENTER) <= R + 0.7) {
        if (isLeaf) drawLeaf(p.x, p.y, p.rot, p.r, 0.36);
        else disc(p.x, p.y, p.r, 0.34 + Math.sin(t * 3 + p.ph) * 0.07);
      }
    } else if (kind) {
      Object.assign(p, spawnFall(isLeaf), { y: rnd(-8, -1) });
      keep.push(p);
    }
  }
  fp.parts = keep;
  if (!kind && fp.parts.length === 0) fallParticles = null;
}

// bonnet de Noël, penché à droite
function drawSantaHat(cx, topY, b) {
  const brimY = topY + 0.5;
  for (let x = -4.2; x <= 3.4; x += 0.5) disc(cx + x, brimY, 1.0, b);   // bord
  // cône
  const tipX = cx + 5.2, tipY = brimY - 6.5;
  for (let s = 0; s <= 1; s += 0.05) {
    const lx = cx - 3.4 + (tipX - (cx - 3.4)) * s;
    const rx = cx + 3.0 + (tipX - (cx + 3.0)) * s;
    const y = brimY + (tipY - brimY) * s;
    for (let x = lx; x <= rx; x += 0.5) disc(x, y, 0.55, b * 0.95);
  }
  disc(tipX, tipY, 1.5, b);                                             // pompon
}

