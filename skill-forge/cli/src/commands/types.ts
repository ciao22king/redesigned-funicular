export interface Command {
  /** Nome digitato dall'utente. */
  name: string;
  /** Riga di sintassi mostrata nell'help. */
  usage: string;
  /** Descrizione breve. */
  summary: string;
  /** Richiede un token? Se si', il dispatcher avvisa prima di partire. */
  needsAuth?: boolean;
  run(args: string[], ctx: Context): Promise<number>;
}

export interface Context {
  /** Flag globali gia' estratti dal dispatcher. */
  json: boolean;
  url?: string;
  token?: string;
}
