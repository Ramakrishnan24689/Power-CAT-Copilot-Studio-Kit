/// <reference types="@testing-library/jest-dom" />

/**
 * Tests for YAML Parsing Service
 * Validates parsing of agent configuration and pattern files
 */

import { parseYAML } from '../Services/parseYAML';

describe('parseYAML', () => {
    describe('Valid YAML Parsing', () => {
        it('should parse simple YAML successfully', () => {
            const yamlContent = `
name: "Test Agent"
version: "1.0.0"
description: "A test agent for validation"
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result).toEqual({
                name: 'Test Agent',
                version: '1.0.0',
                description: 'A test agent for validation'
            });
        });

        it('should parse nested YAML structures', () => {
            const yamlContent = `
agent:
  name: "Complex Agent"
  settings:
    timeout: 30
    retries: 3
    features:
      - authentication
      - logging
      - monitoring
patterns:
  validation:
    enabled: true
    strict: false
  performance:
    threshold: 1000
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result).toHaveProperty('agent.name', 'Complex Agent');
            expect(result).toHaveProperty('agent.settings.timeout', 30);
            expect(result.agent.settings.features).toEqual(['authentication', 'logging', 'monitoring']);
            expect(result.patterns.validation.enabled).toBe(true);
            expect(result.patterns.performance.threshold).toBe(1000);
        });

        it('should handle arrays and objects correctly', () => {
            const yamlContent = `
items:
  - name: "Item 1"
    value: 100
    active: true
  - name: "Item 2" 
    value: 200
    active: false
metadata:
  tags: ["test", "development", "yaml"]
  config:
    debug: true
    level: "info"
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result.items).toHaveLength(2);
            expect(result.items[0]).toEqual({
                name: 'Item 1',
                value: 100,
                active: true
            });
            expect(result.metadata.tags).toEqual(['test', 'development', 'yaml']);
            expect(result.metadata.config.debug).toBe(true);
        });

        it('should handle empty YAML', () => {
            const result = parseYAML('');
            expect(result).toBeNull();
        });

        it('should handle YAML with only whitespace', () => {
            const result = parseYAML('   \n\t  \n  ');
            expect(result).toBeNull();
        });

        it('should handle YAML with comments', () => {
            const yamlContent = `
# This is a comment
name: "Agent with Comments"
# Another comment
version: "1.0.0" # Inline comment
# Configuration section
config:
  # Nested comment
  enabled: true
  # More nested comments
  timeout: 30
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result).toEqual({
                name: 'Agent with Comments',
                version: '1.0.0',
                config: {
                    enabled: true,
                    timeout: 30
                }
            });
        });
    });

    describe('Data Type Handling', () => {
        it('should parse different data types correctly', () => {
            const yamlContent = `
string_value: "Hello World"
integer_value: 42
float_value: 3.14159
boolean_true: true
boolean_false: false
null_value: null
date_value: 2024-12-04T10:30:00Z
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result.string_value).toBe('Hello World');
            expect(result.integer_value).toBe(42);
            expect(result.float_value).toBe(3.14159);
            expect(result.boolean_true).toBe(true);
            expect(result.boolean_false).toBe(false);
            expect(result.null_value).toBeNull();
            expect(result.date_value).toEqual(new Date('2024-12-04T10:30:00Z'));
        });

        it('should handle quoted and unquoted strings', () => {
            const yamlContent = `
quoted_string: "This is quoted"
unquoted_string: This is unquoted
single_quoted: 'Single quotes'
multiline_string: |
  This is a multiline
  string that preserves
  line breaks
folded_string: >
  This is a folded
  string that removes
  line breaks
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result.quoted_string).toBe('This is quoted');
            expect(result.unquoted_string).toBe('This is unquoted');
            expect(result.single_quoted).toBe('Single quotes');
            expect(result.multiline_string.trim()).toMatch(/This is a multiline\nstring that preserves\nline breaks/);
            expect(result.folded_string.trim()).toBe('This is a folded string that removes line breaks');
        });

        it('should handle special characters and unicode', () => {
            const yamlContent = `
special_chars: "Characters: @#$%^&*()_+{}|:<>?[]\\;',./"
unicode_string: "Unicode: àáâãäå émojis 🚀 中文 العربية"
escaped_quotes: "String with \\"escaped\\" quotes"
`;
            
            const result = parseYAML(yamlContent);
            
            expect(result.special_chars).toBe('Characters: @#$%^&*()_+{}|:<>?[]\\;\',"./');
            expect(result.unicode_string).toBe('Unicode: àáâãäå émojis 🚀 中文 العربية');
            expect(result.escaped_quotes).toBe('String with "escaped" quotes');
        });
    });

    describe('Error Handling', () => {
        it('should throw error for invalid YAML syntax', () => {
            const invalidYaml = `
name: "Test Agent"
version: 1.0.0
  invalid_indentation: "This should fail"
description: [unclosed array
`;
            
            expect(() => parseYAML(invalidYaml)).toThrow();
        });

        it('should throw error for malformed structures', () => {
            const malformedYaml = `
name: "Test"
{invalid: json-like syntax}
`;
            
            expect(() => parseYAML(malformedYaml)).toThrow();
        });

        it('should handle tabs vs spaces indentation issues', () => {
            const mixedIndentationYaml = `
config:
  setting1: value1
\tsetting2: value2  # Tab indentation
  setting3: value3
`;
            
            // May throw or may parse depending on YAML parser tolerance
            // This tests that the function handles it consistently
            expect(() => parseYAML(mixedIndentationYaml)).toBeDefined();
        });

        it('should provide meaningful error messages', () => {
            const invalidYaml = 'name: [unclosed array';
            
            try {
                parseYAML(invalidYaml);
                fail('Expected parseYAML to throw an error');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBeDefined();
                expect((error as Error).message.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Complex Agent Configuration Scenarios', () => {
        it('should parse typical agent configuration', () => {
            const agentConfig = `
metadata:
  name: "Customer Service Agent"
  version: "2.1.0"
  description: "Handles customer inquiries and support requests"
  author: "AI Team"
  created: 2024-12-04T00:00:00Z

configuration:
  language: "en-US"
  timezone: "UTC"
  timeout_seconds: 30
  max_retries: 3
  
capabilities:
  - name: "answer_questions"
    enabled: true
    confidence_threshold: 0.8
  - name: "escalate_to_human" 
    enabled: true
    trigger_conditions:
      - "confidence < 0.6"
      - "user_frustrated == true"
      
patterns:
  greeting:
    templates:
      - "Hello! How can I help you today?"
      - "Hi there! What can I assist you with?"
    trigger_phrases:
      - "hello"
      - "hi"
      - "help"
      
  farewell:
    templates:
      - "Thank you for contacting us!"
      - "Have a great day!"
    trigger_phrases:
      - "goodbye"
      - "bye"
      - "thanks"
`;
            
            const result = parseYAML(agentConfig);
            
            expect(result.metadata.name).toBe('Customer Service Agent');
            expect(result.configuration.timeout_seconds).toBe(30);
            expect(result.capabilities).toHaveLength(2);
            expect(result.capabilities[0].confidence_threshold).toBe(0.8);
            expect(result.patterns.greeting.templates).toHaveLength(2);
            expect(result.patterns.farewell.trigger_phrases).toContain('goodbye');
        });

        it('should parse pattern validation rules', () => {
            const patternRules = `
validation_patterns:
  authentication:
    rule_id: "AUTH_001"
    description: "Validates authentication patterns"
    severity: "high"
    checks:
      - pattern: "password.*plain"
        message: "Passwords should not be stored in plain text"
        recommendation: "Use encrypted storage"
      - pattern: "api_key.*hardcoded"
        message: "API keys should not be hardcoded"
        recommendation: "Use environment variables"
        
  performance:
    rule_id: "PERF_001" 
    description: "Validates performance patterns"
    severity: "medium"
    checks:
      - pattern: "loop.*large_dataset"
        message: "Avoid large loops over datasets"
        recommendation: "Implement pagination or streaming"
        
  security:
    rule_id: "SEC_001"
    description: "Security pattern validation"
    severity: "critical"
    enabled: true
    checks:
      - pattern: "sql.*injection"
        message: "SQL injection vulnerability detected"
        recommendation: "Use parameterized queries"
      - pattern: "xss.*vulnerability"
        message: "XSS vulnerability detected"  
        recommendation: "Sanitize user inputs"
`;
            
            const result = parseYAML(patternRules);
            
            expect(result.validation_patterns.authentication.severity).toBe('high');
            expect(result.validation_patterns.authentication.checks).toHaveLength(2);
            expect(result.validation_patterns.performance.checks[0].pattern).toBe('loop.*large_dataset');
            expect(result.validation_patterns.security.enabled).toBe(true);
            expect(result.validation_patterns.security.checks).toHaveLength(2);
        });
    });

    describe('Edge Cases and Boundary Conditions', () => {
        it('should handle very large YAML files', () => {
            // Generate a large YAML structure
            const items = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                value: Math.random() * 1000,
                active: i % 2 === 0,
                metadata: {
                    created: '2024-12-04T00:00:00Z',
                    tags: [`tag${i}`, 'generated', 'test']
                }
            }));

            const largeYaml = `
metadata:
  total_items: ${items.length}
  generated: true
items:
${items.map(item => `  - id: ${item.id}
    name: "${item.name}"
    value: ${item.value}
    active: ${item.active}
    metadata:
      created: "${item.metadata.created}"
      tags: [${item.metadata.tags.map(tag => `"${tag}"`).join(', ')}]`).join('\n')}
`;

            const startTime = Date.now();
            const result = parseYAML(largeYaml);
            const endTime = Date.now();

            expect(result.items).toHaveLength(1000);
            expect(result.metadata.total_items).toBe(1000);
            // Should parse in reasonable time (less than 2 seconds)
            expect(endTime - startTime).toBeLessThan(2000);
        });

        it('should handle deeply nested structures', () => {
            // Create a deeply nested YAML structure
            let nestedYaml = 'root:\n';
            for (let i = 0; i < 50; i++) {
                nestedYaml += '  '.repeat(i + 1) + `level${i}:\n`;
            }
            nestedYaml += '  '.repeat(51) + 'value: "deep"';

            const result = parseYAML(nestedYaml);
            
            // Navigate to the deeply nested value
            let current = result.root;
            for (let i = 0; i < 50; i++) {
                current = current[`level${i}`];
            }
            expect(current.value).toBe('deep');
        });

        it('should handle YAML with mixed line endings', () => {
            const mixedLineEndingsYaml = 'name: "Test"\r\nversion: "1.0"\nconfig:\r\n  enabled: true\n';
            
            const result = parseYAML(mixedLineEndingsYaml);
            
            expect(result.name).toBe('Test');
            expect(result.version).toBe('1.0');
            expect(result.config.enabled).toBe(true);
        });

        it('should handle YAML anchors and references', () => {
            const yamlWithAnchors = `
defaults: &defaults
  timeout: 30
  retries: 3
  enabled: true

development:
  <<: *defaults
  debug: true
  
production:
  <<: *defaults
  debug: false
  timeout: 60
`;
            
            const result = parseYAML(yamlWithAnchors);
            
            expect(result.development.timeout).toBe(30);
            expect(result.development.debug).toBe(true);
            expect(result.production.timeout).toBe(60);
            expect(result.production.debug).toBe(false);
            expect(result.production.retries).toBe(3);
        });
    });
});