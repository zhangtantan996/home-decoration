import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, Eraser, UserCircle2 } from 'lucide-react-native';

import { useToast } from '../components/Toast';
import SettingsBottomSheet from '../components/settings/SettingsBottomSheet';
import {
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
} from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';

type SheetType = 'avatar' | 'nickname' | 'bio' | 'birthday' | null;

type BirthdayPickerColumnProps = {
    label: string;
    options: string[];
    selectedValue: string;
    onSelect: (value: string) => void;
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1949 }, (_, index) => String(currentYear - index));
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const PICKER_ITEM_HEIGHT = 44;
const PICKER_VISIBLE_ROWS = 5;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * PICKER_VISIBLE_ROWS;
const PICKER_SPACER_HEIGHT = PICKER_ITEM_HEIGHT * 2;

const getDaysInMonth = (year: string, month: string) => {
    const yearNumber = Number(year);
    const monthNumber = Number(month);
    if (!yearNumber || !monthNumber) {
        return 31;
    }
    return new Date(yearNumber, monthNumber, 0).getDate();
};

const BirthdayPickerColumn = ({ label, options, selectedValue, onSelect }: BirthdayPickerColumnProps) => {
    const scrollRef = useRef<ScrollView | null>(null);
    const isProgrammaticRef = useRef(false);
    const selectedIndex = Math.max(options.indexOf(selectedValue), 0);

    const alignToIndex = (index: number, animated: boolean) => {
        const safeIndex = Math.max(index, 0);
        isProgrammaticRef.current = true;
        scrollRef.current?.scrollTo({ y: safeIndex * PICKER_ITEM_HEIGHT, animated });
        setTimeout(() => {
            isProgrammaticRef.current = false;
        }, animated ? 220 : 0);
    };

    useEffect(() => {
        alignToIndex(selectedIndex, false);
    }, [selectedIndex]);

    const handleSnap = (offsetY: number) => {
        if (isProgrammaticRef.current) {
            return;
        }
        const nextIndex = Math.min(
            options.length - 1,
            Math.max(0, Math.round(offsetY / PICKER_ITEM_HEIGHT))
        );
        const nextValue = options[nextIndex];
        if (nextValue !== selectedValue) {
            onSelect(nextValue);
            return;
        }
        alignToIndex(nextIndex, true);
    };

    return (
        <View style={styles.pickerColumnWrap}>
            <Text style={styles.pickerLabel}>{label}</Text>
            <View style={styles.pickerViewport}>
                <View pointerEvents="none" style={styles.pickerCenterHighlight} />
                <ScrollView
                    ref={scrollRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={PICKER_ITEM_HEIGHT}
                    decelerationRate="fast"
                    bounces={false}
                    onMomentumScrollEnd={(event) => handleSnap(event.nativeEvent.contentOffset.y)}
                    contentContainerStyle={styles.pickerContent}
                >
                    <View style={styles.pickerSpacer} />
                    {options.map((option) => {
                        const selected = option === selectedValue;
                        return (
                            <TouchableOpacity
                                key={`${label}-${option}`}
                                activeOpacity={0.86}
                                style={styles.pickerItem}
                                onPress={() => {
                                    onSelect(option);
                                    alignToIndex(options.indexOf(option), true);
                                }}
                            >
                                <Text style={[styles.pickerItemText, selected && styles.pickerItemTextActive]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                    <View style={styles.pickerSpacer} />
                </ScrollView>
            </View>
        </View>
    );
};

const PersonalInfoScreen = ({ navigation }: any) => {
    const { user, updateUser } = useAuthStore();
    const { showToast } = useToast();
    const { personalProfile, updatePersonalProfile } = useSettingsStore();

    const initialBirthday = personalProfile.birthday.split('-');
    const [sheetType, setSheetType] = useState<SheetType>(null);
    const [nicknameDraft, setNicknameDraft] = useState(user?.nickname || '');
    const [bioDraft, setBioDraft] = useState(personalProfile.bio);
    const [yearDraft, setYearDraft] = useState(initialBirthday[0] || '1992');
    const [monthDraft, setMonthDraft] = useState(initialBirthday[1] || '08');
    const [dayDraft, setDayDraft] = useState(initialBirthday[2] || '18');

    const availableDays = useMemo(() => {
        const count = getDaysInMonth(yearDraft, monthDraft);
        return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'));
    }, [monthDraft, yearDraft]);

    const birthdayValue = useMemo(
        () => `${yearDraft.padStart(4, '0')}-${monthDraft.padStart(2, '0')}-${dayDraft.padStart(2, '0')}`,
        [dayDraft, monthDraft, yearDraft]
    );

    useEffect(() => {
        if (!availableDays.includes(dayDraft)) {
            setDayDraft(availableDays[availableDays.length - 1]);
        }
    }, [availableDays, dayDraft]);

    const handlePickAvatar = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 1,
            quality: 0.8,
        });

        if (result.didCancel) {
            return;
        }

        if (result.errorCode) {
            showToast({ type: 'error', message: result.errorMessage || '图片选择失败，请稍后重试' });
            return;
        }

        const asset = result.assets?.[0];
        if (!asset?.uri) {
            showToast({ type: 'warning', message: '未获取到可用图片，请重新选择' });
            return;
        }

        await updateUser({ avatar: asset.uri });
        setSheetType(null);
        showToast({ type: 'success', message: '头像已更新' });
    };

    const handleSaveNickname = async () => {
        const nextNickname = nicknameDraft.trim();
        if (nextNickname.length < 2) {
            showToast({ type: 'warning', message: '昵称至少 2 个字' });
            return;
        }
        await updateUser({ nickname: nextNickname });
        setSheetType(null);
        showToast({ type: 'success', message: '昵称已保存' });
    };

    const handleSaveBio = () => {
        updatePersonalProfile({ bio: bioDraft.trim() || '让装修过程更省心一点。' });
        setSheetType(null);
        showToast({ type: 'success', message: '简介已保存' });
    };

    const handleSaveBirthday = () => {
        updatePersonalProfile({ birthday: birthdayValue });
        setSheetType(null);
        showToast({ type: 'success', message: '生日已保存' });
    };

    const renderSheet = () => {
        switch (sheetType) {
            case 'avatar':
                return (
                    <>
                        <Text style={styles.sheetTitle}>修改头像</Text>
                        <Text style={styles.sheetSubtitle}>尽量使用清晰正面照片，头像会同步到消息和项目协作页。</Text>
                        <TouchableOpacity activeOpacity={0.86} style={styles.actionRow} onPress={handlePickAvatar}>
                            <Camera size={18} color={SETTINGS_COLORS.textPrimary} strokeWidth={2.1} />
                            <Text style={styles.actionLabel}>从相册选择</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.86}
                            style={styles.actionRow}
                            onPress={async () => {
                                await updateUser({ avatar: '' });
                                setSheetType(null);
                                showToast({ type: 'success', message: '已恢复默认头像' });
                            }}
                        >
                            <Eraser size={18} color={SETTINGS_COLORS.textPrimary} strokeWidth={2.1} />
                            <Text style={styles.actionLabel}>恢复默认头像</Text>
                        </TouchableOpacity>
                    </>
                );
            case 'nickname':
                return (
                    <>
                        <Text style={styles.sheetTitle}>编辑昵称</Text>
                        <Text style={styles.sheetSubtitle}>昵称会展示在消息、项目和订单相关页面，建议简洁易识别。</Text>
                        <TextInput
                            value={nicknameDraft}
                            onChangeText={setNicknameDraft}
                            placeholder="请输入昵称"
                            placeholderTextColor={SETTINGS_COLORS.textMuted}
                            style={styles.sheetInput}
                            maxLength={16}
                        />
                        <TouchableOpacity activeOpacity={0.88} style={styles.saveButton} onPress={handleSaveNickname}>
                            <Text style={styles.saveButtonText}>保存昵称</Text>
                        </TouchableOpacity>
                    </>
                );
            case 'bio':
                return (
                    <>
                        <Text style={styles.sheetTitle}>编辑简介</Text>
                        <Text style={styles.sheetSubtitle}>一句话说明你的偏好或装修状态，便于合作方快速了解你的需求。</Text>
                        <TextInput
                            value={bioDraft}
                            onChangeText={setBioDraft}
                            placeholder="例如：偏爱自然木质风，正在准备全屋改造。"
                            placeholderTextColor={SETTINGS_COLORS.textMuted}
                            style={[styles.sheetInput, styles.sheetInputMulti]}
                            maxLength={60}
                            multiline
                        />
                        <Text style={styles.counterText}>{bioDraft.length}/60</Text>
                        <TouchableOpacity activeOpacity={0.88} style={styles.saveButton} onPress={handleSaveBio}>
                            <Text style={styles.saveButtonText}>保存简介</Text>
                        </TouchableOpacity>
                    </>
                );
            case 'birthday':
                return (
                    <>
                        <Text style={styles.sheetTitle}>编辑生日</Text>
                        <View style={styles.pickerRow}>
                            <BirthdayPickerColumn label="年" options={YEARS} selectedValue={yearDraft} onSelect={setYearDraft} />
                            <BirthdayPickerColumn label="月" options={MONTHS} selectedValue={monthDraft} onSelect={setMonthDraft} />
                            <BirthdayPickerColumn label="日" options={availableDays} selectedValue={dayDraft} onSelect={setDayDraft} />
                        </View>
                        <Text style={styles.previewText}>{birthdayValue}</Text>
                        <TouchableOpacity activeOpacity={0.88} style={styles.saveButton} onPress={handleSaveBirthday}>
                            <Text style={styles.saveButtonText}>保存生日</Text>
                        </TouchableOpacity>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <SettingsLayout title="个人信息" navigation={navigation}>
            <SettingsPageDescription text="个人信息页跟随设置中心统一改成轻量卡片，常用编辑动作都收进底部弹层。" />

            <SettingsSection>
                <SettingsRow
                    label="头像"
                    rightNode={
                        <View style={styles.avatarWrap}>
                            {user?.avatar ? (
                                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <UserCircle2 size={24} color={SETTINGS_COLORS.textMuted} strokeWidth={1.8} />
                                </View>
                            )}
                        </View>
                    }
                    onPress={() => setSheetType('avatar')}
                />
                <SettingsRow label="昵称" value={user?.nickname || '未设置'} onPress={() => setSheetType('nickname')} />
                <SettingsRow label="用户 ID" value={String(user?.id || '--')} withChevron={false} />
                <SettingsRow label="手机号" value={user?.phone || '未绑定'} withChevron={false} />
                <SettingsRow label="简介" value={personalProfile.bio} onPress={() => setSheetType('bio')} />
                <SettingsRow label="生日" value={personalProfile.birthday} onPress={() => setSheetType('birthday')} last />
            </SettingsSection>

            <SettingsBottomSheet visible={sheetType !== null} onClose={() => setSheetType(null)}>
                {renderSheet()}
            </SettingsBottomSheet>
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    avatarWrap: {
        marginRight: 6,
    },
    avatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
    },
    sheetSubtitle: {
        fontSize: 14,
        lineHeight: 21,
        color: SETTINGS_COLORS.textSecondary,
        marginBottom: 18,
    },
    actionRow: {
        minHeight: 54,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: SETTINGS_COLORS.textPrimary,
    },
    sheetInput: {
        minHeight: 56,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 16,
        fontSize: 16,
        color: SETTINGS_COLORS.textPrimary,
    },
    sheetInputMulti: {
        minHeight: 120,
        paddingTop: 16,
        textAlignVertical: 'top',
    },
    saveButton: {
        minHeight: 56,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    counterText: {
        marginTop: 8,
        fontSize: 13,
        color: SETTINGS_COLORS.textSecondary,
        textAlign: 'right',
    },
    pickerRow: {
        flexDirection: 'row',
        gap: 10,
    },
    pickerColumnWrap: {
        flex: 1,
        gap: 8,
    },
    pickerLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: SETTINGS_COLORS.textSecondary,
        textAlign: 'center',
    },
    pickerViewport: {
        height: PICKER_HEIGHT,
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        overflow: 'hidden',
        position: 'relative',
    },
    pickerCenterHighlight: {
        position: 'absolute',
        top: PICKER_ITEM_HEIGHT * 2,
        left: 10,
        right: 10,
        height: PICKER_ITEM_HEIGHT,
        borderRadius: SETTINGS_RADIUS.button,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: SETTINGS_COLORS.border,
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    pickerContent: {
        paddingHorizontal: 8,
    },
    pickerSpacer: {
        height: PICKER_SPACER_HEIGHT,
    },
    pickerItem: {
        height: PICKER_ITEM_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    pickerItemText: {
        fontSize: 16,
        fontWeight: '500',
        color: SETTINGS_COLORS.textSecondary,
    },
    pickerItemTextActive: {
        fontSize: 20,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    previewText: {
        marginTop: 14,
        textAlign: 'center',
        fontSize: 14,
        color: SETTINGS_COLORS.textSecondary,
    },
});

export default PersonalInfoScreen;
