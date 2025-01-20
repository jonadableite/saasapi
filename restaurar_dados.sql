SET session_replication_role = 'replica';

-- 1. Empresas (whatlead_companies)
INSERT INTO whatlead_companies (id, name, active, "createdAt", "updatedAt")
VALUES
('82a3b374-fbc1-4ad1-9915-4632f6a439b0', 'Whatlead', true, '2025-01-11 23:59:09.29', '2025-01-11 23:59:31.094'),
('39bb1169-00b9-4cca-ba26-1af36b84d6d7', 'LUTHAY NEGOCIOS DIGITAIS', true, '2025-01-12 00:04:21.68', '2025-01-12 00:04:42.616'),
('e3968311-9889-4242-af58-62037dd2b171', 'LUTHAY NEGOCIOS DIGITAIS LTDA', true, '2025-01-12 00:39:06.797', '2025-01-12 00:40:01.653'),
('35f352f2-24ea-4cfc-bb2b-46c15c9924ff', 'Temporary Company', true, '2025-01-12 00:56:12.509', '2025-01-12 00:56:12.509'),
('9a74eb9c-acf4-4fee-981e-aff80de603d1', 'Especialista GotaVita', true, '2025-01-12 00:58:52.503', '2025-01-12 00:59:46.079'),
('97af23e1-6a75-46e6-af60-ce4b0e7664d8', 'PatJenBer', true, '2025-01-12 00:59:21.897', '2025-01-12 01:00:44.62'),
('b1abc241-a4fe-4a78-9e7b-b9ca8a5325f9', 'Alisson', true, '2025-01-12 01:02:30.216', '2025-01-12 01:09:01.341'),
('8d98201e-f4ca-499c-894b-046c46e9d19e', 'Rosali Barboza', true, '2025-01-12 01:22:50.186', '2025-01-12 01:35:43.08'),
('f3418cec-61c2-482e-8f85-ed0fd59e286c', 'Temporary Company', true, '2025-01-12 01:37:44.859', '2025-01-12 01:37:44.859'),
('b87da37b-09fe-49cc-ac87-43146996e044', 'Ruth.com', true, '2025-01-12 01:51:18.006', '2025-01-12 01:53:04.036'),
('240f5131-21e0-4feb-9551-5e502da6c8dc', 'Tefysamuel', true, '2025-01-12 01:55:29.829', '2025-01-12 01:56:43.643'),
('5d444b18-7610-49c8-9d9e-78b3dbbb89fa', 'Fabi', true, '2025-01-12 01:57:35.959', '2025-01-12 02:03:16.686'),
('0f613bd3-5525-41e8-aefd-a570c44b31ac', 'Emilly Moraes', true, '2025-01-12 01:58:19', '2025-01-12 02:16:19.388'),
('12b89c3d-11de-4c3d-a000-539ab408edd1', 'Especialista', true, '2025-01-12 01:47:49.891', '2025-01-12 02:41:13.244'),
('f22e083b-4344-4d85-870a-5825843045d7', 'NPD', true, '2025-01-15 00:33:34.566', '2025-01-15 00:34:14.019'),
('ef3378c1-b6e2-404e-b542-c8415b1d3680', 'Vendas', true, '2025-01-15 15:58:17.194', '2025-01-15 15:58:41.474'),
('97e428aa-93d3-43b3-bce0-f26afe17d632', 'Brsport', true, '2025-01-15 20:51:41.817', '2025-01-15 20:54:34.135'),
('a7f0cdbb-caad-4c00-8998-3e13e30594ba', 'Deotec', true, '2025-01-16 09:48:25.947', '2025-01-16 09:48:52.315'),
('a9b40a85-8e6f-4fae-b41c-604b29ccc46f', 'Anglas', true, '2025-01-16 23:47:44.484', '2025-01-16 23:48:30.58')
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
active = EXCLUDED.active,
"updatedAt" = EXCLUDED."updatedAt";

-- 2. Usuários (whatlead_users)
INSERT INTO whatlead_users (id, email, name, password, profile, phone, "whatleadCompanyId", plan, status, "maxInstances", "messagesPerDay", "createdAt", "updatedAt", features, support, "trialEndDate")
VALUES
('778a30fa-64a5-4bec-a704-0ea888b74a38', 'jonadab.leite@gmail.com', 'Jonadab Leite', '$2b$10$kudF7sYjkTcGXJP2fGvqC.R8mrE/ZCbccCMx4ppL72GyiUbgN9hpO', 'user', '', '82a3b374-fbc1-4ad1-9915-4632f6a439b0', 'free', true, 2, 20, '2025-01-11 23:59:09.295', '2025-01-11 23:59:09.295', '{}', 'basic', '2025-01-18 23:59:09.28'),
('ae077b70-ecb6-419a-80a4-475541e29ca9', 'nanajaraquadros15@outlook.com', 'Nana Jara Quadros', '$2b$10$Cl8AhF.QxJN3xUN5Y7vpbOHQVZRBIi2w36DZBx3xdYhHhf8nyQkNC', 'user', '', 'f22e083b-4344-4d85-870a-5825843045d7', 'free', true, 2, 20, '2025-01-15 00:33:34.568', '2025-01-15 00:33:34.568', '{}', 'basic', '2025-01-22 00:33:34.563'),
('bca32529-ab9e-4358-914c-4dbd903ff8a3', 'lucaslopes0108@gmail.com', 'Lucas Lopes da Silva Santos', '$2b$10$2a1FpK1d7954h9gMtEo0/.EkpSqepzoWXhv8qAHkPlkgJ5Ml12tJO', 'user', '', 'e3968311-9889-4242-af58-62037dd2b171', 'free', true, 2, 20, '2025-01-12 00:39:06.803', '2025-01-12 00:39:06.803', '{}', 'basic', '2025-01-19 00:39:06.779'),
('2c6d2ed0-c935-49ea-a7a0-b1d42cc3805d', 'kv819302@gmail.com', 'Keila dos Santos Vieira vogt', '$2b$10$KIupEze4YzRsFrNd3wOXxusAIjlG17IH5/2lZEV8POoeqWHcAJTZW', 'user', '', '9a74eb9c-acf4-4fee-981e-aff80de603d1', 'free', true, 2, 20, '2025-01-12 00:58:52.506', '2025-01-12 00:58:52.506', '{}', 'basic', '2025-01-19 00:58:52.501'),
('f73f1555-f0ad-4fc0-86f4-81464510ef4b', 'brsportmax1@gmail.com', 'Carlos Henrique Braga', '$2b$10$mQvI6l3G5YzBlmJx.GoFPe.sB8z4STldP5hfmLboKrjeuFi2G.kPW', 'user', '', '97e428aa-93d3-43b3-bce0-f26afe17d632', 'enterprise', true, 5000, 50000, '2025-01-15 20:51:41.825', '2025-01-15 20:51:41.825', '{}', 'dedicado', '2025-01-22 20:51:41.813'),
('0a038795-c14e-4861-bf83-8e65be8709de', 'liciafranca7@hotmail.com', 'Lícia Kerline Lins França', '$2b$10$gl/o/wnZCZ1noSwFw.sMougUxBFMPDK3lmXxU71zgcCvWl9XCncli', 'user', '', 'ef3378c1-b6e2-404e-b542-c8415b1d3680', 'free', true, 2, 20, '2025-01-15 15:58:17.204', '2025-01-15 15:58:17.204', '{}', 'basic', '2025-01-22 15:58:17.187'),
('c60b9e3b-9beb-43cf-8b8b-abcdbbf7992c', 'f56b89c0f0@emailawb.pro', 'João Silva', '$2b$10$V/gUEQCtAOBGTC1ZOnaYaOOc.ItvRnduNphc3JUbWudxP4s8dO.YS', 'user', '', 'a7f0cdbb-caad-4c00-8998-3e13e30594ba', 'free', true, 2, 20, '2025-01-16 09:48:25.977', '2025-01-16 09:48:25.977', '{}', 'basic', '2025-01-23 09:48:25.869'),
('d37e841c-d0b5-4daf-b2dd-02c8b34cad87', 'anglasmiranda9@gmail.com', 'Anglas Neves Miranda', '$2b$10$rhFd9eZ9QPv7pDPkIkwkeuMUbDbZf0UHXxiDo.UXby6.afNj6yLwS', 'user', '', 'a9b40a85-8e6f-4fae-b41c-604b29ccc46f', 'free', true, 2, 20, '2025-01-16 23:47:44.497', '2025-01-16 23:47:44.497', '{}', 'basic', '2025-01-23 23:47:44.469')
ON CONFLICT (id) DO UPDATE SET
email = EXCLUDED.email,
name = EXCLUDED.name,
"updatedAt" = EXCLUDED."updatedAt";

-- 3. Instâncias (Instance)
INSERT INTO "Instance" (id, "instanceName", "connectionStatus", number, "ownerJid", "profilePicUrl", integration, token, "clientName", "profileName", "userId", "createdAt", "updatedAt", "disconnectedAt", "disconnectionObject", "disconnectionReasonCode", "proxyConfig", typebot)
VALUES
('f80fedc5-327d-4103-ad09-2706b7761a61', 'Brsport Alice', 'connecting', NULL, NULL, NULL, 'WHATSAPP-BAILEYS', 'ADEC67FC-5B74-4BDF-82B2-8AE6358B78B5', 'evolutionv2_exchange', NULL, 'f73f1555-f0ad-4fc0-86f4-81464510ef4b', '2025-01-16 17:33:16.383', '2025-01-16 19:35:47.535', NULL, NULL, NULL, NULL, NULL),
('b680a896-dee9-4f00-aeae-77047279fc00', 'Brsport Kethelyn', 'connecting', NULL, NULL, NULL, 'WHATSAPP-BAILEYS', 'B271E5AE-5FD3-44A0-83BF-65524CA4ECA7', 'evolutionv2_exchange', NULL, 'f73f1555-f0ad-4fc0-86f4-81464510ef4b', '2025-01-16 17:35:10.564', '2025-01-16 19:35:47.544', NULL, NULL, NULL, NULL, NULL),
('89c9d9f0-417d-435c-8870-23946943cfa7', 'Brsport Externo Michele', 'open', NULL, '5517991693971@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/328782722_843920574446418_1846468129134136468_n.jpg?ccb=11-4&oh=01_Q5AaILsgjgihy3f8jpNRpWwEM03cKBqKhoOHhftvBGNg0kXW&oe=67967057&_nc_sid=5e03e0&_nc_cat=109', 'WHATSAPP-BAILEYS', '614D05E7-E277-4673-852B-92282CE5B9AB', 'evolutionv2_exchange', '.', 'f73f1555-f0ad-4fc0-86f4-81464510ef4b', '2025-01-16 17:35:50.158', '2025-01-16 19:35:47.549', NULL, NULL, NULL, NULL, NULL),
('b881068f-2062-4c80-91b9-b88417849ec6', 'Teste', 'open', NULL, '5512981217093@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/465953318_963425072242442_6227340909865400527_n.jpg?ccb=11-4&oh=01_Q5AaICbEdj-jcZJEdT-xILu5D1tKgPJWK7DVIyUYBn-hMu35&oe=67968DE5&_nc_sid=5e03e0&_nc_cat=108', 'WHATSAPP-BAILEYS', '32DEEEEB-3B06-46FF-BFB5-64F768FCA67D', 'evolutionv2_exchange', 'Urolasermkt', '778a30fa-64a5-4bec-a704-0ea888b74a38', '2025-01-15 01:14:25.857', '2025-01-17 03:30:28.472', NULL, NULL, NULL, NULL, NULL),
('99ce14a3-5761-4af9-ac61-ca495a3a53cf', 'Neural Vendas', 'open', NULL, '5516993335889@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/473397827_1118691989748459_4685434764339167007_n.jpg?ccb=11-4&oh=01_Q5AaIHG0Ub2n-y_RDfvyjxWfbuXuVaeJCm96gtyOgYBsZRG4&oe=67966EF2&_nc_sid=5e03e0&_nc_cat=110', 'WHATSAPP-BAILEYS', '36857AC9-EA25-4024-B8A7-DFD94614DDFC', 'evolutionv2_exchange', 'Neural vendas', 'f73f1555-f0ad-4fc0-86f4-81464510ef4b', '2025-01-16 17:31:29.367', '2025-01-16 19:35:47.557', NULL, NULL, NULL, NULL, NULL),
('2bf533fb-27ec-4082-bf06-9e2252450f76', 'Brsport Sophia', 'connecting', NULL, NULL, NULL, 'WHATSAPP-BAILEYS', '4C612905-BD5E-45FA-B8F8-E90DF3877C35', 'evolutionv2_exchange', NULL, 'f73f1555-f0ad-4fc0-86f4-81464510ef4b', '2025-01-16 17:35:30.877', '2025-01-16 19:35:47.56', NULL, NULL, NULL, NULL, NULL),
('9ed2cbfa-0b0a-42eb-92b0-d5e3c0802cfb', 'WhatLead', 'open', NULL, '5512988444921@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/472831971_600182202662593_4052389712798509149_n.jpg?ccb=11-4&oh=01_Q5AaIFpf5NGj8Rf3uPj_DAWpirJ20M-6TBCkls8fWu59wApE&oe=6796AAC0&_nc_sid=5e03e0&_nc_cat=110', 'WHATSAPP-BAILEYS', '193D85AB-C729-446C-B893-74FCD81FDAE1', 'evolutionv2_exchange', 'WhatLeads', '778a30fa-64a5-4bec-a704-0ea888b74a38', '2025-01-15 01:13:47.303', '2025-01-17 03:30:28.754', NULL, NULL, NULL, NULL, NULL),
('27d8e9ec-50d5-4103-acc9-750403212081', '2151', 'close', NULL, '5511966592151@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/420616272_1079260193714565_2996409013528630048_n.jpg?ccb=11-4&oh=01_Q5AaIAKaFXz5OHha2Nmrs2N_QZU9hl2qzvN8-x08trTUokMc&oe=67957C6F&_nc_sid=5e03e0&_nc_cat=100', 'WHATSAPP-BAILEYS', 'FACEEDA1-7C3D-4A7E-A28A-BF4C8E0B6A07', 'evolutionv2_exchange', 'Lucas Lopes', 'bca32529-ab9e-4358-914c-4dbd903ff8a3', '2025-01-16 03:07:19.751', '2025-01-16 21:37:23.952', NULL, NULL, NULL, '{"host": "200.234.179.93", "port": 50101, "password": "cgKJcdTYQs", "username": "lucaslopes010899"}', '{"url": "https://flowbot.whatlead.com.br/final-2151-q59jp6m", "expire": 1, "enabled": true, "typebot": "Final 2151", "keepOpen": false, "description": "Final 2151", "triggerType": "keyword", "debounceTime": 10, "delayMessage": 1000, "triggerValue": "Olá Lucas! Quero saber mais detalhes, pode me explicar melhor? 03", "keywordFinish": "#SAIR", "stopBotFromMe": false, "unknownMessage": "?", "listeningFromMe": false, "triggerOperator": "contains"}'),
('bc912ccd-1ac5-4913-8384-bf3348599914', 'Lícia', 'open', NULL, '558291293999@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/472311051_909334248056586_6078000403036963316_n.jpg?ccb=11-4&oh=01_Q5AaIJv3qvd6qvV7TrDCWKJB_UyYqEc5lUMiTo1m5PKdjjQD&oe=6796ACDA&_nc_sid=5e03e0&_nc_cat=103', 'WHATSAPP-BAILEYS', '167050F6-D649-4891-8826-74C97282EC0D', 'evolutionv2_exchange', 'Daniella Hoffman', '0a038795-c14e-4861-bf83-8e65be8709de', '2025-01-16 21:39:51.701', '2025-01-16 23:17:30.009', NULL, NULL, NULL, NULL, '{"url": "https://flowbot.whatlead.com.br/my-typebot-s1sxv5y", "expire": 0, "enabled": true, "typebot": "Lícia", "keepOpen": false, "description": "Lícia fluxo", "triggerType": "all", "debounceTime": 10, "delayMessage": 1000, "triggerValue": "", "keywordFinish": "#SAIR", "stopBotFromMe": false, "unknownMessage": "Message not recognized", "listeningFromMe": false, "triggerOperator": "contains"}'),
('9d94a273-a64f-4e6f-bc09-9b3773fed966', 'Nana', 'connecting', NULL, NULL, NULL, 'WHATSAPP-BAILEYS', '32ED11F1-2DF9-469F-8468-12C9B902D987', 'evolutionv2_exchange', NULL, 'ae077b70-ecb6-419a-80a4-475541e29ca9', '2025-01-16 23:17:13.683', '2025-01-16 23:35:07.326', NULL, NULL, NULL, NULL, '{"url": "https://flowbot.whatlead.com.br/nana", "expire": 0, "enabled": true, "typebot": "nana", "keepOpen": false, "description": "fluxo nana", "triggerType": "all", "debounceTime": 10, "delayMessage": 1000, "triggerValue": "", "keywordFinish": "#SAIR", "stopBotFromMe": false, "unknownMessage": "Message not recognized", "listeningFromMe": false, "triggerOperator": "contains"}')
ON CONFLICT (id) DO UPDATE SET
"connectionStatus" = EXCLUDED."connectionStatus",
"updatedAt" = EXCLUDED."updatedAt";

-- 4. Campanhas (whatlead_campaigns)
INSERT INTO whatlead_campaigns (id, name, description, status, type, "userId", "createdAt", "updatedAt", progress, "minDelay", "maxDelay")
VALUES
('0f77409f-d188-499f-bbb8-83c4f4cf6e55', 'Teste', 'campanha para primeiro teste', 'completed', 'conversao', '778a30fa-64a5-4bec-a704-0ea888b74a38', '2025-01-16 00:45:06.549', '2025-01-17 03:31:49.007', 100, 5, 30)
ON CONFLICT (id) DO UPDATE SET
status = EXCLUDED.status,
"updatedAt" = EXCLUDED."updatedAt";

-- 5. Estatísticas de Campanha (whatlead_campaign_statistics)
INSERT INTO whatlead_campaign_statistics (id, "campaignId", "totalLeads", "sentCount", "deliveredCount", "readCount", "failedCount", "createdAt", "updatedAt")
VALUES
('1e0822d8-a677-41bb-ad67-12008cc09f50', '0f77409f-d188-499f-bbb8-83c4f4cf6e55', 6, 30, 0, 0, 0, '2025-01-16 01:06:17.863', '2025-01-17 03:31:49.006')
ON CONFLICT (id) DO UPDATE SET
"totalLeads" = EXCLUDED."totalLeads",
"sentCount" = EXCLUDED."sentCount",
"updatedAt" = EXCLUDED."updatedAt";

-- 6. Leads de Campanha (whatlead_campaign_leads)
INSERT INTO whatlead_campaign_leads (id, "userId", "campaignId", name, phone, status, "sentAt", "createdAt", "updatedAt")
VALUES
('fac79a16-257d-4a75-9ce5-71805ae1eea9', '778a30fa-64a5-4bec-a704-0ea888b74a38', '0f77409f-d188-499f-bbb8-83c4f4cf6e55', NULL, '5512981944688', 'sent', '2025-01-17 02:40:21.913', '2025-01-17 02:39:50.716', '2025-01-17 02:40:21.914'),
('d21d93b7-7e25-442b-8bfc-7a31a0fe1924', '778a30fa-64a5-4bec-a704-0ea888b74a38', '0f77409f-d188-499f-bbb8-83c4f4cf6e55', 'Urolaser', '5512981217093', 'sent', '2025-01-17 02:40:46.264', '2025-01-17 02:39:50.716', '2025-01-17 02:40:46.265'),
('98fc39e1-cea6-4333-8e2e-d25fbaaec3df', '778a30fa-64a5-4bec-a704-0ea888b74a38', '0f77409f-d188-499f-bbb8-83c4f4cf6e55', 'Jonadab', '5512992465180', 'sent', '2025-01-17 02:41:13.93', '2025-01-17 02:39:52.296', '2025-01-17 02:41:13.935')
ON CONFLICT (id) DO UPDATE SET
status = EXCLUDED.status,
"sentAt" = EXCLUDED."sentAt",
"updatedAt" = EXCLUDED."updatedAt";

SET session_replication_role = 'origin';
