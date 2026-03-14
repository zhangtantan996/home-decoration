import React, { memo } from 'react';

import { Worker } from '../types/provider';
import ServiceProviderCard from './provider/ServiceProviderCard';

interface WorkerCardProps {
    worker: Worker;
    onPress: (worker: Worker) => void;
    onBookPress: (worker: Worker, type: string) => void;
}

export const WorkerCard = memo(({ worker, onPress, onBookPress: _onBookPress }: WorkerCardProps) => {
    const identityLabel = worker.type === 'company' ? '装修公司' : '工长';
    const leadMeta = worker.type === 'company'
        ? (worker.establishedYear ? `成立${new Date().getFullYear() - worker.establishedYear}年` : '团队施工')
        : `${worker.yearsExperience || 0}年经验`;
    const descriptor = worker.type === 'company'
        ? `团队${worker.teamSize || 0}人`
        : '施工服务';

    return (
        <ServiceProviderCard
            imageUri={worker.avatar || worker.logo}
            name={worker.name}
            identityLabel={identityLabel}
            metaItems={[leadMeta, `${worker.rating}分`, worker.distance]}
            descriptor={descriptor}
            supportingText={worker.serviceLabel}
            quote={worker.quoteDisplay}
            tags={worker.tags}
            onPress={() => onPress(worker)}
        />
    );
});
