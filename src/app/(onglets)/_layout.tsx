import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Onglet } from '@/components/Onglet';
import { useTheme } from '@/theme/ThemeProvider';
import { bord } from '@/theme/theme';

// Cinq onglets, dans l'ordre de la carte de l'app : Accueil · Réviser · Photo · Questions · Moi.
export default function LayoutOnglets() {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs style={styles.racine}>
      <TabSlot style={styles.ecran} />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.barre, { backgroundColor: theme.fond.surface, borderTopColor: theme.bord.fort, paddingBottom: bottom }])}>
          <TabTrigger name="index" href="/" asChild>
            <Onglet libelle="Accueil" icone="home-outline" iconeActive="home" />
          </TabTrigger>
          <TabTrigger name="reviser" href="/reviser" asChild>
            <Onglet libelle="Réviser" icone="book-outline" iconeActive="book" />
          </TabTrigger>
          <TabTrigger name="photo" href="/photo" asChild>
            <Onglet libelle="Photo" icone="camera" central />
          </TabTrigger>
          <TabTrigger name="questions" href="/questions" asChild>
            <Onglet libelle="Questions" icone="chatbubbles-outline" iconeActive="chatbubbles" />
          </TabTrigger>
          <TabTrigger name="moi" href="/moi" asChild>
            <Onglet libelle="Moi" icone="person-outline" iconeActive="person" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  ecran: { flex: 1, minHeight: 0 },
  barre: { flexDirection: 'row', borderTopWidth: bord.normal },
});
