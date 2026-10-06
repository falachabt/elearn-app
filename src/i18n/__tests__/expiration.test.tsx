import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { fr } from '../fr';
import { useTraduction } from '../useTraduction';

let mockValide = true;
jest.mock('@/services/connectivite', () => ({
  contenuHorsLigneValide: jest.fn(async () => mockValide),
  ecouterConnectivite: jest.fn(() => () => {}),
  ecouterSimulation: jest.fn(() => () => {}),
}));

import { actualiserExpiration } from '@/services/expiration';

function Messages() {
  const { t } = useTraduction();
  return (
    <>
      <Text testID="cours">{t('reviser.erreur')}</Text>
      <Text testID="annales">{t('annales.erreur')}</Text>
      <Text testID="autre">{t('questions.publierErreur')}</Text>
    </>
  );
}

describe('contenu hors ligne expiré : message unique à la place de « vérifie ta connexion »', () => {
  it('contenu valable : les messages d’origine', async () => {
    mockValide = true;
    await act(async () => { await actualiserExpiration(); });
    await render(<Messages />);
    expect(screen.getByTestId('cours').props.children).toBe(fr.reviser.erreur);
    expect(screen.getByTestId('annales').props.children).toBe(fr.annales.erreur);
  });

  it('contenu expiré : cours et annales annoncent l’expiration, les autres erreurs ne changent pas', async () => {
    mockValide = false;
    await render(<Messages />);
    await act(async () => { await actualiserExpiration(); });
    expect(screen.getByTestId('cours').props.children).toBe(fr.reseau.expireErreur);
    expect(screen.getByTestId('annales').props.children).toBe(fr.reseau.expireErreur);
    expect(screen.getByTestId('autre').props.children).toBe(fr.questions.publierErreur);
    expect(fr.reseau.expireErreur).toMatch(/expiré/);
    expect(fr.reseau.expireErreur).not.toMatch(/Vérifie ta connexion/);
  });

  it('retour du contenu valable : les messages d’origine reviennent', async () => {
    mockValide = false;
    await act(async () => { await actualiserExpiration(); });
    await render(<Messages />);
    mockValide = true;
    await act(async () => { await actualiserExpiration(); });
    expect(screen.getByTestId('cours').props.children).toBe(fr.reviser.erreur);
  });
});
