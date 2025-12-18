const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
    resolver: {
        resolverMainFields: ['react-native', 'browser', 'main'],
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
