import { AlertCircle, Loader, Tag, WifiOff, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { etiquetteRabais } from '@/services/codePromo';
import type { CodeOffre } from '@/services/pass';
import { formaterMontant } from '@/services/pass';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { useRendreVisible } from '../Ecran';
import { useFeedback } from '../useFeedback';
import type { EtatCodePromo } from './useCodePromo';

type Props = {
  etat: EtatCodePromo;
  offre: CodeOffre;
  /** Bouton « Choisir le Pass concours » : l'écran change d'offre puis revérifie le code pour elle. */
  surChoisirOffre: (offre: CodeOffre) => void;
  /** Pendant l'envoi du paiement, rien ne bouge. */
  fige?: boolean;
};

/** Icône qui tourne pendant la vérification ; fixe si « Réduire les animations ». */
function Rotation({ couleur }: { couleur: string }) {
  const { reduit } = useFeedback();
  const angle = useSharedValue(0);
  useEffect(() => {
    if (reduit) return;
    angle.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [reduit, angle]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Loader size={20} color={couleur} strokeWidth={2} />
    </Animated.View>
  );
}

/**
 * Code promo du Pass sur l'écran de paiement E2 (maquette docs/maquettes/code-promo.md) : lien « J'ai un code promo »,
 * champ avec « Appliquer », vérification, code appliqué avec « Retirer », erreurs avec leur action. Le prix réduit et le
 * badge sont affichés par l'écran de paiement (résumé), pas ici.
 */
export function CodePromo({ etat, offre, surChoisirOffre, fige }: Props) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { phase, texte, refus, applique } = etat;
  const nom = (o: CodeOffre) => t(`offres.${o}`);
  const rendreVisible = useRendreVisible();
  const zone = useRef<View>(null);

  if (phase === 'ferme') {
    return (
      <Appui accessibilityRole="button" accessibilityLabel={t('paiement.promo.lien')} onPress={etat.ouvrir} disabled={fige} decalage={0} style={styles.lienZone}>
        <Text style={[typo.texteFort, styles.lien, { color: theme.texte.lien }]}>{t('paiement.promo.lien')}</Text>
      </Appui>
    );
  }

  if (phase === 'applique' && applique) {
    const montant = (n: number) => formaterMontant(n, applique.devise);
    return (
      <View style={[styles.appliquee, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.pastille, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
          <Tag size={20} color={theme.texte.surCouleur} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text style={[typo.texteFort, styles.mono, { color: theme.texte.principal }]}>{applique.code}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('paiement.promo.rabaisSur', { rabais: etiquetteRabais(applique, montant), offre: nom(offre) })}</Text>
        </View>
        <Appui
          accessibilityRole="button"
          accessibilityLabel={t('paiement.promo.retirerCode', { code: applique.code })}
          onPress={etat.retirer}
          disabled={fige}
          rayon={rayon.m}
          decalage={2}
        >
          <View style={[styles.retirer, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <X size={18} color={theme.texte.principal} strokeWidth={2} />
            <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('paiement.promo.retirer')}</Text>
          </View>
        </Appui>
      </View>
    );
  }

  const verif = phase === 'verif';
  const erreur = phase === 'erreur' && refus ? refus : null;
  const vide = texte.length === 0;
  const motif = erreur?.erreur;

  const message = (() => {
    if (!motif) return '';
    if (motif === 'expire') {
      const date = erreur?.expireLe ? new Date(`${erreur.expireLe}T00:00:00Z`) : null;
      if (date && !Number.isNaN(date.getTime())) {
        return t('paiement.promo.erreurs.expire', { date: date.toLocaleDateString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) });
      }
      return t('paiement.promo.erreurs.expireSansDate');
    }
    if (motif === 'offre') {
      const valable = erreur?.offresValables?.[0];
      return valable
        ? t('paiement.promo.erreurs.offre', { valable: nom(valable), actuel: nom(offre) })
        : t('paiement.promo.erreurs.offreAutre', { actuel: nom(offre) });
    }
    return t(`paiement.promo.erreurs.${motif}` as CleTexte);
  })();
  const offreValable = motif === 'offre' ? erreur?.offresValables?.[0] : undefined;

  return (
    <View ref={zone} style={styles.groupe}>
      <View style={styles.ligne}>
        <View
          style={[
            styles.champ,
            { backgroundColor: theme.fond.surface, borderColor: erreur ? theme.etat.erreur : theme.bord.fort, borderWidth: erreur ? bord.epais : bord.normal },
          ]}
        >
          <Tag size={20} color={theme.texte.principal} strokeWidth={2} />
          <TextInput
            value={texte}
            onChangeText={etat.changerTexte}
            onSubmitEditing={() => void etat.appliquer()}
            onFocus={() => rendreVisible?.(zone.current)}
            editable={!verif && !fige}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            returnKeyType="done"
            accessibilityLabel={t('paiement.promo.libelle')}
            placeholder={t('paiement.promo.placeholder')}
            placeholderTextColor={theme.texte.secondaire}
            style={[typo.texteFort, styles.saisie, { color: theme.texte.principal }]}
          />
        </View>
        <View style={styles.boutonAppliquer}>
          {verif ? (
            <Bouton variante="secondaire" petit desactive libelle={t('paiement.promo.verification')} icone={<Rotation couleur={theme.texte.secondaire} />} onPress={() => {}} />
          ) : (
            <Bouton variante={erreur ? 'secondaire' : 'primaire'} petit desactive={vide || !!fige} libelle={t('paiement.promo.appliquer')} onPress={() => void etat.appliquer()} />
          )}
        </View>
      </View>

      {erreur ? (
        <View style={styles.groupe}>
          <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.message}>
            {motif === 'reseau' ? (
              <WifiOff size={18} color={theme.etat.erreurTexte} strokeWidth={2} />
            ) : (
              <AlertCircle size={18} color={theme.etat.erreurTexte} strokeWidth={2} />
            )}
            <Text style={[typo.petit, styles.flex, { color: theme.etat.erreurTexte }]}>{message}</Text>
          </View>
          {offreValable ? (
            <Bouton variante="secondaire" libelle={t('paiement.promo.choisirOffre', { offre: nom(offreValable) })} onPress={() => surChoisirOffre(offreValable)} />
          ) : null}
          {motif === 'reseau' ? <Bouton variante="secondaire" libelle={t('paiement.promo.reessayer')} onPress={() => void etat.appliquer()} /> : null}
        </View>
      ) : null}

      <View style={styles.annuler}>
        <Appui accessibilityRole="button" accessibilityLabel={t('paiement.promo.annuler')} onPress={etat.annuler} disabled={verif} decalage={0} style={styles.lienZone}>
          <Text style={[typo.texteFort, styles.lien, { color: theme.texte.lien }]}>{t('paiement.promo.annuler')}</Text>
        </Appui>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  groupe: { gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'stretch', gap: espace[3] },
  lienZone: { minHeight: cibleMin, justifyContent: 'center', alignSelf: 'flex-start' },
  lien: { textDecorationLine: 'underline' },
  annuler: { alignItems: 'flex-end' },
  champ: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], borderRadius: rayon.m },
  saisie: { flex: 1, minWidth: 0, paddingVertical: 0, letterSpacing: 1.2, fontFamily: 'monospace' },
  boutonAppliquer: { minWidth: 124, justifyContent: 'center' },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
  appliquee: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderWidth: bord.normal, borderRadius: rayon.l },
  pastille: { width: 40, height: 40, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: 'monospace', letterSpacing: 0.8 },
  retirer: { flexDirection: 'row', alignItems: 'center', gap: espace[2], minHeight: cibleMin, paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
});
