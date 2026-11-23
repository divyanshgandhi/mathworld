import * as THREE from "three";
import { canvasTexture } from "@/engine/materials";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import type { Stop } from "@/director/hub";
import { makeBody, starfield, type Body } from "./planets";

/**
 * The Solar System map (SPEC §2.5): the Sun on the left, then Mercury and Venus (warm-ups) and the
 * frontier from Earth out to Deep Space, in a line the camera glides along. Locked planets are dark
 * silhouettes with a faint rim, cleared ones glow warm with a gold ring, the frontier has a lime ring.
 * The HUD scrolls it (wheel, drag, arrows, swipe) and pins a label under each planet: `stop:<id>`.
 */
const SPACING = 10;
const RADIUS: Record<Stop["id"], number> = {
  mercury: 1.0, venus: 1.45, earth: 1.6, moon: 0.85, mars: 1.25, "asteroid-belt": 1.9, jupiter: 2.9, saturn: 2.3, uranus: 1.8, "deep-space": 2.0,
};

function ringSprite(colour: string, alpha = 1) {
  const { texture, ctx } = canvasTexture(256, 256);
  ctx.strokeStyle = colour; ctx.globalAlpha = alpha; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.stroke();
  texture.needsUpdate = true;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

export function mountSolarMap(stage: Stage, init: Stop[]) {
  const { scene, camera, mats: M } = stage, rnd = seeded(19), root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(0x02030a);
  scene.fog = null;
  camera.fov = 40;
  camera.far = 3000;
  camera.updateProjectionMatrix();
  Object.assign(stage.bloom, { strength: 0.6, radius: 0.5, threshold: 1.0 });
  stage.renderer.toneMappingExposure = 1.05;

  const sun = makeBody(M, "sun", 7);
  sun.group.position.set(-SPACING * 1.25, 0, -4);
  root.add(sun.group, starfield(2400, 600, rnd));
  const light = new THREE.PointLight(0xfff0d8, 2.6, 0, 0);
  light.position.copy(sun.group.position);
  root.add(light, new THREE.AmbientLight(0x8090c0, 0.55));

  // the track the planets sit on
  const track = new THREE.Mesh(new THREE.PlaneGeometry(SPACING * (init.length + 1.5), 0.05), new THREE.MeshBasicMaterial({ color: 0x5060a0, transparent: true, opacity: 0.4 }));
  track.position.set((SPACING * (init.length - 1)) / 2 - SPACING * 0.4, 0, -0.5);
  root.add(track);

  interface View { stop: Stop; body: Body; x: number; ring: THREE.Sprite; rim: THREE.Sprite; base: THREE.Color[] }
  const views: View[] = init.map((stop, i) => {
    const r = RADIUS[stop.id], body = makeBody(M, stop.id, r, { glow: 0.3 }), x = i * SPACING;
    body.group.position.set(x, 0, 0);
    root.add(body.group);
    const ring = ringSprite("#ffffff");
    ring.scale.setScalar(r * 3.1);
    body.group.add(ring);
    const rim = ringSprite("#8ea0d8", 0.8);
    rim.scale.setScalar(r * 2.45);
    body.group.add(rim);
    return { stop, body, x, ring, rim, base: body.mats.map((m) => m.color.clone()) };
  });

  function setStops(stops: Stop[]) {
    stops.forEach((s, i) => {
      const v = views[i];
      if (!v) return;
      v.stop = s;
      const locked = s.status === "locked", warm = s.status === "cleared" || s.status === "ace";
      v.body.mats.forEach((m, k) => {
        m.color.copy(locked ? new THREE.Color(0x0b0e1a) : v.base[k]);
        m.emissiveIntensity = locked ? 0 : warm ? 0.5 : 0.3;
        if (warm) m.emissive.setHex(0xffe2b0); else m.emissive.setHex(0xffffff);
      });
      v.rim.visible = locked;
      v.ring.visible = s.status !== "locked" && s.status !== "open";
      (v.ring.material as THREE.SpriteMaterial).color.set(s.status === "frontier" ? 0xbef264 : warm ? 0xfbbf24 : 0x7dd3fc);
    });
  }
  setStops(init);

  let target = 0, x = 0, drag = 0;
  const maxX = (views.length - 1) * SPACING;
  const stop = stage.onUpdate((dt, T) => {
    sun.spin.rotation.y += dt * 0.05;
    for (const v of views) {
      v.body.spin.rotation.y += dt * 0.25;
      const pulse = v.stop.status === "frontier" ? 1 + Math.sin(T * 3) * 0.06 : 1;
      v.ring.scale.setScalar(v.body.radius * 3.1 * pulse);
    }
    x += (Math.max(-SPACING * 0.6, Math.min(maxX + SPACING * 0.3, target + drag)) - x) * Math.min(1, dt * 4);
    // phones (portrait) see fewer planets at once, from a little further back
    const dist = camera.aspect < 1 ? 44 : 34;
    camera.position.set(x, 4.5, dist);
    camera.lookAt(x, -0.4, 0);
  });

  return {
    setStops,
    /** Centre a stop (by index). */
    focus(i: number) { target = Math.max(0, Math.min(views.length - 1, i)) * SPACING; drag = 0; },
    /** Glide by `dx` world units (wheel, drag): released, it settles on the nearest stop. */
    pan(dx: number) { drag += dx; },
    settle() { const i = Math.round((target + drag) / SPACING); this.focus(i); return Math.max(0, Math.min(views.length - 1, i)); },
    get index() { return Math.round(x / SPACING); },
    anchor(id: string): THREE.Vector3 | null {
      const v = views.find((w) => `stop:${w.stop.id}` === id);
      return v ? new THREE.Vector3(v.x, -v.body.radius - 1.1, 0) : null;
    },
    dispose() { stop(); scene.remove(root); },
  };
}
export type SolarMapScene = ReturnType<typeof mountSolarMap>;
