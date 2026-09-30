import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { estInvite } from '@/services/compte';
import { annulerSuppression, dateEffacement, demanderSuppression, lireDemandeSuppression } from '@/services/moi';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

/** H6 · Supprimer mon compte (M2-08) : demande en deux appuis, effacement serveur sous 30 jours, annulable d'ici là. */
export function SuppressionCompte() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const connecte = !!session?.user && !estInvite(session.user);
  const [demande, setDemande] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ton: 'succes' | 'erreur'; cle: CleTexte } | null>(null);

  useEffect(() => {
    if (!connecte) return;
    let actif = true;
    lireDemandeSuppression(getSupabase())
      .then((d) => actif && setDemande(d))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [connecte]);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/moi'));
  const date = (d: Date) => d.toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const supprimer = async () => {
    if (!confirmation) {
      setConfirmation(true);
      return;
    }
    setEnCours(true);
    setMessage(null);
    try {
      setDemande(await demanderSuppression(getSupabase(), motif));
      setConfirmation(false);
    } catch {
      setMessage({ ton: 'erreur', cle: 'suppression.erreur' });
    } finally {
      setEnCours(false);
    }
  };

  const annuler = async () => {
    setEnCours(true);
    setMessage(null);
    try {
      await annulerSuppression(getSupabase());
      setDemande(null);
      setMessage({ ton: 'succes', cle: 'suppression.annulee' });
    } catch {
      setMessage({ ton: 'erreur', cle: 'suppression.erreur' });
    } finally {
      setEnCours(false);
    }
  };

  const pied = !connecte ? undefined : demande ? (
    <Bouton libelle={t('suppression.annuler')} desactive={enCours} onPress={() => void annuler()} />
  ) : (
    <Bouton variante="danger" libelle={enCours ? t('suppression.enCours') : t('suppression.confirmer')} desactive={enCours} onPress={() => void supprimer()} />
  );

  return (
    <Ecran
      pied={pied}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={fermer} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('suppression.titre')}</Text>
        </>
      }
    >
      {message ? <Banniere ton={message.ton} titre={t(message.cle)} /> : null}
      {!connecte ? <Banniere ton="info" titre={t('suppression.invite')} /> : null}
      {connecte && demande ? <Banniere ton="alerte" titre={t('suppression.demande')} texte={t('suppression.demandeTexte', { date: date(dateEffacement(demande)) })} /> : null}
      {connecte && !demande ? (
        <View style={styles.groupe}>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('suppression.texte')}</Text>
          <Champ libelle={t('suppression.motif')} value={motif} onChangeText={setMotif} maxLength={300} multiline />
          {confirmation ? <Banniere ton="erreur" titre={t('suppression.confirmerTitre')} texte={t('suppression.confirmerTexte')} /> : null}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
});
