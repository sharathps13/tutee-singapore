/* The Marina Bay scene for the hero, rendered with three.js.
   Geometry and baked ambient occlusion come from Blender (_source/hero3d/build_marina_bay.py -> assets/3d/).
   Everything that changes with the time of day is live: the sky and the reflections it gives, the sun and its
   shadows, the water, the lights at night. sg-hero3d.js owns the camera, the UI and the clock and calls render(). */
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from '../vendor/three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from '../vendor/three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from '../vendor/three/addons/postprocessing/OutputPass.js';
import {Water} from '../vendor/three/addons/objects/Water.js';
import {mergeGeometries} from '../vendor/three/addons/utils/BufferGeometryUtils.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const mixC = (a, b, t) => a.clone().lerp(b, t);

/* uniforms every patched material shares */
const G = {uNight: {value: 0}, uTime: {value: 0}, uDusk: {value: 0}};
const HI = [{value: 0}, {value: 0}, {value: 0}, {value: 0}];   // study, fund, work, live

/* ------------------------------------------------------------------ material patching
   One small shader layer on top of MeshStandardMaterial: world-space facades (curtain-wall panes, spandrels and
   mullions, anti-aliased with fwidth and faded to their average when a floor is under a pixel), lit windows at
   night, landmark lighting, and the gold rim that highlights a landmark when its pin is hovered. */
const COMMON = /* glsl */`
varying vec3 vWP; varying vec3 vWN;
uniform float uNight, uTime, uDusk, uHi;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
`;
function patch(mat, kind, o = {}) {
  const uni = Object.assign({}, G, {uHi: o.hi || {value: 0}, uCell: {value: new THREE.Vector2(o.cw || .25, o.fh || .35)},
    uLit: {value: o.lit ?? .45}, uFrame: {value: new THREE.Color(o.frame ?? 0x9aa3a6)}, uWarm: {value: new THREE.Color(o.warm ?? 0xffc98a)},
    uGlow: {value: new THREE.Color(o.glow ?? 0x000000)}, uSeed: {value: o.seed || 0}, uVary: {value: o.vary || 0}});
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n#ifdef USE_INSTANCING\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal);\n#else\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);\n#endif');
    let frag = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + COMMON +
      'uniform vec2 uCell;uniform float uLit,uSeed,uVary;uniform vec3 uFrame,uWarm,uGlow;\nfloat gPane=1.,gLit=0.,gRoof=0.;');
    if (kind === 'facade') {
      frag = frag.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 n=normalize(vWN);gRoof=step(.72,abs(n.y));
        vec2 hn=normalize(n.xz+1e-5);vec2 c=vec2(vWP.x*hn.y-vWP.z*hn.x,vWP.y)/uCell;
        vec2 f=fract(c),id=floor(c),w=fwidth(c);
        float mx=smoothstep(.0,w.x*1.5,f.x-.07)*smoothstep(.0,w.x*1.5,.93-f.x);
        float my=smoothstep(.0,w.y*1.5,f.y-.3)*smoothstep(.0,w.y*1.5,.94-f.y);
        float detail=1.-smoothstep(.3,.75,max(w.x,w.y));
        float seed=uSeed;
        #ifdef USE_COLOR_ALPHA
          seed+=vColor.a*97.;
        #endif
        gPane=mix(.66,mx*my,detail)*(1.-gRoof);
        float big=h21(floor(c/vec2(4.,3.))+seed*1.7);   /* glazing panels never reflect quite alike */
        diffuseColor.rgb*=.86+.28*big;
        /* a city of many buildings: each ~60 m block gets its own glass tint and lit-window pattern */
        float bh=h21(floor(vWP.xz/6.)+3.1);seed+=bh*53.*uVary;
        diffuseColor.rgb*=mix(vec3(1.),mix(vec3(.78,.9,1.02),vec3(1.12,1.04,.9),bh),uVary);
        float hh=h21(id+seed);
        /* far away, windows light up in clusters (4 x 3), so a distant skyline reads as dark towers with scattered
           lights rather than an evenly glowing slab; past that, the faint average */
        vec2 cc=c/vec2(4.,3.);float cdet=1.-smoothstep(.3,.75,max(fwidth(cc).x,fwidth(cc).y));
        float coarse=mix(uLit*.55,mix(uLit*.22,step(1.-uLit*.8,h21(floor(cc)+seed+11.))*.8,cdet),uVary);   /* landmarks keep a fine, even glow */
        gLit=mix(coarse,step(1.-uLit,hh)*(.55+.45*h21(id+seed+7.)),detail);
        diffuseColor.rgb=mix(gRoof>.5?vec3(.32,.33,.33):uFrame,diffuseColor.rgb,gPane);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(gRoof>.5?.85:.42,roughnessFactor+.08*h21(floor(vec2(vWP.x*hn.y-vWP.z*hn.x,vWP.y)/uCell/vec2(4.,3.))),gPane);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=mix(gRoof>.5?0.:.55,metalnessFactor,gPane);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance+=uWarm*(gLit*gPane*1.25+.035*gPane)*uNight*(1.-gRoof);`);
    }
    if (kind === 'ground') {
      frag = frag.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 sc=floor(vWP.xz*.7);float lamp=step(.986,h21(sc))*smoothstep(.3,.0,length(fract(vWP.xz*.7)-.5));
        totalEmissiveRadiance+=vec3(1.,.75,.45)*lamp*uNight*3.;`);
    }
    if (kind === 'lattice') {    /* steel lattices drawn in the shader (Supertree canopies, the domes' gridshells) */
      frag = frag.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 lq=vWP*uCell.x;vec3 lf=abs(fract(vec3(lq.x+lq.y*.5,lq.z-lq.y*.5,lq.y*uCell.y))-.5);vec3 lw=fwidth(lq)*1.2+.02;
        float line=max(max(1.-smoothstep(lw.x*.6,lw.x*1.6,lf.x),1.-smoothstep(lw.y*.6,lw.y*1.6,lf.y)),1.-smoothstep(lw.z*.6,lw.z*1.6,lf.z));
        line=mix(.35,line,1.-smoothstep(.25,.6,max(lw.x,lw.y)));
        #ifdef LATTICE_CUT
          if(line<.5)discard;
        #endif
        diffuseColor.rgb=mix(diffuseColor.rgb,uFrame,line);diffuseColor.a=mix(diffuseColor.a,1.,line);gPane=1.-line;`);
      if (o.cut) frag = '#define LATTICE_CUT\n' + frag;
    }
    if (kind === 'glow' || kind === 'lattice') {       /* landmark lighting at night: a vertical colour ramp, gently animated */
      frag = frag.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float hgt=clamp(vWP.y/uCell.y,0.,1.);
        vec3 a=uGlow,b=uWarm;float wave=.5+.5*sin(uTime*.7+vWP.x*.25+vWP.z*.2);
        totalEmissiveRadiance+=mix(a,b,hgt*.7+wave*.3)*uNight*uLit;`);
    }
    frag = frag.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 vd=normalize(cameraPosition-vWP);float rim=pow(1.-abs(dot(normalize(vWN),vd)),2.);
        totalEmissiveRadiance+=vec3(1.,.72,.26)*uHi*(rim*1.6+.12); }`);
    sh.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => kind + (o.hi ? 'h' : '') + (o.cut ? 'c' : '');
  return mat;
}

/* ------------------------------------------------------------------ sky: day, golden hour and night in one shader */
const SKY_V = `varying vec3 vDir;void main(){vDir=(modelMatrix*vec4(position,0.)).xyz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`;
const SKY_F = `varying vec3 vDir;uniform vec3 uSun;uniform float uNight,uDusk,uTime,uDetail;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){vec3 rd=normalize(vDir);float y=max(rd.y,0.);float g=pow(1.-y,5.);
 vec3 day=mix(vec3(.07,.22,.58),vec3(.52,.68,.86),g);
 float az=max(dot(normalize(rd.xz+1e-5),normalize(uSun.xz+1e-5)),0.);
 vec3 dk=mix(vec3(.06,.1,.27),mix(vec3(.42,.27,.36),vec3(1.15,.58,.24),az*az),pow(1.-y,4.));
 vec3 nt=mix(vec3(.004,.008,.026),vec3(.05,.042,.075),pow(1.-y,8.));
 vec3 c=mix(mix(day,dk,uDusk),nt,uNight);
 float sd=max(dot(rd,uSun),0.);vec3 sc=mix(vec3(1.,.92,.78),vec3(1.,.52,.22),uDusk);
 c+=sc*(pow(sd,1600.)*60.+pow(sd,18.)*.45+pow(sd,3.)*.16*uDusk)*smoothstep(-.06,.02,uSun.y)*(1.-uNight);
 if(rd.y>0.&&uDetail>.5){vec2 uv=rd.xz/(rd.y+.12)*.9+vec2(uTime*.004,uTime*.0018);float n=fbm(uv*1.3);
  float cov=smoothstep(.5,.78,n)*smoothstep(0.,.16,rd.y);vec3 cl=mix(vec3(1.05,1.06,1.1),vec3(1.15,.6,.42),uDusk);
  cl*=mix(.7,1.12,smoothstep(.45,.9,fbm(uv*1.3+uSun.xz*.09)));cl=mix(cl,vec3(.06,.055,.08),uNight);c=mix(c,cl*mix(1.,.88,g),cov*.85);
  vec3 md=normalize(vec3(.7,.45,-.32));float m=max(dot(rd,md),0.);c+=vec3(.86,.9,1.)*(smoothstep(.99965,.99985,m)*2.+pow(m,90.)*.08)*uNight*(1.-cov);
  vec2 st=floor(rd.xz/(rd.y+.3)*260.);float s=h21(st);c+=vec3(.9,.93,1.)*step(.997,s)*uNight*smoothstep(.06,.35,rd.y)*(.55+.45*sin(uTime*2.+s*40.))*(1.-cov)*1.5;}
 c=mix(c,mix(mix(vec3(.05,.1,.12),vec3(.09,.07,.09),uDusk),vec3(.006,.012,.02),uNight),smoothstep(0.,-.1,rd.y));
 gl_FragColor=vec4(c,1.);}`;

/* a tileable normal map for the bay, so the water needs no image download */
function waterNormals(size = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), h = new Float32Array(size * size);
  const waves = [];for (let i = 0; i < 14; i++) waves.push([1 + (i * 7) % 9, 1 + (i * 5) % 11, Math.random() * 6.3, 1 / (1 + i * .35)]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;for (const [a, b, p, amp] of waves) v += Math.sin((x * a + y * b * (a % 2 ? 1 : -1)) / size * 6.2832 + p) * amp;
    h[y * size + x] = v;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = h[y * size + (x + 1) % size] - h[y * size + (x - 1 + size) % size], dy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    const n = V3(-dx * .9, -dy * .9, 1).normalize(), k = (y * size + x) * 4;
    img.data[k] = (n.x * .5 + .5) * 255; img.data[k + 1] = (n.y * .5 + .5) * 255; img.data[k + 2] = (n.z * .5 + .5) * 255; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* ------------------------------------------------------------------ the scene */
export async function createScene(canvas, opts) {
  const mobile = !!opts.mobile, base = opts.base;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;   // r186 filters PCF softly; PCFSoft is gone
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 7000);
  scene.fog = new THREE.FogExp2(0x9fb4c4, 0.0016);

  /* sky dome, plus a copy in its own scene for the environment map (reflections and image-based light) */
  const skyU = {uSun: {value: V3(0, 1, 0)}, uNight: G.uNight, uDusk: G.uDusk, uTime: G.uTime, uDetail: {value: 1}};
  const skyMat = new THREE.ShaderMaterial({uniforms: skyU, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false});
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);
  const envScene = new THREE.Scene(), envU = Object.assign({}, skyU, {uDetail: {value: 0}});
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({uniforms: envU, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false})));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, envHour = -99, envAt = 0;

  /* sun (or moon), with shadows over the whole bay */
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, {left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 700});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  sun.target.position.set(0, 0, 5); scene.add(sun, sun.target);
  sun.shadow.camera.layers.enable(2);   // the trees live on layer 2 (kept out of the water's mirror)
  const fill = new THREE.HemisphereLight(0xbfd6ff, 0x30403a, 0.15); scene.add(fill);

  /* the bay */
  const water = new Water(new THREE.PlaneGeometry(9000, 9000), {
    textureWidth: mobile ? 256 : 512, textureHeight: mobile ? 256 : 512, waterNormals: waterNormals(),
    sunDirection: V3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x0b2b33, distortionScale: .5, fog: true, alpha: 1});
  water.rotation.x = -Math.PI / 2; water.position.y = 0;
  water.material.uniforms.size.value = 7;
  scene.add(water);
  /* Water builds its mirror camera with lookAt, which flips the camera's x axis; with our shifted lens
     (setViewOffset, to frame the scene beside the copy) the mirror then renders the wrong slice of the scene and the
     water samples the texture's clamped edge. Hand it a stand-in camera whose horizontal lens shift is mirrored too. */
  const waterBefore = water.onBeforeRender, proxyCam = new THREE.PerspectiveCamera();
  let mirrorTick = 0;
  water.onBeforeRender = function (r, s, cam, ...rest) {
    if (tier === 0 && mirrorTick % 2) return;   // lowest tier: refresh the reflection every other frame
    proxyCam.matrixWorld.copy(cam.matrixWorld); proxyCam.matrixWorldInverse.copy(cam.matrixWorldInverse);
    proxyCam.projectionMatrix.copy(cam.projectionMatrix); proxyCam.projectionMatrix.elements[8] *= -1; proxyCam.far = cam.far;
    return waterBefore.call(this, r, s, proxyCam, ...rest);
  };

  /* ---- everything loads in parallel (the page preloads most of it from <head>, see sg-theme.js) ---- */
  const texLoader = new THREE.TextureLoader();
  const AO_GROUPS = ['mbs', 'artscience', 'helix', 'gardens', 'cbd', 'northshore', 'ground'];
  const json = (n) => fetch(base + n).then((r) => r.ok ? r.json() : []).catch(() => []);
  /* the model ships gzipped (hosts don't compress .glb); the browser inflates it natively. The bytes are sniffed
     rather than trusted, so a host or CDN that decodes the .gz on the way (Content-Encoding: gzip) still works */
  async function glbBuffer() {
    if ('DecompressionStream' in window) {
      try {const r = await fetch(base + 'marina-bay.glb.gz');
        if (r.ok) {const buf = await r.arrayBuffer(), b = new Uint8Array(buf, 0, 2);
          if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
          return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}} catch (e) {}
    }
    return (await fetch(base + 'marina-bay.glb')).arrayBuffer();
  }
  const [gltf, aoList, trees, city] = await Promise.all([
    glbBuffer().then((buf) => new GLTFLoader().parseAsync(buf, base)),
    Promise.all(AO_GROUPS.map((n) => texLoader.loadAsync(base + 'ao-' + n + '.webp').then((t) => {t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.anisotropy = 4; return t;}).catch(() => null))),
    json('trees.json'), json('city.json')]);
  const ao = {};AO_GROUPS.forEach((n, i) => {if (aoList[i]) ao[n] = aoList[i];});

  const M = {    mbs_glass: (g) => patch(new THREE.MeshStandardMaterial({color: 0x93aaa9, metalness: .82, roughness: .12, envMapIntensity: 1.2}), 'facade', {hi: HI[1], cw: .19, fh: .34, lit: .4, frame: 0xc5cac8}),
    mbs_steel: (g) => patch(new THREE.MeshStandardMaterial({color: 0xd7dadb, metalness: .55, roughness: .3, emissive: 0x000000}), 'glow', {hi: HI[1], fh: 22, glow: 0x9fc2ff, warm: 0xcfe0ff, lit: .25}),
    pool: () => new THREE.MeshStandardMaterial({color: 0x2c9fc4, metalness: .1, roughness: .04, envMapIntensity: 1.6}),
    foliage: () => new THREE.MeshStandardMaterial({color: 0x3c6a2c, roughness: .9}),
    podium: (g) => patch(new THREE.MeshStandardMaterial({color: 0xc9cfcf, metalness: .35, roughness: .3}), 'facade', {hi: HI[1], cw: .6, fh: .7, lit: .7, frame: 0xdfe3e2}),
    glass_clear: () => new THREE.MeshStandardMaterial({color: 0xa9c2c6, metalness: .95, roughness: .04, transparent: true, opacity: .8}),
    artscience: () => patch(new THREE.MeshStandardMaterial({color: 0xf3f1ea, metalness: .05, roughness: .26, envMapIntensity: .9}), 'glow', {hi: HI[0], fh: 7, glow: 0xff3d9e, warm: 0x4b7bff, lit: .9}),
    helix_steel: () => patch(new THREE.MeshStandardMaterial({color: 0xcfd3d8, metalness: .9, roughness: .25}), 'glow', {fh: 3, glow: 0x2de0ff, warm: 0xff4060, lit: 1.6}),
    supertree: () => patch(new THREE.MeshStandardMaterial({color: 0x4d3550, metalness: .35, roughness: .55}), 'glow', {hi: HI[3], fh: 5.5, glow: 0xff2fb3, warm: 0x2fe6ff, lit: 1.3}),
    supertree_canopy: () => patch(new THREE.MeshStandardMaterial({color: 0x5a3a58, metalness: .45, roughness: .5, side: THREE.DoubleSide}), 'lattice', {hi: HI[3], cw: 3.2, fh: 5.5, frame: 0x6b4767, glow: 0xff2fb3, warm: 0x2fe6ff, lit: 1.3, cut: true}),
    dome_glass: () => patch(new THREE.MeshStandardMaterial({color: 0x8fbab2, metalness: .6, roughness: .06, transparent: true, opacity: .62, envMapIntensity: 1.3}), 'lattice', {hi: HI[3], cw: 1.6, fh: 6, frame: 0xe6eae8, glow: 0x3aff9a, warm: 0xbaffd8, lit: .35}),
    cbd_glass: () => patch(new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, metalness: .9, roughness: .12, envMapIntensity: 1.15}), 'facade', {hi: HI[2], cw: .3, fh: .4, lit: .33, frame: 0x8e979b, warm: 0xdfe9ff, vary: 1}),
    city_glass: () => patch(new THREE.MeshStandardMaterial({color: 0x7d8f98, metalness: .85, roughness: .15}), 'facade', {cw: .3, fh: .38, lit: .38, frame: 0xa3aaad, vary: 1}),
    flyer_steel: () => patch(new THREE.MeshStandardMaterial({color: 0xe9ecef, metalness: .6, roughness: .3}), 'glow', {fh: 17, glow: 0x6fb6ff, warm: 0xffffff, lit: 1.1}),
    ground: () => patch(new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: .92, metalness: 0}), 'ground'),
    /* the wider city */
    residential: () => patch(new THREE.MeshStandardMaterial({color: 0x5e7280, metalness: .5, roughness: .28}), 'facade', {cw: .34, fh: .3, lit: .5, frame: 0xe8e2d4, warm: 0xffd39a, vary: 1}),
    stadium: () => new THREE.MeshStandardMaterial({color: 0xdfe3e6, metalness: .85, roughness: .22}),
    island: () => new THREE.MeshStandardMaterial({color: 0x2c4631, roughness: .95}),
  };
  const shadowCasters = ['mbs', 'artscience', 'cbd', 'northshore', 'gardens', 'helix'];
  const casters = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    let group = o; while (group.parent && group.parent !== gltf.scene) group = group.parent;
    const gname = group.name, mname = o.material && o.material.name;
    const make = M[mname] || (() => new THREE.MeshStandardMaterial({color: 0xcccccc, roughness: .6}));
    const m = make();
    if (ao[gname]) {m.aoMap = ao[gname]; m.aoMapIntensity = 1;}
    o.material = m;
    o.castShadow = shadowCasters.includes(gname) && mname !== 'dome_glass';
    if (o.castShadow) casters.push(o);
    o.receiveShadow = !['islands', 'ground_far', 'wider_city'].includes(gname);
  });
  scene.add(gltf.scene);

  /* the wider city: hundreds of blocks as GPU instances, six draw calls (shape x office/residential) */
  if (city.length) {
    const shapes = [new THREE.BoxGeometry(1, 1, 1), new THREE.CylinderGeometry(.5, .5, 1, 8, 1), new THREE.CylinderGeometry(.5, .5, 1, 16, 1)];
    shapes[1].rotateY(Math.PI / 8); shapes.forEach((g) => g.translate(0, .5, 0));
    const mats = [M.city_glass(), M.residential()];
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let s = 0; s < 3; s++) for (let r = 0; r < 2; r++) {
      const list = city.filter((c) => c[0] === s && c[1] === r);
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(shapes[s], mats[r], list.length);
      list.forEach((c, i) => {mtx.compose(V3(c[2], c[3], c[4]), q, V3(c[5], c[6], c[7])); im.setMatrixAt(i, mtx);});
      im.frustumCulled = false; scene.add(im);
    }
  }

  /* rain trees as GPU instances: three soft lobes per crown. Near the bay they cast shadows; all of them stay
     out of the water's mirror (layer 2), where a thousand tiny crowns would double the cost for nothing visible */
  if (trees.length) {
    /* near the bay a rounder crown (240 triangles); across the city, where a tree is a few pixels, 60 */
    const crownOf = (detail) => mergeGeometries([[0, 1.25, 0, 1], [.55, 1.12, .3, .74], [-.5, 1.18, -.32, .76]].map(([x, y, z, r]) => {
      const g = new THREE.IcosahedronGeometry(r, detail); g.scale(1.2, .62, 1.2); g.translate(x, y, z); return g;}));
    const crowns = [crownOf(1), crownOf(0)];
    const trunk = new THREE.CylinderGeometry(.07, .12, 1.2, 5).toNonIndexed(); trunk.translate(0, .6, 0);
    const crownMat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .85}), trunkMat = new THREE.MeshStandardMaterial({color: 0x4a3b2f, roughness: .9});
    const near = trees.filter(([x, z]) => Math.abs(x) < 72 && Math.abs(z - 5) < 72), far = trees.filter(([x, z]) => !(Math.abs(x) < 72 && Math.abs(z - 5) < 72));
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    [[near, true], [far, false]].forEach(([pts, shadow], set) => {
      if (!pts.length) return;
      const tm = new THREE.InstancedMesh(crowns[set], crownMat, pts.length), tk = new THREE.InstancedMesh(trunk, trunkMat, pts.length);
      pts.forEach(([x, z, s], i) => {
        const k = i + set * 7919;
        q.setFromAxisAngle(V3(0, 1, 0), (k * 2.39996) % 6.283);
        mtx.compose(V3(x, .2, z), q, V3(s, s * (.85 + (k % 7) * .04), s));
        tm.setMatrixAt(i, mtx); tk.setMatrixAt(i, mtx);
        col.setHSL(.27 + ((k * 37) % 11) * .006, .42 + ((k * 13) % 5) * .04, .16 + ((k * 7) % 9) * .012); tm.setColorAt(i, col);
      });
      tm.castShadow = tk.castShadow = shadow; tm.receiveShadow = shadow;
      if (shadow) casters.push(tm, tk);
      [tm, tk].forEach((m) => {m.frustumCulled = false; m.layers.set(2); scene.add(m);});
    });
  }
  camera.layers.enable(2);
  /* ships at anchor in the Singapore Strait: container ships and tankers, GPU-instanced (three draw calls in all) */
  const rng = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(20261008);
  const ships = [];
  for (let tries = 0; ships.length < 44 && tries < 3000; tries++) {
    const x = -40 + rng() * 520, z = 100 + rng() * 390;            // south of Marina South, clear of every shore
    if (ships.some((s) => Math.hypot(s.x - x, s.z - z) < 24)) continue;
    ships.push({x, z, rot: rng() * 6.283, len: 16 + rng() * 16, box: rng() < .6, col: rng()});
  }
  {
    const hullG = new THREE.BoxGeometry(1, .075, .15, 6, 1, 1);
    const hp = hullG.attributes.position;
    for (let i = 0; i < hp.count; i++) {const x = hp.getX(i);if (x > .3) hp.setZ(i, hp.getZ(i) * (1 - (x - .3) * 2.4));if (hp.getY(i) < 0) hp.setZ(i, hp.getZ(i) * .8);}
    hullG.translate(0, .03, 0); hullG.computeVertexNormals();
    const houseG = new THREE.BoxGeometry(.075, .11, .13); houseG.translate(-.4, .12, 0);
    const boxG = new THREE.BoxGeometry(.62, .05, .13); boxG.translate(.02, .093, 0);
    const hulls = new THREE.InstancedMesh(hullG, new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .55, metalness: .3}), ships.length);
    const houses = new THREE.InstancedMesh(houseG, patch(new THREE.MeshStandardMaterial({color: 0xeef0f0, roughness: .5}), 'facade', {cw: .25, fh: .32, lit: .7, frame: 0xf2f2f0}), ships.length);
    const boxes = ships.filter((s) => s.box);
    const cont = new THREE.InstancedMesh(boxG, patch(new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .7}), 'facade', {cw: .6, fh: .26, lit: 0, frame: 0x2a2a2a}), boxes.length);
    const HULL = [0x7a1f1f, 0x1f2a3a, 0x2b2b2b, 0x1d4a6b, 0x8a3b12], BOX = [0xc0392b, 0x2e86c1, 0xd68910, 0x1e8449, 0x7d3c98, 0xa04000];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let bi = 0;
    ships.forEach((s, i) => {
      q.setFromAxisAngle(V3(0, 1, 0), s.rot); m.compose(V3(s.x, 0, s.z), q, V3(s.len, s.len, s.len));
      hulls.setMatrixAt(i, m); houses.setMatrixAt(i, m); hulls.setColorAt(i, c.setHex(HULL[Math.floor(s.col * HULL.length)]));
      if (s.box) {cont.setMatrixAt(bi, m); cont.setColorAt(bi, c.setHex(BOX[Math.floor(s.col * 97) % BOX.length])); bi++;}
    });
    [hulls, houses, cont].forEach((im) => {im.frustumCulled = false; scene.add(im);});
  }

  /* bumboats cruising the bay, each with a wake */
  const wakeMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: 'varying vec2 vU;\n#include <fog_pars_vertex>\nvoid main(){vU=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: 'varying vec2 vU;uniform float uNight;\n#include <fog_pars_fragment>\nvoid main(){float u=clamp(vU.x,0.,1.);float a=u*u*clamp(1.-abs(vU.y*2.-1.),0.,1.)*.75*(1.-uNight*.8);gl_FragColor=vec4(vec3(.92,.96,1.)*(1.-uNight*.6),a);\n#include <fog_fragment>\n}'});
  wakeMat.uniforms.uNight = G.uNight;
  const boats = [[-31, -4, 12, 15, .05, 0], [-28, -30, 7, 6, -.08, 2], [-40, -20, 5, 8, .07, 4]].map(([cx, cz, rx, rz, w, ph]) => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, .55, 1.1), new THREE.MeshStandardMaterial({color: 0xb5482e, roughness: .6})); hull.position.y = .25;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, .5, .95), patch(new THREE.MeshStandardMaterial({color: 0xf3efe6, roughness: .5}), 'facade', {cw: .3, fh: .5, lit: .9, frame: 0xf3efe6}));
    cabin.position.set(-.2, .75, 0);
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), wakeMat); wake.rotation.x = -Math.PI / 2; wake.position.set(-8.4, .05, 0);
    g.add(hull, cabin, wake); scene.add(g);
    return {g, cx, cz, rx, rz, w, ph};
  });

  /* the SkyPark light show at night: soft beams sweeping the sky */
  const beamMat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {uNight: G.uNight, uCol: {value: new THREE.Color(0x8fb4ff)}},
    vertexShader: 'varying float vH;varying vec3 vN,vV;void main(){vH=uv.y;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'varying float vH;varying vec3 vN,vV;uniform float uNight;uniform vec3 uCol;void main(){float e=pow(abs(dot(vN,vV)),2.);float h=clamp(1.-vH,0.,1.);gl_FragColor=vec4(uCol*e*h*h*uNight*.55,1.);}'});
  const beams = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.CylinderGeometry(9, .25, 260, 20, 1, true); g.translate(0, 130, 0);
    const mtl = beamMat.clone(); mtl.uniforms.uNight = G.uNight; mtl.uniforms.uCol.value = new THREE.Color(i % 2 ? 0xd59cff : 0x8fbaff);
    const b = new THREE.Mesh(g, mtl); b.position.set(-1.2, 21.2, 17 - i * 8); b.frustumCulled = false; scene.add(b); beams.push(b);
  }

  /* an airliner on its way in to Changi */
  const plane = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.18, 2.2, 4, 8), new THREE.MeshStandardMaterial({color: 0xf2f4f6, metalness: .3, roughness: .4}));
  body.rotation.z = Math.PI / 2; plane.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(.7, .04, 3), body.material); plane.add(wing);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({color: 0xff3b30, fog: false}));
  blink.position.set(0, .2, 0); plane.add(blink);
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: {uNight: G.uNight}, vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vU;uniform float uNight;void main(){float a=vU.x*smoothstep(0.,.5,.5-abs(vU.y-.5));gl_FragColor=vec4(vec3(1.),a*.55*(1.-uNight));}'}));
  trail.scale.set(60, .5, 1); trail.position.x = -30.5; plane.add(trail);
  plane.scale.setScalar(1.4); scene.add(plane);

  /* ---- post: HDR, MSAA, bloom, then tone mapping and sRGB ---- */
  const rt = new THREE.WebGLRenderTarget(2, 2, {type: THREE.HalfFloatType, samples: mobile ? 0 : 4});   // MSAA where it is cheap enough
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .3, .55, .92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 2, H = 2, shadowT = -1, shadowAt = 0, tier = 2;
  const fogDay = new THREE.Color(.62, .71, .8), fogDusk = new THREE.Color(.62, .5, .52), fogNight = new THREE.Color(.03, .034, .06);
  const sunDay = new THREE.Color(1, .95, .86), sunDusk = new THREE.Color(1, .56, .28), moonCol = new THREE.Color(.55, .65, .95);

  function resize(w, h, ratio) {
    W = w; H = h;
    renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio); composer.setSize(w, h);
    bloom.resolution.set(w * ratio / 2, h * ratio / 2);
  }

  /* state: {t, hour, sun:{dir,night,dusk}, cam:{o,f,u}, F, shift, hi[4]} */
  function prepare(s) {
    const S = s.sun, night = S.night, dusk = S.dusk;
    G.uNight.value = night; G.uDusk.value = dusk; G.uTime.value = s.t;
    for (let i = 0; i < 4; i++) HI[i].value = s.hi[i];
    skyU.uSun.value.set(S.dir[0], S.dir[1], S.dir[2]);

    /* light: the sun by day, a cool moon by night */
    const sd = S.dir[1] > -0.02 ? V3(...S.dir) : V3(-.55, .62, .55).normalize();
    sun.position.copy(sun.target.position).addScaledVector(sd, 320);
    sun.color.copy(night > .5 ? moonCol : mixC(sunDay, sunDusk, dusk));
    sun.intensity = night > .5 ? .12 : lerp(3.1, 1.75, dusk) * THREE.MathUtils.smoothstep(S.dir[1], -.02, .08);
    fill.intensity = lerp(.18, .05, night);
    /* shadows only move with the sun: re-rendered when the hour moves, at most ~12 times a second while it does */
    const now = performance.now();
    if (Math.abs(shadowT - s.hour) > .01 && now - shadowAt > 80) {renderer.shadowMap.needsUpdate = true; shadowT = s.hour; shadowAt = now;}
    /* reflections and sky light follow the sky: a small (64 px) map, rebuilt at most ~4 times a second */
    if (!envRT || (Math.abs(envHour - s.hour) > .05 && now - envAt > 250)) {
      envHour = s.hour; envAt = now; const old = envRT; envRT = pmrem.fromScene(envScene, 0, .1, 1000, {size: 64}); scene.environment = envRT.texture; if (old) old.dispose();
    }
    scene.environmentIntensity = lerp(lerp(1, .8, dusk), .18, night);
    scene.fog.color.copy(mixC(mixC(fogDay, fogDusk, dusk), fogNight, night));
    scene.fog.density = lerp(.0013, .0019, night);
    renderer.toneMappingExposure = lerp(lerp(.82, .78, dusk), 1.2, night);
    /* bloom is for the lights after dark; by day it is switched off entirely */
    bloom.enabled = tier > 0 && night > .03; bloom.strength = .8 * night; bloom.threshold = .72;

    const wu = water.material.uniforms;
    wu.time.value = s.t * .45; wu.sunDirection.value.copy(sd);
    wu.sunColor.value.copy(night > .5 ? new THREE.Color(.12, .15, .25) : mixC(sunDay, sunDusk, dusk).multiplyScalar(lerp(.45, .3, dusk)));
    wu.waterColor.value.setRGB(lerp(lerp(.03, .06, dusk), .004, night), lerp(lerp(.13, .1, dusk), .012, night), lerp(lerp(.16, .13, dusk), .02, night));

    beams.forEach((b, i) => {b.visible = night > .05; b.rotation.set(Math.sin(s.t * .21 + i * 1.3) * .5 - .25, 0, Math.sin(s.t * .16 + i * 2.1) * .45);});
    const pt = (s.t / 40) % 1; plane.position.set(60 - pt * 20, 34 + pt * 4, -130 + pt * 260); plane.rotation.y = -Math.PI / 2 + .08;
    blink.visible = night > .3 && (s.t * 1.1) % 1 > .8;
    boats.forEach((b) => {
      const a = s.t * b.w + b.ph, x = b.cx + Math.cos(a) * b.rx, z = b.cz + Math.sin(a) * b.rz;
      const dx = -Math.sin(a) * b.rx * Math.sign(b.w), dz = Math.cos(a) * b.rz * Math.sign(b.w);
      b.g.position.set(x, 0, z); b.g.rotation.y = Math.atan2(-dz, dx);
    });

    /* camera, with the lens shifted so the scene sits beside the copy */
    camera.fov = 2 * Math.atan(.5 / s.F) * 180 / Math.PI; camera.aspect = W / H;
    camera.position.set(s.cam.o[0], s.cam.o[1], s.cam.o[2]);
    camera.up.set(0, 1, 0); camera.lookAt(s.cam.o[0] + s.cam.f[0], s.cam.o[1] + s.cam.f[1], s.cam.o[2] + s.cam.f[2]);
    camera.setViewOffset(W, H, -s.shift[0] * H, s.shift[1] * H, W, H);
    camera.updateProjectionMatrix();
  }
  function render(s) {prepare(s); mirrorTick++; composer.render();}

  /* Quality tiers, stepped down by the controller when a device can't hold 60 fps even at its lowest resolution:
     2 = everything; 1 = no MSAA, 1024 shadows; 0 = no bloom, 512 shadows, the water's mirror refreshed every other frame.
     None of these recompiles a shader, so a step is never a hitch. */
  function setTier(n) {
    if (n === tier) return; tier = n;
    const samples = n === 2 && !mobile ? 4 : 0;
    if (rt.samples !== samples) {rt.samples = samples; rt.dispose();}
    const ms = n === 2 ? (mobile ? 1024 : 2048) : n === 1 ? 1024 : 512;
    if (sun.shadow.mapSize.x !== ms) {sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) {sun.shadow.map.dispose(); sun.shadow.map = null;} renderer.shadowMap.needsUpdate = true;}
  }
  /* Compile every shader off the main thread (KHR_parallel_shader_compile) and draw one frame while the canvas is
     still hidden, so the first frame anyone sees is complete: no half-built buildings, no stutter as shaders arrive. */
  async function warm(s) {
    prepare(s);
    if (renderer.compileAsync) {try {await renderer.compileAsync(scene, camera);} catch (e) {}}
    renderer.shadowMap.needsUpdate = true; render(s);
  }

  /* ---- keeping the orbit clear: how far the camera can swing either way before a tower stands in front of it.
     The tall things are the city blocks (boxes, tested exactly) and the CBD, north-shore and MBS meshes (ray-cast
     both sides, so a camera inside a tower counts as blocked too). The view is blocked when anything stands in the
     nearer half of the way to the bay, on the centre line or a little either side of it. ---- */
  gltf.scene.updateMatrixWorld(true);
  const solid = new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), proxies = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    let g = o; while (g.parent && g.parent !== gltf.scene) g = g.parent;
    if (!['cbd', 'northshore', 'mbs'].includes(g.name)) return;
    const p = new THREE.Mesh(o.geometry, solid); p.matrixAutoUpdate = false; p.matrixWorld.copy(o.matrixWorld); proxies.push(p);
  });
  const boxes = city.map((c) => [c[2] - c[5] / 2, c[3], c[4] - c[7] / 2, c[2] + c[5] / 2, c[3] + c[6], c[4] + c[7] / 2]);
  const caster = new THREE.Raycaster(), dir = new THREE.Vector3(), eye = new THREE.Vector3(), aim = new THREE.Vector3();
  function hitsBox(o, d, far, b) {   // slab test of the segment o + d*[0, far] against an axis-aligned box
    let t0 = 0, t1 = far;
    for (let k = 0; k < 3; k++) {
      const oo = o.getComponent(k), dd = d.getComponent(k), lo = b[k], hi = b[k + 3];
      if (Math.abs(dd) < 1e-9) {if (oo < lo || oo > hi) return false; continue;}
      let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
    }
    return true;
  }
  function blocked(o, p) {
    const far = dir.subVectors(p, o).length() * .5; dir.normalize();
    for (const b of boxes) if (hitsBox(o, dir, far, b)) return true;
    caster.set(o, dir); caster.far = far;
    return caster.intersectObjects(proxies, false).length > 0;
  }
  function clearAt(c, yaw, offs) {
    for (const pitch of [c.pitch, .04]) {
      const cp = Math.cos(pitch), sx = Math.sin(yaw), cx = Math.cos(yaw);
      eye.set(c.t[0] + c.dist * cp * cx, c.t[1] + c.dist * Math.sin(pitch), c.t[2] + c.dist * cp * sx);
      for (const a of offs) {const off = c.dist * a; if (blocked(eye, aim.set(c.t[0] + sx * off, c.t[1], c.t[2] - cx * off))) return false;}
    }
    return true;
  }
  /* the widest clear arc around `from` (at most `span` either way), for an orbit of c = {pitch, dist, t}. offs are the
     sight lines tested, as sideways offsets at the target in units of the orbit's distance (negative = left of frame) */
  function yawRange(c, from, span, offs = [-.16, 0, .16]) {
    const step = .04; let lo = from, hi = from;
    while (lo - step >= from - span && clearAt(c, lo - step, offs)) lo -= step;
    while (hi + step <= from + span && clearAt(c, hi + step, offs)) hi += step;
    return [lo, hi];
  }

  return {render, resize, warm, setTier, yawRange, renderer, scene, camera};
}
