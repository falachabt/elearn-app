import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { choixFaux, lireSondage, pourcentage, voterSondage, type Sondage } from '@/services/questions';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { useCompteRequis } from '../FeuilleCompte';
import { Squelettes } from '../liste/Squelettes';

/**
 * G6b à G6d · Sondage de l'équipe : options à choix unique avant le vote (aucun résultat), répartition en % après le vote
 * (un vote est définitif), bonne réponse révélée plus tard avec explication facultative. Jamais de vert ou rouge sur les barres.
 */
export function CarteSondage({ postId }: { postId: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const { exiger, feuille } = useCompteRequis();
  const [sondage, setSondage] = useState<Sondage | null>(null);
  const [erreur, setErreur] = useState(false);
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => lireSondage(getSupabase(), postId).then((s) => (setSondage(s), setErreur(false)), () => setErreur(true)), [postId]);
  useEffect(() => {
    if (pret) void charger();
  }, [pret, charger]);

  const voter = () =>
    exiger('question', async () => {
      if (!choix || envoi) return;
      setEnvoi(true);
      try {
        await voterSondage(getSupabase(), postId, choix);
        await charger();
      } catch {
        setErreur(true);
      } finally {
        setEnvoi(false);
      }
    });

  if (erreur && !sondage) return <Banniere ton="erreur" titre={t('questions.erreurTitre')} texte={t('questions.erreurPhrase')} />;
  if (!sondage) return <Squelettes nombre={1} />;

  const bonne = sondage.options.find((o) => o.correcte);
  const date = sondage.reveleLe ? new Date(sondage.reveleLe).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;

  return (
    <View style={styles.zone}>
      {sondage.options.map((o) => {
        const pct = pourcentage(o.votes, sondage.total);
        const juste = sondage.revele && o.correcte;
        const faux = sondage.revele && o.monChoix && o.correcte === false;
        const choisie = sondage.aVote ? o.monChoix : choix === o.id;
        const fond = juste ? theme.marque.principale : faux ? theme.etat.erreur : choisie && !sondage.aVote ? theme.marque.douce : theme.fond.surface;
        return (
          <Appui
            key={o.id}
            accessibilityRole={sondage.aVote ? 'text' : 'radio'}
            accessibilityState={{ selected: choisie, disabled: sondage.aVote }}
            accessibilityLabel={sondage.aVote ? `${o.libelle}, ${pct} %${juste ? `, ${t('questions.bonneReponse')}` : ''}` : o.libelle}
            disabled={sondage.aVote}
            onPress={() => setChoix(o.id)}
            decalage={0}
            rayon={rayon.m}
          >
            <View style={[styles.option, { backgroundColor: fond, borderColor: theme.bord.fort, borderWidth: choisie ? bord.epais : bord.normal }]}>
              {sondage.aVote && !sondage.revele ? <View style={[styles.barre, { width: `${pct}%`, backgroundColor: theme.fond.creux }]} /> : null}
              {!sondage.aVote ? <View style={[styles.cercle, { borderColor: theme.bord.fort, backgroundColor: choisie ? theme.bord.fort : 'transparent' }]} /> : null}
              <Text style={[typo.texte, styles.flex, { color: juste || faux ? theme.texte.surCouleur : theme.texte.principal }]}>
                {juste ? '✓ ' : faux ? '✕ ' : ''}{o.libelle}{sondage.aVote && o.monChoix ? ` · ${t('questions.tonChoix')}` : ''}
              </Text>
              {sondage.aVote ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{pct} %</Text> : null}
            </View>
          </Appui>
        );
      })}
      {!sondage.aVote ? <Bouton libelle={t('questions.voter')} onPress={voter} desactive={!choix || envoi} /> : null}
      {sondage.aVote ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.votesTotal', { n: sondage.total })}</Text> : null}
      {sondage.aVote && !sondage.revele && sondage.reveleLe ? (
        <>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('questions.reponseRevelee', { date: date ?? '' })}</Text>
          <Banniere ton="info" titre={t('questions.onTePrevient')} />
        </>
      ) : null}
      {sondage.revele && bonne ? (
        <View style={[styles.explication, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('questions.bonneReponseDetail', { option: bonne.libelle })}</Text>
          {sondage.explication ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{sondage.explication}</Text> : null}
          {choixFaux(sondage) ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('questions.tonChoixFaux')}</Text> : null}
        </View>
      ) : null}
      {feuille}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  cercle: { width: 20, height: 20, borderRadius: 10, borderWidth: bord.normal },
  explication: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  flex: { flex: 1 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: espace[4], paddingHorizontal: espace[4], paddingVertical: espace[3], borderRadius: rayon.m, overflow: 'hidden' },
  zone: { gap: espace[3] },
});
