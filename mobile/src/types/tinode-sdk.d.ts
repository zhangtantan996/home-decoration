declare module 'tinode-sdk' {
  // The upstream SDK ships JS only. Keep types minimal to avoid blocking builds.
  // Expand as needed when we adopt more Tinode APIs.
  export class Tinode {
    constructor(config?: unknown);

    onConnect?: () => void;
    onDisconnect?: (err?: unknown) => void;
    onMessage?: (msg: unknown) => void;

    connect(): Promise<unknown>;
    loginToken(token: string): Promise<unknown>;

    getMeTopic(): unknown;
    getTopic(name: string): unknown;
  }

  // The CommonJS build exports an object { Tinode, Drafty, AccessMode }.
  // Provide a default for convenience even if not used.
  export default Tinode;
}
