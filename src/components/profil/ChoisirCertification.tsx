import { router } from 'expo-router';
import { Award } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { passerAuToeic } from '@/services/changementProfil';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix } from '../certification/ui';
import { FeuilleChangementProfil, type EtatChangement } from './FeuilleChangementProfil';

/**
 * Choix de la certification (P2, branche « Je prépare une certification ») : le TOEIC est le seul examen actuel.
 * Si le profil est déjà TOEIC, « Continuer » revient sans rien écrire. Sinon la bascule passe par la confirmation.
 */
export function ChoisirCertification() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [actuel, setActuel] = useState<boolean | null>(null);
  const [etat, setEtat] = useState<EtatChangement>('repos');

  useEffect(() => {
    let vivant = true;
    lireProfil().then((p) => {
      if (vivant) setActuel(p?.type === 'certification');
    });
    return () => {
      vivant = false;
    };
  }, []);

  const confirmer = async () => {
    if (actuel) {
      router.back();
      return;
    }
    setEtat('charge');
    try {
      await passerAuToeic();
      router.replace('/');
    } catch {
      setEtat('erreur');
    }
  };

  return (
    <Ecran entete={<EnteteToeic titre={t('profilChoix.certificationTitre')} onRetour={() => router.back()} />}>
      <FeuilleChangementProfil
        etat={etat}
        titre={t('profilChoix.passerToeicTitre')}
        texte={t('profilChoix.passerToeicTexte')}
        confirmer={actuel ? t('profilChoix.continuer') : t('profilChoix.passerToeicBouton')}
        annuler={t('profilChoix.annuler')}
        onConfirmer={() => void confirmer()}
        onAnnuler={() => router.back()}
      >
        <LigneChoix
          icone={Award}
          titre={t('profilChoix.toeicTitre')}
          aide={t('profilChoix.toeicAideSeul')}
          radio
          actif
          onPress={() => undefined}
          droite={actuel ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profilChoix.actuel')}</Text> : undefined}
        />
      </FeuilleChangementProfil>
    </Ecran>
  );
}
