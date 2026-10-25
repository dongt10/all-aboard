// Read declarations, never comments or the palette's separate JavaScript constants.
export const withoutComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
export function cssRules(css) {
  return [...withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) => {
    const declarations = Object.fromEntries(body.split(';').filter(part => part.includes(':')).map(part => {
      const colon = part.indexOf(':'); return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
    }));
    return selectors.trim().split(',').map(selector => ({ selector: selector.trim(), declarations }));
  });
}
export function declarations(css, selector) {
  const matches = cssRules(css).filter(rule => rule.selector === selector);
  if (!matches.length) throw new Error(`Missing CSS selector: ${selector}`);
  return Object.assign({}, ...matches.map(rule => rule.declarations));
}
export function resolveVars(value, variables) {
  for (let i = 0; i < 20 && value.includes('var('); i++) {
    const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_, name, fallback) => variables[name] ?? fallback ?? `UNSET(${name})`);
    if (next === value) throw new Error(`Unresolved CSS value: ${value}`);
    value = next;
  }
  return value.replace(/calc\(([\d.]+)px - ([\d.]+)px\)/g, (_, a, b) => `${Number(a) - Number(b)}px`);
}
// Deliberately limited cascade for the kit's color and typography contracts. No layout
// is simulated. Tests mount real controls and match their actual classes/attributes.
export function controlStyle(element, css, { hover = null } = {}) {
  const rules = cssRules(css), root = declarations(css, ':root');
  const inherited = element.parentElement ? controlStyle(element.parentElement, css, { hover }) : {};
  const variables = { ...root, ...Object.fromEntries(Object.entries(inherited).filter(([k]) => k.startsWith('--'))) };
  const specificity = selector => {
    const plain = selector.replace(/:not\(/g, '(');
    return (plain.match(/#/g)?.length ?? 0) * 100 + (plain.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g)?.length ?? 0) * 10 + (plain.match(/(?:^|\s)[a-z]+/g)?.length ?? 0);
  };
  const matches = selector => {
    if (selector.startsWith('@') || selector === ':root' || /::|:focus|:active|:has|%/.test(selector)) return false;
    if (selector.includes(':hover')) { if (element !== hover) return false; selector = selector.replaceAll(':hover', ''); }
    if (selector === '*') return true;
    return element.matches(selector);
  };
  const selected = rules.filter(rule => matches(rule.selector)).sort((a, b) => specificity(a.selector) - specificity(b.selector));
  const own = Object.assign({}, ...selected.map(rule => rule.declarations));
  Object.assign(variables, Object.fromEntries(Object.entries(own).filter(([k]) => k.startsWith('--'))));
  const style = { ...variables };
  for (const property of ['color', 'font-size']) if (inherited[property]) style[property] = inherited[property];
  for (const rule of selected) {
    for (const [property, value] of Object.entries(rule.declarations)) {
      if (property === 'font') {
        const size = value.match(/var\(--text-[\w-]+\)/)?.[0];
        if (size) style['font-size'] = resolveVars(size, variables);
        else if (value === 'inherit') style['font-size'] = inherited['font-size'];
      } else if (!property.startsWith('--')) style[property] = value === 'inherit' ? inherited[property] : resolveVars(value, variables);
    }
  }
  return style;
}
