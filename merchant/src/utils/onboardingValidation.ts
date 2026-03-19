const UNIFIED_SOCIAL_CREDIT_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const UNIFIED_SOCIAL_CREDIT_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

export const normalizeLicenseNo = (value: string): string => value.replace(/\s+/g, '').toUpperCase();

export const isValidChineseIDCard = (value: string): boolean => {
    const id = value.trim().toUpperCase();
    if (!/^\d{17}[\dX]$/.test(id)) {
        return false;
    }

    const year = Number(id.slice(6, 10));
    const month = Number(id.slice(10, 12));
    const day = Number(id.slice(12, 14));
    const date = new Date(year, month - 1, day);
    if (
        Number.isNaN(date.getTime())
        || date.getFullYear() !== year
        || date.getMonth() + 1 !== month
        || date.getDate() !== day
    ) {
        return false;
    }

    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    const sum = id
        .slice(0, 17)
        .split('')
        .reduce((acc, char, index) => acc + Number(char) * weights[index], 0);

    return checkMap[sum % 11] === id[17];
};

export const isValidUnifiedSocialCreditCode = (rawValue: string): boolean => {
    const value = normalizeLicenseNo(rawValue);
    if (!/^[0-9A-Z]{18}$/.test(value)) {
        return false;
    }

    const chars = value.split('');
    if (chars.some((char) => !UNIFIED_SOCIAL_CREDIT_CHARSET.includes(char))) {
        return false;
    }

    const sum = chars
        .slice(0, 17)
        .reduce((acc, char, index) => acc + UNIFIED_SOCIAL_CREDIT_CHARSET.indexOf(char) * UNIFIED_SOCIAL_CREDIT_WEIGHTS[index], 0);
    const checkCode = UNIFIED_SOCIAL_CREDIT_CHARSET[(31 - (sum % 31)) % 31];
    return checkCode === chars[17];
};

export const isValidLegacyBusinessLicenseNo = (rawValue: string): boolean => /^\d{15}$/.test(normalizeLicenseNo(rawValue));

export const isValidBusinessLicenseNo = (rawValue: string): boolean => {
    const value = normalizeLicenseNo(rawValue);
    return isValidUnifiedSocialCreditCode(value) || isValidLegacyBusinessLicenseNo(value);
};
