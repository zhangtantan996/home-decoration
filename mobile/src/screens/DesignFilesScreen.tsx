import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    Image,
    Linking,
    ActivityIndicator,
    Dimensions,
    StatusBar,
    Platform,
    Modal,
    ScrollView,
} from 'react-native';
import { ArrowLeft, FileText, Download, X, ZoomIn } from 'lucide-react-native';
import { billApi } from '../services/api';
import InfoModal from '../components/InfoModal';
import { getApiBaseUrl } from '../config';
import { downloadFile } from '../utils/fileDownload';

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const ITEM_WIDTH = (width - 48) / COLUMN_COUNT;

interface DesignFilesScreenProps {
    route: any;
    navigation: any;
}

const DesignFilesScreen: React.FC<DesignFilesScreenProps> = ({ route, navigation }) => {
    const { projectId } = route.params;
    const [files, setFiles] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Image preview state
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [downloading, setDownloading] = useState<string | null>(null); // Track which file is downloading

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({ title: '', message: '', type: 'info' });

    useEffect(() => {
        loadFiles();
    }, [projectId]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const res = await billApi.getFiles(projectId);
            setFiles(res.data?.files || []);
        } catch (error: any) {
            setModalConfig({
                title: '加载失败',
                message: error.message || '请稀后重试',
                type: 'error'
            });
            setModalVisible(true);
        } finally {
            setLoading(false);
        }
    };

    const isImage = (url: string) => {
        const lowerUrl = url.toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/.test(lowerUrl);
    };

    const getFileName = (url: string) => {
        try {
            const parts = url.split('/');
            let name = parts[parts.length - 1] || '未命名文件';
            // Remove query string if present
            if (name.includes('?')) {
                name = name.split('?')[0];
            }
            return name;
        } catch {
            return '未命名文件';
        }
    };

    const getFullUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    // 获取所有图片的完整 URL 列表
    const getImageFileUrls = () => {
        return files.filter(f => isImage(f)).map(f => getFullUrl(f));
    };

    // 打开图片预览
    const handleImagePress = (url: string) => {
        const imageUrls = getImageFileUrls();
        const fullUrl = getFullUrl(url);
        const index = imageUrls.indexOf(fullUrl);
        setPreviewImages(imageUrls);
        setCurrentImageIndex(index >= 0 ? index : 0);
        setPreviewVisible(true);
    };

    // 下载非图片文件
    const handleDownload = async (url: string) => {
        const fullUrl = getFullUrl(url);
        setDownloading(url);

        const result = await downloadFile(fullUrl);
        setDownloading(null);

        if (result.success) {
            setModalConfig({
                title: '下载成功',
                message: '文件已保存到下载目录',
                type: 'success'
            });
        } else {
            setModalConfig({
                title: '下载失败',
                message: result.error || '请稍后重试',
                type: 'error'
            });
        }
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: string }) => {
        const isImg = isImage(item);
        const fileName = getFileName(item);
        const fullUrl = getFullUrl(item);
        const isDownloading = downloading === item;

        return (
            <TouchableOpacity
                style={styles.fileCard}
                onPress={() => isImg ? handleImagePress(item) : handleDownload(item)}
                activeOpacity={0.7}
                disabled={isDownloading}
            >
                <View style={styles.previewContainer}>
                    {isImg ? (
                        <Image
                            source={{ uri: fullUrl }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.genericFileIcon}>
                            <FileText size={40} color="#94A3B8" />
                        </View>
                    )}
                    {/* Overlay for type indicator */}
                    <View style={styles.typeTag}>
                        <Text style={styles.typeText}>{isImg ? 'IMG' : 'FILE'}</Text>
                    </View>
                </View>

                <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={2}>{fileName}</Text>
                    <View style={styles.actionRow}>
                        {isImg ? (
                            <>
                                <Text style={styles.actionText}>点击预览</Text>
                                <ZoomIn size={14} color="#3B82F6" />
                            </>
                        ) : (
                            <>
                                <Text style={styles.actionText}>
                                    {isDownloading ? '下载中...' : '点击下载'}
                                </Text>
                                <Download size={14} color={isDownloading ? '#10B981' : '#3B82F6'} />
                            </>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // 图片预览 Modal
    const renderImagePreview = () => (
        <Modal
            visible={previewVisible}
            transparent
            onRequestClose={() => setPreviewVisible(false)}
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.previewOverlay}>
                {/* 关闭按钮 */}
                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setPreviewVisible(false)}
                >
                    <X size={28} color="#FFFFFF" />
                </TouchableOpacity>

                {/* 图片索引 */}
                {previewImages.length > 1 && (
                    <View style={styles.indexIndicator}>
                        <Text style={styles.indexText}>
                            {currentImageIndex + 1} / {previewImages.length}
                        </Text>
                    </View>
                )}

                {/* 可滑动的图片列表 */}
                <FlatList
                    data={previewImages}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={currentImageIndex}
                    getItemLayout={(data, index) => ({
                        length: width,
                        offset: width * index,
                        index,
                    })}
                    onMomentumScrollEnd={(e) => {
                        const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                        setCurrentImageIndex(newIndex);
                    }}
                    renderItem={({ item }) => (
                        <View style={styles.previewImageContainer}>
                            <Image
                                source={{ uri: item }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        </View>
                    )}
                    keyExtractor={(item, index) => index.toString()}
                />
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#09090B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>设计图纸</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>设计图纸</Text>
                <View style={{ width: 40 }} />
            </View>

            {files.length === 0 ? (
                <View style={styles.centerContainer}>
                    <FileText size={48} color="#E4E4E7" />
                    <Text style={styles.emptyText}>暂无图纸文件</Text>
                </View>
            ) : (
                <FlatList
                    data={files}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => index.toString()}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={styles.listContent}
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* 图片预览 Modal */}
            {renderImagePreview()}

            <InfoModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F4F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E4E4E7',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 10 : 12,
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 14,
        color: '#71717A',
    },
    fileCard: {
        width: ITEM_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    previewContainer: {
        height: ITEM_WIDTH, // Square
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    genericFileIcon: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeTag: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    fileInfo: {
        padding: 12,
    },
    fileName: {
        fontSize: 14,
        color: '#18181B',
        marginBottom: 8,
        height: 40, // Fixed height for 2 lines
        lineHeight: 20,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    actionText: {
        fontSize: 12,
        color: '#3B82F6',
        marginRight: 4,
    },
    // Image Preview Styles
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 10 : 50,
        right: 16,
        zIndex: 10,
        padding: 8,
    },
    indexIndicator: {
        position: 'absolute',
        top: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 16 : 56,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    indexText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    previewImageContainer: {
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: width,
        height: height * 0.8,
    },
});

export default DesignFilesScreen;
