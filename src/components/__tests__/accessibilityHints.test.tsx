import { render, screen } from '@testing-library/react-native';

import { Bouton } from '@/components/Bouton';
import { OptionReponse } from '@/components/OptionReponse';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('Accessibilité mobile : accessibilityHint (B10-7)', () => {
  it('Bouton transmet son accessibilityHint au composant sous-jacent', async () => {
    await render(
      <ThemeProvider>
        <Bouton
          libelle="Tester"
          accessibilityHint="Déclenche l'action de test."
          onPress={() => {}}
        />
      </ThemeProvider>
    );

    const bouton = screen.getByRole('button', { name: 'Tester' });
    expect(bouton.props.accessibilityHint).toBe("Déclenche l'action de test.");
  });

  it('OptionReponse fournit un hint non sélectionné en état neutre', async () => {
    await render(
      <ThemeProvider>
        <OptionReponse lettre="A" texte="Réponse 1" etat="neutre" onPress={() => {}} />
      </ThemeProvider>
    );

    const optionNeutre = screen.getByRole('button', { name: 'Réponse 1' });
    expect(optionNeutre.props.accessibilityHint).toBe('Touchez deux fois pour choisir cette réponse.');
  });

  it('OptionReponse fournit un hint sélectionné en état choisie', async () => {
    await render(
      <ThemeProvider>
        <OptionReponse lettre="A" texte="Réponse 1" etat="choisie" onPress={() => {}} />
      </ThemeProvider>
    );

    const optionChoisie = screen.getByRole('button', { name: 'Réponse 1' });
    expect(optionChoisie.props.accessibilityHint).toBe('Réponse sélectionnée. Touchez deux fois pour confirmer ou modifier.');
  });
});
