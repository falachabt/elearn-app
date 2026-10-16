import { EcranMoi } from '@/components/EcranMoi';
import { MoiToeic } from '@/components/certification/MoiToeic';
import { useProfilToeic } from '@/components/certification/useProfilToeic';

export default function EcranMoiOnglet() {
  const toeic = useProfilToeic();
  if (toeic === null) return null;
  return toeic ? <MoiToeic /> : <EcranMoi />;
}
