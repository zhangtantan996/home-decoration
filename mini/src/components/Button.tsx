import { Button as TaroButton } from '@tarojs/components';
import React from 'react';
import './Button.scss';

type ButtonVariant = 'primary' | 'secondary' | 'brand' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  type?: 'primary' | 'secondary' | 'brand' | 'outline' | 'ghost' | 'default';
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  onClick?: (...args: any[]) => void;
  className?: string;
  style?: React.CSSProperties;
  openType?: any; // For WeChat capabilities
  onGetPhoneNumber?: (e: any) => void;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant,
  type,
  size = 'md',
  disabled = false,
  loading = false,
  block = false,
  onClick,
  className,
  style,
  openType,
  onGetPhoneNumber
}) => {
  const isWeapp = process.env.TARO_ENV === 'weapp';
  const normalizedVariant: ButtonVariant =
    variant || (type && type !== 'default' ? type : 'primary');
  const normalizedSize =
    size === 'small' ? 'sm' : size === 'medium' ? 'md' : size === 'large' ? 'lg' : size;
  const classes = buildClassName('btn', [
    `btn--${normalizedVariant}`,
    `btn--${normalizedSize}`,
    block ? 'btn--block' : undefined,
    disabled ? 'btn--disabled' : undefined,
    className
  ]);

  return (
    <TaroButton
      className={classes}
      style={style}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      {...(isWeapp ? { openType, onGetPhoneNumber } : {})}
    >
      {children}
    </TaroButton>
  );
};
