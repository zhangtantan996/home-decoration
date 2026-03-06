import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

import { SETTINGS_ANIMATION, SETTINGS_COLORS, SETTINGS_RADIUS, SETTINGS_SHADOW } from '../../styles/settingsTheme';

interface SettingsBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const SettingsBottomSheet: React.FC<SettingsBottomSheetProps> = ({ visible, onClose, children }) => {
    const [modalVisible, setModalVisible] = useState(visible);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: SETTINGS_ANIMATION.modalIn,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: SETTINGS_ANIMATION.modalIn,
                    useNativeDriver: true,
                }),
            ]).start();
            return;
        }

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: SETTINGS_ANIMATION.modalOut,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 300,
                duration: SETTINGS_ANIMATION.modalOut,
                useNativeDriver: true,
            }),
        ]).start(() => setModalVisible(false));
    }, [visible, opacity, translateY]);

    if (!modalVisible) {
        return null;
    }

    return (
        <Modal transparent visible={modalVisible} animationType="none" statusBarTranslucent>
            <KeyboardAvoidingView
                style={styles.wrapper}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Animated.View style={[styles.backdrop, { opacity }]}> 
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                </Animated.View>
                <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}> 
                    <View style={styles.indicator} />
                    <ScrollView
                        keyboardShouldPersistTaps="always"
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        contentContainerStyle={styles.content}
                    >
                        {children}
                    </ScrollView>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: SETTINGS_COLORS.overlay,
    },
    sheet: {
        maxHeight: '82%',
        backgroundColor: SETTINGS_COLORS.card,
        borderTopLeftRadius: SETTINGS_RADIUS.modal,
        borderTopRightRadius: SETTINGS_RADIUS.modal,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        ...SETTINGS_SHADOW,
    },
    indicator: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: SETTINGS_COLORS.border,
        alignSelf: 'center',
        marginBottom: 14,
    },
    content: {
        paddingBottom: 8,
    },
});

export default SettingsBottomSheet;
