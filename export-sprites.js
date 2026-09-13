const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = process.argv[2];
const URL = process.argv[3];
const S = 128;                       // taille finale des emojis Discord

const dataURLtoBuf = (u) => Buffer.from(u.split(',')[1], 'base64');

app.whenReady().then(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  const w = new BrowserWindow({ width: 900, height: 900, show: false });
  await w.loadURL(URL);
  await new Promise(r => setTimeout(r, 1000));

  const manifest = await w.webContents.executeJavaScript('SPRITE_API.manifest');
  const report = [];

  for (const item of manifest) {
    const still = await w.webContents.executeJavaScript(
      `SPRITE_API.still(${JSON.stringify(item)}, ${S})`);
    const png = path.join(OUT, item.name + '.png');
    fs.writeFileSync(png, dataURLtoBuf(still));
    let line = `${item.name}.png`;

    if (item.anim) {
      const frames = await w.webContents.executeJavaScript(
        `SPRITE_API.frames(${JSON.stringify(item)}, ${S})`);
      const fdir = path.join(OUT, 'frames', item.name);
      fs.mkdirSync(fdir, { recursive: true });
      const files = frames.map((f, i) => {
        const p = path.join(fdir, String(i).padStart(3, '0') + '.png');
        fs.writeFileSync(p, dataURLtoBuf(f));
        return p;
      });
      const gif = path.join(OUT, item.name + '.gif');
      const delay = Math.max(2, Math.round((item.anim.dt || 0.08) * 100));
      try {
        execFileSync('magick', ['-loop', '0', '-delay', String(delay),
          ...files, '-layers', 'OptimizePlus', gif]);
        const kb = (fs.statSync(gif).size / 1024).toFixed(0);
        line += `  +  ${item.name}.gif (${kb} KB)`;
        if (fs.statSync(gif).size > 256 * 1024) line += '  ⚠ >256KB';
      } catch (e) { line += `  (gif KO: ${e.message.split('\n')[0]})`; }
    }
    report.push(line);
  }

  // planche-contact (append par lignes de 5, sans police)
  try {
    const stills = manifest.map(m => path.join(OUT, m.name + '.png'));
    const rows = [];
    for (let i = 0; i < stills.length; i += 5) {
      const rp = path.join(OUT, `_row${i}.png`);
      execFileSync('magick', [...stills.slice(i, i + 5), '+append', rp]);
      rows.push(rp);
    }
    execFileSync('magick', [...rows, '-append', '-background', '#1e1f22', path.join(OUT, '_sheet.png')]);
    rows.forEach(r => fs.rmSync(r));
  } catch (e) { report.push('sheet KO: ' + e.message.split('\n')[0]); }

  fs.writeFileSync(path.join(OUT, 'README.txt'),
    'Sprites PC Pet pour Discord\n' +
    '==========================\n' +
    'PNG 128x128 (~25 KB) + GIF animes (<256 KB, boucle).\n\n' +
    'Ajout : serveur Discord > Parametres du serveur > Emojis (ou Autocollants)\n' +
    '        > Importer. Le nom du fichier devient le code : :pcpet_happy:\n' +
    '(2-32 caracteres, minuscules/chiffres/underscore — deja OK ici.)\n\n' +
    'Contenu :\n' + report.map(l => '  ' + l).join('\n') + '\n');
  console.log(report.join('\n'));
  fs.rmSync(path.join(OUT, 'frames'), { recursive: true, force: true });
  app.quit();
});
