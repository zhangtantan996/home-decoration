# 服务区域数据结构改造完成指南

## 📋 改造概述

本次改造将服务区域数据存储从**区域名称数组**改为**区域代码数组**，实现与 `regions` 表的完全关联。

### 改造内容

#### 1. **后端改造** ✅

##### 新增服务层
- **文件**: `server/internal/service/region_service.go`
- **功能**:
  - `ValidateRegionCodes`: 验证区域代码是否有效且已启用
  - `ConvertCodesToNames`: 将区域代码转换为名称（用于展示）
  - `ConvertNamesToCodes`: 将区域名称转换为代码（用于迁移）

##### 修改的 Handler
- **`merchant_apply_handler.go`**:
  - 入驻申请时验证服务区域代码
  - 查询时返回 `serviceArea`（名称）和 `serviceAreaCodes`（代码）

- **`merchant_handler.go`**:
  - 商家信息查询时转换代码为名称展示
  - 更新商家信息时验证区域代码

- **`admin_handler.go`**:
  - 管理员更新服务商时验证区域代码

##### 数据存储格式
```json
// Provider.ServiceArea 字段存储格式（JSON字符串）
"[\"610113\",\"610103\"]"  // 西安市雁塔区、碑林区的代码
```

##### API 响应格式
```json
{
  "serviceArea": ["雁塔区", "碑林区"],      // 名称数组，用于展示
  "serviceAreaCodes": ["610113", "610103"]  // 代码数组，用于编辑
}
```

#### 2. **前端组件** ✅

##### RegionCascader 组件
- **文件**: `admin/src/components/RegionCascader.tsx`
- **特性**:
  - 已支持懒加载省市区三级数据
  - 返回区域代码数组 `string[]`
  - 支持搜索过滤
  - 支持禁用状态

##### 使用示例

```tsx
import RegionCascader from '@/components/RegionCascader';

// 1. 创建/编辑表单 - 使用代码数组
<Form.Item name="serviceArea" label="服务区域">
  <RegionCascader
    placeholder="请选择服务区域"
  />
</Form.Item>

// 2. 设置初始值 - 使用 serviceAreaCodes
form.setFieldsValue({
  serviceArea: data.serviceAreaCodes  // ["610113", "610103"]
});

// 3. 提交时直接使用表单值
const values = form.getFieldsValue();
// values.serviceArea = ["610113", "610103"]

// 4. 展示时使用 serviceArea（名称数组）
<span>{data.serviceArea?.join(', ')}</span>  // "雁塔区, 碑林区"
```

#### 3. **数据迁移** ✅

提供了两种迁移方式：

##### 方式 A: SQL 脚本（简单场景）
```bash
# 文件位置
server/scripts/data-fixes/migrate_service_area_to_codes.sql

# 执行方式
psql -U postgres -d home_decoration -f server/scripts/data-fixes/migrate_service_area_to_codes.sql
```

##### 方式 B: Go 程序（推荐）
```bash
# 文件位置
server/scripts/migrate_service_area.go

# 执行方式
cd server/scripts
DATABASE_URL="host=localhost user=postgres password=postgres dbname=home_decoration port=5432" \
go run migrate_service_area.go
```

**Go 程序优势**:
- 自动从 `regions` 表加载区域映射
- 智能转换，支持任意区域
- 详细的迁移报告（成功/失败统计）
- 安全的错误处理

---

## 🚀 部署步骤

### Step 1: 备份数据库
```bash
# 导出备份
pg_dump -U postgres home_decoration > backup_before_migration_$(date +%Y%m%d).sql
```

### Step 2: 更新代码
```bash
git pull origin dev
```

### Step 3: 确保区域数据已导入
```bash
# 检查 regions 表是否有数据
psql -U postgres -d home_decoration -c "SELECT COUNT(*) FROM regions;"

# 如果没有数据，导入区域数据
psql -U postgres -d home_decoration -f server/scripts/seeds/seed_regions_shaanxi.sql
```

### Step 4: 执行数据迁移
```bash
# 使用 Go 程序迁移（推荐）
cd server/scripts
DATABASE_URL="host=localhost user=postgres password=postgres dbname=home_decoration port=5432" \
go run migrate_service_area.go

# 或使用 SQL 脚本
psql -U postgres -d home_decoration -f server/scripts/data-fixes/migrate_service_area_to_codes.sql
```

### Step 5: 验证迁移结果
```bash
# 查看 providers 表的 service_area 分布
psql -U postgres -d home_decoration -c "
SELECT service_area, COUNT(*) as count
FROM providers
GROUP BY service_area
ORDER BY count DESC LIMIT 10;"

# 检查是否还有未转换的数据（包含中文）
psql -U postgres -d home_decoration -c "
SELECT id, service_area
FROM providers
WHERE service_area LIKE '%区%' OR service_area LIKE '%县%'
LIMIT 5;"
```

### Step 6: 重启服务
```bash
# Docker 环境
docker-compose -f docker-compose.local.yml restart api

# 或直接运行
cd server
go run ./cmd/api
```

### Step 7: 测试验证
1. **商家入驻申请测试**
   - 打开商家入驻页面
   - 选择服务区域（应该显示级联选择器）
   - 提交申请，检查是否成功

2. **商家信息编辑测试**
   - 登录商家中心
   - 编辑服务区域
   - 保存后检查显示是否正确

3. **管理后台测试**
   - 登录管理后台
   - 查看服务商列表，检查服务区域显示
   - 编辑服务商信息，检查区域选择器

---

## 📝 前端使用注意事项

### 1. 表单字段命名
```tsx
// ✅ 正确：使用 serviceArea 作为字段名（存储代码）
<Form.Item name="serviceArea">
  <RegionCascader />
</Form.Item>

// ❌ 错误：不要使用其他字段名
<Form.Item name="serviceAreaNames">
  <RegionCascader />
</Form.Item>
```

### 2. 数据回显
```tsx
// ✅ 正确：使用后端返回的 serviceAreaCodes
useEffect(() => {
  if (data) {
    form.setFieldsValue({
      ...data,
      serviceArea: data.serviceAreaCodes  // 使用代码数组
    });
  }
}, [data]);

// ❌ 错误：使用名称数组会导致无法匹配
form.setFieldsValue({
  serviceArea: data.serviceArea  // ["雁塔区"] 无法匹配到 value
});
```

### 3. 列表展示
```tsx
// ✅ 正确：展示时使用名称数组
<span>{record.serviceArea?.join(', ')}</span>

// ❌ 错误：展示代码给用户看
<span>{record.serviceAreaCodes?.join(', ')}</span>  // "610113, 610103"
```

### 4. 提交数据
```tsx
// ✅ 正确：直接提交表单值（代码数组）
const onFinish = (values) => {
  api.post('/merchant/apply', {
    ...values,
    // serviceArea 已经是代码数组，无需转换
  });
};

// ❌ 错误：不要手动转换为名称
const onFinish = (values) => {
  api.post('/merchant/apply', {
    ...values,
    serviceArea: values.serviceArea.map(code => getNameByCode(code))
  });
};
```

---

## 🔍 故障排查

### 问题 1: "服务区域验证失败: 以下区域代码不存在"
**原因**: 区域代码在 `regions` 表中不存在
**解决**:
```bash
# 检查区域数据是否导入
psql -U postgres -d home_decoration -c "SELECT * FROM regions WHERE code = '610113';"

# 如果没有，导入区域数据
psql -U postgres -d home_decoration -f server/scripts/seeds/seed_regions_shaanxi.sql
```

### 问题 2: "服务区域验证失败: 以下区域已被禁用"
**原因**: 区域的 `enabled` 字段为 `false`
**解决**:
```bash
# 启用该区域
psql -U postgres -d home_decoration -c "UPDATE regions SET enabled = true WHERE code = '610113';"
```

### 问题 3: 前端区域选择器不显示数据
**原因**: 区域 API 未返回数据
**解决**:
1. 检查后端 API: `GET /api/v1/regions/provinces`
2. 检查 CORS 配置
3. 检查浏览器控制台错误

### 问题 4: 编辑表单无法回显区域
**原因**: 使用了名称数组而非代码数组
**解决**:
```tsx
// 确保使用 serviceAreaCodes
form.setFieldsValue({
  serviceArea: data.serviceAreaCodes  // 代码数组
});
```

---

## ✅ 验收检查清单

- [ ] 后端 API 能够接收和验证区域代码数组
- [ ] 后端查询时返回 `serviceArea` 和 `serviceAreaCodes` 两个字段
- [ ] 数据库中 `providers.service_area` 字段存储的是代码数组
- [ ] 前端 RegionCascader 组件能够正确加载省市区数据
- [ ] 前端表单能够正确回显已选区域
- [ ] 前端提交时发送的是区域代码数组
- [ ] 列表页展示的是区域名称（不是代码）
- [ ] 数据迁移脚本执行成功，无遗留数据
- [ ] 商家入驻流程正常
- [ ] 商家信息编辑流程正常
- [ ] 管理后台服务商管理正常

---

## 📚 相关文档

- [行政区划管理指南](./REGION_MANAGEMENT_GUIDE.md)
- [RegionCascader 组件 API](../admin/src/components/RegionCascader.tsx)
- [区域服务层 API](../server/internal/service/region_service.go)
