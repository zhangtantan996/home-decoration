const fs = require('fs');

function replaceUnsplash(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log('Skipping', filePath);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const importStats = "import { getApiBaseUrl } from '../config';\n";

    // Check if getApiBaseUrl is already imported
    if (!content.includes('import { getApiBaseUrl }') && filePath.includes('mockData.ts')) {
        content = importStats + content;
    }

    const regex = /'https:\/\/images\.unsplash\.com\/[^']+'/g;

    if (filePath.includes('mockData.ts')) {
        content = content.replace(regex, "getApiBaseUrl().replace('/api/v1', '') + '/static/inspiration/modern_minimalist_living_room.png'");
    } else {
        content = content.replace(regex, "getApiBaseUrl().replace('/api/v1', '') + '/static/inspiration/nordic_style_bedroom.png'");
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Replaced unsplash links in', filePath);
}

replaceUnsplash('mobile/src/services/mockData.ts');
replaceUnsplash('mobile/src/screens/ProviderDetails.tsx');
replaceUnsplash('mobile/src/screens/CaseScreens.tsx');
replaceUnsplash('mobile/src/screens/OrderDetailScreen.tsx');
replaceUnsplash('mobile/src/screens/MaterialShopDetailScreen.tsx');
replaceUnsplash('mobile/src/screens/BookingScreen.tsx');
replaceUnsplash('mobile/src/screens/MySiteScreen.tsx');
