import { Alert, Platform } from 'react-native';

declare const window: any;

export const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

export const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText: string = '确定',
    cancelText: string = '取消',
    onCancel?: () => void
) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n${message}`)) {
            onConfirm();
        } else {
            onCancel?.();
        }
    } else {
        Alert.alert(title, message, [
            { text: cancelText, style: 'cancel', onPress: onCancel },
            { text: confirmText, onPress: onConfirm, style: 'destructive' }
        ]);
    }
};
