import { CalendarDays } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Carte } from '../Carte';

export type TypeEcheance = 'examen' | 'fin_de_cours' | 'concours';
export type Decompte = { jours: number; heures: number; minutes: number; secondes: number; passee: boolean };

/** Sous ce nombre de jours, la carte passe en orange (attention) quel que soit son type. */
export const SEUIL_PROCHE_JOURS = 30;

const JOUR = 86_400_000;
const HEURE = 3_600_000;
const MINUTE = 60_000;

/** Temps restant jusqu'à la date cible (minuit, heure locale, du jour cible). Pur : testable sans horloge. */
export function decompter(cible: Date, maintenant: Date): Decompte {
  const reste = cible.getTime() - maintenant.getTime();
  if (reste <= 0) return { jours: 0, heures: 0, minutes: 0, secondes: 0, passee: true };
  return {
    jours: Math.floor(reste / JOUR),
    heures: Math.floor((reste % JOUR) / HEURE),
    minutes: Math.floor((reste % HEURE) / MINUTE),
    secondes: Math.floor((reste % MINUTE) / 1000),
    passee: false,
  };
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

export type SegmentDecompte = { unite: 'jours' | 'heures' | 'minutes' | 'secondes'; texte: string; grand: boolean; moyen: boolean };

/**
 * Affichage du décompte : l'unité la plus grande non nulle est la première, en grand. Les unités nulles qui la précèdent
 * disparaissent (0 j → l'heure devient grande). Une seconde en petit, la minute en moyen.
 */
export function segments(d: Decompte, libelles: Record<SegmentDecompte['unite'], string>): SegmentDecompte[] {
  const unites = [
    { unite: 'jours' as const, valeur: d.jours, libelle: libelles.jours },
    { unite: 'heures' as const, valeur: d.heures, libelle: libelles.heures },
    { unite: 'minutes' as const, valeur: d.minutes, libelle: libelles.minutes },
    { unite: 'secondes' as const, valeur: d.secondes, libelle: libelles.secondes },
  ];
  const premier = unites.findIndex((u) => u.valeur > 0);
  const debut = premier < 0 ? unites.length - 1 : premier;
  return unites.slice(debut).map((u, i) => ({
    unite: u.unite,
    texte: `${u.unite === 'jours' ? u.valeur : deuxChiffres(u.valeur)} ${u.libelle}`,
    grand: i === 0,
    moyen: i === 1,
  }));
}

/**
 * Compte à rebours de l'accueil (issue #65) : jours en grand, heures et minutes ensuite, secondes en petit.
 * Quatre variantes : examen (jaune, à retenir), fin de cours (blanc), concours (bleu, information), et « proche »
 * (orange, attention) dès que la date est à moins de 30 jours. Les couleurs viennent des jetons du thème : le mode
 * sombre suit sans code en plus. Texte noir sur les couleurs vives (règle du design : soleil, matières).
 */
export function CompteARebours({ type, cible, libelle, estime = false }: { type: TypeEcheance; cible: Date; libelle: string; estime?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const d = decompter(cible, maintenant);
  // Une date passée n'affiche rien : le caller choisit ce qu'il montre ensuite.
  if (d.passee) return null;

  const proche = d.jours < SEUIL_PROCHE_JOURS;
  const fond = proche ? theme.etat.alerteDoux : type === 'examen' ? theme.accent.soleil : type === 'concours' ? theme.etat.infoDoux : theme.fond.surface;
  // Jaune et orange vifs : texte noir. Surfaces claires ou sombres du thème : texte du thème.
  const encre = type === 'examen' && !proche ? theme.texte.surCouleur : theme.texte.principal;

  return (
    <Carte
      accessible
      accessibilityLabel={`${libelle}${estime ? `, ${t('accueil.compteARebours.estime')}` : ''}, ${d.jours} ${t('accueil.compteARebours.jours')}`}
      style={[styles.carte, { backgroundColor: fond }]}
    >
      <View style={[styles.pastille, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
        <CalendarDays size={20} strokeWidth={2} color={theme.texte.principal} />
      </View>
      <View style={styles.texte}>
        <Text numberOfLines={1} style={[typo.etiquette, { color: encre }]}>
          {libelle}
          {estime ? ` · ${t('accueil.compteARebours.estime')}` : ''}
        </Text>
        <View style={styles.ligne}>
          {segments(d, {
            jours: t('accueil.compteARebours.jours'),
            heures: t('accueil.compteARebours.heures'),
            minutes: t('accueil.compteARebours.minutes'),
            secondes: t('accueil.compteARebours.secondes'),
          }).map((s) => (
            <Text key={s.unite} style={[s.grand ? typo.chiffreL : s.moyen ? typo.donnee : typo.legende, { color: encre }]}>
              {s.texte}
            </Text>
          ))}
        </View>
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  carte: { flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingVertical: espace[3], paddingHorizontal: espace[4] },
  pastille: { width: 36, height: 36, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
  ligne: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: espace[2] },
});
