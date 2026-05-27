import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Space, Spin, Switch, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MediaGalleryInput from '../components/MediaGalleryInput';
import MediaPathInput from '../components/MediaPathInput';
import RequiredLabel from '../components/RequiredLabel';
import {
  createMaterialProduct,
  listMaterialProducts,
  listMaterialShops,
  showApiError,
  updateMaterialProduct,
  type MaterialProductItem,
  type MaterialShopItem,
} from '../services/api';
import { getAssetStoredPath, joinStoredAssetText } from '../utils/asset';

const { Text, Title } = Typography;

const MAX_PRODUCT_NAME_LENGTH = 40;
const MAX_PRODUCT_UNIT_LENGTH = 12;
const MAX_PRODUCT_DESCRIPTION_LENGTH = 500;
const MAX_PRODUCT_PRICE = 9_999_999;
const MAX_PRODUCT_SORT = 9_999;

const splitText = (value?: string) => String(value || '').split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);

const MaterialProductEditPage = () => {
  const navigate = useNavigate();
  const { shopId, productId } = useParams();
  const numericShopId = Number(shopId);
  const numericProductId = Number(productId);
  const isNew = productId === 'new';
  const [form] = Form.useForm();
  const [shop, setShop] = useState<MaterialShopItem | null>(null);
  const [product, setProduct] = useState<MaterialProductItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const productsPath = useMemo(() => `/providers/material-shop/${numericShopId}/products`, [numericShopId]);

  useEffect(() => {
    if (!numericShopId) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const [shopsResult, productsResult] = await Promise.all([
          listMaterialShops(1, 500),
          isNew ? Promise.resolve({ list: [] as MaterialProductItem[] }) : listMaterialProducts(numericShopId),
        ]);
        const currentShop = shopsResult.list.find((item) => item.id === numericShopId) || null;
        const currentProduct = productsResult.list.find((item) => item.id === numericProductId) || null;
        setShop(currentShop);
        setProduct(currentProduct);
        form.setFieldsValue(isNew ? {
          unit: '件',
          status: true,
          sortOrder: 0,
        } : {
          name: currentProduct?.name,
          unit: currentProduct?.unit,
          description: currentProduct?.description,
          price: currentProduct?.price,
          coverImage: getAssetStoredPath(currentProduct?.coverImage),
          images: joinStoredAssetText((currentProduct?.images || []).map((item) => getAssetStoredPath(item))),
          sortOrder: currentProduct?.sortOrder,
          status: currentProduct?.status !== 0,
        });
      } catch (error) {
        showApiError(error, '商品资料加载失败');
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [form, isNew, numericProductId, numericShopId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        unit: values.unit,
        price: values.price,
        coverImage: values.coverImage,
        images: splitText(values.images),
        sortOrder: values.sortOrder ?? 0,
        description: values.description,
        status: values.status ? 1 : 0,
      };
      if (isNew) {
        await createMaterialProduct(numericShopId, payload);
      } else {
        await updateMaterialProduct(numericShopId, numericProductId, payload);
      }
      navigate(productsPath);
    } catch (error) {
      showApiError(error, '商品保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ops-page ops-page--editor ops-product-edit-page">
      <div className="ops-edit-header">
        <Space size={14}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(productsPath)}>返回</Button>
          <div>
            <Title level={2}>{isNew ? '新增商品' : '编辑商品'}</Title>
            <Text type="secondary">{shop?.name || `主材商 #${numericShopId}`} · {product?.name || '维护商品展示信息'}</Text>
          </div>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()}>保存商品</Button>
      </div>

      <Form form={form} layout="vertical" className="ops-product-edit-form" requiredMark={false}>
        <div className="ops-product-edit-layout">
          <Spin spinning={loading}>
            <Card className="ops-edit-card" title="商品信息">
              <div className="ops-form-grid">
                <Form.Item name="name" label={<RequiredLabel>商品名称</RequiredLabel>} rules={[{ required: true, message: '请输入商品名称' }, { max: MAX_PRODUCT_NAME_LENGTH, message: `商品名称最多 ${MAX_PRODUCT_NAME_LENGTH} 个字` }]}>
                  <Input maxLength={MAX_PRODUCT_NAME_LENGTH} showCount placeholder="例如：岩板台面 / 瓷砖套餐" />
                </Form.Item>
                <Form.Item name="unit" label={<RequiredLabel>销售单位</RequiredLabel>} rules={[{ required: true, message: '请输入销售单位' }, { max: MAX_PRODUCT_UNIT_LENGTH, message: `单位最多 ${MAX_PRODUCT_UNIT_LENGTH} 个字` }]}>
                  <Input maxLength={MAX_PRODUCT_UNIT_LENGTH} showCount placeholder="件 / 套 / ㎡" />
                </Form.Item>
                <Form.Item name="price" label={<RequiredLabel>商品价格</RequiredLabel>} rules={[{ required: true, message: '请输入价格' }, { type: 'number', min: 0.01, max: MAX_PRODUCT_PRICE, message: `价格需在 0.01-${MAX_PRODUCT_PRICE} 之间` }]}>
                  <InputNumber min={0.01} max={MAX_PRODUCT_PRICE} precision={2} addonAfter="元" className="ops-form-wide" />
                </Form.Item>
                <Form.Item name="sortOrder" label="排序" rules={[{ type: 'number', min: 0, max: MAX_PRODUCT_SORT, message: `排序需在 0-${MAX_PRODUCT_SORT} 之间` }]}>
                  <InputNumber min={0} max={MAX_PRODUCT_SORT} precision={0} addonAfter="位" className="ops-form-wide" />
                </Form.Item>
                <Form.Item className="ops-form-grid__full" name="description" label="商品说明" rules={[{ max: MAX_PRODUCT_DESCRIPTION_LENGTH, message: `商品说明最多 ${MAX_PRODUCT_DESCRIPTION_LENGTH} 个字` }]}>
                  <Input.TextArea rows={5} maxLength={MAX_PRODUCT_DESCRIPTION_LENGTH} showCount placeholder="写清材质、规格、适用场景和服务范围，方便非技术用户理解" />
                </Form.Item>
              </div>
            </Card>

            <Card className="ops-edit-card" title="图片展示">
              <div className="ops-form-grid">
                <Form.Item name="coverImage" label={<RequiredLabel>商品封面</RequiredLabel>} rules={[{ required: true, message: '请上传商品封面' }]}>
                  <MediaPathInput placeholder="商品封面" maxSizeMB={5} />
                </Form.Item>
                <Form.Item name="images" label={<RequiredLabel>商品图片</RequiredLabel>} rules={[{ required: true, message: '请至少上传一张商品图片' }]}>
                  <MediaGalleryInput placeholder="商品图片" maxCount={9} maxSizeMB={5} />
                </Form.Item>
              </div>
            </Card>
          </Spin>

          <Card className="ops-edit-card ops-product-publish-card" title="展示状态">
            <Form.Item name="status" label="公开展示" valuePropName="checked">
              <Switch checkedChildren="展示" unCheckedChildren="隐藏" />
            </Form.Item>
            <Text type="secondary">隐藏后商品不会在小程序商品展示中出现，但资料仍会保留。</Text>
          </Card>
        </div>
      </Form>
    </div>
  );
};

export default MaterialProductEditPage;
