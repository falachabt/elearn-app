# Avant la production et les stores

Liste décidée par Benny (30/09/2026) : le nettoyage sécurité est **différé** pendant le développement, mais **rien ne part en production ni sur les stores** tant que cette liste n'est pas cochée, au plus tard en phase 5. Chaque point demande l'accord explicite de Benny et la relecture de la PR. Le détail technique (tables, clés concernées) est dans le dépôt privé `elearn-supabase` (`docs/AUDIT-SECURITE-2026-09-30.md`, `docs/projet/`).

- [ ] **RLS Supabase** : 83 tables du schéma `public` sans sécurité par ligne, dont les paiements et les comptes ; `anon` a tous les droits. Corriger par lots (paiements d'abord), testés en local, appliqués par migrations versionnées. Ajouter aussi : vues en `security_invoker`, `search_path` fixé sur les fonctions, `REVOKE EXECUTE` pour `anon` sur les fonctions non publiques, auth (code e-mail < 1 h, protection mots de passe compromis).
- [ ] **Révoquer les clés secrètes** restées dans l'historique git des anciens dépôts (fournisseurs de paiement, IA, vidéo, e-mail, mot de passe de base, jeton Vercel, secret de pont d'authentification, deux comptes de service Google). Les retirer des fichiers ne suffit pas.
- [ ] **Supabase de prod** : activer `enable_manual_linking` et la redirection `elearnprepa://auth/callback` pour la liaison Google ; configurer les fournisseurs Google, Apple et Facebook.
- [ ] **Appliquer en prod, après relecture** : `20260930120000_auth_insert_trigger_security_definer`, `20260930130000_referrals_capture`, `20260930150000_first_results` (et les suivantes).
- [ ] Trancher le bug suspect `refresh_secondary_daily_content_for_date` contre le trigger de validation.
- [ ] **Paiements** : webhook pawaPay comme **seule** source du statut, événement `payment_succeeded`, aucune écriture de statut depuis l'app ; règle Apple pour l'achat sur iOS (M8-13) validée.
- [ ] **Liens universels / App Links** et domaine configurés avec un prochain build ; projets Vercel de l'ancienne app qui échouent au build.
- [ ] Reprise des comptes existants (M2-06) et de l'historique de paiements testées.
- [ ] Suppression du compte depuis l'app (M2-08) ; pages légales (CGU, confidentialité, suppression) relues par un juriste (durées de conservation proposées 2 ans / 90 jours : à valider).
- [ ] Recette de la section 13 du cahier des charges : test terrain 20 élèves, 10 paiements réels MTN et Orange, M16 sur Android d'entrée de gamme et iPhone.
- [ ] Basculer le canal EAS `production` et les stores **seulement** avec l'accord de Benny ; droits sur les annales vérifiés ; compte Apple Developer et Play Console prêts (déjà ouverts).
- [ ] Anonymous sign-ins : déjà activés en prod par Benny (à conserver).
