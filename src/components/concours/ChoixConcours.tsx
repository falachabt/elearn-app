import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, Check, Cpu, GraduationCap, Stethoscope, Trophy, Wrench } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { adopterProfil } from '@/services/changementProfil';
import { filtrerConcours, lireConcoursFiliere, lireFilieres, type ConcoursFiliere, type Filiere } from '@/services/concours';
import { CLE_MISSION } from '@/services/mission';
import { enregistrerProfil, lireProfil, type ConcoursChoisi, type Profil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { BlocChangementProfil, type EtatChangement } from '../profil/BlocChangementProfil';

function renduIcone(icone: unknown, couleur: string) {
  if (icone === Trophy) return <Trophy size={20} color={couleur} strokeWidth={2} />;
  const c = typeof icone === 'string' ? icone.toLowerCase() : '';
  if (c.includes('ingenieur') || c.includes('construct') || c.includes('techn') || c.includes('poly')) {
    return <Wrench size={20} color={couleur} strokeWidth={2} />;
  }
  if (c.includes('sante') || c.includes('med') || c.includes('medkit')) {
    return <Stethoscope size={20} color={couleur} strokeWidth={2} />;
  }
  if (c.includes('ens') || c.includes('educ') || c.includes('pedag')) {
    return <GraduationCap size={20} color={couleur} strokeWidth={2} />;
  }
  if (c.includes('science') || c.includes('info')) {
    return <Cpu size={20} color={couleur} strokeWidth={2} />;
  }
  if (c.includes('droit') || c.includes('lettre')) {
    return <BookOpen size={20} color={couleur} strokeWidth={2} />;
  }
  return <Trophy size={20} color={couleur} strokeWidth={2} />;
}

/** Ligne à choisir (filière ou concours) : badge icône, titre, détail, radio à droite. */
function Choix({
  icone,
  titre,
  detail,
  actif,
  onPress,
}: {
  icone?: unknown;
  titre: string;
  detail: string;
  actif: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Appui
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      accessibilityLabel={`${titre}. ${detail}`}
      onPress={onPress}
      rayon={rayon.l}
      ombre={actif ? ombre.m : ombre.s}
      decalage={actif ? 3 : 2}
      couleurOmbre={theme.ombre}
      retour
    >
      <View
        style={[
          styles.ligne,
          {
            backgroundColor: actif ? theme.fond.surface : theme.fond.surface,
            borderColor: theme.bord.fort,
            borderWidth: actif ? bord.epais : bord.normal,
          },
        ]}
      >
        <View style={[styles.iconeCadre, { backgroundColor: actif ? theme.accent.soleilTresDoux : theme.fond.creux, borderColor: theme.bord.fort }]}>
          {renduIcone(icone, theme.texte.principal)}
        </View>
        <View style={styles.flex}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{detail}</Text>
        </View>
        <View
          style={[
            styles.radio,
            {
              borderColor: theme.bord.fort,
              backgroundColor: actif ? theme.marque.principale : theme.fond.surface,
            },
          ]}
        >
          {actif ? <Check size={14} color={theme.texte.surCouleur} strokeWidth={3} /> : null}
        </View>
      </View>
    </Appui>
  );
}

type ChoixConcoursProps = {
  /**
   * Dans la page de changement (issue #125) : la page porte le retour et l'inset du haut ; un petit retour
   * texte remplace le bouton fermer pour revenir de l'étape 2 aux filières.
   */
  dansPage?: boolean;
  /**
   * Le profil actuel est d'une AUTRE famille : une fois un concours choisi (étape 2), le pied devient le bloc
   * d'adoption (conséquences + confirmation) au lieu du simple « Choisir ce concours ».
   */
  adoption?: boolean;
  /** Filière du profil concours mémorisé : pré-remplit l'étape 1 quand le profil actuel n'est pas un concours. */
  filierePrefill?: string | null;
  /** Concours du profil mémorisé : pré-sélectionne l'étape 2 dans le même cas. */
  concoursPrefill?: ConcoursChoisi | null;
  /** Abandon de l'adoption depuis l'état d'erreur : la page revient à l'onglet de la famille actuelle. */
  onAnnulerAdoption?: () => void;
};

/**
 * Concours en deux étapes : la filière, puis le concours précis. Le concours choisi se comporte comme une classe :
 * programme, mission du jour et annales le suivent. Utilisé à l'arrivée et depuis Moi.
 */
export function ChoixConcours({ dansPage = false, adoption = false, filierePrefill = null, concoursPrefill = null, onAnnulerAdoption }: ChoixConcoursProps = {}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [etape, setEtape] = useState<1 | 2>(1);
  const [filieres, setFilieres] = useState<Filiere[] | null | undefined>(undefined);
  const [filiere, setFiliere] = useState<string | null>(null);
  const [liste, setListe] = useState<ConcoursFiliere[] | null | undefined>(undefined);
  const [choisi, setChoisi] = useState<ConcoursFiliere | null>(null);
  const [recherche, setRecherche] = useState('');
  // Type du profil actuel (famille d'origine) et état du bloc d'adoption, pour la page de changement (issue #125).
  const [typeActuel, setTypeActuel] = useState<Profil['type'] | null>(null);
  const [etatAdoption, setEtatAdoption] = useState<EtatChangement>('repos');

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void Promise.all([lireFilieres(getSupabase(), langue === 'en' ? 'en' : 'fr'), lireProfil()])
      .then(([f, p]) => {
        if (!actif) return;
        setFilieres(f);
        setTypeActuel(p?.type ?? null);
        if (p?.type === 'concours' && p.niveau && f.some((x) => x.code === p.niveau)) setFiliere(p.niveau);
        else if (filierePrefill && f.some((x) => x.code === filierePrefill)) setFiliere(filierePrefill);
      })
      .catch(() => actif && setFilieres(null));
    return () => {
      actif = false;
    };
  }, [pret, langue, filierePrefill]);

  useEffect(() => {
    if (etape !== 2 || !filiere) return;
    let actif = true;
    void Promise.all([lireConcoursFiliere(getSupabase(), filiere), lireProfil()])
      .then(([l, p]) => {
        if (!actif) return;
        setListe(l);
        setChoisi(l.find((c) => c.id === p?.concours?.id) ?? l.find((c) => c.id === concoursPrefill?.id) ?? null);
      })
      .catch(() => actif && setListe(null));
    return () => {
      actif = false;
    };
  }, [etape, filiere, concoursPrefill]);

  const retour = () => (etape === 2 ? setEtape(1) : router.canGoBack() ? router.back() : router.replace('/bienvenue'));

  const valider = async () => {
    if (!choisi || !filiere) return;
    const p = await lireProfil();
    const { ecole: _e, cycle: _c, date: _d, sujets: _s, lecons: _l, ...concours } = choisi;
    await enregistrerProfil({ type: 'concours', niveau: filiere, pays: p?.pays ?? 'CM', concours, termine: p?.termine ?? false });
    // La mission gardée pour aujourd'hui était tirée pour l'ancien programme.
    await AsyncStorage.removeItem(CLE_MISSION);
    suivre('contest_chosen', { filiere, concours: choisi.sigle });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /** Adoption inter-familles (page de changement, issue #125) : le profil quitté est gardé en mémoire, rien n'est effacé. */
  const confirmerAdoption = async () => {
    if (!choisi || !filiere) return;
    const p = await lireProfil();
    const { ecole: _e, cycle: _c, date: _d, sujets: _s, lecons: _l, ...concours } = choisi;
    setEtatAdoption('charge');
    try {
      await adopterProfil({ type: 'concours', niveau: filiere, pays: p?.pays ?? 'CM', concours, termine: true });
      await AsyncStorage.removeItem(CLE_MISSION);
      suivre('contest_chosen', { filiere, concours: choisi.sigle });
      router.dismissAll();
      router.replace('/');
    } catch {
      setEtatAdoption('erreur');
    }
  };

  const nomFiliere = filieres?.find((f) => f.code === filiere)?.nom ?? '';
  const visibles = liste ? filtrerConcours(liste, recherche) : [];
  const piedAdoption =
    adoption && etape === 2 && choisi ? (
      <BlocChangementProfil
        etat={etatAdoption}
        titre={t('profilChoix.passerConcoursTitre')}
        texte={typeActuel === 'certification' ? t('profilChoix.revenirTexte') : t('profilChoix.consequencesDepuisSecondaire')}
        confirmer={t('profilChoix.passerConcoursBouton')}
        annuler={t('profilChoix.annuler')}
        onConfirmer={() => void confirmerAdoption()}
        onAnnuler={() => {
          if (etatAdoption === 'erreur') {
            setEtatAdoption('repos');
            onAnnulerAdoption?.();
          } else {
            setChoisi(null);
          }
        }}
      />
    ) : null;
  const pied =
    piedAdoption ??
    (etape === 1 ? (
      <Bouton libelle={t('concours.suivant')} desactive={!filiere}
        onPress={() => {
          setListe(undefined);
          setEtape(2);
        }}
      />
    ) : (
      <Bouton libelle={choisi ? t('concours.choisir', { sigle: choisi.sigle }) : t('concours.choisirVide')} desactive={!choisi} onPress={() => void valider()} retour />
    ));

  return (
    <Ecran
      insetHaut={!dansPage}
      pied={pied}
      entete={
        <>
          {!dansPage ? <BoutonFermer icone="chevron-back" libelle={t('classe.retour')} onPress={retour} /> : null}
          <Text style={[typo.etiquette, styles.flex, { color: theme.texte.secondaire }]}>{t('concours.etape', { n: etape })}</Text>
        </>
      }
    >
      {etape === 1 ? (
        <>
          <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('concours.filiereTitre')}</Text>
          {filieres === null ? <Banniere ton="erreur" titre={t('concours.erreur')} /> : null}
          <View accessibilityRole="radiogroup" style={styles.liste}>
            {filieres?.map((f) => (
              <Choix key={f.code} icone={f.icone} titre={f.nom} detail={t(f.concours > 1 ? 'concours.nombre' : 'concours.nombre1', { n: f.concours })} actif={filiere === f.code} onPress={() => setFiliere(f.code)} />
            ))}
          </View>
        </>
      ) : (
        <>
          {dansPage ? <Bouton petit variante="texte" libelle={t('concours.retourFilieres')} onPress={() => setEtape(1)} /> : null}
          <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('concours.concoursTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{nomFiliere}</Text>
          <Champ libelle={t('concours.chercher')} value={recherche} onChangeText={setRecherche} autoCorrect={false} />
          {liste === null ? <Banniere ton="erreur" titre={t('concours.erreur')} /> : null}
          <View accessibilityRole="radiogroup" style={styles.liste}>
            {visibles.map((c) => (
              <Choix
                key={c.id}
                icone={Trophy}
                titre={[c.sigle, c.ville].filter(Boolean).join(' · ')}
                detail={[c.cycle ?? c.nom, c.sujets ? t(c.sujets > 1 ? 'annales.sujets' : 'annales.sujet', { n: c.sujets }) : null].filter(Boolean).join(' · ')}
                actif={choisi?.id === c.id}
                onPress={() => setChoisi(c)}
              />
            ))}
          </View>
          {choisi ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('concours.aide')}</Text> : null}
        </>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  liste: { gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderRadius: rayon.l },
  iconeCadre: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
});
