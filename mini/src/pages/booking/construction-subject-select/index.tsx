import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Tag';
import { selectConstructionParty } from '@/services/construction-party';
import { listProviders, type ProviderListItem } from '@/services/providers';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const ConstructionSubjectSelect: React.FC = () => {
  const auth = useAuthStore();
  const [bookingId, setBookingId] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);

  useLoad((options) => {
    if (options.bookingId) {
      setBookingId(Number(options.bookingId));
    }
  });

  useEffect(() => {
    if (!bookingId || !auth.token) {
      setLoading(false);
      return;
    }

    const fetchProviders = async () => {
      setLoading(true);
      try {
        // 获取装修公司（providerType=2）和独立工长（providerType=3）
        const [companiesRes, foremenRes] = await Promise.all([
          listProviders({ type: '2', page: 1, pageSize: 20 }),
          listProviders({ type: '3', page: 1, pageSize: 20 }),
        ]);

        const allProviders = [
          ...(companiesRes.list || []),
          ...(foremenRes.list || []),
        ];

        setProviders(allProviders);
      } catch (error) {
        showErrorToast(error, '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [bookingId, auth.token]);

  const handleSelectProvider = async (provider: ProviderListItem) => {
    if (!bookingId || submitting) {
      return;
    }

    Taro.showModal({
      title: '确认选择',
      content: `确定选择 ${provider.companyName || provider.nickname} 作为施工方吗？`,
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          setSubmitting(true);
          await selectConstructionParty(bookingId, {
            providerId: provider.id,
            providerType: provider.providerType as 2 | 3,
          });

          Taro.showToast({ title: '已提交选择，进入施工桥接推进', icon: 'success' });
          Taro.redirectTo({
            url: `/pages/booking/construction-confirm-waiting/index?bookingId=${bookingId}&providerId=${provider.id}`,
          });
        } catch (error) {
          showErrorToast(error, '选择失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const getProviderTypeLabel = (providerType: number) => {
    if (providerType === 2) return '装修公司';
    if (providerType === 3) return '独立工长';
    return '服务商';
  };

  if (!auth.token) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty
          description="登录后选择施工方"
          action={{ text: '去登录', onClick: () => Taro.switchTab({ url: '/pages/profile/index' }) }}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Skeleton height={120} className="mb-md" />
        <Skeleton height={120} className="mb-md" />
        <Skeleton height={120} />
      </View>
    );
  }

  if (providers.length === 0) {
    return (
      <View className="page bg-gray-50 min-h-screen p-md">
        <Empty description="暂无可选施工方" />
      </View>
    );
  }

  return (
    <View className="page construction-select-page bg-gray-50 min-h-screen">
      <ScrollView scrollY className="h-full">
        <View className="p-md">
          <View className="construction-select-page__header">
            <Text className="construction-select-page__title">选择施工方</Text>
            <Text className="construction-select-page__subtitle">
              请选择装修公司或独立工长作为施工主体
            </Text>
          </View>

          <View className="construction-select-page__list">
            {providers.map((provider) => {
              const displayName = provider.companyName || provider.nickname || `服务商 #${provider.id}`;
              const providerInitial = displayName.slice(0, 1);

              return (
                <View key={provider.id} className="construction-select-page__card">
                  <View className="construction-select-page__card-header">
                    {provider.avatar ? (
                      <Image
                        className="construction-select-page__avatar"
                        src={provider.avatar}
                        mode="aspectFill"
                      />
                    ) : (
                      <View className="construction-select-page__avatar construction-select-page__avatar--fallback">
                        <Text className="construction-select-page__avatar-text">{providerInitial}</Text>
                      </View>
                    )}
                    <View className="construction-select-page__card-main">
                      <View className="construction-select-page__card-top">
                        <Text className="construction-select-page__name">{displayName}</Text>
                        <Tag variant="brand">{getProviderTypeLabel(provider.providerType)}</Tag>
                      </View>
                      <View className="construction-select-page__tags">
                        {provider.verified ? <Tag variant="success">已认证</Tag> : null}
                        {provider.rating ? (
                          <Tag variant="default">{provider.rating.toFixed(1)} 分</Tag>
                        ) : null}
                        {provider.completedCnt ? (
                          <Tag variant="default">{provider.completedCnt} 案例</Tag>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {provider.specialty ? (
                    <View className="construction-select-page__specialty">
                      <Text className="construction-select-page__specialty-text">{provider.specialty}</Text>
                    </View>
                  ) : null}

                  {provider.serviceArea ? (
                    <View className="construction-select-page__service-area">
                      <Text className="construction-select-page__label">服务范围：</Text>
                      <Text className="construction-select-page__value">
                        {Array.isArray(provider.serviceArea)
                          ? provider.serviceArea.join('、')
                          : provider.serviceArea}
                      </Text>
                    </View>
                  ) : null}

                  <View className="construction-select-page__card-footer">
                    <Button
                      variant="primary"
                      size="md"
                      className="construction-select-page__select-btn"
                      disabled={submitting}
                      onClick={() => handleSelectProvider(provider)}
                    >
                      选择
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ConstructionSubjectSelect;
