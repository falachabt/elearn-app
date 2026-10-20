import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { CLE_CATALOGUE, lireSujet, titreSujet, type DetailSujet, type Sujet } from '@/services/annales';
import { useEtatMemorise } from '@/services/memoire';
import { getSupabase } from '@/services/supabase';
import {
  PREFERENCE_TEMPS_DEFAUT,
  dureeDemarrage,
  enregistrerPreferenceTemps,
  lirePreferenceTemps,
  lireSessions,
  preferenceCoherente,
  type PreferenceTemps,
  type Session,
  type TypeSujet,
} from '@/services/travailSujet';
import { useCredits } from '@/session/CreditsProvider';
import { useSessionPrete } from '@/session/SessionProvider';
import { libelleAvecPrix, useContenuPayant } from '@/session/useContenuPayant';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { BoutonFermer } from '../arrivee/MiniTest';
import { useDepenseCredits } from '../credits/useDepenseCredits';
import { ChoixTemps } from './travail/ChoixTemps';
import { FeuilleCorrigerTravail } from './travail/FeuilleCorrigerTravail';
import { ListeSessions } from './travail/ListeSessions';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; detail: DetailSujet; sujet: Sujet | null };

/**
 * D4 · Détails d'un ancien sujet, le même pour un concours et pour un document de classe (#72) : école, année, temps de
 * travail (chrono libre ou compte à rebours), ouverture du sujet, correction du concours selon le droit, correction du
 * travail de l'élève par l'IA, et ses anciennes sessions avec leur note.
 * Concours : `id` = numéro du sujet. Document de classe : `kind=document`, `id` = document, `nom`, `corr` = corrigé éventuel.
 */
export function SujetAnnale() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, kind: kindParam, nom, corr } = useLocalSearchParams<{ id: string; kind?: string; nom?: string; corr?: string }>();
  const document = kindParam === 'document';
  const kind: TypeSujet = document ? 'document' : 'exam';
  const pret = useSessionPrete();
  const { couts, solde } = useCredits();
  const [etat, setEtat] = useEtatMemorise<Etat>(`annales.sujet.${kind}.${id}`, { statut: 'chargement' });
  const [pref, setPref] = useState<PreferenceTemps>(PREFERENCE_TEMPS_DEFAUT);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionsErreur, setSessionsErreur] = useState(false);
  const [ia, setIa] = useState(false);

  useEffect(() => {
    if (document) {
      setEtat({ statut: 'pret', detail: { id: 0, titre: titreSujet(String(nom ?? '')), urlSujet: '', aCorrection: !!corr, correctionGratuite: false }, sujet: null });
      return;
    }
    if (!pret) return;
    let actif = true;
    void (async () => {
      try {
        const [detail, catalogue] = await Promise.all([lireSujet(getSupabase(), Number(id)), AsyncStorage.getItem(CLE_CATALOGUE)]);
        const sujet = catalogue ? ((JSON.parse(catalogue) as Sujet[]).find((s) => s.id === Number(id)) ?? null) : null;
        if (actif) setEtat({ statut: 'pret', detail, sujet });
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [id, pret, setEtat, document, nom, corr]);

  useEffect(() => {
    void lirePreferenceTemps().then(setPref);
  }, []);

  // Anciennes sessions : relues à chaque ouverture (une correction vient peut-être de finir).
  useEffect(() => {
    if (!pret || pret === 'hors-ligne') return;
    let actif = true;
    void lireSessions(getSupabase(), kind, String(id))
      .then((l) => {
        if (actif) {
          setSessions(l);
          setSessionsErreur(false);
        }
      })
      .catch(() => actif && setSessionsErreur(true));
    return () => {
      actif = false;
    };
  }, [id, kind, pret]);

  const payant = useContenuPayant();
  const { lancer, feuilles } = useDepenseCredits({ rechargeSimple: true });
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));

  const s = etat.statut === 'pret' ? etat.sujet : null;
  const dureeMin = s?.dureeMin ?? null;
  const prefEffective = useMemo(() => preferenceCoherente(pref, dureeMin), [pref, dureeMin]);
  const duree = dureeDemarrage(prefEffective, dureeMin);
  const titre = etat.statut === 'pret' ? etat.detail.titre : '';
  const parametresLecteur = (url: string, titreDoc: string, extra: Record<string, string> = {}) => ({
    url,
    titre: titreDoc,
    kind,
    ref: String(id),
    corrAction: document ? 'document_pdf' : 'exam_correction',
    corrRef: document ? String(corr ?? '') : String(id),
    ...(document ? {} : { sujet: String(id) }),
    ...extra,
  });

  const ouvrirSujet = async (d: DetailSujet) => {
    if (!duree) return;
    void enregistrerPreferenceTemps(prefEffective);
    let url = d.urlSujet;
    if (document) {
      try {
        url = (await lancer<{ url?: string | null }>('document_pdf', String(id)))?.contenu?.url ?? '';
      } catch {
        url = '';
      }
    }
    if (url) router.push({ pathname: '/document', params: parametresLecteur(url, d.titre, { duree, ...(s?.matiere ? { matiere: s.matiere } : {}) }) });
  };

  // La correction ne vient que de depenser_credits (M18-04) : le premier sujet de chaque concours est gratuit.
  const voirCorrection = async (d: DetailSujet) => {
    if (document) {
      const r = await lancer<{ url?: string | null }>('document_pdf', String(corr));
      if (r?.contenu?.url) router.push({ pathname: '/document', params: parametresLecteur(r.contenu.url, `${d.titre} · ${t('annales.correctionTitre')}`, { vue: 'correction' }) });
      return;
    }
    const contenu = await payant.ouvrir<{ url?: string | null }>('exam_correction', d.id);
    if (contenu?.url) router.push({ pathname: '/document', params: parametresLecteur(contenu.url, `${d.titre} · ${t('annales.correctionTitre')}`, { vue: 'correction' }) });
  };

  const prixIA = { cout: couts.ai_question || null, illimite: !!solde?.illimite };
  const pied =
    etat.statut === 'pret' ? (
      <View style={styles.groupe}>
        <Bouton libelle={t('annales.ouvrirSujet')} desactive={!duree} onPress={() => void ouvrirSujet(etat.detail)} retour />
        {etat.detail.aCorrection ? (
          <Bouton
            variante="secondaire"
            libelle={etat.detail.correctionGratuite || document ? t('annales.ouvrirCorrection') : libelleAvecPrix(t, t('annales.ouvrirCorrection'), payant.prix('exam_correction'))}
            desactive={payant.encours}
            onPress={() => void voirCorrection(etat.detail)}
          />
        ) : null}
        <Bouton variante="secondaire" libelle={libelleAvecPrix(t, t('travail.corrigerIA'), prixIA)} icone={<Sparkles size={20} color={theme.texte.principal} />} onPress={() => setIa(true)} />
      </View>
    ) : undefined;

  return (
    <>
      <Ecran pied={pied} entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}>
        {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('annales.sujetErreur')} /> : null}
        {etat.statut === 'pret' ? (
          <>
            <View style={styles.meta}>
              {s ? <Etiquette texte={[s.sigle, s.annee].filter(Boolean).join(' · ')} /> : null}
              {s?.matiere ? <Etiquette jaune texte={s.matiere} /> : null}
            </View>
            <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{etat.detail.titre}</Text>
            {s ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{s.concours}</Text> : null}
            {payant.refus ? (
              <Carte style={{ backgroundColor: theme.accent.soleil }}>
                <View style={styles.groupe}>
                  <View style={styles.meta}>
                    <Ionicons name="lock-closed" size={16} color={theme.texte.surCouleur} />
                    <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{t('annales.correctionTitre')}</Text>
                  </View>
                  <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>
                    {payant.refus.raison === 'erreur' ? t('payant.erreur') : t('payant.insuffisant', { n: payant.refus.cout, solde: payant.refus.solde ?? 0 })}
                  </Text>
                  <Bouton variante="secondaire" libelle={t('annales.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'limite' } })} />
                </View>
              </Carte>
            ) : null}
            <ChoixTemps valeur={prefEffective} onChange={setPref} dureeMin={dureeMin} />
            {!etat.detail.aCorrection ? <Banniere ton="info" titre={t('travail.pasDeCorrigeIA')} /> : null}
            <ListeSessions sessions={sessions} erreur={sessionsErreur} kind={kind} reference={String(id)} />
            {s?.ecole ? (
              <View style={[styles.source, { borderColor: theme.bord.doux }]}>
                <Ionicons name="document-outline" size={14} color={theme.texte.secondaire} />
                <Text style={[typo.legende, styles.flex, { color: theme.texte.secondaire }]}>{t('annales.source', { ecole: s.ecole })}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Ecran>
      {feuilles}
      <FeuilleCorrigerTravail ouverte={ia} onFermer={() => setIa(false)} sujet={{ kind, ref: String(id), titre, matiere: s?.matiere ?? null }} />
    </>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: espace[3], flexWrap: 'wrap' },
  source: { flexDirection: 'row', gap: espace[3], paddingTop: espace[4], borderTopWidth: bord.fin, borderRadius: rayon.aucun },
  flex: { flex: 1 },
});
