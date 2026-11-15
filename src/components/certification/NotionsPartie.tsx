import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { etatContenu } from '@/services/certification/etatsContenu';
import { chargerDonneesRevision, notionsDeLaPartie } from '@/services/certification/revision';
import { titreAffiche } from '@/services/certification/titre';
import type { NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { GroupeColle, LigneGroupe } from '../liste/ListeCollee';
import { stylePartie } from './partiesStyle';
import { PuceEtatContenu } from './PuceEtatContenu';
import { EnteteToeic, Squelette } from './ui';
import { useChargement } from './useChargement';

/** C3 · Notions d'une partie, triées de la plus fragile à la plus solide ; une notion se choisit puis se révise ou s'entraîne. */
export function NotionsPartie() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const params = useLocalSearchParams<{ n?: string }>();
  const partie = Math.min(7, Math.max(1, Number(params.n) || 1));
  const { etat, recharger } = useChargement(chargerDonneesRevision);

  const styleDeLaPartie = stylePartie(theme, sombre)[partie] ?? stylePartie(theme, sombre)[1]!;
  const IconePartie = styleDeLaPartie.icone;
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser' as never));
  const aide = (n: NotionListee) =>
    n.reponses === 0 ? t('certification.notionsPartie.zero') : n.reponses === 1 ? t('certification.notionsPartie.ligneUneQuestion', { r: n.reussies }) : n.reussies <= 1 ? t('certification.notionsPartie.ligneReussie', { n: n.reponses, r: n.reussies }) : t('certification.notionsPartie.ligne', { n: n.reponses, r: n.reussies });

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.notionsPartie.entete', { n: partie })} onRetour={retour} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? (() => {
        const notions = notionsDeLaPartie(etat.valeur.revision.notions, partie);
        if (notions.length === 0) return <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.notionsPartie.vide')}</Text>;
        const active = notions[0]!;
        return (
          <View style={styles.groupe}>
            {/* Retouche de novembre 2026 : lignes collées, icône et couleur propres à la partie (partiesStyle). */}
            <GroupeColle>
              {notions.map((n, i) => (
                <LigneGroupe
                  key={n.id}
                  premier={i === 0}
                  titre={titreAffiche(n.titre)}
                  sousTitre={aide(n)}
                  gauche={
                    <View testID="pastille-notion" style={[styles.pastille, { backgroundColor: styleDeLaPartie.couleur, borderColor: theme.bord.fort }]}>
                      <IconePartie size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                    </View>
                  }
                  droite={<PuceEtatContenu etat={etatContenu(n)} />}
                  onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: n.id, source: 'partie' } } as never)}
                />
              ))}
            </GroupeColle>
            <Bouton variante="secondaire" libelle={t('certification.notionsPartie.revoir')} desactive={!active.fiche} onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: active.id, source: 'partie' } } as never)} />
            <Bouton libelle={t('certification.notionsPartie.entrainer', { notion: titreAffiche(active.titre) })} onPress={() => router.push({ pathname: '/certification/serie', params: { notion: active.id } } as never)} />
          </View>
        );
      })() : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  pastille: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
});
