import { MOTIFS_SIGNALEMENT } from '@/services/questions';

describe('motifs de signalement', () => {
  it('chaque motif de la feuille correspond à un motif accepté par le serveur', () => {
    const serveur = ['inapproprie', 'harcelement', 'numero_personnel', 'hors_sujet', 'autre'];
    for (const m of MOTIFS_SIGNALEMENT) expect(serveur).toContain(m.motif);
    expect(MOTIFS_SIGNALEMENT).toHaveLength(3);
  });
});
