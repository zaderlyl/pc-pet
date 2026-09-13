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
- **Interactions directes sur le compagnon** (sans passer par une
  friandise) :
  - clic simple → caresse (ronronne) ; clics rapprochés → gaga ;
  - double-clic → astuce au hasard (pirouette, salto, déhanché) ;
  - ces réactions gardent désormais la teinte de l'identité en cours
    au lieu de retomber sur un fond neutre le temps de l'animation.
- **Bouton Hub** : un bouton dans l'étagère de friandises ouvre la galerie
  des émotes, en plus du menu de la barre de menus.
- **Fix** : le nom des friandises au survol pouvait être caché derrière
  le compagnon ; le compagnon ne repasse plus devant l'étagère.
