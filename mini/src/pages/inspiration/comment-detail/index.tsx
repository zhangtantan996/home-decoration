import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';

import { Empty } from '@/components/Empty';
import MiniPageNav from '@/components/MiniPageNav';

import './index.scss';

export default function InspirationCommentDetailPage() {
  const handleBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      Taro.navigateBack();
      return;
    }
    Taro.switchTab({ url: '/pages/inspiration/index' });
  };

  return (
    <View className="page-comment-detail comment-detail-page comment-detail-page--empty">
      <MiniPageNav title="评论详情" onBack={handleBack} placeholder />
      <View className="comment-detail-page__disabled-card">
        <Text className="comment-detail-page__disabled-title">评论功能暂未开放</Text>
        <Empty description="当前仅展示灵感内容，评论和回复功能后续再开放" action={{ text: '返回灵感页', onClick: handleBack }} />
      </View>
    </View>
  );
}
