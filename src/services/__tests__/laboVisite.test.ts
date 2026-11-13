import AsyncStorage from '@react-native-async-storage/async-storage';

import { marquerVisiteLaboVue, visiteLaboDejaVue } from '../laboVisite';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('visite guidée du labo', () => {
  it('pas encore vue au départ, vue après marquage', async () => {
    await expect(visiteLaboDejaVue()).resolves.toBe(false);
    await marquerVisiteLaboVue();
    await expect(visiteLaboDejaVue()).resolves.toBe(true);
  });

  it('une autre valeur que « 1 » ne compte pas comme vue', async () => {
    await AsyncStorage.setItem('labo.chat.visite.vue', 'oui');
    await expect(visiteLaboDejaVue()).resolves.toBe(false);
  });
});
