// src/debug/textProcessorDebug.ts
import { TextSegmenter } from '../utils';
import { TextSegment } from '../types';
import * as fs from 'fs';

function debugTextSegmenter() {
    const segmenter = new TextSegmenter();
    
    // 测试示例文本
    const testText = fs.readFileSync('src/debug/test.txt', 'utf-8');
    
    console.log("=== Text Segmenter Debug Test ===");
    console.log("Input text:");
    console.log(testText);
    console.log("\n=== Segmentation Results ===");
    
    try {
        const segments = segmenter.segmentText(testText);
        
        segments.forEach((segment, index) => {
            console.log(`\n--- Segment ${index + 1} ---`);
            console.log(`Type: ${segment.type}`);
            console.log(`Language: ${segment.language}`);
            console.log(`Content:`);
            console.log(segment.content);
        });
        
        console.log("\n=== Summary ===");
        console.log(`Total segments: ${segments.length}`);
    } catch (error) {
        console.error("Error during segmentation:", error);
    }
}

debugTextSegmenter();