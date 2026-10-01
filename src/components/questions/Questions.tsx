import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useEtatMemorise } from '@/services/memoire';
import { lireProfil } from '@/services/profil';
import { curseurSuivant, lireFil, MATIERES_FIL, type FiltresFil, type Question } from '@/services/questions';
import { couleurMatiere } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { matiere as couleursMatiere, espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { useCompteRequis } from '../FeuilleCompte';
import { EcranErreur } from '../liste/EcranErreur';
import { Puce } from '../liste/Puce';
import { Squelettes } from '../liste/Squelettes';
import { CarteQuestion } from './CarteQuestion';

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  | { statut: 'pret'; questions: Question[]; suivant: string | null; copie: boolean };

type Classe = 'maClasse' | 'toutes' | 'resolues';

/** G1 · Fil des questions (M7-01) : filtres matière et classe, cartes de questions, copie locale au retour et hors ligne. */
export function Questions() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const { exiger, feuille } = useCompteRequis();
  const [niveau, setNiveau] = useState<string | null>(null);
  const [matiere, setMatiere] = useState<string | null>(null);
  const [classe, setClasse] = useState<Classe>('maClasse');
  const [essai, setEssai] = useState(0);
  const [plus, setPlus] = useState(false);
  const filtres: FiltresFil = { matiere, classe: classe === 'maClasse' ? niveau : null, resolues: classe === 'resolues' };
  const cle = `questions.${filtres.classe ?? '*'}.${matiere ?? '*'}.${classe}`;
  const [etat, setEtat] = useEtatMemorise<Etat>(cle, { statut: 'chargement' });

  useEffect(() => {
    void lireProfil().then((p) => setNiveau(p?.niveau ?? null));
  }, []);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    lireFil(getSupabase(), filtres)
      .then(({ questions, copie }) => actif && setEtat({ statut: 'pret', questions, suivant: curseurSuivant(questions), copie }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
    // `filtres` dérive de niveau, matiere et classe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, niveau, matiere, classe, essai, setEtat]);

  const voirPlus = useCallback(async () => {
    if (etat.statut !== 'pret' || !etat.suivant || plus) return;
    setPlus(true);
    try {
      const { questions } = await lireFil(getSupabase(), filtres, etat.suivant);
      setEtat({ ...etat, questions: [...etat.questions, ...questions], suivant: curseurSuivant(questions) });
    } catch {
      // la page suivante reste proposée
    } finally {
      setPlus(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, plus]);

  return (
    <Ecran insetBas={false} pied={<Bouton libelle={`+ ${t('questions.poserCourt')}`} desactive={etat.statut === 'pret' && etat.copie} onPress={() => exiger('question', () => router.push('/question/poser'))} />}>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('questions.titre')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces}>
        <Puce libelle={t('questions.toutes')} choisie={!matiere} onPress={() => setMatiere(null)} />
        {MATIERES_FIL.map((m) => {
          const c = couleurMatiere(m);
          return <Puce key={m} libelle={m} choisie={matiere === m} onPress={() => setMatiere(m)} pastille={c ? couleursMatiere[c] : undefined} />;
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces}>
        <Puce libelle={niveau ? t('questions.maClasse', { classe: niveau }) : t('questions.toutes')} choisie={classe === 'maClasse'} onPress={() => setClasse('maClasse')} />
        <Puce libelle={t('questions.toutesClasses')} choisie={classe === 'toutes'} onPress={() => setClasse('toutes')} />
        <Puce libelle={t('questions.resolues')} choisie={classe === 'resolues'} onPress={() => setClasse('resolues')} />
      </ScrollView>
      {etat.statut === 'chargement' ? <Squelettes nombre={3} /> : null}
      {etat.statut === 'erreur' ? (
        <EcranErreur
          titre={t('questions.erreurTitre')}
          phrase={t('questions.erreurPhrase')}
          reessayer={t('questions.reessayer')}
          onReessayer={() => {
            setEtat({ statut: 'chargement' });
            setEssai((n) => n + 1);
          }}
        />
      ) : null}
      {etat.statut === 'pret' && !etat.questions.length ? (
        <View style={styles.vide}>
          <View style={[styles.rond, { backgroundColor: theme.etat.info, borderColor: theme.bord.fort }]}>
            <Text style={[typo.h1, { color: theme.texte.surCouleur }]}>?</Text>
          </View>
          <Text style={[typo.h3, styles.centre, { color: theme.texte.principal }]}>{t('questions.vide')}</Text>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('questions.videPhrase')}</Text>
        </View>
      ) : null}
      {etat.statut === 'pret' ? (
        <View style={styles.liste}>
          {etat.questions.map((q) => (
            <CarteQuestion key={q.id} q={q} onPress={() => router.push({ pathname: '/question', params: { id: q.id } })} />
          ))}
          {etat.suivant && !etat.copie ? <Bouton variante="secondaire" libelle={t('questions.voirPlus')} onPress={voirPlus} desactive={plus} /> : null}
          {etat.copie ? <Banniere ton="info" titre={t('questions.horsLigne')} /> : null}
        </View>
      ) : null}
      {feuille}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  liste: { gap: espace[4] },
  puces: { gap: espace[3], paddingRight: espace[5] },
  rond: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  vide: { alignItems: 'center', gap: espace[4], paddingVertical: espace[8] },
});
