// Polyfill Intl.Segmenter for React Native runtimes which don't implement it.
// Tinode SDK's Drafty module initializes a Segmenter at import time.

type Segment = { segment: string; index: number; input: string };

function installIntlSegmenterPolyfill(): void {
  // Intl exists in RN, but Segmenter may be missing.
  const intlAny = (globalThis as unknown as { Intl?: unknown }).Intl as
    | { Segmenter?: unknown }
    | undefined;

  if (!intlAny || intlAny.Segmenter) return;

  class SegmenterPolyfill {
    // Keep signature loose: Tinode calls `new Intl.Segmenter()` with no args.
    constructor(_locales?: unknown, _options?: unknown) {}

    segment(input: string): Segment[] {
      // Approximate grapheme segmentation by iterating code points.
      // This is sufficient to keep Drafty logic working in RN.
      const out: Segment[] = [];
      let idx = 0;
      for (const ch of input) {
        out.push({ segment: ch, index: idx, input });
        idx += ch.length;
      }
      return out;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (intlAny as any).Segmenter = SegmenterPolyfill;
}

installIntlSegmenterPolyfill();

function installIndexedDBPolyfill(): void {
  const g = globalThis as unknown as { indexedDB?: unknown };
  if (g.indexedDB) return;

  // Tinode SDK expects an IndexedDB-like API. We provide a minimal stub:
  // - deleteDatabase resolves (so non-persistent mode won't crash)
  // - open triggers onerror (so persistent mode fails gracefully)
  const indexedDBStub = {
    deleteDatabase(_name: string) {
      const req: any = {};
      setTimeout(() => {
        if (typeof req.onsuccess === 'function') req.onsuccess({});
      }, 0);
      return req;
    },
    open(_name: string, _version?: number) {
      const req: any = {};
      setTimeout(() => {
        if (typeof req.onerror === 'function') {
          req.onerror({ target: { error: new Error('IndexedDB is not supported in React Native') } });
        }
      }, 0);
      return req;
    },
  };

  g.indexedDB = indexedDBStub;
}

installIndexedDBPolyfill();
