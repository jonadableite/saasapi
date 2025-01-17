--
-- PostgreSQL database dump
--

-- Dumped from database version 16.6 (Debian 16.6-1.pgdg120+1)
-- Dumped by pg_dump version 16.3

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

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Instance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Instance" (
    id text NOT NULL,
    "instanceName" text NOT NULL,
    "connectionStatus" text DEFAULT 'pending'::text NOT NULL,
    number text,
    "ownerJid" text,
    "profilePicUrl" text,
    integration text DEFAULT 'WHATSAPP-BAILEYS'::text NOT NULL,
    token text,
    "clientName" text,
    "profileName" text,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "disconnectedAt" timestamp(3) without time zone,
    "disconnectionObject" jsonb,
    "disconnectionReasonCode" text,
    "proxyConfig" jsonb,
    typebot jsonb
);


ALTER TABLE public."Instance" OWNER TO postgres;

--
-- Name: MediaStats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MediaStats" (
    id text NOT NULL,
    "instanceName" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    text integer DEFAULT 0 NOT NULL,
    image integer DEFAULT 0 NOT NULL,
    video integer DEFAULT 0 NOT NULL,
    audio integer DEFAULT 0 NOT NULL,
    sticker integer DEFAULT 0 NOT NULL,
    reaction integer DEFAULT 0 NOT NULL,
    "isReceived" boolean DEFAULT false NOT NULL,
    "totalDaily" integer DEFAULT 0 NOT NULL,
    "totalAllTime" integer DEFAULT 0 NOT NULL,
    "totalSent" integer DEFAULT 0 NOT NULL,
    "totalReceived" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MediaStats" OWNER TO postgres;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "stripePaymentId" text NOT NULL,
    amount integer NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    "customerId" text,
    metadata jsonb,
    "disputeStatus" text,
    "disputeReason" text,
    "cancelReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text
);


ALTER TABLE public."Payment" OWNER TO postgres;

--
-- Name: WarmupStats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."WarmupStats" (
    id text NOT NULL,
    "instanceName" text NOT NULL,
    status text DEFAULT 'paused'::text NOT NULL,
    "messagesSent" integer DEFAULT 0 NOT NULL,
    "messagesReceived" integer DEFAULT 0 NOT NULL,
    "warmupTime" integer DEFAULT 0 NOT NULL,
    "lastActive" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "startTime" timestamp(3) without time zone,
    "pauseTime" timestamp(3) without time zone,
    progress integer DEFAULT 0 NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "mediaStatsId" text,
    "mediaReceivedId" text
);


ALTER TABLE public."WarmupStats" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: bot_descritivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bot_descritivo (
    id text NOT NULL,
    name text NOT NULL,
    descritivo text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.bot_descritivo OWNER TO postgres;

--
-- Name: whatlead_companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatlead_companies (
    id text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.whatlead_companies OWNER TO postgres;

--
-- Name: whatlead_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatlead_users (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password text NOT NULL,
    profile text NOT NULL,
    phone text NOT NULL,
    "stripeCustomerId" text,
    "stripeSubscriptionId" text,
    "stripeSubscriptionStatus" text,
    active boolean DEFAULT true,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "whatleadCompanyId" text NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    status boolean DEFAULT true NOT NULL,
    "maxInstances" integer DEFAULT 2 NOT NULL,
    "messagesPerDay" integer DEFAULT 20 NOT NULL,
    features text[] DEFAULT ARRAY[]::text[],
    support text DEFAULT 'basic'::text NOT NULL,
    "trialEndDate" timestamp(3) without time zone
);


ALTER TABLE public.whatlead_users OWNER TO postgres;

--
-- Name: whatleadleads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatleadleads (
    id text NOT NULL,
    externalid text,
    sourceid text,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    lastmessagesent timestamp(3) without time zone,
    stepsecondcalltemplate integer,
    stepnointeraction integer,
    nointeractionquantity integer,
    accepttemplate boolean,
    acceptsecondtemplate boolean,
    status text,
    dialog jsonb[],
    configid text NOT NULL,
    whitelabelconfig text NOT NULL,
    lastintent text,
    broker text,
    origin text,
    send boolean,
    "sendAt" timestamp(3) without time zone,
    "isBusinessAutoResponder" boolean DEFAULT false,
    startmessage timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    schedulingdata text,
    productchoosebyclient text,
    productid integer,
    createdat timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP,
    updatedat timestamp(3) without time zone,
    curation jsonb
);


ALTER TABLE public.whatleadleads OWNER TO postgres;

--
-- Name: whatleadparceiroconfigs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatleadparceiroconfigs (
    id text NOT NULL,
    "createdAt" date,
    name text,
    productdefault text,
    campaignstatus text,
    enablecuration boolean,
    enabletosendustolead boolean,
    enabled boolean,
    isconversationia boolean,
    campaignnumberbusiness text,
    whatsappprovider text,
    enabletosendprovider boolean,
    enabletosecondcallprovider boolean,
    integrationconfiguration jsonb,
    integrationname text,
    templatelistvars jsonb[],
    metaconfiguration jsonb,
    messageperruns jsonb[],
    notifyconfiguration jsonb,
    "updatedAt" date,
    whitelabel_config text NOT NULL,
    "whatleadCompanyId" text
);


ALTER TABLE public.whatleadparceiroconfigs OWNER TO postgres;

--
-- Data for Name: Instance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Instance" (id, "instanceName", "connectionStatus", number, "ownerJid", "profilePicUrl", integration, token, "clientName", "profileName", "userId", "createdAt", "updatedAt", "disconnectedAt", "disconnectionObject", "disconnectionReasonCode", "proxyConfig", typebot) FROM stdin;
e8652577-98f2-4b66-8649-98ce50788692	Especialista 2	open	\N	556798458559@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/421275887_1101538084791761_2392507726518701581_n.jpg?ccb=11-4&oh=01_Q5AaIAdK142WmLLzzAVeJCb3Wb6Hz8sPtifxTzP0z7GAfE9Q&oe=67903DE3&_nc_sid=5e03e0&_nc_cat=106	WHATSAPP-BAILEYS	5BB1781D-89B5-411A-8CD4-82F0453411A0	evolutionv2_exchange	Anderson Especialista Gota	2c448774-e96d-412a-b953-c6be05207bad	2025-01-12 03:09:17.156	2025-01-12 03:11:17.768	\N	\N	\N	\N	\N
76dd90b4-1a56-4471-bbec-182d84864f4f	Especialista 	connecting	\N	\N	\N	WHATSAPP-BAILEYS	2D1C54D8-F77D-4017-8E20-A40AF4C4619F	evolutionv2_exchange	\N	2c448774-e96d-412a-b953-c6be05207bad	2025-01-12 02:42:20.167	2025-01-12 03:11:17.773	\N	\N	\N	\N	\N
adb95201-4187-4cf4-bcc1-148a3c4022e4	215	connecting	\N	\N	\N	WHATSAPP-BAILEYS	140A6E3B-CF5A-43AA-AD84-298B6CBC7B7C	evolutionv2_exchange	\N	bca32529-ab9e-4358-914c-4dbd903ff8a3	2025-01-12 00:41:40.334	2025-01-12 00:43:32.67	\N	\N	\N	\N	\N
837103ab-7a62-4984-8cfc-e6e66a827bfa	Lícia	connecting	\N	\N	\N	WHATSAPP-BAILEYS	566AF442-BC97-4674-AAF6-5461695B9972	evolutionv2_exchange	\N	bca32529-ab9e-4358-914c-4dbd903ff8a3	2025-01-12 00:42:00.344	2025-01-12 00:43:32.681	\N	\N	\N	\N	\N
1b9e983d-59d5-417e-808f-def4b05da4f6	WhatLead	open	\N	5512988444921@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/472831971_600182202662593_4052389712798509149_n.jpg?ccb=11-4&oh=01_Q5AaIEPAw-9lZFvjB4hgefOvcRJNw6r1hNd1JGAx5WWpHH2M&oe=67904B80&_nc_sid=5e03e0&_nc_cat=110	WHATSAPP-BAILEYS	F54FC7FB-C0DE-4A5C-8817-4857DE59D803	evolutionv2_exchange	WhatLeads	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-12 02:08:23.713	2025-01-12 02:08:30.817	\N	\N	\N	\N	\N
\.


--
-- Data for Name: MediaStats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MediaStats" (id, "instanceName", date, text, image, video, audio, sticker, reaction, "isReceived", "totalDaily", "totalAllTime", "totalSent", "totalReceived", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Payment" (id, "stripePaymentId", amount, currency, status, "customerId", metadata, "disputeStatus", "disputeReason", "cancelReason", "createdAt", "updatedAt", "userId") FROM stdin;
\.


--
-- Data for Name: WarmupStats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."WarmupStats" (id, "instanceName", status, "messagesSent", "messagesReceived", "warmupTime", "lastActive", "startTime", "pauseTime", progress, "userId", "createdAt", "updatedAt", "mediaStatsId", "mediaReceivedId") FROM stdin;
11b4aec9-51f1-4a61-a9f5-c58959e74ee7	215	paused	0	0	0	2025-01-12 00:41:40.34	\N	\N	0	bca32529-ab9e-4358-914c-4dbd903ff8a3	2025-01-12 00:41:40.34	2025-01-12 00:41:40.34	\N	\N
4bb9f76b-13fa-45e7-90a7-0d74113a4e02	Lícia	paused	0	0	0	2025-01-12 00:42:00.35	\N	\N	0	bca32529-ab9e-4358-914c-4dbd903ff8a3	2025-01-12 00:42:00.35	2025-01-12 00:42:00.35	\N	\N
1586f64b-92ed-4dd3-9a07-0a803f8f9f7e	WhatLead	paused	0	0	0	2025-01-12 02:08:23.719	\N	\N	0	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-12 02:08:23.719	2025-01-12 02:08:23.719	\N	\N
90eb6342-3edd-4580-8134-debd9ea914ca	Especialista 	paused	0	0	0	2025-01-12 02:42:20.179	\N	\N	0	2c448774-e96d-412a-b953-c6be05207bad	2025-01-12 02:42:20.179	2025-01-12 02:42:20.179	\N	\N
a4061757-e86e-462f-bcf0-49b7123c4dcd	Especialista 2	paused	0	0	0	2025-01-12 03:09:17.162	\N	\N	0	2c448774-e96d-412a-b953-c6be05207bad	2025-01-12 03:09:17.162	2025-01-12 03:09:17.162	\N	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
2363f4a9-13d1-4b62-aaf0-2e0dc983ae1a	b818b0731297096aeab8c7fc8569c2dfd1954b1b3d31c5c5a4016c911cfc7d16	2025-01-11 23:57:55.968922+00	20250111235754_add_company_instance_relatio	\N	\N	2025-01-11 23:57:55.125402+00	1
\.


--
-- Data for Name: bot_descritivo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bot_descritivo (id, name, descritivo, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: whatlead_companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_companies (id, name, active, "createdAt", "updatedAt") FROM stdin;
82a3b374-fbc1-4ad1-9915-4632f6a439b0	Whatlead	t	2025-01-11 23:59:09.29	2025-01-11 23:59:31.094
39bb1169-00b9-4cca-ba26-1af36b84d6d7	LUTHAY NEGOCIOS DIGITAIS	t	2025-01-12 00:04:21.68	2025-01-12 00:04:42.616
e3968311-9889-4242-af58-62037dd2b171	LUTHAY NEGOCIOS DIGITAIS LTDA	t	2025-01-12 00:39:06.797	2025-01-12 00:40:01.653
35f352f2-24ea-4cfc-bb2b-46c15c9924ff	Temporary Company	t	2025-01-12 00:56:12.509	2025-01-12 00:56:12.509
9a74eb9c-acf4-4fee-981e-aff80de603d1	Especialista GotaVita	t	2025-01-12 00:58:52.503	2025-01-12 00:59:46.079
97af23e1-6a75-46e6-af60-ce4b0e7664d8	PatJenBer	t	2025-01-12 00:59:21.897	2025-01-12 01:00:44.62
b1abc241-a4fe-4a78-9e7b-b9ca8a5325f9	Alisson	t	2025-01-12 01:02:30.216	2025-01-12 01:09:01.341
8d98201e-f4ca-499c-894b-046c46e9d19e	Rosali Barboza	t	2025-01-12 01:22:50.186	2025-01-12 01:35:43.08
f3418cec-61c2-482e-8f85-ed0fd59e286c	Temporary Company	t	2025-01-12 01:37:44.859	2025-01-12 01:37:44.859
b87da37b-09fe-49cc-ac87-43146996e044	Ruth.com	t	2025-01-12 01:51:18.006	2025-01-12 01:53:04.036
240f5131-21e0-4feb-9551-5e502da6c8dc	Tefysamuel	t	2025-01-12 01:55:29.829	2025-01-12 01:56:43.643
5d444b18-7610-49c8-9d9e-78b3dbbb89fa	Fabi	t	2025-01-12 01:57:35.959	2025-01-12 02:03:16.686
0f613bd3-5525-41e8-aefd-a570c44b31ac	Emilly Moraes	t	2025-01-12 01:58:19	2025-01-12 02:16:19.388
12b89c3d-11de-4c3d-a000-539ab408edd1	Especialista	t	2025-01-12 01:47:49.891	2025-01-12 02:41:13.244
\.


--
-- Data for Name: whatlead_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_users (id, email, name, password, profile, phone, "stripeCustomerId", "stripeSubscriptionId", "stripeSubscriptionStatus", active, "createdAt", "updatedAt", "whatleadCompanyId", plan, status, "maxInstances", "messagesPerDay", features, support, "trialEndDate") FROM stdin;
778a30fa-64a5-4bec-a704-0ea888b74a38	jonadab.leite@gmail.com	Jonadab Leite	$2b$10$kudF7sYjkTcGXJP2fGvqC.R8mrE/ZCbccCMx4ppL72GyiUbgN9hpO	user		\N	\N	\N	t	2025-01-11 23:59:09.295	2025-01-11 23:59:09.295	82a3b374-fbc1-4ad1-9915-4632f6a439b0	free	t	2	20	{}	basic	2025-01-18 23:59:09.28
bca32529-ab9e-4358-914c-4dbd903ff8a3	lucaslopes0108@gmail.com	Lucas Lopes da Silva Santos	$2b$10$2a1FpK1d7954h9gMtEo0/.EkpSqepzoWXhv8qAHkPlkgJ5Ml12tJO	user		\N	\N	\N	t	2025-01-12 00:39:06.803	2025-01-12 00:39:06.803	e3968311-9889-4242-af58-62037dd2b171	free	t	2	20	{}	basic	2025-01-19 00:39:06.779
2c6d2ed0-c935-49ea-a7a0-b1d42cc3805d	kv819302@gmail.com	Keila dos Santos Vieira vogt 	$2b$10$KIupEze4YzRsFrNd3wOXxusAIjlG17IH5/2lZEV8POoeqWHcAJTZW	user		\N	\N	\N	t	2025-01-12 00:58:52.506	2025-01-12 00:58:52.506	9a74eb9c-acf4-4fee-981e-aff80de603d1	free	t	2	20	{}	basic	2025-01-19 00:58:52.501
ac74f654-5f01-4f45-b2fc-92d9effc6558	patypatriciaoliveirasilva13@gmail.com	Patrícia de Oliveira Silva 	$2b$10$PpX1SxD1nZFhmSMLJJCtjeUbakEde0VQd0jRmhgQcWj5tNfPibNDy	user		\N	\N	\N	t	2025-01-12 00:59:21.9	2025-01-12 00:59:21.9	97af23e1-6a75-46e6-af60-ce4b0e7664d8	free	t	2	20	{}	basic	2025-01-19 00:59:21.895
48ba95e0-19e5-4efb-9225-7fb7a43f9a17	alissonfernando91@hotmail.com	Alisson Fernando da Silva Lima	$2b$10$a/RXXZ2O596nDVcpKEXkcOzXIa53udLG9Q0tjAgRiYcmEvEcdjknu	user		\N	\N	\N	t	2025-01-12 01:02:30.223	2025-01-12 01:02:30.223	b1abc241-a4fe-4a78-9e7b-b9ca8a5325f9	free	t	2	20	{}	basic	2025-01-19 01:02:30.197
bb62201a-e946-495f-ae2d-3146a9151447	rosymarques300@gmail.com	Rosiane Moura Marques 	$2b$10$jEBo5XJkDX2MJNJLpC96qOGmFUuA1m0cTmRwfcJgr1fIFUHUaSp4G	user		\N	\N	\N	t	2025-01-12 01:37:44.882	2025-01-12 01:37:44.882	f3418cec-61c2-482e-8f85-ed0fd59e286c	free	t	2	20	{}	basic	2025-01-19 01:37:44.854
2c448774-e96d-412a-b953-c6be05207bad	Anderson-params@outlook.com	Anderson Silva Siqueira 	$2b$10$1tunLw0rcyoWOwGyyu3Mmu/T1u6AVv3uRz6hjkWlrgJGSkVdRmgJ6	user		\N	\N	\N	t	2025-01-12 01:47:49.905	2025-01-12 01:47:49.905	12b89c3d-11de-4c3d-a000-539ab408edd1	free	t	2	20	{}	basic	2025-01-19 01:47:49.889
a85cb316-b409-4444-b8ff-ba86bfa11bed	www.silvaruth@gmail.com	Ruth Lopes silva	$2b$10$qD0MW1RBBWZYbvARoupNEut8BMu2aOS66LJnxsfazUzUElDPt9Y7a	user		\N	\N	\N	t	2025-01-12 01:51:18.022	2025-01-12 01:51:18.022	b87da37b-09fe-49cc-ac87-43146996e044	free	t	2	20	{}	basic	2025-01-19 01:51:18.001
f7ada163-84be-4067-b31f-2e7c32f65e36	lovanebispo141@gmail.com	LovaniBispo	$2b$10$MkBcpNl/W7T8jAbRucItCeGYic/IutIngr4Wsjp.07gm64ZnL.jfm	user		\N	\N	\N	t	2025-01-12 01:55:29.833	2025-01-12 01:55:29.833	240f5131-21e0-4feb-9551-5e502da6c8dc	free	t	2	20	{}	basic	2025-01-19 01:55:29.827
2382cd4d-ec0c-4670-b9a5-c2b8d21de346	fabigomes8570@gmail.com	Fabiane Gomes 	$2b$10$aBzzphiVZ7pRAUW/SV.D/e3d8GIkFjtJkmqTEcnc3tCLviegoFyk2	user		\N	\N	\N	t	2025-01-12 01:57:35.961	2025-01-12 01:57:35.961	5d444b18-7610-49c8-9d9e-78b3dbbb89fa	free	t	2	20	{}	basic	2025-01-19 01:57:35.957
9ba14aba-0899-43c5-814f-39911700e0f3	emillymoraes187@gmail.com	Emilly Caroline Borges De Moraes 	$2b$10$Ynqo3PX/1IS3WOcPTxUN0usIimEaEFSzOgQfoGv4iywNl2hjtEMK.	user		\N	\N	\N	t	2025-01-12 01:58:19.002	2025-01-12 01:58:19.002	0f613bd3-5525-41e8-aefd-a570c44b31ac	free	t	2	20	{}	basic	2025-01-19 01:58:18.997
\.


--
-- Data for Name: whatleadleads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatleadleads (id, externalid, sourceid, name, phone, email, lastmessagesent, stepsecondcalltemplate, stepnointeraction, nointeractionquantity, accepttemplate, acceptsecondtemplate, status, dialog, configid, whitelabelconfig, lastintent, broker, origin, send, "sendAt", "isBusinessAutoResponder", startmessage, schedulingdata, productchoosebyclient, productid, createdat, updatedat, curation) FROM stdin;
\.


--
-- Data for Name: whatleadparceiroconfigs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatleadparceiroconfigs (id, "createdAt", name, productdefault, campaignstatus, enablecuration, enabletosendustolead, enabled, isconversationia, campaignnumberbusiness, whatsappprovider, enabletosendprovider, enabletosecondcallprovider, integrationconfiguration, integrationname, templatelistvars, metaconfiguration, messageperruns, notifyconfiguration, "updatedAt", whitelabel_config, "whatleadCompanyId") FROM stdin;
\.


--
-- Name: Instance Instance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Instance"
    ADD CONSTRAINT "Instance_pkey" PRIMARY KEY (id);


--
-- Name: MediaStats MediaStats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MediaStats"
    ADD CONSTRAINT "MediaStats_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: WarmupStats WarmupStats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WarmupStats"
    ADD CONSTRAINT "WarmupStats_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: bot_descritivo bot_descritivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_descritivo
    ADD CONSTRAINT bot_descritivo_pkey PRIMARY KEY (id);


--
-- Name: whatlead_companies whatlead_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_companies
    ADD CONSTRAINT whatlead_companies_pkey PRIMARY KEY (id);


--
-- Name: whatlead_users whatlead_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_users
    ADD CONSTRAINT whatlead_users_pkey PRIMARY KEY (id);


--
-- Name: whatleadleads whatleadleads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatleadleads
    ADD CONSTRAINT whatleadleads_pkey PRIMARY KEY (id);


--
-- Name: whatleadparceiroconfigs whatleadparceiroconfigs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatleadparceiroconfigs
    ADD CONSTRAINT whatleadparceiroconfigs_pkey PRIMARY KEY (id);


--
-- Name: Instance_instanceName_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Instance_instanceName_key" ON public."Instance" USING btree ("instanceName");


--
-- Name: Instance_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Instance_userId_idx" ON public."Instance" USING btree ("userId");


--
-- Name: MediaStats_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MediaStats_date_idx" ON public."MediaStats" USING btree (date);


--
-- Name: MediaStats_instanceName_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MediaStats_instanceName_idx" ON public."MediaStats" USING btree ("instanceName");


--
-- Name: Payment_customerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_customerId_idx" ON public."Payment" USING btree ("customerId");


--
-- Name: Payment_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);


--
-- Name: Payment_stripePaymentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON public."Payment" USING btree ("stripePaymentId");


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Payment_userId_idx" ON public."Payment" USING btree ("userId");


--
-- Name: WarmupStats_instanceName_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WarmupStats_instanceName_idx" ON public."WarmupStats" USING btree ("instanceName");


--
-- Name: WarmupStats_instanceName_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WarmupStats_instanceName_key" ON public."WarmupStats" USING btree ("instanceName");


--
-- Name: WarmupStats_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WarmupStats_userId_idx" ON public."WarmupStats" USING btree ("userId");


--
-- Name: bot_descritivo_name_descritivo_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "bot_descritivo_name_descritivo_createdAt_idx" ON public.bot_descritivo USING btree (name, descritivo, "createdAt" DESC);


--
-- Name: whatlead_companies_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "whatlead_companies_createdAt_idx" ON public.whatlead_companies USING btree ("createdAt" DESC);


--
-- Name: whatlead_users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX whatlead_users_email_key ON public.whatlead_users USING btree (email);


--
-- Name: whatlead_users_email_profile_phone_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "whatlead_users_email_profile_phone_createdAt_idx" ON public.whatlead_users USING btree (email, profile, phone, "createdAt" DESC);


--
-- Name: whatleadleads_phone_configid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX whatleadleads_phone_configid_idx ON public.whatleadleads USING btree (phone, configid);


--
-- Name: whatleadparceiroconfigs_campaignnumberbusiness_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX whatleadparceiroconfigs_campaignnumberbusiness_key ON public.whatleadparceiroconfigs USING btree (campaignnumberbusiness);


--
-- Name: Instance Instance_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Instance"
    ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.whatlead_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MediaStats MediaStats_instanceName_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MediaStats"
    ADD CONSTRAINT "MediaStats_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES public."Instance"("instanceName") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.whatlead_users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WarmupStats WarmupStats_instanceName_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WarmupStats"
    ADD CONSTRAINT "WarmupStats_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES public."Instance"("instanceName") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WarmupStats WarmupStats_mediaReceivedId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WarmupStats"
    ADD CONSTRAINT "WarmupStats_mediaReceivedId_fkey" FOREIGN KEY ("mediaReceivedId") REFERENCES public."MediaStats"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WarmupStats WarmupStats_mediaStatsId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WarmupStats"
    ADD CONSTRAINT "WarmupStats_mediaStatsId_fkey" FOREIGN KEY ("mediaStatsId") REFERENCES public."MediaStats"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WarmupStats WarmupStats_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WarmupStats"
    ADD CONSTRAINT "WarmupStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.whatlead_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatlead_users whatlead_users_whatleadCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_users
    ADD CONSTRAINT "whatlead_users_whatleadCompanyId_fkey" FOREIGN KEY ("whatleadCompanyId") REFERENCES public.whatlead_companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatleadleads whatleadleads_configid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatleadleads
    ADD CONSTRAINT whatleadleads_configid_fkey FOREIGN KEY (configid) REFERENCES public.whatleadparceiroconfigs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatleadparceiroconfigs whatleadparceiroconfigs_whatleadCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatleadparceiroconfigs
    ADD CONSTRAINT "whatleadparceiroconfigs_whatleadCompanyId_fkey" FOREIGN KEY ("whatleadCompanyId") REFERENCES public.whatlead_companies(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

