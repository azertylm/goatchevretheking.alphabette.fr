import type { AlphaAppConfig } from '@alphabette/shell';

/**
 * Configuration de Goat Chèvre The King pour la base commune
 * (@alphabette/shell) : identité du site, couleur et liens de l'écosystème.
 */
export const APP: AlphaAppConfig = {
  key: 'goat',
  name: 'Goat Chèvre The King',
  tagline: 'Élisez votre goat, votre chèvre ou votre Roi',

  // Couleur d'identité du site : l'ambre de la couronne.
  accent: '#f59e0b',

  // Adresses publiques.
  subdomain: 'goatchevretheking',
  homePath: '/goat',

  // Liens de l'écosystème.
  donUrl: 'https://alphabette.fr/don',
  accountUrl: 'https://alphabette.fr/compte',
  apiKeysUrl: 'https://alphabette.fr/cles',

  // Goat Chèvre The King est gratuite, pour toujours : la base n'affiche donc
  // ici ni prix, ni essai, ni bouton de paiement — seulement les liens vers le
  // hub (écosystème, dons, compte) et le compte des applications gratuites.
  gratuit: true,

  apiKeyState: 'ok',
  accountState: 'ok',
};
