import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerSerie, chargerMission, jourLocal, lireDernierResultat, lireHistorique, type Mission, type ResultatMission } from '@/services/mission';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Apparition } from '../Apparition';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';

type Etat = { mission: Mission | null; serie: number; faite: ResultatMission | null };

/** Titre de la carte : les deux premiers chapitres de la mission. */
export function titreMission(m: Mission | null): string | null {
  const chapitres = [...new Set(m?.questions.map((q) => q.chapitre).filter(Boolean) ?? [])];
  return chapitres.length ? chapitres.slice(0, 2).join(', ') : null;
}

/** C1 · Accueil (M4-01) : la mission du jour en 1 appui, la série, l'aide par photo. */
export function Accueil({ maintenant }: { maintenant?: Date }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<Etat>({ mission: null, serie: 0, faite: null });

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        const jour = jourLocal(maintenant);
        const [profil, historique, dernier] = await Promise.all([lireProfil(), lireHistorique(), lireDernierResultat()]);
        const { serie } = calculerSerie(historique, jour);
        const faite = dernier?.jour === jour ? dernier : null;
        if (actif) setEtat((e) => ({ ...e, serie, faite }));
        // Tirée dès l'accueil : la mission est prête (et jouable hors ligne) avant le premier appui.
        const mission = await chargerMission(getSupabase(), {
          niveau: profil?.niveau ?? '3e',
          pays: profil?.pays ?? 'CM',
          vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') },
          jour,
        }).catch(() => null);
        if (actif) setEtat((e) => ({ ...e, mission }));
      })();
      return () => {
        actif = false;
      };
    }, [maintenant, t]),
  );

  const heure = (maintenant ?? new Date()).getHours();
  const matieres = [...new Set(etat.mission?.questions.map((q) => q.libelleMatiere).filter((m): m is string => !!m) ?? [])].slice(0, 3);
  const surVert = theme.texte.surCouleur;

  return (
    <Ecran insetBas={false}>
      <Apparition>
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.h1, styles.flex, { color: theme.texte.principal }]}>{t(heure >= 17 ? 'mission.bonsoir' : 'mission.bonjour')}</Text>
          {etat.serie > 0 ? (
            <View accessible accessibilityLabel={t('mission.serieLibelle', { n: etat.serie })} style={[styles.serie, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Ionicons name="flame" size={14} color={surVert} />
              <Text style={[typo.etiquette, { color: surVert }]}>{t('mission.serie', { n: etat.serie })}</Text>
            </View>
          ) : null}
        </View>
      </Apparition>

      <Apparition delai={60}>
        <Carte style={{ backgroundColor: theme.marque.principale }}>
          <View style={styles.groupe}>
            <View style={styles.entete}>
              <View style={[styles.pastille, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('mission.etiquette')}</Text>
              </View>
              <Text style={[typo.legende, styles.droite, { color: surVert }]}>{t('mission.duree')}</Text>
            </View>
            {etat.faite ? (
              <>
                <Text style={[typo.h2, { color: surVert }]}>{t('mission.faite')}</Text>
                <Text style={[typo.petit, { color: surVert }]}>{t('mission.faiteTexte', { score: etat.faite.score, total: etat.faite.total })}</Text>
                <Bouton variante="secondaire" libelle={t('mission.refaire')} onPress={() => router.push('/mission')} />
              </>
            ) : (
              <>
                <Text style={[typo.h2, { color: surVert }]}>{titreMission(etat.mission) ?? t('mission.titreDefaut')}</Text>
                {matieres.length ? (
                  <View style={styles.tags}>
                    {matieres.map((m) => (
                      <View key={m} style={[styles.tag, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                        <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{m}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Bouton variante="secondaire" libelle={t('mission.commencer')} onPress={() => router.push('/mission')} retour />
              </>
            )}
          </View>
        </Carte>
      </Apparition>

      <Apparition delai={120}>
        <Appui accessibilityRole="button" accessibilityLabel={`${t('mission.photoTitre')}. ${t('mission.photoTexte')}`} onPress={() => router.push('/photo')} rayon={rayon.l} ombre={4} decalage={3} couleurOmbre={theme.ombre}>
          <View style={[styles.photo, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={[styles.icone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
              <Ionicons name="camera-outline" size={20} color={theme.texte.principal} />
            </View>
            <View style={styles.flex}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('mission.photoTitre')}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('mission.photoTexte')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.texte.principal} />
          </View>
        </Appui>
      </Apparition>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  droite: { marginLeft: 'auto' },
  serie: { flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[3], paddingVertical: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
  groupe: { gap: espace[4] },
  pastille: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.s },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  tag: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.s },
  photo: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
