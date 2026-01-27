/**
 * Tinode IM Configuration
 *
 * Loads configuration from environment variables using react-native-config.
 * See mobile/.env.example for required environment variables.
 */

import Config from 'react-native-config';

const normalizeTinodeHost = (raw?: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const withoutScheme = trimmed.replace(/^(ws|wss|http|https):\/\//, '');
    return withoutScheme.split('/')[0];
};

// Runtime validation: warn if API key is not configured
if (!Config.TINODE_API_KEY) {
    console.warn(
        '[Tinode Config] TINODE_API_KEY is not set. Please configure it in .env file. ' +
        'See .env.example for instructions.'
    );
}

export const TINODE_CONFIG = {
    API_KEY: Config.TINODE_API_KEY || '',
    // Optional override. Accepts values like:
    // - "ws://192.168.0.10:6060"
    // - "http://localhost:6060"
    // - "192.168.0.10:6060"
    HOST: normalizeTinodeHost(Config.TINODE_SERVER_URL),
    APP_NAME: 'HomeDecoration',
};
