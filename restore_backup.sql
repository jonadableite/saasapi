-- restore_backup.sql
-- Desabilitar verificação de chaves estrangeiras
SET session_replication_role = 'replica';

-- Limpar todas as tabelas existentes
TRUNCATE TABLE "whatlead_companies" CASCADE;
TRUNCATE TABLE "whatlead_users" CASCADE;
TRUNCATE TABLE "Instance" CASCADE;
TRUNCATE TABLE "MediaStats" CASCADE;
TRUNCATE TABLE "WarmupStats" CASCADE;
TRUNCATE TABLE "Payment" CASCADE;
TRUNCATE TABLE "bot_descritivo" CASCADE;
TRUNCATE TABLE "whatleadparceiroconfigs" CASCADE;
TRUNCATE TABLE "whatleadleads" CASCADE;

-- Restaurar Companies
INSERT INTO "whatlead_companies" (id, name, active, "createdAt", "updatedAt") VALUES
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
('12b89c3d-11de-4c3d-a000-539ab408edd1', 'Especialista', true, '2025-01-12 01:47:49.891', '2025-01-12 02:41:13.244');

-- Restaurar Users
INSERT INTO "whatlead_users" (id, email, name, password, profile, phone, "stripeCustomerId", "stripeSubscriptionId", "stripeSubscriptionStatus", active, "createdAt", "updatedAt", "whatleadCompanyId", plan, status, "maxInstances", "messagesPerDay", features, support, "trialEndDate") VALUES
('778a30fa-64a5-4bec-a704-0ea888b74a38', 'jonadab.leite@gmail.com', 'Jonadab Leite', '$2b$10$kudF7sYjkTcGXJP2fGvqC.R8mrE/ZCbccCMx4ppL72GyiUbgN9hpO', 'user', '', NULL, NULL, NULL, true, '2025-01-11 23:59:09.295', '2025-01-11 23:59:09.295', '82a3b374-fbc1-4ad1-9915-4632f6a439b0', 'free', true, 2, 20, '{}', 'basic', '2025-01-18 23:59:09.28'),
('bca32529-ab9e-4358-914c-4dbd903ff8a3', 'lucaslopes0108@gmail.com', 'Lucas Lopes da Silva Santos', '$2b$10$2a1FpK1d7954h9gMtEo0/.EkpSqepzoWXhv8qAHkPlkgJ5Ml12tJO', 'user', '', NULL, NULL, NULL, true, '2025-01-12 00:39:06.803', '2025-01-12 00:39:06.803', 'e3968311-9889-4242-af58-62037dd2b171', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 00:39:06.779'),
('2c6d2ed0-c935-49ea-a7a0-b1d42cc3805d', 'kv819302@gmail.com', 'Keila dos Santos Vieira vogt', '$2b$10$KIupEze4YzRsFrNd3wOXxusAIjlG17IH5/2lZEV8POoeqWHcAJTZW', 'user', '', NULL, NULL, NULL, true, '2025-01-12 00:58:52.506', '2025-01-12 00:58:52.506', '9a74eb9c-acf4-4fee-981e-aff80de603d1', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 00:58:52.501'),
('ac74f654-5f01-4f45-b2fc-92d9effc6558', 'patypatriciaoliveirasilva13@gmail.com', 'Patrícia de Oliveira Silva', '$2b$10$PpX1SxD1nZFhmSMLJJCtjeUbakEde0VQd0jRmhgQcWj5tNfPibNDy', 'user', '', NULL, NULL, NULL, true, '2025-01-12 00:59:21.9', '2025-01-12 00:59:21.9', '97af23e1-6a75-46e6-af60-ce4b0e7664d8', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 00:59:21.895'),
('48ba95e0-19e5-4efb-9225-7fb7a43f9a17', 'alissonfernando91@hotmail.com', 'Alisson Fernando da Silva Lima', '$2b$10$a/RXXZ2O596nDVcpKEXkcOzXIa53udLG9Q0tjAgRiYcmEvEcdjknu', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:02:30.223', '2025-01-12 01:02:30.223', 'b1abc241-a4fe-4a78-9e7b-b9ca8a5325f9', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:02:30.197'),
('bb62201a-e946-495f-ae2d-3146a9151447', 'rosymarques300@gmail.com', 'Rosiane Moura Marques', '$2b$10$jEBo5XJkDX2MJNJLpC96qOGmFUuA1m0cTmRwfcJgr1fIFUHUaSp4G', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:37:44.882', '2025-01-12 01:37:44.882', 'f3418cec-61c2-482e-8f85-ed0fd59e286c', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:37:44.854'),
('2c448774-e96d-412a-b953-c6be05207bad', 'Anderson-params@outlook.com', 'Anderson Silva Siqueira', '$2b$10$1tunLw0rcyoWOwGyyu3Mmu/T1u6AVv3uRz6hjkWlrgJGSkVdRmgJ6', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:47:49.905', '2025-01-12 01:47:49.905', '12b89c3d-11de-4c3d-a000-539ab408edd1', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:47:49.889'),
('a85cb316-b409-4444-b8ff-ba86bfa11bed', 'www.silvaruth@gmail.com', 'Ruth Lopes silva', '$2b$10$qD0MW1RBBWZYbvARoupNEut8BMu2aOS66LJnxsfazUzUElDPt9Y7a', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:51:18.022', '2025-01-12 01:51:18.022', 'b87da37b-09fe-49cc-ac87-43146996e044', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:51:18.001'),
('f7ada163-84be-4067-b31f-2e7c32f65e36', 'lovanebispo141@gmail.com', 'LovaniBispo', '$2b$10$MkBcpNl/W7T8jAbRucItCeGYic/IutIngr4Wsjp.07gm64ZnL.jfm', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:55:29.833', '2025-01-12 01:55:29.833', '240f5131-21e0-4feb-9551-5e502da6c8dc', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:55:29.827'),
('2382cd4d-ec0c-4670-b9a5-c2b8d21de346', 'fabigomes8570@gmail.com', 'Fabiane Gomes', '$2b$10$aBzzphiVZ7pRAUW/SV.D/e3d8GIkFjtJkmqTEcnc3tCLviegoFyk2', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:57:35.961', '2025-01-12 01:57:35.961', '5d444b18-7610-49c8-9d9e-78b3dbbb89fa', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:57:35.957'),
('9ba14aba-0899-43c5-814f-39911700e0f3', 'emillymoraes187@gmail.com', 'Emilly Caroline Borges De Moraes', '$2b$10$Ynqo3PX/1IS3WOcPTxUN0usIimEaEFSzOgQfoGv4iywNl2hjtEMK.', 'user', '', NULL, NULL, NULL, true, '2025-01-12 01:58:19.002', '2025-01-12 01:58:19.002', '0f613bd3-5525-41e8-aefd-a570c44b31ac', 'free', true, 2, 20, '{}', 'basic', '2025-01-19 01:58:18.997');


-- Restaurar Instance
INSERT INTO "Instance" (id, "instanceName", "connectionStatus", "ownerJid", "profilePicUrl", integration, token, "clientName", "profileName", "userId", "createdAt", "updatedAt") VALUES
('e8652577-98f2-4b66-8649-98ce50788692', 'Especialista 2', 'open', '556798458559@s.whatsapp.net', 'https://pps.whatsapp.net/v/t61.24694-24/421275887_1101538084791761_2392507726518701581_n.jpg?ccb=11-4&oh=01_Q5AaIAdK142WmLLzzAVeJCb3Wb6Hz8sPtifxTzP0z7GAfE9Q&oe=67903DE3&_nc_sid=5e03e0&_nc_cat=106', 'WHATSAPP-BAILEYS', '5BB1781D-89B5-411A-8CD4-82F0453411A0', 'evolutionv2_exchange', 'Anderson Especialista Gota', '2c448774-e96d-412a-b953-c6be05207bad', '2025-01-12 03:09:17.156', '2025-01-12 03:11:17.768'),
('76dd90b4-1a56-4471-bbec-182d84864f4f', 'Especialista', 'connecting', NULL, NULL, 'WHATSAPP-BAILEYS', '2D1C54D8-F77D-4017-8E20-A40AF4C4619F', 'evolutionv2_exchange', NULL, '2c448774-e96d-412a-b953-c6be05207bad', '2025-01-12 02:42:20.167', '2025-01-12 03:11:17.773');

-- Restaurar WarmupStats
INSERT INTO "WarmupStats" (id, "instanceName", status, "messagesSent", "messagesReceived", "warmupTime", "lastActive", "startTime", "pauseTime", progress, "userId", "createdAt", "updatedAt", "mediaStatsId", "mediaReceivedId") VALUES
('11b4aec9-51f1-4a61-a9f5-c58959e74ee7', '215', 'paused', 0, 0, 0, '2025-01-12 00:41:40.34', NULL, NULL, 0, 'bca32529-ab9e-4358-914c-4dbd903ff8a3', '2025-01-12 00:41:40.34', '2025-01-12 00:41:40.34', NULL, NULL),
('4bb9f76b-13fa-45e7-90a7-0d74113a4e02', 'Lícia', 'paused', 0, 0, 0, '2025-01-12 00:42:00.35', NULL, NULL, 0, 'bca32529-ab9e-4358-914c-4dbd903ff8a3', '2025-01-12 00:42:00.35', '2025-01-12 00:42:00.35', NULL, NULL);

-- Reabilitar verificação de chaves estrangeiras
SET session_replication_role = 'origin';
