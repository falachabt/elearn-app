import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { formaterMontant, lireAcces, lireOffres, PRIX_REPETITEUR, type Acces, type CodeOffre, type Offre } from '@/services/pass';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { BoutonFermer } from '../arrivee/MiniTest';

type Choix = CodeOffre | 'free';
type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; offres: Offre[]; acces: Acces; pays: string };

/** Ligne d'offre : pastille radio, nom, aide, prix. La couleur n'est pas le seul signal (coche dans la pastille). */
function LigneOffre({ titre, aide, prix, choisie, conseille, onPress }: { titre: string; aide: string; prix: string; choisie: boolean; conseille?: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui
      accessibilityRole="radio"
      accessibilityState={{ checked: choisie }}
      accessibilityLabel={`${titre}, ${prix}. ${aide}`}
      onPress={onPress}
      decalage={3}
      ombre={choisie ? ombre.m : ombre.s}
      couleurOmbre={theme.ombre}
      rayon={rayon.l}
      retour
    >
      <View style={[styles.ligne, { backgroundColor: choisie ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort, borderWidth: choisie ? bord.epais : bord.normal }]}>
        <View style={[styles.radio, { borderColor: theme.bord.fort, backgroundColor: choisie ? theme.marque.principale : 'transparent' }]}>
          {choisie ? <Ionicons name="checkmark" size={14} color={theme.texte.surCouleur} /> : null}
        </View>
        <View style={styles.texte}>
          <View style={styles.titre}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
            {conseille ? <Etiquette texte={conseille} jaune /> : null}
          </View>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{aide}</Text>
        </View>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{prix}</Text>
      </View>
    </Appui>
  );
}

async function chargerOffres(): Promise<Etat> {
  try {
    const pays = (await lireProfil())?.pays ?? 'CM';
    const client = getSupabase();
    const [offres, acces] = await Promise.all([lireOffres(client, pays), lireAcces(client).catch(() => null)]);
    return { statut: 'pret', offres, acces, pays };
  } catch {
    return { statut: 'erreur' };
  }
}

/** E1 · Offres (M8-01) : repère répétiteur, gratuit / semaine / mois / concours, payer ou envoyer à son parent. */
export function Offres() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { declencheur } = useLocalSearchParams<{ declencheur?: 'score' | 'moi' | 'limite' }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [choix, setChoix] = useState<Choix>('month');
  const [bientot, setBientot] = useState(false);

  const charger = useCallback(() => {
    void chargerOffres().then((e) => {
      setEtat(e);
      const conseillee = e.statut === 'pret' ? e.offres.find((o) => o.recommandee) : undefined;
      if (conseillee) setChoix(conseillee.code);
    });
  }, []);

  useEffect(() => {
    suivre('paywall_viewed', { declencheur: declencheur ?? 'moi' });
    charger();
  }, [charger, declencheur]);

  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const offres = etat.statut === 'pret' ? etat.offres : [];
  const choisie = offres.find((o) => o.code === choix);
  const devise = offres[0]?.devise ?? 'XAF';

  const choisir = (c: Choix) => {
    setChoix(c);
    setBientot(false);
    if (c !== 'free') suivre('offer_selected', { offre: c });
  };

  const pied =
    etat.statut === 'pret' && offres.length ? (
      <View style={styles.groupe}>
        {choisie ? (
          <Bouton libelle={t('offres.payer', { montant: formaterMontant(choisie.montant, choisie.devise) })} onPress={() => setBientot(true)} retour />
        ) : (
          <Bouton libelle={t('offres.continuerGratuit')} onPress={fermer} />
        )}
        {choisie ? (
          <Bouton variante="secondaire" libelle={t('offres.parent')} onPress={() => router.push({ pathname: '/offres/parent', params: { offre: choisie.code } })} />
        ) : null}
      </View>
    ) : undefined;

  const dateFin = (iso: string) => new Date(iso).toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Ecran pied={pied}>
      <View style={styles.entete}>
        <BoutonFermer libelle={t('offres.fermer')} onPress={fermer} />
        <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('offres.titre')}</Text>
      </View>

      {etat.statut === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('offres.erreur')} />
          <Bouton variante="secondaire" libelle={t('offres.reessayer')} onPress={() => {
              setEtat({ statut: 'chargement' });
              charger();
            }} />
        </View>
      ) : null}

      {etat.statut === 'pret' && etat.acces ? (
        <Banniere ton="succes" titre={t('offres.actif', { offre: t(`offres.${etat.acces.offre}`), date: dateFin(etat.acces.fin) })} />
      ) : null}

      {etat.statut === 'pret' && !offres.length ? <Banniere ton="info" titre={t('offres.indisponible')} /> : null}

      {etat.statut === 'pret' && offres.length ? (
        <>
          <View style={[styles.repere, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
            <Ionicons name="person-outline" size={18} color={theme.texte.principal} />
            <Text style={[typo.petit, styles.texte, { color: theme.texte.principal }]}>{t('offres.repere', { prix: formaterMontant(PRIX_REPETITEUR, devise) })}</Text>
          </View>
          <View accessibilityRole="radiogroup" style={styles.groupe}>
            <LigneOffre titre={t('offres.gratuit')} aide={t('offres.gratuitAide')} prix={formaterMontant(0, devise)} choisie={choix === 'free'} onPress={() => choisir('free')} />
            {offres.map((o) => (
              <LigneOffre
                key={o.code}
                titre={t(`offres.${o.code}`)}
                aide={t(`offres.${o.code}Aide`)}
                prix={formaterMontant(o.montant, o.devise)}
                choisie={choix === o.code}
                conseille={o.recommandee ? t('offres.conseille') : undefined}
                onPress={() => choisir(o.code)}
              />
            ))}
          </View>
          <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('offres.sansAbonnement')}</Text>
          {bientot ? <Banniere ton="info" titre={t('offres.bientot')} texte={t('offres.bientotTexte')} /> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  groupe: { gap: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderRadius: rayon.l },
  radio: { width: 22, height: 22, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
  titre: { flexDirection: 'row', alignItems: 'center', gap: espace[3], flexWrap: 'wrap' },
  repere: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  centre: { textAlign: 'center' },
});
