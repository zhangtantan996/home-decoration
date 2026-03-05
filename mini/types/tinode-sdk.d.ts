declare module 'tinode-sdk' {
  // tinode-sdk is a CommonJS/UMD bundle which exports { Tinode, Drafty, AccessMode }.
  // Keep types permissive to avoid blocking builds; narrow as we adopt more APIs.
  export class Tinode {
    constructor(config: any, onComplete?: ((err?: unknown) => void) | null);

    connect(host?: string): Promise<void>;
    loginToken(token: string, cred?: any): Promise<any>;
    disconnect(): void;

    getMeTopic(): any;
    getTopic(name: string): any;

    getCurrentUserID(): string | null;
    isMe(uid: string): boolean;

    [key: string]: any;
  }

  export const Drafty: any;
  export const AccessMode: any;
}

