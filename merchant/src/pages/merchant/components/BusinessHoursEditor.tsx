import React from 'react';
import { Input } from 'antd';

import type { BusinessHoursRange } from '../../../services/merchantApi';

const DEFAULT_START = '09:00';
const DEFAULT_END = '18:00';

const normalizeTime = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value : fallback;

const normalizeRange = (value?: BusinessHoursRange[]): BusinessHoursRange => {
    const first = Array.isArray(value) && value.length > 0 ? value[0] : undefined;

    return {
        day: 1,
        start: normalizeTime(first?.start, DEFAULT_START),
        end: normalizeTime(first?.end, DEFAULT_END),
    };
};

export const summarizeBusinessHoursRanges = (value?: BusinessHoursRange[]) => {
    const range = normalizeRange(value);
    return `${range.start}-${range.end}`;
};

interface BusinessHoursEditorProps {
    value?: BusinessHoursRange[];
    onChange?: (value: BusinessHoursRange[]) => void;
}

const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({ value, onChange }) => {
    const range = React.useMemo(() => normalizeRange(value), [value]);

    React.useEffect(() => {
        const first = Array.isArray(value) ? value[0] : undefined;
        const hasNormalizedValue =
            Array.isArray(value) &&
            value.length === 1 &&
            !!first &&
            first.day === 1 &&
            first.start === range.start &&
            first.end === range.end;

        if (!hasNormalizedValue) {
            onChange?.([range]);
        }
    }, [onChange, range, value]);

    const updateTime = (field: 'start' | 'end', nextValue: string) => {
        const safeValue = nextValue || (field === 'start' ? DEFAULT_START : DEFAULT_END);

        if (field === 'start') {
            onChange?.([{ day: 1, start: safeValue, end: range.end }]);
            return;
        }

        onChange?.([{ day: 1, start: range.start, end: safeValue }]);
    };

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
                <Input
                    type="time"
                    value={range.start}
                    style={{ flex: '1 1 140px', minWidth: 0 }}
                    onChange={(event) => updateTime('start', event.target.value)}
                />
                <Input
                    type="time"
                    value={range.end}
                    style={{ flex: '1 1 140px', minWidth: 0 }}
                    onChange={(event) => updateTime('end', event.target.value)}
                />
            </div>
        </div>
    );
};

export default BusinessHoursEditor;
