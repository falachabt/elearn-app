import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, BookOpen, Check, RotateCw, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import {
  cartesDe,
  dimancheDe,
  jourCourt,
  joursFaits,
  lireRecap,
  marquerSemaineVue,
  titreMissions,
  type CarteRecap,
  type Recap,
} from '@/services/maSemaine';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typeContenu, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { BoutonFermer } from '../arrivee/MiniTest';
import { couleursBouton } from '../Bouton';
import { useFeedback } from '../useFeedback';

type Source = 'auto' | 'push' | 'inbox';
type Etat =
  | { type: 'chargement' }
  | { type: 'pret'; recap: Recap; copie: boolean }
  | { type: 'vide' }
  | { type: 'pasReseau' };

/** Déplacement horizontal minimal pour compter un balayage, en pixels. */
const SEUIL_BALAYAGE = 50;
/** Un appui plus court que ça (ms) et sans déplacement est un appui sur un tiers de l'écran. */
const DUREE_APPUI_MS = 400;
const DEPLACEMENT_APPUI = 12;
const DUREE_COMPTEUR_MS = 600;
const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const;

const sourceDe = (valeur?: string): Source => (valeur === 'auto' || valeur === 'inbox' ? valeur : 'push');

// --- Briques ----------------------------------------------------------------------------------------------------------

/** Nombre qui monte de 0 à sa valeur en 600 ms ; sans animation si « Réduire les animations ». Le libellé garde la valeur finale. */
function Nombre({ valeur, style, testID }: { valeur: number; style: object; testID?: string }) {
  const { reduit } = useFeedback();
  const [progression, setProgression] = useState(0);
  const anime = !reduit && valeur > 0;
  useEffect(() => {
    if (!anime) return;
    const debut = Date.now();
    const minuteur = setInterval(() => {
      const p = Math.min(1, (Date.now() - debut) / DUREE_COMPTEUR_MS);
      setProgression(p);
      if (p >= 1) clearInterval(minuteur);
    }, 32);
    return () => clearInterval(minuteur);
  }, [anime, valeur]);
  const affiche = anime ? Math.round(valeur * progression) : valeur;
  return <Text testID={testID} accessibilityLabel={String(valeur)} style={style}>{affiche}</Text>;
}

/** Bloc avec bordure 2 et ombre dure. */
function Bloc({ fond, decalage = ombre.m, children, style }: { fond: string; decalage?: number; children: ReactNode; style?: object }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingRight: decalage, paddingBottom: decalage }}>
      <View style={[styles.ombre, { left: decalage, top: decalage, backgroundColor: theme.ombre }]} />
      <View style={[styles.bloc, { backgroundColor: fond, borderColor: theme.bord.fort }, style]}>{children}</View>
    </View>
  );
}

/** Bloc coloré : le texte est toujours noir dessus, dans les deux thèmes. */
function Hero({ fond, valeur, libelle, taille = 88, testID }: { fond: string; valeur: number; libelle: string; taille?: number; testID?: string }) {
  const { theme } = useTheme();
  const ligne = taille < 70;
  return (
    <Bloc fond={fond} style={ligne ? styles.heroLigne : styles.heroGrand}>
      <Nombre testID={testID} valeur={valeur} style={{ ...typo.chiffreXL, fontSize: taille, lineHeight: Math.round(taille * 0.96), letterSpacing: -2, color: theme.texte.surCouleur, minWidth: ligne ? 76 : undefined }} />
      <Text style={[ligne ? typo.h3 : styles.libelleGrand, { color: theme.texte.surCouleur, flex: ligne ? 1 : undefined }]}>{libelle}</Text>
    </Bloc>
  );
}

function CarteBlanche({ etiquette, children }: { etiquette: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <Bloc fond={theme.fond.surface} decalage={ombre.carte} style={styles.carteBlanche}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{etiquette}</Text>
      {children}
    </Bloc>
  );
}

type VarianteBouton = 'primaire' | 'secondaire' | 'texte';

function BoutonRecap({ libelle, onPress, variante = 'primaire', icone: Icone, apres }: { libelle: string; onPress: () => void; variante?: VarianteBouton; icone?: LucideIcon; apres?: boolean }) {
  const { theme } = useTheme();
  const plat = variante === 'texte';
  const c = couleursBouton(theme, variante);
  const encre = plat ? theme.texte.principal : c.texte;
  const icone = Icone ? <Icone size={20} strokeWidth={2} color={encre} /> : null;
  return (
    <Appui accessibilityRole="button" onPress={onPress} decalage={plat ? 0 : ombre.m} ombre={plat ? 0 : ombre.m} couleurOmbre={c.ombre} rayon={rayon.m} style={styles.zoneBouton}>
      <View style={[styles.bouton, { minHeight: plat ? 44 : 52, backgroundColor: c.fond, borderColor: c.bord }]}>
        {!apres ? icone : null}
        <Text style={[typo.bouton, { color: encre }, plat && styles.souligne]}>{libelle}</Text>
        {apres ? icone : null}
      </View>
    </Appui>
  );
}

function Segments({ total, courante }: { total: number; courante: number }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.segments}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          testID="segment"
          accessibilityLabel={t('maSemaine.segment', { n: i + 1, total })}
          style={[styles.segment, { borderColor: theme.bord.fort, backgroundColor: i < courante ? theme.texte.principal : i === courante ? theme.marque.principale : theme.fond.creux }]}
        />
      ))}
    </View>
  );
}

function Entete({ onFermer }: { onFermer: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.entete}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('maSemaine.etiquette')}</Text>
      <BoutonFermer libelle={t('maSemaine.fermer')} onPress={onFermer} />
    </View>
  );
}

// --- Cartes -----------------------------------------------------------------------------------------------------------

function Titre({ surtitre, titre, annonce }: { surtitre: string; titre: string; annonce: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: espace[2] }}>
      <Text accessibilityLabel={`${surtitre}. ${annonce}`} style={[typo.etiquette, { color: theme.texte.secondaire }]}>{surtitre}</Text>
      <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{titre}</Text>
    </View>
  );
}

const TITRES = { pleine: 'maSemaine.titrePleine', regularite: 'maSemaine.titreRegularite', debut: 'maSemaine.titreDebut', avance: 'maSemaine.titreAvance' } as const;

function CarteMissions({ recap, annonce }: { recap: Recap; annonce: string }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const faits = joursFaits(recap);
  const surtitre = t('maSemaine.semaineDu', { debut: jourCourt(recap.semaine, langue), fin: jourCourt(dimancheDe(recap.semaine), langue) });
  return (
    <>
      <Titre surtitre={surtitre} titre={t(TITRES[titreMissions(recap.missions)])} annonce={annonce} />
      <Hero testID="hero-missions" fond={theme.marque.principale} valeur={recap.missions} libelle={t(recap.missions > 1 ? 'maSemaine.missionsPlus' : 'maSemaine.missionUne')} />
      {recap.missionsParJour ? (
        <>
          <CarteBlanche etiquette={t('maSemaine.tesJours')}>
            <View style={styles.jours}>
              {recap.missionsParJour.map((fait, i) => (
                <View
                  key={JOURS[i]}
                  testID={fait ? 'jour-fait' : 'jour-pas-fait'}
                  accessibilityLabel={`${t(`maSemaine.noms.${JOURS[i]}`)} : ${t(fait ? 'maSemaine.jourFait' : 'maSemaine.jourPasFait')}`}
                  style={styles.jour}
                >
                  <View style={[styles.caseJour, { backgroundColor: fait ? theme.marque.principale : theme.fond.creux, borderColor: fait ? theme.bord.fort : theme.bord.doux }]}>
                    {fait ? <Check size={18} strokeWidth={3} color={theme.texte.surCouleur} /> : null}
                  </View>
                  <Text style={[typo.etiquette, { color: fait ? theme.texte.principal : theme.texte.secondaire }]}>{t(`maSemaine.initiales.${JOURS[i]}`)}</Text>
                </View>
              ))}
            </View>
          </CarteBlanche>
          <Text testID="regularite" style={[typo.texte, { color: theme.texte.principal }]}>{t(faits > 1 ? 'maSemaine.regularitePlus' : 'maSemaine.regulariteUn', { n: faits })}</Text>
        </>
      ) : null}
    </>
  );
}

function CarteAppris({ recap, annonce }: { recap: Recap; annonce: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const lignes = [
    { cle: 'lecons', valeur: recap.leconsValidees, fond: theme.marque.principale, libelle: t(recap.leconsValidees > 1 ? 'maSemaine.leconsPlus' : 'maSemaine.leconUne') },
    { cle: 'quiz', valeur: recap.quizTermines, fond: typeContenu.quiz, libelle: t(recap.quizTermines > 1 ? 'maSemaine.quizPlus' : 'maSemaine.quizUn') },
    { cle: 'exercices', valeur: recap.exercicesFaits, fond: typeContenu.exercice, libelle: t(recap.exercicesFaits > 1 ? 'maSemaine.exercicesPlus' : 'maSemaine.exerciceUn') },
  ].filter((l) => l.valeur > 0);
  return (
    <>
      <Titre surtitre={t('maSemaine.apprisSurtitre')} titre={t('maSemaine.apprisTitre')} annonce={annonce} />
      {lignes.map((l) => (
        <Hero key={l.cle} testID={`hero-${l.cle}`} fond={l.fond} valeur={l.valeur} libelle={l.libelle} taille={56} />
      ))}
      <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('maSemaine.apprisTexte')}</Text>
    </>
  );
}

function CarteRatees({ recap, annonce }: { recap: Recap; annonce: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <>
      <Titre surtitre={t('maSemaine.rateesSurtitre')} titre={t('maSemaine.rateesTitre')} annonce={annonce} />
      <Hero testID="hero-ratees" fond={typeContenu.exercice} valeur={recap.questionsRatees} libelle={t(recap.questionsRatees > 1 ? 'maSemaine.rateesPlus' : 'maSemaine.rateeUne')} />
      <CarteBlanche etiquette={t('maSemaine.reflexe')}>
        <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('maSemaine.reflexeTexte')}</Text>
      </CarteBlanche>
    </>
  );
}

function CarteCredits({ recap, annonce }: { recap: Recap; annonce: string }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const credits = (n: number) => t(n > 1 ? 'maSemaine.nCredits' : 'maSemaine.nCredit', { n });
  return (
    <>
      <Titre surtitre={t('maSemaine.creditsSurtitre')} titre={t(recap.passActif ? 'maSemaine.creditsTitrePass' : 'maSemaine.creditsTitre')} annonce={annonce} />
      {recap.passActif ? (
        <Bloc fond={theme.accent.soleil} style={styles.heroGrand}>
          <Text testID="credits-illimites" style={[typo.chiffreXL, { fontSize: 52, lineHeight: 54, letterSpacing: -1, color: theme.texte.surCouleur }]}>{t('maSemaine.illimites')}</Text>
          <Text style={[styles.libelleGrand, { color: theme.texte.surCouleur }]}>{t('maSemaine.avecPass')}</Text>
        </Bloc>
      ) : (
        <Hero testID="hero-credits" fond={theme.accent.soleil} valeur={recap.creditsUtilises} libelle={t(recap.creditsUtilises > 1 ? 'maSemaine.creditsPlus' : 'maSemaine.creditUn')} />
      )}
      <CarteBlanche etiquette={t('maSemaine.pourLaSuite')}>
        {recap.passActif ? (
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('maSemaine.passTexte')}</Text>
        ) : (
          <Text testID="pour-la-suite" style={[typo.texte, { color: theme.texte.principal }]}>
            {t('maSemaine.resteAvant')}
            <Text style={typo.texteFort}>{credits(recap.solde)}</Text>
            {t('maSemaine.resteMilieu')}
            <Text style={typo.texteFort}>{credits(recap.rechargeLundi)}</Text>
            {t('maSemaine.resteFin')}
          </Text>
        )}
      </CarteBlanche>
    </>
  );
}

// --- États ------------------------------------------------------------------------------------------------------------

function Squelette({ largeur, hauteur, rond }: { largeur: `${number}%`; hauteur: number; rond?: boolean }) {
  const { theme } = useTheme();
  return <View style={{ width: largeur, height: hauteur, borderRadius: rond ? rayon.l : rayon.m, backgroundColor: theme.fond.creux }} />;
}

function Chargement() {
  const { t } = useTraduction();
  return (
    <View testID="recap-chargement" accessibilityLabel={t('maSemaine.chargement')} style={styles.corps}>
      <Squelette largeur="55%" hauteur={14} />
      <Squelette largeur="80%" hauteur={38} />
      <Squelette largeur="100%" hauteur={200} rond />
      <Squelette largeur="100%" hauteur={110} rond />
      <Squelette largeur="70%" hauteur={16} />
    </View>
  );
}

function EtatCentre({ icone: Icone, fond, titre, texte }: { icone: LucideIcon; fond: string; titre: string; texte: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.corps, styles.centre]}>
      <Bloc fond={fond} style={styles.pastilleEtat}>
        <Icone size={34} strokeWidth={2} color={theme.texte.surCouleur} />
      </Bloc>
      <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{titre}</Text>
      <Text style={[typo.texte, { color: theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

function BandeHorsLigne() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.bande, { backgroundColor: theme.etat.alerteDoux, borderColor: theme.bord.fort }]}>
      <WifiOff size={18} strokeWidth={2} color={theme.texte.principal} />
      <Text style={[typo.petit, { color: theme.texte.principal, flex: 1 }]}>{t('maSemaine.horsLigne')}</Text>
    </View>
  );
}

// --- Écran ------------------------------------------------------------------------------------------------------------

/**
 * « Ma semaine » : mini récap de la semaine passée en 4 cartes (missions, appris, à rattraper, crédits). Les cartes à
 * zéro sont sautées. Ouverte seule au premier lancement de la semaine, ou par la notification du lundi (push et
 * centre). Maquette validée par Benny le 7 octobre : `docs/maquettes/ma-semaine.md`.
 */
export function MaSemaine() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { declencher } = useFeedback();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ semaine?: string; source?: string }>();
  const source = sourceDe(params.source);
  const utilisateur = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' });
  const [index, setIndex] = useState(0);
  const [essai, setEssai] = useState(0);
  const affichee = useRef(false);
  const toucher = useRef<{ x: number; y: number; t: number } | null>(null);

  const semaineDemandee = params.semaine;
  useEffect(() => {
    if (utilisateur === null) return;
    let actif = true;
    void lireRecap(getSupabase(), semaineDemandee)
      .then(({ recap, copie }) => actif && setEtat(recap ? { type: 'pret', recap, copie } : { type: 'vide' }))
      .catch(() => actif && setEtat({ type: 'pasReseau' }));
    return () => {
      actif = false;
    };
  }, [utilisateur, semaineDemandee, essai]);

  const recap = etat.type === 'pret' ? etat.recap : null;
  const cartes: CarteRecap[] = recap ? cartesDe(recap) : [];
  const semaine = recap?.semaine ?? semaineDemandee ?? '';

  // Première carte affichée : la semaine est vue, évènement et retour sonore (spec §5, §7, §8).
  useEffect(() => {
    if (!recap || affichee.current) return;
    affichee.current = true;
    suivre('week_recap_shown', { source, semaine: recap.semaine });
    void marquerSemaineVue(recap.semaine);
    declencher('arrive');
    if (recap.missions >= 7) declencher('streak');
  }, [recap, source, declencher]);

  useEffect(() => {
    if (recap) suivre('week_recap_card_viewed', { index: index + 1, semaine: recap.semaine });
  }, [recap, index]);

  const fermer = useCallback(
    (cta?: 'fermer') => {
      if (cta) suivre('week_recap_cta', { cta, semaine });
      suivre('week_recap_closed', { derniere_carte: index + 1, semaine });
      if (router.canGoBack()) router.back();
      else router.replace('/');
    },
    [index, semaine],
  );

  const suivant = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(cartes.length - 1, 0))), [cartes.length]);
  const precedent = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Bouton retour Android : carte précédente, puis fermeture.
  useEffect(() => {
    const abo = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) {
        precedent();
        return true;
      }
      return false;
    });
    return () => abo.remove();
  }, [index, precedent]);

  const debutToucher = (e: GestureResponderEvent) => {
    toucher.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: e.nativeEvent.timestamp };
  };
  const finToucher = (e: GestureResponderEvent) => {
    const d = toucher.current;
    toucher.current = null;
    if (!d || !recap) return;
    const dx = e.nativeEvent.pageX - d.x;
    const dy = e.nativeEvent.pageY - d.y;
    if (Math.abs(dx) >= SEUIL_BALAYAGE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) suivant();
      else precedent();
      return;
    }
    if (Math.abs(dx) <= DEPLACEMENT_APPUI && Math.abs(dy) <= DEPLACEMENT_APPUI && e.nativeEvent.timestamp - d.t <= DUREE_APPUI_MS) {
      if (d.x > (width * 2) / 3) suivant();
      else if (d.x < width / 3) precedent();
    }
  };

  const carte = cartes[index];
  const derniere = index >= cartes.length - 1;
  const annonce = t('maSemaine.carteSur', { n: index + 1, total: cartes.length });

  const sortir = (cta: 'aller_reviser' | 'faire_mission' | 'reessayer' | 'refaire_erreurs', action: () => void) => () => {
    suivre('week_recap_cta', { cta, semaine });
    action();
  };

  let corps: ReactNode;
  let pied: ReactNode = null;
  if (etat.type === 'chargement') {
    corps = <Chargement />;
  } else if (etat.type === 'vide') {
    corps = <EtatCentre icone={BookOpen} fond={theme.marque.principale} titre={t('maSemaine.videTitre')} texte={t('maSemaine.videTexte')} />;
    pied = (
      <>
        <BoutonRecap libelle={t('maSemaine.faireMission')} onPress={sortir('faire_mission', () => router.replace('/'))} />
        <BoutonRecap variante="texte" libelle={t('maSemaine.fermer')} onPress={() => fermer('fermer')} />
      </>
    );
  } else if (etat.type === 'pasReseau') {
    corps = <EtatCentre icone={WifiOff} fond={theme.accent.soleil} titre={t('maSemaine.pasReseauTitre')} texte={t('maSemaine.pasReseauTexte')} />;
    pied = (
      <>
        <BoutonRecap icone={RotateCw} libelle={t('maSemaine.reessayer')} onPress={sortir('reessayer', () => {
          setEtat({ type: 'chargement' });
          setEssai((n) => n + 1);
        })} />
        <BoutonRecap variante="texte" libelle={t('maSemaine.fermer')} onPress={() => fermer('fermer')} />
      </>
    );
  } else if (recap && carte) {
    corps = (
      <View testID={`carte-${carte}`} style={styles.corps}>
        {carte === 'missions' ? <CarteMissions recap={recap} annonce={annonce} /> : null}
        {carte === 'appris' ? <CarteAppris recap={recap} annonce={annonce} /> : null}
        {carte === 'ratees' ? <CarteRatees recap={recap} annonce={annonce} /> : null}
        {carte === 'credits' ? <CarteCredits recap={recap} annonce={annonce} /> : null}
      </View>
    );
    const suite = (variante: VarianteBouton) =>
      derniere ? (
        <BoutonRecap variante={variante} libelle={t('maSemaine.fermer')} onPress={() => fermer('fermer')} />
      ) : (
        <BoutonRecap variante={variante} libelle={t('maSemaine.suivant')} icone={ArrowRight} apres onPress={suivant} />
      );
    pied =
      carte === 'ratees' ? (
        <>
          <BoutonRecap icone={RotateCw} libelle={t('maSemaine.refaireErreurs')} onPress={sortir('refaire_erreurs', () => router.push('/mission/erreurs'))} />
          {suite('secondaire')}
        </>
      ) : carte === 'credits' ? (
        <>
          <BoutonRecap icone={BookOpen} libelle={t('maSemaine.allerReviser')} onPress={sortir('aller_reviser', () => router.replace('/reviser'))} />
          <BoutonRecap variante="texte" libelle={t('maSemaine.fermer')} onPress={() => fermer('fermer')} />
        </>
      ) : (
        suite('primaire')
      );
  }

  return (
    <View style={[styles.racine, { backgroundColor: theme.fond.app, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, espace[5]) }]}>
      {recap ? <Segments total={cartes.length} courante={index} /> : null}
      <Entete onFermer={() => fermer()} />
      {etat.type === 'pret' && etat.copie ? <BandeHorsLigne /> : null}
      <ScrollView testID="recap-corps" style={styles.defile} contentContainerStyle={styles.defileContenu} onTouchStart={debutToucher} onTouchEnd={finToucher} keyboardShouldPersistTaps="handled">
        {corps}
      </ScrollView>
      <View style={styles.pied}>{pied}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: espace[5], paddingTop: espace[2] },
  segment: { flex: 1, height: 8, borderWidth: bord.normal, borderRadius: rayon.s },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], paddingTop: espace[4], minHeight: cibleMin + espace[4] },
  defile: { flex: 1 },
  defileContenu: { flexGrow: 1 },
  corps: { paddingHorizontal: espace[5], paddingTop: espace[2], gap: 14 },
  centre: { flex: 1, justifyContent: 'center', paddingBottom: espace[8] },
  pied: { paddingHorizontal: espace[5], paddingTop: espace[4], gap: espace[4] - 2 },
  ombre: { position: 'absolute', right: 0, bottom: 0, top: 0, left: 0, borderRadius: rayon.l },
  bloc: { borderWidth: bord.normal, borderRadius: rayon.l },
  heroGrand: { paddingHorizontal: espace[6] - 2, paddingTop: espace[6] - 2, paddingBottom: espace[5] },
  heroLigne: { flexDirection: 'row', alignItems: 'center', gap: espace[5], paddingHorizontal: espace[5], paddingVertical: espace[4] + 2 },
  libelleGrand: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 19, lineHeight: 24, marginTop: espace[3] },
  carteBlanche: { padding: espace[5] - 2, gap: espace[3] },
  jours: { flexDirection: 'row', gap: espace[3] - 2, marginTop: espace[1] },
  jour: { flex: 1, alignItems: 'center', gap: 5 },
  caseJour: { width: '100%', maxWidth: 40, aspectRatio: 1, borderWidth: bord.normal, borderRadius: rayon.m - 2, alignItems: 'center', justifyContent: 'center' },
  zoneBouton: { alignSelf: 'stretch' },
  bouton: { flexDirection: 'row', gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espace[6] - 4 },
  souligne: { textDecorationLine: 'underline' },
  bande: { flexDirection: 'row', gap: espace[3], alignItems: 'center', marginHorizontal: espace[5], marginTop: espace[3], padding: espace[3] + 2, borderWidth: bord.normal, borderRadius: rayon.m },
  pastilleEtat: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
});
