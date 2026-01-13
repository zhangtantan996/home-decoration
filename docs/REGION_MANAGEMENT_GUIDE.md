# 行政区划管理部署指南

## 🚀 快速部署（3步完成）

### 步骤1：导入陕西省数据
```bash
# 方式1：通过Docker（推荐）
docker-compose -f docker-compose.local.yml exec -T db psql -U postgres -d home_decoration < server/scripts/migrations/seed_regions_shaanxi.sql

# 方式2：直接连接数据库
psql -U postgres -d home_decoration -f server/scripts/migrations/seed_regions_shaanxi.sql
```

### 步骤2：添加侧边栏菜单
```bash
# 通过Docker
docker-compose -f docker-compose.local.yml exec -T db psql -U postgres -d home_decoration < server/scripts/add_region_menu.sql

# 直接连接
psql -U postgres -d home_decoration -f server/scripts/add_region_menu.sql
```

### 步骤3：重启前端开发服务器
```bash
cd admin
npm run dev
```

---

## ✅ 功能验证

访问以下页面确认功能正常：

1. **字典管理页面** - `http://localhost:5173/system/dictionary`
   - ✅ 应该看到黄色提示框
   - ✅ 点击"行政区划管理"链接跳转正常
   - ✅ 分类标签中不再显示"服务区域"

2. **行政区划管理页面** - `http://localhost:5173/system/regions`
   - ✅ 显示陕西省数据（共约157条记录）
   - ✅ 层级筛选功能正常（省/市/区县）
   - ✅ 搜索功能正常（输入"西安"或"610100"）
   - ✅ 启用/禁用开关正常

3. **侧边栏菜单**
   - ✅ "系统管理" 下显示 "数据字典" 和 "行政区划管理"

---

## 📋 页面功能说明

### 行政区划管理页面特性

**层级筛选**
- 全部：显示所有省市区县
- 省级：仅显示省份（1条：陕西省）
- 市级：显示地级市（10条）
- 区/县级：显示区县（107条）

**搜索功能**
- 支持名称搜索：例如 "西安"、"碑林"
- 支持代码搜索：例如 "610000"、"610102"

**状态管理**
- 通过开关启用/禁用服务区域
- 禁用的区域将不在前端选择器中显示

**视觉优化**
- 层级标签：省（红色）、市（橙色）、区/县（蓝色）
- 名称缩进：视觉上区分层级关系
- 分页增强：支持快速跳转和每页条数调整

---

## 🔧 故障排查

### 问题1：点击链接白屏

**原因**：使用了 `<a href>` 导致页面刷新

**解决**：已修复，现使用 React Router 的 `<Link>` 组件

### 问题2：侧边栏没有"行政区划管理"菜单

**原因**：数据库未添加菜单配置

**解决**：执行步骤2的SQL脚本

### 问题3：数据为空

**原因**：未导入陕西省数据

**解决**：执行步骤1的SQL脚本

### 问题4：API 404错误

**检查后端路由**：
```bash
# 确认后端服务正在运行
docker-compose -f docker-compose.local.yml logs api

# 测试API
curl http://localhost:8080/api/v1/regions/provinces
curl http://localhost:8080/api/v1/admin/regions?page=1&pageSize=20
```

---

## 📊 数据库表结构

```sql
-- regions 表
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,      -- 行政区划代码
    name VARCHAR(50) NOT NULL,            -- 名称
    level INT NOT NULL,                    -- 层级：1省 2市 3区/县
    parent_code VARCHAR(6),                -- 父级代码
    enabled BOOLEAN DEFAULT true,          -- 是否启用
    sort_order INT DEFAULT 0,              -- 排序
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE UNIQUE INDEX idx_regions_code ON regions(code);
CREATE INDEX idx_regions_parent_code ON regions(parent_code);
```

---

## 🌟 后续扩展建议

### 导入其他省份数据

参考 `server/scripts/migrations/seed_regions_shaanxi.sql` 格式创建新文件：

```sql
-- seed_regions_beijing.sql
INSERT INTO regions (code, name, level, parent_code, enabled, sort_order) VALUES
('110000', '北京市', 1, NULL, true, 1);

INSERT INTO regions (code, name, level, parent_code, enabled, sort_order) VALUES
('110101', '东城区', 3, '110000', true, 1),
('110102', '西城区', 3, '110000', true, 2);
-- ...
```

### 关联服务商区域

修改 `providers` 表，添加服务区域字段：

```sql
ALTER TABLE providers
ADD COLUMN service_region_codes TEXT[]; -- 存储区域代码数组

-- 示例：设计师服务西安市所有区县
UPDATE providers
SET service_region_codes = ARRAY['610102','610103','610104',...]
WHERE id = 1;
```

### 前端组件集成

在设计师/工人注册页面使用 `RegionCascader` 组件：

```tsx
import RegionCascader from '@/components/RegionCascader';

<Form.Item label="服务区域" name="serviceRegions">
    <RegionCascader />
</Form.Item>
```

---

## 📞 技术支持

如遇到问题：
1. 检查数据库连接：`docker-compose -f docker-compose.local.yml ps`
2. 查看API日志：`docker-compose -f docker-compose.local.yml logs -f api`
3. 查看前端控制台错误（浏览器开发者工具）

**相关文件**：
- 前端页面：[admin/src/pages/system/RegionManagement.tsx](../admin/src/pages/system/RegionManagement.tsx)
- 后端接口：[server/internal/handler/region_handler.go](../server/internal/handler/region_handler.go)
- 数据模型：[server/internal/model/region.go](../server/internal/model/region.go)
- 路由配置：[admin/src/router.tsx](../admin/src/router.tsx)
