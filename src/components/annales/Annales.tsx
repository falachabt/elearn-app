import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { concoursDuCatalogue, lireCatalogue, lireDossiers, type Concours, type Dossier } from '@/services/annales';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { LigneLien } from '../LigneLien';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; dossiers: Dossier[]; concours: Concours[] };

/**
 * D3 · Annales (M6-01, v1.4) : rangées en dossiers. Un élève du secondaire voit d'abord les dossiers de sa classe,
 * puis les concours ; un candidat aux concours voit les concours. Chaque concours ouvre ses sujets.
 */
export function Annales() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void (async () => {
      const client = getSupabase();
      const profil = await lireProfil();
      const eleve = profil?.type !== 'concours';
      const [dossiers, sujets] = await Promise.all([
        eleve ? lireDossiers(client, { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM' }).catch(() => []) : Promise.resolve([]),
        lireCatalogue(client).catch(() => null),
      ]);
      if (!actif) return;
      if (!sujets && !dossiers.length) return setEtat({ statut: 'erreur' });
      setEtat({ statut: 'pret', dossiers, concours: concoursDuCatalogue(sujets ?? []) });
    })();
    return () => {
      actif = false;
    };
  }, [pret]);

  if (etat.statut === 'chargement') return <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('annales.chargement')}</Text>;
  if (etat.statut === 'erreur') return <Banniere ton="erreur" titre={t('annales.erreur')} />;

  return (
    <View style={styles.groupe}>
      {etat.dossiers.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('annales.maClasse')}</Text>
          {etat.dossiers.map((d) => (
            <LigneLien
              key={d.id}
              icone="folder-outline"
              titre={d.nom}
              detail={t(d.documents > 1 ? 'annales.documents' : 'annales.document', { n: d.documents })}
              onPress={() => router.push({ pathname: '/annales/dossier', params: { id: d.id, nom: d.nom } })}
            />
          ))}
        </View>
      ) : null}
      {etat.concours.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('annales.concours')}</Text>
          {etat.concours.map((c) => (
            <LigneLien
              key={c.id}
              icone="trophy-outline"
              titre={c.sigle && c.sigle !== c.nom ? `${c.sigle} · ${c.nom}` : c.nom}
              detail={t(c.sujets > 1 ? 'annales.sujets' : 'annales.sujet', { n: c.sujets })}
              onPress={() => router.push({ pathname: '/annales/concours', params: { id: c.id, nom: c.sigle || c.nom } })}
            />
          ))}
        </View>
      ) : null}
      {!etat.dossiers.length && !etat.concours.length ? <Banniere ton="info" titre={t('annales.vide')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[6] },
  section: { gap: espace[4] },
});
