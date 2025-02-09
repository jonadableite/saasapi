// src/jobs/payment-reminder.job.ts
import cron from "node-cron";
import { paymentReminderService } from "../services/payment-reminder.service";

export function schedulePaymentReminders() {
  // Executa todos os dias às 10:00
  cron.schedule("0 10 * * *", async () => {
    console.log("Executando job de lembretes de pagamento");
    try {
      await paymentReminderService.sendReminders();
      console.log("Lembretes de pagamento enviados com sucesso");
    } catch (error) {
      console.error("Erro ao enviar lembretes de pagamento:", error);
    }
  });
}
