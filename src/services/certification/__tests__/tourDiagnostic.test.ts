import AsyncStorage from '@react-native-async-storage/async-storage';

import { marquerTourDiagnosticVu, tourDiagnosticDejaVu } from '../tourDiagnostic';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('#123 · tourDiagnostic : drapeaux de première fois', () => {
  it('aucun moment n’est vu par défaut', async () => {
    expect(await tourDiagnosticDejaVu('audio')).toBe(false);
    expect(await tourDiagnosticDejaVu('partie7')).toBe(false);
  });

  it('le marquage pose « 1 » sous la clé du moment, et les deux moments sont indépendants', async () => {
    await marquerTourDiagnosticVu('audio');
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.audio.vue')).toBe('1');
    expect(await tourDiagnosticDejaVu('audio')).toBe(true);
    expect(await tourDiagnosticDejaVu('partie7')).toBe(false);
    await marquerTourDiagnosticVu('partie7');
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.partie7.vue')).toBe('1');
    expect(await tourDiagnosticDejaVu('partie7')).toBe(true);
  });

  it('une lecture qui échoue compte comme « déjà vu » : jamais bloquant', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('panne'));
    expect(await tourDiagnosticDejaVu('audio')).toBe(true);
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('panne'));
    expect(await tourDiagnosticDejaVu('partie7')).toBe(true);
  });

  it('une écriture qui échoue ne lève pas (le tour peut se représenter, sans casser l’écran)', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('panne'));
    await expect(marquerTourDiagnosticVu('audio')).resolves.toBeUndefined();
  });
});
