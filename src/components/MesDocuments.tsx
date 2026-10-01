import { Trash2 } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireDocuments, PLAFOND_OCTETS, retirerTousDocuments, supprimerDocument, type DocumentGarde } from '@/services/documents';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';
import { Bouton } from './Bouton';
import { Ecran } from './Ecran';
import { Feuille } from './Feuille';
import { BoutonFermer } from './arrivee/MiniTest';
import { CarteListe } from './liste/CarteListe';
import { PastilleType } from './liste/PastilleType';

export const enMo = (octets: number) => Math.max(0.1, Math.round((octets / (1024 * 1024)) * 10) / 10);

/** « ouvert aujourd'hui », « ouvert hier », sinon la date. */
export function quandOuvert(le: string, maintenant = new Date()): 'aujourdhui' | 'hier' | null {
  const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecart = Math.round((jour(maintenant) - jour(new Date(le))) / 86_400_000);
  return ecart === 0 ? 'aujourdhui' : ecart === 1 ? 'hier' : null;
}

/** Mes documents (M6-08, revue design écran 10) : place utilisée, les PDF gardés (dernier ouvert en tête), tout supprimer. */
export function MesDocuments() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [documents, setDocuments] = useState<DocumentGarde[] | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void lireDocuments().then((d) => actif && setDocuments(d));
      return () => {
        actif = false;
      };
    }, []),
  );

  const total = (documents ?? []).reduce((n, d) => n + d.taille, 0);
  const details = (d: DocumentGarde) => {
    const mo = enMo(d.taille);
    const q = quandOuvert(d.le);
    if (q === 'aujourdhui') return t('document.ouvertAujourdhui', { mo });
    if (q === 'hier') return t('document.ouvertHier', { mo });
    return t('document.details', { mo, date: new Date(d.le).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' }) });
  };
  const retirer = async (url: string) => {
    await supprimerDocument(url);
    setDocuments(await lireDocuments());
  };
  const toutRetirer = async () => {
    setConfirmer(false);
    await retirerTousDocuments();
    setDocuments(await lireDocuments());
  };

  return (
    <>
      <Ecran
        pied={documents?.length ? <Bouton variante="secondaire" libelle={t('document.toutSupprimer')} onPress={() => setConfirmer(true)} /> : undefined}
        entete={
          <>
            <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
            <Text accessibilityRole="header" style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('document.mesDocuments')}</Text>
          </>
        }
      >
        {documents ? (
          <View accessibilityLabel={t('document.espace', { n: enMo(total), max: enMo(PLAFOND_OCTETS) })} style={[styles.place, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={styles.ligne}>
              <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('document.placeUtilisee')}</Text>
              <Text style={[typo.donnee, { color: theme.texte.principal }]}>{t('document.placeValeur', { n: enMo(total), max: enMo(PLAFOND_OCTETS) })}</Text>
            </View>
            <View style={[styles.barre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
              <View style={[styles.rempli, { width: `${Math.min(100, (total / PLAFOND_OCTETS) * 100)}%`, backgroundColor: theme.marque.principale }]} />
            </View>
          </View>
        ) : null}
        {documents && !documents.length ? <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>{t('document.aucunCourt')}</Text> : null}
        {documents?.map((d) => (
          <CarteListe
            key={d.url}
            gauche={<PastilleType type="annale" />}
            titre={d.titre}
            sousTitre={details(d)}
            droite={
              <Appui accessibilityRole="button" accessibilityLabel={t('document.retirer', { titre: d.titre })} onPress={() => void retirer(d.url)} rayon={rayon.s} decalage={0} hitSlop={8}>
                <View style={[styles.retirer, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
                  <Trash2 size={16} strokeWidth={2} color={theme.etat.erreurTexte} />
                </View>
              </Appui>
            }
            onPress={() => router.push({ pathname: '/document', params: { url: d.url, titre: d.titre } })}
          />
        ))}
      </Ecran>
      <Feuille
        ouverte={confirmer}
        onFermer={() => setConfirmer(false)}
        titre={t('document.confirmerTitre')}
        texte={t('document.confirmerTexte')}
        actions={[
          { libelle: t('document.confirmer'), onPress: () => void toutRetirer() },
          { libelle: t('document.garder'), onPress: () => setConfirmer(false), variante: 'secondaire' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  place: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  barre: { height: 10, borderWidth: bord.fin, borderRadius: rayon.pilule, overflow: 'hidden' },
  rempli: { height: '100%' },
  centre: { textAlign: 'center', paddingVertical: espace[6] },
  retirer: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
});
