import { router } from 'expo-router';
import { NotebookPen, Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { EtatMot } from '@/services/certification/certCarnet';
import { chercherMots, compteursCarnet, motsParEtat } from '@/services/certification/revision';
import type { MotCarnetServi } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Onglets } from '../Onglets';
import { LigneChoix } from './ui';

const ETATS: readonly EtatMot[] = ['a_revoir', 'en_cours', 'connu'];

/** Pastille d'état d'un mot : texte seul, jamais la couleur seule (R-03). */
function PastilleBoite({ etat, libelle }: { etat: EtatMot; libelle: string }) {
  const { theme } = useTheme();
  const fond = etat === 'a_revoir' ? theme.etat.erreurDoux : etat === 'connu' ? theme.etat.succesDoux : theme.etat.alerteDoux;
  return (
    <View style={[styles.pastille, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
      <Text style={[typo.legende, { color: theme.texte.principal }]}>{libelle}</Text>
    </View>
  );
}

/** C6 · Carnet de mots : recherche en direct, trois listes (À revoir, En cours, Connus), états vide S5 et sans résultat S6. */
export function CarnetMots({ mots }: { mots: MotCarnetServi[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [requete, setRequete] = useState('');
  const [etat, setEtat] = useState<EtatMot>('a_revoir');
  const [bientot, setBientot] = useState(false);
  const compteurs = compteursCarnet(mots);
  const recherche = requete.trim().length > 0;
  // La recherche porte sur tout le carnet, quel que soit l'onglet (cahier C6).
  const trouves = recherche ? chercherMots(mots, requete) : motsParEtat(mots, etat);
  const ajouter = () => setBientot(true);

  if (mots.length === 0) {
    return (
      <View style={styles.colonne}>
        <Onglets valeurs={ETATS.map((e) => ({ valeur: e, libelle: t(`certification.carnet.onglets.${e}`, { n: 0 }) }))} valeur={etat} onChange={setEtat} />
        <Carte>
          <View style={styles.centre}>
            <NotebookPen size={28} color={theme.texte.principal} strokeWidth={2} />
            <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.carnet.videTitre')}</Text>
            <Text style={[typo.petit, { color: theme.texte.principal, textAlign: 'center' }]}>{t('certification.carnet.videTexte')}</Text>
          </View>
        </Carte>
        <Bouton libelle={t('certification.carnet.ajouter')} onPress={ajouter} />
        {bientot ? <Banniere ton="info" titre={t('certification.carnet.ajoutBientot')} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.colonne}>
      <View style={[styles.recherche, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Search size={18} color={theme.texte.secondaire} strokeWidth={2} />
        <TextInput
          value={requete}
          onChangeText={setRequete}
          placeholder={t('certification.carnet.rechercher')}
          placeholderTextColor={theme.texte.secondaire}
          accessibilityLabel={t('certification.carnet.rechercher')}
          autoCapitalize="none"
          autoCorrect={false}
          style={[typo.texte, styles.champ, { color: theme.texte.principal }]}
        />
      </View>
      <Onglets valeurs={ETATS.map((e) => ({ valeur: e, libelle: t(`certification.carnet.onglets.${e}`, { n: compteurs[e] }) }))} valeur={etat} onChange={setEtat} />
      {recherche && trouves.length === 0 ? (
        <Carte>
          <View style={styles.colonne}>
            <PastilleBoite etat="a_revoir" libelle={t('certification.carnet.aucunTitre')} />
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.carnet.aucunTexte', { mot: requete.trim() })}</Text>
          </View>
        </Carte>
      ) : null}
      {!recherche && trouves.length === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.carnet.videEtat')}</Text> : null}
      {trouves.map((m) => (
        <LigneChoix
          key={m.id}
          icone={NotebookPen}
          titre={m.mot}
          aide={t('certification.carnet.ligneAide', { definition: m.definition, boite: m.boite })}
          droite={<PastilleBoite etat={m.boite === 1 ? 'a_revoir' : m.boite === 4 ? 'connu' : 'en_cours'} libelle={t(`certification.carnet.etats.${m.boite === 1 ? 'a_revoir' : m.boite === 4 ? 'connu' : 'en_cours'}`)} />}
          onPress={() => router.push({ pathname: '/certification/mot/[id]', params: { id: m.id } } as never)}
        />
      ))}
      <View style={styles.droite}>
        <Bouton libelle={recherche && trouves.length === 0 ? t('certification.carnet.ajouterMot', { mot: requete.trim() }) : t('certification.carnet.ajouter')} onPress={ajouter} />
      </View>
      {bientot ? <Banniere ton="info" titre={t('certification.carnet.ajoutBientot')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: espace[3] },
  centre: { alignItems: 'center', gap: espace[2] },
  recherche: { flexDirection: 'row', alignItems: 'center', gap: espace[2], minHeight: cibleMin, paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  champ: { flex: 1, paddingVertical: espace[2] },
  pastille: { alignSelf: 'flex-start', borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[2], paddingVertical: 2 },
  droite: { alignItems: 'flex-end' },
});
