interface ImportMetaEnv {
  /** HTTP(S) origin of the separately hosted multiplayer server. */
  readonly VITE_GAME_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
