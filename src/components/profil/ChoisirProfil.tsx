import { router } from 'expo-router';
import { GraduationCap, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { LogoToeic } from '../certification/LogoToeic';
import { EnteteToeic, LigneChoix } from '../certification/ui';

type Choix = 'secondaire' | 'concours' | 'certification';

/**
 * P2 · Choix du profil en trois : secondaire, concours ou certification. Le profil actuel porte la mention
 * « Actuel ». « Continuer » ouvre la page de changement (issue #125) sur l'onglet du parcours choisi : le choix
 * concret et l'adoption se font là-bas, dans la page — plus aucune feuille de confirmation ici.
 */
export function ChoisirProfil() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [actuel, setActuel] = useState<Choix | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);

  useEffect(() => {
    let vivant = true;
    lireProfil().then((p) => {
      if (!vivant) return;
      const c: Choix | null = p?.type === 'certification' ? 'certification' : p?.type === 'concours' ? 'concours' : p ? 'secondaire' : null;
      setActuel(c);
      setChoix(c);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const continuer = () => {
    router.push({ pathname: '/profil/changer', params: { onglet: choix ?? actuel ?? 'secondaire', source: 'moi' } });
  };

  const badge = (c: Choix) => (actuel === c ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profilChoix.actuel')}</Text> : undefined);

  return (
    <Ecran
      entete={<EnteteToeic titre={t('profilChoix.titre')} onRetour={() => router.back()} />}
      pied={<Bouton libelle={t('profilChoix.continuer')} onPress={continuer} />}
    >
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('profilChoix.intro')}</Text>
      <LigneChoix icone={GraduationCap} titre={t('profilChoix.secondaire')} aide={t('profilChoix.secondaireAide')} radio actif={choix === 'secondaire'} droite={badge('secondaire')} onPress={() => setChoix('secondaire')} />
      <LigneChoix icone={Trophy} titre={t('profilChoix.concours')} aide={t('profilChoix.concoursAide')} radio actif={choix === 'concours'} droite={badge('concours')} onPress={() => setChoix('concours')} />
      <LigneChoix visuel={<LogoToeic />} titre={t('profilChoix.toeic')} aide={t('profilChoix.toeicAide')} radio actif={choix === 'certification'} droite={badge('certification')} onPress={() => setChoix('certification')} />
    </Ecran>
  );
}
