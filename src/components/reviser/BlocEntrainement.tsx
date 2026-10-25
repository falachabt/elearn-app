import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { espace } from '@/theme/theme';

import { GroupeColle, LigneGroupe } from '../liste/ListeCollee';
import { PastilleType } from '../liste/PastilleType';
import { PiluleCompteur } from '../liste/PiluleCompteur';

// Le bloc collé vit désormais dans le composant partagé `liste/ListeCollee` (lot 1bis) ; ces
// réexportations gardent les imports existants (Chapitre, lecteur vidéo, Mes vidéos) inchangés.
export { GroupeColle, LigneGroupe } from '../liste/ListeCollee';

/** Le bloc « S'entraîner sur ce cours » seul (compteurs quiz/exercices), réutilisé au pied du lecteur vidéo. */
export function BlocEntrainement({
  cours,
  nom,
  quiz,
  exercices,
  faits,
  quizFaits,
  libelle,
}: {
  cours: string;
  nom: string;
  quiz: number;
  exercices: number;
  faits: number;
  quizFaits: number;
  libelle: string;
}) {
  return (
    <GroupeColle>
      <LigneGroupe
        premier
        gauche={<PastilleType type="quiz" />}
        titre={libelle}
        bas={
          <View style={styles.compteurs}>
            {quiz ? <PiluleCompteur type="quiz" faits={quizFaits} total={quiz} fini={false} /> : null}
            {exercices ? <PiluleCompteur type="exercice" faits={faits} total={exercices} fini={false} /> : null}
          </View>
        }
        onPress={() => router.push({ pathname: '/entrainement/chapitre', params: { cours, nom } })}
      />
    </GroupeColle>
  );
}

const styles = StyleSheet.create({
  compteurs: { flexDirection: 'row', gap: espace[2], marginTop: espace[1] },
});
