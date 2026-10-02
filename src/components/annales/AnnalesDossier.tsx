import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireDocuments, lireDossiers, type Document, type Dossier } from '@/services/annales';
import { useEtatMemorise } from '@/services/memoire';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { PuceCout } from '../credits/PuceCout';
import { useDepenseCredits } from '../credits/useDepenseCredits';
import { useOuverts } from '../credits/useOuverts';
import { Feuille } from '../Feuille';
import { Ecran } from '../Ecran';
import { LigneLien } from '../LigneLien';
import { BoutonFermer } from '../arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; dossiers: Dossier[]; documents: Document[] };

/** Dossier d'annales de la classe : ses sous-dossiers, puis ses documents (PDF ouverts dans le navigateur). */
export function AnnalesDossier() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, nom } = useLocalSearchParams<{ id: string; nom?: string }>();
  const pret = useSessionPrete();
  const [etat, setEtat] = useEtatMemorise<Etat>(`annales.dossier.${id}`, { statut: 'chargement' });

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void (async () => {
      try {
        const client = getSupabase();
        const profil = await lireProfil();
        const [dossiers, documents] = await Promise.all([
          lireDossiers(client, { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM', parent: id }),
          lireDocuments(client, id),
        ]);
        if (actif) setEtat({ statut: 'pret', dossiers, documents });
      } catch {
        if (actif) setEtat({ statut: 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [id, pret, setEtat]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  // L'adresse du PDF ne vient que de depenser_credits (M18-04). Un PDF déjà ouvert ne redemande rien, quelques documents
  // sont gratuits ; les autres coûtent des crédits. Plus de crédits : une feuille du bas (« Recharger »), pas un message
  // perdu en haut de la liste.
  const { lancer, feuilles } = useDepenseCredits({ rechargeSimple: true });
  const [reseau, setReseau] = useState(false);
  const refs = etat.statut === 'pret' ? etat.documents.flatMap((d) => [d.id, ...(d.correctionId ? [d.correctionId] : [])]).map(String) : [];
  const acces = useOuverts('document_pdf', refs);
  const ouvrir = async (d: Document, correction = false) => {
    const ref = correction && d.correctionId ? d.correctionId : d.id;
    let r;
    try {
      r = await lancer<{ url?: string | null }>('document_pdf', ref, { deja: acces.sansFrais(String(ref)) });
    } catch {
      setReseau(true);
      return;
    }
    const url = r?.contenu?.url;
    if (!url) return;
    void acces.relire();
    suivre('class_document_opened', { correction });
    router.push({ pathname: '/document', params: { url, titre: correction ? `${d.nom} · ${t('annales.correctionTitre')}` : d.nom } });
  };
  const puce = (ref: string | number) => <PuceCout cout={acces.cout} etat={acces.etat(String(ref))} />;

  return (
    <>
    <Ecran
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{nom}</Text>
        </>
      }
    >
      {etat.statut === 'chargement' ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('annales.chargement')}</Text> : null}
      {etat.statut === 'erreur' ? <Banniere ton="erreur" titre={t('annales.erreur')} /> : null}
      {etat.statut === 'pret' ? (
        <>
          {etat.dossiers.map((d) => (
            <LigneLien
              key={d.id}
              icone="folder-outline"
              titre={d.nom}
              detail={t(d.documents > 1 ? 'annales.documents' : 'annales.document', { n: d.documents })}
              onPress={() => router.push({ pathname: '/annales/dossier', params: { id: d.id, nom: d.nom } })}
            />
          ))}
          {etat.documents.map((d) => (
            <View key={d.id} style={styles.document}>
              <LigneLien icone="document-text-outline" titre={d.nom} detail={d.correctionId ? t('annales.sujetCorrige') : undefined} droite={puce(d.id)} onPress={() => void ouvrir(d)} />
              {d.correctionId ? <LigneLien icone="checkmark-done-outline" titre={t('annales.ouvrirCorrection')} droite={puce(d.correctionId)} onPress={() => void ouvrir(d, true)} /> : null}
            </View>
          ))}
          {!etat.dossiers.length && !etat.documents.length ? <Banniere ton="info" titre={t('annales.dossierVide')} /> : null}
        </>
      ) : null}
    </Ecran>
    {feuilles}
    <Feuille
      ouverte={reseau}
      onFermer={() => setReseau(false)}
      icone="cloud-offline-outline"
      titre={t('payant.erreur')}
      actions={[{ libelle: t('credits.fermer'), onPress: () => setReseau(false) }]}
    />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  document: { gap: espace[2] },
});
