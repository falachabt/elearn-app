# Certifications et écoles : dossier d'étude

Étude du 7 octobre 2026. Aucun code d'app : uniquement des documents. Branche `claude/certifications-etude`, partie de `claude/project-thread-kw792g`.

| Fichier | Contenu |
| --- | --- |
| `01-etude-certifications.md` | Certifications à viser, format exact du TOEIC, types d'exercices, mini-exercices, contenu, modèle de données, impact sur l'app |
| `02-etude-ecoles.md` | Licences, espace écoles, rôles, données, confidentialité, risques |
| `03-cahier-des-charges.md` | Exigences par lot, skills dédiés, liste des maquettes, critères de réception |
| `04-tarifs-et-modele.md` | Prix FCFA cohérents avec 500 / 2 500 / 7 500, licences d'école |

L'annexe financière (scénarios, coûts, correspondance avec le business plan) n'est **pas dans ce dépôt public** : elle a été remise à Benny séparément, pour `elearn-supabase/docs/projet/`.

## Décisions qui reviennent à Benny

1. **Calendrier.** Recommandation : rien avant les P0 et P1 du lancement de janvier 2027 ; démarrer tout de suite seulement le contenu TOEIC (lot C0) et une première école en concierge (lot E0), qui ne demandent pas de code.
2. **Pass pour la certification.** Option A (recommandée) : les trois pass existants couvrent la certification. Option B : un pass dédié valable jusqu'à la date du test.
3. **Prix des licences d'école.** Proposé : 5 000 FCFA par élève et par an (minimum 100 places) pour le secondaire, 7 500 FCFA par étudiant et par cohorte de six mois (minimum 30 places) pour la certification, pilote gratuit de soixante jours sur cinquante places. Hypothèses jusqu'à cinq entretiens de directeurs.
4. **Contenu et marque.** Contenu 100 % original (voix de synthèse, relecture humaine), mention « non affilié » dans l'app. Accord à donner, et choix de qui relit l'anglais (l'associé, ou un relecteur payé).
5. **Écoles : concierge d'abord.** Première école suivie à la main (codes, export de suivi) avant de construire l'espace web. Oui ou non.
6. **Mineurs dans les écoles.** L'école atteste détenir l'accord des parents par contrat de licence, l'élève voit ce que l'école voit, texte à faire relire. Accord de principe.
7. **Ordre des certifications suivantes.** Proposé : TOEIC Listening and Reading, puis TOEIC Speaking and Writing, TOEFL iBT, IELTS ; TCF et TEF Canada à étudier à part (forte demande, public plus âgé).

## Points à vérifier avant le cahier des charges définitif
- Le gabarit exact des parties 3 et 7 du TOEIC (nombre de dialogues, répartition des passages) sur le guide officiel.
- Les formats TCF, TEF et IELTS (écrits de mémoire, non vérifiés).
- Les règles de la plateforme iOS pour une licence payée hors de l'app.
- Le coût réel d'une question IA et d'un test blanc audio (hypothèses de l'annexe).
