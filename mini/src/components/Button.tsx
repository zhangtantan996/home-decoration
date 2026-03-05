import { Button as TaroButton, View } from '@tarojs/components';
import React from 'react';
import './Button.scss';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'brand' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  openType?: string; // For WeChat capabilities
  onGetPhoneNumber?: (e: any) => void;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className,
  openType,
  onGetPhoneNumber
}) => {
  const isWeapp = process.env.TARO_ENV === 'weapp';
  const classes = buildClassName('btn', [
    `btn--${variant}`,
    `btn--${size}`,
    disabled ? 'btn--disabled' : undefined,
    className
  ]);

  return (
    <TaroButton
      className={classes}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      {...(isWeapp ? { openType, onGetPhoneNumber } : {})}
    >
      {children}
    </TaroButton>
  );
};
