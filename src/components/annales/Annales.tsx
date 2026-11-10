import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { concoursDuCatalogue, correspond, lireCatalogue, lireDossiers, rechercherSujets, type Concours, type Dossier, type Sujet } from '@/services/annales';
import { lireDocuments } from '@/services/documents';
import { useEtatMemorise } from '@/services/memoire';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { LigneLien } from '../LigneLien';
import { EcranErreur } from '../liste/EcranErreur';
import { GroupeColle, LigneGroupe } from '../liste/ListeCollee';
import { Squelettes } from '../liste/Squelettes';
import { BarreRecherche } from './BarreRecherche';
import { ListeSujets } from './ListeSujets';

type Etat =
  | { statut: 'chargement' }
  | { statut: 'erreur' }
  | { statut: 'pret'; dossiers: Dossier[]; mien: Concours[]; autres: Concours[]; eleve: boolean; sujets?: Sujet[] }
  | { statut: 'concours'; concours: Concours | null; sujets: Sujet[] };

/**
 * D3 · Annales (M6-01, v1.8) : l'élève voit les dossiers de sa classe ; plus de carte « Autres concours » (demande
 * de Benny, 01/10). Le candidat qui a choisi son concours voit directement ses sujets, filtrables par année, et rien d'autre.
 * `tous` : la liste complète des concours.
 */
export function Annales({ tous = false }: { tous?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [etat, setEtat] = useEtatMemorise<Etat>(`annales.${tous}`, { statut: 'chargement' });
  const [gardes, setGardes] = useState(0);
  const [essai, setEssai] = useState(0);
  const [requete, setRequete] = useState('');
  const cherche = requete.trim().length > 0;

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void lireDocuments().then((d) => actif && setGardes(d.length));
    void (async () => {
      const client = getSupabase();
      const profil = await lireProfil();
      const eleve = profil?.type !== 'concours';
      const [dossiers, sujets] = await Promise.all([
        eleve && !tous
          ? lireDossiers(client, {
              niveau: profil?.niveau ?? '3e',
              pays: profil?.pays ?? 'CM',
              ...(profil?.serie?.id ? { serie: profil.serie.id } : {}),
            }).catch(() => [])
          : Promise.resolve([]),
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
      setEtat({ statut: 'pret', dossiers, mien, autres, eleve, sujets: sujets ?? [] });
    })();
    return () => {
      actif = false;
    };
  }, [pret, tous, essai, setEtat]);

  // Documents gardés sur le téléphone : en tête, accessibles même hors ligne.
  const mesDocuments =
    gardes && !tous ? (
      <LigneLien icone="download-outline" titre={t('document.mesDocuments')} detail={t('document.mesDocumentsDetail', { n: gardes })} onPress={() => router.push('/documents')} />
    ) : null;
  if (etat.statut === 'chargement') return <Squelettes />;
  if (etat.statut === 'erreur') {
    return (
      <EcranErreur
        titre={t('annales.erreurTitre')}
        phrase={t('annales.erreurPhrase')}
        reessayer={t('annales.reessayer')}
        onReessayer={() => {
          setEtat({ statut: 'chargement' });
          setEssai((n) => n + 1);
        }}
        secours={gardes ? { libelle: t('document.mesDocuments'), onPress: () => router.push('/documents') } : undefined}
      />
    );
  }
  if (etat.statut === 'concours') {
    return (
      <View style={styles.section}>
        {mesDocuments}
        {etat.concours ? (
          <View>
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
              {etat.concours.sigle && etat.concours.sigle !== etat.concours.nom ? `${etat.concours.sigle} · ${etat.concours.nom}` : etat.concours.nom}
            </Text>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t(etat.sujets.length > 1 ? 'annales.sujets' : 'annales.sujet', { n: etat.sujets.length })}</Text>
          </View>
        ) : null}
        <BarreRecherche valeur={requete} onChange={setRequete} />
        {(() => {
          const trouves = cherche ? rechercherSujets(etat.sujets, requete) : etat.sujets;
          if (cherche && !trouves.length) return <AucunResultat q={requete.trim()} />;
          return trouves.length ? <ListeSujets sujets={trouves} /> : <Banniere ton="info" titre={t('annales.vide')} />;
        })()}
      </View>
    );
  }

  const dossiers = cherche ? etat.dossiers.filter((d) => correspond(requete, d.nom)) : etat.dossiers;
  // Un élève n'a aucun concours dans sa liste, sauf la page « tous les concours » qu'il ouvre lui-même.
  const mien = cherche ? etat.mien.filter((c) => correspond(requete, c.nom, c.sigle)) : etat.mien;
  const autres = cherche ? etat.autres.filter((c) => correspond(requete, c.nom, c.sigle)) : etat.autres;
  // L'élève ne cherche que dans les dossiers de sa classe : les sujets du catalogue des concours restent hors recherche.
  const sujets = cherche && !etat.eleve ? rechercherSujets(etat.sujets ?? [], requete) : [];
  const rien = !dossiers.length && !mien.length && !(tous && autres.length);

  return (
    <View style={styles.groupe}>
      {mesDocuments}
      <BarreRecherche valeur={requete} onChange={setRequete} />
      {dossiers.length ? (
        <GroupeColle>
          {dossiers.map((d, i) => (
            <LigneGroupe
              key={d.id}
              premier={i === 0}
              gauche={<Ionicons name="folder-outline" size={22} color={theme.texte.principal} />}
              titre={d.nom}
              sousTitre={t(d.documents > 1 ? 'annales.documents' : 'annales.document', { n: d.documents })}
              onPress={() => router.push({ pathname: '/annales/dossier', params: { id: d.id, nom: d.nom } })}
            />
          ))}
        </GroupeColle>
      ) : null}
      {mien.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t(mien.length > 1 ? 'annales.concours' : 'annales.monConcours')}</Text>
          {mien.map((c) => (
            <LigneConcours key={c.id} c={c} />
          ))}
        </View>
      ) : null}
      {tous ? autres.map((c) => <LigneConcours key={c.id} c={c} />) : null}
      {sujets.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('annales.sujetsTrouves')}</Text>
          <ListeSujets sujets={sujets} />
        </View>
      ) : null}
      {rien && !sujets.length ? (cherche ? <AucunResultat q={requete.trim()} /> : <Banniere ton="info" titre={t('annales.vide')} />) : null}
    </View>
  );
}

function AucunResultat({ q }: { q: string }) {
  const { t } = useTraduction();
  return <Banniere ton="info" titre={t('annales.aucunResultat', { q })} texte={t('annales.aucunResultatTexte')} />;
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
