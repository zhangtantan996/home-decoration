/**
 * Tinode IM Configuration
 *
 * Loads configuration from environment variables using react-native-config.
 * See mobile/.env.example for required environment variables.
 */

import Config from 'react-native-config';

// Runtime validation: warn if API key is not configured
if (!Config.TINODE_API_KEY) {
    console.warn(
        '[Tinode Config] TINODE_API_KEY is not set. Please configure it in .env file. ' +
        'See .env.example for instructions.'
    );
}

export const TINODE_CONFIG = {
    API_KEY: Config.TINODE_API_KEY || '',
    APP_NAME: 'HomeDecoration',
};
