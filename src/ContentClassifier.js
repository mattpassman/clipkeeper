/**
 * ContentClassifier - Detects and classifies clipboard content types
 * 
 * Validates Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 * 
 * Type Precedence Logic (Requirement 7.7):
 * When content matches multiple type patterns, the classifier assigns the most
 * specific type. Specificity is determined by how constrained the format is:
 * 
 * - IMAGE: Binary data (most specific - exact format)
 * - URL: Single-line with strict URL format
 * - JSON: Must parse as valid JSON
 * - XML: Must have valid XML structure
 * - FILE_PATH: OS-specific path format
 * - MARKDOWN: Specific formatting patterns (headers, links, etc.)
 * - CODE: Language keywords and syntax patterns
 * - TEXT: Any text (least specific - default fallback)
 * 
 * Implementation: Types are checked in precedence order, returning the first match.
 * This ensures more specific types are identified before more general ones.
 * 
 * Examples:
 * - '{"function": "test"}' → JSON (not CODE, even though it contains code keywords)
 * - 'function test() { // # comment }' → CODE (not MARKDOWN, despite # symbol)
 * - 'https://example.com' → URL (not TEXT)
 * - '/usr/bin/node' → FILE_PATH (not TEXT)
 */

export const ContentType = {
  TEXT: 'text',
  CODE: 'code',
  URL: 'url',
  IMAGE: 'image',
  FILE_PATH: 'file_path',
  JSON: 'json',
  XML: 'xml',
  MARKDOWN: 'markdown'
};

export class ContentClassifier {
  constructor() {
    // URL pattern with TLD validation
    this.urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    
    // File path patterns for different OS
    this.filePathPatterns = {
      windows: /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/,
      unix: /^\/(?:[^/\0]+\/?)*$|^~(?:\/[^/\0]+)*\/?$/
    };
    
    // Markdown patterns
    this.markdownPatterns = [
      /^#{1,6}\s+.+/m,           // Headers
      /\*\*[^*]+\*\*/,            // Bold
      /\*[^*]+\*/,                // Italic
      /\[.+?\]\(.+?\)/,           // Links
      /^[-*+]\s+.+/m,             // Unordered lists
      /^\d+\.\s+.+/m,             // Ordered lists
      /^```[\s\S]*?```$/m,        // Code blocks
      /`[^`]+`/                   // Inline code
    ];
    
    // Code detection keywords by language
    this.languageKeywords = {
      javascript: ['function', 'const', 'let', 'var', 'class', 'import', 'export', 'async', 'await', '=>'],
      typescript: ['interface', 'type', 'enum', 'namespace', 'implements', 'extends'],
      python: ['def', 'class', 'import', 'from', 'lambda', 'yield', 'async', 'await', '__init__'],
      java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'package'],
      csharp: ['namespace', 'using', 'class', 'interface', 'public', 'private', 'protected', 'async'],
      cpp: ['#include', 'namespace', 'class', 'template', 'typename', 'std::'],
      go: ['package', 'import', 'func', 'type', 'struct', 'interface', 'defer', 'go'],
      rust: ['fn', 'let', 'mut', 'impl', 'trait', 'struct', 'enum', 'use', 'mod'],
      ruby: ['def', 'class', 'module', 'require', 'end', 'do', 'yield'],
      php: ['<?php', 'function', 'class', 'namespace', 'use', 'public', 'private', 'protected'],
      swift: ['func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension'],
      kotlin: ['fun', 'val', 'var', 'class', 'interface', 'object', 'companion', 'suspend'],
      sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE'],
      html: ['<!DOCTYPE', '<html', '<head', '<body', '<div', '<span', '<script'],
      css: ['{', '}', ':', ';', 'px', 'em', 'rem', '@media', 'display', 'position']
    };
  }

  /**
   * Classify clipboard content
   * 
   * Implements type precedence logic (Requirement 7.7):
   * When content matches multiple types, assigns the most specific type.
   * 
   * Type Precedence Hierarchy (most specific to least specific):
   * 1. IMAGE - Binary image data (highest specificity)
   * 2. URL - Single-line valid URLs (very specific format)
   * 3. JSON - Valid JSON objects/arrays (strict syntax)
   * 4. XML - Valid XML documents (strict syntax)
   * 5. FILE_PATH - Valid file system paths (OS-specific format)
   * 6. MARKDOWN - Markdown formatted text (specific syntax patterns)
   * 7. CODE - Programming language code (language-specific keywords)
   * 8. TEXT - Plain text (default fallback, least specific)
   * 
   * The precedence is enforced by checking types in order and returning
   * the first match. This ensures that more specific types are identified
   * before more general ones (e.g., JSON before CODE, CODE before TEXT).
   * 
   * @param {string|Buffer|object} content - The clipboard content
   * @returns {ClassificationResult} Classification result with type, language, and confidence
   */
  classify(content) {
    // Handle null/undefined
    if (content === null || content === undefined) {
      return {
        type: ContentType.TEXT,
        confidence: 1.0
      };
    }

    // Handle Buffer (image data) - Highest precedence
    if (Buffer.isBuffer(content)) {
      return {
        type: ContentType.IMAGE,
        confidence: 1.0
      };
    }

    // Handle object with image property
    if (typeof content === 'object' && content !== null && content.image) {
      return {
        type: ContentType.IMAGE,
        confidence: 1.0
      };
    }

    // Convert to string for text-based classification
    const text = typeof content === 'string' ? content : String(content);
    
    // Empty or whitespace-only content defaults to text
    if (!text || text.trim().length === 0) {
      return {
        type: ContentType.TEXT,
        confidence: 1.0
      };
    }

    // Type precedence: Check types in order from most specific to least specific
    // Return immediately on first match to ensure most specific type is assigned
    
    // 1. URL detection - Very specific format (single-line URLs)
    const urlResult = this.detectURL(text);
    if (urlResult.isMatch) {
      return {
        type: ContentType.URL,
        confidence: urlResult.confidence
      };
    }

    // 2. JSON detection - Strict syntax validation
    const jsonResult = this.detectJSON(text);
    if (jsonResult.isMatch) {
      return {
        type: ContentType.JSON,
        confidence: jsonResult.confidence
      };
    }

    // 3. XML detection - Strict syntax validation
    const xmlResult = this.detectXML(text);
    if (xmlResult.isMatch) {
      return {
        type: ContentType.XML,
        confidence: xmlResult.confidence
      };
    }

    // 4. File path detection - OS-specific path formats
    const filePathResult = this.detectFilePath(text);
    if (filePathResult.isMatch) {
      return {
        type: ContentType.FILE_PATH,
        confidence: filePathResult.confidence
      };
    }

    // 5. Markdown detection - Checked before code because markdown can contain code-like syntax
    //    but has specific formatting patterns that make it more specific than generic code
    const markdownResult = this.detectMarkdown(text);
    if (markdownResult.isMatch) {
      return {
        type: ContentType.MARKDOWN,
        confidence: markdownResult.confidence
      };
    }

    // 6. Code detection - Language-specific keywords and syntax patterns
    const codeResult = this.detectCode(text);
    if (codeResult.isMatch) {
      return {
        type: ContentType.CODE,
        language: codeResult.language,
        confidence: codeResult.confidence
      };
    }

    // 7. Default to plain text - Least specific, catches everything else
    return {
      type: ContentType.TEXT,
      confidence: 1.0
    };
  }

  /**
   * Detect if content is a URL
   * @param {string} text - Text to check
   * @returns {object} Detection result
   */
  detectURL(text) {
    const trimmed = text.trim();
    
    // Must be single line
    if (trimmed.includes('\n')) {
      return { isMatch: false, confidence: 0 };
    }

    // Check URL pattern
    if (this.urlPattern.test(trimmed)) {
      return { isMatch: true, confidence: 1.0 };
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Detect if content is JSON
   * @param {string} text - Text to check
   * @returns {object} Detection result
   */
  detectJSON(text) {
    const trimmed = text.trim();
    
    // Must start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { isMatch: false, confidence: 0 };
    }

    try {
      JSON.parse(trimmed);
      return { isMatch: true, confidence: 1.0 };
    } catch (e) {
      return { isMatch: false, confidence: 0 };
    }
  }

  /**
   * Detect if content is XML
   * @param {string} text - Text to check
   * @returns {object} Detection result
   */
  detectXML(text) {
    const trimmed = text.trim();
    
    // Must start with < and contain closing tags
    if (!trimmed.startsWith('<')) {
      return { isMatch: false, confidence: 0 };
    }

    // Check for XML declaration or root element
    const hasXMLDeclaration = /^<\?xml/.test(trimmed);
    const hasRootElement = /<[a-zA-Z][^>]*>[\s\S]*<\/[a-zA-Z][^>]*>/.test(trimmed);
    
    if (hasXMLDeclaration || hasRootElement) {
      return { isMatch: true, confidence: 0.9 };
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Detect if content is a file path
   * @param {string} text - Text to check
   * @returns {object} Detection result
   */
  detectFilePath(text) {
    const trimmed = text.trim();
    
    // Must be single line
    if (trimmed.includes('\n')) {
      return { isMatch: false, confidence: 0 };
    }

    // Check Windows path
    if (this.filePathPatterns.windows.test(trimmed)) {
      return { isMatch: true, confidence: 0.9 };
    }

    // Check Unix path
    if (this.filePathPatterns.unix.test(trimmed)) {
      return { isMatch: true, confidence: 0.9 };
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Detect if content is code and identify language
   * @param {string} text - Text to check
   * @returns {object} Detection result with language
   */
  detectCode(text) {
    const trimmed = text.trim();
    
    // Code heuristics
    const hasCodeCharacters = /[{}\[\]();]/.test(trimmed);
    const hasIndentation = /^[ \t]+/m.test(trimmed);
    const hasOperators = /[=<>!+\-*/%&|^~]/.test(trimmed);
    
    // Count code indicators
    let codeScore = 0;
    if (hasCodeCharacters) codeScore += 0.3;
    if (hasIndentation) codeScore += 0.2;
    if (hasOperators) codeScore += 0.2;

    // Detect language by keywords with weighted scoring
    let languageScores = {};

    for (const [language, keywords] of Object.entries(this.languageKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        // Use word boundaries for better matching, except for special cases
        const isSpecialKeyword = keyword.includes('<') || keyword.includes('::') || keyword.includes('<?');
        const regex = isSpecialKeyword 
          ? new RegExp(this.escapeRegex(keyword), 'i')
          : new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'i');
        
        if (regex.test(trimmed)) {
          // Weight unique keywords higher
          const weight = keyword.length > 5 ? 1.5 : 1.0;
          score += weight;
        }
      }
      
      if (score > 0) {
        languageScores[language] = score;
      }
    }

    // Find language with highest score
    let detectedLanguage = null;
    let maxScore = 0;
    
    for (const [language, score] of Object.entries(languageScores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLanguage = language;
      }
    }

    // If we found language keywords, boost the code score
    if (maxScore > 0) {
      codeScore += Math.min(maxScore * 0.1, 0.5);
    }

    // For longer text (>200 chars), require stronger evidence
    // This helps avoid false positives from prose containing common words like "let", "use", "class"
    const isLongText = trimmed.length > 200;
    const minCodeScore = isLongText ? 0.7 : 0.5;
    const minKeywordScore = isLongText ? 3 : 2;

    // Consider it code if score is high enough
    if (codeScore >= minCodeScore || maxScore >= minKeywordScore) {
      return {
        isMatch: true,
        language: detectedLanguage,
        confidence: Math.min(codeScore, 1.0)
      };
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Detect if content is Markdown
   * @param {string} text - Text to check
   * @returns {object} Detection result
   */
  detectMarkdown(text) {
    const trimmed = text.trim();
    
    let matchCount = 0;
    for (const pattern of this.markdownPatterns) {
      if (pattern.test(trimmed)) {
        matchCount++;
      }
    }

    // Consider it markdown if at least 1 strong pattern matches
    // Strong patterns: headers, links, code blocks, lists with content
    const hasHeader = /^#{1,6}\s+.+/m.test(trimmed);
    const hasLink = /\[.+?\]\(.+?\)/.test(trimmed);
    const hasCodeBlock = /^```[\s\S]*?```$/m.test(trimmed);
    const hasList = /^[-*+]\s+.+/m.test(trimmed) || /^\d+\.\s+.+/m.test(trimmed);
    
    const strongMatches = [hasHeader, hasLink, hasCodeBlock, hasList].filter(Boolean).length;
    
    // If we have strong markdown indicators or multiple weak ones
    if (strongMatches >= 1 || matchCount >= 2) {
      return { isMatch: true, confidence: 0.8 };
    }

    return { isMatch: false, confidence: 0 };
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  /**
     * Escape special regex characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

}

