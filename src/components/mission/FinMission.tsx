import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireDernierResultat, type ResultatMission } from '@/services/mission';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Apparition } from '../Apparition';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { LigneLien } from '../LigneLien';
import { Rebond } from '../Rebond';
import { BoutonFermer } from '../arrivee/MiniTest';

function Chiffre({ valeur, legende, jaune }: { valeur: string; legende: string; jaune?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.flex}>
      <Carte style={jaune ? { backgroundColor: theme.accent.soleil } : undefined}>
        <Text style={[typo.chiffreL, { color: jaune ? theme.texte.surCouleur : theme.texte.principal }]}>{valeur}</Text>
        <Text style={[typo.legende, { color: jaune ? theme.texte.surCouleur : theme.texte.secondaire }]}>{legende}</Text>
      </Carte>
    </View>
  );
}

/** C3 · Mission terminée (M4-02, M4-03) : score, série, temps, où tu en es par chapitre, jour de grâce expliqué. */
export function FinMission() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [r, setR] = useState<ResultatMission | null>(null);

  useEffect(() => {
    let actif = true;
    lireDernierResultat().then((x) => actif && setR(x));
    return () => {
      actif = false;
    };
  }, []);

  const terminer = () => router.replace('/');
  if (!r) return <Ecran>{null}</Ecran>;

  return (
    <Ecran pied={<Bouton libelle={t('mission.fin')} onPress={terminer} />}>
      <BoutonFermer libelle={t('mission.fin')} onPress={terminer} />
      <Apparition>
        <View style={styles.titre}>
          <Rebond declencheur={1} echelle={1.08} moment={r.serie > 1 ? 'streak' : 'celebrate'}>
            <View style={[styles.trophee, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Ionicons name="trophy-outline" size={30} color={theme.texte.surCouleur} />
            </View>
          </Rebond>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('mission.finTitre')}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('mission.finSousTitre', { score: r.score, total: r.total })}</Text>
          </View>
        </View>
      </Apparition>
      <Apparition delai={80}>
        <View style={styles.ligne}>
          <Chiffre jaune valeur={String(r.serie)} legende={t(r.serie > 1 ? 'mission.joursDeSuite' : 'mission.jourDeSuite')} />
          <Chiffre valeur={t('mission.minutes', { n: Math.max(1, Math.round(r.dureeS / 60)) })} legende={t('mission.deRevision')} />
        </View>
      </Apparition>
      <Apparition delai={160}>
        <Carte>
          <View style={styles.groupe}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('mission.ouTuEnEs')}</Text>
            {r.chapitres.map((c) => (
              <View key={c.chapitre} style={styles.barreBloc} accessible accessibilityLabel={`${c.chapitre} : ${c.bonnes}/${c.total}`}>
                <View style={styles.barreTexte}>
                  <Text numberOfLines={1} style={[typo.petit, styles.flex, { color: theme.texte.principal }]}>{c.chapitre}</Text>
                  <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{`${c.bonnes}/${c.total}`}</Text>
                </View>
                <View style={[styles.piste, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
                  <View style={[styles.rempli, { width: `${(c.bonnes / c.total) * 100}%`, backgroundColor: c.bonnes === c.total ? theme.marque.principale : theme.accent.soleil }]} />
                </View>
              </View>
            ))}
          </View>
        </Carte>
      </Apparition>
      {r.erreurs ? (
        <Apparition delai={240}>
          <View style={styles.groupe}>
            <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('mission.revoirTitre')}</Text>
            {(r.coursRates ?? []).map((c) => (
              <LigneLien
                key={c.id}
                icone="book-outline"
                titre={c.nom}
                detail={t(c.erreurs > 1 ? 'mission.erreursN' : 'mission.erreur1', { n: c.erreurs })}
                onPress={() => {
                  suivre('mission_lesson_review_opened', { cours: c.id });
                  router.push({ pathname: '/cours/chapitre', params: { id: String(c.id), nom: c.nom } });
                }}
              />
            ))}
            <Bouton variante="secondaire" libelle={t('mission.refaireErreurs', { n: r.erreurs })} onPress={() => router.push('/mission/erreurs')} />
          </View>
        </Apparition>
      ) : null}
      <View style={styles.info}>
        <Ionicons name="information-circle-outline" size={18} color={theme.texte.secondaire} />
        <Text style={[typo.legende, styles.flex, { color: theme.texte.secondaire }]}>{t(r.graceUtilisee ? 'mission.graceUtilisee' : 'mission.grace')}</Text>
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  titre: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  trophee: { width: 60, height: 60, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', gap: espace[4] },
  groupe: { gap: espace[4] },
  barreBloc: { gap: espace[2] },
  barreTexte: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  piste: { height: 10, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
  rempli: { height: '100%' },
  info: { flexDirection: 'row', gap: espace[3], alignItems: 'flex-start' },
});
