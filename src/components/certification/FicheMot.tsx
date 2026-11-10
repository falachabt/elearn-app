import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { etatMot } from '@/services/certification/certCarnet';
import { obtenirReglages } from '@/services/certification/etat';
import { urlMedia } from '@/services/certification/media';
import { chargerDonneesRevision, motsEchus } from '@/services/certification/revision';
import { jourDe } from '@/services/certification/jours';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { LecteurAudio } from './LecteurAudio';
import { EnteteToeic, EtiquetteSection, Squelette } from './ui';
import { useChargement } from './useChargement';

async function charger() {
  const donnees = await chargerDonneesRevision();
  const reglages = await obtenirReglages().catch(() => null);
  return { ...donnees, delaiEchecS: reglages?.audioEchecSecondes ?? 20 };
}

/** C7 · Fiche d'un mot : définition, exemple, prononciation, boîte, accès à la séance de mots. */
export function FicheMot() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { etat, recharger } = useChargement(charger);
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser' as never));
  const mot = etat.phase === 'ok' ? etat.valeur.carnet.find((m) => m.id === id) : undefined;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={mot?.mot ?? t('certification.carnet.entete')} onRetour={retour} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.carnet.erreurTitre')} texte={t('certification.carnet.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' && !mot ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.mot.introuvable')}</Text> : null}
      {etat.phase === 'ok' && mot ? (() => {
        const echus = motsEchus(etat.valeur.carnet, jourDe(new Date())).length;
        return (
          <View style={styles.groupe}>
            <Carte>
              <EtiquetteSection texte={mot.categorie ? t('certification.mot.definition', { categorie: mot.categorie }) : t('certification.mot.definitionSans')} />
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{mot.definition}</Text>
              {mot.exemple ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{mot.exemple}</Text> : null}
              {mot.audio ? (
                <LecteurAudio uri={urlMedia(mot.audio)} libelle={t('certification.mot.prononciation')} delaiEchecS={etat.valeur.delaiEchecS} ecran="mot" onPasser={() => undefined} />
              ) : null}
            </Carte>
            <View style={[styles.boite, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.mot.boite')}</Text>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.mot.boiteEtat', { n: mot.boite, etat: t(`certification.carnet.etats.${etatMot(mot.boite)}`) })}</Text>
            </View>
            {echus === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.mot.aucunEchu')}</Text> : null}
            <Bouton libelle={t('certification.mot.commencer')} desactive={echus === 0} onPress={() => router.push({ pathname: '/certification/mots-seance', params: { origine: 'carnet' } } as never)} />
          </View>
        );
      })() : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  boite: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[3] },
});
