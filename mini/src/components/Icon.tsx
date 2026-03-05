import { Image, Text, View } from '@tarojs/components';
import React, { useEffect, useMemo, useState } from 'react';

import './Icon.scss';

export type IconName =
  | 'home'
  | 'inspiration'
  | 'progress'
  | 'message'
  | 'profile'
  | 'identity'
  | 'identity-add'
  | 'orders'
  | 'favorites'
  | 'history'
  | 'notification'
  | 'support'
  | 'about'
  | 'settings'
  | 'success'
  | 'pending';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

const SVG_VIEWBOX = '0 0 24 24';

const wrapSvg = (content: string, color: string) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SVG_VIEWBOX}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
};

const iconSvgMap: Record<IconName, (color: string) => string> = {
  home: (color) =>
    wrapSvg('<path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>', color),
  inspiration: (color) =>
    wrapSvg('<path d="M12 3l2.2 5.4L20 9l-4.3 3.7L17 18l-5-3-5 3 1.3-5.3L4 9l5.8-.6L12 3z"/>', color),
  progress: (color) =>
    wrapSvg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h5"/>', color),
  message: (color) => wrapSvg('<path d="M4 6h16v10H8l-4 3V6z"/>', color),
  profile: (color) => wrapSvg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.8-3.3 4.1-5 7-5s5.2 1.7 7 5"/>', color),
  identity: (color) =>
    wrapSvg('<path d="M12 3l7 3v5c0 4.4-2.6 7.6-7 9-4.4-1.4-7-4.6-7-9V6l7-3z"/>', color),
  'identity-add': (color) =>
    wrapSvg('<path d="M12 3l7 3v5c0 4.4-2.6 7.6-7 9-4.4-1.4-7-4.6-7-9V6l7-3z"/><path d="M12 8v6"/><path d="M9 11h6"/>', color),
  orders: (color) =>
    wrapSvg('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4v2"/><path d="M15 4v2"/><path d="M8 11h8"/><path d="M8 15h6"/>', color),
  favorites: (color) => wrapSvg('<path d="M12 20l-7.2-6.6A4.6 4.6 0 0 1 4 7.2 4.8 4.8 0 0 1 12 9a4.8 4.8 0 0 1 8-1.8 4.6 4.6 0 0 1-.8 6.2L12 20z"/>', color),
  history: (color) =>
    wrapSvg('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 5v4h4"/><path d="M12 8v5l3 2"/>', color),
  notification: (color) =>
    wrapSvg('<path d="M6 17h12"/><path d="M8 17V10a4 4 0 1 1 8 0v7"/><path d="M10 20a2 2 0 0 0 4 0"/>', color),
  support: (color) =>
    wrapSvg('<path d="M6 10a6 6 0 0 1 12 0v4"/><path d="M6 14h2v4H6z"/><path d="M16 14h2v4h-2z"/><path d="M11 18h2"/>', color),
  about: (color) => wrapSvg('<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><circle cx="12" cy="7" r="1"/>', color),
  settings: (color) =>
    wrapSvg('<circle cx="12" cy="12" r="3"/><path d="M12 4v2"/><path d="M12 18v2"/><path d="M4 12h2"/><path d="M18 12h2"/><path d="M6.3 6.3l1.4 1.4"/><path d="M16.3 16.3l1.4 1.4"/><path d="M17.7 6.3l-1.4 1.4"/><path d="M7.7 16.3l-1.4 1.4"/>', color),
  success: (color) => wrapSvg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>', color),
  pending: (color) => wrapSvg('<circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>', color),
};

const fallbackGlyphMap: Record<IconName, string> = {
  home: '⌂',
  inspiration: '✦',
  progress: '▦',
  message: '✉',
  profile: '◎',
  identity: '◉',
  'identity-add': '+',
  orders: '▣',
  favorites: '♥',
  history: '◷',
  notification: '◉',
  support: '?',
  about: 'i',
  settings: '◌',
  success: '✓',
  pending: '…',
};

const buildClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base;
};

const svgToDataUri = (svg: string) => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 28,
  color = '#71717A',
  className,
}) => {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [name, color]);

  const imageSrc = useMemo(() => {
    const builder = iconSvgMap[name];
    return svgToDataUri(builder(color));
  }, [name, color]);

  const iconStyle = {
    width: `${size}rpx`,
    height: `${size}rpx`,
  };

  const textStyle = {
    fontSize: `${size}rpx`,
    color,
    lineHeight: `${size}rpx`,
  };

  return (
    <View className={buildClassName('mini-icon', className)}>
      {!loadFailed ? (
        <Image
          className="mini-icon__image"
          src={imageSrc}
          style={iconStyle}
          mode="aspectFit"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <Text className="mini-icon__glyph" style={textStyle}>
          {fallbackGlyphMap[name]}
        </Text>
      )}
    </View>
  );
};
