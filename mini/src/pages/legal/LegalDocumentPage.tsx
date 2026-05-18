import Taro, { useDidShow } from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import MiniPageNav from '@/components/MiniPageNav';
import {
  fallbackPublicSiteConfig,
  findLegalDocument,
  getPublicSiteConfig,
  type PublicLegalDocument,
  type PublicSiteConfig,
} from '@/services/publicSiteConfig';
import { navigateBackWithFallback } from '@/utils/navigation';

import './common.scss';

interface LegalDocumentPageProps {
  slug: string;
  pageTitle: string;
  eyebrow: string;
  description: string;
}

interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets: string[];
}

const LEGAL_REFRESH_INTERVAL_MS = 60 * 1000;

function buildSections(content: string): LegalSection[] {
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections: LegalSection[] = [];
  let current: LegalSection | null = null;

  blocks.forEach((block, index) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return;
    }

    const firstLine = lines[0];

    if (firstLine.startsWith('## ')) {
      current = {
        title: firstLine.slice(3),
        paragraphs: [],
        bullets: [],
      };
      sections.push(current);
      return;
    }

    if (lines.every((line) => line.startsWith('- '))) {
      if (!current) {
        current = {
          title: index === 0 ? '导言' : `说明 ${index + 1}`,
          paragraphs: [],
          bullets: [],
        };
        sections.push(current);
      }
      current.bullets.push(...lines.map((line) => line.slice(2)));
      return;
    }

    if (!current) {
      current = {
        title: index === 0 ? '导言' : `说明 ${index + 1}`,
        paragraphs: [],
        bullets: [],
      };
      sections.push(current);
    }

    if (firstLine.startsWith('### ')) {
      current.paragraphs.push(firstLine.slice(4));
      if (lines.length > 1) {
        current.paragraphs.push(lines.slice(1).join('\n'));
      }
      return;
    }

    current.paragraphs.push(lines.join('\n'));
  });

  return sections;
}

export default function LegalDocumentPage({ slug, pageTitle, eyebrow, description }: LegalDocumentPageProps) {
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig>(fallbackPublicSiteConfig);
  const [loading, setLoading] = useState(true);

  const refreshConfig = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const nextConfig = await getPublicSiteConfig();
      setSiteConfig(nextConfig);
    } catch {
      // Keep current content readable; fallback is already loaded in state.
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshConfig(true);
    const timer = setInterval(() => {
      void refreshConfig(false);
    }, LEGAL_REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [refreshConfig]);

  useDidShow(() => {
    void refreshConfig(false);
  });

  const document = useMemo<PublicLegalDocument>(
    () => findLegalDocument(siteConfig, slug),
    [siteConfig, slug],
  );

  const sections = useMemo(() => buildSections(document.content), [document.content]);

  return (
    <View className="mini-legal">
      <MiniPageNav title={pageTitle} onBack={() => navigateBackWithFallback('/pages/home/index')} placeholder />

      <View className="mini-legal__content">
        <View className="mini-legal__hero">
          <Text className="mini-legal__eyebrow">{eyebrow}</Text>
          <Text className="mini-legal__title">{document.title}</Text>
          <Text className="mini-legal__description">{description}</Text>
          <Text className="mini-legal__meta">
            版本 {document.version} · 生效日期 {document.effectiveDate}
            {loading ? ' · 正在同步最新配置' : ''}
          </Text>
        </View>

        {sections.map((section) => (
          <View key={`${document.slug}-${section.title}`} className="mini-legal__section">
            <Text className="mini-legal__section-title">{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={`${section.title}-${paragraph.slice(0, 16)}`} className="mini-legal__section-text">
                {paragraph}
              </Text>
            ))}
            {section.bullets.length > 0 ? (
              <View className="mini-legal__list">
                {section.bullets.map((bullet) => (
                  <View key={`${section.title}-${bullet.slice(0, 16)}`} className="mini-legal__list-item">
                    <Text className="mini-legal__list-dot">•</Text>
                    <Text className="mini-legal__list-text">{bullet}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
