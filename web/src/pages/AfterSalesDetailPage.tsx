import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorBlock, LoadingBlock } from '../components/AsyncState';
import { StatusBanner } from '../components/StatusBanner';
import { useAsyncData } from '../hooks/useAsyncData';
import { cancelAfterSales, getAfterSalesDetail } from '../services/afterSales';

export function AfterSalesDetailPage() {
  const params = useParams();
  const afterSalesId = Number(params.id || 0);
  const [message, setMessage] = useState('');
  const { data, loading, error, reload } = useAsyncData(() => getAfterSalesDetail(afterSalesId), [afterSalesId]);

  if (loading) {
    return <div className="container page-stack"><LoadingBlock title="加载售后详情" /></div>;
  }

  if (error || !data) {
    return <div className="container page-stack"><ErrorBlock description={error || '售后详情不存在'} onRetry={() => void reload()} /></div>;
  }

  return (
    <div className="container page-stack">
      <StatusBanner
        description="你可以在这里回看申请内容、平台回复和处理状态。"
        label="售后详情"
        meta={
          <>
            <span className="status-chip" data-tone={data.status === 0 ? 'warning' : data.status === 1 ? 'brand' : data.status === 2 ? 'success' : 'danger'}>{data.statusText}</span>
            <span className="status-chip">{data.typeText}</span>
          </>
        }
        title={data.reason}
        tone={data.status === 2 ? 'success' : data.status === 3 ? 'warning' : 'info'}
      />

      <section className="split-shell">
        <section className="dashboard-shell">
          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">申请信息</p>
                <h2 className="section-title">单号 {data.orderNo}</h2>
              </div>
              <Link className="button-link" to="/me/after-sales">返回售后中心</Link>
            </div>
            <div className="data-grid detail-grid-two">
              <article>
                <span>关联预约</span>
                <strong>#{data.bookingId}</strong>
              </article>
              <article>
                <span>提交时间</span>
                <strong>{data.createdAt}</strong>
              </article>
              <article>
                <span>申请类型</span>
                <strong>{data.typeText}</strong>
              </article>
              <article>
                <span>涉及金额</span>
                <strong>{data.amountText}</strong>
              </article>
            </div>
            <div className="status-note" style={{ marginTop: 16 }}>{data.description}</div>
          </section>

          <section className="card section-card">
            <div className="panel-head">
              <div>
                <p className="kicker eyebrow-accent">证据材料</p>
                <h2 className="section-title">图片和补充说明</h2>
              </div>
            </div>
            {data.images.length === 0 ? <ErrorBlock title="暂无证据图片" description="本次申请没有上传图片证据。" /> : (
              <div className="grid-3">
                {data.images.map((item) => (
                  <a className="card" href={item} key={item} rel="noreferrer" target="_blank">
                    <img alt="售后证据" src={item} />
                  </a>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="card section-card">
          <div className="panel-head">
            <div>
              <p className="kicker eyebrow-accent">平台处理</p>
              <h2 className="section-title">处理状态与回复</h2>
            </div>
          </div>
          {message ? <div className="status-note" style={{ marginBottom: 16 }}>{message}</div> : null}
          <div className="list-stack">
            <div className="surface-card">
              <div>
                <h3>当前状态</h3>
                <p>{data.statusText}</p>
              </div>
            </div>
            <div className="surface-card">
              <div>
                <h3>平台回复</h3>
                <p>{data.reply}</p>
              </div>
            </div>
            <div className="surface-card">
              <div>
                <h3>完成时间</h3>
                <p>{data.resolvedAt}</p>
              </div>
            </div>
          </div>
          <div className="inline-actions" style={{ marginTop: 18 }}>
            <button
              className="button-danger"
              disabled={data.status !== 0 && data.status !== 1}
              onClick={async () => {
                setMessage('');
                try {
                  await cancelAfterSales(data.id);
                  setMessage('申请已取消。');
                  await reload();
                } catch (cancelError) {
                  setMessage(cancelError instanceof Error ? cancelError.message : '取消失败');
                }
              }}
              type="button"
            >
              取消申请
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}
