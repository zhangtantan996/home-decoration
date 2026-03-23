/*
 Navicat Premium Data Transfer

 Source Server         : Home
 Source Server Type    : PostgreSQL
 Source Server Version : 150015 (150015)
 Source Host           : localhost:5432
 Source Catalog        : home_decoration
 Source Schema         : public

 Target Server Type    : PostgreSQL
 Target Server Version : 150015 (150015)
 File Encoding         : 65001

 Date: 21/01/2026 13:05:23
*/


-- ----------------------------
-- Sequence structure for admin_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."admin_logs_id_seq";
CREATE SEQUENCE "public"."admin_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for admins_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."admins_id_seq";
CREATE SEQUENCE "public"."admins_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for after_sales_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."after_sales_id_seq";
CREATE SEQUENCE "public"."after_sales_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for arbitrations_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."arbitrations_id_seq";
CREATE SEQUENCE "public"."arbitrations_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for audit_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."audit_logs_id_seq";
CREATE SEQUENCE "public"."audit_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for bookings_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."bookings_id_seq";
CREATE SEQUENCE "public"."bookings_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for case_audits_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."case_audits_id_seq";
CREATE SEQUENCE "public"."case_audits_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for chat_messages_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."chat_messages_id_seq";
CREATE SEQUENCE "public"."chat_messages_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for dictionary_categories_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."dictionary_categories_id_seq";
CREATE SEQUENCE "public"."dictionary_categories_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for escrow_accounts_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."escrow_accounts_id_seq";
CREATE SEQUENCE "public"."escrow_accounts_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for material_shop_audits_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."material_shop_audits_id_seq";
CREATE SEQUENCE "public"."material_shop_audits_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for material_shops_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."material_shops_id_seq";
CREATE SEQUENCE "public"."material_shops_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for merchant_applications_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."merchant_applications_id_seq";
CREATE SEQUENCE "public"."merchant_applications_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for merchant_bank_accounts_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."merchant_bank_accounts_id_seq";
CREATE SEQUENCE "public"."merchant_bank_accounts_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for merchant_incomes_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."merchant_incomes_id_seq";
CREATE SEQUENCE "public"."merchant_incomes_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for merchant_service_settings_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."merchant_service_settings_id_seq";
CREATE SEQUENCE "public"."merchant_service_settings_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for merchant_withdraws_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."merchant_withdraws_id_seq";
CREATE SEQUENCE "public"."merchant_withdraws_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for milestones_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."milestones_id_seq";
CREATE SEQUENCE "public"."milestones_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for notifications_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."notifications_id_seq";
CREATE SEQUENCE "public"."notifications_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for orders_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."orders_id_seq";
CREATE SEQUENCE "public"."orders_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for payment_plans_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."payment_plans_id_seq";
CREATE SEQUENCE "public"."payment_plans_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for phase_tasks_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."phase_tasks_id_seq";
CREATE SEQUENCE "public"."phase_tasks_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for project_phases_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."project_phases_id_seq";
CREATE SEQUENCE "public"."project_phases_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for projects_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."projects_id_seq";
CREATE SEQUENCE "public"."projects_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for proposals_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."proposals_id_seq";
CREATE SEQUENCE "public"."proposals_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for provider_audits_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."provider_audits_id_seq";
CREATE SEQUENCE "public"."provider_audits_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for provider_cases_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."provider_cases_id_seq";
CREATE SEQUENCE "public"."provider_cases_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for provider_reviews_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."provider_reviews_id_seq";
CREATE SEQUENCE "public"."provider_reviews_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for providers_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."providers_id_seq";
CREATE SEQUENCE "public"."providers_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for regions_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."regions_id_seq";
CREATE SEQUENCE "public"."regions_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for risk_warnings_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."risk_warnings_id_seq";
CREATE SEQUENCE "public"."risk_warnings_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_admins_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_admins_id_seq";
CREATE SEQUENCE "public"."sys_admins_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_menus_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_menus_id_seq";
CREATE SEQUENCE "public"."sys_menus_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_operation_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_operation_logs_id_seq";
CREATE SEQUENCE "public"."sys_operation_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for sys_roles_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."sys_roles_id_seq";
CREATE SEQUENCE "public"."sys_roles_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for system_configs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."system_configs_id_seq";
CREATE SEQUENCE "public"."system_configs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for system_dictionaries_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."system_dictionaries_id_seq";
CREATE SEQUENCE "public"."system_dictionaries_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for system_settings_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."system_settings_id_seq";
CREATE SEQUENCE "public"."system_settings_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for transactions_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."transactions_id_seq";
CREATE SEQUENCE "public"."transactions_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for user_favorites_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."user_favorites_id_seq";
CREATE SEQUENCE "public"."user_favorites_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for user_follows_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."user_follows_id_seq";
CREATE SEQUENCE "public"."user_follows_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for user_wechat_bindings_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."user_wechat_bindings_id_seq";
CREATE SEQUENCE "public"."user_wechat_bindings_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for users_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."users_id_seq";
CREATE SEQUENCE "public"."users_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for work_logs_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."work_logs_id_seq";
CREATE SEQUENCE "public"."work_logs_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for workers_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."workers_id_seq";
CREATE SEQUENCE "public"."workers_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 9223372036854775807
START 1
CACHE 1;

-- ----------------------------
-- Table structure for admin_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."admin_logs";
CREATE TABLE "public"."admin_logs" (
  "id" int8 NOT NULL DEFAULT nextval('admin_logs_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "admin_id" int8,
  "admin_name" varchar(50) COLLATE "pg_catalog"."default",
  "action" varchar(100) COLLATE "pg_catalog"."default",
  "resource" varchar(100) COLLATE "pg_catalog"."default",
  "resource_id" int8,
  "method" varchar(10) COLLATE "pg_catalog"."default",
  "path" varchar(200) COLLATE "pg_catalog"."default",
  "ip" varchar(50) COLLATE "pg_catalog"."default",
  "user_agent" varchar(500) COLLATE "pg_catalog"."default",
  "request_data" text COLLATE "pg_catalog"."default",
  "status" int8
)
;

-- ----------------------------
-- Records of admin_logs
-- ----------------------------
INSERT INTO "public"."admin_logs" VALUES (1, '2025-12-26 17:57:01.598472+00', '2025-12-26 17:57:01.598472+00', 1, '', 'PATCH /api/v1/admin/providers/90005/verify', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (2, '2025-12-26 17:57:02.414607+00', '2025-12-26 17:57:02.414607+00', 1, '', 'PATCH /api/v1/admin/providers/90005/verify', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (34, '2025-12-28 08:36:31.124605+00', '2025-12-28 08:36:31.124605+00', 1, '', 'POST /api/v1/admin/admins', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (35, '2025-12-28 10:32:44.409487+00', '2025-12-28 10:32:44.409487+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (36, '2025-12-28 10:32:45.123495+00', '2025-12-28 10:32:45.123495+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (37, '2025-12-28 12:07:01.804637+00', '2025-12-28 12:07:01.804637+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (38, '2025-12-28 12:07:03.188235+00', '2025-12-28 12:07:03.188235+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (39, '2025-12-28 12:13:54.198663+00', '2025-12-28 12:13:54.198663+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (40, '2025-12-28 12:13:55.452854+00', '2025-12-28 12:13:55.452854+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (41, '2025-12-28 12:14:10.040121+00', '2025-12-28 12:14:10.040121+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (42, '2025-12-28 12:14:11.478208+00', '2025-12-28 12:14:11.478208+00', 1, '', 'PATCH /api/v1/admin/admins/13/status', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (43, '2025-12-28 12:37:20.565253+00', '2025-12-28 12:37:20.565253+00', 1, '', 'DELETE /api/v1/admin/admins/13', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (44, '2025-12-28 12:37:25.403938+00', '2025-12-28 12:37:25.403938+00', 1, '', 'DELETE /api/v1/admin/admins/12', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (45, '2025-12-28 12:37:30.245094+00', '2025-12-28 12:37:30.245094+00', 1, '', 'DELETE /api/v1/admin/admins/11', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (46, '2025-12-28 12:37:33.80486+00', '2025-12-28 12:37:33.80486+00', 1, '', 'DELETE /api/v1/admin/admins/10', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (47, '2025-12-28 12:37:35.694575+00', '2025-12-28 12:37:35.694575+00', 1, '', 'DELETE /api/v1/admin/admins/9', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (48, '2025-12-28 12:37:37.244712+00', '2025-12-28 12:37:37.244712+00', 1, '', 'DELETE /api/v1/admin/admins/8', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (49, '2025-12-28 12:38:14.47366+00', '2025-12-28 12:38:14.47366+00', 1, '', 'POST /api/v1/admin/admins', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (50, '2025-12-28 12:49:31.913927+00', '2025-12-28 12:49:31.913927+00', 1, '', 'PUT /api/v1/admin/admins/14', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (51, '2025-12-29 14:07:05.175451+00', '2025-12-29 14:07:05.175451+00', 1, '', 'POST /api/v1/admin/audits/cases/2/approve', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (52, '2025-12-29 14:07:50.944843+00', '2025-12-29 14:07:50.944843+00', 1, '', 'POST /api/v1/admin/audits/cases/3/approve', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (53, '2025-12-29 14:38:42.49131+00', '2025-12-29 14:38:42.49131+00', 1, '', 'POST /api/v1/admin/audits/cases/6/reject', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (54, '2025-12-29 14:39:53.173242+00', '2025-12-29 14:39:53.173242+00', 1, '', 'POST /api/v1/admin/audits/cases/7/approve', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (55, '2025-12-30 15:02:30.926672+00', '2025-12-30 15:02:30.926672+00', 1, '', 'DELETE /api/v1/admin/admins/20', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (56, '2025-12-30 15:02:32.540616+00', '2025-12-30 15:02:32.540616+00', 1, '', 'DELETE /api/v1/admin/admins/19', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (57, '2025-12-30 15:02:34.630796+00', '2025-12-30 15:02:34.630796+00', 1, '', 'DELETE /api/v1/admin/admins/18', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (58, '2025-12-30 15:02:36.367033+00', '2025-12-30 15:02:36.367033+00', 1, '', 'DELETE /api/v1/admin/admins/17', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (59, '2025-12-30 15:02:37.702989+00', '2025-12-30 15:02:37.702989+00', 1, '', 'DELETE /api/v1/admin/admins/16', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (60, '2025-12-30 15:02:39.339126+00', '2025-12-30 15:02:39.339126+00', 1, '', 'DELETE /api/v1/admin/admins/15', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (64, '2025-12-31 06:39:34.790772+00', '2025-12-31 06:39:34.790772+00', 1, '', 'POST /api/v1/admin/menus', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (65, '2025-12-31 06:41:20.560694+00', '2025-12-31 06:41:20.560694+00', 1, '', 'POST /api/v1/admin/roles/1/menus', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (66, '2025-12-31 09:56:59.368168+00', '2025-12-31 09:56:59.368168+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (67, '2025-12-31 09:57:02.001285+00', '2025-12-31 09:57:02.001285+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (68, '2025-12-31 10:07:32.216136+00', '2025-12-31 10:07:32.216136+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (69, '2025-12-31 10:07:34.02914+00', '2025-12-31 10:07:34.02914+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (70, '2025-12-31 10:08:08.204583+00', '2025-12-31 10:08:08.204583+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (71, '2025-12-31 10:08:26.323767+00', '2025-12-31 10:08:26.323767+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (72, '2025-12-31 10:08:40.628792+00', '2025-12-31 10:08:40.628792+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (73, '2025-12-31 10:17:50.675288+00', '2025-12-31 10:17:50.675288+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (74, '2025-12-31 15:25:06.330907+00', '2025-12-31 15:25:06.330907+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (75, '2025-12-31 15:26:37.218338+00', '2025-12-31 15:26:37.218338+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (76, '2025-12-31 15:30:39.485477+00', '2025-12-31 15:30:39.485477+00', 1, '', 'PUT /api/v1/admin/settings', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (77, '2026-01-01 11:51:12.235172+00', '2026-01-01 11:51:12.235172+00', 1, '', 'PUT /api/v1/admin/cases/36', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (78, '2026-01-01 11:51:19.230266+00', '2026-01-01 11:51:19.230266+00', 1, '', 'PUT /api/v1/admin/cases/35', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (79, '2026-01-01 11:51:24.790806+00', '2026-01-01 11:51:24.790806+00', 1, '', 'PUT /api/v1/admin/cases/34', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (80, '2026-01-01 11:51:30.641847+00', '2026-01-01 11:51:30.641847+00', 1, '', 'PUT /api/v1/admin/cases/33', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (81, '2026-01-01 11:51:36.002175+00', '2026-01-01 11:51:36.002175+00', 1, '', 'PUT /api/v1/admin/cases/32', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (82, '2026-01-06 06:48:28.698138+00', '2026-01-06 06:48:28.698138+00', 1, '', 'PUT /api/v1/admin/dictionaries/26', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (83, '2026-01-06 06:48:42.241638+00', '2026-01-06 06:48:42.241638+00', 1, '', 'POST /api/v1/admin/dictionaries', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (84, '2026-01-06 08:44:08.491029+00', '2026-01-06 08:44:08.491029+00', 1, '', 'PUT /api/v1/admin/regions/1/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (85, '2026-01-06 08:44:13.641524+00', '2026-01-06 08:44:13.641524+00', 1, '', 'PUT /api/v1/admin/regions/1/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (86, '2026-01-06 09:16:34.935135+00', '2026-01-06 09:16:34.935135+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (87, '2026-01-06 09:16:49.896127+00', '2026-01-06 09:16:49.896127+00', 1, '', 'PUT /api/v1/admin/regions/1/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (88, '2026-01-06 09:26:22.508896+00', '2026-01-06 09:26:22.508896+00', 1, '', 'PUT /api/v1/admin/regions/1/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (89, '2026-01-06 09:26:27.50473+00', '2026-01-06 09:26:27.50473+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (90, '2026-01-06 09:26:32.675505+00', '2026-01-06 09:26:32.675505+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (91, '2026-01-06 09:26:40.63624+00', '2026-01-06 09:26:40.63624+00', 1, '', 'PUT /api/v1/admin/regions/12/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (92, '2026-01-06 09:26:48.991205+00', '2026-01-06 09:26:48.991205+00', 1, '', 'PUT /api/v1/admin/regions/12/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (93, '2026-01-06 09:31:47.538423+00', '2026-01-06 09:31:47.538423+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (94, '2026-01-06 09:33:08.353965+00', '2026-01-06 09:33:08.353965+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (95, '2026-01-06 09:33:10.246103+00', '2026-01-06 09:33:10.246103+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (96, '2026-01-06 09:33:15.054501+00', '2026-01-06 09:33:15.054501+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (97, '2026-01-06 09:33:19.021685+00', '2026-01-06 09:33:19.021685+00', 1, '', 'PUT /api/v1/admin/regions/1/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (98, '2026-01-06 09:33:20.229522+00', '2026-01-06 09:33:20.229522+00', 1, '', 'PUT /api/v1/admin/regions/2/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (99, '2026-01-06 11:32:23.269546+00', '2026-01-06 11:32:23.269546+00', 1, '', 'PUT /api/v1/admin/regions/1/toggle', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (100, '2026-01-06 12:15:31.04789+00', '2026-01-06 12:15:31.04789+00', 1, '', 'POST /api/v1/admin/dictionaries', '', 0, '', '', '172.21.0.1', '', '', 200);
INSERT INTO "public"."admin_logs" VALUES (101, '2026-01-14 09:36:38.416149+00', '2026-01-14 09:36:38.416149+00', 1, '', 'POST /api/v1/admin/audits/cases/8/approve', '', 0, '', '', '172.21.0.1', '', '', 200);

-- ----------------------------
-- Table structure for admins
-- ----------------------------
DROP TABLE IF EXISTS "public"."admins";
CREATE TABLE "public"."admins" (
  "id" int8 NOT NULL DEFAULT nextval('admins_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "username" varchar(50) COLLATE "pg_catalog"."default",
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "email" varchar(100) COLLATE "pg_catalog"."default",
  "password" varchar(255) COLLATE "pg_catalog"."default",
  "role" varchar(20) COLLATE "pg_catalog"."default" DEFAULT 'admin'::character varying,
  "status" int2 DEFAULT 1,
  "last_login_at" timestamptz(6),
  "last_login_ip" varchar(50) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of admins
-- ----------------------------
INSERT INTO "public"."admins" VALUES (1, '2025-12-28 08:36:31.099928+00', '2025-12-28 08:36:31.099928+00', 'zhangtantan', '18717212217', '', '$2a$10$TmZE3p4lI8HZRTxukPZZzOznl28Efv5NxMTmgEpMwxBcB3iNQmjbS', 'operator', 1, NULL, '');
INSERT INTO "public"."admins" VALUES (2, '2025-12-30 15:20:42.126294+00', '2025-12-30 15:20:42.126294+00', 'admin', '13800138000', 'admin@example.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'super', 1, NULL, NULL);
INSERT INTO "public"."admins" VALUES (3, '2025-12-30 15:20:42.126294+00', '2025-12-30 15:20:42.126294+00', 'operator1', '13800138001', 'operator1@example.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'operator', 1, NULL, NULL);

-- ----------------------------
-- Table structure for after_sales
-- ----------------------------
DROP TABLE IF EXISTS "public"."after_sales";
CREATE TABLE "public"."after_sales" (
  "id" int8 NOT NULL DEFAULT nextval('after_sales_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "booking_id" int8,
  "order_no" varchar(32) COLLATE "pg_catalog"."default",
  "type" varchar(20) COLLATE "pg_catalog"."default",
  "reason" varchar(200) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "images" text COLLATE "pg_catalog"."default",
  "amount" numeric,
  "status" int2 DEFAULT 0,
  "reply" text COLLATE "pg_catalog"."default",
  "resolved_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of after_sales
-- ----------------------------

-- ----------------------------
-- Table structure for arbitrations
-- ----------------------------
DROP TABLE IF EXISTS "public"."arbitrations";
CREATE TABLE "public"."arbitrations" (
  "id" int8 NOT NULL DEFAULT nextval('arbitrations_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "project_name" varchar(100) COLLATE "pg_catalog"."default",
  "applicant" varchar(50) COLLATE "pg_catalog"."default",
  "respondent" varchar(50) COLLATE "pg_catalog"."default",
  "reason" text COLLATE "pg_catalog"."default",
  "evidence" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 0,
  "result" text COLLATE "pg_catalog"."default",
  "attachments" text COLLATE "pg_catalog"."default",
  "updated_by" int8
)
;

-- ----------------------------
-- Records of arbitrations
-- ----------------------------

-- ----------------------------
-- Table structure for audit_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."audit_logs";
CREATE TABLE "public"."audit_logs" (
  "id" int8 NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "operator_type" varchar(20) COLLATE "pg_catalog"."default",
  "operator_id" int8,
  "action" varchar(100) COLLATE "pg_catalog"."default",
  "resource" varchar(50) COLLATE "pg_catalog"."default",
  "request_body" text COLLATE "pg_catalog"."default",
  "client_ip" varchar(50) COLLATE "pg_catalog"."default",
  "user_agent" varchar(500) COLLATE "pg_catalog"."default",
  "status_code" int8,
  "duration" int8
)
;

-- ----------------------------
-- Records of audit_logs
-- ----------------------------

-- ----------------------------
-- Table structure for bookings
-- ----------------------------
DROP TABLE IF EXISTS "public"."bookings";
CREATE TABLE "public"."bookings" (
  "id" int8 NOT NULL DEFAULT nextval('bookings_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "provider_id" int8,
  "provider_type" varchar(20) COLLATE "pg_catalog"."default",
  "address" varchar(200) COLLATE "pg_catalog"."default",
  "area" numeric,
  "renovation_type" varchar(50) COLLATE "pg_catalog"."default",
  "budget_range" varchar(50) COLLATE "pg_catalog"."default",
  "preferred_date" varchar(100) COLLATE "pg_catalog"."default",
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "notes" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 1,
  "house_layout" varchar(50) COLLATE "pg_catalog"."default",
  "intent_fee" numeric DEFAULT 0,
  "intent_fee_paid" bool DEFAULT false,
  "intent_fee_deducted" bool DEFAULT false,
  "intent_fee_refunded" bool DEFAULT false,
  "intent_fee_refund_reason" varchar(200) COLLATE "pg_catalog"."default",
  "intent_fee_refunded_at" timestamp(6),
  "merchant_response_deadline" timestamp(6)
)
;

-- ----------------------------
-- Records of bookings
-- ----------------------------
INSERT INTO "public"."bookings" VALUES (2, '2025-12-28 13:06:30.415333+00', '2025-12-28 18:18:09.294397+00', 1, 90004, 'designer', '反反复复的', 55, 'new', '2', '12-29 [周一] 08:00-10:00', '13800138000', '', 4, '2室1厅1卫', 0, 'f', 'f', 'f', NULL, NULL, NULL);
INSERT INTO "public"."bookings" VALUES (3, '2025-12-28 16:52:00.005407+00', '2025-12-29 14:41:27.348075+00', 1, 90004, 'designer', '反反复复方法发', 55, 'new', '3', '12-30 [周二] 09:00-12:00', '13800138000', '', 4, '2室1厅1卫', 0, 'f', 'f', 'f', NULL, NULL, NULL);
INSERT INTO "public"."bookings" VALUES (5, '2025-12-28 17:23:08.890847+00', '2025-12-29 17:04:53.061437+00', 1, 90004, 'designer', '嘟嘟嘟嘟哈哈哈哈方法', 55, 'new', '3', '12-30 [周二] 09:00-12:00', '13800138000', '', 3, '2室1厅1卫', 99, 't', 'f', 'f', NULL, NULL, NULL);

-- ----------------------------
-- Table structure for case_audits
-- ----------------------------
DROP TABLE IF EXISTS "public"."case_audits";
CREATE TABLE "public"."case_audits" (
  "id" int8 NOT NULL DEFAULT nextval('case_audits_id_seq'::regclass),
  "case_id" int8,
  "provider_id" int8 NOT NULL,
  "action_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "title" varchar(100) COLLATE "pg_catalog"."default",
  "cover_image" varchar(500) COLLATE "pg_catalog"."default",
  "style" varchar(50) COLLATE "pg_catalog"."default",
  "area" varchar(20) COLLATE "pg_catalog"."default",
  "year" varchar(10) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "images" text COLLATE "pg_catalog"."default",
  "sort_order" int4 DEFAULT 0,
  "status" int4 DEFAULT 0,
  "reject_reason" varchar(500) COLLATE "pg_catalog"."default",
  "audited_by" int8,
  "audited_at" timestamptz(6),
  "created_at" timestamptz(6) DEFAULT now(),
  "updated_at" timestamptz(6) DEFAULT now(),
  "price" numeric(10,2) DEFAULT 0,
  "layout" varchar(50) COLLATE "pg_catalog"."default",
  "quote_total_cent" int8 DEFAULT 0,
  "quote_currency" varchar(10) COLLATE "pg_catalog"."default" DEFAULT 'CNY'::character varying,
  "quote_items" jsonb DEFAULT '[]'::jsonb
)
;

-- ----------------------------
-- Records of case_audits
-- ----------------------------
INSERT INTO "public"."case_audits" VALUES (2, 4, 90004, 'update', '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 1, '', 0, '2025-12-29 14:07:05.16533+00', '2025-12-29 13:49:32.518472+00', '2025-12-29 14:07:05.165351+00', 120000.00, '一室一厅', 0, 'CNY', '[]');
INSERT INTO "public"."case_audits" VALUES (3, 5, 90004, 'update', '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 1, '', 0, '2025-12-29 14:07:50.935627+00', '2025-12-29 13:49:53.432542+00', '2025-12-29 14:07:50.935643+00', 200000.00, '两室一厅', 0, 'CNY', '[]');
INSERT INTO "public"."case_audits" VALUES (7, 6, 90004, 'update', '新中式别墅设计', '/uploads/cases/case_90004_1767005171319429722.png', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 1, '', 0, '2025-12-29 14:39:53.168195+00', '2025-12-29 14:39:46.60004+00', '2025-12-29 14:39:53.168219+00', 1880000.00, '四室及以上', 0, 'CNY', '[]');
INSERT INTO "public"."case_audits" VALUES (8, 4, 90004, 'update', '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 1, '', 0, '2026-01-14 09:36:38.403884+00', '2026-01-14 09:35:40.326971+00', '2026-01-14 09:36:38.403907+00', 150000.00, '一室一厅', 15000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1000000, "unitPriceCent": 1000000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 2500000, "unitPriceCent": 2500000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 8000000, "unitPriceCent": 8000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 3000000, "unitPriceCent": 3000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 500000, "unitPriceCent": 500000}]');

-- ----------------------------
-- Table structure for chat_messages
-- ----------------------------
DROP TABLE IF EXISTS "public"."chat_messages";
CREATE TABLE "public"."chat_messages" (
  "id" int8 NOT NULL DEFAULT nextval('chat_messages_id_seq'::regclass),
  "conversation_id" varchar(64) COLLATE "pg_catalog"."default",
  "sender_id" int8,
  "receiver_id" int8,
  "content" text COLLATE "pg_catalog"."default",
  "msg_type" int8 DEFAULT 1,
  "is_read" bool DEFAULT false,
  "created_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of chat_messages
-- ----------------------------
INSERT INTO "public"."chat_messages" VALUES (1, '1_90001', 90001, 1, '您好，我是张设计师，很高兴为您服务！', 1, 't', '2025-12-24 05:40:21.188089+00');
INSERT INTO "public"."chat_messages" VALUES (2, '1_90001', 1, 90001, '您好，我想咨询一下现代简约风格的设计方案', 1, 't', '2025-12-24 05:42:21.188089+00');
INSERT INTO "public"."chat_messages" VALUES (3, '1_90001', 90001, 1, '好的，请问您的房屋面积是多少？有什么特殊的功能需求吗？', 1, 't', '2025-12-24 05:44:21.188089+00');
INSERT INTO "public"."chat_messages" VALUES (4, '1_90001', 1, 90001, '120平米，三室两厅。希望客厅和餐厅能够做开放式设计，主卧需要带衣帽间', 1, 't', '2025-12-24 05:46:21.188089+00');
INSERT INTO "public"."chat_messages" VALUES (5, '1_90001', 90001, 1, '明白了，这个需求很常见。我之前做过类似的案例，效果非常不错。', 1, 't', '2025-12-24 05:48:21.188089+00');
INSERT INTO "public"."chat_messages" VALUES (6, '1_90001', 1, 90001, '新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！', 1, 'f', '2025-12-24 05:50:21.188089+00');
INSERT INTO "public"."chat_messages" VALUES (7, '1_90002', 90002, 1, '李师傅，水电改造什么时候能完工？', 1, 't', '2025-12-24 05:40:21.231417+00');
INSERT INTO "public"."chat_messages" VALUES (8, '1_90002', 1, 90002, '预计明天下午可以完成，今天正在做最后的验收检查', 1, 't', '2025-12-24 05:42:21.231417+00');
INSERT INTO "public"."chat_messages" VALUES (9, '1_90002', 90002, 1, '好的，辛苦了！验收通过后我会安排第一期款项', 1, 't', '2025-12-24 05:44:21.231417+00');
INSERT INTO "public"."chat_messages" VALUES (10, '1_90002', 1, 90002, '收到，您放心！', 1, 'f', '2025-12-24 05:46:21.231417+00');
INSERT INTO "public"."chat_messages" VALUES (11, '1_2', 2, 1, '您好，我是张设计师，很高兴为您服务！', 1, 't', '2025-12-30 10:55:36.711044+00');
INSERT INTO "public"."chat_messages" VALUES (12, '1_2', 1, 2, '您好，我想咨询一下现代简约风格的设计方案', 1, 't', '2025-12-30 10:57:36.711044+00');
INSERT INTO "public"."chat_messages" VALUES (13, '1_2', 2, 1, '好的，请问您的房屋面积是多少？有什么特殊的功能需求吗？', 1, 't', '2025-12-30 10:59:36.711044+00');
INSERT INTO "public"."chat_messages" VALUES (14, '1_2', 1, 2, '120平米，三室两厅。希望客厅和餐厅能够做开放式设计，主卧需要带衣帽间', 1, 't', '2025-12-30 11:01:36.711044+00');
INSERT INTO "public"."chat_messages" VALUES (15, '1_2', 2, 1, '明白了，这个需求很常见。我之前做过类似的案例，效果非常不错。', 1, 't', '2025-12-30 11:03:36.711044+00');
INSERT INTO "public"."chat_messages" VALUES (16, '1_2', 1, 2, '新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！', 1, 'f', '2025-12-30 11:05:36.711044+00');
INSERT INTO "public"."chat_messages" VALUES (17, '1_90004', 90004, 1, '李师傅，水电改造什么时候能完工？', 1, 't', '2025-12-30 10:55:36.765943+00');
INSERT INTO "public"."chat_messages" VALUES (18, '1_90004', 1, 90004, '预计明天下午可以完成，今天正在做最后的验收检查', 1, 't', '2025-12-30 10:57:36.765943+00');
INSERT INTO "public"."chat_messages" VALUES (19, '1_90004', 90004, 1, '好的，辛苦了！验收通过后我会安排第一期款项', 1, 't', '2025-12-30 10:59:36.765943+00');
INSERT INTO "public"."chat_messages" VALUES (20, '1_90004', 1, 90004, '收到，您放心！', 1, 'f', '2025-12-30 11:01:36.765943+00');

-- ----------------------------
-- Table structure for conversations
-- ----------------------------
DROP TABLE IF EXISTS "public"."conversations";
CREATE TABLE "public"."conversations" (
  "id" varchar(64) COLLATE "pg_catalog"."default" NOT NULL,
  "user1_id" int8,
  "user2_id" int8,
  "last_message_content" varchar(500) COLLATE "pg_catalog"."default",
  "last_message_time" timestamptz(6),
  "user1_unread" int8 DEFAULT 0,
  "user2_unread" int8 DEFAULT 0,
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of conversations
-- ----------------------------
INSERT INTO "public"."conversations" VALUES ('1_90002', 1, 90002, '收到，您放心！', '2025-12-24 06:40:21.248187+00', 0, 0, '2025-12-24 06:40:21.226821+00', '2025-12-24 07:24:15.156059+00');
INSERT INTO "public"."conversations" VALUES ('1_90001', 1, 90001, '新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！', '2025-12-24 06:40:21.216155+00', 0, 0, '2025-12-24 06:40:21.162983+00', '2025-12-24 07:24:41.052961+00');
INSERT INTO "public"."conversations" VALUES ('1_2', 1, 2, '新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！', '2025-12-30 11:55:36.747439+00', 1, 0, '2025-12-30 11:55:36.70123+00', '2025-12-30 11:55:36.748479+00');
INSERT INTO "public"."conversations" VALUES ('1_90004', 1, 90004, '收到，您放心！', '2025-12-30 11:55:36.793793+00', 1, 0, '2025-12-30 11:55:36.758912+00', '2025-12-30 11:55:36.794377+00');

-- ----------------------------
-- Table structure for dictionary_categories
-- ----------------------------
DROP TABLE IF EXISTS "public"."dictionary_categories";
CREATE TABLE "public"."dictionary_categories" (
  "id" int8 NOT NULL DEFAULT nextval('dictionary_categories_id_seq'::regclass),
  "code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "sort_order" int4 DEFAULT 0,
  "enabled" bool DEFAULT true,
  "icon" varchar(50) COLLATE "pg_catalog"."default",
  "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON COLUMN "public"."dictionary_categories"."code" IS '分类唯一标识，用于API查询';
COMMENT ON COLUMN "public"."dictionary_categories"."name" IS '分类显示名称';
COMMENT ON COLUMN "public"."dictionary_categories"."enabled" IS '软删除标记，false时不返回给前端';
COMMENT ON TABLE "public"."dictionary_categories" IS '数据字典分类表';

-- ----------------------------
-- Records of dictionary_categories
-- ----------------------------
INSERT INTO "public"."dictionary_categories" VALUES (1, 'style', '装修风格', '设计作品的装修风格分类', 1, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (2, 'layout', '户型', '房屋户型分类', 2, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (3, 'budget_range', '预算区间', '装修预算范围', 3, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (4, 'renovation_type', '装修类型', '全包、半包、局部改造等', 4, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (5, 'work_type', '工种类型', '工长的专业工种', 5, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (6, 'provider_sub_type', '商家类型', '个人、工作室、公司', 6, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (7, 'service_area', '服务区域', '服务商的服务区域', 7, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (8, 'phase_type', '施工阶段', '项目施工阶段', 8, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (9, 'material_category', '材料分类', '主材门店分类', 9, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (10, 'review_tag', '评价标签', '商家评价标签', 10, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (11, 'certification_type', '资质类型', '商家资质认证类型', 11, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');
INSERT INTO "public"."dictionary_categories" VALUES (12, 'after_sales_type', '售后类型', '售后申请类型', 12, 't', NULL, '2026-01-05 12:20:00.789373', '2026-01-05 12:20:00.789373');

-- ----------------------------
-- Table structure for escrow_accounts
-- ----------------------------
DROP TABLE IF EXISTS "public"."escrow_accounts";
CREATE TABLE "public"."escrow_accounts" (
  "id" int8 NOT NULL DEFAULT nextval('escrow_accounts_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "total_amount" numeric,
  "frozen_amount" numeric DEFAULT 0,
  "released_amount" numeric DEFAULT 0,
  "status" int2 DEFAULT 1,
  "user_id" int8,
  "project_name" varchar(100) COLLATE "pg_catalog"."default",
  "user_name" varchar(50) COLLATE "pg_catalog"."default",
  "available_amount" numeric DEFAULT 0
)
;

-- ----------------------------
-- Records of escrow_accounts
-- ----------------------------

-- ----------------------------
-- Table structure for material_shop_audits
-- ----------------------------
DROP TABLE IF EXISTS "public"."material_shop_audits";
CREATE TABLE "public"."material_shop_audits" (
  "id" int8 NOT NULL DEFAULT nextval('material_shop_audits_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "shop_id" int8,
  "shop_name" varchar(100) COLLATE "pg_catalog"."default",
  "type" varchar(20) COLLATE "pg_catalog"."default",
  "brand_name" varchar(100) COLLATE "pg_catalog"."default",
  "address" varchar(300) COLLATE "pg_catalog"."default",
  "contact_person" varchar(50) COLLATE "pg_catalog"."default",
  "contact_phone" varchar(20) COLLATE "pg_catalog"."default",
  "business_license" varchar(500) COLLATE "pg_catalog"."default",
  "store_front" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 0,
  "submit_time" timestamptz(6),
  "audit_time" timestamptz(6),
  "audit_admin_id" int8,
  "reject_reason" text COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of material_shop_audits
-- ----------------------------
INSERT INTO "public"."material_shop_audits" VALUES (1, '2025-12-30 15:21:19.194229+00', '2025-12-30 15:21:19.194229+00', 1, '示例品牌旗舰店', 'brand', '马可波罗', '上海市浦东新区张江高科苑路88号', '张经理', '13900139003', 'https://example.com/license4.jpg', '["https://example.com/store1.jpg","https://example.com/store2.jpg"]', 0, '2025-12-30 15:21:19.194229+00', NULL, NULL, NULL);
INSERT INTO "public"."material_shop_audits" VALUES (2, '2025-12-30 15:21:19.194229+00', '2025-12-30 15:21:19.194229+00', 2, '高端家居展厅', 'showroom', '顾家家居', '上海市徐汇区宜山路407号', '李店长', '13900139004', 'https://example.com/license5.jpg', '["https://example.com/store3.jpg"]', 0, '2025-12-30 15:21:19.194229+00', NULL, NULL, NULL);

-- ----------------------------
-- Table structure for material_shops
-- ----------------------------
DROP TABLE IF EXISTS "public"."material_shops";
CREATE TABLE "public"."material_shops" (
  "id" int8 NOT NULL DEFAULT nextval('material_shops_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "type" varchar(20) COLLATE "pg_catalog"."default",
  "name" varchar(100) COLLATE "pg_catalog"."default",
  "cover" varchar(500) COLLATE "pg_catalog"."default",
  "brand_logo" varchar(500) COLLATE "pg_catalog"."default",
  "rating" numeric DEFAULT 0,
  "review_count" int8 DEFAULT 0,
  "main_products" text COLLATE "pg_catalog"."default",
  "product_categories" varchar(200) COLLATE "pg_catalog"."default",
  "address" varchar(300) COLLATE "pg_catalog"."default",
  "latitude" numeric,
  "longitude" numeric,
  "open_time" varchar(50) COLLATE "pg_catalog"."default",
  "tags" text COLLATE "pg_catalog"."default",
  "is_verified" bool DEFAULT false
)
;

-- ----------------------------
-- Records of material_shops
-- ----------------------------
INSERT INTO "public"."material_shops" VALUES (1, '2025-12-26 10:37:43.368878+00', '2025-12-26 10:37:43.368878+00', 'showroom', '红星美凯龙家居馆', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', '', 4.800000190734863, 1256, '["瓷砖","地板","卫浴","橱柜","灯饰"]', '瓷砖,地板,卫浴,橱柜,灯饰', '北京市朝阳区东四环北路6号', 39.9219, 116.4837, '09:00-21:00', '["免费停车","设计服务","送货上门"]', 't');
INSERT INTO "public"."material_shops" VALUES (2, '2025-12-26 10:37:43.375595+00', '2025-12-26 10:37:43.375595+00', 'brand', 'TOTO卫浴专卖店', 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TOTO_logo.svg/200px-TOTO_logo.svg.png', 4.900000095367432, 892, '["智能马桶","花洒","浴缸","洗脸盆"]', '卫浴', '北京市海淀区中关村大街15号', 39.9789, 116.3074, '10:00-21:30', '["正品保障","安装服务","全国联保"]', 't');
INSERT INTO "public"."material_shops" VALUES (3, '2025-12-26 10:37:43.379747+00', '2025-12-26 10:37:43.379747+00', 'showroom', '居然之家设计中心', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800', '', 4.699999809265137, 2341, '["全屋定制","瓷砖","地板","门窗","智能家居"]', '定制,瓷砖,地板,门窗', '北京市丰台区南四环西路1号', 39.8289, 116.3193, '09:30-21:00', '["免费设计","VR体验","品质保障"]', 't');
INSERT INTO "public"."material_shops" VALUES (4, '2025-12-26 10:37:43.383833+00', '2025-12-26 10:37:43.383833+00', 'brand', '马可波罗瓷砖旗舰店', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 'https://example.com/marco-polo-logo.png', 4.599999904632568, 567, '["抛光砖","仿古砖","木纹砖","大理石瓷砖"]', '瓷砖', '北京市朝阳区建国路88号', 39.9075, 116.4714, '09:00-20:00', '["样板间展示","免费切割","施工指导"]', 't');
INSERT INTO "public"."material_shops" VALUES (5, '2025-12-26 10:37:43.388004+00', '2025-12-26 10:37:43.388004+00', 'brand', '大自然地板专卖', 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800', 'https://example.com/nature-floor-logo.png', 4.5, 423, '["实木地板","复合地板","强化地板"]', '地板', '北京市西城区月坛北街甲2号', 39.9134, 116.3479, '09:00-19:00', '["环保认证","免费量房","终身维护"]', 't');
INSERT INTO "public"."material_shops" VALUES (34, '2025-12-26 10:47:28.792913+00', '2025-12-26 10:47:28.792913+00', 'showroom', '红星美凯龙家居馆', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', '', 4.800000190734863, 1256, '["瓷砖","地板","卫浴","橱柜","灯饰"]', '瓷砖,地板,卫浴,橱柜,灯饰', '北京市朝阳区东四环北路6号', 39.9219, 116.4837, '09:00-21:00', '["免费停车","设计服务","送货上门"]', 't');
INSERT INTO "public"."material_shops" VALUES (35, '2025-12-26 10:47:28.799108+00', '2025-12-26 10:47:28.799108+00', 'brand', 'TOTO卫浴专卖店', 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TOTO_logo.svg/200px-TOTO_logo.svg.png', 4.900000095367432, 892, '["智能马桶","花洒","浴缸","洗脸盆"]', '卫浴', '北京市海淀区中关村大街15号', 39.9789, 116.3074, '10:00-21:30', '["正品保障","安装服务","全国联保"]', 't');
INSERT INTO "public"."material_shops" VALUES (36, '2025-12-26 10:47:28.802218+00', '2025-12-26 10:47:28.802218+00', 'showroom', '居然之家设计中心', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800', '', 4.699999809265137, 2341, '["全屋定制","瓷砖","地板","门窗","智能家居"]', '定制,瓷砖,地板,门窗', '北京市丰台区南四环西路1号', 39.8289, 116.3193, '09:30-21:00', '["免费设计","VR体验","品质保障"]', 't');
INSERT INTO "public"."material_shops" VALUES (37, '2025-12-26 10:47:28.806853+00', '2025-12-26 10:47:28.806853+00', 'brand', '马可波罗瓷砖旗舰店', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 'https://example.com/marco-polo-logo.png', 4.599999904632568, 567, '["抛光砖","仿古砖","木纹砖","大理石瓷砖"]', '瓷砖', '北京市朝阳区建国路88号', 39.9075, 116.4714, '09:00-20:00', '["样板间展示","免费切割","施工指导"]', 't');
INSERT INTO "public"."material_shops" VALUES (38, '2025-12-26 10:47:28.811082+00', '2025-12-26 10:47:28.811082+00', 'brand', '大自然地板专卖', 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800', 'https://example.com/nature-floor-logo.png', 4.5, 423, '["实木地板","复合地板","强化地板"]', '地板', '北京市西城区月坛北街甲2号', 39.9134, 116.3479, '09:00-19:00', '["环保认证","免费量房","终身维护"]', 't');

-- ----------------------------
-- Table structure for merchant_applications
-- ----------------------------
DROP TABLE IF EXISTS "public"."merchant_applications";
CREATE TABLE "public"."merchant_applications" (
  "id" int8 NOT NULL DEFAULT nextval('merchant_applications_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "applicant_type" varchar(20) COLLATE "pg_catalog"."default",
  "real_name" varchar(50) COLLATE "pg_catalog"."default",
  "id_card_no" varchar(100) COLLATE "pg_catalog"."default",
  "id_card_front" varchar(500) COLLATE "pg_catalog"."default",
  "id_card_back" varchar(500) COLLATE "pg_catalog"."default",
  "company_name" varchar(100) COLLATE "pg_catalog"."default",
  "license_no" varchar(50) COLLATE "pg_catalog"."default",
  "license_image" varchar(500) COLLATE "pg_catalog"."default",
  "team_size" int8 DEFAULT 1,
  "office_address" varchar(200) COLLATE "pg_catalog"."default",
  "service_area" text COLLATE "pg_catalog"."default",
  "styles" text COLLATE "pg_catalog"."default",
  "introduction" text COLLATE "pg_catalog"."default",
  "portfolio_cases" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 0,
  "reject_reason" varchar(500) COLLATE "pg_catalog"."default",
  "audited_by" int8,
  "audited_at" timestamptz(6),
  "user_id" int8,
  "provider_id" int8
)
;

-- ----------------------------
-- Records of merchant_applications
-- ----------------------------

-- ----------------------------
-- Table structure for merchant_bank_accounts
-- ----------------------------
DROP TABLE IF EXISTS "public"."merchant_bank_accounts";
CREATE TABLE "public"."merchant_bank_accounts" (
  "id" int8 NOT NULL DEFAULT nextval('merchant_bank_accounts_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "account_name" varchar(100) COLLATE "pg_catalog"."default",
  "account_no" varchar(100) COLLATE "pg_catalog"."default",
  "bank_name" varchar(50) COLLATE "pg_catalog"."default",
  "branch_name" varchar(100) COLLATE "pg_catalog"."default",
  "is_default" bool DEFAULT false,
  "status" int2 DEFAULT 1
)
;

-- ----------------------------
-- Records of merchant_bank_accounts
-- ----------------------------

-- ----------------------------
-- Table structure for merchant_incomes
-- ----------------------------
DROP TABLE IF EXISTS "public"."merchant_incomes";
CREATE TABLE "public"."merchant_incomes" (
  "id" int8 NOT NULL DEFAULT nextval('merchant_incomes_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "order_id" int8,
  "booking_id" int8,
  "type" varchar(20) COLLATE "pg_catalog"."default",
  "amount" numeric,
  "platform_fee" numeric,
  "net_amount" numeric,
  "status" int2 DEFAULT 0,
  "settled_at" timestamptz(6),
  "withdraw_order_no" varchar(50) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of merchant_incomes
-- ----------------------------
INSERT INTO "public"."merchant_incomes" VALUES (1, '2025-12-31 07:44:47.201789+00', '2025-12-31 07:44:47.201789+00', 90004, 5, 0, 'material', 200000, 10000, 190000, 0, NULL, '');

-- ----------------------------
-- Table structure for merchant_service_settings
-- ----------------------------
DROP TABLE IF EXISTS "public"."merchant_service_settings";
CREATE TABLE "public"."merchant_service_settings" (
  "id" int8 NOT NULL DEFAULT nextval('merchant_service_settings_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "accept_booking" bool DEFAULT true,
  "auto_confirm_hours" int8 DEFAULT 24,
  "service_styles" text COLLATE "pg_catalog"."default",
  "service_packages" text COLLATE "pg_catalog"."default",
  "price_range_min" numeric,
  "price_range_max" numeric,
  "response_time_desc" varchar(50) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of merchant_service_settings
-- ----------------------------

-- ----------------------------
-- Table structure for merchant_withdraws
-- ----------------------------
DROP TABLE IF EXISTS "public"."merchant_withdraws";
CREATE TABLE "public"."merchant_withdraws" (
  "id" int8 NOT NULL DEFAULT nextval('merchant_withdraws_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "order_no" varchar(32) COLLATE "pg_catalog"."default",
  "amount" numeric,
  "bank_account" varchar(100) COLLATE "pg_catalog"."default",
  "bank_name" varchar(50) COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 0,
  "fail_reason" varchar(200) COLLATE "pg_catalog"."default",
  "completed_at" timestamptz(6),
  "operator_id" int8,
  "audit_remark" text COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of merchant_withdraws
-- ----------------------------

-- ----------------------------
-- Table structure for milestones
-- ----------------------------
DROP TABLE IF EXISTS "public"."milestones";
CREATE TABLE "public"."milestones" (
  "id" int8 NOT NULL DEFAULT nextval('milestones_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "name" varchar(50) COLLATE "pg_catalog"."default",
  "seq" int2,
  "amount" numeric,
  "percentage" numeric,
  "status" int2 DEFAULT 0,
  "criteria" text COLLATE "pg_catalog"."default",
  "submitted_at" timestamptz(6),
  "accepted_at" timestamptz(6),
  "paid_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of milestones
-- ----------------------------
INSERT INTO "public"."milestones" VALUES (1, '2025-12-30 09:40:45.615427+00', '2025-12-30 09:40:45.615427+00', 3, '开工交底', 1, 51000, 20, 0, '现场保护完成，图纸确认', NULL, NULL, NULL);
INSERT INTO "public"."milestones" VALUES (2, '2025-12-30 09:40:45.615427+00', '2025-12-30 09:40:45.615427+00', 3, '水电验收', 2, 76500, 30, 0, '水管试压合格，电路通断测试', NULL, NULL, NULL);
INSERT INTO "public"."milestones" VALUES (3, '2025-12-30 09:40:45.615427+00', '2025-12-30 09:40:45.615427+00', 3, '泥木验收', 3, 76500, 30, 0, '瓷砖空鼓率<5%，木工结构牢固', NULL, NULL, NULL);
INSERT INTO "public"."milestones" VALUES (4, '2025-12-30 09:40:45.615427+00', '2025-12-30 09:40:45.615427+00', 3, '竣工验收', 4, 51000, 20, 0, '全屋保洁完成，设备调试正常', NULL, NULL, NULL);

-- ----------------------------
-- Table structure for notifications
-- ----------------------------
DROP TABLE IF EXISTS "public"."notifications";
CREATE TABLE "public"."notifications" (
  "id" int8 NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  "user_id" int8 NOT NULL,
  "user_type" varchar(20) COLLATE "pg_catalog"."default" NOT NULL,
  "title" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "content" text COLLATE "pg_catalog"."default" NOT NULL,
  "type" varchar(30) COLLATE "pg_catalog"."default" NOT NULL,
  "related_id" int8 DEFAULT 0,
  "related_type" varchar(30) COLLATE "pg_catalog"."default",
  "is_read" bool DEFAULT false,
  "read_at" timestamp(6),
  "action_url" varchar(200) COLLATE "pg_catalog"."default",
  "extra" text COLLATE "pg_catalog"."default",
  "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON COLUMN "public"."notifications"."user_type" IS '用户类型: user(普通用户), provider(商家), admin(管理员)';
COMMENT ON COLUMN "public"."notifications"."type" IS '通知类型: booking.intent_paid, proposal.submitted, order.paid等';
COMMENT ON COLUMN "public"."notifications"."is_read" IS '是否已读';
COMMENT ON COLUMN "public"."notifications"."action_url" IS '点击通知后的跳转路径';
COMMENT ON COLUMN "public"."notifications"."extra" IS 'JSON格式的扩展数据';
COMMENT ON TABLE "public"."notifications" IS '站内通知表';

-- ----------------------------
-- Records of notifications
-- ----------------------------
INSERT INTO "public"."notifications" VALUES (1, 90004, 'provider', '收款通知', '用户已支付订单，金额：200000.00元', 'order.paid', 5, 'order', 'f', NULL, '/merchant/orders/5', '{"amount":200000,"orderId":5}', '2025-12-31 07:44:47.185816', '2025-12-31 07:44:47.185816');

-- ----------------------------
-- Table structure for orders
-- ----------------------------
DROP TABLE IF EXISTS "public"."orders";
CREATE TABLE "public"."orders" (
  "id" int8 NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "booking_id" int8,
  "order_no" text COLLATE "pg_catalog"."default",
  "order_type" varchar(20) COLLATE "pg_catalog"."default",
  "total_amount" numeric,
  "paid_amount" numeric DEFAULT 0,
  "discount" numeric DEFAULT 0,
  "status" int2 DEFAULT 0,
  "paid_at" timestamptz(6),
  "proposal_id" int8,
  "expire_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of orders
-- ----------------------------
INSERT INTO "public"."orders" VALUES (1, '2025-12-30 05:27:24.417824+00', '2025-12-30 07:11:51.78963+00', 0, 5, 'DF20251230052724', 'design', 5000, 0, 99, 2, NULL, 1, '2025-12-31 23:59:59+00');
INSERT INTO "public"."orders" VALUES (2, '2025-12-30 07:46:07.582395+00', '2025-12-30 07:46:19.159444+00', 0, 5, 'DF20251230074607', 'design', 4901, 4802, 99, 1, '2025-12-30 07:46:19.159267+00', 1, '2026-01-01 07:46:07.581942+00');
INSERT INTO "public"."orders" VALUES (3, '2025-12-31 07:39:55.695432+00', '2025-12-31 07:39:55.695432+00', 3, 0, 'D1735640103000', 'design', 5000, 4901, 99, 1, '2025-12-31 07:39:55.695432+00', NULL, NULL);
INSERT INTO "public"."orders" VALUES (5, '2025-12-31 07:39:55.705464+00', '2025-12-31 07:44:47.168557+00', 3, 0, 'M1735640103002', 'material', 200000, 200000, 0, 1, '2025-12-31 07:44:47.168327+00', 0, NULL);
INSERT INTO "public"."orders" VALUES (4, '2025-12-31 07:39:55.701944+00', '2026-01-01 12:12:48.701131+00', 3, 0, 'C1735640103001', 'construction', 50000, 32500, 0, 0, NULL, 0, NULL);

-- ----------------------------
-- Table structure for payment_plans
-- ----------------------------
DROP TABLE IF EXISTS "public"."payment_plans";
CREATE TABLE "public"."payment_plans" (
  "id" int8 NOT NULL DEFAULT nextval('payment_plans_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "order_id" int8,
  "type" varchar(20) COLLATE "pg_catalog"."default",
  "seq" int8,
  "name" varchar(50) COLLATE "pg_catalog"."default",
  "amount" numeric,
  "percentage" numeric,
  "status" int2 DEFAULT 0,
  "due_at" timestamptz(6),
  "paid_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of payment_plans
-- ----------------------------
INSERT INTO "public"."payment_plans" VALUES (3, '2025-12-31 07:39:55.717351+00', '2025-12-31 07:39:55.717351+00', 4, 'milestone', 3, '中期款', 15000, 30, 0, NULL, NULL);
INSERT INTO "public"."payment_plans" VALUES (4, '2025-12-31 07:39:55.721372+00', '2025-12-31 07:39:55.721372+00', 4, 'milestone', 4, '尾款', 2500, 5, 0, NULL, NULL);
INSERT INTO "public"."payment_plans" VALUES (1, '2025-12-31 07:39:55.707549+00', '2025-12-31 07:46:46.754647+00', 4, 'milestone', 1, '开工款', 15000, 30, 1, NULL, '2025-12-31 07:46:46.754342+00');
INSERT INTO "public"."payment_plans" VALUES (2, '2025-12-31 07:39:55.713483+00', '2026-01-01 12:12:48.688395+00', 4, 'milestone', 2, '水电款', 17500, 35, 1, NULL, '2026-01-01 12:12:48.687988+00');

-- ----------------------------
-- Table structure for phase_tasks
-- ----------------------------
DROP TABLE IF EXISTS "public"."phase_tasks";
CREATE TABLE "public"."phase_tasks" (
  "id" int8 NOT NULL DEFAULT nextval('phase_tasks_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "phase_id" int8,
  "name" varchar(100) COLLATE "pg_catalog"."default",
  "is_completed" bool DEFAULT false,
  "completed_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of phase_tasks
-- ----------------------------
INSERT INTO "public"."phase_tasks" VALUES (1, '2025-12-30 09:40:45.603813+00', '2025-12-30 09:40:45.603813+00', 1, '现场交接确认', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (2, '2025-12-30 09:40:45.603813+00', '2025-12-30 09:40:45.603813+00', 1, '施工图纸确认', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (3, '2025-12-30 09:40:45.603813+00', '2025-12-30 09:40:45.603813+00', 1, '材料进场验收', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (4, '2025-12-30 09:40:45.610479+00', '2025-12-30 09:40:45.610479+00', 2, '墙体拆除', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (5, '2025-12-30 09:40:45.610479+00', '2025-12-30 09:40:45.610479+00', 2, '地面拆除', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (6, '2025-12-30 09:40:45.610479+00', '2025-12-30 09:40:45.610479+00', 2, '垃圾清运', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (7, '2025-12-30 09:40:45.611328+00', '2025-12-30 09:40:45.611328+00', 3, '水管布置', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (8, '2025-12-30 09:40:45.611328+00', '2025-12-30 09:40:45.611328+00', 3, '电路布线', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (9, '2025-12-30 09:40:45.611328+00', '2025-12-30 09:40:45.611328+00', 3, '水电验收', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (10, '2025-12-30 09:40:45.612145+00', '2025-12-30 09:40:45.612145+00', 4, '瓷砖铺贴', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (11, '2025-12-30 09:40:45.612145+00', '2025-12-30 09:40:45.612145+00', 4, '木工制作', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (12, '2025-12-30 09:40:45.612145+00', '2025-12-30 09:40:45.612145+00', 4, '吊顶施工', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (13, '2025-12-30 09:40:45.612888+00', '2025-12-30 09:40:45.612888+00', 5, '墙面处理', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (14, '2025-12-30 09:40:45.612888+00', '2025-12-30 09:40:45.612888+00', 5, '乳胶漆施工', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (15, '2025-12-30 09:40:45.613917+00', '2025-12-30 09:40:45.613917+00', 6, '灯具安装', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (16, '2025-12-30 09:40:45.613917+00', '2025-12-30 09:40:45.613917+00', 6, '洁具安装', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (17, '2025-12-30 09:40:45.613917+00', '2025-12-30 09:40:45.613917+00', 6, '五金安装', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (18, '2025-12-30 09:40:45.614797+00', '2025-12-30 09:40:45.614797+00', 7, '全屋保洁', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (19, '2025-12-30 09:40:45.614797+00', '2025-12-30 09:40:45.614797+00', 7, '设备调试', 'f', NULL);
INSERT INTO "public"."phase_tasks" VALUES (20, '2025-12-30 09:40:45.614797+00', '2025-12-30 09:40:45.614797+00', 7, '交付验收', 'f', NULL);

-- ----------------------------
-- Table structure for project_phases
-- ----------------------------
DROP TABLE IF EXISTS "public"."project_phases";
CREATE TABLE "public"."project_phases" (
  "id" int8 NOT NULL DEFAULT nextval('project_phases_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "phase_type" varchar(20) COLLATE "pg_catalog"."default",
  "seq" int8,
  "status" varchar(20) COLLATE "pg_catalog"."default" DEFAULT 'pending'::character varying,
  "responsible_person" varchar(50) COLLATE "pg_catalog"."default",
  "start_date" date,
  "end_date" date,
  "estimated_days" int8
)
;

-- ----------------------------
-- Records of project_phases
-- ----------------------------
INSERT INTO "public"."project_phases" VALUES (1, '2025-12-30 09:40:45.598493+00', '2025-12-30 09:40:45.598493+00', 3, 'preparation', 1, 'pending', '', NULL, NULL, 4);
INSERT INTO "public"."project_phases" VALUES (2, '2025-12-30 09:40:45.610136+00', '2025-12-30 09:40:45.610136+00', 3, 'demolition', 2, 'pending', '', NULL, NULL, 7);
INSERT INTO "public"."project_phases" VALUES (3, '2025-12-30 09:40:45.610986+00', '2025-12-30 09:40:45.610986+00', 3, 'electrical', 3, 'pending', '', NULL, NULL, 10);
INSERT INTO "public"."project_phases" VALUES (4, '2025-12-30 09:40:45.611805+00', '2025-12-30 09:40:45.611805+00', 3, 'masonry', 4, 'pending', '', NULL, NULL, 15);
INSERT INTO "public"."project_phases" VALUES (5, '2025-12-30 09:40:45.612536+00', '2025-12-30 09:40:45.612536+00', 3, 'painting', 5, 'pending', '', NULL, NULL, 10);
INSERT INTO "public"."project_phases" VALUES (6, '2025-12-30 09:40:45.613504+00', '2025-12-30 09:40:45.613504+00', 3, 'installation', 6, 'pending', '', NULL, NULL, 7);
INSERT INTO "public"."project_phases" VALUES (7, '2025-12-30 09:40:45.614517+00', '2025-12-30 09:40:45.614517+00', 3, 'inspection', 7, 'pending', '', NULL, NULL, 3);

-- ----------------------------
-- Table structure for projects
-- ----------------------------
DROP TABLE IF EXISTS "public"."projects";
CREATE TABLE "public"."projects" (
  "id" int8 NOT NULL DEFAULT nextval('projects_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "owner_id" int8,
  "provider_id" int8,
  "name" varchar(100) COLLATE "pg_catalog"."default",
  "address" varchar(200) COLLATE "pg_catalog"."default",
  "latitude" numeric,
  "longitude" numeric,
  "area" numeric,
  "budget" numeric,
  "status" int2 DEFAULT 0,
  "current_phase" varchar(50) COLLATE "pg_catalog"."default",
  "start_date" timestamptz(6),
  "expected_end" timestamptz(6),
  "actual_end" timestamptz(6),
  "material_method" varchar(20) COLLATE "pg_catalog"."default",
  "crew_id" int8,
  "entry_start_date" timestamptz(6),
  "entry_end_date" timestamptz(6),
  "proposal_id" int8
)
;

-- ----------------------------
-- Records of projects
-- ----------------------------
INSERT INTO "public"."projects" VALUES (99001, '2025-12-22 12:38:42.127702+00', '2025-12-22 12:38:42.127702+00', 1, 1, '汤臣一品 A栋-1201 [TEST]', '上海市浦东新区', NULL, NULL, 180, 500000, 1, '水电工程', '2024-11-05 00:00:00+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "public"."projects" VALUES (1, '2025-12-29 16:47:06.59972+00', '2025-12-29 16:47:06.59972+00', 0, 90004, '项目-嘟嘟嘟嘟哈哈哈哈方法', '嘟嘟嘟嘟哈哈哈哈方法', 0, 0, 55, 255000, 0, 'selecting', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "public"."projects" VALUES (2, '2025-12-29 17:04:53.058776+00', '2025-12-29 17:04:53.058776+00', 0, 90004, '项目-嘟嘟嘟嘟哈哈哈哈方法', '嘟嘟嘟嘟哈哈哈哈方法', 0, 0, 55, 255000, 0, 'selecting', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO "public"."projects" VALUES (3, '2025-12-30 09:40:45.586823+00', '2025-12-30 09:40:45.586823+00', 1, 90004, '嘟嘟嘟嘟哈哈哈哈方法装修项目', '嘟嘟嘟嘟哈哈哈哈方法', 0, 0, 55, 255000, 0, '准备阶段', '2025-12-31 00:00:00+00', '2026-03-31 00:00:00+00', NULL, 'platform', 1, '2025-12-31 00:00:00+00', '2026-01-03 00:00:00+00', 1);

-- ----------------------------
-- Table structure for proposals
-- ----------------------------
DROP TABLE IF EXISTS "public"."proposals";
CREATE TABLE "public"."proposals" (
  "id" int8 NOT NULL DEFAULT nextval('proposals_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "booking_id" int8,
  "designer_id" int8,
  "summary" text COLLATE "pg_catalog"."default",
  "design_fee" numeric,
  "construction_fee" numeric,
  "material_fee" numeric,
  "estimated_days" int8,
  "attachments" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 1,
  "confirmed_at" timestamptz(6),
  "version" int8 DEFAULT 1,
  "parent_proposal_id" int8,
  "rejection_count" int8 DEFAULT 0,
  "rejection_reason" text COLLATE "pg_catalog"."default",
  "rejected_at" timestamptz(6),
  "submitted_at" timestamptz(6),
  "user_response_deadline" timestamptz(6)
)
;
COMMENT ON COLUMN "public"."proposals"."version" IS 'Proposal version number (1, 2, 3, etc.)';
COMMENT ON COLUMN "public"."proposals"."parent_proposal_id" IS 'References the previous version of this proposal';
COMMENT ON COLUMN "public"."proposals"."rejection_count" IS 'Number of times proposals for this booking have been rejected';
COMMENT ON COLUMN "public"."proposals"."rejection_reason" IS 'User-provided reason for rejection';
COMMENT ON COLUMN "public"."proposals"."rejected_at" IS 'Timestamp when proposal was rejected';
COMMENT ON COLUMN "public"."proposals"."submitted_at" IS 'Timestamp when proposal was submitted by merchant';
COMMENT ON COLUMN "public"."proposals"."user_response_deadline" IS '14-day deadline for user to confirm/reject';

-- ----------------------------
-- Records of proposals
-- ----------------------------
INSERT INTO "public"."proposals" VALUES (1, '2025-12-29 15:48:34.397116+00', '2025-12-30 07:46:07.581967+00', 5, 90004, '本次家装设计以现代简约风格为主，注重功能与美感的平衡。整体色调采用温暖的中性色，搭配自然材质，营造舒适放松的居住氛围。空间布局强调通透与收纳，提升使用效率。通过合理的灯光设计与软装搭配，打造实用、温馨且富有品质感的家居环境。', 5000, 50000, 200000, 90, '["/uploads/cases/case_90004_1767023242869667598.png","/uploads/cases/case_90004_1767023312358644589.pdf"]', 2, '2025-12-30 07:46:07.581942+00', 1, NULL, 0, NULL, NULL, '2025-12-29 15:48:34.397116+00', NULL);

-- ----------------------------
-- Table structure for provider_audits
-- ----------------------------
DROP TABLE IF EXISTS "public"."provider_audits";
CREATE TABLE "public"."provider_audits" (
  "id" int8 NOT NULL DEFAULT nextval('provider_audits_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "provider_type" int2,
  "company_name" varchar(100) COLLATE "pg_catalog"."default",
  "contact_person" varchar(50) COLLATE "pg_catalog"."default",
  "contact_phone" varchar(20) COLLATE "pg_catalog"."default",
  "business_license" varchar(500) COLLATE "pg_catalog"."default",
  "certificates" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 0,
  "submit_time" timestamptz(6),
  "audit_time" timestamptz(6),
  "audit_admin_id" int8,
  "reject_reason" text COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of provider_audits
-- ----------------------------
INSERT INTO "public"."provider_audits" VALUES (3, '2025-12-30 15:21:19.181767+00', '2025-12-30 15:21:19.181767+00', 3, 3, '?????', '??', '13900139002', 'https://example.com/license3.jpg', '["https://example.com/cert4.jpg"]', 1, '2025-12-28 15:21:19.181767+00', NULL, NULL, NULL);

-- ----------------------------
-- Table structure for provider_cases
-- ----------------------------
DROP TABLE IF EXISTS "public"."provider_cases";
CREATE TABLE "public"."provider_cases" (
  "id" int8 NOT NULL DEFAULT nextval('provider_cases_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "title" varchar(100) COLLATE "pg_catalog"."default",
  "cover_image" varchar(500) COLLATE "pg_catalog"."default",
  "style" varchar(50) COLLATE "pg_catalog"."default",
  "area" varchar(20) COLLATE "pg_catalog"."default",
  "year" varchar(10) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "images" text COLLATE "pg_catalog"."default",
  "sort_order" int8 DEFAULT 0,
  "price" numeric(10,2) DEFAULT 0,
  "layout" varchar(50) COLLATE "pg_catalog"."default",
  "quote_total_cent" int8 DEFAULT 0,
  "quote_currency" varchar(10) COLLATE "pg_catalog"."default" DEFAULT 'CNY'::character varying,
  "quote_items" jsonb DEFAULT '[]'::jsonb
)
;

-- ----------------------------
-- Records of provider_cases
-- ----------------------------
INSERT INTO "public"."provider_cases" VALUES (5, '2025-12-23 08:14:45.079671+00', '2025-12-29 14:07:50.935108+00', 90004, '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 200000.00, '两室一厅', 20000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 9000000, "unitPriceCent": 9000000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 7000000, "unitPriceCent": 7000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 2000000, "unitPriceCent": 2000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 400000, "unitPriceCent": 400000}]');
INSERT INTO "public"."provider_cases" VALUES (6, '2025-12-23 08:14:45.081621+00', '2025-12-29 14:39:53.166988+00', 90004, '新中式别墅设计', '/uploads/cases/case_90004_1767005171319429722.png', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 1880000.00, '四室及以上', 188000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 15040000, "unitPriceCent": 15040000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 84600000, "unitPriceCent": 84600000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 65800000, "unitPriceCent": 65800000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 18800000, "unitPriceCent": 18800000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 3760000, "unitPriceCent": 3760000}]');
INSERT INTO "public"."provider_cases" VALUES (1, '2025-12-23 08:14:45.048847+00', '2025-12-23 08:14:45.048847+00', 90001, '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 200000.00, '一室一厅', 20000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 9000000, "unitPriceCent": 9000000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 7000000, "unitPriceCent": 7000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 2000000, "unitPriceCent": 2000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 400000, "unitPriceCent": 400000}]');
INSERT INTO "public"."provider_cases" VALUES (11, '2025-12-23 08:14:45.133581+00', '2025-12-23 08:14:45.133582+00', 90012, '水电改造工程', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '标准施工', '120', '2024', '全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 100000.00, '两室一厅', 10000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 800000, "unitPriceCent": 800000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4500000, "unitPriceCent": 4500000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3500000, "unitPriceCent": 3500000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1000000, "unitPriceCent": 1000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 200000, "unitPriceCent": 200000}]');
INSERT INTO "public"."provider_cases" VALUES (20, '2025-12-23 08:14:45.204392+00', '2025-12-23 08:14:45.204392+00', 90005, '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 170000.00, '三室一厅', 17000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1360000, "unitPriceCent": 1360000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 7650000, "unitPriceCent": 7650000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5950000, "unitPriceCent": 5950000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1700000, "unitPriceCent": 1700000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 340000, "unitPriceCent": 340000}]');
INSERT INTO "public"."provider_cases" VALUES (35, '2025-12-23 08:14:45.325504+00', '2026-01-01 11:51:19.225504+00', 90013, '水电改造工程', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '标准施工', '120', '2024', '全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 140000.00, '两室一厅', 14000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1120000, "unitPriceCent": 1120000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6300000, "unitPriceCent": 6300000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4900000, "unitPriceCent": 4900000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1400000, "unitPriceCent": 1400000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 280000, "unitPriceCent": 280000}]');
INSERT INTO "public"."provider_cases" VALUES (4, '2025-12-23 08:14:45.076262+00', '2026-01-14 09:36:38.402166+00', 90004, '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 150000.00, '一室一厅', 15000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1000000, "unitPriceCent": 1000000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 2500000, "unitPriceCent": 2500000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 8000000, "unitPriceCent": 8000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 3000000, "unitPriceCent": 3000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 500000, "unitPriceCent": 500000}]');
INSERT INTO "public"."provider_cases" VALUES (36, '2025-12-23 08:14:45.327749+00', '2026-01-01 11:51:12.218262+00', 90013, '木工吊顶施工', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '精工细作', '80', '2024', '客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 160000.00, '一室一厅', 16000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1280000, "unitPriceCent": 1280000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 7200000, "unitPriceCent": 7200000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5600000, "unitPriceCent": 5600000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 320000, "unitPriceCent": 320000}]');
INSERT INTO "public"."provider_cases" VALUES (2, '2025-12-23 08:14:45.053707+00', '2025-12-23 08:14:45.053707+00', 90001, '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 130000.00, '一室一厅', 13000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1040000, "unitPriceCent": 1040000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 5850000, "unitPriceCent": 5850000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4550000, "unitPriceCent": 4550000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1300000, "unitPriceCent": 1300000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 260000, "unitPriceCent": 260000}]');
INSERT INTO "public"."provider_cases" VALUES (3, '2025-12-23 08:14:45.057647+00', '2025-12-23 08:14:45.057647+00', 90001, '新中式别墅设计', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 150000.00, '一室一厅', 15000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1200000, "unitPriceCent": 1200000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6750000, "unitPriceCent": 6750000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5250000, "unitPriceCent": 5250000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1500000, "unitPriceCent": 1500000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 300000, "unitPriceCent": 300000}]');
INSERT INTO "public"."provider_cases" VALUES (7, '2025-12-23 08:14:45.100138+00', '2025-12-23 08:14:45.100139+00', 90011, '厨卫改造项目', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '实用主义', '15', '2024', '针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 190000.00, '一室一厅', 19000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1520000, "unitPriceCent": 1520000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 8550000, "unitPriceCent": 8550000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 6650000, "unitPriceCent": 6650000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1900000, "unitPriceCent": 1900000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 380000, "unitPriceCent": 380000}]');
INSERT INTO "public"."provider_cases" VALUES (10, '2025-12-23 08:14:45.127949+00', '2025-12-23 08:14:45.127949+00', 90012, '厨卫改造项目', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '实用主义', '15', '2024', '针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 110000.00, '一室一厅', 11000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 880000, "unitPriceCent": 880000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4950000, "unitPriceCent": 4950000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3850000, "unitPriceCent": 3850000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1100000, "unitPriceCent": 1100000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 220000, "unitPriceCent": 220000}]');
INSERT INTO "public"."provider_cases" VALUES (8, '2025-12-23 08:14:45.103622+00', '2025-12-23 08:14:45.103622+00', 90011, '水电改造工程', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '标准施工', '120', '2024', '全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 190000.00, '三室一厅', 19000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1520000, "unitPriceCent": 1520000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 8550000, "unitPriceCent": 8550000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 6650000, "unitPriceCent": 6650000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1900000, "unitPriceCent": 1900000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 380000, "unitPriceCent": 380000}]');
INSERT INTO "public"."provider_cases" VALUES (9, '2025-12-23 08:14:45.10752+00', '2025-12-23 08:14:45.107521+00', 90011, '木工吊顶施工', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '精工细作', '80', '2024', '客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 100000.00, '三室一厅', 10000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 800000, "unitPriceCent": 800000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4500000, "unitPriceCent": 4500000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3500000, "unitPriceCent": 3500000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1000000, "unitPriceCent": 1000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 200000, "unitPriceCent": 200000}]');
INSERT INTO "public"."provider_cases" VALUES (12, '2025-12-23 08:14:45.135495+00', '2025-12-23 08:14:45.135495+00', 90012, '木工吊顶施工', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '精工细作', '80', '2024', '客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 150000.00, '一室一厅', 15000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1200000, "unitPriceCent": 1200000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6750000, "unitPriceCent": 6750000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5250000, "unitPriceCent": 5250000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1500000, "unitPriceCent": 1500000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 300000, "unitPriceCent": 300000}]');
INSERT INTO "public"."provider_cases" VALUES (13, '2025-12-23 08:14:45.152029+00', '2025-12-23 08:14:45.152029+00', 90014, '厨卫改造项目', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '实用主义', '15', '2024', '针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 110000.00, '三室一厅', 11000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 880000, "unitPriceCent": 880000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4950000, "unitPriceCent": 4950000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3850000, "unitPriceCent": 3850000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1100000, "unitPriceCent": 1100000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 220000, "unitPriceCent": 220000}]');
INSERT INTO "public"."provider_cases" VALUES (14, '2025-12-23 08:14:45.15559+00', '2025-12-23 08:14:45.15559+00', 90014, '水电改造工程', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '标准施工', '120', '2024', '全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 130000.00, '三室一厅', 13000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1040000, "unitPriceCent": 1040000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 5850000, "unitPriceCent": 5850000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4550000, "unitPriceCent": 4550000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1300000, "unitPriceCent": 1300000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 260000, "unitPriceCent": 260000}]');
INSERT INTO "public"."provider_cases" VALUES (15, '2025-12-23 08:14:45.15768+00', '2025-12-23 08:14:45.15768+00', 90014, '木工吊顶施工', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '精工细作', '80', '2024', '客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 200000.00, '一室一厅', 20000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 9000000, "unitPriceCent": 9000000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 7000000, "unitPriceCent": 7000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 2000000, "unitPriceCent": 2000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 400000, "unitPriceCent": 400000}]');
INSERT INTO "public"."provider_cases" VALUES (16, '2025-12-23 08:14:45.178373+00', '2025-12-23 08:14:45.178373+00', 90002, '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 140000.00, '两室一厅', 14000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1120000, "unitPriceCent": 1120000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6300000, "unitPriceCent": 6300000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4900000, "unitPriceCent": 4900000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1400000, "unitPriceCent": 1400000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 280000, "unitPriceCent": 280000}]');
INSERT INTO "public"."provider_cases" VALUES (17, '2025-12-23 08:14:45.181729+00', '2025-12-23 08:14:45.181729+00', 90002, '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 110000.00, '三室一厅', 11000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 880000, "unitPriceCent": 880000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4950000, "unitPriceCent": 4950000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3850000, "unitPriceCent": 3850000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1100000, "unitPriceCent": 1100000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 220000, "unitPriceCent": 220000}]');
INSERT INTO "public"."provider_cases" VALUES (18, '2025-12-23 08:14:45.183516+00', '2025-12-23 08:14:45.183516+00', 90002, '新中式别墅设计', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 200000.00, '两室一厅', 20000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 9000000, "unitPriceCent": 9000000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 7000000, "unitPriceCent": 7000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 2000000, "unitPriceCent": 2000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 400000, "unitPriceCent": 400000}]');
INSERT INTO "public"."provider_cases" VALUES (21, '2025-12-23 08:14:45.207554+00', '2025-12-23 08:14:45.207554+00', 90005, '新中式别墅设计', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 110000.00, '一室一厅', 11000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 880000, "unitPriceCent": 880000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4950000, "unitPriceCent": 4950000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3850000, "unitPriceCent": 3850000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1100000, "unitPriceCent": 1100000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 220000, "unitPriceCent": 220000}]');
INSERT INTO "public"."provider_cases" VALUES (23, '2025-12-23 08:14:45.227524+00', '2025-12-23 08:14:45.227524+00', 90003, '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 180000.00, '一室一厅', 18000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1440000, "unitPriceCent": 1440000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 8100000, "unitPriceCent": 8100000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 6300000, "unitPriceCent": 6300000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1800000, "unitPriceCent": 1800000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 360000, "unitPriceCent": 360000}]');
INSERT INTO "public"."provider_cases" VALUES (22, '2025-12-23 08:14:45.224195+00', '2025-12-23 08:14:45.224195+00', 90003, '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 100000.00, '一室一厅', 10000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 800000, "unitPriceCent": 800000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4500000, "unitPriceCent": 4500000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3500000, "unitPriceCent": 3500000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1000000, "unitPriceCent": 1000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 200000, "unitPriceCent": 200000}]');
INSERT INTO "public"."provider_cases" VALUES (24, '2025-12-23 08:14:45.229519+00', '2025-12-23 08:14:45.229519+00', 90003, '新中式别墅设计', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 140000.00, '三室一厅', 14000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1120000, "unitPriceCent": 1120000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6300000, "unitPriceCent": 6300000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4900000, "unitPriceCent": 4900000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1400000, "unitPriceCent": 1400000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 280000, "unitPriceCent": 280000}]');
INSERT INTO "public"."provider_cases" VALUES (25, '2025-12-23 08:14:45.248179+00', '2025-12-23 08:14:45.248179+00', 90006, '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 120000.00, '一室一厅', 12000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 960000, "unitPriceCent": 960000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 5400000, "unitPriceCent": 5400000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4200000, "unitPriceCent": 4200000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1200000, "unitPriceCent": 1200000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 240000, "unitPriceCent": 240000}]');
INSERT INTO "public"."provider_cases" VALUES (26, '2025-12-23 08:14:45.251475+00', '2025-12-23 08:14:45.251475+00', 90006, '北欧风两居室', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '北欧风格', '90', '2024', '小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 180000.00, '两室一厅', 18000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1440000, "unitPriceCent": 1440000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 8100000, "unitPriceCent": 8100000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 6300000, "unitPriceCent": 6300000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1800000, "unitPriceCent": 1800000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 360000, "unitPriceCent": 360000}]');
INSERT INTO "public"."provider_cases" VALUES (27, '2025-12-23 08:14:45.253704+00', '2025-12-23 08:14:45.253704+00', 90006, '新中式别墅设计', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '新中式', '280', '2024', '传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 150000.00, '两室一厅', 15000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1200000, "unitPriceCent": 1200000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6750000, "unitPriceCent": 6750000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5250000, "unitPriceCent": 5250000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1500000, "unitPriceCent": 1500000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 300000, "unitPriceCent": 300000}]');
INSERT INTO "public"."provider_cases" VALUES (34, '2025-12-23 08:14:45.32195+00', '2026-01-01 11:51:24.785965+00', 90013, '厨卫改造项目', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '实用主义', '15', '2024', '针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 100000.00, '三室一厅', 10000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 800000, "unitPriceCent": 800000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4500000, "unitPriceCent": 4500000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3500000, "unitPriceCent": 3500000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1000000, "unitPriceCent": 1000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 200000, "unitPriceCent": 200000}]');
INSERT INTO "public"."provider_cases" VALUES (33, '2025-12-23 08:14:45.303533+00', '2026-01-01 11:51:30.638661+00', 90022, '商业空间装修', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '工业风', '500', '2024', '办公空间整体设计装修，兼顾美观与实用，打造高效舒适的工作环境。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 200000.00, '两室一厅', 20000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 9000000, "unitPriceCent": 9000000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 7000000, "unitPriceCent": 7000000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 2000000, "unitPriceCent": 2000000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 400000, "unitPriceCent": 400000}]');
INSERT INTO "public"."provider_cases" VALUES (32, '2025-12-23 08:14:45.301536+00', '2026-01-01 11:51:35.998401+00', 90022, '老房翻新改造', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '简约现代', '100', '2024', '20年老房焕新颜，水电全改造，空间重新规划，让老房子变成现代舒适住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 180000.00, '一室一厅', 18000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1440000, "unitPriceCent": 1440000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 8100000, "unitPriceCent": 8100000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 6300000, "unitPriceCent": 6300000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1800000, "unitPriceCent": 1800000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 360000, "unitPriceCent": 360000}]');
INSERT INTO "public"."provider_cases" VALUES (28, '2025-12-23 08:14:45.272011+00', '2025-12-23 08:14:45.272011+00', 90021, '整装全包案例', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代轻奢', '140', '2024', '从毛坯到精装的全流程整装服务，包含硬装施工、主材选购、软装搭配等一站式解决方案。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 110000.00, '一室一厅', 11000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 880000, "unitPriceCent": 880000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 4950000, "unitPriceCent": 4950000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 3850000, "unitPriceCent": 3850000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1100000, "unitPriceCent": 1100000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 220000, "unitPriceCent": 220000}]');
INSERT INTO "public"."provider_cases" VALUES (29, '2025-12-23 08:14:45.275545+00', '2025-12-23 08:14:45.275545+00', 90021, '老房翻新改造', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '简约现代', '100', '2024', '20年老房焕新颜，水电全改造，空间重新规划，让老房子变成现代舒适住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 1, 160000.00, '两室一厅', 16000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1280000, "unitPriceCent": 1280000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 7200000, "unitPriceCent": 7200000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5600000, "unitPriceCent": 5600000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1600000, "unitPriceCent": 1600000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 320000, "unitPriceCent": 320000}]');
INSERT INTO "public"."provider_cases" VALUES (30, '2025-12-23 08:14:45.277481+00', '2025-12-23 08:14:45.277481+00', 90021, '商业空间装修', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '工业风', '500', '2024', '办公空间整体设计装修，兼顾美观与实用，打造高效舒适的工作环境。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 2, 190000.00, '一室一厅', 19000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1520000, "unitPriceCent": 1520000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 8550000, "unitPriceCent": 8550000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 6650000, "unitPriceCent": 6650000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1900000, "unitPriceCent": 1900000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 380000, "unitPriceCent": 380000}]');
INSERT INTO "public"."provider_cases" VALUES (31, '2025-12-23 08:14:45.297851+00', '2025-12-23 08:14:45.297851+00', 90022, '整装全包案例', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代轻奢', '140', '2024', '从毛坯到精装的全流程整装服务，包含硬装施工、主材选购、软装搭配等一站式解决方案。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 120000.00, '三室一厅', 12000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 960000, "unitPriceCent": 960000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 5400000, "unitPriceCent": 5400000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 4200000, "unitPriceCent": 4200000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1200000, "unitPriceCent": 1200000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 240000, "unitPriceCent": 240000}]');
INSERT INTO "public"."provider_cases" VALUES (19, '2025-12-23 08:14:45.202139+00', '2025-12-23 08:14:45.202139+00', 90005, '现代简约三居室', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', '现代简约', '120', '2024', '本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\u0026auto=format\u0026fit=crop\u0026w=800\u0026q=80"]', 0, 150000.00, '两室一厅', 15000000, 'CNY', '[{"unit": "项", "category": "设计费", "itemName": "设计费", "quantity": 1, "sortOrder": 1, "amountCent": 1200000, "unitPriceCent": 1200000}, {"unit": "项", "category": "施工费", "itemName": "施工费", "quantity": 1, "sortOrder": 2, "amountCent": 6750000, "unitPriceCent": 6750000}, {"unit": "项", "category": "主材费", "itemName": "主材费", "quantity": 1, "sortOrder": 3, "amountCent": 5250000, "unitPriceCent": 5250000}, {"unit": "项", "category": "软装费", "itemName": "软装费", "quantity": 1, "sortOrder": 4, "amountCent": 1500000, "unitPriceCent": 1500000}, {"unit": "项", "category": "其他", "itemName": "其他", "quantity": 1, "sortOrder": 5, "amountCent": 300000, "unitPriceCent": 300000}]');

-- ----------------------------
-- Table structure for provider_reviews
-- ----------------------------
DROP TABLE IF EXISTS "public"."provider_reviews";
CREATE TABLE "public"."provider_reviews" (
  "id" int8 NOT NULL DEFAULT nextval('provider_reviews_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "provider_id" int8,
  "user_id" int8,
  "rating" numeric,
  "content" text COLLATE "pg_catalog"."default",
  "images" text COLLATE "pg_catalog"."default",
  "service_type" varchar(20) COLLATE "pg_catalog"."default",
  "area" varchar(20) COLLATE "pg_catalog"."default",
  "style" varchar(50) COLLATE "pg_catalog"."default",
  "tags" varchar(200) COLLATE "pg_catalog"."default",
  "helpful_count" int8 DEFAULT 0,
  "reply" text COLLATE "pg_catalog"."default",
  "reply_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of provider_reviews
-- ----------------------------
INSERT INTO "public"."provider_reviews" VALUES (1, '2025-12-21 09:58:16.035003+00', '2025-12-23 09:58:16.035003+00', 90012, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (2, '2025-12-14 09:58:16.040083+00', '2025-12-23 09:58:16.040084+00', 90012, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (3, '2025-12-07 09:58:16.042092+00', '2025-12-23 09:58:16.042093+00', 90012, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (4, '2025-12-19 09:58:16.050878+00', '2025-12-23 09:58:16.050878+00', 90004, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (5, '2025-12-12 09:58:16.054125+00', '2025-12-23 09:58:16.054126+00', 90004, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (6, '2025-12-05 09:58:16.056023+00', '2025-12-23 09:58:16.056023+00', 90004, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (7, '2025-12-22 09:58:16.06304+00', '2025-12-23 09:58:16.06304+00', 90011, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 30, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (8, '2025-12-15 09:58:16.066174+00', '2025-12-23 09:58:16.066174+00', 90011, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 25, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (9, '2025-12-08 09:58:16.068051+00', '2025-12-23 09:58:16.068051+00', 90011, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (10, '2025-12-01 09:58:16.070133+00', '2025-12-23 09:58:16.070133+00', 90011, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (11, '2025-11-24 09:58:16.072125+00', '2025-12-23 09:58:16.072126+00', 90011, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (12, '2025-11-17 09:58:16.073962+00', '2025-12-23 09:58:16.073962+00', 90011, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (13, '2025-12-22 09:58:16.084954+00', '2025-12-23 09:58:16.084955+00', 90021, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (14, '2025-12-15 09:58:16.087993+00', '2025-12-23 09:58:16.087993+00', 90021, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (15, '2025-12-08 09:58:16.090054+00', '2025-12-23 09:58:16.090054+00', 90021, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (16, '2025-12-01 09:58:16.092163+00', '2025-12-23 09:58:16.092164+00', 90021, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (17, '2025-12-20 09:58:16.098816+00', '2025-12-23 09:58:16.098817+00', 90003, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 30, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (18, '2025-12-13 09:58:16.102072+00', '2025-12-23 09:58:16.102073+00', 90003, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 25, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (19, '2025-12-06 09:58:16.104029+00', '2025-12-23 09:58:16.10403+00', 90003, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (20, '2025-11-29 09:58:16.106035+00', '2025-12-23 09:58:16.106035+00', 90003, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (21, '2025-11-22 09:58:16.108239+00', '2025-12-23 09:58:16.108239+00', 90003, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (22, '2025-11-15 09:58:16.114145+00', '2025-12-23 09:58:16.114146+00', 90003, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (23, '2025-12-21 09:58:16.121047+00', '2025-12-23 09:58:16.121048+00', 90022, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 25, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (24, '2025-12-14 09:58:16.124091+00', '2025-12-23 09:58:16.124091+00', 90022, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (25, '2025-12-07 09:58:16.126086+00', '2025-12-23 09:58:16.126087+00', 90022, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (26, '2025-11-30 09:58:16.127961+00', '2025-12-23 09:58:16.127962+00', 90022, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (27, '2025-11-23 09:58:16.130011+00', '2025-12-23 09:58:16.130012+00', 90022, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (28, '2025-12-19 09:58:16.136756+00', '2025-12-23 09:58:16.136756+00', 90014, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 25, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (29, '2025-12-12 09:58:16.140153+00', '2025-12-23 09:58:16.140153+00', 90014, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (30, '2025-12-05 09:58:16.142086+00', '2025-12-23 09:58:16.142087+00', 90014, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (31, '2025-11-28 09:58:16.144054+00', '2025-12-23 09:58:16.144054+00', 90014, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (32, '2025-11-21 09:58:16.145987+00', '2025-12-23 09:58:16.145987+00', 90014, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (33, '2025-12-20 09:58:16.152739+00', '2025-12-23 09:58:16.15274+00', 90013, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (34, '2025-12-13 09:58:16.156343+00', '2025-12-23 09:58:16.156344+00', 90013, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (35, '2025-12-06 09:58:16.160104+00', '2025-12-23 09:58:16.160105+00', 90013, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (36, '2025-11-29 09:58:16.162147+00', '2025-12-23 09:58:16.162147+00', 90013, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (37, '2025-12-17 09:58:16.168951+00', '2025-12-23 09:58:16.168951+00', 90006, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 25, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (38, '2025-12-10 09:58:16.172003+00', '2025-12-23 09:58:16.172003+00', 90006, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (39, '2025-12-03 09:58:16.174049+00', '2025-12-23 09:58:16.174049+00', 90006, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (40, '2025-11-26 09:58:16.17604+00', '2025-12-23 09:58:16.17604+00', 90006, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (41, '2025-11-19 09:58:16.178034+00', '2025-12-23 09:58:16.178034+00', 90006, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (42, '2025-12-21 09:58:16.184755+00', '2025-12-23 09:58:16.184755+00', 90002, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 25, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (43, '2025-12-14 09:58:16.188059+00', '2025-12-23 09:58:16.188059+00', 90002, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (44, '2025-12-07 09:58:16.190045+00', '2025-12-23 09:58:16.190045+00', 90002, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (45, '2025-11-30 09:58:16.192008+00', '2025-12-23 09:58:16.192008+00', 90002, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (46, '2025-11-23 09:58:16.19404+00', '2025-12-23 09:58:16.194041+00', 90002, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (47, '2025-12-18 09:58:16.200964+00', '2025-12-23 09:58:16.200965+00', 90005, 1, 4.5, '从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。', '', '半包', '130㎡', '轻奢风格', '["专业","进度透明"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (48, '2025-12-11 09:58:16.203982+00', '2025-12-23 09:58:16.203982+00', 90005, 1, 5, '非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]', '整装', '120㎡', '现代简约', '["服务好","设计赞","沟通顺畅"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (49, '2025-12-04 09:58:16.206022+00', '2025-12-23 09:58:16.206022+00', 90005, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (50, '2025-11-27 09:58:16.207921+00', '2025-12-23 09:58:16.207921+00', 90005, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 5, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (51, '2025-12-22 09:58:16.214818+00', '2025-12-23 09:58:16.214818+00', 90001, 1, 4.5, '整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！', '', '整装', '95㎡', '北欧风格', '["工期准时","质量好"]', 20, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (52, '2025-12-15 09:58:16.218111+00', '2025-12-23 09:58:16.218111+00', 90001, 1, 5, '服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。', '["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]', '半包', '110㎡', '现代简约', '["细节到位","质量好","服务好"]', 15, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (53, '2025-12-08 09:58:16.219982+00', '2025-12-23 09:58:16.219982+00', 90001, 1, 4, '设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。', '', '整装', '88㎡', '简约现代', '["性价比高"]', 10, '', NULL);
INSERT INTO "public"."provider_reviews" VALUES (54, '2025-12-01 09:58:16.221973+00', '2025-12-23 09:58:16.221973+00', 90001, 1, 5, '第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！', '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]', '整装', '75㎡', '新中式', '["服务好","设计赞","老客户"]', 5, '', NULL);

-- ----------------------------
-- Table structure for providers
-- ----------------------------
DROP TABLE IF EXISTS "public"."providers";
CREATE TABLE "public"."providers" (
  "id" int8 NOT NULL DEFAULT nextval('providers_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "provider_type" int2,
  "company_name" varchar(100) COLLATE "pg_catalog"."default",
  "license_no" varchar(50) COLLATE "pg_catalog"."default",
  "rating" numeric DEFAULT 0,
  "restore_rate" numeric,
  "budget_control" numeric,
  "completed_cnt" int8 DEFAULT 0,
  "verified" bool DEFAULT false,
  "latitude" numeric,
  "longitude" numeric,
  "sub_type" varchar(20) COLLATE "pg_catalog"."default" DEFAULT 'personal'::character varying,
  "years_experience" int8 DEFAULT 0,
  "specialty" varchar(200) COLLATE "pg_catalog"."default",
  "work_types" varchar(100) COLLATE "pg_catalog"."default",
  "review_count" int8 DEFAULT 0,
  "price_min" numeric DEFAULT 0,
  "price_max" numeric DEFAULT 0,
  "price_unit" varchar(20) COLLATE "pg_catalog"."default" DEFAULT '元/天'::character varying,
  "followers_count" int8 DEFAULT 0,
  "service_intro" text COLLATE "pg_catalog"."default",
  "team_size" int8 DEFAULT 1,
  "established_year" int8 DEFAULT 2020,
  "certifications" text COLLATE "pg_catalog"."default",
  "cover_image" varchar(500) COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 1,
  "service_area" text COLLATE "pg_catalog"."default",
  "office_address" varchar(200) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of providers
-- ----------------------------
INSERT INTO "public"."providers" VALUES (90002, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.217514+00', 90002, 1, '雅居设计工作室', NULL, 4.8, 94.2, 88.5, 512, 't', 31.2345, 121.4802, 'studio', 12, '新中式 · 轻奢风格', '', 5, 300.00, 800.00, '元/㎡', 900120, '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。', 1, 2020, NULL, 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200', 1, '["610111", "610114", "610118"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90011, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.18744+00', 90011, 3, '工长', NULL, 4.9, 95.0, 90.0, 568, 't', 31.2310, 121.4750, 'personal', 20, '全屋装修 · 水电改造', 'general,plumber,electrician', 6, 300.00, 500.00, '元/天', 900210, '多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。', 6, 2020, NULL, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', 1, '["610124", "610104", "610114"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90005, '2025-12-22 06:50:31.272993+00', '2025-12-26 17:57:02.412137+00', 90005, 1, '强设计工作室', NULL, 4.6, 89.5, 82.0, 445, 'f', 31.2250, 121.4580, 'studio', 10, '工业风 · 混搭风格', '', 4, 250.00, 600.00, '元/㎡', 900150, '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。', 1, 2020, NULL, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200', 1, '["610114", "610117", "610102"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90014, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.193507+00', 90014, 3, '工长', NULL, 4.7, 90.0, 85.0, 245, 'f', 31.2350, 121.4850, 'personal', 12, '墙面粉刷 · 艺术漆施工', 'painter', 5, 280.00, 400.00, '元/天', 900240, '多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。', 9, 2020, NULL, 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=1200', 1, '["610104", "610113", "610117"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90012, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.235421+00', 90012, 3, '工长', NULL, 4.8, 92.0, 88.0, 423, 't', 31.2330, 121.4780, 'personal', 15, '电路改造 · 弱电布线', 'electrician', 3, 350.00, 450.00, '元/天', 900220, '多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。', 7, 2020, NULL, 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200', 1, '["610102", "610111", "610115"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90021, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.241692+00', 90021, 2, '匠心装修工程有限公司', NULL, 4.7, 92.5, 88.0, 1256, 't', 31.2260, 121.4600, 'company', 18, '全包装修 · 整装服务', 'general', 4, 80000.00, 150000.00, '元/全包', 900310, '专业装修公司，提供从设计到施工的一站式服务。拥有专业施工团队，严格把控工程质量，让您省心省力。', 25, 2020, '["营业执照","建筑装饰资质","安全生产许可证"]', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', 1, '["610117", "610124", "610111"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90004, '2025-12-22 06:50:31.272993+00', '2026-01-06 11:30:12.810364+00', 90004, 1, '独立设计师', NULL, 4.9, 98.0, 95.0, 186, 't', 31.2380, 121.4820, 'personal', 5, '现代简约 · 新中式 · 北欧风格', '', 3, 180.00, 400.00, '元/㎡', 900140, '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。阿拉山口大家卡就断开连接ask领导就拉开就大数据的卡拉集散地立刻解开了觉得撒赖科技绿卡的撒尽量快点急啊离开的距离喀什角动量咯技术的会计师大理石空间看了就撒了的卡拉卡斯就拉克沙克来得及卡拉就是打开垃圾三菱电机拉丝机打卡时间的撒加快了的就阿斯利康大家坷拉世界大赛的看就ask来得及可拉斯基的离开洒家的卡拉就少得可怜急啊抗衰老大家看来洒家打开了按揭贷款垃圾啊利空打击ask劳动纪律卡角度看垃圾上来看大家奥克兰撒旦记录卡建档立卡时间离开大家阿斯利康大家立刻撒旦记录卡叫阿里大开杀戒了咯技术的拉开建档立卡时间卢卡斯觉得卡拉就是打开垃圾上来看就打算离开大家阿斯利康决定离开洒家到了离开', 0, 2020, NULL, 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=1200', 1, '["610113","610103","610102","610104","610112","610111"]', '');
INSERT INTO "public"."providers" VALUES (90022, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.229708+00', 90022, 2, '鑫盛建筑装饰公司', NULL, 4.6, 88.0, 82.0, 867, 't', 31.2220, 121.4550, 'company', 12, '半包装修 · 局部翻新', 'general', 5, 50000.00, 100000.00, '元/半包', 900320, '专业装修公司，提供从设计到施工的一站式服务。拥有专业施工团队，严格把控工程质量，让您省心省力。', 30, 2020, '["营业执照","建筑装饰资质","安全生产许可证"]', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200', 1, '["610118", "610102", "610112"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90013, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.208351+00', 90013, 3, '工长', NULL, 4.9, 97.0, 94.0, 312, 't', 31.2280, 121.4620, 'personal', 25, '定制木工 · 吊顶隔断', 'carpenter', 4, 400.00, 600.00, '元/天', 900230, '多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。', 8, 2020, NULL, 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200', 1, '["610103", "610112", "610116"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90001, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.224423+00', 90001, 1, '独立设计师', NULL, 4.9, 96.5, 92.0, 326, 't', 31.2304, 121.4737, 'personal', 8, '现代简约 · 北欧风格', '', 4, 200.00, 500.00, '元/㎡', 900110, '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。', 1, 2020, NULL, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', 1, '["610104", "610113", "610117"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90003, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.181584+00', 90003, 1, '华美装饰设计公司', NULL, 4.7, 91.8, 85.0, 892, 't', 31.2290, 121.4650, 'company', 15, '欧式古典 · 美式田园', '', 6, 500.00, 1200.00, '元/㎡', 900130, '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。', 1, 2020, NULL, 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200', 1, '["610112", "610115", "610122"]', '陕西省西安市');
INSERT INTO "public"."providers" VALUES (90006, '2025-12-22 06:50:31.272993+00', '2025-12-23 12:21:40.176353+00', 90006, 1, '燕归来设计公司', NULL, 4.8, 93.0, 90.0, 278, 't', 31.2200, 121.4500, 'company', 7, '法式浪漫 · 地中海风', '', 5, 350.00, 900.00, '元/㎡', 900160, '专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。', 1, 2020, NULL, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', 1, '["610115", "610118", "610103"]', '陕西省西安市');

-- ----------------------------
-- Table structure for regions
-- ----------------------------
DROP TABLE IF EXISTS "public"."regions";
CREATE TABLE "public"."regions" (
  "id" int8 NOT NULL DEFAULT nextval('regions_id_seq'::regclass),
  "code" varchar(6) COLLATE "pg_catalog"."default" NOT NULL,
  "name" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "level" int4 NOT NULL,
  "parent_code" varchar(6) COLLATE "pg_catalog"."default",
  "enabled" bool DEFAULT true,
  "sort_order" int4 DEFAULT 0,
  "created_at" timestamp(6) DEFAULT now(),
  "updated_at" timestamp(6) DEFAULT now()
)
;
COMMENT ON COLUMN "public"."regions"."code" IS '国家标准6位行政区划代码';
COMMENT ON COLUMN "public"."regions"."name" IS '行政区划名称';
COMMENT ON COLUMN "public"."regions"."level" IS '1:省/直辖市, 2:市/地级市, 3:区/县';
COMMENT ON COLUMN "public"."regions"."parent_code" IS '父级行政区划代码';
COMMENT ON TABLE "public"."regions" IS '行政区划表';

-- ----------------------------
-- Records of regions
-- ----------------------------
INSERT INTO "public"."regions" VALUES (3, '610200', '铜川市', 2, '610000', 't', 2, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (4, '610300', '宝鸡市', 2, '610000', 't', 3, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (5, '610400', '咸阳市', 2, '610000', 't', 4, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (6, '610500', '渭南市', 2, '610000', 't', 5, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (7, '610600', '延安市', 2, '610000', 't', 6, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (8, '610700', '汉中市', 2, '610000', 't', 7, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (9, '610800', '榆林市', 2, '610000', 't', 8, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (10, '610900', '安康市', 2, '610000', 't', 9, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (11, '611000', '商洛市', 2, '610000', 't', 10, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (2, '610100', '西安市', 2, '610000', 't', 1, '2026-01-06 08:01:06.017998', '2026-01-06 11:32:23.223737');
INSERT INTO "public"."regions" VALUES (25, '610202', '王益区', 3, '610200', 't', 1, '2026-01-06 08:01:06.026231', '2026-01-06 11:32:23.225284');
INSERT INTO "public"."regions" VALUES (26, '610203', '印台区', 3, '610200', 't', 2, '2026-01-06 08:01:06.026231', '2026-01-06 11:32:23.225284');
INSERT INTO "public"."regions" VALUES (27, '610204', '耀州区', 3, '610200', 't', 3, '2026-01-06 08:01:06.026231', '2026-01-06 11:32:23.225284');
INSERT INTO "public"."regions" VALUES (70, '610625', '志丹县', 3, '610600', 't', 5, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (71, '610626', '吴起县', 3, '610600', 't', 6, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (72, '610627', '甘泉县', 3, '610600', 't', 7, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (103, '610921', '汉阴县', 3, '610900', 't', 2, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (104, '610922', '石泉县', 3, '610900', 't', 3, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (105, '610923', '宁陕县', 3, '610900', 't', 4, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (106, '610924', '紫阳县', 3, '610900', 't', 5, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (107, '610925', '岚皋县', 3, '610900', 't', 6, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (108, '610926', '平利县', 3, '610900', 't', 7, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (109, '610927', '镇坪县', 3, '610900', 't', 8, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (110, '610929', '白河县', 3, '610900', 't', 9, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (111, '610981', '旬阳市', 3, '610900', 't', 10, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (112, '611002', '商州区', 3, '611000', 't', 1, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (113, '611021', '洛南县', 3, '611000', 't', 2, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (114, '611022', '丹凤县', 3, '611000', 't', 3, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (115, '611023', '商南县', 3, '611000', 't', 4, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (116, '611024', '山阳县', 3, '611000', 't', 5, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (117, '611025', '镇安县', 3, '611000', 't', 6, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (118, '611026', '柞水县', 3, '611000', 't', 7, '2026-01-06 08:01:06.05438', '2026-01-06 11:32:23.257191');
INSERT INTO "public"."regions" VALUES (13, '610103', '碑林区', 3, '610100', 't', 2, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (14, '610104', '莲湖区', 3, '610100', 't', 3, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (15, '610111', '灞桥区', 3, '610100', 't', 4, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (16, '610112', '未央区', 3, '610100', 't', 5, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (17, '610113', '雁塔区', 3, '610100', 't', 6, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (18, '610114', '阎良区', 3, '610100', 't', 7, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (19, '610115', '临潼区', 3, '610100', 't', 8, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (20, '610116', '长安区', 3, '610100', 't', 9, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (21, '610117', '高陵区', 3, '610100', 't', 10, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (22, '610118', '鄠邑区', 3, '610100', 't', 11, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (23, '610122', '蓝田县', 3, '610100', 't', 12, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (24, '610124', '周至县', 3, '610100', 't', 13, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');
INSERT INTO "public"."regions" VALUES (1, '610000', '陕西省', 1, NULL, 't', 1, '2026-01-06 08:01:06.004866', '2026-01-06 11:32:23.22203');
INSERT INTO "public"."regions" VALUES (28, '610222', '宜君县', 3, '610200', 't', 4, '2026-01-06 08:01:06.026231', '2026-01-06 11:32:23.225284');
INSERT INTO "public"."regions" VALUES (29, '610302', '渭滨区', 3, '610300', 't', 1, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (30, '610303', '金台区', 3, '610300', 't', 2, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (31, '610304', '陈仓区', 3, '610300', 't', 3, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (32, '610305', '凤翔区', 3, '610300', 't', 4, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (33, '610323', '岐山县', 3, '610300', 't', 5, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (34, '610324', '扶风县', 3, '610300', 't', 6, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (35, '610326', '眉县', 3, '610300', 't', 7, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (36, '610327', '陇县', 3, '610300', 't', 8, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (37, '610328', '千阳县', 3, '610300', 't', 9, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (38, '610329', '麟游县', 3, '610300', 't', 10, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (39, '610330', '凤县', 3, '610300', 't', 11, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (40, '610331', '太白县', 3, '610300', 't', 12, '2026-01-06 08:01:06.030114', '2026-01-06 11:32:23.227786');
INSERT INTO "public"."regions" VALUES (41, '610402', '秦都区', 3, '610400', 't', 1, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (42, '610403', '杨陵区', 3, '610400', 't', 2, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (43, '610404', '渭城区', 3, '610400', 't', 3, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (44, '610422', '三原县', 3, '610400', 't', 4, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (45, '610423', '泾阳县', 3, '610400', 't', 5, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (46, '610424', '乾县', 3, '610400', 't', 6, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (47, '610425', '礼泉县', 3, '610400', 't', 7, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (48, '610426', '永寿县', 3, '610400', 't', 8, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (49, '610428', '长武县', 3, '610400', 't', 9, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (50, '610429', '旬邑县', 3, '610400', 't', 10, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (51, '610430', '淳化县', 3, '610400', 't', 11, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (52, '610431', '武功县', 3, '610400', 't', 12, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (53, '610481', '兴平市', 3, '610400', 't', 13, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (54, '610482', '彬州市', 3, '610400', 't', 14, '2026-01-06 08:01:06.033676', '2026-01-06 11:32:23.231739');
INSERT INTO "public"."regions" VALUES (55, '610502', '临渭区', 3, '610500', 't', 1, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (56, '610503', '华州区', 3, '610500', 't', 2, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (57, '610522', '潼关县', 3, '610500', 't', 3, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (58, '610523', '大荔县', 3, '610500', 't', 4, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (59, '610524', '合阳县', 3, '610500', 't', 5, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (60, '610525', '澄城县', 3, '610500', 't', 6, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (61, '610526', '蒲城县', 3, '610500', 't', 7, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (62, '610527', '白水县', 3, '610500', 't', 8, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (63, '610528', '富平县', 3, '610500', 't', 9, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (64, '610581', '韩城市', 3, '610500', 't', 10, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (65, '610582', '华阴市', 3, '610500', 't', 11, '2026-01-06 08:01:06.036208', '2026-01-06 11:32:23.236889');
INSERT INTO "public"."regions" VALUES (66, '610602', '宝塔区', 3, '610600', 't', 1, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (67, '610603', '安塞区', 3, '610600', 't', 2, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (68, '610621', '延长县', 3, '610600', 't', 3, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (69, '610622', '延川县', 3, '610600', 't', 4, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (73, '610628', '富县', 3, '610600', 't', 8, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (74, '610629', '洛川县', 3, '610600', 't', 9, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (75, '610630', '宜川县', 3, '610600', 't', 10, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (76, '610631', '黄龙县', 3, '610600', 't', 11, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (77, '610632', '黄陵县', 3, '610600', 't', 12, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (78, '610681', '子长市', 3, '610600', 't', 13, '2026-01-06 08:01:06.039853', '2026-01-06 11:32:23.241232');
INSERT INTO "public"."regions" VALUES (79, '610702', '汉台区', 3, '610700', 't', 1, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (80, '610703', '南郑区', 3, '610700', 't', 2, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (81, '610722', '城固县', 3, '610700', 't', 3, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (82, '610723', '洋县', 3, '610700', 't', 4, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (83, '610724', '西乡县', 3, '610700', 't', 5, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (84, '610725', '勉县', 3, '610700', 't', 6, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (85, '610726', '宁强县', 3, '610700', 't', 7, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (86, '610727', '略阳县', 3, '610700', 't', 8, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (87, '610728', '镇巴县', 3, '610700', 't', 9, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (88, '610729', '留坝县', 3, '610700', 't', 10, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (89, '610730', '佛坪县', 3, '610700', 't', 11, '2026-01-06 08:01:06.044062', '2026-01-06 11:32:23.245932');
INSERT INTO "public"."regions" VALUES (90, '610802', '榆阳区', 3, '610800', 't', 1, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (91, '610803', '横山区', 3, '610800', 't', 2, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (92, '610822', '府谷县', 3, '610800', 't', 3, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (93, '610824', '靖边县', 3, '610800', 't', 4, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (94, '610825', '定边县', 3, '610800', 't', 5, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (95, '610826', '绥德县', 3, '610800', 't', 6, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (96, '610827', '米脂县', 3, '610800', 't', 7, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (97, '610828', '佳县', 3, '610800', 't', 8, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (98, '610829', '吴堡县', 3, '610800', 't', 9, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (99, '610830', '清涧县', 3, '610800', 't', 10, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (100, '610831', '子洲县', 3, '610800', 't', 11, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (101, '610881', '神木市', 3, '610800', 't', 12, '2026-01-06 08:01:06.047978', '2026-01-06 11:32:23.249843');
INSERT INTO "public"."regions" VALUES (102, '610902', '汉滨区', 3, '610900', 't', 1, '2026-01-06 08:01:06.051804', '2026-01-06 11:32:23.253955');
INSERT INTO "public"."regions" VALUES (12, '610102', '新城区', 3, '610100', 't', 1, '2026-01-06 08:01:06.021802', '2026-01-06 11:32:23.260392');

-- ----------------------------
-- Table structure for risk_warnings
-- ----------------------------
DROP TABLE IF EXISTS "public"."risk_warnings";
CREATE TABLE "public"."risk_warnings" (
  "id" int8 NOT NULL DEFAULT nextval('risk_warnings_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "project_name" varchar(100) COLLATE "pg_catalog"."default",
  "type" varchar(50) COLLATE "pg_catalog"."default",
  "level" varchar(20) COLLATE "pg_catalog"."default",
  "description" text COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 0,
  "handled_at" timestamptz(6),
  "handled_by" int8,
  "handle_result" text COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of risk_warnings
-- ----------------------------

-- ----------------------------
-- Table structure for sys_admin_roles
-- ----------------------------
DROP TABLE IF EXISTS "public"."sys_admin_roles";
CREATE TABLE "public"."sys_admin_roles" (
  "admin_id" int8 NOT NULL,
  "role_id" int8 NOT NULL
)
;

-- ----------------------------
-- Records of sys_admin_roles
-- ----------------------------
INSERT INTO "public"."sys_admin_roles" VALUES (1, 1);
INSERT INTO "public"."sys_admin_roles" VALUES (14, 3);

-- ----------------------------
-- Table structure for sys_admins
-- ----------------------------
DROP TABLE IF EXISTS "public"."sys_admins";
CREATE TABLE "public"."sys_admins" (
  "id" int8 NOT NULL DEFAULT nextval('sys_admins_id_seq'::regclass),
  "username" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "password" varchar(255) COLLATE "pg_catalog"."default" NOT NULL,
  "nickname" varchar(50) COLLATE "pg_catalog"."default",
  "avatar" varchar(500) COLLATE "pg_catalog"."default",
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "email" varchar(100) COLLATE "pg_catalog"."default",
  "status" int2 DEFAULT 1,
  "is_super_admin" bool DEFAULT false,
  "last_login_at" timestamptz(6),
  "last_login_ip" varchar(50) COLLATE "pg_catalog"."default",
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of sys_admins
-- ----------------------------
INSERT INTO "public"."sys_admins" VALUES (14, 'zhangtantan', '$2a$10$RO8SCfEdBsMHY2MH/cGvs.XIxckIM8jxIY6QEOz/eMo1b7aAF8l9q', '运营test', '', '', '', 1, 'f', '2025-12-28 17:43:52.876053+00', '172.21.0.1', '2025-12-28 12:38:14.460303+00', '2025-12-28 17:43:52.876336+00');
INSERT INTO "public"."sys_admins" VALUES (1, 'admin', '$2a$10$TP4kgSmgUeQwwwjcE2s0n.sNa19xffV8jlxagtFYjyWR7o.bZ4vli', '超级管理员', '', '', '', 1, 't', '2026-01-14 09:12:16.976888+00', '172.21.0.1', '2025-12-26 15:52:51.857328+00', '2026-01-14 09:12:16.977109+00');

-- ----------------------------
-- Table structure for sys_menus
-- ----------------------------
DROP TABLE IF EXISTS "public"."sys_menus";
CREATE TABLE "public"."sys_menus" (
  "id" int8 NOT NULL DEFAULT nextval('sys_menus_id_seq'::regclass),
  "parent_id" int8 DEFAULT 0,
  "title" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "type" int2 DEFAULT 1,
  "permission" varchar(100) COLLATE "pg_catalog"."default",
  "path" varchar(200) COLLATE "pg_catalog"."default",
  "component" varchar(200) COLLATE "pg_catalog"."default",
  "icon" varchar(100) COLLATE "pg_catalog"."default",
  "sort" int8 DEFAULT 0,
  "visible" bool DEFAULT true,
  "status" int2 DEFAULT 1,
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of sys_menus
-- ----------------------------
INSERT INTO "public"."sys_menus" VALUES (131, 130, '查看审核', 3, 'case:audit:view', NULL, NULL, NULL, 0, 'f', 1, '2025-12-29 13:57:28.702218+00', '2025-12-29 13:57:28.702218+00');
INSERT INTO "public"."sys_menus" VALUES (132, 130, '审核通过', 3, 'case:audit:approve', NULL, NULL, NULL, 0, 'f', 1, '2025-12-29 13:57:28.702218+00', '2025-12-29 13:57:28.702218+00');
INSERT INTO "public"."sys_menus" VALUES (133, 130, '审核拒绝', 3, 'case:audit:reject', NULL, NULL, NULL, 0, 'f', 1, '2025-12-29 13:57:28.702218+00', '2025-12-29 13:57:28.702218+00');
INSERT INTO "public"."sys_menus" VALUES (134, 60, '预约列表', 2, 'booking:list', '/bookings/list', 'pages/bookings/BookingList', 'CalendarOutlined', 0, 't', 1, '2025-12-29 15:08:24.275922+00', '2025-12-29 15:08:24.275922+00');
INSERT INTO "public"."sys_menus" VALUES (136, 100, '日志列表', 2, 'system:log:list', '/logs/list', 'pages/logs/LogList', 'FileTextOutlined', 0, 't', 1, '2025-12-29 15:08:46.759037+00', '2025-12-29 15:08:46.759037+00');
INSERT INTO "public"."sys_menus" VALUES (138, 60, '争议预约', 2, 'booking:dispute:list', '/bookings/disputed', 'bookings/DisputedBookings', '', 10, 't', 1, '2025-12-31 06:39:34.753873+00', '2025-12-31 06:39:34.753873+00');
INSERT INTO "public"."sys_menus" VALUES (150, 110, '字典管理', 1, NULL, '/system/dictionary', NULL, 'UnorderedListOutlined', 10, 't', 1, '2026-01-06 06:14:01.95942+00', '2026-01-06 06:14:01.95942+00');
INSERT INTO "public"."sys_menus" VALUES (145, 150, '查看字典', 2, 'dict:view', NULL, NULL, NULL, 1, 'f', 1, '2026-01-06 06:14:01.95942+00', '2026-01-06 06:14:01.95942+00');
INSERT INTO "public"."sys_menus" VALUES (146, 150, '创建字典', 2, 'dict:create', NULL, NULL, NULL, 2, 'f', 1, '2026-01-06 06:14:01.95942+00', '2026-01-06 06:14:01.95942+00');
INSERT INTO "public"."sys_menus" VALUES (147, 150, '编辑字典', 2, 'dict:update', NULL, NULL, NULL, 3, 'f', 1, '2026-01-06 06:14:01.95942+00', '2026-01-06 06:14:01.95942+00');
INSERT INTO "public"."sys_menus" VALUES (148, 150, '删除字典', 2, 'dict:delete', NULL, NULL, NULL, 4, 'f', 1, '2026-01-06 06:14:01.95942+00', '2026-01-06 06:14:01.95942+00');
INSERT INTO "public"."sys_menus" VALUES (60, 0, '预约管理', 1, 'booking:list', '/bookings', 'pages/bookings/BookingList', 'CalendarOutlined', 50, 't', 1, '2025-12-28 09:38:28.333529+00', '2025-12-28 09:38:28.333529+00');
INSERT INTO "public"."sys_menus" VALUES (80, 0, '评价管理', 1, 'review:list', '/reviews', 'pages/reviews/ReviewList', 'StarOutlined', 70, 't', 1, '2025-12-28 09:38:28.416267+00', '2025-12-28 09:38:28.416267+00');
INSERT INTO "public"."sys_menus" VALUES (1, 0, '工作台', 2, 'dashboard:view', '/dashboard', 'pages/dashboard', 'DashboardOutlined', 1, 't', 1, '2025-12-28 09:38:28.048358+00', '2025-12-28 09:38:28.048358+00');
INSERT INTO "public"."sys_menus" VALUES (10, 0, '用户管理', 1, '', '/users', '', 'UserOutlined', 10, 't', 1, '2025-12-28 09:38:28.056416+00', '2025-12-28 09:38:28.056416+00');
INSERT INTO "public"."sys_menus" VALUES (11, 10, '用户列表', 2, 'system:user:list', '/users/list', 'pages/users/UserList', '', 1, 't', 1, '2025-12-28 09:38:28.062652+00', '2025-12-28 09:38:28.062652+00');
INSERT INTO "public"."sys_menus" VALUES (12, 10, '查看用户', 3, 'system:user:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.068275+00', '2025-12-28 09:38:28.068275+00');
INSERT INTO "public"."sys_menus" VALUES (13, 10, '编辑用户', 3, 'system:user:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.074004+00', '2025-12-28 09:38:28.074004+00');
INSERT INTO "public"."sys_menus" VALUES (14, 10, '删除用户', 3, 'system:user:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.079788+00', '2025-12-28 09:38:28.079788+00');
INSERT INTO "public"."sys_menus" VALUES (15, 10, '导出用户', 3, 'system:user:export', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.08454+00', '2025-12-28 09:38:28.08454+00');
INSERT INTO "public"."sys_menus" VALUES (16, 10, '管理员管理', 2, 'system:admin:list', '/users/admins', 'pages/admins/AdminList', '', 2, 't', 1, '2025-12-28 09:38:28.089871+00', '2025-12-28 09:38:28.089871+00');
INSERT INTO "public"."sys_menus" VALUES (17, 10, '创建管理员', 3, 'system:admin:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.096639+00', '2025-12-28 09:38:28.096639+00');
INSERT INTO "public"."sys_menus" VALUES (18, 10, '编辑管理员', 3, 'system:admin:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.102576+00', '2025-12-28 09:38:28.102576+00');
INSERT INTO "public"."sys_menus" VALUES (19, 10, '删除管理员', 3, 'system:admin:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.108349+00', '2025-12-28 09:38:28.108349+00');
INSERT INTO "public"."sys_menus" VALUES (20, 0, '服务商管理', 1, '', '/providers', '', 'TeamOutlined', 20, 't', 1, '2025-12-28 09:38:28.114667+00', '2025-12-28 09:38:28.114667+00');
INSERT INTO "public"."sys_menus" VALUES (21, 20, '设计师', 2, 'provider:designer:list', '/providers/designers', 'pages/providers/ProviderList', '', 1, 't', 1, '2025-12-28 09:38:28.12147+00', '2025-12-28 09:38:28.12147+00');
INSERT INTO "public"."sys_menus" VALUES (22, 20, '查看设计师', 3, 'provider:designer:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.126712+00', '2025-12-28 09:38:28.126712+00');
INSERT INTO "public"."sys_menus" VALUES (23, 20, '创建设计师', 3, 'provider:designer:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.132729+00', '2025-12-28 09:38:28.132729+00');
INSERT INTO "public"."sys_menus" VALUES (24, 20, '编辑设计师', 3, 'provider:designer:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.139051+00', '2025-12-28 09:38:28.139051+00');
INSERT INTO "public"."sys_menus" VALUES (25, 20, '删除设计师', 3, 'provider:designer:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.14479+00', '2025-12-28 09:38:28.14479+00');
INSERT INTO "public"."sys_menus" VALUES (26, 20, '装修公司', 2, 'provider:company:list', '/providers/companies', 'pages/providers/ProviderList', '', 2, 't', 1, '2025-12-28 09:38:28.151043+00', '2025-12-28 09:38:28.151043+00');
INSERT INTO "public"."sys_menus" VALUES (27, 20, '查看装修公司', 3, 'provider:company:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.156269+00', '2025-12-28 09:38:28.156269+00');
INSERT INTO "public"."sys_menus" VALUES (28, 20, '创建装修公司', 3, 'provider:company:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.163617+00', '2025-12-28 09:38:28.163617+00');
INSERT INTO "public"."sys_menus" VALUES (29, 20, '编辑装修公司', 3, 'provider:company:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.168307+00', '2025-12-28 09:38:28.168307+00');
INSERT INTO "public"."sys_menus" VALUES (30, 20, '删除装修公司', 3, 'provider:company:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.174683+00', '2025-12-28 09:38:28.174683+00');
INSERT INTO "public"."sys_menus" VALUES (31, 20, '工长', 2, 'provider:foreman:list', '/providers/foremen', 'pages/providers/ProviderList', '', 3, 't', 1, '2025-12-28 09:38:28.180448+00', '2025-12-28 09:38:28.180448+00');
INSERT INTO "public"."sys_menus" VALUES (32, 20, '查看工长', 3, 'provider:foreman:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.186326+00', '2025-12-28 09:38:28.186326+00');
INSERT INTO "public"."sys_menus" VALUES (33, 20, '创建工长', 3, 'provider:foreman:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.192648+00', '2025-12-28 09:38:28.192648+00');
INSERT INTO "public"."sys_menus" VALUES (34, 20, '编辑工长', 3, 'provider:foreman:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.198403+00', '2025-12-28 09:38:28.198403+00');
INSERT INTO "public"."sys_menus" VALUES (35, 20, '删除工长', 3, 'provider:foreman:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.204579+00', '2025-12-28 09:38:28.204579+00');
INSERT INTO "public"."sys_menus" VALUES (36, 20, '资质审核', 2, 'provider:audit:list', '/providers/audit', 'pages/audits/ProviderAudit', '', 4, 't', 1, '2025-12-28 09:38:28.210741+00', '2025-12-28 09:38:28.210741+00');
INSERT INTO "public"."sys_menus" VALUES (37, 20, '查看审核', 3, 'provider:audit:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.215945+00', '2025-12-28 09:38:28.215945+00');
INSERT INTO "public"."sys_menus" VALUES (38, 20, '审核通过', 3, 'provider:audit:approve', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.222954+00', '2025-12-28 09:38:28.222954+00');
INSERT INTO "public"."sys_menus" VALUES (39, 20, '审核拒绝', 3, 'provider:audit:reject', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.230154+00', '2025-12-28 09:38:28.230154+00');
INSERT INTO "public"."sys_menus" VALUES (40, 0, '主材门店', 1, '', '/materials', '', 'ShopOutlined', 30, 't', 1, '2025-12-28 09:38:28.236419+00', '2025-12-28 09:38:28.236419+00');
INSERT INTO "public"."sys_menus" VALUES (41, 40, '门店列表', 2, 'material:shop:list', '/materials/list', 'pages/materials/MaterialShopList', '', 1, 't', 1, '2025-12-28 09:38:28.242177+00', '2025-12-28 09:38:28.242177+00');
INSERT INTO "public"."sys_menus" VALUES (42, 40, '查看门店', 3, 'material:shop:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.248508+00', '2025-12-28 09:38:28.248508+00');
INSERT INTO "public"."sys_menus" VALUES (43, 40, '创建门店', 3, 'material:shop:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.254843+00', '2025-12-28 09:38:28.254843+00');
INSERT INTO "public"."sys_menus" VALUES (44, 40, '编辑门店', 3, 'material:shop:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.260697+00', '2025-12-28 09:38:28.260697+00');
INSERT INTO "public"."sys_menus" VALUES (45, 40, '删除门店', 3, 'material:shop:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.266418+00', '2025-12-28 09:38:28.266418+00');
INSERT INTO "public"."sys_menus" VALUES (46, 40, '认证审核', 2, 'material:audit:list', '/materials/audit', 'pages/audits/MaterialShopAudit', '', 2, 't', 1, '2025-12-28 09:38:28.272339+00', '2025-12-28 09:38:28.272339+00');
INSERT INTO "public"."sys_menus" VALUES (47, 40, '查看门店审核', 3, 'material:audit:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.27816+00', '2025-12-28 09:38:28.27816+00');
INSERT INTO "public"."sys_menus" VALUES (48, 40, '门店审核通过', 3, 'material:audit:approve', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.285065+00', '2025-12-28 09:38:28.285065+00');
INSERT INTO "public"."sys_menus" VALUES (49, 40, '门店审核拒绝', 3, 'material:audit:reject', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.290346+00', '2025-12-28 09:38:28.290346+00');
INSERT INTO "public"."sys_menus" VALUES (50, 0, '项目管理', 1, '', '/projects', '', 'ProjectOutlined', 40, 't', 1, '2025-12-28 09:38:28.296136+00', '2025-12-28 09:38:28.296136+00');
INSERT INTO "public"."sys_menus" VALUES (51, 50, '工地列表', 2, 'project:list', '/projects/list', 'pages/projects/list', '', 1, 't', 1, '2025-12-28 09:38:28.302513+00', '2025-12-28 09:38:28.302513+00');
INSERT INTO "public"."sys_menus" VALUES (52, 50, '查看项目', 3, 'project:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.308887+00', '2025-12-28 09:38:28.308887+00');
INSERT INTO "public"."sys_menus" VALUES (53, 50, '编辑项目', 3, 'project:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.31453+00', '2025-12-28 09:38:28.31453+00');
INSERT INTO "public"."sys_menus" VALUES (54, 50, '删除项目', 3, 'project:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.320329+00', '2025-12-28 09:38:28.320329+00');
INSERT INTO "public"."sys_menus" VALUES (55, 50, '全景地图', 2, 'project:map', '/projects/map', 'pages/projects/ProjectMap', '', 2, 't', 1, '2025-12-28 09:38:28.326528+00', '2025-12-28 09:38:28.326528+00');
INSERT INTO "public"."sys_menus" VALUES (70, 0, '资金中心', 1, '', '/finance', '', 'BankOutlined', 60, 't', 1, '2025-12-28 09:38:28.362369+00', '2025-12-28 09:38:28.362369+00');
INSERT INTO "public"."sys_menus" VALUES (71, 70, '托管账户', 2, 'finance:escrow:list', '/finance/escrow', 'pages/finance/EscrowAccountList', '', 1, 't', 1, '2025-12-28 09:38:28.368616+00', '2025-12-28 09:38:28.368616+00');
INSERT INTO "public"."sys_menus" VALUES (72, 70, '查看账户', 3, 'finance:escrow:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.374478+00', '2025-12-28 09:38:28.374478+00');
INSERT INTO "public"."sys_menus" VALUES (73, 70, '冻结账户', 3, 'finance:escrow:freeze', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.380413+00', '2025-12-28 09:38:28.380413+00');
INSERT INTO "public"."sys_menus" VALUES (74, 70, '解冻账户', 3, 'finance:escrow:unfreeze', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.386118+00', '2025-12-28 09:38:28.386118+00');
INSERT INTO "public"."sys_menus" VALUES (75, 70, '交易记录', 2, 'finance:transaction:list', '/finance/transactions', 'pages/finance/TransactionList', '', 2, 't', 1, '2025-12-28 09:38:28.392636+00', '2025-12-28 09:38:28.392636+00');
INSERT INTO "public"."sys_menus" VALUES (76, 70, '查看交易', 3, 'finance:transaction:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.398349+00', '2025-12-28 09:38:28.398349+00');
INSERT INTO "public"."sys_menus" VALUES (77, 70, '导出交易', 3, 'finance:transaction:export', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.404189+00', '2025-12-28 09:38:28.404189+00');
INSERT INTO "public"."sys_menus" VALUES (78, 70, '审批交易', 3, 'finance:transaction:approve', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.409978+00', '2025-12-28 09:38:28.409978+00');
INSERT INTO "public"."sys_menus" VALUES (90, 0, '风控中心', 1, '', '/risk', '', 'SafetyOutlined', 80, 't', 1, '2025-12-28 09:38:28.441281+00', '2025-12-28 09:38:28.441281+00');
INSERT INTO "public"."sys_menus" VALUES (91, 90, '风险预警', 2, 'risk:warning:list', '/risk/warnings', 'pages/risk/RiskWarningList', '', 1, 't', 1, '2025-12-28 09:38:28.446011+00', '2025-12-28 09:38:28.446011+00');
INSERT INTO "public"."sys_menus" VALUES (92, 90, '查看预警', 3, 'risk:warning:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.452731+00', '2025-12-28 09:38:28.452731+00');
INSERT INTO "public"."sys_menus" VALUES (93, 90, '处理风险', 3, 'risk:warning:handle', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.458216+00', '2025-12-28 09:38:28.458216+00');
INSERT INTO "public"."sys_menus" VALUES (94, 90, '忽略风险', 3, 'risk:warning:ignore', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.463919+00', '2025-12-28 09:38:28.463919+00');
INSERT INTO "public"."sys_menus" VALUES (95, 90, '仲裁中心', 2, 'risk:arbitration:list', '/risk/arbitration', 'pages/risk/ArbitrationCenter', '', 2, 't', 1, '2025-12-28 09:38:28.470326+00', '2025-12-28 09:38:28.470326+00');
INSERT INTO "public"."sys_menus" VALUES (96, 90, '查看仲裁', 3, 'risk:arbitration:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.476063+00', '2025-12-28 09:38:28.476063+00');
INSERT INTO "public"."sys_menus" VALUES (97, 90, '受理仲裁', 3, 'risk:arbitration:accept', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.481976+00', '2025-12-28 09:38:28.481976+00');
INSERT INTO "public"."sys_menus" VALUES (98, 90, '驳回仲裁', 3, 'risk:arbitration:reject', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.488135+00', '2025-12-28 09:38:28.488135+00');
INSERT INTO "public"."sys_menus" VALUES (99, 90, '裁决仲裁', 3, 'risk:arbitration:judge', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.493799+00', '2025-12-28 09:38:28.493799+00');
INSERT INTO "public"."sys_menus" VALUES (120, 0, '权限管理', 1, '', '/permission', '', 'LockOutlined', 110, 't', 1, '2025-12-28 09:38:28.524195+00', '2025-12-28 09:38:28.524195+00');
INSERT INTO "public"."sys_menus" VALUES (121, 120, '角色管理', 2, 'system:role:list', '/permission/roles', 'pages/permission/RoleList', '', 1, 't', 1, '2025-12-28 09:38:28.53012+00', '2025-12-28 09:38:28.53012+00');
INSERT INTO "public"."sys_menus" VALUES (122, 120, '创建角色', 3, 'system:role:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.536421+00', '2025-12-28 09:38:28.536421+00');
INSERT INTO "public"."sys_menus" VALUES (123, 120, '编辑角色', 3, 'system:role:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.542863+00', '2025-12-28 09:38:28.542863+00');
INSERT INTO "public"."sys_menus" VALUES (124, 120, '删除角色', 3, 'system:role:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.548823+00', '2025-12-28 09:38:28.548823+00');
INSERT INTO "public"."sys_menus" VALUES (125, 120, '分配权限', 3, 'system:role:assign', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.557183+00', '2025-12-28 09:38:28.557183+00');
INSERT INTO "public"."sys_menus" VALUES (126, 120, '菜单管理', 2, 'system:menu:list', '/permission/menus', 'pages/permission/MenuList', '', 2, 't', 1, '2025-12-28 09:38:28.563486+00', '2025-12-28 09:38:28.563486+00');
INSERT INTO "public"."sys_menus" VALUES (127, 120, '创建菜单', 3, 'system:menu:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.568744+00', '2025-12-28 09:38:28.568744+00');
INSERT INTO "public"."sys_menus" VALUES (128, 120, '编辑菜单', 3, 'system:menu:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.57523+00', '2025-12-28 09:38:28.57523+00');
INSERT INTO "public"."sys_menus" VALUES (129, 120, '删除菜单', 3, 'system:menu:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.580973+00', '2025-12-28 09:38:28.580973+00');
INSERT INTO "public"."sys_menus" VALUES (100, 0, '操作日志', 1, 'system:log:list', '/logs', 'pages/system/LogList', 'FileTextOutlined', 90, 't', 1, '2025-12-28 09:38:28.500149+00', '2025-12-28 09:38:28.500149+00');
INSERT INTO "public"."sys_menus" VALUES (110, 0, '系统设置', 1, 'system:setting:list', '/settings', 'pages/settings/SystemSettings', 'SettingOutlined', 100, 't', 1, '2025-12-28 09:38:28.512155+00', '2025-12-28 09:38:28.512155+00');
INSERT INTO "public"."sys_menus" VALUES (61, 134, '查看预约', 3, 'booking:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.338799+00', '2025-12-28 09:38:28.338799+00');
INSERT INTO "public"."sys_menus" VALUES (62, 134, '创建预约', 3, 'booking:create', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.344988+00', '2025-12-28 09:38:28.344988+00');
INSERT INTO "public"."sys_menus" VALUES (63, 134, '编辑预约', 3, 'booking:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.35074+00', '2025-12-28 09:38:28.35074+00');
INSERT INTO "public"."sys_menus" VALUES (64, 134, '取消预约', 3, 'booking:cancel', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.356542+00', '2025-12-28 09:38:28.356542+00');
INSERT INTO "public"."sys_menus" VALUES (135, 80, '评价列表', 2, 'review:list', '/reviews/list', 'pages/reviews/ReviewList', 'StarOutlined', 0, 't', 1, '2025-12-29 15:08:39.384445+00', '2025-12-29 15:08:39.384445+00');
INSERT INTO "public"."sys_menus" VALUES (81, 135, '查看评价', 3, 'review:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.422146+00', '2025-12-28 09:38:28.422146+00');
INSERT INTO "public"."sys_menus" VALUES (82, 135, '删除评价', 3, 'review:delete', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.42848+00', '2025-12-28 09:38:28.42848+00');
INSERT INTO "public"."sys_menus" VALUES (83, 135, '隐藏评价', 3, 'review:hide', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.434284+00', '2025-12-28 09:38:28.434284+00');
INSERT INTO "public"."sys_menus" VALUES (101, 136, '查看日志', 3, 'system:log:view', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.505905+00', '2025-12-28 09:38:28.505905+00');
INSERT INTO "public"."sys_menus" VALUES (137, 110, '系统配置', 2, 'system:setting:list', '/settings/config', 'pages/settings/SystemSettings', 'SettingOutlined', 0, 't', 1, '2025-12-29 15:08:55.074104+00', '2025-12-29 15:08:55.074104+00');
INSERT INTO "public"."sys_menus" VALUES (111, 137, '编辑设置', 3, 'system:setting:edit', '', '', '', 0, 't', 1, '2025-12-28 09:38:28.517882+00', '2025-12-28 09:38:28.517882+00');
INSERT INTO "public"."sys_menus" VALUES (139, 138, '查看详情', 3, 'booking:dispute:detail', '', '', '', 1, 't', 1, '2025-12-31 07:15:42.735711+00', '2025-12-31 07:15:42.735711+00');
INSERT INTO "public"."sys_menus" VALUES (140, 138, '处理争议', 3, 'booking:dispute:resolve', '', '', '', 2, 't', 1, '2025-12-31 07:15:42.735711+00', '2025-12-31 07:15:42.735711+00');
INSERT INTO "public"."sys_menus" VALUES (143, 0, '作品管理', 1, 'system:case:list', '/cases', 'Layout', 'FileImageOutlined', 50, 't', 1, '2026-01-01 08:33:22.235696+00', '2026-01-01 08:33:22.235696+00');
INSERT INTO "public"."sys_menus" VALUES (144, 143, '作品列表', 2, 'system:case:view', '/cases/manage', '/cases/CaseManagement', 'UnorderedListOutlined', 1, 't', 1, '2026-01-01 08:33:22.235696+00', '2026-01-01 08:33:22.235696+00');
INSERT INTO "public"."sys_menus" VALUES (149, 110, '行政区划管理', 1, NULL, '/settings/regions', NULL, 'EnvironmentOutlined', 10, 't', 1, '2026-01-06 08:25:46.897792+00', '2026-01-06 08:25:46.897792+00');

-- ----------------------------
-- Table structure for sys_operation_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."sys_operation_logs";
CREATE TABLE "public"."sys_operation_logs" (
  "id" int8 NOT NULL DEFAULT nextval('sys_operation_logs_id_seq'::regclass),
  "admin_id" int8,
  "admin_name" varchar(50) COLLATE "pg_catalog"."default",
  "module" varchar(50) COLLATE "pg_catalog"."default",
  "action" varchar(50) COLLATE "pg_catalog"."default",
  "method" varchar(10) COLLATE "pg_catalog"."default",
  "path" varchar(200) COLLATE "pg_catalog"."default",
  "ip" varchar(50) COLLATE "pg_catalog"."default",
  "user_agent" varchar(500) COLLATE "pg_catalog"."default",
  "params" text COLLATE "pg_catalog"."default",
  "result" text COLLATE "pg_catalog"."default",
  "status" int8,
  "duration" int8,
  "created_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of sys_operation_logs
-- ----------------------------

-- ----------------------------
-- Table structure for sys_role_menus
-- ----------------------------
DROP TABLE IF EXISTS "public"."sys_role_menus";
CREATE TABLE "public"."sys_role_menus" (
  "role_id" int8 NOT NULL,
  "menu_id" int8 NOT NULL
)
;

-- ----------------------------
-- Records of sys_role_menus
-- ----------------------------
INSERT INTO "public"."sys_role_menus" VALUES (8, 1);
INSERT INTO "public"."sys_role_menus" VALUES (8, 10);
INSERT INTO "public"."sys_role_menus" VALUES (8, 11);
INSERT INTO "public"."sys_role_menus" VALUES (8, 12);
INSERT INTO "public"."sys_role_menus" VALUES (8, 13);
INSERT INTO "public"."sys_role_menus" VALUES (8, 14);
INSERT INTO "public"."sys_role_menus" VALUES (8, 15);
INSERT INTO "public"."sys_role_menus" VALUES (8, 20);
INSERT INTO "public"."sys_role_menus" VALUES (8, 21);
INSERT INTO "public"."sys_role_menus" VALUES (8, 22);
INSERT INTO "public"."sys_role_menus" VALUES (8, 23);
INSERT INTO "public"."sys_role_menus" VALUES (8, 24);
INSERT INTO "public"."sys_role_menus" VALUES (8, 25);
INSERT INTO "public"."sys_role_menus" VALUES (8, 26);
INSERT INTO "public"."sys_role_menus" VALUES (8, 27);
INSERT INTO "public"."sys_role_menus" VALUES (8, 28);
INSERT INTO "public"."sys_role_menus" VALUES (8, 29);
INSERT INTO "public"."sys_role_menus" VALUES (8, 30);
INSERT INTO "public"."sys_role_menus" VALUES (8, 31);
INSERT INTO "public"."sys_role_menus" VALUES (8, 32);
INSERT INTO "public"."sys_role_menus" VALUES (8, 33);
INSERT INTO "public"."sys_role_menus" VALUES (8, 34);
INSERT INTO "public"."sys_role_menus" VALUES (8, 35);
INSERT INTO "public"."sys_role_menus" VALUES (8, 36);
INSERT INTO "public"."sys_role_menus" VALUES (8, 37);
INSERT INTO "public"."sys_role_menus" VALUES (8, 38);
INSERT INTO "public"."sys_role_menus" VALUES (8, 39);
INSERT INTO "public"."sys_role_menus" VALUES (8, 40);
INSERT INTO "public"."sys_role_menus" VALUES (8, 41);
INSERT INTO "public"."sys_role_menus" VALUES (8, 42);
INSERT INTO "public"."sys_role_menus" VALUES (8, 43);
INSERT INTO "public"."sys_role_menus" VALUES (8, 44);
INSERT INTO "public"."sys_role_menus" VALUES (8, 45);
INSERT INTO "public"."sys_role_menus" VALUES (8, 46);
INSERT INTO "public"."sys_role_menus" VALUES (8, 47);
INSERT INTO "public"."sys_role_menus" VALUES (8, 48);
INSERT INTO "public"."sys_role_menus" VALUES (8, 49);
INSERT INTO "public"."sys_role_menus" VALUES (8, 50);
INSERT INTO "public"."sys_role_menus" VALUES (8, 51);
INSERT INTO "public"."sys_role_menus" VALUES (8, 52);
INSERT INTO "public"."sys_role_menus" VALUES (8, 53);
INSERT INTO "public"."sys_role_menus" VALUES (8, 54);
INSERT INTO "public"."sys_role_menus" VALUES (8, 55);
INSERT INTO "public"."sys_role_menus" VALUES (8, 60);
INSERT INTO "public"."sys_role_menus" VALUES (8, 61);
INSERT INTO "public"."sys_role_menus" VALUES (8, 62);
INSERT INTO "public"."sys_role_menus" VALUES (8, 63);
INSERT INTO "public"."sys_role_menus" VALUES (8, 64);
INSERT INTO "public"."sys_role_menus" VALUES (8, 70);
INSERT INTO "public"."sys_role_menus" VALUES (8, 71);
INSERT INTO "public"."sys_role_menus" VALUES (8, 72);
INSERT INTO "public"."sys_role_menus" VALUES (8, 73);
INSERT INTO "public"."sys_role_menus" VALUES (8, 74);
INSERT INTO "public"."sys_role_menus" VALUES (8, 75);
INSERT INTO "public"."sys_role_menus" VALUES (8, 76);
INSERT INTO "public"."sys_role_menus" VALUES (8, 77);
INSERT INTO "public"."sys_role_menus" VALUES (8, 78);
INSERT INTO "public"."sys_role_menus" VALUES (8, 80);
INSERT INTO "public"."sys_role_menus" VALUES (8, 81);
INSERT INTO "public"."sys_role_menus" VALUES (8, 82);
INSERT INTO "public"."sys_role_menus" VALUES (8, 83);
INSERT INTO "public"."sys_role_menus" VALUES (8, 90);
INSERT INTO "public"."sys_role_menus" VALUES (8, 91);
INSERT INTO "public"."sys_role_menus" VALUES (8, 92);
INSERT INTO "public"."sys_role_menus" VALUES (8, 93);
INSERT INTO "public"."sys_role_menus" VALUES (8, 94);
INSERT INTO "public"."sys_role_menus" VALUES (8, 95);
INSERT INTO "public"."sys_role_menus" VALUES (8, 96);
INSERT INTO "public"."sys_role_menus" VALUES (8, 97);
INSERT INTO "public"."sys_role_menus" VALUES (8, 98);
INSERT INTO "public"."sys_role_menus" VALUES (8, 99);
INSERT INTO "public"."sys_role_menus" VALUES (8, 100);
INSERT INTO "public"."sys_role_menus" VALUES (8, 101);
INSERT INTO "public"."sys_role_menus" VALUES (8, 110);
INSERT INTO "public"."sys_role_menus" VALUES (8, 111);
INSERT INTO "public"."sys_role_menus" VALUES (8, 120);
INSERT INTO "public"."sys_role_menus" VALUES (1, 134);
INSERT INTO "public"."sys_role_menus" VALUES (1, 136);
INSERT INTO "public"."sys_role_menus" VALUES (1, 135);
INSERT INTO "public"."sys_role_menus" VALUES (1, 137);
INSERT INTO "public"."sys_role_menus" VALUES (1, 1);
INSERT INTO "public"."sys_role_menus" VALUES (1, 10);
INSERT INTO "public"."sys_role_menus" VALUES (1, 11);
INSERT INTO "public"."sys_role_menus" VALUES (1, 12);
INSERT INTO "public"."sys_role_menus" VALUES (1, 13);
INSERT INTO "public"."sys_role_menus" VALUES (1, 14);
INSERT INTO "public"."sys_role_menus" VALUES (1, 15);
INSERT INTO "public"."sys_role_menus" VALUES (1, 16);
INSERT INTO "public"."sys_role_menus" VALUES (1, 17);
INSERT INTO "public"."sys_role_menus" VALUES (1, 18);
INSERT INTO "public"."sys_role_menus" VALUES (1, 19);
INSERT INTO "public"."sys_role_menus" VALUES (1, 20);
INSERT INTO "public"."sys_role_menus" VALUES (1, 21);
INSERT INTO "public"."sys_role_menus" VALUES (1, 22);
INSERT INTO "public"."sys_role_menus" VALUES (1, 23);
INSERT INTO "public"."sys_role_menus" VALUES (1, 24);
INSERT INTO "public"."sys_role_menus" VALUES (1, 25);
INSERT INTO "public"."sys_role_menus" VALUES (1, 26);
INSERT INTO "public"."sys_role_menus" VALUES (1, 27);
INSERT INTO "public"."sys_role_menus" VALUES (1, 28);
INSERT INTO "public"."sys_role_menus" VALUES (1, 29);
INSERT INTO "public"."sys_role_menus" VALUES (1, 30);
INSERT INTO "public"."sys_role_menus" VALUES (1, 31);
INSERT INTO "public"."sys_role_menus" VALUES (1, 32);
INSERT INTO "public"."sys_role_menus" VALUES (1, 33);
INSERT INTO "public"."sys_role_menus" VALUES (1, 34);
INSERT INTO "public"."sys_role_menus" VALUES (1, 35);
INSERT INTO "public"."sys_role_menus" VALUES (1, 36);
INSERT INTO "public"."sys_role_menus" VALUES (1, 37);
INSERT INTO "public"."sys_role_menus" VALUES (1, 38);
INSERT INTO "public"."sys_role_menus" VALUES (1, 39);
INSERT INTO "public"."sys_role_menus" VALUES (1, 40);
INSERT INTO "public"."sys_role_menus" VALUES (1, 41);
INSERT INTO "public"."sys_role_menus" VALUES (1, 42);
INSERT INTO "public"."sys_role_menus" VALUES (1, 43);
INSERT INTO "public"."sys_role_menus" VALUES (1, 44);
INSERT INTO "public"."sys_role_menus" VALUES (1, 45);
INSERT INTO "public"."sys_role_menus" VALUES (1, 46);
INSERT INTO "public"."sys_role_menus" VALUES (1, 47);
INSERT INTO "public"."sys_role_menus" VALUES (1, 48);
INSERT INTO "public"."sys_role_menus" VALUES (1, 49);
INSERT INTO "public"."sys_role_menus" VALUES (1, 50);
INSERT INTO "public"."sys_role_menus" VALUES (1, 51);
INSERT INTO "public"."sys_role_menus" VALUES (1, 52);
INSERT INTO "public"."sys_role_menus" VALUES (1, 53);
INSERT INTO "public"."sys_role_menus" VALUES (1, 54);
INSERT INTO "public"."sys_role_menus" VALUES (1, 55);
INSERT INTO "public"."sys_role_menus" VALUES (1, 60);
INSERT INTO "public"."sys_role_menus" VALUES (1, 61);
INSERT INTO "public"."sys_role_menus" VALUES (1, 62);
INSERT INTO "public"."sys_role_menus" VALUES (1, 63);
INSERT INTO "public"."sys_role_menus" VALUES (1, 64);
INSERT INTO "public"."sys_role_menus" VALUES (1, 70);
INSERT INTO "public"."sys_role_menus" VALUES (1, 71);
INSERT INTO "public"."sys_role_menus" VALUES (1, 72);
INSERT INTO "public"."sys_role_menus" VALUES (1, 73);
INSERT INTO "public"."sys_role_menus" VALUES (1, 74);
INSERT INTO "public"."sys_role_menus" VALUES (1, 75);
INSERT INTO "public"."sys_role_menus" VALUES (1, 76);
INSERT INTO "public"."sys_role_menus" VALUES (1, 77);
INSERT INTO "public"."sys_role_menus" VALUES (1, 78);
INSERT INTO "public"."sys_role_menus" VALUES (1, 80);
INSERT INTO "public"."sys_role_menus" VALUES (1, 81);
INSERT INTO "public"."sys_role_menus" VALUES (1, 82);
INSERT INTO "public"."sys_role_menus" VALUES (1, 83);
INSERT INTO "public"."sys_role_menus" VALUES (1, 90);
INSERT INTO "public"."sys_role_menus" VALUES (1, 91);
INSERT INTO "public"."sys_role_menus" VALUES (1, 92);
INSERT INTO "public"."sys_role_menus" VALUES (1, 93);
INSERT INTO "public"."sys_role_menus" VALUES (1, 94);
INSERT INTO "public"."sys_role_menus" VALUES (1, 95);
INSERT INTO "public"."sys_role_menus" VALUES (1, 96);
INSERT INTO "public"."sys_role_menus" VALUES (1, 97);
INSERT INTO "public"."sys_role_menus" VALUES (1, 98);
INSERT INTO "public"."sys_role_menus" VALUES (1, 99);
INSERT INTO "public"."sys_role_menus" VALUES (1, 100);
INSERT INTO "public"."sys_role_menus" VALUES (1, 101);
INSERT INTO "public"."sys_role_menus" VALUES (1, 110);
INSERT INTO "public"."sys_role_menus" VALUES (1, 111);
INSERT INTO "public"."sys_role_menus" VALUES (1, 120);
INSERT INTO "public"."sys_role_menus" VALUES (1, 121);
INSERT INTO "public"."sys_role_menus" VALUES (1, 122);
INSERT INTO "public"."sys_role_menus" VALUES (1, 123);
INSERT INTO "public"."sys_role_menus" VALUES (1, 124);
INSERT INTO "public"."sys_role_menus" VALUES (1, 125);
INSERT INTO "public"."sys_role_menus" VALUES (1, 126);
INSERT INTO "public"."sys_role_menus" VALUES (1, 127);
INSERT INTO "public"."sys_role_menus" VALUES (1, 128);
INSERT INTO "public"."sys_role_menus" VALUES (1, 129);
INSERT INTO "public"."sys_role_menus" VALUES (1, 131);
INSERT INTO "public"."sys_role_menus" VALUES (1, 132);
INSERT INTO "public"."sys_role_menus" VALUES (1, 133);
INSERT INTO "public"."sys_role_menus" VALUES (1, 138);
INSERT INTO "public"."sys_role_menus" VALUES (1, 141);
INSERT INTO "public"."sys_role_menus" VALUES (8, 141);
INSERT INTO "public"."sys_role_menus" VALUES (1, 150);
INSERT INTO "public"."sys_role_menus" VALUES (1, 145);
INSERT INTO "public"."sys_role_menus" VALUES (1, 146);
INSERT INTO "public"."sys_role_menus" VALUES (1, 147);
INSERT INTO "public"."sys_role_menus" VALUES (1, 148);
INSERT INTO "public"."sys_role_menus" VALUES (2, 1);
INSERT INTO "public"."sys_role_menus" VALUES (2, 10);
INSERT INTO "public"."sys_role_menus" VALUES (2, 11);
INSERT INTO "public"."sys_role_menus" VALUES (2, 12);
INSERT INTO "public"."sys_role_menus" VALUES (2, 15);
INSERT INTO "public"."sys_role_menus" VALUES (2, 20);
INSERT INTO "public"."sys_role_menus" VALUES (2, 21);
INSERT INTO "public"."sys_role_menus" VALUES (2, 22);
INSERT INTO "public"."sys_role_menus" VALUES (2, 23);
INSERT INTO "public"."sys_role_menus" VALUES (2, 24);
INSERT INTO "public"."sys_role_menus" VALUES (2, 25);
INSERT INTO "public"."sys_role_menus" VALUES (2, 26);
INSERT INTO "public"."sys_role_menus" VALUES (2, 27);
INSERT INTO "public"."sys_role_menus" VALUES (2, 28);
INSERT INTO "public"."sys_role_menus" VALUES (2, 29);
INSERT INTO "public"."sys_role_menus" VALUES (2, 30);
INSERT INTO "public"."sys_role_menus" VALUES (2, 31);
INSERT INTO "public"."sys_role_menus" VALUES (2, 32);
INSERT INTO "public"."sys_role_menus" VALUES (2, 33);
INSERT INTO "public"."sys_role_menus" VALUES (2, 34);
INSERT INTO "public"."sys_role_menus" VALUES (2, 35);
INSERT INTO "public"."sys_role_menus" VALUES (2, 40);
INSERT INTO "public"."sys_role_menus" VALUES (2, 41);
INSERT INTO "public"."sys_role_menus" VALUES (2, 42);
INSERT INTO "public"."sys_role_menus" VALUES (2, 43);
INSERT INTO "public"."sys_role_menus" VALUES (2, 44);
INSERT INTO "public"."sys_role_menus" VALUES (2, 45);
INSERT INTO "public"."sys_role_menus" VALUES (2, 50);
INSERT INTO "public"."sys_role_menus" VALUES (2, 51);
INSERT INTO "public"."sys_role_menus" VALUES (2, 52);
INSERT INTO "public"."sys_role_menus" VALUES (2, 53);
INSERT INTO "public"."sys_role_menus" VALUES (2, 55);
INSERT INTO "public"."sys_role_menus" VALUES (2, 80);
INSERT INTO "public"."sys_role_menus" VALUES (2, 81);
INSERT INTO "public"."sys_role_menus" VALUES (3, 1);
INSERT INTO "public"."sys_role_menus" VALUES (3, 10);
INSERT INTO "public"."sys_role_menus" VALUES (3, 11);
INSERT INTO "public"."sys_role_menus" VALUES (3, 12);
INSERT INTO "public"."sys_role_menus" VALUES (3, 20);
INSERT INTO "public"."sys_role_menus" VALUES (3, 21);
INSERT INTO "public"."sys_role_menus" VALUES (3, 22);
INSERT INTO "public"."sys_role_menus" VALUES (3, 26);
INSERT INTO "public"."sys_role_menus" VALUES (3, 27);
INSERT INTO "public"."sys_role_menus" VALUES (3, 31);
INSERT INTO "public"."sys_role_menus" VALUES (3, 32);
INSERT INTO "public"."sys_role_menus" VALUES (3, 36);
INSERT INTO "public"."sys_role_menus" VALUES (3, 37);
INSERT INTO "public"."sys_role_menus" VALUES (3, 38);
INSERT INTO "public"."sys_role_menus" VALUES (3, 39);
INSERT INTO "public"."sys_role_menus" VALUES (3, 40);
INSERT INTO "public"."sys_role_menus" VALUES (3, 46);
INSERT INTO "public"."sys_role_menus" VALUES (3, 47);
INSERT INTO "public"."sys_role_menus" VALUES (3, 48);
INSERT INTO "public"."sys_role_menus" VALUES (3, 49);
INSERT INTO "public"."sys_role_menus" VALUES (3, 60);
INSERT INTO "public"."sys_role_menus" VALUES (3, 61);
INSERT INTO "public"."sys_role_menus" VALUES (3, 62);
INSERT INTO "public"."sys_role_menus" VALUES (3, 63);
INSERT INTO "public"."sys_role_menus" VALUES (3, 64);
INSERT INTO "public"."sys_role_menus" VALUES (3, 80);
INSERT INTO "public"."sys_role_menus" VALUES (3, 81);
INSERT INTO "public"."sys_role_menus" VALUES (3, 82);
INSERT INTO "public"."sys_role_menus" VALUES (3, 83);
INSERT INTO "public"."sys_role_menus" VALUES (4, 1);
INSERT INTO "public"."sys_role_menus" VALUES (4, 10);
INSERT INTO "public"."sys_role_menus" VALUES (4, 11);
INSERT INTO "public"."sys_role_menus" VALUES (4, 12);
INSERT INTO "public"."sys_role_menus" VALUES (4, 50);
INSERT INTO "public"."sys_role_menus" VALUES (4, 51);
INSERT INTO "public"."sys_role_menus" VALUES (4, 52);
INSERT INTO "public"."sys_role_menus" VALUES (4, 70);
INSERT INTO "public"."sys_role_menus" VALUES (4, 71);
INSERT INTO "public"."sys_role_menus" VALUES (4, 72);
INSERT INTO "public"."sys_role_menus" VALUES (4, 73);
INSERT INTO "public"."sys_role_menus" VALUES (4, 74);
INSERT INTO "public"."sys_role_menus" VALUES (4, 75);
INSERT INTO "public"."sys_role_menus" VALUES (4, 76);
INSERT INTO "public"."sys_role_menus" VALUES (4, 77);
INSERT INTO "public"."sys_role_menus" VALUES (4, 78);
INSERT INTO "public"."sys_role_menus" VALUES (5, 1);
INSERT INTO "public"."sys_role_menus" VALUES (5, 10);
INSERT INTO "public"."sys_role_menus" VALUES (5, 11);
INSERT INTO "public"."sys_role_menus" VALUES (5, 12);
INSERT INTO "public"."sys_role_menus" VALUES (5, 50);
INSERT INTO "public"."sys_role_menus" VALUES (5, 51);
INSERT INTO "public"."sys_role_menus" VALUES (5, 52);
INSERT INTO "public"."sys_role_menus" VALUES (5, 90);
INSERT INTO "public"."sys_role_menus" VALUES (5, 91);
INSERT INTO "public"."sys_role_menus" VALUES (5, 92);
INSERT INTO "public"."sys_role_menus" VALUES (5, 93);
INSERT INTO "public"."sys_role_menus" VALUES (5, 94);
INSERT INTO "public"."sys_role_menus" VALUES (5, 95);
INSERT INTO "public"."sys_role_menus" VALUES (5, 96);
INSERT INTO "public"."sys_role_menus" VALUES (5, 97);
INSERT INTO "public"."sys_role_menus" VALUES (5, 98);
INSERT INTO "public"."sys_role_menus" VALUES (5, 99);
INSERT INTO "public"."sys_role_menus" VALUES (6, 1);
INSERT INTO "public"."sys_role_menus" VALUES (6, 10);
INSERT INTO "public"."sys_role_menus" VALUES (6, 11);
INSERT INTO "public"."sys_role_menus" VALUES (6, 12);
INSERT INTO "public"."sys_role_menus" VALUES (6, 13);
INSERT INTO "public"."sys_role_menus" VALUES (6, 20);
INSERT INTO "public"."sys_role_menus" VALUES (6, 21);
INSERT INTO "public"."sys_role_menus" VALUES (6, 22);
INSERT INTO "public"."sys_role_menus" VALUES (6, 26);
INSERT INTO "public"."sys_role_menus" VALUES (6, 27);
INSERT INTO "public"."sys_role_menus" VALUES (6, 31);
INSERT INTO "public"."sys_role_menus" VALUES (6, 32);
INSERT INTO "public"."sys_role_menus" VALUES (6, 60);
INSERT INTO "public"."sys_role_menus" VALUES (6, 61);
INSERT INTO "public"."sys_role_menus" VALUES (6, 62);
INSERT INTO "public"."sys_role_menus" VALUES (6, 63);
INSERT INTO "public"."sys_role_menus" VALUES (6, 64);
INSERT INTO "public"."sys_role_menus" VALUES (6, 80);
INSERT INTO "public"."sys_role_menus" VALUES (6, 81);
INSERT INTO "public"."sys_role_menus" VALUES (7, 1);
INSERT INTO "public"."sys_role_menus" VALUES (7, 10);
INSERT INTO "public"."sys_role_menus" VALUES (7, 11);
INSERT INTO "public"."sys_role_menus" VALUES (7, 12);
INSERT INTO "public"."sys_role_menus" VALUES (7, 15);
INSERT INTO "public"."sys_role_menus" VALUES (7, 20);
INSERT INTO "public"."sys_role_menus" VALUES (7, 21);
INSERT INTO "public"."sys_role_menus" VALUES (7, 22);
INSERT INTO "public"."sys_role_menus" VALUES (7, 26);
INSERT INTO "public"."sys_role_menus" VALUES (7, 27);
INSERT INTO "public"."sys_role_menus" VALUES (7, 31);
INSERT INTO "public"."sys_role_menus" VALUES (7, 32);
INSERT INTO "public"."sys_role_menus" VALUES (7, 40);
INSERT INTO "public"."sys_role_menus" VALUES (7, 41);
INSERT INTO "public"."sys_role_menus" VALUES (7, 42);
INSERT INTO "public"."sys_role_menus" VALUES (7, 50);
INSERT INTO "public"."sys_role_menus" VALUES (7, 51);
INSERT INTO "public"."sys_role_menus" VALUES (7, 52);
INSERT INTO "public"."sys_role_menus" VALUES (7, 55);
INSERT INTO "public"."sys_role_menus" VALUES (7, 60);
INSERT INTO "public"."sys_role_menus" VALUES (7, 61);
INSERT INTO "public"."sys_role_menus" VALUES (7, 70);
INSERT INTO "public"."sys_role_menus" VALUES (7, 71);
INSERT INTO "public"."sys_role_menus" VALUES (7, 72);
INSERT INTO "public"."sys_role_menus" VALUES (7, 75);
INSERT INTO "public"."sys_role_menus" VALUES (7, 76);
INSERT INTO "public"."sys_role_menus" VALUES (7, 77);
INSERT INTO "public"."sys_role_menus" VALUES (7, 80);
INSERT INTO "public"."sys_role_menus" VALUES (7, 81);
INSERT INTO "public"."sys_role_menus" VALUES (7, 90);
INSERT INTO "public"."sys_role_menus" VALUES (7, 91);
INSERT INTO "public"."sys_role_menus" VALUES (7, 92);
INSERT INTO "public"."sys_role_menus" VALUES (7, 95);
INSERT INTO "public"."sys_role_menus" VALUES (7, 96);
INSERT INTO "public"."sys_role_menus" VALUES (7, 100);
INSERT INTO "public"."sys_role_menus" VALUES (7, 101);
INSERT INTO "public"."sys_role_menus" VALUES (1, 143);
INSERT INTO "public"."sys_role_menus" VALUES (1, 144);
INSERT INTO "public"."sys_role_menus" VALUES (8, 143);
INSERT INTO "public"."sys_role_menus" VALUES (8, 144);

-- ----------------------------
-- Table structure for sys_roles
-- ----------------------------
DROP TABLE IF EXISTS "public"."sys_roles";
CREATE TABLE "public"."sys_roles" (
  "id" int8 NOT NULL DEFAULT nextval('sys_roles_id_seq'::regclass),
  "name" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "key" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "remark" varchar(200) COLLATE "pg_catalog"."default",
  "sort" int8 DEFAULT 0,
  "status" int2 DEFAULT 1,
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of sys_roles
-- ----------------------------
INSERT INTO "public"."sys_roles" VALUES (1, '超级管理员', 'super_admin', '系统超级管理员，拥有所有权限', 0, 1, '2025-12-28 09:38:28.590278+00', '2025-12-28 09:38:28.590278+00');
INSERT INTO "public"."sys_roles" VALUES (2, '产品管理', 'product_manager', '负责产品数据维护、服务商/门店管理', 10, 1, '2025-12-28 09:38:28.596596+00', '2025-12-28 09:38:28.596596+00');
INSERT INTO "public"."sys_roles" VALUES (3, '运营管理', 'operations', '负责审核、内容管理、用户管理', 20, 1, '2025-12-28 09:38:28.602497+00', '2025-12-28 09:38:28.602497+00');
INSERT INTO "public"."sys_roles" VALUES (4, '财务管理', 'finance', '负责资金管理、交易审核', 30, 1, '2025-12-28 09:38:28.608445+00', '2025-12-28 09:38:28.608445+00');
INSERT INTO "public"."sys_roles" VALUES (5, '风控管理', 'risk', '负责风险预警、纠纷仲裁', 40, 1, '2025-12-28 09:38:28.614361+00', '2025-12-28 09:38:28.614361+00');
INSERT INTO "public"."sys_roles" VALUES (6, '客服', 'customer_service', '处理用户咨询、预约管理', 50, 1, '2025-12-28 09:38:28.620617+00', '2025-12-28 09:38:28.620617+00');
INSERT INTO "public"."sys_roles" VALUES (7, '只读用户', 'viewer', '数据分析、报表查看', 60, 1, '2025-12-28 09:38:28.626453+00', '2025-12-28 09:38:28.626453+00');
INSERT INTO "public"."sys_roles" VALUES (8, '管理员', 'admin', '系统管理员，拥有除超级管理员外的所有权限', 5, 1, '2025-12-28 12:43:50.92701+00', '2025-12-28 12:43:50.92701+00');

-- ----------------------------
-- Table structure for system_configs
-- ----------------------------
DROP TABLE IF EXISTS "public"."system_configs";
CREATE TABLE "public"."system_configs" (
  "id" int8 NOT NULL DEFAULT nextval('system_configs_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "key" varchar(50) COLLATE "pg_catalog"."default",
  "value" text COLLATE "pg_catalog"."default",
  "type" varchar(20) COLLATE "pg_catalog"."default" DEFAULT 'string'::character varying,
  "description" varchar(200) COLLATE "pg_catalog"."default",
  "editable" bool DEFAULT true
)
;

-- ----------------------------
-- Records of system_configs
-- ----------------------------
INSERT INTO "public"."system_configs" VALUES (1, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'fee.platform.intent_fee_rate', '0', 'number', '意向金抽成比例（0-1，默认0表示不抽成）', 't');
INSERT INTO "public"."system_configs" VALUES (2, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'fee.platform.design_fee_rate', '0.10', 'number', '设计费抽成比例（0-1，默认10%）', 't');
INSERT INTO "public"."system_configs" VALUES (3, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'fee.platform.construction_fee_rate', '0.10', 'number', '施工费抽成比例（0-1，默认10%）', 't');
INSERT INTO "public"."system_configs" VALUES (4, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'fee.platform.material_fee_rate', '0.05', 'number', '材料费抽成比例（0-1，默认5%）', 't');
INSERT INTO "public"."system_configs" VALUES (5, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'withdraw.min_amount', '100', 'number', '最小提现金额（元）', 't');
INSERT INTO "public"."system_configs" VALUES (6, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'withdraw.fee', '0', 'number', '提现手续费（元，固定金额）', 't');
INSERT INTO "public"."system_configs" VALUES (7, '2025-12-30 11:52:09.27108+00', '2025-12-30 11:52:09.27108+00', 'settlement.auto_days', '7', 'number', '自动结算天数（订单完成后多少天可提现）', 't');
INSERT INTO "public"."system_configs" VALUES (10, '2025-12-31 15:16:03.426552+00', '2025-12-31 15:30:39.455399+00', 'im.tencent_enabled', 'true', 'boolean', '是否启用腾讯云 IM', 't');
INSERT INTO "public"."system_configs" VALUES (8, '2025-12-31 15:16:03.426552+00', '2025-12-31 15:30:39.460188+00', 'im.tencent_sdk_app_id', '1600120547', 'string', '腾讯云 IM SDKAppID', 't');
INSERT INTO "public"."system_configs" VALUES (9, '2025-12-31 15:16:03.426552+00', '2025-12-31 15:30:39.482158+00', 'im.tencent_secret_key', '56210cab92b337ee8508bb084acc7fd97cb41b22b36256d6f828e09e66509abe', 'string', '腾讯云 IM SecretKey', 't');

-- ----------------------------
-- Table structure for system_dictionaries
-- ----------------------------
DROP TABLE IF EXISTS "public"."system_dictionaries";
CREATE TABLE "public"."system_dictionaries" (
  "id" int8 NOT NULL DEFAULT nextval('system_dictionaries_id_seq'::regclass),
  "category_code" varchar(50) COLLATE "pg_catalog"."default" NOT NULL,
  "value" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "label" varchar(100) COLLATE "pg_catalog"."default" NOT NULL,
  "description" text COLLATE "pg_catalog"."default",
  "sort_order" int4 DEFAULT 0,
  "enabled" bool DEFAULT true,
  "extra_data" jsonb,
  "parent_value" varchar(100) COLLATE "pg_catalog"."default",
  "created_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(6) DEFAULT CURRENT_TIMESTAMP
)
;
COMMENT ON COLUMN "public"."system_dictionaries"."category_code" IS '所属分类代码';
COMMENT ON COLUMN "public"."system_dictionaries"."value" IS '实际存储值，保持向后兼容';
COMMENT ON COLUMN "public"."system_dictionaries"."label" IS '前端显示文本';
COMMENT ON COLUMN "public"."system_dictionaries"."extra_data" IS '扩展字段，存储额外属性（JSONB格式）';
COMMENT ON COLUMN "public"."system_dictionaries"."parent_value" IS '父级值，支持多级字典';
COMMENT ON TABLE "public"."system_dictionaries" IS '数据字典值表';

-- ----------------------------
-- Records of system_dictionaries
-- ----------------------------
INSERT INTO "public"."system_dictionaries" VALUES (1, 'style', '现代简约', '现代简约', '简洁明快的现代设计风格', 1, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (2, 'style', '北欧风格', '北欧风格', '北欧简约自然风格', 2, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (3, 'style', '新中式', '新中式', '现代与中式结合的风格', 3, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (4, 'style', '轻奢风格', '轻奢风格', '低调奢华的设计风格', 4, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (5, 'style', '美式风格', '美式风格', '美式休闲舒适风格', 5, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (6, 'style', '欧式风格', '欧式风格', '欧式古典奢华风格', 6, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (7, 'style', '日式风格', '日式风格', '日式简约禅意风格', 7, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (8, 'style', '工业风格', '工业风格', '工业复古风格', 8, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (9, 'style', '法式风格', '法式风格', '法式浪漫优雅风格', 9, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (10, 'style', '地中海风格', '地中海风格', '地中海蓝白清新风格', 10, 't', NULL, NULL, '2026-01-05 12:20:00.803866', '2026-01-05 12:20:00.803866');
INSERT INTO "public"."system_dictionaries" VALUES (11, 'layout', '一室', '一室', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (12, 'layout', '一室一厅', '一室一厅', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (13, 'layout', '两室一厅', '两室一厅', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (14, 'layout', '两室两厅', '两室两厅', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (15, 'layout', '三室一厅', '三室一厅', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (16, 'layout', '三室两厅', '三室两厅', NULL, 6, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (17, 'layout', '四室及以上', '四室及以上', NULL, 7, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (18, 'layout', '复式', '复式', NULL, 8, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (19, 'layout', '别墅', '别墅', NULL, 9, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (20, 'layout', '其他', '其他', NULL, 99, 't', NULL, NULL, '2026-01-05 12:20:00.813449', '2026-01-05 12:20:00.813449');
INSERT INTO "public"."system_dictionaries" VALUES (21, 'budget_range', '5万以下', '5万以下', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.815449', '2026-01-05 12:20:00.815449');
INSERT INTO "public"."system_dictionaries" VALUES (22, 'budget_range', '5-10万', '5-10万', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.815449', '2026-01-05 12:20:00.815449');
INSERT INTO "public"."system_dictionaries" VALUES (23, 'budget_range', '10-15万', '10-15万', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.815449', '2026-01-05 12:20:00.815449');
INSERT INTO "public"."system_dictionaries" VALUES (24, 'budget_range', '15-20万', '15-20万', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.815449', '2026-01-05 12:20:00.815449');
INSERT INTO "public"."system_dictionaries" VALUES (25, 'budget_range', '20-30万', '20-30万', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.815449', '2026-01-05 12:20:00.815449');
INSERT INTO "public"."system_dictionaries" VALUES (27, 'renovation_type', '全包', '全包', '包工包料，全部交给装修公司', 1, 't', NULL, NULL, '2026-01-05 12:20:00.817635', '2026-01-05 12:20:00.817635');
INSERT INTO "public"."system_dictionaries" VALUES (28, 'renovation_type', '半包', '半包', '装修公司负责施工和辅料，业主自购主材', 2, 't', NULL, NULL, '2026-01-05 12:20:00.817635', '2026-01-05 12:20:00.817635');
INSERT INTO "public"."system_dictionaries" VALUES (29, 'renovation_type', '局部改造', '局部改造', '仅改造部分空间', 3, 't', NULL, NULL, '2026-01-05 12:20:00.817635', '2026-01-05 12:20:00.817635');
INSERT INTO "public"."system_dictionaries" VALUES (30, 'renovation_type', '软装设计', '软装设计', '仅提供软装设计服务', 4, 't', NULL, NULL, '2026-01-05 12:20:00.817635', '2026-01-05 12:20:00.817635');
INSERT INTO "public"."system_dictionaries" VALUES (31, 'work_type', 'mason', '瓦工', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.819516', '2026-01-05 12:20:00.819516');
INSERT INTO "public"."system_dictionaries" VALUES (32, 'work_type', 'electrician', '电工', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.819516', '2026-01-05 12:20:00.819516');
INSERT INTO "public"."system_dictionaries" VALUES (33, 'work_type', 'carpenter', '木工', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.819516', '2026-01-05 12:20:00.819516');
INSERT INTO "public"."system_dictionaries" VALUES (34, 'work_type', 'painter', '油漆工', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.819516', '2026-01-05 12:20:00.819516');
INSERT INTO "public"."system_dictionaries" VALUES (35, 'work_type', 'plumber', '水电工', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.819516', '2026-01-05 12:20:00.819516');
INSERT INTO "public"."system_dictionaries" VALUES (36, 'provider_sub_type', 'personal', '个人设计师', '独立设计师', 1, 't', NULL, NULL, '2026-01-05 12:20:00.821469', '2026-01-05 12:20:00.821469');
INSERT INTO "public"."system_dictionaries" VALUES (37, 'provider_sub_type', 'studio', '工作室', '设计工作室', 2, 't', NULL, NULL, '2026-01-05 12:20:00.821469', '2026-01-05 12:20:00.821469');
INSERT INTO "public"."system_dictionaries" VALUES (38, 'provider_sub_type', 'company', '装修公司', '正规装修公司', 3, 't', NULL, NULL, '2026-01-05 12:20:00.821469', '2026-01-05 12:20:00.821469');
INSERT INTO "public"."system_dictionaries" VALUES (55, 'phase_type', 'preparation', '准备阶段', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (56, 'phase_type', 'demolition', '拆除阶段', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (57, 'phase_type', 'electrical', '水电阶段', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (58, 'phase_type', 'masonry', '瓦工阶段', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (59, 'phase_type', 'painting', '油漆阶段', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (60, 'phase_type', 'installation', '安装阶段', NULL, 6, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (61, 'phase_type', 'inspection', '验收阶段', NULL, 7, 't', NULL, NULL, '2026-01-05 12:20:00.827531', '2026-01-05 12:20:00.827531');
INSERT INTO "public"."system_dictionaries" VALUES (62, 'material_category', '瓷砖', '瓷砖', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (63, 'material_category', '地板', '地板', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (64, 'material_category', '卫浴', '卫浴', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (65, 'material_category', '橱柜', '橱柜', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (66, 'material_category', '门窗', '门窗', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (67, 'material_category', '灯具', '灯具', NULL, 6, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (68, 'material_category', '五金', '五金', NULL, 7, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (69, 'material_category', '涂料', '涂料', NULL, 8, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (70, 'material_category', '壁纸', '壁纸', NULL, 9, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (71, 'material_category', '家具', '家具', NULL, 10, 't', NULL, NULL, '2026-01-05 12:20:00.829542', '2026-01-05 12:20:00.829542');
INSERT INTO "public"."system_dictionaries" VALUES (72, 'review_tag', '专业', '专业', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (73, 'review_tag', '守时', '守时', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (74, 'review_tag', '沟通好', '沟通好', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (75, 'review_tag', '价格合理', '价格合理', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (76, 'review_tag', '质量好', '质量好', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (77, 'review_tag', '服务态度好', '服务态度好', NULL, 6, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (78, 'review_tag', '设计感强', '设计感强', NULL, 7, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (79, 'review_tag', '施工规范', '施工规范', NULL, 8, 't', NULL, NULL, '2026-01-05 12:20:00.83143', '2026-01-05 12:20:00.83143');
INSERT INTO "public"."system_dictionaries" VALUES (80, 'certification_type', '一级资质', '一级资质', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.837423', '2026-01-05 12:20:00.837423');
INSERT INTO "public"."system_dictionaries" VALUES (81, 'certification_type', '二级资质', '二级资质', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.837423', '2026-01-05 12:20:00.837423');
INSERT INTO "public"."system_dictionaries" VALUES (82, 'certification_type', '三级资质', '三级资质', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.837423', '2026-01-05 12:20:00.837423');
INSERT INTO "public"."system_dictionaries" VALUES (83, 'certification_type', '设计甲级', '设计甲级', NULL, 4, 't', NULL, NULL, '2026-01-05 12:20:00.837423', '2026-01-05 12:20:00.837423');
INSERT INTO "public"."system_dictionaries" VALUES (84, 'certification_type', '设计乙级', '设计乙级', NULL, 5, 't', NULL, NULL, '2026-01-05 12:20:00.837423', '2026-01-05 12:20:00.837423');
INSERT INTO "public"."system_dictionaries" VALUES (85, 'certification_type', 'ISO认证', 'ISO认证', NULL, 6, 't', NULL, NULL, '2026-01-05 12:20:00.837423', '2026-01-05 12:20:00.837423');
INSERT INTO "public"."system_dictionaries" VALUES (86, 'after_sales_type', 'refund', '退款', NULL, 1, 't', NULL, NULL, '2026-01-05 12:20:00.839476', '2026-01-05 12:20:00.839476');
INSERT INTO "public"."system_dictionaries" VALUES (87, 'after_sales_type', 'complaint', '投诉', NULL, 2, 't', NULL, NULL, '2026-01-05 12:20:00.839476', '2026-01-05 12:20:00.839476');
INSERT INTO "public"."system_dictionaries" VALUES (88, 'after_sales_type', 'repair', '返修', NULL, 3, 't', NULL, NULL, '2026-01-05 12:20:00.839476', '2026-01-05 12:20:00.839476');
INSERT INTO "public"."system_dictionaries" VALUES (26, 'budget_range', '30-50万', '30-50万', '', 6, 't', NULL, '', '2026-01-05 12:20:00.815449', '2026-01-06 06:48:28.685699');
INSERT INTO "public"."system_dictionaries" VALUES (89, 'budget_range', '50万以上', '50万以上', '', 7, 't', NULL, '', '2026-01-06 06:48:42.235879', '2026-01-06 06:48:42.235879');
INSERT INTO "public"."system_dictionaries" VALUES (90, 'service_area', '雁塔区', '雁塔区', NULL, 1, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (91, 'service_area', '碑林区', '碑林区', NULL, 2, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (92, 'service_area', '莲湖区', '莲湖区', NULL, 3, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (93, 'service_area', '新城区', '新城区', NULL, 4, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (94, 'service_area', '未央区', '未央区', NULL, 5, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (95, 'service_area', '灞桥区', '灞桥区', NULL, 6, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (96, 'service_area', '长安区', '长安区', NULL, 7, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (97, 'service_area', '高新区', '高新区', NULL, 8, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (98, 'service_area', '曲江新区', '曲江新区', NULL, 9, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (99, 'service_area', '经开区', '经开区', NULL, 10, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (100, 'service_area', '浐灞生态区', '浐灞生态区', NULL, 11, 't', NULL, NULL, '2026-01-06 07:40:14.762531', '2026-01-06 07:40:14.762531');
INSERT INTO "public"."system_dictionaries" VALUES (101, 'style', '叙利亚风格', '叙利亚风格', '', 11, 't', NULL, '', '2026-01-06 12:15:31.031302', '2026-01-06 12:15:31.031302');

-- ----------------------------
-- Table structure for system_settings
-- ----------------------------
DROP TABLE IF EXISTS "public"."system_settings";
CREATE TABLE "public"."system_settings" (
  "id" int8 NOT NULL DEFAULT nextval('system_settings_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "key" varchar(100) COLLATE "pg_catalog"."default",
  "value" text COLLATE "pg_catalog"."default",
  "description" varchar(200) COLLATE "pg_catalog"."default",
  "category" varchar(50) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of system_settings
-- ----------------------------
INSERT INTO "public"."system_settings" VALUES (58, '2025-12-30 15:30:45.358448+00', '2025-12-31 10:17:50.663983+00', 'im_tencent_enabled', 'true', '是否启用腾讯云IM', 'im');
INSERT INTO "public"."system_settings" VALUES (59, '2025-12-30 15:30:45.358448+00', '2025-12-31 10:17:50.667563+00', 'im_tencent_sdk_app_id', '1600120547', '腾讯云IM SDKAppID', 'im');
INSERT INTO "public"."system_settings" VALUES (60, '2025-12-30 15:30:45.358448+00', '2025-12-31 10:17:50.671595+00', 'im_tencent_secret_key', '56210cab92b337ee8508bb084acc7fd97cb41b22b36256d6f828e09e66509abe', '腾讯云IM SecretKey', 'im');
INSERT INTO "public"."system_settings" VALUES (44, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'enable_registration', 'true', '是否允许用户注册', 'security');
INSERT INTO "public"."system_settings" VALUES (45, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'enable_sms_verify', 'true', '是否开启短信验证', 'security');
INSERT INTO "public"."system_settings" VALUES (46, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'enable_email_verify', 'false', '是否开启邮箱验证', 'security');
INSERT INTO "public"."system_settings" VALUES (47, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'wechat_app_id', '', '微信支付AppID', 'payment');
INSERT INTO "public"."system_settings" VALUES (48, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'wechat_mch_id', '', '微信支付商户号', 'payment');
INSERT INTO "public"."system_settings" VALUES (49, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'wechat_api_key', '', '微信支付API密钥', 'payment');
INSERT INTO "public"."system_settings" VALUES (50, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'alipay_app_id', '', '支付宝AppID', 'payment');
INSERT INTO "public"."system_settings" VALUES (51, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'alipay_private_key', '', '支付宝应用私钥', 'payment');
INSERT INTO "public"."system_settings" VALUES (52, '2025-12-30 15:30:45.358448+00', '2025-12-30 15:30:45.358448+00', 'alipay_public_key', '', '支付宝公钥', 'payment');
INSERT INTO "public"."system_settings" VALUES (39, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.433896+00', 'site_name', '家装管理平台', '网站名称', 'basic');
INSERT INTO "public"."system_settings" VALUES (40, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.437772+00', 'site_description', '专业的家装服务管理系统', '网站描述', 'basic');
INSERT INTO "public"."system_settings" VALUES (53, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.441971+00', 'sms_provider', '', '短信服务商', 'sms');
INSERT INTO "public"."system_settings" VALUES (54, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.446344+00', 'sms_access_key', '', '短信服务AccessKey', 'sms');
INSERT INTO "public"."system_settings" VALUES (57, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.449762+00', 'sms_template_id', '', '短信模板ID', 'sms');
INSERT INTO "public"."system_settings" VALUES (41, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.463775+00', 'contact_email', 'support@example.com', '联系邮箱', 'basic');
INSERT INTO "public"."system_settings" VALUES (42, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.467876+00', 'contact_phone', '400-888-8888', '联系电话', 'basic');
INSERT INTO "public"."system_settings" VALUES (43, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.471964+00', 'icp', '京ICP备12345678号', 'ICP备案号', 'basic');
INSERT INTO "public"."system_settings" VALUES (55, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.47647+00', 'sms_secret_key', '', '短信服务SecretKey', 'sms');
INSERT INTO "public"."system_settings" VALUES (56, '2025-12-30 15:30:45.358448+00', '2025-12-31 15:30:39.479587+00', 'sms_sign_name', '', '短信签名', 'sms');

-- ----------------------------
-- Table structure for transactions
-- ----------------------------
DROP TABLE IF EXISTS "public"."transactions";
CREATE TABLE "public"."transactions" (
  "id" int8 NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "escrow_id" int8,
  "milestone_id" int8,
  "type" varchar(20) COLLATE "pg_catalog"."default",
  "amount" numeric,
  "from_user_id" int8,
  "to_user_id" int8,
  "status" int2 DEFAULT 0,
  "completed_at" timestamptz(6),
  "order_id" varchar(50) COLLATE "pg_catalog"."default",
  "from_account" varchar(200) COLLATE "pg_catalog"."default",
  "to_account" varchar(200) COLLATE "pg_catalog"."default",
  "remark" text COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of transactions
-- ----------------------------

-- ----------------------------
-- Table structure for user_favorites
-- ----------------------------
DROP TABLE IF EXISTS "public"."user_favorites";
CREATE TABLE "public"."user_favorites" (
  "id" int8 NOT NULL DEFAULT nextval('user_favorites_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "target_id" int8,
  "target_type" varchar(20) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of user_favorites
-- ----------------------------

-- ----------------------------
-- Table structure for user_follows
-- ----------------------------
DROP TABLE IF EXISTS "public"."user_follows";
CREATE TABLE "public"."user_follows" (
  "id" int8 NOT NULL DEFAULT nextval('user_follows_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "target_id" int8,
  "target_type" varchar(20) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of user_follows
-- ----------------------------

-- ----------------------------
-- Table structure for user_wechat_bindings
-- ----------------------------
DROP TABLE IF EXISTS "public"."user_wechat_bindings";
CREATE TABLE "public"."user_wechat_bindings" (
  "id" int8 NOT NULL DEFAULT nextval('user_wechat_bindings_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "app_id" varchar(64) COLLATE "pg_catalog"."default",
  "open_id" varchar(128) COLLATE "pg_catalog"."default",
  "union_id" varchar(128) COLLATE "pg_catalog"."default",
  "bound_at" timestamptz(6),
  "last_login_at" timestamptz(6)
)
;

-- ----------------------------
-- Records of user_wechat_bindings
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS "public"."users";
CREATE TABLE "public"."users" (
  "id" int8 NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "phone" varchar(20) COLLATE "pg_catalog"."default",
  "nickname" varchar(50) COLLATE "pg_catalog"."default",
  "avatar" varchar(500) COLLATE "pg_catalog"."default",
  "password" varchar(255) COLLATE "pg_catalog"."default",
  "user_type" int2,
  "status" int2 DEFAULT 1,
  "login_failed_count" int8 DEFAULT 0,
  "locked_until" timestamptz(6),
  "last_failed_login_at" timestamptz(6)
)
;
COMMENT ON COLUMN "public"."users"."login_failed_count" IS '登录失败次数';
COMMENT ON COLUMN "public"."users"."locked_until" IS '锁定到期时间';
COMMENT ON COLUMN "public"."users"."last_failed_login_at" IS '最后失败登录时间';

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO "public"."users" VALUES (1, '2025-12-19 03:41:53.855212+00', '2025-12-19 03:41:53.855212+00', '13800138000', '用户8000', '', '', 1, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (2, '2025-12-26 15:19:32.956141+00', '2025-12-26 15:19:32.956141+00', '13800138001', '用户8001', '', '', 1, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (3, '2025-12-30 11:55:33.158708+00', '2025-12-30 11:55:33.158708+00', '13900139001', '金牌设计师', '', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90001, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13800000001', '张明远', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90002, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13800000002', '李雅婷', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90003, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13800000003', '王建国', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90005, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13800000005', '刘伟强', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90006, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13800000006', '周晓燕', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90012, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13900000002', '张电工', 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=200', '', 3, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90004, '2025-12-22 06:50:31.272993+00', '2026-01-06 11:30:12.811359+00', '13800000004', '陈思琪', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90021, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13700000001', '匠心装修', 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90022, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13700000002', '鑫盛建筑', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=200', '', 2, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90011, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13900000001', '李胜利', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200', '', 3, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90013, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13900000003', '王思源', 'https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=200', '', 3, 1, 0, NULL, NULL);
INSERT INTO "public"."users" VALUES (90014, '2025-12-22 06:50:31.272993+00', '2025-12-22 06:50:31.272993+00', '13900000004', '刘进步', 'https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=200', '', 3, 1, 0, NULL, NULL);

-- ----------------------------
-- Table structure for work_logs
-- ----------------------------
DROP TABLE IF EXISTS "public"."work_logs";
CREATE TABLE "public"."work_logs" (
  "id" int8 NOT NULL DEFAULT nextval('work_logs_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "project_id" int8,
  "worker_id" int8,
  "log_date" date,
  "description" text COLLATE "pg_catalog"."default",
  "photos" jsonb,
  "ai_analysis" jsonb,
  "is_compliant" bool,
  "issues" jsonb,
  "phase_id" int8,
  "created_by" int8,
  "title" varchar(100) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of work_logs
-- ----------------------------

-- ----------------------------
-- Table structure for workers
-- ----------------------------
DROP TABLE IF EXISTS "public"."workers";
CREATE TABLE "public"."workers" (
  "id" int8 NOT NULL DEFAULT nextval('workers_id_seq'::regclass),
  "created_at" timestamptz(6),
  "updated_at" timestamptz(6),
  "user_id" int8,
  "skill_type" varchar(50) COLLATE "pg_catalog"."default",
  "origin" varchar(50) COLLATE "pg_catalog"."default",
  "cert_water" bool,
  "cert_height" bool,
  "hourly_rate" numeric,
  "insured" bool,
  "latitude" numeric,
  "longitude" numeric,
  "available" bool DEFAULT true
)
;

-- ----------------------------
-- Records of workers
-- ----------------------------

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."admin_logs_id_seq"
OWNED BY "public"."admin_logs"."id";
SELECT setval('"public"."admin_logs_id_seq"', 101, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."admins_id_seq"
OWNED BY "public"."admins"."id";
SELECT setval('"public"."admins_id_seq"', 5, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."after_sales_id_seq"
OWNED BY "public"."after_sales"."id";
SELECT setval('"public"."after_sales_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."arbitrations_id_seq"
OWNED BY "public"."arbitrations"."id";
SELECT setval('"public"."arbitrations_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."audit_logs_id_seq"
OWNED BY "public"."audit_logs"."id";
SELECT setval('"public"."audit_logs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."bookings_id_seq"
OWNED BY "public"."bookings"."id";
SELECT setval('"public"."bookings_id_seq"', 5, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."case_audits_id_seq"
OWNED BY "public"."case_audits"."id";
SELECT setval('"public"."case_audits_id_seq"', 8, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."chat_messages_id_seq"
OWNED BY "public"."chat_messages"."id";
SELECT setval('"public"."chat_messages_id_seq"', 20, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."dictionary_categories_id_seq"
OWNED BY "public"."dictionary_categories"."id";
SELECT setval('"public"."dictionary_categories_id_seq"', 12, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."escrow_accounts_id_seq"
OWNED BY "public"."escrow_accounts"."id";
SELECT setval('"public"."escrow_accounts_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."material_shop_audits_id_seq"
OWNED BY "public"."material_shop_audits"."id";
SELECT setval('"public"."material_shop_audits_id_seq"', 2, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."material_shops_id_seq"
OWNED BY "public"."material_shops"."id";
SELECT setval('"public"."material_shops_id_seq"', 66, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."merchant_applications_id_seq"
OWNED BY "public"."merchant_applications"."id";
SELECT setval('"public"."merchant_applications_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."merchant_bank_accounts_id_seq"
OWNED BY "public"."merchant_bank_accounts"."id";
SELECT setval('"public"."merchant_bank_accounts_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."merchant_incomes_id_seq"
OWNED BY "public"."merchant_incomes"."id";
SELECT setval('"public"."merchant_incomes_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."merchant_service_settings_id_seq"
OWNED BY "public"."merchant_service_settings"."id";
SELECT setval('"public"."merchant_service_settings_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."merchant_withdraws_id_seq"
OWNED BY "public"."merchant_withdraws"."id";
SELECT setval('"public"."merchant_withdraws_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."milestones_id_seq"
OWNED BY "public"."milestones"."id";
SELECT setval('"public"."milestones_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."notifications_id_seq"
OWNED BY "public"."notifications"."id";
SELECT setval('"public"."notifications_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."orders_id_seq"
OWNED BY "public"."orders"."id";
SELECT setval('"public"."orders_id_seq"', 5, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."payment_plans_id_seq"
OWNED BY "public"."payment_plans"."id";
SELECT setval('"public"."payment_plans_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."phase_tasks_id_seq"
OWNED BY "public"."phase_tasks"."id";
SELECT setval('"public"."phase_tasks_id_seq"', 20, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."project_phases_id_seq"
OWNED BY "public"."project_phases"."id";
SELECT setval('"public"."project_phases_id_seq"', 7, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."projects_id_seq"
OWNED BY "public"."projects"."id";
SELECT setval('"public"."projects_id_seq"', 3, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."proposals_id_seq"
OWNED BY "public"."proposals"."id";
SELECT setval('"public"."proposals_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."provider_audits_id_seq"
OWNED BY "public"."provider_audits"."id";
SELECT setval('"public"."provider_audits_id_seq"', 3, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."provider_cases_id_seq"
OWNED BY "public"."provider_cases"."id";
SELECT setval('"public"."provider_cases_id_seq"', 36, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."provider_reviews_id_seq"
OWNED BY "public"."provider_reviews"."id";
SELECT setval('"public"."provider_reviews_id_seq"', 54, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."providers_id_seq"
OWNED BY "public"."providers"."id";
SELECT setval('"public"."providers_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."regions_id_seq"
OWNED BY "public"."regions"."id";
SELECT setval('"public"."regions_id_seq"', 118, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."risk_warnings_id_seq"
OWNED BY "public"."risk_warnings"."id";
SELECT setval('"public"."risk_warnings_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_admins_id_seq"
OWNED BY "public"."sys_admins"."id";
SELECT setval('"public"."sys_admins_id_seq"', 20, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_menus_id_seq"
OWNED BY "public"."sys_menus"."id";
SELECT setval('"public"."sys_menus_id_seq"', 149, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_operation_logs_id_seq"
OWNED BY "public"."sys_operation_logs"."id";
SELECT setval('"public"."sys_operation_logs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."sys_roles_id_seq"
OWNED BY "public"."sys_roles"."id";
SELECT setval('"public"."sys_roles_id_seq"', 1, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."system_configs_id_seq"
OWNED BY "public"."system_configs"."id";
SELECT setval('"public"."system_configs_id_seq"', 10, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."system_dictionaries_id_seq"
OWNED BY "public"."system_dictionaries"."id";
SELECT setval('"public"."system_dictionaries_id_seq"', 101, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."system_settings_id_seq"
OWNED BY "public"."system_settings"."id";
SELECT setval('"public"."system_settings_id_seq"', 60, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."transactions_id_seq"
OWNED BY "public"."transactions"."id";
SELECT setval('"public"."transactions_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."user_favorites_id_seq"
OWNED BY "public"."user_favorites"."id";
SELECT setval('"public"."user_favorites_id_seq"', 7, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."user_follows_id_seq"
OWNED BY "public"."user_follows"."id";
SELECT setval('"public"."user_follows_id_seq"', 4, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."user_wechat_bindings_id_seq"
OWNED BY "public"."user_wechat_bindings"."id";
SELECT setval('"public"."user_wechat_bindings_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."users_id_seq"
OWNED BY "public"."users"."id";
SELECT setval('"public"."users_id_seq"', 3, true);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."work_logs_id_seq"
OWNED BY "public"."work_logs"."id";
SELECT setval('"public"."work_logs_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."workers_id_seq"
OWNED BY "public"."workers"."id";
SELECT setval('"public"."workers_id_seq"', 1, false);

-- ----------------------------
-- Indexes structure for table admin_logs
-- ----------------------------
CREATE INDEX "idx_admin_logs_admin_id" ON "public"."admin_logs" USING btree (
  "admin_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table admin_logs
-- ----------------------------
ALTER TABLE "public"."admin_logs" ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table admins
-- ----------------------------
CREATE UNIQUE INDEX "idx_admins_phone" ON "public"."admins" USING btree (
  "phone" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_admins_username" ON "public"."admins" USING btree (
  "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table admins
-- ----------------------------
ALTER TABLE "public"."admins" ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table after_sales
-- ----------------------------
CREATE INDEX "idx_after_sales_booking_id" ON "public"."after_sales" USING btree (
  "booking_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_after_sales_order_no" ON "public"."after_sales" USING btree (
  "order_no" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_after_sales_user_id" ON "public"."after_sales" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table after_sales
-- ----------------------------
ALTER TABLE "public"."after_sales" ADD CONSTRAINT "after_sales_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table arbitrations
-- ----------------------------
CREATE INDEX "idx_arbitrations_project_id" ON "public"."arbitrations" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table arbitrations
-- ----------------------------
ALTER TABLE "public"."arbitrations" ADD CONSTRAINT "arbitrations_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table audit_logs
-- ----------------------------
CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING btree (
  "action" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_audit_logs_operator_id" ON "public"."audit_logs" USING btree (
  "operator_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_audit_logs_operator_type" ON "public"."audit_logs" USING btree (
  "operator_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_audit_logs_resource" ON "public"."audit_logs" USING btree (
  "resource" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table audit_logs
-- ----------------------------
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table bookings
-- ----------------------------
CREATE INDEX "idx_bookings_merchant_deadline" ON "public"."bookings" USING btree (
  "merchant_response_deadline" "pg_catalog"."timestamp_ops" ASC NULLS LAST
) WHERE status = 1 AND intent_fee_paid = true AND intent_fee_refunded = false;
CREATE INDEX "idx_bookings_provider_id" ON "public"."bookings" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_bookings_refund_status" ON "public"."bookings" USING btree (
  "intent_fee_refunded" "pg_catalog"."bool_ops" ASC NULLS LAST
) WHERE intent_fee_paid = true;
CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table bookings
-- ----------------------------
ALTER TABLE "public"."bookings" ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table case_audits
-- ----------------------------
CREATE INDEX "idx_case_audits_case_id" ON "public"."case_audits" USING btree (
  "case_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_case_audits_provider" ON "public"."case_audits" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_case_audits_status" ON "public"."case_audits" USING btree (
  "status" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table case_audits
-- ----------------------------
ALTER TABLE "public"."case_audits" ADD CONSTRAINT "case_audits_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table chat_messages
-- ----------------------------
CREATE INDEX "idx_chat_messages_conversation_id" ON "public"."chat_messages" USING btree (
  "conversation_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_chat_messages_receiver_id" ON "public"."chat_messages" USING btree (
  "receiver_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_chat_messages_sender_id" ON "public"."chat_messages" USING btree (
  "sender_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table chat_messages
-- ----------------------------
ALTER TABLE "public"."chat_messages" ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table conversations
-- ----------------------------
CREATE INDEX "idx_conversations_user1_id" ON "public"."conversations" USING btree (
  "user1_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_conversations_user2_id" ON "public"."conversations" USING btree (
  "user2_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table conversations
-- ----------------------------
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table dictionary_categories
-- ----------------------------
CREATE INDEX "idx_dict_cat_enabled" ON "public"."dictionary_categories" USING btree (
  "enabled" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_dict_cat_sort" ON "public"."dictionary_categories" USING btree (
  "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table dictionary_categories
-- ----------------------------
ALTER TABLE "public"."dictionary_categories" ADD CONSTRAINT "dictionary_categories_code_key" UNIQUE ("code");

-- ----------------------------
-- Checks structure for table dictionary_categories
-- ----------------------------
ALTER TABLE "public"."dictionary_categories" ADD CONSTRAINT "chk_dict_cat_sort_order" CHECK (sort_order >= 0);

-- ----------------------------
-- Primary Key structure for table dictionary_categories
-- ----------------------------
ALTER TABLE "public"."dictionary_categories" ADD CONSTRAINT "dictionary_categories_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table escrow_accounts
-- ----------------------------
CREATE UNIQUE INDEX "idx_escrow_accounts_project_id" ON "public"."escrow_accounts" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_escrow_accounts_user_id" ON "public"."escrow_accounts" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table escrow_accounts
-- ----------------------------
ALTER TABLE "public"."escrow_accounts" ADD CONSTRAINT "escrow_accounts_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table material_shop_audits
-- ----------------------------
CREATE INDEX "idx_material_shop_audits_shop_id" ON "public"."material_shop_audits" USING btree (
  "shop_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table material_shop_audits
-- ----------------------------
ALTER TABLE "public"."material_shop_audits" ADD CONSTRAINT "material_shop_audits_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table material_shops
-- ----------------------------
ALTER TABLE "public"."material_shops" ADD CONSTRAINT "material_shops_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table merchant_applications
-- ----------------------------
CREATE INDEX "idx_merchant_applications_phone" ON "public"."merchant_applications" USING btree (
  "phone" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_merchant_applications_provider_id" ON "public"."merchant_applications" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_merchant_applications_user_id" ON "public"."merchant_applications" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table merchant_applications
-- ----------------------------
ALTER TABLE "public"."merchant_applications" ADD CONSTRAINT "merchant_applications_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table merchant_bank_accounts
-- ----------------------------
CREATE INDEX "idx_merchant_bank_accounts_provider_id" ON "public"."merchant_bank_accounts" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table merchant_bank_accounts
-- ----------------------------
ALTER TABLE "public"."merchant_bank_accounts" ADD CONSTRAINT "merchant_bank_accounts_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table merchant_incomes
-- ----------------------------
CREATE INDEX "idx_merchant_incomes_booking_id" ON "public"."merchant_incomes" USING btree (
  "booking_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_merchant_incomes_order_id" ON "public"."merchant_incomes" USING btree (
  "order_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_merchant_incomes_provider_id" ON "public"."merchant_incomes" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table merchant_incomes
-- ----------------------------
ALTER TABLE "public"."merchant_incomes" ADD CONSTRAINT "merchant_incomes_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table merchant_service_settings
-- ----------------------------
CREATE UNIQUE INDEX "idx_merchant_service_settings_provider_id" ON "public"."merchant_service_settings" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table merchant_service_settings
-- ----------------------------
ALTER TABLE "public"."merchant_service_settings" ADD CONSTRAINT "merchant_service_settings_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table merchant_withdraws
-- ----------------------------
CREATE UNIQUE INDEX "idx_merchant_withdraws_order_no" ON "public"."merchant_withdraws" USING btree (
  "order_no" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_merchant_withdraws_provider_id" ON "public"."merchant_withdraws" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table merchant_withdraws
-- ----------------------------
ALTER TABLE "public"."merchant_withdraws" ADD CONSTRAINT "merchant_withdraws_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table milestones
-- ----------------------------
CREATE INDEX "idx_milestones_project_id" ON "public"."milestones" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table milestones
-- ----------------------------
ALTER TABLE "public"."milestones" ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table notifications
-- ----------------------------
CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING btree (
  "created_at" "pg_catalog"."timestamp_ops" DESC NULLS FIRST
);
CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING btree (
  "is_read" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "user_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table notifications
-- ----------------------------
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table orders
-- ----------------------------
CREATE INDEX "idx_orders_booking_id" ON "public"."orders" USING btree (
  "booking_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_orders_order_no" ON "public"."orders" USING btree (
  "order_no" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_orders_project_id" ON "public"."orders" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_orders_proposal_id" ON "public"."orders" USING btree (
  "proposal_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table orders
-- ----------------------------
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table payment_plans
-- ----------------------------
CREATE INDEX "idx_payment_plans_order_id" ON "public"."payment_plans" USING btree (
  "order_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table payment_plans
-- ----------------------------
ALTER TABLE "public"."payment_plans" ADD CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table phase_tasks
-- ----------------------------
CREATE INDEX "idx_phase_tasks_phase_id" ON "public"."phase_tasks" USING btree (
  "phase_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table phase_tasks
-- ----------------------------
ALTER TABLE "public"."phase_tasks" ADD CONSTRAINT "phase_tasks_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table project_phases
-- ----------------------------
CREATE INDEX "idx_project_phases_project_id" ON "public"."project_phases" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table project_phases
-- ----------------------------
ALTER TABLE "public"."project_phases" ADD CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table projects
-- ----------------------------
CREATE INDEX "idx_projects_owner_id" ON "public"."projects" USING btree (
  "owner_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_projects_proposal_id" ON "public"."projects" USING btree (
  "proposal_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_projects_provider_id" ON "public"."projects" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table projects
-- ----------------------------
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table proposals
-- ----------------------------
CREATE INDEX "idx_proposals_booking_id" ON "public"."proposals" USING btree (
  "booking_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_proposals_booking_version" ON "public"."proposals" USING btree (
  "booking_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "version" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_proposals_designer_id" ON "public"."proposals" USING btree (
  "designer_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_proposals_parent_proposal_id" ON "public"."proposals" USING btree (
  "parent_proposal_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_proposals_submitted_at" ON "public"."proposals" USING btree (
  "submitted_at" "pg_catalog"."timestamptz_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table proposals
-- ----------------------------
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table provider_audits
-- ----------------------------
CREATE INDEX "idx_provider_audits_provider_id" ON "public"."provider_audits" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table provider_audits
-- ----------------------------
ALTER TABLE "public"."provider_audits" ADD CONSTRAINT "provider_audits_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table provider_cases
-- ----------------------------
CREATE INDEX "idx_provider_cases_provider_id" ON "public"."provider_cases" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table provider_cases
-- ----------------------------
ALTER TABLE "public"."provider_cases" ADD CONSTRAINT "provider_cases_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table provider_reviews
-- ----------------------------
CREATE INDEX "idx_provider_reviews_provider_id" ON "public"."provider_reviews" USING btree (
  "provider_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_provider_reviews_user_id" ON "public"."provider_reviews" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table provider_reviews
-- ----------------------------
ALTER TABLE "public"."provider_reviews" ADD CONSTRAINT "provider_reviews_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table providers
-- ----------------------------
CREATE INDEX "idx_providers_user_id" ON "public"."providers" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table providers
-- ----------------------------
ALTER TABLE "public"."providers" ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table regions
-- ----------------------------
CREATE INDEX "idx_regions_enabled" ON "public"."regions" USING btree (
  "enabled" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_regions_level" ON "public"."regions" USING btree (
  "level" "pg_catalog"."int4_ops" ASC NULLS LAST
);
CREATE INDEX "idx_regions_parent" ON "public"."regions" USING btree (
  "parent_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table regions
-- ----------------------------
ALTER TABLE "public"."regions" ADD CONSTRAINT "regions_code_key" UNIQUE ("code");

-- ----------------------------
-- Primary Key structure for table regions
-- ----------------------------
ALTER TABLE "public"."regions" ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table risk_warnings
-- ----------------------------
CREATE INDEX "idx_risk_warnings_project_id" ON "public"."risk_warnings" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table risk_warnings
-- ----------------------------
ALTER TABLE "public"."risk_warnings" ADD CONSTRAINT "risk_warnings_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table sys_admin_roles
-- ----------------------------
ALTER TABLE "public"."sys_admin_roles" ADD CONSTRAINT "sys_admin_roles_pkey" PRIMARY KEY ("admin_id", "role_id");

-- ----------------------------
-- Indexes structure for table sys_admins
-- ----------------------------
CREATE UNIQUE INDEX "idx_sys_admins_username" ON "public"."sys_admins" USING btree (
  "username" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table sys_admins
-- ----------------------------
ALTER TABLE "public"."sys_admins" ADD CONSTRAINT "sys_admins_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table sys_menus
-- ----------------------------
CREATE INDEX "idx_sys_menus_parent_id" ON "public"."sys_menus" USING btree (
  "parent_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_sys_menus_permission" ON "public"."sys_menus" USING btree (
  "permission" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table sys_menus
-- ----------------------------
ALTER TABLE "public"."sys_menus" ADD CONSTRAINT "sys_menus_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table sys_operation_logs
-- ----------------------------
CREATE INDEX "idx_sys_operation_logs_admin_id" ON "public"."sys_operation_logs" USING btree (
  "admin_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table sys_operation_logs
-- ----------------------------
ALTER TABLE "public"."sys_operation_logs" ADD CONSTRAINT "sys_operation_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table sys_role_menus
-- ----------------------------
ALTER TABLE "public"."sys_role_menus" ADD CONSTRAINT "sys_role_menus_pkey" PRIMARY KEY ("role_id", "menu_id");

-- ----------------------------
-- Indexes structure for table sys_roles
-- ----------------------------
CREATE UNIQUE INDEX "idx_sys_roles_key" ON "public"."sys_roles" USING btree (
  "key" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table sys_roles
-- ----------------------------
ALTER TABLE "public"."sys_roles" ADD CONSTRAINT "sys_roles_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table system_configs
-- ----------------------------
CREATE UNIQUE INDEX "idx_system_configs_key" ON "public"."system_configs" USING btree (
  "key" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table system_configs
-- ----------------------------
ALTER TABLE "public"."system_configs" ADD CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table system_dictionaries
-- ----------------------------
CREATE INDEX "idx_dict_category" ON "public"."system_dictionaries" USING btree (
  "category_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_dict_enabled" ON "public"."system_dictionaries" USING btree (
  "enabled" "pg_catalog"."bool_ops" ASC NULLS LAST
);
CREATE INDEX "idx_dict_parent" ON "public"."system_dictionaries" USING btree (
  "parent_value" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_dict_sort" ON "public"."system_dictionaries" USING btree (
  "category_code" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
  "sort_order" "pg_catalog"."int4_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table system_dictionaries
-- ----------------------------
ALTER TABLE "public"."system_dictionaries" ADD CONSTRAINT "uk_dict_category_value" UNIQUE ("category_code", "value");

-- ----------------------------
-- Checks structure for table system_dictionaries
-- ----------------------------
ALTER TABLE "public"."system_dictionaries" ADD CONSTRAINT "chk_dict_value_not_empty" CHECK (length(TRIM(BOTH FROM value)) > 0);
ALTER TABLE "public"."system_dictionaries" ADD CONSTRAINT "chk_dict_label_not_empty" CHECK (length(TRIM(BOTH FROM label)) > 0);
ALTER TABLE "public"."system_dictionaries" ADD CONSTRAINT "chk_dict_sort_order" CHECK (sort_order >= 0);

-- ----------------------------
-- Primary Key structure for table system_dictionaries
-- ----------------------------
ALTER TABLE "public"."system_dictionaries" ADD CONSTRAINT "system_dictionaries_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table system_settings
-- ----------------------------
CREATE UNIQUE INDEX "idx_system_settings_key" ON "public"."system_settings" USING btree (
  "key" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table system_settings
-- ----------------------------
ALTER TABLE "public"."system_settings" ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table transactions
-- ----------------------------
CREATE INDEX "idx_transactions_escrow_id" ON "public"."transactions" USING btree (
  "escrow_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_transactions_from_user_id" ON "public"."transactions" USING btree (
  "from_user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_transactions_milestone_id" ON "public"."transactions" USING btree (
  "milestone_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_transactions_order_id" ON "public"."transactions" USING btree (
  "order_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_transactions_to_user_id" ON "public"."transactions" USING btree (
  "to_user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_transactions_type" ON "public"."transactions" USING btree (
  "type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Uniques structure for table transactions
-- ----------------------------
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_order_id_key" UNIQUE ("order_id");

-- ----------------------------
-- Primary Key structure for table transactions
-- ----------------------------
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table user_favorites
-- ----------------------------
CREATE UNIQUE INDEX "idx_user_favorite" ON "public"."user_favorites" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "target_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "target_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_user_favorites_user_id" ON "public"."user_favorites" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table user_favorites
-- ----------------------------
ALTER TABLE "public"."user_favorites" ADD CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table user_follows
-- ----------------------------
CREATE UNIQUE INDEX "idx_user_follow" ON "public"."user_follows" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "target_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "target_type" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_user_follows_user_id" ON "public"."user_follows" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table user_follows
-- ----------------------------
ALTER TABLE "public"."user_follows" ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table user_wechat_bindings
-- ----------------------------
CREATE UNIQUE INDEX "idx_user_wechat_app_openid" ON "public"."user_wechat_bindings" USING btree (
  "app_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST,
  "open_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_user_wechat_bindings_union_id" ON "public"."user_wechat_bindings" USING btree (
  "union_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);
CREATE INDEX "idx_user_wechat_bindings_user_id" ON "public"."user_wechat_bindings" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE UNIQUE INDEX "idx_user_wechat_user_app" ON "public"."user_wechat_bindings" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST,
  "app_id" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table user_wechat_bindings
-- ----------------------------
ALTER TABLE "public"."user_wechat_bindings" ADD CONSTRAINT "user_wechat_bindings_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table users
-- ----------------------------
CREATE UNIQUE INDEX "idx_users_phone" ON "public"."users" USING btree (
  "phone" COLLATE "pg_catalog"."default" "pg_catalog"."text_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table users
-- ----------------------------
ALTER TABLE "public"."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table work_logs
-- ----------------------------
CREATE INDEX "idx_work_logs_created_by" ON "public"."work_logs" USING btree (
  "created_by" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_work_logs_log_date" ON "public"."work_logs" USING btree (
  "log_date" "pg_catalog"."date_ops" ASC NULLS LAST
);
CREATE INDEX "idx_work_logs_phase_id" ON "public"."work_logs" USING btree (
  "phase_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_work_logs_project_id" ON "public"."work_logs" USING btree (
  "project_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);
CREATE INDEX "idx_work_logs_worker_id" ON "public"."work_logs" USING btree (
  "worker_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table work_logs
-- ----------------------------
ALTER TABLE "public"."work_logs" ADD CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table workers
-- ----------------------------
CREATE INDEX "idx_workers_user_id" ON "public"."workers" USING btree (
  "user_id" "pg_catalog"."int8_ops" ASC NULLS LAST
);

-- ----------------------------
-- Primary Key structure for table workers
-- ----------------------------
ALTER TABLE "public"."workers" ADD CONSTRAINT "workers_pkey" PRIMARY KEY ("id");

-- ----------------------------
-- Foreign Keys structure for table phase_tasks
-- ----------------------------
ALTER TABLE "public"."phase_tasks" ADD CONSTRAINT "fk_project_phases_tasks" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ----------------------------
-- Foreign Keys structure for table system_dictionaries
-- ----------------------------
ALTER TABLE "public"."system_dictionaries" ADD CONSTRAINT "fk_dict_category" FOREIGN KEY ("category_code") REFERENCES "public"."dictionary_categories" ("code") ON DELETE CASCADE ON UPDATE CASCADE;
-- WARNING: 历史数据库快照，仅供参考/回溯，不是认证或商家入驻 schema 的权威来源。
-- 请使用 server/migrations/ 下的迁移，尤其是 server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql。
