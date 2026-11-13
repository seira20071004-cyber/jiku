import {projectedOriginRadius} from './origin-framing.js';

export const BANG_DURATION = 5000;
export const GATHER_DURATION = 3600;
export const IGNITION_DURATION = 3200;
const BEAT_DURATION = 800;
export const SPHERE_FORMATION_AT = 3630;
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function beatEnvelope(phase, start, peak, end) {
  return smooth((phase - start) / (peak - start)) * (1 - smooth((phase - peak) / (end - peak)));
}

function grain(x, y) {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y) {
  const left = Math.floor(x), top = Math.floor(y);
  const dx = smooth(x - left), dy = smooth(y - top);
  return mix(
    mix(grain(left, top), grain(left + 1, top), dx),
    mix(grain(left, top + 1), grain(left + 1, top + 1), dx), dy
  );
}

function clouds(x, y) {
  return noise(x, y) * .55 + noise(x * 2.1, y * 2.1) * .28 +
    noise(x * 4.4, y * 4.4) * .13 + noise(x * 9, y * 9) * .06;
}

// Bake one transparent, filamented cloud. The animation moves the texture and
// the stars independently, so the flight has depth without per-frame noise.
function makeNebula() {
  const canvas = document.createElement('canvas');
  const side = canvas.width = canvas.height = 350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const texture = ctx.createImageData(side, side);
  for (let row = 0; row < side; row++) {
    for (let col = 0; col < side; col++) {
      const x = (col / side - .5) * 2, y = (row / side - .5) * 2;
      const radius = Math.hypot(x, y);
      if (radius >= 1) continue;
      const angle = Math.atan2(y, x);
      const warp = clouds(x * 3.2 + 14, y * 3.2 + 9);
      const detail = clouds(x * 6 + warp * 2.8, y * 6 - warp * 2.4);
      const rim = .51 + Math.sin(angle * 3 + 1) * .09 + Math.cos(angle * 5) * .05;
      const distance = (radius - rim + (warp - .5) * .43) / .21;
      const shell = Math.exp(-distance * distance) * (.2 + .8 * detail);
      const filaments = Math.max(0, (detail - .34) * 2) * shell;
      const veil = smooth((1 - radius) / .32) * Math.max(0, detail - .27) * .49;
      const density = clamp(veil + shell * .18 + filaments * .66);
      const color = smooth(.5 + x * .49 - y * .2 + (warp - .5) * .64);
      const heat = Math.pow(filaments, 1.3);
      const offset = (row * side + col) * 4;
      texture.data[offset] = mix(70, 226, color) + heat * 92;
      texture.data[offset + 1] = mix(157, 88, color) + heat * 85;
      texture.data[offset + 2] = 252 - color * 24 + heat * 35;
      texture.data[offset + 3] = density * 255;
    }
  }
  ctx.putImageData(texture, 0, 0);
  return canvas;
}

function glow(ctx, x, y, radius, stops) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [position, color] of stops) gradient.addColorStop(position, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function startBirthSky(canvas, origin, motion) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const light = canvas.parentElement.querySelector('.birth-light');
  const stars = Array.from({length: 255}, (_, i) => ({
    x: (grain(i, 27) - .5) * 2.85, y: (grain(i, 39) - .5) * 2.85,
    depth: .27 + grain(i, 61) * .73,
    color: ['#e4edff', '#9bc7ff', '#fbe1ff', '#ffdcab'][i % 4],
    size: .32 + grain(i, 87) ** 3 * 1.4
  }));
  const particles = Array.from({length: 76}, (_, i) => ({
    angle: grain(i, 2) * Math.PI * 2,
    radius: .21 + grain(i, 4) * .78,
    depth: grain(i, 5),
    color: ['#bfc5ff', '#f2b4ff', '#aadfff', '#ffd5a7'][i % 4]
  }));
  let nebula, width, height, center, sphereRadius, frame, stage = 'gaze', entered = performance.now();
  let drawnStage, heartbeat, lastDraw = 0;
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    center = height * (parseFloat(getComputedStyle(canvas).getPropertyValue('--birth-point-height')) || 42) / 100;
    sphereRadius = projectedOriginRadius(origin.clientWidth, origin.clientHeight);
    if (sphereRadius) origin.style.setProperty('--birth-orb-diameter', sphereRadius * 2 + 'px');
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2.5, Math.sqrt(1_900_000 / (width * height)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawnStage = null;
  }

  function paint(time) {
    frame = requestAnimationFrame(paint);
    const changing = ['gather', 'ignite', 'still', 'bang'].includes(stage) && !motion.matches;
    if (!width || !height || (!changing && drawnStage === stage) || time - lastDraw < 16) return;
    lastDraw = time;
    drawnStage = stage;
    const elapsed = (time - entered) / 1000;
    const igniting = stage === 'ignite';
    const gatheringLight = stage === 'gather' || igniting;
    const still = stage === 'still';
    const close = ['welcome', 'goal', 'name', 'suggest', 'gaze'].includes(stage) || gatheringLight || still;
    const expanding = stage === 'bang';
    const burst = expanding ? mix(.11, 1, clamp(elapsed / (BANG_DURATION / 1000))) : close ? 0 : 1;
    const scale = Math.min(width, height);
    const cx = width / 2, cy = center;
    const flight = smooth((burst - .13) / .87);
    const convergence = expanding ? smooth((burst - .11) / .84) : 0;
    const launch = smooth((burst - .12) / .32);
    ctx.clearRect(0, 0, width, height);

    if (!close && burst > .12 && nebula) {
      const opacity = smooth((burst - .12) / .36);
      const spread = scale * (.06 + flight * 1.71);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-.39);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = opacity * .9;
      ctx.drawImage(nebula, -spread / 2, -spread * .41, spread, spread * .82);
      const back = spread * 1.35;
      ctx.rotate(1.92);
      ctx.globalAlpha = opacity * .37;
      ctx.drawImage(nebula, -back * .59, -back * .34, back, back * .68);
      ctx.restore();
    }

    if (!close && burst > .16) {
      const skyAlpha = smooth((burst - .16) / .53);
      for (const star of stars) {
        const perspective = .12 + (.72 * flight + .28 * launch) * (.4 + star.depth * .9);
        const x = star.x * width * perspective, y = star.y * height * perspective;
        if (cx + x < -5 || cx + x > width + 5 || cy + y < -5 || cy + y > height + 5) continue;
        const streak = expanding ? Math.sin(launch * Math.PI) * star.depth * .16 + Math.sin(flight * Math.PI) * star.depth * .065 : 0;
        ctx.globalAlpha = skyAlpha * (.25 + star.depth * .54);
        ctx.strokeStyle = ctx.fillStyle = star.color;
        ctx.beginPath();
        if (streak > .01) {
          ctx.lineWidth = star.size * 1.05;
          ctx.moveTo(cx + x * (1 - streak), cy + y * (1 - streak));
          ctx.lineTo(cx + x, cy + y);
          ctx.stroke();
        } else {
          ctx.arc(cx + x, cy + y, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (((gatheringLight || still) && !motion.matches) || expanding) {
      const gathering = stage === 'gather' ? smooth((time - entered) / GATHER_DURATION) : 1;
      const settling = still ? smooth(elapsed / .38) : 0;
      const contraction = expanding ? 0 : 1 - settling;
      const outgoing = smooth((burst - .11) / .40);
      const flare = Math.sin(Math.PI * outgoing) * (1 - convergence);
      const tailProgress = smooth((burst - .55) / .39);
      const ignition = igniting ? clamp((time - entered) / IGNITION_DURATION) : Number(still);
      const beatStrength = igniting ? mix(.74, 1, ignition) * (1 - smooth((ignition - .91) / .09)) : 0;
      if (igniting && !heartbeat) heartbeat = light?.getAnimations?.().find(animation => animation.animationName === 'birth-heartbeat');
      const beatTime = igniting ? (heartbeat?.currentTime ?? time - entered) : 0;
      const beatDuration = heartbeat?.effect.getTiming().duration || BEAT_DURATION;
      for (const particle of particles) {
        const speed = .96 + particle.depth * .45;
        const phase = (beatTime % beatDuration) / beatDuration - particle.depth * .05;
        const pulse = beatStrength * (
          beatEnvelope(phase, .015, .16, .35) + .6 * beatEnvelope(phase, .26, .42, .64)
        );
        const breathing = 1 + pulse * (.36 + particle.depth * .27);
        const start = expanding ? scale * particle.radius * .38 * speed
          : scale * particle.radius * .36 * (1 - gathering * .74) * contraction * breathing;
        const finish = 0;
        const angle = particle.angle + gathering * .8 + ignition * (.24 + particle.depth * .14) + outgoing * .4;
        const curl = .62 + particle.depth * .85;
        const sweep = angle + curl * convergence;
        const distance = mix(start, finish, convergence);
        const stretch = mix(.77, .48, convergence);
        const x = cx + Math.cos(sweep) * distance;
        const y = cy + Math.sin(sweep) * distance * stretch;
        const life = expanding
          ? smooth((burst - .11) / .065) * (1 - smooth((burst - .82) / .18))
          : gathering * (1 - settling);
        const color = convergence > .66 ? '#f1f1fb' : particle.color;
        if (pulse > .02) {
          const trail = distance * pulse * (.10 + particle.depth * .12);
          ctx.globalAlpha = pulse * life * .28;
          ctx.strokeStyle = color;
          ctx.lineWidth = .65 + particle.depth * .55;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(sweep) * trail, y - Math.sin(sweep) * trail * stretch);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (flare > .02 || convergence > .01) {
          const tailAngle = angle + curl * tailProgress - flare * .09;
          const tailDistance = mix(start, finish, tailProgress) * (1 - flare * (.25 + particle.depth * .38));
          ctx.globalAlpha = life * (.2 + particle.depth * .32 + flare * .22);
          ctx.strokeStyle = color;
          ctx.lineWidth = .5 + particle.depth * (.8 + flare * 1.25);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(tailAngle) * tailDistance, cy + Math.sin(tailAngle) * tailDistance * stretch);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        ctx.globalAlpha = life * Math.min(1, .35 + particle.depth * .61 + pulse * .19);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, (.48 + particle.depth * 1.55) * (1 + pulse * .25), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (expanding && convergence > .22 && sphereRadius > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = smooth((convergence - .22) / .52) * (1 - smooth((burst - .81) / .19)) * .66;
      glow(ctx, cx, cy, sphereRadius * 1.25, [
        [0, '#fff3'], [.58, '#dedbf30d'], [.73, '#c5c2db18'],
        [.81, '#eceaf980'], [.91, '#c6c5eb24'], [1, '#0000']
      ]);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (expanding && burst > .72 && burst < .96) {
      const reach = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
      const wave = clamp((burst - .72) / .24);
      const radius = Math.min(reach, sphereRadius * 2) * (.22 + wave * .78);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = (1 - wave ** 1.55) * .97;
      glow(ctx, cx, cy, radius + 1, [
        [0, '#0000'], [.59, '#0000'], [.79, '#664fd633'], [.9, '#a976ff96'],
        [.948, '#e3cfffb8'], [.968, '#fff8eedd'], [.985, '#9ae5ff94'], [1, '#0000']
      ]);
      const echo = smooth((burst - .76) / .20);
      if (echo > 0 && echo < 1) {
        ctx.globalAlpha = .42 * (1 - echo);
        glow(ctx, cx, cy, radius * .75, [
          [0, '#0000'], [.75, '#0000'], [.91, '#9261d98c'], [.96, '#f6d4ffbd'], [1, '#0000']
        ]);
      }
      const flash = smooth((burst - .72) / .038) * (1 - smooth((burst - .76) / .10));
      ctx.globalAlpha = flash * .96;
      glow(ctx, cx, cy, sphereRadius * (.40 + wave * .36), [
        [0, '#fff6e7'], [.05, '#fff7e6'], [.14, '#eab5ffdf'], [.34, '#9a72f786'],
        [.64, '#679dff25'], [1, '#0000']
      ]);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  frame = requestAnimationFrame(paint);
  return {
    stage(next) {
      stage = next;
      heartbeat = undefined;
      entered = performance.now();
      if (!['welcome', 'goal', 'name', 'suggest', 'gaze'].includes(next) && !nebula) nebula = makeNebula();
    },
    dispose() {cancelAnimationFrame(frame); observer.disconnect();}
  };
}
