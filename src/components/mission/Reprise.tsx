import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTraduction } from "@/i18n/useTraduction";
import { lireProfil } from "@/services/profil";
import { lireReprise, type ElementReprise } from "@/services/reprise";
import { lireCours, programmeDu } from "@/services/reviser";
import { getSupabase } from "@/services/supabase";
import { titreExercice } from "@/services/titres";
import { useSessionPrete } from "@/session/SessionProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { espace, typo } from "@/theme/theme";

import { Apparition } from "../Apparition";
import { libelleQuiz } from "../entrainement/libelles";
import { CarteListe } from "../liste/CarteListe";
import { PastilleType } from "../liste/PastilleType";

/** C1 · Accueil, reprise (M4-09) : sous la mission du jour, jusqu'à 3 cartes (leçon, quiz, exercice en cours). Rien si tout est fini. */
export function Reprise() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [elements, setElements] = useState<ElementReprise[]>([]);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        // Les cours (copie locale de moins de 12 h) donnent la matière et le nom du chapitre ; sans eux, la reprise reste possible.
        const cours = pret
          ? await lireCours(
              getSupabase(),
              programmeDu(await lireProfil()),
            ).catch(() => [])
          : [];
        const e = await lireReprise(cours).catch(() => []);
        if (actif) setElements(e);
      })();
      return () => {
        actif = false;
      };
    }, [pret]),
  );

  if (!elements.length) return null;
  return (
    <Apparition delai={90}>
      <View style={styles.groupe}>
        <Text
          accessibilityRole="header"
          style={[typo.etiquette, { color: theme.texte.secondaire }]}
        >
          {t("mission.reprendre")}
        </Text>
        {elements.map((e) => {
          const detail = (x: string | null) =>
            [e.matiere, x].filter(Boolean).join(" · ");
          if (e.type === "lecon") {
            const l = e.lecon;
            return (
              <CarteListe
                key="lecon"
                gauche={<PastilleType type="lecon" play />}
                titre={
                  l.numero
                    ? t("mission.repriseLecon", { n: l.numero, nom: l.nom })
                    : l.nom
                }
                sousTitre={detail(
                  l.minutes
                    ? t("mission.repriseMinutes", { n: l.minutes })
                    : null,
                )}
                onPress={() =>
                  router.push({
                    pathname: "/cours/lecon",
                    params: {
                      id: String(l.id),
                      cours: String(l.cours),
                      matiere: e.matiere,
                    },
                  })
                }
              />
            );
          }
          const d = e.dernier;
          const chapitre = e.chapitre || d.chapitre;
          if (e.type === "quiz") {
            return (
              <CarteListe
                key="quiz"
                gauche={<PastilleType type="quiz" />}
                titre={libelleQuiz(t, d.nom, chapitre, d.numero)}
                sousTitre={detail(
                  d.meilleur !== undefined
                    ? t("mission.repriseMeilleur", { n: d.meilleur })
                    : chapitre,
                )}
                onPress={() =>
                  router.push({
                    pathname: "/entrainement/quiz",
                    params: { id: d.id, cours: String(d.cours), nom: chapitre },
                  })
                }
              />
            );
          }
          return (
            <CarteListe
              key="exercice"
              gauche={<PastilleType type="exercice" />}
              titre={
                titreExercice(d.nom, chapitre) ||
                t("entrainement.exerciceN", { n: d.rang })
              }
              sousTitre={detail(
                t("mission.repriseExercice", { n: d.rang, total: d.total }),
              )}
              onPress={() =>
                router.push({
                  pathname: "/entrainement/exercice",
                  params: { id: d.id, cours: String(d.cours) },
                })
              }
            />
          );
        })}
      </View>
    </Apparition>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
