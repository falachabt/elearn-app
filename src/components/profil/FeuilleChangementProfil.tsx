import { TriangleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';

export type EtatChangement = 'repos' | 'charge' | 'erreur';

type Props = {
  etat: EtatChangement;
  titre: string;
  texte?: string;
  confirmer: string;
  annuler: string;
  onConfirmer: () => void;
  onAnnuler: () => void;
  children?: ReactNode;
};

/**
 * Feuille de confirmation d'un changement de profil (P4, P5) avec ses états : en cours, bouton désactivé (P6-CHARGE),
 * et erreur où le profil reste inchangé (P6-ERR).
 */
export function FeuilleChangementProfil({ etat, titre, texte, confirmer, annuler, onConfirmer, onAnnuler, children }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();

  if (etat === 'charge') {
    return (
      <Carte>
        <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
          {t('profilChoix.chargeTitre')}
        </Text>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('profilChoix.chargeTexte')}</Text>
        <Bouton libelle={t('profilChoix.chargeBouton')} desactive onPress={() => {}} />
      </Carte>
    );
  }

  if (etat === 'erreur') {
    return (
      <Carte>
        <View style={styles.ligne}>
          <TriangleAlert size={20} color={theme.etat.erreur} strokeWidth={2} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
            {t('profilChoix.erreurTitre')}
          </Text>
        </View>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('profilChoix.erreurTexte')}</Text>
        <Bouton libelle={t('profilChoix.reessayer')} onPress={onConfirmer} />
        <Bouton variante="texte" libelle={t('profilChoix.rester')} onPress={onAnnuler} />
      </Carte>
    );
  }

  return (
    <Carte>
      <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
        {titre}
      </Text>
      {texte ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{texte}</Text> : null}
      {children}
      <Bouton libelle={confirmer} onPress={onConfirmer} />
      <Bouton variante="texte" libelle={annuler} onPress={onAnnuler} />
    </Carte>
  );
}

const styles = StyleSheet.create({ ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[2] } });
