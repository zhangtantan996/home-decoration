export type ProviderType = 'designer' | 'company' | 'foreman';

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
  serviceArea?: string;
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
    highlightTags?: string;
    pricingJson?: string;
    graduateSchool?: string;
    designPhilosophy?: string;
    serviceArea?: string;
    serviceIntro?: string;
    teamSize?: number;
    establishedYear?: number;
    priceMin?: number;
    priceMax?: number;
    priceUnit?: string;
    coverImage?: string;
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
  certifications?: string;
  serviceArea?: string;
  officeAddress?: string;
  specialty?: string;
  highlightTags?: string;
  pricingJson?: string;
  graduateSchool?: string;
  designPhilosophy?: string;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: string;
}

export interface ProviderCaseDTO {
  id: number;
  title: string;
  coverImage: string;
  style?: string;
  area?: number;
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
  createdAt?: string;
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
  milestones?: Array<Record<string, unknown>>;
  logs?: Array<Record<string, unknown>>;
  escrow?: Record<string, unknown>;
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
