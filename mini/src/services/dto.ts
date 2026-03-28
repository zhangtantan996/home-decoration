export type ProviderType = 'designer' | 'company' | 'foreman';
type StringListValue = string | string[];

export interface ProviderDTO {
  id: number;
  userId: number;
  providerType: number;
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
  subType: string;
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
  serviceArea?: StringListValue;
  isSettled?: boolean;
}

export interface ProviderDetailDTO {
  provider?: {
    id?: number;
    userId?: number;
    providerType?: number;
    companyName?: string;
    avatar?: string;
    verified?: boolean;
    completedCnt?: number;
    rating?: number;
    yearsExperience?: number;
    specialty?: string;
    highlightTags?: StringListValue;
    pricingJson?: string;
    graduateSchool?: string;
    designPhilosophy?: string;
    serviceArea?: StringListValue;
    serviceIntro?: string;
    teamSize?: number;
    establishedYear?: number;
    followersCount?: number;
    officeAddress?: string;
    certifications?: StringListValue;
    companyAlbumJson?: StringListValue;
    priceMin?: number;
    priceMax?: number;
    priceUnit?: string;
    coverImage?: string;
    isSettled?: boolean;
  };
  user?: {
    id?: number;
    publicId?: string;
    nickname?: string;
    avatar?: string;
  };
  id: number;
  userId: number;
  providerType: number;
  companyName?: string;
  nickname?: string;
  avatar?: string;
  rating?: number;
  completedCnt?: number;
  verified?: boolean;
  coverImage?: string;
  serviceIntro?: string;
  teamSize?: number;
  establishedYear?: number;
  certifications?: StringListValue;
  serviceArea?: StringListValue;
  officeAddress?: string;
  companyAlbumJson?: StringListValue;
  specialty?: string;
  highlightTags?: StringListValue;
  pricingJson?: string;
  graduateSchool?: string;
  designPhilosophy?: string;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: string;
  isSettled?: boolean;
  cases?: ProviderCaseDTO[];
  caseCount?: number;
}

export interface ProviderCaseDTO {
  id: number;
  title: string;
  coverImage: string;
  images?: StringListValue;
  style?: string;
  area?: string | number;
  layout?: string;
  year?: string | number;
  price?: number;
}

export interface ProposalDTO {
  id: number;
  bookingId: number;
  designerId: number;
  summary: string;
  designFee: number;
  constructionFee: number;
  materialFee: number;
  estimatedDays: number;
  attachments: string;
  status: number;
  version: number;
  parentProposalId?: number;
  rejectionCount: number;
  rejectionReason?: string;
  submittedAt?: string;
  userResponseDeadline?: string;
}

export interface OrderDTO {
  id: number;
  orderNo: string;
  orderType: string;
  totalAmount: number;
  paidAmount: number;
  discount: number;
  status: 0 | 1 | 2 | 3;
  projectId?: number;
  proposalId?: number;
  bookingId?: number;
  expireAt?: string;
  paidAt?: string;
  createdAt?: string;
}

export interface PendingPaymentDTO {
  type: 'intent_fee' | 'design_fee' | 'construction_fee';
  id: number;
  orderNo: string;
  amount: number;
  providerId: number;
  providerName: string;
  address?: string;
  expireAt?: string;
  createdAt?: string;
}

export interface ProjectDTO {
  id: number;
  name: string;
  address: string;
  area?: number;
  budget?: number;
  status?: number;
  businessStage?: string;
  flowSummary?: string;
  availableActions?: string[];
  createdAt?: string;
}

export interface ProjectRiskSummaryDTO {
  pausedAt?: string;
  resumedAt?: string;
  pauseReason?: string;
  pauseInitiator?: string;
  disputedAt?: string;
  disputeReason?: string;
  disputeEvidence?: string[];
  auditId?: number;
  auditStatus?: string;
  escrowFrozen?: boolean;
  escrowStatus?: number;
  frozenAmount?: number;
}

export interface ProjectPhaseTaskDTO {
  id: number;
  name: string;
  isCompleted: boolean;
}

export interface ProjectPhaseDTO {
  id: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | string;
  startDate?: string;
  endDate?: string;
  tasks?: ProjectPhaseTaskDTO[];
}

export interface ProjectDetailDTO extends ProjectDTO {
  selectedQuoteTaskId?: number;
  milestones?: Array<Record<string, unknown>>;
  logs?: Array<Record<string, unknown>>;
  escrow?: Record<string, unknown>;
  riskSummary?: ProjectRiskSummaryDTO;
}

export interface RefundTypeEstimateDTO {
  type: 'intent_fee' | 'design_fee' | 'construction_fee' | 'full';
  label: string;
  amount: number;
  orderId?: number;
}

export interface RefundSummaryDTO {
  canApplyRefund: boolean;
  latestRefundId?: number;
  latestRefundStatus?: string;
  refundableAmount: number;
  refundableTypes: RefundTypeEstimateDTO[];
}

export interface RefundApplicationDTO {
  id: number;
  bookingId: number;
  projectId?: number;
  orderId?: number;
  userId: number;
  refundType: 'intent_fee' | 'design_fee' | 'construction_fee' | 'full';
  refundAmount: number;
  requestedAmount: number;
  approvedAmount: number;
  reason: string;
  evidence: string[];
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminId?: number;
  adminNotes?: string;
  approvedAt?: string;
  rejectedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  booking?: {
    id: number;
    address?: string;
    status?: number;
    intentFee?: number;
  };
  project?: {
    id: number;
    name?: string;
    status?: number;
    currentPhase?: string;
  };
  order?: {
    id: number;
    orderNo?: string;
    orderType?: string;
    totalAmount?: number;
    status?: number;
  };
}

export interface NotificationDTO {
  id: number;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt?: string;
  actionUrl?: string;
}

export interface InspirationAuthorDTO {
  id: number;
  name: string;
  avatar: string;
}

export interface InspirationItemDTO {
  id: number;
  title: string;
  coverImage: string;
  style: string;
  layout: string;
  area: string;
  price: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isFavorited: boolean;
  author: InspirationAuthorDTO;
}

export interface InspirationDetailDTO {
  id: number;
  providerId?: number;
  title: string;
  coverImage: string;
  style: string;
  layout: string;
  area: string;
  price: number;
  description?: string;
  images: string[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isFavorited: boolean;
  author?: InspirationAuthorDTO;
}

export interface InspirationCommentDTO {
  id: number;
  content: string;
  createdAt: string;
  user: InspirationAuthorDTO;
}

export interface FavoriteItemDTO {
  id: number;
  targetId: number;
  targetType: 'case' | 'material_shop';
  title: string;
  coverImage: string;
  createdAt: string;
}
