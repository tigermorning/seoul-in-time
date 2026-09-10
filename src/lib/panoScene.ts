// 안 B — the past as a sphere around the viewer (BENCHMARK_CITY_IN_TIME.md
// §7.3). Every historical photo of a spot is hung in the world at its own
// bearing: an equirect panorama becomes the inside of a sphere, an ordinary
// photograph becomes a flat card at `view.heading_deg` sized by `hfov_deg`.
// The camera sits at the origin and is turned by the phone's compass.
//
// Conventions (match heading.ts): bearings clockwise from true north. In the
// three.js scene +Y is up, north is -Z, east is +X, so a bearing b maps to
// direction (sin b, 0, -cos b) and a camera yaw of -b radians.
import * as THREE from 'three'

const DEG = Math.PI / 180
const RADIUS = 50

export interface PanoPhotoSpec {
  url: string
  projection: 'flat' | 'equirect'
  headingDeg: number
  pitchDeg: number
  /** Ignored for equirect. */
  hfovDeg: number
}

export interface PanoView {
  headingDeg: number
  pitchDeg: number
  rollDeg: number
  /** Horizontal field of view of the screen. */
  hfovDeg: number
}

export class PanoScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, RADIUS * 4)
  private loader = new THREE.TextureLoader()
  private disposables: { dispose(): void }[] = []
  private raf = 0
  private dirty = true

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.scene.background = new THREE.Color(0x0a0a0a)
    this.camera.rotation.order = 'YXZ'
    this.loop()
  }

  /** Call whenever the canvas element's CSS size changes. */
  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  addPhoto(spec: PanoPhotoSpec, onError?: () => void) {
    this.loader.load(
      spec.url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        const mesh = spec.projection === 'equirect' ? this.sphere(tex, spec) : this.card(tex, spec)
        this.scene.add(mesh)
        this.disposables.push(tex, mesh.geometry, mesh.material as THREE.Material)
        this.dirty = true
      },
      undefined,
      () => onError?.(),
    )
  }

  private sphere(tex: THREE.Texture, spec: PanoPhotoSpec): THREE.Mesh {
    const geo = new THREE.SphereGeometry(RADIUS, 64, 32)
    geo.scale(-1, 1, 1) // look at it from the inside
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    const mesh = new THREE.Mesh(geo, mat)
    // With the sphere mirrored, texture column u=0.5 faces -X. Rotate so the
    // image's centre column faces the photo's heading instead.
    mesh.rotation.y = (-90 - spec.headingDeg) * DEG
    return mesh
  }

  private card(tex: THREE.Texture, spec: PanoPhotoSpec): THREE.Mesh {
    const img = tex.image as { width: number; height: number }
    const dist = RADIUS * 0.9
    const width = 2 * dist * Math.tan((spec.hfovDeg / 2) * DEG)
    const height = width * (img.height / img.width)
    const geo = new THREE.PlaneGeometry(width, height)
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geo, mat)
    const b = spec.headingDeg * DEG
    const p = spec.pitchDeg * DEG
    mesh.position.set(dist * Math.cos(p) * Math.sin(b), dist * Math.sin(p), -dist * Math.cos(p) * Math.cos(b))
    mesh.lookAt(0, 0, 0)
    return mesh
  }

  setView(v: PanoView) {
    // Horizontal → vertical FOV for the current aspect.
    const vfov = 2 * Math.atan(Math.tan((v.hfovDeg / 2) * DEG) / this.camera.aspect)
    this.camera.fov = vfov / DEG
    this.camera.updateProjectionMatrix()
    // YXZ: yaw about world up, then pitch, then roll about the view axis.
    // Roll: the phone's top leaning right (roll > 0) turns the camera
    // clockwise as seen by the viewer, which is a negative rotation about
    // the camera's +Z (which points at the viewer).
    this.camera.rotation.set(v.pitchDeg * DEG, -v.headingDeg * DEG, -v.rollDeg * DEG)
    this.dirty = true
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    if (!this.dirty) return
    this.dirty = false
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
  }
}
