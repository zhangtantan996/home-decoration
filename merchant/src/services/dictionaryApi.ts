import axios from './api';

export interface DictOption {
    value: string;
    label: string;
}

const unwrapOptions = (payload: unknown): DictOption[] => {
    if (Array.isArray(payload)) {
        return payload as DictOption[];
    }

    if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as { data?: unknown }).data)) {
        return (payload as { data: DictOption[] }).data;
    }

    return [];
};

export const dictionaryApi = {
    getOptions: async (category: string): Promise<DictOption[]> => {
        const res = await axios.get(`/dictionaries/${category}`);
        return unwrapOptions(res);
    },
};
