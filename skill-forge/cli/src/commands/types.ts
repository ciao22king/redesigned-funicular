export interface Command {
  /** Nome digitato dall'utente. */
  name: string;
  /** Riga di sintassi mostrata nell'help. */
  usage: string;
  /** Descrizione breve. */
  summary: string;
  /** Requires a token? If so, the dispatcher warns before starting. */
  needsAuth?: boolean;
  run(args: string[], ctx: Context): Promise<number>;
}

export interface Context {
  /** Global flags already extracted by the dispatcher. */
  json: boolean;
  url?: string;
  token?: string;
}
