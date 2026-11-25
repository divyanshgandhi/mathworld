import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Materials } from "./materials";
import { LOOKS } from "@/worlds/looks";

/** Colour grade after tone mapping: saturation, tint and a soft vignette. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, vig: { value: 0.3 } },
  vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:
    "uniform sampler2D tDiffuse;uniform float sat;uniform vec3 tint;uniform float vig;varying vec2 vUv;" +
    "void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722));vec3 col=mix(vec3(l),c.rgb,sat)*tint;" +
    "float d=distance(vUv,vec2(0.5));col*=1.0-vig*smoothstep(0.35,0.85,d);gl_FragColor=vec4(col,c.a);}",
};

export type Update = (dt: number, t: number) => void;

export interface Stage {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  mats: Materials;
  bloom: UnrealBloomPass;
  grade: { sat: { value: number }; tint: { value: THREE.Vector3 }; vig: { value: number } };
  /** Run `fn` every frame; returns a function that stops it. */
  onUpdate(fn: Update): () => void;
  /** Advance time by hand (tests, debugging, or a hidden tab) and render once. */
  step(seconds: number): void;
  readonly time: number;
  /** Freeze the clock (frames still render): for inspecting a shot with `step`. */
  paused: boolean;
  dispose(): void;
}

/**
 * One canvas, one scene, one camera, the space look's defaults and the bloom + grade post chain.
 * `fill` sizes the canvas to the container's box (a full-screen game); otherwise height = width × aspect.
 */
export function createStage(container: HTMLElement, { aspect = 0.58, fill = false } = {}): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap is gone in this three.js; lights soften with shadow.radius
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.display = "block";
  container.prepend(renderer.domElement);

  // every stage starts in the space look (src/worlds/looks.ts); a scene switches look with applyLook
  const start = LOOKS.space;
  renderer.toneMappingExposure = start.exposure;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(start.background);
  const camera = new THREE.PerspectiveCamera(48, 1.7, 0.05, 3000);
  scene.add(camera);

  // the post chain renders into a multisampled target so thin edges do not crawl when the camera moves
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  rt.texture.name = "EffectComposer.rt1";
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), start.bloom.strength, start.bloom.radius, start.bloom.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const gradePass = new ShaderPass(GradeShader);
  gradePass.uniforms.sat.value = start.sat;
  gradePass.uniforms.vig.value = start.vignette;
  composer.addPass(gradePass);

  const size = () => {
    const w = container.clientWidth || 680, h = fill ? container.clientHeight || Math.round(w * aspect) : Math.round(w * aspect);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size);
  ro.observe(container);
  size();

  const updates: Update[] = [];
  let time = 0, last = performance.now(), raf = 0, paused = false;
  const advance = (dt: number) => {
    time += dt;
    for (const fn of updates) fn(dt, time);
  };
  const tick = (now: number) => {
    if (!paused) advance(Math.min((now - last) / 1000, 0.05));
    last = now;
    composer.render();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  // a hidden or starved tab gets few or no animation frames: keep the game clock (and its timers) moving anyway
  const hiddenTick = window.setInterval(() => {
    const now = performance.now();
    if (!document.hidden && now - last < 150) return;
    if (!paused) advance(Math.min((now - last) / 1000, 0.25));
    last = now;
    composer.render();
  }, 50);

  const mats = new Materials();
  return {
    container, renderer, scene, camera, mats, bloom,
    grade: gradePass.uniforms as unknown as Stage["grade"],
    onUpdate(fn) {
      updates.push(fn);
      return () => { const i = updates.indexOf(fn); if (i >= 0) updates.splice(i, 1); };
    },
    step(seconds) {
      for (let i = 0; i < seconds * 60; i++) advance(1 / 60);
      composer.render();
    },
    get time() { return time; },
    get paused() { return paused; },
    set paused(v) { paused = v; },
    dispose() {
      cancelAnimationFrame(raf);
      window.clearInterval(hiddenTick);
      ro.disconnect();
      composer.dispose();
      mats.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
