# Changelog

Toutes les modifications notables de PC Pet sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non publié]

Rien pour l'instant.

## 2026-09-13 — Cinq nouvelles identités

- **Figmi** (Figma) — détection par l'appli native ou `figma.com`, teinte
  orange/or (couleur du logo). Pose de base : suit les composants du
  regard. Scène "frames" : les composants s'organisent en grille
  (réutilise l'extra `tiles`, déjà utilisé par Canva).
- **Noti** (Notion) — détection par l'appli native ou `notion.so`, teinte
  volontairement neutre/monochrome (pas de couleur de marque). Pose de
  base posée (lit/écrit). Scène "check" : coche une tâche, avec un nouvel
  extra `checkbox` (case + coche dessinées au trait).
- **Spoti** (Spotify) — détection par l'appli native ou `open.spotify.com`,
  teinte verte `#1DB954`. Pose unique : hoche la tête, égaliseur animé
  sous le menton (nouvel extra `bars`). Indépendant du signal
  `musicPlaying()` existant, qui gère toujours "beatbop" quand Spotify
  tourne en fond sans être au premier plan — cette identité, elle, ne
  s'active que quand on regarde/parcourt l'appli elle-même.
- **Adobi** (toute la suite Adobe) — détection par expression régulière
  (`/^Adobe\b/`) : Photoshop, Illustrator, XD, InDesign, Premiere, After
  Effects, Lightroom, Acrobat... tombent tous sur la même identité, comme
  Affinity Photo/Designer/Publisher le font déjà pour "affinity". Teinte
  rouge-magenta (Creative Cloud). Pose de base concentrée (langue tirée,
  comme Arti). Scène "swatch" : choisit une couleur (réutilise l'extra
  `popswatch`, déjà utilisé par Canva).
- **Steami** (Steam) — détection par l'appli native (le process s'appelle
  `steam_osx` côté System Events, pas "Steam" — les deux sont couverts).
  Teinte bleue `#66C0F4`. Pose de base impatiente qui parcourt sa
  bibliothèque (réutilise l'extra `tiles`). Scène "win" : succès
  débloqué (réutilise l'extra `stars`). Testé en conditions réelles
  (Steam installé) : détection confirmée sans erreur.
- **Galerie** (`gallery.html`) : les 5 nouvelles identités ont chacune
  leur section dans le catalogue (teintes, descriptions, poses) —
  114 → 124 émotes au total.

## 2026-09-13 — Premiers pas sur GitHub

- **Dépôt séparé** : PC Pet a son propre dépôt Git (auparavant un dossier
  local sans historique). Lié au dépôt [Nothing OS](https://github.com/zaderlyl/Nothing-OS),
  dont le compagnon **Asti** est un portage partiel de ce moteur.
- **Humeurs spontanées** : au repos, en journée, une petite humeur
  (content, amour, coucou, rebond, danse, étourdi) se déclenche de temps
  en temps sans signal particulier — porté depuis Asti, qui l'avait
  inventé faute de vrais signaux desktop à observer.
- **Verrouillage d'identité** : certaines applis (Claude, VS Code, Git,
  Affinity, Canva, ChatGPT, Discord, YouTube) priment sur l'identité même
  quand le focus est ailleurs — mais **seulement si elles partagent
  vraiment l'écran** avec l'appli au premier plan (Split View ou double
  écran physique). Une appli juste ouverte en arrière-plan, masquée,
  réduite ou cachée derrière une fenêtre plein écran ne prime jamais.
- **Fix de teinte** : cliquer (caresse), enchaîner les clics (gaga) ou
  nourrir le compagnon faisait retomber le fond sur le neutre le temps
  de l'animation, avant de revenir à l'identité en cours (ex. bleu VS
  Code) — ces interactions existaient déjà, seule la teinte pendant
  l'animation était en cause. Elles gardent maintenant la couleur de
  l'identité active.
- **Bouton Hub** : un bouton dans l'étagère de friandises ouvre la galerie
  des émotes, en plus du menu de la barre de menus.
- **Fix** : le nom des friandises au survol pouvait être caché derrière
  le compagnon ; le compagnon ne repasse plus devant l'étagère.

## Avant ce dépôt Git — la généalogie de pc-pet

pc-pet n'est pas parti de zéro. Ce qui suit retrace, avec les dates des
fichiers eux-mêmes (aucun de ces projets n'était suivi par Git à
l'époque), comment on en est arrivé là avant le premier commit du
13 septembre.

### 31 août — l'objectif de départ : Asti sur l'écran arrière du Nothing Phone (3)

Le but initial n'était ni pc-pet ni Asti-dans-Nothing-OS : c'était une
vraie appli pour le **Nothing Phone (3)**, pour faire vivre le
personnage sur son **écran arrière** — la **matrice Glyph**, l'affichage
à LED au dos du téléphone. `nothing-pet/android` (Kotlin, Gradle) est
cette appli : un **Glyph Toy** enregistré auprès du système Nothing.
`CreatureBrain.kt` gère un cycle horaire (dort la nuit, mange le midi,
fatigué le soir) et une file de réactions ; `SensorHub.kt` branche les
capteurs du téléphone (secousse → étourdi, chute → panique, charge → se
pose, batterie < 15 % → à plat, musique → danse) ; `CreatureRenderer.kt`
calcule le rendu en `IntArray(625)` — 25×25, la résolution exacte de la
matrice Glyph, la même grille qu'Asti et pc-pet utilisent encore
aujourd'hui sur écran classique.

### 1er septembre — le simulateur web

`nothing-pet/simulator/index.html` : une page unique pour prototyper le
rendu du personnage dans un navigateur, sans avoir besoin du téléphone
physique à côté. C'est ce moteur-là que pc-pet réutilisera.

### 2 septembre — naissance de pc-pet

Le moteur du simulateur est repris pour un compagnon de **bureau
macOS** (Electron) plutôt que pour la matrice Glyph d'un téléphone :
mêmes primitives de rendu, mais des capteurs différents — appli active,
inactivité, batterie du Mac, volume système — au lieu des capteurs de
téléphone.

### 2–4 septembre — le compagnon prend forme

Ce que contenait déjà le tout premier commit Git (93a0c8f, 13
septembre) — construit dans ces quelques jours, avant tout suivi de
version :

- **Compagnon flottant** : fenêtre transparente toujours au-dessus,
  glissable, 3 modes de fond (Plein / Léger / Aucun).
- **Interactions** : clic → caresse (`purr`) ; clics répétés → gaga
  (`smitten`) ; double-clic → figure au hasard (`spin` / `flip` / `wiggle`).
- **Friandises** : étagère de 9 friandises (cookie, fraise, os, poisson,
  bonbon, carotte, piment, donut, pile), chacune avec sa propre
  dégustation (`nom`, `nibble`, `gnaw`, `gulp`, `crunch`, `sugarrush`,
  `spicy`, `recharge`) ; `stuffed` si trop nourri.
- **Identités selon l'appli active** : Claude (Laudi), ChatGPT (Gepti),
  Gemini (Gemi), VS Code (Codi), Git/GitHub (Giti), Canva (Canvi),
  Affinity (Arti), Discord (Cordi), YouTube (Tubi) — plus des catégories
  génériques (Hacki, Webi, Desi, Chilli, Cheeti, Playi).
- **Discord et YouTube** : traitement approfondi — badge de non-lus,
  vocal/appel/caméra pour Discord ; vidéo en lecture et micro-sommeils
  "3 h du mat'" pour YouTube.
- **Autres signaux** : heure (jour/soir/nuit), volume (chevrons, mute),
  musique en lecture (suit le rythme), inactivité (ennui à 4 min,
  sommeil à 15 min, coucou au retour), changement d'appli (sursaut),
  batterie faible/en charge, bonnet de Père Noël en décembre/janvier.
- **Écran scindé (version d'origine)** : lissage sur 5 secondes de
  l'identité la plus « logique » vue récemment — remplacé depuis par le
  verrouillage conditionné au partage réel de l'écran (voir plus haut).
- **Galerie / Hub** : `gallery.html` + `PC Pet Hub.app` (appli autonome,
  buildée séparément via `build-hub.command`) pour parcourir toutes les
  émotes.
- **Sprites Discord** : script d'export (`export-sprites.js`) qui génère
  20 emojis PNG + 4 GIF animés, importables comme emojis personnalisés
  sur un serveur Discord — jamais réellement importés sur un serveur,
  juste la capacité de les générer.
- **Permissions** : automatisation System Events (appli active, musique,
  volume) ; lecture des logs Claude/Discord en best-effort pour des
  états plus fins ("réfléchit", vocal...).
