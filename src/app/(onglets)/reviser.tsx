import { useProfilToeic } from '@/components/certification/useProfilToeic';
import { ReviserToeic } from '@/components/certification/ReviserToeic';
import { Reviser } from '@/components/reviser/Reviser';

export default function EcranReviser() {
  const toeic = useProfilToeic();
  if (toeic === null) return null;
  return toeic ? <ReviserToeic /> : <Reviser />;
}
