# Studio Mandala — Superposition de couches

Application desktop hors ligne pour générer et composer des mandalas à partir de couches radiales indépendantes.

Le studio associe un moteur géométrique déterministe, un éditeur de calques et une coque native Tauri. Une composition peut être enregistrée dans un fichier `.mandala.json`, rouverte puis exportée en PNG 2048 ou 4096 pixels.

## Fonctionnalités

- Génération reproductible à partir d’une graine.
- Trois types de couches :
  - fleur paramétrique ;
  - disque central ;
  - anneau de cercles.
- Ajout, duplication, renommage, visibilité, verrouillage, suppression et réordonnancement.
- Paramètres de géométrie, rotation, remplissage, contour et opacité propres à chaque couche.
- Historique avec annulation et rétablissement.
- Sélection depuis la pile ou directement dans le Canvas.
- Zoom, panoramique et guides non exportés.
- Sauvegarde locale du projet.
- Export PNG carré en 2048 ou 4096 pixels.
- Parcours clavier, focus visible et description textuelle du Canvas.
- Interface responsive utilisable à 200 % de zoom.

Toutes les couches partagent l’origine `(0, 0)`. Leur tableau est rendu de l’arrière-plan vers le premier plan ; l’interface affiche cette pile dans l’ordre visuel inverse.

## Prérequis Windows

- Node.js LTS ;
- npm ;
- Rust stable avec la cible MSVC ;
- Microsoft C++ Build Tools ;
- Microsoft Edge WebView2.

## Installation

```powershell
cd "K:\BrandonViryEl\rapport\linkedin\posts\05-coloribook\mandalat\02-superposition-couches"
npm install
npx playwright install chromium
```

## Développement

Lancer l’application desktop :

```powershell
npm run tauri dev
```

Lancer uniquement l’interface dans le navigateur :

```powershell
npm run dev
```

Le mode navigateur remplace les dialogues natifs par un sélecteur de fichier et des téléchargements locaux. Le moteur et le rendu restent identiques.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | Vérification TypeScript stricte. |
| `npm run lint` | Analyse ESLint sans avertissement accepté. |
| `npm run test:unit` | Tests du domaine, de la génération et de la persistance. |
| `npm run test:renderer` | Tests Canvas dans Chromium réel. |
| `npm run test:coverage` | Couverture V8 du moteur. |
| `npm run test:rust` | Tests de la coque Tauri. |
| `npm run test:browser-e2e` | Parcours complémentaires Playwright dans le navigateur. |
| `npm run test:e2e` | Construction du binaire E2E puis parcours desktop WebdriverIO. |
| `npm run test:perf:smoke` | Mesures de performance courtes. |
| `npm run build` | Build Vite de production. |
| `npm run package:windows` | Création de l’installateur NSIS Windows. |
| `npm run test:package:windows` | Installe, lance, ferme et désinstalle le bundle NSIS dans un dossier temporaire. |
| `npm run test:package:windows:artifact` | Contrôle le bundle et son empreinte SHA-256 sans l’installer. |

Le stress de 30 minutes est réservé aux validations longues :

```powershell
npm run test:perf:stress
```

## Utilisation

1. Saisir une graine puis choisir **Générer**.
2. Ajouter ou sélectionner une couche dans la colonne de gauche.
3. Modifier ses propriétés dans l’inspecteur.
4. Réordonner la pile pour changer la superposition.
5. Enregistrer le projet avec `Ctrl/Cmd + S`.
6. Choisir **Exporter**, puis 2048 ou 4096 pixels.

Les raccourcis principaux sont disponibles dans le dialogue d’aide de l’application.

## Format de projet

Les fichiers `.mandala.json` contiennent :

- `schemaVersion` et `generatorVersion` ;
- titre, graine et couleur de fond ;
- compteur d’identifiants ;
- liste ordonnée des couches et de leurs paramètres.

La géométrie calculée, le zoom, la sélection et l’historique ne sont pas sérialisés. L’ouverture applique une validation stricte : les versions futures, propriétés inconnues, nombres non finis et discriminants invalides sont refusés sans remplacer la composition active.

## Architecture

```text
src/
├── app/          Application React et raccourcis
├── domain/       Modèle, invariants, opérations et sérialisation
├── generation/   PRNG, recettes et géométries de couches
├── persistence/  Dialogues, fichiers projet et export PNG
├── rendering/    Scène, cache, Canvas, hit-test et scheduler
├── state/        Reducer et historique
├── styles/       Direction visuelle « table de montage »
└── ui/           Toolbar, pile, Canvas, inspecteur et dialogues

src-tauri/        Coque native, permissions production/E2E et configuration NSIS
tests/            Unitaires, Canvas, Playwright, WebdriverIO et performances
```

Le moteur de domaine ne dépend ni de React, ni du DOM, ni de Tauri. L’aperçu et l’export utilisent la même scène normalisée.

## Sécurité et fonctionnement hors ligne

- aucun backend ni compte ;
- aucune requête réseau nécessaire au fonctionnement ;
- polices embarquées dans le build ;
- aucun accès shell ou HTTP exposé par Tauri ;
- accès aux fichiers limité aux chemins choisis dans les dialogues ;
- politique CSP restrictive ;
- composants de test absents du package de production.

Le profil desktop E2E est explicitement séparé : la feature Cargo `e2e`, la
capability inline de `tauri.e2e.conf.json`, `withGlobalTauri: true` et les
plugins WebdriverIO ne sont activés que pour le binaire de test non distribué.
Ce profil écrit uniquement dans `$TEMP/mandala-e2e`. Le contrôle du package
vérifie que ces composants ne figurent ni dans l’arbre Cargo, ni dans le
renderer, ni dans le binaire de production.

## Packaging Windows

```powershell
npm run package:windows
npm run test:package:windows
```

L’installateur est produit dans `src-tauri/target/release/bundle/nsis`.
`npm run test:package:windows` exécute le smoke complet dans un dossier
temporaire. Pour valider explicitement le fonctionnement hors ligne, exécuter
ce smoke sur une machine ou VM propre dont le réseau est désactivé. Le contrôle
plus rapide `npm run test:package:windows:artifact` vérifie seulement l’artefact
et l’absence des composants E2E dans la production.

## Spécification

Le détail des invariants, jalons et critères d’acceptation se trouve dans [PLAN.md](PLAN.md).

## Licence

Le code de ce sous-projet est distribué sous licence MIT. Voir [LICENSE](LICENSE).

## Références artistiques

- [Creating Mandalas — Wolfram Community](https://community.wolfram.com/groups/-/m/t/1011591)
- [Adobe — découverte de l’art du mandala](https://www.adobe.com/fr/creativecloud/design/discover/mandala-art.html)
- [Domestika — L’art de dessiner des mandalas](https://www.domestika.org/fr/courses/1755-l-art-de-dessiner-des-mandalas-creez-des-motifs-geometriques)
- [Clip Studio Paint — comment dessiner un mandala](https://www.clipstudio.net/comment-dessiner/archives/159256)
- [Tombow Europe — dessiner un mandala](https://www.tomboweurope.com/fr/inspiration/dessiner-un-mandala)
- [Cœurs Bohèmes — dessiner facilement un mandala](https://coeursbohemes.com/comment-dessiner-facilement-mandala/)
