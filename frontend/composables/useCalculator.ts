/**
 * Composable for calculator functionality
 * Provides safe expression parsing and evaluation for arithmetic operations
 */

import { computed, ref } from 'vue'

export interface SummaryRow {
  name: string
  maxLD: number
  maxLDAlpha: number
  clMax: number
  clMaxAlpha: number
  clAtZero: number
  minCD: number
  cmAtZero: number
  ldAtZero: number
  ldAtDesignAlpha?: number
  smoothness_CM?: number
  avg_confidence?: number
  thickness?: number
  thickness_location?: number
  camber?: number
  camber_location?: number
}

/**
 * Available variables with their display labels
 */
export const AVAILABLE_VARIABLES = [
  { value: 'maxLD', label: 'Max L/D' },
  { value: 'maxLDAlpha', label: 'α @ Max L/D' },
  { value: 'clMax', label: 'CL Max' },
  { value: 'clMaxAlpha', label: 'α @ CL Max' },
  { value: 'clAtZero', label: 'CL @ α=0°' },
  { value: 'minCD', label: 'Min CD' },
  { value: 'cmAtZero', label: 'CM @ α=0°' },
  { value: 'ldAtZero', label: 'L/D @ α=0°' },
  { value: 'ldAtDesignAlpha', label: 'L/D @ design α' },
  { value: 'smoothness_CM', label: 'Smoothness CM' },
  { value: 'avg_confidence', label: 'NN Confidence' },
  { value: 'thickness', label: 't/c (%)' },
  { value: 'thickness_location', label: 't/c Loc (%)' },
  { value: 'camber', label: 'Camber (%)' },
  { value: 'camber_location', label: 'Camber Loc (%)' },
] as const

export type VariableName = typeof AVAILABLE_VARIABLES[number]['value']

/**
 * Token types for the parser
 */
type TokenType = 'NUMBER' | 'VARIABLE' | 'OPERATOR' | 'PAREN_OPEN' | 'PAREN_CLOSE' | 'EOF'

interface Token {
  type: TokenType
  value: string | number
  position: number
}

/**
 * Parse error class
 */
export class ParseError extends Error {
  constructor(message: string, public position: number) {
    super(message)
    this.name = 'ParseError'
  }
}

/**
 * Simple recursive descent parser for arithmetic expressions
 */
class ExpressionParser {
  private tokens: Token[] = []
  private current = 0

  /**
   * Tokenize the input string
   */
  private tokenize(input: string): Token[] {
    const tokens: Token[] = []
    let i = 0

    while (i < input.length) {
      const char = input[i]

      // Skip whitespace
      if (/\s/.test(char)) {
        i++
        continue
      }

      // Parentheses
      if (char === '(') {
        tokens.push({ type: 'PAREN_OPEN', value: char, position: i })
        i++
        continue
      }
      if (char === ')') {
        tokens.push({ type: 'PAREN_CLOSE', value: char, position: i })
        i++
        continue
      }

      // Operators
      if (['+', '-', '*', '/'].includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char, position: i })
        i++
        continue
      }

      // Numbers (including decimals)
      if (/\d/.test(char) || char === '.') {
        let numStr = ''
        while (i < input.length && (/\d/.test(input[i]) || input[i] === '.')) {
          numStr += input[i]
          i++
        }
        const num = parseFloat(numStr)
        if (isNaN(num)) {
          throw new ParseError(`Invalid number: ${numStr}`, i - numStr.length)
        }
        tokens.push({ type: 'NUMBER', value: num, position: i - numStr.length })
        continue
      }

      // Variables (alphanumeric + underscore)
      if (/[a-zA-Z_]/.test(char)) {
        let varStr = ''
        while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
          varStr += input[i]
          i++
        }
        tokens.push({ type: 'VARIABLE', value: varStr, position: i - varStr.length })
        continue
      }

      // Unknown character
      throw new ParseError(`Unexpected character: ${char}`, i)
    }

    tokens.push({ type: 'EOF', value: '', position: i })
    return tokens
  }

  /**
   * Get current token
   */
  private peek(): Token {
    return this.tokens[this.current] || this.tokens[this.tokens.length - 1]
  }

  /**
   * Advance to next token
   */
  private advance(): Token {
    if (this.current < this.tokens.length) {
      this.current++
    }
    return this.peek()
  }

  /**
   * Check if current token matches type
   */
  private match(type: TokenType, value?: string | number): boolean {
    const token = this.peek()
    if (token.type !== type) return false
    if (value !== undefined && token.value !== value) return false
    return true
  }

  /**
   * Parse expression: handles addition and subtraction
   */
  private parseExpression(): number {
    let left = this.parseTerm()

    while (this.match('OPERATOR', '+') || this.match('OPERATOR', '-')) {
      const op = this.peek().value as string
      this.advance()
      const right = this.parseTerm()

      if (op === '+') {
        left = left + right
      } else {
        left = left - right
      }
    }

    return left
  }

  /**
   * Parse term: handles multiplication and division
   */
  private parseTerm(): number {
    let left = this.parseFactor()

    while (this.match('OPERATOR', '*') || this.match('OPERATOR', '/')) {
      const op = this.peek().value as string
      this.advance()
      const right = this.parseFactor()

      if (op === '*') {
        left = left * right
      } else {
        if (right === 0) {
          throw new ParseError('Division by zero', this.peek().position)
        }
        left = left / right
      }
    }

    return left
  }

  /**
   * Parse factor: handles numbers, variables, and parentheses
   */
  private parseFactor(): number {
    const token = this.peek()

    if (token.type === 'NUMBER') {
      this.advance()
      return token.value as number
    }

    if (token.type === 'VARIABLE') {
      this.advance()
      const varName = token.value as string
      // Variable value will be substituted later
      throw new ParseError(`Variable substitution needed: ${varName}`, token.position)
    }

    if (token.type === 'PAREN_OPEN') {
      this.advance()
      const result = this.parseExpression()
      if (!this.match('PAREN_CLOSE')) {
        throw new ParseError('Expected closing parenthesis', this.peek().position)
      }
      this.advance()
      return result
    }

    if (token.type === 'OPERATOR' && token.value === '-') {
      // Unary minus
      this.advance()
      return -this.parseFactor()
    }

    throw new ParseError(`Unexpected token: ${token.type}`, token.position)
  }

  /**
   * Parse the expression string
   */
  parse(input: string): { variables: string[]; ast: any } {
    this.tokens = this.tokenize(input)
    this.current = 0

    // Extract variables first
    const variables = new Set<string>()
    this.tokens.forEach(token => {
      if (token.type === 'VARIABLE') {
        const varName = token.value as string
        // Validate variable name
        const isValid = AVAILABLE_VARIABLES.some(v => v.value === varName)
        if (!isValid) {
          throw new ParseError(`Unknown variable: ${varName}`, token.position)
        }
        variables.add(varName)
      }
    })

    // Parse to validate syntax (but we'll re-parse with values later)
    try {
      this.current = 0
      this.parseExpression()
      
      if (!this.match('EOF')) {
        throw new ParseError('Unexpected tokens after expression', this.peek().position)
      }
    } catch (error) {
      if (error instanceof ParseError && error.message.includes('Variable substitution needed')) {
        // This is expected during syntax validation
      } else {
        throw error
      }
    }

    return {
      variables: Array.from(variables),
      ast: null, // We'll evaluate directly
    }
  }

  /**
   * Evaluate expression with variable values
   */
  evaluate(input: string, variables: Record<string, number>): number {
    // Replace variables with their values
    let substituted = input
    Object.keys(variables).forEach(varName => {
      const value = variables[varName]
      if (value === undefined || value === null || !isFinite(value)) {
        throw new ParseError(`Invalid value for variable: ${varName}`, 0)
      }
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${varName}\\b`, 'g')
      substituted = substituted.replace(regex, value.toString())
    })

    // Re-tokenize and evaluate
    this.tokens = this.tokenize(substituted)
    this.current = 0

    const result = this.parseExpression()
    
    if (!this.match('EOF')) {
      throw new ParseError('Unexpected tokens after expression', this.peek().position)
    }

    if (!isFinite(result)) {
      throw new ParseError('Result is not a finite number', 0)
    }

    return result
  }
}

/**
 * Use calculator composable
 */
export const useCalculator = () => {
  const formula = ref<string>('')
  const error = ref<string | null>(null)
  const parser = new ExpressionParser()

  /**
   * Get available variables
   */
  const getAvailableVariables = () => {
    return AVAILABLE_VARIABLES
  }

  /**
   * Calculate results for all airfoils
   */
  const calculateResults = (summaryData: SummaryRow[]) => {
    if (!formula.value.trim()) {
      return []
    }

    error.value = null

    try {
      // Parse to validate syntax and get variables
      const { variables } = parser.parse(formula.value)

      // Calculate for each airfoil
      const results = summaryData.map(row => {
        try {
          // Build variable values object
          const varValues: Record<string, number> = {}
          variables.forEach(varName => {
            const value = (row as any)[varName]
            if (value === undefined || value === null || !isFinite(value)) {
              throw new ParseError(`Missing or invalid value for variable: ${varName}`, 0)
            }
            varValues[varName] = value
          })

          // Evaluate expression
          const result = parser.evaluate(formula.value, varValues)
          return {
            name: row.name,
            value: result,
            error: null,
          }
        } catch (err) {
          return {
            name: row.name,
            value: NaN,
            error: err instanceof ParseError ? err.message : 'Calculation error',
          }
        }
      })

      return results
    } catch (err) {
      error.value = err instanceof ParseError 
        ? `Parse error at position ${err.position}: ${err.message}`
        : err instanceof Error 
        ? err.message 
        : 'Unknown error'
      return []
    }
  }

  /**
   * Get autocomplete suggestions based on current input
   */
  const getAutocompleteSuggestions = (input: string, cursorPosition: number): Array<{ value: string; label: string }> => {
    if (!input || cursorPosition < 0) {
      return []
    }

    // Find the word at cursor position
    const beforeCursor = input.substring(0, cursorPosition)
    const match = beforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/)
    
    if (!match) {
      return AVAILABLE_VARIABLES
    }

    const partial = match[1].toLowerCase()
    return AVAILABLE_VARIABLES.filter(v => 
      v.value.toLowerCase().includes(partial) || 
      v.label.toLowerCase().includes(partial)
    )
  }

  return {
    formula,
    error,
    getAvailableVariables,
    calculateResults,
    getAutocompleteSuggestions,
  }
}


