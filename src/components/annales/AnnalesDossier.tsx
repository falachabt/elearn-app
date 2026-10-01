import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireDocuments, lireDossiers, type Document, type Dossier } from '@/services/annales';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
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
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

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
  }, [id, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const ouvrir = (d: Document, correction = false) => {
    const url = correction ? d.urlCorrection : d.url;
    if (!url) return;
    suivre('class_document_opened', { correction });
    router.push({ pathname: '/document', params: { url, titre: correction ? `${d.nom} · ${t('annales.correctionTitre')}` : d.nom } });
  };

  return (
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
              <LigneLien icone="document-text-outline" titre={d.nom} detail={d.urlCorrection ? t('annales.sujetCorrige') : undefined} onPress={() => ouvrir(d)} />
              {d.urlCorrection ? <LigneLien icone="checkmark-done-outline" titre={t('annales.ouvrirCorrection')} onPress={() => ouvrir(d, true)} /> : null}
            </View>
          ))}
          {!etat.dossiers.length && !etat.documents.length ? <Banniere ton="info" titre={t('annales.dossierVide')} /> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  document: { gap: espace[2] },
});
