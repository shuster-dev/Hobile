/**
 * A one-pass colour grade.
 *
 * Bloom needs a downsample and several blur taps; on a mid-range phone that is
 * a real cost for an effect this art style barely uses. Almost all of the lift
 * comes from the cheap half: a contrast curve, a saturation push, warm lights
 * against cool shadows, and a vignette to hold the eye. That is one extra
 * render target and one fullscreen triangle, which a phone will not notice.
 */
import {
  Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
  LinearFilter, RGBAFormat, WebGLRenderTarget, Vector2,
} from 'three';

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
varying vec2 vUv;
uniform sampler2D tScene;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform vec3  uLift;      // pushed into the shadows
uniform vec3  uGain;      // pushed into the highlights
uniform float uNight;
uniform float uFlash;     // lightning, added flat

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;

  // Contrast around mid grey. A straight multiply crushes the blacks this
  // palette depends on, so it pivots instead.
  c = (c - 0.5) * uContrast + 0.5;

  // Split tone: warm where it is bright, cool where it is dark. This is most
  // of what makes a flat-shaded scene look photographed rather than filled.
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += uLift * (1.0 - luma) + uGain * luma;

  c = mix(vec3(luma), c, uSaturation);

  // Vignette, stronger at night, so the edge of the screen stops competing
  // with the character in the middle of it.
  vec2 d = vUv - 0.5;
  float v = 1.0 - dot(d, d) * (uVignette + uNight * 0.35);
  c *= clamp(v, 0.0, 1.0);

  // Lightning. Flat and after the vignette, because a strike lights the whole
  // frame including its corners — that is most of what tells the eye it came
  // from outside the scene rather than from something in it.
  c += uFlash;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export class Grade {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.enabled = opts.enabled !== false;
    this.target = new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat,
      depthBuffer: true, stencilBuffer: false,
    });
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.target.texture },
        uContrast: { value: opts.contrast ?? 1.1 },
        uSaturation: { value: opts.saturation ?? 1.12 },
        uVignette: { value: opts.vignette ?? 0.55 },
        uLift: { value: opts.lift ?? { x: -0.012, y: -0.004, z: 0.028 } },
        uGain: { value: opts.gain ?? { x: 0.030, y: 0.014, z: -0.014 } },
        uNight: { value: 0 },
        uFlash: { value: 0 },
      },
    });
    // What the grade looks like with nothing happening. Weather and season bend
    // these; without a copy of the originals every bend would compound on the
    // last one and a week of overcast would end up monochrome.
    this.base = {
      contrast: this.material.uniforms.uContrast.value,
      saturation: this.material.uniforms.uSaturation.value,
    };
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this._size = new Vector2();
  }

  setNight(n) { this.material.uniforms.uNight.value = n; }

  setFlash(v) { this.material.uniforms.uFlash.value = v; }

  /** Bend contrast and saturation away from the base, never from the current. */
  setMood({ contrast = 1, saturation = 1 } = {}) {
    this.material.uniforms.uContrast.value = this.base.contrast * contrast;
    this.material.uniforms.uSaturation.value = this.base.saturation * saturation;
  }

  /** Render the scene through the grade, or straight to the screen when off. */
  render(scene, camera) {
    if (!this.enabled) { this.renderer.render(scene, camera); return; }
    this.renderer.getDrawingBufferSize(this._size);
    if (this.target.width !== this._size.x || this.target.height !== this._size.y) {
      this.target.setSize(this._size.x, this._size.y);
    }
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(prev);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
