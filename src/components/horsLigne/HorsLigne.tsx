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
  type CategorieHorsLigne,
  type EtatHorsLigne,
} from '@/services/horsLigne';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

type Phase = 'choix' | 'confirmation' | 'progression';

const CLE_CATEGORIE: Record<CategorieHorsLigne, CleTexte> = {
  missions: 'horsLigne.missions',
  cours: 'horsLigne.cours',
  quiz: 'horsLigne.quiz',
  exercices: 'horsLigne.exercices',
  pdf: 'horsLigne.pdf',
};

function tailleLisible(octets: number): string {
  if (octets >= 1024 ** 3) return `${(octets / 1024 ** 3).toFixed(1)} Go`;
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
  const [phase, setPhase] = useState<Phase>('choix');
  const [etat, setEtat] = useState<EtatHorsLigne | null>(null);
  const [estimation, setEstimation] = useState<Awaited<ReturnType<typeof estimerTelechargement>> | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    lireEtatHorsLigne().then((e) => {
      if (!actif) return;
      setEtat(e);
      if (e && (e.statut === 'telechargement' || e.statut === 'partiel' || e.statut === 'termine')) setPhase('progression');
    });
    const arreter = ecouterHorsLigne((e) => actif && setEtat(e));
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  const retour = async () => {
    if (phase === 'choix' && source === 'accueil') await declinerModeHorsLigne();
    router.back();
  };

  const demanderEstimation = async () => {
    setChargement(true);
    setErreur(false);
    try {
      setEstimation(await estimerTelechargement());
      setPhase('confirmation');
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
      await lancerTelechargement(estimation);
      setEtat(await lireEtatHorsLigne());
    } catch {
      setErreur(true);
      setPhase('confirmation');
    }
  };

  const pourcentage = useMemo(() => {
    if (!etat) return 0;
    const p = Object.values(etat.progression);
    const total = p.reduce((n, x) => n + x.total, 0);
    return total ? Math.floor(p.reduce((n, x) => n + x.faites + x.echecs, 0) * 100 / total) : 100;
  }, [etat]);

  const pied =
    phase === 'choix' ? (
      <View style={styles.actions}>
        <Bouton libelle={chargement ? t('horsLigne.preparation') : t('horsLigne.oui')} desactive={chargement} onPress={() => void demanderEstimation()} />
        <Bouton variante="secondaire" libelle={t('horsLigne.non')} onPress={() => void retour()} />
      </View>
    ) : phase === 'confirmation' ? (
      <View style={styles.actions}>
        <Bouton libelle={t('horsLigne.telecharger')} onPress={() => void commencer()} />
        <Bouton variante="secondaire" libelle={t('horsLigne.retour')} onPress={() => setPhase('choix')} />
      </View>
    ) : (
      <Bouton variante="secondaire" libelle={t(etat?.statut === 'partiel' ? 'horsLigne.reessayer' : 'horsLigne.fermer')} onPress={() => {
        if (etat?.statut === 'partiel') void lancerTelechargement(etat);
        else router.back();
      }} />
    );

  return (
    <Ecran
      entete={<BoutonFermer icone="chevron-back" libelle={t('horsLigne.retour')} onPress={() => void retour()} />}
      pied={pied}
    >
      <View style={styles.intro}>
        <View style={[styles.icone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
          <Ionicons name="cloud-download-outline" size={26} color={theme.marque.forte} />
        </View>
        <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>
          {phase === 'progression' && etat?.statut === 'termine' ? t('horsLigne.termineTitre') : t('horsLigne.titre')}
        </Text>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
          {phase === 'choix' ? t('horsLigne.intro') : phase === 'confirmation' ? t('horsLigne.confirmation') : t('horsLigne.travail')}
        </Text>
      </View>

      {erreur ? <Banniere ton="erreur" titre={t('horsLigne.erreur')} /> : null}

      {phase === 'confirmation' && estimation ? (
        <View style={[styles.estimation, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('horsLigne.estimationTitre')}</Text>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('horsLigne.estimationTaille', { taille: tailleLisible(estimation.estimationOctets) })}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
            {estimation.espaceDisponible > 0
              ? t('horsLigne.espaceDisponible', { taille: tailleLisible(estimation.espaceDisponible) })
              : t('horsLigne.espaceInconnu')}
          </Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('horsLigne.estimationIndicative')}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('horsLigne.droitsPdf')}</Text>
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
  icone: { width: 56, height: 56, borderWidth: bord.normal, borderRadius: rayon.m, justifyContent: 'center', alignItems: 'center' },
  actions: { gap: espace[3] },
  estimation: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  progression: { gap: espace[5] },
  resume: { flexDirection: 'row', alignItems: 'baseline', gap: espace[3] },
  ligneProgression: { gap: espace[2] },
  ligneEntete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  rail: { height: 14, borderWidth: bord.fin, borderRadius: rayon.pilule, overflow: 'hidden' },
  remplissage: { height: '100%', borderRadius: rayon.pilule },
});
