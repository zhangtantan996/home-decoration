import React from 'react';
import { Button, Input, Select, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

import type { BusinessHoursRange } from '../../../services/merchantApi';

const DAY_OPTIONS = [
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' },
    { value: 0, label: '周日' },
];

const normalizeRanges = (value?: BusinessHoursRange[]) =>
    Array.isArray(value)
        ? value.filter((item) => item && typeof item.day === 'number').map((item) => ({
            day: item.day,
            start: String(item.start || ''),
            end: String(item.end || ''),
        }))
        : [];

export const summarizeBusinessHoursRanges = (value?: BusinessHoursRange[]) => {
    const ranges = normalizeRanges(value);
    return ranges.map((item) => {
        const dayLabel = DAY_OPTIONS.find((option) => option.value === item.day)?.label || `周${item.day}`;
        return `${dayLabel} ${item.start}-${item.end}`;
    }).join('；');
};

interface BusinessHoursEditorProps {
    value?: BusinessHoursRange[];
    onChange?: (value: BusinessHoursRange[]) => void;
}

const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({ value, onChange }) => {
    const ranges = normalizeRanges(value);

    const updateRange = (index: number, patch: Partial<BusinessHoursRange>) => {
        const next = [...ranges];
        next[index] = { ...next[index], ...patch };
        onChange?.(next);
    };

    const addRange = () => {
        onChange?.([...ranges, { day: 1, start: '09:00', end: '18:00' }]);
    };

    const removeRange = (index: number) => {
        onChange?.(ranges.filter((_, currentIndex) => currentIndex !== index));
    };

    return (
        <div>
            {ranges.map((item, index) => (
                <Space key={`${item.day}-${index}`} align="start" style={{ display: 'flex', marginBottom: 12 }}>
                    <Select
                        value={item.day}
                        style={{ width: 100 }}
                        options={DAY_OPTIONS}
                        onChange={(day) => updateRange(index, { day })}
                    />
                    <Input
                        type="time"
                        value={item.start}
                        style={{ width: 132 }}
                        onChange={(event) => updateRange(index, { start: event.target.value })}
                    />
                    <Input
                        type="time"
                        value={item.end}
                        style={{ width: 132 }}
                        onChange={(event) => updateRange(index, { end: event.target.value })}
                    />
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeRange(index)}
                        aria-label={`删除营业时间 ${index + 1}`}
                    />
                </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addRange}>
                添加营业时间
            </Button>
        </div>
    );
};

export default BusinessHoursEditor;
