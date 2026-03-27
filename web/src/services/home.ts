import type { HomePageDataVM, InspirationListItemVM, MaterialShopListItemVM, ProviderListItemVM } from '../types/viewModels';
import { normalizeProviderRole, parseTextArray, resolveProviderDisplayName, summarizePricing } from '../utils/provider';
import { listBookings } from './bookings';
import { listDemands } from './demands';
import { listInspiration } from './inspiration';
import { listMaterialShops } from './materialShops';
import { listNotifications } from './notifications';
import { listProjects } from './projects';
import { listProposals } from './proposals';
import { listProviders } from './providers';
import { requestJson } from './http';
import { readThroughCache } from './runtimeCache';

const categories: HomePageDataVM['categories'] = [
  { id: 'designer', label: '设计师', description: '先看风格、方案能力和空间规划。' },
  { id: 'company', label: '装修公司', description: '比较交付能力、团队协同和报价体系。' },
  { id: 'foreman', label: '工长/施工', description: '重点看现场执行、工序衔接和经验。' },
  { id: 'material', label: '主材门店', description: '先比品牌、门店和主打品类。' },
];

const hotTerms = ['极简设计', '全案交付', '旧房翻新', '水电改造', '定制柜体', '卫浴主材'];
const PUBLIC_HOME_TTL_MS = 20 * 1000;

export async function getHomePageData(): Promise<HomePageDataVM> {
  const [designers, companies, foremen, materialShops, inspiration, bookings, demands, proposals, projects, notifications] = await Promise.all([
    listProviders({ role: 'designer', keyword: '', page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
    listProviders({ role: 'company', keyword: '', page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
    listProviders({ role: 'foreman', keyword: '', page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
    listMaterialShops({ page: 1, pageSize: 4, sortBy: 'recommend' }).then((result) => result.list).catch(() => []),
    listInspiration({ page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
    listBookings().catch(() => []),
    listDemands({ page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
    listProposals().catch(() => []),
    listProjects({ page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
    listNotifications({ page: 1, pageSize: 4 }).then((result) => result.list).catch(() => []),
  ]);

  return {
    categories,
    hotTerms,
    designers,
    companies,
    foremen,
    materialShops,
    inspirationHighlights: inspiration,
    reminders: [
      {
        title: '提交需求',
        count: `${demands.length}`,
        description: '先提交真实需求，再进入平台审核与商家匹配。',
        href: '/demands/new',
      },
      {
        title: '待确认报价',
        count: `${proposals.filter((item) => item.statusText.includes('待')).length}`,
        description: '新的方案正在等你确认。',
        href: '/me/proposals',
      },
      {
        title: '最近预约',
        count: `${bookings.filter((item) => item.statusText.includes('待')).length}`,
        description: '看看有没有需要继续跟进的预约。',
        href: '/me/bookings',
      },
      {
        title: '进行中项目',
        count: `${projects.filter((item) => item.statusText.includes('进行中')).length}`,
        description: '回到进度页继续查看节点和施工日志。',
        href: '/progress',
      },
      {
        title: '最新通知',
        count: `${notifications.filter((item) => !item.isRead).length}`,
        description: '系统提醒和业务通知都在这里。',
        href: '/messages',
      },
    ],
  };
}

// --- Public homepage API (no auth required) ---

interface HomepageProviderDTO {
  id: number;
  providerType?: number;
  companyName?: string;
  nickname?: string;
  avatar?: string;
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  yearsExperience?: number;
  verified?: boolean;
  specialty?: string;
  subType?: string;
  highlightTags?: string;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: string;
}

interface HomepageShopDTO {
  id: number;
  type?: string;
  name?: string;
  cover?: string;
  brandLogo?: string;
  rating?: number;
  mainProducts?: string;
  address?: string;
  isVerified?: boolean;
}

interface HomepageInspirationDTO {
  id: number;
  title?: string;
  coverImage?: string;
  style?: string;
  layout?: string;
  area?: string;
  price?: number;
  likeCount?: number;
  authorName?: string;
}

interface HomepageResponse {
  stats: { designerCount: number; companyCount: number; foremanCount: number; caseCount: number };
  featuredDesigners: HomepageProviderDTO[];
  featuredCompanies: HomepageProviderDTO[];
  featuredForemen: HomepageProviderDTO[];
  materialShops: HomepageShopDTO[];
  inspirations: HomepageInspirationDTO[];
  hotSearchTerms: string[];
}

function toProviderVM(dto: HomepageProviderDTO): ProviderListItemVM {
  const role = normalizeProviderRole(dto.providerType);
  const pricing = summarizePricing(dto.highlightTags, dto.priceMin, dto.priceMax, dto.priceUnit, role);
  const displayName = resolveProviderDisplayName(role, dto.companyName, dto.nickname);
  return {
    id: dto.id,
    role,
    name: displayName,
    orgLabel: role === 'designer' ? '设计师' : role === 'company' ? '装修公司' : '工长施工',
    avatar: dto.avatar || 'https://placehold.co/1200x900/e7eaef/0f172a?text=HZ',
    summary: dto.specialty || '支持前期沟通、现场勘测与分项报价。',
    rating: Number(dto.rating || 0),
    reviewCount: Number(dto.reviewCount || 0),
    completedCount: Number(dto.completedCnt || 0),
    yearsExperience: Number(dto.yearsExperience || 0),
    verified: Boolean(dto.verified),
    priceText: pricing.priceText,
    tags: parseTextArray(dto.highlightTags).slice(0, 3),
    serviceArea: [],
  };
}

function toShopVM(dto: HomepageShopDTO): MaterialShopListItemVM {
  return {
    id: dto.id,
    type: dto.type || 'showroom',
    name: dto.name || '',
    cover: dto.cover || '',
    brandLogo: dto.brandLogo,
    rating: Number(dto.rating || 0),
    reviewCount: 0,
    mainProducts: parseTextArray(dto.mainProducts),
    productCategories: [],
    address: dto.address || '',
    distance: '',
    openTime: '',
    tags: [],
    isVerified: Boolean(dto.isVerified),
  };
}

function toInspirationVM(dto: HomepageInspirationDTO): InspirationListItemVM {
  return {
    id: dto.id,
    title: dto.title || '',
    coverImage: dto.coverImage || '',
    style: dto.style || '',
    layout: dto.layout || '',
    area: dto.area || '',
    priceText: dto.price ? `${(dto.price / 10000).toFixed(0)}万` : '',
    authorName: dto.authorName || '官方',
    authorAvatar: '',
    likeCount: Number(dto.likeCount || 0),
    commentCount: 0,
  };
}

export interface PublicHomePageData {
  stats: HomepageResponse['stats'];
  designers: ProviderListItemVM[];
  companies: ProviderListItemVM[];
  foremen: ProviderListItemVM[];
  materialShops: MaterialShopListItemVM[];
  inspirationHighlights: InspirationListItemVM[];
  hotTerms: string[];
  categories: HomePageDataVM['categories'];
}

export async function getPublicHomePageData(): Promise<PublicHomePageData> {
  return readThroughCache(
    'homepage:public',
    PUBLIC_HOME_TTL_MS,
    async () => {
      const resp = await requestJson<HomepageResponse>('/homepage', { skipAuth: true });
      return {
        stats: resp.stats,
        designers: resp.featuredDesigners.map(toProviderVM),
        companies: resp.featuredCompanies.map(toProviderVM),
        foremen: resp.featuredForemen.map(toProviderVM),
        materialShops: resp.materialShops.map(toShopVM),
        inspirationHighlights: resp.inspirations.map(toInspirationVM),
        hotTerms: resp.hotSearchTerms,
        categories,
      };
    },
    'public',
  );
}
