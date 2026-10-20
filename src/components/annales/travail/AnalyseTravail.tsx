import { router } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { getSupabase } from '@/services/supabase';
import { ETAPES_TRAVAIL, definirBrouillon, envoyerTravail, etatsEtapesTravail, lireBrouillon, preparerFeuille, type EtapeTravail, type Issue } from '@/services/travailSujet';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Banniere } from '../../Banniere';
import { Bouton } from '../../Bouton';
import { Ecran } from '../../Ecran';
import { FeuilleEpuise } from '../../credits';

const CLES: Record<EtapeTravail, 'travail.etapeEnvoi' | 'travail.etapeCorrection' | 'travail.etapeNotation'> = {
  envoi: 'travail.etapeEnvoi',
  correction: 'travail.etapeCorrection',
  notation: 'travail.etapeNotation',
};

/** AS7 · Correction en cours : étapes réelles signalées par le serveur ; issues d'échec avec crédits rendus. */
export function AnalyseTravail() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etapes, setEtapes] = useState<EtapeTravail[]>([]);
  const [echec, setEchec] = useState<Exclude<Issue, { type: 'fin' }> | null>(null);
  const [epuise, setEpuise] = useState(false);
  const lance = useRef(false);

  const lancer = useCallback(async () => {
    const b = lireBrouillon();
    if (!b || !b.feuilles.length) {
      router.replace('/annales/ordre');
      return;
    }
    setEchec(null);
    setEtapes([]);
    suivre('annale_ai_sent', { feuilles: b.feuilles.length });
    let issue: Issue;
    try {
      const pages = await Promise.all(b.feuilles.map(preparerFeuille));
      issue = await envoyerTravail(getSupabase(), { kind: b.kind, ref: b.ref, pages, titre: b.titre, matiere: b.matiere, tempsS: b.tempsS, surEtape: (e) => setEtapes((l) => (l.includes(e) ? l : [...l, e])) });
    } catch {
      issue = { type: 'erreur' };
    }
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
    if (lance.current) return;
    lance.current = true;
    void lancer();
  }, [lancer]);

  const etats = etatsEtapesTravail(etapes);
  const message =
    echec?.type === 'illisible' ? t('travail.illisible')
    : echec?.type === 'hors-ligne' ? t('travail.horsLigne')
    : echec?.type === 'quota' ? t('travail.quota')
    : echec?.type === 'limite' ? t('travail.limite')
    : echec?.type === 'erreur' ? t('travail.erreurIA')
    : null;

  return (
    <Ecran
      defilement={false}
      pied={
        echec ? (
          <View style={styles.pied}>
            {echec.type !== 'illisible' ? <Bouton libelle={t('travail.reessayer')} onPress={() => { lance.current = true; void lancer(); }} /> : null}
            <Bouton variante="secondaire" libelle={t('travail.ordreTitre')} onPress={() => router.replace('/annales/ordre')} />
          </View>
        ) : undefined
      }
    >
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('travail.analyseTitre')}</Text>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('travail.analyseTexte')}</Text>
      {message ? <Banniere ton="erreur" titre={message} /> : null}
      <View style={styles.liste}>
        {ETAPES_TRAVAIL.map((e, i) => {
          const etat = echec && etats[i] === 'en_cours' ? 'attente' : etats[i];
          return (
            <View key={e} style={styles.zone}>
              {etat === 'en_cours' ? <View style={[styles.ombre, { backgroundColor: theme.ombre }]} /> : null}
              <View
                accessibilityLabel={t(CLES[e])}
                accessibilityState={{ busy: etat === 'en_cours' }}
                style={[styles.etape, { backgroundColor: etat === 'en_cours' ? theme.marque.douce : theme.fond.surface, borderColor: etat === 'attente' ? theme.bord.doux : theme.bord.fort }]}
              >
                {etat === 'fait' ? <Check size={20} color={theme.texte.principal} strokeWidth={2} /> : etat === 'en_cours' ? <ActivityIndicator size="small" color={theme.marque.forte} /> : <Clock size={20} color={theme.texte.secondaire} strokeWidth={2} />}
                <Text style={[typo.texte, styles.flex, { color: etat === 'attente' ? theme.texte.secondaire : theme.texte.principal }]}>{t(CLES[e])}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <FeuilleEpuise ouverte={epuise} onFermer={() => setEpuise(false)} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { gap: espace[4] },
  liste: { gap: espace[4], marginTop: espace[4] },
  zone: { paddingBottom: ombre.carte, paddingRight: ombre.carte },
  ombre: { position: 'absolute', left: ombre.carte, top: ombre.carte, right: 0, bottom: 0, borderRadius: rayon.m },
  etape: { minHeight: cibleMin, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: espace[4], flexDirection: 'row', alignItems: 'center', gap: espace[4] },
});
