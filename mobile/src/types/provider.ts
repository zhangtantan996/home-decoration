import { formatProviderPricing, type ProviderQuoteDisplay } from '../utils/providerPricing';

export interface ProviderDTO {
    id: number;
    providerType: number;
    companyName: string;
    nickname: string;
    avatar: string;
    rating: number;
    restoreRate: number;
    budgetControl: number;
    completedCnt: number;
    verified: boolean;
    distance?: number;
    subType?: string;
    entityType?: 'personal' | 'company';
    applicantType?: 'personal' | 'studio' | 'company' | 'foreman';
    yearsExperience: number;
    specialty: string;
    workTypes?: string;
    highlightTags?: string;
    pricingJson?: string;
    graduateSchool?: string;
    designPhilosophy?: string;
    reviewCount: number;
    priceMin: number;
    priceMax: number;
    priceUnit: string;
    serviceArea?: string;
}

export interface PageResponse<T> {
    code: number;
    message: string;
    data: {
        list: T[];
        total: number;
        page: number;
        pageSize: number;
    };
}

export interface Designer {
    id: number;
    name: string;
    avatar: string;
    yearsExperience: number;
    rating: number;
    reviewCount: number;
    orgType: 'personal' | 'studio' | 'company';
    orgLabel: string;
    distance: string;
    specialty: string;
    price: string;
    priceRange: string;
    priceUnit: string;
    pricingSummary: string;
    pricingDetail: string;
    quoteDisplay: ProviderQuoteDisplay;
    serviceArea: string[];
}

export interface Worker {
    id: number;
    type: 'personal' | 'company';
    name: string;
    avatar?: string;
    logo?: string;
    yearsExperience?: number;
    establishedYear?: number;
    rating: number;
    reviewCount: number;
    serviceLabel: string;
    priceRange: string;
    priceUnit: string;
    pricingSummary: string;
    pricingDetail: string;
    quoteDisplay: ProviderQuoteDisplay;
    completedOrders: number;
    teamSize?: number;
    certifications?: string[];
    distance: string;
    tags: string[];
}

const WORKER_TAG_MAP: Record<string, string> = {
    mason: '泥瓦铺贴',
    masonry: '泥瓦铺贴',
    electrician: '水电改造',
    electric: '水电改造',
    plumber: '管路改造',
    water: '防水施工',
    carpenter: '木作安装',
    wood: '木作安装',
    painter: '油漆找平',
    paint: '油漆找平',
    foreman: '现场管理',
    manager: '现场管理',
};

const splitWorkerTokens = (raw?: string) => {
    const text = String(raw || '').trim();
    if (!text) {
        return [];
    }
    return text
        .split(/[·,，/|\\s]+/)
        .map((token) => token.trim())
        .filter(Boolean);
};

const normalizeWorkerTagText = (raw: string) => {
    const normalized = raw.trim();
    if (!normalized) {
        return '';
    }
    const lower = normalized.toLowerCase();
    const mapped = WORKER_TAG_MAP[lower];
    if (mapped) {
        return mapped;
    }
    const compact = normalized.replace(/[A-Za-z]/g, '');
    const source = compact || normalized;
    return Array.from(source).slice(0, 4).join('');
};

const buildWorkerTags = (dto: ProviderDTO, isCompany: boolean): string[] => {
    const tags: string[] = [];
    tags.push(isCompany ? '装修施工' : '综合施工');

    splitWorkerTokens(dto.specialty).forEach((token) => {
        const normalized = normalizeWorkerTagText(token);
        if (normalized && !tags.includes(normalized)) {
            tags.push(normalized);
        }
    });

    if (dto.verified) {
        tags.push(isCompany ? '品质保障' : '技术过硬');
    }

    if (tags.length < 3) {
        tags.push(isCompany ? '正规资质' : '准时守信');
    }

    return tags.slice(0, 3);
};

export interface MaterialShop {
    id: number;
    type: 'showroom' | 'brand';
    name: string;
    cover: string;
    brandLogo?: string;
    rating: number;
    reviewCount: number;
    mainProducts: string[];
    productCategories: string[];
    address: string;
    distance: string;
    openTime: string;
    tags: string[];
    isVerified: boolean;
    isSettled?: boolean;
}

export function toDesigner(dto: ProviderDTO): Designer {
    let orgType: 'personal' | 'studio' | 'company' = 'personal';
    if (dto.subType && ['personal', 'studio', 'company'].includes(dto.subType)) {
        orgType = dto.subType as 'personal' | 'studio' | 'company';
    } else if (dto.companyName && dto.companyName.includes('工作室')) {
        orgType = 'studio';
    } else if (dto.companyName && dto.companyName.includes('公司')) {
        orgType = 'company';
    }

    const priceRange = dto.priceMin && dto.priceMax
        ? `${dto.priceMin}-${dto.priceMax}`
        : '120-300';
    const priceUnit = dto.priceUnit || '/㎡';
    const pricing = formatProviderPricing({
        role: 'designer',
        pricingJson: dto.pricingJson,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        priceUnit,
    });

    return {
        id: dto.id,
        name: dto.nickname || dto.companyName || '未知',
        avatar: dto.avatar || 'https://via.placeholder.com/100',
        yearsExperience: dto.yearsExperience || Math.floor(dto.completedCnt / 50) + 3,
        rating: dto.rating,
        reviewCount: dto.reviewCount || 0,
        orgType,
        orgLabel: dto.companyName || (orgType === 'personal' ? '独立设计师' : '设计公司'),
        distance: dto.distance ? `${dto.distance.toFixed(1)}km` : '附近',
        specialty: dto.specialty || (dto.restoreRate > 95 ? '高还原度 · 精品设计' : '现代简约 · 实用主义'),
        price: pricing.summary,
        priceRange,
        priceUnit,
        pricingSummary: pricing.summary,
        pricingDetail: pricing.detail,
        quoteDisplay: pricing.quoteDisplay,
        serviceArea: dto.serviceArea
            ? (() => {
                try {
                    const parsed = JSON.parse(dto.serviceArea || '[]');
                    return Array.isArray(parsed) ? parsed : ['雁塔区', '曲江新区', '高新区'];
                } catch {
                    return ['雁塔区', '曲江新区', '高新区'];
                }
            })()
            : ['雁塔区', '曲江新区', '高新区'],
    };
}

export function toWorker(dto: ProviderDTO): Worker {
    const isCompany = dto.providerType === 2 || Boolean(dto.companyName && dto.companyName.includes('公司'));
    const serviceLabel = isCompany ? '装修施工' : '综合施工';
    const fallbackUnit = dto.priceUnit || (isCompany ? '元/全包' : '元/天');
    const pricing = formatProviderPricing({
        role: isCompany ? 'company' : 'foreman',
        pricingJson: dto.pricingJson,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        priceUnit: fallbackUnit,
    });

    return {
        id: dto.id,
        type: isCompany ? 'company' : 'personal',
        name: dto.nickname || dto.companyName || '未知',
        avatar: isCompany ? undefined : (dto.avatar || 'https://via.placeholder.com/100'),
        logo: isCompany ? (dto.avatar || 'https://via.placeholder.com/100') : undefined,
        yearsExperience: isCompany ? undefined : (dto.yearsExperience || Math.floor(dto.completedCnt / 50) + 5),
        establishedYear: isCompany ? (new Date().getFullYear() - (dto.yearsExperience || 10)) : undefined,
        rating: dto.rating,
        reviewCount: dto.reviewCount || 0,
        serviceLabel,
        priceRange: dto.priceMin && dto.priceMax ? `${dto.priceMin}-${dto.priceMax}` : (isCompany ? '8-15' : '300-500'),
        priceUnit: fallbackUnit,
        pricingSummary: pricing.summary,
        pricingDetail: pricing.detail,
        quoteDisplay: pricing.quoteDisplay,
        completedOrders: dto.completedCnt,
        teamSize: isCompany ? Math.floor(dto.completedCnt / 30) + 10 : undefined,
        certifications: isCompany ? ['建筑装饰资质'] : undefined,
        distance: dto.distance ? `${dto.distance.toFixed(1)}km` : '附近',
        tags: buildWorkerTags(dto, isCompany),
    };
}
