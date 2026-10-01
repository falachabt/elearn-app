import { memo, useEffect, useState } from 'react';

type Props<T> = {
  items: readonly T[];
  /** Éléments montrés au premier rendu : le reste suit, par paquets, pour ne pas bloquer l'interface. */
  initial?: number;
  pas?: number;
  rendu: (item: T, index: number) => React.ReactNode;
};

// Un élément déjà dessiné ne l'est pas à nouveau quand le paquet suivant arrive (le parent, lui, le redessine en entier).
const Ligne = memo(
  function Ligne<T>({ item, index, rendu }: { item: T; index: number; rendu: Props<T>['rendu'] }) {
    return <>{rendu(item, index)}</>;
  },
  (a, b) => a.item === b.item && a.index === b.index && a.rendu === b.rendu,
) as <T>(p: { item: T; index: number; rendu: Props<T>['rendu'] }) => React.ReactElement;

/**
 * Longue liste non virtualisée (cartes dans un défilement d'écran) : les premiers éléments tout de suite, les suivants
 * à chaque image libre. Un changement d'onglet ou un appui n'attend plus que toute la liste soit dessinée.
 */
export function Progressive<T>({ items, initial = 8, pas = 8, rendu }: Props<T>) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    if (n >= items.length) return;
    const minuterie = setTimeout(() => setN((x) => x + pas), 16);
    return () => clearTimeout(minuterie);
  }, [n, items.length, pas]);
  return (
    <>
      {items.slice(0, n).map((item, i) => (
        <Ligne key={i} item={item} index={i} rendu={rendu} />
      ))}
    </>
  );
}
