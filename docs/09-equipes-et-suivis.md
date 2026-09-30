# Équipes d'agents et où trouver les suivis

Le projet Claude s'appelle « Repenser le produit et l'app ». Il fonctionne avec un **coordinateur** (chat du projet) et des **fils** spécialisés (un Claude par fil). Mémoire partagée du projet (faits, décisions) et dossier partagé `/mnt/project-files/` (hors Git : il n'existe que dans ce projet Claude).

| Équipe / fil | Rôle | Où est son suivi |
|---|---|---|
| Dev app mobile, reprise | Code de `elearn-app` et `elearn-supabase`, phases 2 à 6 | `suivi/dev.md` (passation), PR #1 et #2 d'`elearn-app`, `docs/03-plan-de-dev.md` |
| Plan de développement (terminé) | Ordonnancement des phases | Doc Claude « Plan de développement », mémoire `plan-dev-nouvelle-app` |
| Design complet de l'app | Figma, guide, `theme.ts`, sons | `suivi/design.md` (section « Demandes du coordinateur » pour lui donner des tâches) ; reprise Figma le 1er octobre 2026 |
| Cahier des charges et récompenses | Tient le cahier des charges (v1.3), le modèle financier et le BP, relaie les missions aux agents | `refonte/` (dont `LISEZ-MOI.md`), mémoire `cahier-des-charges-suivi` |
| Refonte du site vitrine | `elearn-site` (PR #5), pages publiques | `elearn-site/docs/` et mémoire `site-vitrine-refonte` |
| Stack et assets marketing | Kit de marque, 99 brouillons Metricool, vidéos, R2, Drive | `marketing/` (`pre-lancement/LISEZ-MOI.md`, `stack-marketing.md`) |
| Conversion / cartographie / besoin client (terminés) | Analyse PostHog, carte de l'ancienne app, 3 positionnements | `cartographie/cartographie-app-actuelle.md`, mémoires `posthog-funnel-findings-2026-09`, `positionnements-produit` |

Agents prévus mais pas lancés : **contenu** (quand l'app aura pris forme : texte « Comment gagner des récompenses », choix du concours blanc du palier 2k), puis suggérés : écoles/partenaires, suivi PostHog, juridique et support avant les stores.

## Dossier partagé `/mnt/project-files/` (hors Git)

`refonte/` (cahier des charges v1.3, business plan, modèle financier, rapport d'analyse, archives v1 à v3) · `design/` (guide HTML, `theme.ts`, sons, aperçus Figma) · `app/apercus/` (captures de la nouvelle app) · `marketing/` (kit, pré-lancement, sources de génération, liens R2) · `suivi/` (`dev.md`, `design.md`) · `cartographie/` · `skills/neobrutal-report/` (skill de rapports PDF de Benny) · `reprise/resume-session-precedente.md`. Les documents confidentiels (BP, modèle, audit) sont aussi copiés dans le dépôt privé `elearn-supabase` (`docs/projet/`) pour que Benny puisse continuer sans ce projet.

## Autres dépôts

- `falachabt/elearn_mobile` (ancienne app, publique) : **ne pas casser**, reste en ligne jusqu'au lancement.
- `falachabt/elearn` (back-office Next.js 16, `staff.elearnprepa.com`, privé) : gère contenu, offres, paiements (pawaPay). PR #14 brouillon (retire `.env.vercel`).
- `falachabt/elearn-site` (site vitrine Next.js 15, privé).
- `falachabt/elearn-supabase` (backend, privé).

## Outils connectés (30/09)

GitHub, Expo (MCP : ne pas lancer de build par ce biais), Supabase (lecture seule en prod), PostHog (projet « Elearn Prepa », Android seulement), Figma, Canva, Metricool, Make, Google Drive/Gmail/Calendar, Cloudflare (R2, Workers AI), Vercel.
