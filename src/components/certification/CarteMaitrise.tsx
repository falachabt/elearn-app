import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { chargerDonneesRevision, partieLaPlusFaible, totauxParEtat } from '@/services/certification/revision';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Appui } from '../Appui';
import { BarreProgression, EnteteToeic, EncadrePointille, PastilleEtat, Squelette } from './ui';
import { useChargement } from './useChargement';

const PARTIES = [1, 2, 3, 4, 5, 6, 7] as const;

/** C2 · Carte de maîtrise : une barre par partie (F4), les totaux par état (F3) et un accès à la partie la plus faible. */
export function CarteMaitrise() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat, recharger } = useChargement(chargerDonneesRevision);

  useEffect(() => {
    suivre('cert_mastery_viewed', { ecran: 'carte' });
  }, []);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser' as never));
  const etiquette = (e: 'acquise' | 'en_progres' | 'fragile' | 'pas_commencee') => t(`certification.resultat.etats.${e}`);

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.carteMaitrise.entete')} onRetour={retour} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={5} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? (() => {
        const { revision } = etat.valeur;
        const totaux = totauxParEtat(revision.notions);
        const faible = partieLaPlusFaible(revision.parties);
        if (faible === null) {
          return (
            <View style={styles.groupe}>
              <EncadrePointille texte={`${t('certification.carteMaitrise.videTitre')}. ${t('certification.carteMaitrise.videTexte')}`} />
            </View>
          );
        }
        return (
          <View style={styles.groupe}>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.carteMaitrise.intro')}</Text>
            <View style={styles.groupe}>
              {PARTIES.map((n) => {
                const p = revision.parties.find((x) => x.partie === n);
                const pourcent = Math.round((p?.m ?? 0) * 100);
                const e = p?.etat ?? 'pas_commencee';
                return (
                  <Appui key={n} accessibilityRole="button" accessibilityLabel={`${t('certification.carteMaitrise.partie', { n })}, ${t('certification.carteMaitrise.pourcent', { n: pourcent })}, ${etiquette(e)}`} onPress={() => router.push({ pathname: '/certification/partie', params: { n: String(n) } } as never)} decalage={0} rayon={rayon.l}>
                    <Carte>
                      <View style={styles.ligne}>
                        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.carteMaitrise.partie', { n })}</Text>
                        <PastilleEtat etat={e} libelle={etiquette(e)} />
                      </View>
                      <BarreProgression pourcent={pourcent} libelle={t('certification.carteMaitrise.partie', { n })} />
                      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.carteMaitrise.pourcent', { n: pourcent })}</Text>
                    </Carte>
                  </Appui>
                );
              })}
            </View>
            <View style={[styles.totaux, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.carteMaitrise.acquise', { n: totaux.acquise })}</Text>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.carteMaitrise.enProgres', { n: totaux.en_progres })}</Text>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.carteMaitrise.fragile', { n: totaux.fragile })}</Text>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.carteMaitrise.pasCommencee', { n: totaux.pas_commencee })}</Text>
            </View>
            <Bouton variante="secondaire" libelle={t('certification.carteMaitrise.voir', { n: faible })} onPress={() => router.push({ pathname: '/certification/partie', params: { n: String(faible) } } as never)} />
          </View>
        );
      })() : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace[2] },
  totaux: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[3], gap: espace[1] },
});
