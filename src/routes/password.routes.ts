// src/routes/password.routes.ts
import { Router } from "express";
import { passwordResetController } from "../controllers/password.controller";

const router = Router();

// Rota para enviar o código de redefinição de senha
router.post("/forgot", (req, res) =>
  passwordResetController.sendResetCode(req, res),
);

// Rota para verificar o código de redefinição de senha
router.post("/verify", (req, res) =>
  passwordResetController.verifyResetCode(req, res),
);

// Rota para redefinir a senha
router.post("/reset", (req, res) =>
  passwordResetController.resetPassword(req, res),
);

export default router;
