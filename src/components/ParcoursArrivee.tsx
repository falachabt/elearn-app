import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getLocales } from 'expo-localization';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, ChevronRight, GraduationCap, Trophy, Zap, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { drapeauPays, listerPays, nomPays } from '@/services/pays';
import { actualiserPlanningProfil } from '@/services/planning';
import {
  CLASSES,
  CONCOURS,
  enregistrerProfil,
  lireProfil,
  lireSeriesClasse,
  paysParDefaut,
  type ConcoursChoisi,
  type Profil,
  type SerieChoisie,
  type SerieClasse,
} from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Apparition } from './Apparition';
import { Appui } from './Appui';
import { LogoToeic } from './certification/LogoToeic';
import { Bouton } from './Bouton';
import { Carte } from './Carte';
import { Ecran } from './Ecran';
import { Etiquette } from './Etiquette';
import { Logo } from './Logo';
import { useProfilCertification } from './certification/useProfilCertification';
import { FeuillePays } from './pass/FeuillePays';

type ChoixCarteProps = {
  titre: string;
  aide: string;
  icone?: LucideIcon;
  /** Remplace l'icône (logo officiel du TOEIC). */
  visuel?: ReactNode;
  couleurIcone?: string;
  couleurFondIcone?: string;
  plein?: 'marque' | 'soleil';
  etiquette?: string;
  onPress: () => void;
};

/** Grande carte de choix (maquettes A1 et A3) : icône Lucide, titre, aide, chevron. */
function ChoixCarte({ titre, aide, icone: Icone, visuel, couleurIcone, couleurFondIcone, plein, etiquette, onPress }: ChoixCarteProps) {
  const { theme } = useTheme();
  const fond = plein === 'marque' ? theme.marque.principale : plein === 'soleil' ? theme.accent.soleil : theme.fond.surface;
  const texte = theme.texte.principal;
  const fondIcone = couleurFondIcone ?? (plein ? theme.fond.surface : theme.fond.creux);
  const iconeCouleur = couleurIcone ?? theme.texte.principal;

  return (
    <Appui accessibilityRole="button" accessibilityLabel={titre} onPress={onPress} decalage={4} ombre={ombre.m} couleurOmbre={theme.ombre} rayon={rayon.l} retour>
      <View style={[styles.choix, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
        <View style={[styles.icone, { backgroundColor: fondIcone, borderColor: theme.bord.fort }]}>
          {visuel ?? (Icone ? <Icone size={20} color={iconeCouleur} strokeWidth={2} /> : null)}
        </View>
        <View style={styles.choixTexte}>
          {etiquette ? <Etiquette texte={etiquette} /> : null}
          <Text style={[typo.texteFort, { color: texte }]}>{titre}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{aide}</Text>
        </View>
        <ChevronRight size={20} color={theme.texte.secondaire} strokeWidth={2} style={styles.chevron} />
      </View>
    </Appui>
  );
}

/** A1 · Bienvenue : aucun compte demandé, deux choix et un appui (M1-01). */
export function Bienvenue() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  // Troisième carte derrière le drapeau PostHog `cert_profile_enabled` (R-09) : faux, l'écran est identique à avant.
  const certification = useProfilCertification();
  return (
    <Ecran>
      <Apparition delai={0}>
        <Logo variante="horizontal" hauteur={44} />
      </Apparition>
      <Apparition delai={60}>
        <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('bienvenue.titre')}</Text>
      </Apparition>
      <Apparition delai={120}>
        <Carte style={{ backgroundColor: theme.accent.soleil }}>
          <View style={styles.groupe}>
            <Etiquette texte={t('bienvenue.exempleEtiquette')} />
            <Text style={[typo.h2, { color: theme.texte.principal }]}>{t('bienvenue.exempleTitre')}</Text>
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('bienvenue.exempleTexte')}</Text>
          </View>
        </Carte>
      </Apparition>
      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('bienvenue.tuEs')}</Text>
      <Apparition delai={180}>
        <ChoixCarte
          icone={GraduationCap}
          couleurIcone={theme.texte.principal}
          couleurFondIcone={theme.accent.soleilTresDoux}
          titre={t('bienvenue.eleve')}
          aide={t('bienvenue.eleveAide')}
          onPress={() => router.push({ pathname: '/classe', params: { type: 'eleve' } })}
        />
      </Apparition>
      <Apparition delai={240}>
        <ChoixCarte
          icone={Trophy}
          couleurIcone={theme.texte.principal}
          couleurFondIcone={theme.accent.soleilTresDoux}
          titre={t('bienvenue.concours')}
          aide={t('bienvenue.concoursAide')}
          onPress={() => router.push({ pathname: '/classe', params: { type: 'concours' } })}
        />
      </Apparition>
      {certification ? (
        <Apparition delai={300}>
          <ChoixCarte
            visuel={<LogoToeic />}
            couleurIcone={theme.texte.principal}
            couleurFondIcone={theme.accent.soleilTresDoux}
            titre={t('certification.carte')}
            aide={t('certification.carteAide')}
            onPress={() => {
              suivre('onboarding_choice_made', { profil: 'certification' });
              router.push('/certification');
            }}
          />
        </Apparition>
      ) : null}
      <Bouton variante="texte" libelle={t('bienvenue.dejaCompte')} onPress={() => router.push('/compte/connexion')} />
    </Ecran>
  );
}

/** Même type, même classe ou filière, même pays, même concours et même série : rien à enregistrer. */
function memeProfil(a: Profil | null, b: Profil): boolean {
  return (
    !!a &&
    a.type === b.type &&
    a.niveau === b.niveau &&
    (a.pays ?? '').toUpperCase() === (b.pays ?? '').toUpperCase() &&
    (a.concours?.id ?? null) === (b.concours?.id ?? null) &&
    (a.serie?.id ?? null) === (b.serie?.id ?? null)
  );
}

/** A2 · Classe (ou concours) et pays, avec valeurs par défaut (M1-01, M1-02). */
export function ChoixClasse() {
  const { t, langue, changerLangue } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ type?: string; modifier?: string }>();
  // H1 : depuis Moi, « Changer de classe » rouvre cet écran avec le profil actuel et revient à Moi.
  const modifier = params.modifier === '1';
  const [type, setType] = useState(params.type);
  const concours = type === 'concours';
  const [niveau, setNiveau] = useState<string>(concours ? CONCOURS[0] : '3e');
  const [monConcours, setMonConcours] = useState<ConcoursChoisi | null>(null);
  const [pays, setPays] = useState<string>(() => paysParDefaut(safeRegion()));
  const [choixPays, setChoixPays] = useState(false);
  const [series, setSeries] = useState<SerieClasse[]>([]);
  const [serie, setSerie] = useState<SerieChoisie | null>(null);
  const listePays = useMemo(() => listerPays(langue, {}), [langue]);
  // Le concours se choisit sur son propre écran (filière puis concours), qui l'enregistre dans le profil.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireProfil().then((p) => {
        if (!actif || p?.type !== 'concours' || !p.concours) return;
        setMonConcours(p.concours);
        if (p.niveau) setNiveau(p.niveau);
      });
      return () => {
        actif = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!modifier) return;
    let actif = true;
    lireProfil().then((p) => {
      if (!actif || !p) return;
      // Le choix du profil (P2) impose le type ; un profil TOEIC ne fournit ni classe ni concours à réutiliser.
      const cible = params.type ?? (p.type === 'certification' ? 'eleve' : p.type);
      setType(cible);
      if (p.type !== 'certification' && p.type === cible && p.niveau) setNiveau(p.niveau);
      if (p.pays) setPays(p.pays.toUpperCase());
      if (p.type === 'eleve' && p.serie) setSerie(p.serie);
    });
    return () => {
      actif = false;
    };
  }, [modifier, params.type]);

  useEffect(() => {
    if (concours) return;
    let actif = true;
    let client = null;
    try {
      client = getSupabase();
    } catch {
      client = null;
    }
    Promise.all([lireSeriesClasse(client, niveau, pays), lireProfil()])
      .then(([liste, p]) => {
        if (!actif) return;
        // Une seule série (« 3e », « 6e »…) est un détail technique : seules les classes qui en ont plusieurs proposent le choix.
        if (liste.length <= 1) {
          setSeries([]);
          const meme = p?.type === 'eleve' && p.niveau === niveau && (p.pays ?? '').toUpperCase() === pays.toUpperCase() ? (p.serie ?? null) : null;
          setSerie(liste.length === 0 ? meme : null);
          return;
        }
        setSeries(liste);
        const connue = p?.serie ? liste.find((s) => s.id === p.serie?.id || s.nom === p.serie?.nom) : null;
        setSerie((actuelle) => {
          const deja = actuelle ? liste.find((s) => s.id === actuelle.id) : null;
          const retenue = deja ?? connue ?? liste[0];
          return retenue ? { id: retenue.id, nom: retenue.nom } : null;
        });
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [concours, niveau, pays]);

  const continuer = async () => {
    if (concours && !monConcours) {
      // Les deux étapes du concours écrivent d'abord un profil de candidat avec ce pays.
      const p = await lireProfil();
      await enregistrerProfil({ type: 'concours', niveau, pays, concours: null, termine: p?.termine ?? false });
      router.push('/concours');
      return;
    }
    const choix = concours ? monConcours : null;
    const serieChoix = !concours && serie ? serie : null;
    if (modifier) {
      const cible: Profil = {
        type: concours ? 'concours' : 'eleve',
        niveau,
        pays,
        concours: choix,
        ...(serieChoix ? { serie: serieChoix } : {}),
        termine: true,
      };
      const actuel = await lireProfil();
      // Rien n'a changé : on revient sans rien écrire (la mission du jour garde son cache).
      if (memeProfil(actuel, cible)) {
        if (router.canGoBack()) router.back();
        else router.replace('/moi');
        return;
      }
      await enregistrerProfil(cible);
      // La mission du jour gardée en cache était tirée pour l'ancienne classe.
      await AsyncStorage.removeItem('mission.jour');
      if (!concours) {
        try {
          void actualiserPlanningProfil(getSupabase(), niveau, pays, serieChoix?.id);
        } catch {
          // Pas de client Supabase configuré (tests unitaires) : rien à recalculer.
        }
      }
      suivre('profile_class_changed', {
        niveau,
        pays,
        statut: concours ? 'concours' : 'eleve',
        ...(serieChoix ? { serie: serieChoix.nom } : {}),
      });
      // Un changement de profil ramène à l'accueil du nouveau profil, quel que soit le parcours d'origine.
      router.dismissAll();
      router.replace('/');
      return;
    }
    await enregistrerProfil({
      type: concours ? 'concours' : 'eleve',
      niveau,
      pays,
      concours: choix,
      ...(serieChoix ? { serie: serieChoix } : {}),
      termine: false,
    });
    suivre('onboarding_choice_made', {
      profil: concours ? 'concours' : 'eleve',
      niveau,
      pays,
      ...(serieChoix ? { serie: serieChoix.nom } : {}),
    });
    router.push('/premier-resultat');
  };

  return (
    <Ecran pied={<Bouton libelle={t(modifier ? 'classe.enregistrer' : 'classe.continuer')} onPress={continuer} retour />}>
      <Bouton petit variante="texte" libelle={t('classe.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/bienvenue'))} />
      {modifier ? (
        // Depuis Moi : on peut aussi changer de statut (élève ou candidat à un concours).
        <View accessibilityRole="radiogroup" accessibilityLabel={t('classe.statut')} style={styles.pastilles}>
          {(['eleve', 'concours'] as const).map((s) => (
            <Pastille
              key={s}
              libelle={t(s === 'eleve' ? 'bienvenue.eleve' : 'bienvenue.concours')}
              actif={(s === 'concours') === concours}
              onPress={() => {
                if ((s === 'concours') === concours) return;
                setType(s);
                setNiveau(s === 'concours' ? CONCOURS[0] : '3e');
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.enteteEtape}>
        <View style={[styles.numeroEtape, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[styles.numeroTexte, { color: theme.texte.principal }]}>1</Text>
        </View>
        <Text style={[typo.h2, { color: theme.texte.principal }]}>
          {concours ? t('classe.tonConcours') : t('classe.taClasse')}
        </Text>
      </View>
      {concours ? (
        <Carte>
          <View style={styles.ligne}>
            <View style={styles.choixTexte}>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('concours.monConcours')}</Text>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{monConcours ? [monConcours.sigle, monConcours.ville].filter(Boolean).join(' · ') : t('concours.aucun')}</Text>
              {monConcours?.nom ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{monConcours.nom}</Text> : null}
            </View>
            <Bouton petit variante="texte" libelle={t('classe.changer')} onPress={() => router.push('/concours')} />
          </View>
        </Carte>
      ) : (
        <>
          <View style={styles.pastilles}>
            {CLASSES.map((o) => (
              <Pastille key={o} libelle={o} actif={niveau === o} onPress={() => setNiveau(o)} />
            ))}
          </View>
          {series.length > 1 ? (
            <View style={styles.blocSerie}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('classe.taSerie')}</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel={t('classe.taSerie')} style={styles.pastilles}>
                {series.map((s) => (
                  <Pastille
                    key={s.id}
                    libelle={s.nom}
                    actif={serie?.id === s.id}
                    onPress={() => setSerie({ id: s.id, nom: s.nom })}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
      <FeuillePays
        ouverte={choixPays}
        pays={listePays}
        choisi={pays}
        onFermer={() => setChoixPays(false)}
        onChoisir={(a2) => {
          setPays(a2.toUpperCase());
          setChoixPays(false);
        }}
      />
      <View style={[styles.enteteEtape, styles.enteteEtapeSuivante]}>
        <View style={[styles.numeroEtape, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[styles.numeroTexte, { color: theme.texte.principal }]}>2</Text>
        </View>
        <Text style={[typo.h2, { color: theme.texte.principal }]}>
          {t('classe.tonPays')}
        </Text>
      </View>
      <View style={styles.lignePaysEpuree}>
        {drapeauPays(pays) ? (
          <Image
            source={{ uri: drapeauPays(pays)! }}
            style={[styles.drapeauGrand, { borderColor: theme.bord.doux }]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>
          {nomPays(pays, langue)}
        </Text>
        <Bouton petit variante="secondaire" libelle={t('classe.changer')} onPress={() => setChoixPays(true)} />
      </View>
      {!modifier ? (
        <>
          <View style={[styles.enteteEtape, styles.enteteEtapeSuivante]}>
            <View style={[styles.numeroEtape, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[styles.numeroTexte, { color: theme.texte.principal }]}>3</Text>
            </View>
            <Text style={[typo.h2, { color: theme.texte.principal }]}>
              {t('classe.langueApp')}
            </Text>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('classe.langueQuestion')} style={styles.pastilles}>
            {([
              ['fr', 'Français'],
              ['en', 'English'],
            ] as const).map(([code, nom]) => (
              <Pastille key={code} libelle={nom} actif={langue === code} onPress={() => void changerLangue(code)} />
            ))}
          </View>
        </>
      ) : null}
    </Ecran>
  );
}

function safeRegion(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

function Pastille({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={libelle}
      onPress={onPress}
      decalage={0}
      rayon={rayon.pilule}
    >
      <View style={[styles.pastille, { backgroundColor: actif ? theme.texte.principal : theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Text style={[typo.texteFort, { color: actif ? theme.texte.inverse : theme.texte.principal }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

async function terminer(): Promise<void> {
  const p = await lireProfil();
  await enregistrerProfil({
    type: p?.type ?? 'eleve',
    niveau: p?.niveau,
    pays: p?.pays,
    ...(p?.concours ? { concours: p.concours } : {}),
    ...(p?.serie ? { serie: p.serie } : {}),
    termine: true,
  });
}

/** A3 · Premier résultat : deux portes (photo ou mini-test) ou explorer (M1-03). La photo mène à l'onglet Photo en attendant le parcours B. */
export function PremierResultat() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const aller = (route: '/photo' | '/') => async () => {
    await terminer();
    router.replace(route);
  };
  return (
    <Ecran pied={<Bouton variante="texte" libelle={t('premier.explorer')} onPress={aller('/')} />}>
      <Bouton petit variante="texte" libelle={t('classe.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/bienvenue'))} />
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('premier.titre')}</Text>
      <ChoixCarte
        plein="marque"
        icone={Camera}
        couleurIcone={theme.texte.principal}
        couleurFondIcone={theme.fond.surface}
        etiquette={t('premier.photoEtiquette')}
        titre={t('premier.photoTitre')}
        aide={t('premier.photoTexte')}
        onPress={aller('/photo')}
      />
      <ChoixCarte
        plein="soleil"
        icone={Zap}
        couleurIcone={theme.texte.principal}
        couleurFondIcone={theme.fond.surface}
        etiquette={t('premier.testEtiquette')}
        titre={t('premier.testTitre')}
        aide={t('premier.testTexte')}
        onPress={() => router.push('/mini-test')}
      />
    </Ecran>
  );
}

export { terminer as terminerParcoursArrivee };

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  choix: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  choixTexte: { flex: 1, gap: espace[2] },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  chevron: { alignSelf: 'center' },
  drapeau: { width: 32, height: 22, borderRadius: 4, borderWidth: bord.fin },
  drapeauGrand: { width: 36, height: 24, borderRadius: 4, borderWidth: bord.fin },
  enteteEtape: { flexDirection: 'row', alignItems: 'center', gap: espace[3], marginTop: espace[2] },
  enteteEtapeSuivante: { marginTop: espace[7] },
  numeroEtape: { width: 28, height: 28, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  numeroTexte: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, lineHeight: 18 },
  flex: { flex: 1 },
  lignePaysEpuree: { flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingVertical: espace[2] },
  blocSerie: { gap: espace[2], marginTop: espace[3] },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  pastille: { minHeight: cibleMin - 6, paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.pilule, alignItems: 'center', justifyContent: 'center' },
});
