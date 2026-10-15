import { router } from 'expo-router';
import { TriangleAlert, NotebookPen } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { formaterPlage, maitriseParGroupe, pointsFaibles, type LigneMaitrise, type PointFaible } from '@/services/certification/certDiagnostic';
import { lireDiagnostic, obtenirReglages } from '@/services/certification/etat';
import { enregistrerProfil, lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { BarreProgression, EnteteToeic, LigneChoix, PastilleEtat } from './ui';

type Donnees = { plage: string | null; lignes: LigneMaitrise[]; faibles: PointFaible[] };

/** A7 · Résultat du diagnostic : fourchette (jamais un score officiel), maîtrise par partie, trois points faibles. */
export function ResultatDiagnostic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [d, setD] = useState<Donnees | null>(null);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const [etat, r] = await Promise.all([lireDiagnostic(), obtenirReglages()]);
      if (!actif) return;
      if (!etat?.fin || !etat.tentative) {
        router.replace('/certification/fin');
        return;
      }
      const mots = await obtenirApi().motsARevoir().catch(() => ({ total: 0, theme: null }));
      const fin = etat.fin;
      const plage = fin.estimated ? formaterPlage(fin.score_min, fin.score_max) : null;
      if (!actif) return;
      setD({ plage, lignes: maitriseParGroupe(fin.per_part, r), faibles: pointsFaibles(etat.tentative.questions, fin.results, mots, r) });
      suivre('cert_diagnostic_completed', { score_min: fin.score_min, score_max: fin.score_max });
      suivre('cert_mastery_viewed', { ecran: 'resultat' });
    })();
    return () => {
      actif = false;
    };
  }, []);

  const voirPlan = async () => {
    // Le profil devient définitif ici : les onglets TOEIC s'ouvrent (lot Réviser / séance du jour).
    const p = await lireProfil();
    await enregistrerProfil({ type: 'certification', exam: p?.exam ?? 'toeic', pays: p?.pays, termine: true });
    router.replace('/');
  };

  return (
    <Ecran entete={<EnteteToeic titre={t('certification.resultat.entete')} />} pied={<Bouton libelle={t('certification.resultat.voirPlan')} desactive={!d} onPress={voirPlan} retour />}>
      {d ? (
        <>
          <Carte>
            <View style={styles.groupe}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.resultat.score')}</Text>
              <Text accessibilityRole="header" style={[typo.chiffreL, { color: theme.texte.principal }]}>{d.plage ?? t('certification.resultat.pasEstime')}</Text>
              <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.resultat.estimation')}</Text>
            </View>
          </Carte>
          <View style={[styles.maitrise, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.resultat.maitrise')}</Text>
            {d.lignes.map((l) => (
              <View key={l.id} style={styles.ligneMaitrise}>
                <Text style={[typo.donnee, styles.etiquetteLigne, { color: theme.texte.principal }]}>{t(`certification.resultat.groupes.${l.id}`)}</Text>
                <View style={styles.barre}>
                  <BarreProgression pourcent={(l.m ?? 0) * 100} hauteur={8} libelle={t(`certification.resultat.groupes.${l.id}`)} />
                </View>
                <PastilleEtat etat={l.etat} libelle={t(`certification.resultat.etats.${l.etat}`)} />
              </View>
            ))}
          </View>
          {d.faibles.length > 0 ? (
            <>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{d.faibles.length === 1 ? t('certification.resultat.aTravaillerUn') : t('certification.resultat.aTravailler', { n: d.faibles.length })}</Text>
              {d.faibles.map((f, i) =>
                f.genre === 'notion' ? (
                  <LigneChoix
                    key={f.notion.id}
                    icone={TriangleAlert}
                    titre={f.notion.title}
                    aide={t('certification.resultat.lignePartie', { n: f.partie, rates: f.ratees === 1 ? t('certification.resultat.ratesUn') : t('certification.resultat.rates', { n: f.ratees }) })}
                  />
                ) : (
                  <LigneChoix
                    key={`mots-${i}`}
                    icone={NotebookPen}
                    titre={f.theme === 'bureau' ? t('certification.resultat.motsDuBureau') : t('certification.resultat.vocabulaire')}
                    aide={`${t('certification.resultat.vocabulaire')} · ${f.mots === 1 ? t('certification.resultat.motsARevoirUn') : t('certification.resultat.motsARevoir', { n: f.mots })}`}
                  />
                ),
              )}
            </>
          ) : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[2] },
  maitrise: { gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: 14 },
  ligneMaitrise: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  etiquetteLigne: { width: 64 },
  barre: { flex: 1 },
});
