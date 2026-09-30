# Stockage Cloudflare R2 et marketing

Décision de Benny (30/09/2026) : réduire les coûts ; **fichiers et médias sur Cloudflare R2** (déjà utilisé par certaines fonctions IA de l'ancien backend), Google Drive en sauvegarde du marketing.

## Règles impératives

1. **Ne jamais rendre public le bucket de production** (`elearnprepa`, contenus payants : cours, annales, corrections). Ne jamais activer son URL publique de développement, ne jamais y écrire depuis un script marketing.
2. Le marketing a son **propre bucket** : `elearnprepa-marketing`, dont l'URL publique (`pub-….r2.dev`) sert aux visuels et vidéos (dossiers `posts/`, `kit/`, `videos/`, `extra/`, `recompenses/`). Les documents confidentiels (business plan, modèle financier) n'y vont **pas**.
3. Aucun jeton, clé ou identifiant de compte Cloudflare dans un dépôt. Les clés se passent par le formulaire « Ajouter un identifiant » de l'environnement Claude (le proxy ajoute l'en-tête, l'agent ne voit pas la clé).
4. Le jeton actuel est un jeton de compte « Workers R2 Storage: Edit » : **il ouvre aussi le bucket de production**. Ne toucher qu'à `elearnprepa-marketing`. Un jeton limité à un seul bucket est refusé par l'API REST.
5. Les copies temporaires de fichiers privés sur R2 (préfixe `tmp-`) doivent être supprimées après usage.
6. Envoi d'objet : API REST Cloudflare `PUT /client/v4/accounts/{id}/r2/buckets/elearnprepa-marketing/objects/{clé}` (le connecteur MCP Cloudflare ne sait pas envoyer d'objets).

## Pour l'app

Le stockage de production (annales, corrections, images d'exercices supprimées après 30 jours) reste côté serveur. L'app ne reçoit que des URL signées ou des fichiers servis par des fonctions serveur. Les images d'exercices photographiées sont supprimées après 30 jours (M3).

## Marketing (aperçu, détail côté équipe marketing)

- Kit de marque : logos SVG/PNG, post 1080×1350, story 1080×1920, flyer A5 (`marketing/kit/` du dossier partagé du projet). Rendu maison en HTML + Playwright, polices du skill `neobrutal-report`.
- Pré-lancement : 99 publications Instagram en **brouillons Metricool** (rien publié), 18 h 30 heure de Douala, plus la vidéo « tout ce qui change » de 48 s. **Aucune publication ni dépense sans accord de Benny.** Une routine hebdomadaire (lundi 8 h 47 Douala) prépare 1 ou 2 posts réactifs.
- Règle Meta : récompenses **collectives** seulement, jamais individuelles contre un like (M15).
- Voix off : provisoire (Cloudflare Workers AI melotts). Benny a accepté ElevenLabs Starter (~5 $/mois) pour une voix africaine ; en attente de sa clé. Tout autre achat demande son accord.
- Connecteurs : Metricool (brand `elearnprepa`, Instagram), Make (scénario de copie R2 → Drive ; limite de 5 Mo par fichier sur l'offre gratuite), Canva (pas de Brand Kit, génération IA peu fiable sur la charte), Google Drive (dossier « Elearn Prepa · Projet »). Pas de connecteur Meta, TikTok ni Runway.
- Compteur d'abonnés pour les paliers M15 : saisie manuelle au lancement (Instagram ~30 abonnés le 30/09 ; Facebook inconnu, non relié à Metricool).
