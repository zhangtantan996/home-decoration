import { View, Input as TaroInput, Text } from '@tarojs/components';
import React from 'react';
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
  maxLength
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
        placeholderStyle="color: #A1A1AA"
        type={type as any}
        disabled={disabled}
        maxlength={maxLength}
      />
      {error && <Text className="input-wrapper__error">{error}</Text>}
    </View>
  );
};
