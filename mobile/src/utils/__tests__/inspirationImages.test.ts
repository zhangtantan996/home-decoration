jest.mock('../../config', () => ({
    getApiBaseUrl: jest.fn(() => 'http://api.example.com'),
}));

import {
    DEFAULT_INSPIRATION_AVATAR_PATH,
    DEFAULT_INSPIRATION_IMAGE_PATH,
    getInspirationAvatarUrl,
    getInspirationCoverImage,
    getInspirationGalleryImages,
    normalizeInspirationImageUrl,
    parseInspirationImages,
} from '../inspirationImages';

describe('inspirationImages', () => {
    it('parses images arrays and filters empty values', () => {
        expect(parseInspirationImages(['/a.jpg', '', '  ', null, '/b.jpg'])).toEqual(['/a.jpg', '/b.jpg']);
    });

    it('parses JSON strings into image arrays', () => {
        expect(parseInspirationImages('["/a.jpg", "gallery/b.jpg", null, ""]')).toEqual([
            '/a.jpg',
            'gallery/b.jpg',
        ]);
    });

    it('returns an empty array for bad JSON', () => {
        expect(parseInspirationImages('[not valid json')).toEqual([]);
    });

    it('merges coverImage and images, normalizes relatives, and removes duplicates', () => {
        expect(
            getInspirationGalleryImages({
                coverImage: '/cover.jpg',
                images: '["/detail-1.jpg", "detail-2.jpg", "/cover.jpg"]',
            }),
        ).toEqual([
            'http://api.example.com/cover.jpg',
            'http://api.example.com/detail-1.jpg',
            'http://api.example.com/detail-2.jpg',
        ]);
    });

    it('uses images when coverImage is missing', () => {
        expect(
            getInspirationCoverImage({
                images: '["/detail-only.jpg"]',
            }),
        ).toBe('http://api.example.com/detail-only.jpg');
    });

    it('normalizes relative paths to first-party absolute URLs', () => {
        expect(normalizeInspirationImageUrl('/uploads/a.jpg')).toBe('http://api.example.com/uploads/a.jpg');
        expect(normalizeInspirationImageUrl('uploads/b.jpg')).toBe('http://api.example.com/uploads/b.jpg');
    });

    it('falls back to first-party defaults for empty or bad links', () => {
        expect(normalizeInspirationImageUrl('', DEFAULT_INSPIRATION_IMAGE_PATH)).toBe(
            'http://api.example.com/static/inspiration/default-cover.png',
        );
        expect(getInspirationAvatarUrl('ftp://invalid-avatar.example.com/avatar.png')).toBe(
            'http://api.example.com/static/inspiration/default-avatar.png',
        );
        expect(getInspirationCoverImage({ images: '[not valid json' })).toBe(
            'http://api.example.com/static/inspiration/default-cover.png',
        );
        expect(DEFAULT_INSPIRATION_AVATAR_PATH).toBe('/static/inspiration/default-avatar.png');
    });
});
