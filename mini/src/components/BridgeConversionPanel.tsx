import { Text, View } from '@tarojs/components';
import React from 'react';

import type {
  BridgeConversionSectionDTO,
  BridgeConversionSubjectComparisonDTO,
  BridgeConversionSummaryDTO,
} from '@/services/dto';

import { Tag } from './Tag';
import './BridgeConversionPanel.scss';

export interface BridgeConversionPanelProps {
  summary?: BridgeConversionSummaryDTO | null;
  title?: string;
  flowSummary?: string;
  stageText?: string;
  className?: string;
}

const buildClassName = (base: string, extra?: string) => [base, extra].filter(Boolean).join(' ');

const getConstructionSubjectLabel = (type?: string) => {
  if (type === 'company') return '公司施工主体';
  if (type === 'foreman') return '独立工长主体';
  return '施工主体';
};

const getTrustFootprint = (summary?: BridgeConversionSummaryDTO | null) => {
  if (!summary?.trustSignals) return '';
  return `案例 ${summary.trustSignals.caseCount || 0} 个 · 完工 ${summary.trustSignals.completedCnt || 0} 个 · 评价 ${summary.trustSignals.reviewCount || 0} 条`;
};

const renderSectionCard = (section?: BridgeConversionSectionDTO) => {
  if (!section?.items?.length) return null;
  return (
    <View key={section.title || section.items.join('-')} className="bridge-conversion-panel__section-card">
      <Text className="bridge-conversion-panel__section-title">{section.title || '桥接说明'}</Text>
      <Text className="bridge-conversion-panel__section-copy">{section.items.join('；')}</Text>
    </View>
  );
};

const renderSubjectCard = (item: BridgeConversionSubjectComparisonDTO) => {
  return (
    <View
      key={`${item.providerId || 0}-${item.displayName || 'subject'}`}
      className="bridge-conversion-panel__subject-card"
    >
      <View className="bridge-conversion-panel__subject-top">
        <Text className="bridge-conversion-panel__subject-name">{item.displayName || '施工主体'}</Text>
        <Tag variant={item.selected ? 'brand' : 'default'}>
          {getConstructionSubjectLabel(item.subjectType)}
        </Tag>
      </View>
      <Text className="bridge-conversion-panel__subject-copy">
        {item.deliveryHint || item.trustSummary || '待补充施工主体说明'}
      </Text>
      {item.priceHint ? (
        <Text className="bridge-conversion-panel__subject-price">{item.priceHint}</Text>
      ) : null}
      {item.highlightTags?.length ? (
        <Text className="bridge-conversion-panel__subject-tags">
          {item.highlightTags.slice(0, 3).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
};

export const BridgeConversionPanel: React.FC<BridgeConversionPanelProps> = ({
  summary,
  title = '施工桥接解释',
  flowSummary,
  stageText,
  className,
}) => {
  if (!summary) return null;

  const metrics = [
    { label: '报价基线', value: summary.quoteBaselineSummary?.title || '待同步' },
    { label: '下一责任人', value: summary.bridgeNextStep?.owner || '待平台继续推进' },
    { label: '可对比主体', value: `${summary.constructionSubjectComparison?.length || 0} 个` },
    {
      label: '平台保障',
      value: summary.trustSignals?.officialReviewHint || '平台会展示案例、评价与履约标签',
    },
  ];
  const sections = [
    summary.responsibilityBoundarySummary,
    summary.scheduleAndAcceptanceSummary,
    summary.platformGuaranteeSummary,
  ].filter(Boolean);
  const trustFootprint = getTrustFootprint(summary);

  return (
    <View className={buildClassName('bridge-conversion-panel', className)}>
      <View className="bridge-conversion-panel__head">
        <View className="bridge-conversion-panel__head-main">
          <Text className="bridge-conversion-panel__title">{title}</Text>
          {flowSummary ? (
            <Text className="bridge-conversion-panel__subtitle">{flowSummary}</Text>
          ) : null}
        </View>
        <View className="bridge-conversion-panel__meta">
          {stageText ? <Tag variant="default">{stageText}</Tag> : null}
          {summary.bridgeNextStep?.actionText ? (
            <Tag variant="brand">{summary.bridgeNextStep.actionText}</Tag>
          ) : null}
        </View>
      </View>

      {summary.bridgeNextStep?.reason ? (
        <View className="bridge-conversion-panel__hero">
          <Text className="bridge-conversion-panel__hero-copy">{summary.bridgeNextStep.reason}</Text>
          {summary.bridgeNextStep.actionHint ? (
            <Text className="bridge-conversion-panel__hero-hint">{summary.bridgeNextStep.actionHint}</Text>
          ) : null}
          {summary.bridgeNextStep.blockingHint ? (
            <Text className="bridge-conversion-panel__hero-blocking">{summary.bridgeNextStep.blockingHint}</Text>
          ) : null}
        </View>
      ) : null}

      <View className="bridge-conversion-panel__metrics">
        {metrics.map((item) => (
          <View key={item.label} className="bridge-conversion-panel__metric">
            <Text className="bridge-conversion-panel__metric-label">{item.label}</Text>
            <Text className="bridge-conversion-panel__metric-value">{item.value}</Text>
          </View>
        ))}
      </View>

      {summary.quoteBaselineSummary?.highlights?.length ? (
        <View className="bridge-conversion-panel__baseline">
          <Text className="bridge-conversion-panel__section-title">报价基线说明</Text>
          <Text className="bridge-conversion-panel__section-copy">
            {summary.quoteBaselineSummary.highlights.join('；')}
          </Text>
        </View>
      ) : null}

      {summary.constructionSubjectComparison?.length ? (
        <View className="bridge-conversion-panel__subject-list">
          <Text className="bridge-conversion-panel__section-title">施工主体对比</Text>
          <View className="bridge-conversion-panel__subject-grid">
            {summary.constructionSubjectComparison.slice(0, 3).map(renderSubjectCard)}
          </View>
        </View>
      ) : null}

      {sections.length ? (
        <View className="bridge-conversion-panel__section-grid">
          {sections.map((item) => renderSectionCard(item))}
        </View>
      ) : null}

      {trustFootprint ? (
        <View className="bridge-conversion-panel__trust">
          <Text className="bridge-conversion-panel__trust-copy">{trustFootprint}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default BridgeConversionPanel;
