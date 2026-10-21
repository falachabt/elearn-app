import { phraseSurlignee } from '../QuestionExercice';

describe('phraseSurlignee (B7) : phrase du document qui porte la bonne réponse', () => {
  const texte = 'Hollis Corporation hires new staff. Orientation starts at 9:00. Lunch is at noon.';

  it('retient la phrase qui contient le mot le plus long de la bonne réponse', () => {
    expect(phraseSurlignee(texte, 'Orientation schedule')).toBe(' Orientation starts at 9:00.');
  });

  it('retourne null quand aucune phrase ne contient un mot de la réponse', () => {
    expect(phraseSurlignee(texte, 'Parking')).toBeNull();
  });

  it('ignore les mots trop courts', () => {
    expect(phraseSurlignee(texte, 'at on')).toBeNull();
  });
});
