import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
    Image,
    Modal,
    TextInput,
} from 'react-native';
import { ArrowLeft, ChevronRight, User, Info } from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';

const PRIMARY_GOLD = '#D4AF37';

// 生成年份列表
const YEARS = Array.from({ length: 100 }, (_, i) => 2024 - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface PersonalInfoScreenProps {
    navigation: any;
}

const PersonalInfoScreen: React.FC<PersonalInfoScreenProps> = ({ navigation }) => {
    const { user } = useAuthStore();

    // 弹框状态
    const [avatarModalVisible, setAvatarModalVisible] = useState(false);
    const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
    const [bioModalVisible, setBioModalVisible] = useState(false);
    const [birthdayModalVisible, setBirthdayModalVisible] = useState(false);

    // 编辑状态
    const [editNickname, setEditNickname] = useState(user?.nickname || '');
    const [editBio, setEditBio] = useState('');
    const [selectedYear, setSelectedYear] = useState(1990);
    const [selectedMonth, setSelectedMonth] = useState(1);
    const [selectedDay, setSelectedDay] = useState(1);

    // 保存昵称
    const saveNickname = () => {
        // TODO: 调用API保存
        setNicknameModalVisible(false);
    };

    // 保存简介
    const saveBio = () => {
        // TODO: 调用API保存
        setBioModalVisible(false);
    };

    // 保存生日
    const saveBirthday = () => {
        // TODO: 调用API保存
        setBirthdayModalVisible(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>个人信息</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    {/* 头像 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setAvatarModalVisible(true)}>
                        <Text style={styles.menuLabel}>头像</Text>
                        <View style={styles.menuRight}>
                            <View style={styles.avatarSmall}>
                                {user?.avatar ? (
                                    <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                                ) : (
                                    <User size={20} color="#71717A" />
                                )}
                            </View>
                            <ChevronRight size={18} color="#A1A1AA" />
                        </View>
                    </TouchableOpacity>

                    {/* 昵称 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setNicknameModalVisible(true)}>
                        <Text style={styles.menuLabel}>昵称</Text>
                        <View style={styles.menuRight}>
                            <Text style={styles.menuValue}>{user?.nickname || '未设置'}</Text>
                            <ChevronRight size={18} color="#A1A1AA" />
                        </View>
                    </TouchableOpacity>

                    {/* 用户ID */}
                    <View style={styles.menuItem}>
                        <Text style={styles.menuLabel}>用户ID</Text>
                        <Text style={styles.menuValue}>88888888</Text>
                    </View>

                    {/* 简介 */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setBioModalVisible(true)}>
                        <Text style={styles.menuLabel}>简介</Text>
                        <View style={styles.menuRight}>
                            <Text style={styles.menuValue} numberOfLines={1}>
                                {editBio || '一句话介绍自己'}
                            </Text>
                            <ChevronRight size={18} color="#A1A1AA" />
                        </View>
                    </TouchableOpacity>

                    {/* 生日 */}
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => setBirthdayModalVisible(true)}>
                        <Text style={styles.menuLabel}>生日</Text>
                        <View style={styles.menuRight}>
                            <Text style={styles.menuValue}>
                                {`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`}
                            </Text>
                            <ChevronRight size={18} color="#A1A1AA" />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* 头像开发中弹框 */}
            <Modal visible={avatarModalVisible} transparent animationType="fade">
                <View style={styles.dialogOverlay}>
                    <View style={styles.dialogContainer}>
                        <View style={styles.dialogIconContainer}>
                            <Info size={32} color={PRIMARY_GOLD} />
                        </View>
                        <Text style={styles.dialogTitle}>功能开发中</Text>
                        <Text style={styles.dialogMessage}>头像修改功能正在开发中，敬请期待！</Text>
                        <TouchableOpacity style={styles.dialogBtn} onPress={() => setAvatarModalVisible(false)}>
                            <Text style={styles.dialogBtnText}>知道了</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 昵称编辑弹框 */}
            <Modal visible={nicknameModalVisible} transparent animationType="slide">
                <View style={styles.bottomSheetOverlay}>
                    <TouchableOpacity style={styles.overlayBg} onPress={() => setNicknameModalVisible(false)} />
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>修改昵称</Text>
                            <TouchableOpacity onPress={() => setNicknameModalVisible(false)}>
                                <Text style={styles.sheetCancel}>取消</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.sheetInput}
                            value={editNickname}
                            onChangeText={setEditNickname}
                            placeholder="请输入昵称"
                            placeholderTextColor="#A1A1AA"
                            maxLength={20}
                        />
                        <TouchableOpacity style={styles.sheetSaveBtn} onPress={saveNickname}>
                            <Text style={styles.sheetSaveBtnText}>保存</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 简介编辑弹框 */}
            <Modal visible={bioModalVisible} transparent animationType="slide">
                <View style={styles.bottomSheetOverlay}>
                    <TouchableOpacity style={styles.overlayBg} onPress={() => setBioModalVisible(false)} />
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>编辑简介</Text>
                            <TouchableOpacity onPress={() => setBioModalVisible(false)}>
                                <Text style={styles.sheetCancel}>取消</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={[styles.sheetInput, styles.bioInput]}
                            value={editBio}
                            onChangeText={setEditBio}
                            placeholder="一句话介绍自己（最多50字）"
                            placeholderTextColor="#A1A1AA"
                            maxLength={50}
                            multiline
                            numberOfLines={3}
                        />
                        <Text style={styles.charCount}>{editBio.length}/50</Text>
                        <TouchableOpacity style={styles.sheetSaveBtn} onPress={saveBio}>
                            <Text style={styles.sheetSaveBtnText}>保存</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 生日选择弹框 */}
            <Modal visible={birthdayModalVisible} transparent animationType="slide">
                <View style={styles.bottomSheetOverlay}>
                    <TouchableOpacity style={styles.overlayBg} onPress={() => setBirthdayModalVisible(false)} />
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>选择生日</Text>
                            <TouchableOpacity onPress={() => setBirthdayModalVisible(false)}>
                                <Text style={styles.sheetCancel}>取消</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.pickerContainer}>
                            {/* 年 */}
                            <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                {YEARS.map(year => (
                                    <TouchableOpacity
                                        key={year}
                                        style={[styles.pickerItem, selectedYear === year && styles.pickerItemSelected]}
                                        onPress={() => setSelectedYear(year)}
                                    >
                                        <Text style={[styles.pickerText, selectedYear === year && styles.pickerTextSelected]}>
                                            {year}年
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {/* 月 */}
                            <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                {MONTHS.map(month => (
                                    <TouchableOpacity
                                        key={month}
                                        style={[styles.pickerItem, selectedMonth === month && styles.pickerItemSelected]}
                                        onPress={() => setSelectedMonth(month)}
                                    >
                                        <Text style={[styles.pickerText, selectedMonth === month && styles.pickerTextSelected]}>
                                            {month}月
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {/* 日 */}
                            <ScrollView style={styles.pickerColumn} showsVerticalScrollIndicator={false}>
                                {DAYS.map(day => (
                                    <TouchableOpacity
                                        key={day}
                                        style={[styles.pickerItem, selectedDay === day && styles.pickerItemSelected]}
                                        onPress={() => setSelectedDay(day)}
                                    >
                                        <Text style={[styles.pickerText, selectedDay === day && styles.pickerTextSelected]}>
                                            {day}日
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        <TouchableOpacity style={styles.sheetSaveBtn} onPress={saveBirthday}>
                            <Text style={styles.sheetSaveBtnText}>保存</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#F5F5F5',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 32,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#F0F0F0',
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuLabel: {
        fontSize: 16,
        color: '#09090B',
    },
    menuRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuValue: {
        fontSize: 14,
        color: '#A1A1AA',
        marginRight: 6,
        maxWidth: 180,
    },
    avatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        overflow: 'hidden',
    },
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    // 底部弹框
    bottomSheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    overlayBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    bottomSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        paddingTop: 16,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    sheetCancel: {
        fontSize: 15,
        color: '#71717A',
    },
    sheetInput: {
        backgroundColor: '#F4F4F5',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#09090B',
    },
    bioInput: {
        height: 80,
        textAlignVertical: 'top',
    },
    charCount: {
        textAlign: 'right',
        color: '#A1A1AA',
        fontSize: 12,
        marginTop: 6,
    },
    sheetSaveBtn: {
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    sheetSaveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    // 日期选择器
    pickerContainer: {
        flexDirection: 'row',
        height: 200,
    },
    pickerColumn: {
        flex: 1,
    },
    pickerItem: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    pickerItemSelected: {
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
    },
    pickerText: {
        fontSize: 16,
        color: '#71717A',
    },
    pickerTextSelected: {
        color: PRIMARY_GOLD,
        fontWeight: '600',
    },
    // 弹窗样式
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    dialogContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    dialogIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    dialogTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
    },
    dialogMessage: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
        marginBottom: 24,
    },
    dialogBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: PRIMARY_GOLD,
    },
    dialogBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default PersonalInfoScreen;
