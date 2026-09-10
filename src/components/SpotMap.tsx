import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Spot } from '../types/spot'

// Leaflet's default marker looks for its PNGs relative to the CSS file,
// which bundlers break. Point it at the copies Vite serves from node_modules.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const SEOUL_CENTER: L.LatLngTuple = [37.5665, 126.978]

export function SpotMap({
  spots,
  onSelect,
}: {
  spots: Spot[]
  onSelect: (spot: Spot) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, { zoomControl: false }).setView(SEOUL_CENTER, 13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const markers = spots.map((spot) =>
      L.marker([spot.viewpoint.lat, spot.viewpoint.lng])
        .addTo(map)
        .bindTooltip(spot.name.ko)
        .on('click', () => onSelect(spot)),
    )
    if (markers.length > 0) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3), { maxZoom: 15, animate: false })
    }

    return () => {
      map.remove()
    }
  }, [spots, onSelect])

  return <div ref={container} className="h-full w-full" />
}
