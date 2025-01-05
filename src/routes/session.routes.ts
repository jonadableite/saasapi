// src/routes/session.routes.ts
import express from "express";
import { login } from "../controllers/login.controller";
import { getSessionStatus, store } from "../controllers/session.controller";

const router = express.Router();

// Rota para login
router.post("/", login); // Usando a função de login

// Rota para armazenar a sessão
router.post("/store", store);

// Rota para obter o status da sessão
router.get("/session-status", getSessionStatus);

export default router;
