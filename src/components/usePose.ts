import { useEffect, useState } from 'react'
import { smoothBearing, smoothLinear } from '../lib/heading'
import { subscribeCameraPose, type CameraPose, type HeadingSource } from '../lib/sensors'

export interface SmoothedPose {
  /** Smoothed MAGNETIC heading; declination is the caller's decision. */
  heading: number | null
  pitch: number | null
  roll: number | null
  gotAnyReading: boolean
  source: HeadingSource
  last: CameraPose | null
}

const EMPTY: SmoothedPose = { heading: null, pitch: null, roll: null, gotAnyReading: false, source: 'none', last: null }

/** Subscribes to the orientation sensors while `active` and returns the
 *  smoothed pose. Pitch/roll update even when the heading is untrustworthy. */
export function usePose(active: boolean): SmoothedPose {
  const [pose, setPose] = useState<SmoothedPose>(EMPTY)

  useEffect(() => {
    if (!active) return
    let sHeading: number | null = null
    let sPitch: number | null = null
    let sRoll: number | null = null
    return subscribeCameraPose((p) => {
      if (p.pitch !== null) sPitch = smoothLinear(sPitch, p.pitch)
      if (p.roll !== null) sRoll = smoothLinear(sRoll, p.roll)
      const hasHeading = p.magneticHeading !== null
      if (hasHeading) sHeading = smoothBearing(sHeading, p.magneticHeading as number)
      setPose((prev) => ({
        heading: sHeading,
        pitch: sPitch,
        roll: sRoll,
        gotAnyReading: prev.gotAnyReading || hasHeading,
        source: hasHeading ? p.source : prev.source,
        last: p,
      }))
    })
  }, [active])

  return pose
}
