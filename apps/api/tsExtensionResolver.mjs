// Node's type stripping resolves import specifiers literally, but the source
// uses TypeScript's NodeNext convention of writing "./x.js" for "./x.ts" (which
// is what the Vercel build expects). This resolve hook bridges the two: a
// relative "*.js" specifier falls back to the sibling "*.ts" file when no
// compiled ".js" exists. Registered by ./tsExtensionResolver.register.mjs.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    try {
      return await nextResolve(`${specifier.slice(0, -".js".length)}.ts`, context);
    } catch {
      // Fall through to the specifier as written.
    }
  }

  return nextResolve(specifier, context);
}
