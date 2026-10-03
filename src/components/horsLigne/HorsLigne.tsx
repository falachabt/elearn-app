import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import {
  CATEGORIES_HORS_LIGNE,
  declinerModeHorsLigne,
  ecouterHorsLigne,
  estimerTelechargement,
  lancerTelechargement,
  lireEtatHorsLigne,
  selectionnerCategories,
  type CategorieHorsLigne,
  type EstimationTelechargement,
  type EtatHorsLigne,
} from '@/services/horsLigne';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Interrupteur } from '../Interrupteur';

type Phase = 'selection' | 'progression';
const SEUIL_PDF_DEFAUT = 200 * 1024 ** 2;

const CLE_CATEGORIE: Record<CategorieHorsLigne, CleTexte> = {
  missions: 'horsLigne.missions',
  cours: 'horsLigne.cours',
  quiz: 'horsLigne.quiz',
  exercices: 'horsLigne.exercices',
  pdf: 'horsLigne.pdf',
};

function tailleLisible(octets: number): string {
  if (octets <= 0) return '0 Ko';
  if (octets >= 1024 ** 3) return `${(octets / 1024 ** 3).toFixed(1)} Go`;
  if (octets < 1024 ** 2) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${Math.max(1, Math.round(octets / 1024 ** 2))} Mo`;
}

function Barre({ valeur, libelle }: { valeur: number; libelle: string }) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={libelle}
      accessibilityValue={{ min: 0, max: 100, now: valeur }}
      style={[styles.rail, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
    >
      <View style={[styles.remplissage, { width: `${valeur}%`, backgroundColor: theme.marque.principale }]} />
    </View>
  );
}

export function HorsLigne() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [phase, setPhase] = useState<Phase>('selection');
  const [etat, setEtat] = useState<EtatHorsLigne | null>(null);
  const [estimation, setEstimation] = useState<EstimationTelechargement | null>(null);
  const [selection, setSelection] = useState<Partial<Record<CategorieHorsLigne, boolean>>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    void (async () => {
      try {
        const e = await lireEtatHorsLigne();
        if (!actif) return;
        setEtat(e);
        if (e && (e.statut === 'telechargement' || e.statut === 'partiel' || e.statut === 'termine')) {
          setPhase('progression');
          return;
        }
        const resultat = await estimerTelechargement();
        if (!actif) return;
        setEstimation(resultat);
        setSelection(Object.fromEntries(
          CATEGORIES_HORS_LIGNE.map((categorie) => [
            categorie,
            categorie !== 'pdf' || resultat.estimationCategories.pdf.octets <= SEUIL_PDF_DEFAUT,
          ]),
        ) as Record<CategorieHorsLigne, boolean>);
      } catch {
        if (actif) setErreur(true);
      } finally {
        if (actif) setChargement(false);
      }
    })();
    const arreter = ecouterHorsLigne((e) => actif && setEtat(e));
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  const retour = async () => {
    if (phase === 'selection' && source === 'accueil') await declinerModeHorsLigne();
    router.back();
  };

  const actualiserEstimation = async () => {
    setChargement(true);
    setErreur(false);
    try {
      const resultat = await estimerTelechargement();
      setEstimation(resultat);
      if (!estimation) {
        setSelection(Object.fromEntries(
          CATEGORIES_HORS_LIGNE.map((categorie) => [
            categorie,
            categorie !== 'pdf' || resultat.estimationCategories.pdf.octets <= SEUIL_PDF_DEFAUT,
          ]),
        ) as Record<CategorieHorsLigne, boolean>);
      }
    } catch {
      setErreur(true);
    } finally {
      setChargement(false);
    }
  };

  const commencer = async () => {
    if (!estimation) return;
    setErreur(false);
    setPhase('progression');
    try {
      await lancerTelechargement(selectionnerCategories(
        estimation,
        CATEGORIES_HORS_LIGNE.filter((categorie) => selection[categorie] !== false),
      ));
      setEtat(await lireEtatHorsLigne());
    } catch {
      setErreur(true);
      setPhase('selection');
    }
  };

  const estimationChoisie = useMemo(
    () => estimation && selectionnerCategories(estimation, CATEGORIES_HORS_LIGNE.filter((categorie) => selection[categorie] !== false)),
    [estimation, selection],
  );
  const ressourcesChoisies = CATEGORIES_HORS_LIGNE.some((categorie) => selection[categorie] !== false && !!estimation?.estimationCategories[categorie].total);
  const pdfDecochesParDefaut = !!estimation && estimation.estimationCategories.pdf.octets > SEUIL_PDF_DEFAUT && selection.pdf === false;

  const pourcentage = useMemo(() => {
    if (!etat) return 0;
    const p = Object.values(etat.progression);
    const total = p.reduce((n, x) => n + x.total, 0);
    return total ? Math.floor(p.reduce((n, x) => n + x.faites + x.echecs, 0) * 100 / total) : 100;
  }, [etat]);

  const pied = phase === 'selection' ? (
      <View style={styles.actions}>
        <Bouton libelle={t('horsLigne.telecharger')} desactive={chargement || !estimation || !ressourcesChoisies} onPress={() => void commencer()} />
        {erreur ? <Bouton variante="secondaire" libelle={t('horsLigne.reessayerEstimation')} onPress={() => void actualiserEstimation()} /> : null}
      </View>
    ) : (
      <Bouton variante="secondaire" libelle={t(etat?.statut === 'partiel' ? 'horsLigne.reessayer' : 'horsLigne.fermer')} onPress={() => {
        if (etat?.statut === 'partiel') void lancerTelechargement(etat);
        else router.back();
      }} />
    );

  return (
    <Ecran
      entete={(
        <>
          <BoutonFermer icone="chevron-back" libelle={t('horsLigne.retour')} onPress={() => void retour()} />
          <Text accessibilityRole="header" style={[typo.h3, styles.titreEntete, { color: theme.texte.principal }]}>
            {phase === 'progression' && etat?.statut === 'termine' ? t('horsLigne.termineTitre') : t('horsLigne.titre')}
          </Text>
        </>
      )}
      pied={pied}
    >
      <View style={styles.intro}>
        <View style={[styles.icone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
          <Ionicons name="cloud-download-outline" size={26} color={theme.marque.forte} />
        </View>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
          {phase === 'selection' ? t('horsLigne.intro') : t('horsLigne.travail')}
        </Text>
      </View>

      {erreur ? <Banniere ton="erreur" titre={t('horsLigne.erreur')} /> : null}

      {phase === 'selection' ? (
        <View style={[styles.estimation, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('horsLigne.estimationTitre')}</Text>
          {chargement ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('horsLigne.preparation')}</Text> : null}
          {estimation && estimationChoisie ? (
            <>
              {CATEGORIES_HORS_LIGNE.map((categorie) => {
                const detail = estimation.estimationCategories[categorie];
                return (
                  <View key={categorie} style={[styles.selectionCategorie, { borderBottomColor: theme.bord.doux }]}>
                    <Interrupteur
                      libelle={t(CLE_CATEGORIE[categorie])}
                      aide={t('horsLigne.ressourcesTaille', { n: detail.total, taille: tailleLisible(detail.octets) })}
                      valeur={selection[categorie] !== false}
                      onChange={(valeur) => setSelection((actuelle) => ({ ...actuelle, [categorie]: valeur }))}
                      desactive={!detail.total}
                    />
                  </View>
                );
              })}
              {pdfDecochesParDefaut ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('horsLigne.pdfLourd')}</Text> : null}
              <View style={[styles.total, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('horsLigne.estimationTaille', { taille: tailleLisible(estimationChoisie.estimationOctets) })}</Text>
                <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('horsLigne.consommeraInternet')}</Text>
              </View>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                {estimation.espaceDisponible > 0
                  ? t('horsLigne.espaceDisponible', { taille: tailleLisible(estimation.espaceDisponible) })
                  : t('horsLigne.espaceInconnu')}
              </Text>
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('horsLigne.estimationIndicative')}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('horsLigne.droitsPdf')}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      {phase === 'progression' && etat ? (
        <View style={styles.progression}>
          <View style={styles.resume}>
            <Text style={[typo.h2, { color: theme.texte.principal }]}>{`${pourcentage}%`}</Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('horsLigne.progressionLocale')}</Text>
          </View>
          {CATEGORIES_HORS_LIGNE.map((categorie) => {
            const p = etat.progression[categorie];
            const pct = p.total ? Math.floor((p.faites + p.echecs) * 100 / p.total) : 100;
            return (
              <View key={categorie} style={styles.ligneProgression}>
                <View style={styles.ligneEntete}>
                  <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t(CLE_CATEGORIE[categorie])}</Text>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{`${p.faites}/${p.total}`}</Text>
                </View>
                <Barre valeur={pct} libelle={t(CLE_CATEGORIE[categorie])} />
                {p.echecs ? <Text style={[typo.legende, { color: theme.etat.erreurTexte }]}>{t('horsLigne.echecs', { n: p.echecs })}</Text> : null}
              </View>
            );
          })}
          {etat.statut === 'telechargement' ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('horsLigne.peutFermer')}</Text> : null}
          {etat.statut === 'termine' ? <Text style={[typo.texteFort, { color: theme.marque.forte }]}>{t('horsLigne.termineTexte')}</Text> : null}
          {etat.statut === 'termine' && etat.notification === 'refusee' ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('horsLigne.notificationRefusee')}</Text> : null}
          {etat.statut === 'termine' && etat.notification === 'echec' ? <Text style={[typo.legende, { color: theme.etat.erreurTexte }]}>{t('horsLigne.notificationEchec')}</Text> : null}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'flex-start', gap: espace[4] },
  titreEntete: { flex: 1 },
  icone: { width: 56, height: 56, borderWidth: bord.normal, borderRadius: rayon.m, justifyContent: 'center', alignItems: 'center' },
  actions: { gap: espace[3] },
  estimation: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  selectionCategorie: { paddingVertical: espace[2], borderBottomWidth: bord.fin },
  total: { gap: espace[2], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  progression: { gap: espace[5] },
  resume: { flexDirection: 'row', alignItems: 'baseline', gap: espace[3] },
  ligneProgression: { gap: espace[2] },
  ligneEntete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  rail: { height: 14, borderWidth: bord.fin, borderRadius: rayon.pilule, overflow: 'hidden' },
  remplissage: { height: '100%', borderRadius: rayon.pilule },
});
