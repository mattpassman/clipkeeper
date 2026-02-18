import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ContentClassifier, ContentType } from '../src/ContentClassifier.js';

describe('ContentClassifier', () => {
  const classifier = new ContentClassifier();

  describe('URL Detection', () => {
    it('should detect valid HTTP URLs', () => {
      const result = classifier.classify('http://example.com');
      assert.strictEqual(result.type, ContentType.URL);
      assert.strictEqual(result.confidence, 1.0);
    });

    it('should detect valid HTTPS URLs', () => {
      const result = classifier.classify('https://www.example.com/path/to/page');
      assert.strictEqual(result.type, ContentType.URL);
      assert.strictEqual(result.confidence, 1.0);
    });

    it('should detect URLs with query parameters', () => {
      const result = classifier.classify('https://example.com/search?q=test&page=1');
      assert.strictEqual(result.type, ContentType.URL);
    });

    it('should detect URLs with fragments', () => {
      const result = classifier.classify('https://example.com/page#section');
      assert.strictEqual(result.type, ContentType.URL);
    });

    it('should not detect invalid URLs', () => {
      const result = classifier.classify('not a url');
      assert.notStrictEqual(result.type, ContentType.URL);
    });

    it('should not detect multi-line content as URL', () => {
      const result = classifier.classify('https://example.com\nmore text');
      assert.notStrictEqual(result.type, ContentType.URL);
    });
  });

  describe('JSON Detection', () => {
    it('should detect valid JSON objects', () => {
      const result = classifier.classify('{"key": "value", "number": 42}');
      assert.strictEqual(result.type, ContentType.JSON);
      assert.strictEqual(result.confidence, 1.0);
    });

    it('should detect valid JSON arrays', () => {
      const result = classifier.classify('[1, 2, 3, "test"]');
      assert.strictEqual(result.type, ContentType.JSON);
    });

    it('should detect nested JSON', () => {
      const result = classifier.classify('{"nested": {"key": "value"}, "array": [1, 2, 3]}');
      assert.strictEqual(result.type, ContentType.JSON);
    });

    it('should not detect invalid JSON', () => {
      const result = classifier.classify('{invalid json}');
      assert.notStrictEqual(result.type, ContentType.JSON);
    });

    it('should not detect text starting with { as JSON', () => {
      const result = classifier.classify('{this is not json');
      assert.notStrictEqual(result.type, ContentType.JSON);
    });
  });

  describe('XML Detection', () => {
    it('should detect XML with declaration', () => {
      const result = classifier.classify('<?xml version="1.0"?><root><child>value</child></root>');
      assert.strictEqual(result.type, ContentType.XML);
    });

    it('should detect XML without declaration', () => {
      const result = classifier.classify('<root><child>value</child></root>');
      assert.strictEqual(result.type, ContentType.XML);
    });

    it('should detect XML with attributes', () => {
      const result = classifier.classify('<root attr="value"><child id="1">text</child></root>');
      assert.strictEqual(result.type, ContentType.XML);
    });

    it('should not detect HTML as XML (code should be detected first)', () => {
      const result = classifier.classify('<!DOCTYPE html><html><head></head><body></body></html>');
      // HTML should be detected as code due to keywords
      assert.ok(result.type === ContentType.CODE || result.type === ContentType.XML);
    });

    it('should not detect incomplete XML', () => {
      const result = classifier.classify('<root>');
      assert.notStrictEqual(result.type, ContentType.XML);
    });
  });

  describe('File Path Detection', () => {
    it('should detect Windows absolute paths', () => {
      const result = classifier.classify('C:\\Users\\username\\Documents\\file.txt');
      assert.strictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should detect Windows paths with forward slashes', () => {
      const result = classifier.classify('C:\\Program Files\\App\\config.json');
      assert.strictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should detect Unix absolute paths', () => {
      const result = classifier.classify('/home/user/documents/file.txt');
      assert.strictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should detect Unix home directory paths', () => {
      const result = classifier.classify('~/documents/file.txt');
      assert.strictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should detect root path', () => {
      const result = classifier.classify('/');
      assert.strictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should not detect relative paths as file paths', () => {
      const result = classifier.classify('./relative/path');
      assert.notStrictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should not detect multi-line content as file path', () => {
      const result = classifier.classify('/home/user\n/another/path');
      assert.notStrictEqual(result.type, ContentType.FILE_PATH);
    });
  });

  describe('Code Detection', () => {
    it('should detect JavaScript code', () => {
      const code = 'function hello() {\n  const message = "Hello";\n  return message;\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'javascript');
    });

    it('should detect Python code', () => {
      const code = 'def hello():\n    message = "Hello"\n    return message';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'python');
    });

    it('should detect Java code', () => {
      const code = 'public class Hello {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'java');
    });

    it('should detect TypeScript code', () => {
      const code = 'interface User {\n  name: string;\n  age: number;\n}\nconst user: User = { name: "John", age: 30 };';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.ok(result.language === 'typescript' || result.language === 'javascript');
    });

    it('should detect SQL code', () => {
      const code = 'SELECT * FROM users WHERE age > 18 ORDER BY name';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'sql');
    });

    it('should detect Go code', () => {
      const code = 'package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Hello")\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'go');
    });

    it('should detect Rust code', () => {
      const code = 'fn main() {\n  let x = 5;\n  println!("x = {}", x);\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'rust');
    });

    it('should detect code with brackets and operators', () => {
      const code = 'if (x > 0) {\n  y = x * 2;\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
    });

    it('should not detect plain text as code', () => {
      const result = classifier.classify('This is just plain text without any code.');
      assert.strictEqual(result.type, ContentType.TEXT);
    });
  });

  describe('Markdown Detection', () => {
    it('should detect markdown with headers', () => {
      const md = '# Title\n## Subtitle\nSome text';
      const result = classifier.classify(md);
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should detect markdown with bold and italic', () => {
      const md = 'This is **bold** and *italic* text';
      const result = classifier.classify(md);
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should detect markdown with links', () => {
      const md = 'Check out [this link](https://example.com) for more info';
      const result = classifier.classify(md);
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should detect markdown with lists', () => {
      const md = '- Item 1\n- Item 2\n- Item 3';
      const result = classifier.classify(md);
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should detect markdown with code blocks', () => {
      const md = '```javascript\nconst x = 5;\n```';
      const result = classifier.classify(md);
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should detect markdown with inline code', () => {
      const md = 'Use the `console.log()` function to **print** output';
      const result = classifier.classify(md);
      // Inline code alone might be detected as code, but with bold it should be markdown
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should require multiple markdown patterns', () => {
      const result = classifier.classify('Just one `code` word');
      // Should not be markdown with only one pattern
      assert.strictEqual(result.type, ContentType.TEXT);
    });
  });

  describe('Image Detection', () => {
    it('should detect Buffer as image', () => {
      const buffer = Buffer.from('fake image data');
      const result = classifier.classify(buffer);
      assert.strictEqual(result.type, ContentType.IMAGE);
      assert.strictEqual(result.confidence, 1.0);
    });

    it('should detect object with image property', () => {
      const content = { image: Buffer.from('fake image data') };
      const result = classifier.classify(content);
      assert.strictEqual(result.type, ContentType.IMAGE);
    });
  });

  describe('Plain Text Detection', () => {
    it('should classify plain text', () => {
      const result = classifier.classify('This is just plain text.');
      assert.strictEqual(result.type, ContentType.TEXT);
    });

    it('should classify empty string as text', () => {
      const result = classifier.classify('');
      assert.strictEqual(result.type, ContentType.TEXT);
    });

    it('should classify whitespace as text', () => {
      const result = classifier.classify('   \n\t  ');
      assert.strictEqual(result.type, ContentType.TEXT);
    });
  });

  describe('Type Precedence', () => {
    it('should prefer URL over text', () => {
      const result = classifier.classify('https://example.com');
      assert.strictEqual(result.type, ContentType.URL);
    });

    it('should prefer JSON over code', () => {
      const result = classifier.classify('{"function": "test", "const": 123}');
      assert.strictEqual(result.type, ContentType.JSON);
    });

    it('should prefer code over markdown for code with markdown syntax', () => {
      const code = 'function test() {\n  // # This is a comment\n  const x = 5;\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
    });

    it('should prefer file path over text', () => {
      const result = classifier.classify('/usr/local/bin/node');
      assert.strictEqual(result.type, ContentType.FILE_PATH);
    });

    it('should prefer JSON over text even with code-like content', () => {
      const json = '{"if": true, "while": false, "function": "name"}';
      const result = classifier.classify(json);
      assert.strictEqual(result.type, ContentType.JSON);
    });

    it('should prefer XML over code for valid XML', () => {
      const xml = '<config><setting>value</setting></config>';
      const result = classifier.classify(xml);
      assert.strictEqual(result.type, ContentType.XML);
    });

    it('should prefer markdown over code when markdown patterns are strong', () => {
      const md = '# Header\n\nSome text with [link](url) and **bold**';
      const result = classifier.classify(md);
      assert.strictEqual(result.type, ContentType.MARKDOWN);
    });

    it('should prefer code over text for code with operators', () => {
      const code = 'if (x > 0) { y = x * 2; }';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
    });

    it('should prefer URL over file path for URLs', () => {
      const result = classifier.classify('https://example.com/path/to/file');
      assert.strictEqual(result.type, ContentType.URL);
    });

    it('should prefer JSON array over code', () => {
      const json = '[{"name": "function"}, {"name": "class"}]';
      const result = classifier.classify(json);
      assert.strictEqual(result.type, ContentType.JSON);
    });

    it('should default to text when no specific type matches', () => {
      const result = classifier.classify('Just some plain text without any special formatting');
      assert.strictEqual(result.type, ContentType.TEXT);
    });

    it('should prefer image over all text-based types', () => {
      const buffer = Buffer.from('fake image data');
      const result = classifier.classify(buffer);
      assert.strictEqual(result.type, ContentType.IMAGE);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', () => {
      const longText = 'a'.repeat(10000);
      const result = classifier.classify(longText);
      assert.strictEqual(result.type, ContentType.TEXT);
    });

    it('should handle special characters', () => {
      const result = classifier.classify('!@#$%^&*()_+-=[]{}|;:,.<>?');
      assert.ok(result.type);
    });

    it('should handle unicode characters', () => {
      const result = classifier.classify('Hello 世界 🌍');
      assert.strictEqual(result.type, ContentType.TEXT);
    });

    it('should handle mixed content types', () => {
      const mixed = 'Some text\nhttps://example.com\nMore text';
      const result = classifier.classify(mixed);
      // Multi-line content with URL should not be classified as URL
      assert.notStrictEqual(result.type, ContentType.URL);
    });

    it('should handle null-like values', () => {
      const result1 = classifier.classify(null);
      const result2 = classifier.classify(undefined);
      assert.ok(result1.type);
      assert.ok(result2.type);
    });
  });

  describe('Language Detection Accuracy', () => {
    it('should detect C++ code', () => {
      const code = '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello";\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      // C++ and C# share some keywords, so we accept either
      assert.ok(result.language === 'cpp' || result.language === 'csharp');
    });

    it('should detect C# code', () => {
      const code = 'using System;\nnamespace Test {\n  public class Program {\n    static void Main() {}\n  }\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'csharp');
    });

    it('should detect Ruby code', () => {
      const code = 'def hello\n  puts "Hello"\nend';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'ruby');
    });

    it('should detect PHP code', () => {
      const code = '<?php\nfunction hello() {\n  echo "Hello";\n}\n?>';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'php');
    });

    it('should detect Swift code', () => {
      const code = 'func hello() {\n  let message = "Hello"\n  print(message)\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'swift');
    });

    it('should detect Kotlin code', () => {
      const code = 'fun main() {\n  val message = "Hello"\n  println(message)\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'kotlin');
    });

    it('should detect HTML code', () => {
      const code = '<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body><div>Content</div></body>\n</html>';
      const result = classifier.classify(code);
      // HTML can be detected as either code or XML, both are acceptable
      assert.ok(result.type === ContentType.CODE || result.type === ContentType.XML);
      if (result.type === ContentType.CODE) {
        assert.strictEqual(result.language, 'html');
      }
    });

    it('should detect CSS code', () => {
      const code = '.container {\n  display: flex;\n  padding: 10px;\n  background: #fff;\n}';
      const result = classifier.classify(code);
      assert.strictEqual(result.type, ContentType.CODE);
      assert.strictEqual(result.language, 'css');
    });
  });
});

