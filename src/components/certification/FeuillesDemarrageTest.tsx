import { router } from 'expo-router';
import { Gift, Wallet } from 'lucide-react-native';
import { Text } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { LigneChoix } from './ui';

/**
 * Blocages au démarrage d'un test composé (liste des tests et détail d'un test fait) : la règle produit
 * est qu'un blocage s'explique par une feuille du bas qui dit la raison — jamais un silence, ni un petit
 * texte perdu sous la liste ou sous les boutons (constats terrain du 27 octobre 2026 : toucher un mixte
 * non fait ne faisait rien, les boutons du détail d'un mixte semblaient morts, alors que le serveur
 * refusait le démarrage). Mêmes textes et même forme que la feuille du réglage d'un mini-test
 * (`ReglageMini`) : l'élève retrouve le même vocabulaire quel que soit l'écran d'où il part.
 */

/** Échec de démarrage (contenu indisponible, erreur serveur) : la raison, et le code court pour le support. */
export function FeuilleErreurDemarrage({ code, onFermer }: { code: string | null; onFermer: () => void }) {
  const { t } = useTraduction();
  return (
    <Feuille
      ouverte={code !== null}
      onFermer={onFermer}
      titre={t('certification.mini.erreurTitre')}
      texte={t('certification.mini.erreurTexte')}
      mention={code ? t('certification.mini.erreurCode', { code }) : undefined}
      actions={[{ libelle: t('certification.mini.plusTard'), onPress: onFermer, variante: 'texte' }]}
    />
  );
}

/** Crédits insuffisants : le coût, le solde, et les deux façons de recharger — comme au réglage d'un mini-test. */
export function FeuilleCreditsInsuffisants({
  blocage,
  coutRepli,
  onFermer,
}: {
  blocage: { cout: number | null; solde: number | null } | null;
  /** Coût affiché si le serveur n'a pas renvoyé le sien (lu dans la configuration des crédits). */
  coutRepli: number;
  onFermer: () => void;
}) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cout } = useTextesCredits();
  const soldeTexte =
    blocage === null || blocage.solde === null
      ? null
      : blocage.solde === 1
        ? t('certification.mini.insuffisantSoldeUn')
        : t('certification.mini.insuffisantSolde', { n: blocage.solde });
  return (
    <Feuille
      ouverte={blocage !== null}
      onFermer={onFermer}
      titre={t('certification.mini.insuffisantTitre', { cout: cout(blocage?.cout ?? coutRepli) })}
      texte={t('certification.mini.insuffisantTexte')}
      actions={[{ libelle: t('certification.mini.plusTard'), onPress: onFermer, variante: 'texte' }]}
    >
      {soldeTexte ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{soldeTexte}</Text> : null}
      <LigneChoix
        icone={Wallet}
        titre={t('certification.mini.recharger')}
        aide={t('certification.mini.rechargerAide')}
        onPress={() => {
          onFermer();
          router.push('/offres?declencheur=limite');
        }}
      />
      <LigneChoix
        icone={Gift}
        titre={t('certification.mini.gagner')}
        aide={t('certification.mini.gagnerAide')}
        onPress={() => {
          onFermer();
          router.push('/certification/gagner' as never);
        }}
      />
    </Feuille>
  );
}
