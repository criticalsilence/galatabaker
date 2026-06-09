/**
 * GalataBaker API — minimal template renderer.
 *
 * MVP scope: simple {{var}} interpolation + {{#if var}}...{{/if}} blocks.
 * No loops, no partials, no helpers. Step 8 hardening can swap in
 * Handlebars or MJML if templates grow.
 *
 * Syntax:
 *   {{name}}              → vars.name (string coerced)
 *   {{#if name}}...{{/if}}   → block if vars.name is truthy
 *   {{#if name}}A{{else}}B{{/if}}  → A if truthy else B
 *
 * Missing variables render as empty string (not "undefined" or "null").
 * Unknown {{tags}} are left intact (caller can spot broken templates).
 */

export type TemplateVars = Record<string, string | number | boolean | null | undefined>;

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
const IF_RE =
  /\{\{\s*#if\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}([\s\S]*?)(?:\{\{\s*else\s*\}\}([\s\S]*?))?\{\{\s*\/if\s*\}\}/g;

/** Render a template string with the given vars. */
export function render(template: string, vars: TemplateVars): string {
  // 1) {{#if}} / {{else}} / {{/if}} — recursive substitution
  let out = template.replace(IF_RE, (_m, name: string, then: string, elseBranch?: string) => {
    const v = vars[name];
    const truthy = v !== null && v !== undefined && v !== false && v !== '' && v !== 0;
    return truthy ? then : (elseBranch ?? '');
  });
  // 2) {{var}} — string coerce
  out = out.replace(VAR_RE, (_m, name: string) => {
    const v = vars[name];
    if (v === null || v === undefined) return '';
    return String(v);
  });
  return out;
}
