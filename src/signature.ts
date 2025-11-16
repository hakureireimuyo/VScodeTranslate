// src/signature.ts

import { createHash } from 'crypto';
export function md5(str: string): string {
	return createHash('md5').update(str, 'utf-8').digest('hex');
}