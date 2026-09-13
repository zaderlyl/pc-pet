const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, screen, nativeImage, shell } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CFG = path.join(app.getPath('userData'), 'config.json');
let cfg = { x: null, y: null, size: 190, hidden: false, bg: 'solid', treats: true };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CFG, 'utf8')) }; } catch {}
const saveCfg = () => { try { fs.writeFileSync(CFG, JSON.stringify(cfg)); } catch {} };

let win = null;
let tray = null;

// ---- détection de l'appli active (macOS) --------------------------------

const APP_CATEGORIES = {
  code: ['Code', 'Cursor', 'Xcode', 'IntelliJ IDEA', 'PyCharm', 'WebStorm', 'PhpStorm',
         'CLion', 'GoLand', 'RubyMine', 'Sublime Text', 'Nova', 'Zed', 'Android Studio'],
  terminal: ['Terminal', 'iTerm2', 'Warp', 'Alacritty', 'kitty', 'Ghostty', 'WezTerm', 'Hyper'],
  web: ['Safari', 'Google Chrome', 'Firefox', 'Arc', 'Brave Browser', 'Microsoft Edge',
        'Chromium', 'Opera', 'Vivaldi', 'Safari Technology Preview'],
  design: ['Figma', 'Sketch', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe XD', 'Blender',
           'Affinity Photo', 'Affinity Designer', 'Pixelmator Pro', 'Cinema 4D', 'DaVinci Resolve'],
  media: ['Music', 'Spotify', 'VLC', 'QuickTime Player', 'TV', 'IINA', 'Plex', 'Podcasts', 'Photos'],
  chat: ['Slack', 'Discord', 'Messages', 'Telegram', 'WhatsApp', 'Microsoft Teams', 'zoom.us',
         'Signal', 'Mail', 'Spark'],
  game: ['Steam', 'Epic Games Launcher', 'OpenEmu', 'Minecraft', 'League of Legends'],
};
const CAT_OF = {};
for (const [cat, apps] of Object.entries(APP_CATEGORIES)) for (const a of apps) CAT_OF[a] = cat;

// ---- lissage écran scindé -------------------------------------------------
// En écran scindé, `frontApp()` alterne entre les 2 fenêtres → le compagnon
// changeait d'identité sans arrêt. On garde plutôt l'identité "la plus logique"
// vue dans les 5 dernières secondes (ex. VS Code + Chrome → VS Code).
const IDENTITY_PRIORITY = ['vscode', 'git', 'claude', 'affinity', 'figma', 'canva', 'notion', 'gemini', 'chatgpt', 'discord', 'youtube'];
const CAT_PRIORITY = ['design', 'code', 'terminal', 'chat', 'game', 'media', 'web'];
const SMOOTH_MS = 5000;
let seenApps = [];   // { tool, cat, ts }
const byPriority = (list) => (a, b) => {
  const ia = list.indexOf(a), ib = list.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
};
function smoothIdentity(rawTool, rawCat, now) {
  seenApps.push({ tool: rawTool, cat: rawCat, ts: now });
  seenApps = seenApps.filter((s) => now - s.ts < SMOOTH_MS);
  const tools = [...new Set(seenApps.map((s) => s.tool).filter(Boolean))];
  const tool = tools.length ? tools.sort(byPriority(IDENTITY_PRIORITY))[0] : null;
  const cats = [...new Set(seenApps.map((s) => s.cat).filter((c) => c && c !== 'other'))];
  const cat = cats.length ? cats.sort(byPriority(CAT_PRIORITY))[0] : 'other';
  return { tool, cat };
}

function frontApp() {
  return new Promise((resolve) => {
    execFile('osascript', ['-e',
      'tell application "System Events" to get name of first application process whose frontmost is true'],
      { timeout: 2000 }, (err, out) => resolve(err ? null : out.trim()));
  });
}

// ---- sur quel assistant IA / appli de création on se trouve -----------
// (clé "aiTool" pour l'historique ; "affinity" = appli de dessin, pas une IA)

const BROWSERS_CHROMIUM = ['Google Chrome', 'Google Chrome Canary', 'Brave Browser',
  'Microsoft Edge', 'Arc', 'Chromium', 'Opera', 'Vivaldi', 'Dia'];
const BROWSERS_SAFARI = ['Safari', 'Safari Technology Preview'];

// URL de l'onglet actif du navigateur au premier plan (sinon null)
function activeUrl(appName) {
  return new Promise((resolve) => {
    let script = null;
    if (BROWSERS_SAFARI.includes(appName))
      script = `tell application "${appName}" to return URL of current tab of front window`;
    else if (BROWSERS_CHROMIUM.includes(appName))
      script = `tell application "${appName}" to return URL of active tab of front window`;
    if (!script) return resolve(null);
    execFile('osascript', ['-e', script], { timeout: 2000 }, (err, out) =>
      resolve(err ? null : out.trim()));
  });
}

// titre de la fenêtre au premier plan (repli pour Firefox / navigateurs non scriptables)
function frontTitle() {
  return new Promise((resolve) => {
    execFile('osascript', ['-e',
      'tell application "System Events" to tell (first process whose frontmost is true) to get value of attribute "AXTitle" of front window'],
      { timeout: 2000 }, (err, out) => resolve(err ? null : out.trim()));
  });
}

const GIT_APPS = ['GitHub Desktop', 'Tower', 'Fork', 'Sourcetree', 'GitKraken', 'Sublime Merge'];

function aiToolOf(appName, url, title) {
  if (appName === 'Claude') return 'claude';
  if (appName === 'Code' || appName === 'Code - Insiders' || appName === 'VSCodium') return 'vscode';
  if (appName === 'ChatGPT') return 'chatgpt';
  if (appName === 'Discord') return 'discord';
  if (appName === 'YouTube') return 'youtube';
  if (appName === 'Figma') return 'figma';
  if (appName === 'Notion') return 'notion';
  if (/Affinity/i.test(appName || '')) return 'affinity';
  if (/^Canva\b/i.test(appName || '')) return 'canva';
  if (GIT_APPS.includes(appName)) return 'git';
  if (url) {
    try {
      const h = new URL(url).hostname;
      if (/(^|\.)claude\.ai$/i.test(h)) return 'claude';
      if (/(^|\.)(chatgpt\.com|chat\.openai\.com)$/i.test(h)) return 'chatgpt';
      if (/(^|\.)(gemini\.google\.com|aistudio\.google\.com)$/i.test(h)) return 'gemini';
      if (/(^|\.)(discord\.com|discordapp\.com)$/i.test(h)) return 'discord';
      if (/(^|\.)(youtube\.com|youtu\.be)$/i.test(h)) return 'youtube';
      if (/(^|\.)(github\.com|githubusercontent\.com)$/i.test(h)) return 'git';
      if (/(^|\.)canva\.com$/i.test(h)) return 'canva';
      if (/(^|\.)figma\.com$/i.test(h)) return 'figma';
      if (/(^|\.)notion\.so$/i.test(h)) return 'notion';
    } catch {}
  }
  if (title) {                       // repli sur le titre d'onglet
    if (/(^|[\s|—-])Claude([\s|—-]|$)/.test(title)) return 'claude';
    if (/ChatGPT/.test(title)) return 'chatgpt';
    if (/(^|[\s|—-])Gemini([\s|—-]|$)/.test(title)) return 'gemini';
  }
  return null;
}

// ---- verrouillage d'identité --------------------------------------------
// Contrairement au lissage ci-dessus (qui ne regarde que les 5 dernières
// secondes de focus), ici on regarde qui est visible À L'ÉCRAN EN MÊME TEMPS
// que l'appli au premier plan — mais UNIQUEMENT quand c'est vraiment le cas
// (écran scindé / Split View, ou deux écrans physiques). Une appli qui
// n'est pas au premier plan ET pas visible à l'écran (masquée ⌘H, réduite,
// ou simplement cachée derrière l'appli au 1er plan si celle-ci occupe tout
// l'écran) ne doit JAMAIS primer. L'ordre de la liste fait la priorité.
const LOCK_APPS = [
  { tool: 'claude', names: ['Claude'] },
  { tool: 'vscode', names: ['Code', 'Code - Insiders', 'VSCodium'] },
  { tool: 'git', names: GIT_APPS },
  { tool: 'affinity', names: ['Affinity Photo', 'Affinity Designer', 'Affinity Publisher'] },
  { tool: 'figma', names: ['Figma'] },
  { tool: 'canva', names: ['Canva'] },
  { tool: 'notion', names: ['Notion'] },
  { tool: 'chatgpt', names: ['ChatGPT'] },
  { tool: 'discord', names: ['Discord'] },
  { tool: 'youtube', names: ['YouTube'] },
];

// Applis GUI avec une fenêtre ouverte (ni masquée ⌘H, ni réduite) : nom +
// position/taille de cette fenêtre, pour pouvoir juger plus loin si elle
// partage vraiment l'écran avec l'appli au premier plan.
function visibleGuiWindows() {
  const script = `
    tell application "System Events"
      set procList to every process whose background only is false
      set out to ""
      repeat with p in procList
        set pname to name of p
        if visible of p then
          try
            repeat with w in windows of p
              if not (value of attribute "AXMinimized" of w) then
                set {px, py} to position of w
                set {pw, ph} to size of w
                set out to out & pname & ":" & px & ":" & py & ":" & pw & ":" & ph & linefeed
                exit repeat
              end if
            end repeat
          end try
        end if
      end repeat
      return out
    end tell`;
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 2500 }, (err, out) => {
      if (err) return resolve([]);
      const rows = out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [name, x, y, w, h] = l.split(':');
        return { name, x: +x, y: +y, w: +w, h: +h };
      });
      resolve(rows);
    });
  });
}

// L'appli `winCandidate` partage-t-elle vraiment l'écran avec l'appli au
// premier plan (`frontName`) ? Oui si : c'est elle-même le 1er plan, ou
// elle est sur un écran physique différent, ou le 1er plan n'occupe pas
// tout son écran (fenêtres côte à côte plausibles, type Split View).
function sharesScreenWithFront(winCandidate, windows, frontName) {
  if (!frontName || winCandidate.name === frontName) return true;
  const frontWin = windows.find((w) => w.name === frontName);
  if (!frontWin) return true; // pas assez d'info -> ne bloque pas (repli permissif)
  const displays = screen.getAllDisplays();
  const displayOf = (w) => displays.find((d) =>
    w.x >= d.bounds.x && w.x < d.bounds.x + d.bounds.width &&
    w.y >= d.bounds.y && w.y < d.bounds.y + d.bounds.height);
  const fd = displayOf(frontWin), ld = displayOf(winCandidate);
  if (fd && ld && fd.id !== ld.id) return true;                 // deux écrans différents
  if (fd && frontWin.w < fd.bounds.width * 0.85) return true;   // 1er plan pas plein écran -> tuilage plausible
  return false; // 1er plan en plein écran sur ce même écran : le reste est masqué derrière
}

// Parmi les applis verrouillées qui partagent vraiment l'écran avec le 1er
// plan, la plus prioritaire (`null` sinon → on retombe sur le lissage).
function lockedIdentity(windows, frontName) {
  for (const { tool, names } of LOCK_APPS) {
    const w = windows.find((x) => names.includes(x.name));
    if (w && sharesScreenWithFront(w, windows, frontName)) return tool;
  }
  return null;
}

// nombre de non-lus sur le badge du Dock de Discord (0 si aucun)
function discordBadge() {
  return new Promise((resolve) => {
    execFile('lsappinfo', ['info', '-only', 'StatusLabel', '-app', 'com.hnc.Discord'],
      { timeout: 2000 }, (err, out) => {
        if (err) return resolve(null);
        const m = out.match(/"label"\s*=\s*"([^"]*)"/);
        if (!m) return resolve(0);
        const n = parseInt(m[1], 10);
        resolve(Number.isFinite(n) ? n : (m[1] ? 1 : 0));   // "●" sans chiffre → 1
      });
  });
}

function battery() {
  return new Promise((resolve) => {
    execFile('pmset', ['-g', 'batt'], { timeout: 2000 }, (err, out) => {
      if (err) return resolve(null);
      const m = out.match(/(\d+)%/);
      const level = m ? parseInt(m[1], 10) / 100 : null;
      const charging = /AC Power|charging|charged/i.test(out) && !/discharging/i.test(out);
      resolve(level == null ? null : { level, charging });
    });
  });
}

// musique en lecture (même si le son est coupé) — Spotify ou Apple Music
function musicPlaying() {
  return new Promise((resolve) => {
    const script = `
      set s1 to ""
      set s2 to ""
      try
        if (application "Spotify" is running) then tell application "Spotify" to set s1 to (player state as text)
      end try
      try
        if (application "Music" is running) then tell application "Music" to set s2 to (player state as text)
      end try
      if (s1 is "playing") or (s2 is "playing") then
        return "yes"
      else
        return "no"
      end if`;
    execFile('osascript', ['-e', script], { timeout: 2500 }, (err, out) =>
      resolve(!err && /yes/i.test(out)));
  });
}

// volume système + mute
function volume() {
  return new Promise((resolve) => {
    execFile('osascript', ['-e',
      '(output volume of (get volume settings) as text) & "," & (output muted of (get volume settings) as text)'],
      { timeout: 2000 }, (err, out) => {
        if (err) return resolve(null);
        const [v, m] = out.trim().split(',');
        resolve({ level: parseInt(v, 10), muted: /true/i.test(m) });
      });
  });
}

// Claude est-il en train de réfléchir / rédiger ? (bouton "Stop" présent sur claude.ai)
// nécessite : Chrome → Présentation > Développeur > "Autoriser JavaScript depuis les
// Apple Events" ; Safari → Développement > "Autoriser JavaScript depuis les Apple Events".
function claudeStreaming(appName) {
  return new Promise((resolve) => {
    const js = "(function(){try{return (document.querySelector('button[aria-label*=stop i]')"
      + "||document.querySelector('[data-testid=stop-button]'))?'1':'0'}catch(e){return '0'}})()";
    let script = null;
    if (BROWSERS_SAFARI.includes(appName))
      script = `tell application "${appName}" to do JavaScript "${js}" in current tab of front window`;
    else if (BROWSERS_CHROMIUM.includes(appName))
      script = `tell application "${appName}" to execute active tab of front window javascript "${js}"`;
    if (!script) return resolve(null);
    execFile('osascript', ['-e', script], { timeout: 2000 }, (err, out) =>
      resolve(err ? null : /^\s*1\s*$/.test(out)));
  });
}

// une vidéo est-elle vraiment en lecture dans l'onglet YouTube ? (même réglage requis)
function youtubePlaying(appName) {
  return new Promise((resolve) => {
    const js = "(function(){try{var v=document.querySelector('video');"
      + "return (v&&!v.paused&&!v.ended&&v.currentTime>0&&v.readyState>2)?'1':'0'}catch(e){return '0'}})()";
    let script = null;
    if (BROWSERS_SAFARI.includes(appName))
      script = `tell application "${appName}" to do JavaScript "${js}" in current tab of front window`;
    else if (BROWSERS_CHROMIUM.includes(appName))
      script = `tell application "${appName}" to execute active tab of front window javascript "${js}"`;
    if (!script) return resolve(null);
    execFile('osascript', ['-e', script], { timeout: 2000 }, (err, out) =>
      resolve(err ? null : /^\s*1\s*$/.test(out)));
  });
}

// ---- app Claude (bureau) : état déduit de son journal --------------------
// pas d'API : on lit ~/Library/Logs/Claude/main.log. "sendMessage" = Claude
// démarre un tour ; "Query completed" / "healthy cycle" / "interrupt" = fini.
// Marche pour les sessions Claude Code du bureau ; peut casser si Claude
// change le format de ses logs.
const CLAUDE_LOG = path.join(os.homedir(), 'Library/Logs/Claude/main.log');
const RE_START = /LocalSessions\.sendMessage:/;
const RE_END = /\[Stop hook\] Query completed|CycleHealth\] healthy cycle|Query (?:aborted|interrupted|cancelled)/;
let deskThinking = false;
let claudeTail = null;

function seedDeskThinking() {
  try {
    const fd = fs.openSync(CLAUDE_LOG, 'r');
    const st = fs.fstatSync(fd);
    const len = Math.min(65536, st.size);
    const b = Buffer.alloc(len);
    fs.readSync(fd, b, 0, len, st.size - len);
    fs.closeSync(fd);
    const txt = b.toString();
    let iStart = -1, iEnd = -1, m;
    const rs = new RegExp(RE_START, 'g'), re = new RegExp(RE_END, 'g');
    while ((m = rs.exec(txt))) iStart = m.index;
    while ((m = re.exec(txt))) iEnd = m.index;
    deskThinking = iStart > iEnd;
  } catch { deskThinking = false; }
}

function watchClaudeApp() {
  try { if (!fs.existsSync(CLAUDE_LOG)) return; } catch { return; }
  seedDeskThinking();
  claudeTail = spawn('tail', ['-n0', '-F', CLAUDE_LOG]);
  let buf = '';
  claudeTail.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      let next = deskThinking;
      if (RE_START.test(line)) next = true;
      else if (RE_END.test(line)) next = false;
      if (next !== deskThinking) {
        deskThinking = next;
        if (win && curAiTool === 'claude' && !curBrowser)
          win.webContents.send('signals', { claudeThinking: deskThinking, t: Date.now() });
      }
    }
  });
  claudeTail.on('error', () => {});
  claudeTail.on('close', () => { claudeTail = null; });
}

// ---- Discord (bureau) : vocal / vidéo, via le log du renderer -----------
// Discord n'expose ni "salon serveur vs DM" ni "appel entrant" dans ses logs :
//  - serveur vs DM  → deviné au titre de la fenêtre au moment de la connexion
//  - appel entrant  → deviné : on rejoint un vocal alors que Discord n'était
//                     pas au 1er plan (= on a décroché un appel venu d'ailleurs)
const DISCORD_LOG = path.join(os.homedir(),
  'Library/Application Support/discord/logs/renderer_js.log');
const RE_RTC_ON = /=>\s*(?:RTC_)?CONNECTED\b/i;
const RE_RTC_OFF = /=>\s*(?:RTC_)?DISCONNECTED\b|Destroy RTCConnection|VOICE_DISCONNECT/i;
const RE_VIDEO_ON = /incomingVideoEnabled = true/i;
const RE_VIDEO_OFF = /incomingVideoEnabled = false/i;
let discordVoice = false;
let discordVideo = false;
let discordTail = null;

function discordWindowKind() {
  return new Promise((resolve) => {
    execFile('osascript', ['-e',
      'tell application "System Events" to tell (first process whose name is "Discord") to get name of front window'],
      { timeout: 1500 }, (err, out) => {
        if (err) return resolve('dm');
        const t = out.trim();
        // "#salon | Serveur - Discord" = serveur ; "@pseudo - Discord" / "Nom - Discord" = DM
        resolve(/[#|｜]|\s\|\s/.test(t) && !/^@/.test(t) ? 'server' : 'dm');
      });
  });
}

function watchDiscordApp() {
  try { if (!fs.existsSync(DISCORD_LOG)) return; } catch { return; }
  discordTail = spawn('tail', ['-n0', '-F', DISCORD_LOG]);
  let buf = '';
  discordTail.stdout.on('data', async (d) => {
    buf += d.toString();
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      // vidéo / partage d'écran dans l'appel
      if (RE_VIDEO_OFF.test(line) && discordVideo) {
        discordVideo = false;
        if (win) win.webContents.send('signals', { discordVideo: false });
      } else if (RE_VIDEO_ON.test(line) && !discordVideo) {
        discordVideo = true;
        if (win) win.webContents.send('signals', { discordVideo: true });
      }
      // connexion / déconnexion vocale
      let next = discordVoice;
      if (RE_RTC_OFF.test(line)) next = false;
      else if (RE_RTC_ON.test(line)) next = true;
      if (next !== discordVoice) {
        const wasConnecting = next && !discordVoice;
        discordVoice = next;
        if (!next) discordVideo = false;
        const incoming = wasConnecting && curAiTool !== 'discord';   // Discord pas au 1er plan → appel entrant
        const kind = wasConnecting ? await discordWindowKind() : undefined;
        if (win) win.webContents.send('signals', {
          discordVoice, discordVideo,
          ...(kind ? { discordCallKind: kind } : {}),
          ...(incoming ? { discordIncoming: true } : {}),
          t: Date.now(),
        });
      }
    }
  });
  discordTail.on('error', () => {});
  discordTail.on('close', () => { discordTail = null; });
}

let lastCat = null;
let lastAiLogged;
let curAiTool = null;      // outil IA courant (mis à jour par pollSignals)
let curBrowser = null;     // nom du navigateur au 1er plan, sinon null
async function pollSignals() {
  if (!win) return;
  const [name, batt, music, windows] = await Promise.all([frontApp(), battery(), musicPlaying(), visibleGuiWindows()]);
  const isBrowser = BROWSERS_SAFARI.includes(name) || BROWSERS_CHROMIUM.includes(name) || name === 'Firefox';
  let url = null, title = null;
  if (isBrowser) [url, title] = await Promise.all([activeUrl(name), frontTitle()]);
  const rawTool = aiToolOf(name, url, title);
  const rawCat = name ? (CAT_OF[name] || 'other') : 'other';
  const { tool: smoothTool, cat } = smoothIdentity(rawTool, rawCat, Date.now());
  const aiTool = lockedIdentity(windows, name) || smoothTool;
  curAiTool = aiTool;
  curBrowser = (BROWSERS_SAFARI.includes(name) || BROWSERS_CHROMIUM.includes(name)) ? name : null;
  if (process.env.PCPET_DEBUG && aiTool !== lastAiLogged) {
    console.log(`[signals] front=${name} raw=${rawTool} → identité=${aiTool} (${cat})`);
    lastAiLogged = aiTool;
  }
  const switched = lastCat !== null && cat !== lastCat;
  lastCat = cat;
  win.webContents.send('signals', {
    activity: cat,
    appName: name,
    aiTool,
    switched,
    idleSec: powerMonitor.getSystemIdleTime(),
    battery: batt,
    musicPlaying: music,
    t: Date.now(),
  });
}

// poll rapide dédié au volume (pour que la réaction suive l'appui)
let lastVol = null;
async function pollVolume() {
  if (!win) return;
  const v = await volume();
  if (!v) return;
  let volEvent = null;
  if (lastVol) {
    const wasMuted = lastVol.muted || lastVol.level === 0;
    const nowMuted = v.muted || v.level === 0;
    if (nowMuted && !wasMuted) volEvent = 'mute';
    else if (!nowMuted && v.level > lastVol.level) volEvent = 'up';
    else if (!nowMuted && v.level < lastVol.level) volEvent = 'down';
  }
  lastVol = v;
  if (volEvent) win.webContents.send('signals', { volEvent, t: Date.now() });
}

// poll dédié à l'état de Claude (réfléchit / a fini)
let lastStreaming;
async function pollClaude() {
  if (!win || curAiTool !== 'claude') return;
  let streaming;
  if (curBrowser) {
    streaming = await claudeStreaming(curBrowser);   // claude.ai : bouton "Stop" présent ?
    if (streaming === null) return;                  // JS-from-Apple-Events désactivé
  } else {
    streaming = deskThinking;                        // app de bureau : déduit du journal
  }
  if (process.env.PCPET_DEBUG && streaming !== lastStreaming) {
    console.log(`[claude] thinking=${streaming} (${curBrowser || 'app bureau'})`);
    lastStreaming = streaming;
  }
  win.webContents.send('signals', { claudeThinking: streaming, t: Date.now() });
}

// poll dédié au badge de non-lus Discord (mentions / DM)
let lastBadge;
async function pollDiscord() {
  if (!win || curAiTool !== 'discord') return;
  const n = await discordBadge();
  if (n === null) return;
  if (process.env.PCPET_DEBUG && n !== lastBadge) {
    console.log(`[discord] badge=${n} voice=${discordVoice} video=${discordVideo}`);
    lastBadge = n;
  }
  win.webContents.send('signals', { discordBadge: n, discordVoice, discordVideo, t: Date.now() });
}

// poll dédié à YouTube : une vidéo est-elle en lecture ?
let lastYtPlaying;
async function pollYoutube() {
  if (!win || curAiTool !== 'youtube' || !curBrowser) return;
  const playing = await youtubePlaying(curBrowser);
  if (playing === null) return;                       // JS-from-Apple-Events désactivé
  if (process.env.PCPET_DEBUG && playing !== lastYtPlaying) {
    console.log(`[youtube] playing=${playing}`);
    lastYtPlaying = playing;
  }
  win.webContents.send('signals', { youtubePlaying: playing, t: Date.now() });
}

// ---- fenêtre ----------------------------------------------------------

const NAMEPLATE_H = 26;   // bande "plaque de nom" au-dessus du disque

function createWindow() {
  const size = Math.max(120, Math.min(360, cfg.size || 190));
  const disp = screen.getPrimaryDisplay().workArea;
  const x = cfg.x != null ? cfg.x : disp.x + disp.width - size - 24;
  const y = cfg.y != null ? cfg.y : disp.y + disp.height - size - NAMEPLATE_H - 24;

  win = new BrowserWindow({
    width: size, height: size + NAMEPLATE_H, x, y,
    frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, fullscreenable: false,
    focusable: false, acceptFirstMouse: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (cfg.hidden) win.hide();
  win.webContents.on('did-finish-load', () =>
    win.webContents.send('signals', { bgMode: cfg.bg || 'solid' }));

  win.webContents.on('console-message', (_e, level, msg, line, src) =>
    console.log(`[renderer] ${msg} (${src}:${line})`));
  win.webContents.on('render-process-gone', (_e, d) => console.log('[renderer gone]', d));
  if (process.env.PCPET_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });

  win.on('moved', () => {
    const [bx, by] = win.getPosition();
    cfg.x = bx; cfg.y = by; saveCfg();
  });
}

function openHub() {
  const hubApp = path.join(__dirname, 'PC Pet Hub.app');
  shell.openPath(fs.existsSync(hubApp) ? hubApp : path.join(__dirname, 'gallery.html'));
}

function buildTray() {
  const img = nativeImage.createFromDataURL(TRAY_ICON).resize({ width: 18, height: 18 });
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip('PC Pet');
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: win && win.isVisible() ? 'Masquer' : 'Afficher', click: toggleShow },
    {
      label: 'Taille', submenu: [140, 170, 190, 220, 260].map((s) => ({
        label: `${s} px`, type: 'radio', checked: cfg.size === s,
        click: () => { cfg.size = s; saveCfg(); relaunchWindow(); },
      })),
    },
    {
      label: 'Fond', submenu: [
        ['solid', 'Plein (recommandé)'], ['soft', 'Léger'], ['off', 'Aucun'],
      ].map(([v, lbl]) => ({
        label: lbl, type: 'radio', checked: (cfg.bg || 'solid') === v,
        click: () => {
          cfg.bg = v; saveCfg();
          if (win) win.webContents.send('signals', { bgMode: v });
        },
      })),
    },
    {
      label: 'Friandises', submenu: [
        {
          label: 'Donner…', submenu: [
            ['cookie', '🍪 Cookie'], ['bone', '🦴 Os'], ['berry', '🍓 Fraise'],
            ['fish', '🐟 Poisson'], ['candy', '🍬 Bonbon'], ['carrot', '🥕 Carotte'],
            ['chili', '🌶 Piment'], ['donut', '🍩 Donut'], ['battery', '🔋 Pile'],
          ].map(([k, lbl]) => ({
            label: lbl,
            click: () => win && win.webContents.send('signals', { fed: Date.now(), fedKind: k }),
          })),
        },
        { type: 'separator' },
        {
          label: 'Afficher l’étagère', type: 'checkbox', checked: cfg.treats !== false,
          click: () => {
            cfg.treats = cfg.treats === false;
            saveCfg();
            if (cfg.treats) createTreatsWindow(); else destroyTreatsWindow();
          },
        },
      ],
    },
    { type: 'separator' },
    { label: 'Galerie des emotes…', click: openHub },
    { type: 'separator' },
    { label: 'Quitter', role: 'quit' },
  ]));
  rebuild();
  tray.on('click', () => { toggleShow(); rebuild(); });
}

function toggleShow() {
  if (!win) return;
  if (win.isVisible()) { win.hide(); cfg.hidden = true; }
  else { win.show(); cfg.hidden = false; keepTreatsOnTop(); }
  saveCfg();
}

function relaunchWindow() {
  if (win) { win.removeAllListeners('moved'); win.close(); win = null; }
  createWindow();
  keepTreatsOnTop();
}

// L'étagère (et l'étiquette de nom au survol qu'elle affiche) doit toujours
// passer devant le compagnon, jamais derrière — sinon le nom des friandises
// se retrouve caché quand le compagnon est posé juste à côté.
function keepTreatsOnTop() {
  if (treatsWin) treatsWin.moveTop();
}

ipcMain.on('drag', (_e, { dx, dy }) => {
  if (!win) return;
  const [bx, by] = win.getPosition();
  win.setPosition(Math.round(bx + dx), Math.round(by + dy));
});
ipcMain.on('drag-end', () => {
  if (!win) return;
  const [bx, by] = win.getPosition();
  cfg.x = bx; cfg.y = by; saveCfg();
});

// ---- fenêtre de friandises (overlay plein écran cliquable seulement sur l'étagère) ----
let treatsWin = null;
function createTreatsWindow() {
  if (treatsWin) return;
  const d = screen.getPrimaryDisplay().workArea;   // exclut Dock + barre de menus
  treatsWin = new BrowserWindow({
    x: d.x, y: d.y, width: d.width, height: d.height,
    frame: false, transparent: true, resizable: false, movable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, focusable: false,
    fullscreenable: false, acceptFirstMouse: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  treatsWin.setAlwaysOnTop(true, 'screen-saver');
  treatsWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  treatsWin.setIgnoreMouseEvents(true, { forward: true });
  treatsWin.loadFile(path.join(__dirname, 'renderer', 'treats.html'));
  keepTreatsOnTop();
  treatsWin.webContents.on('console-message', (_e, l, m, ln, src) =>
    console.log(`[treats] ${m} (${src}:${ln})`));
  treatsWin.on('closed', () => { treatsWin = null; });
}
function destroyTreatsWindow() {
  if (treatsWin) { treatsWin.close(); treatsWin = null; }
}
ipcMain.on('treats-clickable', (_e, on) => {
  if (treatsWin) treatsWin.setIgnoreMouseEvents(!on, { forward: true });
});
ipcMain.handle('pet-bounds', () => {
  if (!win || !win.isVisible()) return null;
  const b = win.getBounds();                       // on retire la bande "plaque de nom" du haut
  return { x: b.x, y: b.y + NAMEPLATE_H, width: b.width, height: b.height - NAMEPLATE_H };
});
ipcMain.on('feed', (_e, kind) => { if (win) win.webContents.send('signals', { fed: Date.now(), fedKind: kind }); });
ipcMain.on('open-hub', openHub);

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  createWindow();
  buildTray();
  if (cfg.treats !== false) createTreatsWindow();
  pollSignals();
  setInterval(pollSignals, 3000);
  pollVolume();
  setInterval(pollVolume, 1000);
  watchClaudeApp();
  setInterval(pollClaude, 900);
  watchDiscordApp();
  pollDiscord();
  setInterval(pollDiscord, 1500);
  setInterval(pollYoutube, 1500);
});
app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => {
  try { claudeTail && claudeTail.kill(); } catch {}
  try { discordTail && discordTail.kill(); } catch {}
});

// petit dessin de patte pour la barre de menus
const TRAY_ICON =
  'data:image/svg+xml;base64,' + Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
       <circle cx="9" cy="11" r="4" fill="black"/>
       <circle cx="4" cy="6" r="1.7" fill="black"/><circle cx="8" cy="4" r="1.7" fill="black"/>
       <circle cx="12" cy="4.5" r="1.7" fill="black"/><circle cx="15" cy="7" r="1.7" fill="black"/>
     </svg>`).toString('base64');
