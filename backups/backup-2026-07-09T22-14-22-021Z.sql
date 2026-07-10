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
-- Name: CollateralType; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."CollateralType" AS ENUM (
    'ID_CARD',
    'PASSPORT',
    'NONE'
);


ALTER TYPE playstation_rental."CollateralType" OWNER TO dior;

--
-- Name: ConditionGrade; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."ConditionGrade" AS ENUM (
    'IDEAL',
    'GOOD',
    'MINOR_ISSUE',
    'SERIOUS_ISSUE'
);


ALTER TYPE playstation_rental."ConditionGrade" OWNER TO dior;

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
-- Name: InventoryItemStatus; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."InventoryItemStatus" AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'RENTED',
    'MAINTENANCE'
);


ALTER TYPE playstation_rental."InventoryItemStatus" OWNER TO dior;

--
-- Name: InventoryItemType; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."InventoryItemType" AS ENUM (
    'CONSOLE',
    'JOYSTICK',
    'HDMI',
    'POWER'
);


ALTER TYPE playstation_rental."InventoryItemType" OWNER TO dior;

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
    'ADVERTISEMENT',
    'ORDER_CANCELLED',
    'COURIER_ASSIGNED',
    'ORDER_ARRIVED',
    'ADMIN_ORDER_ASSIGNED'
);


ALTER TYPE playstation_rental."NotificationType" OWNER TO dior;

--
-- Name: OrderPhotoType; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."OrderPhotoType" AS ENUM (
    'HANDOVER',
    'RETURN'
);


ALTER TYPE playstation_rental."OrderPhotoType" OWNER TO dior;

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
    'ARRIVED',
    'ACTIVE'
);


ALTER TYPE playstation_rental."OrderStatus" OWNER TO dior;

--
-- Name: PaymentMethod; Type: TYPE; Schema: playstation_rental; Owner: dior
--

CREATE TYPE playstation_rental."PaymentMethod" AS ENUM (
    'CASH',
    'CLICK',
    'CARD'
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
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mediaType" character varying(32) DEFAULT 'text'::character varying NOT NULL,
    payload jsonb,
    "successCount" integer DEFAULT 0 NOT NULL,
    "failCount" integer DEFAULT 0 NOT NULL
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
-- Name: inventory_item_history; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.inventory_item_history (
    id integer NOT NULL,
    "inventoryItemId" integer NOT NULL,
    action character varying(64) NOT NULL,
    "fromStatus" playstation_rental."InventoryItemStatus",
    "toStatus" playstation_rental."InventoryItemStatus",
    "orderId" integer,
    note text,
    "actorType" character varying(32),
    "actorId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.inventory_item_history OWNER TO dior;

--
-- Name: inventory_item_history_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.inventory_item_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.inventory_item_history_id_seq OWNER TO dior;

--
-- Name: inventory_item_history_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.inventory_item_history_id_seq OWNED BY playstation_rental.inventory_item_history.id;


--
-- Name: inventory_items; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.inventory_items (
    id integer NOT NULL,
    "itemType" playstation_rental."InventoryItemType" NOT NULL,
    "consoleType" playstation_rental."ConsoleType",
    "inventoryNumber" character varying(64) NOT NULL,
    "serialNumber" character varying(128) NOT NULL,
    condition playstation_rental."ConditionGrade" DEFAULT 'GOOD'::playstation_rental."ConditionGrade" NOT NULL,
    status playstation_rental."InventoryItemStatus" DEFAULT 'AVAILABLE'::playstation_rental."InventoryItemStatus" NOT NULL,
    "purchasedAt" timestamp(3) without time zone,
    note text,
    "reservedOrderId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.inventory_items OWNER TO dior;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.inventory_items_id_seq OWNER TO dior;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.inventory_items_id_seq OWNED BY playstation_rental.inventory_items.id;


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
-- Name: order_inventory_items; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.order_inventory_items (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "inventoryItemId" integer NOT NULL,
    role playstation_rental."InventoryItemType" NOT NULL,
    "returnedAt" timestamp(3) without time zone,
    "returnCondition" playstation_rental."ConditionGrade",
    "returnNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.order_inventory_items OWNER TO dior;

--
-- Name: order_inventory_items_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.order_inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.order_inventory_items_id_seq OWNER TO dior;

--
-- Name: order_inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.order_inventory_items_id_seq OWNED BY playstation_rental.order_inventory_items.id;


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
-- Name: order_photos; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.order_photos (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "photoType" playstation_rental."OrderPhotoType" NOT NULL,
    "filePath" text,
    "telegramFileId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.order_photos OWNER TO dior;

--
-- Name: order_photos_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.order_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.order_photos_id_seq OWNER TO dior;

--
-- Name: order_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.order_photos_id_seq OWNED BY playstation_rental.order_photos.id;


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
    "deliveryZoneCode" character varying(64),
    "paymentReceived" boolean DEFAULT false NOT NULL,
    "paymentMethod" playstation_rental."PaymentMethod",
    "paymentReceivedAt" timestamp(3) without time zone,
    "finalPaidAmount" numeric(10,2),
    "collateralType" playstation_rental."CollateralType",
    "collateralTaken" boolean DEFAULT false NOT NULL,
    "collateralReturned" boolean DEFAULT false NOT NULL,
    "deliveredByCourierId" integer,
    "consoleItemId" integer,
    "hdmiItemId" integer,
    "powerItemId" integer,
    "returnCondition" playstation_rental."ConditionGrade",
    "returnNote" text,
    "returnedAt" timestamp(3) without time zone
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
    description text,
    "minOrderAmount" numeric(10,2),
    "maxDiscountAmount" numeric(10,2),
    "perUserLimit" integer DEFAULT 1 NOT NULL
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
-- Name: rental_contracts; Type: TABLE; Schema: playstation_rental; Owner: dior
--

CREATE TABLE playstation_rental.rental_contracts (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "contractNumber" character varying(64) NOT NULL,
    "pdfPath" text,
    "telegramFileId" text,
    payload jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE playstation_rental.rental_contracts OWNER TO dior;

--
-- Name: rental_contracts_id_seq; Type: SEQUENCE; Schema: playstation_rental; Owner: dior
--

CREATE SEQUENCE playstation_rental.rental_contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE playstation_rental.rental_contracts_id_seq OWNER TO dior;

--
-- Name: rental_contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: playstation_rental; Owner: dior
--

ALTER SEQUENCE playstation_rental.rental_contracts_id_seq OWNED BY playstation_rental.rental_contracts.id;


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
    "adminNotes" text,
    language character varying(8)
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
-- Name: inventory_item_history id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_item_history ALTER COLUMN id SET DEFAULT nextval('playstation_rental.inventory_item_history_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_items ALTER COLUMN id SET DEFAULT nextval('playstation_rental.inventory_items_id_seq'::regclass);


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
-- Name: order_inventory_items id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_inventory_items ALTER COLUMN id SET DEFAULT nextval('playstation_rental.order_inventory_items_id_seq'::regclass);


--
-- Name: order_payments id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_payments ALTER COLUMN id SET DEFAULT nextval('playstation_rental.order_payments_id_seq'::regclass);


--
-- Name: order_photos id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_photos ALTER COLUMN id SET DEFAULT nextval('playstation_rental.order_photos_id_seq'::regclass);


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
-- Name: rental_contracts id; Type: DEFAULT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_contracts ALTER COLUMN id SET DEFAULT nextval('playstation_rental.rental_contracts_id_seq'::regclass);


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

COPY playstation_rental.ad_campaigns (id, "adminId", message, "recipientCount", "sentAt", "mediaType", payload, "successCount", "failCount") FROM stdin;
1	1	SALOM	2	2026-07-05 21:31:12.528	text	\N	0	0
2	1	🚚 Kuryerlar	2	2026-07-05 21:31:31.78	text	\N	0	0
3	1	📢 Reklama	1	2026-07-05 22:57:49.464	text	\N	0	0
4	1	Salom	3	2026-07-05 22:59:23.274	text	\N	0	0
5	1	.	4	2026-07-06 05:52:27.712	text	\N	0	0
6	1	.	4	2026-07-06 06:01:07.331	text	\N	0	0
7	1	🤍🤍	6	2026-07-06 13:57:36.226	text	\N	0	0
8	1	[photo] Wunaqa…	6	2026-07-06 13:59:10.115	text	\N	0	0
9	1	Salom	7	2026-07-07 19:54:10.666	text	\N	0	0
\.


--
-- Data for Name: admin_audit_logs; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.admin_audit_logs (id, "adminId", "adminTelegramId", action, "entityType", "entityId", "beforeData", "afterData", "createdAt", module) FROM stdin;
20	1	8866189157	AUDIT_LOGS_CLEARED	\N	\N	\N	{"deletedCount": 19}	2026-07-05 22:58:17.642	AUDIT
21	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 10, "consoleType": "PS3"}	{"count": 11, "message": "Admin PS3 sonini 10 tadan 11 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:58:40.497	\N
22	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 11, "consoleType": "PS3"}	{"count": 10, "message": "Admin PS3 sonini 11 tadan 10 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-05 22:58:46.807	\N
23	1	8866189157	DELIVERY_FEE_UPDATED	SystemSetting	\N	{"deliveryFee": 30000}	{"deliveryFee": 31000}	2026-07-05 22:59:41.978	\N
24	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": false}	{"enabled": true}	2026-07-05 23:00:04.63	SYSTEM
25	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": true}	{"enabled": false}	2026-07-05 23:00:13.346	SYSTEM
26	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": false}	{"enabled": true}	2026-07-05 23:00:21.304	SYSTEM
27	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": true}	{"enabled": false}	2026-07-05 23:00:25.039	SYSTEM
28	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": false}	{"enabled": true}	2026-07-05 23:00:36.813	SYSTEM
29	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": true}	{"enabled": false}	2026-07-05 23:00:40.407	SYSTEM
30	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": false}	{"enabled": true}	2026-07-05 23:00:45.902	SYSTEM
31	1	8866189157	MAINTENANCE_MODE_TOGGLED	SystemSetting	\N	{"enabled": true}	{"enabled": false}	2026-07-06 05:40:01.79	SYSTEM
32	1	8866189157	CUSTOMER_NOTES_UPDATED	User	5	\N	{"adminNotes": "Maeyam"}	2026-07-06 05:51:55.869	CRM
33	1	8866189157	CUSTOMER_NOTES_UPDATED	User	5	\N	{"adminNotes": "Maryam"}	2026-07-06 05:52:12.152	CRM
34	1	8866189157	DELIVERY_FEE_UPDATED	SystemSetting	\N	{"deliveryFee": 31000}	{"deliveryFee": 30000}	2026-07-06 06:00:53.106	\N
35	\N	8866189157	ORDER_REJECTED	Order	21	\N	{"message": "Admin buyurtmani #21 rad etdi"}	2026-07-09 19:47:56.514	\N
36	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 2, "consoleType": "PS5"}	{"count": 1, "message": "Admin PS5 sonini 2 tadan 1 taga o'zgartirdi", "consoleType": "PS5"}	2026-07-09 19:54:01.622	\N
37	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 1, "consoleType": "PS5"}	{"count": 0, "message": "Admin PS5 sonini 1 tadan 0 taga o'zgartirdi", "consoleType": "PS5"}	2026-07-09 19:54:04.097	\N
38	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 10, "consoleType": "PS4"}	{"count": 9, "message": "Admin PS4 sonini 10 tadan 9 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-09 19:54:08.277	\N
39	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 9, "consoleType": "PS4"}	{"count": 8, "message": "Admin PS4 sonini 9 tadan 8 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-09 19:54:08.71	\N
40	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 9, "consoleType": "PS4"}	{"count": 8, "message": "Admin PS4 sonini 9 tadan 8 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-09 19:54:08.716	\N
41	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 8, "consoleType": "PS4"}	{"count": 7, "message": "Admin PS4 sonini 8 tadan 7 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-09 19:54:14.73	\N
42	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 7, "consoleType": "PS4"}	{"count": 6, "message": "Admin PS4 sonini 7 tadan 6 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-09 19:54:15.731	\N
43	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 6, "consoleType": "PS4"}	{"count": 5, "message": "Admin PS4 sonini 6 tadan 5 taga o'zgartirdi", "consoleType": "PS4"}	2026-07-09 19:54:16.662	\N
44	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 10, "consoleType": "PS3"}	{"count": 9, "message": "Admin PS3 sonini 10 tadan 9 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-09 19:54:20.923	\N
45	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 9, "consoleType": "PS3"}	{"count": 8, "message": "Admin PS3 sonini 9 tadan 8 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-09 19:54:21.833	\N
46	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 8, "consoleType": "PS3"}	{"count": 7, "message": "Admin PS3 sonini 8 tadan 7 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-09 19:54:22.729	\N
47	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 7, "consoleType": "PS3"}	{"count": 6, "message": "Admin PS3 sonini 7 tadan 6 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-09 19:54:23.601	\N
48	1	8866189157	INVENTORY_COUNT_UPDATED	InventoryUnit	\N	{"count": 6, "consoleType": "PS3"}	{"count": 5, "message": "Admin PS3 sonini 6 tadan 5 taga o'zgartirdi", "consoleType": "PS3"}	2026-07-09 19:54:24.456	\N
49	\N	\N	PROMO_CREATED	Promocode	1	\N	{"code": "TEST3321"}	2026-07-09 20:50:23.375	PROMO
50	1	8866189157	RENTAL_EXTENSION_APPROVED	RentalExtension	1	\N	{"orderId": 27, "extraHours": 24, "extraPrice": 119990}	2026-07-09 20:59:33.75	RENTAL
51	1	8866189157	PROMO_CREATED	Promocode	2	\N	{"code": "DIOR"}	2026-07-09 21:04:34.096	PROMO
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
1	PS3	PlayStation 3	t	1	2026-07-06 02:40:15.349	2026-07-05 22:53:10.409
2	PS4	PlayStation 4	t	2	2026-07-06 02:40:15.349	2026-07-05 22:53:10.435
4	📊 STATISTIKA	📊 Statistika	f	0	2026-07-05 21:48:11.107	2026-07-09 19:24:35.57
8	📊 DASHBOARD	A	f	0	2026-07-09 19:34:20.727	2026-07-09 19:38:17.737
3	PS5	PlayStation 5	f	3	2026-07-06 02:40:15.349	2026-07-09 19:38:24.803
\.


--
-- Data for Name: couriers; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.couriers (id, "telegramId", "fullName", phone, region, latitude, longitude, "isActive", "createdAt", username, rating) FROM stdin;
1	8866189157	Dior	🎮 Inventar	💰 Narxlar	39.902016	66.264225	t	2026-07-05 21:49:34.866	DiyorbekAzizbekovich	5.00
2	8127652025	Jon	915541616	Toshkent Shahar	39.902043	66.264305	f	2026-07-05 21:53:04.685	\N	5.00
\.


--
-- Data for Name: database_backups; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.database_backups (id, filename, "filePath", "fileSize", "createdByAdminId", "createdAt") FROM stdin;
1	backup-2026-07-05T22-58-00-932Z.sql	/home/dior/Desktop/playstation-rental-bot/backups/backup-2026-07-05T22-58-00-932Z.sql	72824	1	2026-07-05 22:58:01.129
\.


--
-- Data for Name: delivery_zones; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.delivery_zones (id, code, name, fee, "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
1	CITY	Shahar ichida	30000.00	t	1	2026-07-06 03:53:10.204	2026-07-06 03:53:10.204
\.


--
-- Data for Name: inventory_item_history; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.inventory_item_history (id, "inventoryItemId", action, "fromStatus", "toStatus", "orderId", note, "actorType", "actorId", "createdAt") FROM stdin;
4	17	CREATED	\N	AVAILABLE	\N	Ps3 qora	admin	\N	2026-07-09 21:56:17.103
5	17	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.806
6	4	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.811
7	5	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.815
8	6	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.819
9	7	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.822
10	13	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.826
11	14	RENTED	AVAILABLE	RENTED	34	\N	courier	1	2026-07-09 22:10:29.829
12	17	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.114
13	4	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.12
14	5	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.124
15	6	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.127
16	7	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.131
17	13	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.135
18	14	RETURNED	RENTED	AVAILABLE	34	\N	courier	1	2026-07-09 22:12:17.138
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.inventory_items (id, "itemType", "consoleType", "inventoryNumber", "serialNumber", condition, status, "purchasedAt", note, "reservedOrderId", "createdAt", "updatedAt") FROM stdin;
1	CONSOLE	PS5	NX-PS5-001	CFI-2018A-45873291	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
2	CONSOLE	PS5	NX-PS5-002	CFI-2018A-45873292	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
3	CONSOLE	PS4	NX-PS4-001	CUH-2216B-10000001	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
8	JOYSTICK	\N	NX-JS-005	JS-SN-0005	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
9	JOYSTICK	\N	NX-JS-006	JS-SN-0006	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
10	JOYSTICK	\N	NX-JS-007	JS-SN-0007	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
11	JOYSTICK	\N	NX-JS-008	JS-SN-0008	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
12	HDMI	\N	NX-HDMI-001	HDMI-SN-0001	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
15	POWER	\N	NX-PWR-002	PWR-SN-0002	GOOD	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-10 02:49:55.83
17	CONSOLE	PS3	NX-PS3-00498929284	Jdkamanekd	IDEAL	AVAILABLE	2008-05-29 00:00:00	Ps3 qora	\N	2026-07-09 21:56:17.096	2026-07-09 22:12:17.111
4	JOYSTICK	\N	NX-JS-001	JS-SN-0001	IDEAL	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-09 22:12:17.118
5	JOYSTICK	\N	NX-JS-002	JS-SN-0002	IDEAL	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-09 22:12:17.122
6	JOYSTICK	\N	NX-JS-003	JS-SN-0003	IDEAL	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-09 22:12:17.126
7	JOYSTICK	\N	NX-JS-004	JS-SN-0004	IDEAL	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-09 22:12:17.129
13	HDMI	\N	NX-HDMI-002	HDMI-SN-0002	IDEAL	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-09 22:12:17.133
14	POWER	\N	NX-PWR-001	PWR-SN-0001	IDEAL	AVAILABLE	2026-07-10 00:00:00	\N	\N	2026-07-10 02:49:55.83	2026-07-09 22:12:17.137
\.


--
-- Data for Name: inventory_unit_history; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.inventory_unit_history (id, "inventoryUnitId", action, "fromStatus", "toStatus", "orderId", note, "actorType", "actorId", "createdAt") FROM stdin;
1	1	ASSIGNED_TO_ORDER	AVAILABLE	RENTED	16	\N	system	\N	2026-07-09 19:10:59.118
2	1	RELEASED_FROM_ORDER	RENTED	AVAILABLE	16	\N	system	\N	2026-07-09 19:11:28.884
3	1	RELEASED_FROM_ORDER	AVAILABLE	AVAILABLE	16	\N	system	\N	2026-07-09 19:11:29.709
4	1	RELEASED_FROM_ORDER	AVAILABLE	AVAILABLE	16	\N	system	\N	2026-07-09 19:17:13.221
5	1	ASSIGNED_TO_ORDER	AVAILABLE	RENTED	28	\N	system	\N	2026-07-09 20:59:16.139
6	1	RELEASED_FROM_ORDER	RENTED	AVAILABLE	28	\N	system	\N	2026-07-09 21:00:31.45
7	1	RELEASED_FROM_ORDER	AVAILABLE	AVAILABLE	28	\N	system	\N	2026-07-09 21:00:32.09
8	1	RELEASED_FROM_ORDER	AVAILABLE	AVAILABLE	28	\N	system	\N	2026-07-09 21:01:42.028
9	1	RELEASED_FROM_ORDER	AVAILABLE	AVAILABLE	28	\N	system	\N	2026-07-09 21:01:42.757
10	1	ASSIGNED_TO_ORDER	AVAILABLE	RENTED	23	\N	system	\N	2026-07-09 21:28:41.864
11	10	ASSIGNED_TO_ORDER	AVAILABLE	RENTED	31	\N	system	\N	2026-07-09 21:35:06.959
\.


--
-- Data for Name: inventory_units; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.inventory_units (id, "unitCode", "consoleType", status, "createdAt", "updatedAt", "purchasedAt", "purchasePrice", "lastServiceAt", "adminNote") FROM stdin;
2	PS4-001	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
3	PS4-002	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
4	PS4-003	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
5	PS4-004	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
6	PS4-005	PS4	AVAILABLE	2026-07-06 03:24:01.684	2026-07-06 03:24:01.684	\N	\N	\N	\N
11	PS3-003	PS3	AVAILABLE	2026-07-05 22:26:34.896	2026-07-05 22:26:34.896	\N	\N	\N	\N
12	PS3-004	PS3	AVAILABLE	2026-07-05 22:26:37.275	2026-07-05 22:26:37.275	\N	\N	\N	\N
13	PS3-005	PS3	AVAILABLE	2026-07-05 22:26:39.503	2026-07-05 22:26:39.503	\N	\N	\N	\N
1	PS3-001	PS3	RENTED	2026-07-06 03:24:01.684	2026-07-09 21:28:41.857	\N	\N	\N	\N
10	PS3-002	PS3	RENTED	2026-07-05 22:26:31.554	2026-07-09 21:35:06.954	\N	\N	\N	\N
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
102	\N	ADVERTISEMENT	user	3	t	2026-07-05 22:59:22.536	2026-07-05 22:59:22.537
103	\N	ADVERTISEMENT	user	1	t	2026-07-05 22:59:22.843	2026-07-05 22:59:22.844
104	\N	ADVERTISEMENT	user	2	t	2026-07-05 22:59:23.055	2026-07-05 22:59:23.056
105	\N	ADVERTISEMENT	user	4	f	\N	2026-07-05 22:59:23.27
106	\N	ADVERTISEMENT	user	3	t	2026-07-06 05:52:26.989	2026-07-06 05:52:26.99
107	\N	ADVERTISEMENT	user	1	t	2026-07-06 05:52:27.12	2026-07-06 05:52:27.121
108	\N	ADVERTISEMENT	user	4	f	\N	2026-07-06 05:52:27.299
109	\N	ADVERTISEMENT	user	2	t	2026-07-06 05:52:27.512	2026-07-06 05:52:27.513
110	\N	ADVERTISEMENT	user	5	t	2026-07-06 05:52:27.707	2026-07-06 05:52:27.708
111	\N	ADVERTISEMENT	user	3	t	2026-07-06 06:01:06.473	2026-07-06 06:01:06.474
112	\N	ADVERTISEMENT	user	1	t	2026-07-06 06:01:06.678	2026-07-06 06:01:06.679
113	\N	ADVERTISEMENT	user	4	f	\N	2026-07-06 06:01:06.885
114	\N	ADVERTISEMENT	user	2	t	2026-07-06 06:01:07.19	2026-07-06 06:01:07.191
115	\N	ADVERTISEMENT	user	5	t	2026-07-06 06:01:07.326	2026-07-06 06:01:07.327
116	13	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:06:48.646
117	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:06:48.651
118	13	ORDER_CREATED	courier	2	f	\N	2026-07-09 19:06:48.659
119	13	ORDER_CREATED	courier	1	f	\N	2026-07-09 19:06:48.662
120	14	ORDER_CREATED	admin	1	t	2026-07-09 19:06:58.609	2026-07-09 19:06:58.61
121	14	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:06:58.909
122	14	ORDER_CREATED	courier	2	t	2026-07-09 19:06:59.053	2026-07-09 19:06:59.054
123	14	ORDER_CREATED	courier	1	t	2026-07-09 19:06:59.232	2026-07-09 19:06:59.233
124	14	ORDER_ACCEPTED	user	2	t	2026-07-09 19:07:10.124	2026-07-09 19:07:10.125
127	15	ORDER_CREATED	admin	1	t	2026-07-09 19:07:40.806	2026-07-09 19:07:40.807
128	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:07:40.942
129	15	ORDER_CREATED	courier	2	t	2026-07-09 19:07:41.125	2026-07-09 19:07:41.126
130	15	ORDER_CREATED	courier	1	t	2026-07-09 19:07:41.319	2026-07-09 19:07:41.32
131	16	ORDER_CREATED	admin	1	t	2026-07-09 19:09:41.686	2026-07-09 19:09:41.687
132	16	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:09:42.167
133	16	ORDER_CREATED	courier	2	t	2026-07-09 19:09:42.472	2026-07-09 19:09:42.473
134	16	ORDER_CREATED	courier	1	t	2026-07-09 19:09:42.777	2026-07-09 19:09:42.778
136	16	ORDER_ACCEPTED	user	9	t	2026-07-09 19:10:17.291	2026-07-09 19:10:17.292
139	16	ORDER_CREATED	user	9	t	2026-07-09 19:10:50.868	2026-07-09 19:10:50.869
140	16	ORDER_CREATED	admin	1	t	2026-07-09 19:10:51.19	2026-07-09 19:10:51.191
141	16	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:10:52.42
142	16	ORDER_CREATED	user	9	f	\N	2026-07-09 19:10:59.536
143	16	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:10:59.817
144	16	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:11:00.888
145	16	ORDER_CREATED	user	9	t	2026-07-09 19:11:26.456	2026-07-09 19:11:26.457
146	16	ORDER_CREATED	admin	1	t	2026-07-09 19:11:26.836	2026-07-09 19:11:26.837
147	16	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:11:27.525
148	16	ORDER_RETURNED	user	9	t	2026-07-09 19:11:27.963	2026-07-09 19:11:27.964
149	16	ORDER_RETURNED	admin	1	t	2026-07-09 19:11:28.267	2026-07-09 19:11:28.268
150	16	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:11:28.874
151	16	ORDER_CREATED	user	9	t	2026-07-09 19:11:29.296	2026-07-09 19:11:29.297
152	16	ORDER_CREATED	admin	1	t	2026-07-09 19:11:29.545	2026-07-09 19:11:29.546
153	16	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:11:29.699
154	10	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:14:00.402
155	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:14:00.688
156	10	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:15:00.4
157	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:15:00.966
158	11	ORDER_CREATED	admin	1	t	2026-07-09 19:15:01.168	2026-07-09 19:15:01.17
159	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:15:01.579
160	10	ORDER_CREATED	admin	1	t	2026-07-09 19:16:00.79	2026-07-09 19:16:00.791
161	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:16:00.996
162	11	ORDER_CREATED	admin	1	t	2026-07-09 19:16:01.216	2026-07-09 19:16:01.217
163	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:16:01.508
164	10	ORDER_CREATED	admin	1	t	2026-07-09 19:17:00.661	2026-07-09 19:17:00.662
165	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:17:00.97
166	11	ORDER_CREATED	admin	1	t	2026-07-09 19:17:01.228	2026-07-09 19:17:01.229
167	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:17:01.385
168	12	ORDER_CREATED	admin	1	t	2026-07-09 19:17:01.582	2026-07-09 19:17:01.583
169	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:17:01.89
170	13	ORDER_CREATED	admin	1	t	2026-07-09 19:17:02.196	2026-07-09 19:17:02.197
171	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:17:02.336
172	15	ORDER_CREATED	admin	1	t	2026-07-09 19:19:00.344	2026-07-09 19:19:00.346
173	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:19:00.549
174	10	ORDER_CREATED	admin	1	t	2026-07-09 19:19:00.852	2026-07-09 19:19:00.853
175	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:19:01.1
176	11	ORDER_CREATED	admin	1	t	2026-07-09 19:19:01.239	2026-07-09 19:19:01.24
177	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:19:01.605
178	12	ORDER_CREATED	admin	1	t	2026-07-09 19:19:01.736	2026-07-09 19:19:01.737
179	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:19:02.054
180	13	ORDER_CREATED	admin	1	t	2026-07-09 19:19:02.207	2026-07-09 19:19:02.208
181	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:19:02.367
183	15	ORDER_CREATED	admin	1	t	2026-07-09 19:20:00.46	2026-07-09 19:20:00.461
184	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:20:00.682
185	10	ORDER_CREATED	admin	1	t	2026-07-09 19:20:00.869	2026-07-09 19:20:00.87
186	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:20:01.089
187	11	ORDER_CREATED	admin	1	t	2026-07-09 19:20:01.234	2026-07-09 19:20:01.235
188	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:20:01.523
189	12	ORDER_CREATED	admin	1	t	2026-07-09 19:20:05.072	2026-07-09 19:20:05.073
190	15	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:21:00.421
191	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:00.718
192	10	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:21:01.048
193	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:01.81
194	11	ORDER_CREATED	admin	1	t	2026-07-09 19:21:02.011	2026-07-09 19:21:02.012
195	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:02.321
196	12	ORDER_CREATED	admin	1	t	2026-07-09 19:21:02.528	2026-07-09 19:21:02.529
197	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:02.732
198	13	ORDER_CREATED	admin	1	t	2026-07-09 19:21:02.948	2026-07-09 19:21:02.949
199	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:03.141
200	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:04.275
201	13	ORDER_CREATED	admin	1	t	2026-07-09 19:21:04.674	2026-07-09 19:21:04.675
202	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:04.984
203	17	ORDER_CREATED	admin	1	t	2026-07-09 19:21:30.923	2026-07-09 19:21:30.924
204	17	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:21:31.097
205	17	ORDER_CREATED	courier	2	t	2026-07-09 19:21:31.505	2026-07-09 19:21:31.506
206	17	ORDER_CREATED	courier	1	t	2026-07-09 19:21:31.813	2026-07-09 19:21:31.814
207	15	ORDER_CREATED	admin	1	t	2026-07-09 19:22:00.699	2026-07-09 19:22:00.7
208	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:22:01.204
209	10	ORDER_CREATED	admin	1	t	2026-07-09 19:22:01.512	2026-07-09 19:22:01.513
210	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:22:01.717
211	11	ORDER_CREATED	admin	1	t	2026-07-09 19:22:01.868	2026-07-09 19:22:01.869
212	11	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:22:02.003
213	12	ORDER_CREATED	admin	1	t	2026-07-09 19:22:02.181	2026-07-09 19:22:02.182
214	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:22:02.373
215	13	ORDER_CREATED	admin	1	t	2026-07-09 19:22:02.522	2026-07-09 19:22:02.523
216	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:22:02.657
217	11	ORDER_ACCEPTED	user	1	t	2026-07-09 19:22:56.682	2026-07-09 19:22:56.683
218	11	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:22:56.849	2026-07-09 19:22:56.85
219	11	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:22:57.019
220	15	ORDER_CREATED	admin	1	t	2026-07-09 19:23:00.154	2026-07-09 19:23:00.155
221	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:23:00.302
222	10	ORDER_CREATED	admin	1	t	2026-07-09 19:23:00.714	2026-07-09 19:23:00.715
223	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:23:01.111
224	12	ORDER_CREATED	admin	1	t	2026-07-09 19:23:01.416	2026-07-09 19:23:01.417
225	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:23:01.724
226	13	ORDER_CREATED	admin	1	t	2026-07-09 19:23:01.946	2026-07-09 19:23:01.947
227	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:23:02.214
228	15	ORDER_CREATED	admin	1	t	2026-07-09 19:24:01.114	2026-07-09 19:24:01.115
229	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:24:01.332
230	10	ORDER_CREATED	admin	1	t	2026-07-09 19:24:01.625	2026-07-09 19:24:01.626
231	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:24:01.831
232	12	ORDER_CREATED	admin	1	t	2026-07-09 19:24:02.241	2026-07-09 19:24:02.242
233	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:24:02.446
234	13	ORDER_CREATED	admin	1	t	2026-07-09 19:24:02.578	2026-07-09 19:24:02.579
235	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:24:02.754
236	15	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:25:00.553
237	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:25:01.222
238	10	ORDER_CREATED	admin	1	t	2026-07-09 19:25:01.528	2026-07-09 19:25:01.529
239	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:25:01.836
240	12	ORDER_CREATED	admin	1	t	2026-07-09 19:25:02.133	2026-07-09 19:25:02.134
241	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:25:02.554
242	13	ORDER_CREATED	admin	1	t	2026-07-09 19:25:02.86	2026-07-09 19:25:02.861
243	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:25:03.168
244	15	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:26:00.453
245	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:26:01.338
246	10	ORDER_CREATED	admin	1	t	2026-07-09 19:26:01.538	2026-07-09 19:26:01.539
247	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:26:01.729
248	12	ORDER_CREATED	admin	1	t	2026-07-09 19:26:01.942	2026-07-09 19:26:01.943
249	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:26:02.252
250	13	ORDER_CREATED	admin	1	t	2026-07-09 19:26:02.47	2026-07-09 19:26:02.471
251	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:26:02.762
252	15	ORDER_CREATED	admin	1	t	2026-07-09 19:27:00.252	2026-07-09 19:27:00.253
253	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:27:00.616
254	10	ORDER_CREATED	admin	1	t	2026-07-09 19:27:00.819	2026-07-09 19:27:00.82
255	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:27:01.145
256	12	ORDER_CREATED	admin	1	t	2026-07-09 19:27:01.516	2026-07-09 19:27:01.517
257	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:27:01.845
258	13	ORDER_CREATED	admin	1	t	2026-07-09 19:27:02.151	2026-07-09 19:27:02.152
259	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:27:02.46
299	10	ORDER_CREATED	admin	1	t	2026-07-09 19:28:26.043	2026-07-09 19:28:26.043
301	12	ORDER_CREATED	user	2	t	2026-07-09 19:28:26.216	2026-07-09 19:28:26.216
305	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:26.527
306	10	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:28:26.663
308	12	ORDER_RETURNED	admin	1	t	2026-07-09 19:28:26.837	2026-07-09 19:28:26.838
309	10	ORDER_CREATED	user	1	t	2026-07-09 19:28:26.847	2026-07-09 19:28:26.848
310	12	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:28:27.142
311	13	ORDER_CREATED	user	3	t	2026-07-09 19:28:27.343	2026-07-09 19:28:27.344
313	12	ORDER_CREATED	user	2	t	2026-07-09 19:28:27.346	2026-07-09 19:28:27.347
314	10	ORDER_CREATED	admin	1	t	2026-07-09 19:28:27.444	2026-07-09 19:28:27.445
315	13	ORDER_CREATED	admin	1	t	2026-07-09 19:28:27.505	2026-07-09 19:28:27.506
316	12	ORDER_CREATED	admin	1	t	2026-07-09 19:28:27.655	2026-07-09 19:28:27.656
317	15	ORDER_CREATED	admin	1	t	2026-07-09 19:28:27.656	2026-07-09 19:28:27.657
319	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:27.66
320	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:27.858
321	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:27.859
326	17	ORDER_CREATED	admin	1	t	2026-07-09 19:28:28.379	2026-07-09 19:28:28.38
327	15	ORDER_RETURNED	admin	1	t	2026-07-09 19:28:28.476	2026-07-09 19:28:28.477
328	17	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:28.579
329	13	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:28:28.582
330	13	ORDER_CREATED	user	3	t	2026-07-09 19:28:28.857	2026-07-09 19:28:28.858
332	17	ORDER_RETURNED	user	2	t	2026-07-09 19:28:28.859	2026-07-09 19:28:28.86
333	13	ORDER_CREATED	admin	1	t	2026-07-09 19:28:29.004	2026-07-09 19:28:29.005
334	15	ORDER_CREATED	user	2	t	2026-07-09 19:28:29.024	2026-07-09 19:28:29.025
335	17	ORDER_RETURNED	admin	1	t	2026-07-09 19:28:29.05	2026-07-09 19:28:29.051
336	15	ORDER_CREATED	admin	1	t	2026-07-09 19:28:29.16	2026-07-09 19:28:29.161
337	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:29.185
338	17	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:28:29.205
339	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:29.389
340	17	ORDER_CREATED	user	2	t	2026-07-09 19:28:29.423	2026-07-09 19:28:29.424
341	17	ORDER_CREATED	admin	1	t	2026-07-09 19:28:29.629	2026-07-09 19:28:29.63
342	17	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:29.846
260	15	ORDER_CREATED	admin	1	t	2026-07-09 19:28:00.209	2026-07-09 19:28:00.21
261	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:00.623
262	10	ORDER_CREATED	admin	1	t	2026-07-09 19:28:00.854	2026-07-09 19:28:00.855
263	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:01.03
264	12	ORDER_CREATED	admin	1	t	2026-07-09 19:28:01.213	2026-07-09 19:28:01.214
265	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:01.365
266	13	ORDER_CREATED	admin	1	t	2026-07-09 19:28:01.643	2026-07-09 19:28:01.644
267	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:01.949
268	10	ORDER_ACCEPTED	user	1	t	2026-07-09 19:28:08.047	2026-07-09 19:28:08.048
269	10	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:28:08.243	2026-07-09 19:28:08.244
270	10	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:28:08.397
271	12	ORDER_ACCEPTED	user	2	t	2026-07-09 19:28:09.119	2026-07-09 19:28:09.12
272	12	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:28:09.424	2026-07-09 19:28:09.425
273	12	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:28:09.834
274	13	ORDER_ACCEPTED	user	3	t	2026-07-09 19:28:10.344	2026-07-09 19:28:10.345
275	13	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:28:10.537	2026-07-09 19:28:10.538
276	13	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:28:10.791
277	15	ORDER_ACCEPTED	user	2	t	2026-07-09 19:28:11.27	2026-07-09 19:28:11.271
278	15	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:28:11.473	2026-07-09 19:28:11.474
279	15	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:28:11.678
280	17	ORDER_ACCEPTED	user	2	t	2026-07-09 19:28:12.099	2026-07-09 19:28:12.1
281	17	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:28:12.495	2026-07-09 19:28:12.496
282	17	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:28:12.694
283	17	ORDER_CREATED	user	2	t	2026-07-09 19:28:16.189	2026-07-09 19:28:16.19
284	17	ORDER_CREATED	admin	1	t	2026-07-09 19:28:16.385	2026-07-09 19:28:16.386
285	17	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:16.597
286	15	ORDER_CREATED	user	2	t	2026-07-09 19:28:18.433	2026-07-09 19:28:18.436
287	15	ORDER_CREATED	admin	1	t	2026-07-09 19:28:18.74	2026-07-09 19:28:18.741
288	15	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:18.927
289	13	ORDER_CREATED	user	3	t	2026-07-09 19:28:20.276	2026-07-09 19:28:20.277
290	13	ORDER_CREATED	admin	1	t	2026-07-09 19:28:20.48	2026-07-09 19:28:20.481
291	13	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:20.687
292	12	ORDER_CREATED	user	2	t	2026-07-09 19:28:21.608	2026-07-09 19:28:21.609
293	12	ORDER_CREATED	admin	1	t	2026-07-09 19:28:21.914	2026-07-09 19:28:21.915
294	12	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:22.226
295	10	ORDER_CREATED	user	1	t	2026-07-09 19:28:22.737	2026-07-09 19:28:22.738
296	10	ORDER_CREATED	admin	1	t	2026-07-09 19:28:22.892	2026-07-09 19:28:22.893
297	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:23.145
298	10	ORDER_CREATED	user	1	t	2026-07-09 19:28:25.804	2026-07-09 19:28:25.805
300	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:26.216
302	10	ORDER_RETURNED	user	1	t	2026-07-09 19:28:26.348	2026-07-09 19:28:26.349
303	12	ORDER_CREATED	admin	1	t	2026-07-09 19:28:26.36	2026-07-09 19:28:26.361
304	10	ORDER_RETURNED	admin	1	t	2026-07-09 19:28:26.525	2026-07-09 19:28:26.526
307	12	ORDER_RETURNED	user	2	t	2026-07-09 19:28:26.679	2026-07-09 19:28:26.68
312	15	ORDER_CREATED	user	2	t	2026-07-09 19:28:27.344	2026-07-09 19:28:27.345
318	10	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:28:27.658
322	13	ORDER_RETURNED	user	3	t	2026-07-09 19:28:27.859	2026-07-09 19:28:27.86
323	15	ORDER_RETURNED	user	2	t	2026-07-09 19:28:28.16	2026-07-09 19:28:28.161
324	17	ORDER_CREATED	user	2	t	2026-07-09 19:28:28.165	2026-07-09 19:28:28.166
325	13	ORDER_RETURNED	admin	1	t	2026-07-09 19:28:28.377	2026-07-09 19:28:28.379
331	15	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:28:28.859
343	18	ORDER_CREATED	admin	1	t	2026-07-09 19:39:41.596	2026-07-09 19:39:41.597
344	18	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:39:41.797
345	18	ORDER_CREATED	courier	1	t	2026-07-09 19:39:42.001	2026-07-09 19:39:42.002
346	18	ORDER_ACCEPTED	user	2	t	2026-07-09 19:41:08.731	2026-07-09 19:41:08.732
347	18	COURIER_ASSIGNED	admin	1	t	2026-07-09 19:41:08.945	2026-07-09 19:41:08.946
348	18	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 19:41:09.353
349	18	ORDER_CREATED	user	2	t	2026-07-09 19:41:10.904	2026-07-09 19:41:10.905
350	18	ORDER_CREATED	admin	1	t	2026-07-09 19:41:11.032	2026-07-09 19:41:11.033
351	18	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:41:11.18
352	18	ORDER_CREATED	user	2	t	2026-07-09 19:41:14.371	2026-07-09 19:41:14.372
353	18	ORDER_CREATED	admin	1	t	2026-07-09 19:41:14.666	2026-07-09 19:41:14.667
354	18	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:41:14.796
355	18	ORDER_RETURNED	user	2	t	2026-07-09 19:41:15.075	2026-07-09 19:41:15.076
356	18	ORDER_RETURNED	admin	1	t	2026-07-09 19:41:15.28	2026-07-09 19:41:15.281
357	18	ORDER_RETURNED	admin	2	f	\N	2026-07-09 19:41:15.448
358	18	ORDER_CREATED	user	2	t	2026-07-09 19:41:15.687	2026-07-09 19:41:15.688
359	18	ORDER_CREATED	admin	1	t	2026-07-09 19:41:16.099	2026-07-09 19:41:16.1
360	18	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:41:16.408
361	19	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:46:20.084
362	19	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:46:20.087
363	19	ORDER_CREATED	courier	1	f	\N	2026-07-09 19:46:20.094
364	19	ORDER_REJECTED	user	9	f	\N	2026-07-09 19:46:20.129
365	19	ORDER_REJECTED	admin	1	f	\N	2026-07-09 19:46:20.133
366	19	ORDER_REJECTED	admin	2	f	\N	2026-07-09 19:46:20.136
367	20	ORDER_CREATED	admin	1	t	2026-07-09 19:46:55.033	2026-07-09 19:46:55.034
368	20	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:46:55.397
369	20	ORDER_CREATED	courier	1	t	2026-07-09 19:46:55.753	2026-07-09 19:46:55.754
370	21	ORDER_CREATED	admin	1	f	\N	2026-07-09 19:47:56.475
371	21	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:47:56.478
372	21	ORDER_CREATED	courier	1	f	\N	2026-07-09 19:47:56.485
373	21	ORDER_REJECTED	user	6	f	\N	2026-07-09 19:47:56.512
374	20	ORDER_REJECTED	user	2	t	2026-07-09 19:52:54.12	2026-07-09 19:52:54.121
375	20	ORDER_REJECTED	admin	1	t	2026-07-09 19:52:54.31	2026-07-09 19:52:54.311
376	20	ORDER_REJECTED	admin	2	f	\N	2026-07-09 19:52:54.527
377	22	ORDER_CREATED	admin	1	t	2026-07-09 19:57:49.89	2026-07-09 19:57:49.892
378	22	ORDER_CREATED	admin	2	f	\N	2026-07-09 19:57:50.069
379	22	ORDER_CREATED	courier	1	t	2026-07-09 19:57:50.428	2026-07-09 19:57:50.429
380	22	ORDER_REJECTED	user	1	t	2026-07-09 19:58:22.701	2026-07-09 19:58:22.702
381	22	ORDER_REJECTED	admin	1	t	2026-07-09 19:58:23.006	2026-07-09 19:58:23.007
382	22	ORDER_REJECTED	admin	2	f	\N	2026-07-09 19:58:23.211
383	23	ORDER_CREATED	admin	1	t	2026-07-09 20:36:35.315	2026-07-09 20:36:35.316
384	23	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:36:35.609
385	23	ORDER_CREATED	courier	1	t	2026-07-09 20:36:35.811	2026-07-09 20:36:35.812
386	23	ORDER_ACCEPTED	user	9	t	2026-07-09 20:38:15.931	2026-07-09 20:38:15.932
387	23	COURIER_ASSIGNED	admin	1	t	2026-07-09 20:38:16.084	2026-07-09 20:38:16.085
388	23	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 20:38:16.25
389	24	ORDER_CREATED	admin	1	t	2026-07-09 20:43:11.358	2026-07-09 20:43:11.359
390	24	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:43:11.744
391	24	ORDER_CREATED	courier	1	t	2026-07-09 20:43:11.877	2026-07-09 20:43:11.878
392	24	ORDER_ACCEPTED	user	3	t	2026-07-09 20:43:31.761	2026-07-09 20:43:31.763
393	24	COURIER_ASSIGNED	admin	1	t	2026-07-09 20:43:32.026	2026-07-09 20:43:32.027
394	24	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 20:43:32.349
395	24	ORDER_CREATED	user	3	t	2026-07-09 20:43:55.389	2026-07-09 20:43:55.39
396	24	ORDER_CREATED	admin	1	t	2026-07-09 20:43:55.579	2026-07-09 20:43:55.58
397	24	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:43:55.816
398	24	ORDER_CREATED	user	3	t	2026-07-09 20:44:04.379	2026-07-09 20:44:04.38
399	24	ORDER_CREATED	admin	1	t	2026-07-09 20:44:04.601	2026-07-09 20:44:04.602
400	24	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:44:04.777
401	24	ORDER_RETURNED	user	3	t	2026-07-09 20:44:05.013	2026-07-09 20:44:05.014
402	24	ORDER_RETURNED	admin	1	t	2026-07-09 20:44:05.218	2026-07-09 20:44:05.219
403	24	ORDER_RETURNED	admin	2	f	\N	2026-07-09 20:44:05.437
404	24	ORDER_CREATED	user	3	t	2026-07-09 20:44:05.728	2026-07-09 20:44:05.729
405	24	ORDER_CREATED	admin	1	t	2026-07-09 20:44:05.866	2026-07-09 20:44:05.867
406	24	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:44:06.061
407	25	ORDER_CREATED	admin	1	t	2026-07-09 20:53:30.552	2026-07-09 20:53:30.553
408	25	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:53:30.737
409	25	ORDER_CREATED	courier	1	t	2026-07-09 20:53:30.958	2026-07-09 20:53:30.959
410	26	ORDER_CREATED	admin	1	t	2026-07-09 20:54:44.663	2026-07-09 20:54:44.664
411	26	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:54:44.868
412	26	ORDER_CREATED	courier	1	t	2026-07-09 20:54:45.029	2026-07-09 20:54:45.03
413	26	ORDER_ACCEPTED	user	3	t	2026-07-09 20:54:50.293	2026-07-09 20:54:50.294
414	26	COURIER_ASSIGNED	admin	1	t	2026-07-09 20:54:50.503	2026-07-09 20:54:50.505
415	26	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 20:54:50.707
416	26	ORDER_CREATED	user	3	t	2026-07-09 20:54:56.337	2026-07-09 20:54:56.338
417	26	ORDER_CREATED	admin	1	t	2026-07-09 20:54:56.543	2026-07-09 20:54:56.544
418	26	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:54:56.751
419	26	ORDER_CREATED	user	3	t	2026-07-09 20:55:24.495	2026-07-09 20:55:24.496
420	26	ORDER_CREATED	admin	1	t	2026-07-09 20:55:24.786	2026-07-09 20:55:24.787
421	26	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:55:25.011
422	26	ORDER_RETURNED	user	3	t	2026-07-09 20:55:25.315	2026-07-09 20:55:25.316
423	26	ORDER_RETURNED	admin	1	t	2026-07-09 20:55:25.517	2026-07-09 20:55:25.519
424	26	ORDER_RETURNED	admin	2	f	\N	2026-07-09 20:55:25.693
425	26	ORDER_CREATED	user	3	t	2026-07-09 20:55:25.845	2026-07-09 20:55:25.846
426	26	ORDER_CREATED	admin	1	t	2026-07-09 20:55:26.005	2026-07-09 20:55:26.006
427	26	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:55:26.235
428	27	ORDER_CREATED	admin	1	t	2026-07-09 20:55:42.457	2026-07-09 20:55:42.458
429	27	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:55:42.619
430	27	ORDER_CREATED	courier	1	t	2026-07-09 20:55:42.869	2026-07-09 20:55:42.87
431	27	ORDER_ACCEPTED	user	3	t	2026-07-09 20:55:46.203	2026-07-09 20:55:46.204
432	27	COURIER_ASSIGNED	admin	1	t	2026-07-09 20:55:46.407	2026-07-09 20:55:46.408
433	27	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 20:55:46.627
434	27	ORDER_CREATED	user	3	t	2026-07-09 20:55:48.687	2026-07-09 20:55:48.688
435	27	ORDER_CREATED	admin	1	t	2026-07-09 20:55:48.894	2026-07-09 20:55:48.895
436	27	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:55:49.376
437	28	ORDER_CREATED	admin	1	t	2026-07-09 20:59:02.08	2026-07-09 20:59:02.081
438	28	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:59:02.213
439	28	ORDER_CREATED	courier	1	t	2026-07-09 20:59:02.388	2026-07-09 20:59:02.389
440	28	ORDER_ACCEPTED	user	3	t	2026-07-09 20:59:12.421	2026-07-09 20:59:12.422
441	28	COURIER_ASSIGNED	admin	1	t	2026-07-09 20:59:12.625	2026-07-09 20:59:12.626
442	28	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 20:59:12.786
443	28	ORDER_CREATED	user	3	t	2026-07-09 20:59:16.418	2026-07-09 20:59:16.419
444	28	ORDER_CREATED	admin	1	t	2026-07-09 20:59:16.825	2026-07-09 20:59:16.826
445	28	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:59:16.956
446	27	ORDER_CREATED	admin	1	t	2026-07-09 20:59:27.474	2026-07-09 20:59:27.475
447	27	ORDER_CREATED	admin	2	f	\N	2026-07-09 20:59:27.685
448	27	ORDER_ACCEPTED	user	3	t	2026-07-09 20:59:34.243	2026-07-09 20:59:34.244
449	27	ORDER_ACCEPTED	courier	1	t	2026-07-09 20:59:34.541	2026-07-09 20:59:34.542
450	28	ORDER_CREATED	user	3	f	\N	2026-07-09 21:00:29.884
451	28	ORDER_CREATED	admin	1	t	2026-07-09 21:00:30.7	2026-07-09 21:00:30.701
452	28	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:00:30.862
453	28	ORDER_RETURNED	user	3	t	2026-07-09 21:00:31.059	2026-07-09 21:00:31.06
454	28	ORDER_RETURNED	admin	1	t	2026-07-09 21:00:31.195	2026-07-09 21:00:31.196
455	28	ORDER_RETURNED	admin	2	f	\N	2026-07-09 21:00:31.44
456	28	ORDER_CREATED	user	3	t	2026-07-09 21:00:31.685	2026-07-09 21:00:31.686
457	28	ORDER_CREATED	admin	1	t	2026-07-09 21:00:31.88	2026-07-09 21:00:31.881
458	28	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:00:32.084
459	28	ORDER_CREATED	user	3	t	2026-07-09 21:01:40.791	2026-07-09 21:01:40.792
460	28	ORDER_CREATED	admin	1	t	2026-07-09 21:01:41.099	2026-07-09 21:01:41.1
461	28	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:01:41.407
462	28	ORDER_RETURNED	user	3	t	2026-07-09 21:01:41.599	2026-07-09 21:01:41.601
463	28	ORDER_RETURNED	admin	1	t	2026-07-09 21:01:41.813	2026-07-09 21:01:41.814
464	28	ORDER_RETURNED	admin	2	f	\N	2026-07-09 21:01:42.02
465	28	ORDER_CREATED	user	3	t	2026-07-09 21:01:42.257	2026-07-09 21:01:42.258
466	28	ORDER_CREATED	admin	1	t	2026-07-09 21:01:42.529	2026-07-09 21:01:42.53
467	28	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:01:42.753
468	27	ORDER_CREATED	user	3	t	2026-07-09 21:02:03.037	2026-07-09 21:02:03.038
469	27	ORDER_CREATED	admin	1	t	2026-07-09 21:02:03.326	2026-07-09 21:02:03.327
470	27	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:02:03.614
471	27	ORDER_RETURNED	user	3	t	2026-07-09 21:02:04.872	2026-07-09 21:02:04.873
472	27	ORDER_RETURNED	admin	1	t	2026-07-09 21:02:05.085	2026-07-09 21:02:05.086
473	27	ORDER_RETURNED	admin	2	f	\N	2026-07-09 21:02:05.285
474	27	ORDER_CREATED	user	3	t	2026-07-09 21:02:05.59	2026-07-09 21:02:05.591
475	27	ORDER_CREATED	admin	1	t	2026-07-09 21:02:05.996	2026-07-09 21:02:05.997
476	27	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:02:06.282
477	29	ORDER_CREATED	admin	1	t	2026-07-09 21:05:01.723	2026-07-09 21:05:01.724
478	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:05:02.021
479	29	ORDER_CREATED	courier	1	t	2026-07-09 21:05:02.224	2026-07-09 21:05:02.225
480	29	ORDER_CREATED	admin	1	t	2026-07-09 21:16:00.588	2026-07-09 21:16:00.59
481	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:16:00.778
482	29	ORDER_CREATED	admin	1	t	2026-07-09 21:17:00.468	2026-07-09 21:17:00.47
483	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:17:00.674
484	29	ORDER_CREATED	admin	1	t	2026-07-09 21:18:00.384	2026-07-09 21:18:00.385
485	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:18:00.547
486	29	ORDER_CREATED	admin	1	t	2026-07-09 21:19:00.446	2026-07-09 21:19:00.448
487	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:19:00.891
488	29	ORDER_CREATED	admin	1	t	2026-07-09 21:21:00.389	2026-07-09 21:21:00.391
489	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:21:00.54
490	29	ORDER_CREATED	admin	1	t	2026-07-09 21:22:00.705	2026-07-09 21:22:00.707
491	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:22:00.92
492	29	ORDER_CREATED	admin	1	t	2026-07-09 21:23:00.359	2026-07-09 21:23:00.361
493	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:23:00.501
494	30	ORDER_CREATED	admin	1	t	2026-07-09 21:23:40.676	2026-07-09 21:23:40.677
495	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:23:40.935
496	30	ORDER_CREATED	courier	1	t	2026-07-09 21:23:41.155	2026-07-09 21:23:41.156
497	29	ORDER_CREATED	admin	1	t	2026-07-09 21:24:00.58	2026-07-09 21:24:00.581
498	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:24:00.72
499	29	ORDER_CREATED	admin	1	t	2026-07-09 21:25:00.348	2026-07-09 21:25:00.349
500	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:25:00.477
501	29	ORDER_CREATED	admin	1	t	2026-07-09 21:28:00.454	2026-07-09 21:28:00.456
502	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:28:00.829
503	23	ORDER_DELIVERED	admin	1	f	\N	2026-07-09 21:28:41.946
504	23	ORDER_DELIVERED	admin	2	f	\N	2026-07-09 21:28:41.95
505	23	ORDER_DELIVERED	user	9	f	\N	2026-07-09 21:28:41.954
506	29	ORDER_CREATED	admin	1	t	2026-07-09 21:29:00.378	2026-07-09 21:29:00.38
507	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:29:00.533
508	29	ORDER_CREATED	admin	1	t	2026-07-09 21:30:00.652	2026-07-09 21:30:00.653
509	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:30:01.267
510	29	ORDER_CREATED	admin	1	t	2026-07-09 21:31:00.656	2026-07-09 21:31:00.658
511	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:31:00.864
512	29	ORDER_CREATED	admin	1	t	2026-07-09 21:32:00.662	2026-07-09 21:32:00.663
513	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:32:01.012
514	29	ORDER_CREATED	admin	1	t	2026-07-09 21:33:00.431	2026-07-09 21:33:00.432
515	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:33:00.604
516	29	ORDER_CREATED	admin	1	t	2026-07-09 21:34:00.561	2026-07-09 21:34:00.562
517	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:34:00.695
518	30	ORDER_CREATED	admin	1	t	2026-07-09 21:34:00.901	2026-07-09 21:34:00.902
519	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:34:01.243
520	31	ORDER_CREATED	admin	1	t	2026-07-09 21:34:29.243	2026-07-09 21:34:29.244
521	31	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:34:29.386
522	31	ORDER_CREATED	courier	1	t	2026-07-09 21:34:29.523	2026-07-09 21:34:29.524
523	31	ORDER_ACCEPTED	user	3	t	2026-07-09 21:34:52.899	2026-07-09 21:34:52.9
524	31	COURIER_ASSIGNED	admin	1	t	2026-07-09 21:34:53.213	2026-07-09 21:34:53.214
525	31	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 21:34:53.445
526	31	ORDER_CREATED	user	3	t	2026-07-09 21:34:58.614	2026-07-09 21:34:58.615
527	31	ORDER_CREATED	admin	1	t	2026-07-09 21:34:58.744	2026-07-09 21:34:58.745
528	31	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:34:58.941
529	29	ORDER_CREATED	admin	1	t	2026-07-09 21:35:00.292	2026-07-09 21:35:00.293
530	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:35:00.51
531	30	ORDER_CREATED	admin	1	t	2026-07-09 21:35:00.717	2026-07-09 21:35:00.718
532	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:35:00.928
533	31	ORDER_DELIVERED	admin	1	t	2026-07-09 21:35:07.336	2026-07-09 21:35:07.337
534	31	ORDER_DELIVERED	admin	2	f	\N	2026-07-09 21:35:07.7
535	31	ORDER_DELIVERED	user	3	t	2026-07-09 21:35:07.951	2026-07-09 21:35:07.952
536	29	ORDER_CREATED	admin	1	t	2026-07-09 21:36:00.686	2026-07-09 21:36:00.687
537	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:36:00.892
538	30	ORDER_CREATED	admin	1	t	2026-07-09 21:36:01.096	2026-07-09 21:36:01.097
539	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:36:01.258
540	29	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:37:10.018
541	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:37:20.03
542	30	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:37:30.045
543	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:37:40.057
544	29	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:38:10.017
545	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:38:20.033
546	30	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:38:30.049
547	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:38:40.061
548	29	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:39:07.022
549	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:39:17.038
550	30	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:39:23.182
551	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:39:33.197
552	29	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:40:10.029
553	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:40:17.965
554	30	ORDER_CREATED	admin	1	f	\N	2026-07-09 21:40:26.042
555	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:40:36.057
556	29	ORDER_CREATED	admin	1	t	2026-07-09 21:41:00.372	2026-07-09 21:41:00.373
557	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:41:00.514
558	30	ORDER_CREATED	admin	1	t	2026-07-09 21:41:00.649	2026-07-09 21:41:00.65
559	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:41:00.829
560	29	ORDER_CREATED	admin	1	t	2026-07-09 21:42:00.436	2026-07-09 21:42:00.437
561	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:42:00.65
562	30	ORDER_CREATED	admin	1	t	2026-07-09 21:42:00.827	2026-07-09 21:42:00.828
563	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:42:01.033
564	29	ORDER_CREATED	admin	1	t	2026-07-09 21:43:00.356	2026-07-09 21:43:00.357
565	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:43:00.517
566	30	ORDER_CREATED	admin	1	t	2026-07-09 21:43:00.636	2026-07-09 21:43:00.637
567	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:43:00.768
568	29	ORDER_CREATED	admin	1	t	2026-07-09 21:44:00.84	2026-07-09 21:44:00.842
569	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:44:01.046
570	30	ORDER_CREATED	admin	1	t	2026-07-09 21:44:01.249	2026-07-09 21:44:01.25
571	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:44:01.455
572	29	ORDER_CREATED	admin	1	t	2026-07-09 21:45:00.948	2026-07-09 21:45:00.949
573	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:45:01.257
574	30	ORDER_CREATED	admin	1	t	2026-07-09 21:45:01.488	2026-07-09 21:45:01.489
575	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:45:01.667
576	29	ORDER_CREATED	admin	1	t	2026-07-09 21:46:00.364	2026-07-09 21:46:00.365
577	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:46:00.503
578	30	ORDER_CREATED	admin	1	t	2026-07-09 21:46:00.629	2026-07-09 21:46:00.631
579	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:46:00.795
580	29	ORDER_CREATED	admin	1	t	2026-07-09 21:47:00.453	2026-07-09 21:47:00.454
581	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:47:00.719
582	30	ORDER_CREATED	admin	1	t	2026-07-09 21:47:00.858	2026-07-09 21:47:00.859
583	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:47:01.01
584	29	ORDER_CREATED	admin	1	t	2026-07-09 21:48:00.551	2026-07-09 21:48:00.553
585	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:48:00.736
586	30	ORDER_CREATED	admin	1	t	2026-07-09 21:48:00.915	2026-07-09 21:48:00.916
587	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:48:01.105
588	29	ORDER_CREATED	admin	1	t	2026-07-09 21:49:00.685	2026-07-09 21:49:00.687
589	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:49:00.891
590	30	ORDER_CREATED	admin	1	t	2026-07-09 21:49:01.088	2026-07-09 21:49:01.09
591	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:49:01.298
592	29	ORDER_CREATED	admin	1	t	2026-07-09 21:50:00.434	2026-07-09 21:50:00.435
593	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:50:00.564
594	30	ORDER_CREATED	admin	1	t	2026-07-09 21:50:00.692	2026-07-09 21:50:00.693
595	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:50:00.988
596	29	ORDER_CREATED	admin	1	t	2026-07-09 21:51:00.388	2026-07-09 21:51:00.39
597	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:51:00.52
598	30	ORDER_CREATED	admin	1	t	2026-07-09 21:51:00.665	2026-07-09 21:51:00.667
599	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:51:00.795
600	29	ORDER_CREATED	admin	1	t	2026-07-09 21:52:00.894	2026-07-09 21:52:00.896
601	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:52:01.098
602	30	ORDER_CREATED	admin	1	t	2026-07-09 21:52:01.301	2026-07-09 21:52:01.302
603	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:52:01.885
604	29	ORDER_CREATED	admin	1	t	2026-07-09 21:53:00.407	2026-07-09 21:53:00.408
605	29	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:53:00.546
606	30	ORDER_CREATED	admin	1	t	2026-07-09 21:53:00.675	2026-07-09 21:53:00.676
607	30	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:53:00.947
608	30	ORDER_REJECTED	user	3	t	2026-07-09 21:53:23.609	2026-07-09 21:53:23.611
609	30	ORDER_REJECTED	admin	1	t	2026-07-09 21:53:24.142	2026-07-09 21:53:24.143
610	30	ORDER_REJECTED	admin	2	f	\N	2026-07-09 21:53:24.347
611	29	ORDER_REJECTED	user	3	t	2026-07-09 21:53:26.908	2026-07-09 21:53:26.909
612	29	ORDER_REJECTED	admin	1	t	2026-07-09 21:53:27.111	2026-07-09 21:53:27.112
613	29	ORDER_REJECTED	admin	2	f	\N	2026-07-09 21:53:27.294
614	32	ORDER_CREATED	admin	1	t	2026-07-09 21:53:59.352	2026-07-09 21:53:59.353
615	32	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:53:59.49
616	32	ORDER_CREATED	courier	1	t	2026-07-09 21:53:59.632	2026-07-09 21:53:59.633
617	32	ORDER_ACCEPTED	user	3	t	2026-07-09 21:54:08.173	2026-07-09 21:54:08.174
618	32	COURIER_ASSIGNED	admin	1	t	2026-07-09 21:54:08.416	2026-07-09 21:54:08.417
619	32	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 21:54:08.588
620	32	ORDER_CREATED	user	3	t	2026-07-09 21:54:10.324	2026-07-09 21:54:10.325
621	32	ORDER_CREATED	admin	1	t	2026-07-09 21:54:10.473	2026-07-09 21:54:10.474
622	32	ORDER_CREATED	admin	2	f	\N	2026-07-09 21:54:10.626
623	32	ORDER_ARRIVED	admin	1	t	2026-07-09 21:54:10.901	2026-07-09 21:54:10.902
624	32	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 21:54:11.051
625	32	ORDER_ARRIVED	admin	1	t	2026-07-09 21:56:36.045	2026-07-09 21:56:36.046
626	32	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 21:56:36.246
627	32	ORDER_ARRIVED	admin	1	t	2026-07-09 21:58:21.748	2026-07-09 21:58:21.749
628	32	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 21:58:21.878
629	32	ORDER_ARRIVED	admin	1	t	2026-07-09 21:58:24.07	2026-07-09 21:58:24.071
630	32	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 21:58:24.277
631	33	ORDER_CREATED	admin	1	t	2026-07-09 22:08:32.669	2026-07-09 22:08:32.671
632	33	ORDER_CREATED	admin	2	f	\N	2026-07-09 22:08:32.844
633	33	ORDER_CREATED	courier	1	t	2026-07-09 22:08:33.009	2026-07-09 22:08:33.011
634	34	ORDER_CREATED	admin	1	t	2026-07-09 22:08:59.601	2026-07-09 22:08:59.602
635	34	ORDER_CREATED	admin	2	f	\N	2026-07-09 22:08:59.791
636	34	ORDER_CREATED	courier	1	t	2026-07-09 22:08:59.982	2026-07-09 22:08:59.984
637	34	ORDER_ACCEPTED	user	10	t	2026-07-09 22:09:52.537	2026-07-09 22:09:52.538
638	34	COURIER_ASSIGNED	admin	1	t	2026-07-09 22:09:52.675	2026-07-09 22:09:52.676
639	34	COURIER_ASSIGNED	admin	2	f	\N	2026-07-09 22:09:52.919
640	34	ORDER_CREATED	user	10	t	2026-07-09 22:09:57.534	2026-07-09 22:09:57.535
641	34	ORDER_CREATED	admin	1	t	2026-07-09 22:09:57.829	2026-07-09 22:09:57.83
642	34	ORDER_CREATED	admin	2	f	\N	2026-07-09 22:09:58.073
643	34	ORDER_ARRIVED	admin	1	t	2026-07-09 22:09:58.447	2026-07-09 22:09:58.448
644	34	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 22:09:58.784
645	34	ORDER_ARRIVED	admin	1	t	2026-07-09 22:10:16.364	2026-07-09 22:10:16.365
646	34	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 22:10:16.57
647	34	ORDER_ARRIVED	admin	1	t	2026-07-09 22:10:20.911	2026-07-09 22:10:20.912
648	34	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 22:10:21.074
649	34	ORDER_DELIVERED	admin	1	t	2026-07-09 22:10:31.825	2026-07-09 22:10:31.827
650	34	ORDER_DELIVERED	admin	2	f	\N	2026-07-09 22:10:32.009
651	34	ORDER_DELIVERED	user	10	t	2026-07-09 22:10:32.178	2026-07-09 22:10:32.179
652	34	ORDER_ARRIVED	admin	1	t	2026-07-09 22:11:29.169	2026-07-09 22:11:29.17
653	34	ORDER_ARRIVED	admin	2	f	\N	2026-07-09 22:11:29.3
654	34	ORDER_RETURNED	admin	1	t	2026-07-09 22:12:18.527	2026-07-09 22:12:18.528
655	34	ORDER_RETURNED	admin	2	f	\N	2026-07-09 22:12:18.677
656	34	ORDER_RETURNED	user	10	t	2026-07-09 22:12:18.813	2026-07-09 22:12:18.814
657	33	ORDER_REJECTED	user	3	t	2026-07-09 22:14:00.302	2026-07-09 22:14:00.303
658	33	ORDER_REJECTED	admin	1	t	2026-07-09 22:14:00.516	2026-07-09 22:14:00.517
659	33	ORDER_REJECTED	admin	2	f	\N	2026-07-09 22:14:00.722
\.


--
-- Data for Name: order_inventory_items; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.order_inventory_items (id, "orderId", "inventoryItemId", role, "returnedAt", "returnCondition", "returnNote", "createdAt") FROM stdin;
1	34	17	CONSOLE	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.838
2	34	4	JOYSTICK	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.843
3	34	5	JOYSTICK	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.844
4	34	6	JOYSTICK	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.846
5	34	7	JOYSTICK	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.847
6	34	13	HDMI	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.848
7	34	14	POWER	2026-07-09 22:12:17.139	IDEAL	Dinaxuy	2026-07-09 22:10:29.849
\.


--
-- Data for Name: order_payments; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.order_payments (id, "orderId", amount, method, status, "paidAt", note, "createdAt") FROM stdin;
1	13	70000.00	CASH	UNPAID	\N	\N	2026-07-09 19:06:48.596
2	14	70000.00	CASH	UNPAID	\N	\N	2026-07-09 19:06:58.437
3	15	100000.00	CASH	UNPAID	\N	\N	2026-07-09 19:07:40.519
4	16	70000.00	CASH	UNPAID	\N	\N	2026-07-09 19:09:41.476
5	17	70000.00	CASH	UNPAID	\N	\N	2026-07-09 19:21:30.792
6	18	129990.00	CASH	UNPAID	\N	\N	2026-07-09 19:39:41.308
7	19	110000.00	CASH	UNPAID	\N	\N	2026-07-09 19:46:20.056
8	20	129990.00	CASH	UNPAID	\N	\N	2026-07-09 19:46:54.841
9	21	110000.00	CASH	UNPAID	\N	\N	2026-07-09 19:47:56.449
10	22	279990.00	CASH	UNPAID	\N	\N	2026-07-09 19:57:49.554
12	24	229990.00	CASH	UNPAID	\N	\N	2026-07-09 20:43:11.172
13	25	164990.00	CASH	UNPAID	\N	\N	2026-07-09 20:53:30.348
14	26	164990.00	CASH	UNPAID	\N	\N	2026-07-09 20:54:44.482
15	27	329990.00	CASH	UNPAID	\N	\N	2026-07-09 20:55:42.24
16	28	164990.00	CASH	UNPAID	\N	\N	2026-07-09 20:59:01.904
17	27	119990.00	CASH	UNPAID	\N	\N	2026-07-09 20:59:33.747
18	29	209991.00	CASH	UNPAID	\N	\N	2026-07-09 21:05:01.519
19	30	164990.00	CASH	UNPAID	\N	\N	2026-07-09 21:23:40.275
11	23	229990.00	CARD	PAID	2026-07-09 21:28:41.817	Delivery handover	2026-07-09 20:36:35.113
20	31	109990.00	CASH	PAID	2026-07-09 21:35:06.934	Delivery handover	2026-07-09 21:34:28.96
21	32	109990.00	CASH	UNPAID	\N	\N	2026-07-09 21:53:59.216
22	33	164990.00	CASH	UNPAID	\N	\N	2026-07-09 22:08:32.5
23	34	109990.00	CASH	PAID	2026-07-09 22:10:29.829	Delivery handover	2026-07-09 22:08:59.398
\.


--
-- Data for Name: order_photos; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.order_photos (id, "orderId", "photoType", "filePath", "telegramFileId", "createdAt") FROM stdin;
1	34	HANDOVER	/home/dior/Desktop/playstation-rental-bot/uploads/photos/order-34-HANDOVER-1783635029909.jpg	AgACAgIAAxkBAAIK62pQGZGDuUSrDhtPxvht1Rd_xKp4AAJPHWsbZBqBSu78_cjI1JhOAQADAgADeQADPAQ	2026-07-09 22:10:31.223
2	34	RETURN	/home/dior/Desktop/playstation-rental-bot/uploads/returns/order-34-RETURN-1783635137156.jpg	AgACAgIAAxkBAAILQ2pQHMBVweTXp8PYoQXPuhDq4fPnAAJYHWsbZBqBSjobXJ_KA55_AQADAgADeQADPAQ	2026-07-09 22:12:18.358
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
41	10	PENDING	2026-07-09 19:03:46.411	system	\N	Buyurtma yaratildi
42	11	PENDING	2026-07-09 19:04:32.129	system	\N	Buyurtma yaratildi
43	12	PENDING	2026-07-09 19:06:11.234	system	\N	Buyurtma yaratildi
44	13	PENDING	2026-07-09 19:06:48.582	system	\N	Buyurtma yaratildi
45	14	PENDING	2026-07-09 19:06:58.423	system	\N	Buyurtma yaratildi
46	14	COURIER_ASSIGNED	2026-07-09 19:07:09.988	courier	1	Kuryer buyurtmani qabul qildi
47	15	PENDING	2026-07-09 19:07:40.508	system	\N	Buyurtma yaratildi
48	16	PENDING	2026-07-09 19:09:41.465	system	\N	Buyurtma yaratildi
49	16	COURIER_ASSIGNED	2026-07-09 19:10:16.813	admin	2	Admin tomonidan kuryer biriktirildi
50	16	ON_THE_WAY	2026-07-09 19:10:49.889	courier	2	Status: ON_THE_WAY
51	16	DELIVERED	2026-07-09 19:10:59.103	courier	2	Status: DELIVERED
52	16	RETURNED	2026-07-09 19:11:25.035	courier	2	Status: RETURNED
53	16	COMPLETED	2026-07-09 19:11:28.903	courier	2	Status: COMPLETED
54	17	PENDING	2026-07-09 19:21:30.781	system	\N	Buyurtma yaratildi
55	17	REJECTED	2026-07-09 19:21:49.746	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
56	11	REJECTED	2026-07-09 19:22:11.971	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
57	12	REJECTED	2026-07-09 19:22:13.695	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
58	13	REJECTED	2026-07-09 19:22:15.458	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
59	15	REJECTED	2026-07-09 19:22:17.71	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
60	11	REJECTED	2026-07-09 19:22:34.464	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
61	12	REJECTED	2026-07-09 19:22:36.834	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
62	13	REJECTED	2026-07-09 19:22:38.588	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
63	15	REJECTED	2026-07-09 19:22:40.023	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
64	11	COURIER_ASSIGNED	2026-07-09 19:22:56.544	courier	1	Kuryer buyurtmani qabul qildi
65	10	REJECTED	2026-07-09 19:27:16.544	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
66	12	REJECTED	2026-07-09 19:27:19.363	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
67	13	REJECTED	2026-07-09 19:27:21.636	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
68	15	REJECTED	2026-07-09 19:27:23.562	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
69	17	REJECTED	2026-07-09 19:27:25.205	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
70	10	COURIER_ASSIGNED	2026-07-09 19:28:07.858	courier	1	Kuryer buyurtmani qabul qildi
71	12	COURIER_ASSIGNED	2026-07-09 19:28:08.929	courier	1	Kuryer buyurtmani qabul qildi
72	13	COURIER_ASSIGNED	2026-07-09 19:28:10.055	courier	1	Kuryer buyurtmani qabul qildi
73	15	COURIER_ASSIGNED	2026-07-09 19:28:11.079	courier	1	Kuryer buyurtmani qabul qildi
74	17	COURIER_ASSIGNED	2026-07-09 19:28:11.964	courier	1	Kuryer buyurtmani qabul qildi
75	17	ARRIVED	2026-07-09 19:28:15.901	courier	1	Status: ARRIVED
76	15	ARRIVED	2026-07-09 19:28:18.246	courier	1	Status: ARRIVED
77	13	ARRIVED	2026-07-09 19:28:20.107	courier	1	Status: ARRIVED
78	12	ARRIVED	2026-07-09 19:28:21.42	courier	1	Status: ARRIVED
79	10	ARRIVED	2026-07-09 19:28:22.561	courier	1	Status: ARRIVED
80	10	RETURNED	2026-07-09 19:28:25.513	courier	1	Status: RETURNED
81	12	RETURNED	2026-07-09 19:28:26.053	courier	1	Status: RETURNED
82	13	RETURNED	2026-07-09 19:28:26.544	courier	1	Status: RETURNED
83	10	COMPLETED	2026-07-09 19:28:26.684	courier	1	Status: COMPLETED
84	12	COMPLETED	2026-07-09 19:28:27.162	courier	1	Status: COMPLETED
85	15	RETURNED	2026-07-09 19:28:27.185	courier	1	Status: RETURNED
86	17	RETURNED	2026-07-09 19:28:27.98	courier	1	Status: RETURNED
87	13	COMPLETED	2026-07-09 19:28:28.601	courier	1	Status: COMPLETED
88	15	COMPLETED	2026-07-09 19:28:28.878	courier	1	Status: COMPLETED
89	17	COMPLETED	2026-07-09 19:28:29.222	courier	1	Status: COMPLETED
90	18	PENDING	2026-07-09 19:39:41.296	system	\N	Buyurtma yaratildi
91	18	REJECTED	2026-07-09 19:39:48.974	courier	1	Kuryer rad etdi (boshqa kuryerlar ko'ra oladi)
92	18	COURIER_ASSIGNED	2026-07-09 19:41:08.554	courier	1	Kuryer buyurtmani qabul qildi
93	18	ARRIVED	2026-07-09 19:41:10.736	courier	1	Status: ARRIVED
94	18	RETURNED	2026-07-09 19:41:14.222	courier	1	Status: RETURNED
95	18	COMPLETED	2026-07-09 19:41:15.467	courier	1	Status: COMPLETED
96	19	PENDING	2026-07-09 19:46:20.04	system	\N	Buyurtma yaratildi
97	19	REJECTED	2026-07-09 19:46:20.121	courier	1	Kuryer buyurtmani rad etdi
98	20	PENDING	2026-07-09 19:46:54.83	system	\N	Buyurtma yaratildi
99	21	PENDING	2026-07-09 19:47:56.436	system	\N	Buyurtma yaratildi
100	21	REJECTED	2026-07-09 19:47:56.503	admin	\N	Admin buyurtmani rad etdi | actorTelegramId=8866189157
101	20	ACCEPTED	2026-07-09 19:52:44.199	admin	\N	Admin buyurtmani tasdiqladi | actorTelegramId=8866189157
102	20	REJECTED	2026-07-09 19:52:53.935	courier	1	Kuryer buyurtmani rad etdi
103	22	PENDING	2026-07-09 19:57:49.545	system	\N	Buyurtma yaratildi
104	22	REJECTED	2026-07-09 19:58:22.516	courier	1	Kuryer buyurtmani rad etdi
105	23	PENDING	2026-07-09 20:36:35.106	system	\N	Buyurtma yaratildi
106	23	COURIER_ASSIGNED	2026-07-09 20:38:15.707	courier	1	Kuryer buyurtmani qabul qildi
107	24	PENDING	2026-07-09 20:43:11.164	system	\N	Buyurtma yaratildi
108	24	COURIER_ASSIGNED	2026-07-09 20:43:31.551	courier	1	Kuryer buyurtmani qabul qildi
109	24	ARRIVED	2026-07-09 20:43:55.102	courier	1	Status: ARRIVED
110	24	RETURNED	2026-07-09 20:44:04.212	courier	1	Status: RETURNED
111	24	COMPLETED	2026-07-09 20:44:05.458	courier	1	Status: COMPLETED
112	25	PENDING	2026-07-09 20:53:30.34	system	\N	Buyurtma yaratildi
113	25	ACCEPTED	2026-07-09 20:53:39.864	admin	\N	Admin buyurtmani tasdiqladi | actorTelegramId=8866189157
114	25	ACCEPTED	2026-07-09 20:54:02.916	admin	\N	Admin buyurtmani tasdiqladi | actorTelegramId=8866189157
115	26	PENDING	2026-07-09 20:54:44.474	system	\N	Buyurtma yaratildi
116	26	COURIER_ASSIGNED	2026-07-09 20:54:50.009	courier	1	Kuryer buyurtmani qabul qildi
117	26	ARRIVED	2026-07-09 20:54:55.44	courier	1	Status: ARRIVED
118	26	RETURNED	2026-07-09 20:55:24.202	courier	1	Status: RETURNED
119	26	COMPLETED	2026-07-09 20:55:25.713	courier	1	Status: COMPLETED
120	27	PENDING	2026-07-09 20:55:42.225	system	\N	Buyurtma yaratildi
121	27	COURIER_ASSIGNED	2026-07-09 20:55:46.019	courier	1	Kuryer buyurtmani qabul qildi
122	27	ARRIVED	2026-07-09 20:55:48.501	courier	1	Status: ARRIVED
123	28	PENDING	2026-07-09 20:59:01.895	system	\N	Buyurtma yaratildi
124	28	COURIER_ASSIGNED	2026-07-09 20:59:12.153	courier	1	Kuryer buyurtmani qabul qildi
125	28	DELIVERED	2026-07-09 20:59:16.127	courier	1	Status: DELIVERED
126	27	ARRIVED	2026-07-09 20:59:33.744	admin	1	Ijara 24 soatga uzaytirildi (+119990 so'm). Yangi tugash: 15.07.2026 22:00
127	28	RETURNED	2026-07-09 21:00:29.441	courier	1	Status: RETURNED
128	28	COMPLETED	2026-07-09 21:00:31.469	courier	1	Status: COMPLETED
129	28	RETURNED	2026-07-09 21:01:40.604	courier	1	Status: RETURNED
130	28	COMPLETED	2026-07-09 21:01:42.049	courier	1	Status: COMPLETED
131	27	RETURNED	2026-07-09 21:02:02.751	courier	1	Status: RETURNED
132	27	COMPLETED	2026-07-09 21:02:05.328	courier	1	Status: COMPLETED
133	29	PENDING	2026-07-09 21:05:01.505	system	\N	Buyurtma yaratildi
134	30	PENDING	2026-07-09 21:23:40.267	system	\N	Buyurtma yaratildi
135	23	DELIVERED	2026-07-09 21:28:41.826	courier	1	Handover: CARD, ID_CARD
136	31	PENDING	2026-07-09 21:34:28.952	system	\N	Buyurtma yaratildi
137	31	COURIER_ASSIGNED	2026-07-09 21:34:52.723	courier	1	Kuryer buyurtmani qabul qildi
138	31	ARRIVED	2026-07-09 21:34:58.144	courier	1	Status: ARRIVED
139	31	DELIVERED	2026-07-09 21:35:06.938	courier	1	Handover: CASH, ID_CARD
140	30	REJECTED	2026-07-09 21:53:23.367	courier	1	Kuryer buyurtmani rad etdi
141	29	REJECTED	2026-07-09 21:53:26.746	courier	1	Kuryer buyurtmani rad etdi
142	32	PENDING	2026-07-09 21:53:59.206	system	\N	Buyurtma yaratildi
143	32	COURIER_ASSIGNED	2026-07-09 21:54:07.978	courier	1	Kuryer buyurtmani qabul qildi
144	32	ARRIVED	2026-07-09 21:54:10.172	courier	1	Status: ARRIVED
145	33	PENDING	2026-07-09 22:08:32.462	system	\N	Buyurtma yaratildi
146	34	PENDING	2026-07-09 22:08:59.376	system	\N	Buyurtma yaratildi
147	34	COURIER_ASSIGNED	2026-07-09 22:09:52.326	courier	1	Kuryer buyurtmani qabul qildi
148	34	ARRIVED	2026-07-09 22:09:57.363	courier	1	Status: ARRIVED
149	34	DELIVERED	2026-07-09 22:10:29.836	courier	1	Handover inventory+payment CASH/ID_CARD
150	34	ACTIVE	2026-07-09 22:10:29.837	courier	1	Rental ACTIVE
151	34	RETURNED	2026-07-09 22:12:17.151	courier	1	Inventory returned
152	34	COMPLETED	2026-07-09 22:12:17.152	courier	1	Rental completed
153	33	REJECTED	2026-07-09 22:14:00.15	courier	1	Kuryer buyurtmani rad etdi
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.orders (id, "userId", "courierId", "playstationId", "promocodeId", "consoleType", address, latitude, longitude, "startDatetime", "endDatetime", "totalPrice", status, "createdAt", "updatedAt", "rentalPriceId", "depositAmount", "acceptedAt", "assignedAt", "deliveryStartedAt", "deliveryCompletedAt", "assignedByAdmin", "deliveryFee", "inventoryUnitId", "deliveryZoneCode", "paymentReceived", "paymentMethod", "paymentReceivedAt", "finalPaidAmount", "collateralType", "collateralTaken", "collateralReturned", "deliveredByCourierId", "consoleItemId", "hdmiItemId", "powerItemId", "returnCondition", "returnNote", "returnedAt") FROM stdin;
14	2	1	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-10 15:00:00	2026-07-11 15:00:00	40000.00	COURIER_ASSIGNED	2026-07-09 19:06:58.418	2026-07-09 19:07:09.983	3	0.00	2026-07-09 19:07:09.982	2026-07-09 19:07:09.982	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
6	1	1	\N	\N	PS5	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-07 16:00:00	2026-07-10 16:00:00	300000.00	COURIER_ASSIGNED	2026-07-05 21:44:20.676	2026-07-05 21:50:54.446	7	0.00	2026-07-05 21:50:54.445	2026-07-05 21:50:54.445	\N	\N	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
2	1	1	1	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 04:00:00	2026-07-07 04:00:00	50000.00	COURIER_ASSIGNED	2026-07-05 21:24:41.313	2026-07-05 21:51:07.659	3	0.00	2026-07-05 21:51:07.658	2026-07-05 21:51:07.658	\N	\N	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
12	2	1	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-11 16:30:00	2026-07-13 16:30:00	70000.00	COMPLETED	2026-07-09 19:06:11.232	2026-07-09 19:28:27.156	2	0.00	2026-07-09 19:28:08.924	2026-07-09 19:28:08.924	\N	2026-07-09 19:28:27.155	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
23	9	1	\N	\N	PS3	Lokatsiya: 39.90197, 66.26444	39.901967	66.264444	2026-07-10 18:00:00	2026-07-13 18:00:00	199990.00	DELIVERED	2026-07-09 20:36:35.102	2026-07-09 21:28:41.86	1	0.00	2026-07-09 20:38:15.701	2026-07-09 20:38:15.701	\N	2026-07-09 21:28:41.817	f	30000.00	1	CITY	t	CARD	2026-07-09 21:28:41.817	229990.00	ID_CARD	t	f	1	\N	\N	\N	\N	\N	\N
3	2	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 04:00:00	2026-07-07 04:00:00	100000.00	ARRIVED	2026-07-05 21:30:43.654	2026-07-05 21:57:12.201	3	0.00	2026-07-05 21:56:47.28	2026-07-05 21:56:47.28	\N	\N	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
13	3	1	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-09 21:00:00	2026-07-10 21:00:00	40000.00	COMPLETED	2026-07-09 19:06:48.577	2026-07-09 19:28:28.595	3	0.00	2026-07-09 19:28:10.05	2026-07-09 19:28:10.05	\N	2026-07-09 19:28:28.594	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
15	2	1	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-11 15:00:00	2026-07-13 15:00:00	70000.00	COMPLETED	2026-07-09 19:07:40.504	2026-07-09 19:28:28.873	2	0.00	2026-07-09 19:28:11.074	2026-07-09 19:28:11.074	\N	2026-07-09 19:28:28.871	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
17	2	1	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-10 04:00:00	2026-07-11 04:00:00	40000.00	COMPLETED	2026-07-09 19:21:30.778	2026-07-09 19:28:29.217	3	0.00	2026-07-09 19:28:11.961	2026-07-09 19:28:11.961	\N	2026-07-09 19:28:29.216	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
4	2	2	\N	\N	PS5	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-07 10:00:00	2026-07-10 10:00:00	120000.00	COMPLETED	2026-07-05 21:32:45.72	2026-07-05 22:01:58.437	7	0.00	2026-07-05 22:01:52.072	2026-07-05 22:01:52.072	\N	2026-07-05 22:01:58.436	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
16	9	2	\N	\N	PS3	Lokatsiya: 39.90197, 66.26444	39.901967	66.264444	2026-07-10 07:30:00	2026-07-11 07:30:00	40000.00	CANCELLED	2026-07-09 19:09:41.46	2026-07-09 19:17:13.225	3	0.00	2026-07-09 19:10:16.807	2026-07-09 19:10:16.807	2026-07-09 19:10:49.874	2026-07-09 19:11:28.896	t	30000.00	1	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
11	1	1	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-11 13:30:00	2026-07-13 13:30:00	70000.00	COURIER_ASSIGNED	2026-07-09 19:04:32.125	2026-07-09 19:22:56.539	2	0.00	2026-07-09 19:22:56.538	2026-07-09 19:22:56.538	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
5	1	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 04:00:00	2026-07-07 04:00:00	40000.00	COMPLETED	2026-07-05 21:43:49.374	2026-07-05 22:02:32.01	3	0.00	2026-07-05 22:02:20.736	2026-07-05 22:02:20.736	\N	2026-07-05 22:02:32.009	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
24	3	1	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-11 16:30:00	2026-07-14 16:30:00	199990.00	COMPLETED	2026-07-09 20:43:11.16	2026-07-09 20:44:05.452	1	0.00	2026-07-09 20:43:31.546	2026-07-09 20:43:31.546	\N	2026-07-09 20:44:05.451	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
7	1	2	\N	\N	PS4	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 07:00:00	2026-07-07 07:00:00	80000.00	COMPLETED	2026-07-05 22:06:39.494	2026-07-05 22:07:31.516	6	0.00	2026-07-05 22:06:49.539	2026-07-05 22:06:49.539	\N	2026-07-05 22:07:31.515	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
18	2	1	\N	\N	PS3	Lokatsiya: 39.90202, 66.26422	39.902016	66.264225	2026-07-10 13:30:00	2026-07-11 13:30:00	99990.00	COMPLETED	2026-07-09 19:39:41.293	2026-07-09 19:41:15.462	3	0.00	2026-07-09 19:41:08.543	2026-07-09 19:41:08.543	\N	2026-07-09 19:41:15.461	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
34	10	1	\N	\N	PS3	Lokatsiya: 39.84911, 66.26211	39.849115	66.262114	2026-07-11 16:30:00	2026-07-12 16:30:00	79990.00	COMPLETED	2026-07-09 22:08:59.37	2026-07-09 22:12:17.148	3	0.00	2026-07-09 22:09:52.322	2026-07-09 22:09:52.322	\N	2026-07-09 22:10:29.829	f	30000.00	\N	CITY	t	CASH	2026-07-09 22:10:29.829	109990.00	ID_CARD	t	t	1	17	13	14	IDEAL	Dinaxuy	2026-07-09 22:12:17.139
8	1	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-07 07:00:00	2026-07-10 07:00:00	95000.00	COMPLETED	2026-07-05 22:14:07.854	2026-07-05 22:15:28.884	1	0.00	2026-07-05 22:14:15.386	2026-07-05 22:14:15.386	\N	2026-07-05 22:15:28.883	f	0.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
25	3	\N	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-10 10:00:00	2026-07-12 10:00:00	134990.00	ACCEPTED	2026-07-09 20:53:30.336	2026-07-09 20:54:02.908	2	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
19	9	\N	\N	\N	PS4	t	\N	\N	2026-07-10 04:00:00	2026-07-11 04:00:00	80000.00	REJECTED	2026-07-09 19:46:20.035	2026-07-09 19:46:20.114	6	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
9	3	2	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-06 07:00:00	2026-07-07 07:00:00	40000.00	COMPLETED	2026-07-05 22:31:47.14	2026-07-05 22:32:02.917	3	0.00	2026-07-05 22:31:54.522	2026-07-05 22:31:54.522	\N	2026-07-05 22:32:02.916	f	30000.00	\N	\N	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
32	3	1	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-10 15:00:00	2026-07-11 15:00:00	79990.00	ARRIVED	2026-07-09 21:53:59.202	2026-07-09 21:54:10.161	3	0.00	2026-07-09 21:54:07.974	2026-07-09 21:54:07.974	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
10	1	1	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-10 04:00:00	2026-07-11 04:00:00	40000.00	COMPLETED	2026-07-09 19:03:46.404	2026-07-09 19:28:26.678	3	0.00	2026-07-09 19:28:07.853	2026-07-09 19:28:07.853	\N	2026-07-09 19:28:26.677	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
28	3	1	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-11 15:00:00	2026-07-13 15:00:00	134990.00	COMPLETED	2026-07-09 20:59:01.891	2026-07-09 21:01:42.042	2	0.00	2026-07-09 20:59:12.147	2026-07-09 20:59:12.147	\N	2026-07-09 21:01:42.041	f	30000.00	1	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
21	6	\N	\N	\N	PS4	test	\N	\N	2026-07-11 10:00:00	2026-07-12 10:00:00	80000.00	REJECTED	2026-07-09 19:47:56.431	2026-07-09 19:47:56.497	6	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
26	3	1	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-10 12:00:00	2026-07-12 12:00:00	134990.00	COMPLETED	2026-07-09 20:54:44.471	2026-07-09 20:55:25.707	2	0.00	2026-07-09 20:54:50.003	2026-07-09 20:54:50.003	\N	2026-07-09 20:55:25.706	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
20	2	\N	\N	\N	PS3	Lokatsiya: 39.90202, 66.26422	39.902016	66.264225	2026-07-10 12:00:00	2026-07-11 12:00:00	99990.00	REJECTED	2026-07-09 19:46:54.827	2026-07-09 19:52:53.93	3	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
22	1	\N	\N	\N	PS3	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	2026-07-11 16:30:00	2026-07-14 16:30:00	249990.00	REJECTED	2026-07-09 19:57:49.541	2026-07-09 19:58:22.508	1	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
31	3	1	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-11 15:00:00	2026-07-12 15:00:00	79990.00	DELIVERED	2026-07-09 21:34:28.948	2026-07-09 21:35:06.956	3	0.00	2026-07-09 21:34:52.719	2026-07-09 21:34:52.719	\N	2026-07-09 21:35:06.934	f	30000.00	10	CITY	t	CASH	2026-07-09 21:35:06.934	109990.00	ID_CARD	t	f	1	\N	\N	\N	\N	\N	\N
30	3	\N	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-11 16:30:00	2026-07-13 16:30:00	134990.00	REJECTED	2026-07-09 21:23:40.264	2026-07-09 21:53:23.34	2	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
29	3	\N	\N	2	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-11 16:00:00	2026-07-14 16:00:00	179991.00	REJECTED	2026-07-09 21:05:01.502	2026-07-09 21:53:26.736	1	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
27	3	1	\N	\N	PS4	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-11 17:00:00	2026-07-15 17:00:00	419980.00	COMPLETED	2026-07-09 20:55:42.222	2026-07-09 21:02:05.32	4	0.00	2026-07-09 20:55:46.013	2026-07-09 20:55:46.013	\N	2026-07-09 21:02:05.318	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
33	3	\N	\N	\N	PS3	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	2026-07-10 13:30:00	2026-07-12 13:30:00	134990.00	REJECTED	2026-07-09 22:08:32.452	2026-07-09 22:14:00.14	2	0.00	\N	\N	\N	\N	f	30000.00	\N	CITY	f	\N	\N	\N	\N	f	f	\N	\N	\N	\N	\N	\N	\N
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

COPY playstation_rental.promocodes (id, code, "discountPercent", "usageLimit", "usedCount", "expiresAt", "isActive", "createdAt", "discountType", "discountAmount", "loyaltyMinOrders", description, "minOrderAmount", "maxDiscountAmount", "perUserLimit") FROM stdin;
2	DIOR	10	100	1	2026-08-08 21:04:34.081	t	2026-07-09 21:04:34.088	PERCENT	\N	\N	\N	\N	\N	1
\.


--
-- Data for Name: rental_contracts; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.rental_contracts (id, "orderId", "contractNumber", "pdfPath", "telegramFileId", payload, "createdAt") FROM stdin;
1	34	NX-20260710-00034	/home/dior/Desktop/playstation-rental-bot/uploads/contracts/contract-34-1783635029861.pdf	\N	{"hdmi": {"serialNumber": "HDMI-SN-0002", "inventoryNumber": "NX-HDMI-002"}, "power": {"serialNumber": "PWR-SN-0001", "inventoryNumber": "NX-PWR-001"}, "rental": {"end": "12.07.2026 21:30", "start": "11.07.2026 21:30", "discount": 0, "basePrice": 79990, "paymentMethod": "CASH", "collateralType": "ID_CARD", "finalPaidAmount": 109990}, "console": {"consoleType": "PS3", "serialNumber": "Jdkamanekd", "inventoryNumber": "NX-PS3-00498929284"}, "courier": "Dior", "orderId": 34, "customer": {"phone": "998507735652", "address": "Lokatsiya: 39.84911, 66.26211", "fullName": "Ogaw"}, "joysticks": [{"serialNumber": "JS-SN-0001", "inventoryNumber": "NX-JS-001"}, {"serialNumber": "JS-SN-0002", "inventoryNumber": "NX-JS-002"}, {"serialNumber": "JS-SN-0003", "inventoryNumber": "NX-JS-003"}, {"serialNumber": "JS-SN-0004", "inventoryNumber": "NX-JS-004"}], "deliveredAt": "10.07.2026 03:10", "contractNumber": "NX-20260710-00034"}	2026-07-09 22:10:29.906
\.


--
-- Data for Name: rental_extensions; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.rental_extensions (id, "orderId", "extraHours", "extraPrice", status, "requestedAt", "resolvedAt", "resolvedByAdminId", "previousEnd", "newEnd") FROM stdin;
1	27	24	119990.00	APPROVED	2026-07-09 20:59:27.181	2026-07-09 20:59:33.736	1	2026-07-14 17:00:00	2026-07-15 17:00:00
\.


--
-- Data for Name: rental_prices; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.rental_prices (id, "consoleCatalogId", hours, price, currency, "isActive", "createdAt", "updatedAt") FROM stdin;
9	3	24	120000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.454
8	3	48	220000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.458
7	3	72	300000.00	UZS	t	2026-07-06 02:40:15.35	2026-07-05 22:53:10.462
3	1	24	79990.00	UZS	t	2026-07-06 02:40:15.35	2026-07-09 20:32:08.667
2	1	48	134990.00	UZS	t	2026-07-06 02:40:15.35	2026-07-09 20:32:42.808
1	1	72	199990.00	UZS	t	2026-07-06 02:40:15.35	2026-07-09 20:33:19.014
6	2	24	119990.00	UZS	t	2026-07-06 02:40:15.35	2026-07-09 20:33:40.214
5	2	48	199990.00	UZS	t	2026-07-06 02:40:15.35	2026-07-09 20:34:23.637
4	2	72	299990.00	UZS	t	2026-07-06 02:40:15.35	2026-07-09 20:35:11.406
10	1	168	209000.00	UZS	f	2026-07-06 03:53:10.233	2026-07-09 19:37:03.809
11	2	168	418000.00	UZS	f	2026-07-06 03:53:10.233	2026-07-09 19:37:07.194
12	3	168	660000.00	UZS	f	2026-07-06 03:53:10.233	2026-07-09 19:37:09.504
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
MAINTENANCE_MODE	false	2026-07-06 05:40:01.787
DELIVERY_FEE	30000	2026-07-06 06:00:53.08
REALTIME_DASHBOARD_DEFAULT	true	2026-07-10 01:48:24.868
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: playstation_rental; Owner: dior
--

COPY playstation_rental.users (id, "telegramId", "fullName", phone, "defaultAddress", latitude, longitude, "isBlocked", "createdAt", username, "lastActivityAt", "customerRating", "adminNotes", language) FROM stdin;
3	8127652025	Dior	998339143260	Lokatsiya: 39.90204, 66.26430	39.902043	66.264305	f	2026-07-05 21:53:32.492	\N	2026-07-09 22:08:32.512	NORMAL	\N	UZ
10	8521388037	Ogaw	998507735652	Lokatsiya: 39.84911, 66.26211	39.849115	66.262114	f	2026-07-09 22:03:20.325	s888sww	2026-07-09 22:08:59.407	NORMAL	\N	UZ
5	5628946171	.	\N	\N	\N	\N	f	2026-07-06 05:39:14.972	\N	2026-07-06 08:53:46.467	NORMAL	Maryam	\N
7	7573130262	ℝ🖇❤️	998955775333	Lokatsiya: 39.90185, 66.28137	39.901846	66.281372	f	2026-07-06 07:15:00.323	\N	2026-07-06 08:54:20.803	NORMAL	\N	\N
4	8522902434	Дилшода	998505407848	Салом	\N	\N	f	2026-07-05 21:54:52.76	\N	\N	TRUSTED	Yaxwii	\N
8	6326161995	🛡️SARDORBEK🛡️	998937582209	Lokatsiya: 39.90173, 66.25656	39.901734	66.256563	f	2026-07-07 14:54:58.541	Bek_ali	2026-07-07 14:54:58.54	NORMAL	\N	\N
2	8866189157	Dior	998500247999	Lokatsiya: 39.90202, 66.26422	39.902016	66.264225	f	2026-07-05 21:26:59.174	DiyorbekAzizbekovich	2026-07-09 19:46:54.843	NORMAL	\N	\N
6	7747310123	Mushtariy	998935071953	\N	\N	\N	f	2026-07-06 06:44:20.984	Abdurakhmanova_Mushtariy	2026-07-09 19:47:56.451	NORMAL	\N	\N
1	8536325501	.	998938492905	Lokatsiya: 39.90205, 66.26427	39.902055	66.264266	f	2026-07-05 21:14:16.202	dior_akb	2026-07-09 19:57:49.556	NORMAL	\N	\N
9	6606058686	X	998946263936	Lokatsiya: 39.90197, 66.26444	39.901967	66.264444	f	2026-07-09 18:39:27.72	ass_beko	2026-07-09 20:36:35.115	NORMAL	\N	\N
\.


--
-- Name: ad_campaigns_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.ad_campaigns_id_seq', 9, true);


--
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.admin_audit_logs_id_seq', 51, true);


--
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.admins_id_seq', 2, true);


--
-- Name: console_catalog_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.console_catalog_id_seq', 9, true);


--
-- Name: couriers_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.couriers_id_seq', 2, true);


--
-- Name: database_backups_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.database_backups_id_seq', 1, true);


--
-- Name: delivery_zones_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.delivery_zones_id_seq', 1, true);


--
-- Name: inventory_item_history_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.inventory_item_history_id_seq', 18, true);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.inventory_items_id_seq', 17, true);


--
-- Name: inventory_unit_history_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.inventory_unit_history_id_seq', 11, true);


--
-- Name: inventory_units_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.inventory_units_id_seq', 23, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.notifications_id_seq', 659, true);


--
-- Name: order_inventory_items_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.order_inventory_items_id_seq', 7, true);


--
-- Name: order_payments_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.order_payments_id_seq', 23, true);


--
-- Name: order_photos_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.order_photos_id_seq', 2, true);


--
-- Name: order_status_logs_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.order_status_logs_id_seq', 153, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.orders_id_seq', 34, true);


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

SELECT pg_catalog.setval('playstation_rental.promocodes_id_seq', 2, true);


--
-- Name: rental_contracts_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.rental_contracts_id_seq', 1, true);


--
-- Name: rental_extensions_id_seq; Type: SEQUENCE SET; Schema: playstation_rental; Owner: dior
--

SELECT pg_catalog.setval('playstation_rental.rental_extensions_id_seq', 1, true);


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

SELECT pg_catalog.setval('playstation_rental.users_id_seq', 10, true);


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
-- Name: inventory_item_history inventory_item_history_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_item_history
    ADD CONSTRAINT inventory_item_history_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_inventoryNumber_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_items
    ADD CONSTRAINT "inventory_items_inventoryNumber_key" UNIQUE ("inventoryNumber");


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_serialNumber_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_items
    ADD CONSTRAINT "inventory_items_serialNumber_key" UNIQUE ("serialNumber");


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
-- Name: order_inventory_items order_inventory_items_orderId_inventoryItemId_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_inventory_items
    ADD CONSTRAINT "order_inventory_items_orderId_inventoryItemId_key" UNIQUE ("orderId", "inventoryItemId");


--
-- Name: order_inventory_items order_inventory_items_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_inventory_items
    ADD CONSTRAINT order_inventory_items_pkey PRIMARY KEY (id);


--
-- Name: order_payments order_payments_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_payments
    ADD CONSTRAINT order_payments_pkey PRIMARY KEY (id);


--
-- Name: order_photos order_photos_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_photos
    ADD CONSTRAINT order_photos_pkey PRIMARY KEY (id);


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
-- Name: rental_contracts rental_contracts_contractNumber_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_contracts
    ADD CONSTRAINT "rental_contracts_contractNumber_key" UNIQUE ("contractNumber");


--
-- Name: rental_contracts rental_contracts_orderId_key; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_contracts
    ADD CONSTRAINT "rental_contracts_orderId_key" UNIQUE ("orderId");


--
-- Name: rental_contracts rental_contracts_pkey; Type: CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_contracts
    ADD CONSTRAINT rental_contracts_pkey PRIMARY KEY (id);


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
-- Name: inventory_item_history_item_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_item_history_item_idx ON playstation_rental.inventory_item_history USING btree ("inventoryItemId");


--
-- Name: inventory_items_consoletype_status_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_items_consoletype_status_idx ON playstation_rental.inventory_items USING btree ("consoleType", status);


--
-- Name: inventory_items_itemtype_status_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_items_itemtype_status_idx ON playstation_rental.inventory_items USING btree ("itemType", status);


--
-- Name: inventory_unit_history_unit_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_unit_history_unit_idx ON playstation_rental.inventory_unit_history USING btree ("inventoryUnitId", "createdAt");


--
-- Name: inventory_units_consoletype_status_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX inventory_units_consoletype_status_idx ON playstation_rental.inventory_units USING btree ("consoleType", status);


--
-- Name: order_inventory_items_order_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX order_inventory_items_order_idx ON playstation_rental.order_inventory_items USING btree ("orderId");


--
-- Name: order_payments_orderid_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX order_payments_orderid_idx ON playstation_rental.order_payments USING btree ("orderId");


--
-- Name: order_payments_status_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX order_payments_status_idx ON playstation_rental.order_payments USING btree (status);


--
-- Name: order_photos_order_type_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX order_photos_order_type_idx ON playstation_rental.order_photos USING btree ("orderId", "photoType");


--
-- Name: orders_paymentreceived_idx; Type: INDEX; Schema: playstation_rental; Owner: dior
--

CREATE INDEX orders_paymentreceived_idx ON playstation_rental.orders USING btree ("paymentReceived");


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
-- Name: inventory_item_history inventory_item_history_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.inventory_item_history
    ADD CONSTRAINT "inventory_item_history_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES playstation_rental.inventory_items(id) ON DELETE CASCADE;


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
-- Name: order_inventory_items order_inventory_items_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_inventory_items
    ADD CONSTRAINT "order_inventory_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES playstation_rental.inventory_items(id);


--
-- Name: order_inventory_items order_inventory_items_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_inventory_items
    ADD CONSTRAINT "order_inventory_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON DELETE CASCADE;


--
-- Name: order_payments order_payments_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_payments
    ADD CONSTRAINT "order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON DELETE CASCADE;


--
-- Name: order_photos order_photos_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_photos
    ADD CONSTRAINT "order_photos_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_logs order_status_logs_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.order_status_logs
    ADD CONSTRAINT "order_status_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_consoleitemid_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT orders_consoleitemid_fkey FOREIGN KEY ("consoleItemId") REFERENCES playstation_rental.inventory_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_courierId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT "orders_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES playstation_rental.couriers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_deliveredbycourierid_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT orders_deliveredbycourierid_fkey FOREIGN KEY ("deliveredByCourierId") REFERENCES playstation_rental.couriers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_hdmiitemid_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT orders_hdmiitemid_fkey FOREIGN KEY ("hdmiItemId") REFERENCES playstation_rental.inventory_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: orders orders_poweritemid_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.orders
    ADD CONSTRAINT orders_poweritemid_fkey FOREIGN KEY ("powerItemId") REFERENCES playstation_rental.inventory_items(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: rental_contracts rental_contracts_orderId_fkey; Type: FK CONSTRAINT; Schema: playstation_rental; Owner: dior
--

ALTER TABLE ONLY playstation_rental.rental_contracts
    ADD CONSTRAINT "rental_contracts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES playstation_rental.orders(id) ON DELETE CASCADE;


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

