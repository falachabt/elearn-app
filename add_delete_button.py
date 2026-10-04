import re
with open("src/components/moi/SuppressionCompte.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Inject the delete_user_safely call and modeDevOuPreview check
if "const modeDevOuPreview" not in content:
    mode_dev_code = """
  const modeDevOuPreview = __DEV__ || process.env.EXPO_PUBLIC_APERCU === '1';

  const supprimerMaintenant = async () => {
    setEnCours(true);
    try {
      await getSupabase().rpc('delete_user_safely', { user_id: user?.id });
      await getSupabase().auth.signOut();
    } catch (e) {
      setEnCours(false);
    }
  };
"""
    content = content.replace("const annuler = async () =>", mode_dev_code + "\n  const annuler = async () =>")

    old_pied = """const pied = !connecte ? undefined : demande ? (
    <Bouton libelle={t('suppression.annuler')} desactive={enCours} onPress={() => void annuler()} />
  ) : (
    <Bouton variante="danger" libelle={enCours ? t('suppression.enCours') : t('suppression.confirmer')} desactive={enCours} onPress={() => void supprimer()} />
  );"""

    new_pied = """const pied = !connecte ? undefined : demande ? (
    <View style={{ gap: 8 }}>
      <Bouton libelle={t('suppression.annuler')} desactive={enCours} onPress={() => void annuler()} />
      {modeDevOuPreview && (
        <Bouton variante="danger" libelle="[DEV] Supprimer immédiatement" desactive={enCours} onPress={() => void supprimerMaintenant()} />
      )}
    </View>
  ) : (
    <View style={{ gap: 8 }}>
      <Bouton variante="danger" libelle={enCours ? t('suppression.enCours') : t('suppression.confirmer')} desactive={enCours} onPress={() => void supprimer()} />
      {modeDevOuPreview && (
        <Bouton variante="danger" libelle="[DEV] Supprimer immédiatement" desactive={enCours} onPress={() => void supprimerMaintenant()} />
      )}
    </View>
  );"""

    content = content.replace(old_pied, new_pied)

    if "View" not in content:
        content = content.replace("from 'react-native';", "View } from 'react-native';")
        
with open("src/components/moi/SuppressionCompte.tsx", "w", encoding="utf-8") as f:
    f.write(content)
