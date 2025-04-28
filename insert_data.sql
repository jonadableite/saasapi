-- Script para recuperação de dados

-- Inserir usuários
INSERT INTO "whatlead_users" ("active", "createdAt", "email", "features", "id", "maxInstances", "messagesPerDay", "name", "password", "phone", "plan", "profile", "role", "status", "support", "trialEndDate", "updatedAt", "whatleadCompanyId")
VALUES 
(true, '2025-04-22 20:49:58.027', 'felipecollab@gmail.com', '{}', '0a92d8a0-b26a-444c-ad33-d683ac7168b4', 100, 2000, 'felipe', '$2b$10$Cady90raUg/uXmYRzO2IuuuBJmd.CkBdN.oTrGm9nTCzeEIHbT0Ei', '', 'enterprise', 'user', 'user', true, 'basic', '2025-04-29 20:49:58.014', '2025-04-22 20:49:58.027', 'bfca70b9-b90b-4210-bc25-d7a7d4e36c5e'),
(true, '2025-04-22 21:44:37.032', 'jonadab.leite@gmail.com', '{}', 'a341f8e3-48f9-40c4-a9cd-73d2a03cf4d1', 10, 200, 'Jonadab Leite', '$2b$10$IchABDg0H8BhsHnJfXQNQOGAkxTRB0O/ua3exfXfixnzdEQP4cAV.', '', 'pro', 'user', 'user', true, 'basic', '2025-04-29 21:44:37.024', '2025-04-22 21:44:37.032', '6ec54e81-92d8-4852-a457-721a388276df');

-- Inserir empresas
INSERT INTO "whatlead_companies" ("active", "createdAt", "id", "name", "updatedAt")
VALUES 
(true, '2025-04-22 20:49:58.021', 'bfca70b9-b90b-4210-bc25-d7a7d4e36c5e', 'felipe stoelben', '2025-04-23 14:29:53.385'),
(true, '2025-04-22 21:44:37.028', '6ec54e81-92d8-4852-a457-721a388276df', 'WhatLeads', '2025-04-23 16:14:16.962');

-- Inserir Instâncias
INSERT INTO "Instance" ("id", "instanceName", "connectionStatus", "createdAt", "updatedAt", "number", "ownerJid", "profileName", "profilePicUrl", "integration", "token", "userId", "clientName")
VALUES 
('15cfe255-c00b-44b6-9b2e-3067989a7356', 'laura suporte', 'OPEN', '2025-04-23 16:39:49.313', '2025-04-24 03:58:00.521', NULL, '555181564941@s.whatsapp.net', 'Luana', NULL, 'WHATSAPP-BAILEYS', 'D916043F-3866-4749-A602-40AC41D183FF', '0a92d8a0-b26a-444c-ad33-d683ac7168b4', 'evolutionv2_exchange'),
('b91c9b34-d088-4114-972d-39ea9d5df06b', 'BRUNO-FELIPE', 'OPEN', '2025-04-23 16:37:38.532', '2025-04-24 03:58:00.521', NULL, '558596472779@s.whatsapp.net', 'SUPORTE', 'https://pps.whatsapp.net/v/t61.24694-24/473399309_636741732445875_9115271125214305377_n.jpg?ccb=11-4&oh=01_Q5Aa1QGyAY0xC9qVtjqhwPJdo2LR7FryhGYPFba9n-LDEp3zig&oe=68166F38&_nc_sid=5e03e0&_nc_cat=103', 'WHATSAPP-BAILEYS', '2EC12EC8-6666-4EAF-9164-A854BBC546D2', '0a92d8a0-b26a-444c-ad33-d683ac7168b4', 'evolutionv2_exchange'),
('33295623-09b7-4f08-94b4-f9c0b7562542', 'leo borges zap 02', 'OPEN', '2025-04-23 21:03:51.878', '2025-04-24 03:58:00.521', NULL, '553597332744@s.whatsapp.net', 'Phantom', 'https://pps.whatsapp.net/v/t61.24694-24/491838465_1128840462382914_6630933583553761666_n.jpg?ccb=11-4&oh=01_Q5Aa1QFDm9mSS75kcmCaveoADuGmQ2k-92bt9jAIUrSrnx-9FA&oe=68166AC1&_nc_sid=5e03e0&_nc_cat=106', 'WHATSAPP-BAILEYS', '679556AC-20E3-4F4D-8BDE-4F1B5D45B728', '0a92d8a0-b26a-444c-ad33-d683ac7168b4', 'evolutionv2_exchange'),
('12d0a980-cb39-4d38-ad21-09514e96068a', 'leo borges zap 01', 'OPEN', '2025-04-23 19:37:27.668', '2025-04-24 03:58:00.522', NULL, '553598003496@s.whatsapp.net', 'Trader Phantom', 'https://pps.whatsapp.net/v/t61.24694-24/491886830_1025027676179723_4458096034425194262_n.jpg?ccb=11-4&oh=01_Q5Aa1QFfj2sL2aSdVVf0PChhnHCF3_Vpc1BdjoPdXhlRz6Purw&oe=68167EAE&_nc_sid=5e03e0&_nc_cat=104', 'WHATSAPP-BAILEYS', '98CBDDDC-1EE9-4998-A7C0-40F23FB504F5', '0a92d8a0-b26a-444c-ad33-d683ac7168b4', 'evolutionv2_exchange'),
('3efd5f66-4bcc-4660-a589-cef88847757b', 'Pessoal', 'OPEN', '2025-04-23 15:37:12.334', '2025-04-24 03:58:08.869', '5512992465180', '5512992465180@s.whatsapp.net', 'jonadab Leite', 'https://pps.whatsapp.net/v/t61.24694-24/431272694_8186394164710743_3998065447072149588_n.jpg?ccb=11-4&oh=01_Q5Aa1QFGPss16YABF_SpHSQG4tqmvisjkTamRS2XFAYyGTdQrA&oe=68168331&_nc_sid=5e03e0&_nc_cat=110', 'WHATSAPP-BAILEYS', '3F9A4C5F-0F69-41DA-8054-AB555513024A', 'a341f8e3-48f9-40c4-a9cd-73d2a03cf4d1', 'evolutionv2_exchange'),
('5dc25916-8aea-4f80-ab08-6dd332438e0e', 'Testes', 'OPEN', '2025-04-22 21:46:46.765', '2025-04-24 03:58:08.869', '5512988444921', '5512988444921@s.whatsapp.net', 'WhatLeads', 'https://pps.whatsapp.net/v/t61.24694-24/473404554_625490446838220_1008615427782015914_n.jpg?ccb=11-4&oh=01_Q5Aa1QGb9sSkh8KUtygHdx-4FuQjsmTHFM8TcfQdr277-Jfx_g&oe=68167D2C&_nc_sid=5e03e0&_nc_cat=101', 'WHATSAPP-BAILEYS', 'EA83F3B3-91DC-4D5D-8C36-2BAB7B1A5F3E', 'a341f8e3-48f9-40c4-a9cd-73d2a03cf4d1', 'evolutionv2_exchange');

-- Inserir MediaStats
INSERT INTO "MediaStats" ("id", "instanceName", "date", "text", "image", "video", "audio", "sticker", "reaction", "isReceived", "totalDaily", "totalAllTime", "totalSent", "totalReceived", "createdAt", "updatedAt")
VALUES 
('468422e2-8f55-4b08-8088-70fc893cfd4c', 'Pessoal', '2025-04-23 03:00:00', 0, 0, 0, 0, 0, 0, true, 0, 0, 0, 0, '2025-04-23 16:26:27.635', '2025-04-23 16:26:27.635'),
('401b59ad-ba88-4058-839a-c9548da0927f', 'Testes', '2025-04-23 03:00:00', 0, 0, 0, 0, 0, 0, true, 0, 0, 0, 0, '2025-04-23 16:26:27.635', '2025-04-23 16:26:27.635'),
('509a3be6-3bed-41db-8f4f-518544454d91', 'Testes', '2025-04-23 03:00:00', 0, 0, 0, 0, 1, 0, false, 1, 1, 1, 0, '2025-04-23 16:26:27.621', '2025-04-23 16:26:27.621');
