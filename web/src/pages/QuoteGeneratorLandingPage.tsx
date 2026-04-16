import { Link } from 'react-router-dom';

import styles from './QuoteGeneratorLandingPage.module.scss';

const trustItems = [
  { title: '平台认证服务商', description: '精选设计/装修/工长，后台履约与资金可控' },
  { title: '真实案例参考', description: '覆盖全屋/局部/软装三类装修场景' },
  { title: '透明预估范围', description: '预估数字+方向说明，不等同正式报价' },
];

const steps = [
  { label: '填写基础信息', detail: '面积、户型、预算、上门时间' },
  { label: '一键生成预估', detail: '平台智能/规则合成多套方案方向' },
  { label: '预约获取正式方案', detail: '即刻提交信息，设计师/工长会联系' },
];

export function QuoteGeneratorLandingPage() {
  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <p className={styles.badge}>一站式提前感知</p>
        <h1>一键生成方案报价</h1>
        <p className={styles.lede}>
          输入户型、预算、时间，就能马上看到平台预估的装修预算区间与方案方向。
          结果仅为参考，正式报价仍以预约沟通为准。
        </p>
        <div className={styles.ctaRow}>
          <button className={styles.primaryButton} type="button">
            打开小程序生成
          </button>
          <Link className={styles.secondaryButton} to="/providers">
            先看看服务商
          </Link>
        </div>
        <p className={styles.supportText}>
          无法直接跳转？请在微信中搜索“小程序名”或扫码首页推广卡快速进入。
        </p>
      </section>

      <section className={styles.trust}>
        <p className={styles.sectionTitle}>安心观测 · 不承担正式报价</p>
        <div className={styles.trustGrid}>
          {trustItems.map((item) => (
            <article key={item.title} className={styles.trustCard}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.steps}>
        <p className={styles.sectionTitle}>简单三步快速生成预估</p>
        <ol className={styles.stepList}>
          {steps.map((step, index) => (
            <li key={step.label} className={styles.stepItem}>
              <div className={styles.stepIndex}>{index + 1}</div>
              <div>
                <p className={styles.stepLabel}>{step.label}</p>
                <p className={styles.stepDetail}>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.hint}>
        <h2>保持小程序主成交，Web 仅做体验节点</h2>
        <p>
          结果页不直接建项目，所有正式报价/设计确认/工长确认仍在小程序主链完成，
          Web 的角色是“说明价值+把用户拉回小程序”，不承担后续流程。
        </p>
      </section>
    </main>
  );
}
