# Liste des certifications A2 — implémentation (issue #77)

**De :** Muse — **Date :** 25 octobre 2026 — **Statut :** implémenté et validé en local, commits locaux sur `claude/project-thread-kw792g`, **push en attente du « Pousse » de Benny**.

Réassignation ponctuelle de Benny à Muse pour cette seule issue (25 octobre 2026). L'écran A2 existait déjà (revue du 20 octobre : « Code présent. Vérifié sous réserve ») ; il restait les deux points de l'issue, tranchés par Benny à l'instant.

## 1. Encadré « D'autres certifications » (AC-A2-6)

Décision de Benny (25 octobre 2026) : **afficher l'encadré pointillé en production**, avec un contenu d'attente uniquement — aucune certification listée. Cela remplace le critère AC-A2-6 d'origine (« l'encadré pointillé n'est jamais affiché en production », écart E-05 du cahier v1.35, qui traitait l'encadré comme un repère de maquette).

- Rendu par le composant existant `EncadrePointille` (`src/components/certification/ui.tsx`, bordure pointillée du design system), placé dans `ChoixCertification.tsx` juste sous la liste des examens servis, avant le sélecteur de pays. Affiché quand la liste est chargée (ni pendant le chargement, ni sur l'erreur, ni sur l'état vide qui a déjà son texte).
- Texte exact, nouvelle clé `certification.choix.autresAVenir` : fr « D'autres certifications à venir. » ; en « More certifications coming soon. »

## 2. Logo officiel TOEIC

Décision de Benny : prendre le logo officiel TOEIC (ETS) s'il est disponible en ligne.

**Recherche menée (25 octobre 2026) — logo NON intégré, pour la raison prévue :**

- Aucun fichier du logo TOEIC n'est proposé en téléchargement par ETS (ni sur ets.org / fr.ets.org, ni dans un kit presse ou des ressources de marque publics ; les pages TOEIC officielles n'exposent pas d'asset logo autonome récupérable proprement).
- Les pages légales d'ETS posent une **condition d'usage explicite** : « Use of any ETS logo is strictly prohibited without the express written permission of ETS » et « Use of the ETS logo, product logos or ETS graphics on your product, promotional material or website is strictly prohibited » (`ets.org/legal/trademarks.html`, `ets.org/legal/trademarks/owned.html` ; même texte sur fr.ets.org). Les lignes directrices ETS n'autorisent aux tiers que l'usage **informatif dans le texte** (la mention de non-affiliation déjà affichée sur A2, AC-A2-4).
- Conformément à la consigne, aucun logo tiers ou de mauvaise qualité n'a été intégré. L'emplacement reste **prêt à recevoir le fichier** : `src/components/certification/LogoToeic.tsx` branche automatiquement `assets/images/logo-toeic.png` (clair, fond transparent) et `logo-toeic-sombre.png` (sombre) dès qu'ils sont déposés — il suffit de remplacer `LOGO_TOEIC = null` par les deux `require`. En attendant, la pastille garde l'icône générique actuelle. Le commentaire du composant documente la recherche et la condition ETS.

## Tests

- `src/components/certification/__tests__/arrivee.test.tsx` : le test AC-A2-6 est mis à jour pour la décision révisée — l'encadré « D'autres certifications à venir » est **présent** sous la liste chargée (avant : absence exigée). Suite d'arrivée : 34/34.
- **Validation complète `npm run valider` verte** : typecheck, ESLint, Jest entier (232 suites, 2 563 tests), export Android Hermes.

## Captures de recette (démo, `EXPO_PUBLIC_CERT_DEMO=1`, Playwright)

Dossier `~/workspace/captures-a2-77/` — variantes demandées par l'issue (clair et sombre, 360 et 390 px, haut et bas de page) :

- `a2-390-clair.png` : écran initial, encadré pointillé sous la ligne TOEIC, « Continuer » inactif, mention de non-affiliation visible sans défilement (AC-A2-4).
- `a2-390-clair-choisi.png` : ligne TOEIC sélectionnée (radio cochée, bordure épaisse), « Continuer » actif ; l'encadré reste en place.
- `a2-390-clair-bas.png` : bas de page — le contenu tient entièrement dans la hauteur 844 px (aucun défilement nécessaire ; le pied avec le bouton et la mention est visible dès le haut).
- `a2-390-sombre.png`, `a2-360-clair.png`, `a2-360-sombre.png` : mêmes vérifications en thème sombre et en 360 px, tout tient, encadré lisible dans les deux thèmes.
- Le pays par défaut des captures est « France » (région du navigateur de recette) ; les tests, eux, vérifient le défaut Cameroun via la localisation simulée (AC-A2-3, inchangé).

## Reste à faire

- Fichier logo : en attente d'un fichier obtenu avec l'autorisation d'ETS (voir §2) ; branchement immédiat dès réception.
- Push sur kw792g : sur le « Pousse » de Benny ; le commentaire de livraison de l'issue #77 partira à ce moment-là.
