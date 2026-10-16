import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerDonneesRevision, notionsDeLaPartie } from '@/services/certification/revision';
import type { NotionListee } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix, PastilleEtat, Squelette } from './ui';
import { useChargement } from './useChargement';

/** C3 · Notions d'une partie, triées de la plus fragile à la plus solide ; une notion se choisit puis se révise ou s'entraîne. */
export function NotionsPartie() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ n?: string }>();
  const partie = Math.min(7, Math.max(1, Number(params.n) || 1));
  const { etat, recharger } = useChargement(chargerDonneesRevision);
  const [choisie, setChoisie] = useState<string | null>(null);

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
        const active = notions.find((n) => n.id === choisie) ?? notions[0];
        return (
          <View style={styles.groupe}>
            {notions.map((n) => (
              <LigneChoix
                key={n.id}
                icone={BookOpen}
                titre={n.titre}
                aide={aide(n)}
                radio
                actif={n.id === active.id}
                onPress={() => setChoisie(n.id)}
                droite={<PastilleEtat etat={n.etat} libelle={t(`certification.resultat.etats.${n.etat}`)} />}
              />
            ))}
            <Bouton variante="secondaire" libelle={t('certification.notionsPartie.revoir')} desactive={!active.fiche} onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: active.id, source: 'partie' } } as never)} />
            <Bouton libelle={t('certification.notionsPartie.entrainer', { notion: active.titre })} onPress={() => router.push({ pathname: '/certification/serie', params: { notion: active.id } } as never)} />
          </View>
        );
      })() : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
