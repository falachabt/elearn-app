import { documentsDuPassage } from '../QuestionExercice';

describe('documents du passage d\'un groupe', () => {
  it('la partie 7 garde sa liste de documents', () => {
    const docs = [{ kind: 'Newsletter', text: 'Texte un.' }, { kind: 'Email', text: 'Texte deux.' }];
    expect(documentsDuPassage({ docs, multi: true })).toEqual(docs);
  });

  it('la partie 6 sert son texte à trous à plat : il devient un document unique (sans lui la question n\'a plus son passage)', () => {
    const passage = { head: null, kind: 'Newsletter', text: 'Dear colleagues,\n\nThe team {1} a new course.', first: null } as unknown as Parameters<typeof documentsDuPassage>[0];
    expect(documentsDuPassage(passage)).toEqual([{ kind: 'Newsletter', head: null, text: 'Dear colleagues,\n\nThe team {1} a new course.' }]);
  });

  it('pas de passage : aucun document', () => {
    expect(documentsDuPassage(null)).toEqual([]);
    expect(documentsDuPassage(undefined)).toEqual([]);
  });
});
