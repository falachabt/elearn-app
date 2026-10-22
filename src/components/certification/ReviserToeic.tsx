import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, NotebookPen, Target } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerDonneesRevision, compteursCarnet, nombreDeFiches, type DonneesRevision } from '@/services/certification/revision';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';
import { CarnetMots } from './CarnetMots';
import { CoursNotions } from './CoursNotions';
import { stylePartie } from './partiesStyle';
import { EnteteToeic, EtiquetteSection, GrilleEgale, LigneChoix, Squelette } from './ui';
import { useChargement } from './useChargement';

type Onglet = 'parcours' | 'parties' | 'cours' | 'carnet';
const ONGLETS: readonly Onglet[] = ['parcours', 'parties', 'cours', 'carnet'];

/**
 * N3 · Réviser, profil TOEIC : quatre sous-onglets, Parcours (par défaut), Parties (C1), Cours (C4), Carnet (C6).
 * Les tests ne sont plus ici : ils vivent dans l'onglet Tests de la barre du bas (décision D-08).
 */
export function ReviserToeic() {
  const { t } = useTraduction();
  const params = useLocalSearchParams<{ onglet?: string }>();
  const [choisi, setChoisi] = useState<Onglet | null>(null);
  const demande = ONGLETS.find((o) => o === params.onglet);
  const onglet: Onglet = choisi ?? demande ?? 'parcours';
  const { etat, recharger } = useChargement(chargerDonneesRevision);

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.reviser.entete')} />}>
      <Onglets
        valeurs={ONGLETS.map((o) => ({ valeur: o, libelle: t(`certification.reviser.onglets.${o}`) }))}
        valeur={onglet}
        onChange={setChoisi}
      />
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? <Contenu onglet={onglet} donnees={etat.valeur} aller={setChoisi} /> : null}
    </Ecran>
  );
}

function Contenu({ onglet, donnees, aller }: { onglet: Onglet; donnees: DonneesRevision; aller: (o: Onglet) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { revision, carnet, depuisCopie } = donnees;
  const compteurs = compteursCarnet(carnet);
  const fiches = nombreDeFiches(revision.notions);
  const aideCours = fiches === 1 ? t('certification.reviser.coursAideUn') : t('certification.reviser.coursAide', { n: fiches });
  const aideCarnetRevoir = compteurs.a_revoir === 1 ? t('certification.reviser.carnetAideUn') : t('certification.reviser.carnetAide', { n: compteurs.a_revoir });
  const aideCarnetCompte = carnet.length === 1 ? t('certification.reviser.carnetCompteUn', { revoir: compteurs.a_revoir }) : t('certification.reviser.carnetCompte', { total: carnet.length, revoir: compteurs.a_revoir });

  return (
    <>
      {depuisCopie ? <Banniere ton="info" titre={t('certification.reviser.copie')} /> : null}
      {onglet === 'parcours' ? (
        <>
          <Appui accessibilityRole="button" accessibilityLabel={`${t('certification.reviser.parcoursTitre')}. ${t('certification.reviser.parcoursTexte')}`} onPress={() => router.push('/certification/seance' as never)} decalage={0} rayon={rayon.l}>
            <Carte>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.reviser.parcoursTitre')}</Text>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.reviser.parcoursTexte')}</Text>
            </Carte>
          </Appui>
          <LigneChoix icone={BookOpen} titre={t('certification.reviser.partiesTitre')} aide={t('certification.reviser.partiesAide')} onPress={() => router.push('/certification/carte' as never)} />
          <LigneChoix icone={Target} titre={t('certification.reviser.coursTitre')} aide={aideCours} onPress={() => aller('cours')} />
          <LigneChoix icone={NotebookPen} titre={t('certification.reviser.carnetTitre')} aide={carnet.length ? aideCarnetRevoir : t('certification.reviser.carnetAideVide')} onPress={() => aller('carnet')} />
        </>
      ) : null}
      {onglet === 'parties' ? (
        <>
          <EtiquetteSection texte={t('certification.reviser.etiquetteParties')} />
          <GrilleEgale
            colonnes={2}
            enfants={[1, 2, 3, 4, 5, 6, 7].map((n) => {
              const { couleur, icone: Icone, cle } = stylePartie(theme)[n] ?? stylePartie(theme)[1]!;
              const pourcent = Math.round((revision.parties.find((x) => x.partie === n)?.m ?? 0) * 100);
              return (
                <Appui
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('certification.reviser.tuileLabel', { n })}, ${t(cle)}, ${t('certification.carteMaitrise.pourcent', { n: pourcent })}`}
                  onPress={() => router.push({ pathname: '/certification/partie', params: { n: String(n) } } as never)}
                  decalage={2}
                  rayon={rayon.m}
                  retour
                >
                  <View style={[styles.cube, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                    <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                      <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                    </View>
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.reviser.tuile', { n })}</Text>
                    <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t(cle)}</Text>
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.carteMaitrise.pourcent', { n: pourcent })}</Text>
                  </View>
                </Appui>
              );
            })}
          />
          <LigneChoix icone={Target} titre={t('certification.reviser.carteTitre')} aide={t('certification.reviser.carteAide')} onPress={() => router.push('/certification/carte' as never)} />
          <LigneChoix icone={BookOpen} titre={t('certification.reviser.coursTitre')} aide={aideCours} onPress={() => aller('cours')} />
          <LigneChoix icone={NotebookPen} titre={t('certification.reviser.carnetTitre')} aide={aideCarnetCompte} onPress={() => aller('carnet')} />
        </>
      ) : null}
      {onglet === 'cours' ? <CoursNotions notions={revision.notions} /> : null}
      {onglet === 'carnet' ? <CarnetMots mots={carnet} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  cube: { minHeight: 136, padding: espace[3], gap: espace[1], alignItems: 'flex-start', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.m },
  pastille: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s, marginBottom: espace[1] },
});
