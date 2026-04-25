import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { useAsyncData } from '../hooks/useAsyncData';
import { getBookingSiteSurvey } from '../services/bookings';
import styles from './BookingStagePage.module.scss';

function readStatusTone(status?: string) {
  if (status === 'submitted') return 'warning';
  if (status === 'confirmed') return 'success';
  if (status === 'revision_requested') return 'danger';
  return 'default';
}

function readStatusText(status?: string) {
  if (status === 'submitted') return '已上传';
  if (status === 'confirmed') return '已确认';
  if (status === 'revision_requested') return '待补充';
  return status || '待上传';
}

function readDimension(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return '-';
  }
  return `${value}`;
}

export function BookingSiteSurveyPage() {
  const params = useParams();
  const bookingId = Number(params.id || 0);
  const { data, loading, error, reload } = useAsyncData(() => getBookingSiteSurvey(bookingId), [bookingId]);

  if (!bookingId) {
    return <div className="container page-stack"><ErrorBlock description="无效预约ID" /></div>;
  }
  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载量房资料" /></div>;
  }
  if (error) {
    return <div className="container page-stack"><ErrorBlock description={error} onRetry={() => void reload()} /></div>;
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <p className="kicker eyebrow-accent">量房资料</p>
              <h1>预约 #{bookingId} 暂无量房资料</h1>
            </div>
            <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
          </div>
          <p className={styles.helperNote}>商家上传后，你可以在这里查看照片、尺寸和备注，无需额外确认操作。</p>
        </section>
      </div>
    );
  }

  const dimensions = Object.entries(data.dimensions || {});

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <p className="kicker eyebrow-accent">量房资料</p>
            <h1>预约 #{bookingId} 量房记录</h1>
          </div>
          <Link className="button-link" to={`/bookings/${bookingId}`}>返回预约详情</Link>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>当前状态</span>
            <strong>{readStatusText(data.status)}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>提交时间</span>
            <strong>{data.submittedAt || '待提交'}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>补充时间</span>
            <strong>{data.revisionRequestedAt || '无'}</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>图片数量</span>
            <strong>{data.photos.length} 张</strong>
          </article>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.mainStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>量房备注</h2>
              <p>量房资料为只读记录，后续调整请在沟通确认节点反馈。</p>
            </div>
            <div className={styles.textBlock}>
              <span className={styles.textBlockLabel}>备注内容</span>
              <p>{data.notes || '暂无补充备注'}</p>
            </div>
            {data.revisionRequestReason ? (
              <div className="status-note" data-tone="danger">补充说明：{data.revisionRequestReason}</div>
            ) : null}
          </section>

          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>尺寸清单</h2>
              <p>按空间维度展示量房尺寸（长/宽/高）。</p>
            </div>
            {dimensions.length ? (
              <div className="list-stack">
                {dimensions.map(([space, dimension]) => (
                  <article className="surface-card" key={space}>
                    <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
                      <strong>{space}</strong>
                      <span className="status-chip" data-tone={readStatusTone(data.status)}>
                        {dimension.unit || 'cm'}
                      </span>
                    </div>
                    <p className="detail-note">
                      长：{readDimension(dimension.length)} / 宽：{readDimension(dimension.width)} / 高：{readDimension(dimension.height)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.helperNote}>暂无尺寸明细</p>
            )}
          </section>
        </div>

        <aside className={styles.sideStack}>
          <section className={`card ${styles.panel}`}>
            <div className={styles.panelHead}>
              <h2>量房照片</h2>
              <p>点击可查看原图</p>
            </div>
            {data.photos.length ? (
              <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                {data.photos.map((photo, index) => (
                  <a href={photo} key={`${photo}-${index}`} rel="noreferrer" target="_blank">
                    <span className="status-chip">查看图片 {index + 1}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className={styles.helperNote}>暂无量房照片</p>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
