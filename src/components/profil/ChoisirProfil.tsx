import { router } from 'expo-router';
import { Award, GraduationCap, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix } from '../certification/ui';

type Choix = 'secondaire' | 'concours' | 'toeic';

/** P2 · Choix du profil en trois : secondaire, concours ou TOEIC. Le profil actuel porte la mention « Actuel ». */
export function ChoisirProfil() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [actuel, setActuel] = useState<Choix | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);

  useEffect(() => {
    let vivant = true;
    lireProfil().then((p) => {
      if (!vivant) return;
      const c: Choix | null = p?.type === 'certification' ? 'toeic' : p?.type === 'concours' ? 'concours' : p ? 'secondaire' : null;
      setActuel(c);
      setChoix(c);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const continuer = () => {
    const c = choix ?? 'secondaire';
    // Secondaire et concours passent par le choix de classe ou de concours existant (M1-01), en mode modification.
    if (c === 'secondaire') router.push({ pathname: '/classe', params: { type: 'eleve', modifier: '1' } });
    else if (c === 'concours') router.push({ pathname: '/classe', params: { type: 'concours', modifier: '1' } });
    // Le TOEIC : page de choix de l'examen, puis confirmation (rien n'est écrit si le profil ne change pas).
    else router.push('/profil/certification' as never);
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
      <LigneChoix icone={Award} titre={t('profilChoix.toeic')} aide={t('profilChoix.toeicAide')} radio actif={choix === 'toeic'} droite={badge('toeic')} onPress={() => setChoix('toeic')} />
    </Ecran>
  );
}
