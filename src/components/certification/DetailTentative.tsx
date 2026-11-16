import { router, useLocalSearchParams } from 'expo-router';
import { CircleAlert, Target } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireDetail, type DetailDeTentative } from '@/services/certification/detailTentative';
import { chargerTentative, dureeMinutes } from '@/services/certification/historique';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { resultatTentative, titreTentative } from './HistoriqueTests';
import { EnteteToeic, EtiquetteSection, LigneChoix, ListeChoix, Squelette, TuilesCollees } from './ui';
import { useChargement } from './useChargement';

/** T7 · Détail d'une tentative : score, temps et résultat par partie. */
export function DetailTentative() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lire = useCallback(async () => {
    const tentative = await chargerTentative(String(id));
    return { tentative, detail: tentative ? await lireDetail(tentative.id) : null };
  }, [id]);
  const { etat, recharger } = useChargement(lire);
  const x = etat.phase === 'ok' ? etat.valeur.tentative : null;
  const detail: DetailDeTentative | null = etat.phase === 'ok' ? etat.valeur.detail : null;
  const aNotions = !!detail && detail.notions.length > 0;
  const ratees = detail?.ratees ?? [];
  // « Revoir la notion » : la notion de la première question ratée.
  const notionARevoir = ratees.find((r) => r.notionId)?.notionId ?? null;
  const partieUnique = ratees.length > 0 && ratees.every((r) => r.part === ratees[0]!.part) ? ratees[0]!.part : null;
  const duree = x ? dureeMinutes(x) : null;
  const parties = x?.perPart ? Object.entries(x.perPart).sort((a, b) => Number(a[0]) - Number(b[0])) : [];
  return (
    <Ecran
      entete={<EnteteToeic titre={x ? titreTentative(t, x) : t('certification.tentative.entete')} onRetour={() => router.back()} />}
      pied={ratees.length > 0 || notionARevoir ? (
        <View style={styles.groupe}>
          {ratees.length > 0 ? (
            <Bouton
              libelle={t('certification.tentative.refaireRatees')}
              onPress={() => router.push({ pathname: '/certification/serie', params: { rejeu: '1', taille: String(ratees.length), ...(partieUnique ? { part: String(partieUnique) } : {}) } } as never)}
              retour
            />
          ) : null}
          {notionARevoir ? <Bouton variante="secondaire" libelle={t('certification.tentative.revoirNotion')} onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: notionARevoir } } as never)} /> : null}
        </View>
      ) : undefined}
    >
      {etat.phase === 'chargement' ? <Squelette lignes={3} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.historique.erreurTitre')} texte={t('certification.historique.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' && !x ? <Banniere ton="info" titre={t('certification.tentative.absent')} /> : null}
      {x ? (
        <>
          <TuilesCollees
            tuiles={[
              { cle: 'score', titre: resultatTentative(t, x), aide: t('certification.tentative.score') },
              ...(duree !== null ? [{ cle: 'temps', titre: t('certification.tentative.minutes', { min: duree }), aide: t('certification.tentative.temps') }] : []),
            ]}
          />
          {x.status === 'abandoned' || x.status === 'refunded' ? (
            <Carte><Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tentative.abandonne')}</Text></Carte>
          ) : null}
          {aNotions ? (
            <>
              <EtiquetteSection texte={t('certification.tentative.parNotion')} />
              <ListeChoix>
              {detail!.notions.map((n) => {
                const etatNotion = n.bonnes / n.total >= 0.75 ? 'acquise' : n.bonnes / n.total >= 0.5 ? 'en_progres' : 'fragile';
                return <LigneChoix key={n.id} icone={Target} titre={n.titre} aide={t('certification.tentative.notionAide', { c: n.bonnes, n: n.total, etat: t(`certification.resultat.etats.${etatNotion}`).toLowerCase() })} />;
              })}
              </ListeChoix>
            </>
          ) : null}
          {ratees.length > 0 ? (
            <>
              <EtiquetteSection texte={t('certification.tentative.ratees')} />
              <ListeChoix>
              {ratees.map((r) => (
                <LigneChoix key={r.id} icone={CircleAlert} titre={t('certification.tentative.questionN', { n: r.position })} aide={r.sansReponse ? t('certification.tentative.sansReponse') : r.notionTitre ?? t('certification.tentative.partieQuestion', { n: r.part })} />
              ))}
              </ListeChoix>
            </>
          ) : null}
          {!aNotions && parties.length > 0 ? (
            <>
              <EtiquetteSection texte={t('certification.tentative.parPartie')} />
              <ListeChoix>
              {parties.map(([p, v]) => (
                <LigneChoix key={p} icone={Target} titre={t('certification.tentative.lignePartie', { n: p })} aide={t('certification.tentative.resultat', { c: v.correct, n: v.answered })} />
              ))}
              </ListeChoix>
            </>
          ) : null}
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.tentative.mention')}</Text>
          {ratees.length === 0 && !notionARevoir ? <Bouton variante="secondaire" libelle={t('certification.tentative.retour')} onPress={() => router.back()} /> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
