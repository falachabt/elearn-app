import { leconsAValiderParVideo } from '../progressionVideo';

const lecons = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

describe('leconsAValiderParVideo', () => {
  it('aucune vidéo terminée : rien n’est validé', () => {
    expect(leconsAValiderParVideo(lecons, {}, 0, 3)).toEqual([]);
  });
  it('la part de vidéos finies donne la part de leçons, dans l’ordre', () => {
    expect(leconsAValiderParVideo(lecons, {}, 1, 2)).toEqual([1, 2]);
    expect(leconsAValiderParVideo(lecons, {}, 1, 4)).toEqual([1]);
  });
  it('toutes les vidéos finies : toutes les leçons', () => {
    expect(leconsAValiderParVideo(lecons, {}, 3, 3)).toEqual([1, 2, 3, 4]);
  });
  it('ne revalide pas une leçon déjà lue', () => {
    expect(leconsAValiderParVideo(lecons, { '1': 9 }, 1, 2)).toEqual([2]);
  });
  it('sans leçon ou sans vidéo : rien', () => {
    expect(leconsAValiderParVideo([], {}, 1, 1)).toEqual([]);
    expect(leconsAValiderParVideo(lecons, {}, 1, 0)).toEqual([]);
  });
});
