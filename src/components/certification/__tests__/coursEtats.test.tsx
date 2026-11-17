import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { fr } from '@/i18n/fr';
import { etatContenu, maitriseDeLaFamille, notionPourContinuer, quizLies } from '@/services/certification/etatsContenu';
import type { FamilleNotion, NotionListee } from '@/services/certification/types';

import { ContinuerCours, CoursNotions } from '../CoursNotions';
import { monter } from './harnais';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) } }));

const notion = (id: string, titre: string, p: Partial<NotionListee> = {}): NotionListee => ({
  id, code: id, titre, famille: 'grammaire', parties: [5], dureeMin: 3, fiche: true, reponses: 0, reussies: 0, etat: 'pas_commencee', derniereOuverture: null, ...p,
});

const NOTIONS: NotionListee[] = [
  notion('n1', 'Présent continu', { derniereOuverture: '2026-10-01', reponses: 4, reussies: 4, etat: 'acquise' }),
  notion('n2', 'Voix passive', { derniereOuverture: '2026-10-02', reponses: 4, reussies: 2, etat: 'en_progres' }),
  notion('n3', 'Mots interrogatifs', { derniereOuverture: '2026-10-03' }),
  notion('n4', 'Questions tag'),
  notion('n5', 'Futur proche', { derniereOuverture: '2026-10-04', reponses: 5, reussies: 1, etat: 'fragile' }),
];

describe('Cours · états de maîtrise (V34-TUILE-ETATS)', () => {
  it('calcule les cinq états à partir des données servies', () => {
    expect(NOTIONS.map(etatContenu)).toEqual(['maitrise', 'valide', 'vu', 'non_vu', 'a_revoir']);
  });

  it('jauge de catégorie : part des notions validées ou maîtrisées', () => {
    expect(maitriseDeLaFamille(NOTIONS, 'grammaire')).toBe(40);
    expect(maitriseDeLaFamille(NOTIONS, 'piege')).toBe(0);
  });

  it('« Continuer » vise d’abord ce qui est à revoir, puis vu, puis non vu', () => {
    expect(notionPourContinuer(NOTIONS, 'grammaire')?.id).toBe('n5');
    expect(notionPourContinuer(NOTIONS.filter((n) => n.id !== 'n5'), 'grammaire')?.id).toBe('n3');
    expect(notionPourContinuer([], 'grammaire')).toBeNull();
  });

  it('quiz liés : null sans réponse, sinon réussies sur données', () => {
    expect(quizLies(NOTIONS[3]!)).toBeNull();
    expect(quizLies(NOTIONS[1]!)).toEqual({ reussis: 2, total: 4 });
  });
});

function Cours({ notions }: { notions: NotionListee[] }) {
  const [famille, setFamille] = useState<FamilleNotion>('grammaire');
  return (
    <>
      <CoursNotions notions={notions} famille={famille} onFamille={setFamille} />
      <ContinuerCours notions={notions} famille={famille} />
    </>
  );
}

describe('Cours · grille', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['clair', 'sombre'] as const)('affiche jauge, cinq états lus sur la barre et bouton Continuer (%s)', async (theme) => {
    await monter(<Cours notions={NOTIONS} />, theme);
    const e = fr.certification.cours.etats;
    for (const mot of [e.non_vu, e.vu, e.valide, e.maitrise, e.a_revoir]) expect(screen.getAllByLabelText(new RegExp(`\\. ${mot}$`)).length).toBeGreaterThan(0);
    expect(screen.getByText(fr.certification.cours.maitriseCategorie)).toBeTruthy();
    expect(screen.getByText(fr.certification.cours.maitrisePourcent.replace('{{n}}', '40'))).toBeTruthy();
    // Plus de fraction « Quiz liés » ni de pastille d’état : une carte par cours, l’état est dit aux lecteurs d’écran.
    expect(screen.queryByText(fr.certification.cours.quizLies.replace('{{r}}', '2').replace('{{n}}', '4'))).toBeNull();
    await fireEvent.press(screen.getByText(fr.certification.cours.continuer.replace('{{categorie}}', fr.certification.cours.familles.grammaire)));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n5', source: 'continuer' } });
  });
});
