--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: playstation_rental; Type: SCHEMA; Schema: -; Owner: dior
--

CREATE SCHEMA playstation_rental;


ALTER SCHEMA playstation_rental OWNER TO dior;

--
-- Name: ConsoleType; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."ConsoleType" AS ENUM (
    'PS3',
    'PS4',
    'PS5'
);


ALTER TYPE playstation_rental."ConsoleType" OWNER TO dior;

--
-- Name: CustomerRating; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."CustomerRating" AS ENUM (
    'TRUSTED',
    'NORMAL',
    'RISKY'
);


ALTER TYPE playstation_rental."CustomerRating" OWNER TO dior;

--
-- Name: DiscountType; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."DiscountType" AS ENUM (
    'PERCENT',
    'FIXED',
    'LOYALTY'
);


ALTER TYPE playstation_rental."DiscountType" OWNER TO dior;

--
-- Name: ExtensionStatus; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."ExtensionStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE playstation_rental."ExtensionStatus" OWNER TO dior;

--
-- Name: NotificationType; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."NotificationType" AS ENUM (
    'ORDER_CREATED',
    'ORDER_ACCEPTED',
    'ORDER_REJECTED',
    'COURIER_ON_WAY',
    'ORDER_DELIVERED',
    'RETURN_REMINDER',
    'ORDER_RETURNED',
    'ORDER_COMPLETED',
    'PROMO',
    'ADVERTISEMENT'
);


ALTER TYPE playstation_rental."NotificationType" OWNER TO dior;

--
-- Name: OrderStatus; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."OrderStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'ON_THE_WAY',
    'DELIVERED',
    'RETURN_REQUESTED',
    'RETURNED',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'COURIER_ASSIGNED',
    'ARRIVED'
);


ALTER TYPE playstation_rental."OrderStatus" OWNER TO dior;

--
-- Name: PaymentMethod; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."PaymentMethod" AS ENUM (
    'CASH',
    'CLICK'
);


ALTER TYPE playstation_rental."PaymentMethod" OWNER TO dior;

--
-- Name: PaymentStatus; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'UNPAID',
    'PARTIAL'
);


ALTER TYPE playstation_rental."PaymentStatus" OWNER TO dior;

--
-- Name: PlaystationStatus; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."PlaystationStatus" AS ENUM (
    'AVAILABLE',
    'RENTED',
    'MAINTENANCE',
    'MISSING_PARTS',
    'DEFECTIVE'
);


ALTER TYPE playstation_rental."PlaystationStatus" OWNER TO dior;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_campaigns; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.ad_campaigns (
    id integer NOT NULL,
    "adminId" integer NOT NULL,
    message text NOT NULL,
    "recipientCount" integer DEFAULT 0 NOT NULL,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.ad_campaigns OWNER TO dior;

--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.ad_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.ad_campaigns_id_seq OWNER TO dior;

--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.ad_campaigns_id_seq OWNED BY playstation_rental.ad_campaigns.id;


--
-- Name: admin_audit_logs; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.admin_audit_logs (
    id integer NOT NULL,
    "adminId" integer,
    "adminTelegramId" bigint,
    action character varying(255) NOT NULL,
    "entityType" character varying(255),
    "entityId" integer,
    "beforeData" jsonb,
    "afterData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    module character varying(128)
);


ALTER TABLE playstation_rental.admin_audit_logs OWNER TO dior;

--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.admin_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.admin_audit_logs_id_seq OWNER TO dior;

--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.admin_audit_logs_id_seq OWNED BY playstation_rental.admin_audit_logs.id;


--
-- Name: admins; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.admins (
    id integer NOT NULL,
    "telegramId" bigint NOT NULL,
    "fullName" text,
    role text DEFAULT 'admin'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.admins OWNER TO dior;

--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.admins_id_seq OWNER TO dior;

--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.admins_id_seq OWNED BY playstation_rental.admins.id;


--
-- Name: console_catalog; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.console_catalog (
    id integer NOT NULL,
    code text NOT NULL,
    "displayName" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.console_catalog OWNER TO dior;

--
-- Name: console_catalog_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.console_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.console_catalog_id_seq OWNER TO dior;

--
-- Name: console_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.console_catalog_id_seq OWNED BY playstation_rental.console_catalog.id;


--
-- Name: couriers; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.couriers (
    id integer NOT NULL,
    "telegramId" bigint NOT NULL,
    "fullName" text,
    phone text,
    region text,
    latitude double precision,
    longitude double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    username text,
    rating numeric(3,2) DEFAULT 5 NOT NULL
);


ALTER TABLE playstation_rental.couriers OWNER TO dior;

--
-- Name: couriers_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.couriers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.couriers_id_seq OWNER TO dior;

--
-- Name: couriers_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.couriers_id_seq OWNED BY playstation_rental.couriers.id;


--
-- Name: database_backups; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.database_backups (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    "filePath" text NOT NULL,
    "fileSize" bigint,
    "createdByAdminId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.database_backups OWNER TO dior;

--
-- Name: database_backups_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.database_backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.database_backups_id_seq OWNER TO dior;

--
-- Name: database_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.database_backups_id_seq OWNED BY playstation_rental.database_backups.id;


--
-- Name: delivery_zones; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.delivery_zones (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(255) NOT NULL,
    fee numeric(10,2) NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.delivery_zones OWNER TO dior;

--
-- Name: delivery_zones_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.delivery_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.delivery_zones_id_seq OWNER TO dior;

--
-- Name: delivery_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.delivery_zones_id_seq OWNED BY playstation_rental.delivery_zones.id;


--
-- Name: inventory_unit_history; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.inventory_unit_history (
    id integer NOT NULL,
    "inventoryUnitId" integer NOT NULL,
    action character varying(255) NOT NULL,
    "fromStatus" playstation_rental."PlaystationStatus",
    "toStatus" playstation_rental."PlaystationStatus",
    "orderId" integer,
    note text,
    "actorType" character varying(64),
    "actorId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.inventory_unit_history OWNER TO dior;

--
-- Name: inventory_unit_history_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.inventory_unit_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.inventory_unit_history_id_seq OWNER TO dior;

--
-- Name: inventory_unit_history_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.inventory_unit_history_id_seq OWNED BY playstation_rental.inventory_unit_history.id;


--
-- Name: inventory_units; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.inventory_units (
    id integer NOT NULL,
    "unitCode" character varying(255) NOT NULL,
    "consoleType" playstation_rental."ConsoleType" NOT NULL,
    status playstation_rental."PlaystationStatus" DEFAULT 'AVAILABLE'::playstation_rental."PlaystationStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "purchasedAt" timestamp(3) without time zone,
    "purchasePrice" numeric(10,2),
    "lastServiceAt" timestamp(3) without time zone,
    "adminNote" text
);


ALTER TABLE playstation_rental.inventory_units OWNER TO dior;

--
-- Name: inventory_units_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.inventory_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.inventory_units_id_seq OWNER TO dior;

--
-- Name: inventory_units_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.inventory_units_id_seq OWNED BY playstation_rental.inventory_units.id;


--
-- Name: notifications; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.notifications (
    id integer NOT NULL,
    "orderId" integer,
    type playstation_rental."NotificationType" NOT NULL,
    "recipientType" text NOT NULL,
    "recipientId" integer NOT NULL,
    "isSent" boolean DEFAULT false NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.notifications OWNER TO dior;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.notifications_id_seq OWNER TO dior;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.notifications_id_seq OWNED BY playstation_rental.notifications.id;


--
-- Name: order_payments; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.order_payments (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    method playstation_rental."PaymentMethod" DEFAULT 'CASH'::playstation_rental."PaymentMethod" NOT NULL,
    status playstation_rental."PaymentStatus" DEFAULT 'UNPAID'::playstation_rental."PaymentStatus" NOT NULL,
    "paidAt" timestamp(3) without time zone,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.order_payments OWNER TO dior;

--
-- Name: order_payments_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.order_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.order_payments_id_seq OWNER TO dior;

--
-- Name: order_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.order_payments_id_seq OWNED BY playstation_rental.order_payments.id;


--
-- Name: order_status_logs; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.order_status_logs (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    status playstation_rental."OrderStatus" NOT NULL,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actorType" text,
    "actorId" integer,
    note text
);


ALTER TABLE playstation_rental.order_status_logs OWNER TO dior;

--
-- Name: order_status_logs_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.order_status_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.order_status_logs_id_seq OWNER TO dior;

--
-- Name: order_status_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.order_status_logs_id_seq OWNED BY playstation_rental.order_status_logs.id;


--
-- Name: orders; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.orders (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "courierId" integer,
    "playstationId" integer,
    "promocodeId" integer,
    "consoleType" playstation_rental."ConsoleType" NOT NULL,
    address text NOT NULL,
    latitude double precision,
    longitude double precision,
    "startDatetime" timestamp(3) without time zone NOT NULL,
    "endDatetime" timestamp(3) without time zone NOT NULL,
    "totalPrice" numeric(10,2) NOT NULL,
    status playstation_rental."OrderStatus" DEFAULT 'PENDING'::playstation_rental."OrderStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "rentalPriceId" integer NOT NULL,
    "depositAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "assignedAt" timestamp(3) without time zone,
    "deliveryStartedAt" timestamp(3) without time zone,
    "deliveryCompletedAt" timestamp(3) without time zone,
    "assignedByAdmin" boolean DEFAULT false NOT NULL,
    "deliveryFee" numeric(10,2) DEFAULT 0 NOT NULL,
    "inventoryUnitId" integer,
    "deliveryZoneCode" character varying(64)
);


ALTER TABLE playstation_rental.orders OWNER TO dior;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.orders_id_seq OWNER TO dior;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.orders_id_seq OWNED BY playstation_rental.orders.id;


--
-- Name: payments; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.payments (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    method text DEFAULT 'cash'::text NOT NULL,
    status playstation_rental."PaymentStatus" DEFAULT 'PENDING'::playstation_rental."PaymentStatus" NOT NULL,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.payments OWNER TO dior;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.payments_id_seq OWNER TO dior;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.payments_id_seq OWNED BY playstation_rental.payments.id;


--
-- Name: playstations; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.playstations (
    id integer NOT NULL,
    "courierId" integer NOT NULL,
    type playstation_rental."ConsoleType" NOT NULL,
    "serialNumber" text NOT NULL,
    status playstation_rental."PlaystationStatus" DEFAULT 'AVAILABLE'::playstation_rental."PlaystationStatus" NOT NULL,
    accessories jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.playstations OWNER TO dior;

--
-- Name: playstations_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.playstations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.playstations_id_seq OWNER TO dior;

--
-- Name: playstations_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.playstations_id_seq OWNED BY playstation_rental.playstations.id;


--
-- Name: promocodes; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.promocodes (
    id integer NOT NULL,
    code text NOT NULL,
    "discountPercent" integer DEFAULT 0 NOT NULL,
    "usageLimit" integer NOT NULL,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "discountType" playstation_rental."DiscountType" DEFAULT 'PERCENT'::playstation_rental."DiscountType" NOT NULL,
    "discountAmount" numeric(10,2),
    "loyaltyMinOrders" integer,
    description text
);


ALTER TABLE playstation_rental.promocodes OWNER TO dior;

--
-- Name: promocodes_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.promocodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.promocodes_id_seq OWNER TO dior;

--
-- Name: promocodes_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.promocodes_id_seq OWNED BY playstation_rental.promocodes.id;


--
-- Name: rental_extensions; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.rental_extensions (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "extraHours" integer NOT NULL,
    "extraPrice" numeric(10,2) NOT NULL,
    status playstation_rental."ExtensionStatus" DEFAULT 'PENDING'::playstation_rental."ExtensionStatus" NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedByAdminId" integer,
    "previousEnd" timestamp(3) without time zone NOT NULL,
    "newEnd" timestamp(3) without time zone
);


ALTER TABLE playstation_rental.rental_extensions OWNER TO dior;

--
-- Name: rental_extensions_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.rental_extensions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.rental_extensions_id_seq OWNER TO dior;

--
-- Name: rental_extensions_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.rental_extensions_id_seq OWNED BY playstation_rental.rental_extensions.id;


--
-- Name: rental_prices; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.rental_prices (
    id integer NOT NULL,
    "consoleCatalogId" integer NOT NULL,
    hours integer NOT NULL,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'UZS'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.rental_prices OWNER TO dior;

--
-- Name: rental_prices_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.rental_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.rental_prices_id_seq OWNER TO dior;

--
-- Name: rental_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.rental_prices_id_seq OWNED BY playstation_rental.rental_prices.id;


--
-- Name: reviews; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.reviews (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "userId" integer NOT NULL,
    rating integer NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.reviews OWNER TO dior;

--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.reviews_id_seq OWNER TO dior;

--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.reviews_id_seq OWNED BY playstation_rental.reviews.id;


--
-- Name: system_settings; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.system_settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.system_settings OWNER TO dior;

--
-- Name: users; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.users (
    id integer NOT NULL,
    "telegramId" bigint NOT NULL,
    "fullName" text,
    phone text,
    "defaultAddress" text,
    latitude double precision,
    longitude double precision,
    "isBlocked" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    username text,
    "lastActivityAt" timestamp(3) without time zone,
    "customerRating" playstation_rental."CustomerRating" DEFAULT 'NORMAL'::playstation_rental."CustomerRating" NOT NULL,
    "adminNotes" text
);


ALTER TABLE playstation_rental.users OWNER TO dior;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.users_id_seq OWNER TO dior;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.users_id_seq OWNED BY playstation_rental.users.id;


--
-- Name: ad_campaigns id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.ad_campaigns ALTER COLUMN id SET DEFAULT nextval('playstation_rental.ad_campaigns_id_seq'::regclass);


--
-- Name: admin_audit_logs id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.admin_audit_logs ALTER COLUMN id SET DEFAULT nextval('playstation_rental.admin_audit_logs_id_seq'::regclass);


--
-- Name: admins id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.admins ALTER COLUMN id SET DEFAULT nextval('playstation_rental.admins_id_seq'::regclass);


--
-- Name: console_catalog id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.console_catalog ALTER COLUMN id SET DEFAULT nextval('playstation_rental.console_catalog_id_seq'::regclass);


--
-- Name: couriers id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.couriers ALTER COLUMN id SET DEFAULT nextval('playstation_rental.couriers_id_seq'::regclass);


--
-- Name: database_backups id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.database_backups ALTER COLUMN id SET DEFAULT nextval('playstation_rental.database_backups_id_seq'::regclass);


--
-- Name: delivery_zones id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.delivery_zones ALTER COLUMN id SET DEFAULT nextval('playstation_rental.delivery_zones_id_seq'::regclass);


--
-- Name: inventory_unit_history id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_unit_history ALTER COLUMN id SET DEFAULT nextval('playstation_rental.inventory_unit_history_id_seq'::regclass);


--
-- Name: inventory_units id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_units ALTER COLUMN id SET DEFAULT nextval('playstation_rental.inventory_units_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.notifications ALTER COLUMN id SET DEFAULT nextval('playstation_rental.notifications_id_seq'::regclass);


--
-- Name: order_payments id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_payments ALTER COLUMN id SET DEFAULT nextval('playstation_rental.order_payments_id_seq'::regclass);


--
-- Name: order_status_logs id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_status_logs ALTER COLUMN id SET DEFAULT nextval('playstation_rental.order_status_logs_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders ALTER COLUMN id SET DEFAULT nextval('playstation_rental.orders_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.payments ALTER COLUMN id SET DEFAULT nextval('playstation_rental.payments_id_seq'::regclass);


--
-- Name: playstations id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.playstations ALTER COLUMN id SET DEFAULT nextval('playstation_rental.playstations_id_seq'::regclass);


--
-- Name: promocodes id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.promocodes ALTER COLUMN id SET DEFAULT nextval('playstation_rental.promocodes_id_seq'::regclass);


--
-- Name: rental_extensions id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_extensions ALTER COLUMN id SET DEFAULT nextval('playstation_rental.rental_extensions_id_seq'::regclass);


--
-- Name: rental_prices id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_prices ALTER COLUMN id SET DEFAULT nextval('playstation_rental.rental_prices_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.reviews ALTER COLUMN id SET DEFAULT nextval('playstation_rental.reviews_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.users ALTER COLUMN id SET DEFAULT nextval('playstation_rental.users_id_seq'::regclass);


--
-- Data for Name: ad_campaigns; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.ad_campaigns (id, "adminId", message, "recipientCount", "sentAt") FROM stdin;
1	1	SALOM	2	2026-07-05 21:31:12.528
2	1	🚚 Kuryerlar	2	2026-07-05 21:31:31.78
3	1	📢 Reklama	1	2026-07-05 22:57:49.464
\.


--
-- Data for Name: admin_audit_logs; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.admin_audit_logs (id, "adminId", "adminTelegramId", action, "entityType", "entityId", "beforeData", "afterData", "createdAt", module) FROM stdin;
1	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 1, "consoleType": "PS3"}	{"count": 2, "message": "Admin PS3 sonini 1 tadan 2 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:31.556	\N
2	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 2, "consoleType": "PS3"}	{"count": 3, "message": "Admin PS3 sonini 2 tadan 3 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:34.899	\N
3	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 3, "consoleType": "PS3"}	{"count": 4, "message": "Admin PS3 sonini 3 tadan 4 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:37.276	\N
4	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 4, "consoleType": "PS3"}	{"count": 5, "message": "Admin PS3 sonini 4 tadan 5 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:39.504	\N
5	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 5, "consoleType": "PS3"}	{"count": 6, "message": "Admin PS3 sonini 5 tadan 6 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:49.152	\N
6	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 6, "consoleType": "PS3"}	{"count": 7, "message": "Admin PS3 sonini 6 tadan 7 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:50.687	\N
7	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 7, "consoleType": "PS3"}	{"count": 8, "message": "Admin PS3 sonini 7 tadan 8 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:26:52.438	\N
8	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 8, "consoleType": "PS3"}	{"count": 9, "message": "Admin PS3 sonini 8 tadan 9 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:27:02.569	\N
9	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 9, "consoleType": "PS3"}	{"count": 10, "message": "Admin PS3 sonini 9 tadan 10 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:27:03.569	\N
10	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 7, "consoleType": "PS4"}	{"count": 8, "message": "Admin PS4 sonini 7 tadan 8 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-05 22:27:04.614	\N
11	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 8, "consoleType": "PS4"}	{"count": 9, "message": "Admin PS4 sonini 8 tadan 9 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-05 22:27:05.739	\N
12	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 9, "consoleType": "PS4"}	{"count": 10, "message": "Admin PS4 sonini 9 tadan 10 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-05 22:27:06.559	\N
13	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 1, "consoleType": "PS5"}	{"count": 2, "message": "Admin PS5 sonini 1 tadan 2 taga o'zgartirdi", "consoleType": "PS5"}	2026-07-05 22:27:07.587	\N
14	1	8866189157	CUSTOMER_NOTES_UPDATED	User	4	\N	{"adminNotes": "Yaxwii"}	2026-07-05 22:55:45.462	CRM
15	1	8866189157	CUSTOMER_RATING_UPDATED	User	4	{"customerRating": "NORMAL"}	{"customerRating": "NORMAL"}	2026-07-05 22:55:48.325	CRM
16	1	8866189157	CUSTOMER_RATING_UPDATED	User	4	{"customerRating": "NORMAL"}	{"customerRating": "NORMAL"}	2026-07-05 22:55:51.088	CRM
17	1	8866189157	CUSTOMER_RATING_UPDATED	User	4	{"customerRating": "NORMAL"}	{"customerRating": "TRUSTED"}	2026-07-05 22:56:11.776	CRM
18	1	8866189157	CUSTOMER_RATING_UPDATED	User	4	{"customerRating": "TRUSTED"}	{"customerRating": "TRUSTED"}	2026-07-05 22:56:15.667	CRM
\.


--
-- Data for Name: admins; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.admins (id, "telegramId", "fullName", role, "createdAt") FROM stdin;
1	8866189157	Super Admin	superadmin	2026-07-05 21:01:28.55
2	222222222	Super Admin	superadmin	2026-07-05 21:01:28.558
\.


--
-- Data for Name: console_catalog; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.console_catalog (id, code, "displayName", "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
4	📊 STATISTIKA	📊 Statistika	t	0	2026-07-05 21:48:11.107	2026-07-05 21:48:11.107
1	PS3	PlayStation 3	t	1	2026-07-06 02:40:15.349	2026-07-05 22:53:10.409
2	PS4	PlayStation 4	t	2	2026-07-06 02:40:15.349	2026-07-05 22:53:10.435
3	PS5	PlayStation 5	t	3	2026-07-06 02:40:15.349	2026-07-05 22:53:10.452
\.


--
-- Data for Name: couriers; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.couriers (id, "telegramId", "fullName", phone, region, latitude, longitude, "isActive", "createdAt", username, rating) FROM stdin;
1	8866189157	Dior	\N	\N	\N	\N	t	2026-07-05 21:49:34.866	DiyorbekAzizbekovich	5.00
2	8127652025	JONNI	2233445566	\N	39.902043	66.264305	t	2026-07-05 21:53:04.685	\N	5.00
\.


--
-- Data for Name: database_backups; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.database_backups (id, filename, "filePath", "fileSize", "createdByAdminId", "createdAt") FROM stdin;
\.


--
-- Data for Name: delivery_zones; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.delivery_zones (id, code, name, fee, "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
1	CITY	Shahar ichida	30000.00	t	1	2026-07-06 03:53:10.204	2026-07-06 03:53:10.204
\.


--
-- Data for Name: inventory_unit_history; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.inventory_unit_history (id, "inventoryUnitId", action, "fromStatus", "toStatus", "orderId", note, "actorType", "actorId", "createdAt") FROM stdin;
\.


--
-- Data for Name: inventory_units; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.inventory_units (id, "unitCode", "consoleType", status, "createdAt", "updatedAt", "purchasedAt", "purchasePrice", "lastServiceAt", "adminNote") FROM stdin;
1	PS3-001	PS3	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
2	PS4-001	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
3	PS4-002	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
4	PS4-003	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
5	PS4-004	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
6	PS4-005	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
7	PS4-006	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
8	PS4-007	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
9	PS5-001	PS5	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
10	PS3-002	PS3	AVAILABLE	2026-07-05 22:26:31.554	2026-07-05 22:26:31.554	\N	\N	\N	\N
11	PS3-003	PS3	AVAILABLE	2026-07-05 22:26:34.896	2026-07-05 22:26:34.896	\N	\N	\N	\N
12	PS3-004	PS3	AVAILABLE	2026-07-05 22:26:37.275	2026-07-05 22:26:37.275	\N	\N	\N	\N
13	PS3-005	PS3	AVAILABLE	2026-07-05 22:26:39.503	2026-07-05 22:26:39.503	\N	\N	\N	\N
14	PS3-006	PS3	AVAILABLE	2026-07-05 22:26:49.151	2026-07-05 22:26:49.151	\N	\N	\N	\N
15	PS3-007	PS3	AVAILABLE	2026-07-05 22:26:50.686	2026-07-05 22:26:50.686	\N	\N	\N	\N
16	PS3-008	PS3	AVAILABLE	2026-07-05 22:26:52.436	2026-07-05 22:26:52.436	\N	\N	\N	\N
17	PS3-009	PS3	AVAILABLE	2026-07-05 22:27:02.568	2026-07-05 22:27:02.568	\N	\N	\N	\N
18	PS3-010	PS3	AVAILABLE	2026-07-05 22:27:03.568	2026-07-05 22:27:03.568	\N	\N	\N	\N
19	PS4-008	PS4	AVAILABLE	2026-07-05 22:27:04.613	2026-07-05 22:27:04.613	\N	\N	\N	\N
20	PS4-009	PS4	AVAILABLE	2026-07-05 22:27:05.738	2026-07-05 22:27:05.738	\N	\N	\N	\N
21	PS4-010	PS4	AVAILABLE	2026-07-05 22:27:06.558	2026-07-05 22:27:06.558	\N	\N	\N	\N
22	PS5-002	PS5	AVAILABLE	2026-07-05 22:27:07.585	2026-07-05 22:27:07.585	\N	\N	\N	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.notifications (id, "orderId", type, "recipientType", "recipientId", "isSent", "sentAt", "createdAt") FROM stdin;
1	\N	ADVERTISEMENT	user	1	t	2026-07-05 21:31:12.118	2026-07-05 21:31:12.119
2	\N	ADVERTISEMENT	user	2	t	2026-07-05 21:31:12.522	2026-07-05 21:31:12.523
3	\N	ADVERTISEMENT	user	1	t	2026-07-05 21:31:31.363	2026-07-05 21:31:31.364
4	\N	ADVERTISEMENT	user	2	t	2026-07-05 21:31:31.774	2026-07-05 21:31:31.776
5	6	ORDER_ACCEPTED	user	1	t	2026-07-05 21:50:54.638	2026-07-05 21:50:54.639
6	2	ORDER_ACCEPTED	user	1	t	2026-07-05 21:51:07.837	2026-07-05 21:51:07.838
7	3	ORDER_ACCEPTED	user	2	t	2026-07-05 21:56:47.512	2026-07-05 21:56:47.513
8	3	ORDER_CREATED	user	2	t	2026-07-05 21:56:56.004	2026-07-05 21:56:56.005
9	3	ORDER_CREATED	user	2	t	2026-07-05 21:57:00.015	2026-07-05 21:57:00.016
10	3	ORDER_CREATED	user	2	t	2026-07-05 21:57:02.778	2026-07-05 21:57:02.779
11	3	ORDER_CREATED	user	2	f	\N	2026-07-05 21:57:12.744
12	4	ORDER_CREATED	admin	1	t	2026-07-05 22:00:00.148	2026-07-05 22:00:00.15
13	4	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:00:00.304
14	5	ORDER_CREATED	admin	1	t	2026-07-05 22:00:00.436	2026-07-05 22:00:00.437
15	5	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:00:00.58
16	\N	ORDER_CREATED	admin	1	f	\N	2026-07-05 22:00:06.312
17	4	ORDER_CREATED	admin	1	t	2026-07-05 22:01:00.337	2026-07-05 22:01:00.339
18	4	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:01:00.646
19	5	ORDER_CREATED	admin	1	t	2026-07-05 22:01:00.846	2026-07-05 22:01:00.847
20	5	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:01:01.156
21	4	ORDER_ACCEPTED	user	2	t	2026-07-05 22:01:52.254	2026-07-05 22:01:52.255
24	4	ORDER_CREATED	user	2	t	2026-07-05 22:01:54.815	2026-07-05 22:01:54.816
25	4	ORDER_CREATED	admin	1	t	2026-07-05 22:01:55.126	2026-07-05 22:01:55.127
26	4	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:01:55.333
27	4	ORDER_CREATED	user	2	t	2026-07-05 22:01:57.68	2026-07-05 22:01:57.681
28	4	ORDER_CREATED	admin	1	t	2026-07-05 22:01:58.087	2026-07-05 22:01:58.089
29	4	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:01:58.428
30	4	ORDER_CREATED	user	2	t	2026-07-05 22:01:58.705	2026-07-05 22:01:58.706
31	4	ORDER_CREATED	admin	1	t	2026-07-05 22:01:59.025	2026-07-05 22:01:59.026
32	4	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:01:59.32
33	5	ORDER_CREATED	admin	1	t	2026-07-05 22:02:00.238	2026-07-05 22:02:00.239
34	5	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:02:00.652
35	5	ORDER_ACCEPTED	user	1	t	2026-07-05 22:02:20.925	2026-07-05 22:02:20.926
38	5	ORDER_CREATED	user	1	t	2026-07-05 22:02:29.015	2026-07-05 22:02:29.016
39	5	ORDER_CREATED	admin	1	t	2026-07-05 22:02:29.219	2026-07-05 22:02:29.22
40	5	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:02:29.424
41	5	ORDER_CREATED	user	1	t	2026-07-05 22:02:31.677	2026-07-05 22:02:31.678
42	5	ORDER_CREATED	admin	1	t	2026-07-05 22:02:31.814	2026-07-05 22:02:31.815
43	5	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:02:32.001
44	5	ORDER_CREATED	user	1	t	2026-07-05 22:02:32.299	2026-07-05 22:02:32.3
45	5	ORDER_CREATED	admin	1	t	2026-07-05 22:02:32.679	2026-07-05 22:02:32.681
46	5	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:02:33.024
47	7	ORDER_CREATED	admin	1	t	2026-07-05 22:06:39.897	2026-07-05 22:06:39.898
48	7	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:06:40.125
49	7	ORDER_CREATED	courier	2	t	2026-07-05 22:06:40.323	2026-07-05 22:06:40.324
50	7	ORDER_CREATED	courier	1	t	2026-07-05 22:06:40.612	2026-07-05 22:06:40.613
51	7	ORDER_ACCEPTED	user	1	t	2026-07-05 22:06:49.727	2026-07-05 22:06:49.728
54	7	ORDER_CREATED	user	1	t	2026-07-05 22:07:20.972	2026-07-05 22:07:20.973
55	7	ORDER_CREATED	admin	1	t	2026-07-05 22:07:21.265	2026-07-05 22:07:21.266
56	7	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:07:21.533
57	7	ORDER_CREATED	user	1	t	2026-07-05 22:07:30.484	2026-07-05 22:07:30.485
58	7	ORDER_CREATED	admin	1	t	2026-07-05 22:07:31.181	2026-07-05 22:07:31.182
59	7	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:07:31.508
60	7	ORDER_CREATED	user	1	t	2026-07-05 22:07:31.712	2026-07-05 22:07:31.713
61	7	ORDER_CREATED	admin	1	t	2026-07-05 22:07:32.017	2026-07-05 22:07:32.018
62	7	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:07:32.225
63	8	ORDER_CREATED	admin	1	t	2026-07-05 22:14:08.103	2026-07-05 22:14:08.104
64	8	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:14:08.339
65	8	ORDER_CREATED	courier	2	t	2026-07-05 22:14:08.514	2026-07-05 22:14:08.515
66	8	ORDER_CREATED	courier	1	t	2026-07-05 22:14:09.124	2026-07-05 22:14:09.126
67	8	ORDER_ACCEPTED	user	1	t	2026-07-05 22:14:15.781	2026-07-05 22:14:15.782
70	8	ORDER_CREATED	user	1	t	2026-07-05 22:15:26.981	2026-07-05 22:15:26.982
71	8	ORDER_CREATED	admin	1	t	2026-07-05 22:15:27.152	2026-07-05 22:15:27.153
72	8	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:15:27.307
73	8	ORDER_CREATED	user	1	t	2026-07-05 22:15:28.588	2026-07-05 22:15:28.589
74	8	ORDER_CREATED	admin	1	t	2026-07-05 22:15:28.742	2026-07-05 22:15:28.743
75	8	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:15:28.876
76	8	ORDER_CREATED	user	1	t	2026-07-05 22:15:29.023	2026-07-05 22:15:29.024
77	8	ORDER_CREATED	admin	1	t	2026-07-05 22:15:29.152	2026-07-05 22:15:29.153
78	8	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:15:29.298
79	9	ORDER_CREATED	admin	1	t	2026-07-05 22:31:47.334	2026-07-05 22:31:47.335
80	9	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:31:47.556
81	9	ORDER_CREATED	courier	2	t	2026-07-05 22:31:47.821	2026-07-05 22:31:47.822
82	9	ORDER_CREATED	courier	1	t	2026-07-05 22:31:48.051	2026-07-05 22:31:48.052
83	9	ORDER_ACCEPTED	user	3	t	2026-07-05 22:31:55.424	2026-07-05 22:31:55.425
86	9	ORDER_CREATED	user	3	t	2026-07-05 22:31:58.441	2026-07-05 22:31:58.442
87	9	ORDER_CREATED	admin	1	t	2026-07-05 22:31:58.603	2026-07-05 22:31:58.604
88	9	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:31:58.911
89	9	ORDER_CREATED	user	3	t	2026-07-05 22:32:01.152	2026-07-05 22:32:01.153
90	9	ORDER_CREATED	admin	1	t	2026-07-05 22:32:01.41	2026-07-05 22:32:01.411
91	9	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:32:01.979
92	9	ORDER_RETURNED	user	3	t	2026-07-05 22:32:02.386	2026-07-05 22:32:02.387
93	9	ORDER_RETURNED	admin	1	t	2026-07-05 22:32:02.623	2026-07-05 22:32:02.624
94	9	ORDER_RETURNED	admin	2	f	\N	2026-07-05 22:32:02.9
95	9	ORDER_CREATED	user	3	t	2026-07-05 22:32:03.205	2026-07-05 22:32:03.206
96	9	ORDER_CREATED	admin	1	t	2026-07-05 22:32:03.41	2026-07-05 22:32:03.411
97	9	ORDER_CREATED	admin	2	f	\N	2026-07-05 22:32:03.73
98	\N	ADVERTISEMENT	user	3	f	\N	2026-07-05 22:57:47.986
99	\N	ADVERTISEMENT	user	1	f	\N	2026-07-05 22:57:48.377
100	\N	ADVERTISEMENT	user	2	t	2026-07-05 22:57:49.147	2026-07-05 22:57:49.148
101	\N	ADVERTISEMENT	user	4	f	\N	2026-07-05 22:57:49.46
\.


--
-- Data for Name: order_payments; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.order_payments (id, "orderId", amount, method, status, "paidAt", note, "createdAt") FROM stdin;
\.


--
-- Data for Name: order_status_logs; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.order_status_logs (id, "orderId", status, "changedAt", "actorType", "actorId", note) FROM stdin;
1	2	PENDING	2026-07-05 21:24:41.32	\N	\N	\N
2	3	PENDING	2026-07-05 21:30:43.659	\N	\N	\N
3	4	PENDING	2026-07-05 21:32:45.726	\N	\N	\N
4	5	PENDING	2026-07-05 21:43:49.383	\N	\N	\N
5	6	PENDING	2026-07-05 21:44:20.681	\N	\N	\N
6	6	REJECTED	2026-07-05 21:50:47.28	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
7	6	COURIER_ASSIGNED	2026-07-05 21:50:54.472	courier	1	Kuryer buyurtmani qabul qildi
8	2	COURIER_ASSIGNED	2026-07-05 21:51:07.665	courier	1	Kuryer buyurtmani qabul qildi
9	3	REJECTED	2026-07-05 21:54:22.318	courier	2	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
10	5	REJECTED	2026-07-05 21:56:43.114	courier	2	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
11	4	REJECTED	2026-07-05 21:56:45.341	courier	2	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
12	3	COURIER_ASSIGNED	2026-07-05 21:56:47.285	courier	2	Kuryer buyurtmani qabul qildi
13	3	ARRIVED	2026-07-05 21:56:55.818	courier	2	Status: ARRIVED
14	3	ARRIVED	2026-07-05 21:56:59.81	courier	2	Status: ARRIVED
15	3	ARRIVED	2026-07-05 21:57:02.472	courier	2	Status: ARRIVED
16	3	ARRIVED	2026-07-05 21:57:12.207	courier	2	Status: ARRIVED
17	4	COURIER_ASSIGNED	2026-07-05 22:01:52.077	courier	2	Kuryer buyurtmani qabul qildi
18	4	ARRIVED	2026-07-05 22:01:54.522	courier	2	Status: ARRIVED
19	4	RETURNED	2026-07-05 22:01:57.284	courier	2	Status: RETURNED
20	4	COMPLETED	2026-07-05 22:01:58.442	courier	2	Status: COMPLETED
21	5	REJECTED	2026-07-05 22:02:14.789	courier	2	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
22	5	COURIER_ASSIGNED	2026-07-05 22:02:20.742	courier	2	Kuryer buyurtmani qabul qildi
23	5	ARRIVED	2026-07-05 22:02:27.873	courier	2	Status: ARRIVED
24	5	RETURNED	2026-07-05 22:02:31.385	courier	2	Status: RETURNED
25	5	COMPLETED	2026-07-05 22:02:32.017	courier	2	Status: COMPLETED
26	7	PENDING	2026-07-05 22:06:39.504	system	\N	Buyurtma yaratildi
27	7	COURIER_ASSIGNED	2026-07-05 22:06:49.566	courier	2	Kuryer buyurtmani qabul qildi
28	7	ARRIVED	2026-07-05 22:07:20.684	courier	2	Status: ARRIVED
29	7	RETURNED	2026-07-05 22:07:30.194	courier	2	Status: RETURNED
30	7	COMPLETED	2026-07-05 22:07:31.522	courier	2	Status: COMPLETED
31	8	PENDING	2026-07-05 22:14:07.863	system	\N	Buyurtma yaratildi
32	8	COURIER_ASSIGNED	2026-07-05 22:14:15.391	courier	2	Kuryer buyurtmani qabul qildi
33	8	ARRIVED	2026-07-05 22:15:26.847	courier	2	Status: ARRIVED
34	8	RETURNED	2026-07-05 22:15:28.46	courier	2	Status: RETURNED
35	8	COMPLETED	2026-07-05 22:15:28.891	courier	2	Status: COMPLETED
36	9	PENDING	2026-07-05 22:31:47.165	system	\N	Buyurtma yaratildi
37	9	COURIER_ASSIGNED	2026-07-05 22:31:54.527	courier	2	Kuryer buyurtmani qabul qildi
38	9	ARRIVED	2026-07-05 22:31:57.899	courier	2	Status: ARRIVED
39	9	RETURNED	2026-07-05 22:32:00.947	courier	2	Status: RETURNED
40	9	COMPLETED	2026-07-05 22:32:02.922	courier	2	Status: COMPLETED
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.orders (id, "userId", "courierId", "playstationId", "promocodeId", "consoleType", address, latitude, longitude, "startDatetime", "endDatetime", "totalPrice", status, "createdAt", "updatedAt", "rentalPriceId", "depositAmount", "acceptedAt", "assignedAt", "deliveryStartedAt", "deliveryCompletedAt", "assignedByAdmin", "deliveryFee", "inventoryUnitId", "deliveryZoneCode") FROM stdin;
6	1	1	\N	\N	PS5	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-07 16:00:00	2026-07-10 16:00:00	300000.00	COURIER_ASSIGNED	2026-07-05 21:44:20.676	2026-07-05 21:50:54.446	7	0.00	2026-07-05 21:50:54.445	2026-07-05 21:50:54.445	\N	\N	f	0.00	\N	\N
2	1	1	1	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 04:00:00	2026-07-07 04:00:00	50000.00	COURIER_ASSIGNED	2026-07-05 21:24:41.313	2026-07-05 21:51:07.659	3	0.00	2026-07-05 21:51:07.658	2026-07-05 21:51:07.658	\N	\N	f	0.00	\N	\N
3	2	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 04:00:00	2026-07-07 04:00:00	100000.00	ARRIVED	2026-07-05 21:30:43.654	2026-07-05 21:57:12.201	3	0.00	2026-07-05 21:56:47.28	2026-07-05 21:56:47.28	\N	\N	f	0.00	\N	\N
4	2	2	\N	\N	PS5	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-07 10:00:00	2026-07-10 10:00:00	120000.00	COMPLETED	2026-07-05 21:32:45.72	2026-07-05 22:01:58.437	7	0.00	2026-07-05 22:01:52.072	2026-07-05 22:01:52.072	\N	2026-07-05 22:01:58.436	f	0.00	\N	\N
5	1	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 04:00:00	2026-07-07 04:00:00	40000.00	COMPLETED	2026-07-05 21:43:49.374	2026-07-05 22:02:32.01	3	0.00	2026-07-05 22:02:20.736	2026-07-05 22:02:20.736	\N	2026-07-05 22:02:32.009	f	0.00	\N	\N
7	1	2	\N	\N	PS4	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 07:00:00	2026-07-07 07:00:00	80000.00	COMPLETED	2026-07-05 22:06:39.494	2026-07-05 22:07:31.516	6	0.00	2026-07-05 22:06:49.539	2026-07-05 22:06:49.539	\N	2026-07-05 22:07:31.515	f	0.00	\N	\N
8	1	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-07 07:00:00	2026-07-10 07:00:00	95000.00	COMPLETED	2026-07-05 22:14:07.854	2026-07-05 22:15:28.884	1	0.00	2026-07-05 22:14:15.386	2026-07-05 22:14:15.386	\N	2026-07-05 22:15:28.883	f	0.00	\N	\N
9	3	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 07:00:00	2026-07-07 07:00:00	40000.00	COMPLETED	2026-07-05 22:31:47.14	2026-07-05 22:32:02.917	3	0.00	2026-07-05 22:31:54.522	2026-07-05 22:31:54.522	\N	2026-07-05 22:32:02.916	f	30000.00	\N	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.payments (id, "orderId", amount, method, status, "paidAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: playstations; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.playstations (id, "courierId", type, "serialNumber", status, accessories, "createdAt") FROM stdin;
1	1	PS3	838494	RENTED	{"cable": 1, "joystick": 2}	2026-07-05 21:50:09.788
2	2	PS5	Jdoska w d	AVAILABLE	{"cable": 1, "joystick": 2}	2026-07-05 22:03:50.764
\.


--
-- Data for Name: promocodes; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.promocodes (id, code, "discountPercent", "usageLimit", "usedCount", "expiresAt", "isActive", "createdAt", "discountType", "discountAmount", "loyaltyMinOrders", description) FROM stdin;
\.


--
-- Data for Name: rental_extensions; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.rental_extensions (id, "orderId", "extraHours", "extraPrice", status, "requestedAt", "resolvedAt", "resolvedByAdminId", "previousEnd", "newEnd") FROM stdin;
\.


--
-- Data for Name: rental_prices; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.rental_prices (id, "consoleCatalogId", hours, price, currency, "isActive", "createdAt", "updatedAt") FROM stdin;
3	1	24	40000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.418
2	1	48	70000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.424
1	1	72	95000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.428
10	1	168	209000.00	UZS	t	2026-07-06 03:53:10.233	2026-07-05 22:53:10.431
6	2	24	80000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.438
5	2	48	140000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.441
4	2	72	190000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.445
11	2	168	418000.00	UZS	t	2026-07-06 03:53:10.233	2026-07-05 22:53:10.449
9	3	24	120000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.454
8	3	48	220000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.458
7	3	72	300000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.462
12	3	168	660000.00	UZS	t	2026-07-06 03:53:10.233	2026-07-05 22:53:10.465
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.reviews (id, "orderId", "userId", rating, comment, "createdAt") FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.system_settings (key, value, "updatedAt") FROM stdin;
DELIVERY_FEE	30000	2026-07-06 03:24:01.683
MAINTENANCE_MODE	false	2026-07-06 03:53:10.232
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.users (id, "telegramId", "fullName", phone, "defaultAddress", latitude, longitude, "isBlocked", "createdAt", username, "lastActivityAt", "customerRating", "adminNotes") FROM stdin;
3	8127652025	Dior	998339143260	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	f	2026-07-05 21:53:32.492	\N	\N	NORMAL	\N
1	8536325501	.	998938492905	\N	39.902043	66.264305	f	2026-07-05 21:14:16.202	dior_akb	2026-07-05 22:53:36.412	NORMAL	\N
2	8866189157	Dior	998500247999	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	f	2026-07-05 21:26:59.174	DiyorbekAzizbekovich	2026-07-05 22:54:52.005	NORMAL	\N
4	8522902434	Дилшода	998505407848	\N	\N	\N	f	2026-07-05 21:54:52.76	\N	\N	TRUSTED	Yaxwii
\.


--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.ad_campaigns_id_seq', 3, true);


--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.admin_audit_logs_id_seq', 18, true);


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.admins_id_seq', 2, true);


--
-- Name: console_catalog_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.console_catalog_id_seq', 7, true);


--
-- Name: couriers_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.couriers_id_seq', 2, true);


--
-- Name: database_backups_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.database_backups_id_seq', 1, false);


--
-- Name: delivery_zones_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.delivery_zones_id_seq', 1, true);


--
-- Name: inventory_unit_history_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.inventory_unit_history_id_seq', 1, false);


--
-- Name: inventory_units_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.inventory_units_id_seq', 22, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.notifications_id_seq', 101, true);


--
-- Name: order_payments_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.order_payments_id_seq', 1, false);


--
-- Name: order_status_logs_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.order_status_logs_id_seq', 40, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.orders_id_seq', 9, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.payments_id_seq', 1, false);


--
-- Name: playstations_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.playstations_id_seq', 2, true);


--
-- Name: promocodes_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.promocodes_id_seq', 1, false);


--
-- Name: rental_extensions_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.rental_extensions_id_seq', 1, false);


--
-- Name: rental_prices_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.rental_prices_id_seq', 24, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.reviews_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.users_id_seq', 4, true);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: console_catalog console_catalog_code_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.console_catalog
    ADD CONSTRAINT console_catalog_code_key UNIQUE (code);


--
-- Name: console_catalog console_catalog_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.console_catalog
    ADD CONSTRAINT console_catalog_pkey PRIMARY KEY (id);


--
-- Name: couriers couriers_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.couriers
    ADD CONSTRAINT couriers_pkey PRIMARY KEY (id);


--
-- Name: database_backups database_backups_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.database_backups
    ADD CONSTRAINT database_backups_pkey PRIMARY KEY (id);


--
-- Name: delivery_zones delivery_zones_code_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.delivery_zones
    ADD CONSTRAINT delivery_zones_code_key UNIQUE (code);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: inventory_unit_history inventory_unit_history_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_unit_history
    ADD CONSTRAINT inventory_unit_history_pkey PRIMARY KEY (id);


--
-- Name: inventory_units inventory_units_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_units
    ADD CONSTRAINT inventory_units_pkey PRIMARY KEY (id);


--
-- Name: inventory_units inventory_units_unitCode_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_units
    ADD CONSTRAINT "inventory_units_unitCode_key" UNIQUE ("unitCode");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_payments order_payments_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_payments
    ADD CONSTRAINT order_payments_pkey PRIMARY KEY (id);


--
-- Name: order_status_logs order_status_logs_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_status_logs
    ADD CONSTRAINT order_status_logs_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: playstations playstations_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.playstations
    ADD CONSTRAINT playstations_pkey PRIMARY KEY (id);


--
-- Name: promocodes promocodes_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.promocodes
    ADD CONSTRAINT promocodes_pkey PRIMARY KEY (id);


--
-- Name: rental_extensions rental_extensions_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_extensions
    ADD CONSTRAINT rental_extensions_pkey PRIMARY KEY (id);


--
-- Name: rental_prices rental_prices_consoleCatalogId_hours_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_prices
    ADD CONSTRAINT "rental_prices_consoleCatalogId_hours_key" UNIQUE ("consoleCatalogId", hours);


--
-- Name: rental_prices rental_prices_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_prices
    ADD CONSTRAINT rental_prices_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_logs_createdat_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX admin_audit_logs_createdat_idx ON playstation_rental.admin_audit_logs USING btree ("createdAt");


--
-- Name: admin_audit_logs_module_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX admin_audit_logs_module_idx ON playstation_rental.admin_audit_logs USING btree (module);


--
-- Name: admins_telegramId_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX "admins_telegramId_key" ON playstation_rental.admins USING btree ("telegramId");


--
-- Name: couriers_telegramId_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX "couriers_telegramId_key" ON playstation_rental.couriers USING btree ("telegramId");


--
-- Name: database_backups_createdat_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX database_backups_createdat_idx ON playstation_rental.database_backups USING btree ("createdAt");


--
-- Name: inventory_unit_history_unit_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_unit_history_unit_idx ON playstation_rental.inventory_unit_history USING btree ("inventoryUnitId", "createdAt");


--
-- Name: inventory_units_consoletype_status_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_units_consoletype_status_idx ON playstation_rental.inventory_units USING btree ("consoleType", status);


--
-- Name: order_payments_orderid_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX order_payments_orderid_idx ON playstation_rental.order_payments USING btree ("orderId");


--
-- Name: order_payments_status_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX order_payments_status_idx ON playstation_rental.order_payments USING btree (status);


--
-- Name: payments_orderId_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX "payments_orderId_key" ON playstation_rental.payments USING btree ("orderId");


--
-- Name: playstations_serialNumber_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX "playstations_serialNumber_key" ON playstation_rental.playstations USING btree ("serialNumber");


--
-- Name: promocodes_code_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX promocodes_code_key ON playstation_rental.promocodes USING btree (code);


--
-- Name: rental_extensions_order_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX rental_extensions_order_idx ON playstation_rental.rental_extensions USING btree ("orderId", status);


--
-- Name: reviews_orderId_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX "reviews_orderId_key" ON playstation_rental.reviews USING btree ("orderId");


--
-- Name: users_lastactivityat_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX users_lastactivityat_idx ON playstation_rental.users USING btree ("lastActivityAt");


--
-- Name: users_telegramId_key; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE UNIQUE INDEX "users_telegramId_key" ON playstation_rental.users USING btree ("telegramId");


--
-- Name: ad_campaigns ad_campaigns_adminId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.ad_campaigns
    ADD CONSTRAINT "ad_campaigns_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES playstation_rental.admins(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_unit_history inventory_unit_history_inventoryUnitId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_unit_history
    ADD CONSTRAINT "inventory_unit_history_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES playstation_rental.inventory_units(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.notifications
    ADD CONSTRAINT "notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: order_payments order_payments_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_payments
    ADD CONSTRAINT "order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_logs order_status_logs_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_status_logs
    ADD CONSTRAINT "order_status_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_courierId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT "orders_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES playstation_rental.couriers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_inventoryUnitId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT "orders_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES playstation_rental.inventory_units(id);


--
-- Name: orders orders_playstationId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT "orders_playstationId_fkey" FOREIGN KEY ("playstationId") REFERENCES playstation_rental.playstations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_promocodeId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT "orders_promocodeId_fkey" FOREIGN KEY ("promocodeId") REFERENCES playstation_rental.promocodes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_rentalpriceid_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT orders_rentalpriceid_fkey FOREIGN KEY ("rentalPriceId") REFERENCES playstation_rental.rental_prices(id);


--
-- Name: orders orders_userId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES playstation_rental.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.payments
    ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: playstations playstations_courierId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.playstations
    ADD CONSTRAINT "playstations_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES playstation_rental.couriers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rental_extensions rental_extensions_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_extensions
    ADD CONSTRAINT "rental_extensions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id);


--
-- Name: rental_prices rental_prices_consoleCatalogId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_prices
    ADD CONSTRAINT "rental_prices_consoleCatalogId_fkey" FOREIGN KEY ("consoleCatalogId") REFERENCES playstation_rental.console_catalog(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.reviews
    ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reviews reviews_userId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.reviews
    ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES playstation_rental.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

