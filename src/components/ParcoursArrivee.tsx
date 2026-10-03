import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { CLASSES, CONCOURS, PAYS, enregistrerProfil, lireProfil, paysParDefaut, type ConcoursChoisi, type Pays } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Apparition } from './Apparition';
import { Appui } from './Appui';
import { Bouton } from './Bouton';
import { Carte } from './Carte';
import { Ecran } from './Ecran';
import { Etiquette } from './Etiquette';
import { Logo } from './Logo';

/** Grande carte de choix (maquettes A1 et A3) : icône, titre, aide, flèche. */
function ChoixCarte({ titre, aide, icone, plein, etiquette, onPress }: { titre: string; aide: string; icone: keyof typeof Ionicons.glyphMap; plein?: 'marque' | 'soleil'; etiquette?: string; onPress: () => void }) {
  const { theme } = useTheme();
  const fond = plein === 'marque' ? theme.marque.principale : plein === 'soleil' ? theme.accent.soleil : theme.fond.surface;
  const texte = plein ? theme.texte.surCouleur : theme.texte.principal;
  return (
    <Appui accessibilityRole="button" accessibilityLabel={titre} onPress={onPress} decalage={4} ombre={ombre.m} couleurOmbre={theme.ombre} rayon={rayon.l} retour>
      <View style={[styles.choix, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
        <View style={[styles.icone, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Ionicons name={icone} size={22} color={theme.texte.principal} />
        </View>
        <View style={styles.choixTexte}>
          {etiquette ? <Etiquette texte={etiquette} /> : null}
          <Text style={[typo.texteFort, { color: texte }]}>{titre}</Text>
          <Text style={[typo.petit, { color: texte }]}>{aide}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={texte} />
      </View>
    </Appui>
  );
}

/** A1 · Bienvenue : aucun compte demandé, deux choix et un appui (M1-01). */
export function Bienvenue() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <Ecran>
      <Apparition delai={0}>
        <Logo variante="horizontal" hauteur={44} />
      </Apparition>
      <Apparition delai={60}>
        <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('bienvenue.titre')}</Text>
      </Apparition>
      <Apparition delai={120}>
        <Carte style={{ backgroundColor: theme.accent.soleil }}>
          <View style={styles.groupe}>
            <Etiquette texte={t('bienvenue.exempleEtiquette')} />
            <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('bienvenue.exempleTitre')}</Text>
            <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{t('bienvenue.exempleTexte')}</Text>
          </View>
        </Carte>
      </Apparition>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('bienvenue.tuEs')}</Text>
      <Apparition delai={180}>
        <ChoixCarte plein="marque" icone="school-outline" titre={t('bienvenue.eleve')} aide={t('bienvenue.eleveAide')} onPress={() => router.push({ pathname: '/classe', params: { type: 'eleve' } })} />
      </Apparition>
      <Apparition delai={240}>
        <ChoixCarte icone="trophy-outline" titre={t('bienvenue.concours')} aide={t('bienvenue.concoursAide')} onPress={() => router.push({ pathname: '/classe', params: { type: 'concours' } })} />
      </Apparition>
      <Bouton variante="texte" libelle={t('bienvenue.dejaCompte')} onPress={() => router.push('/compte/connexion')} />
    </Ecran>
  );
}

/** A2 · Classe (ou concours) et pays, avec valeurs par défaut (M1-01, M1-02). */
export function ChoixClasse() {
  const { t, langue, changerLangue } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ type?: string; modifier?: string }>();
  // H1 : depuis Moi, « Changer de classe » rouvre cet écran avec le profil actuel et revient à Moi.
  const modifier = params.modifier === '1';
  const [type, setType] = useState(params.type);
  const concours = type === 'concours';
  const [niveau, setNiveau] = useState<string>(concours ? CONCOURS[0] : '3e');
  const [monConcours, setMonConcours] = useState<ConcoursChoisi | null>(null);
  const [pays, setPays] = useState<Pays>(() => paysParDefaut(safeRegion()));
  const [changerPays, setChangerPays] = useState(false);
  // Le concours se choisit sur son propre écran (filière puis concours), qui l'enregistre dans le profil.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireProfil().then((p) => {
        if (!actif || p?.type !== 'concours' || !p.concours) return;
        setMonConcours(p.concours);
        if (p.niveau) setNiveau(p.niveau);
      });
      return () => {
        actif = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!modifier) return;
    let actif = true;
    lireProfil().then((p) => {
      if (!actif || !p) return;
      setType(p.type);
      if (p.niveau) setNiveau(p.niveau);
      if (p.pays && (PAYS as readonly string[]).includes(p.pays)) setPays(p.pays as Pays);
    });
    return () => {
      actif = false;
    };
  }, [modifier]);

  const continuer = async () => {
    if (concours && !monConcours) {
      // Les deux étapes du concours écrivent d'abord un profil de candidat avec ce pays.
      const p = await lireProfil();
      await enregistrerProfil({ type: 'concours', niveau, pays, concours: null, termine: p?.termine ?? false });
      router.push('/concours');
      return;
    }
    const choix = concours ? monConcours : null;
    if (modifier) {
      await enregistrerProfil({ type: concours ? 'concours' : 'eleve', niveau, pays, concours: choix, termine: true });
      // La mission du jour gardée en cache était tirée pour l'ancienne classe.
      await AsyncStorage.removeItem('mission.jour');
      suivre('profile_class_changed', { niveau, pays, statut: concours ? 'concours' : 'eleve' });
      if (router.canGoBack()) router.back();
      else router.replace('/moi');
      return;
    }
    await enregistrerProfil({ type: concours ? 'concours' : 'eleve', niveau, pays, concours: choix, termine: false });
    suivre('onboarding_choice_made', { profil: concours ? 'concours' : 'eleve', niveau, pays });
    router.push('/premier-resultat');
  };

  return (
    <Ecran pied={<Bouton libelle={t(modifier ? 'classe.enregistrer' : 'classe.continuer')} onPress={continuer} retour />}>
      <Bouton petit variante="texte" libelle={t('classe.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/bienvenue'))} />
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t(concours ? 'classe.titreConcours' : 'classe.titreEleve')}</Text>
      {modifier ? (
        // Depuis Moi : on peut aussi changer de statut (élève ou candidat à un concours).
        <View accessibilityRole="radiogroup" accessibilityLabel={t('classe.statut')} style={styles.pastilles}>
          {(['eleve', 'concours'] as const).map((s) => (
            <Pastille
              key={s}
              libelle={t(s === 'eleve' ? 'bienvenue.eleve' : 'bienvenue.concours')}
              actif={(s === 'concours') === concours}
              onPress={() => {
                if ((s === 'concours') === concours) return;
                setType(s);
                setNiveau(s === 'concours' ? CONCOURS[0] : '3e');
              }}
            />
          ))}
        </View>
      ) : null}
      {concours ? (
        <Carte>
          <View style={styles.ligne}>
            <View style={styles.choixTexte}>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('concours.monConcours')}</Text>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{monConcours ? [monConcours.sigle, monConcours.ville].filter(Boolean).join(' · ') : t('concours.aucun')}</Text>
              {monConcours?.nom ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{monConcours.nom}</Text> : null}
            </View>
            <Bouton petit variante="texte" libelle={t('classe.changer')} onPress={() => router.push('/concours')} />
          </View>
        </Carte>
      ) : (
        <View style={styles.pastilles}>
          {CLASSES.map((o) => (
            <Pastille key={o} libelle={o} actif={niveau === o} onPress={() => setNiveau(o)} />
          ))}
        </View>
      )}
      <Carte>
        <View style={styles.groupe}>
          <View style={styles.ligne}>
            <View style={styles.choixTexte}>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('classe.pays')}</Text>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{`${t(`pays.${pays}`)} · ${t('classe.programme')}`}</Text>
            </View>
            <Bouton petit variante="texte" libelle={t('classe.changer')} onPress={() => setChangerPays((v) => !v)} />
          </View>
          {changerPays ? (
            <View style={styles.pastilles}>
              {PAYS.map((p) => (
                <Pastille key={p} libelle={t(`pays.${p}`)} actif={pays === p} onPress={() => setPays(p)} />
              ))}
            </View>
          ) : null}
        </View>
      </Carte>
      {!modifier ? (
        <View style={styles.groupe}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('classe.langueQuestion')}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('classe.langueQuestion')} style={styles.pastilles}>
            {([
              ['fr', 'Français'],
              ['en', 'English'],
            ] as const).map(([code, nom]) => (
              <Pastille key={code} libelle={nom} actif={langue === code} onPress={() => void changerLangue(code)} />
            ))}
          </View>
        </View>
      ) : null}
    </Ecran>
  );
}

function safeRegion(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

function Pastille({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={libelle}
      onPress={onPress}
      decalage={0}
      rayon={rayon.pilule}
    >
      <View style={[styles.pastille, { backgroundColor: actif ? theme.texte.principal : theme.fond.surface, borderColor: theme.bord.fort }]}>
        <Text style={[typo.texteFort, { color: actif ? theme.texte.inverse : theme.texte.principal }]}>{libelle}</Text>
      </View>
    </Appui>
  );
}

async function terminer(): Promise<void> {
  const p = await lireProfil();
  await enregistrerProfil({ type: p?.type ?? 'eleve', niveau: p?.niveau, pays: p?.pays, termine: true });
}

/** A3 · Premier résultat : deux portes (photo ou mini-test) ou explorer (M1-03). La photo mène à l'onglet Photo en attendant le parcours B. */
export function PremierResultat() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const aller = (route: '/photo' | '/') => async () => {
    await terminer();
    router.replace(route);
  };
  return (
    <Ecran pied={<Bouton variante="texte" libelle={t('premier.explorer')} onPress={aller('/')} />}>
      <Bouton petit variante="texte" libelle={t('classe.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/bienvenue'))} />
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('premier.titre')}</Text>
      <ChoixCarte plein="marque" icone="camera-outline" etiquette={t('premier.photoEtiquette')} titre={t('premier.photoTitre')} aide={t('premier.photoTexte')} onPress={aller('/photo')} />
      <ChoixCarte plein="soleil" icone="flash-outline" etiquette={t('premier.testEtiquette')} titre={t('premier.testTitre')} aide={t('premier.testTexte')} onPress={() => router.push('/mini-test')} />
    </Ecran>
  );
}

export { terminer as terminerParcoursArrivee };

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  choix: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  choixTexte: { flex: 1, gap: espace[2] },
  icone: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  pastille: { minHeight: cibleMin - 6, paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.pilule, alignItems: 'center', justifyContent: 'center' },
});
