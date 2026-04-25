export const XIAN_CITY_NAME = '西安市';
export const XIAN_CITY_SHORT_NAME = '西安';
export const XIAN_CITY_CODE = '610100';

const trimAddress = (value?: string) => String(value || '').replace(/\s+/g, '').trim();

export const normalizeXianDetailAddress = (districtName: string, detailAddress: string) => {
  let detail = trimAddress(detailAddress);
  const district = trimAddress(districtName);

  if (detail.startsWith(XIAN_CITY_NAME)) {
    detail = detail.slice(XIAN_CITY_NAME.length);
  } else if (detail.startsWith(XIAN_CITY_SHORT_NAME)) {
    detail = detail.slice(XIAN_CITY_SHORT_NAME.length);
  }

  if (district && detail.startsWith(district)) {
    detail = detail.slice(district.length);
  }

  return detail;
};

export const buildXianFullAddress = (districtName: string, detailAddress: string) => {
  const district = trimAddress(districtName);
  const detail = normalizeXianDetailAddress(district, detailAddress);
  return `${XIAN_CITY_NAME}${district}${detail}`;
};

export const parseXianAddress = (address: string, districtName?: string) => {
  const raw = trimAddress(address);
  const district = trimAddress(districtName);
  let detail = raw;

  if (detail.startsWith(XIAN_CITY_NAME)) {
    detail = detail.slice(XIAN_CITY_NAME.length);
  } else if (detail.startsWith(XIAN_CITY_SHORT_NAME)) {
    detail = detail.slice(XIAN_CITY_SHORT_NAME.length);
  }

  if (district && detail.startsWith(district)) {
    detail = detail.slice(district.length);
  }

  return {
    cityName: XIAN_CITY_NAME,
    cityCode: XIAN_CITY_CODE,
    districtName: district,
    detailAddress: detail,
    fullAddress: district ? buildXianFullAddress(district, detail) : raw,
  };
};
