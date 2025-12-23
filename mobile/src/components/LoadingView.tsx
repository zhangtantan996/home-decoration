import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface LoadingViewProps {
    message?: string;
    size?: 'small' | 'large';
    fullScreen?: boolean;
}

export const LoadingView: React.FC<LoadingViewProps> = ({
    message = '加载中...',
    size = 'large',
    fullScreen = true,
}) => {
    return (
        <View style={[styles.container, fullScreen && styles.fullScreen]}>
            <ActivityIndicator size={size} color="#18181B" />
            {message && <Text style={styles.message}>{message}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    fullScreen: {
        flex: 1,
    },
    message: {
        marginTop: 16,
        fontSize: 14,
        color: '#71717A',
    },
});

export default LoadingView;
