import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { languesDisponibles, type Langue } from '@/i18n';
import { cleErreur, deconnecter, estInvite } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from './Banniere';
import { Bouton } from './Bouton';
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

  const user = session?.user;
  const invite = estInvite(user);
  const connecte = !!user && !invite;

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

      <Bouton variante="secondaire" libelle={t('moi.parametres')} onPress={() => router.push('/parametres')} />

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
  ligne: { flexDirection: 'row', gap: espace[4] },
  moitie: { flex: 1 },
});
