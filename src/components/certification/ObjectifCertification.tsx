import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { jourDe } from '@/services/certification/jours';
import { ecrirePlan, lirePlan, obtenirExamens, obtenirReglages } from '@/services/certification/etat';
import { afficherJour, analyserDateSaisie, analyserObjectif } from '@/services/certification/format';
import type { Reglages } from '@/services/certification/reglages';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { Curseur } from './Curseur';
import { EnteteToeic } from './ui';

/** A3 · Objectif : score visé (paliers, champ, curseur) et date du test, facultative. */
export function ObjectifCertification() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [exam, setExam] = useState('toeic');
  const [nomExamen, setNomExamen] = useState('TOEIC');
  const [paliers, setPaliers] = useState<number[]>([]);
  const [r, setR] = useState<Reglages | null>(null);
  const [texte, setTexte] = useState('');
  const [dateTexte, setDateTexte] = useState('');
  const [dateOuverte, setDateOuverte] = useState(false);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const [p, plan, reglages, liste] = await Promise.all([lireProfil(), lirePlan(), obtenirReglages().catch(() => null), obtenirExamens().catch(() => null)]);
      if (!actif) return;
      const code = p?.exam ?? 'toeic';
      setExam(code);
      const ex = liste?.examens.find((e) => e.code === code);
      if (ex) {
        setNomExamen(ex.name.split(' ')[0] ?? ex.name);
        setPaliers(ex.goal_steps);
      }
      if (reglages) {
        setR(reglages);
        setTexte(String(plan?.exam === code && plan.objectif ? plan.objectif : reglages.objectifDefaut));
      }
      if (plan?.exam === code && plan.dateTest) {
        setDateTexte(afficherJour(plan.dateTest));
        setDateOuverte(true);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const valeur = r ? analyserObjectif(texte, r.objectifMin, r.objectifMax) : null;
  const aujourdhui = useMemo(() => jourDe(new Date()), []);
  const date = analyserDateSaisie(dateTexte, aujourdhui);
  const erreurValeur = r && texte !== '' && valeur === null ? t('certification.objectif.erreurBornes', { min: r.objectifMin, max: r.objectifMax }) : undefined;
  const erreurDate = !date.ok ? t(date.erreur === 'passe' ? 'certification.objectif.erreurDate' : 'certification.objectif.erreurDateFormat') : undefined;
  const valide = valeur !== null && date.ok;

  const continuer = async () => {
    if (valeur === null || !date.ok) return;
    await ecrirePlan({ exam, objectif: valeur, ...(date.jour ? { dateTest: date.jour } : {}) }, { effacerDate: !date.jour });
    suivre('cert_goal_set', { score: valeur, date_renseignee: !!date.jour });
    router.push('/certification/temps');
  };
  const passer = () => {
    suivre('cert_goal_skipped', {});
    router.push('/certification/temps');
  };

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.objectif.entete')} onRetour={() => router.back()} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.continuer')} desactive={!valide} onPress={continuer} retour />
          <Bouton variante="texte" libelle={t('certification.objectif.passer')} onPress={passer} />
        </View>
      }
    >
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.objectif.etape', { examen: nomExamen })}</Text>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.objectif.titre')}</Text>
      <View accessibilityRole="radiogroup" style={styles.paliers}>
        {paliers.map((p) => {
          const actif = valeur === p;
          return (
            <Appui key={p} accessibilityRole="radio" accessibilityState={{ checked: actif }} accessibilityLabel={String(p)} onPress={() => setTexte(String(p))} decalage={0} rayon={rayon.pilule} retour>
              <View style={[styles.palier, { backgroundColor: actif ? theme.texte.principal : theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.texteFort, { color: actif ? theme.texte.inverse : theme.texte.principal }]}>{p}</Text>
              </View>
            </Appui>
          );
        })}
      </View>
      {r ? (
        <>
          <Champ
            libelle={t('certification.objectif.valeur', { min: r.objectifMin, max: r.objectifMax })}
            value={texte}
            onChangeText={(v) => setTexte(v.replace(/[^0-9]/g, '').slice(0, 4))}
            keyboardType="number-pad"
            inputMode="numeric"
            erreur={erreurValeur}
            accessibilityLabel={t('certification.objectif.curseur')}
          />
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.objectif.sur', { max: r.objectifMax })}</Text>
          <Curseur
            libelle={t('certification.objectif.curseur')}
            valeur={valeur ?? r.objectifDefaut}
            min={r.objectifMin}
            max={r.objectifMax}
            onChange={(v) => setTexte(String(v))}
          />
        </>
      ) : null}
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.objectif.date')}</Text>
      {dateOuverte ? (
        <Champ
          libelle={t('certification.objectif.dateAide')}
          value={dateTexte}
          onChangeText={setDateTexte}
          placeholder="JJ/MM/AAAA"
          keyboardType="numbers-and-punctuation"
          erreur={erreurDate}
        />
      ) : (
        <Appui accessibilityRole="button" accessibilityLabel={`${t('certification.objectif.date')} : ${t('certification.objectif.datePasEncore')}`} onPress={() => setDateOuverte(true)} decalage={0} rayon={rayon.m}>
          <View style={[styles.champ, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('certification.objectif.datePasEncore')}</Text>
            <CalendarDays size={20} color={theme.texte.principal} strokeWidth={2} />
          </View>
        </Appui>
      )}
      {dateOuverte ? (
        <Bouton
          petit
          variante="texte"
          libelle={t('certification.objectif.effacerDate')}
          onPress={() => {
            setDateTexte('');
            setDateOuverte(false);
          }}
        />
      ) : null}
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.objectif.aide')}</Text>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[2] },
  paliers: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  palier: { minHeight: 48, minWidth: 64, paddingHorizontal: espace[5], alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.pilule },
  champ: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace[5], borderWidth: bord.normal, borderRadius: rayon.m },
});
