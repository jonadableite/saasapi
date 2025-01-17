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
-- Name: CampaignDispatch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CampaignDispatch" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "instanceName" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CampaignDispatch" OWNER TO postgres;

--
-- Name: CampaignErrorLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CampaignErrorLog" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "errorMessage" text NOT NULL,
    "errorDetails" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CampaignErrorLog" OWNER TO postgres;

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
-- Name: MessageLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MessageLog" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "leadId" text NOT NULL,
    "messageId" text NOT NULL,
    "messageDate" timestamp(3) without time zone NOT NULL,
    "messageType" text NOT NULL,
    content text NOT NULL,
    status text NOT NULL,
    "statusHistory" jsonb[],
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    "failureReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MessageLog" OWNER TO postgres;

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
-- Name: _CampaignLeadToMessageLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."_CampaignLeadToMessageLog" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


ALTER TABLE public."_CampaignLeadToMessageLog" OWNER TO postgres;

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
-- Name: whatlead_campaign_leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatlead_campaign_leads (
    id text NOT NULL,
    "userId" text NOT NULL,
    "campaignId" text NOT NULL,
    name text,
    phone text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "readAt" timestamp(3) without time zone,
    "failedAt" timestamp(3) without time zone,
    "failureReason" text,
    "messageId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.whatlead_campaign_leads OWNER TO postgres;

--
-- Name: whatlead_campaign_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatlead_campaign_messages (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    "order" integer NOT NULL,
    caption text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.whatlead_campaign_messages OWNER TO postgres;

--
-- Name: whatlead_campaign_statistics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatlead_campaign_statistics (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "totalLeads" integer DEFAULT 0 NOT NULL,
    "sentCount" integer DEFAULT 0 NOT NULL,
    "deliveredCount" integer DEFAULT 0 NOT NULL,
    "readCount" integer DEFAULT 0 NOT NULL,
    "failedCount" integer DEFAULT 0 NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.whatlead_campaign_statistics OWNER TO postgres;

--
-- Name: whatlead_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatlead_campaigns (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    type text NOT NULL,
    message text,
    "mediaUrl" text,
    "mediaType" text,
    "mediaCaption" text,
    "scheduledDate" timestamp(3) without time zone,
    "scheduledStatus" text DEFAULT 'pending'::text,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "pausedAt" timestamp(3) without time zone,
    progress integer DEFAULT 0 NOT NULL,
    "minDelay" integer DEFAULT 5 NOT NULL,
    "maxDelay" integer DEFAULT 30 NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.whatlead_campaigns OWNER TO postgres;

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
-- Data for Name: CampaignDispatch; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CampaignDispatch" (id, "campaignId", "instanceName", status, "startedAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
a4371a99-d507-4c7b-b7b7-316660cc1293	0f77409f-d188-499f-bbb8-83c4f4cf6e55	WhatLead	completed	2025-01-16 01:16:56.872	\N	2025-01-16 01:16:56.873	2025-01-16 01:16:56.873
c8988b4d-00a0-4968-8717-6a38bdc297ee	0f77409f-d188-499f-bbb8-83c4f4cf6e55	WhatLead	completed	2025-01-16 01:06:20.817	\N	2025-01-16 01:06:20.818	2025-01-16 01:06:20.818
29636472-c552-4172-84d2-450213e76427	0f77409f-d188-499f-bbb8-83c4f4cf6e55	WhatLead	running	2025-01-17 02:39:54.587	\N	2025-01-17 02:39:54.588	2025-01-17 02:39:54.588
149b9775-c5e1-4477-8bf4-02e419b5cf78	0f77409f-d188-499f-bbb8-83c4f4cf6e55	WhatLead	running	2025-01-17 03:30:41.088	\N	2025-01-17 03:30:41.089	2025-01-17 03:30:41.089
\.


--
-- Data for Name: CampaignErrorLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CampaignErrorLog" (id, "campaignId", "errorMessage", "errorDetails", "createdAt") FROM stdin;
\.


--
-- Data for Name: Instance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Instance" (id, "instanceName", "connectionStatus", number, "ownerJid", "profilePicUrl", integration, token, "clientName", "profileName", "userId", "createdAt", "updatedAt", "disconnectedAt", "disconnectionObject", "disconnectionReasonCode", "proxyConfig", typebot) FROM stdin;
f80fedc5-327d-4103-ad09-2706b7761a61	Brsport Alice	connecting	\N	\N	\N	WHATSAPP-BAILEYS	ADEC67FC-5B74-4BDF-82B2-8AE6358B78B5	evolutionv2_exchange	\N	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:33:16.383	2025-01-16 19:35:47.535	\N	\N	\N	\N	\N
b680a896-dee9-4f00-aeae-77047279fc00	Brsport Kethelyn	connecting	\N	\N	\N	WHATSAPP-BAILEYS	B271E5AE-5FD3-44A0-83BF-65524CA4ECA7	evolutionv2_exchange	\N	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:35:10.564	2025-01-16 19:35:47.544	\N	\N	\N	\N	\N
89c9d9f0-417d-435c-8870-23946943cfa7	Brsport Externo Michele	open	\N	5517991693971@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/328782722_843920574446418_1846468129134136468_n.jpg?ccb=11-4&oh=01_Q5AaILsgjgihy3f8jpNRpWwEM03cKBqKhoOHhftvBGNg0kXW&oe=67967057&_nc_sid=5e03e0&_nc_cat=109	WHATSAPP-BAILEYS	614D05E7-E277-4673-852B-92282CE5B9AB	evolutionv2_exchange	.	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:35:50.158	2025-01-16 19:35:47.549	\N	\N	\N	\N	\N
b881068f-2062-4c80-91b9-b88417849ec6	Teste	open	\N	5512981217093@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/465953318_963425072242442_6227340909865400527_n.jpg?ccb=11-4&oh=01_Q5AaICbEdj-jcZJEdT-xILu5D1tKgPJWK7DVIyUYBn-hMu35&oe=67968DE5&_nc_sid=5e03e0&_nc_cat=108	WHATSAPP-BAILEYS	32DEEEEB-3B06-46FF-BFB5-64F768FCA67D	evolutionv2_exchange	Urolasermkt	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-15 01:14:25.857	2025-01-17 03:30:28.472	\N	\N	\N	\N	\N
99ce14a3-5761-4af9-ac61-ca495a3a53cf	Neural Vendas	open	\N	5516993335889@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/473397827_1118691989748459_4685434764339167007_n.jpg?ccb=11-4&oh=01_Q5AaIHG0Ub2n-y_RDfvyjxWfbuXuVaeJCm96gtyOgYBsZRG4&oe=67966EF2&_nc_sid=5e03e0&_nc_cat=110	WHATSAPP-BAILEYS	36857AC9-EA25-4024-B8A7-DFD94614DDFC	evolutionv2_exchange	Neural vendas	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:31:29.367	2025-01-16 19:35:47.557	\N	\N	\N	\N	\N
2bf533fb-27ec-4082-bf06-9e2252450f76	Brsport Sophia	connecting	\N	\N	\N	WHATSAPP-BAILEYS	4C612905-BD5E-45FA-B8F8-E90DF3877C35	evolutionv2_exchange	\N	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:35:30.877	2025-01-16 19:35:47.56	\N	\N	\N	\N	\N
9ed2cbfa-0b0a-42eb-92b0-d5e3c0802cfb	WhatLead	open	\N	5512988444921@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/472831971_600182202662593_4052389712798509149_n.jpg?ccb=11-4&oh=01_Q5AaIFpf5NGj8Rf3uPj_DAWpirJ20M-6TBCkls8fWu59wApE&oe=6796AAC0&_nc_sid=5e03e0&_nc_cat=110	WHATSAPP-BAILEYS	193D85AB-C729-446C-B893-74FCD81FDAE1	evolutionv2_exchange	WhatLeads	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-15 01:13:47.303	2025-01-17 03:30:28.754	\N	\N	\N	\N	\N
27d8e9ec-50d5-4103-acc9-750403212081	2151	close	\N	5511966592151@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/420616272_1079260193714565_2996409013528630048_n.jpg?ccb=11-4&oh=01_Q5AaIAKaFXz5OHha2Nmrs2N_QZU9hl2qzvN8-x08trTUokMc&oe=67957C6F&_nc_sid=5e03e0&_nc_cat=100	WHATSAPP-BAILEYS	FACEEDA1-7C3D-4A7E-A28A-BF4C8E0B6A07	evolutionv2_exchange	Lucas Lopes	bca32529-ab9e-4358-914c-4dbd903ff8a3	2025-01-16 03:07:19.751	2025-01-16 21:37:23.952	\N	\N	\N	{"host": "200.234.179.93", "port": 50101, "password": "cgKJcdTYQs", "username": "lucaslopes010899"}	{"url": "https://flowbot.whatlead.com.br/final-2151-q59jp6m", "expire": 1, "enabled": true, "typebot": "Final 2151", "keepOpen": false, "description": "Final 2151", "triggerType": "keyword", "debounceTime": 10, "delayMessage": 1000, "triggerValue": "Olá Lucas! Quero saber mais detalhes, pode me explicar melhor? 03", "keywordFinish": "#SAIR", "stopBotFromMe": false, "unknownMessage": "?", "listeningFromMe": false, "triggerOperator": "contains"}
bc912ccd-1ac5-4913-8384-bf3348599914	Lícia	open	\N	558291293999@s.whatsapp.net	https://pps.whatsapp.net/v/t61.24694-24/472311051_909334248056586_6078000403036963316_n.jpg?ccb=11-4&oh=01_Q5AaIJv3qvd6qvV7TrDCWKJB_UyYqEc5lUMiTo1m5PKdjjQD&oe=6796ACDA&_nc_sid=5e03e0&_nc_cat=103	WHATSAPP-BAILEYS	167050F6-D649-4891-8826-74C97282EC0D	evolutionv2_exchange	Daniella Hoffman	0a038795-c14e-4861-bf83-8e65be8709de	2025-01-16 21:39:51.701	2025-01-16 23:17:30.009	\N	\N	\N	\N	{"url": "https://flowbot.whatlead.com.br/my-typebot-s1sxv5y", "expire": 0, "enabled": true, "typebot": "Lícia", "keepOpen": false, "description": "Lícia fluxo", "triggerType": "all", "debounceTime": 10, "delayMessage": 1000, "triggerValue": "", "keywordFinish": "#SAIR", "stopBotFromMe": false, "unknownMessage": "Message not recognized", "listeningFromMe": false, "triggerOperator": "contains"}
9d94a273-a64f-4e6f-bc09-9b3773fed966	Nana	connecting	\N	\N	\N	WHATSAPP-BAILEYS	32ED11F1-2DF9-469F-8468-12C9B902D987	evolutionv2_exchange	\N	ae077b70-ecb6-419a-80a4-475541e29ca9	2025-01-16 23:17:13.683	2025-01-16 23:35:07.326	\N	\N	\N	\N	{"url": "https://flowbot.whatlead.com.br/nana", "expire": 0, "enabled": true, "typebot": "nana", "keepOpen": false, "description": "fluxo nana", "triggerType": "all", "debounceTime": 10, "delayMessage": 1000, "triggerValue": "", "keywordFinish": "#SAIR", "stopBotFromMe": false, "unknownMessage": "Message not recognized", "listeningFromMe": false, "triggerOperator": "contains"}
\.


--
-- Data for Name: MediaStats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MediaStats" (id, "instanceName", date, text, image, video, audio, sticker, reaction, "isReceived", "totalDaily", "totalAllTime", "totalSent", "totalReceived", "createdAt", "updatedAt") FROM stdin;
51ce643b-98c5-4262-827c-5f2c55e8ad49	Neural Vendas	2025-01-16 00:00:00	512	44	0	0	0	157	f	713	713	713	0	2025-01-16 18:51:23.705	2025-01-16 23:59:34.538
9aa4f00e-a61f-45d0-94fc-05824155eb7a	Teste	2025-01-15 00:00:00	9999	99	9	999	88	99	t	0	0	0	0	2025-01-15 23:44:41.381	2025-01-15 23:44:41.381
58618689-5322-4392-af2b-97bd3342b402	Teste	2025-01-15 00:00:00	999	999	99	999	99	99	f	1	1	1	0	2025-01-15 23:44:41.36	2025-01-15 23:44:52.77
a4bfc684-f21c-4951-83e4-35be9cb6e2f7	WhatLead	2025-01-15 00:00:00	99	99	9	99	99	99	t	0	0	0	0	2025-01-15 23:44:41.381	2025-01-15 23:44:41.381
aabef34b-746d-4782-8bd4-5bcd6aa3bcc8	WhatLead	2025-01-15 00:00:00	29	9	999	0	999	999	f	3	3	3	0	2025-01-15 23:44:41.36	2025-01-15 23:45:28.542
276450ec-4f76-4bd6-afe3-cd72f213c268	Brsport Externo Michele	2025-01-17 00:00:00	59	6	0	0	0	2	f	67	67	67	0	2025-01-17 00:04:11.665	2025-01-17 03:51:35.636
34beed67-e58d-4452-9986-33cfe00bb888	Neural Vendas	2025-01-17 00:00:00	412	50	0	0	0	116	f	578	578	578	0	2025-01-17 00:00:07.193	2025-01-17 03:51:37.66
bc110d93-164f-4e82-a525-712e7de07dd2	Brsport Externo Michele	2025-01-16 00:00:00	61	6	0	0	0	3	t	70	70	70	0	2025-01-16 18:51:23.72	2025-01-16 23:53:56.704
ea6c5c44-15ec-49b0-9bd4-501cf18ee079	Brsport Externo Michele	2025-01-16 00:00:00	25	0	0	0	0	2	f	27	27	27	0	2025-01-16 18:51:23.706	2025-01-16 20:29:34.098
e60bdbbc-3c06-4238-9f13-cfda78faa455	Neural Vendas	2025-01-16 00:00:00	46	7	0	0	0	16	t	69	69	69	0	2025-01-16 18:51:23.719	2025-01-16 19:34:00.895
\.


--
-- Data for Name: MessageLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MessageLog" (id, "campaignId", "leadId", "messageId", "messageDate", "messageType", content, status, "statusHistory", "sentAt", "deliveredAt", "readAt", "failedAt", "failureReason", "createdAt", "updatedAt") FROM stdin;
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
3128725f-aa81-483d-9ab0-380b3750d04e	Brsport Kethelyn	paused	0	0	0	2025-01-16 17:35:10.569	\N	2025-01-16 18:51:34.013	0	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:35:10.569	2025-01-16 18:51:34.014	\N	\N
01118355-a010-480f-bd7e-9975b446ed95	Brsport Sophia	paused	0	0	0	2025-01-16 17:35:30.881	\N	2025-01-16 18:51:34.013	0	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:35:30.881	2025-01-16 18:51:34.014	\N	\N
f29f4a7d-32fe-490d-908b-253c52638e17	Brsport Alice	paused	0	0	0	2025-01-16 17:33:16.386	\N	2025-01-16 18:51:34.013	0	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:33:16.386	2025-01-16 18:51:34.014	\N	\N
e1a0efcd-4872-42b6-bbe9-e857df21aa5f	Lícia	paused	0	0	0	2025-01-16 21:39:51.796	\N	\N	0	0a038795-c14e-4861-bf83-8e65be8709de	2025-01-16 21:39:51.796	2025-01-16 21:39:51.796	\N	\N
5758cb79-c5e0-4fb6-8be3-6cf259d8925e	Brsport Externo Michele	active	0	0	32365	2025-01-17 03:51:40.489	2025-01-16 18:51:39.385	2025-01-16 18:51:34.013	1	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:35:50.161	2025-01-17 03:51:40.49	ea6c5c44-15ec-49b0-9bd4-501cf18ee079	bc110d93-164f-4e82-a525-712e7de07dd2
cd61363f-33cf-4dab-ac53-8382b1a898fc	Neural Vendas	active	0	0	32365	2025-01-17 03:51:40.491	2025-01-16 18:51:39.415	2025-01-16 18:51:34.013	1	f73f1555-f0ad-4fc0-86f4-81464510ef4b	2025-01-16 17:31:29.418	2025-01-17 03:51:40.492	51ce643b-98c5-4262-827c-5f2c55e8ad49	e60bdbbc-3c06-4238-9f13-cfda78faa455
f0d8e971-665a-4049-b05e-0c2dd896c059	Nana	paused	0	0	0	2025-01-16 23:17:13.703	\N	\N	0	ae077b70-ecb6-419a-80a4-475541e29ca9	2025-01-16 23:17:13.703	2025-01-16 23:17:13.703	\N	\N
b7f2d90f-ac62-46c8-ab0c-267cf8a5f4d3	WhatLead	paused	0	0	99110000	2025-01-15 23:45:20.439	2025-01-15 23:45:14.17	2025-01-15 23:45:20.964	0	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-15 23:44:41.385	2025-01-15 23:45:20.964	aabef34b-746d-4782-8bd4-5bcd6aa3bcc8	a4bfc684-f21c-4951-83e4-35be9cb6e2f7
c6be4274-0c84-4255-9df3-e5b3e70d7906	Teste	paused	0	0	1000089	2025-01-15 23:45:20.439	2025-01-15 23:45:14.168	2025-01-15 23:45:20.964	0	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-15 23:44:41.39	2025-01-15 23:45:20.964	58618689-5322-4392-af2b-97bd3342b402	9aa4f00e-a61f-45d0-94fc-05824155eb7a
e536018b-566d-42db-8b35-e65a566b7449	2151	paused	0	0	0	2025-01-16 03:07:19.763	\N	\N	0	bca32529-ab9e-4358-914c-4dbd903ff8a3	2025-01-16 03:07:19.763	2025-01-16 03:07:19.763	\N	\N
\.


--
-- Data for Name: _CampaignLeadToMessageLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."_CampaignLeadToMessageLog" ("A", "B") FROM stdin;
\.


--
-- Data for Name: bot_descritivo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bot_descritivo (id, name, descritivo, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: whatlead_campaign_leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_campaign_leads (id, "userId", "campaignId", name, phone, status, "sentAt", "deliveredAt", "readAt", "failedAt", "failureReason", "messageId", "createdAt", "updatedAt") FROM stdin;
fac79a16-257d-4a75-9ce5-71805ae1eea9	778a30fa-64a5-4bec-a704-0ea888b74a38	0f77409f-d188-499f-bbb8-83c4f4cf6e55	\N	5512981944688	sent	2025-01-17 02:40:21.913	\N	\N	\N	\N	3EB00A92893FB52D3CB0AEB6953B646A3D33F923	2025-01-17 02:39:50.716	2025-01-17 02:40:21.914
d21d93b7-7e25-442b-8bfc-7a31a0fe1924	778a30fa-64a5-4bec-a704-0ea888b74a38	0f77409f-d188-499f-bbb8-83c4f4cf6e55	Urolaser	5512981217093	sent	2025-01-17 02:40:46.264	\N	\N	\N	\N	3EB03148C02FD1F0C41B29BC980BB9CBB64AED0D	2025-01-17 02:39:50.716	2025-01-17 02:40:46.265
98fc39e1-cea6-4333-8e2e-d25fbaaec3df	778a30fa-64a5-4bec-a704-0ea888b74a38	0f77409f-d188-499f-bbb8-83c4f4cf6e55	Jonadab	5512992465180	sent	2025-01-17 02:41:13.93	\N	\N	\N	\N	3EB0095BD987BD6F05CED1168586D2C54E4912E6	2025-01-17 02:39:52.296	2025-01-17 02:41:13.935
\.


--
-- Data for Name: whatlead_campaign_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_campaign_messages (id, "campaignId", type, content, "order", caption, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: whatlead_campaign_statistics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_campaign_statistics (id, "campaignId", "totalLeads", "sentCount", "deliveredCount", "readCount", "failedCount", "startedAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
1e0822d8-a677-41bb-ad67-12008cc09f50	0f77409f-d188-499f-bbb8-83c4f4cf6e55	6	30	0	0	0	\N	\N	2025-01-16 01:06:17.863	2025-01-17 03:31:49.006
\.


--
-- Data for Name: whatlead_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_campaigns (id, name, description, status, type, message, "mediaUrl", "mediaType", "mediaCaption", "scheduledDate", "scheduledStatus", "startedAt", "completedAt", "pausedAt", progress, "minDelay", "maxDelay", "userId", "createdAt", "updatedAt") FROM stdin;
0f77409f-d188-499f-bbb8-83c4f4cf6e55	Teste	campanha para primeiro teste	completed	conversao	\N	\N	\N	\N	\N	pending	\N	2025-01-17 03:31:49.005	\N	100	5	30	778a30fa-64a5-4bec-a704-0ea888b74a38	2025-01-16 00:45:06.549	2025-01-17 03:31:49.007
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
f22e083b-4344-4d85-870a-5825843045d7	NPD	t	2025-01-15 00:33:34.566	2025-01-15 00:34:14.019
ef3378c1-b6e2-404e-b542-c8415b1d3680	Vendas	t	2025-01-15 15:58:17.194	2025-01-15 15:58:41.474
97e428aa-93d3-43b3-bce0-f26afe17d632	Brsport	t	2025-01-15 20:51:41.817	2025-01-15 20:54:34.135
a7f0cdbb-caad-4c00-8998-3e13e30594ba	Deotec	t	2025-01-16 09:48:25.947	2025-01-16 09:48:52.315
a9b40a85-8e6f-4fae-b41c-604b29ccc46f	Anglas	t	2025-01-16 23:47:44.484	2025-01-16 23:48:30.58
\.


--
-- Data for Name: whatlead_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatlead_users (id, email, name, password, profile, phone, "stripeCustomerId", "stripeSubscriptionId", "stripeSubscriptionStatus", active, "createdAt", "updatedAt", "whatleadCompanyId", plan, status, "maxInstances", "messagesPerDay", features, support, "trialEndDate") FROM stdin;
ae077b70-ecb6-419a-80a4-475541e29ca9	nanajaraquadros15@outlook.com	Nana Jara Quadros 	$2b$10$Cl8AhF.QxJN3xUN5Y7vpbOHQVZRBIi2w36DZBx3xdYhHhf8nyQkNC	user		\N	\N	\N	t	2025-01-15 00:33:34.568	2025-01-15 00:33:34.568	f22e083b-4344-4d85-870a-5825843045d7	free	t	2	20	{}	basic	2025-01-22 00:33:34.563
778a30fa-64a5-4bec-a704-0ea888b74a38	jonadab.leite@gmail.com	Jonadab Leite	$2b$10$kudF7sYjkTcGXJP2fGvqC.R8mrE/ZCbccCMx4ppL72GyiUbgN9hpO	user		\N	\N	\N	t	2025-01-11 23:59:09.295	2025-01-11 23:59:09.295	82a3b374-fbc1-4ad1-9915-4632f6a439b0	free	t	2	20	{}	basic	2025-01-18 23:59:09.28
bca32529-ab9e-4358-914c-4dbd903ff8a3	lucaslopes0108@gmail.com	Lucas Lopes da Silva Santos	$2b$10$2a1FpK1d7954h9gMtEo0/.EkpSqepzoWXhv8qAHkPlkgJ5Ml12tJO	user		\N	\N	\N	t	2025-01-12 00:39:06.803	2025-01-12 00:39:06.803	e3968311-9889-4242-af58-62037dd2b171	free	t	2	20	{}	basic	2025-01-19 00:39:06.779
2c6d2ed0-c935-49ea-a7a0-b1d42cc3805d	kv819302@gmail.com	Keila dos Santos Vieira vogt	$2b$10$KIupEze4YzRsFrNd3wOXxusAIjlG17IH5/2lZEV8POoeqWHcAJTZW	user		\N	\N	\N	t	2025-01-12 00:58:52.506	2025-01-12 00:58:52.506	9a74eb9c-acf4-4fee-981e-aff80de603d1	free	t	2	20	{}	basic	2025-01-19 00:58:52.501
ac74f654-5f01-4f45-b2fc-92d9effc6558	patypatriciaoliveirasilva13@gmail.com	Patrícia de Oliveira Silva	$2b$10$PpX1SxD1nZFhmSMLJJCtjeUbakEde0VQd0jRmhgQcWj5tNfPibNDy	user		\N	\N	\N	t	2025-01-12 00:59:21.9	2025-01-12 00:59:21.9	97af23e1-6a75-46e6-af60-ce4b0e7664d8	free	t	2	20	{}	basic	2025-01-19 00:59:21.895
48ba95e0-19e5-4efb-9225-7fb7a43f9a17	alissonfernando91@hotmail.com	Alisson Fernando da Silva Lima	$2b$10$a/RXXZ2O596nDVcpKEXkcOzXIa53udLG9Q0tjAgRiYcmEvEcdjknu	user		\N	\N	\N	t	2025-01-12 01:02:30.223	2025-01-12 01:02:30.223	b1abc241-a4fe-4a78-9e7b-b9ca8a5325f9	free	t	2	20	{}	basic	2025-01-19 01:02:30.197
bb62201a-e946-495f-ae2d-3146a9151447	rosymarques300@gmail.com	Rosiane Moura Marques	$2b$10$jEBo5XJkDX2MJNJLpC96qOGmFUuA1m0cTmRwfcJgr1fIFUHUaSp4G	user		\N	\N	\N	t	2025-01-12 01:37:44.882	2025-01-12 01:37:44.882	f3418cec-61c2-482e-8f85-ed0fd59e286c	free	t	2	20	{}	basic	2025-01-19 01:37:44.854
2c448774-e96d-412a-b953-c6be05207bad	Anderson-params@outlook.com	Anderson Silva Siqueira	$2b$10$1tunLw0rcyoWOwGyyu3Mmu/T1u6AVv3uRz6hjkWlrgJGSkVdRmgJ6	user		\N	\N	\N	t	2025-01-12 01:47:49.905	2025-01-12 01:47:49.905	12b89c3d-11de-4c3d-a000-539ab408edd1	free	t	2	20	{}	basic	2025-01-19 01:47:49.889
a85cb316-b409-4444-b8ff-ba86bfa11bed	www.silvaruth@gmail.com	Ruth Lopes silva	$2b$10$qD0MW1RBBWZYbvARoupNEut8BMu2aOS66LJnxsfazUzUElDPt9Y7a	user		\N	\N	\N	t	2025-01-12 01:51:18.022	2025-01-12 01:51:18.022	b87da37b-09fe-49cc-ac87-43146996e044	free	t	2	20	{}	basic	2025-01-19 01:51:18.001
f7ada163-84be-4067-b31f-2e7c32f65e36	lovanebispo141@gmail.com	LovaniBispo	$2b$10$MkBcpNl/W7T8jAbRucItCeGYic/IutIngr4Wsjp.07gm64ZnL.jfm	user		\N	\N	\N	t	2025-01-12 01:55:29.833	2025-01-12 01:55:29.833	240f5131-21e0-4feb-9551-5e502da6c8dc	free	t	2	20	{}	basic	2025-01-19 01:55:29.827
2382cd4d-ec0c-4670-b9a5-c2b8d21de346	fabigomes8570@gmail.com	Fabiane Gomes	$2b$10$aBzzphiVZ7pRAUW/SV.D/e3d8GIkFjtJkmqTEcnc3tCLviegoFyk2	user		\N	\N	\N	t	2025-01-12 01:57:35.961	2025-01-12 01:57:35.961	5d444b18-7610-49c8-9d9e-78b3dbbb89fa	free	t	2	20	{}	basic	2025-01-19 01:57:35.957
9ba14aba-0899-43c5-814f-39911700e0f3	emillymoraes187@gmail.com	Emilly Caroline Borges De Moraes	$2b$10$Ynqo3PX/1IS3WOcPTxUN0usIimEaEFSzOgQfoGv4iywNl2hjtEMK.	user		\N	\N	\N	t	2025-01-12 01:58:19.002	2025-01-12 01:58:19.002	0f613bd3-5525-41e8-aefd-a570c44b31ac	free	t	2	20	{}	basic	2025-01-19 01:58:18.997
0a038795-c14e-4861-bf83-8e65be8709de	liciafranca7@hotmail.com	Lícia Kerline Lins França	$2b$10$gl/o/wnZCZ1noSwFw.sMougUxBFMPDK3lmXxU71zgcCvWl9XCncli	user		\N	\N	\N	t	2025-01-15 15:58:17.204	2025-01-15 15:58:17.204	ef3378c1-b6e2-404e-b542-c8415b1d3680	free	t	2	20	{}	basic	2025-01-22 15:58:17.187
f73f1555-f0ad-4fc0-86f4-81464510ef4b	brsportmax1@gmail.com	Carlos Henrique Braga	$2b$10$mQvI6l3G5YzBlmJx.GoFPe.sB8z4STldP5hfmLboKrjeuFi2G.kPW	user		\N	\N	\N	t	2025-01-15 20:51:41.825	2025-01-15 20:51:41.825	97e428aa-93d3-43b3-bce0-f26afe17d632	enterprise	t	5000	50000	{}	dedicado	2025-01-22 20:51:41.813
c60b9e3b-9beb-43cf-8b8b-abcdbbf7992c	f56b89c0f0@emailawb.pro	João Silva	$2b$10$V/gUEQCtAOBGTC1ZOnaYaOOc.ItvRnduNphc3JUbWudxP4s8dO.YS	user		\N	\N	\N	t	2025-01-16 09:48:25.977	2025-01-16 09:48:25.977	a7f0cdbb-caad-4c00-8998-3e13e30594ba	free	t	2	20	{}	basic	2025-01-23 09:48:25.869
d37e841c-d0b5-4daf-b2dd-02c8b34cad87	anglasmiranda9@gmail.com	Anglas Neves Miranda 	$2b$10$rhFd9eZ9QPv7pDPkIkwkeuMUbDbZf0UHXxiDo.UXby6.afNj6yLwS	user		\N	\N	\N	t	2025-01-16 23:47:44.497	2025-01-16 23:47:44.497	a9b40a85-8e6f-4fae-b41c-604b29ccc46f	free	t	2	20	{}	basic	2025-01-23 23:47:44.469
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
-- Name: CampaignDispatch CampaignDispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CampaignDispatch"
    ADD CONSTRAINT "CampaignDispatch_pkey" PRIMARY KEY (id);


--
-- Name: CampaignErrorLog CampaignErrorLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CampaignErrorLog"
    ADD CONSTRAINT "CampaignErrorLog_pkey" PRIMARY KEY (id);


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
-- Name: MessageLog MessageLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessageLog"
    ADD CONSTRAINT "MessageLog_pkey" PRIMARY KEY (id);


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
-- Name: _CampaignLeadToMessageLog _CampaignLeadToMessageLog_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_CampaignLeadToMessageLog"
    ADD CONSTRAINT "_CampaignLeadToMessageLog_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: bot_descritivo bot_descritivo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_descritivo
    ADD CONSTRAINT bot_descritivo_pkey PRIMARY KEY (id);


--
-- Name: whatlead_campaign_leads whatlead_campaign_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_leads
    ADD CONSTRAINT whatlead_campaign_leads_pkey PRIMARY KEY (id);


--
-- Name: whatlead_campaign_messages whatlead_campaign_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_messages
    ADD CONSTRAINT whatlead_campaign_messages_pkey PRIMARY KEY (id);


--
-- Name: whatlead_campaign_statistics whatlead_campaign_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_statistics
    ADD CONSTRAINT whatlead_campaign_statistics_pkey PRIMARY KEY (id);


--
-- Name: whatlead_campaigns whatlead_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaigns
    ADD CONSTRAINT whatlead_campaigns_pkey PRIMARY KEY (id);


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
-- Name: MessageLog_campaignId_messageDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessageLog_campaignId_messageDate_idx" ON public."MessageLog" USING btree ("campaignId", "messageDate");


--
-- Name: MessageLog_leadId_messageDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessageLog_leadId_messageDate_idx" ON public."MessageLog" USING btree ("leadId", "messageDate");


--
-- Name: MessageLog_messageId_messageDate_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "MessageLog_messageId_messageDate_key" ON public."MessageLog" USING btree ("messageId", "messageDate");


--
-- Name: MessageLog_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "MessageLog_status_idx" ON public."MessageLog" USING btree (status);


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
-- Name: _CampaignLeadToMessageLog_B_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "_CampaignLeadToMessageLog_B_index" ON public."_CampaignLeadToMessageLog" USING btree ("B");


--
-- Name: bot_descritivo_name_descritivo_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "bot_descritivo_name_descritivo_createdAt_idx" ON public.bot_descritivo USING btree (name, descritivo, "createdAt" DESC);


--
-- Name: whatlead_campaign_leads_campaignId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "whatlead_campaign_leads_campaignId_idx" ON public.whatlead_campaign_leads USING btree ("campaignId");


--
-- Name: whatlead_campaign_leads_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX whatlead_campaign_leads_phone_idx ON public.whatlead_campaign_leads USING btree (phone);


--
-- Name: whatlead_campaign_leads_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX whatlead_campaign_leads_status_idx ON public.whatlead_campaign_leads USING btree (status);


--
-- Name: whatlead_campaign_messages_campaignId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "whatlead_campaign_messages_campaignId_idx" ON public.whatlead_campaign_messages USING btree ("campaignId");


--
-- Name: whatlead_campaign_statistics_campaignId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "whatlead_campaign_statistics_campaignId_idx" ON public.whatlead_campaign_statistics USING btree ("campaignId");


--
-- Name: whatlead_campaign_statistics_campaignId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "whatlead_campaign_statistics_campaignId_key" ON public.whatlead_campaign_statistics USING btree ("campaignId");


--
-- Name: whatlead_campaigns_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX whatlead_campaigns_status_idx ON public.whatlead_campaigns USING btree (status);


--
-- Name: whatlead_campaigns_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "whatlead_campaigns_userId_idx" ON public.whatlead_campaigns USING btree ("userId");


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
-- Name: CampaignDispatch CampaignDispatch_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CampaignDispatch"
    ADD CONSTRAINT "CampaignDispatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.whatlead_campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CampaignDispatch CampaignDispatch_instanceName_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CampaignDispatch"
    ADD CONSTRAINT "CampaignDispatch_instanceName_fkey" FOREIGN KEY ("instanceName") REFERENCES public."Instance"("instanceName") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CampaignErrorLog CampaignErrorLog_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CampaignErrorLog"
    ADD CONSTRAINT "CampaignErrorLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.whatlead_campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: MessageLog MessageLog_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessageLog"
    ADD CONSTRAINT "MessageLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.whatlead_campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MessageLog MessageLog_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MessageLog"
    ADD CONSTRAINT "MessageLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.whatleadleads(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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
-- Name: _CampaignLeadToMessageLog _CampaignLeadToMessageLog_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_CampaignLeadToMessageLog"
    ADD CONSTRAINT "_CampaignLeadToMessageLog_A_fkey" FOREIGN KEY ("A") REFERENCES public.whatlead_campaign_leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _CampaignLeadToMessageLog _CampaignLeadToMessageLog_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."_CampaignLeadToMessageLog"
    ADD CONSTRAINT "_CampaignLeadToMessageLog_B_fkey" FOREIGN KEY ("B") REFERENCES public."MessageLog"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: whatlead_campaign_leads whatlead_campaign_leads_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_leads
    ADD CONSTRAINT "whatlead_campaign_leads_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.whatlead_campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatlead_campaign_leads whatlead_campaign_leads_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_leads
    ADD CONSTRAINT "whatlead_campaign_leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.whatlead_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatlead_campaign_messages whatlead_campaign_messages_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_messages
    ADD CONSTRAINT "whatlead_campaign_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.whatlead_campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatlead_campaign_statistics whatlead_campaign_statistics_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaign_statistics
    ADD CONSTRAINT "whatlead_campaign_statistics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.whatlead_campaigns(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: whatlead_campaigns whatlead_campaigns_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatlead_campaigns
    ADD CONSTRAINT "whatlead_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.whatlead_users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


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

