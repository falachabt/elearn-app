import { Ionicons } from '@expo/vector-icons';
import { ChevronDown, GraduationCap, Trophy } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerSerie, chargerMission, jourLocal, lireAlerteSerie, lireDernierResultat, lireHistorique, noterAlerteSerie, type Mission, type ResultatMission } from '@/services/mission';
import { lireRythme } from '@/services/rythme';
import { lireProfil, profilDepuisCompte, type Profil } from '@/services/profil';
import { suivre } from '@/services/analytics';
import { doitRappelerCompte, noterRappelCompte } from '@/services/rappels';
import { getSupabase } from '@/services/supabase';
import { useSession, useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Apparition } from '../Apparition';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { CompteurCredits } from '../credits/CompteurCredits';
import { Ecran } from '../Ecran';
import { FeuilleCompte, useInvite } from '../FeuilleCompte';
import { Cloche } from '../notifications/Cloche';
import { CompteARebours } from '../accueil/CompteARebours';
import { CartePlanning } from '../planning/CartePlanning';
import { lireCalendrierClasse, prochaineEcheance, type EcheanceClasse } from '@/services/calendrier';
import { AvatarNiveau } from '../xp/AvatarNiveau';
import { AssistantConfiguration } from './AssistantConfiguration';
import { FeuilleSerie } from './FeuilleSerie';
import { Reprise } from './Reprise';
import { identiteDe } from '@/services/identite';
import { ecouterGainXp, lireUserXp } from '@/services/xp';

type Etat = { mission: Mission | null; serie: number; faite: ResultatMission | null };

/** Exemple du compte à rebours en développement : une date dans 243 jours. Jamais utilisée en production. */
const CIBLE_EXEMPLE = new Date(Date.now() + 243 * 86_400_000);

/** Titre de la carte : trois lignes au plus (une leçon au titre très long ne pousse plus le reste de l'écran vers le bas). */
const LIGNES_TITRE = 3;
const HAUTEUR_ETIQUETTE = 32;

/** Titre de la carte : les deux premiers chapitres de la mission. */
export function titreMission(m: Mission | null): string | null {
  const chapitres = [...new Set(m?.questions.map((q) => q.chapitre).filter(Boolean) ?? [])];
  return chapitres.length ? chapitres.slice(0, 2).join(', ') : null;
}

/**
 * Libellé court du profil affiché dans le sélecteur d'en-tête :
 * - élève : classe seule (ex. 3e, Tle) sans le pays
 * - concours : sigle seul (ex. ENS, Médecine) sans le pays
 */
export function libelleProfil(profil: Profil | null): string {
  if (!profil) return '3e';
  if (profil.type === 'concours') {
    return (
      profil.concours?.sigle ??
      (profil.niveau === 'ens'
        ? 'ENS'
        : profil.niveau === 'medecine'
          ? 'Médecine'
          : profil.niveau === 'ingenieurs'
            ? 'Ingénieurs'
            : profil.niveau ?? 'Concours')
    );
  }
  const classe = profil.niveau || '3e';
  const court = profil.serie?.nom ? profil.serie.nom.replace(/^(s[eé]rie|seconde|premi[eè]re|terminale)\s+/i, '').trim() : '';
  return court && court.toLowerCase() !== classe.toLowerCase() ? `${classe} ${court}` : classe;
}

/**
 * Sélecteur de classe ou de programme actuel : sous forme de menu select, un appui
 * ouvre l'écran permettant de changer de classe ou de programme.
 * Même gabarit et hauteur que les pastilles voisines (série, éclair, cloche).
 */
export function SelecteurClasse({ profil }: { profil: Profil | null }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const libelle = libelleProfil(profil);
  const concours = profil?.type === 'concours';

  return (
    <View style={styles.zoneSelecteur}>
      <Appui
        accessibilityRole="button"
        accessibilityLabel={t('classe.selecteurA11y', { classe: libelle })}
        onPress={() => router.push({ pathname: '/classe', params: { modifier: '1' } })}
        rayon={rayon.s}
        decalage={2}
        hitSlop={4}
      >
        <View style={[styles.selecteur, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          {concours ? (
            <Trophy size={14} strokeWidth={2.2} color={theme.texte.principal} />
          ) : (
            <GraduationCap size={14} strokeWidth={2.2} color={theme.texte.principal} />
          )}
          <Text numberOfLines={1} style={[styles.texteSelecteur, { color: theme.texte.principal }]}>
            {libelle}
          </Text>
          <ChevronDown size={14} strokeWidth={2.2} color={theme.texte.secondaire} />
        </View>
      </Appui>
    </View>
  );
}

/** C1 · Accueil (M4-01) : la mission du jour en 1 appui, la série, l'aide par photo. */
export function Accueil({ maintenant }: { maintenant?: Date }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const [etat, setEtat] = useState<Etat>({ mission: null, serie: 0, faite: null });
  const [profil, setProfil] = useState<Profil | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const pret = useSessionPrete();
  const invite = useInvite();
  const [rappelCompte, setRappelCompte] = useState(false);
  const [joues, setJoues] = useState<string[]>([]);
  const [feuilleSerie, setFeuilleSerie] = useState(false);
  const [serieEnDanger, setSerieEnDanger] = useState(false);
  // Prochaine échéance de la classe (issue #65) : null tant que la base n'a rien, ou pour un invité ou un concours.
  // Liée à la clé (classe, pays, session) qui l'a calculée : une valeur d'une autre classe ou session n'est jamais affichée.
  const [echeanceCalculee, setEcheanceCalculee] = useState<{ cle: string; echeance: EcheanceClasse | null } | null>(null);
  const cleEcheance = !pret || pret === 'hors-ligne' || invite || profil?.type !== 'eleve' || !profil.niveau || !profil.pays ? null : `${pret}|${profil.niveau}|${profil.pays}`;
  const echeance = cleEcheance && echeanceCalculee?.cle === cleEcheance ? echeanceCalculee.echeance : null;

  const user = session?.user;
  const idUtilisateur = user?.id;
  const { nom, photo } = identiteDe(user);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const p = await lireProfil();
      const effectif = (!p || !p.niveau) && user ? (profilDepuisCompte(user) ?? p) : p;
      if (actif && effectif) setProfil(effectif);
    })();
    return () => {
      actif = false;
    };
    // idUtilisateur suffit pour recharger le profil lors d'un changement de compte sans relancer l'effet a chaque re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idUtilisateur]);

  useEffect(() => {
    return ecouterGainXp((info) => {
      setTotalXp(info.total);
    });
  }, []);

  // Compte à rebours : seulement pour un élève connecté avec une classe et un pays. Une erreur ou une base vide cache la carte.
  useEffect(() => {
    if (!cleEcheance || !profil?.niveau || !profil.pays) return;
    let actif = true;
    const cle = cleEcheance;
    lireCalendrierClasse(getSupabase(), profil.niveau, profil.pays)
      .then((echeances) => actif && setEcheanceCalculee({ cle, echeance: prochaineEcheance(echeances, new Date()) }))
      .catch(() => actif && setEcheanceCalculee({ cle, echeance: null }));
    return () => {
      actif = false;
    };
  }, [cleEcheance, profil?.niveau, profil?.pays]);

  // Rappel à l'invité de lier un compte pour ne pas perdre sa progression, quelques jours après la première ouverture.
  useFocusEffect(
    useCallback(() => {
      if (!pret || pret === 'hors-ligne') return;
      let actif = true;
      void (async () => {
        const historique = await lireHistorique();
        if (!(await doitRappelerCompte({ invite, aProgression: historique.length > 0 }, maintenant)) || !actif) return;
        await noterRappelCompte(maintenant);
        suivre('account_prompt_shown', { raison: 'rappel' });
        setRappelCompte(true);
      })().catch(() => {});
      return () => {
        actif = false;
      };
    }, [pret, invite, maintenant]),
  );

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        const jour = jourLocal(maintenant);
        const [p, historique, dernier, taille, xp] = await Promise.all([
          lireProfil(),
          lireHistorique(),
          lireDernierResultat(),
          lireRythme(),
          lireUserXp(getSupabase(), idUtilisateur).catch(() => 0),
        ]);
        const { serie } = calculerSerie(historique, jour);
        const faite = dernier?.jour === jour ? dernier : null;
        if (actif) {
          setProfil(p);
          setTotalXp(xp);
          setJoues(historique);
          setEtat((e) => ({ ...e, serie, faite }));
        }
        // Série en danger à l'ouverture (mission du jour pas faite) : feuille ouverte toute seule, une fois par jour.
        if (actif && serie > 0 && !faite && (await lireAlerteSerie()) !== jour) {
          await noterAlerteSerie(jour);
          setSerieEnDanger(true);
          setFeuilleSerie(true);
        }
        if (!pret) return;
        // Tirée dès l'accueil : la mission est prête (et jouable hors ligne) avant le premier appui.
        const mission = await chargerMission(getSupabase(), {
          niveau: p?.niveau ?? '3e',
          pays: p?.pays ?? 'CM',
          vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') },
          jour,
          taille: taille ?? undefined,
          concours: p?.type === 'concours' ? p.concours?.id : null,
          ...(p?.type === 'eleve' && p.serie?.id ? { serie: p.serie.id } : {}),
        }).catch(() => null);
        // Un résultat d'une autre mission du jour (taille changée, nouvelle version) ne compte pas comme faite.
        const aJour = faite && mission && faite.total !== mission.questions.length ? null : faite;
        if (actif) setEtat((e) => ({ ...e, mission, faite: aJour }));
      })();
      return () => {
        actif = false;
      };
    }, [maintenant, t, pret, idUtilisateur]),
  );

  const matieres = [...new Set(etat.mission?.questions.map((q) => q.libelleMatiere).filter((m): m is string => !!m) ?? [])].slice(0, 3);
  const surVert = theme.texte.surCouleur;

  return (
    <View style={styles.racine}>
    <Ecran insetBas={false}>
      <Apparition>
        <View style={styles.entete}>
          <SelecteurClasse profil={profil} />
          {etat.serie > 0 ? (
            <Appui
              accessibilityRole="button"
              accessibilityLabel={t('mission.serieLibelle', { n: etat.serie })}
              onPress={() => {
                setSerieEnDanger(false);
                setFeuilleSerie(true);
              }}
              rayon={rayon.s}
              decalage={2}
              hitSlop={4}
            >
              <View style={[styles.serie, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
                <Ionicons name="flame" size={14} color={surVert} />
                <Text style={[typo.etiquette, { color: surVert }]}>{t('mission.serie', { n: etat.serie })}</Text>
              </View>
            </Appui>
          ) : null}
          <CompteurCredits />
          <Cloche />
          <Appui
            accessibilityRole="button"
            accessibilityLabel={t('onglets.moi')}
            onPress={() => router.push('/moi')}
            rayon={rayon.pilule}
            decalage={0}
            hitSlop={4}
          >
            <AvatarNiveau photo={photo} nom={nom} totalXp={totalXp} taille={38} />
          </Appui>
        </View>
      </Apparition>

      {/* En développement seulement : exemple visible tant que la base n'a pas de date pour cet élève. */}
      {echeance || __DEV__ ? (
        <Apparition delai={40}>
          <CompteARebours
            type={echeance?.type ?? 'examen'}
            cible={echeance?.dateCible ?? CIBLE_EXEMPLE}
            libelle={
              echeance
                ? `${echeance.libelle} · ${echeance.dateCible.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'EXEMPLE · BEPC'
            }
            estime={echeance ? echeance.statut === 'reprise' : true}
          />
        </Apparition>
      ) : null}

      <Apparition delai={50}>
        <Carte style={{ backgroundColor: theme.marque.principale }}>
          <View style={styles.groupe}>
            <View style={styles.entete}>
              <View style={[styles.pastille, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('mission.etiquette')}</Text>
              </View>
              <Text style={[typo.legende, styles.droite, { color: surVert }]}>{etat.mission ? t('mission.duree', { n: etat.mission.questions.length }) : ''}</Text>
            </View>
            {etat.faite ? (
              <>
                <Text style={[typo.h2, { color: surVert }]}>{t('mission.faite')}</Text>
                <Text style={[typo.petit, { color: surVert }]}>{t('mission.faiteTexte', { score: etat.faite.score, total: etat.faite.total })}</Text>
                <Bouton variante="secondaire" libelle={t('mission.refaire')} onPress={() => router.push('/mission')} />
              </>
            ) : (
              <>
                <Text numberOfLines={LIGNES_TITRE} ellipsizeMode="tail" style={[typo.h2, { color: surVert }]}>{titreMission(etat.mission) ?? t('mission.titreDefaut')}</Text>
                {matieres.length ? (
                  <View style={styles.tags}>
                    {matieres.map((m) => (
                      <View key={m} style={[styles.tag, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[typo.etiquette, { color: theme.texte.principal }]}>{m}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Bouton variante="secondaire" libelle={t('mission.commencer')} onPress={() => router.push('/mission')} retour />
              </>
            )}
          </View>
        </Carte>
      </Apparition>

      {/* Planning d'études (issue #65) : après la mission du jour, seulement quand l'élève a une date à venir. */}
      {echeance && idUtilisateur ? (
        <Apparition delai={60}>
          <CartePlanning idUtilisateur={idUtilisateur} />
        </Apparition>
      ) : null}

      <Apparition delai={80}>
        <AssistantConfiguration />
      </Apparition>

      <Reprise />

      <Apparition delai={120}>
        <Appui accessibilityRole="button" accessibilityLabel={`${t('mission.photoTitre')}. ${t('mission.photoTexte')}`} onPress={() => router.push('/photo')} rayon={rayon.l} ombre={4} decalage={3} couleurOmbre={theme.ombre}>
          <View style={[styles.photo, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={[styles.icone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
              <Ionicons name="camera-outline" size={20} color={theme.texte.principal} />
            </View>
            <View style={styles.flex}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('mission.photoTitre')}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('mission.photoTexte')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.texte.principal} style={styles.chevronPhoto} />
          </View>
        </Appui>
      </Apparition>
    </Ecran>
    <FeuilleSerie
      ouverte={feuilleSerie}
      onFermer={() => setFeuilleSerie(false)}
      serie={etat.serie}
      joues={joues}
      enDanger={serieEnDanger}
      onFaireMission={() => {
        setFeuilleSerie(false);
        router.push('/mission');
      }}
    />
    <FeuilleCompte raison={rappelCompte ? 'rappel' : null} onFermer={() => setRappelCompte(false)} onCompte={() => setRappelCompte(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  droite: { marginLeft: 'auto' },
  serie: { flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[3], paddingVertical: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
  groupe: { gap: espace[4] },
  pastille: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.s },
  // Étiquettes de matières : deux lignes au plus (hauteur fixe par étiquette, le reste est rogné) ; un nom trop long se raccourcit (…).
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3], maxHeight: HAUTEUR_ETIQUETTE * 2 + espace[3], overflow: 'hidden' },
  tag: { height: HAUTEUR_ETIQUETTE, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.s },
  photo: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  chevronPhoto: { alignSelf: 'center' },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  zoneSelecteur: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  selecteur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingHorizontal: espace[3],
    paddingVertical: espace[2],
    borderWidth: bord.normal,
    borderRadius: rayon.s,
  },
  texteSelecteur: {
    fontFamily: 'SpaceGrotesk-Bold',
    fontSize: 13,
    lineHeight: 16,
    maxWidth: 160,
  },
});
