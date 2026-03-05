import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
    TouchableOpacity,
    StatusBar,
    SafeAreaView,
    Platform,
    Easing,
    ActivityIndicator,
    Linking,
    PermissionsAndroid,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import {
    X, Zap, Image as ImageIcon, Camera as CameraIcon,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { Camera, CameraType } from 'react-native-camera-kit';
import ImageCropPicker from 'react-native-image-crop-picker';

const { width, height } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7; // 扫描框大小

export const ScanQRScreen: React.FC = () => {
    const navigation = useNavigation();
    const { showAlert } = useToast();
    const isFocused = useIsFocused();
    const lineAnim = useRef(new Animated.Value(0)).current;

    // 相机状态
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [torchMode, setTorchMode] = useState<'on' | 'off'>('off');
    const [scanned, setScanned] = useState(false);

    // 扫描线动画循环
    useEffect(() => {
        const startAnimation = () => {
            lineAnim.setValue(0);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(lineAnim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(lineAnim, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        };
        startAnimation();
    }, [lineAnim]);

    // 请求相机权限
    useEffect(() => {
        const requestPermission = async () => {
            if (Platform.OS === 'web') {
                setHasPermission(true); // Web 暂不支持
                return;
            }

            if (Platform.OS === 'android') {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.CAMERA,
                        {
                            title: '相机权限',
                            message: '扫码功能需要使用相机',
                            buttonPositive: '允许',
                            buttonNegative: '拒绝',
                        }
                    );
                    setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
                } catch (err) {
                    console.warn(err);
                    setHasPermission(false);
                }
            } else {
                // iOS 权限由 camera-kit 自动处理
                setHasPermission(true);
            }
        };
        requestPermission();
    }, []);

    // 扫码回调
    const handleBarCodeScanned = (event: any) => {
        if (scanned) return;
        const { codeStringValue, codeFormat } = event.nativeEvent;
        if (codeStringValue) {
            setScanned(true);
            showAlert('扫描成功', `类型: ${codeFormat}\n内容: ${codeStringValue}`, [{ text: '确定', onPress: () => setScanned(false) }]);
        }
    };

    // 打开相册
    const pickImage = async () => {
        try {
            const image = await ImageCropPicker.openPicker({
                mediaType: 'photo',
                cropping: false,
                compressImageQuality: 1,
            });

            if (image && image.path) {
                // 注意：从图片解析二维码需要额外的解码库如 'rn-qr-generator'
                showAlert('图片已选择', '（图片解析功能需额外集成解码库）\n\n' + image.path);
            }
        } catch (error: any) {
            // 用户取消选择不需要报错
            if (error.code === 'E_PICKER_CANCELLED') {
                return;
            }
            console.error('Pick image error:', error);
            showAlert('错误', '无法访问相册');
        }
    };

    // 切换手电筒
    const toggleFlash = () => {
        setTorchMode(torchMode === 'off' ? 'on' : 'off');
    };

    // 渲染相机视图
    const renderCamera = () => {
        if (hasPermission === null) {
            return <View style={styles.cameraPreview} />;
        }

        if (hasPermission === false) {
            return (
                <View style={[styles.cameraPreview, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#fff', marginBottom: 10 }}>没有相机权限</Text>
                    <TouchableOpacity onPress={() => Linking.openSettings()}>
                        <Text style={{ color: '#06b6d4' }}>去设置开启</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (Platform.OS === 'web') {
            return (
                <View style={[styles.cameraPreview, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }]}>
                    <Text style={{ color: '#aaa' }}>Web 端暂不支持原生相机预览</Text>
                </View>
            );
        }

        return (
            <Camera
                style={StyleSheet.absoluteFill}
                cameraType={CameraType.Back}
                torchMode={torchMode}
                scanBarcode={true}
                onReadCode={handleBarCodeScanned}
                showFrame={false}
            />
        );
    };

    const translateY = lineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, SCAN_SIZE],
    });

    const handleGoBack = () => {
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* 相机预览层 */}
            {renderCamera()}

            {/* 遮罩层 */}
            <View style={styles.maskContainer}>
                <View style={styles.maskTop} />
                <View style={styles.maskMiddle}>
                    <View style={styles.maskSide} />

                    {/* 扫描框区域 */}
                    <View style={styles.scanBox}>
                        {/* 扫描框四角装饰 */}
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />

                        {/* 扫描线 */}
                        <Animated.View
                            style={[
                                styles.laserLine,
                                {
                                    transform: [{ translateY }],
                                },
                            ]}
                        >
                            {/* 激光 Glow 效果 */}
                            <View style={styles.laserGlow} />
                        </Animated.View>
                    </View>

                    <View style={styles.maskSide} />
                </View>
                <View style={styles.maskBottom} />
            </View>

            {/* UI 内容层 */}
            <SafeAreaView style={styles.uiContainer}>
                {/* 顶部导航 */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleGoBack}>
                        <X size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>扫一扫</Text>
                    <View style={{ width: 40 }} /> {/* 占位 */}
                </View>

                {/* 底部操作区 */}
                <View style={styles.controls}>
                    <Text style={styles.hintText}>将二维码放入框内，即可自动扫描</Text>

                    <View style={styles.buttonsRow}>
                        <TouchableOpacity style={styles.iconBtn} onPress={pickImage}>
                            <View style={styles.iconCircle}>
                                <ImageIcon size={24} color="#fff" />
                            </View>
                            <Text style={styles.btnLabel}>相册</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={toggleFlash}
                        >
                            <View style={[styles.iconCircle, torchMode === 'on' && styles.iconCircleActive]}>
                                <Zap size={24} color={torchMode === 'on' ? "#000" : "#fff"} fill={torchMode === 'on' ? "#000" : "none"} />
                            </View>
                            <Text style={styles.btnLabel}>手电筒</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraPreview: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1C1C1E', // 模拟暗光环境
    },
    // 遮罩系统
    maskContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    maskTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    maskMiddle: {
        height: SCAN_SIZE,
        flexDirection: 'row',
    },
    maskSide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    maskBottom: {
        flex: 1.5, // 底部留多一点空间给按钮
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    // 扫描框
    scanBox: {
        width: SCAN_SIZE,
        height: SCAN_SIZE,
        position: 'relative',
        overflow: 'hidden', // 限制扫描线溢出
    },
    corner: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderColor: '#06b6d4', // Cyan color for premium tech feel
        borderWidth: 3,
    },
    cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

    // 激光线
    laserLine: {
        width: '100%',
        height: 4,
        backgroundColor: '#06b6d4', // Cyan
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 10,
    },
    laserGlow: {
        width: '100%',
        height: 60,
        backgroundColor: 'transparent',
        position: 'absolute',
        bottom: 0,
    },

    // UI 层
    uiContainer: {
        flex: 1,
        zIndex: 10,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 44 : 44,
        height: Platform.OS === 'android' ? (StatusBar.currentHeight || 44) + 60 : 104,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    controls: {
        paddingBottom: 50,
        alignItems: 'center',
    },
    hintText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginBottom: 40,
        textAlign: 'center',
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 60,
    },
    iconBtn: {
        alignItems: 'center',
        gap: 8,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)', // Glass effect
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleActive: {
        backgroundColor: '#fff',
    },
    btnLabel: {
        color: '#fff',
        fontSize: 12,
    },
});
