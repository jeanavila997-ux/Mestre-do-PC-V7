/**
 * Unit Tests for Command Sanitizer
 */

import {
  escapeString,
  isValidParamName,
  encodeCommand,
  buildSafeCommand,
  detectInjection,
} from '../../src/security/sanitizer';

describe('escapeString', () => {
  it('should escape semicolons', () => {
    expect(escapeString('foo;bar')).toBe('foo`;bar');
  });

  it('should escape ampersands', () => {
    expect(escapeString('test&echo')).toBe('test`&echo');
  });

  it('should escape pipes', () => {
    expect(escapeString('dir|more')).toBe('dir`|more');
  });

  it('should escape multiple dangerous chars', () => {
    const input = 'foo;bar&baz|qux';
    const escaped = escapeString(input);
    expect(escaped).toContain('`');
    expect(escaped).not.toContain(';bar&');
  });

  it('should throw on non-string input', () => {
    expect(() => escapeString(null as any)).toThrow('Input must be a string');
  });

  it('should return empty string unchanged', () => {
    expect(escapeString('')).toBe('');
  });

  it('should return safe string unchanged except for escaping', () => {
    expect(escapeString('notepad')).toBe('notepad');
  });
});

describe('isValidParamName', () => {
  it('should accept valid parameter names', () => {
    expect(isValidParamName('processName')).toBe(true);
    expect(isValidParamName('targetMB')).toBe(true);
    expect(isValidParamName('dryRun')).toBe(true);
  });

  it('should reject parameter names with special chars', () => {
    expect(isValidParamName('foo;bar')).toBe(false);
    expect(isValidParamName('test&echo')).toBe(false);
  });

  it('should reject parameter names starting with numbers', () => {
    expect(isValidParamName('123param')).toBe(false);
  });

  it('should accept parameter names with underscores', () => {
    expect(isValidParamName('param_name')).toBe(true);
  });
});

describe('encodeCommand', () => {
  it('should encode simple command', () => {
    const command = 'Get-Process';
    const encoded = encodeCommand(command);
    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe('string');
  });

  it('should decode back to original', () => {
    const command = 'Get-Process -Name "notepad"';
    const encoded = encodeCommand(command);
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le');
    expect(decoded).toBe(command);
  });
});

describe('buildSafeCommand', () => {
  it('should build command without args', () => {
    const result = buildSafeCommand('Get-Process');
    expect(result).toContain('powershell -EncodedCommand');
  });

  it('should build command with escaped args', () => {
    const result = buildSafeCommand('Get-Process', { Name: 'notepad' });
    expect(result).toContain('powershell -EncodedCommand');
  });

  it('should escape dangerous chars in args', () => {
    const result = buildSafeCommand('Test-Command', { Param: 'foo;rm' });
    expect(result).toContain('powershell -EncodedCommand');
  });

  it('should reject invalid param names', () => {
    expect(() => buildSafeCommand('Test', { 'foo;bar': 'value' })).toThrow(
      'Invalid parameter name'
    );
  });
});

describe('detectInjection', () => {
  it('should return false for safe input', () => {
    expect(detectInjection('notepad')).toBe(false);
    expect(detectInjection('Get-Process')).toBe(false);
  });

  it('should detect semicolon injection', () => {
    expect(detectInjection('foo; rm -rf /')).toBe(true);
  });

  it('should detect ampersand injection', () => {
    expect(detectInjection('test&echo hacked')).toBe(true);
  });

  it('should detect pipe injection', () => {
    expect(detectInjection('dir|more')).toBe(true);
  });

  it('should detect command substitution', () => {
    expect(detectInjection('$(whoami)')).toBe(true);
  });

  it('should detect destructive commands', () => {
    expect(detectInjection('rm -rf /')).toBe(true);
    expect(detectInjection('del C:\\')).toBe(true);
    expect(detectInjection('format C:')).toBe(true);
  });

  it('should detect redirection', () => {
    expect(detectInjection('echo test > /etc/passwd')).toBe(true);
  });
});
