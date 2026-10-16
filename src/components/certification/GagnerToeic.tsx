import { router } from 'expo-router';
import { Check, NotebookPen, RotateCcw, Target } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import { lireGains, reclamerGain } from '@/services/certification/gains';
import { lireProfil } from '@/services/profil';
import type { CodeGain, EtatGains, GainListe, ResultatGain } from '@/services/certification/types';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix, PastilleEtat, Squelette } from './ui';
import { useChargement } from './useChargement';

const ICONES = { session_done: Check, streak_7: RotateCcw, goal_reached: Target, mini_first: NotebookPen } as const;
const CLES = { session_done: 'sessionDone', streak_7: 'streak', goal_reached: 'goal', mini_first: 'mini' } as const;

type Charge = { exam: string; gains: EtatGains; validiteJours: number };
const charger = async (): Promise<Charge> => {
  const exam = (await lireProfil())?.exam ?? 'toeic';
  const [gains, r] = await Promise.all([lireGains(exam), obtenirReglages()]);
  return { exam, gains, validiteJours: r.gainsValiditeJours };
};

/**
 * G1 · Gagner des crédits en TOEIC : quatre gains liés à l'apprentissage, plafonnés par semaine. Le serveur décide de tout
 * (éligibilité, plafond, une fois par jour ou par compte) : l'écran affiche et réclame, il ne calcule aucun montant.
 */
export function GagnerToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { rafraichir } = useCredits();
  const { etat, recharger } = useChargement(charger);
  const [message, setMessage] = useState<{ ton: 'succes' | 'info' | 'alerte'; texte: string } | null>(null);
  const [occupe, setOccupe] = useState<CodeGain | null>(null);

  const reclamer = useCallback(
    async (exam: string, code: CodeGain) => {
      setOccupe(code);
      try {
        const r: ResultatGain = await reclamerGain(code, exam);
        suivre('cert_earn_claimed', { code, statut: r.status });
        if (r.status === 'granted') {
          setMessage({ ton: 'succes', texte: t('certification.gagner.obtenu', { n: r.montant ?? 0 }) });
          void rafraichir();
        } else if (r.status === 'already') setMessage({ ton: 'info', texte: t('certification.gagner.dejaObtenu') });
        else if (r.status === 'cap_reached') setMessage({ ton: 'alerte', texte: t('certification.gagner.plafondAtteint') });
        else if (r.status === 'account_required') setMessage({ ton: 'info', texte: t('certification.gagner.compte') });
        else setMessage({ ton: 'info', texte: t('certification.gagner.pasEncore') });
        recharger();
      } catch {
        setMessage({ ton: 'alerte', texte: t('certification.gagner.erreurTexte') });
      } finally {
        setOccupe(null);
      }
    },
    [recharger, rafraichir, t],
  );

  return (
    <Ecran entete={<EnteteToeic titre={t('certification.gagner.entete')} onRetour={() => router.back()} />}>
      {etat.phase === 'chargement' ? <Squelette lignes={4} /> : null}
      {etat.phase === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.gagner.erreurTitre')} texte={t('certification.gagner.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={recharger} />
        </View>
      ) : null}
      {etat.phase === 'ok' ? (
        <>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.gagner.intro', { plafond: etat.valeur.gains.plafond })}</Text>
          {message ? <Banniere ton={message.ton} titre={message.texte} /> : null}
          {etat.valeur.gains.gains.map((g) => (
            <LigneGain key={g.code} gain={g} occupe={occupe === g.code} onReclamer={() => void reclamer(etat.valeur.exam, g.code)} />
          ))}
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>
            {t('certification.gagner.plafondLigne', { g: etat.valeur.gains.gagneSemaine, p: etat.valeur.gains.plafond })}
          </Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.gagner.expire', { n: etat.valeur.validiteJours })}</Text>
          <Bouton variante="secondaire" libelle={t('certification.gagner.retour')} onPress={() => router.replace('/')} />
        </>
      ) : null}
    </Ecran>
  );
}

function LigneGain({ gain, occupe, onReclamer }: { gain: GainListe; occupe: boolean; onReclamer: () => void }) {
  const { t } = useTraduction();
  const cle = CLES[gain.code];
  const n = gain.montant;
  const aide =
    gain.code === 'session_done'
      ? t('certification.gagner.sessionDoneAide', { n, p: gain.progression ?? 0, c: gain.cible ?? 7 })
      : gain.code === 'streak_7'
        ? t('certification.gagner.streakAide', { n, p: gain.progression ?? 0, c: gain.cible ?? 7 })
        : gain.code === 'goal_reached'
          ? t('certification.gagner.goalAide', { n })
          : t('certification.gagner.miniAide', { n });
  const atteint = gain.code !== 'streak_7' || (gain.progression ?? 0) >= (gain.cible ?? Infinity);
  return (
    <LigneChoix
      icone={ICONES[gain.code]}
      titre={t(`certification.gagner.${cle}`)}
      aide={aide}
      droite={
        gain.deja ? (
          <PastilleEtat etat="acquise" libelle={t('certification.gagner.fait')} />
        ) : (
          <Bouton petit variante="secondaire" libelle={t('certification.gagner.reclamer')} desactive={occupe || !atteint} onPress={onReclamer} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
