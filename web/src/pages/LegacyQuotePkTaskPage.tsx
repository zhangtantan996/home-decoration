import { useParams } from 'react-router-dom';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { getLegacyQuoteComparison } from '../services/legacyQuotePk';

export function LegacyQuotePkTaskPage() {
  const params = useParams();
  const taskId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getLegacyQuoteComparison(taskId), [taskId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载报价对比" /></div>;
  }
  if (error) {
    return <div className="container page-stack"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;
  }
  if (!data?.length) {
    return (
      <div className="container page-stack">
        <EmptyBlock title="暂无可查看报价" description="当前报价记录暂无可展示内容，请从项目进度继续处理。" />
      </div>
    );
  }

  return (
    <div className="container page-stack">
      <StatusBanner
        label="报价记录"
        title={`报价对比 #${taskId}`}
        description="当前报价记录仅支持查看，如需继续处理请前往项目进度。"
        tone="warning"
      />

      <div className="status-note">报价记录仅支持查看；请从项目进度继续处理后续事项。</div>

      <section className="dashboard-shell">
        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">报价列表</p>
              <h2 className="section-title">报价记录</h2>
            </div>
          </div>
          <div className="list-stack">
            {data.map((item) => (
              <div className="list-card" key={item.submissionId}>
                <div>
                  <h3>{item.providerName}</h3>
                  <p>{`评分 ${item.rating.toFixed(1)} · ${item.yearsExperience} 年经验 · 完工 ${item.completedCnt} 单`}</p>
                  <p>{`总价 ¥${item.totalPrice.toLocaleString()} · 工期 ${item.duration} 天`}</p>
                  {item.materials ? <p>{`材料：${item.materials}`}</p> : null}
                  {item.description ? <p>{`说明：${item.description}`}</p> : null}
                  <p>{`提交时间：${item.submittedAt || '-'}`}</p>
                </div>
                <div className="list-meta">
                  <strong>{item.status === 'selected' ? '已选择' : item.status === 'rejected' ? '未选择' : '待确认'}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
