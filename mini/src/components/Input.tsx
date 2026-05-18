import { View, Input as TaroInput, Text } from '@tarojs/components';
import React from 'react';
import { colors } from '@/theme/tokens';
import './Input.scss';

interface InputProps {
  value: string;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'password' | 'phone';
  disabled?: boolean;
  error?: string;
  className?: string;
  maxLength?: number;
  onFocus?: () => void;
  onBlur?: () => void;
}

const buildClassName = (base: string, parts: Array<string | false | undefined>) => {
  return [base, ...parts.filter(Boolean)].join(' ');
};

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  label,
  placeholder,
  type = 'text',
  disabled,
  error,
  className,
  maxLength,
  onFocus,
  onBlur
}) => {
  const wrapperClass = buildClassName('input-wrapper', [className]);
  const fieldClass = buildClassName('input-wrapper__field', [
    error ? 'input-wrapper__field--error' : undefined,
    disabled ? 'input-wrapper__field--disabled' : undefined
  ]);

  return (
    <View className={wrapperClass}>
      {label && <Text className="input-wrapper__label">{label}</Text>}
      <TaroInput
        className={fieldClass}
        value={value}
        onInput={(e) => onChange?.(e.detail.value)}
        placeholder={placeholder}
        placeholderClass="text-placeholder"
        placeholderStyle={`color: ${colors.secondary}`}
        type={type as any}
        disabled={disabled}
        maxlength={maxLength}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {error && <Text className="input-wrapper__error">{error}</Text>}
    </View>
  );
};
