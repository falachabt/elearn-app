import { router } from 'expo-router';
import { BookOpen, Check, NotebookPen, RotateCcw, Target } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { minutesDeLaSeance } from '@/services/certification/accueil';
import { ecrirePlan, obtenirReglages } from '@/services/certification/etat';
import { jourDe } from '@/services/certification/jours';
import type { Reglages } from '@/services/certification/reglages';
import { avancement, changerDuree, chargerSeanceJour, commencer, indexBlocSuivant, pourquoiDeLaSeance, terminerBloc, type EtatSeanceJour } from '@/services/certification/seanceJour';
import { longueurSerieAnnoncee } from '@/services/certification/serie';
import type { BlocServi } from '@/services/certification/types';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { BarreProgression, EnteteToeic, LigneChoix, Squelette } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'ok' };

/** D2 · Séance du jour : pourquoi cette séance, les blocs dans l'ordre, durée modifiable avant de commencer. */
export function SeanceDuJour() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [etat, setEtat] = useState<EtatSeanceJour | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [duree, setDuree] = useState(false);

  const charger = useCallback(async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [profil, r, minutes] = await Promise.all([lireProfil(), obtenirReglages(), minutesDeLaSeance()]);
      setReglages(r);
      setEtat(await chargerSeanceJour(profil?.exam ?? 'toeic', jourDe(new Date()), minutes));
      setPhase({ nom: 'ok' });
    } catch {
      setPhase({ nom: 'erreur' });
    }
  }, []);

  useEffect(() => {
    // Chargement initial : l'état de chargement est posé par `charger` lui-même.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const lancer = async () => {
    if (!etat) return;
    const i = indexBlocSuivant(etat);
    if (i === null) return;
    const bloc = etat.seance.blocs[i];
    let courant = etat;
    if (etat.debut === null) {
      courant = await commencer(etat);
      suivre('cert_session_started', { composition: etat.seance.blocs.map((b) => b.type).join(',') });
    }
    setEtat(courant);
    if (bloc.type === 'cours') {
      // La lecture de la fiche est l'activité du bloc : il est clos à l'ouverture, les blocs suivants se débloquent.
      setEtat(await terminerBloc(courant, i));
      router.push({ pathname: '/certification/notion/[id]', params: { id: bloc.notionId, source: 'seance' } } as never);
    } else if (bloc.type === 'mots') {
      router.push({ pathname: '/certification/mots-seance', params: { origine: 'seance', nombre: String(bloc.nombre) } } as never);
    } else if (bloc.type === 'rejeu') {
      router.push({ pathname: '/certification/serie', params: { rejeu: '1', taille: String(bloc.nombre), origine: 'seance' } } as never);
    } else {
      router.push({ pathname: '/certification/serie', params: { part: String(bloc.partie), taille: String(bloc.nombre), origine: 'seance' } } as never);
    }
  };

  const choisirDuree = async (minutes: number) => {
    setDuree(false);
    if (!etat) return;
    const profil = await lireProfil();
    await ecrirePlan({ exam: profil?.exam ?? 'toeic', minutes });
    try {
      setEtat(await changerDuree(etat, minutes));
    } catch {
      setPhase({ nom: 'erreur' });
    }
  };

  const bloc = (b: BlocServi): { icone: typeof Target; titre: string; aide: string } => {
    if (b.type === 'cours') return { icone: BookOpen, titre: t('certification.seanceJour.cours'), aide: t('certification.seanceJour.coursAide', { notion: b.titre, n: b.minutes }) };
    if (b.type === 'mots') return { icone: NotebookPen, titre: t('certification.seanceJour.mots'), aide: b.nombre === 1 ? t('certification.seanceJour.motsAideUn') : t('certification.seanceJour.motsAide', { n: b.nombre }) };
    if (b.type === 'rejeu') return { icone: RotateCcw, titre: t('certification.seanceJour.rejeu'), aide: b.partie ? (b.nombre === 1 ? t('certification.seanceJour.rejeuAideUne', { partie: b.partie }) : t('certification.seanceJour.rejeuAide', { n: b.nombre, partie: b.partie })) : t('certification.seanceJour.rejeuAideSans', { n: b.nombre }) };
    return { icone: Target, titre: t('certification.seanceJour.serie'), aide: t('certification.seanceJour.serieAide', { partie: b.partie, n: longueurSerieAnnoncee(b.partie, b.nombre, reglages) }) };
  };

  const av = etat ? avancement(etat) : null;
  const finie = !!etat?.finie;
  const p = etat ? pourquoiDeLaSeance(etat.seance.pourquoi) : null;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.seanceJour.entete')} onRetour={retour} />}>
      {phase.nom === 'chargement' ? <Squelette lignes={4} /> : null}
      {phase.nom === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.seanceJour.erreurTitre')} texte={t('certification.seanceJour.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={() => void charger()} />
        </View>
      ) : null}
      {phase.nom === 'ok' && etat && av ? (
        etat.seance.blocs.length === 0 ? (
          <Banniere ton="info" titre={t('certification.seanceJour.vide')} texte={t('certification.seanceJour.videTexte')} />
        ) : (
          <View style={styles.groupe}>
            <Carte>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.seanceJour.pourquoiTitre')}</Text>
              {p ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{t(`certification.accueilToeic.${p.cle}`, p.params)}</Text> : null}
              <BarreProgression pourcent={(av.faits / av.total) * 100} libelle={av.total === 1 ? t('certification.seanceJour.avancementUn', { k: av.faits }) : t('certification.seanceJour.avancement', { k: av.faits, b: av.total })} />
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{av.total === 1 ? t('certification.seanceJour.avancementUn', { k: av.faits }) : t('certification.seanceJour.avancement', { k: av.faits, b: av.total })}</Text>
            </Carte>
            {etat.seance.blocs.map((b, i) => {
              const fait = etat.termines.includes(i);
              const d = bloc(b);
              return <LigneChoix key={i} icone={fait ? Check : d.icone} titre={d.titre} aide={fait ? `${d.aide} · ${t('certification.seanceJour.fait')}` : d.aide} />;
            })}
            {finie ? (
              <View style={styles.groupe}>
                <Banniere ton="succes" titre={t('certification.seanceJour.terminee')} texte={etat.enregistree ? t('certification.seanceJour.termineeTexte') : t('certification.seanceJour.termineeNonEnvoyee')} />
                <Bouton libelle={t('certification.seanceJour.retourAccueil')} onPress={() => router.replace('/')} />
              </View>
            ) : (
              <View style={styles.groupe}>
                <Bouton libelle={av.faits > 0 ? t('certification.seanceJour.continuer') : t('certification.seanceJour.commencer')} onPress={() => void lancer()} />
                {av.faits === 0 && etat.debut === null ? <Bouton variante="texte" libelle={t('certification.seanceJour.changerDuree')} onPress={() => setDuree(true)} /> : <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.seanceJour.dureeFigee')}</Text>}
              </View>
            )}
          </View>
        )
      ) : null}
      <Feuille
        ouverte={duree}
        onFermer={() => setDuree(false)}
        titre={t('certification.seanceJour.dureeTitre')}
        actions={(reglages?.seanceMinutesChoix ?? []).map((m) => ({ libelle: t('certification.seanceJour.dureeMinutes', { n: m }), variante: m === etat?.seance.minutes ? 'principal' : 'secondaire', onPress: () => void choisirDuree(m) }))}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
