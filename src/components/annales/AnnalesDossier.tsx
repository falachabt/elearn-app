import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireDocuments, lireDossiers, type Document, type Dossier } from '@/services/annales';
import { useEtatMemorise } from '@/services/memoire';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { PuceCout } from '../credits/PuceCout';
import { useOuverts } from '../credits/useOuverts';
import { Ecran } from '../Ecran';
import { LigneLien } from '../LigneLien';
import { BoutonFermer } from '../arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; dossiers: Dossier[]; documents: Document[] };

/** Dossier d'annales de la classe : ses sous-dossiers, puis ses documents (PDF ouverts dans le navigateur). */
export function AnnalesDossier() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { solde } = useCredits();
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
          lireDossiers(client, {
            niveau: profil?.niveau ?? '3e',
            pays: profil?.pays ?? 'CM',
            parent: id,
            ...(profil?.type === 'eleve' && profil.serie?.id ? { serie: profil.serie.id } : {}),
          }),
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
  // Le PDF ne s'ouvre plus d'ici : la page de détails du document (temps de travail, sujet, corrigé, correction IA) s'en charge,
  // comme pour un concours. Les pastilles de coût restent sur la ligne.
  const refs = etat.statut === 'pret' ? etat.documents.flatMap((d) => [d.id, ...(d.correctionId ? [d.correctionId] : [])]).map(String) : [];
  const acces = useOuverts('document_pdf', refs);
  const detail = (d: Document) => router.push({ pathname: '/annales/sujet', params: { id: d.id, kind: 'document', nom: d.nom, ...(d.correctionId ? { corr: d.correctionId } : {}) } });
  const puce = (ref: string | number) => solde?.illimite ? null : <PuceCout cout={acces.cout} etat={acces.etat(String(ref))} />;

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
            <LigneLien key={d.id} icone="document-text-outline" titre={d.nom} detail={d.correctionId ? t('annales.sujetCorrige') : undefined} droite={puce(d.id)} onPress={() => detail(d)} />
          ))}
          {!etat.dossiers.length && !etat.documents.length ? <Banniere ton="info" titre={t('annales.dossierVide')} /> : null}
        </>
      ) : null}
    </Ecran>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
