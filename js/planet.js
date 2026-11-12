// Dithered gas-giant planet, rendered with a WebGL fragment shader.
// Turbulent bands with differential rotation, crescent lighting, then an ordered (Bayer)
// dither so tone becomes dot density. Exposes window.GasGiant.
(() => {
  'use strict';

  const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2  uCenter;   // planet centre in canvas pixels (GL coords, y up)
uniform float uRadius;   // planet radius in canvas pixels
uniform float uTime;
uniform vec3  uSun;      // light direction, view space (x right, y up, z toward viewer)
uniform float uTilt;     // axial tilt in the screen plane (radians)
uniform vec3  uC0, uC1, uC2, uC3;   // band palette, light → dark
uniform vec3  uPole, uDot;          // pole tint, dot colour
uniform float uCell;     // dither dot size in canvas pixels
uniform float uSpin;     // rotation speed multiplier
const float DITHER_MIX = 0.82;  // 1 = pure 1-bit dots, 0 = smooth shading
const float EDGE_GLOW = 0.22;     // extra brightness on the lit edge
const float PLANET_GAIN = 1.0;    // overall planet brightness (1 = full)

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i),                   hash(i + vec3(1.,0.,0.)), f.x),
                 mix(hash(i + vec3(0.,1.,0.)),  hash(i + vec3(1.,1.,0.)), f.x), f.y),
             mix(mix(hash(i + vec3(0.,0.,1.)),  hash(i + vec3(1.,0.,1.)), f.x),
                 mix(hash(i + vec3(0.,1.,1.)),  hash(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
// Interleaved-gradient-noise dither thresholds: an even grain, no square grid (matches the asteroids)
float ign(vec2 a) { a = floor(a); return fract(52.9829189 * fract(dot(a, vec2(0.06711056, 0.00583715)))); }

vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, c*v.y - s*v.z, s*v.y + c*v.z); }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }
vec3 rotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c*v.x - s*v.y, s*v.x + c*v.y, v.z); }

// Band palette from uniforms (light → dark)
vec3 palette(float t) {
  float a = 0.5 + 0.5 * sin(t);
  float b = 0.5 + 0.5 * sin(t * 2.3 + 1.3);
  float c = 0.5 + 0.5 * sin(t * 5.7 + 0.4);
  vec3 col = mix(uC0, uC1, a);
  col = mix(col, uC2, b * 0.55);
  col = mix(col, uC3, smoothstep(0.7, 1.0, c) * 0.5);
  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uRadius;
  float d = length(p);
  if (d > 1.0) { gl_FragColor = vec4(0.0); return; }

  float z = sqrt(max(0.0, 1.0 - d * d));
  vec3 n = vec3(p, z);

  // Orient the planet: tilt the axis in the screen, then lean the north pole toward us
  vec3 q = rotX(rotZ(n, uTilt), 0.3);
  float lat = asin(clamp(q.y, -1.0, 1.0));

  // Differential rotation: bands slide past each other
  float spin = uTime * uSpin * (0.012 + 0.008 * sin(lat * 7.0));
  vec3 s = rotY(q, spin);

  // Domain-warped turbulence, stretched along latitude
  vec3 st = s * vec3(2.2, 7.0, 2.2);
  vec2 w = vec2(fbm(st), fbm(st + 5.2));
  float turb = fbm(s * vec3(3.0, 18.0, 3.0) + vec3(w, w.x) * 1.2);
  float band = lat * 7.0 + (turb - 0.5) * 0.55 + (w.x - 0.5) * 0.25;

  vec3 col = palette(band);
  col *= 0.94 + 0.12 * fbm(s * vec3(5.0, 60.0, 5.0) + vec3(w, 0.0) * 1.5);  // fine gassy streaks
  col = mix(col, uPole, smoothstep(0.6, 1.0, abs(q.y)) * 0.55);              // muted poles

  // Crescent lighting: sun mostly behind-left, so only the upper-left edge is lit
  float ndl = dot(n, normalize(uSun));
  float diff = smoothstep(-0.05, 0.75, ndl);
  float limb = mix(0.55, 1.0, pow(z, 0.5));
  vec3 lit = col * (0.03 + 0.8 * diff) * limb;
  float rim = pow(1.0 - z, 2.5) * smoothstep(0.0, 0.6, ndl);
  lit += uDot * rim * EDGE_GLOW;                                             // haze on the lit edge

  // Ordered dither: tone becomes dot density, with a little smooth tone blended back in
  float L = pow(clamp(dot(lit, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), 1.25);
  float on = step(ign(gl_FragCoord.xy / uCell) + 0.02, L * 1.15);         // +0.02 keeps the night side black
  vec3 outc = uDot * mix(L * 1.15, on, DITHER_MIX) * PLANET_GAIN;

  gl_FragColor = vec4(outc, 1.0);   // solid disc: hides stars + far-side asteroids behind it
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('Planet shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function create(canvas, colors) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    for (const name of ['uCenter', 'uRadius', 'uTime', 'uSun', 'uTilt', 'uC0', 'uC1', 'uC2', 'uC3', 'uPole', 'uDot', 'uCell', 'uSpin']) {
      u[name] = gl.getUniformLocation(prog, name);
    }
    for (const k of ['C0', 'C1', 'C2', 'C3', 'Pole', 'Dot']) gl.uniform3fv(u['u' + k], colors[k]);
    gl.uniform3f(u.uSun, -0.78, 0.42, -0.55);   // mostly behind-left → crescent
    gl.uniform1f(u.uTilt, -0.22);
    gl.uniform1f(u.uSpin, 4);                    // dots hide slow drift, so turn fast enough to read as moving

    return {
      // Size the canvas to just the visible part of the planet (CSS px), then set uniforms.
      resize({ cx, cy, R, W, H }) {
        // One canvas pixel per ~1.5 CSS px dot, but always a whole number of *device* pixels —
        // otherwise the pixelated upscale mixes 1px and 2px dots into uneven squares/moiré.
        const sys = window.devicePixelRatio || 1;
        const k = Math.max(1, Math.round(1.5 * sys));   // device pixels per dot
        const dpr = sys / k;                            // canvas pixels per CSS px
        const left = Math.max(0, Math.floor(cx - R - 2));
        const top = Math.max(0, Math.floor(cy - R - 2));
        const right = Math.min(W, Math.ceil(cx + R + 2));
        const bottom = Math.min(H, Math.ceil(cy + R + 2));
        canvas.width = Math.max(1, Math.ceil((right - left) * dpr));
        canvas.height = Math.max(1, Math.ceil((bottom - top) * dpr));
        const w = canvas.width / dpr, h = canvas.height / dpr;   // exact multiple of the dot size
        Object.assign(canvas.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(u.uCenter, (cx - left) * dpr, (top + h - cy) * dpr);
        gl.uniform1f(u.uRadius, R * dpr);
        gl.uniform1f(u.uCell, 1.0);                                   // each canvas pixel is one dot
      },
      render(t) {
        gl.uniform1f(u.uTime, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  window.GasGiant = { create };
})();
