# Tests E2E Maestro — Elearn Prepa

Ce répertoire contient les flux de test End-to-End (E2E) automatisés pour l'application mobile Elearn Prepa sous Android et iOS.

## Prérequis
1. Installer [Maestro CLI](https://maestro.mobile.dev/) :
   - **macOS / Linux** : `curl -fsSL "https://get.maestro.mobile.dev" | bash`
   - **Windows** : Télécharger le binaire Maestro ou exécuter via WSL / PowerShell.
2. Démarrer un émulateur Android (AVD) ou un simulateur iOS.
3. Installer le build de dev ou preview (`com.ezadrive.elearn`).

## Exécution du parcours critique (B10-11)
Le parcours critique teste la chaîne clé de l'application :
1. Accueil et carte de la **Mission du jour**.
2. Parcours d'un **Quiz** (sélection d'option).
3. Écran du **Pass** et ouverture du récapitulatif de **Paiement Mobile Money**.

Pour lancer le test :
```bash
maestro test .maestro/parcours_critique.yaml
```
