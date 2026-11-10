import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { CourseEntry, Lang } from '../lib/course'
import { stopName } from '../lib/course'

// Numbered pins in walking order. The dashed line only shows the order of
// stops; it is not the walking path.
export function CourseMap({
  course,
  lang,
  onSelect,
}: {
  course: CourseEntry[]
  lang: Lang
  onSelect: (entry: CourseEntry) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const map = L.map(container.current, { zoomControl: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    const points = course.map((e) => [e.spot.viewpoint.lat, e.spot.viewpoint.lng] as L.LatLngTuple)
    L.polyline(points, { color: '#9a3412', weight: 4, opacity: 0.9, dashArray: '6 8' }).addTo(map)

    course.forEach((entry) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:9999px;background:#fbbf24;color:#000;font:600 14px/28px system-ui;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.6)">${entry.index + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      L.marker([entry.spot.viewpoint.lat, entry.spot.viewpoint.lng], { icon, title: stopName(entry, lang) })
        .addTo(map)
        .bindTooltip(stopName(entry, lang))
        .on('click', () => onSelect(entry))
    })
    map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: false })

    return () => {
      map.remove()
    }
  }, [course, lang, onSelect])

  return <div ref={container} className="h-full w-full" />
}
