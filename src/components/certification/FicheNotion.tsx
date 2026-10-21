import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Target } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { ErreurContenuExpire } from '@/services/certification/copie';
import { jourDe } from '@/services/certification/jours';
import { titreAffiche } from '@/services/certification/titre';
import { chargerFiche, lireFiche, morceauxMisEnValeur } from '@/services/certification/revision';
import type { NotionFiche } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, EtiquetteSection, LigneChoix, Squelette } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'expire' } | { nom: 'ok'; fiche: NotionFiche };

/** C5 · Fiche d'une notion : règle, exemples, piège, faux ami, trois questions d'ancrage, entraînement. */
export function FicheNotion() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });

  const charger = useCallback(() => {
    setPhase({ nom: 'chargement' });
    chargerFiche(id)
      .then(({ valeur }) => {
        setPhase({ nom: 'ok', fiche: valeur });
        suivre('cert_notion_opened', { notion: valeur.code, source: source ?? 'liste' });
        void obtenirApi().ouvrirNotion(id, 0, jourDe(new Date())).catch(() => undefined);
      })
      .catch((e: unknown) => setPhase(e instanceof ErreurContenuExpire ? { nom: 'expire' } : { nom: 'erreur' }));
  }, [id, source]);

  useEffect(() => {
    // Chargement initial de la fiche (copie locale puis serveur) : l'état de chargement est posé par `charger` lui-même.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  // Temps de lecture : envoyé en quittant l'écran, jamais bloquant (F11).
  useFocusEffect(
    useCallback(() => {
      const arrivee = Date.now();
      return () => {
        const secondes = Math.round((Date.now() - arrivee) / 1000);
        if (secondes > 0) void obtenirApi().ouvrirNotion(id, secondes, jourDe(new Date())).catch(() => undefined);
      };
    }, [id]),
  );

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser' as never));
  const titre = phase.nom === 'ok' ? titreAffiche(phase.fiche.titre) : t('certification.cours.entete');

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={titre} onRetour={retour} />}>
      {phase.nom === 'chargement' ? <Squelette lignes={4} /> : null}
      {phase.nom === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.fiche.erreurTitre')} texte={t('certification.fiche.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={charger} />
        </View>
      ) : null}
      {phase.nom === 'expire' ? (
        <View style={styles.groupe}>
          <Banniere ton="alerte" titre={t('certification.fiche.expireTitre')} texte={`${t('certification.fiche.expireTexte')}. ${t('certification.fiche.expireAide')}`} />
          <Bouton libelle={t('certification.fiche.actualiser')} onPress={charger} />
        </View>
      ) : null}
      {phase.nom === 'ok' ? (() => {
        const f = lireFiche(phase.fiche.markdown);
        const vide = !f.regle && f.exemples.length === 0 && !f.piege && !f.fauxAmi;
        return (
          <View style={styles.groupe}>
            {vide ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.fiche.sansTexte')}</Text> : null}
            {f.regle ? (
              <View style={styles.groupe}>
                <EtiquetteSection texte={t('certification.fiche.regle')} />
                <Carte><Text style={[typo.texte, { color: theme.texte.principal }]}>{f.regle}</Text></Carte>
              </View>
            ) : null}
            {f.exemples.length ? (
              <View style={styles.groupe}>
                <EtiquetteSection texte={t('certification.fiche.exemples')} />
                {f.exemples.map((ex, i) => (
                  <Carte key={i}>
                    <Text style={[typo.texte, { color: theme.texte.principal }]}>
                      {morceauxMisEnValeur(ex.en).map((m, j) => (
                        <Text key={j} style={m.fort ? typo.texteFort : undefined}>{m.texte}</Text>
                      ))}
                    </Text>
                    {ex.fr ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{ex.fr}</Text> : null}
                  </Carte>
                ))}
              </View>
            ) : null}
            {f.piege ? (
              <View style={styles.groupe}>
                <EtiquetteSection texte={t('certification.fiche.piege')} />
                <View style={[styles.piege, { backgroundColor: theme.etat.alerteDoux, borderColor: theme.bord.fort }]}>
                  <Text style={[typo.texte, { color: theme.texte.principal }]}>{f.piege}</Text>
                </View>
              </View>
            ) : null}
            {f.fauxAmi ? <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.fiche.fauxAmi', { texte: f.fauxAmi })}</Text> : null}
            {phase.fiche.ancrages.length ? (
              <View style={styles.groupe}>
                <EtiquetteSection texte={t('certification.fiche.ancrage', { n: phase.fiche.ancrages.length })} />
                {phase.fiche.ancrages.map((_, i) => (
                  <LigneChoix
                    key={i}
                    icone={Target}
                    titre={t('certification.fiche.ancrageLigneSans', { n: i + 1 })}
                    onPress={() => router.push({ pathname: '/certification/serie', params: { notion: phase.fiche.id, ancrage: '1' } } as never)}
                  />
                ))}
              </View>
            ) : null}
            <Bouton libelle={t('certification.fiche.entrainer')} onPress={() => router.push({ pathname: '/certification/serie', params: { notion: phase.fiche.id } } as never)} />
          </View>
        );
      })() : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  piege: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[3] },
});
