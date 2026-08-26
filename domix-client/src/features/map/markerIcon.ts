import L from 'leaflet'

/**
 * Custom teardrop pin as a divIcon rather than Leaflet's default `L.Icon` —
 * the default relies on bundler-resolved image URLs that Vite doesn't wire up
 * automatically, a well-known Leaflet+bundler footgun. Using `var(--color-*)`
 * means the pin follows whatever palette/theme is active, since this HTML is
 * injected straight into the live document rather than isolated in React.
 */
export function apartmentMarkerIcon(active: boolean): L.DivIcon {
  const size = active ? 40 : 30
  const fill = active ? 'var(--color-primary)' : 'var(--color-foreground)'

  return L.divIcon({
    className: 'domix-marker',
    html: `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
        <path d="M12 0C7.03 0 3 4.03 3 9c0 6.5 9 15 9 15s9-8.5 9-15c0-4.97-4.03-9-9-9z" fill="${fill}" />
        <circle cx="12" cy="9" r="3.5" fill="var(--color-card)" />
      </svg>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

export function userMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'domix-marker',
    html: `
      <span style="
        display: block; width: 16px; height: 16px; border-radius: 9999px;
        background: var(--color-primary); border: 3px solid var(--color-card);
        box-shadow: 0 0 0 2px var(--color-primary), 0 2px 6px rgba(0,0,0,0.4);
      "></span>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}
