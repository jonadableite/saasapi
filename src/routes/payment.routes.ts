import { Router } from "express";
import {
  createPaymentController,
  updatePaymentController,
} from "../controllers/payment.controller";
import { paymentReminderService } from "../services/payment-reminder.service";

const router = Router();

// Rota para registrar um pagamento
router.post("/payments", createPaymentController);

// Rota para atualizar um pagamento
router.put("/admin/payments/:paymentId", updatePaymentController);

router.post("/test-reminders", async (req, res) => {
  try {
    await paymentReminderService.sendReminders();
    res.json({
      success: true,
      message: "Lembretes de pagamento enviados com sucesso",
    });
  } catch (error) {
    console.error("Erro ao enviar lembretes:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao enviar lembretes",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

export default router;
