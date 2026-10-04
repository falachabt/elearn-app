import { render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { effacerDonneesLocales } from '../donneesLocales';
import { garderMemorise, lireMemorise, useEtatMemorise } from '../memoire';

type E = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; v: string };

const AUCUN: E[] = [];
const COURS: E[] = [{ statut: 'pret', v: 'cours' }];
const GARDE: E[] = [{ statut: 'pret', v: 'garde' }, { statut: 'erreur' }];
const UN: E[] = [{ statut: 'pret', v: 'un' }];

/** Écran de test : applique `envoyer` à son arrivée, comme un chargement qui aboutit. */
function Ecran({ cle, envoyer = AUCUN }: { cle: string; envoyer?: E[] }) {
  const [etat, setEtat] = useEtatMemorise<E>(cle, { statut: 'chargement' });
  useEffect(() => {
    envoyer.forEach(setEtat);
  }, [envoyer, setEtat]);
  return <Text>{etat.statut === 'pret' ? etat.v : etat.statut}</Text>;
}


describe('useEtatMemorise', () => {
  it('au retour sur l’écran, montre tout de suite le dernier contenu, sans chargement', async () => {
    const premiere = await render(<Ecran cle="a" />);
    expect(premiere.getByText('chargement')).toBeTruthy();
    await premiere.unmount();
    const arrivee = await render(<Ecran cle="a" envoyer={COURS} />);
    expect(arrivee.getByText('cours')).toBeTruthy();
    await arrivee.unmount();
    const retour = await render(<Ecran cle="a" />);
    expect(retour.getByText('cours')).toBeTruthy();
    expect(retour.queryByText('chargement')).toBeNull();
  });

  it('une erreur de rechargement ne remplace pas le contenu déjà affiché', async () => {
    const r = await render(<Ecran cle="b" envoyer={GARDE} />);
    expect(r.getByText('garde')).toBeTruthy();
  });

  it('un autre contenu repart du chargement', async () => {
    await render(<Ecran cle="c" envoyer={UN} />);
    const r = await render(<Ecran cle="d" />);
    expect(r.getByText('chargement')).toBeTruthy();
  });
});

describe('changement de compte', () => {
  it('effacerDonneesLocales vide aussi les contenus gardés en mémoire', async () => {
    garderMemorise('accueil.reprise', [1]);
    await effacerDonneesLocales();
    expect(lireMemorise('accueil.reprise', [])).toEqual([]);
  });
});
