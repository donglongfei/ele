/**
 * Ele plugin logo SVG (black/white, follows theme)
 * Used for ribbon icon and tab header - adapts to light/dark themes
 * Simple bold letters
 */
export const ELE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="currentColor" transform="translate(5, 25)">
    <!-- E -->
    <rect x="0" y="0" width="26" height="9"/>
    <rect x="0" y="0" width="9" height="41"/>
    <rect x="0" y="16" width="21" height="9"/>
    <rect x="0" y="32" width="26" height="9"/>

    <!-- L -->
    <rect x="32" y="0" width="9" height="41"/>
    <rect x="32" y="32" width="21" height="9"/>

    <!-- E -->
    <rect x="59" y="0" width="26" height="9"/>
    <rect x="59" y="0" width="9" height="41"/>
    <rect x="59" y="16" width="21" height="9"/>
    <rect x="59" y="32" width="26" height="9"/>
  </g>
</svg>`;

/**
 * Ele plugin logo SVG (dark orange color with design elements)
 * Used for chat panel - always dark orange with brand identity
 */
export const ELE_LOGO_RED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g>
    <!-- Background rounded square for logo container -->
    <rect x="8" y="20" width="84" height="60" rx="8" fill="none" stroke="#D97757" stroke-width="3" opacity="0.3"/>

    <!-- ELE letters -->
    <g fill="#D97757" transform="translate(15, 32)">
      <!-- E -->
      <rect x="0" y="0" width="18" height="6"/>
      <rect x="0" y="0" width="6" height="36"/>
      <rect x="0" y="15" width="14" height="6"/>
      <rect x="0" y="30" width="18" height="6"/>

      <!-- L -->
      <rect x="24" y="0" width="6" height="36"/>
      <rect x="24" y="30" width="14" height="6"/>

      <!-- E -->
      <rect x="44" y="0" width="18" height="6"/>
      <rect x="44" y="0" width="6" height="36"/>
      <rect x="44" y="15" width="14" height="6"/>
      <rect x="44" y="30" width="18" height="6"/>
    </g>

    <!-- Decorative accent dot -->
    <circle cx="82" cy="30" r="3" fill="#D97757" opacity="0.8"/>
  </g>
</svg>`;
