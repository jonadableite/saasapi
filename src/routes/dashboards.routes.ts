// src/routes/dashboards.routes.ts
import express from "express";
import { getDashboardData } from "../controllers/dashboards.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();

router.get("/", authMiddleware, getDashboardData);

export default router;
