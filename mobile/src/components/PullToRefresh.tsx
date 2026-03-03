import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    PanResponder,
    Platform,
    Dimensions,
    Text,
} from 'react-native';
import { Check, AlertCircle, RefreshCw } from 'lucide-react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

// 状态枚举
export enum RefreshState {
    IDLE = 'IDLE',
    PULLING = 'PULLING',
    REFRESHING = 'REFRESHING',
    SUCCESS = 'SUCCESS',
    FAIL = 'FAIL',
}

// 配置常量
const CONFIG = {
    THRESHOLD: 60,           // 触发阈值
    DAMPING: 0.5,            // 阻尼系数
    RESULT_DURATION: 800,    // 结果展示时间
    INDICATOR_HEIGHT: 60,    // 指示器高度
} as const;

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
    onRefresh,
    children,
    disabled = false,
}) => {
    const [state, setState] = useState<RefreshState>(RefreshState.IDLE);
    const translateY = useRef(new Animated.Value(0)).current;
    const pullDistance = useRef(0);
    const spinValue = useRef(new Animated.Value(0)).current;
    const spinAnimation = useRef<Animated.CompositeAnimation | null>(null);

    // 旋转动画插值
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // 下拉时的旋转角度（基于距离）
    const pullRotation = translateY.interpolate({
        inputRange: [0, CONFIG.THRESHOLD * 2],
        outputRange: ['0deg', '360deg'],
        extrapolate: 'clamp',
    });

    // 开始循环旋转动画
    const startSpinAnimation = useCallback(() => {
        spinValue.setValue(0);
        spinAnimation.current = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            })
        );
        spinAnimation.current.start();
    }, [spinValue]);

    // 停止旋转动画
    const stopSpinAnimation = useCallback(() => {
        if (spinAnimation.current) {
            spinAnimation.current.stop();
            spinAnimation.current = null;
        }
    }, []);

    // 回弹动画
    const springBack = useCallback((toValue: number = 0) => {
        Animated.spring(translateY, {
            toValue,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
        }).start();
    }, [translateY]);

    // 处理刷新结果
    const handleRefreshComplete = useCallback(async () => {
        try {
            await onRefresh();
            // 刷新成功，直接回弹，不展示"已更新"状态以加快交互节奏
            setState(RefreshState.SUCCESS);
            stopSpinAnimation();
            springBack(0);
            setTimeout(() => {
                setState(RefreshState.IDLE);
            }, 300);
        } catch {
            // 失败时仍然展示提示
            setState(RefreshState.FAIL);
            stopSpinAnimation();
            setTimeout(() => {
                springBack(0);
                setTimeout(() => {
                    setState(RefreshState.IDLE);
                }, 300);
            }, 800); // 失败提示停留一下
        }
    }, [onRefresh, springBack, stopSpinAnimation]);

    // 触发刷新
    useEffect(() => {
        if (state === RefreshState.REFRESHING) {
            startSpinAnimation();
            springBack(CONFIG.INDICATOR_HEIGHT);
            handleRefreshComplete();
        }
    }, [state, handleRefreshComplete, springBack, startSpinAnimation]);

    // Web 平台手势处理
    const containerRef = useRef<View>(null);
    const startY = useRef(0);
    const isTracking = useRef(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        // @ts-ignore - Web TouchEvent
        const handleTouchStart = (e: TouchEvent) => {
            if (disabled || state !== RefreshState.IDLE) return;
            startY.current = (e as any).touches[0].clientY;
            isTracking.current = true;
            pullDistance.current = 0;
        };

        // @ts-ignore - Web TouchEvent
        const handleTouchMove = (e: TouchEvent) => {
            if (!isTracking.current || disabled) return;

            const currentY = (e as any).touches[0].clientY;
            const delta = (currentY - startY.current) * CONFIG.DAMPING;

            if (delta > 0) {
                e.preventDefault();
                pullDistance.current = delta;
                translateY.setValue(delta);
                if (state === RefreshState.IDLE) {
                    setState(RefreshState.PULLING);
                }
            }
        };

        const handleTouchEnd = () => {
            if (!isTracking.current) return;
            isTracking.current = false;

            if (pullDistance.current >= CONFIG.THRESHOLD) {
                setState(RefreshState.REFRESHING);
            } else {
                springBack(0);
                setState(RefreshState.IDLE);
            }
        };

        // @ts-ignore - Web document
        const element = typeof document !== 'undefined' ? document.querySelector('[data-pull-refresh]') : null;
        if (element) {
            element.addEventListener('touchstart', handleTouchStart as EventListener, { passive: false });
            element.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
            element.addEventListener('touchend', handleTouchEnd as EventListener);

            return () => {
                element.removeEventListener('touchstart', handleTouchStart as EventListener);
                element.removeEventListener('touchmove', handleTouchMove as EventListener);
                element.removeEventListener('touchend', handleTouchEnd as EventListener);
            };
        }
    }, [disabled, state, translateY, springBack]);

    // Native PanResponder
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !disabled && state === RefreshState.IDLE,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return !disabled && state === RefreshState.IDLE && gestureState.dy > 0;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    const dampedDistance = gestureState.dy * CONFIG.DAMPING;
                    pullDistance.current = dampedDistance;
                    translateY.setValue(dampedDistance);
                    if (state === RefreshState.IDLE) {
                        setState(RefreshState.PULLING);
                    }
                }
            },
            onPanResponderRelease: () => {
                if (pullDistance.current >= CONFIG.THRESHOLD) {
                    setState(RefreshState.REFRESHING);
                } else {
                    springBack(0);
                    setState(RefreshState.IDLE);
                }
            },
        })
    ).current;

    // 渲染指示器 (Floating Capsule)
    const renderIndicator = () => {
        // 下拉时的位移：从 -60 到 10 (加一点 marginTop)
        const indicatorTranslateY = translateY.interpolate({
            inputRange: [0, CONFIG.THRESHOLD],
            outputRange: [-CONFIG.INDICATOR_HEIGHT, 10],
            extrapolate: 'clamp',
        });

        // 缩放动画：从 0.8 弹到 1
        const scale = translateY.interpolate({
            inputRange: [0, CONFIG.THRESHOLD],
            outputRange: [0.8, 1],
            extrapolate: 'clamp',
        });

        // 透明度
        const opacity = translateY.interpolate({
            inputRange: [0, 20],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });

        const getContent = () => {
            switch (state) {
                case RefreshState.PULLING:
                    return {
                        icon: (
                            <Animated.View style={{ transform: [{ rotate: pullRotation }] }}>
                                <RefreshCw size={18} color={colors.gray900} />
                            </Animated.View>
                        ),
                        text: '下拉刷新',
                    };
                case RefreshState.REFRESHING:
                    return {
                        icon: (
                            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                                <RefreshCw size={18} color={colors.gray900} />
                            </Animated.View>
                        ),
                        text: '刷新中...',
                    };
                case RefreshState.SUCCESS:
                    return {
                        icon: <Check size={20} color={colors.gray900} />,
                        text: '已更新',
                    };
                case RefreshState.FAIL:
                    return {
                        icon: <AlertCircle size={20} color={colors.error} />,
                        text: '失败',
                    };
                default:
                    return null;
            }
        };

        const content = getContent();

        return (
            <Animated.View
                style={[
                    styles.indicatorContainer,
                    {
                        height: CONFIG.INDICATOR_HEIGHT,
                        opacity,
                        transform: [
                            { translateY: indicatorTranslateY },
                            { scale }
                        ],
                    },
                ]}
            >
                <View style={styles.capsule}>
                    {content?.icon}
                    {state !== RefreshState.IDLE && (
                        <Text style={styles.capsuleText}>{content?.text}</Text>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <View
            ref={containerRef}
            style={styles.container}
            {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
            // @ts-ignore - web data attribute
            data-pull-refresh="true"
        >
            {renderIndicator()}
            <Animated.View
                style={[
                    styles.content,
                    {
                        transform: [{ translateY }],
                    },
                ]}
            >
                {children}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'transparent',
    },
    indicatorContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center', // 确保在高度范围内垂直居中
        zIndex: 10,
    },
    capsule: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.gray100,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: radii.full,
        gap: spacing.xs,
        minWidth: 120,
    },
    capsuleText: {
        color: colors.gray900,
        fontSize: typography.caption,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    content: {
        flex: 1,
        // backgroundColor: '#fff', // 移除背景色限制，由子组件决定
    },
});

export default PullToRefresh;
