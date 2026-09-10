import type { Spot } from '../types/spot'

// spots/*.json live at the repo root, outside src/, so the same files are
// shared by the validator script and by any future non-web client.
const modules = import.meta.glob<Spot>('../../spots/*.json', {
  eager: true,
  import: 'default',
})

export const spots: Spot[] = Object.values(modules).sort((a, b) =>
  a.id.localeCompare(b.id),
)

export function findSpot(id: string): Spot | undefined {
  return spots.find((s) => s.id === id)
}

/** Images are served from public/spots/<id>/ so they are plain static files
 *  and never bundled. BASE_URL keeps this correct under the GitHub Pages
 *  sub-path. */
export function spotImageUrl(spot: Spot, file: string): string {
  return `${import.meta.env.BASE_URL}spots/${spot.id}/${file}`
}
