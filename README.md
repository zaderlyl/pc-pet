# PC Pet — compagnon flottant (macOS)

Le personnage du Nothing Pet, mais sur le bureau : une petite fenêtre
transparente toujours au-dessus, qu'on attrape et pose où on veut.

> Ce moteur (rendu + humeurs) est aussi porté, en partie, dans le noyau de
> [Nothing OS](https://github.com/zaderlyl/Nothing-OS) sous le nom **Asti**.
> Les deux évoluent indépendamment ; les ajouts d'un côté sont reportés
> manuellement de l'autre quand ça a du sens.

## Lancer

```bash
cd pc-pet
npm install      # une fois (télécharge Electron)
npm start
```

Une icône (patte) apparaît dans la barre de menus : Afficher/Masquer,
Taille, **Fond**, **Galerie des emotes…**, Quitter. On déplace le perso en le faisant glisser.

**Fond** : par défaut le perso est posé sur un **disque « boîtier » opaque**
(liseré + ombre portée) pour ne jamais se fondre dans le bureau. Menu *Fond* :
*Plein* (défaut), *Léger* (translucide), *Aucun* (juste un halo).

**Interactions** — chacune a sa propre émote (style LED du compagnon) :
- **Clic** → caresse (`purr` : yeux fermés, museau de chat, une main le caresse, il ronronne) · plusieurs clics de suite → `smitten` (gaga, cœurs qui tournent) · **glisser** → le déplacer
- **Double-clic** → une figure au hasard : `spin` (pirouette), `flip` (salto), `wiggle` (danse)
- **Friandises** : étagère **verticale** sur le bord droit, 9 friandises dessinées en points (style LED du perso) — **glisse-en une sur le perso**, chacune a sa propre dégustation :
  - 🍪 cookie / 🍩 donut → `nom` · 🍓 fraise → `nibble` (petites bouchées) · 🦴 os → `gnaw` (il le ronge en secouant la tête) · 🐟 poisson → `gulp` (gobé façon chat) · 🥕 carotte → `crunch` (croque net, +énergie) · 🍬 bonbon → `sugarrush` (shot de sucre, yeux en spirale) · 🌶 piment → `spicy` (ça brûle : vapeur, sueur) · 🔋 pile → `recharge` (c'est un robot : jauge, éclairs)
  - le **nom de la friandise s'affiche au survol** sur la barre
  - trop de friandises → `stuffed`. Menu *Friandises › Donner…* : raccourci sans glisser. Afficher/masquer l'étagère.

## Ce qui le fait réagir

| Signal | Effet |
|---|---|
| Heure | dort la nuit, fatigué le soir |
| Appli active | **terminal** → *Hacki* la matrice (écran vert + pluie de code) · **VS Code** → *Codi* l'ingénieur méthodique, écran bleu #007ACC · **Git / GitHub / GitHub Desktop** → *Giti* le gardien de l'histoire, écran ardoise #0d1117 (commit, branche, diff, push) · **Canva** → *Canvi* le compositeur express, écran cyan #00C4CC (template, drag magnétique, palette pop) · **Affinity** → *Arti* l'artiste minutieux, écran vert #A7F175 · **web** → *Webi* · **design** → *Desi* · **média** → *Chilli* · **messagerie** → *Cheeti* · **jeu** → *Playi* |
| Assistant IA (appli ou onglet) | **Claude** → *Laudi*, attente chaleureuse (regarde autour / fredonne / lit / a une idée) · **ChatGPT** → *Gepti* l'assistant appliqué (réflexion •••, réponse qui se streame, liste à puces), écran vert #A7F175 · **Gemini** → *Gemi* le jumeau show-off (éclat, étoile en orbite, clin d'œil), écran violet |
| Nom au-dessus du compagnon | une **plaque** affiche le nom de la facette à son arrivée (ou **Asti**, son nom de base, en mode neutre), puis s'efface au bout de 5 s et réapparaît à chaque changement |
| Claude réfléchit / rédige | bouche en chargement •, ••, ••• ; à la fin, un « ! » puis retour à l'attente |
| **Affinity** (appli de dessin) | identité bleue, **l'artiste minutieux**. Fond = grille d'artboard + repères de coupe. Les outils s'enchaînent : crayon (langue tirée) → pinceau (se peint son sourire) → plume (nœuds de courbe) → nuancier → zoom pixel (un œil géant) → il recule pour juger. |
| **Discord** (appli ou onglet) | identité blurple, **le gremlin hyper-social**. Fond = messages qui remontent. Yeux grands ouverts qui suivent le chat, « ah ! » à chaque message · tape vite · trop de salons. Badge > 40 → **débordé**. Badge ↑ → **ping**. Badge ↓ de ≥5 → **rattrapage**. Vocal : appel DM · salon serveur · cam/partage · appel entrant (ça sonne). |
| **YouTube** (onglet) | identité rouge, **le zombie hypnotisé**. Fond = scanlines + lueur d'écran qui bat sur le visage. Regard vitreux, avachi, ré-aspiré au centre · scrolle en boucle · « 3 h du mat' » (micro-sommeils). Une **vidéo en lecture** (`<video>` non en pause) → absorption totale, il ne bouge plus, popcorn, barre de progression. |
| Volume | monte → chevrons ↑ · baisse → chevrons ↓ · coupé → mains sur les oreilles |
| Musique en lecture (même son coupé) | il suit le rythme |
| Inactivité | 4 min → s'ennuie · 15 min → s'endort · retour → petit coucou |
| Changement d'appli | petit sursaut |
| Batterie < 15 % (sur secteur = non) | énervé · Branchement secteur → content |
| Décembre / janvier | bonnet de Père Noël |

**Écran scindé** : quand deux fenêtres se partagent l'écran, le compagnon ne
saute plus d'une identité à l'autre — il garde la **plus « logique »** des deux
vues dans les 5 dernières secondes (VS Code + Chrome → Codi). Priorité :
Codi > Giti > Laudi > Arti > Canvi > Gemi > Gepti > Cordi > Tubi.

### Permissions

- Au 1er lancement, macOS demande d'autoriser **Electron** à contrôler
  « System Events » / Spotify / Music (appli active, musique, volume).
  Réglages → Confidentialité et sécurité → Automatisation.
- **Détection « Claude réfléchit » et « vidéo YouTube en lecture »** :
  - dans un **navigateur** → activer « Autoriser JavaScript depuis les Apple
    Events » (Chrome : Présentation › Développeur ; Safari : réglages Développeur).
    Sans ça, l'identité s'affiche mais pas l'état « réfléchit » / « regarde ».
  - dans l'**app Claude du bureau** → lecture de `~/Library/Logs/Claude/main.log`
    (aucune config ; log-scraping, peut casser si le format des logs change).
- **Discord** : badge de non-lus via `lsappinfo` (fiable, aucune config). Le reste
  via `~/Library/Application Support/discord/logs/renderer_js.log` (log-scraping,
  best-effort) : vocal on/off (`RTC ... CONNECTED` / `DISCONNECTED`), cam/partage
  (`incomingVideoEnabled`). Discord ne loggant **ni** « serveur vs DM » **ni**
  « appel entrant », ce sont des **devinettes** : serveur/DM au titre de la fenêtre
  à la connexion ; appel entrant = on rejoint un vocal alors que Discord n'était
  pas au 1er plan. Ça peut se tromper ; si Discord change ses logs, seul le vocal
  est perdu (le badge continue).

Sans ces réglages, seule la détection de réflexion est inactive ; tout le reste marche.

## Galerie / Hub

`gallery.html` — une page qui montre **toutes les emotes en boucle** (repos,
micro-animations, scènes, réactions, applis, son, assistants IA, Claude, cosmétiques),
avec vitesse réglable, filtre et clic pour agrandir. Charge `renderer/engine.js`.
Ouverte depuis le menu de la barre de menus, en double-cliquant le fichier, ou :

**App autonome** — double-cliquer **`build-hub.command`** construit `PC Pet Hub.app`,
une vraie fenêtre macOS (Dock, ⌘Q, plein écran…) qui n'affiche que la galerie,
indépendante de pc-pet. À reconstruire après une modif du moteur (le script y
recopie `gallery.html` + `renderer/engine.js`). Sources dans `hub/`.
`PC Pet Hub.app` = artefact de build (~230 Mo, Electron inclus), pas à versionner.

## Sprites Discord

`discord-sprites/` — 20 emojis PNG 128×128 (`:pcpet_happy:`, `:pcpet_hack:`…) +
4 GIF animés (`dizzy`, `vibe`, `hack`, `thinking`), tous sous la limite Discord.
Régénérés par : `./node_modules/.bin/electron export-sprites.js discord-sprites
"file://$PWD/sprites.html"` (ImageMagick requis pour les GIF ; liste des poses
dans `sprites.html` → `MANIFEST`). Import : Serveur Discord › Paramètres › Emojis
› Importer — le nom du fichier devient le code de l'emoji.

## Structure

- `main.js` — fenêtre, icône barre de menus, sondage des signaux (appli active
  via `osascript`, inactivité via `powerMonitor`, batterie via `pmset`)
- `preload.js` — pont IPC
- `renderer/engine.js` — **moteur de rendu copié de `nothing-pet/simulator`**
  (primitives + `drawCreature` + accessoires). Garder synchro avec le simulateur ;
  `drawCreature` a en plus les humeurs "PC" (focus/curious/creative/chill/social/bored).
- `renderer/pet.js` — cerveau "bureau" + affichage canvas + boucle
