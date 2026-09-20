/**
 * log-parser.ts - Detección del nivel de una línea de log.
 *
 * Usado por `main/logs.ts` al construir `LogEntry.level` y por el renderer
 * en US-067 para colorizar. Patrones del UI-GUIDE §Colorización de Logs.
 */
import type { LogLevel } from './types';

interface LevelPattern {
  readonly regex: RegExp;
  readonly level: LogLevel;
}

const LEVEL_PATTERNS: ReadonlyArray<LevelPattern> = [
  { regex: /!!!\s*LEAK\s+DETECTED\s*!!!/i, level: 'leak' },
  { regex: /\[ERROR\]/i, level: 'error' },
  { regex: /\[WARN\]/i, level: 'warn' },
  { regex: /\[(\d+)\/\d+\]/, level: 'done' },
];

export function parseLogLevel(line: string): LogLevel {
  for (const { regex, level } of LEVEL_PATTERNS) {
    if (regex.test(line)) return level;
  }
  return 'info';
}
