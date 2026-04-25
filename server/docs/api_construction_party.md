# 施工桥接 API 文档

## 说明

本文档描述设计确认后的施工桥接接口。旧桥接口径已停用，当前统一语义为：`construction_party_pending = 施工桥接中`。

施工桥接覆盖三件事：
- 报价基线准备
- 施工主体确认
- 进入正式施工报价

如与其他历史文档冲突，请以 `docs/产品需求文档(PRD).md`、`docs/BUSINESS_FLOW.md` 和当前代码实现为准。

## 业务流程

1. 用户完成设计确认后，业务流程进入 `design_confirmed`
2. 用户选择施工主体后，业务流程进入 `construction_party_pending`
3. 在施工桥接阶段，平台继续推进报价基线、施工主体确认和正式施工报价
4. 施工主体接受后，状态进入 `constructor_confirmed`
5. 用户确认正式施工报价后，才会创建项目并进入后续履约链

## API 接口

### 1. 用户选择施工主体

**接口**: `POST /api/v1/bookings/:id/select-crew`

**权限**: 需要用户登录（JWT Token）

**请求参数**:

```json
{
  "providerId": 123,
  "providerType": 2
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "施工主体选择成功，施工桥接推进中"
  }
}
```

**业务规则**:

- 只能在 `design_confirmed` 状态下选择施工主体
- 只允许选择装修公司或独立工长类施工主体
- 选择成功后会通知被选中的施工主体，并进入 `construction_party_pending`
- `construction_party_pending` 表示“施工桥接中”，不是最终成交完成

### 2. 施工主体确认桥接邀请

**接口**: `POST /api/v1/merchant/bookings/:id/confirm-crew`

**权限**: 需要服务商登录（Merchant JWT Token）

**请求参数**:

```json
{
  "accept": true,
  "reason": "档期已满，无法接单"
}
```

**响应示例**:

接受时：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "工长确认成功"
  }
}
```

拒绝时：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": "已拒绝施工邀请"
  }
}
```

**业务规则**:

- 只能在 `construction_party_pending` 状态下确认
- 只有被选中的施工主体才能确认
- 接受后状态进入 `constructor_confirmed`
- 拒绝后状态回退到 `design_confirmed`
- `constructor_confirmed` 仍不是项目创建点，后续还需要正式施工报价与用户确认

## 状态流转图

```text
design_confirmed (设计确认完成)
    ↓ [用户选择施工主体]
construction_party_pending (施工桥接中)
    ↓ [施工主体接受]
constructor_confirmed (施工主体已确认)
    ↓ [正式施工报价 -> 用户确认]
project_created / ready_to_start

construction_party_pending (施工桥接中)
    ↓ [施工主体拒绝]
design_confirmed (回退，重新选择施工主体)
```

## 通知口径

### 选择施工主体后

发送给施工主体：
- 标题: `新的施工桥接邀请`
- 内容: `业主已选择您作为施工主体，请尽快确认并进入正式施工报价准备`

### 施工主体确认后

发送给用户：
- 接受时：`施工主体已确认，平台将继续推进正式施工报价`
- 拒绝时：`施工主体已拒绝，请重新选择施工主体`

## 相关文件

- `server/internal/service/project_service.go`
- `server/internal/handler/construction_party_handler.go`
- `server/internal/router/router.go`
- `server/internal/model/business_closure.go`
