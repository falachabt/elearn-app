import { useLocalSearchParams } from 'expo-router';
import { BaremeXp } from '@/components/xp/BaremeXp';

export default function EcranReglesXp() {
  const params = useLocalSearchParams<{ totalXp?: string }>();
  const total = params.totalXp ? parseInt(params.totalXp, 10) : 0;
  return <BaremeXp totalXp={total} />;
}
