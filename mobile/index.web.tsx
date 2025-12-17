import { AppRegistry } from 'react-native';

declare const document: any;

import App from './App';
import { name as appName } from './app.json';

// Register the app
AppRegistry.registerComponent(appName, () => App);

// Mount the app to the DOM
AppRegistry.runApplication(appName, {
    initialProps: {},
    rootTag: document.getElementById('root'),
});
