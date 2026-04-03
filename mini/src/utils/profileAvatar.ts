import {
  DEFAULT_PROVIDER_AVATAR_URL,
  normalizeProviderMediaUrl,
} from '@/utils/providerMedia';

export const resolveProfileAvatarDisplayUrl = (
  primary?: string,
  secondary?: string,
) => {
  const first = normalizeProviderMediaUrl(primary, '');
  if (first) {
    return first;
  }

  const second = normalizeProviderMediaUrl(secondary, '');
  if (second) {
    return second;
  }

  return DEFAULT_PROVIDER_AVATAR_URL;
};
