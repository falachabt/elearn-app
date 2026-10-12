import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, Check, Cpu, GraduationCap, Stethoscope, Trophy, Wrench } from 'lucide-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { filtrerConcours, lireConcoursFiliere, lireFilieres, type ConcoursFiliere, type Filiere } from '@/services/concours';
import { CLE_MISSION } from '@/services/mission';
import { enregistrerProfil, lireProfil } from '@/services/profil';
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

/**
 * Concours en deux étapes : la filière, puis le concours précis. Le concours choisi se comporte comme une classe :
 * programme, mission du jour et annales le suivent. Utilisé à l'arrivée et depuis Moi.
 */
export function ChoixConcours() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [etape, setEtape] = useState<1 | 2>(1);
  const [filieres, setFilieres] = useState<Filiere[] | null | undefined>(undefined);
  const [filiere, setFiliere] = useState<string | null>(null);
  const [liste, setListe] = useState<ConcoursFiliere[] | null | undefined>(undefined);
  const [choisi, setChoisi] = useState<ConcoursFiliere | null>(null);
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void Promise.all([lireFilieres(getSupabase(), langue === 'en' ? 'en' : 'fr'), lireProfil()])
      .then(([f, p]) => {
        if (!actif) return;
        setFilieres(f);
        if (p?.type === 'concours' && p.niveau && f.some((x) => x.code === p.niveau)) setFiliere(p.niveau);
      })
      .catch(() => actif && setFilieres(null));
    return () => {
      actif = false;
    };
  }, [pret, langue]);

  useEffect(() => {
    if (etape !== 2 || !filiere) return;
    let actif = true;
    void Promise.all([lireConcoursFiliere(getSupabase(), filiere), lireProfil()])
      .then(([l, p]) => {
        if (!actif) return;
        setListe(l);
        setChoisi(l.find((c) => c.id === p?.concours?.id) ?? null);
      })
      .catch(() => actif && setListe(null));
    return () => {
      actif = false;
    };
  }, [etape, filiere]);

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

  const nomFiliere = filieres?.find((f) => f.code === filiere)?.nom ?? '';
  const visibles = liste ? filtrerConcours(liste, recherche) : [];
  const pied =
    etape === 1 ? (
      <Bouton libelle={t('concours.suivant')} desactive={!filiere}
        onPress={() => {
          setListe(undefined);
          setEtape(2);
        }}
      />
    ) : (
      <Bouton libelle={choisi ? t('concours.choisir', { sigle: choisi.sigle }) : t('concours.choisirVide')} desactive={!choisi} onPress={() => void valider()} retour />
    );

  return (
    <Ecran
      pied={pied}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('classe.retour')} onPress={retour} />
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
