import * as THREE from "three";
import { add, canvasTexture, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";

export const EARTH_RADIUS = 30;

/** Earth from orbit: painted continents, drifting clouds, a fresnel atmosphere, the Moon and a starfield. */
export function buildEarth(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3) {
  const R = EARTH_RADIUS, off = { cast: false, recv: false };
  const map = canvasTexture(1024, 512);
  {
    const x = map.ctx, g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#4a86c8"); g.addColorStop(0.5, "#2c69b0"); g.addColorStop(1, "#4a86c8");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    const blob = (cx: number, cy: number, r: number, col: string, n: number) => {
      x.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.28, d = rnd() * r;
        x.beginPath(); x.arc(cx + Math.cos(a) * d * 1.7, cy + Math.sin(a) * d, r * (0.22 + rnd() * 0.32), 0, 7); x.fill();
      }
    };
    for (const [cx, cy, r] of [[190, 170, 62], [255, 330, 52], [520, 150, 52], [565, 300, 62], [770, 180, 82], [870, 360, 42], [120, 420, 24], [960, 120, 30]]) {
      blob(cx, cy, r, "#6fb86c", 30); blob(cx + 8, cy + 6, r * 0.6, "#93c76e", 18); blob(cx - 6, cy - 4, r * 0.32, "#d9c58f", 10);
    }
    x.fillStyle = "#f4f8fb"; x.fillRect(0, 0, 1024, 26); x.fillRect(0, 486, 1024, 26);
    map.texture.needsUpdate = true;
  }
  const earth = add(scene, new THREE.SphereGeometry(R, 96, 64), M.clay(0xffffff, { map: map.texture, roughness: 0.75 }), at.x, at.y, at.z, off);
  earth.rotation.z = 0.4;

  const cl = canvasTexture(1024, 512);
  for (let i = 0; i < 160; i++) {
    const cx = rnd() * 1024, cy = 40 + rnd() * 432;
    cl.ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.4})`;
    for (let k = 0; k < 4; k++) { cl.ctx.beginPath(); cl.ctx.ellipse(cx + rnd() * 40, cy + rnd() * 10, 14 + rnd() * 30, 5 + rnd() * 9, 0, 0, 7); cl.ctx.fill(); }
  }
  cl.texture.needsUpdate = true;
  const clouds = add(scene, new THREE.SphereGeometry(R * 1.015, 96, 64), new THREE.MeshStandardMaterial({ map: cl.texture, transparent: true, depthWrite: false, roughness: 1 }), at.x, at.y, at.z, off);

  const atmosphere = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0x7fc4ff) } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform vec3 c;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-max(dot(vN,vV),0.0),2.4);gl_FragColor=vec4(c*f*2.2,f);}",
  });
  add(scene, new THREE.SphereGeometry(R * 1.07, 64, 48), atmosphere, at.x, at.y, at.z, off);
  add(scene, new THREE.SphereGeometry(7, 48, 32), M.clay(0xcfc9d6, { roughness: 0.95 }), at.x + 70, at.y + 24, at.z - 60, off);

  const sp: number[] = [];
  for (let i = 0; i < 2200; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(900).add(at);
    sp.push(v.x, v.y, v.z);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false })));

  const sun = new THREE.DirectionalLight(0xfff4e6, 0);
  sun.position.set(at.x - 120, at.y + 50, at.z + 120);
  sun.target.position.copy(at);
  scene.add(sun, sun.target);

  return {
    sun,
    update(dt: number) {
      earth.rotation.y += dt * 0.05;
      clouds.rotation.y += dt * 0.065;
    },
  };
}
