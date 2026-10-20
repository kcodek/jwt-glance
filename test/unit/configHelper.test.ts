import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getJwtGlanceSetting,
  getGlanceClaims,
  updateJwtGlanceSetting,
  DEFAULT_GLANCE_CLAIMS
} from '../../src/vscode/configHelper';

test('getJwtGlanceSetting resolves from root single object config {"jwtGlance": { ... }}', () => {
  const mockVscode = {
    workspace: {
      getConfiguration: (section?: string) => {
        if (!section) {
          return {
            get: (k: string) => {
              if (k === 'jwtGlance') {
                return {
                  enabled: false,
                  glanceClaims: ['roles', 'email', 'sub'],
                  position: 'left'
                };
              }
              return undefined;
            }
          };
        }
        return {
          get: () => undefined
        };
      }
    }
  };

  const enabled = getJwtGlanceSetting<boolean>('enabled', true, mockVscode as any);
  const glanceClaims = getJwtGlanceSetting<string[]>('glanceClaims', ['sub'], mockVscode as any);
  const position = getJwtGlanceSetting<string>('position', 'top', mockVscode as any);

  assert.equal(enabled, false);
  assert.deepEqual(glanceClaims, ['roles', 'email', 'sub']);
  assert.equal(position, 'left');
});

test('getJwtGlanceSetting resolves from scoped config section getConfiguration("jwtGlance")', () => {
  const mockVscode = {
    workspace: {
      getConfiguration: (section?: string) => {
        if (section === 'jwtGlance') {
          return {
            get: (k: string) => {
              if (k === 'maxLineLength') return 5000;
              return undefined;
            }
          };
        }
        return {
          get: () => undefined
        };
      }
    }
  };

  const maxLine = getJwtGlanceSetting<number>('maxLineLength', 10000, mockVscode as any);
  assert.equal(maxLine, 5000);
});

test('getJwtGlanceSetting resolves legacy flat settings ("jwtGlance.enabled")', () => {
  const mockVscode = {
    workspace: {
      getConfiguration: (section?: string) => {
        if (!section) {
          return {
            get: (k: string) => {
              if (k === 'jwtGlance.enabled') return false;
              if (k === 'jwtGlance.position') return 'both';
              return undefined;
            }
          };
        }
        return {
          get: () => undefined
        };
      }
    }
  };

  const enabled = getJwtGlanceSetting<boolean>('enabled', true, mockVscode as any);
  const position = getJwtGlanceSetting<string>('position', 'top', mockVscode as any);

  assert.equal(enabled, false);
  assert.equal(position, 'both');
});

test('getJwtGlanceSetting returns defaultValue when setting is absent', () => {
  const mockVscode = {
    workspace: {
      getConfiguration: () => ({
        get: () => undefined
      })
    }
  };

  const val = getJwtGlanceSetting<number>('expiringSoonThreshold', 1800, mockVscode as any);
  assert.equal(val, 1800);
});

test('getGlanceClaims normalizes array, string, whitespace and falls back to ["sub"]', () => {
  const createMock = (glanceClaimsVal: unknown) => ({
    workspace: {
      getConfiguration: () => ({
        get: (k: string) => {
          if (k === 'jwtGlance') {
            return { glanceClaims: glanceClaimsVal };
          }
          return undefined;
        }
      })
    }
  });

  // Array of valid claims
  assert.deepEqual(getGlanceClaims(createMock(['roles', 'email']) as any), ['roles', 'email']);

  // Single string
  assert.deepEqual(getGlanceClaims(createMock('email') as any), ['email']);

  // Array with whitespace or empty strings
  assert.deepEqual(getGlanceClaims(createMock(['', '   ', 'tenant']) as any), ['tenant']);

  // Empty array -> fallback to default claims ['roles', 'name', 'email', 'sub']
  assert.deepEqual(getGlanceClaims(createMock([]) as any), DEFAULT_GLANCE_CLAIMS);

  // Non-string / non-array -> fallback to default claims
  assert.deepEqual(getGlanceClaims(createMock(null) as any), DEFAULT_GLANCE_CLAIMS);
});

test('updateJwtGlanceSetting updates within the single "jwtGlance": { ... } object preserving siblings', async () => {
  let updatedSection = '';
  let updatedValue: unknown;
  let updatedTarget: unknown;

  const mockVscode = {
    workspace: {
      getConfiguration: () => ({
        get: (k: string) => {
          if (k === 'jwtGlance') {
            return {
              enabled: true,
              position: 'top'
            };
          }
          return undefined;
        },
        update: async (section: string, value: unknown, target: unknown) => {
          updatedSection = section;
          updatedValue = value;
          updatedTarget = target;
        }
      })
    }
  };

  await updateJwtGlanceSetting('glanceClaims', ['roles', 'email', 'sub'], 1 as any, mockVscode as any);

  assert.equal(updatedSection, 'jwtGlance');
  assert.deepEqual(updatedValue, {
    enabled: true,
    position: 'top',
    glanceClaims: ['roles', 'email', 'sub']
  });
  assert.equal(updatedTarget, 1);
});
