import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { paiementPossible } from '@/services/plateforme';
import { filtrer, optionsFiltres, trierSujets, type Sujet } from '@/services/annales';
import { lireDocuments } from '@/services/documents';
import { recaser } from '@/services/titres';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Puce } from '../liste/Puce';
import { CarteListe } from '../liste/CarteListe';
import { Progressive } from '../liste/Progressive';
import { Pastille } from '../liste/Pastille';
import { PastilleType } from '../liste/PastilleType';

/** Une rangée de puces par critère, qui commence par « Toutes » et défile à l'horizontale. */
function Rangee<T extends string | number>({ libelle, valeurs, valeur, onChange, toutes }: { libelle: string; valeurs: T[]; valeur: T | null; onChange: (v: T | null) => void; toutes: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces} accessibilityLabel={libelle}>
      <Puce libelle={toutes} choisie={valeur === null} onPress={() => onChange(null)} />
      {valeurs.map((v) => (
        <Puce key={v} libelle={String(v)} choisie={valeur === v} onPress={() => onChange(v)} />
      ))}
    </ScrollView>
  );
}

/**
 * Sujets d'un concours (M6-01, revue design écran 8) : filtres Année et Matière, une carte par sujet
 * « Matière Année », une seule pastille d'état (hors ligne, gratuit ou pass). Tri : année décroissante, puis matière.
 */
export function ListeSujets({ sujets }: { sujets: Sujet[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [annee, setAnnee] = useState<number | null>(null);
  const [matiere, setMatiere] = useState<string | null>(null);
  const [gardes, setGardes] = useState<Set<number>>(new Set());
  const options = useMemo(() => optionsFiltres(sujets), [sujets]);
  const liste = useMemo(() => trierSujets(filtrer(sujets, { annee, matiere })), [sujets, annee, matiere]);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireDocuments()
        .then((d) => actif && setGardes(new Set(d.map((x) => x.sujet).filter((x): x is number => !!x))))
        .catch(() => {});
      return () => {
        actif = false;
      };
    }, []),
  );

  return (
    <View style={styles.groupe}>
      {options.annees.length > 1 ? <Rangee libelle={t('annales.filtreAnnee')} toutes={t('annales.toutes')} valeurs={options.annees} valeur={annee} onChange={setAnnee} /> : null}
      {options.matieres.length > 1 ? <Rangee libelle={t('annales.filtreMatiere')} toutes={t('annales.toutes')} valeurs={options.matieres} valeur={matiere} onChange={setMatiere} /> : null}
      {!liste.length ? (
        <View style={styles.vide}>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('annales.videFiltres')}</Text>
          <Bouton
            variante="texte"
            libelle={t('annales.effacerFiltres')}
            onPress={() => {
              setAnnee(null);
              setMatiere(null);
            }}
          />
        </View>
      ) : null}
      <View style={styles.cartes}>
        <Progressive
          items={liste}
          initial={12}
          pas={12}
          rendu={(s) => {
          const titre = s.matiere ? [recaser(s.matiere), s.annee].filter(Boolean).join(' ') : [recaser(s.titre), s.annee].filter(Boolean).join(' ');
          const sousTitre = [s.corrige ? t('annales.sujetCorrige') : t('annales.sujetSeul'), s.dureeMin ? t('annales.duree', { n: s.dureeMin }) : null].filter(Boolean).join(' · ');
          const etat = gardes.has(s.id) ? <Pastille vert texte={t('annales.horsLigne')} /> : s.gratuit ? <Pastille vert texte={t('annales.gratuit')} /> : <Pastille texte={t('annales.pass')} />;
          return (
            <CarteListe
              key={s.id}
              gauche={<PastilleType type="annale" />}
              titre={titre}
              sousTitre={sousTitre}
              droite={etat}
              onPress={() => router.push({ pathname: '/annales/sujet', params: { id: String(s.id) } })}
            />
          );
          }}
        />
      </View>
      {paiementPossible() ? <Bouton variante="texte" libelle={t('annales.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'limite' } })} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  cartes: { gap: espace[4] },
  puces: { gap: espace[3], paddingRight: espace[4] },
  vide: { gap: espace[3], paddingVertical: espace[6] },
  centre: { textAlign: 'center' },
});
