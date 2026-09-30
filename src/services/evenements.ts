/** Dictionnaire des événements d'analytics : nom de l'événement -> propriétés autorisées. */
export type Evenements = {
  app_opened: { plateforme: string };
  session_invite_creee: Record<string, never>;
  feedback_setting_changed: { setting: 'sounds' | 'haptics' | 'reduced_motion'; value: boolean; sound_on: boolean; haptics_on: boolean; reduced_motion: boolean };
  celebration_seen: { sound_on: boolean; haptics_on: boolean; reduced_motion: boolean };
  referral_code_captured: { source: 'lien' | 'saisie' };
  compte_cree: { methode: 'email' | 'google' | 'apple'; conversion_invite: boolean; avec_parrainage: boolean };
  connexion_reussie: { methode: 'email' | 'google' | 'apple' };
  deconnexion: Record<string, never>;
  erreur_ecran: { message: string; pile?: string; origine: 'boundary' | 'global'; fatale?: boolean };
};

export type NomEvenement = keyof Evenements;
