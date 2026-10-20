import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { getSupabase } from '@/services/supabase';
import { ETAPES_TRAVAIL, definirBrouillon, envoyerTravail, etatsEtapesTravail, lireBrouillon, preparerFeuille, type EtapeTravail, type Issue } from '@/services/travailSujet';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../../Banniere';
import { Bouton } from '../../Bouton';
import { Ecran } from '../../Ecran';
import { FeuilleEpuise } from '../../credits';

const CLES: Record<EtapeTravail, 'travail.etapeEnvoi' | 'travail.etapeCorrection' | 'travail.etapeNotation'> = {
  envoi: 'travail.etapeEnvoi',
  correction: 'travail.etapeCorrection',
  notation: 'travail.etapeNotation',
};

/**
 * AS7 · Correction en cours : étapes réelles signalées par le serveur (chacune avec son chargement, sa réussite ou son
 * échec) ; l'élève peut quitter la page, la correction continue et il est prévenu par notification.
 */
export function AnalyseTravail() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etapes, setEtapes] = useState<EtapeTravail[]>([]);
  const [echec, setEchec] = useState<Exclude<Issue, { type: 'fin' }> | null>(null);
  const [epuise, setEpuise] = useState(false);
  const [parti, setParti] = useState(false);
  const lance = useRef(false);
  const controleur = useRef<AbortController | null>(null);

  const lancer = useCallback(async () => {
    const b = lireBrouillon();
    if (!b || !b.feuilles.length) {
      router.replace('/annales/ordre');
      return;
    }
    const c = new AbortController();
    controleur.current = c;
    setEchec(null);
    setEtapes([]);
    suivre('annale_ai_sent', { feuilles: b.feuilles.length });
    let issue: Issue;
    try {
      const pages = await Promise.all(b.feuilles.map(preparerFeuille));
      if (c.signal.aborted) return;
      issue = await envoyerTravail(getSupabase(), { kind: b.kind, ref: b.ref, pages, titre: b.titre, matiere: b.matiere, tempsS: b.tempsS, signal: c.signal, surEtape: (e) => { if (!c.signal.aborted) setEtapes((l) => (l.includes(e) ? l : [...l, e])); } });
    } catch {
      issue = { type: 'erreur' };
    }
    // Page quittée : la correction continue côté serveur et la notification prend le relais.
    if (c.signal.aborted) return;
    if (issue.type === 'fin') {
      suivre('annale_ai_done', { points: issue.score, total: issue.total });
      definirBrouillon(null);
      router.replace({ pathname: '/annales/session', params: { id: issue.id, kind: b.kind, ref: b.ref } });
      return;
    }
    suivre('annale_ai_failed', { raison: issue.type });
    if (issue.type === 'credits') setEpuise(true);
    setEchec(issue);
  }, []);

  useEffect(() => {
    if (!lance.current) {
      lance.current = true;
      void lancer();
    }
    return () => {
      controleur.current?.abort();
      lance.current = false;
    };
  }, [lancer]);

  /** Coupe la connexion : le serveur le voit, termine la correction et envoie la notification. */
  const quitter = () => {
    controleur.current?.abort();
    definirBrouillon(null);
    setParti(true);
  };
  const terminerDepart = () => router.replace('/reviser');

  const etats = etatsEtapesTravail(etapes, !!echec);
  const message =
    echec?.type === 'illisible' ? t('travail.illisible')
    : echec?.type === 'hors-ligne' ? t('travail.horsLigne')
    : echec?.type === 'quota' ? t('travail.quota')
    : echec?.type === 'limite' ? t('travail.limite')
    : echec?.type === 'erreur' ? t('travail.erreurIA')
    : null;
  const nomEtat = (e: 'attente' | 'en_cours' | 'fait' | 'echec') => (e === 'fait' ? `, ${t('travail.etapeFaite')}` : e === 'en_cours' ? `, ${t('travail.etapeEnCours')}` : e === 'echec' ? `, ${t('travail.etapeEchec')}` : '');

  if (parti) {
    return (
      <Ecran defilement={false} pied={<Bouton libelle={t('travail.partiOk')} onPress={terminerDepart} />}>
        <View accessibilityLiveRegion="polite" style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('travail.partiTitre')}</Text>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('travail.partiTexte')}</Text>
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran
      defilement={false}
      pied={
        echec ? (
          <View style={styles.pied}>
            {echec.type === 'illisible' ? (
              <Bouton libelle={t('travail.reprendrePhotos')} onPress={() => router.replace('/annales/photos')} />
            ) : (
              <Bouton libelle={t('travail.reessayer')} onPress={() => { lance.current = true; void lancer(); }} />
            )}
            <Bouton variante="secondaire" libelle={t('travail.ordreTitre')} onPress={() => router.replace('/annales/ordre')} />
          </View>
        ) : etapes.length ? (
          <Bouton variante="secondaire" libelle={t('travail.quitterAnalyse')} onPress={quitter} />
        ) : undefined
      }
    >
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('travail.analyseTitre')}</Text>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('travail.analyseTexte')}</Text>
      {message ? <Banniere ton="erreur" titre={message} /> : null}
      {echec?.type === 'illisible' && echec.raison ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('travail.illisibleRaison', { raison: echec.raison })}</Text> : null}
      <View accessibilityLiveRegion="polite" style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
        {ETAPES_TRAVAIL.map((e, i) => {
          const etat = etats[i];
          return (
            <View key={e} accessibilityLabel={`${t(CLES[e])}${nomEtat(etat)}`} style={styles.ligne}>
              <View style={[styles.coche, { borderColor: theme.bord.fort, backgroundColor: etat === 'fait' ? theme.etat.succes : etat === 'echec' ? theme.etat.erreur : 'transparent' }]}>
                {etat === 'en_cours' ? <ActivityIndicator size="small" color={theme.marque.principale} /> : <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{etat === 'fait' ? '✓' : etat === 'echec' ? '✕' : ''}</Text>}
              </View>
              <Text style={[typo.texteFort, { color: theme.texte.principal, opacity: etat === 'attente' ? 0.55 : 1 }]}>{t(CLES[e])}</Text>
            </View>
          );
        })}
      </View>
      <FeuilleEpuise ouverte={epuise} onFermer={() => setEpuise(false)} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[4] },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[4], marginTop: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  coche: { width: 24, height: 24, borderRadius: 12, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
