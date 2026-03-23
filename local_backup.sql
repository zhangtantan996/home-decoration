--
-- PostgreSQL database dump
--

\restrict 5afDTts6TBzhbRFcWm8TadEGl44wTlXTxRBQDo6NKXGCrRhEhNLZH0MdjEs53f8

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_logs (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    admin_id bigint,
    admin_name character varying(50),
    action character varying(100),
    resource character varying(100),
    resource_id bigint,
    method character varying(10),
    path character varying(200),
    ip character varying(50),
    user_agent character varying(500),
    request_data text,
    status bigint
);


ALTER TABLE public.admin_logs OWNER TO postgres;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admin_logs_id_seq OWNER TO postgres;

--
-- Name: admin_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_logs_id_seq OWNED BY public.admin_logs.id;


--
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    username character varying(50),
    phone character varying(20),
    email character varying(100),
    password character varying(255),
    role character varying(20) DEFAULT 'admin'::character varying,
    status smallint DEFAULT 1,
    last_login_at timestamp with time zone,
    last_login_ip character varying(50)
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.admins_id_seq OWNER TO postgres;

--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: after_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.after_sales (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id bigint,
    booking_id bigint,
    order_no character varying(32),
    type character varying(20),
    reason character varying(200),
    description text,
    images text,
    amount numeric,
    status smallint DEFAULT 0,
    reply text,
    resolved_at timestamp with time zone
);


ALTER TABLE public.after_sales OWNER TO postgres;

--
-- Name: after_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.after_sales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.after_sales_id_seq OWNER TO postgres;

--
-- Name: after_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.after_sales_id_seq OWNED BY public.after_sales.id;


--
-- Name: arbitrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.arbitrations (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    project_name character varying(100),
    applicant character varying(50),
    respondent character varying(50),
    reason text,
    evidence text,
    status smallint DEFAULT 0,
    result text,
    attachments text,
    updated_by bigint
);


ALTER TABLE public.arbitrations OWNER TO postgres;

--
-- Name: arbitrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.arbitrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.arbitrations_id_seq OWNER TO postgres;

--
-- Name: arbitrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.arbitrations_id_seq OWNED BY public.arbitrations.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    operator_type character varying(20),
    operator_id bigint,
    action character varying(100),
    resource character varying(50),
    request_body text,
    client_ip character varying(50),
    user_agent character varying(500),
    status_code bigint,
    duration bigint
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id bigint,
    provider_id bigint,
    provider_type character varying(20),
    address character varying(200),
    area numeric,
    renovation_type character varying(50),
    budget_range character varying(50),
    preferred_date character varying(100),
    phone character varying(20),
    notes text,
    status smallint DEFAULT 1,
    house_layout character varying(50),
    intent_fee numeric DEFAULT 0,
    intent_fee_paid boolean DEFAULT false,
    intent_fee_deducted boolean DEFAULT false,
    intent_fee_refunded boolean DEFAULT false,
    intent_fee_refund_reason character varying(200),
    intent_fee_refunded_at timestamp without time zone,
    merchant_response_deadline timestamp without time zone
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bookings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bookings_id_seq OWNER TO postgres;

--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: case_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.case_audits (
    id bigint NOT NULL,
    case_id bigint,
    provider_id bigint NOT NULL,
    action_type character varying(20) NOT NULL,
    title character varying(100),
    cover_image character varying(500),
    style character varying(50),
    area character varying(20),
    year character varying(10),
    description text,
    images text,
    sort_order integer DEFAULT 0,
    status integer DEFAULT 0,
    reject_reason character varying(500),
    audited_by bigint,
    audited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    price numeric(10,2) DEFAULT 0,
    layout character varying(50)
);


ALTER TABLE public.case_audits OWNER TO postgres;

--
-- Name: case_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.case_audits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.case_audits_id_seq OWNER TO postgres;

--
-- Name: case_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.case_audits_id_seq OWNED BY public.case_audits.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id bigint NOT NULL,
    conversation_id character varying(64),
    sender_id bigint,
    receiver_id bigint,
    content text,
    msg_type bigint DEFAULT 1,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chat_messages_id_seq OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id character varying(64) NOT NULL,
    user1_id bigint,
    user2_id bigint,
    last_message_content character varying(500),
    last_message_time timestamp with time zone,
    user1_unread bigint DEFAULT 0,
    user2_unread bigint DEFAULT 0,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: escrow_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.escrow_accounts (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    total_amount numeric,
    frozen_amount numeric DEFAULT 0,
    released_amount numeric DEFAULT 0,
    status smallint DEFAULT 1,
    user_id bigint,
    project_name character varying(100),
    user_name character varying(50),
    available_amount numeric DEFAULT 0
);


ALTER TABLE public.escrow_accounts OWNER TO postgres;

--
-- Name: escrow_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.escrow_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.escrow_accounts_id_seq OWNER TO postgres;

--
-- Name: escrow_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.escrow_accounts_id_seq OWNED BY public.escrow_accounts.id;


--
-- Name: material_shop_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_shop_audits (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    shop_id bigint,
    shop_name character varying(100),
    type character varying(20),
    brand_name character varying(100),
    address character varying(300),
    contact_person character varying(50),
    contact_phone character varying(20),
    business_license character varying(500),
    store_front text,
    status smallint DEFAULT 0,
    submit_time timestamp with time zone,
    audit_time timestamp with time zone,
    audit_admin_id bigint,
    reject_reason text
);


ALTER TABLE public.material_shop_audits OWNER TO postgres;

--
-- Name: material_shop_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.material_shop_audits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.material_shop_audits_id_seq OWNER TO postgres;

--
-- Name: material_shop_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.material_shop_audits_id_seq OWNED BY public.material_shop_audits.id;


--
-- Name: material_shops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_shops (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    type character varying(20),
    name character varying(100),
    cover character varying(500),
    brand_logo character varying(500),
    rating numeric DEFAULT 0,
    review_count bigint DEFAULT 0,
    main_products text,
    product_categories character varying(200),
    address character varying(300),
    latitude numeric,
    longitude numeric,
    open_time character varying(50),
    tags text,
    is_verified boolean DEFAULT false
);


ALTER TABLE public.material_shops OWNER TO postgres;

--
-- Name: material_shops_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.material_shops_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.material_shops_id_seq OWNER TO postgres;

--
-- Name: material_shops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.material_shops_id_seq OWNED BY public.material_shops.id;


--
-- Name: merchant_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_applications (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone character varying(20),
    applicant_type character varying(20),
    real_name character varying(50),
    id_card_no character varying(100),
    id_card_front character varying(500),
    id_card_back character varying(500),
    company_name character varying(100),
    license_no character varying(50),
    license_image character varying(500),
    team_size bigint DEFAULT 1,
    office_address character varying(200),
    service_area text,
    styles text,
    introduction text,
    portfolio_cases text,
    status smallint DEFAULT 0,
    reject_reason character varying(500),
    audited_by bigint,
    audited_at timestamp with time zone,
    user_id bigint,
    provider_id bigint
);


ALTER TABLE public.merchant_applications OWNER TO postgres;

--
-- Name: merchant_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.merchant_applications_id_seq OWNER TO postgres;

--
-- Name: merchant_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_applications_id_seq OWNED BY public.merchant_applications.id;


--
-- Name: merchant_bank_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_bank_accounts (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    account_name character varying(100),
    account_no character varying(100),
    bank_name character varying(50),
    branch_name character varying(100),
    is_default boolean DEFAULT false,
    status smallint DEFAULT 1
);


ALTER TABLE public.merchant_bank_accounts OWNER TO postgres;

--
-- Name: merchant_bank_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_bank_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.merchant_bank_accounts_id_seq OWNER TO postgres;

--
-- Name: merchant_bank_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_bank_accounts_id_seq OWNED BY public.merchant_bank_accounts.id;


--
-- Name: merchant_incomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_incomes (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    order_id bigint,
    booking_id bigint,
    type character varying(20),
    amount numeric,
    platform_fee numeric,
    net_amount numeric,
    status smallint DEFAULT 0,
    settled_at timestamp with time zone,
    withdraw_order_no character varying(50)
);


ALTER TABLE public.merchant_incomes OWNER TO postgres;

--
-- Name: merchant_incomes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_incomes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.merchant_incomes_id_seq OWNER TO postgres;

--
-- Name: merchant_incomes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_incomes_id_seq OWNED BY public.merchant_incomes.id;


--
-- Name: merchant_service_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_service_settings (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    accept_booking boolean DEFAULT true,
    auto_confirm_hours bigint DEFAULT 24,
    service_styles text,
    service_packages text,
    price_range_min numeric,
    price_range_max numeric,
    response_time_desc character varying(50)
);


ALTER TABLE public.merchant_service_settings OWNER TO postgres;

--
-- Name: merchant_service_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_service_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.merchant_service_settings_id_seq OWNER TO postgres;

--
-- Name: merchant_service_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_service_settings_id_seq OWNED BY public.merchant_service_settings.id;


--
-- Name: merchant_withdraws; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_withdraws (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    order_no character varying(32),
    amount numeric,
    bank_account character varying(100),
    bank_name character varying(50),
    status smallint DEFAULT 0,
    fail_reason character varying(200),
    completed_at timestamp with time zone,
    operator_id bigint,
    audit_remark text
);


ALTER TABLE public.merchant_withdraws OWNER TO postgres;

--
-- Name: merchant_withdraws_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_withdraws_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.merchant_withdraws_id_seq OWNER TO postgres;

--
-- Name: merchant_withdraws_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_withdraws_id_seq OWNED BY public.merchant_withdraws.id;


--
-- Name: milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.milestones (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    name character varying(50),
    seq smallint,
    amount numeric,
    percentage numeric,
    status smallint DEFAULT 0,
    criteria text,
    submitted_at timestamp with time zone,
    accepted_at timestamp with time zone,
    paid_at timestamp with time zone
);


ALTER TABLE public.milestones OWNER TO postgres;

--
-- Name: milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.milestones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.milestones_id_seq OWNER TO postgres;

--
-- Name: milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.milestones_id_seq OWNED BY public.milestones.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    user_type character varying(20) NOT NULL,
    title character varying(100) NOT NULL,
    content text NOT NULL,
    type character varying(30) NOT NULL,
    related_id bigint DEFAULT 0,
    related_type character varying(30),
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    action_url character varying(200),
    extra text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notifications IS '站内通知表';


--
-- Name: COLUMN notifications.user_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.user_type IS '用户类型: user(普通用户), provider(商家), admin(管理员)';


--
-- Name: COLUMN notifications.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.type IS '通知类型: booking.intent_paid, proposal.submitted, order.paid等';


--
-- Name: COLUMN notifications.is_read; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.is_read IS '是否已读';


--
-- Name: COLUMN notifications.action_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.action_url IS '点击通知后的跳转路径';


--
-- Name: COLUMN notifications.extra; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notifications.extra IS 'JSON格式的扩展数据';


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    booking_id bigint,
    order_no text,
    order_type character varying(20),
    total_amount numeric,
    paid_amount numeric DEFAULT 0,
    discount numeric DEFAULT 0,
    status smallint DEFAULT 0,
    paid_at timestamp with time zone,
    proposal_id bigint,
    expire_at timestamp with time zone
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_plans (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    order_id bigint,
    type character varying(20),
    seq bigint,
    name character varying(50),
    amount numeric,
    percentage numeric,
    status smallint DEFAULT 0,
    due_at timestamp with time zone,
    paid_at timestamp with time zone
);


ALTER TABLE public.payment_plans OWNER TO postgres;

--
-- Name: payment_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payment_plans_id_seq OWNER TO postgres;

--
-- Name: payment_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_plans_id_seq OWNED BY public.payment_plans.id;


--
-- Name: phase_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.phase_tasks (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phase_id bigint,
    name character varying(100),
    is_completed boolean DEFAULT false,
    completed_at timestamp with time zone
);


ALTER TABLE public.phase_tasks OWNER TO postgres;

--
-- Name: phase_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.phase_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.phase_tasks_id_seq OWNER TO postgres;

--
-- Name: phase_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.phase_tasks_id_seq OWNED BY public.phase_tasks.id;


--
-- Name: project_phases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_phases (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    phase_type character varying(20),
    seq bigint,
    status character varying(20) DEFAULT 'pending'::character varying,
    responsible_person character varying(50),
    start_date date,
    end_date date,
    estimated_days bigint
);


ALTER TABLE public.project_phases OWNER TO postgres;

--
-- Name: project_phases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.project_phases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.project_phases_id_seq OWNER TO postgres;

--
-- Name: project_phases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.project_phases_id_seq OWNED BY public.project_phases.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    owner_id bigint,
    provider_id bigint,
    name character varying(100),
    address character varying(200),
    latitude numeric,
    longitude numeric,
    area numeric,
    budget numeric,
    status smallint DEFAULT 0,
    current_phase character varying(50),
    start_date timestamp with time zone,
    expected_end timestamp with time zone,
    actual_end timestamp with time zone,
    material_method character varying(20),
    crew_id bigint,
    entry_start_date timestamp with time zone,
    entry_end_date timestamp with time zone,
    proposal_id bigint
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.projects_id_seq OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proposals (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    booking_id bigint,
    designer_id bigint,
    summary text,
    design_fee numeric,
    construction_fee numeric,
    material_fee numeric,
    estimated_days bigint,
    attachments text,
    status smallint DEFAULT 1,
    confirmed_at timestamp with time zone,
    version bigint DEFAULT 1,
    parent_proposal_id bigint,
    rejection_count bigint DEFAULT 0,
    rejection_reason text,
    rejected_at timestamp with time zone,
    submitted_at timestamp with time zone,
    user_response_deadline timestamp with time zone
);


ALTER TABLE public.proposals OWNER TO postgres;

--
-- Name: COLUMN proposals.version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.version IS 'Proposal version number (1, 2, 3, etc.)';


--
-- Name: COLUMN proposals.parent_proposal_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.parent_proposal_id IS 'References the previous version of this proposal';


--
-- Name: COLUMN proposals.rejection_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.rejection_count IS 'Number of times proposals for this booking have been rejected';


--
-- Name: COLUMN proposals.rejection_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.rejection_reason IS 'User-provided reason for rejection';


--
-- Name: COLUMN proposals.rejected_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.rejected_at IS 'Timestamp when proposal was rejected';


--
-- Name: COLUMN proposals.submitted_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.submitted_at IS 'Timestamp when proposal was submitted by merchant';


--
-- Name: COLUMN proposals.user_response_deadline; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.proposals.user_response_deadline IS '14-day deadline for user to confirm/reject';


--
-- Name: proposals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proposals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.proposals_id_seq OWNER TO postgres;

--
-- Name: proposals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proposals_id_seq OWNED BY public.proposals.id;


--
-- Name: provider_audits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_audits (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    provider_type smallint,
    company_name character varying(100),
    contact_person character varying(50),
    contact_phone character varying(20),
    business_license character varying(500),
    certificates text,
    status smallint DEFAULT 0,
    submit_time timestamp with time zone,
    audit_time timestamp with time zone,
    audit_admin_id bigint,
    reject_reason text
);


ALTER TABLE public.provider_audits OWNER TO postgres;

--
-- Name: provider_audits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.provider_audits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_audits_id_seq OWNER TO postgres;

--
-- Name: provider_audits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.provider_audits_id_seq OWNED BY public.provider_audits.id;


--
-- Name: provider_cases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_cases (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    title character varying(100),
    cover_image character varying(500),
    style character varying(50),
    area character varying(20),
    year character varying(10),
    description text,
    images text,
    sort_order bigint DEFAULT 0,
    price numeric(10,2) DEFAULT 0,
    layout character varying(50)
);


ALTER TABLE public.provider_cases OWNER TO postgres;

--
-- Name: provider_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.provider_cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_cases_id_seq OWNER TO postgres;

--
-- Name: provider_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.provider_cases_id_seq OWNED BY public.provider_cases.id;


--
-- Name: provider_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_reviews (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    provider_id bigint,
    user_id bigint,
    rating numeric,
    content text,
    images text,
    service_type character varying(20),
    area character varying(20),
    style character varying(50),
    tags character varying(200),
    helpful_count bigint DEFAULT 0,
    reply text,
    reply_at timestamp with time zone
);


ALTER TABLE public.provider_reviews OWNER TO postgres;

--
-- Name: provider_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.provider_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_reviews_id_seq OWNER TO postgres;

--
-- Name: provider_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.provider_reviews_id_seq OWNED BY public.provider_reviews.id;


--
-- Name: providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.providers (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id bigint,
    provider_type smallint,
    company_name character varying(100),
    license_no character varying(50),
    rating numeric DEFAULT 0,
    restore_rate numeric,
    budget_control numeric,
    completed_cnt bigint DEFAULT 0,
    verified boolean DEFAULT false,
    latitude numeric,
    longitude numeric,
    sub_type character varying(20) DEFAULT 'personal'::character varying,
    years_experience bigint DEFAULT 0,
    specialty character varying(200),
    work_types character varying(100),
    review_count bigint DEFAULT 0,
    price_min numeric DEFAULT 0,
    price_max numeric DEFAULT 0,
    price_unit character varying(20) DEFAULT '元/天'::character varying,
    followers_count bigint DEFAULT 0,
    service_intro text,
    team_size bigint DEFAULT 1,
    established_year bigint DEFAULT 2020,
    certifications text,
    cover_image character varying(500),
    status smallint DEFAULT 1,
    service_area text,
    office_address character varying(200)
);


ALTER TABLE public.providers OWNER TO postgres;

--
-- Name: providers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.providers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.providers_id_seq OWNER TO postgres;

--
-- Name: providers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.providers_id_seq OWNED BY public.providers.id;


--
-- Name: risk_warnings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.risk_warnings (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    project_name character varying(100),
    type character varying(50),
    level character varying(20),
    description text,
    status smallint DEFAULT 0,
    handled_at timestamp with time zone,
    handled_by bigint,
    handle_result text
);


ALTER TABLE public.risk_warnings OWNER TO postgres;

--
-- Name: risk_warnings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.risk_warnings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.risk_warnings_id_seq OWNER TO postgres;

--
-- Name: risk_warnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.risk_warnings_id_seq OWNED BY public.risk_warnings.id;


--
-- Name: sys_admin_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_admin_roles (
    admin_id bigint NOT NULL,
    role_id bigint NOT NULL
);


ALTER TABLE public.sys_admin_roles OWNER TO postgres;

--
-- Name: sys_admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_admins (
    id bigint NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    nickname character varying(50),
    avatar character varying(500),
    phone character varying(20),
    email character varying(100),
    status smallint DEFAULT 1,
    is_super_admin boolean DEFAULT false,
    last_login_at timestamp with time zone,
    last_login_ip character varying(50),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.sys_admins OWNER TO postgres;

--
-- Name: sys_admins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sys_admins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sys_admins_id_seq OWNER TO postgres;

--
-- Name: sys_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sys_admins_id_seq OWNED BY public.sys_admins.id;


--
-- Name: sys_menus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_menus (
    id bigint NOT NULL,
    parent_id bigint DEFAULT 0,
    title character varying(50) NOT NULL,
    type smallint DEFAULT 1,
    permission character varying(100),
    path character varying(200),
    component character varying(200),
    icon character varying(100),
    sort bigint DEFAULT 0,
    visible boolean DEFAULT true,
    status smallint DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.sys_menus OWNER TO postgres;

--
-- Name: sys_menus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sys_menus_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sys_menus_id_seq OWNER TO postgres;

--
-- Name: sys_menus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sys_menus_id_seq OWNED BY public.sys_menus.id;


--
-- Name: sys_operation_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_operation_logs (
    id bigint NOT NULL,
    admin_id bigint,
    admin_name character varying(50),
    module character varying(50),
    action character varying(50),
    method character varying(10),
    path character varying(200),
    ip character varying(50),
    user_agent character varying(500),
    params text,
    result text,
    status bigint,
    duration bigint,
    created_at timestamp with time zone
);


ALTER TABLE public.sys_operation_logs OWNER TO postgres;

--
-- Name: sys_operation_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sys_operation_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sys_operation_logs_id_seq OWNER TO postgres;

--
-- Name: sys_operation_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sys_operation_logs_id_seq OWNED BY public.sys_operation_logs.id;


--
-- Name: sys_role_menus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_role_menus (
    role_id bigint NOT NULL,
    menu_id bigint NOT NULL
);


ALTER TABLE public.sys_role_menus OWNER TO postgres;

--
-- Name: sys_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_roles (
    id bigint NOT NULL,
    name character varying(50) NOT NULL,
    key character varying(50) NOT NULL,
    remark character varying(200),
    sort bigint DEFAULT 0,
    status smallint DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.sys_roles OWNER TO postgres;

--
-- Name: sys_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sys_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sys_roles_id_seq OWNER TO postgres;

--
-- Name: sys_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sys_roles_id_seq OWNED BY public.sys_roles.id;


--
-- Name: system_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_configs (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    key character varying(50),
    value text,
    type character varying(20) DEFAULT 'string'::character varying,
    description character varying(200),
    editable boolean DEFAULT true
);


ALTER TABLE public.system_configs OWNER TO postgres;

--
-- Name: system_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_configs_id_seq OWNER TO postgres;

--
-- Name: system_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_configs_id_seq OWNED BY public.system_configs.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    key character varying(100),
    value text,
    description character varying(200),
    category character varying(50)
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_settings_id_seq OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    escrow_id bigint,
    milestone_id bigint,
    type character varying(20),
    amount numeric,
    from_user_id bigint,
    to_user_id bigint,
    status smallint DEFAULT 0,
    completed_at timestamp with time zone,
    order_id character varying(50),
    from_account character varying(200),
    to_account character varying(200),
    remark text
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_favorites (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id bigint,
    target_id bigint,
    target_type character varying(20)
);


ALTER TABLE public.user_favorites OWNER TO postgres;

--
-- Name: user_favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_favorites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_favorites_id_seq OWNER TO postgres;

--
-- Name: user_favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_favorites_id_seq OWNED BY public.user_favorites.id;


--
-- Name: user_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_follows (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id bigint,
    target_id bigint,
    target_type character varying(20)
);


ALTER TABLE public.user_follows OWNER TO postgres;

--
-- Name: user_follows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_follows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_follows_id_seq OWNER TO postgres;

--
-- Name: user_follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_follows_id_seq OWNED BY public.user_follows.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone character varying(20),
    nickname character varying(50),
    avatar character varying(500),
    password character varying(255),
    user_type smallint,
    status smallint DEFAULT 1,
    login_failed_count bigint DEFAULT 0,
    locked_until timestamp with time zone,
    last_failed_login_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.login_failed_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.login_failed_count IS '登录失败次数';


--
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.locked_until IS '锁定到期时间';


--
-- Name: COLUMN users.last_failed_login_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.last_failed_login_at IS '最后失败登录时间';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: work_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_logs (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    project_id bigint,
    worker_id bigint,
    log_date date,
    description text,
    photos jsonb,
    ai_analysis jsonb,
    is_compliant boolean,
    issues jsonb,
    phase_id bigint,
    created_by bigint,
    title character varying(100)
);


ALTER TABLE public.work_logs OWNER TO postgres;

--
-- Name: work_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_logs_id_seq OWNER TO postgres;

--
-- Name: work_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_logs_id_seq OWNED BY public.work_logs.id;


--
-- Name: workers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workers (
    id bigint NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id bigint,
    skill_type character varying(50),
    origin character varying(50),
    cert_water boolean,
    cert_height boolean,
    hourly_rate numeric,
    insured boolean,
    latitude numeric,
    longitude numeric,
    available boolean DEFAULT true
);


ALTER TABLE public.workers OWNER TO postgres;

--
-- Name: workers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.workers_id_seq OWNER TO postgres;

--
-- Name: workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workers_id_seq OWNED BY public.workers.id;


--
-- Name: admin_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_logs_id_seq'::regclass);


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: after_sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.after_sales ALTER COLUMN id SET DEFAULT nextval('public.after_sales_id_seq'::regclass);


--
-- Name: arbitrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arbitrations ALTER COLUMN id SET DEFAULT nextval('public.arbitrations_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: case_audits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.case_audits ALTER COLUMN id SET DEFAULT nextval('public.case_audits_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: escrow_accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escrow_accounts ALTER COLUMN id SET DEFAULT nextval('public.escrow_accounts_id_seq'::regclass);


--
-- Name: material_shop_audits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_shop_audits ALTER COLUMN id SET DEFAULT nextval('public.material_shop_audits_id_seq'::regclass);


--
-- Name: material_shops id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_shops ALTER COLUMN id SET DEFAULT nextval('public.material_shops_id_seq'::regclass);


--
-- Name: merchant_applications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_applications ALTER COLUMN id SET DEFAULT nextval('public.merchant_applications_id_seq'::regclass);


--
-- Name: merchant_bank_accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.merchant_bank_accounts_id_seq'::regclass);


--
-- Name: merchant_incomes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_incomes ALTER COLUMN id SET DEFAULT nextval('public.merchant_incomes_id_seq'::regclass);


--
-- Name: merchant_service_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_service_settings ALTER COLUMN id SET DEFAULT nextval('public.merchant_service_settings_id_seq'::regclass);


--
-- Name: merchant_withdraws id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_withdraws ALTER COLUMN id SET DEFAULT nextval('public.merchant_withdraws_id_seq'::regclass);


--
-- Name: milestones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones ALTER COLUMN id SET DEFAULT nextval('public.milestones_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payment_plans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans ALTER COLUMN id SET DEFAULT nextval('public.payment_plans_id_seq'::regclass);


--
-- Name: phase_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.phase_tasks ALTER COLUMN id SET DEFAULT nextval('public.phase_tasks_id_seq'::regclass);


--
-- Name: project_phases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_phases ALTER COLUMN id SET DEFAULT nextval('public.project_phases_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: proposals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals ALTER COLUMN id SET DEFAULT nextval('public.proposals_id_seq'::regclass);


--
-- Name: provider_audits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_audits ALTER COLUMN id SET DEFAULT nextval('public.provider_audits_id_seq'::regclass);


--
-- Name: provider_cases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_cases ALTER COLUMN id SET DEFAULT nextval('public.provider_cases_id_seq'::regclass);


--
-- Name: provider_reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_reviews ALTER COLUMN id SET DEFAULT nextval('public.provider_reviews_id_seq'::regclass);


--
-- Name: providers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers ALTER COLUMN id SET DEFAULT nextval('public.providers_id_seq'::regclass);


--
-- Name: risk_warnings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_warnings ALTER COLUMN id SET DEFAULT nextval('public.risk_warnings_id_seq'::regclass);


--
-- Name: sys_admins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_admins ALTER COLUMN id SET DEFAULT nextval('public.sys_admins_id_seq'::regclass);


--
-- Name: sys_menus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_menus ALTER COLUMN id SET DEFAULT nextval('public.sys_menus_id_seq'::regclass);


--
-- Name: sys_operation_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_operation_logs ALTER COLUMN id SET DEFAULT nextval('public.sys_operation_logs_id_seq'::regclass);


--
-- Name: sys_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_roles ALTER COLUMN id SET DEFAULT nextval('public.sys_roles_id_seq'::regclass);


--
-- Name: system_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_configs ALTER COLUMN id SET DEFAULT nextval('public.system_configs_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_favorites id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_favorites ALTER COLUMN id SET DEFAULT nextval('public.user_favorites_id_seq'::regclass);


--
-- Name: user_follows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows ALTER COLUMN id SET DEFAULT nextval('public.user_follows_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: work_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs ALTER COLUMN id SET DEFAULT nextval('public.work_logs_id_seq'::regclass);


--
-- Name: workers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers ALTER COLUMN id SET DEFAULT nextval('public.workers_id_seq'::regclass);


--
-- Data for Name: admin_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_logs (id, created_at, updated_at, admin_id, admin_name, action, resource, resource_id, method, path, ip, user_agent, request_data, status) FROM stdin;
1	2025-12-26 17:57:01.598472+00	2025-12-26 17:57:01.598472+00	1		PATCH /api/v1/admin/providers/90005/verify		0			172.21.0.1			200
2	2025-12-26 17:57:02.414607+00	2025-12-26 17:57:02.414607+00	1		PATCH /api/v1/admin/providers/90005/verify		0			172.21.0.1			200
34	2025-12-28 08:36:31.124605+00	2025-12-28 08:36:31.124605+00	1		POST /api/v1/admin/admins		0			172.21.0.1			200
35	2025-12-28 10:32:44.409487+00	2025-12-28 10:32:44.409487+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
36	2025-12-28 10:32:45.123495+00	2025-12-28 10:32:45.123495+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
37	2025-12-28 12:07:01.804637+00	2025-12-28 12:07:01.804637+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
38	2025-12-28 12:07:03.188235+00	2025-12-28 12:07:03.188235+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
39	2025-12-28 12:13:54.198663+00	2025-12-28 12:13:54.198663+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
40	2025-12-28 12:13:55.452854+00	2025-12-28 12:13:55.452854+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
41	2025-12-28 12:14:10.040121+00	2025-12-28 12:14:10.040121+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
42	2025-12-28 12:14:11.478208+00	2025-12-28 12:14:11.478208+00	1		PATCH /api/v1/admin/admins/13/status		0			172.21.0.1			200
43	2025-12-28 12:37:20.565253+00	2025-12-28 12:37:20.565253+00	1		DELETE /api/v1/admin/admins/13		0			172.21.0.1			200
44	2025-12-28 12:37:25.403938+00	2025-12-28 12:37:25.403938+00	1		DELETE /api/v1/admin/admins/12		0			172.21.0.1			200
45	2025-12-28 12:37:30.245094+00	2025-12-28 12:37:30.245094+00	1		DELETE /api/v1/admin/admins/11		0			172.21.0.1			200
46	2025-12-28 12:37:33.80486+00	2025-12-28 12:37:33.80486+00	1		DELETE /api/v1/admin/admins/10		0			172.21.0.1			200
47	2025-12-28 12:37:35.694575+00	2025-12-28 12:37:35.694575+00	1		DELETE /api/v1/admin/admins/9		0			172.21.0.1			200
48	2025-12-28 12:37:37.244712+00	2025-12-28 12:37:37.244712+00	1		DELETE /api/v1/admin/admins/8		0			172.21.0.1			200
49	2025-12-28 12:38:14.47366+00	2025-12-28 12:38:14.47366+00	1		POST /api/v1/admin/admins		0			172.21.0.1			200
50	2025-12-28 12:49:31.913927+00	2025-12-28 12:49:31.913927+00	1		PUT /api/v1/admin/admins/14		0			172.21.0.1			200
51	2025-12-29 14:07:05.175451+00	2025-12-29 14:07:05.175451+00	1		POST /api/v1/admin/audits/cases/2/approve		0			172.21.0.1			200
52	2025-12-29 14:07:50.944843+00	2025-12-29 14:07:50.944843+00	1		POST /api/v1/admin/audits/cases/3/approve		0			172.21.0.1			200
53	2025-12-29 14:38:42.49131+00	2025-12-29 14:38:42.49131+00	1		POST /api/v1/admin/audits/cases/6/reject		0			172.21.0.1			200
54	2025-12-29 14:39:53.173242+00	2025-12-29 14:39:53.173242+00	1		POST /api/v1/admin/audits/cases/7/approve		0			172.21.0.1			200
55	2025-12-30 15:02:30.926672+00	2025-12-30 15:02:30.926672+00	1		DELETE /api/v1/admin/admins/20		0			172.21.0.1			200
56	2025-12-30 15:02:32.540616+00	2025-12-30 15:02:32.540616+00	1		DELETE /api/v1/admin/admins/19		0			172.21.0.1			200
57	2025-12-30 15:02:34.630796+00	2025-12-30 15:02:34.630796+00	1		DELETE /api/v1/admin/admins/18		0			172.21.0.1			200
58	2025-12-30 15:02:36.367033+00	2025-12-30 15:02:36.367033+00	1		DELETE /api/v1/admin/admins/17		0			172.21.0.1			200
59	2025-12-30 15:02:37.702989+00	2025-12-30 15:02:37.702989+00	1		DELETE /api/v1/admin/admins/16		0			172.21.0.1			200
60	2025-12-30 15:02:39.339126+00	2025-12-30 15:02:39.339126+00	1		DELETE /api/v1/admin/admins/15		0			172.21.0.1			200
64	2025-12-31 06:39:34.790772+00	2025-12-31 06:39:34.790772+00	1		POST /api/v1/admin/menus		0			172.21.0.1			200
65	2025-12-31 06:41:20.560694+00	2025-12-31 06:41:20.560694+00	1		POST /api/v1/admin/roles/1/menus		0			172.21.0.1			200
66	2025-12-31 09:56:59.368168+00	2025-12-31 09:56:59.368168+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
67	2025-12-31 09:57:02.001285+00	2025-12-31 09:57:02.001285+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
68	2025-12-31 10:07:32.216136+00	2025-12-31 10:07:32.216136+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
69	2025-12-31 10:07:34.02914+00	2025-12-31 10:07:34.02914+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
70	2025-12-31 10:08:08.204583+00	2025-12-31 10:08:08.204583+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
71	2025-12-31 10:08:26.323767+00	2025-12-31 10:08:26.323767+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
72	2025-12-31 10:08:40.628792+00	2025-12-31 10:08:40.628792+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
73	2025-12-31 10:17:50.675288+00	2025-12-31 10:17:50.675288+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
74	2025-12-31 15:25:06.330907+00	2025-12-31 15:25:06.330907+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
75	2025-12-31 15:26:37.218338+00	2025-12-31 15:26:37.218338+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
76	2025-12-31 15:30:39.485477+00	2025-12-31 15:30:39.485477+00	1		PUT /api/v1/admin/settings		0			172.21.0.1			200
77	2026-01-01 11:51:12.235172+00	2026-01-01 11:51:12.235172+00	1		PUT /api/v1/admin/cases/36		0			172.21.0.1			200
78	2026-01-01 11:51:19.230266+00	2026-01-01 11:51:19.230266+00	1		PUT /api/v1/admin/cases/35		0			172.21.0.1			200
79	2026-01-01 11:51:24.790806+00	2026-01-01 11:51:24.790806+00	1		PUT /api/v1/admin/cases/34		0			172.21.0.1			200
80	2026-01-01 11:51:30.641847+00	2026-01-01 11:51:30.641847+00	1		PUT /api/v1/admin/cases/33		0			172.21.0.1			200
81	2026-01-01 11:51:36.002175+00	2026-01-01 11:51:36.002175+00	1		PUT /api/v1/admin/cases/32		0			172.21.0.1			200
\.


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admins (id, created_at, updated_at, username, phone, email, password, role, status, last_login_at, last_login_ip) FROM stdin;
1	2025-12-28 08:36:31.099928+00	2025-12-28 08:36:31.099928+00	zhangtantan	18717212217		$2a$10$TmZE3p4lI8HZRTxukPZZzOznl28Efv5NxMTmgEpMwxBcB3iNQmjbS	operator	1	\N	
2	2025-12-30 15:20:42.126294+00	2025-12-30 15:20:42.126294+00	admin	13800138000	admin@example.com	$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	super	1	\N	\N
3	2025-12-30 15:20:42.126294+00	2025-12-30 15:20:42.126294+00	operator1	13800138001	operator1@example.com	$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	operator	1	\N	\N
\.


--
-- Data for Name: after_sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.after_sales (id, created_at, updated_at, user_id, booking_id, order_no, type, reason, description, images, amount, status, reply, resolved_at) FROM stdin;
\.


--
-- Data for Name: arbitrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.arbitrations (id, created_at, updated_at, project_id, project_name, applicant, respondent, reason, evidence, status, result, attachments, updated_by) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, created_at, updated_at, operator_type, operator_id, action, resource, request_body, client_ip, user_agent, status_code, duration) FROM stdin;
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bookings (id, created_at, updated_at, user_id, provider_id, provider_type, address, area, renovation_type, budget_range, preferred_date, phone, notes, status, house_layout, intent_fee, intent_fee_paid, intent_fee_deducted, intent_fee_refunded, intent_fee_refund_reason, intent_fee_refunded_at, merchant_response_deadline) FROM stdin;
2	2025-12-28 13:06:30.415333+00	2025-12-28 18:18:09.294397+00	1	90004	designer	反反复复的	55	new	2	12-29 [周一] 08:00-10:00	13800138000		4	2室1厅1卫	0	f	f	f	\N	\N	\N
3	2025-12-28 16:52:00.005407+00	2025-12-29 14:41:27.348075+00	1	90004	designer	反反复复方法发	55	new	3	12-30 [周二] 09:00-12:00	13800138000		4	2室1厅1卫	0	f	f	f	\N	\N	\N
5	2025-12-28 17:23:08.890847+00	2025-12-29 17:04:53.061437+00	1	90004	designer	嘟嘟嘟嘟哈哈哈哈方法	55	new	3	12-30 [周二] 09:00-12:00	13800138000		3	2室1厅1卫	99	t	f	f	\N	\N	\N
\.


--
-- Data for Name: case_audits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.case_audits (id, case_id, provider_id, action_type, title, cover_image, style, area, year, description, images, sort_order, status, reject_reason, audited_by, audited_at, created_at, updated_at, price, layout) FROM stdin;
2	4	90004	update	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	1		0	2025-12-29 14:07:05.16533+00	2025-12-29 13:49:32.518472+00	2025-12-29 14:07:05.165351+00	120000.00	一室一厅
3	5	90004	update	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	1		0	2025-12-29 14:07:50.935627+00	2025-12-29 13:49:53.432542+00	2025-12-29 14:07:50.935643+00	200000.00	两室一厅
7	6	90004	update	新中式别墅设计	/uploads/cases/case_90004_1767005171319429722.png	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	1		0	2025-12-29 14:39:53.168195+00	2025-12-29 14:39:46.60004+00	2025-12-29 14:39:53.168219+00	1880000.00	四室及以上
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (id, conversation_id, sender_id, receiver_id, content, msg_type, is_read, created_at) FROM stdin;
1	1_90001	90001	1	您好，我是张设计师，很高兴为您服务！	1	t	2025-12-24 05:40:21.188089+00
2	1_90001	1	90001	您好，我想咨询一下现代简约风格的设计方案	1	t	2025-12-24 05:42:21.188089+00
3	1_90001	90001	1	好的，请问您的房屋面积是多少？有什么特殊的功能需求吗？	1	t	2025-12-24 05:44:21.188089+00
4	1_90001	1	90001	120平米，三室两厅。希望客厅和餐厅能够做开放式设计，主卧需要带衣帽间	1	t	2025-12-24 05:46:21.188089+00
5	1_90001	90001	1	明白了，这个需求很常见。我之前做过类似的案例，效果非常不错。	1	t	2025-12-24 05:48:21.188089+00
6	1_90001	1	90001	新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！	1	f	2025-12-24 05:50:21.188089+00
7	1_90002	90002	1	李师傅，水电改造什么时候能完工？	1	t	2025-12-24 05:40:21.231417+00
8	1_90002	1	90002	预计明天下午可以完成，今天正在做最后的验收检查	1	t	2025-12-24 05:42:21.231417+00
9	1_90002	90002	1	好的，辛苦了！验收通过后我会安排第一期款项	1	t	2025-12-24 05:44:21.231417+00
10	1_90002	1	90002	收到，您放心！	1	f	2025-12-24 05:46:21.231417+00
11	1_2	2	1	您好，我是张设计师，很高兴为您服务！	1	t	2025-12-30 10:55:36.711044+00
12	1_2	1	2	您好，我想咨询一下现代简约风格的设计方案	1	t	2025-12-30 10:57:36.711044+00
13	1_2	2	1	好的，请问您的房屋面积是多少？有什么特殊的功能需求吗？	1	t	2025-12-30 10:59:36.711044+00
14	1_2	1	2	120平米，三室两厅。希望客厅和餐厅能够做开放式设计，主卧需要带衣帽间	1	t	2025-12-30 11:01:36.711044+00
15	1_2	2	1	明白了，这个需求很常见。我之前做过类似的案例，效果非常不错。	1	t	2025-12-30 11:03:36.711044+00
16	1_2	1	2	新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！	1	f	2025-12-30 11:05:36.711044+00
17	1_90004	90004	1	李师傅，水电改造什么时候能完工？	1	t	2025-12-30 10:55:36.765943+00
18	1_90004	1	90004	预计明天下午可以完成，今天正在做最后的验收检查	1	t	2025-12-30 10:57:36.765943+00
19	1_90004	90004	1	好的，辛苦了！验收通过后我会安排第一期款项	1	t	2025-12-30 10:59:36.765943+00
20	1_90004	1	90004	收到，您放心！	1	f	2025-12-30 11:01:36.765943+00
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, user1_id, user2_id, last_message_content, last_message_time, user1_unread, user2_unread, created_at, updated_at) FROM stdin;
1_90002	1	90002	收到，您放心！	2025-12-24 06:40:21.248187+00	0	0	2025-12-24 06:40:21.226821+00	2025-12-24 07:24:15.156059+00
1_90001	1	90001	新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！	2025-12-24 06:40:21.216155+00	0	0	2025-12-24 06:40:21.162983+00	2025-12-24 07:24:41.052961+00
1_2	1	2	新的平面布局方案已经发给您了，请查收。如有任何问题随时沟通！	2025-12-30 11:55:36.747439+00	1	0	2025-12-30 11:55:36.70123+00	2025-12-30 11:55:36.748479+00
1_90004	1	90004	收到，您放心！	2025-12-30 11:55:36.793793+00	1	0	2025-12-30 11:55:36.758912+00	2025-12-30 11:55:36.794377+00
\.


--
-- Data for Name: escrow_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.escrow_accounts (id, created_at, updated_at, project_id, total_amount, frozen_amount, released_amount, status, user_id, project_name, user_name, available_amount) FROM stdin;
\.


--
-- Data for Name: material_shop_audits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_shop_audits (id, created_at, updated_at, shop_id, shop_name, type, brand_name, address, contact_person, contact_phone, business_license, store_front, status, submit_time, audit_time, audit_admin_id, reject_reason) FROM stdin;
1	2025-12-30 15:21:19.194229+00	2025-12-30 15:21:19.194229+00	1	???????	brand	??	?????????A?101	???	13900139003	https://example.com/license4.jpg	["https://example.com/store1.jpg","https://example.com/store2.jpg"]	0	2025-12-30 15:21:19.194229+00	\N	\N	\N
2	2025-12-30 15:21:19.194229+00	2025-12-30 15:21:19.194229+00	2	??????	showroom	??	???????????100?	???	13900139004	https://example.com/license5.jpg	["https://example.com/store3.jpg"]	0	2025-12-30 15:21:19.194229+00	\N	\N	\N
\.


--
-- Data for Name: material_shops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_shops (id, created_at, updated_at, type, name, cover, brand_logo, rating, review_count, main_products, product_categories, address, latitude, longitude, open_time, tags, is_verified) FROM stdin;
1	2025-12-26 10:37:43.368878+00	2025-12-26 10:37:43.368878+00	showroom	红星美凯龙家居馆	https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800		4.800000190734863	1256	["瓷砖","地板","卫浴","橱柜","灯饰"]	瓷砖,地板,卫浴,橱柜,灯饰	北京市朝阳区东四环北路6号	39.9219	116.4837	09:00-21:00	["免费停车","设计服务","送货上门"]	t
2	2025-12-26 10:37:43.375595+00	2025-12-26 10:37:43.375595+00	brand	TOTO卫浴专卖店	https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800	https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TOTO_logo.svg/200px-TOTO_logo.svg.png	4.900000095367432	892	["智能马桶","花洒","浴缸","洗脸盆"]	卫浴	北京市海淀区中关村大街15号	39.9789	116.3074	10:00-21:30	["正品保障","安装服务","全国联保"]	t
3	2025-12-26 10:37:43.379747+00	2025-12-26 10:37:43.379747+00	showroom	居然之家设计中心	https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800		4.699999809265137	2341	["全屋定制","瓷砖","地板","门窗","智能家居"]	定制,瓷砖,地板,门窗	北京市丰台区南四环西路1号	39.8289	116.3193	09:30-21:00	["免费设计","VR体验","品质保障"]	t
4	2025-12-26 10:37:43.383833+00	2025-12-26 10:37:43.383833+00	brand	马可波罗瓷砖旗舰店	https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800	https://example.com/marco-polo-logo.png	4.599999904632568	567	["抛光砖","仿古砖","木纹砖","大理石瓷砖"]	瓷砖	北京市朝阳区建国路88号	39.9075	116.4714	09:00-20:00	["样板间展示","免费切割","施工指导"]	t
5	2025-12-26 10:37:43.388004+00	2025-12-26 10:37:43.388004+00	brand	大自然地板专卖	https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800	https://example.com/nature-floor-logo.png	4.5	423	["实木地板","复合地板","强化地板"]	地板	北京市西城区月坛北街甲2号	39.9134	116.3479	09:00-19:00	["环保认证","免费量房","终身维护"]	t
34	2025-12-26 10:47:28.792913+00	2025-12-26 10:47:28.792913+00	showroom	红星美凯龙家居馆	https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800		4.800000190734863	1256	["瓷砖","地板","卫浴","橱柜","灯饰"]	瓷砖,地板,卫浴,橱柜,灯饰	北京市朝阳区东四环北路6号	39.9219	116.4837	09:00-21:00	["免费停车","设计服务","送货上门"]	t
35	2025-12-26 10:47:28.799108+00	2025-12-26 10:47:28.799108+00	brand	TOTO卫浴专卖店	https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800	https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/TOTO_logo.svg/200px-TOTO_logo.svg.png	4.900000095367432	892	["智能马桶","花洒","浴缸","洗脸盆"]	卫浴	北京市海淀区中关村大街15号	39.9789	116.3074	10:00-21:30	["正品保障","安装服务","全国联保"]	t
36	2025-12-26 10:47:28.802218+00	2025-12-26 10:47:28.802218+00	showroom	居然之家设计中心	https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800		4.699999809265137	2341	["全屋定制","瓷砖","地板","门窗","智能家居"]	定制,瓷砖,地板,门窗	北京市丰台区南四环西路1号	39.8289	116.3193	09:30-21:00	["免费设计","VR体验","品质保障"]	t
37	2025-12-26 10:47:28.806853+00	2025-12-26 10:47:28.806853+00	brand	马可波罗瓷砖旗舰店	https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800	https://example.com/marco-polo-logo.png	4.599999904632568	567	["抛光砖","仿古砖","木纹砖","大理石瓷砖"]	瓷砖	北京市朝阳区建国路88号	39.9075	116.4714	09:00-20:00	["样板间展示","免费切割","施工指导"]	t
38	2025-12-26 10:47:28.811082+00	2025-12-26 10:47:28.811082+00	brand	大自然地板专卖	https://images.unsplash.com/photo-1615529328331-f8917597711f?w=800	https://example.com/nature-floor-logo.png	4.5	423	["实木地板","复合地板","强化地板"]	地板	北京市西城区月坛北街甲2号	39.9134	116.3479	09:00-19:00	["环保认证","免费量房","终身维护"]	t
\.


--
-- Data for Name: merchant_applications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchant_applications (id, created_at, updated_at, phone, applicant_type, real_name, id_card_no, id_card_front, id_card_back, company_name, license_no, license_image, team_size, office_address, service_area, styles, introduction, portfolio_cases, status, reject_reason, audited_by, audited_at, user_id, provider_id) FROM stdin;
\.


--
-- Data for Name: merchant_bank_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchant_bank_accounts (id, created_at, updated_at, provider_id, account_name, account_no, bank_name, branch_name, is_default, status) FROM stdin;
\.


--
-- Data for Name: merchant_incomes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchant_incomes (id, created_at, updated_at, provider_id, order_id, booking_id, type, amount, platform_fee, net_amount, status, settled_at, withdraw_order_no) FROM stdin;
1	2025-12-31 07:44:47.201789+00	2025-12-31 07:44:47.201789+00	90004	5	0	material	200000	10000	190000	0	\N	
\.


--
-- Data for Name: merchant_service_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchant_service_settings (id, created_at, updated_at, provider_id, accept_booking, auto_confirm_hours, service_styles, service_packages, price_range_min, price_range_max, response_time_desc) FROM stdin;
\.


--
-- Data for Name: merchant_withdraws; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchant_withdraws (id, created_at, updated_at, provider_id, order_no, amount, bank_account, bank_name, status, fail_reason, completed_at, operator_id, audit_remark) FROM stdin;
\.


--
-- Data for Name: milestones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.milestones (id, created_at, updated_at, project_id, name, seq, amount, percentage, status, criteria, submitted_at, accepted_at, paid_at) FROM stdin;
1	2025-12-30 09:40:45.615427+00	2025-12-30 09:40:45.615427+00	3	开工交底	1	51000	20	0	现场保护完成，图纸确认	\N	\N	\N
2	2025-12-30 09:40:45.615427+00	2025-12-30 09:40:45.615427+00	3	水电验收	2	76500	30	0	水管试压合格，电路通断测试	\N	\N	\N
3	2025-12-30 09:40:45.615427+00	2025-12-30 09:40:45.615427+00	3	泥木验收	3	76500	30	0	瓷砖空鼓率<5%，木工结构牢固	\N	\N	\N
4	2025-12-30 09:40:45.615427+00	2025-12-30 09:40:45.615427+00	3	竣工验收	4	51000	20	0	全屋保洁完成，设备调试正常	\N	\N	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, user_type, title, content, type, related_id, related_type, is_read, read_at, action_url, extra, created_at, updated_at) FROM stdin;
1	90004	provider	收款通知	用户已支付订单，金额：200000.00元	order.paid	5	order	f	\N	/merchant/orders/5	{"amount":200000,"orderId":5}	2025-12-31 07:44:47.185816	2025-12-31 07:44:47.185816
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, created_at, updated_at, project_id, booking_id, order_no, order_type, total_amount, paid_amount, discount, status, paid_at, proposal_id, expire_at) FROM stdin;
1	2025-12-30 05:27:24.417824+00	2025-12-30 07:11:51.78963+00	0	5	DF20251230052724	design	5000	0	99	2	\N	1	2025-12-31 23:59:59+00
2	2025-12-30 07:46:07.582395+00	2025-12-30 07:46:19.159444+00	0	5	DF20251230074607	design	4901	4802	99	1	2025-12-30 07:46:19.159267+00	1	2026-01-01 07:46:07.581942+00
3	2025-12-31 07:39:55.695432+00	2025-12-31 07:39:55.695432+00	3	0	D1735640103000	design	5000	4901	99	1	2025-12-31 07:39:55.695432+00	\N	\N
5	2025-12-31 07:39:55.705464+00	2025-12-31 07:44:47.168557+00	3	0	M1735640103002	material	200000	200000	0	1	2025-12-31 07:44:47.168327+00	0	\N
4	2025-12-31 07:39:55.701944+00	2026-01-01 12:12:48.701131+00	3	0	C1735640103001	construction	50000	32500	0	0	\N	0	\N
\.


--
-- Data for Name: payment_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_plans (id, created_at, updated_at, order_id, type, seq, name, amount, percentage, status, due_at, paid_at) FROM stdin;
3	2025-12-31 07:39:55.717351+00	2025-12-31 07:39:55.717351+00	4	milestone	3	中期款	15000	30	0	\N	\N
4	2025-12-31 07:39:55.721372+00	2025-12-31 07:39:55.721372+00	4	milestone	4	尾款	2500	5	0	\N	\N
1	2025-12-31 07:39:55.707549+00	2025-12-31 07:46:46.754647+00	4	milestone	1	开工款	15000	30	1	\N	2025-12-31 07:46:46.754342+00
2	2025-12-31 07:39:55.713483+00	2026-01-01 12:12:48.688395+00	4	milestone	2	水电款	17500	35	1	\N	2026-01-01 12:12:48.687988+00
\.


--
-- Data for Name: phase_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.phase_tasks (id, created_at, updated_at, phase_id, name, is_completed, completed_at) FROM stdin;
1	2025-12-30 09:40:45.603813+00	2025-12-30 09:40:45.603813+00	1	现场交接确认	f	\N
2	2025-12-30 09:40:45.603813+00	2025-12-30 09:40:45.603813+00	1	施工图纸确认	f	\N
3	2025-12-30 09:40:45.603813+00	2025-12-30 09:40:45.603813+00	1	材料进场验收	f	\N
4	2025-12-30 09:40:45.610479+00	2025-12-30 09:40:45.610479+00	2	墙体拆除	f	\N
5	2025-12-30 09:40:45.610479+00	2025-12-30 09:40:45.610479+00	2	地面拆除	f	\N
6	2025-12-30 09:40:45.610479+00	2025-12-30 09:40:45.610479+00	2	垃圾清运	f	\N
7	2025-12-30 09:40:45.611328+00	2025-12-30 09:40:45.611328+00	3	水管布置	f	\N
8	2025-12-30 09:40:45.611328+00	2025-12-30 09:40:45.611328+00	3	电路布线	f	\N
9	2025-12-30 09:40:45.611328+00	2025-12-30 09:40:45.611328+00	3	水电验收	f	\N
10	2025-12-30 09:40:45.612145+00	2025-12-30 09:40:45.612145+00	4	瓷砖铺贴	f	\N
11	2025-12-30 09:40:45.612145+00	2025-12-30 09:40:45.612145+00	4	木工制作	f	\N
12	2025-12-30 09:40:45.612145+00	2025-12-30 09:40:45.612145+00	4	吊顶施工	f	\N
13	2025-12-30 09:40:45.612888+00	2025-12-30 09:40:45.612888+00	5	墙面处理	f	\N
14	2025-12-30 09:40:45.612888+00	2025-12-30 09:40:45.612888+00	5	乳胶漆施工	f	\N
15	2025-12-30 09:40:45.613917+00	2025-12-30 09:40:45.613917+00	6	灯具安装	f	\N
16	2025-12-30 09:40:45.613917+00	2025-12-30 09:40:45.613917+00	6	洁具安装	f	\N
17	2025-12-30 09:40:45.613917+00	2025-12-30 09:40:45.613917+00	6	五金安装	f	\N
18	2025-12-30 09:40:45.614797+00	2025-12-30 09:40:45.614797+00	7	全屋保洁	f	\N
19	2025-12-30 09:40:45.614797+00	2025-12-30 09:40:45.614797+00	7	设备调试	f	\N
20	2025-12-30 09:40:45.614797+00	2025-12-30 09:40:45.614797+00	7	交付验收	f	\N
\.


--
-- Data for Name: project_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_phases (id, created_at, updated_at, project_id, phase_type, seq, status, responsible_person, start_date, end_date, estimated_days) FROM stdin;
1	2025-12-30 09:40:45.598493+00	2025-12-30 09:40:45.598493+00	3	preparation	1	pending		\N	\N	4
2	2025-12-30 09:40:45.610136+00	2025-12-30 09:40:45.610136+00	3	demolition	2	pending		\N	\N	7
3	2025-12-30 09:40:45.610986+00	2025-12-30 09:40:45.610986+00	3	electrical	3	pending		\N	\N	10
4	2025-12-30 09:40:45.611805+00	2025-12-30 09:40:45.611805+00	3	masonry	4	pending		\N	\N	15
5	2025-12-30 09:40:45.612536+00	2025-12-30 09:40:45.612536+00	3	painting	5	pending		\N	\N	10
6	2025-12-30 09:40:45.613504+00	2025-12-30 09:40:45.613504+00	3	installation	6	pending		\N	\N	7
7	2025-12-30 09:40:45.614517+00	2025-12-30 09:40:45.614517+00	3	inspection	7	pending		\N	\N	3
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, created_at, updated_at, owner_id, provider_id, name, address, latitude, longitude, area, budget, status, current_phase, start_date, expected_end, actual_end, material_method, crew_id, entry_start_date, entry_end_date, proposal_id) FROM stdin;
99001	2025-12-22 12:38:42.127702+00	2025-12-22 12:38:42.127702+00	1	1	汤臣一品 A栋-1201 [TEST]	上海市浦东新区	\N	\N	180	500000	1	水电工程	2024-11-05 00:00:00+00	\N	\N	\N	\N	\N	\N	\N
1	2025-12-29 16:47:06.59972+00	2025-12-29 16:47:06.59972+00	0	90004	项目-嘟嘟嘟嘟哈哈哈哈方法	嘟嘟嘟嘟哈哈哈哈方法	0	0	55	255000	0	selecting	\N	\N	\N	\N	\N	\N	\N	\N
2	2025-12-29 17:04:53.058776+00	2025-12-29 17:04:53.058776+00	0	90004	项目-嘟嘟嘟嘟哈哈哈哈方法	嘟嘟嘟嘟哈哈哈哈方法	0	0	55	255000	0	selecting	\N	\N	\N	\N	\N	\N	\N	\N
3	2025-12-30 09:40:45.586823+00	2025-12-30 09:40:45.586823+00	1	90004	嘟嘟嘟嘟哈哈哈哈方法装修项目	嘟嘟嘟嘟哈哈哈哈方法	0	0	55	255000	0	准备阶段	2025-12-31 00:00:00+00	2026-03-31 00:00:00+00	\N	platform	1	2025-12-31 00:00:00+00	2026-01-03 00:00:00+00	1
\.


--
-- Data for Name: proposals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proposals (id, created_at, updated_at, booking_id, designer_id, summary, design_fee, construction_fee, material_fee, estimated_days, attachments, status, confirmed_at, version, parent_proposal_id, rejection_count, rejection_reason, rejected_at, submitted_at, user_response_deadline) FROM stdin;
1	2025-12-29 15:48:34.397116+00	2025-12-30 07:46:07.581967+00	5	90004	本次家装设计以现代简约风格为主，注重功能与美感的平衡。整体色调采用温暖的中性色，搭配自然材质，营造舒适放松的居住氛围。空间布局强调通透与收纳，提升使用效率。通过合理的灯光设计与软装搭配，打造实用、温馨且富有品质感的家居环境。	5000	50000	200000	90	["/uploads/cases/case_90004_1767023242869667598.png","/uploads/cases/case_90004_1767023312358644589.pdf"]	2	2025-12-30 07:46:07.581942+00	1	\N	0	\N	\N	2025-12-29 15:48:34.397116+00	\N
\.


--
-- Data for Name: provider_audits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.provider_audits (id, created_at, updated_at, provider_id, provider_type, company_name, contact_person, contact_phone, business_license, certificates, status, submit_time, audit_time, audit_admin_id, reject_reason) FROM stdin;
3	2025-12-30 15:21:19.181767+00	2025-12-30 15:21:19.181767+00	3	3	?????	??	13900139002	https://example.com/license3.jpg	["https://example.com/cert4.jpg"]	1	2025-12-28 15:21:19.181767+00	\N	\N	\N
\.


--
-- Data for Name: provider_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.provider_cases (id, created_at, updated_at, provider_id, title, cover_image, style, area, year, description, images, sort_order, price, layout) FROM stdin;
5	2025-12-23 08:14:45.079671+00	2025-12-29 14:07:50.935108+00	90004	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	200000.00	两室一厅
6	2025-12-23 08:14:45.081621+00	2025-12-29 14:39:53.166988+00	90004	新中式别墅设计	/uploads/cases/case_90004_1767005171319429722.png	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	1880000.00	四室及以上
1	2025-12-23 08:14:45.048847+00	2025-12-23 08:14:45.048847+00	90001	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	200000.00	一室一厅
11	2025-12-23 08:14:45.133581+00	2025-12-23 08:14:45.133582+00	90012	水电改造工程	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	标准施工	120	2024	全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	100000.00	两室一厅
20	2025-12-23 08:14:45.204392+00	2025-12-23 08:14:45.204392+00	90005	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	170000.00	三室一厅
35	2025-12-23 08:14:45.325504+00	2026-01-01 11:51:19.225504+00	90013	水电改造工程	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	标准施工	120	2024	全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	140000.00	两室一厅
36	2025-12-23 08:14:45.327749+00	2026-01-01 11:51:12.218262+00	90013	木工吊顶施工	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	精工细作	80	2024	客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	160000.00	一室一厅
4	2025-12-23 08:14:45.076262+00	2025-12-29 14:07:05.16217+00	90004	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	120000.00	一室一厅
2	2025-12-23 08:14:45.053707+00	2025-12-23 08:14:45.053707+00	90001	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	130000.00	一室一厅
3	2025-12-23 08:14:45.057647+00	2025-12-23 08:14:45.057647+00	90001	新中式别墅设计	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	150000.00	一室一厅
7	2025-12-23 08:14:45.100138+00	2025-12-23 08:14:45.100139+00	90011	厨卫改造项目	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	实用主义	15	2024	针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	190000.00	一室一厅
10	2025-12-23 08:14:45.127949+00	2025-12-23 08:14:45.127949+00	90012	厨卫改造项目	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	实用主义	15	2024	针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	110000.00	一室一厅
8	2025-12-23 08:14:45.103622+00	2025-12-23 08:14:45.103622+00	90011	水电改造工程	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	标准施工	120	2024	全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	190000.00	三室一厅
9	2025-12-23 08:14:45.10752+00	2025-12-23 08:14:45.107521+00	90011	木工吊顶施工	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	精工细作	80	2024	客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	100000.00	三室一厅
12	2025-12-23 08:14:45.135495+00	2025-12-23 08:14:45.135495+00	90012	木工吊顶施工	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	精工细作	80	2024	客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	150000.00	一室一厅
13	2025-12-23 08:14:45.152029+00	2025-12-23 08:14:45.152029+00	90014	厨卫改造项目	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	实用主义	15	2024	针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	110000.00	三室一厅
14	2025-12-23 08:14:45.15559+00	2025-12-23 08:14:45.15559+00	90014	水电改造工程	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	标准施工	120	2024	全屋水电线路重新布置，采用国标材料，规范施工，确保用电安全。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	130000.00	三室一厅
15	2025-12-23 08:14:45.15768+00	2025-12-23 08:14:45.15768+00	90014	木工吊顶施工	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	精工细作	80	2024	客厅餐厅一体化吊顶设计施工，造型美观，工艺精细，完美呈现设计效果。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	200000.00	一室一厅
16	2025-12-23 08:14:45.178373+00	2025-12-23 08:14:45.178373+00	90002	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	140000.00	两室一厅
17	2025-12-23 08:14:45.181729+00	2025-12-23 08:14:45.181729+00	90002	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	110000.00	三室一厅
18	2025-12-23 08:14:45.183516+00	2025-12-23 08:14:45.183516+00	90002	新中式别墅设计	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	200000.00	两室一厅
21	2025-12-23 08:14:45.207554+00	2025-12-23 08:14:45.207554+00	90005	新中式别墅设计	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	110000.00	一室一厅
23	2025-12-23 08:14:45.227524+00	2025-12-23 08:14:45.227524+00	90003	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	180000.00	一室一厅
22	2025-12-23 08:14:45.224195+00	2025-12-23 08:14:45.224195+00	90003	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	100000.00	一室一厅
24	2025-12-23 08:14:45.229519+00	2025-12-23 08:14:45.229519+00	90003	新中式别墅设计	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	140000.00	三室一厅
25	2025-12-23 08:14:45.248179+00	2025-12-23 08:14:45.248179+00	90006	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	120000.00	一室一厅
26	2025-12-23 08:14:45.251475+00	2025-12-23 08:14:45.251475+00	90006	北欧风两居室	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	北欧风格	90	2024	小户型空间最大化利用，采用浅色系为主色调，营造清新自然的居住氛围。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	180000.00	两室一厅
27	2025-12-23 08:14:45.253704+00	2025-12-23 08:14:45.253704+00	90006	新中式别墅设计	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	新中式	280	2024	传统与现代的完美融合，保留中式韵味的同时注入现代元素，打造高品质生活空间。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	150000.00	两室一厅
34	2025-12-23 08:14:45.32195+00	2026-01-01 11:51:24.785965+00	90013	厨卫改造项目	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	实用主义	15	2024	针对老旧小区的厨房卫生间进行全面改造，更换水电路，重新铺设瓷砖，安装现代化卫浴设施。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	100000.00	三室一厅
33	2025-12-23 08:14:45.303533+00	2026-01-01 11:51:30.638661+00	90022	商业空间装修	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	工业风	500	2024	办公空间整体设计装修，兼顾美观与实用，打造高效舒适的工作环境。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	200000.00	两室一厅
32	2025-12-23 08:14:45.301536+00	2026-01-01 11:51:35.998401+00	90022	老房翻新改造	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	简约现代	100	2024	20年老房焕新颜，水电全改造，空间重新规划，让老房子变成现代舒适住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	180000.00	一室一厅
28	2025-12-23 08:14:45.272011+00	2025-12-23 08:14:45.272011+00	90021	整装全包案例	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代轻奢	140	2024	从毛坯到精装的全流程整装服务，包含硬装施工、主材选购、软装搭配等一站式解决方案。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	110000.00	一室一厅
29	2025-12-23 08:14:45.275545+00	2025-12-23 08:14:45.275545+00	90021	老房翻新改造	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	简约现代	100	2024	20年老房焕新颜，水电全改造，空间重新规划，让老房子变成现代舒适住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	1	160000.00	两室一厅
30	2025-12-23 08:14:45.277481+00	2025-12-23 08:14:45.277481+00	90021	商业空间装修	https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	工业风	500	2024	办公空间整体设计装修，兼顾美观与实用，打造高效舒适的工作环境。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	2	190000.00	一室一厅
31	2025-12-23 08:14:45.297851+00	2025-12-23 08:14:45.297851+00	90022	整装全包案例	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代轻奢	140	2024	从毛坯到精装的全流程整装服务，包含硬装施工、主材选购、软装搭配等一站式解决方案。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	120000.00	三室一厅
19	2025-12-23 08:14:45.202139+00	2025-12-23 08:14:45.202139+00	90005	现代简约三居室	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80	现代简约	120	2024	本案例位于城市中心高档社区，业主是一对年轻夫妇。采用简洁大气的设计风格，功能完善的现代化住宅。	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3\\u0026auto=format\\u0026fit=crop\\u0026w=800\\u0026q=80"]	0	150000.00	两室一厅
\.


--
-- Data for Name: provider_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.provider_reviews (id, created_at, updated_at, provider_id, user_id, rating, content, images, service_type, area, style, tags, helpful_count, reply, reply_at) FROM stdin;
1	2025-12-21 09:58:16.035003+00	2025-12-23 09:58:16.035003+00	90012	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	15		\N
2	2025-12-14 09:58:16.040083+00	2025-12-23 09:58:16.040084+00	90012	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	10		\N
3	2025-12-07 09:58:16.042092+00	2025-12-23 09:58:16.042093+00	90012	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	5		\N
4	2025-12-19 09:58:16.050878+00	2025-12-23 09:58:16.050878+00	90004	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	15		\N
5	2025-12-12 09:58:16.054125+00	2025-12-23 09:58:16.054126+00	90004	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	10		\N
6	2025-12-05 09:58:16.056023+00	2025-12-23 09:58:16.056023+00	90004	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	5		\N
7	2025-12-22 09:58:16.06304+00	2025-12-23 09:58:16.06304+00	90011	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	30		\N
8	2025-12-15 09:58:16.066174+00	2025-12-23 09:58:16.066174+00	90011	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	25		\N
9	2025-12-08 09:58:16.068051+00	2025-12-23 09:58:16.068051+00	90011	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	20		\N
10	2025-12-01 09:58:16.070133+00	2025-12-23 09:58:16.070133+00	90011	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	15		\N
11	2025-11-24 09:58:16.072125+00	2025-12-23 09:58:16.072126+00	90011	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	10		\N
12	2025-11-17 09:58:16.073962+00	2025-12-23 09:58:16.073962+00	90011	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	5		\N
13	2025-12-22 09:58:16.084954+00	2025-12-23 09:58:16.084955+00	90021	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	20		\N
14	2025-12-15 09:58:16.087993+00	2025-12-23 09:58:16.087993+00	90021	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	15		\N
15	2025-12-08 09:58:16.090054+00	2025-12-23 09:58:16.090054+00	90021	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	10		\N
16	2025-12-01 09:58:16.092163+00	2025-12-23 09:58:16.092164+00	90021	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	5		\N
17	2025-12-20 09:58:16.098816+00	2025-12-23 09:58:16.098817+00	90003	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	30		\N
18	2025-12-13 09:58:16.102072+00	2025-12-23 09:58:16.102073+00	90003	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	25		\N
19	2025-12-06 09:58:16.104029+00	2025-12-23 09:58:16.10403+00	90003	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	20		\N
20	2025-11-29 09:58:16.106035+00	2025-12-23 09:58:16.106035+00	90003	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	15		\N
21	2025-11-22 09:58:16.108239+00	2025-12-23 09:58:16.108239+00	90003	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	10		\N
22	2025-11-15 09:58:16.114145+00	2025-12-23 09:58:16.114146+00	90003	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	5		\N
23	2025-12-21 09:58:16.121047+00	2025-12-23 09:58:16.121048+00	90022	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	25		\N
24	2025-12-14 09:58:16.124091+00	2025-12-23 09:58:16.124091+00	90022	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	20		\N
25	2025-12-07 09:58:16.126086+00	2025-12-23 09:58:16.126087+00	90022	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	15		\N
26	2025-11-30 09:58:16.127961+00	2025-12-23 09:58:16.127962+00	90022	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	10		\N
27	2025-11-23 09:58:16.130011+00	2025-12-23 09:58:16.130012+00	90022	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	5		\N
28	2025-12-19 09:58:16.136756+00	2025-12-23 09:58:16.136756+00	90014	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	25		\N
29	2025-12-12 09:58:16.140153+00	2025-12-23 09:58:16.140153+00	90014	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	20		\N
30	2025-12-05 09:58:16.142086+00	2025-12-23 09:58:16.142087+00	90014	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	15		\N
31	2025-11-28 09:58:16.144054+00	2025-12-23 09:58:16.144054+00	90014	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	10		\N
32	2025-11-21 09:58:16.145987+00	2025-12-23 09:58:16.145987+00	90014	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	5		\N
33	2025-12-20 09:58:16.152739+00	2025-12-23 09:58:16.15274+00	90013	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	20		\N
34	2025-12-13 09:58:16.156343+00	2025-12-23 09:58:16.156344+00	90013	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	15		\N
35	2025-12-06 09:58:16.160104+00	2025-12-23 09:58:16.160105+00	90013	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	10		\N
36	2025-11-29 09:58:16.162147+00	2025-12-23 09:58:16.162147+00	90013	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	5		\N
37	2025-12-17 09:58:16.168951+00	2025-12-23 09:58:16.168951+00	90006	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	25		\N
38	2025-12-10 09:58:16.172003+00	2025-12-23 09:58:16.172003+00	90006	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	20		\N
39	2025-12-03 09:58:16.174049+00	2025-12-23 09:58:16.174049+00	90006	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	15		\N
40	2025-11-26 09:58:16.17604+00	2025-12-23 09:58:16.17604+00	90006	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	10		\N
41	2025-11-19 09:58:16.178034+00	2025-12-23 09:58:16.178034+00	90006	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	5		\N
42	2025-12-21 09:58:16.184755+00	2025-12-23 09:58:16.184755+00	90002	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	25		\N
43	2025-12-14 09:58:16.188059+00	2025-12-23 09:58:16.188059+00	90002	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	20		\N
44	2025-12-07 09:58:16.190045+00	2025-12-23 09:58:16.190045+00	90002	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	15		\N
45	2025-11-30 09:58:16.192008+00	2025-12-23 09:58:16.192008+00	90002	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	10		\N
46	2025-11-23 09:58:16.19404+00	2025-12-23 09:58:16.194041+00	90002	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	5		\N
47	2025-12-18 09:58:16.200964+00	2025-12-23 09:58:16.200965+00	90005	1	4.5	从选材到施工都很专业，每个节点都会主动汇报进度。唯一不足是周末联系不太方便，但瑕不掩瑜。		半包	130㎡	轻奢风格	["专业","进度透明"]	20		\N
48	2025-12-11 09:58:16.203982+00	2025-12-23 09:58:16.203982+00	90005	1	5	非常专业，方案很符合我们的需求，沟通也很耐心。从设计到施工，每个环节都很用心。特别是客厅的设计，比我想象的还要好！强烈推荐！	["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400","https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=400"]	整装	120㎡	现代简约	["服务好","设计赞","沟通顺畅"]	15		\N
49	2025-12-04 09:58:16.206022+00	2025-12-23 09:58:16.206022+00	90005	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	10		\N
50	2025-11-27 09:58:16.207921+00	2025-12-23 09:58:16.207921+00	90005	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	5		\N
51	2025-12-22 09:58:16.214818+00	2025-12-23 09:58:16.214818+00	90001	1	4.5	整体很满意，工期按时完成，质量有保障。施工过程中有一些小问题，但都及时解决了。下次还会合作！		整装	95㎡	北欧风格	["工期准时","质量好"]	20		\N
52	2025-12-15 09:58:16.218111+00	2025-12-23 09:58:16.218111+00	90001	1	5	服务态度好，施工质量高，细节处理得很好。物超所值！特别是水电改造做得很规范，验收一次通过。	["https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=400"]	半包	110㎡	现代简约	["细节到位","质量好","服务好"]	15		\N
53	2025-12-08 09:58:16.219982+00	2025-12-23 09:58:16.219982+00	90001	1	4	设计方案修改了好几次，最终效果还是不错的。价格在预算范围内，整体满意。		整装	88㎡	简约现代	["性价比高"]	10		\N
54	2025-12-01 09:58:16.221973+00	2025-12-23 09:58:16.221973+00	90001	1	5	第二次找他们装修了，一如既往的专业。这次是给父母装修的房子，他们非常满意，感谢团队的用心！	["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400","https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400"]	整装	75㎡	新中式	["服务好","设计赞","老客户"]	5		\N
\.


--
-- Data for Name: providers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.providers (id, created_at, updated_at, user_id, provider_type, company_name, license_no, rating, restore_rate, budget_control, completed_cnt, verified, latitude, longitude, sub_type, years_experience, specialty, work_types, review_count, price_min, price_max, price_unit, followers_count, service_intro, team_size, established_year, certifications, cover_image, status, service_area, office_address) FROM stdin;
90002	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.217514+00	90002	1	雅居设计工作室	\N	4.8	94.2	88.5	512	t	31.2345	121.4802	studio	12	新中式 · 轻奢风格		5	300.00	800.00	元/㎡	900120	专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。	1	2020	\N	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200	1	\N	\N
90011	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.18744+00	90011	3	工长	\N	4.9	95.0	90.0	568	t	31.2310	121.4750	personal	20	全屋装修 · 水电改造	general,plumber,electrician	6	300.00	500.00	元/天	900210	多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。	6	2020	\N	https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200	1	\N	\N
90005	2025-12-22 06:50:31.272993+00	2025-12-26 17:57:02.412137+00	90005	1	强设计工作室	\N	4.6	89.5	82.0	445	f	31.2250	121.4580	studio	10	工业风 · 混搭风格		4	250.00	600.00	元/㎡	900150	专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。	1	2020	\N	https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200	1	\N	\N
90014	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.193507+00	90014	3	工长	\N	4.7	90.0	85.0	245	f	31.2350	121.4850	personal	12	墙面粉刷 · 艺术漆施工	painter	5	280.00	400.00	元/天	900240	多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。	9	2020	\N	https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=1200	1	\N	\N
90012	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.235421+00	90012	3	工长	\N	4.8	92.0	88.0	423	t	31.2330	121.4780	personal	15	电路改造 · 弱电布线	electrician	3	350.00	450.00	元/天	900220	多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。	7	2020	\N	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200	1	\N	\N
90021	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.241692+00	90021	2	匠心装修工程有限公司	\N	4.7	92.5	88.0	1256	t	31.2260	121.4600	company	18	全包装修 · 整装服务	general	4	80000.00	150000.00	元/全包	900310	专业装修公司，提供从设计到施工的一站式服务。拥有专业施工团队，严格把控工程质量，让您省心省力。	25	2020	["营业执照","建筑装饰资质","安全生产许可证"]	https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200	1	\N	\N
90022	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.229708+00	90022	2	鑫盛建筑装饰公司	\N	4.6	88.0	82.0	867	t	31.2220	121.4550	company	12	半包装修 · 局部翻新	general	5	50000.00	100000.00	元/半包	900320	专业装修公司，提供从设计到施工的一站式服务。拥有专业施工团队，严格把控工程质量，让您省心省力。	30	2020	["营业执照","建筑装饰资质","安全生产许可证"]	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200	1	\N	\N
90013	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.208351+00	90013	3	工长	\N	4.9	97.0	94.0	312	t	31.2280	121.4620	personal	25	定制木工 · 吊顶隔断	carpenter	4	400.00	600.00	元/天	900230	多年施工经验，熟悉各类装修工艺。工作认真负责，注重细节，确保每个环节都达到高标准。	8	2020	\N	https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200	1	\N	\N
90001	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.224423+00	90001	1	独立设计师	\N	4.9	96.5	92.0	326	t	31.2304	121.4737	personal	8	现代简约 · 北欧风格		4	200.00	500.00	元/㎡	900110	专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。	1	2020	\N	https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200	1	\N	\N
90004	2025-12-22 06:50:31.272993+00	2026-01-01 10:34:13.288263+00	90004	1	独立设计师	\N	4.9	98.0	95.0	186	t	31.2380	121.4820	personal	5	现代简约 · 新中式 · 北欧风格		3	180.00	400.00	元/㎡	900140	专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。阿拉山口大家卡就断开连接ask领导就拉开就大数据的卡拉集散地立刻解开了觉得撒赖科技绿卡的撒尽量快点急啊离开的距离喀什角动量咯技术的会计师大理石空间看了就撒了的卡拉卡斯就拉克沙克来得及卡拉就是打开垃圾三菱电机拉丝机打卡时间的撒加快了的就阿斯利康大家坷拉世界大赛的看就ask来得及可拉斯基的离开洒家的卡拉就少得可怜急啊抗衰老大家看来洒家打开了按揭贷款垃圾啊利空打击ask劳动纪律卡角度看垃圾上来看大家奥克兰撒旦记录卡建档立卡时间离开大家阿斯利康大家立刻撒旦记录卡叫阿里大开杀戒了咯技术的拉开建档立卡时间卢卡斯觉得卡拉就是打开垃圾上来看就打算离开大家阿斯利康决定离开洒家到了离开	0	2020	\N	https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=1200	1	["雁塔区","碑林区","新城区","莲湖区"]	
90003	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.181584+00	90003	1	华美装饰设计公司	\N	4.7	91.8	85.0	892	t	31.2290	121.4650	company	15	欧式古典 · 美式田园		6	500.00	1200.00	元/㎡	900130	专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。	1	2020	\N	https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200	1	\N	\N
90006	2025-12-22 06:50:31.272993+00	2025-12-23 12:21:40.176353+00	90006	1	燕归来设计公司	\N	4.8	93.0	90.0	278	t	31.2200	121.4500	company	7	法式浪漫 · 地中海风		5	350.00	900.00	元/㎡	900160	专注现代简约、北欧风格设计，擅长空间规划与色彩搭配。提供从平面布局、效果图设计到软装搭配的全流程服务。秉承"少即是多"的设计理念，打造舒适、实用、美观的居住空间。	1	2020	\N	https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200	1	\N	\N
1	2025-12-30 11:55:33.170436+00	2025-12-30 11:55:33.170436+00	3	1	顶层设计工作室		4.900000095367432	0	0	0	t	0	0	personal	0			0	0	0	元/天	0		1	2020			1		
\.


--
-- Data for Name: risk_warnings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.risk_warnings (id, created_at, updated_at, project_id, project_name, type, level, description, status, handled_at, handled_by, handle_result) FROM stdin;
\.


--
-- Data for Name: sys_admin_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_admin_roles (admin_id, role_id) FROM stdin;
1	1
14	3
\.


--
-- Data for Name: sys_admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_admins (id, username, password, nickname, avatar, phone, email, status, is_super_admin, last_login_at, last_login_ip, created_at, updated_at) FROM stdin;
1	admin	$2a$10$TP4kgSmgUeQwwwjcE2s0n.sNa19xffV8jlxagtFYjyWR7o.bZ4vli	超级管理员				1	t	2026-01-01 11:50:32.423492+00	172.21.0.1	2025-12-26 15:52:51.857328+00	2026-01-01 11:50:32.425406+00
14	zhangtantan	$2a$10$RO8SCfEdBsMHY2MH/cGvs.XIxckIM8jxIY6QEOz/eMo1b7aAF8l9q	运营test				1	f	2025-12-28 17:43:52.876053+00	172.21.0.1	2025-12-28 12:38:14.460303+00	2025-12-28 17:43:52.876336+00
\.


--
-- Data for Name: sys_menus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_menus (id, parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at) FROM stdin;
131	130	查看审核	3	case:audit:view	\N	\N	\N	0	f	1	2025-12-29 13:57:28.702218+00	2025-12-29 13:57:28.702218+00
132	130	审核通过	3	case:audit:approve	\N	\N	\N	0	f	1	2025-12-29 13:57:28.702218+00	2025-12-29 13:57:28.702218+00
133	130	审核拒绝	3	case:audit:reject	\N	\N	\N	0	f	1	2025-12-29 13:57:28.702218+00	2025-12-29 13:57:28.702218+00
134	60	预约列表	2	booking:list	/bookings/list	pages/bookings/BookingList	CalendarOutlined	0	t	1	2025-12-29 15:08:24.275922+00	2025-12-29 15:08:24.275922+00
136	100	日志列表	2	system:log:list	/logs/list	pages/logs/LogList	FileTextOutlined	0	t	1	2025-12-29 15:08:46.759037+00	2025-12-29 15:08:46.759037+00
138	60	争议预约	2	booking:dispute:list	/bookings/disputed	bookings/DisputedBookings		10	t	1	2025-12-31 06:39:34.753873+00	2025-12-31 06:39:34.753873+00
60	0	预约管理	1	booking:list	/bookings	pages/bookings/BookingList	CalendarOutlined	50	t	1	2025-12-28 09:38:28.333529+00	2025-12-28 09:38:28.333529+00
80	0	评价管理	1	review:list	/reviews	pages/reviews/ReviewList	StarOutlined	70	t	1	2025-12-28 09:38:28.416267+00	2025-12-28 09:38:28.416267+00
1	0	工作台	2	dashboard:view	/dashboard	pages/dashboard	DashboardOutlined	1	t	1	2025-12-28 09:38:28.048358+00	2025-12-28 09:38:28.048358+00
10	0	用户管理	1		/users		UserOutlined	10	t	1	2025-12-28 09:38:28.056416+00	2025-12-28 09:38:28.056416+00
11	10	用户列表	2	system:user:list	/users/list	pages/users/UserList		1	t	1	2025-12-28 09:38:28.062652+00	2025-12-28 09:38:28.062652+00
12	10	查看用户	3	system:user:view				0	t	1	2025-12-28 09:38:28.068275+00	2025-12-28 09:38:28.068275+00
13	10	编辑用户	3	system:user:edit				0	t	1	2025-12-28 09:38:28.074004+00	2025-12-28 09:38:28.074004+00
14	10	删除用户	3	system:user:delete				0	t	1	2025-12-28 09:38:28.079788+00	2025-12-28 09:38:28.079788+00
15	10	导出用户	3	system:user:export				0	t	1	2025-12-28 09:38:28.08454+00	2025-12-28 09:38:28.08454+00
16	10	管理员管理	2	system:admin:list	/users/admins	pages/admins/AdminList		2	t	1	2025-12-28 09:38:28.089871+00	2025-12-28 09:38:28.089871+00
17	10	创建管理员	3	system:admin:create				0	t	1	2025-12-28 09:38:28.096639+00	2025-12-28 09:38:28.096639+00
18	10	编辑管理员	3	system:admin:edit				0	t	1	2025-12-28 09:38:28.102576+00	2025-12-28 09:38:28.102576+00
19	10	删除管理员	3	system:admin:delete				0	t	1	2025-12-28 09:38:28.108349+00	2025-12-28 09:38:28.108349+00
20	0	服务商管理	1		/providers		TeamOutlined	20	t	1	2025-12-28 09:38:28.114667+00	2025-12-28 09:38:28.114667+00
21	20	设计师	2	provider:designer:list	/providers/designers	pages/providers/ProviderList		1	t	1	2025-12-28 09:38:28.12147+00	2025-12-28 09:38:28.12147+00
22	20	查看设计师	3	provider:designer:view				0	t	1	2025-12-28 09:38:28.126712+00	2025-12-28 09:38:28.126712+00
23	20	创建设计师	3	provider:designer:create				0	t	1	2025-12-28 09:38:28.132729+00	2025-12-28 09:38:28.132729+00
24	20	编辑设计师	3	provider:designer:edit				0	t	1	2025-12-28 09:38:28.139051+00	2025-12-28 09:38:28.139051+00
25	20	删除设计师	3	provider:designer:delete				0	t	1	2025-12-28 09:38:28.14479+00	2025-12-28 09:38:28.14479+00
26	20	装修公司	2	provider:company:list	/providers/companies	pages/providers/ProviderList		2	t	1	2025-12-28 09:38:28.151043+00	2025-12-28 09:38:28.151043+00
27	20	查看装修公司	3	provider:company:view				0	t	1	2025-12-28 09:38:28.156269+00	2025-12-28 09:38:28.156269+00
28	20	创建装修公司	3	provider:company:create				0	t	1	2025-12-28 09:38:28.163617+00	2025-12-28 09:38:28.163617+00
29	20	编辑装修公司	3	provider:company:edit				0	t	1	2025-12-28 09:38:28.168307+00	2025-12-28 09:38:28.168307+00
30	20	删除装修公司	3	provider:company:delete				0	t	1	2025-12-28 09:38:28.174683+00	2025-12-28 09:38:28.174683+00
31	20	工长	2	provider:foreman:list	/providers/foremen	pages/providers/ProviderList		3	t	1	2025-12-28 09:38:28.180448+00	2025-12-28 09:38:28.180448+00
32	20	查看工长	3	provider:foreman:view				0	t	1	2025-12-28 09:38:28.186326+00	2025-12-28 09:38:28.186326+00
33	20	创建工长	3	provider:foreman:create				0	t	1	2025-12-28 09:38:28.192648+00	2025-12-28 09:38:28.192648+00
34	20	编辑工长	3	provider:foreman:edit				0	t	1	2025-12-28 09:38:28.198403+00	2025-12-28 09:38:28.198403+00
35	20	删除工长	3	provider:foreman:delete				0	t	1	2025-12-28 09:38:28.204579+00	2025-12-28 09:38:28.204579+00
36	20	资质审核	2	provider:audit:list	/providers/audit	pages/audits/ProviderAudit		4	t	1	2025-12-28 09:38:28.210741+00	2025-12-28 09:38:28.210741+00
37	20	查看审核	3	provider:audit:view				0	t	1	2025-12-28 09:38:28.215945+00	2025-12-28 09:38:28.215945+00
38	20	审核通过	3	provider:audit:approve				0	t	1	2025-12-28 09:38:28.222954+00	2025-12-28 09:38:28.222954+00
39	20	审核拒绝	3	provider:audit:reject				0	t	1	2025-12-28 09:38:28.230154+00	2025-12-28 09:38:28.230154+00
40	0	主材门店	1		/materials		ShopOutlined	30	t	1	2025-12-28 09:38:28.236419+00	2025-12-28 09:38:28.236419+00
41	40	门店列表	2	material:shop:list	/materials/list	pages/materials/MaterialShopList		1	t	1	2025-12-28 09:38:28.242177+00	2025-12-28 09:38:28.242177+00
42	40	查看门店	3	material:shop:view				0	t	1	2025-12-28 09:38:28.248508+00	2025-12-28 09:38:28.248508+00
43	40	创建门店	3	material:shop:create				0	t	1	2025-12-28 09:38:28.254843+00	2025-12-28 09:38:28.254843+00
44	40	编辑门店	3	material:shop:edit				0	t	1	2025-12-28 09:38:28.260697+00	2025-12-28 09:38:28.260697+00
45	40	删除门店	3	material:shop:delete				0	t	1	2025-12-28 09:38:28.266418+00	2025-12-28 09:38:28.266418+00
46	40	认证审核	2	material:audit:list	/materials/audit	pages/audits/MaterialShopAudit		2	t	1	2025-12-28 09:38:28.272339+00	2025-12-28 09:38:28.272339+00
47	40	查看门店审核	3	material:audit:view				0	t	1	2025-12-28 09:38:28.27816+00	2025-12-28 09:38:28.27816+00
48	40	门店审核通过	3	material:audit:approve				0	t	1	2025-12-28 09:38:28.285065+00	2025-12-28 09:38:28.285065+00
49	40	门店审核拒绝	3	material:audit:reject				0	t	1	2025-12-28 09:38:28.290346+00	2025-12-28 09:38:28.290346+00
50	0	项目管理	1		/projects		ProjectOutlined	40	t	1	2025-12-28 09:38:28.296136+00	2025-12-28 09:38:28.296136+00
51	50	工地列表	2	project:list	/projects/list	pages/projects/list		1	t	1	2025-12-28 09:38:28.302513+00	2025-12-28 09:38:28.302513+00
52	50	查看项目	3	project:view				0	t	1	2025-12-28 09:38:28.308887+00	2025-12-28 09:38:28.308887+00
53	50	编辑项目	3	project:edit				0	t	1	2025-12-28 09:38:28.31453+00	2025-12-28 09:38:28.31453+00
54	50	删除项目	3	project:delete				0	t	1	2025-12-28 09:38:28.320329+00	2025-12-28 09:38:28.320329+00
55	50	全景地图	2	project:map	/projects/map	pages/projects/ProjectMap		2	t	1	2025-12-28 09:38:28.326528+00	2025-12-28 09:38:28.326528+00
70	0	资金中心	1		/finance		BankOutlined	60	t	1	2025-12-28 09:38:28.362369+00	2025-12-28 09:38:28.362369+00
71	70	托管账户	2	finance:escrow:list	/finance/escrow	pages/finance/EscrowAccountList		1	t	1	2025-12-28 09:38:28.368616+00	2025-12-28 09:38:28.368616+00
72	70	查看账户	3	finance:escrow:view				0	t	1	2025-12-28 09:38:28.374478+00	2025-12-28 09:38:28.374478+00
73	70	冻结账户	3	finance:escrow:freeze				0	t	1	2025-12-28 09:38:28.380413+00	2025-12-28 09:38:28.380413+00
74	70	解冻账户	3	finance:escrow:unfreeze				0	t	1	2025-12-28 09:38:28.386118+00	2025-12-28 09:38:28.386118+00
75	70	交易记录	2	finance:transaction:list	/finance/transactions	pages/finance/TransactionList		2	t	1	2025-12-28 09:38:28.392636+00	2025-12-28 09:38:28.392636+00
76	70	查看交易	3	finance:transaction:view				0	t	1	2025-12-28 09:38:28.398349+00	2025-12-28 09:38:28.398349+00
77	70	导出交易	3	finance:transaction:export				0	t	1	2025-12-28 09:38:28.404189+00	2025-12-28 09:38:28.404189+00
78	70	审批交易	3	finance:transaction:approve				0	t	1	2025-12-28 09:38:28.409978+00	2025-12-28 09:38:28.409978+00
90	0	风控中心	1		/risk		SafetyOutlined	80	t	1	2025-12-28 09:38:28.441281+00	2025-12-28 09:38:28.441281+00
91	90	风险预警	2	risk:warning:list	/risk/warnings	pages/risk/RiskWarningList		1	t	1	2025-12-28 09:38:28.446011+00	2025-12-28 09:38:28.446011+00
92	90	查看预警	3	risk:warning:view				0	t	1	2025-12-28 09:38:28.452731+00	2025-12-28 09:38:28.452731+00
93	90	处理风险	3	risk:warning:handle				0	t	1	2025-12-28 09:38:28.458216+00	2025-12-28 09:38:28.458216+00
94	90	忽略风险	3	risk:warning:ignore				0	t	1	2025-12-28 09:38:28.463919+00	2025-12-28 09:38:28.463919+00
95	90	仲裁中心	2	risk:arbitration:list	/risk/arbitration	pages/risk/ArbitrationCenter		2	t	1	2025-12-28 09:38:28.470326+00	2025-12-28 09:38:28.470326+00
96	90	查看仲裁	3	risk:arbitration:view				0	t	1	2025-12-28 09:38:28.476063+00	2025-12-28 09:38:28.476063+00
97	90	受理仲裁	3	risk:arbitration:accept				0	t	1	2025-12-28 09:38:28.481976+00	2025-12-28 09:38:28.481976+00
98	90	驳回仲裁	3	risk:arbitration:reject				0	t	1	2025-12-28 09:38:28.488135+00	2025-12-28 09:38:28.488135+00
99	90	裁决仲裁	3	risk:arbitration:judge				0	t	1	2025-12-28 09:38:28.493799+00	2025-12-28 09:38:28.493799+00
120	0	权限管理	1		/permission		LockOutlined	110	t	1	2025-12-28 09:38:28.524195+00	2025-12-28 09:38:28.524195+00
121	120	角色管理	2	system:role:list	/permission/roles	pages/permission/RoleList		1	t	1	2025-12-28 09:38:28.53012+00	2025-12-28 09:38:28.53012+00
122	120	创建角色	3	system:role:create				0	t	1	2025-12-28 09:38:28.536421+00	2025-12-28 09:38:28.536421+00
123	120	编辑角色	3	system:role:edit				0	t	1	2025-12-28 09:38:28.542863+00	2025-12-28 09:38:28.542863+00
124	120	删除角色	3	system:role:delete				0	t	1	2025-12-28 09:38:28.548823+00	2025-12-28 09:38:28.548823+00
125	120	分配权限	3	system:role:assign				0	t	1	2025-12-28 09:38:28.557183+00	2025-12-28 09:38:28.557183+00
126	120	菜单管理	2	system:menu:list	/permission/menus	pages/permission/MenuList		2	t	1	2025-12-28 09:38:28.563486+00	2025-12-28 09:38:28.563486+00
127	120	创建菜单	3	system:menu:create				0	t	1	2025-12-28 09:38:28.568744+00	2025-12-28 09:38:28.568744+00
128	120	编辑菜单	3	system:menu:edit				0	t	1	2025-12-28 09:38:28.57523+00	2025-12-28 09:38:28.57523+00
129	120	删除菜单	3	system:menu:delete				0	t	1	2025-12-28 09:38:28.580973+00	2025-12-28 09:38:28.580973+00
100	0	操作日志	1	system:log:list	/logs	pages/system/LogList	FileTextOutlined	90	t	1	2025-12-28 09:38:28.500149+00	2025-12-28 09:38:28.500149+00
110	0	系统设置	1	system:setting:list	/settings	pages/settings/SystemSettings	SettingOutlined	100	t	1	2025-12-28 09:38:28.512155+00	2025-12-28 09:38:28.512155+00
61	134	查看预约	3	booking:view				0	t	1	2025-12-28 09:38:28.338799+00	2025-12-28 09:38:28.338799+00
62	134	创建预约	3	booking:create				0	t	1	2025-12-28 09:38:28.344988+00	2025-12-28 09:38:28.344988+00
63	134	编辑预约	3	booking:edit				0	t	1	2025-12-28 09:38:28.35074+00	2025-12-28 09:38:28.35074+00
64	134	取消预约	3	booking:cancel				0	t	1	2025-12-28 09:38:28.356542+00	2025-12-28 09:38:28.356542+00
135	80	评价列表	2	review:list	/reviews/list	pages/reviews/ReviewList	StarOutlined	0	t	1	2025-12-29 15:08:39.384445+00	2025-12-29 15:08:39.384445+00
81	135	查看评价	3	review:view				0	t	1	2025-12-28 09:38:28.422146+00	2025-12-28 09:38:28.422146+00
82	135	删除评价	3	review:delete				0	t	1	2025-12-28 09:38:28.42848+00	2025-12-28 09:38:28.42848+00
83	135	隐藏评价	3	review:hide				0	t	1	2025-12-28 09:38:28.434284+00	2025-12-28 09:38:28.434284+00
101	136	查看日志	3	system:log:view				0	t	1	2025-12-28 09:38:28.505905+00	2025-12-28 09:38:28.505905+00
137	110	系统配置	2	system:setting:list	/settings/config	pages/settings/SystemSettings	SettingOutlined	0	t	1	2025-12-29 15:08:55.074104+00	2025-12-29 15:08:55.074104+00
111	137	编辑设置	3	system:setting:edit				0	t	1	2025-12-28 09:38:28.517882+00	2025-12-28 09:38:28.517882+00
139	138	查看详情	3	booking:dispute:detail				1	t	1	2025-12-31 07:15:42.735711+00	2025-12-31 07:15:42.735711+00
140	138	处理争议	3	booking:dispute:resolve				2	t	1	2025-12-31 07:15:42.735711+00	2025-12-31 07:15:42.735711+00
143	0	作品管理	1	system:case:list	/cases	Layout	FileImageOutlined	50	t	1	2026-01-01 08:33:22.235696+00	2026-01-01 08:33:22.235696+00
144	143	作品列表	2	system:case:view	/cases/manage	/cases/CaseManagement	UnorderedListOutlined	1	t	1	2026-01-01 08:33:22.235696+00	2026-01-01 08:33:22.235696+00
\.


--
-- Data for Name: sys_operation_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_operation_logs (id, admin_id, admin_name, module, action, method, path, ip, user_agent, params, result, status, duration, created_at) FROM stdin;
\.


--
-- Data for Name: sys_role_menus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_role_menus (role_id, menu_id) FROM stdin;
8	1
8	10
8	11
8	12
8	13
8	14
8	15
8	20
8	21
8	22
8	23
8	24
8	25
8	26
8	27
8	28
8	29
8	30
8	31
8	32
8	33
8	34
8	35
8	36
8	37
8	38
8	39
8	40
8	41
8	42
8	43
8	44
8	45
8	46
8	47
8	48
8	49
8	50
8	51
8	52
8	53
8	54
8	55
8	60
8	61
8	62
8	63
8	64
8	70
8	71
8	72
8	73
8	74
8	75
8	76
8	77
8	78
8	80
8	81
8	82
8	83
8	90
8	91
8	92
8	93
8	94
8	95
8	96
8	97
8	98
8	99
8	100
8	101
8	110
8	111
8	120
1	134
1	136
1	135
1	137
1	1
1	10
1	11
1	12
1	13
1	14
1	15
1	16
1	17
1	18
1	19
1	20
1	21
1	22
1	23
1	24
1	25
1	26
1	27
1	28
1	29
1	30
1	31
1	32
1	33
1	34
1	35
1	36
1	37
1	38
1	39
1	40
1	41
1	42
1	43
1	44
1	45
1	46
1	47
1	48
1	49
1	50
1	51
1	52
1	53
1	54
1	55
1	60
1	61
1	62
1	63
1	64
1	70
1	71
1	72
1	73
1	74
1	75
1	76
1	77
1	78
1	80
1	81
1	82
1	83
1	90
1	91
1	92
1	93
1	94
1	95
1	96
1	97
1	98
1	99
1	100
1	101
1	110
1	111
1	120
1	121
1	122
1	123
1	124
1	125
1	126
1	127
1	128
1	129
1	131
1	132
1	133
1	138
1	141
8	141
2	1
2	10
2	11
2	12
2	15
2	20
2	21
2	22
2	23
2	24
2	25
2	26
2	27
2	28
2	29
2	30
2	31
2	32
2	33
2	34
2	35
2	40
2	41
2	42
2	43
2	44
2	45
2	50
2	51
2	52
2	53
2	55
2	80
2	81
3	1
3	10
3	11
3	12
3	20
3	21
3	22
3	26
3	27
3	31
3	32
3	36
3	37
3	38
3	39
3	40
3	46
3	47
3	48
3	49
3	60
3	61
3	62
3	63
3	64
3	80
3	81
3	82
3	83
4	1
4	10
4	11
4	12
4	50
4	51
4	52
4	70
4	71
4	72
4	73
4	74
4	75
4	76
4	77
4	78
5	1
5	10
5	11
5	12
5	50
5	51
5	52
5	90
5	91
5	92
5	93
5	94
5	95
5	96
5	97
5	98
5	99
6	1
6	10
6	11
6	12
6	13
6	20
6	21
6	22
6	26
6	27
6	31
6	32
6	60
6	61
6	62
6	63
6	64
6	80
6	81
7	1
7	10
7	11
7	12
7	15
7	20
7	21
7	22
7	26
7	27
7	31
7	32
7	40
7	41
7	42
7	50
7	51
7	52
7	55
7	60
7	61
7	70
7	71
7	72
7	75
7	76
7	77
7	80
7	81
7	90
7	91
7	92
7	95
7	96
7	100
7	101
1	143
1	144
8	143
8	144
\.


--
-- Data for Name: sys_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sys_roles (id, name, key, remark, sort, status, created_at, updated_at) FROM stdin;
1	超级管理员	super_admin	系统超级管理员，拥有所有权限	0	1	2025-12-28 09:38:28.590278+00	2025-12-28 09:38:28.590278+00
2	产品管理	product_manager	负责产品数据维护、服务商/门店管理	10	1	2025-12-28 09:38:28.596596+00	2025-12-28 09:38:28.596596+00
3	运营管理	operations	负责审核、内容管理、用户管理	20	1	2025-12-28 09:38:28.602497+00	2025-12-28 09:38:28.602497+00
4	财务管理	finance	负责资金管理、交易审核	30	1	2025-12-28 09:38:28.608445+00	2025-12-28 09:38:28.608445+00
5	风控管理	risk	负责风险预警、纠纷仲裁	40	1	2025-12-28 09:38:28.614361+00	2025-12-28 09:38:28.614361+00
6	客服	customer_service	处理用户咨询、预约管理	50	1	2025-12-28 09:38:28.620617+00	2025-12-28 09:38:28.620617+00
7	只读用户	viewer	数据分析、报表查看	60	1	2025-12-28 09:38:28.626453+00	2025-12-28 09:38:28.626453+00
8	管理员	admin	系统管理员，拥有除超级管理员外的所有权限	5	1	2025-12-28 12:43:50.92701+00	2025-12-28 12:43:50.92701+00
\.


--
-- Data for Name: system_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_configs (id, created_at, updated_at, key, value, type, description, editable) FROM stdin;
1	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	fee.platform.intent_fee_rate	0	number	意向金抽成比例（0-1，默认0表示不抽成）	t
2	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	fee.platform.design_fee_rate	0.10	number	设计费抽成比例（0-1，默认10%）	t
3	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	fee.platform.construction_fee_rate	0.10	number	施工费抽成比例（0-1，默认10%）	t
4	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	fee.platform.material_fee_rate	0.05	number	材料费抽成比例（0-1，默认5%）	t
5	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	withdraw.min_amount	100	number	最小提现金额（元）	t
6	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	withdraw.fee	0	number	提现手续费（元，固定金额）	t
7	2025-12-30 11:52:09.27108+00	2025-12-30 11:52:09.27108+00	settlement.auto_days	7	number	自动结算天数（订单完成后多少天可提现）	t
10	2025-12-31 15:16:03.426552+00	2025-12-31 15:30:39.455399+00	im.tencent_enabled	true	boolean	是否启用腾讯云 IM	t
8	2025-12-31 15:16:03.426552+00	2025-12-31 15:30:39.460188+00	im.tencent_sdk_app_id	1600120547	string	腾讯云 IM SDKAppID	t
9	2025-12-31 15:16:03.426552+00	2025-12-31 15:30:39.482158+00	im.tencent_secret_key	56210cab92b337ee8508bb084acc7fd97cb41b22b36256d6f828e09e66509abe	string	腾讯云 IM SecretKey	t
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (id, created_at, updated_at, key, value, description, category) FROM stdin;
58	2025-12-30 15:30:45.358448+00	2025-12-31 10:17:50.663983+00	im_tencent_enabled	true	是否启用腾讯云IM	im
59	2025-12-30 15:30:45.358448+00	2025-12-31 10:17:50.667563+00	im_tencent_sdk_app_id	1600120547	腾讯云IM SDKAppID	im
60	2025-12-30 15:30:45.358448+00	2025-12-31 10:17:50.671595+00	im_tencent_secret_key	56210cab92b337ee8508bb084acc7fd97cb41b22b36256d6f828e09e66509abe	腾讯云IM SecretKey	im
44	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	enable_registration	true	是否允许用户注册	security
45	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	enable_sms_verify	true	是否开启短信验证	security
46	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	enable_email_verify	false	是否开启邮箱验证	security
47	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	wechat_app_id		微信支付AppID	payment
48	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	wechat_mch_id		微信支付商户号	payment
49	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	wechat_api_key		微信支付API密钥	payment
50	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	alipay_app_id		支付宝AppID	payment
51	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	alipay_private_key		支付宝应用私钥	payment
52	2025-12-30 15:30:45.358448+00	2025-12-30 15:30:45.358448+00	alipay_public_key		支付宝公钥	payment
39	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.433896+00	site_name	家装管理平台	网站名称	basic
40	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.437772+00	site_description	专业的家装服务管理系统	网站描述	basic
53	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.441971+00	sms_provider		短信服务商	sms
54	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.446344+00	sms_access_key		短信服务AccessKey	sms
57	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.449762+00	sms_template_id		短信模板ID	sms
41	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.463775+00	contact_email	support@example.com	联系邮箱	basic
42	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.467876+00	contact_phone	400-888-8888	联系电话	basic
43	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.471964+00	icp	京ICP备12345678号	ICP备案号	basic
55	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.47647+00	sms_secret_key		短信服务SecretKey	sms
56	2025-12-30 15:30:45.358448+00	2025-12-31 15:30:39.479587+00	sms_sign_name		短信签名	sms
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, created_at, updated_at, escrow_id, milestone_id, type, amount, from_user_id, to_user_id, status, completed_at, order_id, from_account, to_account, remark) FROM stdin;
\.


--
-- Data for Name: user_favorites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_favorites (id, created_at, updated_at, user_id, target_id, target_type) FROM stdin;
\.


--
-- Data for Name: user_follows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_follows (id, created_at, updated_at, user_id, target_id, target_type) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, created_at, updated_at, phone, nickname, avatar, password, user_type, status, login_failed_count, locked_until, last_failed_login_at) FROM stdin;
1	2025-12-19 03:41:53.855212+00	2025-12-19 03:41:53.855212+00	13800138000	用户8000			1	1	0	\N	\N
2	2025-12-26 15:19:32.956141+00	2025-12-26 15:19:32.956141+00	13800138001	用户8001			1	1	0	\N	\N
3	2025-12-30 11:55:33.158708+00	2025-12-30 11:55:33.158708+00	13900139001	金牌设计师			2	1	0	\N	\N
90001	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13800000001	张明远	https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200		2	1	0	\N	\N
90002	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13800000002	李雅婷	https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200		2	1	0	\N	\N
90003	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13800000003	王建国	https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200		2	1	0	\N	\N
90005	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13800000005	刘伟强	https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200		2	1	0	\N	\N
90006	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13800000006	周晓燕	https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200		2	1	0	\N	\N
90004	2025-12-22 06:50:31.272993+00	2026-01-01 10:34:13.289147+00	13800000004	陈思琪	https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200		2	1	0	\N	\N
90012	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13900000002	张电工	https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=200		3	1	0	\N	\N
90021	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13700000001	匠心装修	https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?q=80&w=200		2	1	0	\N	\N
90022	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13700000002	鑫盛建筑	https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=200		2	1	0	\N	\N
90011	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13900000001	李胜利	https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200		3	1	0	\N	\N
90013	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13900000003	王思源	https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=200		3	1	0	\N	\N
90014	2025-12-22 06:50:31.272993+00	2025-12-22 06:50:31.272993+00	13900000004	刘进步	https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=200		3	1	0	\N	\N
\.


--
-- Data for Name: work_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_logs (id, created_at, updated_at, project_id, worker_id, log_date, description, photos, ai_analysis, is_compliant, issues, phase_id, created_by, title) FROM stdin;
\.


--
-- Data for Name: workers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workers (id, created_at, updated_at, user_id, skill_type, origin, cert_water, cert_height, hourly_rate, insured, latitude, longitude, available) FROM stdin;
\.


--
-- Name: admin_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_logs_id_seq', 81, true);


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 5, true);


--
-- Name: after_sales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.after_sales_id_seq', 1, false);


--
-- Name: arbitrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.arbitrations_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bookings_id_seq', 5, true);


--
-- Name: case_audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.case_audits_id_seq', 7, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 20, true);


--
-- Name: escrow_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.escrow_accounts_id_seq', 1, false);


--
-- Name: material_shop_audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.material_shop_audits_id_seq', 2, true);


--
-- Name: material_shops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.material_shops_id_seq', 66, true);


--
-- Name: merchant_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchant_applications_id_seq', 1, false);


--
-- Name: merchant_bank_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchant_bank_accounts_id_seq', 1, false);


--
-- Name: merchant_incomes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchant_incomes_id_seq', 1, true);


--
-- Name: merchant_service_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchant_service_settings_id_seq', 1, false);


--
-- Name: merchant_withdraws_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchant_withdraws_id_seq', 1, false);


--
-- Name: milestones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.milestones_id_seq', 4, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 5, true);


--
-- Name: payment_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_plans_id_seq', 4, true);


--
-- Name: phase_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.phase_tasks_id_seq', 20, true);


--
-- Name: project_phases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.project_phases_id_seq', 7, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.projects_id_seq', 3, true);


--
-- Name: proposals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.proposals_id_seq', 1, true);


--
-- Name: provider_audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.provider_audits_id_seq', 3, true);


--
-- Name: provider_cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.provider_cases_id_seq', 36, true);


--
-- Name: provider_reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.provider_reviews_id_seq', 54, true);


--
-- Name: providers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.providers_id_seq', 1, true);


--
-- Name: risk_warnings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.risk_warnings_id_seq', 1, false);


--
-- Name: sys_admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sys_admins_id_seq', 20, true);


--
-- Name: sys_menus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sys_menus_id_seq', 144, true);


--
-- Name: sys_operation_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sys_operation_logs_id_seq', 1, false);


--
-- Name: sys_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sys_roles_id_seq', 1, true);


--
-- Name: system_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_configs_id_seq', 10, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 60, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1, false);


--
-- Name: user_favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_favorites_id_seq', 6, true);


--
-- Name: user_follows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_follows_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: work_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_logs_id_seq', 1, false);


--
-- Name: workers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workers_id_seq', 1, false);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: after_sales after_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.after_sales
    ADD CONSTRAINT after_sales_pkey PRIMARY KEY (id);


--
-- Name: arbitrations arbitrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arbitrations
    ADD CONSTRAINT arbitrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: case_audits case_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.case_audits
    ADD CONSTRAINT case_audits_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: escrow_accounts escrow_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escrow_accounts
    ADD CONSTRAINT escrow_accounts_pkey PRIMARY KEY (id);


--
-- Name: material_shop_audits material_shop_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_shop_audits
    ADD CONSTRAINT material_shop_audits_pkey PRIMARY KEY (id);


--
-- Name: material_shops material_shops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_shops
    ADD CONSTRAINT material_shops_pkey PRIMARY KEY (id);


--
-- Name: merchant_applications merchant_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_applications
    ADD CONSTRAINT merchant_applications_pkey PRIMARY KEY (id);


--
-- Name: merchant_bank_accounts merchant_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_bank_accounts
    ADD CONSTRAINT merchant_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: merchant_incomes merchant_incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_incomes
    ADD CONSTRAINT merchant_incomes_pkey PRIMARY KEY (id);


--
-- Name: merchant_service_settings merchant_service_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_service_settings
    ADD CONSTRAINT merchant_service_settings_pkey PRIMARY KEY (id);


--
-- Name: merchant_withdraws merchant_withdraws_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_withdraws
    ADD CONSTRAINT merchant_withdraws_pkey PRIMARY KEY (id);


--
-- Name: milestones milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: phase_tasks phase_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.phase_tasks
    ADD CONSTRAINT phase_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_phases project_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_phases
    ADD CONSTRAINT project_phases_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: provider_audits provider_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_audits
    ADD CONSTRAINT provider_audits_pkey PRIMARY KEY (id);


--
-- Name: provider_cases provider_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_cases
    ADD CONSTRAINT provider_cases_pkey PRIMARY KEY (id);


--
-- Name: provider_reviews provider_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_reviews
    ADD CONSTRAINT provider_reviews_pkey PRIMARY KEY (id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: risk_warnings risk_warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_warnings
    ADD CONSTRAINT risk_warnings_pkey PRIMARY KEY (id);


--
-- Name: sys_admin_roles sys_admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_admin_roles
    ADD CONSTRAINT sys_admin_roles_pkey PRIMARY KEY (admin_id, role_id);


--
-- Name: sys_admins sys_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_admins
    ADD CONSTRAINT sys_admins_pkey PRIMARY KEY (id);


--
-- Name: sys_menus sys_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_menus
    ADD CONSTRAINT sys_menus_pkey PRIMARY KEY (id);


--
-- Name: sys_operation_logs sys_operation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_operation_logs
    ADD CONSTRAINT sys_operation_logs_pkey PRIMARY KEY (id);


--
-- Name: sys_role_menus sys_role_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_role_menus
    ADD CONSTRAINT sys_role_menus_pkey PRIMARY KEY (role_id, menu_id);


--
-- Name: sys_roles sys_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_roles
    ADD CONSTRAINT sys_roles_pkey PRIMARY KEY (id);


--
-- Name: system_configs system_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_key UNIQUE (order_id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_favorites user_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_favorites
    ADD CONSTRAINT user_favorites_pkey PRIMARY KEY (id);


--
-- Name: user_follows user_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_logs work_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_logs
    ADD CONSTRAINT work_logs_pkey PRIMARY KEY (id);


--
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_logs_admin_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs USING btree (admin_id);


--
-- Name: idx_admins_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_admins_phone ON public.admins USING btree (phone);


--
-- Name: idx_admins_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_admins_username ON public.admins USING btree (username);


--
-- Name: idx_after_sales_booking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_after_sales_booking_id ON public.after_sales USING btree (booking_id);


--
-- Name: idx_after_sales_order_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_after_sales_order_no ON public.after_sales USING btree (order_no);


--
-- Name: idx_after_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_after_sales_user_id ON public.after_sales USING btree (user_id);


--
-- Name: idx_arbitrations_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_arbitrations_project_id ON public.arbitrations USING btree (project_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_operator_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_operator_id ON public.audit_logs USING btree (operator_id);


--
-- Name: idx_audit_logs_operator_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_operator_type ON public.audit_logs USING btree (operator_type);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource);


--
-- Name: idx_bookings_merchant_deadline; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_merchant_deadline ON public.bookings USING btree (merchant_response_deadline) WHERE ((status = 1) AND (intent_fee_paid = true) AND (intent_fee_refunded = false));


--
-- Name: idx_bookings_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_provider_id ON public.bookings USING btree (provider_id);


--
-- Name: idx_bookings_refund_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_refund_status ON public.bookings USING btree (intent_fee_refunded) WHERE (intent_fee_paid = true);


--
-- Name: idx_bookings_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookings_user_id ON public.bookings USING btree (user_id);


--
-- Name: idx_case_audits_case_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_case_audits_case_id ON public.case_audits USING btree (case_id);


--
-- Name: idx_case_audits_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_case_audits_provider ON public.case_audits USING btree (provider_id);


--
-- Name: idx_case_audits_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_case_audits_status ON public.case_audits USING btree (status);


--
-- Name: idx_chat_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages USING btree (conversation_id);


--
-- Name: idx_chat_messages_receiver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_receiver_id ON public.chat_messages USING btree (receiver_id);


--
-- Name: idx_chat_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages USING btree (sender_id);


--
-- Name: idx_conversations_user1_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user1_id ON public.conversations USING btree (user1_id);


--
-- Name: idx_conversations_user2_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user2_id ON public.conversations USING btree (user2_id);


--
-- Name: idx_escrow_accounts_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_escrow_accounts_project_id ON public.escrow_accounts USING btree (project_id);


--
-- Name: idx_escrow_accounts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_escrow_accounts_user_id ON public.escrow_accounts USING btree (user_id);


--
-- Name: idx_material_shop_audits_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_material_shop_audits_shop_id ON public.material_shop_audits USING btree (shop_id);


--
-- Name: idx_merchant_applications_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_applications_phone ON public.merchant_applications USING btree (phone);


--
-- Name: idx_merchant_applications_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_applications_provider_id ON public.merchant_applications USING btree (provider_id);


--
-- Name: idx_merchant_applications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_applications_user_id ON public.merchant_applications USING btree (user_id);


--
-- Name: idx_merchant_bank_accounts_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_bank_accounts_provider_id ON public.merchant_bank_accounts USING btree (provider_id);


--
-- Name: idx_merchant_incomes_booking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_incomes_booking_id ON public.merchant_incomes USING btree (booking_id);


--
-- Name: idx_merchant_incomes_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_incomes_order_id ON public.merchant_incomes USING btree (order_id);


--
-- Name: idx_merchant_incomes_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_incomes_provider_id ON public.merchant_incomes USING btree (provider_id);


--
-- Name: idx_merchant_service_settings_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_merchant_service_settings_provider_id ON public.merchant_service_settings USING btree (provider_id);


--
-- Name: idx_merchant_withdraws_order_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_merchant_withdraws_order_no ON public.merchant_withdraws USING btree (order_no);


--
-- Name: idx_merchant_withdraws_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_withdraws_provider_id ON public.merchant_withdraws USING btree (provider_id);


--
-- Name: idx_milestones_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestones_project_id ON public.milestones USING btree (project_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, user_type);


--
-- Name: idx_orders_booking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_booking_id ON public.orders USING btree (booking_id);


--
-- Name: idx_orders_order_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_orders_order_no ON public.orders USING btree (order_no);


--
-- Name: idx_orders_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_project_id ON public.orders USING btree (project_id);


--
-- Name: idx_orders_proposal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_proposal_id ON public.orders USING btree (proposal_id);


--
-- Name: idx_payment_plans_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_plans_order_id ON public.payment_plans USING btree (order_id);


--
-- Name: idx_phase_tasks_phase_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_phase_tasks_phase_id ON public.phase_tasks USING btree (phase_id);


--
-- Name: idx_project_phases_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_phases_project_id ON public.project_phases USING btree (project_id);


--
-- Name: idx_projects_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_owner_id ON public.projects USING btree (owner_id);


--
-- Name: idx_projects_proposal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_proposal_id ON public.projects USING btree (proposal_id);


--
-- Name: idx_projects_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_provider_id ON public.projects USING btree (provider_id);


--
-- Name: idx_proposals_booking_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proposals_booking_id ON public.proposals USING btree (booking_id);


--
-- Name: idx_proposals_booking_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proposals_booking_version ON public.proposals USING btree (booking_id, version);


--
-- Name: idx_proposals_designer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proposals_designer_id ON public.proposals USING btree (designer_id);


--
-- Name: idx_proposals_parent_proposal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proposals_parent_proposal_id ON public.proposals USING btree (parent_proposal_id);


--
-- Name: idx_proposals_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proposals_submitted_at ON public.proposals USING btree (submitted_at);


--
-- Name: idx_provider_audits_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_provider_audits_provider_id ON public.provider_audits USING btree (provider_id);


--
-- Name: idx_provider_cases_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_provider_cases_provider_id ON public.provider_cases USING btree (provider_id);


--
-- Name: idx_provider_reviews_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_provider_reviews_provider_id ON public.provider_reviews USING btree (provider_id);


--
-- Name: idx_provider_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_provider_reviews_user_id ON public.provider_reviews USING btree (user_id);


--
-- Name: idx_providers_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_providers_user_id ON public.providers USING btree (user_id);


--
-- Name: idx_risk_warnings_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_warnings_project_id ON public.risk_warnings USING btree (project_id);


--
-- Name: idx_sys_admins_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_sys_admins_username ON public.sys_admins USING btree (username);


--
-- Name: idx_sys_menus_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sys_menus_parent_id ON public.sys_menus USING btree (parent_id);


--
-- Name: idx_sys_menus_permission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sys_menus_permission ON public.sys_menus USING btree (permission);


--
-- Name: idx_sys_operation_logs_admin_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sys_operation_logs_admin_id ON public.sys_operation_logs USING btree (admin_id);


--
-- Name: idx_sys_roles_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_sys_roles_key ON public.sys_roles USING btree (key);


--
-- Name: idx_system_configs_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_system_configs_key ON public.system_configs USING btree (key);


--
-- Name: idx_system_settings_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_system_settings_key ON public.system_settings USING btree (key);


--
-- Name: idx_transactions_escrow_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_escrow_id ON public.transactions USING btree (escrow_id);


--
-- Name: idx_transactions_from_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_from_user_id ON public.transactions USING btree (from_user_id);


--
-- Name: idx_transactions_milestone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_milestone_id ON public.transactions USING btree (milestone_id);


--
-- Name: idx_transactions_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_transactions_order_id ON public.transactions USING btree (order_id);


--
-- Name: idx_transactions_to_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_to_user_id ON public.transactions USING btree (to_user_id);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_user_favorite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_favorite ON public.user_favorites USING btree (user_id, target_id, target_type);


--
-- Name: idx_user_favorites_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_favorites_user_id ON public.user_favorites USING btree (user_id);


--
-- Name: idx_user_follow; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_follow ON public.user_follows USING btree (user_id, target_id, target_type);


--
-- Name: idx_user_follows_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_follows_user_id ON public.user_follows USING btree (user_id);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_work_logs_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_created_by ON public.work_logs USING btree (created_by);


--
-- Name: idx_work_logs_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_log_date ON public.work_logs USING btree (log_date);


--
-- Name: idx_work_logs_phase_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_phase_id ON public.work_logs USING btree (phase_id);


--
-- Name: idx_work_logs_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_project_id ON public.work_logs USING btree (project_id);


--
-- Name: idx_work_logs_worker_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_logs_worker_id ON public.work_logs USING btree (worker_id);


--
-- Name: idx_workers_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workers_user_id ON public.workers USING btree (user_id);


--
-- Name: phase_tasks fk_project_phases_tasks; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.phase_tasks
    ADD CONSTRAINT fk_project_phases_tasks FOREIGN KEY (phase_id) REFERENCES public.project_phases(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 5afDTts6TBzhbRFcWm8TadEGl44wTlXTxRBQDo6NKXGCrRhEhNLZH0MdjEs53f8
-- WARNING: 历史数据库快照，仅供参考/回溯，不是认证或商家入驻 schema 的权威来源。
-- 请使用 server/migrations/ 下的迁移，尤其是 server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql。

