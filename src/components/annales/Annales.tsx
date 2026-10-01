import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { concoursDuCatalogue, lireCatalogue, lireDossiers, type Concours, type Dossier, type Sujet } from '@/services/annales';
import { lireDocuments } from '@/services/documents';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { LigneLien } from '../LigneLien';
import { ListeSujets } from './ListeSujets';

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  | { statut: 'pret'; dossiers: Dossier[]; mien: Concours[]; autres: Concours[]; eleve: boolean }
  | { statut: 'concours'; concours: Concours | null; sujets: Sujet[] };

/**
 * D3 · Annales (M6-01, v1.8) : l'élève voit les dossiers de sa classe, les concours étant rangés dans « Autres
 * concours ». Le candidat qui a choisi son concours voit directement ses sujets, filtrables par année, et rien d'autre.
 * `tous` : la liste complète des concours.
 */
export function Annales({ tous = false }: { tous?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [gardes, setGardes] = useState(0);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void lireDocuments().then((d) => actif && setGardes(d.length));
    void (async () => {
      const client = getSupabase();
      const profil = await lireProfil();
      const eleve = profil?.type !== 'concours';
      const [dossiers, sujets] = await Promise.all([
        eleve && !tous ? lireDossiers(client, { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM' }).catch(() => []) : Promise.resolve([]),
        lireCatalogue(client).catch(() => null),
      ]);
      if (!actif) return;
      if (!sujets && !dossiers.length) return setEtat({ statut: 'erreur' });
      const concours = concoursDuCatalogue(sujets ?? []);
      const monId = profil?.type === 'concours' ? profil.concours?.id : undefined;
      if (monId && !tous) {
        return setEtat({ statut: 'concours', concours: concours.find((c) => c.id === monId) ?? null, sujets: (sujets ?? []).filter((x) => x.concoursId === monId) });
      }
      // Sans concours choisi, un candidat voit tous les concours, comme avant le choix.
      const mien = tous ? [] : eleve ? [] : monId ? concours.filter((c) => c.id === monId) : concours;
      const autres = tous ? concours : concours.filter((c) => !mien.includes(c));
      setEtat({ statut: 'pret', dossiers, mien, autres, eleve });
    })();
    return () => {
      actif = false;
    };
  }, [pret, tous]);

  // Documents gardés sur le téléphone : en tête, accessibles même hors ligne.
  const mesDocuments =
    gardes && !tous ? (
      <LigneLien icone="download-outline" titre={t('document.mesDocuments')} detail={t('document.mesDocumentsDetail', { n: gardes })} onPress={() => router.push('/documents')} />
    ) : null;
  if (etat.statut === 'chargement') return <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('annales.chargement')}</Text>;
  if (etat.statut === 'erreur') {
    return (
      <View style={styles.section}>
        {mesDocuments}
        <Banniere ton="erreur" titre={t('annales.erreur')} />
      </View>
    );
  }
  if (etat.statut === 'concours') {
    return (
      <View style={styles.section}>
        {mesDocuments}
        {etat.concours ? (
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
            {etat.concours.sigle && etat.concours.sigle !== etat.concours.nom ? `${etat.concours.sigle} · ${etat.concours.nom}` : etat.concours.nom}
          </Text>
        ) : null}
        {etat.sujets.length ? <ListeSujets sujets={etat.sujets} /> : <Banniere ton="info" titre={t('annales.vide')} />}
      </View>
    );
  }

  return (
    <View style={styles.groupe}>
      {mesDocuments}
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
      {etat.mien.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t(etat.mien.length > 1 ? 'annales.concours' : 'annales.monConcours')}</Text>
          {etat.mien.map((c) => (
            <LigneConcours key={c.id} c={c} />
          ))}
        </View>
      ) : null}
      {tous ? (
        etat.autres.map((c) => <LigneConcours key={c.id} c={c} />)
      ) : etat.autres.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('annales.autres')}</Text>
          <LigneLien
            icone="folder-outline"
            titre={t('annales.autresConcours')}
            detail={t(etat.autres.length > 1 ? 'concours.nombre' : 'concours.nombre1', { n: etat.autres.length })}
            onPress={() => router.push('/annales/autres')}
          />
        </View>
      ) : null}
      {!etat.dossiers.length && !etat.mien.length && !etat.autres.length ? <Banniere ton="info" titre={t('annales.vide')} /> : null}
    </View>
  );
}

function LigneConcours({ c }: { c: Concours }) {
  const { t } = useTraduction();
  return (
    <LigneLien
      icone="trophy-outline"
      titre={c.sigle && c.sigle !== c.nom ? `${c.sigle} · ${c.nom}` : c.nom}
      detail={t(c.sujets > 1 ? 'annales.sujets' : 'annales.sujet', { n: c.sujets })}
      onPress={() => router.push({ pathname: '/annales/concours', params: { id: c.id, nom: c.sigle || c.nom } })}
    />
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[6] },
  section: { gap: espace[4] },
});
