// React Native's FormData implementation accepts `{ uri, type, name }` objects.
// The DOM lib typings only allow string/Blob, so we add an overload.

declare global {
    type ReactNativeFormDataFile = {
        uri: string;
        type?: string;
        name?: string;
    };

    interface FormData {
        append(name: string, value: ReactNativeFormDataFile): void;
    }
}

export {};
