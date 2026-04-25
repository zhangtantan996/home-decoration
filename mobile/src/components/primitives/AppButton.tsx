import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type AppButtonSize = 'sm' | 'md' | 'lg';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const VARIANT_STYLES: Record<AppButtonVariant, { container: ViewStyle; text: TextStyle; spinner: string }> = {
  primary: {
    container: { backgroundColor: colors.gray900, borderColor: colors.gray900 },
    text: { color: colors.white },
    spinner: colors.white,
  },
  secondary: {
    container: { backgroundColor: colors.gray100, borderColor: colors.gray100 },
    text: { color: colors.gray900 },
    spinner: colors.gray900,
  },
  outline: {
    container: { backgroundColor: colors.white, borderColor: colors.border },
    text: { color: colors.gray900 },
    spinner: colors.gray900,
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: 'transparent' },
    text: { color: colors.gray700 },
    spinner: colors.gray700,
  },
  danger: {
    container: { backgroundColor: colors.error, borderColor: colors.error },
    text: { color: colors.white },
    spinner: colors.white,
  },
};

const SIZE_STYLES: Record<AppButtonSize, ViewStyle & { textSize: number }> = {
  sm: { minHeight: 36, paddingHorizontal: spacing.md, textSize: typography.caption },
  md: { minHeight: 44, paddingHorizontal: spacing.lg, textSize: typography.body },
  lg: { minHeight: 52, paddingHorizontal: spacing.xl, textSize: typography.h3 },
};

export function AppButton({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  block,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  ...pressableProps
}: AppButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        {
          minHeight: sizeStyle.minHeight,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          opacity: inactive ? 0.56 : pressed ? 0.78 : 1,
          alignSelf: block ? 'stretch' : 'auto',
        },
        style,
      ]}
      {...pressableProps}
    >
      {loading ? <ActivityIndicator size="small" color={variantStyle.spinner} /> : leftIcon}
      <Text style={[styles.text, variantStyle.text, { fontSize: sizeStyle.textSize }, textStyle]} numberOfLines={1}>
        {title}
      </Text>
      {rightIcon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
