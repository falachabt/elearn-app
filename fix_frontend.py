import re

with open(r"D:\Projets\Elearn Apps\elearn-app\src\services\actionsCredits.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Replace crediterRecompenseServeur
old_crediter = """export async function crediterRecompenseServeur(client: Client, utilisateurId: string, montant: number, motif: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('add_reward_credits', { p_amount: montant, p_reason: motif });
    if (!error && data !== false) return true;
  } catch {
    // Si la RPC n'existe pas en DB, fallback d'insertion directe ledger/balance
  }
  try {
    const { error: errLedger } = await client.from('credit_ledger').insert({
      user_id: utilisateurId,
      delta: montant,
      kind: 'reward',
      reason: motif,
    });
    if (errLedger) return false;
    return true;
  } catch {
    return false;
  }
}"""

new_crediter = """export async function crediterRecompenseServeur(client: Client, actionCode: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('claim_daily_action', { p_action_code: actionCode });
    if (!error && data > 0) return true;
    return false;
  } catch {
    return false;
  }
}"""

content = content.replace(old_crediter, new_crediter)

# Replace the specific lines inside executerActionQuotidienne
def repl(m):
    return """  // Si dj rclame aujourd'hui, on ouvre juste le lien sans r-attribuer de crdits.
  if (etat[action]) return false;

  if (config.gain > 0) {
    const client = options.client ?? getSupabase();
    if (options.utilisateurId) {
      const succes = await crediterRecompenseServeur(client, action);
      if (!succes) return false; // Dj rclam sur un autre appareil ou erreur serveur
    }
    await enregistrerActionQuotidienne(action, maintenant);
    await mefierNotificationReward(action, config.gain);
    options.onSucces?.(config.gain);
  } else {
    await enregistrerActionQuotidienne(action, maintenant);
  }

  return true;"""

import re
content = re.sub(r'  // Si d.j. r.clam.e aujourd\'hui, on ouvre juste le lien sans r.-attribuer de cr.dits\.\n  if \(etat\[action\]\) return false;\n\n  await enregistrerActionQuotidienne\(action, maintenant\);\n\n  if \(config\.gain > 0\) \{\n    const client = options\.client \?\? getSupabase\(\);\n    if \(options\.utilisateurId\) \{\n      await crediterRecompenseServeur\(client, options\.utilisateurId, config\.gain, action\);\n    \}\n    await mefierNotificationReward\(action, config\.gain\);\n    options\.onSucces\?.\(config\.gain\);\n  \}\n\n  return true;', repl, content)


with open(r"D:\Projets\Elearn Apps\elearn-app\src\services\actionsCredits.ts", "w", encoding="utf-8") as f:
    f.write(content)
