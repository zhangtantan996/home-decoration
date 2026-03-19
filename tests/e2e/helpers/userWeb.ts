import { expect, type Page, type Route } from '@playwright/test';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
};

export const userWebFixtureIds = {
  designerId: 101,
  bookingId: 9001,
  proposalId: 9101,
  orderId: 9201,
  projectId: 9301,
  demandId: 9401,
  demandProposalId: 9402,
  quoteTaskId: 9501,
  quoteSubmissionId: 9502,
  inspirationDraftAuditId: 9601,
  inspirationId: 7001,
  materialShopId: 8101,
};

const providerList = [
  {
    id: userWebFixtureIds.designerId,
    userPublicId: 'designer-public-id',
    providerType: 1,
    companyName: '拾光设计工作室',
    nickname: '拾光设计',
    avatar: 'https://placehold.co/200x200/e4e4e7/27272a?text=SD',
    rating: 4.8,
    reviewCount: 18,
    completedCnt: 36,
    yearsExperience: 8,
    verified: true,
    specialty: '老房改造、收纳优化、动线梳理',
    highlightTags: '["预算透明","节点清晰","响应快"]',
    serviceArea: '["雁塔区","高新区"]',
    priceMin: 120,
    priceMax: 260,
    priceUnit: '元/㎡',
    subType: 'studio',
  },
  {
    id: 202,
    userPublicId: 'company-public-id',
    providerType: 2,
    companyName: '匠心整装',
    nickname: '匠心整装',
    avatar: 'https://placehold.co/200x200/e4e4e7/27272a?text=JG',
    rating: 4.6,
    reviewCount: 25,
    completedCnt: 52,
    yearsExperience: 10,
    verified: true,
    specialty: '全案设计施工、工地管控',
    highlightTags: '["工期稳定","工地透明","主材协同"]',
    serviceArea: '["曲江新区","航天基地"]',
    priceMin: 98000,
    priceMax: 188000,
    priceUnit: '元/套',
    subType: 'company',
  },
  {
    id: 303,
    userPublicId: 'foreman-public-id',
    providerType: 3,
    companyName: '老陈工长',
    nickname: '老陈工长',
    avatar: 'https://placehold.co/200x200/e4e4e7/27272a?text=FM',
    rating: 4.7,
    reviewCount: 16,
    completedCnt: 44,
    yearsExperience: 12,
    verified: true,
    specialty: '拆改、水电、泥木油统筹',
    highlightTags: '["现场管理","工序稳","返工少"]',
    serviceArea: '["长安区","高新区"]',
    priceMin: 380,
    priceMax: 680,
    priceUnit: '元/天',
    subType: 'foreman',
  },
];

const inspirationList = [
  {
    id: userWebFixtureIds.inspirationId,
    title: '雁塔区 98㎡ 旧房焕新',
    coverImage: 'https://placehold.co/960x720/e4e4e7/27272a?text=INS-1',
    style: '现代简约',
    layout: '三室两厅',
    area: '98㎡',
    price: 220000,
    likeCount: 18,
    commentCount: 5,
    isLiked: false,
    isFavorited: true,
    author: {
      id: userWebFixtureIds.designerId,
      name: '拾光设计',
      avatar: 'https://placehold.co/80x80/e4e4e7/27272a?text=AU',
    },
  },
  {
    id: 7002,
    title: '高新区 120㎡ 三代同堂改造',
    coverImage: 'https://placehold.co/960x720/e4e4e7/27272a?text=INS-2',
    style: '奶油原木',
    layout: '四室两厅',
    area: '120㎡',
    price: 360000,
    likeCount: 9,
    commentCount: 2,
    isLiked: false,
    isFavorited: false,
    author: {
      id: 202,
      name: '匠心整装',
      avatar: 'https://placehold.co/80x80/e4e4e7/27272a?text=AU2',
    },
  },
];

const materialShops = [
  {
    id: userWebFixtureIds.materialShopId,
    type: 'showroom',
    name: '西安整装主材馆',
    cover: 'https://placehold.co/960x720/e4e4e7/27272a?text=SHOP-1',
    brandLogo: 'https://placehold.co/160x80/e4e4e7/27272a?text=LOGO',
    rating: 4.7,
    reviewCount: 32,
    mainProducts: ['瓷砖', '卫浴', '地板'],
    productCategories: ['瓷砖', '卫浴', '地板'],
    address: '西安市高新区丈八一路 56 号',
    distance: '3.2km',
    openTime: '09:00-18:30',
    tags: ['到店选材', '品牌合作'],
    isVerified: true,
  },
];

const ok = <T>(route: Route, data: T, status = 200) => route.fulfill({
  status,
  contentType: 'application/json; charset=utf-8',
  headers: corsHeaders,
  body: JSON.stringify({ code: 0, message: 'ok', data }),
});

const unauthorized = (route: Route) => route.fulfill({
  status: 401,
  contentType: 'application/json; charset=utf-8',
  headers: corsHeaders,
  body: JSON.stringify({ code: 401, message: '未登录', data: null }),
});

const parseBody = (route: Route) => {
  try {
    return route.request().postDataJSON() as Record<string, unknown>;
  } catch {
    return {};
  }
};

const hasAuth = (route: Route) => Boolean(route.request().headers().authorization);

const mockProviderDetail = () => {
  const provider = providerList[0];
  return {
    provider: {
      id: provider.id,
      providerType: provider.providerType,
      companyName: provider.companyName,
      avatar: provider.avatar,
      verified: provider.verified,
      completedCnt: provider.completedCnt,
      rating: provider.rating,
      yearsExperience: provider.yearsExperience,
      specialty: provider.specialty,
      highlightTags: provider.highlightTags,
      serviceArea: provider.serviceArea,
      serviceIntro: '先梳理真实需求，再给户型方案和施工边界，不用一上来就被迫进复杂流程。',
      priceMin: provider.priceMin,
      priceMax: provider.priceMax,
      priceUnit: provider.priceUnit,
      coverImage: 'https://placehold.co/1280x540/27272a/faf7ef?text=%E6%8B%BE%E5%85%89%E8%AE%BE%E8%AE%A1',
      subType: provider.subType,
      officeAddress: '西安市高新区科技路 188 号',
      teamSize: 6,
      establishedYear: 2018,
      certifications: '["平台认证","营业执照"]',
    },
    user: {
      id: 501,
      publicId: provider.userPublicId,
      nickname: provider.nickname,
      avatar: provider.avatar,
      phone: '13900000001',
    },
    cases: inspirationList,
    reviews: [
      {
        id: 8001,
        userName: '王女士',
        userAvatar: 'https://placehold.co/80x80/e4e4e7/27272a?text=W',
        rating: 4.9,
        content: '预算透明，节点清晰，施工安排很稳。',
        createdAt: '2026-02-20T10:00:00Z',
        tags: '["预算透明","节点清晰"]',
      },
    ],
    reviewCount: 18,
  };
};

type UserWebMockOptions = {
  initialBusinessStage?: 'construction_quote_pending' | 'ready_to_start' | 'milestone_review' | 'completed' | 'archived';
};

export async function mockUserWebApi(page: Page, options: UserWebMockOptions = {}) {
  const state = {
    booking: {
      booking: {
        id: userWebFixtureIds.bookingId,
        providerId: userWebFixtureIds.designerId,
        providerType: 'designer',
        address: '西安市高新区云杉路 88 号',
        area: 98,
        preferredDate: '2026-03-20',
        renovationType: '全屋整装',
        budgetRange: '10-30万',
        phone: '13900000001',
        notes: '希望优先解决收纳和采光问题。',
        houseLayout: '三室两厅',
        intentFee: 99,
        intentFeePaid: true,
        status: 1,
        createdAt: '2026-03-12T09:00:00Z',
      },
      provider: {
        id: userWebFixtureIds.designerId,
        name: '拾光设计',
        avatar: 'https://placehold.co/120x120/e4e4e7/27272a?text=SD',
        rating: 4.8,
        completedCnt: 36,
        yearsExperience: 8,
        specialty: '老房改造、收纳优化、动线梳理',
        providerType: 1,
        verified: true,
      },
      proposalId: userWebFixtureIds.proposalId,
    },
    siteSurvey: {
      id: 9701,
      status: 'submitted',
      notes: '首次量房完成，客厅采光较好。',
      photos: [
        'https://placehold.co/400x300/e4e4e7/27272a?text=SURVEY-1',
        'https://placehold.co/400x300/e4e4e7/27272a?text=SURVEY-2',
      ],
      dimensions: {
        客厅: { length: 5.2, width: 4.6, height: 2.8, unit: 'm' },
        主卧: { length: 4.0, width: 3.6, height: 2.8, unit: 'm' },
      },
      submittedAt: '2026-03-18T09:00:00Z',
      confirmedAt: '',
      revisionRequestedAt: '',
      revisionRequestReason: '',
    },
    budgetConfirmation: {
      id: 9702,
      status: 'submitted',
      budgetMin: 50000,
      budgetMax: 80000,
      includes: {
        design_fee: true,
        construction_fee: true,
        material_fee: true,
        furniture_fee: false,
      },
      notes: '包含基础施工和主材，不含家具软装。',
      designIntent: '现代简约，强化收纳与采光。',
      submittedAt: '2026-03-19T10:00:00Z',
      acceptedAt: '',
      rejectedAt: '',
      rejectionReason: '',
    },
    completion: {
      projectId: userWebFixtureIds.projectId,
      completedPhotos: [
        'https://placehold.co/400x300/e4e4e7/27272a?text=COMPLETE-1',
        'https://placehold.co/400x300/e4e4e7/27272a?text=COMPLETE-2',
      ],
      completionNotes: '柜体、灯具和收口均已完成，建议重点验看柜门缝隙与乳胶漆补色。',
      completionSubmittedAt: '2026-03-26T18:00:00Z',
      completionRejectedAt: '',
      completionRejectionReason: '',
      inspirationCaseDraftId: 0,
    },
    proposalConfirmed: false,
    demandStatus: 'matched',
    settings: {
      notifySystem: true,
      notifyProject: true,
      notifyPayment: true,
      fontSize: 'medium',
      language: 'zh',
    },
    businessStage: options.initialBusinessStage || 'construction_quote_pending',
    quoteTaskConfirmed: false,
    inspirationDraftCreated: false,
    milestones: [
      {
        id: 1,
        seq: 1,
        name: '水电验收',
        amount: 66000,
        percentage: 30,
        status: 3,
        criteria: '线路、给排水和试压记录全部合格。',
        acceptedAt: '2026-03-12T10:00:00Z',
      },
      {
        id: 2,
        seq: 2,
        name: '泥木验收',
        amount: 66000,
        percentage: 30,
        status: 2,
        criteria: '木作基层与瓦工排砖到位。',
        acceptedAt: '',
      },
    ],
  };

  const getFlowSummary = () => {
    switch (state.businessStage) {
      case 'construction_quote_pending':
        return '施工报价待用户确认';
      case 'ready_to_start':
        return '施工报价已确认，项目待开工';
      case 'milestone_review':
        return '节点已提交，待用户验收';
      case 'completed':
        return '施工方已提交完工材料，待业主整体验收';
      case 'archived':
        return '项目已归档，案例草稿已生成';
      default:
        return '业务主链处理中';
    }
  };

  const getAvailableActions = () => {
    switch (state.businessStage) {
      case 'construction_quote_pending':
        return ['confirm_construction_quote', 'reject_construction_quote'];
      case 'ready_to_start':
        return ['start_project'];
      case 'milestone_review':
        return ['approve_milestone', 'reject_milestone'];
      case 'completed':
        return ['approve_completion', 'reject_completion'];
      default:
        return [];
    }
  };

  const getCurrentPhase = () => {
    switch (state.businessStage) {
      case 'construction_quote_pending':
        return '待确认施工报价';
      case 'ready_to_start':
        return '待开工';
      case 'in_progress':
        return state.completion.completionRejectedAt ? '完工整改中' : '泥木阶段';
      case 'milestone_review':
        return '泥木验收';
      case 'completed':
        return '已完工待验收';
      case 'archived':
        return '已归档';
      default:
        return '泥木阶段';
    }
  };

  const getProjectStatus = () => {
    if (state.businessStage === 'completed' || state.businessStage === 'archived') {
      return 1;
    }
    return 0;
  };

  const getBookingStage = () => {
    if (state.budgetConfirmation.status === 'accepted') return 'design_pending_submission';
    if (state.budgetConfirmation.status === 'rejected') return 'cancelled';
    return 'negotiating';
  };

  const getBookingFlowSummary = () => {
    if (state.budgetConfirmation.status === 'accepted') return '预算与设计意向已确认，待商家提交设计方案。';
    if (state.budgetConfirmation.status === 'rejected') return '预算已拒绝，预约已关闭。';
    if (state.siteSurvey.status === 'revision_requested') return '已要求重新量房，等待商家补测后重提。';
    if (state.siteSurvey.status === 'confirmed') return '量房已确认，待商家提交预算与设计意向。';
    return '沟通进行中，待确认量房与预算。';
  };

  const getBookingAvailableActions = () => {
    if (state.budgetConfirmation.status === 'submitted') return ['accept_budget_confirm', 'reject_budget_confirm'];
    if (state.siteSurvey.status === 'submitted') return ['confirm_site_survey', 'reject_site_survey'];
    return [];
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (path === '/auth/send-code' && method === 'POST') {
      await ok(route, { expiresIn: 300, debugCode: '123456', debugOnly: true });
      return;
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = parseBody(route);
      await ok(route, {
        token: 'user-web-token',
        refreshToken: 'user-web-refresh-token',
        expiresIn: 7200,
        user: {
          id: 1,
          phone: String(body.phone || '13900000001'),
          nickname: '测试业主',
          userType: 1,
          avatar: 'https://placehold.co/160x160/e4e4e7/27272a?text=ME',
        },
      });
      return;
    }

    if (path === '/auth/refresh' && method === 'POST') {
      await ok(route, {
        token: 'user-web-token-refreshed',
        refreshToken: 'user-web-refresh-token-refreshed',
        expiresIn: 7200,
      });
      return;
    }

    if (!hasAuth(route) && path !== '/auth/send-code' && path !== '/auth/login' && path !== '/auth/refresh') {
      await unauthorized(route);
      return;
    }

    if (path === '/user/profile' && method === 'GET') {
      await ok(route, {
        id: 1,
        publicId: 'test-owner-public-id',
        phone: '13900000001',
        nickname: '测试业主',
        avatar: 'https://placehold.co/160x160/e4e4e7/27272a?text=ME',
        userType: 1,
      });
      return;
    }

    if (path === '/user/settings' && method === 'GET') {
      await ok(route, state.settings);
      return;
    }

    if (path === '/user/settings' && method === 'PUT') {
      state.settings = {
        ...state.settings,
        ...(parseBody(route) as typeof state.settings),
      };
      await ok(route, state.settings);
      return;
    }

    if (path === '/notifications' && method === 'GET') {
      await ok(route, {
        list: [
          {
            id: 5001,
            title: '报价待确认',
            content: '拾光设计提交了新的方案版本，请尽快确认。',
            actionUrl: `/proposals/${userWebFixtureIds.proposalId}`,
            createdAt: '2026-03-13T08:30:00Z',
            isRead: false,
          },
          {
            id: 5002,
            title: '需求已有新方案',
            content: '整装需求已收到新的商家方案，可进入对比页查看。',
            actionUrl: `/demands/${userWebFixtureIds.demandId}/compare`,
            createdAt: '2026-03-12T09:00:00Z',
            isRead: true,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
      });
      return;
    }

    if (path === '/notifications/unread-count' && method === 'GET') {
      await ok(route, { count: 1 });
      return;
    }

    if (path === '/orders' && method === 'GET') {
      await ok(route, {
        list: [
          {
            id: userWebFixtureIds.orderId,
            orderNo: 'DES-9201',
            status: state.proposalConfirmed ? 1 : 0,
            amount: 12000,
            providerName: '拾光设计',
            address: '西安市高新区云杉路 88 号',
            nextPayableAt: '2026-03-14T08:00:00Z',
            proposalId: userWebFixtureIds.proposalId,
            projectId: userWebFixtureIds.projectId,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });
      return;
    }

    if (path === '/orders/pending-payments' && method === 'GET') {
      await ok(route, {
        items: [
          {
            type: 'design_fee',
            id: userWebFixtureIds.orderId,
            orderNo: 'DES-9201',
            amount: 12000,
            providerId: userWebFixtureIds.designerId,
            providerName: '拾光设计',
            address: '西安市高新区云杉路 88 号',
            expireAt: '2026-03-14T08:00:00Z',
            createdAt: '2026-03-12T08:00:00Z',
          },
        ],
        total: 1,
      });
      return;
    }

    if (path === '/upload' && method === 'POST') {
      await ok(route, {
        url: 'https://example.com/uploads/floor-plan.jpg',
        path: '/uploads/floor-plan.jpg',
        filename: 'floor-plan.jpg',
        size: 102400,
      });
      return;
    }

    if (path === '/providers' && method === 'GET') {
      const type = url.searchParams.get('type');
      const keyword = (url.searchParams.get('keyword') || '').trim();
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const pageSize = Number(url.searchParams.get('pageSize') || '10');
      const filtered = providerList.filter((provider) => {
        const roleMatched = !type || (type === 'designer' && provider.providerType === 1) || (type === 'company' && provider.providerType === 2) || (type === 'foreman' && provider.providerType === 3);
        const keywordMatched = !keyword || `${provider.companyName}${provider.nickname}${provider.specialty}`.includes(keyword);
        return roleMatched && keywordMatched;
      });
      const start = (pageNumber - 1) * pageSize;
      await ok(route, {
        list: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page: pageNumber,
        pageSize,
      });
      return;
    }

    if (path === '/material-shops' && method === 'GET') {
      await ok(route, {
        list: materialShops,
        total: materialShops.length,
        page: 1,
        pageSize: 12,
      });
      return;
    }

    if (path === `/material-shops/${userWebFixtureIds.materialShopId}` && method === 'GET') {
      await ok(route, materialShops[0]);
      return;
    }

    if (path === `/designers/${userWebFixtureIds.designerId}` && method === 'GET') {
      await ok(route, mockProviderDetail());
      return;
    }

    if (path === `/designers/${userWebFixtureIds.designerId}/cases` && method === 'GET') {
      await ok(route, {
        list: inspirationList,
        total: inspirationList.length,
        page: 1,
        pageSize: 6,
      });
      return;
    }

    if (path === `/designers/${userWebFixtureIds.designerId}/reviews` && method === 'GET') {
      await ok(route, {
        list: [
          {
            id: 8001,
            userName: '王女士',
            userAvatar: 'https://placehold.co/80x80/e4e4e7/27272a?text=W',
            rating: 4.9,
            content: '预算透明，节点清晰，施工安排很稳。',
            createdAt: '2026-02-20T10:00:00Z',
            tags: '["预算透明","节点清晰"]',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 4,
      });
      return;
    }

    if (path === `/designers/${userWebFixtureIds.designerId}/review-stats` && method === 'GET') {
      await ok(route, {
        rating: 4.8,
        restoreRate: 94,
        budgetControl: 91,
        totalCount: 18,
      });
      return;
    }

    if (path === '/inspiration' && method === 'GET') {
      await ok(route, {
        list: inspirationList,
        total: inspirationList.length,
        page: 1,
        pageSize: 12,
      });
      return;
    }

    if (path === `/cases/${userWebFixtureIds.inspirationId}` && method === 'GET') {
      await ok(route, {
        id: userWebFixtureIds.inspirationId,
        title: '雁塔区 98㎡ 旧房焕新',
        coverImage: 'https://placehold.co/960x720/e4e4e7/27272a?text=INS-1',
        images: '["https://placehold.co/960x720/e4e4e7/27272a?text=INS-1","https://placehold.co/960x720/e4e4e7/27272a?text=INS-1B"]',
        style: '现代简约',
        layout: '三室两厅',
        area: '98㎡',
        price: 220000,
        description: '通过收纳重组、餐厨动线优化和采光改造，让老房住起来更顺。',
        likeCount: 18,
        commentCount: 5,
        isLiked: false,
        isFavorited: true,
        author: {
          id: userWebFixtureIds.designerId,
          name: '拾光设计',
          avatar: 'https://placehold.co/80x80/e4e4e7/27272a?text=AU',
        },
      });
      return;
    }

    if (path === '/bookings' && method === 'GET') {
      await ok(route, [state.booking.booking]);
      return;
    }

    if (path === '/bookings' && method === 'POST') {
      const body = parseBody(route);
      state.booking = {
        ...state.booking,
        booking: {
          ...state.booking.booking,
          id: userWebFixtureIds.bookingId,
          address: String(body.address || state.booking.booking.address),
          area: Number(body.area || state.booking.booking.area),
          preferredDate: String(body.preferredDate || state.booking.booking.preferredDate),
          budgetRange: String(body.budgetRange || state.booking.booking.budgetRange),
          notes: String(body.notes || state.booking.booking.notes),
          phone: String(body.phone || state.booking.booking.phone),
          intentFeePaid: false,
        },
      };
      await ok(route, { id: userWebFixtureIds.bookingId });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}` && method === 'GET') {
      await ok(route, {
        ...state.booking,
        flowSummary: getBookingFlowSummary(),
        availableActions: getBookingAvailableActions(),
        currentStage: getBookingStage(),
        siteSurveySummary: state.siteSurvey,
        budgetConfirmSummary: state.budgetConfirmation,
      });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/pay-intent` && method === 'POST') {
      state.booking.booking.intentFeePaid = true;
      await ok(route, state.booking.booking);
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/site-survey` && method === 'GET') {
      await ok(route, { siteSurvey: state.siteSurvey });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/site-survey/confirm` && method === 'POST') {
      state.siteSurvey.status = 'confirmed';
      state.siteSurvey.confirmedAt = '2026-03-20T11:00:00Z';
      state.siteSurvey.revisionRequestedAt = '';
      state.siteSurvey.revisionRequestReason = '';
      await ok(route, { siteSurvey: state.siteSurvey });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/site-survey/reject` && method === 'POST') {
      const body = parseBody(route);
      state.siteSurvey.status = 'revision_requested';
      state.siteSurvey.confirmedAt = '';
      state.siteSurvey.revisionRequestedAt = '2026-03-20T11:05:00Z';
      state.siteSurvey.revisionRequestReason = String(body.reason || '请重新量房');
      await ok(route, { siteSurvey: state.siteSurvey });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/budget-confirm` && method === 'GET') {
      await ok(route, { budgetConfirmation: state.budgetConfirmation });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/budget-confirm/accept` && method === 'POST') {
      state.budgetConfirmation.status = 'accepted';
      state.budgetConfirmation.acceptedAt = '2026-03-20T12:00:00Z';
      state.budgetConfirmation.rejectedAt = '';
      state.budgetConfirmation.rejectionReason = '';
      await ok(route, { budgetConfirmation: state.budgetConfirmation });
      return;
    }

    if (path === `/bookings/${userWebFixtureIds.bookingId}/budget-confirm/reject` && method === 'POST') {
      const body = parseBody(route);
      state.budgetConfirmation.status = 'rejected';
      state.budgetConfirmation.acceptedAt = '';
      state.budgetConfirmation.rejectedAt = '2026-03-20T12:05:00Z';
      state.budgetConfirmation.rejectionReason = String(body.reason || '预算超出预期');
      state.booking.booking.status = 4;
      await ok(route, { budgetConfirmation: state.budgetConfirmation });
      return;
    }

    if (path === '/demands' && method === 'GET') {
      await ok(route, {
        list: [
          {
            id: userWebFixtureIds.demandId,
            demandType: 'renovation',
            title: '西安 98㎡ 老房翻新',
            city: '西安',
            district: '雁塔区',
            area: 98,
            budgetMin: 120000,
            budgetMax: 220000,
            timeline: '3month',
            status: state.demandStatus,
            matchedCount: 2,
            maxMatch: 3,
            reviewNote: '平台已完成初审并开始分配商家。',
            closedReason: '',
            createdAt: '2026-03-13T08:00:00Z',
            updatedAt: '2026-03-13T09:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });
      return;
    }

    if (path === '/demands' && method === 'POST') {
      state.demandStatus = 'draft';
      await ok(route, {
        id: userWebFixtureIds.demandId,
        status: state.demandStatus,
      });
      return;
    }

    if (path === `/demands/${userWebFixtureIds.demandId}` && method === 'PUT') {
      await ok(route, {
        id: userWebFixtureIds.demandId,
        status: state.demandStatus,
      });
      return;
    }

    if (path === `/demands/${userWebFixtureIds.demandId}/submit` && method === 'POST') {
      state.demandStatus = 'submitted';
      await ok(route, { id: userWebFixtureIds.demandId, status: state.demandStatus });
      return;
    }

    if (path === `/demands/${userWebFixtureIds.demandId}` && method === 'GET') {
      await ok(route, {
        id: userWebFixtureIds.demandId,
        demandType: 'renovation',
        title: '西安 98㎡ 老房翻新',
        city: '西安',
        district: '雁塔区',
        address: '科技路 66 号',
        area: 98,
        budgetMin: 120000,
        budgetMax: 220000,
        timeline: '3month',
        stylePref: '现代简约 / 原木',
        description: '重点解决采光、收纳和餐厨动线问题。',
        attachments: [
          { url: 'https://example.com/uploads/floor-plan.jpg', name: '户型图.jpg', size: 102400 },
        ],
        status: state.demandStatus,
        matchedCount: 2,
        maxMatch: 3,
        reviewNote: '平台已完成初审并开始分配商家。',
        closedReason: '',
        createdAt: '2026-03-13T08:00:00Z',
        updatedAt: '2026-03-13T09:00:00Z',
        reviewedAt: '2026-03-13T09:00:00Z',
        reviewerId: 1,
        matches: [
          {
            id: 1,
            status: 'quoted',
            assignedAt: '2026-03-13T09:10:00Z',
            responseDeadline: '2026-03-15T09:10:00Z',
            respondedAt: '2026-03-13T15:20:00Z',
            declineReason: '',
            proposalId: userWebFixtureIds.demandProposalId,
            provider: {
              id: userWebFixtureIds.designerId,
              userId: 501,
              name: '拾光设计',
              avatar: 'https://placehold.co/120x120/e4e4e7/27272a?text=SD',
              rating: 4.8,
              completedCnt: 36,
              verified: true,
              providerType: 1,
              subType: 'designer',
              yearsExperience: 8,
              specialty: '老房改造、收纳优化、动线梳理',
              serviceArea: ['雁塔区', '高新区'],
            },
            proposal: {
              id: userWebFixtureIds.demandProposalId,
              sourceType: 'demand',
              summary: '先做餐厨一体化和主卧储物优化，再同步水电点位调整。',
              designFee: 6000,
              constructionFee: 138000,
              materialFee: 32000,
              estimatedDays: 75,
              status: 1,
              version: 1,
              submittedAt: '2026-03-13T15:20:00Z',
              responseDeadline: '2026-03-27T15:20:00Z',
              attachments: '[\"https://example.com/uploads/plan-a.pdf\"]',
            },
          },
          {
            id: 2,
            status: 'accepted',
            assignedAt: '2026-03-13T09:20:00Z',
            responseDeadline: '2026-03-15T09:20:00Z',
            respondedAt: '2026-03-13T10:00:00Z',
            declineReason: '',
            proposalId: 0,
            provider: {
              id: 202,
              userId: 502,
              name: '匠心整装',
              avatar: 'https://placehold.co/120x120/e4e4e7/27272a?text=JX',
              rating: 4.6,
              completedCnt: 52,
              verified: true,
              providerType: 2,
              subType: 'company',
              yearsExperience: 10,
              specialty: '全案设计施工、工地管控',
              serviceArea: ['雁塔区'],
            },
            proposal: null,
          },
        ],
      });
      return;
    }

    if (path === '/proposals' && method === 'GET') {
      await ok(route, [
        {
          id: userWebFixtureIds.proposalId,
          sourceType: 'booking',
          bookingId: userWebFixtureIds.bookingId,
          designerId: userWebFixtureIds.designerId,
          summary: '基于 98㎡ 老房焕新，优先处理收纳、餐厨动线和采光。',
          designFee: 12000,
          constructionFee: 168000,
          materialFee: 42000,
          estimatedDays: 75,
          status: state.proposalConfirmed ? 2 : 1,
          version: 1,
          submittedAt: '2026-03-10T08:00:00Z',
          userResponseDeadline: '2026-03-24T08:00:00Z',
        },
        {
          id: userWebFixtureIds.demandProposalId,
          sourceType: 'demand',
          demandId: userWebFixtureIds.demandId,
          demandMatchId: 1,
          summary: '西安 98㎡ 老房翻新需求报价',
          designFee: 6000,
          constructionFee: 138000,
          materialFee: 32000,
          estimatedDays: 75,
          status: 1,
          version: 1,
          submittedAt: '2026-03-13T15:20:00Z',
          userResponseDeadline: '2026-03-27T15:20:00Z',
        },
      ]);
      return;
    }

    if (path === `/proposals/${userWebFixtureIds.proposalId}` && method === 'GET') {
      await ok(route, {
        proposal: {
          id: userWebFixtureIds.proposalId,
          bookingId: userWebFixtureIds.bookingId,
          designerId: userWebFixtureIds.designerId,
          summary: '基于 98㎡ 老房焕新，优先处理收纳、餐厨动线和采光。',
          designFee: 12000,
          constructionFee: 168000,
          materialFee: 42000,
          estimatedDays: 75,
          attachments: '["https://placehold.co/600x400/e4e4e7/27272a?text=Plan"]',
          status: state.proposalConfirmed ? 2 : 1,
          version: 1,
          rejectionCount: 0,
          submittedAt: '2026-03-10T08:00:00Z',
          userResponseDeadline: '2026-03-24T08:00:00Z',
        },
        order: state.proposalConfirmed
          ? {
              id: userWebFixtureIds.orderId,
              orderNo: 'DES-9201',
              orderType: 'design',
              totalAmount: 12000,
              paidAmount: 0,
              discount: 0,
              status: 0,
              projectId: userWebFixtureIds.projectId,
              expireAt: '2026-03-14T08:00:00Z',
            }
          : null,
        hasOrder: state.proposalConfirmed,
      });
      return;
    }

    if (path === `/proposals/${userWebFixtureIds.proposalId}/confirm` && method === 'POST') {
      state.proposalConfirmed = true;
      await ok(route, {
        order: {
          id: userWebFixtureIds.orderId,
          orderNo: 'DES-9201',
          orderType: 'design',
          totalAmount: 12000,
          paidAmount: 0,
          discount: 0,
          status: 0,
          projectId: userWebFixtureIds.projectId,
        },
        message: '请在48小时内完成设计费支付',
      });
      return;
    }

    if (path === `/orders/${userWebFixtureIds.orderId}/plans` && method === 'GET') {
      await ok(route, {
        plans: [
          {
            id: 1,
            name: '设计费',
            amount: 12000,
            status: state.proposalConfirmed ? 1 : 0,
            dueAt: '2026-03-14T08:00:00Z',
          },
        ],
      });
      return;
    }

    if (path === '/projects' && method === 'GET') {
      await ok(route, {
        list: [
          {
            id: userWebFixtureIds.projectId,
            name: '云杉路旧房改造项目',
            currentPhase: getCurrentPhase(),
            status: getProjectStatus(),
            address: '西安市高新区云杉路 88 号',
            budget: 220000,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}` && method === 'GET') {
      await ok(route, {
        id: userWebFixtureIds.projectId,
        name: '云杉路旧房改造项目',
        address: '西安市高新区云杉路 88 号',
        currentPhase: getCurrentPhase(),
        status: getProjectStatus(),
        businessStage: state.businessStage,
        flowSummary: getFlowSummary(),
        availableActions: getAvailableActions(),
        selectedQuoteTaskId: state.businessStage === 'construction_quote_pending' ? userWebFixtureIds.quoteTaskId : 0,
        area: 98,
        budget: 220000,
        ownerName: '测试业主',
        providerName: '拾光设计',
        escrowBalance: 88000,
        completedPhotos: state.completion.completedPhotos,
        completionNotes: state.completion.completionNotes,
        completionSubmittedAt: state.businessStage === 'completed' || state.businessStage === 'archived' ? state.completion.completionSubmittedAt : '',
        completionRejectedAt: state.completion.completionRejectedAt,
        completionRejectionReason: state.completion.completionRejectionReason,
      });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/phases` && method === 'GET') {
      await ok(route, {
        phases: [
          {
            id: 1,
            name: '拆改与水电',
            status: 'completed',
            startDate: '2026-03-01',
            endDate: '2026-03-12',
            tasks: [
              { id: 11, name: '现场保护', isCompleted: true },
              { id: 12, name: '强弱电布线', isCompleted: true },
            ],
          },
          {
            id: 2,
            name: '泥木阶段',
            status: 'in_progress',
            startDate: '2026-03-13',
            endDate: '2026-03-26',
            tasks: [
              { id: 21, name: '瓦工排砖', isCompleted: true },
              { id: 22, name: '木作基层', isCompleted: false },
            ],
          },
        ],
      });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/milestones` && method === 'GET') {
      await ok(route, { milestones: state.milestones });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/logs` && method === 'GET') {
      await ok(route, {
        list: [
          {
            id: 3001,
            title: '泥木阶段巡检',
            description: '瓦工排砖完成，木作基层施工中，现场整洁。',
            logDate: '2026-03-18',
            photos: '[\"https://placehold.co/400x300/e4e4e7/27272a?text=LOG-1\"]',
          },
          {
            id: 3002,
            title: '水电验收完成',
            description: '强弱电布线与水管试压均已验收通过。',
            logDate: '2026-03-12',
            photos: '[]',
          },
        ],
        total: 2,
        page: 1,
        pageSize: 4,
      });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/accept` && method === 'POST') {
      state.milestones = state.milestones.map((item) => item.id === 2 ? { ...item, status: 3, acceptedAt: '2026-03-26T18:00:00Z' } : item);
      state.businessStage = 'completed';
      await ok(route, { message: '验收成功' });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/start` && method === 'POST') {
      state.businessStage = 'in_progress';
      await ok(route, { message: '项目已开工' });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/milestones/2/reject` && method === 'POST') {
      state.milestones = state.milestones.map((item) => item.id === 2 ? { ...item, status: 2 } : item);
      state.businessStage = 'milestone_review';
      await ok(route, { message: '已驳回当前节点' });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/completion` && method === 'GET') {
      await ok(route, {
        completion: {
          ...state.completion,
          businessStage: state.businessStage,
          flowSummary: getFlowSummary(),
          availableActions: getAvailableActions(),
          inspirationCaseDraftId: state.inspirationDraftCreated ? userWebFixtureIds.inspirationDraftAuditId : 0,
        },
      });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/completion/approve` && method === 'POST') {
      state.inspirationDraftCreated = true;
      state.businessStage = 'archived';
      await ok(route, {
        completion: {
          ...state.completion,
          businessStage: state.businessStage,
          flowSummary: getFlowSummary(),
          availableActions: getAvailableActions(),
          inspirationCaseDraftId: userWebFixtureIds.inspirationDraftAuditId,
        },
        auditId: userWebFixtureIds.inspirationDraftAuditId,
      });
      return;
    }

    if (path === `/projects/${userWebFixtureIds.projectId}/completion/reject` && method === 'POST') {
      const body = parseBody(route);
      state.businessStage = 'in_progress';
      state.completion.completionRejectedAt = '2026-03-26T20:00:00Z';
      state.completion.completionRejectionReason = String(body.reason || '仍需整改');
      await ok(route, {
        completion: {
          ...state.completion,
          businessStage: state.businessStage,
          flowSummary: getFlowSummary(),
          availableActions: ['submit_completion'],
          inspirationCaseDraftId: 0,
        },
      });
      return;
    }

    if (path === `/quote-tasks/${userWebFixtureIds.quoteTaskId}/user-view` && method === 'GET') {
      await ok(route, {
        quoteList: {
          id: userWebFixtureIds.quoteTaskId,
          title: '云杉路施工报价确认单',
          status: state.quoteTaskConfirmed ? 'user_confirmed' : 'submitted_to_user',
        },
        submission: {
          id: userWebFixtureIds.quoteSubmissionId,
          totalCent: 18680000,
          estimatedDays: 62,
        },
        items: [
          {
            id: 1,
            quoteListItemId: 101,
            unitPriceCent: 280000,
            amountCent: 5600000,
            remark: '拆改与基层处理',
          },
          {
            id: 2,
            quoteListItemId: 102,
            unitPriceCent: 654000,
            amountCent: 13080000,
            remark: '水电、泥木与油工合计',
          },
        ],
        taskSummary: {
          area: 98,
          layout: '三室两厅',
          renovationType: '全屋翻新',
          constructionScope: '拆改 / 水电 / 泥木 / 油工',
          serviceAreas: ['雁塔区', '高新区'],
          workTypes: ['demolition', 'hydropower', 'masonry'],
          houseUsage: '自住',
          notes: '先确认施工报价再进入开工准备',
        },
        businessStage: state.businessStage,
        flowSummary: getFlowSummary(),
        availableActions: getAvailableActions(),
      });
      return;
    }

    if (path === `/quote-submissions/${userWebFixtureIds.quoteSubmissionId}/confirm` && method === 'POST') {
      state.quoteTaskConfirmed = true;
      state.businessStage = 'ready_to_start';
      await ok(route, { message: '施工报价已确认' });
      return;
    }

    if (path === `/quote-submissions/${userWebFixtureIds.quoteSubmissionId}/reject` && method === 'POST') {
      state.quoteTaskConfirmed = false;
      state.businessStage = 'construction_quote_pending';
      await ok(route, { message: '施工报价已驳回' });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: corsHeaders,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ code: 404, message: `Unhandled mock for ${method} ${path}`, data: null }),
    });
  });
}

export async function loginThroughUi(page: Page, redirectPath = '/') {
  const normalizedRedirect = redirectPath.startsWith('/app/') ? redirectPath.replace(/^\/app/, '') : redirectPath;
  await page.goto(`/app/login?redirect=${encodeURIComponent(normalizedRedirect)}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('手机号').fill('13900000001');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await expect(page.getByText('验证码已发送，开发环境验证码：123456')).toBeVisible();
  await page.locator('#login-code').fill('123456');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '登录' }).click();
}
