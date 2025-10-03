// src/services/spintax.service.ts

import {
  SpinTaxVariation,
  SpinTaxGroup,
  SpinTaxProcessResult,
  SpinTaxConfig,
  SpinTaxValidationResult,
  SpinTaxValidationError,
  SpinTaxValidationWarning,
  SpinTaxStats,
  SpinTaxErrorType,
  SpinTaxWarningType
} from '../types/spintax.types';

/**
 * Serviço para processamento e validação de SpinTax
 * Implementa padrão SOLID com responsabilidade única
 */
export class SpinTaxService {
  private readonly defaultConfig: Required<SpinTaxConfig> = {
    useWeights: true,
    seed: undefined,
    maxGroups: 50,
    maxVariationsPerGroup: 20
  };

  /**
   * Processa texto SpinTax e retorna uma variação aleatória
   */
  public process(text: string, config?: SpinTaxConfig): SpinTaxProcessResult {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Se há seed, usar para randomização determinística
    if (finalConfig.seed !== undefined) {
      this.setSeed(finalConfig.seed);
    }

    const groups = this.parseSpinTaxGroups(text, finalConfig);
    const processedText = this.generateVariation(text, groups, finalConfig);
    const totalCombinations = this.calculateTotalCombinations(groups);

    return {
      processedText,
      groups,
      hasSpinTax: groups.length > 0,
      totalCombinations
    };
  }

  /**
   * Gera múltiplas variações do texto SpinTax
   */
  public processMultiple(text: string, count: number, config?: SpinTaxConfig): string[] {
    const results: string[] = [];
    const finalConfig = { ...this.defaultConfig, ...config };

    for (let i = 0; i < count; i++) {
      const result = this.process(text, finalConfig);
      results.push(result.processedText);
    }

    return results;
  }

  /**
   * Valida sintaxe SpinTax
   */
  public validate(text: string, config?: SpinTaxConfig): SpinTaxValidationResult {
    const finalConfig = { ...this.defaultConfig, ...config };
    const errors: SpinTaxValidationError[] = [];
    const warnings: SpinTaxValidationWarning[] = [];

    try {
      // Verificar balanceamento de chaves
      this.validateBracketBalance(text, errors);
      
      // Verificar grupos aninhados
      this.validateNestedGroups(text, errors);
      
      // Parse grupos para validações adicionais
      const groups = this.parseSpinTaxGroups(text, finalConfig);
      
      // Validar cada grupo
      groups.forEach((group, index) => {
        this.validateGroup(group, index, errors, warnings, finalConfig);
      });

      // Validar limites globais
      this.validateGlobalLimits(groups, errors, finalConfig);

      const stats = this.calculateStats(groups);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        stats
      };
    } catch (error) {
      errors.push({
        type: SpinTaxErrorType.MALFORMED_SYNTAX,
        message: `Erro inesperado na validação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });

      return {
        isValid: false,
        errors,
        warnings,
        stats: this.getEmptyStats()
      };
    }
  }

  /**
   * Gera exemplos de variações para preview
   */
  public generateExamples(text: string, count: number = 5, config?: SpinTaxConfig): string[] {
    const examples = new Set<string>();
    const maxAttempts = count * 3; // Evitar loop infinito
    let attempts = 0;

    while (examples.size < count && attempts < maxAttempts) {
      const result = this.process(text, config);
      examples.add(result.processedText);
      attempts++;
    }

    return Array.from(examples);
  }

  /**
   * Parse grupos SpinTax do texto
   */
  private parseSpinTaxGroups(text: string, config: Required<SpinTaxConfig>): SpinTaxGroup[] {
    const groups: SpinTaxGroup[] = [];
    const regex = /\{([^{}]+)\}/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (groups.length >= config.maxGroups) {
        break;
      }

      const groupContent = match[1];
      const variations = this.parseVariations(groupContent, config);
      
      if (variations.length > 0) {
        groups.push({
          variations,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    }

    return groups;
  }

  /**
   * Parse variações dentro de um grupo
   */
  private parseVariations(content: string, config: Required<SpinTaxConfig>): SpinTaxVariation[] {
    const variations: SpinTaxVariation[] = [];
    const parts = content.split('|');

    for (const part of parts) {
      if (variations.length >= config.maxVariationsPerGroup) {
        break;
      }

      const trimmed = part.trim();
      if (trimmed) {
        // Verificar se há peso especificado (formato: "texto:peso")
        const weightMatch = trimmed.match(/^(.+):(\d+(?:\.\d+)?)$/);
        
        if (weightMatch && config.useWeights) {
          const text = weightMatch[1].trim();
          const weight = parseFloat(weightMatch[2]);
          
          if (text && weight > 0) {
            variations.push({ text, weight });
          }
        } else {
          variations.push({ text: trimmed, weight: 1 });
        }
      }
    }

    return variations;
  }

  /**
   * Gera uma variação do texto processando os grupos
   */
  private generateVariation(text: string, groups: SpinTaxGroup[], config: Required<SpinTaxConfig>): string {
    let result = text;

    // Processar grupos em ordem reversa para manter índices corretos
    const sortedGroups = [...groups].sort((a, b) => b.startIndex - a.startIndex);

    for (const group of sortedGroups) {
      const selectedVariation = this.selectVariation(group.variations, config);
      
      // Usar os índices originais do grupo no texto atual
      result = result.substring(0, group.startIndex) + selectedVariation.text + result.substring(group.endIndex);
    }

    return result;
  }

  /**
   * Seleciona uma variação baseada nos pesos
   */
  private selectVariation(variations: SpinTaxVariation[], config: Required<SpinTaxConfig>): SpinTaxVariation {
    if (variations.length === 0) {
      return { text: '', weight: 1 };
    }

    if (variations.length === 1 || !config.useWeights) {
      return variations[Math.floor(Math.random() * variations.length)];
    }

    // Seleção baseada em peso
    const totalWeight = variations.reduce((sum, v) => sum + (v.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const variation of variations) {
      random -= variation.weight || 1;
      if (random <= 0) {
        return variation;
      }
    }

    return variations[variations.length - 1];
  }

  /**
   * Calcula total de combinações possíveis
   */
  private calculateTotalCombinations(groups: SpinTaxGroup[]): number {
    if (groups.length === 0) return 1;
    
    return groups.reduce((total, group) => {
      return total * Math.max(1, group.variations.length);
    }, 1);
  }

  /**
   * Valida balanceamento de chaves
   */
  private validateBracketBalance(text: string, errors: SpinTaxValidationError[]): void {
    let openCount = 0;
    let lastOpenIndex = -1;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '{') {
        openCount++;
        lastOpenIndex = i;
      } else if (char === '}') {
        if (openCount === 0) {
          errors.push({
            type: SpinTaxErrorType.UNOPENED_BRACKET,
            message: 'Chave de fechamento "}" sem chave de abertura correspondente',
            position: i,
            context: this.getContext(text, i)
          });
        } else {
          openCount--;
        }
      }
    }

    if (openCount > 0) {
      errors.push({
        type: SpinTaxErrorType.UNCLOSED_BRACKET,
        message: `${openCount} chave(s) de abertura "{" sem fechamento`,
        position: lastOpenIndex,
        context: this.getContext(text, lastOpenIndex)
      });
    }
  }

  /**
   * Valida grupos aninhados
   */
  private validateNestedGroups(text: string, errors: SpinTaxValidationError[]): void {
    let depth = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '{') {
        depth++;
        if (depth > 1) {
          errors.push({
            type: SpinTaxErrorType.NESTED_GROUPS,
            message: 'Grupos SpinTax aninhados não são suportados',
            position: i,
            context: this.getContext(text, i)
          });
          return;
        }
      } else if (char === '}') {
        depth--;
      }
    }
  }

  /**
   * Valida um grupo específico
   */
  private validateGroup(
    group: SpinTaxGroup, 
    index: number, 
    errors: SpinTaxValidationError[], 
    warnings: SpinTaxValidationWarning[],
    config: Required<SpinTaxConfig>
  ): void {
    // Verificar grupo vazio
    if (group.variations.length === 0) {
      errors.push({
        type: SpinTaxErrorType.EMPTY_GROUP,
        message: 'Grupo SpinTax vazio encontrado',
        position: group.startIndex
      });
      return;
    }

    // Verificar variações vazias
    group.variations.forEach((variation, vIndex) => {
      if (!variation.text.trim()) {
        errors.push({
          type: SpinTaxErrorType.EMPTY_VARIATION,
          message: `Variação vazia no grupo ${index + 1}`,
          position: group.startIndex
        });
      }

      // Verificar peso inválido
      if (variation.weight !== undefined && (variation.weight <= 0 || !isFinite(variation.weight))) {
        errors.push({
          type: SpinTaxErrorType.INVALID_WEIGHT,
          message: `Peso inválido "${variation.weight}" na variação ${vIndex + 1} do grupo ${index + 1}`,
          position: group.startIndex
        });
      }
    });

    // Avisos
    if (group.variations.length === 1) {
      warnings.push({
        type: SpinTaxWarningType.SINGLE_VARIATION,
        message: `Grupo ${index + 1} tem apenas uma variação`,
        position: group.startIndex
      });
    }

    // Verificar duplicatas
    const texts = group.variations.map(v => v.text.toLowerCase());
    const duplicates = texts.filter((text, i) => texts.indexOf(text) !== i);
    if (duplicates.length > 0) {
      warnings.push({
        type: SpinTaxWarningType.DUPLICATE_VARIATION,
        message: `Grupo ${index + 1} contém variações duplicadas`,
        position: group.startIndex
      });
    }

    // Verificar variações muito longas
    group.variations.forEach((variation, vIndex) => {
      if (variation.text.length > 200) {
        warnings.push({
          type: SpinTaxWarningType.VERY_LONG_VARIATION,
          message: `Variação ${vIndex + 1} no grupo ${index + 1} é muito longa (${variation.text.length} caracteres)`,
          position: group.startIndex
        });
      }
    });

    // Verificar muitas variações
    if (group.variations.length > 10) {
      warnings.push({
        type: SpinTaxWarningType.MANY_VARIATIONS,
        message: `Grupo ${index + 1} tem muitas variações (${group.variations.length})`,
        position: group.startIndex
      });
    }
  }

  /**
   * Valida limites globais
   */
  private validateGlobalLimits(groups: SpinTaxGroup[], errors: SpinTaxValidationError[], config: Required<SpinTaxConfig>): void {
    if (groups.length > config.maxGroups) {
      errors.push({
        type: SpinTaxErrorType.TOO_MANY_GROUPS,
        message: `Muitos grupos SpinTax (${groups.length}). Máximo permitido: ${config.maxGroups}`
      });
    }

    groups.forEach((group, index) => {
      if (group.variations.length > config.maxVariationsPerGroup) {
        errors.push({
          type: SpinTaxErrorType.TOO_MANY_VARIATIONS,
          message: `Muitas variações no grupo ${index + 1} (${group.variations.length}). Máximo permitido: ${config.maxVariationsPerGroup}`,
          position: group.startIndex
        });
      }
    });
  }

  /**
   * Calcula estatísticas do SpinTax
   */
  private calculateStats(groups: SpinTaxGroup[]): SpinTaxStats {
    if (groups.length === 0) {
      return this.getEmptyStats();
    }

    const totalVariations = groups.reduce((sum, group) => sum + group.variations.length, 0);
    const totalCombinations = this.calculateTotalCombinations(groups);
    
    const allVariations = groups.flatMap(group => group.variations);
    const averageVariationLength = allVariations.reduce((sum, v) => sum + v.text.length, 0) / allVariations.length;
    
    const variationCounts = groups.map(group => group.variations.length);
    const maxVariationsInGroup = Math.max(...variationCounts);
    const minVariationsInGroup = Math.min(...variationCounts);

    return {
      totalGroups: groups.length,
      totalVariations,
      totalCombinations,
      averageVariationLength: Math.round(averageVariationLength * 100) / 100,
      maxVariationsInGroup,
      minVariationsInGroup
    };
  }

  /**
   * Retorna estatísticas vazias
   */
  private getEmptyStats(): SpinTaxStats {
    return {
      totalGroups: 0,
      totalVariations: 0,
      totalCombinations: 1,
      averageVariationLength: 0,
      maxVariationsInGroup: 0,
      minVariationsInGroup: 0
    };
  }

  /**
   * Obtém contexto ao redor de uma posição
   */
  private getContext(text: string, position: number, radius: number = 20): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    const context = text.substring(start, end);
    
    return start > 0 ? '...' + context : context + (end < text.length ? '...' : '');
  }

  /**
   * Define seed para randomização (para testes)
   */
  private setSeed(seed: number): void {
    // Implementação simples de PRNG com seed
    let currentSeed = seed;
    Math.random = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }
}

// Instância singleton do serviço
export const spinTaxService = new SpinTaxService();