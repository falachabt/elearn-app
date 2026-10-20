import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Image as IconeImage } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { getSupabase } from '@/services/supabase';
import { libelleNote, libellePoints, lireSession, lireUrlsFeuilles, niveauNote, niveauPoints, type NiveauPoints, type Session } from '@/services/travailSujet';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Banniere } from '../../Banniere';
import { Bouton } from '../../Bouton';
import { Carte } from '../../Carte';
import { Ecran } from '../../Ecran';
import { BoutonFermer } from '../../arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'absente' } | { statut: 'pret'; session: Session };

export const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** AS8 · Résultat d'une session : note, points par question, retour aux feuilles. */
export function SessionTravail() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string; kind?: string; ref?: string }>();
  const pret = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [urls, setUrls] = useState<string[] | null>(null);
  const [urlsErreur, setUrlsErreur] = useState(false);

  useEffect(() => {
    if (!pret || !id) return;
    let actif = true;
    void lireSession(getSupabase(), String(id))
      .then((s) => actif && setEtat(s && s.statut === 'done' ? { statut: 'pret', session: s } : { statut: 'absente' }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [id, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const revoir = async () => {
    setUrlsErreur(false);
    try {
      setUrls(await lireUrlsFeuilles(getSupabase(), String(id)));
    } catch {
      setUrlsErreur(true);
    }
  };

  const couleurPoints = (n: NiveauPoints) => (n === 'plein' ? theme.marque.principale : n === 'partiel' ? theme.accent.soleil : theme.etat.erreurDoux);
  const s = etat.statut === 'pret' ? etat.session : null;
  const couleurNote = s && s.score !== null && s.total !== null ? (niveauNote(s.score, s.total) === 'bonne' ? theme.marque.principale : niveauNote(s.score, s.total) === 'moyenne' ? theme.accent.soleil : theme.etat.erreurDoux) : theme.marque.principale;

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('travail.resultatTitre')}</Text>
        </>
      }
      pied={
        s ? (
          <View style={styles.pied}>
            {!s.feuillesEffacees ? <Bouton variante="secondaire" libelle={t('travail.revoirFeuilles')} icone={<IconeImage size={20} color={theme.texte.principal} />} onPress={() => void revoir()} /> : null}
            <Bouton libelle={t('travail.retourSujet')} onPress={retour} />
          </View>
        ) : undefined
      }
    >
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('annales.sujetErreur')} /> : null}
      {etat.statut === 'absente' ? <Banniere ton="info" titre={t('travail.sessionIntrouvable')} /> : null}
      {s && s.score !== null && s.total !== null ? (
        <>
          <Carte style={{ backgroundColor: couleurNote }}>
            <View style={styles.note}>
              <View style={styles.flex}>
                <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('travail.taNote')}</Text>
                <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('travail.session', { date: dateCourte(s.date) })}</Text>
              </View>
              <Text accessibilityLabel={`${t('travail.taNote')} ${libelleNote(s.score, s.total)}`} style={[typo.chiffreXL, { color: theme.texte.surCouleur }]}>{libelleNote(s.score, s.total)}</Text>
            </View>
          </Carte>
          {s.resultat?.resume ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{s.resultat.resume}</Text> : null}
          {s.resultat?.barème_propose ? <Banniere ton="info" titre={t('travail.baremePropose')} /> : null}
          {(s.resultat?.questions ?? []).map((q, i) => (
            <View key={`${q.n}-${i}`} style={[styles.question, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <View style={styles.ligne}>
                <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('travail.question', { n: q.n })}{q.titre ? ` · ${q.titre}` : ''}</Text>
                <View style={[styles.points, { backgroundColor: couleurPoints(niveauPoints(q.points, q.max)), borderColor: theme.bord.fort }]}>
                  <Text style={[typo.donnee, { color: theme.texte.surCouleur }]}>{libellePoints(q.points, q.max)}</Text>
                </View>
              </View>
              {q.commentaire ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{q.commentaire}</Text> : null}
            </View>
          ))}
          {s.feuillesEffacees ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('travail.feuillesEffacees')}</Text> : null}
          {urlsErreur ? <Banniere ton="erreur" titre={t('travail.feuillesErreur')} /> : null}
          {urls ? urls.map((u, i) => <Image key={u} source={{ uri: u }} style={[styles.feuille, { borderColor: theme.bord.fort }]} contentFit="contain" accessibilityLabel={t('travail.feuilleNumero', { n: i + 1 })} />) : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { gap: espace[4] },
  note: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  question: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[2], marginBottom: ombre.carte },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  points: { borderWidth: bord.normal, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  feuille: { width: '100%', height: 420, borderWidth: bord.normal, borderRadius: rayon.m },
});
