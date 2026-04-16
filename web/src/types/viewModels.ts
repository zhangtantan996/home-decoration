export type ProviderRole = 'designer' | 'company' | 'foreman';
export type HomeServiceCategory = ProviderRole | 'material';
export type ProviderPriceDisplayMode = 'single' | 'range' | 'structured' | 'negotiable';

export interface ProviderPriceDisplayVM {
  primary: string;
  secondary: string;
  details: string[];
  mode: ProviderPriceDisplayMode;
}

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
  isSettled?: boolean;
  priceDisplay: ProviderPriceDisplayVM;
  tags: string[];
  serviceArea: string[];
}

export interface MaterialShopListItemVM {
  id: number;
  type: string;
  name: string;
  cover: string;
  brandLogo?: string;
  description?: string;
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

export interface MaterialShopProductVM {
  id: number;
  name: string;
  unit: string;
  description: string;
  price: number;
  images: string[];
  coverImage: string;
}

export interface MaterialShopDetailVM extends MaterialShopListItemVM {
  products: MaterialShopProductVM[];
}

export interface ProviderCaseVM {
  id: number;
  title: string;
  coverImage: string;
  style: string;
  area: string;
  showInInspiration?: boolean;
}

export interface ProviderSceneVM {
  id: number;
  caseId: number;
  projectId: number;
  title: string;
  coverImage: string;
  description: string;
  images: string[];
  year: string;
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
  avgRating: number;
  displayRating: number;
  sampleState: 'none' | 'small' | 'stable';
  totalCount: number;
}

export interface ProviderDetailVM extends ProviderListItemVM {
  coverImage: string;
  serviceIntro: string;
  officeAddress?: string;
  teamSize: number;
  establishedText: string;
  certifications: string[];
  cases: ProviderCaseVM[];
  scenes: ProviderSceneVM[];
  reviews: ProviderReviewVM[];
  reviewStats: ReviewStatsVM;
  phoneHint?: string;
  surveyDepositPrice?: number;
}

export interface ProviderShowcaseDetailVM {
  id: number;
  providerId: number;
  title: string;
  coverImage: string;
  style: string;
  layout: string;
  area: string;
  description: string;
  galleryImages: string[];
  year: string;
}

export interface ProviderSceneDetailVM {
  id: number;
  caseId: number;
  projectId: number;
  providerId: number;
  title: string;
  coverImage: string;
  description: string;
  galleryImages: string[];
  year: string;
  createdAt: string;
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
  state: 'done' | 'active' | 'pending' | 'danger';
}

export interface BookingInfoFieldVM {
  label: string;
  value: string;
}

export interface BookingStageOverviewVM {
  title: string;
  description: string;
  helperText: string;
}

export interface BookingDesignFeeQuoteSummaryVM {
  id: number;
  status: string;
  netAmount: number;
  expireAt?: string;
  orderId?: number;
  orderStatus?: number;
}

export interface BookingDesignDeliverableSummaryVM {
  id: number;
  status: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface BridgeSupervisorSummaryVM {
  plannedStartDate?: string;
  latestLogAt?: string;
  latestLogTitle?: string;
  unhandledRiskCount?: number;
}

export interface ConstructionSubjectComparisonItemVM {
  providerId: number;
  subjectType?: string;
  displayName: string;
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  caseCount?: number;
  highlightTags?: string[];
  priceHint?: string;
  deliveryHint?: string;
  trustSummary?: string;
  selected?: boolean;
}

export interface BridgeQuoteBaselineSummaryVM {
  title?: string;
  sourceStage?: string;
  submittedAt?: string;
  itemCount?: number;
  highlights?: string[];
  readyForUser?: boolean;
}

export interface BridgeChecklistSummaryVM {
  title?: string;
  items?: string[];
}

export interface BridgeTrustSignalsVM {
  rating?: number;
  reviewCount?: number;
  completedCnt?: number;
  caseCount?: number;
  highlightTags?: string[];
  officialReviewHint?: string;
}

export interface BridgeNextStepVM {
  title?: string;
  owner?: string;
  reason?: string;
  actionHint?: string;
}

export interface BridgeConversionSummaryVM {
  constructionSubjectComparison?: ConstructionSubjectComparisonItemVM[];
  quoteBaselineSummary?: BridgeQuoteBaselineSummaryVM;
  responsibilityBoundarySummary?: BridgeChecklistSummaryVM;
  scheduleAndAcceptanceSummary?: BridgeChecklistSummaryVM;
  platformGuaranteeSummary?: BridgeChecklistSummaryVM;
  trustSignals?: BridgeTrustSignalsVM;
  bridgeNextStep?: BridgeNextStepVM;
}

export interface ProjectClosureSummaryVM {
  completionStatus?: string;
  archiveStatus?: string;
  settlementStatus?: string;
  payoutStatus?: string;
  caseDraftStatus?: string;
  financialClosureStatus?: string;
  nextPendingAction?: string;
}

export interface BookingDetailVM {
  id: number;
  statusCode: number;
  statusText: string;
  providerId: number;
  address: string;
  areaText: string;
  preferredDate: string;
  renovationType: string;
  budgetRange: string;
  notes: string;
  depositAmountText: string;
  depositPaid: boolean;
  proposalId?: number;
  providerName: string;
  providerSummary: string;
  providerTags: string[];
  providerFacts: BookingInfoFieldVM[];
  providerAvatar: string;
  providerType: ProviderRole;
  updatedAt: string;
  timeline: BookingTimelineItemVM[];
  stageOverview: BookingStageOverviewVM;
  flowSummary?: string;
  availableActions?: string[];
  currentStage?: string;
  baselineStatus?: string;
  baselineSubmittedAt?: string;
  constructionSubjectType?: string;
  constructionSubjectId?: number;
  constructionSubjectDisplayName?: string;
  kickoffStatus?: string;
  plannedStartDate?: string;
  supervisorSummary?: BridgeSupervisorSummaryVM;
  bridgeConversionSummary?: BridgeConversionSummaryVM;
  surveyDepositSource?: string;
  surveyRefundNotice?: string;
  surveyDepositPaymentId?: number;
  siteSurveySummary?: BookingSiteSurveyVM | null;
  budgetConfirmSummary?: BookingBudgetConfirmVM | null;
  designFeeQuoteSummary?: BookingDesignFeeQuoteSummaryVM | null;
  designDeliverableSummary?: BookingDesignDeliverableSummaryVM | null;
}

export interface SurveyDimensionVM {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
}

export interface BookingSiteSurveyVM {
  id: number;
  status: string;
  statusText: string;
  notes: string;
  photos: string[];
  dimensions: Record<string, SurveyDimensionVM>;
  submittedAt?: string;
  confirmedAt?: string;
  revisionRequestedAt?: string;
  revisionRequestReason?: string;
}

export interface BookingBudgetConfirmVM {
  id: number;
  status: string;
  statusText: string;
  budgetMin: number;
  budgetMax: number;
  notes: string;
  designIntent: string;
  styleDirection: string;
  spaceRequirements: string;
  expectedDurationDays: number;
  specialRequirements: string;
  includes: Record<string, boolean>;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  lastRejectedAt?: string;
  rejectionReason?: string;
  rejectCount: number;
  rejectLimit: number;
  canResubmit: boolean;
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
  bookingId?: number;
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
  canReject: boolean;
  blockingReason: string;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  bridgeConversionSummary?: BridgeConversionSummaryVM;
  deliveryUnlocked?: boolean;
  previewSummary?: string;
  previewFloorPlanImages?: string[];
  previewEffectImages?: string[];
  previewEffectLinks?: string[];
  previewHasCad?: boolean;
  previewHasAttachments?: boolean;
  deliveryDescription?: string;
  deliveryFloorPlanImages?: string[];
  deliveryEffectImages?: string[];
  deliveryEffectLinks?: string[];
  deliveryCadFiles?: string[];
  deliveryAttachments?: string[];
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
  reviewCount: number;
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
  kickoffStatus?: string;
  plannedStartDate?: string;
}

export interface ProjectPhaseVM {
  id: number;
  name: string;
  status: string;
  statusText: string;
  startDate: string;
  endDate: string;
  responsiblePerson?: string;
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

export interface ProjectPaymentPlanVM {
  id: number;
  orderId: number;
  seq: number;
  name: string;
  amountText: string;
  statusText: string;
  activatedAt?: string;
  dueAt?: string;
  expiresAt?: string;
  payable?: boolean;
  payableReason?: string;
  planType?: string;
}

export interface ProjectChangeOrderVM {
  id: number;
  title: string;
  reason: string;
  description?: string;
  amountImpactText: string;
  timelineImpactText?: string;
  status: string;
  statusText: string;
  createdAt?: string;
  userRejectReason?: string;
  settlementReason?: string;
}

export interface ProjectDetailVM {
  id: number;
  name: string;
  address: string;
  currentPhase: string;
  statusText: string;
  startDateText?: string;
  expectedEndText?: string;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  baselineStatus?: string;
  baselineSubmittedAt?: string;
  constructionSubjectType?: string;
  constructionSubjectId?: number;
  constructionSubjectDisplayName?: string;
  kickoffStatus?: string;
  plannedStartDate?: string;
  supervisorSummary?: BridgeSupervisorSummaryVM;
  bridgeConversionSummary?: BridgeConversionSummaryVM;
  closureSummary?: ProjectClosureSummaryVM;
  selectedQuoteTaskId?: number;
  areaText: string;
  budgetText: string;
  ownerName: string;
  providerName: string;
  providerAvatar?: string;
  providerPhoneHint?: string;
  providerRoleText?: string;
  designerName?: string;
  designerAvatar?: string;
  designerPhoneHint?: string;
  escrowBalanceText: string;
  phases: ProjectPhaseVM[];
  milestones: ProjectMilestoneVM[];
  completedPhotos?: string[];
  completionNotes?: string;
  completionSubmittedAt?: string;
  completionRejectedAt?: string;
  completionRejectionReason?: string;
  paymentPlans: ProjectPaymentPlanVM[];
  nextPayablePlan?: ProjectPaymentPlanVM;
  changeOrders: ProjectChangeOrderVM[];
}

export interface ProjectCompletionVM {
  projectId: number;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  completedPhotos: string[];
  completionNotes: string;
  completionSubmittedAt?: string;
  completionRejectedAt?: string;
  completionRejectionReason?: string;
  inspirationCaseDraftId?: number;
  closureSummary?: ProjectClosureSummaryVM;
  projectReview?: {
    id: number;
    projectId: number;
    providerId: number;
    rating: number;
    content: string;
    images: string[];
    createdAt?: string;
  };
}

export interface ProgressPageVM {
  projects: ProjectListItemVM[];
  featuredProject: ProjectDetailVM | null;
  recentLogs: ProjectLogVM[];
  pendingMilestones: ProjectMilestoneVM[];
}

export interface QuoteTaskSubmissionItemVM {
  id: number;
  quoteListItemId: number;
  itemName: string;
  unit: string;
  baselineQuantity?: number;
  quotedQuantity?: number;
  quantityChangeReason?: string;
  deviationFlag?: boolean;
  unitPriceText: string;
  amountText: string;
  remark: string;
}

export interface QuoteTaskPaymentPlanVM {
  id: number;
  orderId: number;
  seq: number;
  name: string;
  amountText: string;
  dueAt?: string;
}

export interface QuoteTaskDetailVM {
  id: number;
  title: string;
  statusText: string;
  businessStage?: string;
  flowSummary?: string;
  estimatedDays: number;
  totalFeeText: string;
  taskSummary: {
    area: number;
    layout: string;
    renovationType: string;
    constructionScope: string;
    serviceAreas: string[];
    workTypes: string[];
    houseUsage: string;
    notes: string;
  };
  items: QuoteTaskSubmissionItemVM[];
  paymentPlanSummary: QuoteTaskPaymentPlanVM[];
  submissionId: number;
  bridgeConversionSummary?: BridgeConversionSummaryVM;
}

export interface OrderListItemVM {
  id: number;
  recordType: 'order' | 'payment';
  entryKey?: string;
  orderNo: string;
  orderType?: string;
  orderTypeText: string;
  status: number;
  statusText: string;
  amountText: string;
  providerName: string;
  address: string;
  createdAt: string;
  nextPayableAt: string;
  bookingId?: number;
  proposalId?: number;
  projectId?: number;
  actionPath?: string;
}

export interface OrderDetailPlanVM {
  id: number;
  name: string;
  amountText: string;
  statusText: string;
  dueAt: string;
}

export interface OrderDetailVM {
  id: number;
  orderNo: string;
  orderType: string;
  orderTypeText: string;
  status: number;
  statusText: string;
  totalAmountText: string;
  paidAmountText: string;
  discountText: string;
  createdAt: string;
  paidAt: string;
  expireAt: string;
  bookingId?: number;
  projectId?: number;
  proposalId?: number;
  primaryActionPath: string;
  primaryActionLabel: string;
  canPay: boolean;
  planItems: OrderDetailPlanVM[];
  bridgeConversionSummary?: BridgeConversionSummaryVM;
  closureSummary?: ProjectClosureSummaryVM;
  businessStage?: string;
  flowSummary?: string;
}

export interface MessageListItemVM {
  id: number;
  title: string;
  content: string;
  actionUrl: string;
  createdAt: string;
  isRead: boolean;
  type: string;
  category: 'system' | 'project' | 'payment';
  kind: 'info' | 'todo' | 'risk' | 'result' | 'governance';
  priority: 'normal' | 'high' | 'urgent';
  actionRequired: boolean;
  actionStatus: 'none' | 'pending' | 'processed' | 'expired';
  actionLabel: string;
  supportsWeb: boolean;
  supportsMini: boolean;
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
  amountText?: string;
}

export interface ProfileHomeVM {
  displayName: string;
  avatar: string;
  unreadCount: number;
  pendingPaymentsCount: number;
  summaryCards: Array<{ title: string; value: string; description: string; href?: string }>;
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
