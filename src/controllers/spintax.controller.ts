// src/controllers/spintax.controller.ts

import { Request, Response } from 'express';
import { spinTaxService } from '../services/spintax.service';
import {
  ProcessSpinTaxRequest,
  ProcessSpinTaxResponse,
  ValidateSpinTaxRequest,
  ValidateSpinTaxResponse,
  PreviewSpinTaxRequest,
  PreviewSpinTaxResponse
} from '../types/spintax.types';

/**
 * Controller para endpoints SpinTax
 * Implementa padrão SOLID com responsabilidade única
 */
export class SpinTaxController {
  /**
   * Processa texto SpinTax e retorna variações
   * POST /api/spintax/process
   */
  public async processSpinTax(req: Request, res: Response): Promise<void> {
    try {
      const { text, config, count = 1 }: ProcessSpinTaxRequest = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          error: 'Texto é obrigatório e deve ser uma string',
          code: 'INVALID_TEXT'
        });
        return;
      }

      if (count < 1 || count > 100) {
        res.status(400).json({
          error: 'Count deve estar entre 1 e 100',
          code: 'INVALID_COUNT'
        });
        return;
      }

      const results = spinTaxService.processMultiple(text, count, config);
      const processResult = spinTaxService.process(text, config);

      const response: ProcessSpinTaxResponse = {
        results,
        stats: spinTaxService.validate(text, config).stats,
        hasSpinTax: processResult.hasSpinTax
      };

      res.json(response);
    } catch (error) {
      console.error('Erro ao processar SpinTax:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Valida sintaxe SpinTax
   * POST /api/spintax/validate
   */
  public async validateSpinTax(req: Request, res: Response): Promise<void> {
    try {
      const { text, config }: ValidateSpinTaxRequest = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          error: 'Texto é obrigatório e deve ser uma string',
          code: 'INVALID_TEXT'
        });
        return;
      }

      const validationResult = spinTaxService.validate(text, config);

      const response: ValidateSpinTaxResponse = {
        ...validationResult,
        originalText: text
      };

      res.json(response);
    } catch (error) {
      console.error('Erro ao validar SpinTax:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Gera preview de variações SpinTax
   * POST /api/spintax/preview
   */
  public async previewSpinTax(req: Request, res: Response): Promise<void> {
    try {
      const { text, count = 5, config }: PreviewSpinTaxRequest = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          error: 'Texto é obrigatório e deve ser uma string',
          code: 'INVALID_TEXT'
        });
        return;
      }

      if (count < 1 || count > 20) {
        res.status(400).json({
          error: 'Count deve estar entre 1 e 20',
          code: 'INVALID_COUNT'
        });
        return;
      }

      const examples = spinTaxService.generateExamples(text, count, config);
      const validation = spinTaxService.validate(text, config);

      const response: PreviewSpinTaxResponse = {
        examples,
        validation,
        stats: validation.stats
      };

      res.json(response);
    } catch (error) {
      console.error('Erro ao gerar preview SpinTax:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Obtém estatísticas de um texto SpinTax
   * POST /api/spintax/stats
   */
  public async getSpinTaxStats(req: Request, res: Response): Promise<void> {
    try {
      const { text, config } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          error: 'Texto é obrigatório e deve ser uma string',
          code: 'INVALID_TEXT'
        });
        return;
      }

      const validation = spinTaxService.validate(text, config);
      const processResult = spinTaxService.process(text, config);

      res.json({
        stats: validation.stats,
        hasSpinTax: processResult.hasSpinTax,
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      });
    } catch (error) {
      console.error('Erro ao obter estatísticas SpinTax:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

// Instância singleton do controller
export const spinTaxController = new SpinTaxController();