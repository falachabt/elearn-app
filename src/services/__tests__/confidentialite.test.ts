import { assainir, estCleInterdite, masquer } from '../confidentialite';

describe('confidentialité des évènements', () => {
  it('masque e-mails, numéros de téléphone et jetons dans un texte', () => {
    expect(masquer('contact marie.k@exemple.com demain')).toBe('contact [email] demain');
    expect(masquer('appel au +237 612 345 678 ok')).toBe('appel au [numero] ok');
    expect(masquer('numéro 612345678.')).toContain('[numero]');
    expect(masquer('jeton eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij1234567890 fin')).toBe('jeton [jeton] fin');
  });

  it('laisse intacts les identifiants et les montants', () => {
    expect(masquer('commande 3f2a9c1e-5b7d-4c8e-9a10-123456789012')).toBe('commande 3f2a9c1e-5b7d-4c8e-9a10-123456789012');
    expect(masquer('montant 2500 FCFA, score 4/5')).toBe('montant 2500 FCFA, score 4/5');
  });

  it('retire les propriétés sensibles, même imbriquées, et garde le reste', () => {
    const propre = assainir({
      score: 4,
      email: 'a@b.cd',
      Mot_De_Passe: 'secret',
      telephone: '+237612345678',
      question: 'Quelle est la dérivée de x² ?',
      texte: 'contenu de la question',
      contenu: 'x',
      imbrique: { jeton: 'abc', ok: true, reponse: '42' },
      liste: [{ phone: '1' }, { valeur: 3 }],
    });
    expect(propre).toEqual({ score: 4, imbrique: { ok: true }, liste: [{}, { valeur: 3 }] });
  });

  it('masque les données personnelles dans les textes imbriqués et tronque les textes longs', () => {
    const propre = assainir({ message: `Échec pour a@b.cd ${'x'.repeat(500)}`, nested: { note: 'tel +33 6 12 34 56 78' } });
    expect(propre.message).not.toContain('a@b.cd');
    expect(propre.message.length).toBeLessThanOrEqual(300);
    expect(propre.nested.note).toBe('tel [numero]');
  });

  it('garde la forme des champs d’exception de PostHog ($…)', () => {
    const propre = assainir({ $exception_list: [{ type: 'Error', value: 'boom pour a@b.cd', stacktrace: { frames: [{ filename: 'x.js' }] } }] });
    expect(propre.$exception_list[0].value).toBe('boom pour [email]');
    expect(propre.$exception_list[0].stacktrace.frames[0].filename).toBe('x.js');
  });

  it('reconnaît les clés interdites sans tenir compte de la casse ni des séparateurs', () => {
    expect(estCleInterdite('E-Mail')).toBe(true);
    expect(estCleInterdite('mot_de_passe')).toBe(true);
    expect(estCleInterdite('score')).toBe(false);
    expect(estCleInterdite('bouton')).toBe(false);
  });
});
