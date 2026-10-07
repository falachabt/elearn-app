import { router } from 'expo-router';
import { Headset } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { estInvite } from '@/services/compte';
import { getSupabase } from '@/services/supabase';
import { lireDemandesSupport, marquerMontree, repondreDemandeSupport, type DemandeSupport, type ReponseDemande } from '@/services/support';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

type Etat = { phase: 'chargement' } | { phase: 'liste'; demandes: DemandeSupport[] } | { phase: 'reponse'; reponse: Exclude<ReponseDemande, 'erreur'> };

/**
 * Confirmer une demande du support WhatsApp (spec : docs/maquettes/support-confirmer.md). L'élève voit qu'une personne
 * demande à parler au support avec son compte, et accepte ou refuse. Le serveur ne partage rien du compte avant l'accord.
 */
export function EcranConfirmerSupport() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session, statut } = useSession();
  const user = session?.user;
  const connecte = !!user && !estInvite(user);
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });
  const [envoiEn, setEnvoiEn] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (statut !== 'pret') return;
    if (!connecte) {
      setEtat({ phase: 'liste', demandes: [] });
      return;
    }
    let actif = true;
    void lireDemandesSupport(getSupabase()).then((demandes) => {
      if (!actif) return;
      demandes.forEach((d) => marquerMontree(d.id));
      suivre('support_confirmation_vue', { demandes: demandes.length });
      setEtat({ phase: 'liste', demandes });
    });
    return () => {
      actif = false;
    };
  }, [statut, connecte]);

  const retour = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/moi')), []);

  const repondre = async (id: string, accepter: boolean) => {
    setErreur(false);
    setEnvoiEn(id);
    const r = await repondreDemandeSupport(getSupabase(), id, accepter);
    setEnvoiEn(null);
    suivre('support_confirmation_reponse', { reponse: r });
    if (r === 'erreur') setErreur(true);
    else setEtat({ phase: 'reponse', reponse: r === 'accepted' ? 'accepted' : r === 'refused' ? 'refused' : 'expiree' });
  };

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('support.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{t('support.titre')}</Text>
        </>
      }
    >
      {etat.phase === 'chargement' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={theme.texte.secondaire} />
        </View>
      ) : null}

      {etat.phase === 'liste' && !connecte ? (
        <>
          <Banniere ton="info" titre={t('support.invite')} texte={t('support.inviteSous')} />
          <Bouton libelle={t('profil.dejaCompte')} onPress={() => router.push('/compte/connexion')} />
        </>
      ) : null}

      {etat.phase === 'liste' && connecte && etat.demandes.length === 0 ? (
        <>
          <Banniere ton="info" titre={t('support.aucune')} texte={t('support.aucuneSous')} />
          <Bouton variante="secondaire" libelle={t('support.retour')} onPress={retour} />
        </>
      ) : null}

      {etat.phase === 'liste' && connecte
        ? etat.demandes.map((d) => (
            <View key={d.id} style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <View style={[styles.pastille, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
                <Headset size={18} strokeWidth={2} color={theme.texte.principal} />
              </View>
              <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('support.intro')}</Text>
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('support.demande', { fin: d.phone_hint })}</Text>
              <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('support.question')}</Text>
              <Bouton libelle={t('support.oui')} desactive={envoiEn !== null} onPress={() => void repondre(d.id, true)} />
              <Bouton variante="secondaire" libelle={t('support.non')} desactive={envoiEn !== null} onPress={() => void repondre(d.id, false)} />
            </View>
          ))
        : null}

      {etat.phase === 'liste' && connecte && erreur ? <Banniere ton="erreur" titre={t('support.erreur')} texte={t('support.erreurSous')} /> : null}

      {etat.phase === 'reponse' ? (
        <>
          <Banniere
            ton={etat.reponse === 'accepted' ? 'succes' : etat.reponse === 'refused' ? 'info' : 'alerte'}
            titre={t(etat.reponse === 'accepted' ? 'support.accepte' : etat.reponse === 'refused' ? 'support.refuse' : 'support.expiree')}
            texte={t(etat.reponse === 'accepted' ? 'support.accepteSous' : etat.reponse === 'refused' ? 'support.refuseSous' : 'support.expireeSous')}
          />
          <Bouton libelle={t('support.retour')} onPress={retour} />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', paddingVertical: espace[8] },
  carte: { gap: espace[3], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  pastille: { width: 34, height: 34, borderWidth: bord.normal, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
});
