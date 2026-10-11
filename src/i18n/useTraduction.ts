import { useCallback, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { contenuExpire, ecouterExpiration } from '@/services/expiration';

import { changerLangue, langueSupportee, LANGUE_PAR_DEFAUT, type CleTexte, type Langue } from './index';

/**
 * Messages d'erreur de chargement d'un contenu (cours, leçons, quiz, entraînement, annales, documents). Quand le
 * contenu hors ligne a expiré, ils sont remplacés partout par le message d'expiration : « vérifie ta connexion »
 * laisserait croire à l'élève qu'il n'a rien téléchargé, alors que son contenu est là mais périmé.
 */
const ERREURS_CONTENU = new Set<CleTexte>([
  'reviser.erreur',
  'reviser.ficheErreur',
  'reviser.leconErreur',
  'reviser.quizErreur',
  'entrainement.erreur',
  'entrainement.erreurPhrase',
  'entrainement.exerciceErreur',
  'entrainement.quizErreur',
  'annales.erreur',
  'annales.erreurPhrase',
  'annales.sujetErreur',
  'document.erreurPhrase',
]);

/** Hook de traduction : `const { t } = useT(); t('accueil.titre')`. Les clés sont typées et l'écran se met à jour au changement de langue. */
export function useTraduction() {
  const { t, i18n } = useTranslation();
  const langue: Langue = langueSupportee(i18n.resolvedLanguage ?? i18n.language) ?? LANGUE_PAR_DEFAUT;
  const expire = useSyncExternalStore(ecouterExpiration, contenuExpire, contenuExpire);
  // Fonction stable tant que la langue et l'expiration ne changent pas : utilisable dans les dépendances des effets.
  const traduire = useCallback(
    (cle: CleTexte, options?: Record<string, unknown>): string => (expire && ERREURS_CONTENU.has(cle) ? (t('reseau.expireErreur') as string) : (t(cle, options) as string)),
    [t, expire],
  );
  return {
    t: traduire,
    langue,
    changerLangue,
  };
}

export const useT = useTraduction;
