# Assets App Store : captures, habillage, bannière

Comment produire les images de la fiche App Store d'Elearn Prepa, et les pièges qui ont coûté du temps la première fois.

## 1. Les tailles : les lire DANS App Store Connect, jamais dans une spec générique

**La leçon principale.** Une première série de captures a été produite en `1320×2868`, la taille « 6,9 pouces » donnée par la documentation Apple. App Store Connect les a **toutes refusées** :

> Les tailles compatibles pour les captures d'écran d'app sont les suivantes :
> 2556 × 1179px, 1179 × 2556px, 2622 × 1206px et 1206 × 2622px.

La section affichée n'était pas la 6,9″ mais **« iPhone avec Dynamic Island (écran moyen) »**, qui n'accepte que du 6,1 / 6,3 pouces. **Les tailles acceptées dépendent de la section affichée dans la page** : il faut les lire à l'écran avant de produire quoi que ce soit.

Tailles utiles (relevées en 2026) :

| Section | Portrait accepté |
|---|---|
| iPhone « Dynamic Island » (6,1 / 6,3″) | **1206 × 2622** (défaut), 1179 × 2556 |
| iPhone 6,9″ | 1320 × 2868 (défaut), 1290 × 2796, 1260 × 2736 |
| iPhone 6,5″ | 1284 × 2778, 1242 × 2688 |
| iPad 13″ | 2064 × 2752, 2048 × 2732 |
| Bannière d'en-tête (page produit) | **5244 × 2950** ou 3840 × 1646 |

Apple décline automatiquement les tailles plus petites à partir du jeu fourni : **un seul jeu suffit**.
Contraintes de format : **PNG/JPG sans canal alpha**, dimensions exactes.

## 2. Les pièges (tous rencontrés)

1. **`EXPO_PUBLIC_*` est figée à la compilation.** La simulation iOS activée depuis la page « Paramètres développeur » vit en mémoire : un rechargement de page la perd, et l'écran des offres retombe sur « bientôt » **sans les prix**. D'où le drapeau d'environnement `EXPO_PUBLIC_SIMULER_IOS=1` (voir `src/services/plateformeDev.ts`).
2. **Sans script d'amorçage, la capture part sur le parcours d'arrivée.** Il faut écrire `profil.arrivee` (profil terminé) dans `localStorage` avant le premier rendu.
3. **Le bandeau web « meilleure expérience sur l'application » apparaît** dans les captures : il faut se déclarer PWA installée (`navigator.standalone = true`).
4. **Les écrans à paramètres rendent vide.** `/cours/chapitre` sans `?id=` ne montre rien. On y arrive en **cliquant** depuis `/reviser`, ou via `/cours/matiere?nom=Maths`.
5. **Un invité neuf n'a que des états vides** : progression, annales, questions (« Aucune question pour l'instant », « Fais ta première mission »). Ces écrans ne font pas de bonnes captures — à éviter tant qu'aucun compte de démonstration n'est garni.
6. **`supportsTablet: false`** dans `app.json` : l'app est iPhone uniquement, donc **aucune capture iPad n'est exigée**. Le bloc iPad visible dans App Store Connect vient de l'ancienne app.
7. **App Store Connect arrondit les coins des captures** (~10 % de la largeur, soit ~120 px sur 1206). Une bordure noire collée au bord de l'image se fait donc **rogner**, ce qui abîme le style néo-brutal. **Solution retenue : aucune bordure au bord de l'image** — le style passe par le titre Archivo Black, le trait émeraude et le châssis noir du téléphone, qui sont tous loin des coins. *(Une variante « carte encadrée » — design rentré de 150 px, bordure conservée et ombre portée dure — avait aussi été produite ; elle tient aussi, mais elle perd 14 % de la surface utile. Benny a choisi la version sans bordure.)*
8. **Les polices doivent être intégrées en data URI.** Depuis une page construite par `page.setContent()` (origine `about:blank`), Chromium **refuse de charger une police en `file://`** (CORS) et le rendu retombe **silencieusement** sur une police système : les titres perdent Archivo Black **sans aucune erreur visible**, seulement un `document.fonts` en `error`. Le script intègre donc polices et logos en base64 et **vérifie `document.fonts` après chaque rendu** (un avertissement s'affiche si une police n'est pas `loaded`).

## 3. Recette

```bash
# 1. Lancer l'app avec la simulation iOS (prix Apple sur l'écran des pass)
EXPO_PUBLIC_SIMULER_IOS=1 npx expo start --web --port 8081

# 2. Captures brutes + habillage + bannière
node scripts/captures-app-store.mjs --url http://localhost:8081 --sortie /tmp/app-store
#    --etapes brut,habille,banniere   pour n'en faire qu'une partie
```

Le script (`scripts/captures-app-store.mjs`) :

- capture à `402 × 874` avec `deviceScaleFactor: 3` → **1206 × 2622** exactement, sans rééchantillonnage ;
- amorce la page (`profil.arrivee` + `navigator.standalone`) et **vérifie l'absence du bandeau web** ;
- habille chaque écran par un **gabarit HTML rendu par Chromium** (fond crème **sans bordure au bord**, logo, titre Archivo Black, trait émeraude, cadre téléphone) — même technique que `scripts/fabriquer-assets.mjs`, donc aucun outil d'image externe ;
- rend la bannière d'en-tête dans les deux tailles.

## 4. Bannière d'en-tête (page produit)

Règles Apple ([bonnes pratiques des assets](https://developer.apple.com/app-store/asset-best-practices/)) :

- **une seule idée claire** — un visuel dense dilue l'impact ;
- **pas de prix, pas de remise, pas d'URL, pas de mention d'une autre plateforme** ;
- **point focal au centre** : le même asset est recadré selon l'emplacement (page produit, résultats de recherche) ;
- le texte doit rester **lisible** après mise à l'échelle.

Le gabarit du script place donc logo, titre et sous-titre **au centre**, avec des bandeaux émeraude haut/bas qui peuvent être rognés sans dommage.

## 5. Sources

- [Spécifications des captures d'écran (App Store Connect Help)](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Bonnes pratiques des assets App Store](https://developer.apple.com/app-store/asset-best-practices/)
- `skills/appshot/references/apple-specs.md` du projet [appshot](https://github.com/ai-zixun/appshot) (récapitulatif des tailles 2026)
