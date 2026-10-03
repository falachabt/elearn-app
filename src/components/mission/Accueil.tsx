import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerSerie, chargerMission, jourLocal, lireDernierResultat, lireHistorique, type Mission, type ResultatMission } from '@/services/mission';
import { lireRythme } from '@/services/rythme';
import { lireProfil } from '@/services/profil';
import { suivre } from '@/services/analytics';
import { doitRappelerCompte, noterRappelCompte } from '@/services/rappels';
import { getSupabase } from '@/services/supabase';
import { identiteDe } from '@/services/identite';
import {
  aVuInvitationHorsLigne,
  ecouterHorsLigne,
  lireEtatHorsLigne,
  modeHorsLigneActif,
  noterInvitationHorsLigneVue,
  type EtatHorsLigne,
} from '@/services/horsLigne';
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
import { Reprise } from './Reprise';

type Etat = { mission: Mission | null; serie: number; faite: ResultatMission | null };

/** Titre de la carte : trois lignes au plus (une leçon au titre très long ne pousse plus le reste de l'écran vers le bas). */
const LIGNES_TITRE = 3;
const HAUTEUR_ETIQUETTE = 32;

/** Titre de la carte : les deux premiers chapitres de la mission. */
export function titreMission(m: Mission | null): string | null {
  const chapitres = [...new Set(m?.questions.map((q) => q.chapitre).filter(Boolean) ?? [])];
  return chapitres.length ? chapitres.slice(0, 2).join(', ') : null;
}

/** « Bonjour Aïcha » : le prénom vient du compte (Google, etc.) ; sans prénom, « Bonjour » seul. */
function Salutation({ heure }: { heure: number }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const prenom = identiteDe(session?.user).prenom;
  return (
    <Text accessibilityRole="header" numberOfLines={1} style={[typo.h1, styles.flex, { color: theme.texte.principal }]}>
      {prenom ? t(heure >= 17 ? 'mission.bonsoirNom' : 'mission.bonjourNom', { prenom }) : t(heure >= 17 ? 'mission.bonsoir' : 'mission.bonjour')}
    </Text>
  );
}

/** C1 · Accueil (M4-01) : la mission du jour en 1 appui, la série, l'aide par photo. */
export function Accueil({ maintenant }: { maintenant?: Date }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<Etat>({ mission: null, serie: 0, faite: null });
  const pret = useSessionPrete();
  const invite = useInvite();
  const [rappelCompte, setRappelCompte] = useState(false);
  const [horsLigne, setHorsLigne] = useState<EtatHorsLigne | null>(null);
  const propositionLancee = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!pret || pret === 'hors-ligne') return;
      let actif = true;
      void (async () => {
        const [vue, actifHorsLigne, etatHorsLigne] = await Promise.all([
          aVuInvitationHorsLigne(),
          modeHorsLigneActif(),
          lireEtatHorsLigne(),
        ]);
        if (!actif) return;
        setHorsLigne(etatHorsLigne);
        if (!vue && !actifHorsLigne && !propositionLancee.current) {
          propositionLancee.current = true;
          await noterInvitationHorsLigneVue();
          router.push({ pathname: '/hors-ligne', params: { source: 'accueil' } });
        }
      })();
      const arreter = ecouterHorsLigne((e) => actif && setHorsLigne(e));
      return () => {
        actif = false;
        arreter();
      };
    }, [pret]),
  );

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
        const [profil, historique, dernier, taille] = await Promise.all([lireProfil(), lireHistorique(), lireDernierResultat(), lireRythme()]);
        const { serie } = calculerSerie(historique, jour);
        const faite = dernier?.jour === jour ? dernier : null;
        if (actif) setEtat((e) => ({ ...e, serie, faite }));
        if (!pret) return;
        // Tirée dès l'accueil : la mission est prête (et jouable hors ligne) avant le premier appui.
        const mission = await chargerMission(getSupabase(), {
          niveau: profil?.niveau ?? '3e',
          pays: profil?.pays ?? 'CM',
          vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') },
          jour,
          taille: taille ?? undefined,
          concours: profil?.type === 'concours' ? profil.concours?.id : null,
        }).catch(() => null);
        // Un résultat d'une autre mission du jour (taille changée, nouvelle version) ne compte pas comme faite.
        const aJour = faite && mission && faite.total !== mission.questions.length ? null : faite;
        if (actif) setEtat((e) => ({ ...e, mission, faite: aJour }));
      })();
      return () => {
        actif = false;
      };
    }, [maintenant, t, pret]),
  );

  const heure = (maintenant ?? new Date()).getHours();
  const matieres = [...new Set(etat.mission?.questions.map((q) => q.libelleMatiere).filter((m): m is string => !!m) ?? [])].slice(0, 3);
  const surVert = theme.texte.surCouleur;

  return (
    <>
    <Ecran insetBas={false}>
      <Apparition>
        <View style={styles.entete}>
          <Salutation heure={heure} />
          {etat.serie > 0 ? (
            <View accessible accessibilityLabel={t('mission.serieLibelle', { n: etat.serie })} style={[styles.serie, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Ionicons name="flame" size={14} color={surVert} />
              <Text style={[typo.etiquette, { color: surVert }]}>{t('mission.serie', { n: etat.serie })}</Text>
            </View>
          ) : null}
          <CompteurCredits />
        </View>
      </Apparition>

      <Apparition delai={60}>
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

      {horsLigne ? (
        <Apparition delai={90}>
          <CarteHorsLigne etat={horsLigne} />
        </Apparition>
      ) : null}

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
            <Ionicons name="chevron-forward" size={18} color={theme.texte.principal} />
          </View>
        </Appui>
      </Apparition>
    </Ecran>
    <FeuilleCompte raison={rappelCompte ? 'rappel' : null} onFermer={() => setRappelCompte(false)} onCompte={() => setRappelCompte(false)} />
    </>
  );
}

function CarteHorsLigne({ etat }: { etat: EtatHorsLigne }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const etapes = Object.values(etat.progression);
  const total = etapes.reduce((n, e) => n + e.total, 0);
  const fait = etapes.reduce((n, e) => n + e.faites + e.echecs, 0);
  const pourcentage = total ? Math.floor(fait * 100 / total) : 100;
  return (
    <Appui accessibilityRole="button" accessibilityLabel={t('horsLigne.titre')} onPress={() => router.push('/hors-ligne')} rayon={rayon.l} ombre={4} decalage={3} couleurOmbre={theme.ombre}>
      <View style={[styles.horsLigne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.horsLigneIcone, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]}>
          <Ionicons name={etat.statut === 'termine' ? 'checkmark' : 'cloud-download-outline'} size={20} color={theme.marque.forte} />
        </View>
        <View style={styles.flex}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t(etat.statut === 'termine' ? 'horsLigne.termineTitre' : 'horsLigne.carteTitre')}</Text>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{`${pourcentage}% · ${t('horsLigne.carteDetail')}`}</Text>
          <View style={[styles.horsLigneRail, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
            <View style={[styles.horsLigneRemplissage, { width: `${pourcentage}%`, backgroundColor: theme.marque.principale }]} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.texte.principal} />
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  droite: { marginLeft: 'auto' },
  serie: { flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[3], paddingVertical: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
  groupe: { gap: espace[4] },
  pastille: { paddingHorizontal: espace[3], paddingVertical: espace[1], borderWidth: bord.normal, borderRadius: rayon.s },
  // Étiquettes de matières : deux lignes au plus (hauteur fixe par étiquette, le reste est rogné) ; un nom trop long se raccourcit (…).
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3], maxHeight: HAUTEUR_ETIQUETTE * 2 + espace[3], overflow: 'hidden' },
  tag: { height: HAUTEUR_ETIQUETTE, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.s },
  photo: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  horsLigne: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  horsLigneIcone: { width: 40, height: 40, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  horsLigneRail: { height: 10, borderWidth: bord.fin, borderRadius: rayon.pilule, overflow: 'hidden', marginTop: espace[2] },
  horsLigneRemplissage: { height: '100%', borderRadius: rayon.pilule },
});
