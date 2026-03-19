import type { Designer, MaterialShop, Worker } from '../types/provider';

type SearchableValue = string | string[] | undefined | null;

type SearchResultBase = {
    _popularity: number;
    _distance: number;
};

export type DesignerSearchResult = Designer & SearchResultBase & {
    _type: 'designer';
};

export type ConstructionSearchResult = Worker & SearchResultBase & {
    _type: 'construction';
};

export type MaterialSearchResult = MaterialShop & SearchResultBase & {
    _type: 'material';
};

export type HomeSearchResult =
    | DesignerSearchResult
    | ConstructionSearchResult
    | MaterialSearchResult;

interface BuildHomeSearchResultsParams {
    searchText: string;
    designers: Designer[];
    workers: Worker[];
    materialShops: MaterialShop[];
    sortBy?: string;
}

const parseDistanceValue = (distance: string | number | undefined) => {
    if (typeof distance === 'number' && Number.isFinite(distance)) {
        return distance;
    }

    if (typeof distance === 'string') {
        const parsed = Number.parseFloat(distance);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return Number.MAX_SAFE_INTEGER;
};

const normalizeSearchValue = (value: SearchableValue) => {
    if (Array.isArray(value)) {
        return value.join(' ').toLowerCase();
    }

    return typeof value === 'string' ? value.toLowerCase() : '';
};

const matchesKeyword = (keyword: string, values: SearchableValue[]) =>
    values.some((value) => normalizeSearchValue(value).includes(keyword));

export const buildHomeSearchResults = ({
    searchText,
    designers,
    workers,
    materialShops,
    sortBy = 'recommend',
}: BuildHomeSearchResultsParams): HomeSearchResult[] => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
        return [];
    }

    const results: HomeSearchResult[] = [];

    designers.forEach((designer) => {
        if (matchesKeyword(keyword, [designer.name, designer.specialty, designer.orgLabel])) {
            results.push({
                ...designer,
                _type: 'designer',
                _popularity: designer.reviewCount,
                _distance: parseDistanceValue(designer.distance),
            });
        }
    });

    workers.forEach((worker) => {
        if (matchesKeyword(keyword, [worker.name, worker.serviceLabel, worker.tags])) {
            results.push({
                ...worker,
                _type: 'construction',
                _popularity: worker.completedOrders,
                _distance: parseDistanceValue(worker.distance),
            });
        }
    });

    materialShops.forEach((shop) => {
        if (matchesKeyword(keyword, [
            shop.name,
            shop.mainProducts,
            shop.productCategories,
            shop.tags,
            shop.address,
        ])) {
            results.push({
                ...shop,
                _type: 'material',
                _popularity: shop.reviewCount,
                _distance: parseDistanceValue(shop.distance),
            });
        }
    });

    switch (sortBy) {
        case 'rating':
            results.sort((a, b) => b.rating - a.rating);
            break;
        case 'distance':
            results.sort((a, b) => a._distance - b._distance);
            break;
        case 'popularity':
            results.sort((a, b) => b._popularity - a._popularity);
            break;
        default:
            break;
    }

    return results;
};

export const getHomeSearchNavigationTarget = (item: HomeSearchResult) => {
    if (item._type === 'designer') {
        return {
            screen: 'DesignerDetail',
            params: { designer: item },
        };
    }

    if (item._type === 'construction') {
        return item.type === 'company'
            ? {
                screen: 'CompanyDetail',
                params: { company: item },
            }
            : {
                screen: 'WorkerDetail',
                params: { worker: item },
            };
    }

    return {
        screen: 'MaterialShopDetail',
        params: { shop: item },
    };
};

export const getHomeSearchDescription = (item: HomeSearchResult) => {
    if (item._type === 'material') {
        const mainProducts = item.mainProducts.slice(0, 2).join(' · ');
        const secondary = item.address || item.tags.slice(0, 2).join(' · ');
        return [mainProducts, secondary].filter(Boolean).join(' · ') || '主材门店';
    }

    if (item._type === 'designer') {
        return item.specialty || '设计服务';
    }

    return item.serviceLabel || '施工服务';
};
