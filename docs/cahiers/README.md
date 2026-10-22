# Cahiers des charges

Ce dossier contient les cahiers des charges de référence, copiés dans le dépôt pour que tout agent (et Muse) puisse les lire. Les versions vivantes et les PDF restent dans les fichiers du projet (`refonte/` et `toeic/`).

## Lequel fait foi

| Fichier | Périmètre | Version | Fait foi pour |
| --- | --- | --- | --- |
| `cahier-des-charges-toeic-v1.35.md` | Profil TOEIC (certification, moteur d'exercice, banque de questions, tests, statistiques) | v1.35, 22 octobre 2026 | Tout ce qui touche au profil TOEIC. Il est la référence unique entre cahier, maquette et code (règle anti-dérive, section 0.1). |
| `archive-cahier-toeic-v0.3.md` | Ancienne version du cahier TOEIC | v0.3 | Rien : archive, à ne pas suivre. |

Le cahier de référence de l'app hors TOEIC (Elearn Prepa 2, v1.13 du 2 octobre 2026, journal des décisions en section 15) n'est pas copié ici : il contient le modèle économique (budget, revenus, coûts), et ce dépôt est public. Il vit dans le dépôt privé `elearn-supabase`, fichier `docs/projet/cahier-des-charges-elearn-prepa-2-v1.13.md`, branche `claude/project-thread-7rqc96` (commit `e99e5cd`, document seulement, à fusionner dans `main` par Benny). La version de référence reste `refonte/documents-en-ligne/Cahier-des-charges-v4.md` dans les fichiers du projet. Pour le travail sur l'app hors TOEIC, lire ce cahier privé (accès à demander à Benny) et, à défaut, `docs/MEMOIRE_PROJET.md`, `docs/PRIORITES.md` et `docs/CONTEXTE_PRODUIT.md`.

En cas de doute entre deux cahiers : le cahier TOEIC fait foi pour le profil TOEIC. Si deux cahiers se contredisent sur un point commun (par exemple les crédits), on signale l'écart dans un échange et on attend la décision de Benny.

Les versions antérieures du cahier de référence (v1.2 à v1.12) sont dans les fichiers du projet, dans `refonte/cdc-archive/`. Elles ne sont pas copiées ici.

## Comment tenir un cahier à jour

1. **Chaque changement de règle est une ligne datée au journal des changements** (cahier TOEIC : section 11 ; cahier de référence : section 15 « Journal des décisions »). Auteur, date, identifiants touchés, raison.
2. **Une nouvelle version par lot.** L'en-tête porte le numéro, la date et la liste de ce qui a changé depuis la version précédente. L'ancienne version reste dans la copie de référence du projet ; on ne l'efface pas.
3. **Un identifiant stable pour chaque exigence et chaque écran** (par exemple `TOEIC-A1`, `D-49`). Un identifiant retiré est marqué « retiré » ; il n'est jamais réutilisé.
4. **Le code et la maquette suivent le cahier, pas l'inverse** : la règle est écrite dans le cahier, puis la maquette est mise à jour, puis le code suit avec son test (voir `docs/travail-collaboratif.md`).
5. **Ne jamais changer un prix ou une décision validée** sans la décision écrite de Benny. Les montants de crédits viennent de la configuration serveur, pas du texte du cahier.
6. **Copie dans le dépôt** : quand une nouvelle version est validée, on la copie ici sous le nouveau nom, on met à jour ce tableau, et on l'annonce dans `docs/communication/` (un échange `fait`).

## Ce qui n'est pas dans ce dossier

- Les PDF, le modèle financier, le business plan et le cahier de référence de l'app hors TOEIC : ils restent dans le dépôt privé ou les fichiers du projet. Le dépôt `elearn-app` est public : aucun chiffre financier confidentiel ici.
- Le cahier des certifications (exigences CERT-n) : `docs/certifications/`.
