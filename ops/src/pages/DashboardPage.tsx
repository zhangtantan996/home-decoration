import {
  AppstoreOutlined,
  BankOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  RightOutlined,
  ShopOutlined,
  ToolOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Button, Card, Skeleton, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  listBookings,
  listCases,
  listMaterialShops,
  listProviders,
  showApiError,
  type BookingItem,
  type CaseItem,
  type MaterialShopItem,
  type ProviderItem,
} from '../services/api';

interface DashboardState {
  designers: ProviderItem[];
  foremen: ProviderItem[];
  companies: ProviderItem[];
  shops: MaterialShopItem[];
  cases: CaseItem[];
  bookings: BookingItem[];
}

const emptyState: DashboardState = {
  designers: [],
  foremen: [],
  companies: [],
  shops: [],
  cases: [],
  bookings: [],
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [state, setState] = useState<DashboardState>(emptyState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [designers, foremen, companies, shops, cases, bookings] = await Promise.all([
          listProviders('designer'),
          listProviders('foreman'),
          listProviders('company'),
          listMaterialShops(),
          listCases(),
          listBookings(),
        ]);
        setState({
          designers: designers.list,
          foremen: foremen.list,
          companies: companies.list,
          shops: shops.list,
          cases: cases.list,
          bookings: bookings.list,
        });
      } catch (error) {
        showApiError(error, '工作台加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const supply = [...state.designers, ...state.foremen, ...state.companies, ...state.shops];
  const onlineCount = supply.filter((item) => item.status !== 0).length;
  const offlineCount = Math.max(0, supply.length - onlineCount);
  const pendingBookings = state.bookings.filter((item) => !item.status || item.status === 1).length;
  const visibleCases = state.cases.filter((item) => item.showInInspiration !== false).length;
  const nickname = user?.nickname || user?.username || '超级管理员';

  const statCards = [
    {
      key: 'total',
      label: '商家总数',
      value: supply.length,
      changeLabel: '较昨日',
      changeValue: '—',
      changeTone: 'neutral',
      tone: 'blue',
      icon: <UserAddOutlined />,
    },
    {
      key: 'online',
      label: '已上线',
      value: onlineCount,
      changeLabel: '较昨日',
      changeValue: '—',
      changeTone: 'positive',
      tone: 'green',
      icon: <CheckCircleOutlined />,
    },
    {
      key: 'offline',
      label: '已下线',
      value: offlineCount,
      changeLabel: '较昨日',
      changeValue: '—',
      changeTone: 'negative',
      tone: 'red',
      icon: <AppstoreOutlined />,
    },
    {
      key: 'booking',
      label: '待联系预约',
      value: pendingBookings,
      changeLabel: '较昨日',
      changeValue: '—',
      changeTone: 'neutral',
      tone: 'amber',
      icon: <UserAddOutlined />,
    },
  ];

  const distributionCards = [
    {
      key: 'designer',
      label: '设计师',
      value: state.designers.length,
      ratio: supply.length ? `${((state.designers.length / supply.length) * 100).toFixed(1)}%` : '0.0%',
      icon: <FileTextOutlined />,
      watermark: '人',
      tone: 'blue',
    },
    {
      key: 'foreman',
      label: '工长',
      value: state.foremen.length,
      ratio: supply.length ? `${((state.foremen.length / supply.length) * 100).toFixed(1)}%` : '0.0%',
      icon: <ToolOutlined />,
      watermark: '工',
      tone: 'green',
    },
    {
      key: 'company',
      label: '装修公司',
      value: state.companies.length,
      ratio: supply.length ? `${((state.companies.length / supply.length) * 100).toFixed(1)}%` : '0.0%',
      icon: <BankOutlined />,
      watermark: '司',
      tone: 'indigo',
    },
    {
      key: 'shop',
      label: '主材商',
      value: state.shops.length,
      ratio: supply.length ? `${((state.shops.length / supply.length) * 100).toFixed(1)}%` : '0.0%',
      icon: <ShopOutlined />,
      watermark: '店',
      tone: 'orange',
    },
  ];

  const todoItems = [
    {
      key: 'bookings',
      title: '预约待联系',
      description: '需要运营线下联系与备注',
      value: pendingBookings,
      icon: <UserAddOutlined />,
      tone: 'red',
      onClick: () => navigate('/bookings'),
    },
    {
      key: 'supply',
      title: '服务商维护',
      description: '补充封面、价格、标签和介绍',
      value: supply.length,
      icon: <AppstoreOutlined />,
      tone: 'amber',
      onClick: () => navigate('/providers'),
    },
    {
      key: 'inspirations',
      title: '展示中灵感',
      description: '小程序灵感中心可见内容',
      value: visibleCases,
      icon: <FileTextOutlined />,
      tone: 'blue',
      onClick: () => navigate('/inspirations'),
    },
  ];

  const renderMetricCard = (item: typeof statCards[number]) => (
    <Card key={item.key} bordered={false} className={`ops-dashboard-metric ops-dashboard-metric--${item.tone}`}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : (
        <div className="ops-dashboard-metric__body">
          <div className="ops-dashboard-metric__content">
            <span className="ops-dashboard-metric__label">{item.label}</span>
            <strong className="ops-dashboard-metric__value">{item.value}</strong>
            <div className="ops-dashboard-metric__change">
              <span>{item.changeLabel}</span>
              <b className={`ops-dashboard-metric__delta ops-dashboard-metric__delta--${item.changeTone}`}>{item.changeValue}</b>
            </div>
          </div>
          <span className="ops-dashboard-metric__icon">{item.icon}</span>
        </div>
      )}
    </Card>
  );

  return (
    <div className="ops-page ops-dashboard">
      <section className="ops-dashboard__hero">
        <div className="ops-dashboard__hero-copy">
          <Typography.Title level={1}>工作台首页</Typography.Title>
          <Typography.Paragraph>欢迎回来，{nickname}，今日运营数据概览</Typography.Paragraph>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/providers')}>
          进入服务商
        </Button>
      </section>

      <section className="ops-dashboard__metrics">
        {statCards.map(renderMetricCard)}
      </section>

      <section className="ops-dashboard__workspace">
        <Card
          bordered={false}
          className="ops-dashboard-panel"
          title={<span className="ops-dashboard-panel__title">商家分布</span>}
          extra={(
            <button type="button" className="ops-dashboard-panel__link" onClick={() => navigate('/providers')}>
              查看全部
              <RightOutlined />
            </button>
          )}
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <>
              <div className="ops-dashboard-distribution">
                {distributionCards.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={`ops-dashboard-distribution__card ops-dashboard-distribution__card--${item.tone}`}
                    onClick={() => navigate('/providers')}
                  >
                    <div className="ops-dashboard-distribution__head">
                      <span className="ops-dashboard-distribution__mini-icon">{item.icon}</span>
                      <strong>{item.label}</strong>
                    </div>
                    <div className="ops-dashboard-distribution__value">{item.value}</div>
                    <div className="ops-dashboard-distribution__ratio">占比 {item.ratio}</div>
                    <span className="ops-dashboard-distribution__watermark">{item.watermark}</span>
                  </button>
                ))}
              </div>
              <div className="ops-dashboard-note ops-dashboard-note--info">
                主材商允许平台整理 / 待认领状态展示，但必须和已入驻商家清晰区分。
              </div>
            </>
          )}
        </Card>

        <Card
          bordered={false}
          className="ops-dashboard-panel"
          title={<span className="ops-dashboard-panel__title">待办事项</span>}
          extra={(
            <button type="button" className="ops-dashboard-panel__link" onClick={() => navigate('/bookings')}>
              查看全部
              <RightOutlined />
            </button>
          )}
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : (
            <>
              <div className="ops-dashboard-todos">
                {todoItems.map((item) => (
                  <button type="button" key={item.key} className="ops-dashboard-todo" onClick={item.onClick}>
                    <span className={`ops-dashboard-todo__icon ops-dashboard-todo__icon--${item.tone}`}>{item.icon}</span>
                    <span className="ops-dashboard-todo__copy">
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="ops-dashboard-todo__value">{item.value}</span>
                    <RightOutlined className="ops-dashboard-todo__arrow" />
                  </button>
                ))}
              </div>
              <div className="ops-dashboard-note">
                及时处理待办事项，可提升平台信息完整度与用户体验。
              </div>
            </>
          )}
        </Card>
      </section>

    </div>
  );
};

export default DashboardPage;
