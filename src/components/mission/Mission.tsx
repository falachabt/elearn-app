import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { chargerMission, terminerMission, type Mission as MissionDuJour } from '@/services/mission';
import { lireRythme } from '@/services/rythme';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSession, useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Ecran } from '../Ecran';
import { MiniTest } from '../arrivee/MiniTest';

const accueil = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** C2 · Mission du jour (M4-01) : même lecteur que le mini-test, questions tirées des quiz de la classe. */
export function Mission() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [mission, setMission] = useState<MissionDuJour | null>(null);
  const [niveau, setNiveau] = useState('3e');
  const pret = useSessionPrete();
  const { session } = useSession();
  const userId = session?.user?.id;
  const termineRef = useRef(false);

  useEffect(() => {
    if (!pret || mission) return;
    let actif = true;
    void (async () => {
      const profil = await lireProfil();
      const n = profil?.niveau ?? '3e';
      const m = await chargerMission(getSupabase(), {
        niveau: n,
        pays: profil?.pays ?? 'CM',
        vraiFaux: { vrai: t('mission.vrai'), faux: t('mission.faux') },
        taille: (await lireRythme()) ?? undefined,
        concours: profil?.type === 'concours' ? profil.concours?.id : null,
        ...(profil?.type === 'eleve' && profil.serie?.id ? { serie: profil.serie.id } : {}),
      });
      if (!actif) return;
      setNiveau(n);
      setMission(m);
      suivre('mission_started', { source: m.source, total: m.questions.length });
    })();
    return () => {
      actif = false;
    };
    // Les libellés Vrai/Faux sont figés au tirage : pas de nouveau tirage si la langue change pendant la mission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  if (!mission) {
    return (
      <Ecran>
        <View style={styles.centre}>
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('mission.chargement')}</Text>
        </View>
      </Ecran>
    );
  }

  return (
    <MiniTest
      questions={mission.questions}
      libelleFin={t('mission.terminer')}
      libelleFermer={t('mission.fermer')}
      onFermer={accueil}
      onTermine={async ({ questions, reponses, dureeS }) => {
        if (termineRef.current) return;
        termineRef.current = true;
        await terminerMission(getSupabase(), { questions, reponses, niveau, dureeS, jour: mission.jour, userId });
        router.replace('/mission/terminee');
      }}
    />
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
});
