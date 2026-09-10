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
