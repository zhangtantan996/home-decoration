import React, { memo } from 'react';

import { Designer } from '../types/provider';
import ServiceProviderCard from './provider/ServiceProviderCard';

interface DesignerCardProps {
    designer: Designer;
    onPress: (designer: Designer) => void;
    onBookPress: (designer: Designer) => void;
}

export const DesignerCard = memo(({ designer, onPress, onBookPress: _onBookPress }: DesignerCardProps) => {
    const identityLabel = designer.orgType === 'personal'
        ? '个人'
        : designer.orgType === 'studio'
            ? '工作室'
            : '公司';

    return (
        <ServiceProviderCard
            imageUri={designer.avatar}
            name={designer.name}
            identityLabel={identityLabel}
            metaItems={[`${designer.yearsExperience}年经验`, `${designer.rating}分`, designer.distance]}
            descriptor={designer.orgLabel}
            supportingText={designer.specialty?.replace(/[,，]/g, ' · ')}
            quote={designer.quoteDisplay}
            onPress={() => onPress(designer)}
        />
    );
});
