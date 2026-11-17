import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerPageStats } from '@/services/certification/stats';
import { useTheme } from '@/theme/ThemeProvider';
import type { Stats } from '@/services/certification/types';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Appui } from '../Appui';
import { Ecran } from '../Ecran';
import { EnteteToeic, Squelette } from './ui';
import { useChargement } from './useChargement';

/** Récapitulatif TOEIC basé exclusivement sur les indicateurs serveur de la période glissante de 7 jours. */
export function RecapSemaineToeic() {
  const { t, langue } = useTraduction();
  const lire = useCallback(() => chargerPageStats(7), []);
  const { etat, recharger } = useChargement(lire);
  const { theme } = useTheme();
  const donnees = etat.phase === 'ok' ? etat.valeur : null;
  const stats = donnees?.stats;
  const copie = donnees?.depuisCopie && stats?.calculeLe
    ? t('certification.stats.horsLigne', { date: new Date(stats.calculeLe).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }) })
    : null;
  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.recapSemaine.entete')} onRetour={() => router.back()} />}>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.recapSemaine.periode')}</Text>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.stats.erreurTitre')} texte={t('certification.stats.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {donnees?.expire ? <Banniere ton="alerte" titre={t('certification.stats.expire.titre')} texte={t('certification.stats.expire.texte')} /> : null}
      {copie ? <Banniere ton="info" titre={copie} /> : null}
      {stats?.status === 'guest' ? (
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('certification.stats.invite.titre')} texte={t('certification.stats.invite.texte')} />
          <Bouton libelle={t('certification.stats.invite.action')} onPress={() => router.push('/compte/creer')} />
        </View>
      ) : null}
      {stats?.status === 'empty' && !donnees?.expire ? (
        <View style={styles.groupe}>
          <Banniere ton="info" titre={t('certification.stats.vide.titre')} texte={t('certification.stats.vide.texte')} />
          <Bouton libelle={t('certification.stats.vide.action')} onPress={() => router.push('/certification/seance' as never)} />
        </View>
      ) : null}
      {stats?.status === 'first_week' ? <Banniere ton="info" titre={t('certification.stats.premiere.titre')} texte={t('certification.stats.premiere.texte')} /> : null}
      {stats && (stats.status === 'ok' || stats.status === 'first_week') && !donnees?.expire ? <CartesSemaine stats={stats} /> : null}
    </Ecran>
  );
}

function Bloc({ fond, children, ombreDure = true }: { fond: string; children: ReactNode; ombreDure?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.bloc, { backgroundColor: fond, borderColor: theme.bord.fort }, ombreDure && { shadowColor: theme.ombre, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }]}>
      {children}
    </View>
  );
}

/**
 * Récap TOEIC « dynamique » (maquette validée le 16 novembre 2026), sur le modèle de Ma semaine du secondaire : quatre cartes
 * plein écran avec des segments en haut, de grands blocs de couleur et un bouton « Suivant ». Le score reste UN chiffre calculé par
 * nos règles (jamais de fourchette). Une carte sans matière à montrer est sautée.
 */
function CartesSemaine({ stats }: { stats: Stats }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [index, setIndex] = useState(0);
  const tendance = stats.tendance === 'up' ? t('certification.stats.tendanceHausse') : stats.tendance === 'down' ? t('certification.stats.tendanceBaisse') : stats.tendance === 'stable' ? t('certification.stats.tendanceStable') : null;
  const fragiles = stats.parties.filter((p) => p.etat === 'fragile').length;
  const encre = theme.texte.surCouleur;
  const cartes: { cle: string; surtitre: string; titre: string; corps: ReactNode }[] = [];
  const score = stats.score?.valeur;
  cartes.push({
    cle: 'score',
    surtitre: t('certification.recapSemaine.periode'),
    titre: t('certification.recapSemaine.titreScore'),
    corps: (
      <>
        <Bloc fond={theme.marque.principale}>
          <Text style={[typo.etiquette, { color: encre }]}>{t('certification.stats.score')}</Text>
          <Text style={[styles.grand, { color: encre }]}>{score !== null && score !== undefined ? String(score) : t('certification.stats.courbe.pasEncore')}</Text>
          {tendance ? <Text style={[typo.h3, { color: encre }]}>{tendance}</Text> : null}
        </Bloc>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.stats.mention')}</Text>
      </>
    ),
  });
  cartes.push({
    cle: 'jours',
    surtitre: t('certification.recapSemaine.regularite'),
    titre: t('certification.recapSemaine.titreJours', { n: stats.joursSur7 }),
    corps: (
      <Bloc fond={theme.accent.soleil}>
        <Text style={[styles.grand, { color: encre }]}>{String(stats.joursSur7)}</Text>
        <Text style={[typo.h3, { color: encre }]}>{stats.joursSur7 === 1 ? t('certification.stats.joursUn') : t('certification.stats.jours', { n: stats.joursSur7 })}</Text>
      </Bloc>
    ),
  });
  cartes.push({
    cle: 'activite',
    surtitre: t('certification.recapSemaine.activite'),
    titre: t('certification.recapSemaine.titreActivite'),
    corps: (
      <Bloc fond={theme.fond.surface} ombreDure={false}>
        <Ligne libelle={t('certification.recapSemaine.reponses')} valeur={String(stats.reponsesTotal)} />
        <Ligne libelle={t('certification.stats.seances')} valeur={String(stats.seances)} />
        <Ligne libelle={t('certification.stats.lecture')} valeur={t('certification.recapSemaine.minutes', { n: stats.minutesLecture })} dernier />
      </Bloc>
    ),
  });
  if (fragiles > 0) {
    cartes.push({
      cle: 'renforcer',
      surtitre: t('certification.recapSemaine.renforcerSurtitre'),
      titre: t('certification.recapSemaine.renforcerTitre'),
      corps: (
        <>
          <Bloc fond={theme.etat.alerte}>
            <Text style={[styles.grand, { color: encre }]}>{String(fragiles)}</Text>
            <Text style={[typo.h3, { color: encre }]}>{fragiles === 1 ? t('certification.recapSemaine.partieFragile') : t('certification.recapSemaine.partiesFragiles', { n: fragiles })}</Text>
          </Bloc>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.recapSemaine.reflexe')}</Text>
        </>
      ),
    });
  }
  const courante = cartes[Math.min(index, cartes.length - 1)]!;
  const derniere = index >= cartes.length - 1;
  return (
    <View style={styles.groupe}>
      <View style={styles.segments}>
        {cartes.map((c, i) => (
          <View key={c.cle} testID="segment" style={[styles.segment, { borderColor: theme.bord.fort, backgroundColor: i < index ? theme.texte.principal : i === index ? theme.marque.principale : theme.fond.creux }]} />
        ))}
      </View>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{courante.surtitre}</Text>
      <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{courante.titre}</Text>
      {courante.corps}
      {derniere ? (
        <Bouton libelle={t('certification.recapSemaine.toutesStats')} onPress={() => router.push('/statistiques')} retour />
      ) : (
        <Appui accessibilityRole="button" onPress={() => setIndex(index + 1)} decalage={ombre.m} ombre={ombre.m} couleurOmbre={theme.ombre} rayon={rayon.m}>
          <View style={[styles.suivant, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Text style={[typo.bouton, { color: theme.texte.surCouleur }]}>{t('certification.recapSemaine.suivant')}</Text>
            <ArrowRight size={20} strokeWidth={2} color={theme.texte.surCouleur} />
          </View>
        </Appui>
      )}
    </View>
  );
}

function Ligne({ libelle, valeur, dernier }: { libelle: string; valeur: string; dernier?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.ligne, !dernier && { borderBottomWidth: bord.fin, borderBottomColor: theme.bord.doux }]}>
      <Text style={[typo.texte, { color: theme.texte.principal }]}>{libelle}</Text>
      <Text style={[typo.h2, { color: theme.texte.principal }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  segments: { flexDirection: 'row', gap: espace[2] },
  segment: { flex: 1, height: 8, borderWidth: bord.normal, borderRadius: rayon.s },
  bloc: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[2] },
  grand: { fontFamily: 'ArchivoBlack', fontSize: 76, lineHeight: 80, letterSpacing: -2 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: espace[3] },
  suivant: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.m },
});
