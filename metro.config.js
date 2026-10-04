const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
const defaut = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, nom, plateforme) => {
  if (nom === 'tslib') return { type: 'sourceFile', filePath: require.resolve('tslib/tslib.js') };
  return (defaut ?? ctx.resolveRequest)(ctx, nom, plateforme);
};
module.exports = config;
