import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { apresDerniereLecon } from '@/services/entrainement';
import { lireLecon, lireLecons, lireLues, noterDerniereLecon, type ContenuLecon, type Lecon } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { Feuille } from '../Feuille';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Blocs } from './Blocs';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; lecon: ContenuLecon; lecons: Lecon[] };

/**
 * D2 · Leçon (M5-01) : contenu court, position dans le chapitre, leçon suivante. La leçon ne compte dans la progression
 * qu'une fois ses questions réussies : avant de passer à la suite, une feuille invite à y répondre.
 */
export function LeconLecteur() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, cours, matiere } = useLocalSearchParams<{ id: string; cours?: string; matiere?: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [validee, setValidee] = useState(false);
  const [invitation, setInvitation] = useState(false);
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    const client = getSupabase();
    void (async () => {
      try {
        const lecon = await lireLecon(client, Number(id));
        const lecons = await lireLecons(client, Number(cours ?? lecon.coursId)).catch(() => []);
        const lues = await lireLues();
        if (!actif) return;
        setValidee(lues[lecon.id] !== undefined);
        setEtat({ statut: 'pret', lecon, lecons });
        const k = lecons.findIndex((l) => l.id === lecon.id);
        void noterDerniereLecon({ id: lecon.id, cours: Number(cours ?? lecon.coursId), nom: lecon.nom, numero: k + 1, minutes: k >= 0 ? lecons[k].minutes : null });
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [id, cours, pret]);

  // Au retour du quiz de la leçon : elle est peut-être validée maintenant.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireLues()
        .then((lues) => actif && lues[Number(id)] !== undefined && setValidee(true))
        .catch(() => {});
      return () => {
        actif = false;
      };
    }, [id]),
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const position = etat.statut === 'pret' ? etat.lecons.findIndex((l) => l.id === etat.lecon.id) : -1;
  const suivante = etat.statut === 'pret' && position >= 0 ? etat.lecons[position + 1] : undefined;
  const courante = etat.statut === 'pret' && position >= 0 ? etat.lecons[position] : undefined;

  const ouvrirQuiz = () => {
    if (etat.statut !== 'pret') return;
    setInvitation(false);
    router.push({ pathname: '/cours/quiz', params: { cours: String(etat.lecon.coursId), lecon: String(etat.lecon.id), suivante: suivante ? String(suivante.id) : '', matiere: matiere ?? '' } });
  };
  const continuer = () => {
    if (etat.statut !== 'pret') return;
    setInvitation(false);
    if (suivante) router.replace({ pathname: '/cours/lecon', params: { id: String(suivante.id), cours: String(etat.lecon.coursId), matiere: matiere ?? '' } });
    // Dernière leçon : la fin de chapitre propose le quiz et les exercices du chapitre (M5-11).
    else {
      const coursId = etat.lecon.coursId;
      void apresDerniereLecon(coursId, () => router.replace({ pathname: '/cours/fin', params: { cours: String(coursId) } }), retour);
    }
  };
  const avancer = () => {
    if (validee) return continuer();
    suivre('lesson_quiz_invited', { lecon: etat.statut === 'pret' ? etat.lecon.id : 0 });
    setInvitation(true);
  };
  const quiz = etat.statut === 'pret' && !validee ? <Bouton variante="secondaire" libelle={t('reviser.quiz')} onPress={ouvrirQuiz} /> : null;
  const pied =
    etat.statut === 'pret' ? (
      <View style={styles.pied}>
        {quiz}
        <Bouton libelle={t(suivante ? 'reviser.suivante' : 'reviser.finChapitre')} onPress={avancer} retour />
      </View>
    ) : undefined;

  const details =
    etat.statut === 'pret' && position >= 0
      ? [t('reviser.leconN', { n: position + 1, total: etat.lecons.length }), courante?.minutes ? t('reviser.minutes', { n: courante.minutes }) : null].filter(Boolean).join(' · ')
      : null;

  return (
    <>
      <Ecran
        pied={pied}
        entete={
          <>
            <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
            <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{etat.statut === 'pret' ? etat.lecon.nom : ''}</Text>
          </>
        }
      >
        {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('reviser.leconErreur')} /> : null}
        {etat.statut === 'pret' ? (
          <>
            <View style={styles.meta}>
              {matiere ? <Etiquette texte={matiere} /> : null}
              {details ? <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{details}</Text> : null}
            </View>
            {etat.lecon.blocs.length ? <Blocs blocs={etat.lecon.blocs} /> : <Banniere ton="info" titre={t('reviser.leconVide')} />}
          </>
        ) : null}
      </Ecran>
      <Feuille
        ouverte={invitation}
        onFermer={() => setInvitation(false)}
        icone="help-circle-outline"
        titre={t('reviser.invitationTitre')}
        texte={t('reviser.invitationTexte')}
        actions={[
          { libelle: t('reviser.quiz'), onPress: ouvrirQuiz },
          { libelle: t('reviser.invitationPasser'), onPress: continuer, variante: 'secondaire' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { gap: espace[3] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: espace[3], flexWrap: 'wrap' },
});
