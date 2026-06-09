/**
 * GalataBaker API — Template renderer tests.
 *
 * MVP render kapsamı:
 *   - {{var}} substitution
 *   - {{#if var}}…{{else}}…{{/if}} conditional
 *   - Missing vars → empty string
 *   - Truthy/falsy semantiği (null, undefined, 0, '', false)
 */

import { describe, expect, it } from 'vitest';

import { render } from './template.js';

describe('render()', () => {
  it('substitutes a single {{var}}', () => {
    expect(render('Hello {{name}}!', { name: 'Caner' })).toBe('Hello Caner!');
  });

  it('substitutes multiple {{var}} placeholders', () => {
    expect(render('{{a}} + {{b}} = {{a}}', { a: 1, b: 2 })).toBe('1 + 2 = 1');
  });

  it('coerces non-string values to string', () => {
    expect(render('Count: {{n}}, Active: {{flag}}', { n: 42, flag: true })).toBe(
      'Count: 42, Active: true',
    );
  });

  it('substitutes missing vars as empty string (not "undefined")', () => {
    expect(render('Hi {{name}}!', {})).toBe('Hi !');
    expect(render('Hi {{name}}!', { name: null })).toBe('Hi !');
  });

  it('leaves unknown {{tags}} intact (caller can spot broken templates)', () => {
    // Numeric prefix is not a valid identifier → not substituted
    expect(render('{{1bad}}', {})).toBe('{{1bad}}');
  });

  it('{{#if var}} renders the truthy branch', () => {
    expect(render('{{#if name}}Hi {{name}}{{/if}}', { name: 'X' })).toBe('Hi X');
  });

  it('{{#if var}} renders the else branch when falsy', () => {
    expect(render('{{#if name}}Hi {{name}}{{else}}Anon{{/if}}', {})).toBe('Anon');
  });

  it('{{#if var}} treats 0, empty string, false as falsy', () => {
    expect(render('{{#if x}}A{{else}}B{{/if}}', { x: 0 })).toBe('B');
    expect(render('{{#if x}}A{{else}}B{{/if}}', { x: '' })).toBe('B');
    expect(render('{{#if x}}A{{else}}B{{/if}}', { x: false })).toBe('B');
  });

  it('{{#if var}} treats non-zero numbers and non-empty strings as truthy', () => {
    expect(render('{{#if x}}A{{else}}B{{/if}}', { x: 1 })).toBe('A');
    expect(render('{{#if x}}A{{else}}B{{/if}}', { x: 'yes' })).toBe('A');
  });

  it('nests if and var in the same template', () => {
    const t = '{{#if amount}}Got {{amount}} tez{{else}}Nothing{{/if}}';
    expect(render(t, { amount: '5' })).toBe('Got 5 tez');
    expect(render(t, {})).toBe('Nothing');
  });

  it('returns empty string for empty template', () => {
    expect(render('', { x: 1 })).toBe('');
  });
});
