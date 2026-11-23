import * as THREE from "three";

export type V3 = [number, number, number];

/**
 * A film camera: `shot()` sets where to look from and at. With speed 0 it cuts; otherwise it
 * glides there. Scenes that animate the camera on a path write `p` and `l` directly.
 */
export class CameraRig {
  readonly p = new THREE.Vector3();
  readonly l = new THREE.Vector3();
  private tp = new THREE.Vector3();
  private tl = new THREE.Vector3();
  private k = 0;
  sway = 0;

  shot(p: V3, l: V3, speed = 2.5) {
    this.tp.set(...p);
    this.tl.set(...l);
    this.k = speed;
    if (!speed) { this.p.copy(this.tp); this.l.copy(this.tl); }
  }

  /** Hand control to a path: the scene sets p and l every frame. */
  hold() { this.k = 0; }

  apply(camera: THREE.Camera, dt: number, t: number) {
    if (this.k > 0) {
      const f = 1 - Math.exp(-dt * this.k);
      this.p.lerp(this.tp, f);
      this.l.lerp(this.tl, f);
    }
    camera.position.set(this.p.x + Math.sin(t * 0.3) * 0.04 * this.sway, this.p.y + Math.sin(t * 0.45) * 0.025 * this.sway, this.p.z);
    camera.lookAt(this.l);
  }
}
