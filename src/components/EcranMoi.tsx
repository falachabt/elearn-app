import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { CircleHelp, FileText, RefreshCw, Settings, Shield, Target } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { identiteDe } from '@/services/identite';
import { lireDocuments } from '@/services/documents';
import { calculerProgression, lirePassages } from '@/services/progression';
import { lireContactParent, lireDemandeSuppression } from '@/services/moi';
import { lireAcces, type Acces } from '@/services/pass';
import { lireProfil, type Profil } from '@/services/profil';
import { joursAvant } from '@/services/quand';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';
import { Banniere } from './Banniere';
import { Bouton } from './Bouton';
import { Ecran } from './Ecran';
import { CarteCredits } from './moi/CarteCredits';
import { enMo } from './MesDocuments';
import { Groupe, LigneGroupe } from './parametres/Groupe';

type Resume = { minutes: number | null; documents: { n: number; octets: number } | null };

/**
 * H1 · Moi (M2-15, guide §23) : en-tête (avatar, nom, classe et pays, roue des réglages), puis selon l'état la carte
 * jaune du pass, la carte « Mes crédits » ou la carte d'invitation à créer un compte, et deux cartes de lignes.
 * Chaque ligne ouvre son écran ; celles dont l'écran n'existe pas encore ne sont pas affichées.
 */
export function EcranMoi() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { session, statut } = useSession();
  const { solde } = useCredits();
  const [acces, setAcces] = useState<Acces>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [resume, setResume] = useState<Resume>({ minutes: null, documents: null });
  const [parent, setParent] = useState<string | null>(null);

  const user = session?.user;
  const invite = estInvite(user);
  const connecte = !!user && !invite;
  const idUtilisateur = user?.id;
  const { nom, photo } = identiteDe(user);
  const initiale = (nom ?? '').charAt(0).toUpperCase();

  // Relu à chaque retour sur l'onglet : classe changée, mission faite, document gardé, contact ajouté.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        const client = getSupabase();
        const [p, docs, passages] = await Promise.all([
          lireProfil(),
          lireDocuments().catch(() => []),
          lirePassages(client).catch(() => null),
        ]);
        if (!actif) return;
        setProfil(p);
        setResume({
          minutes: passages ? calculerProgression(passages).minutesSemaine : null,
          documents: { n: docs.length, octets: docs.reduce((s, d) => s + d.taille, 0) },
        });
        if (!connecte) return;
        const [c] = await Promise.all([lireContactParent(client).catch(() => null), lireDemandeSuppression(client).catch(() => null)]);
        if (actif) setParent(c?.telephone ? c.nom : null);
      })();
      return () => {
        actif = false;
      };
    }, [connecte]),
  );

  useEffect(() => {
    if (!idUtilisateur) return;
    let actif = true;
    lireAcces(getSupabase())
      .then((a) => actif && setAcces(a))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [idUtilisateur]);

  const classePays = profil?.niveau
    ? t('profil.classeSous', {
        classe: profil.type === 'concours' ? t(`classe.concoursListe.${profil.niveau as 'ens'}`) : profil.niveau,
        pays: profil.pays ? t(`pays.${profil.pays as 'CM'}`) : '',
      })
    : null;

  const finPass = solde?.illimiteJusqua ?? (acces?.fin ?? null);
  const avecPass = !!solde?.illimite || (!!acces && new Date(acces.fin) > new Date());
  const jours = finPass ? joursAvant(finPass) : null;
  const date = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });

  return (
    <Ecran insetBas={false}>
      <View style={styles.entete}>
        <Text accessibilityRole="header" style={[typo.h1, styles.flex, { color: theme.texte.principal }]}>{t('moi.titre')}</Text>
        <Appui accessibilityRole="button" accessibilityLabel={t('profil.reglagesLibelle')} onPress={() => router.push('/parametres')} decalage={0} rayon={rayon.m} hitSlop={4}>
          <View style={[styles.roue, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
            <Settings size={20} strokeWidth={2} color={theme.texte.principal} />
          </View>
        </Appui>
      </View>

      <View style={styles.identite}>
        <View style={[styles.avatar, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" accessibilityLabel={nom ?? undefined} accessibilityIgnoresInvertColors />
          ) : (
            <Text style={[typo.h3, { color: theme.texte.surCouleur }]}>{initiale || '?'}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={[typo.h2, { color: theme.texte.principal }]}>{nom ?? t('profil.invite')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{invite ? t('profil.inviteSous') : classePays ?? ''}</Text>
        </View>
      </View>

      {statut === 'erreur' ? <Banniere ton="erreur" titre={t('erreur.banniere')} texte={t('moi.sessionErreur')} /> : null}

      {invite ? (
        <View style={[styles.carteJaune, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
          <Text style={[typo.h3, { color: theme.texte.surCouleur }]}>{t('profil.inviteCarteTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>
            {solde ? t('profil.inviteCarteTexte', { n: solde.total }) : t('profil.inviteCarteSans')}
          </Text>
          <Bouton libelle={t('profil.creerCompte')} onPress={() => router.push('/compte/creer')} variante="secondaire" />
          <Bouton petit variante="texte" libelle={t('profil.dejaCompte')} onPress={() => router.push('/compte/connexion')} />
        </View>
      ) : avecPass ? (
        <Appui
          accessibilityRole="button"
          accessibilityLabel={`${acces ? t('profil.passActif', { offre: t(`offres.${acces.offre}`) }) : t('profil.passActifSimple')}`}
          onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'moi' } })}
          rayon={rayon.l}
          ombre={ombre.m}
          decalage={2}
          couleurOmbre={theme.ombre}
        >
          <View style={[styles.carteJaune, styles.ligne, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
            <View style={styles.flex}>
              <Text style={[typo.h3, { color: theme.texte.surCouleur }]}>{acces ? t('profil.passActif', { offre: t(`offres.${acces.offre}`) }) : t('profil.passActifSimple')}</Text>
              {finPass ? <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{t('profil.passDetail', { date: date(finPass) })}</Text> : null}
            </View>
            {jours !== null ? (
              <View style={[styles.jours, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.donnee, { color: theme.texte.principal }]}>{jours <= 3 ? (jours === 0 ? t('profil.passDernierJour') : t('profil.passBientot', { n: jours })) : t('profil.passJours', { n: jours })}</Text>
              </View>
            ) : null}
          </View>
        </Appui>
      ) : (
        <CarteCredits />
      )}

      <Groupe>
        <LigneGroupe
          icone={Target}
          titre={t('profil.progression')}
          sousTitre={resume.minutes !== null ? t('profil.progSous', { n: resume.minutes }) : undefined}
          onPress={() => router.push('/progression')}
        />
        <LigneGroupe
          icone={FileText}
          titre={t('profil.documents')}
          sousTitre={resume.documents ? (resume.documents.n ? t('profil.docsSous', { n: resume.documents.n, mo: enMo(resume.documents.octets) }) : t('profil.docsAucun')) : undefined}
          onPress={() => router.push('/documents')}
        />
      </Groupe>

      <Groupe>
        <LigneGroupe icone={RefreshCw} titre={t('profil.classe')} sousTitre={classePays ?? undefined} onPress={() => router.push({ pathname: '/classe', params: { modifier: '1' } })} />
        {connecte ? (
          <LigneGroupe icone={Shield} titre={t('moi.parent')} sousTitre={parent ? t('profil.parentSous', { nom: parent }) : t('profil.parentAucun')} onPress={() => router.push('/profil/parent')} />
        ) : null}
        <LigneGroupe icone={CircleHelp} titre={t('profil.aide')} onPress={() => router.push('/aide')} />
      </Groupe>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  roue: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  identite: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  avatar: { width: 56, height: 56, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  carteJaune: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  ligne: { flexDirection: 'row', alignItems: 'center' },
  jours: { borderWidth: bord.normal, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
});
