import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { languesDisponibles, type Langue } from '@/i18n';
import { cleErreur, deconnecter, estInvite } from '@/services/compte';
import { calculerSerie, lireHistorique } from '@/services/mission';
import { lireContactParent, lireDemandeSuppression } from '@/services/moi';
import { lireAcces, type Acces } from '@/services/pass';
import { lireProfil, type Profil } from '@/services/profil';
import { lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from './Banniere';
import { Bouton } from './Bouton';
import { LigneLien as Ligne } from './LigneLien';
import { Carte } from './Carte';
import { Ecran } from './Ecran';
import { Etiquette } from './Etiquette';

const NOM_LANGUE: Record<Langue, 'moi.francais' | 'moi.anglais'> = { fr: 'moi.francais', en: 'moi.anglais' };

/** Onglet Moi : état du compte (invité ou compte sauvegardé), langue fr/en mémorisée, réglages, déconnexion. */
export function EcranMoi() {
  const { t, langue, changerLangue } = useTraduction();
  const { theme } = useTheme();
  const { session, statut } = useSession();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [acces, setAcces] = useState<Acces>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [stats, setStats] = useState({ serie: 0, missions: 0, lecons: 0 });
  const [parent, setParent] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);

  const user = session?.user;
  const invite = estInvite(user);
  const connecte = !!user && !invite;
  const idUtilisateur = user?.id;
  const nom = (user?.user_metadata?.full_name as string | undefined)?.trim() || (user?.user_metadata?.name as string | undefined)?.trim() || null;
  const prenom = nom?.split(/\s+/)[0] ?? null;

  // Relu à chaque retour sur l'onglet : classe changée, mission faite, leçon lue, contact ajouté.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        const [p, jours, lues] = await Promise.all([lireProfil(), lireHistorique(), lireLues()]);
        if (!actif) return;
        setProfil(p);
        setStats({ serie: calculerSerie(jours).serie, missions: jours.length, lecons: Object.keys(lues).length });
        if (!connecte) return;
        const client = getSupabase();
        const [c, d] = await Promise.all([lireContactParent(client).catch(() => null), lireDemandeSuppression(client).catch(() => null)]);
        if (!actif) return;
        setParent(c?.telephone ? c.nom : null);
        setSuppression(!!d);
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

  const sortir = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await deconnecter(getSupabase());
    } catch (e) {
      setErreur(t(cleErreur(e) === 'compte.erreurs.reseau' ? 'compte.erreurs.reseau' : 'moi.deconnexionErreur'));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Ecran insetBas={false}>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('moi.titre')}</Text>

      <Carte>
        <View style={styles.groupe}>
          <View style={styles.identite}>
            <View style={[styles.avatar, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
              {prenom ? (
                <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{prenom.charAt(0).toUpperCase()}</Text>
              ) : (
                <Ionicons name="person" size={28} color={theme.texte.surCouleur} />
              )}
            </View>
            <View style={styles.flex}>
              <Text style={[typo.h3, { color: theme.texte.principal }]}>{prenom ? t('moi.bonjour', { nom: prenom }) : t('moi.bonjourSansNom')}</Text>
              {profil?.niveau ? (
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
                  {t('moi.classePays', {
                    classe: profil.type === 'concours' ? t(`classe.concoursListe.${profil.niveau as 'ens'}`) : profil.niveau,
                    pays: profil.pays ? t(`pays.${profil.pays as 'CM'}`) : '',
                  })}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.ligne}>
            {([
              ['serie', stats.serie],
              ['missions', stats.missions],
              ['lecons', stats.lecons],
            ] as const).map(([cle, valeur]) => (
              <View key={cle} style={[styles.chiffre, { borderColor: theme.bord.fort, backgroundColor: cle === 'serie' ? theme.accent.soleil : theme.fond.creux }]}>
                <Text style={[typo.chiffreL, { color: cle === 'serie' ? theme.texte.surCouleur : theme.texte.principal }]}>{String(valeur)}</Text>
                <Text style={[typo.legende, { color: cle === 'serie' ? theme.texte.surCouleur : theme.texte.secondaire }]}>{t(`moi.${cle}`)}</Text>
              </View>
            ))}
          </View>
          <Bouton petit variante="secondaire" libelle={t('moi.changerClasse')} onPress={() => router.push({ pathname: '/classe', params: { modifier: '1' } })} />
        </View>
      </Carte>

      {statut === 'erreur' ? <Banniere ton="erreur" titre={t('erreur.banniere')} texte={t('moi.sessionErreur')} /> : null}

      {statut === 'pret' ? (
        <Carte>
          <View style={styles.groupe}>
            <Etiquette texte={t(connecte ? 'moi.statutConnecte' : 'moi.statutInvite')} jaune={!connecte} />
            <Text style={[typo.texte, { color: theme.texte.principal }]}>
              {connecte ? (user?.email ? t('moi.connecteTexte', { email: user.email }) : t('moi.connecteSocial')) : t('moi.inviteTexte')}
            </Text>
          </View>
        </Carte>
      ) : null}

      {statut === 'pret' && invite ? (
        <View style={styles.groupe}>
          <Bouton libelle={t('compte.pasDeCompte')} onPress={() => router.push('/compte/creer')} retour />
          <Bouton variante="secondaire" libelle={t('compte.dejaUnCompte')} onPress={() => router.push('/compte/connexion')} />
        </View>
      ) : null}

      <View style={styles.groupe}>
        <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('moi.langue')}</Text>
        <View style={styles.ligne}>
          {languesDisponibles.map((l) => (
            <View key={l} style={styles.moitie}>
              <Bouton
                petit
                variante={langue === l ? 'primaire' : 'secondaire'}
                libelle={t(NOM_LANGUE[l])}
                onPress={() => void changerLangue(l)}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.groupe}>
        <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('moi.pass')}</Text>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
          {acces
            ? t('moi.passActif', { offre: t(`offres.${acces.offre}`), date: new Date(acces.fin).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }) })
            : t('moi.passGratuit')}
        </Text>
        <Bouton variante="secondaire" libelle={t('moi.voirPass')} onPress={() => router.push({ pathname: '/offres', params: { declencheur: 'moi' } })} />
      </View>

      <Bouton variante="secondaire" libelle={t('moi.parametres')} onPress={() => router.push('/parametres')} />

      {connecte ? (
        <View style={styles.groupe}>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('moi.monCompte')}</Text>
          <Ligne icone="people-outline" titre={t('moi.parent')} detail={parent ? t('moi.parentAjoute', { nom: parent }) : t('moi.parentAucun')} onPress={() => router.push('/profil/parent')} />
          <Ligne icone="trash-outline" titre={t('moi.supprimer')} detail={suppression ? t('moi.supprimerDemande') : undefined} onPress={() => router.push('/profil/supprimer')} />
        </View>
      ) : null}

      {connecte ? (
        <View style={styles.groupe}>
          {erreur ? <Banniere ton="erreur" titre={t('compte.erreurTitre')} texte={erreur} /> : null}
          <Bouton variante="danger" libelle={enCours ? t('compte.enCours') : t('moi.deconnexion')} desactive={enCours} onPress={sortir} />
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  flex: { flex: 1 },
  identite: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  avatar: { width: 56, height: 56, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  chiffre: { flex: 1, gap: espace[1], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  ligne: { flexDirection: 'row', gap: espace[4] },
  moitie: { flex: 1 },
});
