import * as ImagePicker from 'expo-image-picker';

import { choisirPhotoLabo } from '../laboPhoto';
import { preparerImage } from '../photo';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../photo', () => ({ preparerImage: jest.fn() }));

const cam = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const bib = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const lanceCam = ImagePicker.launchCameraAsync as jest.Mock;
const lanceBib = ImagePicker.launchImageLibraryAsync as jest.Mock;
const prepare = preparerImage as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  cam.mockResolvedValue({ granted: true });
  bib.mockResolvedValue({ granted: true });
  prepare.mockResolvedValue({ uri: 'file:///preparee.jpg', base64: 'JPEG_BASE64' });
});

describe('choisirPhotoLabo', () => {
  it('caméra : permission accordée, photo prise → photo préparée (uri + base64)', async () => {
    lanceCam.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///brute.jpg', width: 1200, height: 900 }] });
    const issue = await choisirPhotoLabo('camera');
    expect(issue).toEqual({ type: 'photo', photo: { uri: 'file:///preparee.jpg', base64: 'JPEG_BASE64' } });
    expect(prepare).toHaveBeenCalledWith('file:///brute.jpg', { x: 0, y: 0, largeur: 1, hauteur: 1 }, 1200, 900);
  });

  it('galerie : la photo choisie est préparée de la même façon', async () => {
    lanceBib.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///galerie.png', width: 800, height: 600 }] });
    const issue = await choisirPhotoLabo('bibliotheque');
    expect(issue.type).toBe('photo');
    expect(bib).toHaveBeenCalled();
    expect(lanceBib).toHaveBeenCalled();
  });

  it('annulation du sélecteur : rien n’est attaché', async () => {
    lanceCam.mockResolvedValue({ canceled: true, assets: [] });
    await expect(choisirPhotoLabo('camera')).resolves.toEqual({ type: 'annule' });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('permission caméra refusée : issue « permission », le sélecteur ne s’ouvre pas', async () => {
    cam.mockResolvedValue({ granted: false });
    await expect(choisirPhotoLabo('camera')).resolves.toEqual({ type: 'permission' });
    expect(lanceCam).not.toHaveBeenCalled();
  });

  it('permission galerie refusée : issue « permission »', async () => {
    bib.mockResolvedValue({ granted: false });
    await expect(choisirPhotoLabo('bibliotheque')).resolves.toEqual({ type: 'permission' });
    expect(lanceBib).not.toHaveBeenCalled();
  });

  it('échec du sélecteur (exception) : issue « erreur », jamais d’exception qui remonte', async () => {
    lanceBib.mockRejectedValue(new Error('indisponible'));
    await expect(choisirPhotoLabo('bibliotheque')).resolves.toEqual({ type: 'erreur' });
  });

  it('résultat sans image exploitable : issue « erreur »', async () => {
    lanceCam.mockResolvedValue({ canceled: false, assets: [] });
    await expect(choisirPhotoLabo('camera')).resolves.toEqual({ type: 'erreur' });
  });
});
