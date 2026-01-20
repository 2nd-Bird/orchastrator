/**
 * Sanitizes terminal output by removing ANSI escape codes, control characters,
 * and normalizing line endings for clean display in Claude Code TUI.
 *
 * @param raw - Raw terminal output from tmux capture
 * @returns Sanitized string safe for display
 */
export function sanitizeOutput(raw: string): string {
  let sanitized = raw;

  // 1. Strip ANSI escape sequences
  sanitized = stripAnsiEscapes(sanitized);

  // 2. Normalize line endings (remove \r)
  sanitized = normalizeLineEndings(sanitized);

  // 3. Remove control characters (except \n and \t)
  sanitized = removeControlChars(sanitized);

  // 4. Normalize UTF-8 (handle any encoding issues)
  sanitized = normalizeUtf8(sanitized);

  return sanitized;
}

/**
 * Strips ANSI escape sequences from text.
 * Handles: color codes, cursor movement, character set switches
 */
function stripAnsiEscapes(text: string): string {
  // CSI (Control Sequence Introducer) sequences: ESC [ ... letter
  const csiRegex = /\x1B\[[0-9;]*[A-Za-z]/g;

  // OSC (Operating System Command) sequences: ESC ] ... BEL/ST
  const oscRegex = /\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g;

  // Character set switches: ESC ( ... or ESC ) ...
  const charsetRegex = /\x1B[()][AB012]/g;

  // Simple escape sequences: ESC letter
  const simpleEscRegex = /\x1B[A-Za-z]/g;

  return text
    .replace(csiRegex, '')
    .replace(oscRegex, '')
    .replace(charsetRegex, '')
    .replace(simpleEscRegex, '');
}

/**
 * Normalizes line endings by removing carriage returns.
 */
function normalizeLineEndings(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // Windows line endings
    .replace(/\r/g, '\n');   // Old Mac line endings / bare CR
}

/**
 * Removes control characters except newline and tab.
 */
function removeControlChars(text: string): string {
  // Keep: \n (0x0A), \t (0x09)
  // Remove: 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F (DEL)
  return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Ensures valid UTF-8 encoding.
 * Handles any malformed UTF-8 sequences that may have been introduced.
 */
function normalizeUtf8(text: string): string {
  // JavaScript strings are already UTF-16, but we may have encoding artifacts
  // from tmux or shell. This is mostly defensive.

  // Replace any remaining problematic characters with space
  // This handles cases where binary data leaked into text
  return text.replace(/[\uFFFD\uFFFE\uFFFF]/g, ' ');
}

/**
 * Checks if output needs sanitization (has control characters or ANSI codes).
 * Useful for debugging or testing.
 */
export function needsSanitization(text: string): boolean {
  // Check for ANSI escape sequences
  if (/\x1B\[/.test(text)) return true;

  // Check for control characters (except \n and \t)
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(text)) return true;

  // Check for carriage returns
  if (/\r/.test(text)) return true;

  return false;
}
