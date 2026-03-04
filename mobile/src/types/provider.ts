// 后端 API 返回的服务商数据类型

export interface ProviderDTO {
    id: number;
    userId: number;
    userPublicId?: string;
    providerType: number; // 1=设计师, 2=公司, 3=工长
    companyName: string;
    nickname: string;
    avatar: string;
    rating: number;
    restoreRate: number;
    budgetControl: number;
    completedCnt: number;
    verified: boolean;
    latitude: number;
    longitude: number;
    distance?: number;
    // 新增字段
    subType?: string; // personal, studio, company - 注册时选择的类型
    entityType?: 'personal' | 'company';
    applicantType?: 'personal' | 'studio' | 'company' | 'foreman';
    yearsExperience: number;
    specialty: string;
    workTypes: string;  // 逗号分隔：mason,electrician,carpenter,painter,plumber
    highlightTags?: string;
    pricingJson?: string;
    graduateSchool?: string;
    designPhilosophy?: string;
    reviewCount: number;
    priceMin: number;
    priceMax: number;
    priceUnit: string;
    serviceArea?: string; // JSON数组，服务区域
}

// 分页响应包装
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

// 前端展示用的设计师类型（兼容现有 UI）
export interface Designer {
    id: number;
    userPublicId?: string;
    name: string;
    avatar: string;
    yearsExperience: number;
    rating: number;
    reviewCount: number;
    orgType: 'personal' | 'studio' | 'company';
    orgLabel: string;
    distance: string;
    specialty: string;
    // Price Display - 拆分价格和单位
    price: string; // 保留兼容
    priceRange: string; // 如: 180-400
    priceUnit: string; // 如: /m²
    // Service Area
    serviceArea: string[];
}

function parseWorkTypesValue(raw?: string): string[] {
    const value = (raw || '').trim();
    if (!value) {
        return ['general'];
    }

    if (value.startsWith('[') && value.endsWith(']')) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                const normalized = parsed.map((item) => String(item).trim()).filter(Boolean);
                return normalized.length ? normalized : ['general'];
            }
        } catch {
            // fallback to delimiter parsing
        }
    }

    const normalized = value.split(',').map((item) => item.trim()).filter(Boolean);
    return normalized.length ? normalized : ['general'];
}

// 前端展示用的施工人员类型
export interface Worker {
    id: number;
    userPublicId?: string;
    type: 'personal' | 'company';
    name: string;
    avatar?: string;
    logo?: string;
    yearsExperience?: number;
    establishedYear?: number;
    rating: number;
    reviewCount: number;
    workTypes: string[];
    workTypeLabels: string;
    priceRange: string;
    priceUnit: string;
    completedOrders: number;
    teamSize?: number;
    certifications?: string[];
    distance: string;
    tags: string[];
}

// 前端展示用的主材门店类型
export interface MaterialShop {
    id: number;
    type: 'showroom' | 'brand'; // 展示店 | 品牌店
    name: string;
    cover: string; // 门店封面图
    brandLogo?: string; // 品牌Logo（品牌店特有）
    rating: number;
    reviewCount: number;
    mainProducts: string[]; // 主营产品
    productCategories: string[]; // 产品分类标签
    address: string;
    distance: string;
    openTime: string; // 营业时间
    tags: string[]; // 如：免费停车、免费设计
    isVerified: boolean; // 认证商家
}

// DTO -> 前端类型转换函数
export function toDesigner(dto: ProviderDTO): Designer {
    // 优先使用后端返回的 subType，仅在缺失时才根据名称推断
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
    const priceUnit = '/m²';

    return {
        id: dto.id,
        userPublicId: dto.userPublicId,
        name: dto.nickname || dto.companyName || '未知',
        avatar: dto.avatar || 'https://via.placeholder.com/100',
        yearsExperience: dto.yearsExperience || Math.floor(dto.completedCnt / 50) + 3,
        rating: dto.rating,
        reviewCount: dto.reviewCount || dto.completedCnt * 3,
        orgType,
        orgLabel: dto.companyName || (orgType === 'personal' ? '独立设计师' : '设计公司'),
        distance: dto.distance ? `${dto.distance.toFixed(1)}km` : '附近',
        specialty: dto.specialty || (dto.restoreRate > 95 ? '高还原度 · 精品设计' : '现代简约 · 实用主义'),
        price: `¥${priceRange}${priceUnit}`, // 兼容旧代码
        priceRange,
        priceUnit,
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
    const isCompany = dto.providerType === 2 || (dto.companyName && dto.companyName.includes('公司'));

    // 解析工种类型
    const workTypesArray = parseWorkTypesValue(dto.workTypes);

    // 工种标签映射
    const workTypeMap: Record<string, string> = {
        'mason': '瓦工',
        'electrician': '电工',
        'carpenter': '木工',
        'painter': '油漆工',
        'plumber': '水暖工',
        'general': '综合施工',
    };
    const workTypeLabels = workTypesArray.map(t => workTypeMap[t] || t).join(' · ') || (isCompany ? '全工种覆盖' : '综合施工');

    return {
        id: dto.id,
        userPublicId: dto.userPublicId,
        type: isCompany ? 'company' : 'personal',
        name: dto.nickname || dto.companyName || '未知',
        avatar: isCompany ? undefined : (dto.avatar || 'https://via.placeholder.com/100'),
        logo: isCompany ? (dto.avatar || 'https://via.placeholder.com/100') : undefined,
        yearsExperience: isCompany ? undefined : (dto.yearsExperience || Math.floor(dto.completedCnt / 50) + 5),
        establishedYear: isCompany ? (new Date().getFullYear() - (dto.yearsExperience || 10)) : undefined,
        rating: dto.rating,
        reviewCount: dto.reviewCount || dto.completedCnt * 2,
        workTypes: workTypesArray,
        workTypeLabels,
        priceRange: dto.priceMin && dto.priceMax ? `${dto.priceMin}-${dto.priceMax}` : (isCompany ? '8-15' : '300-500'),
        priceUnit: dto.priceUnit || (isCompany ? '万/全包' : '元/天'),
        completedOrders: dto.completedCnt,
        teamSize: isCompany ? Math.floor(dto.completedCnt / 30) + 10 : undefined,
        certifications: isCompany ? ['建筑装饰资质'] : undefined,
        distance: dto.distance ? `${dto.distance.toFixed(1)}km` : '附近',
        tags: isCompany
            ? (dto.verified ? ['认证商家', '品质保障'] : ['正规资质'])
            : (dto.verified ? ['实名认证', '技术过硬'] : ['服务优质']),
    };
}
