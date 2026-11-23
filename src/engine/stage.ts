import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Materials } from "./materials";

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
  onUpdate(fn: Update): void;
  /** Advance time by hand (tests, debugging, or a hidden tab) and render once. */
  step(seconds: number): void;
  readonly time: number;
  dispose(): void;
}

/** One canvas, one scene, one camera, clay-friendly lighting defaults and the bloom + grade post chain. */
export function createStage(container: HTMLElement, { aspect = 0.58 } = {}): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.display = "block";
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1.7, 0.05, 3000);
  scene.add(camera);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);

  const size = () => {
    const w = container.clientWidth || 680, h = Math.round(w * aspect);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(size);
  ro.observe(container);
  size();

  const updates: Update[] = [];
  let time = 0, last = performance.now(), raf = 0;
  const advance = (dt: number) => {
    time += dt;
    for (const fn of updates) fn(dt, time);
  };
  const tick = (now: number) => {
    advance(Math.min((now - last) / 1000, 0.05));
    last = now;
    composer.render();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const mats = new Materials();
  return {
    container, renderer, scene, camera, mats, bloom,
    grade: gradePass.uniforms as unknown as Stage["grade"],
    onUpdate: (fn) => void updates.push(fn),
    step(seconds) {
      for (let i = 0; i < seconds * 60; i++) advance(1 / 60);
      composer.render();
    },
    get time() { return time; },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      composer.dispose();
      mats.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
