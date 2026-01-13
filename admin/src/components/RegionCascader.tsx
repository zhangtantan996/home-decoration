import React from 'react';
import { Cascader } from 'antd';
import type { CascaderProps } from 'antd';
import { useRegionCascader, type RegionCascaderOption } from '../services/regionApi';

interface RegionCascaderProps {
    value?: string[];
    onChange?: (value: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * 行政区划级联选择器组件
 * 用于选择省-市-区三级行政区划
 */
const RegionCascader: React.FC<RegionCascaderProps> = ({
    value,
    onChange,
    placeholder = '请选择省-市-区',
    disabled = false,
}) => {
    const { options, loading, loadData } = useRegionCascader();

    const handleChange: CascaderProps<RegionCascaderOption>['onChange'] = (value) => {
        onChange?.(value as string[]);
    };

    return (
        <Cascader
            options={options}
            loadData={loadData}
            onChange={handleChange}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            loading={loading}
            changeOnSelect
            style={{ width: '100%' }}
            showSearch={{
                filter: (inputValue, path) =>
                    path.some((option) => option.label.toLowerCase().includes(inputValue.toLowerCase())),
            }}
        />
    );
};

export default RegionCascader;
