# Plan d’implémentation — Studio desktop de mandalas par couches

## 1. Résumé

Créer dans `02-superposition-couches` une application desktop autonome permettant :

- de générer un mandala reproductible à partir d’une graine ;
- de construire manuellement une composition ordonnée de couches ;
- d’ajouter des couches « fleur », « disque » et « anneau de cercles » ;
- de modifier, masquer, verrouiller, dupliquer, supprimer et réordonner chaque couche indépendamment ;
- de prévisualiser immédiatement le résultat ;
- d’enregistrer et rouvrir un projet local ;
- d’exporter le mandala en PNG haute résolution.

L’application fonctionnera hors ligne. Aucun backend, compte utilisateur ou service distant ne sera nécessaire.

Le premier livrable installable ciblera Windows 11 x64. L’architecture restera compatible avec macOS et Linux ; leur packaging constituera une extension de livraison après validation fonctionnelle de la V1 Windows.

Le `README.md` définit le moteur de composition attendu. La demande actuelle étend volontairement ce moteur en une application desktop exploitable : la coque native, l’éditeur, l’historique, les fichiers projet et l’export constituent donc l’enveloppe produit de ce même moteur, et non de nouveaux sous-projets.

## 2. Décisions structurantes

### Socle technique

- **Application desktop :** Tauri 2.
- **Interface :** React, TypeScript strict et Vite.
- **Rendu :** Canvas 2D avec géométrie normalisée.
- **État :** `useReducer` et fonctions métier pures, sans bibliothèque globale de gestion d’état.
- **Validation :** validateurs TypeScript exécutés à toutes les frontières du domaine.
- **Tests :** Vitest en environnement Node pour le domaine, Vitest Browser Mode avec le fournisseur Playwright pour le véritable Canvas, puis WebdriverIO avec le service Tauri pour les parcours desktop.
- **Packaging :** installateur Windows NSIS pour la première livraison ; DMG et AppImage/DEB dans la phase multi-OS.

Tauri ne contiendra que la coque native, les dialogues de fichiers, l’écriture locale et le packaging. Le moteur de mandala ne dépendra ni de React, ni du DOM, ni de Tauri.

### Prérequis de développement Windows

- version LTS active de Node.js et npm ;
- Rust stable avec la cible MSVC ;
- Microsoft C++ Build Tools ;
- Microsoft Edge WebView2 ;
- Git pour le suivi des modifications.

### Choix fonctionnels V1

- La composition contient au maximum 32 couches.
- Toutes les couches sont centrées implicitement sur `(0, 0)` ; aucune position X/Y n’est éditable.
- Le tableau des couches est stocké de l’arrière-plan vers le premier plan.
- L’interface affiche la pile dans l’ordre inverse, comme un logiciel graphique : la couche au premier plan apparaît en haut.
- Le mode de composition Canvas est uniquement `source-over`.
- Les exports V1 sont le projet rééditable `.mandala.json` et le PNG 2048 ou 4096 px.
- Le SVG, le PDF, les groupes, les masques et les modes de fusion sont reportés.
- Le rendu est déterministe : même version de générateur, même graine et mêmes paramètres donnent la même géométrie.
- La symétrie radiale est garantie séparément pour chaque couche. Des nombres de pétales et de cercles différents restent autorisés ; la V1 n’impose pas un ordre de symétrie global commun.

## 3. Parcours utilisateur principal

1. L’utilisateur ouvre l’application et voit une composition d’exemple ou choisit « Nouvelle composition ».
2. Il saisit une graine puis lance « Générer » pour obtenir une recette de 3 à 8 couches.
3. Il sélectionne une couche dans la pile ou directement dans le Canvas.
4. Il modifie sa géométrie, sa rotation et son apparence dans l’inspecteur.
5. Il ajoute, duplique, masque ou réordonne des couches.
6. Il annule ou rétablit les opérations si nécessaire.
7. Il enregistre le projet localement.
8. Il exporte le rendu en PNG 2048 ou 4096 px.

Un second parcours permet de partir d’une composition vide et d’ajouter manuellement les trois types de couches.

## 4. Architecture du projet

```text
02-superposition-couches/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── bootstrap.tsx
│   │   └── shortcuts.ts
│   ├── domain/
│   │   ├── types.ts
│   │   ├── defaults.ts
│   │   ├── validation.ts
│   │   ├── layerOperations.ts
│   │   └── serialization.ts
│   ├── generation/
│   │   ├── prng.ts
│   │   ├── recipeGenerator.ts
│   │   ├── flowerGenerator.ts
│   │   ├── diskGenerator.ts
│   │   └── circleRingGenerator.ts
│   ├── rendering/
│   │   ├── scene.ts
│   │   ├── canvasRenderer.ts
│   │   ├── hitTesting.ts
│   │   └── renderScheduler.ts
│   ├── state/
│   │   ├── editorReducer.ts
│   │   ├── history.ts
│   │   └── selectors.ts
│   ├── persistence/
│   │   ├── projectFiles.ts
│   │   ├── pngExport.ts
│   │   └── desktopGateway.ts
│   ├── ui/
│   │   ├── Toolbar/
│   │   ├── LayerPanel/
│   │   ├── CanvasStage/
│   │   ├── Inspector/
│   │   ├── ExportDialog/
│   │   └── StatusBar/
│   └── styles/
│       ├── tokens.css
│       └── main.css
├── src-tauri/
│   ├── src/
│   ├── capabilities/
│   ├── Cargo.toml
│   └── tauri.conf.json
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    └── performance/
```

## 5. Modèle de domaine

Le fichier projet sérialise uniquement les intentions de l’utilisateur. La géométrie Canvas est toujours recalculée.

```ts
interface MandalaProject {
  schemaVersion: 1;
  generatorVersion: 1;
  title: string;
  seed: string;
  background: string;
  nextLayerNumber: number;
  layers: MandalaLayer[]; // arrière-plan vers premier plan
}

type MandalaLayer = FlowerLayer | DiskLayer | CircleRingLayer;

interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  rotationDeg: number;
  style: {
    stroke: string | null;
    strokeWidth: number;
    fill: string | null;
    opacity: number;
  };
}

interface FlowerLayer extends BaseLayer {
  kind: "flower";
  outerRadius: number;
  innerRatio: number;
  petalCount: number;
}

interface DiskLayer extends BaseLayer {
  kind: "disk";
  radius: number;
}

interface CircleRingLayer extends BaseLayer {
  kind: "circle-ring";
  orbitRadius: number;
  circleRadius: number;
  circleCount: number;
}
```

### Invariants

- Les identifiants sont uniques dans l’état courant et suivent `layer-N`.
- `nextLayerNumber` est strictement supérieur au plus grand suffixe présent. Après une annulation suivie d’une nouvelle branche d’historique, un identifiant de la branche abandonnée peut être réutilisé, puisqu’il ne coexiste avec aucune entité active.
- La graine canonique est une chaîne NFC non vide de 1 à 128 caractères.
- `rotationDeg` est normalisé dans `[0, 360)`.
- Une couche possède au moins un remplissage ou un contour.
- `opacity` appartient à `[0, 1]`.
- `strokeWidth` appartient à `[0.0005, 0.05]` en unité normalisée.
- Fleur :
  - `petalCount` entier de 3 à 64 ;
  - `outerRadius` dans `[0.02, 1]` ;
  - `innerRatio` dans `[0, 0.95]`.
- Disque : `radius` dans `[0.02, 1]`.
- Anneau :
  - `circleCount` entier de 3 à 128 ;
  - `orbitRadius` dans `[0.02, 0.95]` ;
  - `circleRadius` dans `[0.005, 0.25]` ;
  - `orbitRadius + circleRadius <= 1`.
- Les couleurs sont soit `null`, soit une chaîne hexadécimale opaque au format `#RRGGBB` ; l’alpha reste porté uniquement par `opacity`.
- Une couche masquée reste entièrement sérialisée mais ne produit aucune primitive de rendu.
- Une couche verrouillée reste sérialisée. Son nom, sa géométrie, son style et son ordre ne peuvent pas être modifiés avant déverrouillage ; sa visibilité et son état verrouillé restent actionnables.

Le disque conserve le champ commun `rotationDeg`, mais l’inspecteur ne l’affiche pas car une rotation ne produit aucun effet visuel sur un cercle central.

## 6. Moteur géométrique

### Représentation intermédiaire

Chaque générateur transforme une couche en primitives vectorielles indépendantes du Canvas :

```ts
type Primitive =
  | { kind: "circle"; center: Point; radius: number }
  | { kind: "path"; points: Point[]; closed: boolean };

interface GeneratedLayer {
  layerId: string;
  primitives: Primitive[];
}
```

Toutes les coordonnées sont normalisées autour du centre commun, avec un rayon utile maximal de `1`.

Le cache géométrique stocke uniquement `Primitive[]`. Le `layerId` est rattaché après lecture du cache afin que deux couches aux paramètres identiques ne puissent jamais recevoir le mauvais identifiant.

### Fleur paramétrique

Échantillonner une courbe polaire fermée :

```text
rotationRad = rotationDeg × π / 180

r(θ) = outerRadius × [
  innerRatio
  + (1 - innerRatio) × (1 + cos(petalCount × (θ - rotationRad))) / 2
]
```

- Utiliser exactement `petalCount × 32` échantillons dans `generatorVersion: 1`.
- Calculer chaque point directement depuis son index.
- Ne jamais construire les pétales par rotations cumulatives.
- Fermer explicitement le chemin.

### Disque

- Produire un cercle centré sur `(0, 0)`.
- Appliquer le style et l’opacité de la couche.
- Ignorer la rotation au rendu.

### Anneau de cercles

Pour chaque cercle `i` :

```text
θᵢ = rotation + 2πi / circleCount
xᵢ = orbitRadius × cos(θᵢ)
yᵢ = orbitRadius × sin(θᵢ)
```

Chaque élément reçoit `circleRadius`. Le calcul direct depuis `i` évite l’accumulation d’erreurs flottantes.

### Composition

1. Valider le projet.
2. Générer ou récupérer dans le cache la géométrie de chaque couche visible.
3. Effacer le Canvas et dessiner le fond.
4. Dessiner les couches dans l’ordre du tableau, de l’arrière-plan vers le premier plan.
5. Dessiner les guides et la sélection dans une passe séparée, jamais exportée.

Le cache est indexé par une signature stable des paramètres géométriques de la couche. Une modification de couleur ne doit pas recalculer la géométrie ; une modification d’une couche ne doit pas invalider les autres. L’aperçu et l’export utilisent une échelle de `0.95 × min(largeur, hauteur) / 2`, afin qu’une forme de rayon `1` et son contour ne soient pas coupés.

## 7. Génération par graine

Ajouter un générateur de recettes distinct du moteur de rendu :

- normaliser la graine avec Unicode NFC, puis la convertir avec `xmur3` ;
- produire les valeurs avec `mulberry32` ;
- calculer `layerCount = 3 + floor(random() × 6)` ;
- créer d’abord exactement un disque, une fleur et un anneau de cercles ;
- compléter jusqu’à `layerCount` avec des fleurs ou anneaux selon un tirage documenté ;
- répartir les couches non-disques dans des bandes de rayons régulières entre `0.18` et `0.90`, puis appliquer une gigue bornée issue du PRNG ;
- conserver le disque en première position, puis ordonner les autres couches de la plus grande enveloppe vers la plus petite ;
- choisir les couleurs dans des palettes locales versionnées ;
- respecter tous les invariants avant de retourner le projet ;
- inscrire les paramètres calculés dans le projet afin que le rendu ne dépende plus du PRNG.

L’ordre exact des tirages est figé dans `recipe-v1.ts` : palette, nombre de couches, types additionnels, puis pour chaque descripteur rayon, rotation, répétition, paramètres propres au type et indices de couleurs. Après l’ordre final, attribuer `layer-1` à `layer-N`, fixer `nextLayerNumber` à `N + 1`, choisir le titre et le fond uniquement depuis la graine et les tables versionnées. À graine donnée, aucun champ dérivé ne dépend de l’heure, de `crypto`, du DPI ou de l’état précédent.

`generatorVersion` fige ce calendrier de tirages. Une évolution future du générateur crée une nouvelle version sans modifier le rendu des projets existants. Des tests « golden » comparent le JSON complet produit par plusieurs graines de référence.

Actions utilisateur :

- « Générer » reconstruit la recette à partir de la graine courante ;
- « Nouvelle variante » crée et inscrit une nouvelle graine explicite puis génère ;
- modifier manuellement une couche ne change pas la graine ni les autres couches.

Une génération complète constitue une seule transaction annulable.

## 8. État, opérations et historique

Toutes les opérations métier retournent un nouveau projet :

- `addLayer(project, kind, index?)`
- `duplicateLayer(project, id)`
- `updateLayer(project, id, patch)` où `patch` exclut obligatoirement `id`, `kind`, `locked` et `visible`
- `setLayerVisibility(project, id, visible)`
- `setLayerLocked(project, id, locked)`
- `moveLayer(project, id, targetIndex)`
- `removeLayer(project, id)`
- `generateProject(seed, generatorVersion)`

`addLayer` et `duplicateLayer` refusent explicitement l’opération à 32 couches et retournent une erreur métier sans modifier le projet.

L’état de l’éditeur sépare :

- le projet sérialisable ;
- la couche sélectionnée ;
- le zoom, le panoramique et les guides ;
- l’historique `past / present / future` ;
- l’indicateur de modifications non enregistrées ;
- la dernière erreur et le dernier rendu valide.

Chaque ajout, suppression, duplication, réordonnancement, changement de visibilité et modification de propriété est annulable. Pendant le déplacement continu d’un slider, l’aperçu se met à jour à chaque frame, mais l’historique ne reçoit qu’une seule transaction au relâchement.

Chaque opération revalide le discriminant et les invariants avant de produire le nouvel état. Une couche verrouillée peut être déverrouillée, masquée, affichée ou dupliquée ; sa modification, son renommage, son déplacement et sa suppression sont refusés. Une duplication reçoit un nouvel identifiant et démarre déverrouillée.

## 9. Interface desktop

### Direction visuelle

Adopter une direction « table de montage et papiers découpés » :

- interface neutre, éditoriale et chaleureuse ;
- grande feuille blanche au centre ;
- panneaux couleur papier, fines règles d’imprimerie et ombres courtes ;
- couleurs saturées réservées au mandala et à l’action principale ;
- polices Newsreader, IBM Plex Sans et IBM Plex Mono embarquées localement avec leurs licences ;
- mouvements brefs et fonctionnels, désactivables avec `prefers-reduced-motion`.

### Mise en page

- Barre supérieure : nouveau, ouvrir, enregistrer, annuler, rétablir, graine, générer et exporter.
- Colonne gauche de 300 px : pile de couches.
- Centre flexible : scène, Canvas carré, zoom, panoramique et guides.
- Colonne droite de 340 px : inspecteur contextuel.
- Barre d’état : zoom, taille logique, calques visibles, statut de sauvegarde et temps du dernier rendu.
- Sous 1180 px ou à un zoom d’interface de 200 %, transformer les panneaux en tiroirs sans supprimer de fonction.

### Pile de couches

Chaque ligne contient :

- poignée de réordonnancement ;
- vignette réelle de 40 × 40 px ;
- nom et type ;
- visibilité ;
- verrouillage ;
- menu pour renommer, dupliquer, monter, descendre et supprimer.

Le glisser-déposer possède toujours une alternative clavier et des boutons de menu. L’ajout insère la nouvelle couche au-dessus de la sélection, ou au premier plan si rien n’est sélectionné.

### Inspecteur

Sans sélection, afficher le titre de la composition, le fond, la graine et les guides.

Avec une couche sélectionnée :

- propriétés communes : nom, visibilité, verrouillage, opacité, remplissage, contour et épaisseur ;
- fleur : rayon extérieur, nombre de pétales, profondeur et rotation ;
- disque : rayon, sans rotation inutile ;
- anneau : rayon orbital, nombre de cercles, rayon des cercles et rotation.

Chaque valeur numérique associe un slider, un champ numérique et une unité. Les chaînes en cours de saisie vivent dans un brouillon UI séparé du `MandalaProject`. Une valeur provisoirement invalide affiche une erreur mais ne rejoint ni le projet, ni le rendu, ni l’historique ; le dernier projet valide reste actif.

### Canvas

- Séparer la taille CSS, la taille interne et la résolution d’export.
- Tenir compte de `devicePixelRatio`.
- Planifier au plus un rendu par `requestAnimationFrame`.
- Permettre le zoom, le panoramique et l’ajustement à la fenêtre sans modifier le projet.
- Afficher hors export le centre commun, les axes, des cercles guides et la surbrillance de la couche sélectionnée.
- Sélectionner la couche supérieure sous le pointeur en testant les chemins du premier plan vers l’arrière-plan.
- Ne jamais proposer de translation du centre.

### Raccourcis

- `Ctrl/Cmd + N` : nouvelle composition.
- `Ctrl/Cmd + O` : ouvrir.
- `Ctrl/Cmd + S` : enregistrer.
- `Ctrl/Cmd + Z` : annuler.
- `Ctrl/Cmd + Maj + Z` et `Ctrl + Y` : rétablir.
- `Ctrl/Cmd + D` : dupliquer.
- `F2` : renommer.
- `Alt + ↑/↓` : monter ou descendre la couche.
- `Suppr` : supprimer quand le focus n’est pas dans un champ.
- `0` : ajuster le Canvas.
- `1` : zoom 100 %.
- `G` : guides quand la scène a le focus.
- `Échap` : fermer un dialogue ou désélectionner.

## 10. Persistance et intégration native

### Projet local

- Extension : `.mandala.json`.
- Sérialiser le projet, jamais la géométrie dérivée, l’historique ou l’état de zoom.
- Vérifier `schemaVersion` et chaque propriété à l’ouverture.
- Refuser une version future avec un message explicite.
- Prévoir le point d’entrée de migration, sans migration fictive en V1 ; chaque future évolution de schéma ajoutera sa conversion et ses tests.
- Conserver le dernier projet valide si l’ouverture échoue.
- Afficher un indicateur « modifié » et demander confirmation avant de fermer ou remplacer un projet non enregistré.

### API Tauri

- Utiliser le dialogue natif pour ouvrir et enregistrer.
- Accorder au WebView uniquement les capacités de dialogue et de lecture/écriture de fichiers.
- Utiliser le chemin retourné par le dialogue, qui est ajouté dynamiquement à la portée du plugin `fs` pour la session courante ; ne déclarer aucun glob général sur le dossier personnel.
- Ne pas activer les plugins `shell` ou `http`.
- Ne charger aucun script, police ou image depuis une URL distante.
- Configurer une politique CSP restrictive.
- Limiter les capacités à la fenêtre principale.
- Déclarer une feature Cargo `e2e` qui active les dépendances optionnelles `tauri-plugin-wdio` et `tauri-plugin-wdio-webdriver`.
- Utiliser `tauri.e2e.conf.json`, les permissions `wdio:*`, `withGlobalTauri: true` et l’import frontend `@wdio/tauri-plugin` uniquement dans le profil E2E.
- Vérifier automatiquement que le bundle de production ne contient ni plugin WDIO, ni permission `wdio:*`, ni `wdioTauri`, ni `withGlobalTauri: true`.

Une interface `DesktopGateway` encapsule les appels Tauri. Une implémentation mémoire est utilisée dans les tests du renderer.

Les dialogues natifs ne sont pas des éléments DOM pilotables. Les E2E utilisent donc un `DesktopGateway` propre au profil de test, alimenté par des chemins explicites sous `$TEMP/mandala-e2e/**`, seule portée de fichier autorisée par la capability E2E. Cette implémentation et toute commande de contournement sont absentes du binaire de production. Un smoke test séparé vérifie le véritable dialogue natif sur chaque OS livré. La portée dynamique accordée par un vrai dialogue n’est pas considérée comme persistante après redémarrage.

### Export PNG

1. Demander le chemin avec le dialogue natif.
2. Créer un Canvas hors écran carré de 2048 ou 4096 px.
3. Utiliser exactement le même moteur de scène que l’aperçu.
4. Appliquer le fond, la visibilité, l’opacité et l’ordre des couches.
5. Exclure sélection, guides et état de l’éditeur.
6. Convertir le Canvas en PNG puis écrire les octets localement.
7. Confirmer le chemin et les dimensions dans l’interface.

## 11. Accessibilité et gestion des erreurs

- Utiliser des éléments natifs : boutons, listes ordonnées, champs, `fieldset` et `legend`.
- Garantir un parcours complet au clavier et un focus visible.
- Fournir une action clavier pour toute interaction par glisser-déposer.
- Associer chaque slider à son champ et fournir `aria-valuetext` avec l’unité.
- Donner au Canvas `role="img"` et une description dynamique de la composition.
- Fournir une alternative textuelle listant les couches, leur ordre, leur type et leur visibilité.
- Annoncer l’ajout, la suppression et le réordonnancement dans une région `aria-live="polite"`.
- Respecter le contraste WCAG AA, `forced-colors` et le zoom d’interface à 200 %.
- Ne jamais indiquer un état uniquement par la couleur.

En cas de brouillon de saisie invalide ou d’erreur de rendu :

- conserver le dernier aperçu valide ;
- afficher l’erreur près du contrôle concerné ;
- marquer le champ avec `aria-invalid` ;
- désactiver l’enregistrement et l’export tant que le brouillon invalide n’est pas corrigé ;
- ne jamais effacer silencieusement une couche ou remplacer le projet courant.

## 12. Plan de réalisation

### Jalon 1 — Tranche verticale desktop

Travaux :

- initialiser React + TypeScript + Vite et Tauri 2 ;
- ouvrir la fenêtre native avec une mise en page minimale ;
- créer un projet d’exemple contenant les trois types de couches ;
- rendre ce projet dans le Canvas ;
- modifier le rayon d’une couche ;
- exporter un PNG via un dialogue natif.

Gate :

- un smoke manuel avec `npm run tauri dev` ouvre l’application sans erreur ;
- un changement de rayon met à jour l’aperçu ;
- le fichier exporté possède la signature PNG et un chunk `IHDR` aux dimensions demandées ;
- à résolution identique, une fixture de référence confirme que l’export ne contient aucun guide.

Cette tranche doit traverser l’ensemble de la stack avant d’enrichir séparément le moteur ou l’interface.

### Jalon 2 — Domaine et géométrie

Travaux :

- implémenter les types discriminés et les validateurs ;
- créer les opérations de couches pures ;
- implémenter les trois générateurs ;
- normaliser les rotations et les coordonnées ;
- ajouter les tests de symétrie, de limites et d’indépendance.

Gate :

- toutes les fonctions métier sont indépendantes du DOM ;
- les tests unitaires du domaine sont verts ;
- couverture V8 du cœur géométrique, configurée par glob : au moins 95 % des lignes et 90 % des branches.

### Jalon 3 — Génération déterministe et moteur de scène

Travaux :

- implémenter le PRNG seedé et les palettes locales ;
- générer des recettes valides ;
- ajouter le cache de géométrie ;
- séparer scène, guides, sélection et export ;
- prendre en charge le redimensionnement et le DPR.

Gate :

- une graine identique produit exactement le même projet ;
- une autre graine produit une recette différente ;
- un compteur de génération injecté prouve que modifier une couche ne recalcule que sa géométrie ;
- pour des DPR `1`, `1.25` et `2`, `canvas.width = round(cssWidth × DPR)` et la même règle s’applique à la hauteur.

### Jalon 4 — Éditeur de couches

Travaux :

- construire la pile, l’inspecteur et la barre d’outils ;
- gérer ajout, duplication, suppression, renommage, visibilité et verrouillage ;
- réordonner par glisser-déposer, menu et clavier ;
- ajouter sélection par la pile et par le Canvas ;
- ajouter zoom, panoramique et guides ;
- implémenter la validation des champs.

Gate :

- chaque couche est manipulable sans altérer les autres ;
- l’ordre de la pile correspond toujours à l’ordre visuel ;
- le centre ne peut jamais être déplacé ;
- toutes les opérations essentielles sont réalisables au clavier ;
- à 32 couches, ajout et duplication échouent sans mutation ;
- l’audit automatisé ne remonte aucune violation d’accessibilité critique ou sérieuse.

### Jalon 5 — Historique et fichiers projet

Travaux :

- ajouter les transactions d’annulation/rétablissement ;
- regrouper les rafales de sliders en une transaction ;
- implémenter ouvrir, enregistrer et enregistrer sous ;
- gérer l’état modifié et la confirmation de fermeture ;
- tester le cycle JSON complet et les erreurs d’ouverture.

Gate :

- annuler puis rétablir restaure exactement le projet ;
- enregistrer puis rouvrir conserve tous les paramètres et l’ordre ;
- un fichier invalide ne remplace jamais le projet courant.

### Jalon 6 — Export, accessibilité et robustesse

Travaux :

- finaliser l’export 2048/4096 ;
- ajouter les états de progression et d’erreur ;
- compléter les raccourcis et annonces accessibles ;
- tester les états vides, tous les calques masqués et les valeurs invalides ;
- profiler le rendu et les allocations mémoire.

Gate :

- les PNG ont les dimensions demandées ;
- les guides et la sélection sont absents de l’export ;
- le parcours principal est utilisable au clavier ;
- les noms accessibles, l’ordre du focus et la visibilité du focus sont vérifiés automatiquement ;
- aucun scénario critique ne produit d’erreur console ou de rejet non géré.

### Jalon 7 — Packaging et livraison Windows V1

Travaux :

- ajouter icônes, métadonnées, version et licences ;
- produire l’installateur Windows x64 NSIS ;
- tester installation, premier lancement hors ligne, fermeture et désinstallation ;
- compléter le `README.md` avec prérequis, commandes et architecture.

Gate :

- `npm run build`, les tests TypeScript, Vitest, Rust et E2E sont verts ;
- `npm run package:windows` produit un installateur fonctionnel ;
- le package de production passe le contrôle négatif d’absence des composants WDIO ;
- l’application installée fonctionne sans serveur local ni connexion réseau.

### Extension post-V1 — Packaging macOS et Linux

Cette extension ne bloque pas la définition de terminé Windows :

- runner macOS : produire un DMG, puis signer et notariser tout artefact diffusé publiquement ;
- runner Ubuntu : produire AppImage et DEB ;
- exécuter sur chaque artefact un smoke natif : installation ou montage, lancement hors ligne, affichage du Canvas, fermeture propre et désinstallation quand le format le permet ;
- construire chaque format sur son système natif.

## 13. Stratégie de tests

### Unitaires

- validation des bornes, `NaN`, valeurs infinies et types inconnus ;
- périodicité et fermeture de la fleur ;
- centre et boîte englobante du disque ;
- nombre, rayon orbital et espacement régulier des cercles ;
- rotations négatives et supérieures à 360° ;
- absence de mutation lors des opérations ;
- visibilité, verrouillage et ordre ;
- déterminisme de la génération ;
- sérialisation, refus des versions futures et point d’entrée de migration ; ajouter un test de migration uniquement lorsqu’un ancien schéma réel existe.

Tolérance géométrique : `1e-9`, avec calculs directs plutôt que transformations cumulatives.

### Intégration renderer dans un vrai navigateur

Ces tests utilisent Vitest Browser Mode avec Playwright. Node et `jsdom` ne constituent pas une implémentation Canvas suffisante pour valider le rendu.

- flux état → géométrie → scène → Canvas ;
- changement indépendant de chaque contrôle ;
- redimensionnement et `devicePixelRatio` ;
- sondes RGBA dans des zones de chevauchement connues ;
- rendu sans une couche masquée ;
- ordre visuel après réordonnancement ;
- export à résolution fixe.

Les comparaisons géométriques sont prioritaires. Les captures de référence sont limitées à un environnement canonique afin d’éviter les différences d’anticrénelage entre systèmes.

### E2E desktop

- construire un binaire E2E non distribué avec la feature Cargo et la configuration Tauri dédiées ;
- lancer ce binaire avec WebdriverIO et le fournisseur WebDriver embarqué ;
- générer depuis une graine ;
- ajouter les trois types de couches ;
- modifier, masquer, verrouiller, dupliquer, supprimer et réordonner ;
- annuler et rétablir ;
- enregistrer puis rouvrir ;
- exporter en 2048 et 4096 ;
- parcourir l’application au clavier ;
- vérifier l’absence d’erreurs console et la fermeture propre.

Les scénarios de fichiers injectent des chemins temporaires via le gateway E2E et ne tentent pas de piloter les fenêtres système. Le package NSIS de production fait l’objet d’un autre parcours : installation, lancement hors ligne, vérification du véritable dialogue, fermeture et désinstallation.

### Budgets de performance

Avant le Jalon 6, enregistrer dans `tests/performance/REFERENCE_MACHINE.md` les valeurs exactes de la machine de référence : édition et build Windows, CPU, RAM, GPU, version WebView2, version de l’application et mode d’alimentation. Utiliser une fixture JSON versionnée, effectuer 5 échauffements puis 30 mesures par scénario.

Mesurer la génération et les commandes Canvas avec `performance.measure`, l’interaction jusqu’à peinture avec deux `requestAnimationFrame`, et la mémoire RSS de tout l’arbre de processus Tauri depuis le harness système. Le temps d’export commence après le choix du chemin et se termine après la résolution de l’écriture ; le délai humain du dialogue est exclu.

Budgets initiaux, à confirmer sur cette machine de référence de 4 cœurs et 8 Go de RAM :

- 8 couches et 256 éléments géométriques, Canvas 1024² : rendu p95 inférieur ou égal à 50 ms ;
- modification d’un paramètre : aperçu mis à jour en moins de 100 ms au p95 ;
- 24 couches et 2048 éléments géométriques, Canvas 2048² : rendu p95 inférieur ou égal à 500 ms ;
- export 4096² : moins de 5 secondes ;
- 500 modifications successives : croissance mémoire résiduelle inférieure à 25 Mo ;
- test de stress de 30 minutes : aucun crash et aucun blocage supérieur à 2 secondes ; ce test s’exécute uniquement en nightly et avant release.

## 14. Critères d’acceptation finaux

- **AC-01 — Centre commun :** toutes les couches utilisent l’origine `(0, 0)` comme centre de symétrie ; le disque et la fleur y sont centrés, tandis que le centroïde des centres de l’anneau y revient avec une tolérance de `1e-9`.
- **AC-02 — Indépendance :** modifier, masquer ou verrouiller une couche ne change aucune autre couche.
- **AC-03 — Symétrie par couche :** une rotation change uniquement la phase angulaire de la couche concernée et conserve sa propre répétition régulière, sans imposer une répétition commune aux autres couches.
- **AC-04 — Superposition :** le dernier élément du tableau est rendu au premier plan et l’interface l’affiche en haut de la pile.
- **AC-05 — Déterminisme :** `generateProject(seed, generatorVersion)` produit un JSON égal en profondeur ; indépendamment, `generateLayerGeometry(layer)` produit, sans consulter la graine, les mêmes coordonnées à une tolérance de `1e-9`.
- **AC-06 — Persistance :** un aller-retour sauvegarde/ouverture conserve tous les paramètres utiles.
- **AC-07 — Export :** les PNG 2048 et 4096 correspondent au rendu sans guides ni sélection.
- **AC-08 — Validation :** une saisie invalide conserve le dernier rendu valide et empêche un fichier incohérent.
- **AC-09 — Accessibilité :** le parcours génération → édition → export est réalisable au clavier avec des libellés compréhensibles.
- **AC-10 — Desktop :** l’installateur Windows produit une application autonome fonctionnant hors ligne.

## 15. Hors périmètre V1

- backend, comptes, synchronisation et partage cloud ;
- collaboration en temps réel ;
- dessin libre et édition de points ;
- déplacement du centre ou centres propres aux couches ;
- groupes, sous-couches, masques et multi-sélection ;
- modes de fusion autres que `source-over` ;
- import d’images ;
- animation et export vidéo ;
- SVG, PDF et impression pilotée ;
- intelligence artificielle ;
- système de plugins ;
- mobile et interface tactile dédiée ;
- mise à jour automatique et télémétrie.

## 16. Commandes attendues à la fin de l’implémentation

Les scripts suivants doivent être définis dans `package.json` ; aucun nom de script utilisé par un gate ne reste implicite :

| Script | Contrat |
| --- | --- |
| `typecheck` | Exécuter TypeScript en mode `--noEmit`. |
| `lint` | Exécuter ESLint avec zéro avertissement autorisé. |
| `test:unit` | Exécuter le projet Vitest `unit` sous Node. |
| `test:renderer` | Exécuter le projet Vitest Browser Mode dans Chromium. |
| `test:coverage` | Produire la couverture V8 avec les seuils du cœur géométrique. |
| `test:rust` | Exécuter `cargo test` sur `src-tauri/Cargo.toml`. |
| `test:e2e` | Construire le binaire non distribué avec `--debug --no-bundle --features e2e --config src-tauri/tauri.e2e.conf.json`, puis lancer WebdriverIO. |
| `test:perf:smoke` | Exécuter les mesures courtes sur la machine de référence. |
| `test:perf:stress` | Exécuter le stress de 30 minutes, uniquement en nightly/release. |
| `build` | Produire le renderer Vite de production. |
| `package:windows` | Produire le bundle NSIS Tauri sans feature E2E. |
| `test:package:windows` | Installer, lancer hors ligne, fermer et désinstaller le bundle de production. |

La configuration ESLint et `@vitest/coverage-v8` font partie du socle ; le lockfile npm est versionné.

### Installation et développement interactif

```powershell
npm install
npm run tauri dev
```

`npm run tauri dev` reste un processus interactif : il sert à la vérification manuelle et ne fait pas partie des commandes CI terminantes.

### Portes de validation automatisées

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:renderer
npm run test:coverage
npm run test:rust
npm run test:e2e
npm run test:perf:smoke
npm run build
npm run package:windows
npm run test:package:windows
```

`npm run test:perf:stress` s’ajoute à cette liste dans la pipeline nightly et avant une release.

## 17. Définition de terminé

Le projet est terminé lorsque :

- les dix critères d’acceptation sont démontrés par des tests ou une vérification reproductible ;
- toutes les commandes de validation réussissent ;
- aucun défaut bloquant ou majeur n’est ouvert ;
- l’installateur Windows a été testé sur une machine propre ;
- le `README.md` explique l’installation, le développement, les tests, le format projet et l’export ;
- tout le code, les tests, la configuration Tauri et la documentation restent contenus dans `02-superposition-couches`.

## 18. Références techniques officielles

- [Créer un projet Tauri 2](https://v2.tauri.app/start/create-project/)
- [Prérequis Tauri](https://v2.tauri.app/start/prerequisites/)
- [Capacités et permissions Tauri](https://v2.tauri.app/security/capabilities/)
- [Plugin de dialogue natif](https://v2.tauri.app/plugin/dialog/)
- [Plugin de système de fichiers](https://v2.tauri.app/plugin/file-system/)
- [Tests desktop Tauri avec WebDriver](https://v2.tauri.app/develop/tests/webdriver/)
- [Distribution des applications Tauri](https://v2.tauri.app/distribute/)
