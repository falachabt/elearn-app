import { recaser, titreExercice, titreQuiz } from '../titres';

describe('titres (revue design, règle 6)', () => {
  const thermo = 'Thermodynamique pour concours polytechnique L3';
  it.each([
    ['Thermodynamique pour concours polytechnique L3 - Quiz 3/3', thermo, { corps: '', numero: 3 }],
    ['Quiz 1/3: Radioactivité et nucléaire - Concours Polytechnique L3', 'Radioactivite et nucleaire pour concours polytechnique L3', { corps: '', numero: 1 }],
    ['Quiz 2/3: Circuits et bilans énergétiques', 'Electrostatique', { corps: 'Circuits et bilans énergétiques', numero: 2 }],
    ['Mécanique classique - Quiz 2/3', 'Mecanique classique pour concours polytechnique L3', { corps: '', numero: 2 }],
    ['Quiz 3/3 - Logique et théorie des ensembles - Approfondissement des démonstrations', 'Logique et theorie des ensembles pour concours polytechnique L3', { corps: 'Approfondissement des démonstrations', numero: 3 }],
    ['10mouvement dans un champ', 'Mouvement dans un champ', { corps: '', numero: 10 }],
    ['Module 2', 'Optique', { corps: 'Module 2', numero: undefined }],
    ['Quiz', 'Actions mécaniques', { corps: '', numero: undefined }],
  ])('quiz « %s »', (nom, chapitre, attendu) => {
    expect(titreQuiz(nom, chapitre)).toEqual(attendu);
  });

  it('garde le numéro connu quand le nom n’en a pas', () => {
    expect(titreQuiz('Optique', 'Optique', 4)).toEqual({ corps: '', numero: 4 });
  });

  it('exercices : titre seul, majuscule en tête, vide si tout répète le chapitre', () => {
    expect(titreExercice('son émis par un diapason', 'Chapitre 16 : Ondes mécaniques')).toBe('Son émis par un diapason');
    expect(titreExercice('Racines carrées', 'Racines carrées')).toBe('');
    expect(titreExercice('Cas pratique - Test médical', 'Probabilités')).toBe('Cas pratique · Test médical');
  });

  it('recase les titres saisis en capitales', () => {
    expect(recaser('sequence 6 COLLEGE PRIVE LAïC MONGO BETI')).toBe('Séquence 6 · Collège privé laïc Mongo Beti');
    expect(recaser('Analyse de texte')).toBe('Analyse de texte');
    expect(recaser('EPREUVE DE MATHEMATIQUES BEPC 2024')).toBe('Épreuve de mathématiques BEPC 2024');
  });
});
