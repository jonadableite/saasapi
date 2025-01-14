// src/routes/company.routes.ts
import express from "express";
import { CompanyController } from "../controllers/company.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const companyController = new CompanyController();

router.use(authMiddleware);

router.get("/", (req, res) => companyController.listCompanies(req, res));
router.get("/:id", (req, res) => companyController.getCompany(req, res));

export { router as companyRoutes };
