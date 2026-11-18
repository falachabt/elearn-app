import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, NotebookPen, Target } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerDonneesRevision, compteursCarnet, nombreDeFiches, type DonneesRevision } from '@/services/certification/revision';
import type { FamilleNotion } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Onglets } from '../Onglets';
import { CarnetMots } from './CarnetMots';
import { ContenuChronologie, PiedFrise, useFrise } from './FriseParcours';
import { ContinuerCours, CoursNotions } from './CoursNotions';
import { stylePartie } from './partiesStyle';
import { BarreProgression, EnteteCase, EnteteToeic, EtiquetteSection, GrilleCollee, LigneChoix, ListeChoix, Squelette, type CaseGrille } from './ui';
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
  const [famille, setFamille] = useState<FamilleNotion>('grammaire');
  const { etat, recharger } = useChargement(chargerDonneesRevision);
  const frise = useFrise();

  return (
    <Ecran piedBordure insetBas={false} entete={<EnteteToeic titre={t('certification.reviser.entete')} />} pied={onglet === 'cours' && etat.phase === 'ok' ? <ContinuerCours notions={etat.valeur.revision.notions} famille={famille} /> : onglet === 'parcours' && frise.etat.phase === 'ok' ? <PiedFrise donnees={frise.etat.valeur} /> : undefined}>
      <Onglets
        valeurs={ONGLETS.map((o) => ({ valeur: o, libelle: t(`certification.reviser.onglets.${o}`) }))}
        valeur={onglet}
        onChange={setChoisi}
      />
      {onglet === 'parcours' ? <ParcoursFrise frise={frise} /> : null}
      {onglet !== 'parcours' && etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {onglet !== 'parcours' && etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {onglet !== 'parcours' && etat.phase === 'ok' ? <Contenu onglet={onglet} donnees={etat.valeur} aller={setChoisi} famille={famille} onFamille={setFamille} /> : null}
    </Ecran>
  );
}

/** Onglet Parcours : la frise du plan de formation, avec ses propres états (squelette, erreur, vide, sans date). */
function ParcoursFrise({ frise }: { frise: ReturnType<typeof useFrise> }) {
  const { t } = useTraduction();
  const { etat, recharger } = frise;
  if (etat.phase === 'chargement') return <Squelette lignes={4} />;
  if (etat.phase === 'erreur') {
    return (
      <View style={styles.groupe}>
        <Banniere ton="erreur" titre={t('certification.reviser.erreurTitre')} texte={t('certification.reviser.erreurTexte')} />
        <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
      </View>
    );
  }
  return <ContenuChronologie donnees={etat.valeur} />;
}

function Contenu({ onglet, donnees, aller, famille, onFamille }: { onglet: Onglet; donnees: DonneesRevision; aller: (o: Onglet) => void; famille: FamilleNotion; onFamille: (f: FamilleNotion) => void }) {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { revision, carnet, depuisCopie } = donnees;
  const compteurs = compteursCarnet(carnet);
  const fiches = nombreDeFiches(revision.notions);
  const aideCours = fiches === 1 ? t('certification.reviser.coursAideUn') : t('certification.reviser.coursAide', { n: fiches });
  const aideCarnetCompte = carnet.length === 1 ? t('certification.reviser.carnetCompteUn', { revoir: compteurs.a_revoir }) : t('certification.reviser.carnetCompte', { total: carnet.length, revoir: compteurs.a_revoir });

  return (
    <>
      {depuisCopie ? <Banniere ton="info" titre={t('certification.reviser.copie')} /> : null}
      {onglet === 'parties' ? (
        <>
          <EtiquetteSection texte={t('certification.reviser.etiquetteParties')} />
          <GrilleCollee
            cases={[1, 2, 3, 4, 5, 6, 7].map((n): CaseGrille => {
              const { couleur, icone: Icone, cle } = stylePartie(theme, sombre)[n] ?? stylePartie(theme, sombre)[1]!;
              const pourcent = Math.round((revision.parties.find((x) => x.partie === n)?.m ?? 0) * 100);
              return {
                cle: String(n),
                accessibilityLabel: `${t('certification.reviser.tuileLabel', { n })}, ${t(cle)}, ${t('certification.carteMaitrise.pourcent', { n: pourcent })}`,
                onPress: () => router.push({ pathname: '/certification/partie', params: { n: String(n) } } as never),
                contenu: (
                  <>
                    <EnteteCase
                      pastille={
                        <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
                          <Icone size={18} color={theme.texte.surCouleur} strokeWidth={2} />
                        </View>
                      }
                    />
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.reviser.tuile', { n })}</Text>
                    <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t(cle)}</Text>
                    <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.carteMaitrise.pourcent', { n: pourcent })}</Text>
                    <BarreProgression pourcent={pourcent} hauteur={6} />
                  </>
                ),
              };
            })}
          />
          <ListeChoix>
          <LigneChoix icone={Target} titre={t('certification.reviser.carteTitre')} aide={t('certification.reviser.carteAide')} onPress={() => router.push('/certification/carte' as never)} />
          <LigneChoix icone={BookOpen} titre={t('certification.reviser.coursTitre')} aide={aideCours} onPress={() => aller('cours')} />
          <LigneChoix icone={NotebookPen} titre={t('certification.reviser.carnetTitre')} aide={aideCarnetCompte} onPress={() => aller('carnet')} />
          </ListeChoix>
        </>
      ) : null}
      {onglet === 'cours' ? <CoursNotions notions={revision.notions} famille={famille} onFamille={onFamille} /> : null}
      {onglet === 'carnet' ? <CarnetMots mots={carnet} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  pastille: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
});
