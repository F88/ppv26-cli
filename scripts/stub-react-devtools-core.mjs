// Stub for react-devtools-core: Ink only imports it on the DEV devtools
// path (process.env.DEV === 'true'), which is additionally gated by
// import.meta.resolve('react-devtools-core') succeeding - so the bundle
// never actually reaches this in practice. Aliased here so the import
// resolves without pulling in the (uninstalled, heavy) real package.
//
// Mirror the methods Ink calls (devtools.initialize() then
// connectToDevTools(), in that order) as no-ops, so that even if the
// DEV path were ever reached the stub stays inert instead of throwing.
export default {
  initialize() {},
  connectToDevTools() {},
};
