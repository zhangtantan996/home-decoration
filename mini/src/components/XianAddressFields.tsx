import React, { useEffect, useMemo, useState } from 'react';
import { Picker, Text, View } from '@tarojs/components';

import { Input } from '@/components/Input';
import { listDistricts, type RegionNode } from '@/services/regions';
import {
  buildXianFullAddress,
  XIAN_CITY_CODE,
  XIAN_CITY_NAME,
} from '@/utils/xianAddress';

import './XianAddressFields.scss';

export interface XianAddressValue {
  cityName: string;
  cityCode: string;
  districtName: string;
  districtCode: string;
  detailAddress: string;
  fullAddress: string;
}

interface XianAddressFieldsProps {
  value: Partial<XianAddressValue>;
  onChange: (value: XianAddressValue) => void;
  className?: string;
  detailPlaceholder?: string;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

const toAddressValue = (
  value: Partial<XianAddressValue>,
  patch: Partial<XianAddressValue> = {},
): XianAddressValue => {
  const next = {
    cityName: XIAN_CITY_NAME,
    cityCode: XIAN_CITY_CODE,
    districtName: value.districtName || '',
    districtCode: value.districtCode || '',
    detailAddress: value.detailAddress || '',
    ...patch,
  };

  return {
    ...next,
    fullAddress: buildXianFullAddress(next.districtName, next.detailAddress),
  };
};

export const XianAddressFields: React.FC<XianAddressFieldsProps> = ({
  value,
  onChange,
  className,
  detailPlaceholder = '请输入街道、小区或门牌号',
}) => {
  const [districts, setDistricts] = useState<RegionNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;

    const fetchDistricts = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const result = await listDistricts(XIAN_CITY_CODE);
        if (!mounted) return;
        setDistricts(Array.isArray(result) ? result : []);
        if (!Array.isArray(result) || result.length === 0) {
          setLoadError('区县加载失败，请稍后重试');
        }
      } catch {
        if (!mounted) return;
        setDistricts([]);
        setLoadError('区县加载失败，请稍后重试');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchDistricts();

    return () => {
      mounted = false;
    };
  }, []);

  const districtIndex = useMemo(() => {
    const index = districts.findIndex(
      (item) => item.code === value.districtCode || item.name === value.districtName,
    );
    return index >= 0 ? index : 0;
  }, [districts, value.districtCode, value.districtName]);

  const districtRange = useMemo(() => districts.map((item) => item.name), [districts]);
  const selectedDistrictName = value.districtName || '';

  const handleDistrictChange = (event: { detail: { value: number | string } }) => {
    const index = Number(event.detail.value || 0);
    const selected = districts[index];
    if (!selected) return;

    onChange(
      toAddressValue(value, {
        districtName: selected.name,
        districtCode: selected.code,
      }),
    );
  };

  const handleDetailChange = (detailAddress: string) => {
    onChange(toAddressValue(value, { detailAddress }));
  };

  return (
    <View className={buildClassName('xian-address-fields', [className])}>
      <View className="xian-address-fields__row">
        <Text className="xian-address-fields__label">城市</Text>
        <Text className="xian-address-fields__value">{XIAN_CITY_NAME}</Text>
      </View>

      <Picker
        mode="selector"
        range={districtRange}
        value={districtIndex}
        disabled={loading || districts.length === 0}
        onChange={handleDistrictChange}
      >
        <View className="xian-address-fields__row xian-address-fields__row--select">
          <Text className="xian-address-fields__label">区县</Text>
          <Text
            className={buildClassName('xian-address-fields__value', [
              !selectedDistrictName && 'xian-address-fields__value--placeholder',
            ])}
          >
            {loading ? '加载中' : selectedDistrictName || '请选择区县'}
          </Text>
        </View>
      </Picker>

      {loadError ? <Text className="xian-address-fields__error">{loadError}</Text> : null}

      <Input
        className="xian-address-fields__detail"
        label="详细地址"
        value={value.detailAddress || ''}
        onChange={handleDetailChange}
        placeholder={detailPlaceholder}
        maxLength={80}
      />
    </View>
  );
};
