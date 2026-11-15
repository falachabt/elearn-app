import { useEffect, useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { proposerSuggestion } from '@/services/concours';
import { getSupabase } from '@/services/supabase';

import { Banniere } from '../Banniere';
import { Champ } from '../Champ';
import { Feuille } from '../Feuille';

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  /** Ce que l'élève propose : un concours (avec sa ville) ou une certification. */
  genre: 'concours' | 'certification';
  /** Code ISO du pays de l'élève : chaque demande est comptée par concours ou certification et par pays. */
  pays: string;
  /** Nom du pays, dit dans la feuille. */
  nomPays: string;
};

/**
 * Feuille « Proposer un concours » ou « Proposer une certification » (retour de Benny du 15 novembre 2026) : l'élève saisit
 * ce qu'il souhaite passer. La demande est enregistrée avec son pays et comptée côté serveur pour décider de ce qu'on ouvre
 * en premier. Une feuille du bas, jamais un écran de plus ; la confirmation remplace le formulaire.
 */
export function FeuilleProposition({ ouverte, onFermer, genre, pays, nomPays }: Props) {
  const { t } = useTraduction();
  const [libelle, setLibelle] = useState('');
  const [ville, setVille] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [etat, setEtat] = useState<'saisie' | 'envoyee' | 'erreur'>('saisie');

  useEffect(() => {
    if (ouverte) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEtat('saisie');
    }
  }, [ouverte]);

  const envoyer = async () => {
    if (envoi || libelle.trim().length < 2) return;
    setEnvoi(true);
    try {
      const res = await proposerSuggestion(getSupabase(), { genre, libelle, pays, ville: genre === 'concours' ? ville : undefined });
      if (res === 'ok') {
        suivre('suggestion_sent', { genre, pays });
        setLibelle('');
        setVille('');
        setEtat('envoyee');
      } else setEtat('erreur');
    } catch {
      setEtat('erreur');
    } finally {
      setEnvoi(false);
    }
  };

  if (etat === 'envoyee') {
    return (
      <Feuille
        ouverte={ouverte}
        onFermer={onFermer}
        titre={t('proposition.merciTitre')}
        texte={t(`proposition.merciTexte_${genre}`)}
        actions={[{ libelle: t('proposition.compris'), onPress: onFermer }]}
      />
    );
  }
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      titre={t(`proposition.titre_${genre}`)}
      texte={t(`proposition.texte_${genre}`)}
      mention={t('proposition.pays', { pays: nomPays })}
      actions={[
        { libelle: t('proposition.envoyer'), onPress: () => void envoyer() },
        { libelle: t('proposition.plusTard'), onPress: onFermer, variante: 'texte' },
      ]}
    >
      <Champ libelle={t(`proposition.champ_${genre}`)} value={libelle} onChangeText={setLibelle} autoCorrect={false} maxLength={120} />
      {genre === 'concours' ? <Champ libelle={t('proposition.ville')} value={ville} onChangeText={setVille} autoCorrect={false} maxLength={80} /> : null}
      {etat === 'erreur' ? <Banniere ton="erreur" titre={t('proposition.erreur')} /> : null}
    </Feuille>
  );
}
