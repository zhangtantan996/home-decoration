import React, { useEffect } from 'react';
import { Select, Spin } from 'antd';
import type { SelectProps } from 'antd';
import { useDictStore } from '../stores/dictStore';

interface DictSelectProps extends Omit<SelectProps, 'options'> {
    /**
     * 字典分类代码
     * 例如：'style' | 'layout' | 'budget_range' | 'renovation_type'
     */
    category: string;
}

/**
 * 数据字典选择器组件
 *
 * 使用示例：
 * ```tsx
 * <DictSelect category="style" placeholder="请选择装修风格" />
 * ```
 */
export const DictSelect: React.FC<DictSelectProps> = ({
    category,
    ...restProps
}) => {
    const { loadDict, getDictOptions, loading } = useDictStore();

    useEffect(() => {
        loadDict(category);
    }, [category, loadDict]);

    const options = getDictOptions(category);
    const isLoading = loading[category];

    return (
        <Select
            {...restProps}
            showSearch
            optionFilterProp="label"
            notFoundContent={isLoading ? <Spin size="small" /> : '暂无数据'}
            options={options}
        />
    );
};
