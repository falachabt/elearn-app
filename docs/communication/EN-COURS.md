# En cours : qui travaille sur quoi

Mis à jour le 23 octobre 2026 (muse, fermeture de l'issue #119). Lire avant de modifier un fichier. Protocole : `docs/communication/README.md`.

Branche de travail : `claude/project-thread-kw792g` (`elearn-app`). `git pull` avant tout push.

| zone | propriétaire | depuis | état | échange |
| --- | --- | --- | --- | --- |
| Profil TOEIC, écrans et moteur d'exercice (`src/` TOEIC) | dev TOEIC (Claude) | 15 octobre 2026 | pris | `echanges/2026-10-22-1955-coordinateur-protocole.md` |
| Profil TOEIC, cahier et journal | dev TOEIC, sous contrôle du coordinateur | 15 octobre 2026 | pris | idem |
| Contrôle qualité TOEIC (`toeic/revue-ecrans.md`) | manager qualité | 17 octobre 2026 | pris | idem |
| Maquettes (`docs/maquettes/`) et méthode design | agent design | 6 octobre 2026 | pris | idem |
| Banque de questions TOEIC et audio (R2, ElevenLabs) | agent contenu | 21 octobre 2026 | bloqué | voir issue du chef de projet |
| Issues GitHub, `docs/PRIORITES.md` | chef de projet | 6 octobre 2026 | pris | idem |
| Cahiers (`docs/cahiers/`) | coordinateur | 22 octobre 2026 | fait | `echanges/2026-10-22-1955-coordinateur-protocole.md` |
| Écrans hors TOEIC (Réviser, Questions, Moi, Photo, paiement) | libre, à prendre avant de modifier | | libre | |
| Première tâche de Muse (hors TOEIC) | Muse | 22 octobre 2026 | fait (choix confirmé par Benny : issue #54) | `echanges/2026-10-22-2032-muse-prise-issue-54.md` |
| Démarrage web et PWA, issue #54 (`public/sw.js`, `public/index.html`, `public/manifest.json`, `vercel.json`, test `src/__tests__/serviceWorker.test.ts`) | Muse | 22 octobre 2026 | libre (tâche fermée le 22 octobre 2026, issue #54 fermée par décision de Benny) | `echanges/2026-10-22-2054-muse-issue-54-fermeture.md` |
| Planning d'études hors ligne, crédits et synchronisation, issue #74 (`src/services/planning.ts`, `src/components/planning/`, `src/services/calendrier.ts`, `src/services/horsLigne.ts`, `src/components/horsLigne/`, `src/i18n/`, migration des caches de contenu vers les fichiers (`stockageContenu`, `reviser`, `entrainement`, `creditsHorsLigne`, `mission`, `donneesLocales`, écrans annales et lecteur PDF, `jest.apres.js`), retours terrain du 23 octobre : sonde de connectivité (`src/services/connectivite.ts`), file de gains XP (`src/services/xp.ts`, `src/session/SessionProvider.tsx`), session servie hors ligne (`src/services/session.ts`), file de synchronisation, garde hors ligne du changement de classe) | Muse | 22 octobre 2026 | libre (issue #74 fermée le 23 octobre 2026 : lots A à D livrés, CI vertes ; voir l'échange de fermeture finale) | `echanges/2026-10-23-1155-muse-issue-74-fermeture-finale.md` |
| libre (issue #118 livrée le 23 octobre 2026 : proposition de téléchargement sur l'accueil + retrait de l'icône de la page hors ligne, commit 1970027, CI verte ; voir l'échange de fermeture) | `echanges/2026-10-23-1245-muse-issue-118-fermeture.md` |
| libre (issue #119 livrée le 23 octobre 2026 : sortie de secours de l'écran de reprise invité, commit 3e78a48, CI verte ; voir l'échange de fermeture) | `echanges/2026-10-23-1445-muse-issue-119-fermeture.md` |
| Pays ouverts par configuration, issue elearn-supabase #108 / M14-03 (nouveau service `src/services/paysOuverts.ts`, filtrage des listes de pays dans `src/components/ParcoursArrivee.tsx` et `src/components/pass/PayerPass.tsx` ; côté base : migration `pays_config`, PR elearn-supabase #160) | Muse | 24 octobre 2026 | libre (livré le 24 octobre 2026 : commit app 4e85a79 local non poussé, validation complète verte ; PR supabase #160 en attente de CI et de validation) | `echanges/2026-10-23-2328-muse-pays-ouverts-108.md` |

## Notes
- Le dev TOEIC et l'agent contenu sont bloqués sur l'accès ElevenLabs et l'écriture R2 : Benny doit reconnecter les accès dans les réglages de l'environnement cloud. Ne pas toucher à ces zones en attendant.
- Muse ne prend aucune zone TOEIC sans échange accepté par son propriétaire.
- Quand une zone est libérée, la ligne passe à « libre » avec la date et le commit.
