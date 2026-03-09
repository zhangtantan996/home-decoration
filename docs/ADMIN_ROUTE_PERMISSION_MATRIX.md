# 管理后台 Admin 路由权限覆盖矩阵

说明：
- 范围仅包含 `server/internal/router/router.go` 中的 `/api/v1/admin/*`
- `Has AdminJWT` 当前均为 `Yes`（整个 `/admin` 分组统一挂载）
- `Has RequirePermission` 表示是否已补充细粒度权限校验（含 `RequireAnyPermission`）
- `Proposed Permission` 为当前代码使用或建议对齐的权限点

## 通用与统计

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/info` | `GET` | Yes | No | Low | `-` |
| `/api/v1/admin/upload` | `POST` | Yes | Yes | Medium | `system:case:list` |
| `/api/v1/admin/stats/overview` | `GET` | Yes | Yes | Low | `dashboard:view` |
| `/api/v1/admin/stats/trends` | `GET` | Yes | Yes | Low | `dashboard:view` |
| `/api/v1/admin/stats/distribution` | `GET` | Yes | Yes | Low | `dashboard:view` |

## 用户与管理员

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/users` | `GET` | Yes | Yes | Medium | `system:user:list` |
| `/api/v1/admin/users/:id` | `GET` | Yes | Yes | Medium | `system:user:view` |
| `/api/v1/admin/users` | `POST` | Yes | Yes | High | `system:user:edit` |
| `/api/v1/admin/users/:id` | `PUT` | Yes | Yes | High | `system:user:edit` |
| `/api/v1/admin/users/:id/status` | `PATCH` | Yes | Yes | High | `system:user:edit` |
| `/api/v1/admin/admins` | `GET` | Yes | Yes | Medium | `system:admin:list` |
| `/api/v1/admin/admins` | `POST` | Yes | Yes | High | `system:admin:create` |
| `/api/v1/admin/admins/:id` | `PUT` | Yes | Yes | High | `system:admin:edit` |
| `/api/v1/admin/admins/:id` | `DELETE` | Yes | Yes | High | `system:admin:delete` |
| `/api/v1/admin/admins/:id/status` | `PATCH` | Yes | Yes | High | `system:admin:edit` |

## 服务商与主材门店

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/providers` | `GET` | Yes | Yes | Medium | `provider:designer:list` / `provider:company:list` / `provider:foreman:list` |
| `/api/v1/admin/providers` | `POST` | Yes | Yes | High | `provider:designer:create` / `provider:company:create` / `provider:foreman:create` |
| `/api/v1/admin/providers/:id` | `PUT` | Yes | Yes | High | `provider:designer:edit` / `provider:company:edit` / `provider:foreman:edit` |
| `/api/v1/admin/providers/:id/verify` | `PATCH` | Yes | Yes | High | `provider:designer:edit` / `provider:company:edit` / `provider:foreman:edit` |
| `/api/v1/admin/providers/:id/status` | `PATCH` | Yes | Yes | High | `provider:designer:edit` / `provider:company:edit` / `provider:foreman:edit` |
| `/api/v1/admin/material-shops` | `GET` | Yes | Yes | Medium | `material:shop:list` |
| `/api/v1/admin/material-shops` | `POST` | Yes | Yes | High | `material:shop:create` |
| `/api/v1/admin/material-shops/:id` | `PUT` | Yes | Yes | High | `material:shop:edit` |
| `/api/v1/admin/material-shops/:id` | `DELETE` | Yes | Yes | High | `material:shop:delete` |
| `/api/v1/admin/material-shops/:id/verify` | `PATCH` | Yes | Yes | High | `material:shop:edit` |

## 预约、争议、评价

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/bookings` | `GET` | Yes | Yes | Low | `booking:list` |
| `/api/v1/admin/bookings/:id/status` | `PATCH` | Yes | Yes | Medium | `booking:edit` |
| `/api/v1/admin/bookings/refundable` | `GET` | Yes | Yes | High | `finance:transaction:approve` |
| `/api/v1/admin/bookings/:bookingId/refund` | `POST` | Yes | Yes | High | `finance:transaction:approve` |
| `/api/v1/admin/disputed-bookings` | `GET` | Yes | Yes | Medium | `booking:list` |
| `/api/v1/admin/disputed-bookings/:id` | `GET` | Yes | Yes | Medium | `booking:dispute:detail` |
| `/api/v1/admin/disputed-bookings/:id/resolve` | `POST` | Yes | Yes | High | `booking:dispute:resolve` |
| `/api/v1/admin/reviews` | `GET` | Yes | Yes | Low | `review:list` |
| `/api/v1/admin/reviews/:id` | `DELETE` | Yes | Yes | Medium | `review:delete` |
| `/api/v1/admin/comments` | `GET` | Yes | Yes | Low | `review:list` |
| `/api/v1/admin/comments/:id/status` | `PATCH` | Yes | Yes | Medium | `review:hide` |

## 审核与作品

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/audits/providers` | `GET` | Yes | Yes | Low | `provider:audit:list` |
| `/api/v1/admin/audits/material-shops` | `GET` | Yes | Yes | Low | `material:audit:list` |
| `/api/v1/admin/audits/:type/:id/approve` | `POST` | Yes | Yes | High | `provider:audit:approve` / `material:audit:approve` |
| `/api/v1/admin/audits/:type/:id/reject` | `POST` | Yes | Yes | High | `provider:audit:reject` / `material:audit:reject` |
| `/api/v1/admin/audits/cases` | `GET` | Yes | Yes | Low | `system:case:view` |
| `/api/v1/admin/audits/cases/:id` | `GET` | Yes | Yes | Low | `system:case:view` |
| `/api/v1/admin/audits/cases/:id/approve` | `POST` | Yes | Yes | High | `system:case:list` |
| `/api/v1/admin/audits/cases/:id/reject` | `POST` | Yes | Yes | High | `system:case:list` |
| `/api/v1/admin/cases` | `GET` | Yes | Yes | Low | `system:case:view` |
| `/api/v1/admin/cases/:id` | `GET` | Yes | Yes | Low | `system:case:view` |
| `/api/v1/admin/cases` | `POST` | Yes | Yes | High | `system:case:list` |
| `/api/v1/admin/cases/:id` | `PUT` | Yes | Yes | High | `system:case:list` |
| `/api/v1/admin/cases/:id` | `DELETE` | Yes | Yes | High | `system:case:list` |
| `/api/v1/admin/cases/batch-delete` | `POST` | Yes | Yes | High | `system:case:list` |
| `/api/v1/admin/cases/:id/inspiration` | `PATCH` | Yes | Yes | Medium | `system:case:list` |
| `/api/v1/admin/merchant-applications` | `GET` | Yes | Yes | Low | `provider:audit:list` |
| `/api/v1/admin/merchant-applications/:id` | `GET` | Yes | Yes | Low | `provider:audit:view` |
| `/api/v1/admin/merchant-applications/:id/approve` | `POST` | Yes | Yes | High | `provider:audit:approve` |
| `/api/v1/admin/merchant-applications/:id/reject` | `POST` | Yes | Yes | High | `provider:audit:reject` |
| `/api/v1/admin/material-shop-applications` | `GET` | Yes | Yes | Low | `material:audit:list` |
| `/api/v1/admin/material-shop-applications/:id` | `GET` | Yes | Yes | Low | `material:audit:view` |
| `/api/v1/admin/material-shop-applications/:id/approve` | `POST` | Yes | Yes | High | `material:audit:approve` |
| `/api/v1/admin/material-shop-applications/:id/reject` | `POST` | Yes | Yes | High | `material:audit:reject` |
| `/api/v1/admin/identity-applications` | `GET` | Yes | Yes | Low | `identity:application:audit` |
| `/api/v1/admin/identity-applications/:id` | `GET` | Yes | Yes | Low | `identity:application:audit` |
| `/api/v1/admin/identity-applications/:id/approve` | `POST` | Yes | Yes | High | `identity:application:audit` |
| `/api/v1/admin/identity-applications/:id/reject` | `POST` | Yes | Yes | High | `identity:application:audit` |

## 项目与施工日志

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/projects` | `GET` | Yes | Yes | Low | `project:list` |
| `/api/v1/admin/projects/:id` | `GET` | Yes | Yes | Low | `project:view` |
| `/api/v1/admin/projects/:id/status` | `PUT` | Yes | Yes | Medium | `project:edit` |
| `/api/v1/admin/projects/:id/phases` | `GET` | Yes | Yes | Low | `project:view` |
| `/api/v1/admin/projects/:id/phases/:phaseId` | `PUT` | Yes | Yes | Medium | `project:edit` |
| `/api/v1/admin/projects/:id/logs` | `GET` | Yes | Yes | Low | `project:view` |
| `/api/v1/admin/projects/:id/phases/:phaseId/logs` | `POST` | Yes | Yes | Medium | `project:edit` |
| `/api/v1/admin/logs/:logId` | `PUT` | Yes | Yes | Medium | `project:edit` |
| `/api/v1/admin/logs/:logId` | `DELETE` | Yes | Yes | High | `project:edit` |

## 财务、风控、系统配置

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/finance/escrow-accounts` | `GET` | Yes | Yes | Low | `finance:escrow:list` |
| `/api/v1/admin/finance/transactions` | `GET` | Yes | Yes | Low | `finance:transaction:list` |
| `/api/v1/admin/finance/escrow-accounts/:accountId/withdraw` | `POST` | Yes | Yes | High | `finance:transaction:approve` |
| `/api/v1/admin/withdraws` | `GET` | Yes | Yes | Low | `finance:transaction:list` |
| `/api/v1/admin/withdraws/:id` | `GET` | Yes | Yes | Medium | `finance:transaction:view` |
| `/api/v1/admin/withdraws/:id/approve` | `POST` | Yes | Yes | High | `finance:transaction:approve` |
| `/api/v1/admin/withdraws/:id/reject` | `POST` | Yes | Yes | High | `finance:transaction:approve` |
| `/api/v1/admin/risk/warnings` | `GET` | Yes | Yes | Low | `risk:warning:list` |
| `/api/v1/admin/risk/warnings/:id/handle` | `POST` | Yes | Yes | High | `risk:warning:handle` |
| `/api/v1/admin/risk/arbitrations` | `GET` | Yes | Yes | Low | `risk:arbitration:list` |
| `/api/v1/admin/risk/arbitrations/:id` | `PUT` | Yes | Yes | High | `risk:arbitration:judge` |
| `/api/v1/admin/settings` | `GET` | Yes | Yes | Low | `system:setting:list` |
| `/api/v1/admin/settings` | `PUT` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/system-configs` | `GET` | Yes | Yes | Low | `system:setting:list` |
| `/api/v1/admin/system-configs/:key` | `PUT` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/system-configs/batch` | `PUT` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/logs` | `GET` | Yes | Yes | Low | `system:log:list` |

## RBAC、字典、行政区划、敏感词

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/roles` | `GET` | Yes | Yes | Low | `system:role:list` |
| `/api/v1/admin/roles` | `POST` | Yes | Yes | High | `system:role:create` |
| `/api/v1/admin/roles/:id` | `PUT` | Yes | Yes | High | `system:role:edit` |
| `/api/v1/admin/roles/:id` | `DELETE` | Yes | Yes | High | `system:role:delete` |
| `/api/v1/admin/roles/:id/menus` | `GET` | Yes | Yes | Medium | `system:role:assign` |
| `/api/v1/admin/roles/:id/menus` | `POST` | Yes | Yes | High | `system:role:assign` |
| `/api/v1/admin/menus` | `GET` | Yes | Yes | Low | `system:menu:list` |
| `/api/v1/admin/menus` | `POST` | Yes | Yes | High | `system:menu:create` |
| `/api/v1/admin/menus/:id` | `PUT` | Yes | Yes | High | `system:menu:edit` |
| `/api/v1/admin/menus/:id` | `DELETE` | Yes | Yes | High | `system:menu:delete` |
| `/api/v1/admin/sensitive-words` | `GET` | Yes | Yes | Medium | `system:setting:list` |
| `/api/v1/admin/sensitive-words` | `POST` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/sensitive-words/import` | `POST` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/sensitive-words/:id` | `PUT` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/sensitive-words/:id` | `DELETE` | Yes | Yes | High | `system:setting:edit` |
| `/api/v1/admin/dictionaries` | `GET` | Yes | Yes | Low | `system:setting:list` |
| `/api/v1/admin/dictionaries` | `POST` | Yes | Yes | Medium | `system:setting:edit` |
| `/api/v1/admin/dictionaries/:id` | `PUT` | Yes | Yes | Medium | `system:setting:edit` |
| `/api/v1/admin/dictionaries/:id` | `DELETE` | Yes | Yes | Medium | `system:setting:edit` |
| `/api/v1/admin/dictionaries/categories` | `GET` | Yes | Yes | Low | `system:setting:list` |
| `/api/v1/admin/dictionaries/categories` | `POST` | Yes | Yes | Medium | `system:setting:edit` |
| `/api/v1/admin/dictionaries/categories/:code` | `PUT` | Yes | Yes | Medium | `system:setting:edit` |
| `/api/v1/admin/dictionaries/categories/:code` | `DELETE` | Yes | Yes | Medium | `system:setting:edit` |
| `/api/v1/admin/regions` | `GET` | Yes | Yes | Low | `system:setting:list` |
| `/api/v1/admin/regions/children/:parentCode` | `GET` | Yes | Yes | Low | `system:setting:list` |
| `/api/v1/admin/regions/:id/toggle` | `PUT` | Yes | Yes | Medium | `system:setting:edit` |

## 通知系统

| Route | Method | Has AdminJWT | Has RequirePermission | Risk Level | Proposed Permission |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/admin/notifications` | `GET` | Yes | No | Low | `-` |
| `/api/v1/admin/notifications/unread-count` | `GET` | Yes | No | Low | `-` |
| `/api/v1/admin/notifications/:id/read` | `PUT` | Yes | No | Low | `-` |
| `/api/v1/admin/notifications/read-all` | `PUT` | Yes | No | Low | `-` |
| `/api/v1/admin/notifications/:id` | `DELETE` | Yes | No | Low | `-` |
