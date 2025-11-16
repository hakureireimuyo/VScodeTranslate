// src/debug/textProcessorDebug.ts
import { splitIntoParagraphs, smartChunking } from '../hover/TextProcessor';

function runDebug() {
  console.log('=== TextProcessor 调试输出 ===\n');
  
  const testCases = [
    {
      name: '复杂函数文档',
      text: 'function assert.deepStrictEqual<string[]>(actual: unknown, expected: string[], message?: string | Error | undefined): asserts actual is string[]\nTests for deep equality between the actual and expected parameters. "Deep" equality means that the enumerable "own" properties of child objects are recursively evaluated also by the following rules\n\n@since — v1.2.0'
    },
    {
      name: '简单多段落',
      text: '第一段文本\n\n第二段文本\n\n第三段文本'
    },
    {
      name: '包含代码块',
      text: '介绍文本\n\n```javascript\nconsole.log("Hello World");\nconst x = 10;\n```\n\n结束文本'
    },
    {
        name: '一个实例',
        text:"namespace console\nvar console: Console\nThe console module provides a simple debugging console that is similar to the JavaScript console mechanism provided by web browsers.\n\nThe module exports two specific components:\n\nA Console class with methods such as console.log(), console.error() and console.warn() that can be used to write to any Node.js stream.\nA global console instance configured to write to process.stdout and process.stderr. The global console can be used without importing the node:console module.\nWarning: The global console object's methods are neither consistently synchronous like the browser APIs they resemble, nor are they consistently asynchronous like all other Node.js streams. See the note on process I/O for more information.\n\nExample using the global console:\n\nconsole.log('hello world');\n// Prints: hello world, to stdout\nconsole.log('hello %s', 'world');\n// Prints: hello world, to stdout\nconsole.error(new Error('Whoops, something bad happened'));\n// Prints error message and stack trace to stderr:\n//   Error: Whoops, something bad happened\n//     at [eval]:5:15\n//     at Script.runInThisContext (node:vm:132:18)\n//     at Object.runInThisContext (node:vm:309:38)\n//     at node:internal/process/execution:77:19\n//     at [eval]-wrapper:6:22\n//     at evalScript (node:internal/process/execution:76:60)\n//     at node:internal/main/eval_string:23:3\n\nconst name = 'Will Robinson';\nconsole.warn(`Danger ${name}! Danger!`);\n// Prints: Danger Will Robinson! Danger!, to stderr\nExample using the Console class:\n\nconst out = getStreamSomehow();\nconst err = getStreamSomehow();\nconst myConsole = new console.Console(out, err);\n\nmyConsole.log('hello world');\n// Prints: hello world, to out\nmyConsole.log('hello %s', 'world');\n// Prints: hello world, to out\nmyConsole.error(new Error('Whoops, something bad happened'));\n// Prints: [Error: Whoops, something bad happened], to err\n\nconst name = 'Will Robinson';\nmyConsole.warn(`Danger ${name}! Danger!`);\n// Prints: Danger Will Robinson! Danger!, to err\n@see — source"
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`--- 测试用例 ${index + 1}: ${testCase.name} ---`);
    console.log(`输入: ${JSON.stringify(testCase.text)}\n`);
    
    const result = splitIntoParagraphs(testCase.text);
    
    console.log(`输出: ${result.length} 个段落`);
    result.forEach((paragraph, paraIndex) => {
      console.log(`  段落 ${paraIndex + 1} (${paragraph.length} 字符):`);
      console.log(`    ${JSON.stringify(paragraph)}`);
    });
    
    console.log('\n');
  });
  
  console.log('=== 调试完成 ===');
}

runDebug();