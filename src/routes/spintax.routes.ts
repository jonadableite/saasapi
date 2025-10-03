// src/routes/spintax.routes.ts

import { Router } from 'express';
import { spinTaxController } from '../controllers/spintax.controller';
import { authMiddleware } from '../middlewares/authenticate';

/**
 * Rotas para funcionalidades SpinTax
 */
const router = Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

/**
 * @route POST /api/spintax/process
 * @desc Processa texto SpinTax e retorna variações
 * @access Private
 * @body {string} text - Texto com SpinTax
 * @body {SpinTaxConfig} config - Configurações opcionais
 * @body {number} count - Número de variações (1-100)
 */
router.post('/process', spinTaxController.processSpinTax.bind(spinTaxController));

/**
 * @route POST /api/spintax/validate
 * @desc Valida sintaxe SpinTax
 * @access Private
 * @body {string} text - Texto com SpinTax
 * @body {SpinTaxConfig} config - Configurações opcionais
 */
router.post('/validate', spinTaxController.validateSpinTax.bind(spinTaxController));

/**
 * @route POST /api/spintax/preview
 * @desc Gera preview de variações SpinTax
 * @access Private
 * @body {string} text - Texto com SpinTax
 * @body {number} count - Número de exemplos (1-20)
 * @body {SpinTaxConfig} config - Configurações opcionais
 */
router.post('/preview', spinTaxController.previewSpinTax.bind(spinTaxController));

/**
 * @route POST /api/spintax/stats
 * @desc Obtém estatísticas de um texto SpinTax
 * @access Private
 * @body {string} text - Texto com SpinTax
 * @body {SpinTaxConfig} config - Configurações opcionais
 */
router.post('/stats', spinTaxController.getSpinTaxStats.bind(spinTaxController));

export { router as spinTaxRoutes };