import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Flag } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGardeReseau } from '@/components/reseau/useGardeReseau';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { motifsPour, TYPE_DU_MOTIF, type MotifSignalement } from '@/services/certification/signalement';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EncadrePointille, EnteteToeic, LigneChoix } from './ui';

type Params = { question?: string; partie?: string; numero?: string; notion?: string };

/**
 * X2 · Signaler une erreur (cahier §5.X, maquette TOEIC-X2). Un motif à choisir, puis « Envoyer ». Le serveur
 * (`cert_report_error`) garde un signalement par identifiant client : un envoi rejoué après une coupure n'écrit
 * rien de plus. Aucune donnée personnelle ne part : la question, le type, l'identifiant client.
 */
export function SignalerErreur() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const p = useLocalSearchParams<Params>();
  const questionId = p.question ?? '';
  const partie = Number(p.partie ?? 0);
  const numero = p.numero ? Number(p.numero) : null;
  const notion = p.notion ?? null;
  const { garde, banniere } = useGardeReseau();
  const [motif, setMotif] = useState<MotifSignalement | null>(null);
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'envoye' | 'erreur'>('saisie');
  // Un identifiant par motif, gardé entre deux essais : un « Envoyer » rejoué après un échec reste idempotent.
  const uuids = useRef<Partial<Record<MotifSignalement, string>>>({});

  const aide = (m: MotifSignalement) => {
    if (m === 'reponse') return numero !== null ? t('certification.signaler.question', { n: numero }) : t('certification.signaler.questionSansNumero');
    if (m === 'explication') return notion ? t('certification.signaler.notion', { titre: notion }) : t('certification.signaler.explicationAide');
    return t('certification.signaler.audioAide');
  };

  const envoyer = async () => {
    if (!motif || !questionId || etat === 'envoi') return;
    const uuid = (uuids.current[motif] ??= Crypto.randomUUID());
    const type = TYPE_DU_MOTIF[motif];
    setEtat('envoi');
    try {
      const fait = await garde(async () => {
        await obtenirApi().signalerErreur(questionId, type, uuid);
        return true;
      });
      if (!fait) {
        setEtat('saisie');
        return;
      }
      suivre('cert_error_reported', { type });
      setEtat('envoye');
    } catch {
      setEtat('erreur');
    }
  };

  const pied =
    etat === 'envoye' ? (
      <Bouton libelle={t('certification.signaler.retour')} onPress={() => router.back()} />
    ) : (
      <Bouton libelle={t('certification.signaler.envoyer')} desactive={!motif || !questionId || etat === 'envoi'} onPress={() => void envoyer()} />
    );

  return (
    <Ecran entete={<EnteteToeic titre={t('certification.signaler.titre')} onRetour={() => router.back()} />} pied={pied}>
      {etat === 'envoye' ? (
        <Banniere ton="succes" titre={t('certification.signaler.merciTitre')} texte={t('certification.signaler.merciTexte')} />
      ) : (
        <View style={styles.colonne}>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.signaler.intro')}</Text>
          {motifsPour(partie).map((m) => (
            <LigneChoix
              key={m}
              icone={Flag}
              radio
              actif={motif === m}
              titre={t(`certification.signaler.motif_${m}`)}
              aide={aide(m)}
              onPress={() => {
                setMotif(m);
                if (etat === 'erreur') setEtat('saisie');
              }}
            />
          ))}
          <EncadrePointille texte={t('certification.signaler.confidentialite')} />
          {banniere}
          {etat === 'erreur' ? <Banniere ton="erreur" titre={t('certification.signaler.erreurTitre')} texte={t('certification.signaler.erreurTexte')} /> : null}
        </View>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({ colonne: { gap: espace[4] } });
