import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Platform,
} from 'react-native';
import { ArrowLeft, Star, MapPin, MessageCircle, Calendar, Award, Briefcase, Users, Clock, ChevronRight, Heart, Share2 } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// ========== Designer Detail Screen ==========
export const DesignerDetailScreen = ({ route, navigation }: any) => {
    const { designer } = route.params;

    const portfolioImages = [
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>设计师详情</Text>
                <TouchableOpacity style={styles.shareBtn}>
                    <Share2 size={20} color="#111" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <Image source={{ uri: designer.avatar }} style={styles.avatar} />
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{designer.name}</Text>
                        <View style={styles.ratingRow}>
                            <Star size={14} color="#F59E0B" fill="#F59E0B" />
                            <Text style={styles.ratingText}>{designer.rating}</Text>
                            <Text style={styles.reviewCount}>({designer.reviewCount}条评价)</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>{designer.yearsExperience}年经验</Text>
                            <Text style={styles.metaDivider}>|</Text>
                            <Text style={styles.metaText}>{designer.specialty}</Text>
                        </View>
                        <View style={styles.orgRow}>
                            <View style={styles.orgBadge}>
                                <Text style={styles.orgBadgeText}>
                                    {designer.orgType === 'personal' ? '个人' : designer.orgType === 'studio' ? '工作室' : '公司'}
                                </Text>
                            </View>
                            <Text style={styles.orgName}>{designer.orgLabel}</Text>
                        </View>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statsSection}>
                    <View style={styles.statItem}>
                        <Briefcase size={20} color="#71717A" />
                        <Text style={styles.statValue}>128</Text>
                        <Text style={styles.statLabel}>完成项目</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Users size={20} color="#71717A" />
                        <Text style={styles.statValue}>1.2k</Text>
                        <Text style={styles.statLabel}>粉丝</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MapPin size={20} color="#71717A" />
                        <Text style={styles.statValue}>{designer.distance}</Text>
                        <Text style={styles.statLabel}>距离</Text>
                    </View>
                </View>

                {/* Reference Price */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>参考报价</Text>
                    <Text style={styles.companyPrice}>¥300-500/m²</Text>
                </View>

                {/* Portfolio */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>作品案例</Text>
                        <TouchableOpacity
                            style={styles.moreBtn}
                            onPress={() => navigation.navigate('CaseGallery', { providerName: designer.name, providerType: 'designer' })}
                        >
                            <Text style={styles.moreText}>查看全部</Text>
                            <ChevronRight size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        {portfolioImages.map((img, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => navigation.navigate('CaseDetail', {
                                    caseItem: {
                                        id: idx,
                                        title: '现代简约三居室改造',
                                        coverImage: img,
                                        style: '现代简约',
                                        area: '120㎡',
                                        year: '2024',
                                        description: '本案例位于城市中心高档社区，业主是一对年轻夫妇。他们希望打造一个简洁大气、功能完善的现代化住宅。',
                                        images: portfolioImages,
                                        height: 200
                                    },
                                    providerName: designer.name,
                                    providerType: 'designer'
                                })}
                            >
                                <Image source={{ uri: img }} style={styles.portfolioImage} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Service Description */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>服务介绍</Text>
                    <Text style={styles.descText}>
                        专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。
                    </Text>
                </View>

                {/* Reviews */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>用户评价</Text>
                        <TouchableOpacity style={styles.moreBtn}>
                            <Text style={styles.moreText}>全部评价</Text>
                            <ChevronRight size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <View style={styles.reviewAvatar} />
                            <View>
                                <Text style={styles.reviewUser}>王女士</Text>
                                <View style={styles.reviewStars}>
                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} color="#F59E0B" fill="#F59E0B" />)}
                                </View>
                            </View>
                            <Text style={styles.reviewDate}>2024-12-15</Text>
                        </View>
                        <Text style={styles.reviewText}>设计师非常专业，方案很符合我们的需求，沟通也很耐心。强烈推荐！</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.consultBtn}
                    onPress={() => navigation.navigate('ChatRoom', {
                        conversation: {
                            id: designer.id,
                            name: designer.name,
                            avatar: designer.avatar,
                            role: 'designer',
                            roleLabel: '设计师',
                            isOnline: true,
                        }
                    })}
                >
                    <MessageCircle size={18} color="#111" />
                    <Text style={styles.consultBtnText}>在线咨询</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() => navigation.navigate('Booking', { provider: designer, providerType: 'designer' })}
                >
                    <Text style={styles.bookBtnText}>立即预约</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// ========== Worker Detail Screen ==========
export const WorkerDetailScreen = ({ route, navigation }: any) => {
    const { worker } = route.params;

    const caseImages = [
        'https://images.unsplash.com/photo-1484154218962-a1c002085aac?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>师傅详情</Text>
                <TouchableOpacity style={styles.shareBtn}>
                    <Share2 size={20} color="#111" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <Image source={{ uri: worker.avatar }} style={styles.avatar} />
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{worker.name}</Text>
                        <View style={styles.ratingRow}>
                            <Star size={14} color="#F59E0B" fill="#F59E0B" />
                            <Text style={styles.ratingText}>{worker.rating}</Text>
                            <Text style={styles.reviewCount}>({worker.reviewCount}条评价)</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>{worker.yearsExperience}年经验</Text>
                            <Text style={styles.metaDivider}>|</Text>
                            <Text style={styles.metaText}>已完成{worker.completedOrders}单</Text>
                        </View>
                        <View style={styles.workTypeBadges}>
                            <View style={styles.workTypeBadge}>
                                <Text style={styles.workTypeBadgeText}>{worker.workTypeLabels}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statsSection}>
                    <View style={styles.statItem}>
                        <Briefcase size={20} color="#71717A" />
                        <Text style={styles.statValue}>{worker.completedOrders}</Text>
                        <Text style={styles.statLabel}>完成订单</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Award size={20} color="#71717A" />
                        <Text style={styles.statValue}>{worker.rating}</Text>
                        <Text style={styles.statLabel}>服务评分</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MapPin size={20} color="#71717A" />
                        <Text style={styles.statValue}>{worker.distance}</Text>
                        <Text style={styles.statLabel}>距离</Text>
                    </View>
                </View>

                {/* Reference Price */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>参考报价</Text>
                    <Text style={styles.companyPrice}>¥{worker.priceRange}{worker.priceUnit?.replace('平米', 'm²')}</Text>
                </View>

                {/* Tags */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>服务特点</Text>
                    <View style={styles.tagsContainer}>
                        {worker.tags.map((tag: string, idx: number) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Cases */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>服务案例</Text>
                        <TouchableOpacity
                            style={styles.moreBtn}
                            onPress={() => navigation.navigate('CaseGallery', { providerName: worker.name, providerType: 'worker' })}
                        >
                            <Text style={styles.moreText}>查看全部</Text>
                            <ChevronRight size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        {caseImages.map((img, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => navigation.navigate('CaseDetail', {
                                    caseItem: {
                                        id: idx,
                                        title: '厨卫改造项目',
                                        coverImage: img,
                                        style: '实用主义',
                                        area: '15㎡',
                                        year: '2024',
                                        description: '针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。',
                                        images: caseImages,
                                        height: 200
                                    },
                                    providerName: worker.name,
                                    providerType: 'worker'
                                })}
                            >
                                <Image source={{ uri: img }} style={styles.portfolioImage} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Reviews */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>用户评价</Text>
                        <TouchableOpacity style={styles.moreBtn}>
                            <Text style={styles.moreText}>全部评价</Text>
                            <ChevronRight size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <View style={styles.reviewAvatar} />
                            <View>
                                <Text style={styles.reviewUser}>李先生</Text>
                                <View style={styles.reviewStars}>
                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} color="#F59E0B" fill="#F59E0B" />)}
                                </View>
                            </View>
                            <Text style={styles.reviewDate}>2024-12-10</Text>
                        </View>
                        <Text style={styles.reviewText}>师傅手艺很好，干活细致认真，工期也按时完成。下次还找他！</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.consultBtn}
                    onPress={() => navigation.navigate('ChatRoom', {
                        conversation: {
                            id: worker.id,
                            name: worker.name,
                            avatar: worker.avatar,
                            role: 'worker',
                            roleLabel: '工人',
                            isOnline: true,
                        }
                    })}
                >
                    <MessageCircle size={18} color="#111" />
                    <Text style={styles.consultBtnText}>在线咨询</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() => navigation.navigate('Booking', { provider: worker, providerType: 'worker' })}
                >
                    <Text style={styles.bookBtnText}>立即预约</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// ========== Company Detail Screen ==========
export const CompanyDetailScreen = ({ route, navigation }: any) => {
    const { company } = route.params;

    const caseImages = [
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>公司详情</Text>
                <TouchableOpacity style={styles.shareBtn}>
                    <Share2 size={20} color="#111" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Company Header */}
                <View style={styles.companyHeaderSection}>
                    <Image source={{ uri: company.logo }} style={styles.companyLogo} />
                    <Text style={styles.companyName}>{company.name}</Text>
                    <View style={styles.ratingRow}>
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{company.rating}</Text>
                        <Text style={styles.reviewCount}>({company.reviewCount}条评价)</Text>
                    </View>
                    <Text style={styles.companyEstablished}>成立于{company.establishedYear}年</Text>
                </View>

                {/* Stats */}
                <View style={styles.statsSection}>
                    <View style={styles.statItem}>
                        <Users size={20} color="#71717A" />
                        <Text style={styles.statValue}>{company.teamSize}人</Text>
                        <Text style={styles.statLabel}>团队规模</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Briefcase size={20} color="#71717A" />
                        <Text style={styles.statValue}>{company.completedOrders}</Text>
                        <Text style={styles.statLabel}>完成项目</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MapPin size={20} color="#71717A" />
                        <Text style={styles.statValue}>{company.distance}</Text>
                        <Text style={styles.statLabel}>距离</Text>
                    </View>
                </View>

                {/* Service Scope */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>服务范围</Text>
                    <Text style={styles.descText}>{company.workTypeLabels}</Text>
                </View>

                {/* Certifications */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>资质认证</Text>
                    <View style={styles.certsContainer}>
                        {company.certifications?.map((cert: string, idx: number) => (
                            <View key={idx} style={styles.certBadge}>
                                <Award size={14} color="#059669" />
                                <Text style={styles.certText}>{cert}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Price */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>参考报价</Text>
                    <Text style={styles.companyPrice}>¥{company.priceRange}{company.priceUnit?.replace('平米', 'm²')}</Text>
                </View>

                {/* Cases */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>工程案例</Text>
                        <TouchableOpacity
                            style={styles.moreBtn}
                            onPress={() => navigation.navigate('CaseGallery', { providerName: company.name, providerType: 'company' })}
                        >
                            <Text style={styles.moreText}>查看全部</Text>
                            <ChevronRight size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        {caseImages.map((img, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => navigation.navigate('CaseDetail', {
                                    caseItem: {
                                        id: idx,
                                        title: '整装全包案例',
                                        coverImage: img,
                                        style: '现代轻奢',
                                        area: '140㎡',
                                        year: '2023',
                                        description: '从毛坯到精装的全流程整装服务，包含硬装施工、主材选购、软装搭配等一站式解决方案。',
                                        images: caseImages,
                                        height: 200
                                    },
                                    providerName: company.name,
                                    providerType: 'company'
                                })}
                            >
                                <Image source={{ uri: img }} style={styles.portfolioImage} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Reviews */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>用户评价</Text>
                        <TouchableOpacity style={styles.moreBtn}>
                            <Text style={styles.moreText}>全部评价</Text>
                            <ChevronRight size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                            <View style={styles.reviewAvatar} />
                            <View>
                                <Text style={styles.reviewUser}>张先生</Text>
                                <View style={styles.reviewStars}>
                                    {[1, 2, 3, 4, 5].map(i => <Star key={i} size={12} color="#F59E0B" fill="#F59E0B" />)}
                                </View>
                            </View>
                            <Text style={styles.reviewDate}>2024-12-08</Text>
                        </View>
                        <Text style={styles.reviewText}>公司很正规，施工质量有保障，售后服务也很到位。整体满意！</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.consultBtn}
                    onPress={() => navigation.navigate('ChatRoom', {
                        conversation: {
                            id: company.id,
                            name: company.name,
                            avatar: company.logo,
                            role: 'company',
                            roleLabel: '公司',
                            isOnline: true,
                        }
                    })}
                >
                    <MessageCircle size={18} color="#111" />
                    <Text style={styles.consultBtnText}>在线咨询</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={() => navigation.navigate('Booking', { provider: company, providerType: 'company' })}
                >
                    <Text style={styles.bookBtnText}>立即预约</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111',
    },
    shareBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    profileSection: {
        flexDirection: 'row',
        padding: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E5E7EB',
    },
    profileInfo: {
        flex: 1,
        marginLeft: 16,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 6,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111',
        marginLeft: 4,
    },
    reviewCount: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    metaText: {
        fontSize: 13,
        color: '#6B7280',
    },
    metaDivider: {
        marginHorizontal: 8,
        color: '#D1D5DB',
    },
    orgRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orgBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    orgBadgeText: {
        fontSize: 11,
        color: '#4F46E5',
        fontWeight: '500',
    },
    orgName: {
        fontSize: 12,
        color: '#6B7280',
    },
    statsSection: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
    },
    section: {
        padding: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
    },
    moreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    moreText: {
        fontSize: 13,
        color: '#9CA3AF',
    },
    portfolioScroll: {
        marginTop: 12,
    },
    portfolioImage: {
        width: 140,
        height: 100,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E7EB',
    },
    descText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 22,
        marginTop: 12,
    },
    reviewCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    reviewAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E5E7EB',
        marginRight: 12,
    },
    reviewUser: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111',
    },
    reviewStars: {
        flexDirection: 'row',
        marginTop: 2,
    },
    reviewDate: {
        marginLeft: 'auto',
        fontSize: 12,
        color: '#9CA3AF',
    },
    reviewText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
    },
    // Worker specific
    workTypeBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    workTypeBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    workTypeBadgeText: {
        fontSize: 11,
        color: '#D97706',
        fontWeight: '500',
    },
    priceSection: {
        padding: 20,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    priceValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#EF4444',
    },
    priceUnit: {
        fontSize: 13,
        fontWeight: 'normal',
        color: '#9CA3AF',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    tag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
        marginBottom: 8,
    },
    tagText: {
        fontSize: 13,
        color: '#4B5563',
    },
    // Company specific
    companyHeaderSection: {
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 8,
        borderBottomColor: '#F3F4F6',
    },
    companyLogo: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: '#E5E7EB',
        marginBottom: 16,
    },
    companyName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    companyEstablished: {
        fontSize: 13,
        color: '#9CA3AF',
        marginTop: 8,
    },
    certsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    certBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    certText: {
        fontSize: 12,
        color: '#059669',
        marginLeft: 4,
    },
    companyPrice: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#EF4444',
        marginTop: 8,
    },
    // Bottom Bar - Reference UI Style
    bottomBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#fff',
    },
    consultBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderRadius: 8,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    consultBtnText: {
        color: '#111',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    bookBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        paddingVertical: 10,
        borderRadius: 8,
    },
    bookBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
