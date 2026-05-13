import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Image, Input, Popconfirm, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  deleteMaterialProduct,
  listMaterialProducts,
  listMaterialShops,
  showApiError,
  type MaterialProductItem,
  type MaterialShopItem,
} from '../services/api';

const { Text, Title } = Typography;

const isOnline = (status?: number) => status !== 0;

const formatPrice = (value?: number) => {
  const amount = Number(value || 0);
  if (!amount) return '待维护';
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 元`;
};

const ProductCover = ({ src, name }: { src?: string; name: string }) => (
  <div className="ops-product-cover">
    {src ? (
      <Image src={src} alt={name} rootClassName="ops-product-cover__image" preview={{ mask: null }} />
    ) : (
      <ShopOutlined />
    )}
  </div>
);

const MaterialProductsPage = () => {
  const navigate = useNavigate();
  const { shopId } = useParams();
  const numericShopId = Number(shopId);
  const [shop, setShop] = useState<MaterialShopItem | null>(null);
  const [products, setProducts] = useState<MaterialProductItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!numericShopId) return;
    setLoading(true);
    try {
      const [shopsResult, productsResult] = await Promise.all([
        listMaterialShops(1, 500),
        listMaterialProducts(numericShopId),
      ]);
      setShop(shopsResult.list.find((item) => item.id === numericShopId) || null);
      setProducts(productsResult.list);
    } catch (error) {
      showApiError(error, '商品资料加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [numericShopId]);

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return products;
    return products.filter((item) => [item.name, item.unit, item.description].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [keyword, products]);

  const onlineCount = useMemo(() => products.filter((item) => isOnline(item.status)).length, [products]);

  const handleDelete = async (productId: number) => {
    try {
      await deleteMaterialProduct(numericShopId, productId);
      await loadData();
    } catch (error) {
      showApiError(error, '商品删除失败');
    }
  };

  const goCreate = () => navigate(`/supply/material-shop/${numericShopId}/products/new`);
  const goEdit = (productId: number) => navigate(`/supply/material-shop/${numericShopId}/products/${productId}`);

  return (
    <div className="ops-page ops-page--editor ops-products-page">
      <div className="ops-edit-header">
        <Space size={14}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/supply')}>返回</Button>
          <div>
            <Title level={2}>商品维护</Title>
            <Text type="secondary">{shop?.name || `主材商 #${numericShopId}`} · 管理商品图片、价格、上架状态</Text>
          </div>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={goCreate}>新增商品</Button>
        </Space>
      </div>

      <div className="ops-products-workspace">
        <Card className="ops-products-summary-card">
          <div className="ops-products-summary">
            <div>
              <Text type="secondary">商品总数</Text>
              <strong>{products.length}</strong>
            </div>
            <div>
              <Text type="secondary">展示中</Text>
              <strong>{onlineCount}</strong>
            </div>
            <div>
              <Text type="secondary">待维护</Text>
              <strong>{Math.max(products.length - onlineCount, 0)}</strong>
            </div>
          </div>
        </Card>

        <Card className="ops-products-card">
          <div className="ops-products-card__head">
            <div>
              <Title level={4}>商品列表</Title>
              <Text type="secondary">维护小程序展示商品，支持快速编辑、删除和上下架查看。</Text>
            </div>
          </div>
          <div className="ops-products-toolbar">
            <Input.Search
              allowClear
              placeholder="搜索商品名称、单位、说明"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={goCreate}>新增商品</Button>
          </div>

          <Spin spinning={loading}>
            {filteredProducts.length ? (
              <div className="ops-product-list">
                {filteredProducts.map((item) => (
                  <article className="ops-product-row" key={item.id}>
                    <div className="ops-product-row__main">
                      <ProductCover src={item.coverImage || item.images?.[0]} name={item.name} />
                      <div>
                        <div className="ops-product-row__title">{item.name}</div>
                        <div className="ops-product-row__desc">{item.description || '未填写商品说明'}</div>
                      </div>
                    </div>
                    <div className="ops-product-row__meta">
                      <span>单位：{item.unit || '未填'}</span>
                      <span>价格：{formatPrice(item.price)}</span>
                      <span>排序：{item.sortOrder ?? 0}</span>
                    </div>
                    <Tag className={isOnline(item.status) ? 'ops-product-status ops-product-status--online' : 'ops-product-status'}>
                      {isOnline(item.status) ? '已上架' : '已下架'}
                    </Tag>
                    <Space size={8} className="ops-product-row__actions">
                      <Button icon={<EditOutlined />} onClick={() => goEdit(item.id)}>编辑</Button>
                      <Popconfirm title="确认删除这个商品？" okText="删除" okButtonProps={{ danger: true }} onConfirm={() => void handleDelete(item.id)}>
                        <Button danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </Space>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                description={keyword ? '没有匹配的商品' : '还没有维护商品'}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={goCreate}>新增第一个商品</Button>
              </Empty>
            )}
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default MaterialProductsPage;
