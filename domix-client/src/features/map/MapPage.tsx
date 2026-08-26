import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import 'leaflet/dist/leaflet.css'
import { useApartments } from '@/hooks/useApartments'
import { apartmentMarkerIcon, userMarkerIcon } from '@/features/map/markerIcon'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Apartment } from '@/types/api'

/** Israel-wide default view, used until real listings (or the visitor's location) narrow it. */
const DEFAULT_CENTER: [number, number] = [31.7683, 35.2137]
const DEFAULT_ZOOM = 7

function hasCoordinates(apartment: Apartment): apartment is Apartment & { latitude: number; longitude: number } {
  return typeof apartment.latitude === 'number' && typeof apartment.longitude === 'number'
}

/** Frames every pin on first load, then re-centers whenever the selection changes. */
function MapController({ apartments, selected }: { apartments: Apartment[]; selected: Apartment | null }) {
  const map = useMap()

  useEffect(() => {
    if (apartments.length === 0) return
    const bounds: [number, number][] = apartments.map((a) => [a.latitude!, a.longitude!])
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    // Only on first load with data — subsequent selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartments.length > 0])

  useEffect(() => {
    if (selected?.latitude != null && selected.longitude != null) {
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 })
    }
  }, [selected, map])

  return null
}

export default function MapPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useApartments()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const listings = useMemo(() => (data ?? []).filter(hasCoordinates), [data])
  const selected = useMemo(() => listings.find((a) => a.apartmentId === selectedId) ?? null, [listings, selectedId])

  const [userPosition, setUserPosition] = useState<[number, number] | null>(null)
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  if (isLoading) {
    return (
      <div className="grid h-[calc(100svh-8rem)] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        <Skeleton className="h-full w-full" />
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  if (isError) {
    return <EmptyState title={t('apartments.loadError')} />
  }

  return (
    <div className="grid h-[calc(100svh-8rem)] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
      <aside className="flex flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-3 lg:order-1">
        <h1 className="px-1 text-base font-semibold text-foreground">{t('map.title')}</h1>
        {listings.length === 0 ? (
          <p className="px-1 text-sm text-muted">{t('map.noPinned')}</p>
        ) : (
          listings.map((apartment) => (
            <button
              key={apartment.apartmentId}
              type="button"
              onClick={() => setSelectedId(apartment.apartmentId)}
              onDoubleClick={() => navigate(`/apartments/${apartment.apartmentId}`)}
              className={cn(
                'rounded-lg border p-3 text-start transition-colors',
                selectedId === apartment.apartmentId
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-card-muted hover:border-border',
              )}
            >
              <p className="text-sm font-semibold text-foreground">{formatCurrency(apartment.price, i18n.language)}</p>
              <p className="truncate text-xs text-muted">
                {apartment.address}, {apartment.city}
              </p>
            </button>
          ))
        )}
      </aside>

      {/* `isolate` gives Leaflet's own z-index:1000 controls a stacking context they
          can't escape — without it they render above the app's sticky header (z-40),
          covering things like the theme switcher. */}
      <div className="isolate overflow-hidden rounded-xl border border-border lg:order-2">
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <MapController apartments={listings} selected={selected} />

          {userPosition && (
            <Marker position={userPosition} icon={userMarkerIcon()}>
              <Popup>{t('map.youAreHere')}</Popup>
            </Marker>
          )}

          {listings.map((apartment) => (
            <Marker
              key={apartment.apartmentId}
              position={[apartment.latitude, apartment.longitude]}
              icon={apartmentMarkerIcon(apartment.apartmentId === selectedId)}
              eventHandlers={{ click: () => setSelectedId(apartment.apartmentId) }}
            >
              <Popup>
                <div className="flex flex-col gap-0.5">
                  <strong>{formatCurrency(apartment.price, i18n.language)}</strong>
                  <span>
                    {apartment.address}, {apartment.city}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/apartments/${apartment.apartmentId}`)}
                    className="mt-1 text-start text-primary underline"
                  >
                    {t('apartments.card.viewDetails')}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
