import type { MaterialShop } from '../../types/provider';
import {
    buildHomeSearchResults,
    getHomeSearchNavigationTarget,
} from '../homeSearch';

const materialShop: MaterialShop = {
    id: 101,
    type: 'brand',
    name: '马可波罗瓷砖生活馆',
    cover: 'https://example.com/material-cover.jpg',
    rating: 4.8,
    reviewCount: 36,
    mainProducts: ['岩板', '瓷砖'],
    productCategories: ['tile'],
    address: '西安市雁塔区建材街 88 号',
    distance: '3.2km',
    openTime: '09:00-18:00',
    tags: ['免费停车', '送货上门'],
    isVerified: true,
};

describe('homeSearch', () => {
    it('includes material shops in unified search results', () => {
        const results = buildHomeSearchResults({
            searchText: '瓷砖',
            designers: [],
            workers: [],
            materialShops: [materialShop],
        });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            id: materialShop.id,
            _type: 'material',
            _popularity: materialShop.reviewCount,
            _distance: 3.2,
        });
    });

    it('maps material search results to MaterialShopDetail', () => {
        const [result] = buildHomeSearchResults({
            searchText: '建材街',
            designers: [],
            workers: [],
            materialShops: [materialShop],
        });

        expect(getHomeSearchNavigationTarget(result)).toEqual({
            screen: 'MaterialShopDetail',
            params: { shop: result },
        });
    });
});
