import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { BaremeXp } from '@/components/xp/BaremeXp';
import { ecouterGainXp, lireUserXp } from '@/services/xp';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';

export default function EcranReglesXp() {
  const params = useLocalSearchParams<{ totalXp?: string }>();
  const initial = params.totalXp ? parseInt(params.totalXp, 10) : 0;
  const [total, setTotal] = useState(initial);
  const { session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    let actif = true;
    void lireUserXp(getSupabase(), userId)
      .then((valeur) => {
        if (actif && valeur > 0) setTotal(valeur);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [userId]);

  useEffect(() => {
    return ecouterGainXp((info) => {
      setTotal(info.total);
    });
  }, []);

  return <BaremeXp totalXp={total} />;
}
