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
  | 'pending'
  | 'search'
  | 'location-pin'
  | 'expand'
  | 'designer-service'
  | 'construction-service'
  | 'company-service'
  | 'material-service'
  | 'star'
  | 'arrow-down'
  | 'nearby'
  | 'arrow-left'
  | 'share'
  | 'plus';

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

const wrapFilledSvg = (content: string, color: string) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SVG_VIEWBOX}" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
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
  search: (color) => wrapSvg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>', color),
  'location-pin': (color) =>
    wrapSvg('<path d="M12 21s-6-4.4-6-10a6 6 0 1 1 12 0c0 5.6-6 10-6 10z"/><circle cx="12" cy="11" r="2.3"/>', color),
  expand: (color) =>
    wrapSvg('<path d="M9 5H5v4"/><path d="M15 5h4v4"/><path d="M5 9l5-5"/><path d="M19 9l-5-5"/><path d="M5 15l5 5"/><path d="M15 19h4v-4"/><path d="M9 19H5v-4"/><path d="M19 15l-5 5"/>', color),
  'designer-service': (color) =>
    wrapSvg('<path d="M4 20l6-6"/><path d="M8.5 18.5L19 8a2.2 2.2 0 1 0-3.1-3.1L5.4 15.4"/><path d="M13 5l6 6"/><path d="M5 7l12 12"/>', color),
  'construction-service': (color) =>
    wrapSvg('<path d="M14 6.5a3.5 3.5 0 0 0 4.5 4.5L12 17.5 6.5 12 14 6.5z"/><path d="M5 19l4.5-4.5"/><path d="M12 7l5 5"/>', color),
  'company-service': (color) =>
    wrapSvg('<path d="M5 20V6l7-3 7 3v14"/><path d="M9 9h1"/><path d="M14 9h1"/><path d="M9 13h1"/><path d="M14 13h1"/><path d="M10 20v-4h4v4"/>', color),
  'material-service': (color) =>
    wrapSvg('<path d="M12 3l7 4v10l-7 4-7-4V7l7-4z"/><path d="M5 7l7 4 7-4"/><path d="M12 11v10"/>', color),
  star: (color) =>
    wrapFilledSvg('<path d="M12 3.8l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 19.7l.9-5.4-3.9-3.8 5.4-.8L12 3.8z"/>', color),
  'arrow-down': (color) => wrapSvg('<path d="M6 9l6 6 6-6"/>', color),
  nearby: (color) =>
    wrapSvg('<circle cx="9" cy="8.5" r="2.5"/><path d="M4.5 16c1-2.4 2.9-3.7 4.5-3.7s3.5 1.3 4.5 3.7"/><path d="M17 8.5a3.5 3.5 0 0 1 0 7c-1.2 0-2.2-.8-2.2-2 0-1.6 1.9-2.2 2.2-5z"/>', color),
  'arrow-left': (color) => wrapSvg('<path d="M15 18l-6-6 6-6"/><path d="M9 12h10"/>', color),
  share: (color) =>
    wrapSvg('<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 12l8-6"/><path d="M8 12l8 6"/>', color),
  plus: (color) => wrapSvg('<path d="M12 5v14"/><path d="M5 12h14"/>', color),
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
  search: '⌕',
  'location-pin': '⌖',
  expand: '⤢',
  'designer-service': '✎',
  'construction-service': '⌁',
  'company-service': '▥',
  'material-service': '▣',
  star: '★',
  'arrow-down': '⌄',
  nearby: '⌖',
  'arrow-left': '‹',
  share: '↗',
  plus: '+',
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
