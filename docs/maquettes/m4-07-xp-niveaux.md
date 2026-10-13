# Spécification & Conception : [M4-07] XP et Niveaux

Issue GitHub : **falachabt/elearn-app #66**  
Cahier des charges : **M4-07** (Priorité Should) & **M17-09**  
Date d'audit & proposition : 13 octobre 2026

---

## 1. État des lieux de l'existant

### Côté Base de Données (Supabase prod & local)
1. **Tables existantes préservées** :
   - `public.user_xp (userid UUID PK, total_xp INTEGER DEFAULT 0)`
   - `public.xp_history (id SERIAL PK, userid UUID, xp_gained INTEGER, source_type TEXT, source_id TEXT, quiz_id UUID, created_at TIMESTAMPTZ)`
2. **Déclencheurs historiques actifs** :
   - `update_user_xp_on_history_insert` sur `xp_history` -> met à jour `user_xp` (source 'quiz').
   - `trg_calculate_xp` sur `usercourseprogress` -> attribue 10 XP à la fin d'un cours.
   - `trigger_update_xp_on_exam_completion` sur `started_exams` -> attribue les XP des épreuves/concours blancs.
   - Triggers sociaux (`award_xp_on_feed_post`, `award_xp_on_feed_comment`, `award_xp_on_feed_like`).
3. **Sécurité RLS** (appliquée le 11 octobre via `20261011104000_rls_roles_permissions.sql`) :
   - `user_xp` : RLS activée, `select` autorisé pour le titulaire authentifié (`user_xp_select_own`), écriture réservée aux triggers et fonctions Postgres sécurisées.
   - `xp_history` : RLS activée, lecture personnelle.
4. **Données historiques** :
   - L'ancienne base possède déjà des lignes `user_xp` pour les utilisateurs existants. La règle d'or #4 est scrupuleusement respectée : **aucun reset, aucune altération de données existantes**.

### Côté Nouvelle Application Mobile (`elearn-app`)
1. **Absence constatée** :
   - `evenements.ts` ne contient pas encore `xp_earned`.
   - `elearn-app` ne chargeait pas encore `user_xp` dans le profil de l'élève (présent uniquement dans l'ancienne app `elearn_mobile`).
   - L'écran `Moi` (H1) n'affichait pas la jauge de niveau ni le total XP.
   - Aucun écran de barème public n'était disponible pour les élèves.

---

## 2. Principes directeurs & Règles d'or de Benny

1. **Aucun emoji** : Utilisation exclusive des icônes Lucide (`Trophy`, `Star`, `Award`, `ChevronRight`).
2. **Néo-brutal doux & Tokens du thème** : Bordures 2px, ombres dures 3px ou 4px sans flou, respect strict de `theme.color.*` (clair & sombre).
3. **Texte noir sur surface colorée** : Contraste vérifié AA sur soleil, émeraude et lilas.
4. **Zéro valeur monétaire** : Les XP mesurent l'effort et la régularité. Ils ne s'achètent pas et ne sont pas convertibles en crédits.
5. **Intégration sans redessiner** : Ajustement harmonieux de l'écran `Moi` (H1) avec une carte XP compacte et un accès vers la page publique du barème.

---

## 3. Barème public proposé

| Action d'apprentissage | Gain XP | Source technique |
| :--- | :--- | :--- |
| **Bonne réponse à une question de quiz** | **+10 XP** | `source_type: 'quiz'` |
| **Mission du jour validée** | **+50 XP** | `source_type: 'daily_mission'` |
| **Leçon / Chapitre validé** | **+20 XP** | `source_type: 'course'` |
| **Exercice d'entraînement résolu** | **+15 XP** | `source_type: 'exercise'` |
| **Concours blanc / Examen terminé** | **+100 XP** | `source_type: 'exam'` |
| **Question utile posée en entraide** | **+5 XP** | `source_type: 'feed_post'` |
| **Entraide : réponse validée / utile** | **+10 XP** | `source_type: 'feed_comment'` |

---

## 4. Grille des 10 Niveaux

| Niveau | Titre | Palier XP |
| :---: | :--- | :--- |
| **1** | Débutant | 0 à 99 XP |
| **2** | Apprenti | 100 à 249 XP |
| **3** | Confirmé | 250 à 499 XP |
| **4** | Assidu | 500 à 999 XP |
| **5** | Expert | 1 000 à 1 999 XP |
| **6** | Major | 2 000 à 3 499 XP |
| **7** | Virtuose | 3 500 à 5 499 XP |
| **8** | Mentor | 5 500 à 7 999 XP |
| **9** | Maître | 8 000 à 11 999 XP |
| **10** | Légende | 12 000+ XP |

Calcul du niveau et progression vers le palier suivant :
```typescript
export interface PalierNiveau {
  niveau: number;
  nom: string;
  seuilMin: number;
  seuilSuivant: number | null;
}

export function calculerNiveau(totalXp: number): {
  niveau: number;
  nom: string;
  xpActuelDansNiveau: number;
  xpRequisPourSuivant: number;
  progressionRatio: number;
}
```

---

## 5. Maquette visuelle disponible

La maquette HTML complète (clair + sombre + écran barème) a été créée dans :
👉 [m4-07-xp-niveaux.html](file:///D:/Projets/Elearn%20Apps/elearn-app/docs/maquettes/m4-07-xp-niveaux.html)
