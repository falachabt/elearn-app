import { BookOpen, Camera, Headphones, NotebookPen, Target, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic, EtiquetteSection } from './ui';

type Props = {
  partie: number;
  /** Nombre de questions de la partie dans le diagnostic. */
  questions: number;
  onCommencer: () => void;
  onRetour: () => void;
};

type Cle = 'aTitre' | 'aTexte' | 'bTitre' | 'bTexte' | 'cTitre' | 'cTexte';
type Carte = { icone: LucideIcon; titre: string; texte: string };

/** Une carte de consigne : pastille d'icône, titre, texte (D-P1, D-P3). */
function CarteConsigne({ icone: Icone, titre, texte }: Carte) {
  const { theme } = useTheme();
  return (
    <View style={styles.zone}>
      <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={[styles.pastille, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
          <Icone size={20} color={theme.texte.principal} strokeWidth={2} />
        </View>
        <View style={styles.texte}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{texte}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * D-P1, D-P3 : consignes affichées avant chaque partie du diagnostic, en quatre cartes (ce que tu vois ou entends, ce que
 * tu fais ou le fonctionnement d'un groupe, pas de retour ou pas de réécoute, nombre de questions), puis « Commencer la partie N ».
 */
export function ConsignesPartie({ partie, questions, onCommencer, onRetour }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [envoi, setEnvoi] = useState(false);
  const n = Math.min(7, Math.max(1, partie));
  const texte = (cle: Cle) => t(`certification.consignes.cartes.p${n}.${cle}` as 'certification.consignes.cartes.p1.aTitre');
  const groupe = n === 3 || n === 4;
  const audio = n <= 4;
  const cartes: Carte[] = [
    { icone: n === 1 ? Camera : audio ? Headphones : BookOpen, titre: texte('aTitre'), texte: texte('aTexte') },
    { icone: groupe ? NotebookPen : Target, titre: texte('bTitre'), texte: texte('bTexte') },
    groupe
      ? { icone: TriangleAlert, titre: texte('cTitre'), texte: texte('cTexte') }
      : { icone: TriangleAlert, titre: t('certification.consignes.cartes.pasDeRetour'), texte: t('certification.consignes.cartes.pasDeRetourTexte', { n }) },
    { icone: NotebookPen, titre: t('certification.consignes.cartes.diagnostic'), texte: questions === 1 ? t('certification.consignes.cartes.nombreUne') : t('certification.consignes.cartes.nombre', { n: questions }) },
  ];
  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.consignes.cartes.entete')} onRetour={onRetour} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.consignes.commencer', { n })} desactive={envoi} onPress={() => (setEnvoi(true), onCommencer())} retour />
        </View>
      }
    >
      <EtiquetteSection texte={t('certification.consignes.cartes.avant', { n })} />
      <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
        {t('certification.consignes.cartes.titrePartie', { n, nom: t(`certification.consignes.partie${n as 1}.titre`) })}
      </Text>
      <View style={styles.groupe}>
        {cartes.map((c, i) => (
          <CarteConsigne key={i} {...c} />
        ))}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  pied: { gap: espace[2] },
  zone: { paddingBottom: ombre.s, paddingRight: ombre.s },
  ombre: { position: 'absolute', left: ombre.s, top: ombre.s, right: 0, bottom: 0, borderRadius: rayon.l },
  carte: { minHeight: 68, flexDirection: 'row', alignItems: 'flex-start', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  pastille: { width: 40, height: 40, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: 2 },
});
