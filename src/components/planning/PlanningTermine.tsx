import { router, useFocusEffect } from 'expo-router';
import { BookOpen, FileText, Sparkles, Trophy } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import {
  calculerBilanPlanning,
  lirePlanning,
  noterPlanningTermineVu,
  type BilanPhase,
  type BilanPlanning,
  type LeconsValidees,
  type Planning,
} from '@/services/planning';
import { lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Squelettes } from '../liste/Squelettes';

function Entete({ onFermer }: { onFermer: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.entete}>
      <Text accessibilityRole="header" style={[typo.h2, styles.titre, { color: theme.texte.principal }]}>
        {t('planning.termineTitre')}
      </Text>
      <BoutonFermer libelle={t('planning.fermer')} onPress={onFermer} />
    </View>
  );
}

function CarteKpi({ valeur, etiquette }: { valeur: string; etiquette: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.kpi, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
      <Text style={[typo.affiche, { color: theme.texte.principal }]}>{valeur}</Text>
      <Text numberOfLines={1} style={[typo.etiquette, { color: theme.texte.secondaire }]}>
        {etiquette.toUpperCase()}
      </Text>
    </View>
  );
}

function CarteZone({
  titre,
  aide,
  icone: Icone,
  fond,
  bilan,
  elements,
}: {
  titre: string;
  aide: string;
  icone: typeof BookOpen;
  fond: string;
  bilan: BilanPhase;
  elements: string[];
}) {
  const { theme } = useTheme();
  const ratio = bilan.totalSeances > 0 ? Math.round((bilan.seancesFaites / bilan.totalSeances) * 100) : 100;

  return (
    <Carte style={[styles.carteZone, { backgroundColor: fond }]}>
      <View style={styles.enteteZone}>
        <View style={[styles.pastilleIcone, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
          <Icone size={22} strokeWidth={2.2} color={theme.texte.principal} />
        </View>
        <View style={styles.titresZone}>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{titre}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{aide}</Text>
        </View>
      </View>

      <View style={styles.pucesZone}>
        {elements.map((texte, i) => (
          <View key={i} style={[styles.puce, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{texte}</Text>
          </View>
        ))}
      </View>

      <View style={styles.barreProgressionFond}>
        <View style={[styles.barreProgressionRemplie, { width: `${Math.min(100, Math.max(8, ratio))}%`, backgroundColor: theme.marque.forte }]} />
      </View>
    </Carte>
  );
}

export function PlanningTermine() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const idUtilisateur = session?.user?.id;
  const [etat, setEtat] = useState<
    | { type: 'chargement' }
    | { type: 'pret'; bilan: BilanPlanning; planning: Planning }
    | { type: 'erreur' }
  >({ type: 'chargement' });

  const charger = useCallback(async () => {
    try {
      const [{ planning }, lues, scores, exercices] = await Promise.all([
        lirePlanning(getSupabase(), idUtilisateur),
        lireLues().catch(() => ({}) as LeconsValidees),
        lireMeilleursScores().catch(() => ({}) as Record<string, number>),
        lireExercicesFaits().catch(() => ({}) as Record<string, true>),
      ]);
      const bilan = calculerBilanPlanning(planning, lues, { scores, exercices });
      setEtat({ type: 'pret', bilan, planning });
      if (idUtilisateur) void noterPlanningTermineVu(idUtilisateur).catch(() => {});
    } catch {
      setEtat({ type: 'erreur' });
    }
  }, [idUtilisateur]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const quitter = useCallback(() => {
    router.replace('/');
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      quitter();
      return true;
    });
    return () => sub.remove();
  }, [quitter]);

  const allerNouveauPlanning = () => {
    router.replace('/planning');
  };

  const piedBilan = (
    <View style={styles.piedActions}>
      <Bouton libelle={t('planning.nouveauPlanning')} onPress={allerNouveauPlanning} />
      <Bouton variante="texte" libelle={t('planning.retourAccueil')} onPress={quitter} />
    </View>
  );

  return (
    <Ecran entete={<Entete onFermer={quitter} />} piedBordure pied={etat.type === 'pret' ? piedBilan : null}>
      <View style={styles.contenu}>
        {etat.type === 'chargement' ? (
          <View style={styles.bloc}>
            <Squelettes nombre={3} />
          </View>
        ) : null}

        {etat.type === 'erreur' ? (
          <View style={styles.bloc}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('planning.horsLigneTitre')}</Text>
            <Bouton libelle={t('planning.reessayer')} onPress={() => void charger()} />
          </View>
        ) : null}

        {etat.type === 'pret' ? (
          <View style={styles.bloc}>
            {/* Carte de célébration */}
            <View style={[styles.hero, { borderColor: theme.bord.fort, backgroundColor: theme.accent.soleil }]}>
              <View style={[styles.pastilleTrophy, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                <Trophy size={36} strokeWidth={2.2} color={theme.texte.principal} />
              </View>
              <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.surCouleur }]}>
                {t('planning.termineBravo')}
              </Text>
              <Text style={[typo.texte, { color: theme.texte.surCouleur, textAlign: 'center' }]}>
                {etat.bilan.cible
                  ? t('planning.termineSousTitre', { cible: etat.bilan.cible.libelle })
                  : t('planning.termineSousTitreGenerique')}
              </Text>
            </View>

            {/* 3 KPI */}
            <View style={styles.grilleKpis}>
              <CarteKpi valeur={`${etat.bilan.tauxReussite} %`} etiquette={t('planning.statTaux')} />
              <CarteKpi valeur={`${etat.bilan.seancesFaites}/${etat.bilan.totalSeances}`} etiquette={t('planning.statSeances')} />
              <CarteKpi valeur={`${Math.max(1, Math.round(etat.bilan.totalMinutes / 60))} h`} etiquette={t('planning.statHeures')} />
            </View>

            {/* Titre section zones */}
            <View style={styles.enteteSection}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>
                {t('planning.zonesTitre').toUpperCase()}
              </Text>
            </View>

            {/* Zone 1 : Apprentissage */}
            <CarteZone
              titre={t('planning.zoneApprentissage')}
              aide={t('planning.zoneApprentissageAide')}
              icone={BookOpen}
              fond={theme.marque.douce}
              bilan={etat.bilan.apprentissage}
              elements={[
                etat.bilan.apprentissage.leconsFaites === 1
                  ? t('planning.nbLeconsUn')
                  : t('planning.nbLecons', { n: etat.bilan.apprentissage.leconsFaites }),
                etat.bilan.apprentissage.quizFaits === 1
                  ? t('planning.nbQuizUn')
                  : t('planning.nbQuiz', { n: etat.bilan.apprentissage.quizFaits }),
                etat.bilan.apprentissage.exercicesFaits === 1
                  ? t('planning.nbExercicesUn')
                  : t('planning.nbExercices', { n: etat.bilan.apprentissage.exercicesFaits }),
              ]}
            />

            {/* Zone 2 : Annales */}
            <CarteZone
              titre={t('planning.zoneAnnales')}
              aide={t('planning.zoneAnnalesAide')}
              icone={FileText}
              fond={theme.etat.infoDoux}
              bilan={etat.bilan.annales}
              elements={[
                etat.bilan.annales.annalesFaites === 1
                  ? t('planning.nbAnnalesUn')
                  : t('planning.nbAnnales', { n: etat.bilan.annales.annalesFaites }),
                `${etat.bilan.annales.seancesFaites} / ${etat.bilan.annales.totalSeances} ${t('planning.statSeances').toLowerCase()}`,
              ]}
            />

            {/* Zone 3 : Dernière révision */}
            <CarteZone
              titre={t('planning.zoneRevision')}
              aide={t('planning.zoneRevisionAide')}
              icone={Sparkles}
              fond={theme.accent.soleilDoux}
              bilan={etat.bilan.revisionFinale}
              elements={[
                etat.bilan.revisionFinale.revisionsFaites === 1
                  ? t('planning.nbRevisionsUn')
                  : t('planning.nbRevisions', { n: etat.bilan.revisionFinale.revisionsFaites }),
                `${etat.bilan.revisionFinale.seancesFaites} / ${etat.bilan.revisionFinale.totalSeances} ${t('planning.statSeances').toLowerCase()}`,
              ]}
            />
          </View>
        ) : null}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: espace[5], paddingBottom: espace[7] },
  bloc: { gap: espace[4] },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espace[3],
    paddingHorizontal: espace[6],
    paddingTop: espace[4],
    paddingBottom: espace[3],
    borderBottomWidth: bord.fin,
  },
  titre: { flex: 1, fontFamily: 'ArchivoBlack-Regular' },
  hero: {
    padding: espace[5],
    borderRadius: rayon.l,
    borderWidth: bord.normal,
    alignItems: 'center',
    gap: espace[3],
  },
  pastilleTrophy: {
    width: 68,
    height: 68,
    borderRadius: rayon.pilule,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grilleKpis: {
    flexDirection: 'row',
    gap: espace[3],
  },
  kpi: {
    flex: 1,
    paddingVertical: espace[3],
    paddingHorizontal: espace[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rayon.m,
    borderWidth: bord.normal,
    gap: espace[1],
  },
  enteteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espace[2],
  },
  carteZone: {
    padding: espace[4],
    borderRadius: rayon.l,
    borderWidth: bord.normal,
    gap: espace[3],
  },
  enteteZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
  },
  pastilleIcone: {
    width: 44,
    height: 44,
    borderRadius: rayon.m,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titresZone: {
    flex: 1,
    gap: 2,
  },
  pucesZone: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espace[2],
  },
  puce: {
    paddingHorizontal: espace[3],
    paddingVertical: espace[1],
    borderRadius: rayon.s,
    borderWidth: bord.fin,
  },
  barreProgressionFond: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: rayon.pilule,
    overflow: 'hidden',
  },
  barreProgressionRemplie: {
    height: '100%',
    borderRadius: rayon.pilule,
  },
  piedActions: {
    gap: espace[2],
  },
});
