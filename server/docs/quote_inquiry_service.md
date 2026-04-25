# 智能报价服务实现文档

## 概述

智能报价服务 (`QuoteInquiryService`) 实现了基于多维度系数的装修报价算法，支持登录/未登录用户的报价查询和记录。

## 文件位置

- **Service层**: `/server/internal/service/quote_inquiry_service.go`
- **Model层**: `/server/internal/model/quote_inquiry.go`
- **测试文件**: `/server/internal/service/quote_inquiry_service_test.go`
- **演示程序**: `/server/examples/quote_demo.go`

## 核心功能

### 1. 报价算法

#### 基础单价（元/㎡）
- 新房装修: 1200元/㎡
- 老房翻新: 1500元/㎡
- 局部改造: 1800元/㎡

#### 城市系数
- 一线城市（北京、上海、广州、深圳）: 1.3
- 二线城市（杭州、南京、成都、武汉、西安）: 1.1
- 三线及以下城市: 1.0

#### 风格系数
- 现代简约: 1.0
- 北欧: 1.1
- 新中式: 1.3
- 轻奢: 1.4
- 欧式: 1.5
- 美式: 1.4
- 日式: 1.2
- 工业风: 1.1

#### 面积系数
- <60㎡: 1.15（小户型单价高）
- 60-90㎡: 1.05
- 90-120㎡: 1.0（标准户型）
- 120-150㎡: 0.95
- 150-200㎡: 0.90
- >200㎡: 0.85（大户型单价低）

#### 户型复杂度系数
- 基础系数: 1.0
- 房间数≥4: +0.1
- 卫生间数≥2: +0.05 × (卫生间数-1)

#### 费用分配比例
- 设计费: 10% (区间: 0.8-1.2倍)
- 施工费: 45% (区间: 0.85-1.15倍)
- 主材费: 45% (区间: 0.75-1.35倍)

#### 工期计算
- 基础工期: 60天
- 面积影响: 每增加20㎡，增加3天
- 装修类型: 老房翻新+10天，局部改造-10天
- 风格影响: 新中式+10天，欧式+15天，美式+10天
- 工期范围: 30-180天

### 2. 主要方法

#### CreateInquiry
创建询价记录并计算报价。

**参数**:
```go
type CreateInquiryRequest struct {
    UserID         *uint64 // 用户ID（可选，未登录为nil）
    OpenID         string  // 微信OpenID（可选）
    Phone          string  // 联系电话
    Address        string  // 房屋地址
    CityCode       string  // 城市代码
    Area           float64 // 房屋面积
    HouseLayout    string  // 户型（如"3室2厅2卫"）
    RenovationType string  // 装修类型
    Style          string  // 装修风格
    BudgetRange    string  // 预算区间（可选）
    Source         string  // 来源（默认"mini_program"）
}
```

**返回**:
- `*model.QuoteInquiry`: 询价记录
- `*QuoteResult`: 报价结果
- `error`: 错误信息

#### Calculate
计算报价（不保存记录）。

**返回**:
```go
type QuoteResult struct {
    TotalMin              float64         // 总价最低
    TotalMax              float64         // 总价最高
    DesignFee             PriceRange      // 设计费区间
    ConstructionFee       PriceRange      // 施工费区间
    MaterialFee           PriceRange      // 主材费区间
    EstimatedDuration     int             // 预计工期（天）
    Breakdown             []BreakdownItem // 费用明细
    CityCoefficient       float64         // 城市系数
    AreaCoefficient       float64         // 面积系数
    StyleCoefficient      float64         // 风格系数
    ComplexityCoefficient float64         // 复杂度系数
}
```

#### AdminListInquiries
管理后台查询询价列表（支持分页和过滤）。

**参数**:
- `page`: 页码
- `pageSize`: 每页数量
- `filters`: 过滤条件（cityCode, renovationType, style, conversionStatus）

## 使用示例

### 示例1: 标准户型 - 现代简约 - 二线城市

**输入**:
- 地址: 杭州市西湖区文一路
- 面积: 100㎡
- 户型: 3室2厅2卫
- 装修类型: 新房装修
- 装修风格: 现代简约

**输出**:
- 总价区间: 11.09 - 17.26 万元
- 设计费: 11,088 - 16,632 元
- 施工费: 53,015 - 71,726 元
- 主材费: 46,778 - 84,200 元
- 预计工期: 63 天

### 示例2: 小户型 - 北欧 - 一线城市

**输入**:
- 地址: 北京市朝阳区
- 面积: 50㎡
- 户型: 1室1厅1卫
- 装修类型: 新房装修
- 装修风格: 北欧

**输出**:
- 总价区间: 7.89 - 12.28 万元
- 设计费: 7,894 - 11,840 元
- 施工费: 37,741 - 51,062 元
- 主材费: 33,301 - 59,942 元
- 预计工期: 60 天

### 示例3: 大户型 - 欧式 - 三线城市

**输入**:
- 地址: 某三线城市
- 面积: 200㎡
- 户型: 5室3厅3卫
- 装修类型: 老房翻新
- 装修风格: 欧式

**输出**:
- 总价区间: 36.72 - 57.15 万元
- 设计费: 36,720 - 55,080 元
- 施工费: 175,568 - 237,533 元
- 主材费: 154,913 - 278,843 元
- 预计工期: 103 天

## 测试

运行测试:
```bash
cd server
go test ./internal/service -run TestQuoteInquiryService -v
```

运行演示程序:
```bash
cd server
go run examples/quote_demo.go
```

## 数据库表结构

表名: `quote_inquiries`

主要字段:
- `user_id`: 用户ID（可为NULL）
- `open_id`: 微信OpenID
- `phone`: 联系电话
- `address`: 房屋地址
- `city_code`: 城市代码
- `area`: 房屋面积
- `house_layout`: 户型
- `renovation_type`: 装修类型
- `style`: 装修风格
- `quote_result_json`: 报价结果JSON
- `total_min/total_max`: 总价区间
- `design_fee_min/design_fee_max`: 设计费区间
- `construction_fee_min/construction_fee_max`: 施工费区间
- `material_fee_min/material_fee_max`: 主材费区间
- `estimated_duration_days`: 预计工期
- `conversion_status`: 转化状态（pending/converted/abandoned）
- `converted_to_booking_id`: 转化的预约ID
- `source`: 来源渠道

## 后续优化建议

1. **城市等级表**: 将城市系数配置化，支持动态调整
2. **风格库**: 支持更多装修风格和自定义系数
3. **材料清单**: 提供详细的材料预算明细
4. **AI优化**: 基于历史数据训练模型，提高报价准确度
5. **区域差异**: 支持同城不同区域的价格差异
6. **季节因素**: 考虑装修旺季/淡季的价格波动
7. **转化追踪**: 完善询价到预约的转化漏斗分析

## 注意事项

1. 所有价格使用 `math.Round` 四舍五入到整数
2. 支持登录/未登录用户（userID可为nil）
3. 报价结果序列化为JSON存储到 `quote_result_json` 字段
4. 使用 `repository.DB` 进行数据库操作
5. 输入校验：面积10-2000㎡，地址至少5个字符
