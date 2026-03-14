export type ProviderRole = 'designer' | 'company' | 'foreman';
export type HomeServiceCategory = ProviderRole | 'material';

export interface ProviderListItemVM {
  id: number;
  role: ProviderRole;
  name: string;
  orgLabel: string;
  avatar: string;
  summary: string;
  rating: number;
  reviewCount: number;
  completedCount: number;
  yearsExperience: number;
  verified: boolean;
  priceText: string;
  tags: string[];
  serviceArea: string[];
  userPublicId?: string;
}

export interface MaterialShopListItemVM {
  id: number;
  type: string;
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
}

export interface ProviderCaseVM {
  id: number;
  title: string;
  coverImage: string;
  style: string;
  area: string;
}

export interface ProviderReviewVM {
  id: number;
  userName: string;
  userAvatar: string;
  rating: number;
  content: string;
  createdAt: string;
  tags: string[];
}

export interface ReviewStatsVM {
  rating: number;
  restoreRate: number;
  budgetControl: number;
  totalCount: number;
}

export interface ProviderDetailVM extends ProviderListItemVM {
  coverImage: string;
  serviceIntro: string;
  officeAddress: string;
  teamSize: number;
  establishedText: string;
  certifications: string[];
  priceDetails: string[];
  cases: ProviderCaseVM[];
  reviews: ProviderReviewVM[];
  reviewStats: ReviewStatsVM;
  phoneHint: string;
}

export interface InspirationListItemVM {
  id: number;
  title: string;
  coverImage: string;
  style: string;
  layout: string;
  area: string;
  priceText: string;
  authorName: string;
  authorAvatar: string;
  likeCount: number;
  commentCount: number;
}

export interface InspirationDetailVM extends InspirationListItemVM {
  description: string;
  galleryImages: string[];
  isLiked: boolean;
  isFavorited: boolean;
}

export interface BookingListItemVM {
  id: number;
  title: string;
  statusText: string;
  preferredDate: string;
  budgetRange: string;
  address: string;
  href: string;
  providerType: ProviderRole;
  providerTypeText: string;
  updatedAt: string;
}

export interface BookingTimelineItemVM {
  title: string;
  description: string;
  state: 'done' | 'active' | 'pending';
}

export interface BookingDetailVM {
  id: number;
  statusText: string;
  address: string;
  areaText: string;
  preferredDate: string;
  renovationType: string;
  budgetRange: string;
  notes: string;
  intentFeeText: string;
  intentFeePaid: boolean;
  proposalId?: number;
  providerName: string;
  providerSummary: string;
  providerAvatar: string;
  providerType: ProviderRole;
  updatedAt: string;
  timeline: BookingTimelineItemVM[];
}

export interface ProposalListItemVM {
  id: number;
  summary: string;
  status: number;
  statusText: string;
  designFeeText: string;
  submittedAt: string;
  href: string;
}

export interface ProposalOrderPlanVM {
  id: number;
  name: string;
  amountText: string;
  statusText: string;
  dueAt: string;
}

export interface ProposalDetailVM {
  id: number;
  status: number;
  statusText: string;
  version: number;
  summary: string;
  estimatedDays: number;
  submittedAt: string;
  responseDeadline: string;
  designFeeText: string;
  constructionFeeText: string;
  materialFeeText: string;
  totalFeeText: string;
  rejectionReason: string;
  hasOrder: boolean;
  orderId?: number;
  orderStatusText: string;
  orderStatus: number | null;
  orderNo: string;
  projectId?: number;
  planItems: ProposalOrderPlanVM[];
  canConfirm: boolean;
  blockingReason: string;
}

export interface DemandSummaryVM {
  id: number;
  demandType: string;
  title: string;
  city: string;
  district: string;
  area: number;
  budgetMin: number;
  budgetMax: number;
  timeline: string;
  status: string;
  matchedCount: number;
  maxMatch: number;
  reviewNote: string;
  closedReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandProposalVM {
  id: number;
  summary: string;
  designFee: number;
  constructionFee: number;
  materialFee: number;
  estimatedDays: number;
  status: number;
  version: number;
  submittedAt: string;
  responseDeadline: string;
  attachments: string[];
}

export interface DemandProviderVM {
  id: number;
  userId: number;
  name: string;
  avatar: string;
  rating: number;
  completedCnt: number;
  verified: boolean;
  providerType: number;
  subType: string;
  yearsExperience: number;
  specialty: string;
  serviceArea: string[];
}

export interface DemandMatchVM {
  id: number;
  status: string;
  assignedAt: string;
  responseDeadline: string;
  respondedAt: string;
  declineReason: string;
  proposalId?: number;
  provider: DemandProviderVM;
  proposal?: DemandProposalVM;
}

export interface DemandDetailVM extends DemandSummaryVM {
  address: string;
  stylePref: string;
  description: string;
  attachments: Array<{ url: string; name: string; size: number }>;
  reviewedAt: string;
  reviewerId: number;
  matches: DemandMatchVM[];
}

export interface DemandCandidateVM {
  provider: DemandProviderVM;
  matchScore: number;
  scoreReason: string[];
}

export interface ContractVM {
  id: number;
  projectId: number;
  demandId: number;
  providerId: number;
  userId: number;
  contractNo: string;
  title: string;
  totalAmount: number;
  status: string;
  paymentPlan: Array<{ phase?: number; name?: string; amount?: number; percentage?: number; trigger_event?: string }>;
  attachmentUrls: string[];
  confirmedAt: string;
}

export interface ComplaintListItemVM {
  id: number;
  projectId: number;
  category: string;
  title: string;
  description: string;
  status: string;
  resolution: string;
  merchantResponse: string;
  freezePayment: boolean;
  createdAt: string;
}

export interface ProjectListItemVM {
  id: number;
  name: string;
  address: string;
  currentPhase: string;
  statusText: string;
  budgetText: string;
  href: string;
}

export interface ProjectPhaseVM {
  id: number;
  name: string;
  status: string;
  statusText: string;
  startDate: string;
  endDate: string;
  tasks: string[];
}

export interface ProjectMilestoneVM {
  id: number;
  name: string;
  seq: number;
  amountText: string;
  status: string;
  statusText: string;
  criteria: string;
  acceptedAt: string;
}

export interface ProjectLogVM {
  id: number;
  title: string;
  description: string;
  logDate: string;
  photos: string[];
}

export interface ProjectEscrowTransactionVM {
  id: number;
  type: string;
  amountText: string;
  statusText: string;
  createdAt: string;
}

export interface ProjectEscrowVM {
  totalAmountText: string;
  frozenAmountText: string;
  releasedAmountText: string;
  balanceText: string;
  transactions: ProjectEscrowTransactionVM[];
}

export interface ProjectFileVM {
  name: string;
  url: string;
}

export interface ProjectBillingPlanVM {
  id: number;
  name: string;
  amountText: string;
  statusText: string;
  dueAt: string;
}

export interface ProjectBillingItemVM {
  id: number;
  orderNo: string;
  amountText: string;
  statusText: string;
  planItems: ProjectBillingPlanVM[];
}

export interface ProjectDetailVM {
  id: number;
  name: string;
  address: string;
  currentPhase: string;
  statusText: string;
  areaText: string;
  budgetText: string;
  ownerName: string;
  providerName: string;
  escrowBalanceText: string;
  phases: ProjectPhaseVM[];
  milestones: ProjectMilestoneVM[];
}

export interface ProgressPageVM {
  projects: ProjectListItemVM[];
  featuredProject: ProjectDetailVM | null;
  recentLogs: ProjectLogVM[];
  pendingMilestones: ProjectMilestoneVM[];
}

export interface OrderListItemVM {
  id: number;
  orderNo: string;
  status: number;
  statusText: string;
  amountText: string;
  providerName: string;
  address: string;
  nextPayableAt: string;
  proposalId?: number;
  projectId?: number;
}

export interface MessageListItemVM {
  id: number;
  title: string;
  content: string;
  actionUrl: string;
  createdAt: string;
  isRead: boolean;
  type: string;
}

export interface AfterSalesListItemVM {
  id: number;
  bookingId: number;
  orderNo: string;
  type: 'refund' | 'complaint' | 'repair';
  typeText: string;
  reason: string;
  amountText: string;
  status: number;
  statusText: string;
  createdAt: string;
}

export interface AfterSalesDetailVM extends AfterSalesListItemVM {
  description: string;
  reply: string;
  resolvedAt: string;
  images: string[];
}

export interface SettingsFormVM {
  notifySystem: boolean;
  notifyProject: boolean;
  notifyPayment: boolean;
  fontSize: string;
  language: string;
}

export interface ProfileShortcutVM {
  key: string;
  title: string;
  description: string;
  countText: string;
  href?: string;
  highlight?: boolean;
}

export interface ProfileFeedItemVM {
  id: number;
  title: string;
  subtitle: string;
  meta: string;
  href?: string;
}

export interface ProfileHomeVM {
  displayName: string;
  phoneText: string;
  avatar: string;
  unreadCount: number;
  pendingPaymentsCount: number;
  summaryCards: Array<{ title: string; value: string; description: string }>;
  todos: Array<{ title: string; value: string; description: string; href?: string }>;
  shortcuts: ProfileShortcutVM[];
  recentBookings: ProfileFeedItemVM[];
  recentProposals: ProfileFeedItemVM[];
  activeProjects: ProfileFeedItemVM[];
  pendingPayments: ProfileFeedItemVM[];
  latestMessages: ProfileFeedItemVM[];
  settingsSummary: string[];
}

export interface HomeCategoryVM {
  id: HomeServiceCategory;
  label: string;
  description: string;
}

export interface HomePageDataVM {
  categories: HomeCategoryVM[];
  hotTerms: string[];
  designers: ProviderListItemVM[];
  companies: ProviderListItemVM[];
  foremen: ProviderListItemVM[];
  materialShops: MaterialShopListItemVM[];
  inspirationHighlights: InspirationListItemVM[];
  reminders: Array<{ title: string; count: string; description: string; href: string }>;
}
