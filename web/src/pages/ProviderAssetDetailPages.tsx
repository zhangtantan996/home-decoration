import { useNavigate, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getProviderSceneDetail, getProviderShowcaseDetail } from '../services/providers';
import type { ProviderSceneDetailVM, ProviderShowcaseDetailVM } from '../types/viewModels';

type ProviderAssetDetailData = {
  title: string;
  description: string;
  coverImage: string;
  galleryImages: string[];
  metaItems: Array<{ label: string; value: string }>;
  backLabel: string;
  kicker: string;
};

function ProviderAssetDetailLayout({
  data,
  loading,
  error,
  onRetry,
  loadingTitle,
  invalidMessage,
}: {
  data: ProviderAssetDetailData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  loadingTitle: string;
  invalidMessage: string;
}) {
  const navigate = useNavigate();

  if (loading) return <div className="top-detail"><LoadingBlock title={loadingTitle} /></div>;
  if (error || !data) return <div className="top-detail"><ErrorBlock description={error || invalidMessage} onRetry={onRetry} /></div>;

  return (
    <div className="top-detail">
      <section className="detail-header">
        <div className="detail-header-row">
          <div>
            <p className="detail-kicker">{data.kicker}</p>
            <h1>{data.title}</h1>
            <p>{data.description}</p>
          </div>
          <div className="inline-actions">
            <button className="button-outline" onClick={() => navigate(-1)} type="button">{data.backLabel}</button>
          </div>
        </div>
      </section>

      <section className="detail-main">
        <section className="card section-card">
          <img alt={data.title} className="detail-cover tall" src={data.coverImage} />
          <div className="detail-stat-grid" style={{ marginTop: 16 }}>
            {data.metaItems.map((item) => (
              <article className="detail-stat" key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="card section-card">
          <div className="section-head"><h2>图集</h2></div>
          <div className="detail-gallery">
            {data.galleryImages.map((image) => (
              <img alt={data.title} key={image} src={image} />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function toShowcaseLayout(detail: ProviderShowcaseDetailVM): ProviderAssetDetailData {
  const categoryText = [detail.style, detail.layout].filter(Boolean).join(' · ') || '服务商案例';
  return {
    title: detail.title,
    description: detail.description,
    coverImage: detail.coverImage,
    galleryImages: detail.galleryImages,
    metaItems: [
      { label: '展示类型', value: categoryText },
      { label: '面积', value: detail.area || '待补充' },
      { label: '年份', value: detail.year || '待补充' },
    ],
    backLabel: '返回服务商详情',
    kicker: '案例详情',
  };
}

function toSceneLayout(detail: ProviderSceneDetailVM): ProviderAssetDetailData {
  return {
    title: detail.title,
    description: detail.description,
    coverImage: detail.coverImage,
    galleryImages: detail.galleryImages,
    metaItems: [
      { label: '案例类型', value: '真实项目案例' },
      { label: '归档年份', value: detail.year || '待补充' },
      { label: '更新时间', value: detail.createdAt || '待补充' },
    ],
    backLabel: '返回服务商详情',
    kicker: '案例实景详情',
  };
}

export function ProviderShowcaseDetailPage() {
  const params = useParams();
  const showcaseId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!showcaseId) throw new Error('无效案例 ID');
    return getProviderShowcaseDetail(showcaseId);
  }, [showcaseId]);

  return (
    <ProviderAssetDetailLayout
      data={data ? toShowcaseLayout(data) : null}
      error={error}
      invalidMessage="案例详情加载失败"
      loading={loading}
      loadingTitle="加载案例详情"
      onRetry={() => void reload()}
    />
  );
}

export function ProviderSceneDetailPage() {
  const params = useParams();
  const sceneId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!sceneId) throw new Error('无效案例实景 ID');
    return getProviderSceneDetail(sceneId);
  }, [sceneId]);

  return (
    <ProviderAssetDetailLayout
      data={data ? toSceneLayout(data) : null}
      error={error}
      invalidMessage="案例实景详情加载失败"
      loading={loading}
      loadingTitle="加载案例实景详情"
      onRetry={() => void reload()}
    />
  );
}
