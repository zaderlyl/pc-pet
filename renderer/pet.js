// ===========================================================================
//  PC PET — cerveau "bureau" + affichage. Réutilise engine.js (drawCreature).
//  Signaux du process principal : appli active, inactivité, batterie, son, musique.
// ===========================================================================

let bgMode = 'solid';   // 'solid' | 'soft' | 'off' — réglé depuis le menu de la barre de menus

// friandise -> émote de dégustation dédiée (chacune a son caractère)
const FEED_POSE = {
  cookie: 'nom', donut: 'nom',
  berry: 'nibble', bone: 'gnaw', fish: 'gulp',
  candy: 'sugarrush', carrot: 'crunch', chili: 'spicy', battery: 'recharge',
};
const FEED_MS = { sugarrush: 2800, spicy: 2600, recharge: 3000, gnaw: 2200, gulp: 2000, crunch: 1900, nibble: 1900 };

const Brain = {
  energy: 0.7,
  activity: 'other',
  appName: null,
  idleSec: 0,
  battery: null,
  musicPlaying: false,
  aiTool: null,
  claudeThinking: false,
  _thinkStart: 0,
  discordBadge: 0,
  _dBadgeInit: false,
  discordVoice: false,        // en vocal (n'importe lequel)
  discordCallKind: 'dm',      // 'dm' | 'server'
  discordVideo: false,        // quelqu'un a la cam / partage l'écran
  dScene: { name: null, start: 0, dur: 0, next: 0 },
  youtubePlaying: false,
  yScene: { name: null, start: 0, dur: 0, next: 0 },
  aScene: { name: null, start: 0, dur: 0, next: 0 },   // Affinity : outils qui tournent
  vScene: { name: null, start: 0, dur: 0, next: 0 },   // VS Code : autocomplete / lint / debug / save
  gptScene: { name: null, start: 0, dur: 0, next: 0 }, // ChatGPT : think / type / list / nod
  gemScene: { name: null, start: 0, dur: 0, next: 0 }, // Gemini : spark / swirl / wink / muse
  caScene: { name: null, start: 0, dur: 0, next: 0 },  // Canva : drag / template / pop
  giScene: { name: null, start: 0, dur: 0, next: 0 },  // Git : commit / branch / diff / push
  figScene: { name: null, start: 0, dur: 0, next: 0 }, // Figma : frames qui s'organisent
  noScene: { name: null, start: 0, dur: 0, next: 0 },  // Notion : coche une tâche
  reactions: [],
  idle: { anim: null, start: 0, dur: 0, next: 0 },
  scene: { name: null, start: 0, dur: 0, next: 0 },
  moodNext: 0,
  wasIdle: false,
  wasCharging: null,

  dayMode() {
    const h = new Date().getHours();
    if (h >= 22 || h < 7) return 'night';
    if (h >= 19) return 'eve';
    return 'day';
  },
  targetEnergy() { return { night: 0.95, eve: 0.4, day: 0.8 }[this.dayMode()]; },

  react(pose, ms) { this.reactions.push({ pose, until: performance.now() + ms }); },

  // ---- signaux du process principal ----
  onSignals(s) {
    // événements de volume (signal léger, dédié)
    if (s.volEvent === 'up') { this.react('volup', 1200); return; }
    if (s.volEvent === 'down') { this.react('voldown', 1200); return; }
    if (s.volEvent === 'mute') { this.react('mute', 1500); return; }

    if (typeof s.idleSec === 'number') {
      if (this.wasIdle && s.idleSec < 20) this.react('greet', 1900);   // "te revoilà !"
      this.wasIdle = s.idleSec > 180;
      this.idleSec = s.idleSec;
    }
    if (s.switched) this.react('alert', 850);

    if (s.battery) {
      if (this.wasCharging === false && s.battery.charging) this.react('happy', 2000);
      this.wasCharging = s.battery.charging;
      this.battery = s.battery;
    }

    if (s.activity) this.activity = s.activity;
    if ('appName' in s) this.appName = s.appName;
    if (typeof s.musicPlaying === 'boolean') this.musicPlaying = s.musicPlaying;
    if ('aiTool' in s) {
      if (s.aiTool && s.aiTool !== this.aiTool) this.react('alert', 700);   // petit sursaut à l'arrivée
      this.aiTool = s.aiTool;
      if (s.aiTool !== 'claude') this.claudeThinking = false;
    }
    if ('claudeThinking' in s) {
      const now = performance.now();
      if (s.claudeThinking) {
        if (!this.claudeThinking) this._thinkStart = now;
        this.claudeThinking = true;
      } else {
        if (this.claudeThinking && this._thinkStart && now - this._thinkStart > 1200)
          this.react('claudedone', 1400);                                   // "fini !"
        this.claudeThinking = false;
      }
    }

    if (typeof s.discordBadge === 'number') {
      const prev = this.discordBadge;
      if (this._dBadgeInit) {
        if (s.discordBadge > prev) this.react('discordping', 1300);              // nouvelle mention
        else if (prev - s.discordBadge >= 5) this.react('discordzero', 2000);    // rattrapage : -5 non-lus d'un coup
      }
      this._dBadgeInit = true;
      this.discordBadge = s.discordBadge;
    }
    if (typeof s.discordVoice === 'boolean') {
      if (s.discordVoice && !this.discordVoice && s.discordIncoming) this.react('discordring', 1600);
      this.discordVoice = s.discordVoice;
    }
    if (s.discordCallKind) this.discordCallKind = s.discordCallKind;
    if (typeof s.discordVideo === 'boolean') this.discordVideo = s.discordVideo;
    if (typeof s.youtubePlaying === 'boolean') this.youtubePlaying = s.youtubePlaying;

    if (s.fed) {                                    // on lui a donné une friandise
      const kind = s.fedKind || 'cookie';
      console.log('[pet] friandise reçue :', kind);
      this._fedCount = (this._fedCount || 0) + 1;
      const stuffed = this.energy > 0.98 || this._fedCount > 4;
      const boost = { battery: 0.34, carrot: 0.2, candy: 0.16, chili: 0.04 }[kind] ?? 0.13;
      this.energy = Math.min(1.15, this.energy + boost);
      const pose = stuffed ? 'stuffed' : (FEED_POSE[kind] || 'nom');
      this.react(pose, stuffed ? 2200 : (FEED_MS[pose] || 1500));
      clearTimeout(this._fedReset);
      this._fedReset = setTimeout(() => { this._fedCount = 0; }, 12000);
    }
  },

  // ---- micro-animations (clignement, regard) ----
  scheduleIdle(now) {
    const mode = this.dayMode();
    const pool = mode === 'night' ? ['zzz', 'zzz', 'twitch']
               : mode === 'eve'   ? ['blink', 'blink', 'lookL', 'lookR', 'yawn']
               :                    ['blink', 'blink', 'blink', 'lookL', 'lookR', 'lookU', 'lookD'];
    const a = pick(pool);
    const dur = { blink: 160, twitch: 220, lookL: 1300, lookR: 1300, lookU: 1200,
                  lookD: 1200, yawn: 1700, zzz: 2600 }[a];
    const gap = a === 'blink' ? rnd(900, 3200) : rnd(2200, 6000);
    this.idle = { anim: a, start: now, dur, next: now + dur + gap };
  },
  tickIdle(now) {
    if (this.idle.next === 0) { this.scheduleIdle(now); return; }
    if (this.idle.anim && now - this.idle.start > this.idle.dur) this.idle.anim = null;
    if (now > this.idle.next) this.scheduleIdle(now);
  },

  // ---- petites humeurs spontanées (repos total, aucun signal du bureau) ----
  // Ajouté côté Nothing OS (Asti, src/asti.rs) — le noyau n'a pas de vrais
  // signaux à observer (pas de Discord/batterie/etc.), donc Asti se contente
  // de temps en temps d'un petit élan de vie gratuit. On le rapatrie ici pour
  // que le compagnon reste vivant même quand aucune appli suivie n'est active.
  atFullRest() { return this.atRest() && !this.aiTool && !this.musicPlaying; },
  tickMood(now) {
    if (this.dayMode() !== 'day') return;
    if (this.moodNext === 0) { this.moodNext = now + rnd(22000, 55000); return; }
    if (now > this.moodNext) {
      this.moodNext = now + rnd(22000, 55000);
      if (this.atFullRest() && Math.random() < 0.5) {
        const pose = pick(['happy', 'love', 'greet', 'bounce', 'dance', 'dizzy']);
        this.react(pose, rnd(1800, 3000));
      }
    }
  },

  // ---- petites scènes (rare, seulement au repos) ----
  sceneDur(name) { return name === 'shades' ? 10000 : rnd(9000, 14000); },
  atRest() { return this.activity === 'other' && this.idleSec < 200 && !this.reactions.length; },
  scheduleScene(now) {
    if (!this.atRest() || Math.random() < 0.6) {
      this.scene = { name: null, start: now, dur: 0, next: now + rnd(12000, 26000) };
      return;
    }
    const name = pick(['pipe', 'shades']);
    this.scene = { name, start: now, dur: this.sceneDur(name), next: now + rnd(35000, 70000) };
  },
  tickScene(now) {
    if (this.scene.next === 0) { this.scheduleScene(now); return; }
    if (this.scene.name && now - this.scene.start > this.scene.dur) this.scene.name = null;
    if (now > this.scene.next) this.scheduleScene(now);
  },

  // ---- petites animations d'attente quand on est sur Claude (sans réfléchir) ----
  cScene: { name: null, start: 0, dur: 0, next: 0 },
  scheduleCScene(now) {
    // ~55 % du temps : juste la pose d'attente ; sinon une petite animation
    if (Math.random() < 0.45) {
      const name = pick(['look', 'look', 'hum', 'read', 'read', 'idea']);
      const dur = { look: 3400, hum: 4600, read: 5600, idea: 2000 }[name];
      this.cScene = { name, start: now, dur, next: now + dur + rnd(5000, 10000) };
    } else {
      this.cScene = { name: null, start: now, dur: 0, next: now + rnd(6000, 12000) };
    }
  },
  tickCScene(now) {
    if (this.aiTool !== 'claude' || this.claudeThinking || this.reactions.length) {
      this.cScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.cScene.next === 0) { this.scheduleCScene(now); return; }
    if (this.cScene.name && now - this.cScene.start > this.cScene.dur) this.cScene.name = null;
    if (now > this.cScene.next) this.scheduleCScene(now);
  },

  // ---- animations d'attente quand on est sur Discord ----
  scheduleDScene(now) {
    if (Math.random() < 0.45) {
      const name = pick(['type', 'type', 'scan']);
      const dur = { type: 2800, scan: 2600 }[name];
      this.dScene = { name, start: now, dur, next: now + dur + rnd(5000, 10000) };
    } else {
      this.dScene = { name: null, start: now, dur: 0, next: now + rnd(6000, 12000) };
    }
  },
  tickDScene(now) {
    if (this.aiTool !== 'discord' || this.discordVoice || this.reactions.length) {
      this.dScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.dScene.next === 0) { this.scheduleDScene(now); return; }
    if (this.dScene.name && now - this.dScene.start > this.dScene.dur) this.dScene.name = null;
    if (now > this.dScene.next) this.scheduleDScene(now);
  },

  // ---- Affinity : les outils s'enchaînent (crayon → plume → couleur → zoom → recul) ----
  scheduleAScene(now) {
    const name = pick(['paint', 'pen', 'pen', 'color', 'zoom', 'step', 'step']);
    const dur = { paint: 6800, pen: 5200, color: 4000, zoom: 4600, step: 3000 }[name];
    this.aScene = { name, start: now, dur, next: now + dur + rnd(2500, 6000) };
  },
  tickAScene(now) {
    if (this.aiTool !== 'affinity' || this.reactions.length) {
      this.aScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.aScene.next === 0) { this.scheduleAScene(now); return; }
    if (this.aScene.name && now - this.aScene.start > this.aScene.dur) this.aScene.name = null;
    if (now > this.aScene.next) this.scheduleAScene(now);
  },

  // ---- ChatGPT : l'assistant appliqué (réflexion / réponse / liste / hochement) ----
  scheduleGptScene(now) {
    if (Math.random() < 0.55) {
      const name = pick(['think', 'type', 'type', 'list', 'nod']);
      const dur = { think: 3000, type: 3800, list: 3400, nod: 1400 }[name];
      this.gptScene = { name, start: now, dur, next: now + dur + rnd(4500, 9000) };
    } else {
      this.gptScene = { name: null, start: now, dur: 0, next: now + rnd(6000, 11000) };
    }
  },
  tickGptScene(now) {
    if (this.aiTool !== 'chatgpt' || this.reactions.length) {
      this.gptScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.gptScene.next === 0) { this.scheduleGptScene(now); return; }
    if (this.gptScene.name && now - this.gptScene.start > this.gptScene.dur) this.gptScene.name = null;
    if (now > this.gptScene.next) this.scheduleGptScene(now);
  },

  // ---- Gemini : le jumeau show-off (étincelles / étoile en orbite / clin d'œil / muse) ----
  scheduleGemScene(now) {
    if (Math.random() < 0.6) {
      const name = pick(['spark', 'swirl', 'swirl', 'wink', 'muse']);
      const dur = { spark: 2200, swirl: 4200, wink: 2200, muse: 3600 }[name];
      this.gemScene = { name, start: now, dur, next: now + dur + rnd(3500, 8000) };
    } else {
      this.gemScene = { name: null, start: now, dur: 0, next: now + rnd(5000, 10000) };
    }
  },
  tickGemScene(now) {
    if (this.aiTool !== 'gemini' || this.reactions.length) {
      this.gemScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.gemScene.next === 0) { this.scheduleGemScene(now); return; }
    if (this.gemScene.name && now - this.gemScene.start > this.gemScene.dur) this.gemScene.name = null;
    if (now > this.gemScene.next) this.scheduleGemScene(now);
  },

  // ---- Canva : le compositeur express (template / drag magnétique / palette) ----
  scheduleCaScene(now) {
    if (Math.random() < 0.6) {
      const name = pick(['drag', 'drag', 'template', 'pop']);
      const dur = { drag: 3200, template: 2400, pop: 3000 }[name];
      this.caScene = { name, start: now, dur, next: now + dur + rnd(3500, 8000) };
    } else {
      this.caScene = { name: null, start: now, dur: 0, next: now + rnd(5000, 10000) };
    }
  },
  tickCaScene(now) {
    if (this.aiTool !== 'canva' || this.reactions.length) {
      this.caScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.caScene.next === 0) { this.scheduleCaScene(now); return; }
    if (this.caScene.name && now - this.caScene.start > this.caScene.dur) this.caScene.name = null;
    if (now > this.caScene.next) this.scheduleCaScene(now);
  },

  // ---- Git / GitHub : le gardien de l'histoire (commit / branch / diff / push) ----
  scheduleGiScene(now) {
    if (Math.random() < 0.58) {
      const name = pick(['commit', 'commit', 'branch', 'diff', 'push']);
      const dur = { commit: 1800, branch: 3400, diff: 3800, push: 1600 }[name];
      this.giScene = { name, start: now, dur, next: now + dur + rnd(4000, 9000) };
    } else {
      this.giScene = { name: null, start: now, dur: 0, next: now + rnd(6000, 11000) };
    }
  },
  tickGiScene(now) {
    if (this.aiTool !== 'git' || this.reactions.length) {
      this.giScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.giScene.next === 0) { this.scheduleGiScene(now); return; }
    if (this.giScene.name && now - this.giScene.start > this.giScene.dur) this.giScene.name = null;
    if (now > this.giScene.next) this.scheduleGiScene(now);
  },

  // ---- Figma : le collaboratif enthousiaste (les frames s'organisent) ----
  scheduleFigScene(now) {
    if (Math.random() < 0.5) {
      this.figScene = { name: 'frames', start: now, dur: 2600, next: now + 2600 + rnd(4000, 8000) };
    } else {
      this.figScene = { name: null, start: now, dur: 0, next: now + rnd(5000, 10000) };
    }
  },
  tickFigScene(now) {
    if (this.aiTool !== 'figma' || this.reactions.length) {
      this.figScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.figScene.next === 0) { this.scheduleFigScene(now); return; }
    if (this.figScene.name && now - this.figScene.start > this.figScene.dur) this.figScene.name = null;
    if (now > this.figScene.next) this.scheduleFigScene(now);
  },

  // ---- Notion : le scribe minimaliste (coche une tâche de temps en temps) ----
  scheduleNoScene(now) {
    if (Math.random() < 0.4) {
      this.noScene = { name: 'check', start: now, dur: 2000, next: now + 2000 + rnd(5000, 10000) };
    } else {
      this.noScene = { name: null, start: now, dur: 0, next: now + rnd(6000, 12000) };
    }
  },
  tickNoScene(now) {
    if (this.aiTool !== 'notion' || this.reactions.length) {
      this.noScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.noScene.next === 0) { this.scheduleNoScene(now); return; }
    if (this.noScene.name && now - this.noScene.start > this.noScene.dur) this.noScene.name = null;
    if (now > this.noScene.next) this.scheduleNoScene(now);
  },

  // ---- VS Code : l'ingénieur méthodique (autocomplete → lint → debug → save) ----
  scheduleVScene(now) {
    if (Math.random() < 0.62) {
      const name = pick(['type', 'type', 'lint', 'debug', 'save']);
      const dur = { type: 3200, lint: 3600, debug: 4200, save: 1800 }[name];
      this.vScene = { name, start: now, dur, next: now + dur + rnd(3500, 8000) };
    } else {
      this.vScene = { name: null, start: now, dur: 0, next: now + rnd(5000, 10000) };
    }
  },
  tickVScene(now) {
    if (this.aiTool !== 'vscode' || this.reactions.length) {
      this.vScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.vScene.next === 0) { this.scheduleVScene(now); return; }
    if (this.vScene.name && now - this.vScene.start > this.vScene.dur) this.vScene.name = null;
    if (now > this.vScene.next) this.scheduleVScene(now);
  },

  // ---- animations d'attente quand on est sur YouTube (sans vidéo en lecture) ----
  scheduleYScene(now) {
    if (Math.random() < 0.5) {
      const name = pick(['scroll', 'scroll', 'rabbithole']);
      const dur = { scroll: 3600, rabbithole: 4600 }[name];
      this.yScene = { name, start: now, dur, next: now + dur + rnd(5000, 10000) };
    } else {
      this.yScene = { name: null, start: now, dur: 0, next: now + rnd(6000, 12000) };
    }
  },
  tickYScene(now) {
    if (this.aiTool !== 'youtube' || this.youtubePlaying || this.reactions.length) {
      this.yScene = { name: null, start: 0, dur: 0, next: 0 };
      return;
    }
    if (this.yScene.next === 0) { this.scheduleYScene(now); return; }
    if (this.yScene.name && now - this.yScene.start > this.yScene.dur) this.yScene.name = null;
    if (now > this.yScene.next) this.scheduleYScene(now);
  },

  decor() { const m = new Date().getMonth(); return (m === 11 || m === 0) ? 'noel' : null; },

  activityPose() {
    return {
      web: 'curious', design: 'creative', media: 'chill', chat: 'social', game: 'bounce',
    }[this.activity] || null;
  },

  // nom affiché au-dessus du compagnon : la facette active, sinon son nom de base
  displayName() {
    if (this.aiTool && IDENTITY_NAME[this.aiTool]) return IDENTITY_NAME[this.aiTool];
    const coding = this.activity === 'code' || this.activity === 'terminal';
    if (coding && this.aiTool !== 'vscode') return 'Hacki';
    return ACTIVITY_NAME[this.activity] || 'Asti';   // mode neutre → nom généralisé
  },

  current(now) {
    this.reactions = this.reactions.filter(r => r.until > now);
    this.tickIdle(now);
    this.tickMood(now);
    this.tickScene(now);
    this.tickCScene(now);
    this.tickDScene(now);
    this.tickYScene(now);
    this.tickAScene(now);
    this.tickVScene(now);
    this.tickGptScene(now);
    this.tickGemScene(now);
    this.tickCaScene(now);
    this.tickGiScene(now);
    this.tickFigScene(now);
    this.tickNoScene(now);

    const idl = this.idleSec;
    const batLow = this.battery && !this.battery.charging && this.battery.level < 0.15;
    const coding = this.activity === 'code' || this.activity === 'terminal';

    let layer = 1, pose = 'rest', phase = 0;
    if (this.reactions.length) {
      layer = 3; pose = this.reactions[this.reactions.length - 1].pose;
    } else if (idl > 900) {                       // > 15 min : il dort
      layer = 2; pose = 'zzz'; phase = ((now / 1000) % 3) / 3;
    } else if (batLow) {
      layer = 3; pose = 'lowbat';
    } else if (idl > 240) {                       // 4–15 min : il s'ennuie
      layer = 3; pose = 'bored';
    } else if (this.aiTool === 'vscode') {        // identités "dev" : avant le "coding" générique
      layer = 3;
      pose = this.vScene.name ? 'vscode' + this.vScene.name : 'vscode';
    } else if (this.aiTool === 'git') {
      layer = 3;
      pose = this.giScene.name ? 'git' + this.giScene.name : 'git';
    } else if (coding) {
      layer = 3; pose = 'matrix';
    } else if (this.aiTool) {                     // claude / chatgpt / gemini / affinity / discord / canva
      layer = 3;
      if (this.aiTool === 'claude' && this.claudeThinking) pose = 'claudethink';
      else if (this.aiTool === 'claude' && this.cScene.name) pose = 'claude' + this.cScene.name;
      else if (this.aiTool === 'discord') {
        if (this.discordVoice) {
          pose = this.discordVideo ? 'discordvideo'
               : this.discordCallKind === 'server' ? 'discordvoiceserver'
               : 'discordcall';
        }
        else if (this.dScene.name) pose = 'discord' + this.dScene.name;
        else if (this.discordBadge > 40) pose = 'discordpile';
        else pose = 'discord';
      }
      else if (this.aiTool === 'youtube') {
        if (this.youtubePlaying) pose = 'youtubewatch';
        else if (this.yScene.name) pose = 'youtube' + this.yScene.name;
        else pose = 'youtube';
      }
      else if (this.aiTool === 'affinity') {
        pose = this.aScene.name ? 'affinity' + this.aScene.name : 'affinity';
      }
      else if (this.aiTool === 'chatgpt') {
        pose = this.gptScene.name ? 'chatgpt' + this.gptScene.name : 'chatgpt';
      }
      else if (this.aiTool === 'gemini') {
        pose = this.gemScene.name ? 'gemini' + this.gemScene.name : 'gemini';
      }
      else if (this.aiTool === 'canva') {
        pose = this.caScene.name ? 'canva' + this.caScene.name : 'canva';
      }
      else if (this.aiTool === 'figma') {
        pose = this.figScene.name ? 'figma' + this.figScene.name : 'figma';
      }
      else if (this.aiTool === 'notion') {
        pose = this.noScene.name ? 'notion' + this.noScene.name : 'notion';
      }
      else pose = this.aiTool;
    } else if (this.musicPlaying) {
      layer = 3; pose = 'beatbop';
    } else {
      const ap = this.activityPose();
      if (ap) { layer = 3; pose = ap; }
      else if (this.scene.name) {
        layer = 1; pose = 'scene:' + this.scene.name;
        phase = (now - this.scene.start) / this.scene.dur;
      } else if (this.idle.anim) {
        layer = 2; pose = this.idle.anim;
        phase = Math.min(1, (now - this.idle.start) / this.idle.dur);
      } else {
        layer = 1; pose = 'rest';
      }
    }
    // une interaction (caresse, astuce, friandise...) n'a pas sa propre
    // teinte : elle garde celle de l'identité en cours plutôt que de
    // retomber sur le neutre le temps de l'animation.
    return {
      layer, pose, phase, tint: POSE_TINT[pose] || POSE_TINT[this.aiTool] || null,
      mode: this.dayMode(), decor: this.decor(),
      energy: this.energy, collapseStart: 0,
    };
  },

  tick(dtMs) {
    const k = 1 - Math.pow(0.5, dtMs / 4000);
    this.energy += (this.targetEnergy() - this.energy) * k;
  },
};

if (window.pcpet) window.pcpet.onSignals((s) => {
  if (s.bgMode) bgMode = s.bgMode;
  Brain.onSignals(s);
});

// ---------- affichage ----------------------------------------------------

// pose -> teinte de l'écran (fond, points éteints, points allumés, halo)
const POSE_TINT = {
  matrix: 'matrix', claude: 'claude', chatgpt: 'chatgpt',
  gemini: 'gemini', affinity: 'affinity',
  chatgptthink: 'chatgpt', chatgpttype: 'chatgpt', chatgptlist: 'chatgpt', chatgptnod: 'chatgpt',
  geminispark: 'gemini', geminiswirl: 'gemini', geminiwink: 'gemini', geminimuse: 'gemini',
  claudethink: 'claude', claudedone: 'claude',
  claudelook: 'claude', claudehum: 'claude', clauderead: 'claude', claudeidea: 'claude',
  discord: 'discord', discordtype: 'discord', discordscan: 'discord', discordpile: 'discord',
  discordping: 'discord', discordzero: 'discord', discordring: 'discord',
  discordcall: 'discord', discordvoiceserver: 'discord', discordvideo: 'discord',
  youtube: 'youtube', youtubescroll: 'youtube', youtuberabbithole: 'youtube', youtubewatch: 'youtube',
  affinity: 'affinity', affinitypaint: 'affinity', affinitypen: 'affinity',
  affinitycolor: 'affinity', affinityzoom: 'affinity', affinitystep: 'affinity',
  vscode: 'vscode', vscodetype: 'vscode', vscodelint: 'vscode',
  vscodedebug: 'vscode', vscodesave: 'vscode',
  canva: 'canva', canvadrag: 'canva', canvatemplate: 'canva', canvapop: 'canva',
  git: 'git', gitcommit: 'git', gitbranch: 'git', gitdiff: 'git', gitpush: 'git',
  figma: 'figma', figmaframes: 'figma',
  notion: 'notion', notioncheck: 'notion',
  spotify: 'spotify',
};

// nom de la facette affiché au-dessus du compagnon
const IDENTITY_NAME = {
  claude: 'Laudi', vscode: 'Codi', chatgpt: 'Gepti', gemini: 'Gemi',
  affinity: 'Arti', discord: 'Cordi', youtube: 'Tubi', canva: 'Canvi', git: 'Giti',
  figma: 'Figmi', notion: 'Noti', spotify: 'Spoti',
};
const ACTIVITY_NAME = {
  code: 'Hacki', terminal: 'Hacki', web: 'Webi', design: 'Desi',
  media: 'Chilli', chat: 'Cheeti', game: 'Playi',
};
const TINTS = {
  null:     { bg: '14,15,20',  off: '224,231,247,0.09', lit: '233,239,253', glow: '200,220,255,0.9' },
  matrix:   { bg: '6,16,8',    off: '80,220,120,0.10',  lit: '180,255,190', glow: '90,255,140,0.9' },
  discord:  { bg: '14,15,34',  off: '112,122,238,0.13', lit: '202,208,255', glow: '88,101,242,0.95' },
  youtube:  { bg: '30,8,8',    off: '255,150,150,0.10', lit: '255,214,208', glow: '255,72,58,1' },
  claude:   { bg: '28,14,8',   off: '236,140,95,0.11',  lit: '255,206,174', glow: '240,120,72,0.9' },
  // ChatGPT + Affinity : vert #A7F175 (167,241,117)
  chatgpt:  { bg: '10,24,8',   off: '167,241,117,0.10', lit: '221,255,196', glow: '167,241,117,0.9' },
  gemini:   { bg: '16,10,30',  off: '160,130,250,0.12', lit: '214,192,255', glow: '158,110,255,0.9' },
  affinity: { bg: '10,24,8',   off: '167,241,117,0.11', lit: '221,255,196', glow: '167,241,117,0.9' },
  // VS Code : bleu #007ACC (0,122,204)
  vscode:   { bg: '6,17,28',   off: '0,122,204,0.14',   lit: '150,205,255', glow: '0,122,204,0.95' },
  // Canva : cyan #00C4CC
  canva:    { bg: '4,24,28',   off: '0,196,204,0.13',   lit: '170,240,244', glow: '0,196,204,0.9' },
  // Git / GitHub : ardoise GitHub #0d1117, lueur bleu-lien
  git:      { bg: '13,17,23',  off: '139,148,158,0.15', lit: '176,190,205', glow: '88,166,255,0.6' },
  // Figma : orange/or (couleur "F" du logo)
  figma:    { bg: '26,16,6',   off: '255,170,60,0.13',  lit: '255,224,180', glow: '255,140,40,0.9' },
  // Notion : monochrome, minimaliste (pas de couleur de marque)
  notion:   { bg: '17,17,19',  off: '215,215,218,0.10', lit: '238,238,240', glow: '205,205,210,0.6' },
  // Spotify : vert #1DB954
  spotify:  { bg: '6,20,12',   off: '80,220,130,0.12',  lit: '190,255,210', glow: '29,185,84,0.95' },
};

const cv = document.getElementById('pet');
const g = cv.getContext('2d');
const nameEl = document.getElementById('nameplate');
const nameTxt = document.getElementById('nameplate-txt');
let CELL = 8;

// le canvas est un carré ancré en bas de la fenêtre (une bande « plaque de nom »
// occupe le haut) — on rend TOUJOURS d'après la boîte du canvas, pas de la fenêtre.
function petBox() {
  const w = cv.clientWidth || window.innerWidth;
  const h = cv.clientHeight || w;
  return { w, h };
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const { w, h } = petBox();
  cv.width = w * dpr; cv.height = h * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // marge pour que le disque + son ombre tiennent dans la fenêtre
  CELL = Math.min(w, h) / N * 0.9;
}
window.addEventListener('resize', resize);
resize();

// pluie "Matrix" derrière le perso quand on code
let rain = null;
function drawMatrixRain(t, w, h) {
  const rows = Math.ceil(h / CELL) + 2, ncol = Math.ceil(w / CELL) + 1;
  if (!rain) {
    rain = { tPrev: t, cols: [] };
    for (let c = 0; c < ncol; c++)
      rain.cols.push({ y: rnd(-rows, 0), spd: rnd(7, 18), len: 3 + (Math.random() * 6 | 0) });
  }
  const dt = Math.min(0.05, Math.max(0, t - rain.tPrev)); rain.tPrev = t;
  for (let c = 0; c < ncol; c++) {
    const col = rain.cols[c] || (rain.cols[c] = { y: rnd(-rows, 0), spd: rnd(7, 18), len: 3 + (Math.random() * 6 | 0) });
    col.y += col.spd * dt;
    const head = Math.floor(col.y);
    for (let i = 0; i < col.len; i++) {
      const r = head - i;
      const py = r * CELL + CELL / 2;
      if (py < -CELL || py > h + CELL) continue;
      const a = i === 0 ? 0.95 : (1 - i / col.len) * 0.4;
      g.fillStyle = i === 0 ? `rgba(210,255,220,${a})` : `rgba(55,215,105,${a})`;
      g.beginPath(); g.arc(c * CELL + CELL / 2, py, CELL * 0.28, 0, 7); g.fill();
    }
    if (head - col.len > rows) { col.y = rnd(-rows * 0.6, -2); col.spd = rnd(7, 18); col.len = 3 + (Math.random() * 6 | 0); }
  }
}

// ---- fonds "ambiance" par identité (comme la pluie Matrix) --------------
let chat = null;
function drawDiscordChat(t, w, h) {
  if (!chat) {
    chat = { tPrev: t, msgs: [] };
    for (let i = 0; i < 7; i++)
      chat.msgs.push({ y: rnd(0, h), x: rnd(0.12, 0.72) * w, spd: rnd(14, 26),
                       wd: rnd(2.4, 5) * CELL, lines: 1 + (Math.random() * 2 | 0), side: Math.random() < 0.5 ? -1 : 1 });
  }
  const dt = Math.min(0.05, Math.max(0, t - chat.tPrev)); chat.tPrev = t;
  for (const m of chat.msgs) {
    m.y -= m.spd * dt;
    if (m.y < -3 * CELL) { m.y = h + rnd(0, 3 * CELL); m.x = rnd(0.1, 0.72) * w;
      m.wd = rnd(2.4, 5) * CELL; m.lines = 1 + (Math.random() * 2 | 0); m.side = Math.random() < 0.5 ? -1 : 1; }
    const fade = Math.min(1, m.y / h) * Math.min(1, (h - m.y) / (h * 0.3));
    if (fade <= 0.02) continue;
    const bx = m.side < 0 ? m.x : w - m.x - m.wd;
    g.fillStyle = `rgba(148,158,255,${0.16 * fade})`;
    for (let l = 0; l < m.lines; l++) {
      const ly = m.y + l * CELL * 0.9, lw = l === m.lines - 1 ? m.wd * 0.6 : m.wd;
      g.beginPath(); g.fillRect(bx, ly, lw, CELL * 0.5);
    }
    g.fillStyle = `rgba(120,132,246,${0.22 * fade})`;         // "avatar"
    g.beginPath(); g.arc(bx - CELL * 0.9, m.y + CELL * 0.25, CELL * 0.5, 0, 7); g.fill();
  }
}

function drawYoutubeScreen(t, w, h, T) {
  // scanlines qui défilent
  const off = (t * 40) % (CELL * 2);
  g.fillStyle = `rgba(255,90,80,0.04)`;
  for (let y = -CELL * 2 + off; y < h; y += CELL * 2) g.fillRect(0, y, w, CELL * 0.6);
  // lueur d'écran depuis le bas
  const flick = 0.10 + 0.10 * Math.abs(Math.sin(t * 5.5)) + 0.04 * Math.sin(t * 23);
  const lg = g.createLinearGradient(0, h, 0, h * 0.35);
  lg.addColorStop(0, `rgba(255,${90 + 40 * Math.sin(t * 3)},70,${flick})`);
  lg.addColorStop(1, 'rgba(255,80,70,0)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
}

let board = null;
function drawAffinityBoard(t, w, h) {
  // grille d'artboard + repères de coupe aux coins
  const mx = w / 2, my = h / 2, R2 = (12.4 + 1.2) * CELL, step = CELL * 2;
  g.strokeStyle = 'rgba(167,241,117,0.05)'; g.lineWidth = 1;
  g.beginPath();
  for (let gx = mx % step; gx < w; gx += step) { g.moveTo(gx, 0); g.lineTo(gx, h); }
  for (let gy = my % step; gy < h; gy += step) { g.moveTo(0, gy); g.lineTo(w, gy); }
  g.stroke();
  g.strokeStyle = 'rgba(190,255,150,0.18)'; g.lineWidth = 1.4;
  const s = R2 * 0.72;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx2 = mx + sx * s, cy2 = my + sy * s;
    g.beginPath(); g.moveTo(cx2 - sx * CELL, cy2); g.lineTo(cx2, cy2);
    g.moveTo(cx2, cy2 - sy * CELL); g.lineTo(cx2, cy2); g.stroke();
  }
}

// VS Code : éditeur — gouttière de numéros de ligne + lignes de code qui défilent
let editor = null;
function drawVscodeEditor(t, w, h) {
  const lh = CELL * 1.3;
  if (!editor) {
    editor = { tPrev: t, off: 0, rows: [] };
    for (let i = 0; i < 40; i++)
      editor.rows.push({ indent: (Math.random() * 4 | 0), len: rnd(2.5, 8), tok: Math.random() });
  }
  const dt = Math.min(0.05, Math.max(0, t - editor.tPrev)); editor.tPrev = t;
  editor.off += lh * 0.55 * dt;                         // défilement lent vers le haut
  if (editor.off > lh) { editor.off -= lh; editor.rows.push(editor.rows.shift()); }
  const x0 = w * 0.5 - CELL * 9;
  for (let r = 0; r < editor.rows.length; r++) {
    const row = editor.rows[r];
    const y = -lh + r * lh - editor.off;
    if (y < -lh || y > h) continue;
    g.fillStyle = 'rgba(0,122,204,0.10)';               // numéro de ligne (gouttière)
    g.fillRect(x0 - CELL * 1.6, y + lh * 0.3, CELL * 0.9, CELL * 0.4);
    const ix = x0 + row.indent * CELL * 1.1;            // indentation
    g.fillStyle = `rgba(120,190,255,${0.11 + row.tok * 0.06})`;
    g.fillRect(ix, y + lh * 0.28, row.len * CELL, CELL * 0.44);
  }
  // curseur qui clignote au centre
  if ((t % 1) < 0.5) {
    g.fillStyle = 'rgba(150,205,255,0.5)';
    g.fillRect(w * 0.5 + CELL * 2, h * 0.5 - lh * 0.4, CELL * 0.16, lh * 0.85);
  }
}

// Canva : planche de templates — vignettes colorées + repères magnétiques
let cboard = null;
function drawCanvaBoard(t, w, h) {
  const mx = w / 2, my = h / 2, step = CELL * 3.2;
  if (!cboard) {
    cboard = { tPrev: t, off: 0, cells: [] };
    for (let i = 0; i < 24; i++) cboard.cells.push({ a: rnd(0.05, 0.13), hue: (Math.random() * 4 | 0) });
  }
  const dt = Math.min(0.05, Math.max(0, t - cboard.tPrev)); cboard.tPrev = t;
  cboard.off = (cboard.off + dt * CELL * 0.5) % step;
  const hues = ['0,196,204', '120,90,255', '255,120,170', '255,190,70'];
  let i = 0;
  for (let gy = -step + (my % step) - cboard.off; gy < h; gy += step)
    for (let gx = (mx % step); gx < w; gx += step) {
      const c = cboard.cells[i++ % cboard.cells.length];
      g.fillStyle = `rgba(${hues[c.hue]},${c.a})`;
      g.fillRect(gx + CELL * 0.3, gy + CELL * 0.3, step - CELL * 0.9, step - CELL * 0.9);
    }
  // repères magnétiques qui traversent
  g.strokeStyle = 'rgba(255,120,190,0.16)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, h); g.moveTo(0, my + CELL); g.lineTo(w, my + CELL); g.stroke();
}

// Git : graphe de commits qui défile — ligne principale + nœuds + une branche
let ggraph = null;
function drawGitGraph(t, w, h) {
  const lh = CELL * 2.2, x0 = w * 0.5 - CELL * 8;
  if (!ggraph) { ggraph = { tPrev: t, off: 0 }; }
  const dt = Math.min(0.05, Math.max(0, t - ggraph.tPrev)); ggraph.tPrev = t;
  ggraph.off = (ggraph.off + dt * CELL * 0.6) % lh;
  g.strokeStyle = 'rgba(139,148,158,0.18)'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, h); g.stroke();
  g.strokeStyle = 'rgba(88,166,255,0.16)';
  g.beginPath(); g.moveTo(x0 + CELL * 2.2, 0); g.lineTo(x0 + CELL * 2.2, h); g.stroke();  // branche
  for (let y = -lh + (h % lh) - ggraph.off; y < h + lh; y += lh) {
    g.fillStyle = 'rgba(160,175,195,0.35)';
    g.beginPath(); g.arc(x0, y, CELL * 0.32, 0, 7); g.fill();
    if (Math.round(y / lh) % 3 === 0) {
      g.fillStyle = 'rgba(88,166,255,0.3)';
      g.beginPath(); g.arc(x0 + CELL * 2.2, y - lh * 0.5, CELL * 0.28, 0, 7); g.fill();
      g.strokeStyle = 'rgba(88,166,255,0.16)';
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + CELL * 2.2, y - lh * 0.5); g.stroke();
    }
  }
}

function renderToScreen(tintKey) {
  const T = TINTS[tintKey] || TINTS.null;
  const matrix = tintKey === 'matrix';
  const { w, h } = petBox();
  const ox = (w - CELL * N) / 2, oy = (h - CELL * N) / 2;
  const mx = w / 2, my = h / 2;
  // disque bien à l'intérieur de la fenêtre (sinon le cercle est rogné aux bords)
  const rad = Math.min(Math.min(mx, my) - 3, (R + 0.6) * CELL);
  const nowS = performance.now() / 1000;
  g.clearRect(0, 0, w, h);

  // ---- le "boîtier" derrière le visage : disque net, pour ne pas se fondre dans le bureau
  if (bgMode !== 'off') {
    const solid = bgMode === 'solid';
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = CELL * 1.0;
    g.shadowOffsetY = CELL * 0.28;
    g.beginPath(); g.arc(mx, my, rad, 0, Math.PI * 2);
    g.fillStyle = solid ? `rgb(${T.bg})` : `rgba(${T.bg},0.5)`;
    g.fill();
    g.restore();
    // relief : haut légèrement éclairé, bas assombri
    g.save();
    g.beginPath(); g.arc(mx, my, rad, 0, Math.PI * 2); g.clip();
    const vg = g.createLinearGradient(0, my - rad, 0, my + rad);
    vg.addColorStop(0, 'rgba(255,255,255,0.055)');
    vg.addColorStop(0.5, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = vg; g.fillRect(mx - rad, my - rad, rad * 2, rad * 2);
    g.restore();
    // liseré de séparation
    g.beginPath(); g.arc(mx, my, rad - 0.75, 0, Math.PI * 2);
    g.strokeStyle = `rgba(${T.lit},0.18)`; g.lineWidth = 1.3; g.stroke();
  } else {
    // mode "aucun fond" : juste un halo diffus pour garder un minimum de contraste
    const grad = g.createRadialGradient(mx, my, rad * 0.3, mx, my, rad);
    grad.addColorStop(0, `rgba(${T.bg},0.34)`);
    grad.addColorStop(0.78, `rgba(${T.bg},0.24)`);
    grad.addColorStop(1, `rgba(${T.bg},0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(mx, my, rad, 0, 7); g.fill();
  }

  // ambiance clippée dans le disque
  if (bgMode !== 'off' && (matrix || tintKey === 'discord' || tintKey === 'youtube'
      || tintKey === 'affinity' || tintKey === 'vscode' || tintKey === 'canva' || tintKey === 'git')) {
    g.save();
    g.beginPath(); g.arc(mx, my, rad, 0, 7); g.clip();
    if (matrix) drawMatrixRain(nowS, w, h);
    else if (tintKey === 'discord') drawDiscordChat(nowS, w, h);
    else if (tintKey === 'youtube') drawYoutubeScreen(nowS, w, h, T);
    else if (tintKey === 'affinity') drawAffinityBoard(nowS, w, h);
    else if (tintKey === 'vscode') drawVscodeEditor(nowS, w, h);
    else if (tintKey === 'canva') drawCanvaBoard(nowS, w, h);
    else if (tintKey === 'git') drawGitGraph(nowS, w, h);
    g.restore();
  }

  const litOff = `rgba(${T.off})`;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (Math.hypot(x - CENTER, y - CENTER) > R) continue;
      const v = buf[idx(x, y)];
      const cx = ox + x * CELL + CELL / 2, cy = oy + y * CELL + CELL / 2;
      g.beginPath();
      g.fillStyle = litOff;
      g.arc(cx, cy, CELL * 0.30, 0, 7); g.fill();
      if (v > 0.02) {
        const q = Math.round(v * 8) / 8;
        g.beginPath();
        g.fillStyle = `rgba(${T.lit},${0.24 + q * 0.76})`;
        g.shadowColor = `rgba(${T.glow})`;
        g.shadowBlur = CELL * 0.7 * q;
        g.arc(cx, cy, CELL * 0.36, 0, 7); g.fill();
        g.shadowBlur = 0;
      }
    }
}

// --- plaque de nom au-dessus du compagnon ---
let shownName = undefined, nameHideAt = 0;
function updateNameplate(now) {
  if (!nameEl) return;
  const name = Brain.displayName();
  if (name !== shownName) {
    shownName = name;
    if (name) {
      nameTxt.textContent = name;
      nameEl.classList.add('show');
      nameHideAt = now + 5000;         // visible 5 s après un changement
    } else {
      nameEl.classList.remove('show');
    }
  } else if (name && now > nameHideAt) {
    nameEl.classList.remove('show');   // puis s'efface tant que ça ne change pas
  }
}

let last = performance.now();
function frame(now) {
  const dt = now - last; last = now;
  Brain.tick(dt);
  const s = Brain.current(now);
  clearBuf();
  drawCreature(s, now / 1000);
  renderToScreen(s.tint);
  updateNameplate(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- interaction souris : glisser / caresser / double-clic --------
(function interaction() {
  const DRAG_PX = 5, CLICK_MS = 350, DBL_MS = 320;
  let down = null;            // { sx, sy, t, moved }
  let lastClick = 0, clickTimer = null;
  let petStreak = 0, petStreakT = 0;              // caresses rapprochées
  const TRICKS = ['spin', 'flip', 'wiggle'];

  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = { sx: e.screenX, sy: e.screenY, lx: e.screenX, ly: e.screenY, t: performance.now(), moved: false };
    try { cv.setPointerCapture(e.pointerId); } catch {}
  });

  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.screenX - down.lx, dy = e.screenY - down.ly;
    if (!down.moved && Math.hypot(e.screenX - down.sx, e.screenY - down.sy) > DRAG_PX) {
      down.moved = true;
      document.body.classList.add('dragging');
    }
    if (down.moved && (dx || dy)) {
      window.pcpet && window.pcpet.drag(dx, dy);
      down.lx = e.screenX; down.ly = e.screenY;
    }
  });

  addEventListener('pointerup', (e) => {
    if (!down) return;
    const d = down; down = null;
    document.body.classList.remove('dragging');
    try { cv.releasePointerCapture(e.pointerId); } catch {}
    if (d.moved) { window.pcpet && window.pcpet.dragEnd(); return; }
    if (performance.now() - d.t > CLICK_MS) return;   // clic maintenu trop longtemps

    const nowc = performance.now();
    if (nowc - lastClick < DBL_MS) {                  // ---- double-clic : une pirouette dédiée
      clearTimeout(clickTimer); clickTimer = null; lastClick = 0;
      const p = pick(TRICKS);
      console.log('[pet] double-clic →', p);
      Brain.react(p, p === 'flip' ? 1300 : p === 'spin' ? 1100 : 2200);
    } else {                                          // ---- clic simple : caresse (après délai)
      lastClick = nowc;
      clickTimer = setTimeout(() => {
        clickTimer = null;
        petStreak = (nowc - petStreakT < 2200) ? petStreak + 1 : 1;
        petStreakT = nowc;
        const pose = petStreak >= 3 ? 'smitten' : 'purr';
        console.log('[pet] caresse', petStreak, '→', pose);
        Brain.react(pose, pose === 'smitten' ? 2600 : 1900);
        Brain.energy = Math.min(1, Brain.energy + 0.04);
      }, DBL_MS);
    }
  });

  addEventListener('pointercancel', () => {
    down = null; document.body.classList.remove('dragging');
  });
})();
