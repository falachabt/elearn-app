import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Image as IconeImage } from 'lucide-react-native';
import { useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { MAX_FEUILLES, ajouterFeuilles, definirBrouillon, lireBrouillon, nouvelleFeuille, type TypeSujet } from '@/services/travailSujet';
import { useTheme } from '@/theme/ThemeProvider';

import { Feuille } from '../../Feuille';

export type SujetACorriger = { kind: TypeSujet; ref: string; titre: string; matiere: string | null; tempsS?: number | null };

/** AS4 · « Faire corriger ton travail » : prendre les feuilles en photo ou les importer de la galerie. */
export function FeuilleCorrigerTravail({ ouverte, onFermer, sujet }: { ouverte: boolean; onFermer: () => void; sujet: SujetACorriger }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [erreur, setErreur] = useState(false);

  const demarrer = () => {
    const actuel = lireBrouillon();
    const memeSujet = actuel && actuel.kind === sujet.kind && actuel.ref === sujet.ref;
    definirBrouillon({ kind: sujet.kind, ref: sujet.ref, titre: sujet.titre, matiere: sujet.matiere, tempsS: sujet.tempsS ?? null, feuilles: memeSujet ? actuel.feuilles : [] });
  };

  const prendre = () => {
    suivre('annale_ai_started', { source: 'photos' });
    demarrer();
    onFermer();
    router.push('/annales/photos');
  };

  const galerie = async () => {
    setErreur(false);
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_FEUILLES, quality: 1 });
      if (r.canceled || !r.assets.length) return;
      suivre('annale_ai_started', { source: 'galerie' });
      demarrer();
      const apres = ajouterFeuilles(lireBrouillon()?.feuilles ?? [], r.assets.map((a) => nouvelleFeuille({ uri: a.uri, largeur: a.width, hauteur: a.height })));
      definirBrouillon({ ...lireBrouillon()!, feuilles: apres.liste });
      onFermer();
      router.push('/annales/ordre');
    } catch {
      setErreur(true);
    }
  };

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t('travail.feuilleTitre')}
      texte={erreur ? t('travail.feuillesErreur') : t('travail.feuilleTexte')}
      actions={[
        { libelle: t('travail.prendre'), onPress: prendre, variante: 'principal', icone: <Camera size={20} color={theme.texte.surCouleur} /> },
        { libelle: t('travail.galerie'), onPress: () => void galerie(), variante: 'secondaire', icone: <IconeImage size={20} color={theme.texte.principal} /> },
        { libelle: t('travail.plusTard'), onPress: onFermer, variante: 'texte' },
      ]}
    />
  );
}
