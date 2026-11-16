import AsyncStorage from '@react-native-async-storage/async-storage';
import { Briefcase, ChevronDown, Leaf, MoreHorizontal, Palette, Search, GraduationCap, Stethoscope, Trophy, Wrench, X, type LucideIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { getLocales } from 'expo-localization';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { adopterProfil } from '@/services/changementProfil';
import { filtrerConcoursAvance, signalerConcoursChoisi, lireConcoursFiliere, lireFilieres, valeursDistinctes, type ConcoursFiliere, type Filiere } from '@/services/concours';
import { CLE_MISSION } from '@/services/mission';
import { drapeauPays, listerPays, nomPays } from '@/services/pays';
import { enregistrerProfil, lireProfil, paysParDefaut, type ConcoursChoisi, type Profil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere, matiereSecours, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { Feuille } from '../Feuille';
import { BoutonFermer } from '../arrivee/MiniTest';
import { GroupeColle, LigneGroupe } from '../liste/ListeCollee';
import { FeuillePays } from '../pass/FeuillePays';
import { BlocChangementProfil, type EtatChangement } from '../profil/BlocChangementProfil';
import { LogoEcole } from './LogoEcole';
import { FeuilleProposition } from '../proposition/FeuilleProposition';

/** Icône et couleur propres à chaque filière (retouche du 15 novembre 2026) ; couleurs du thème, texte toujours en encre dessus. */
const STYLE_FILIERE: Record<string, { Icone: LucideIcon; couleur: string }> = {
  ingenieurs: { Icone: Wrench, couleur: matiere.physique },
  sante: { Icone: Stethoscope, couleur: matiereSecours[3] },
  ens: { Icone: GraduationCap, couleur: matiere.maths },
  agro: { Icone: Leaf, couleur: matiere.svt },
  commerce: { Icone: Briefcase, couleur: matiere.histoireGeo },
  arts: { Icone: Palette, couleur: matiere.francais },
  autres: { Icone: MoreHorizontal, couleur: matiere.philo },
};
const STYLE_DEFAUT = { Icone: Trophy, couleur: matiere.anglais };

function regionTelephone(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

function PastilleFiliere({ code }: { code: string }) {
  const { theme } = useTheme();
  const { Icone, couleur } = STYLE_FILIERE[code] ?? STYLE_DEFAUT;
  return (
    <View style={[styles.pastille, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
      <Icone size={20} color={theme.texte.surCouleur} strokeWidth={2} />
    </View>
  );
}

function Puce({ libelle, actif, onPress, onEffacer }: { libelle: string; actif: boolean; onPress: () => void; onEffacer?: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={libelle}
      onPress={actif && onEffacer ? onEffacer : onPress}
      style={[styles.puce, { backgroundColor: actif ? theme.accent.soleil : theme.fond.surface, borderColor: theme.bord.fort }]}
    >
      <Text style={[typo.legende, { color: actif ? theme.texte.surCouleur : theme.texte.principal }]}>{libelle}</Text>
      {actif ? <X size={14} color={theme.texte.surCouleur} strokeWidth={2} /> : <ChevronDown size={14} color={theme.texte.principal} strokeWidth={2} />}
    </Pressable>
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
 * Concours : le pays, la filière (un toucher passe à la suite), puis le concours dans une liste collée avec logo, inscrits et
 * filtres ; un toucher ouvre la feuille de détails (retouches du 15 novembre 2026). Le concours choisi se comporte comme une
 * classe : programme, mission du jour et annales le suivent. Utilisé à l'arrivée et depuis Moi.
 */
export function ChoixConcours({ dansPage = false, adoption = false, filierePrefill = null, concoursPrefill = null, onAnnulerAdoption }: ChoixConcoursProps = {}) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [etape, setEtape] = useState<1 | 2>(1);
  const [pays, setPays] = useState<string>(() => paysParDefaut(regionTelephone()));
  const [feuillePays, setFeuillePays] = useState(false);
  const [filieres, setFilieres] = useState<Filiere[] | null | undefined>(undefined);
  const [filiere, setFiliere] = useState<string | null>(null);
  const [liste, setListe] = useState<ConcoursFiliere[] | null | undefined>(undefined);
  const [choisi, setChoisi] = useState<ConcoursFiliere | null>(null);
  const [detail, setDetail] = useState<ConcoursFiliere | null>(null);
  const [recherche, setRecherche] = useState('');
  const [cycle, setCycle] = useState<string | null>(null);
  const [ville, setVille] = useState<string | null>(null);
  const [feuilleFiltre, setFeuilleFiltre] = useState<'cycle' | 'ville' | null>(null);
  const [proposer, setProposer] = useState(false);
  // Type du profil actuel (famille d'origine) et état du bloc d'adoption, pour la page de changement (issue #125).
  const [typeActuel, setTypeActuel] = useState<Profil['type'] | null>(null);
  const [etatAdoption, setEtatAdoption] = useState<EtatChangement>('repos');
  const listePays = useMemo(() => listerPays(langue, {}), [langue]);

  // Pays du profil (ou de la région du téléphone) : lu une fois.
  useEffect(() => {
    let actif = true;
    void lireProfil().then((p) => {
      if (!actif) return;
      setTypeActuel(p?.type ?? null);
      if (p?.pays) setPays(p.pays.toUpperCase());
      if (p?.type === 'concours' && p.niveau) setFiliere(p.niveau);
      else if (filierePrefill) setFiliere(filierePrefill);
    });
    return () => {
      actif = false;
    };
  }, [filierePrefill]);

  // Filières du pays : changer de pays actualise la liste (retour de Benny du 15 novembre 2026).
  useEffect(() => {
    if (!pret) return;
    let actif = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilieres(undefined);
    void lireFilieres(getSupabase(), langue === 'en' ? 'en' : 'fr', pays)
      .then((f) => {
        if (!actif) return;
        setFilieres(f);
        setFiliere((courante) => (courante && f.some((x) => x.code === courante) ? courante : null));
      })
      .catch(() => actif && setFilieres(null));
    return () => {
      actif = false;
    };
  }, [pret, langue, pays]);

  useEffect(() => {
    if (etape !== 2 || !filiere) return;
    let actif = true;
    void Promise.all([lireConcoursFiliere(getSupabase(), filiere, pays), lireProfil()])
      .then(([l, p]) => {
        if (!actif) return;
        setListe(l);
        setChoisi(l.find((c) => c.id === p?.concours?.id) ?? l.find((c) => c.id === concoursPrefill?.id) ?? null);
      })
      .catch(() => actif && setListe(null));
    return () => {
      actif = false;
    };
  }, [etape, filiere, pays, concoursPrefill]);

  const retour = () => (etape === 2 ? revenirFilieres() : router.canGoBack() ? router.back() : router.replace('/bienvenue'));
  const revenirFilieres = () => {
    setEtape(1);
    setRecherche('');
    setCycle(null);
    setVille(null);
    setDetail(null);
  };
  const ouvrirFiliere = (code: string) => {
    setFiliere(code);
    setListe(undefined);
    setChoisi(null);
    setEtape(2);
  };

  const valider = async (c: ConcoursFiliere) => {
    if (!filiere) return;
    const { ecole: _e, cycle: _c, date: _d, sujets: _s, lecons: _l, inscrits: _i, site: _w, logo, ...reste } = c;
    const concours = logo ? { ...reste, logo } : reste;
    await enregistrerProfil({ type: 'concours', niveau: filiere, pays, concours, termine: (await lireProfil())?.termine ?? false });
    // La mission gardée pour aujourd'hui était tirée pour l'ancien programme.
    await AsyncStorage.removeItem(CLE_MISSION);
    suivre('contest_chosen', { filiere, concours: c.sigle });
    void signalerConcoursChoisi(getSupabase(), c.id);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /** Adoption inter-familles (page de changement, issue #125) : le profil quitté est gardé en mémoire, rien n'est effacé. */
  const confirmerAdoption = async () => {
    if (!choisi || !filiere) return;
    const { ecole: _e, cycle: _c, date: _d, sujets: _s, lecons: _l, inscrits: _i, site: _w, logo, ...reste } = choisi;
    const concours = logo ? { ...reste, logo } : reste;
    setEtatAdoption('charge');
    try {
      await adopterProfil({ type: 'concours', niveau: filiere, pays, concours: concours as ConcoursChoisi, termine: true });
      await AsyncStorage.removeItem(CLE_MISSION);
      suivre('contest_chosen', { filiere, concours: choisi.sigle });
      router.dismissAll();
      router.replace('/');
    } catch {
      setEtatAdoption('erreur');
    }
  };

  /** « Choisir ce concours » de la feuille de détails : enregistre tout de suite, ou garde le choix pour le bloc d'adoption. */
  const choisirDepuisDetail = (c: ConcoursFiliere) => {
    setDetail(null);
    if (adoption) setChoisi(c);
    else void valider(c);
  };

  const nomFiliere = filieres?.find((f) => f.code === filiere)?.nom ?? '';
  const nomDuPays = nomPays(pays, langue);
  const cycles = useMemo(() => (liste ? valeursDistinctes(liste, 'cycle') : []), [liste]);
  const villes = useMemo(() => (liste ? valeursDistinctes(liste, 'ville') : []), [liste]);
  const visibles = liste ? filtrerConcoursAvance(liste, recherche, cycle, ville) : [];
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
    ) : undefined;

  const drapeau = drapeauPays(pays);
  const lignePays = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('concours.tonPays')} : ${nomDuPays}. ${t('concours.changerPays')}`}
      onPress={() => setFeuillePays(true)}
      style={[styles.lignePays, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}
    >
      {drapeau ? <Image source={{ uri: drapeau }} style={styles.drapeau} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{nomDuPays}</Text>
      <Text style={[typo.legende, { color: theme.texte.lien }]}>{t('concours.changerPays')}</Text>
    </Pressable>
  );

  return (
    <Ecran
      insetHaut={!dansPage}
      pied={piedAdoption}
      entete={
        !dansPage ? (
          <>
            <BoutonFermer icone="chevron-back" libelle={t('classe.retour')} onPress={retour} />
            <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>
              {etape === 1 ? t('concours.filiereTitre') : nomFiliere}
            </Text>
          </>
        ) : undefined
      }
    >
      {etape === 1 ? (
        <>
          {dansPage ? <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('concours.filiereTitre')}</Text> : null}
          {lignePays}
          {filieres === null ? <Banniere ton="erreur" titre={t('concours.erreur')} /> : null}
          {filieres && filieres.length > 0 ? (
            <View accessibilityRole="radiogroup">
              <GroupeColle>
                {filieres.map((f, i) => (
                  <LigneGroupe
                    key={f.code}
                    premier={i === 0}
                    gauche={<PastilleFiliere code={f.code} />}
                    titre={f.nom}
                    sousTitre={t(f.concours > 1 ? 'concours.nombre' : 'concours.nombre1', { n: f.concours })}
                    onPress={() => ouvrirFiliere(f.code)}
                  />
                ))}
              </GroupeColle>
            </View>
          ) : null}
          {filieres && filieres.length === 0 ? (
            <View style={[styles.vide, { borderColor: theme.bord.fort }]}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('concours.filiereVideTitre', { pays: nomDuPays })}</Text>
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('concours.filiereVideTexte')}</Text>
              <Bouton libelle={t('concours.proposerBouton')} onPress={() => setProposer(true)} />
              <Bouton variante="secondaire" libelle={t('concours.autrePays')} onPress={() => setFeuillePays(true)} />
            </View>
          ) : null}
        </>
      ) : (
        <>
          {dansPage ? <Bouton petit variante="texte" libelle={t('concours.retourFilieres')} onPress={revenirFilieres} /> : null}
          {dansPage ? <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{nomFiliere}</Text> : null}
          <Champ
            libelle={t('concours.chercher')}
            libelleDroite={t('concours.sousTitreListe', { pays: nomDuPays, n: liste ? liste.length : '…' })}
            value={recherche}
            onChangeText={setRecherche}
            autoCorrect={false}
          />
          {liste && (cycles.length > 1 || villes.length > 1) ? (
            <View style={styles.puces}>
              {cycles.length > 1 ? <Puce libelle={cycle ?? t('concours.niveau')} actif={cycle !== null} onPress={() => setFeuilleFiltre('cycle')} onEffacer={() => setCycle(null)} /> : null}
              {villes.length > 1 ? <Puce libelle={ville ?? t('concours.ville')} actif={ville !== null} onPress={() => setFeuilleFiltre('ville')} onEffacer={() => setVille(null)} /> : null}
            </View>
          ) : null}
          {liste === null ? <Banniere ton="erreur" titre={t('concours.erreur')} /> : null}
          {liste && visibles.length > 0 ? (
            <GroupeColle>
              {visibles.map((c, i) => (
                <LigneGroupe
                  key={c.id}
                  premier={i === 0}
                  gauche={<LogoEcole concours={c} />}
                  titre={[c.sigle, c.ville].filter(Boolean).join(' · ')}
                  bas={
                    <View style={styles.baseLigne}>
                      {c.cycle ? <Etiquette texte={c.cycle} jaune /> : null}
                      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                        {[c.cycle ? null : c.nom, c.sujets ? t(c.sujets > 1 ? 'annales.sujets' : 'annales.sujet', { n: c.sujets }) : null, c.inscrits ? t(c.inscrits > 1 ? 'concours.inscrits' : 'concours.inscritUn', { n: c.inscrits }) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  }
                  enCours={choisi?.id === c.id}
                  onPress={() => setDetail(c)}
                />
              ))}
            </GroupeColle>
          ) : null}
          {liste && visibles.length === 0 ? (
            <View style={[styles.vide, { borderColor: theme.bord.fort }]}>
              <Search size={20} color={theme.texte.secondaire} strokeWidth={2} />
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('concours.listeVideTitre')}</Text>
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('concours.listeVideTexte', { pays: nomDuPays })}</Text>
              <Bouton variante="secondaire" libelle={t('concours.voirFilieres', { pays: nomDuPays })} onPress={revenirFilieres} />
            </View>
          ) : null}
        </>
      )}

      <FeuillePays
        ouverte={feuillePays}
        pays={listePays}
        choisi={pays}
        onFermer={() => setFeuillePays(false)}
        onChoisir={(a2) => {
          setFeuillePays(false);
          if (a2.toUpperCase() !== pays) {
            setPays(a2.toUpperCase());
            revenirFilieres();
            setFiliere(null);
            setListe(undefined);
          }
        }}
      />
      <FeuilleProposition ouverte={proposer} onFermer={() => setProposer(false)} genre="concours" pays={pays} nomPays={nomDuPays} />
      <Feuille
        ouverte={feuilleFiltre !== null}
        onFermer={() => setFeuilleFiltre(null)}
        titre={feuilleFiltre === 'cycle' ? t('concours.niveau') : t('concours.ville')}
        actions={[{ libelle: t('concours.detailFermer'), onPress: () => setFeuilleFiltre(null), variante: 'texte' }]}
      >
        <GroupeColle>
          {[null, ...(feuilleFiltre === 'cycle' ? cycles : villes)].map((v, i) => (
            <LigneGroupe
              key={v ?? 'tous'}
              premier={i === 0}
              titre={v ?? t('concours.tous')}
              droite={<View />}
              enCours={(feuilleFiltre === 'cycle' ? cycle : ville) === v}
              onPress={() => {
                if (feuilleFiltre === 'cycle') setCycle(v);
                else setVille(v);
                setFeuilleFiltre(null);
              }}
            />
          ))}
        </GroupeColle>
      </Feuille>
      <Feuille
        ouverte={detail !== null}
        onFermer={() => setDetail(null)}
        titre={detail ? [detail.sigle, detail.ville].filter(Boolean).join(' · ') : ''}
        texte={detail ? detail.ecole : undefined}
        actions={[
          { libelle: t('concours.detailChoisir'), onPress: () => detail && choisirDepuisDetail(detail) },
          { libelle: t('concours.detailFermer'), onPress: () => setDetail(null), variante: 'texte' },
        ]}
      >
        {detail ? (
          <>
            <View style={styles.enteteDetail}>
              <LogoEcole concours={detail} taille={72} />
              <View style={styles.flex}>
                {detail.cycle ? <Etiquette texte={detail.cycle} jaune /> : null}
                {detail.ville ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{detail.ville}</Text> : null}
              </View>
            </View>
            <View style={styles.stats}>
              <View style={[styles.stat, { borderColor: theme.bord.doux }]}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{detail.sujets}</Text>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('concours.detailSujets')}</Text>
              </View>
              {detail.inscrits ? (
                <View style={[styles.stat, { borderColor: theme.bord.doux }]}>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{detail.inscrits}</Text>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('concours.detailInscrits')}</Text>
                </View>
              ) : null}
              {detail.date ? (
                <View style={[styles.stat, { borderColor: theme.bord.doux }]}>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{new Date(detail.date).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' })}</Text>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('concours.detailDate')}</Text>
                </View>
              ) : null}
            </View>
            {detail.site ? (
              <Bouton
                variante="secondaire"
                libelle={t('concours.detailSite')}
                onPress={() => void Linking.openURL(detail.site as string).catch(() => undefined)}
              />
            ) : null}
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('concours.detailAide')}</Text>
          </>
        ) : null}
      </Feuille>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pastille: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  lignePays: { flexDirection: 'row', alignItems: 'center', gap: espace[3], minHeight: 52, paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  drapeau: { width: 24, height: 16, borderRadius: 2 },
  puces: { flexDirection: 'row', gap: espace[3], flexWrap: 'wrap' },
  puce: { flexDirection: 'row', alignItems: 'center', gap: espace[2], minHeight: 36, paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.pilule },
  vide: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderStyle: 'dashed', borderRadius: rayon.m },
  stats: { flexDirection: 'row', gap: espace[3] },
  enteteDetail: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  baseLigne: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espace[2], marginTop: espace[1] },
  stat: { flex: 1, gap: 2, padding: espace[3], borderWidth: bord.fin, borderRadius: rayon.m },
});
