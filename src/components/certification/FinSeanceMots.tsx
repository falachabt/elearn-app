import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirReglages } from '@/services/certification/etat';
import { terminerBlocSuivant } from '@/services/certification/seanceJour';
import { effacerSeanceMots, lireSeanceMots, resumerSeanceMots, type EtatSeanceMots, type ResumeSeanceMots } from '@/services/certification/seanceMots';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, EtiquetteSection, Tuile } from './ui';

/** C9 · Fin d'une séance de mots : score, mots qui reviennent demain, répartition par boîte. */
export function FinSeanceMots() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<EtatSeanceMots | null>(null);
  const [resume, setResume] = useState<ResumeSeanceMots | null>(null);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const e = await lireSeanceMots();
      if (!actif) return;
      if (!e || !e.termine) {
        router.replace('/reviser' as never);
        return;
      }
      const r = await obtenirReglages().catch(() => null);
      if (!actif) return;
      setEtat(e);
      setResume(resumerSeanceMots(e, { delaisBoitesJours: r?.delaisBoitesJours ?? [1, 3, 7, 14] }));
    })();
    return () => {
      actif = false;
    };
  }, []);

  const sortir = async () => {
    const seance = etat?.origine === 'seance';
    if (seance) await terminerBlocSuivant();
    await effacerSeanceMots();
    if (seance) router.replace('/certification/seance' as never);
    else router.replace({ pathname: '/reviser', params: { onglet: 'carnet' } } as never);
  };

  if (!resume || !etat) return <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.finMots.entete')} />}><View /></Ecran>;
  const demain = resume.aRevoir === 0 ? t('certification.finMots.aucun') : resume.aRevoir === 1 ? t('certification.finMots.demainUn') : t('certification.finMots.demain', { n: resume.aRevoir });
  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.finMots.entete')} />}>
      <View style={styles.groupe}>
        <Carte>
          <View style={styles.centre}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.finMots.ta')}</Text>
            <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal, textAlign: 'center' }]}>{resume.sus === 1 ? t('certification.finMots.scoreUn', { k: resume.sus, n: resume.total }) : t('certification.finMots.score', { k: resume.sus, n: resume.total })}</Text>
            <Text style={[typo.texte, { color: theme.texte.principal, textAlign: 'center' }]}>{demain}</Text>
          </View>
        </Carte>
        <EtiquetteSection texte={t('certification.finMots.boites')} />
        <View style={styles.grille}>
          {([1, 2, 3, 4] as const).map((n) => (
            <Tuile key={n} titre={resume.boites[n] === 1 ? t('certification.finMots.boiteUn', { n, m: resume.boites[n] }) : t('certification.finMots.boite', { n, m: resume.boites[n] })} />
          ))}
        </View>
        <Bouton libelle={etat.origine === 'seance' ? t('certification.finMots.seance') : t('certification.finMots.retour')} onPress={() => void sortir()} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  centre: { alignItems: 'center', gap: espace[2] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
});
