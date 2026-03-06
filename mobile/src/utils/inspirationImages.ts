import { getApiBaseUrl } from '../config';

export const DEFAULT_INSPIRATION_IMAGE_PATH = '/static/inspiration/default-cover.png';
export const DEFAULT_INSPIRATION_AVATAR_PATH = '/static/inspiration/default-avatar.png';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type InspirationImageSource = {
    coverImage?: unknown;
    image?: unknown;
    images?: unknown;
};

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function toNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => toNonEmptyString(item))
        .filter((item): item is string => Boolean(item));
}

function getFallbackUrl(path: string): string {
    const baseUrl = trimTrailingSlash(getApiBaseUrl());
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function normalizeOptionalInspirationImageUrl(value: unknown): string | undefined {
    const raw = toNonEmptyString(value);
    if (!raw) {
        return undefined;
    }

    if (raw.startsWith('data:image/')) {
        return raw;
    }

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) && !/^https?:/i.test(raw)) {
        return undefined;
    }

    if (/^https?:\/\//i.test(raw)) {
        try {
            const current = new URL(raw);
            if (__DEV__ && LOOPBACK_HOSTS.has(current.hostname.toLowerCase())) {
                const base = new URL(getApiBaseUrl());
                return `${base.origin}${current.pathname}${current.search}${current.hash}`;
            }
        } catch {
            return undefined;
        }

        return raw;
    }

    const baseUrl = trimTrailingSlash(getApiBaseUrl());
    return `${baseUrl}/${raw.replace(/^\/+/, '')}`;
}

export function parseInspirationImages(value: unknown): string[] {
    if (Array.isArray(value)) {
        return toStringArray(value);
    }

    const raw = toNonEmptyString(value);
    if (!raw) {
        return [];
    }

    if (!['[', '{', '"'].includes(raw[0])) {
        return [raw];
    }

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return toStringArray(parsed);
        }

        const parsedString = toNonEmptyString(parsed);
        return parsedString ? [parsedString] : [];
    } catch {
        return [];
    }
}

export function normalizeInspirationImageUrl(
    value: unknown,
    fallbackPath = DEFAULT_INSPIRATION_IMAGE_PATH,
): string {
    return normalizeOptionalInspirationImageUrl(value) ?? getFallbackUrl(fallbackPath);
}

export function getInspirationGalleryImages(source: InspirationImageSource): string[] {
    const candidates = [
        source.coverImage,
        source.image,
        ...parseInspirationImages(source.images),
    ];

    const normalized = candidates
        .map((item) => normalizeOptionalInspirationImageUrl(item))
        .filter((item): item is string => Boolean(item));

    const uniqueImages = [...new Set(normalized)];
    return uniqueImages.length > 0
        ? uniqueImages
        : [getFallbackUrl(DEFAULT_INSPIRATION_IMAGE_PATH)];
}

export function getInspirationCoverImage(source: InspirationImageSource): string {
    return getInspirationGalleryImages(source)[0];
}

export function getInspirationAvatarUrl(value: unknown): string {
    return normalizeInspirationImageUrl(value, DEFAULT_INSPIRATION_AVATAR_PATH);
}
