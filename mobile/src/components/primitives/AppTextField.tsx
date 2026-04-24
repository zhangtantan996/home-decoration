import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type AppTextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function AppTextField({
  label,
  error,
  helperText,
  containerStyle,
  inputStyle,
  editable = true,
  placeholderTextColor = colors.placeholder,
  ...inputProps
}: AppTextFieldProps) {
  const description = error || helperText;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={placeholderTextColor}
        editable={editable}
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          Boolean(error) && styles.inputError,
          inputStyle,
        ]}
        {...inputProps}
      />
      {description ? <Text style={[styles.description, error ? styles.errorText : null]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.gray700,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.gray900,
    fontSize: typography.body,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputDisabled: {
    backgroundColor: colors.gray100,
    color: colors.gray400,
  },
  inputError: {
    borderColor: colors.error,
  },
  description: {
    color: colors.gray500,
    fontSize: typography.xs,
    lineHeight: 16,
  },
  errorText: {
    color: colors.error,
  },
});
