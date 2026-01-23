declare module 'tinode-sdk' {
  // tinode-sdk is a CommonJS/UMD bundle which exports { Tinode, Drafty, AccessMode }.
  // In Vite, use named imports: `import { Tinode } from 'tinode-sdk'`.
  export class Tinode {
    constructor(config: any, onComplete?: ((err?: unknown) => void) | null);
    connect(host?: string): Promise<void>;
    loginToken(token: string, cred?: any): Promise<any>;
    disconnect(): void;
    [key: string]: any;
  }

  export const Drafty: any;
  export const AccessMode: any;
}
