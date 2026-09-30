import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Apparition } from '@/components/Apparition';
import { Banniere } from '@/components/Banniere';
import { Bouton } from '@/components/Bouton';
import { Carte } from '@/components/Carte';
import { Champ } from '@/components/Champ';
import { Ecran } from '@/components/Ecran';
import { Etiquette } from '@/components/Etiquette';
import { Logo } from '@/components/Logo';
import { OptionReponse } from '@/components/OptionReponse';
import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

// Écran provisoire : vitrine des composants, remplacée par le parcours « premier lancement » (phase 2).
export default function Accueil() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const [choix, setChoix] = useState<string | null>(null);

  return (
    <Ecran insetBas={false}>
      <Apparition delai={0}>
        <Logo variante="horizontal" hauteur={72} />
      </Apparition>
      <Apparition delai={60}>
        <Etiquette texte={t('accueil.etiquette')} jaune />
      </Apparition>
      <Apparition delai={120}>
        <Text style={[typo.affiche, { color: theme.texte.principal }]}>{t('accueil.titre')}</Text>
      </Apparition>
      <Apparition delai={180}>
        <Text style={[typo.texteGrand, { color: theme.texte.secondaire }]}>{t('accueil.accroche')}</Text>
      </Apparition>
      <Apparition delai={240}>
        <Carte>
          <View style={styles.groupe}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('accueil.exercice')}</Text>
            {['2', '3', '4'].map((valeur, i) => (
              <OptionReponse
                key={valeur}
                lettre={'ABC'[i]}
                texte={valeur}
                etat={choix === valeur ? (valeur === '3' ? 'bonne' : 'fausse') : 'neutre'}
                onPress={() => setChoix(valeur)}
              />
            ))}
          </View>
        </Carte>
      </Apparition>
      <Apparition delai={300}>
        <Banniere ton="info" titre={t('accueil.astuceTitre')} texte={t('accueil.astuceTexte')} />
      </Apparition>
      <Apparition delai={360}>
        <Champ libelle={t('accueil.champMobileMoney')} placeholder="6 12 34 56 78" keyboardType="phone-pad" />
      </Apparition>
      <Apparition delai={420}>
        <Bouton libelle={t('actions.commencer')} onPress={() => setChoix(null)} />
      </Apparition>
      <Apparition delai={480}>
        <Bouton libelle={t('actions.plusTard')} variante="texte" onPress={() => setChoix(null)} />
      </Apparition>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
});
