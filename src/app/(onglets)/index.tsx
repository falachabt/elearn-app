import { AccueilToeic } from '@/components/certification/AccueilToeic';
import { useProfilToeic } from '@/components/certification/useProfilToeic';
import { Accueil } from '@/components/mission/Accueil';

export default function EcranAccueil() {
  const toeic = useProfilToeic();
  if (toeic === null) return null;
  return toeic ? <AccueilToeic /> : <Accueil />;
}
