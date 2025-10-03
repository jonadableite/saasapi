// src/types/spintax.types.ts

/**
 * Representa uma variação dentro de um grupo SpinTax
 */
export interface SpinTaxVariation {
  /** Texto da variação */
  text: string;
  /** Peso da variação (opcional, padrão 1) */
  weight?: number;
}

/**
 * Representa um grupo de variações SpinTax
 */
export interface SpinTaxGroup {
  /** Lista de variações possíveis */
  variations: SpinTaxVariation[];
  /** Posição inicial no texto original */
  startIndex: number;
  /** Posição final no texto original */
  endIndex: number;
}

/**
 * Resultado do processamento SpinTax
 */
export interface SpinTaxProcessResult {
  /** Texto processado com uma variação selecionada */
  processedText: string;
  /** Grupos identificados no texto original */
  groups: SpinTaxGroup[];
  /** Indica se o texto contém SpinTax válido */
  hasSpinTax: boolean;
  /** Número total de combinações possíveis */
  totalCombinations: number;
}

/**
 * Configurações para processamento SpinTax
 */
export interface SpinTaxConfig {
  /** Usar pesos nas variações (padrão: true) */
  useWeights?: boolean;
  /** Seed para randomização (para testes) */
  seed?: number;
  /** Máximo de grupos permitidos (padrão: 50) */
  maxGroups?: number;
  /** Máximo de variações por grupo (padrão: 20) */
  maxVariationsPerGroup?: number;
}

/**
 * Resultado da validação SpinTax
 */
export interface SpinTaxValidationResult {
  /** Indica se o SpinTax é válido */
  isValid: boolean;
  /** Lista de erros encontrados */
  errors: SpinTaxValidationError[];
  /** Avisos não críticos */
  warnings: SpinTaxValidationWarning[];
  /** Estatísticas do SpinTax */
  stats: SpinTaxStats;
}

/**
 * Erro de validação SpinTax
 */
export interface SpinTaxValidationError {
  /** Tipo do erro */
  type: SpinTaxErrorType;
  /** Mensagem do erro */
  message: string;
  /** Posição do erro no texto */
  position?: number;
  /** Contexto adicional */
  context?: string;
}

/**
 * Aviso de validação SpinTax
 */
export interface SpinTaxValidationWarning {
  /** Tipo do aviso */
  type: SpinTaxWarningType;
  /** Mensagem do aviso */
  message: string;
  /** Posição do aviso no texto */
  position?: number;
}

/**
 * Estatísticas do SpinTax
 */
export interface SpinTaxStats {
  /** Número total de grupos */
  totalGroups: number;
  /** Número total de variações */
  totalVariations: number;
  /** Número total de combinações possíveis */
  totalCombinations: number;
  /** Comprimento médio das variações */
  averageVariationLength: number;
  /** Grupo com mais variações */
  maxVariationsInGroup: number;
  /** Grupo com menos variações */
  minVariationsInGroup: number;
}

/**
 * Tipos de erro SpinTax
 */
export enum SpinTaxErrorType {
  UNCLOSED_BRACKET = 'UNCLOSED_BRACKET',
  UNOPENED_BRACKET = 'UNOPENED_BRACKET',
  EMPTY_GROUP = 'EMPTY_GROUP',
  EMPTY_VARIATION = 'EMPTY_VARIATION',
  NESTED_GROUPS = 'NESTED_GROUPS',
  INVALID_WEIGHT = 'INVALID_WEIGHT',
  TOO_MANY_GROUPS = 'TOO_MANY_GROUPS',
  TOO_MANY_VARIATIONS = 'TOO_MANY_VARIATIONS',
  MALFORMED_SYNTAX = 'MALFORMED_SYNTAX'
}

/**
 * Tipos de aviso SpinTax
 */
export enum SpinTaxWarningType {
  SINGLE_VARIATION = 'SINGLE_VARIATION',
  DUPLICATE_VARIATION = 'DUPLICATE_VARIATION',
  UNBALANCED_WEIGHTS = 'UNBALANCED_WEIGHTS',
  VERY_LONG_VARIATION = 'VERY_LONG_VARIATION',
  MANY_VARIATIONS = 'MANY_VARIATIONS'
}

/**
 * Payload para processamento SpinTax via API
 */
export interface ProcessSpinTaxRequest {
  /** Texto com SpinTax para processar */
  text: string;
  /** Configurações opcionais */
  config?: SpinTaxConfig;
  /** Número de variações a gerar (padrão: 1) */
  count?: number;
}

/**
 * Resposta do processamento SpinTax via API
 */
export interface ProcessSpinTaxResponse {
  /** Lista de textos processados */
  results: string[];
  /** Estatísticas do processamento */
  stats: SpinTaxStats;
  /** Indica se o texto original continha SpinTax */
  hasSpinTax: boolean;
}

/**
 * Payload para validação SpinTax via API
 */
export interface ValidateSpinTaxRequest {
  /** Texto com SpinTax para validar */
  text: string;
  /** Configurações opcionais */
  config?: SpinTaxConfig;
}

/**
 * Resposta da validação SpinTax via API
 */
export interface ValidateSpinTaxResponse extends SpinTaxValidationResult {
  /** Texto original */
  originalText: string;
}

/**
 * Payload para preview SpinTax via API
 */
export interface PreviewSpinTaxRequest {
  /** Texto com SpinTax para preview */
  text: string;
  /** Número de exemplos a gerar (padrão: 5) */
  count?: number;
  /** Configurações opcionais */
  config?: SpinTaxConfig;
}

/**
 * Resposta do preview SpinTax via API
 */
export interface PreviewSpinTaxResponse {
  /** Lista de exemplos gerados */
  examples: string[];
  /** Resultado da validação */
  validation: SpinTaxValidationResult;
  /** Estatísticas */
  stats: SpinTaxStats;
}