const colors = ['#edf4ff', '#b3d5ff', '#90b9ff', '#cfbcff', '#fff0d7'];
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function createPortalWarp(lowQuality) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  canvas.className = 'universe-portal-warp';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  document.body.append(canvas);

  let seed = 9871;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const stars = Array.from({length: lowQuality ? 145 : 235}, (_, index) => {
    const angle = random() * Math.PI * 2;
    const spread = .025 + .68 * random() ** 1.65;
    return {
      x: Math.cos(angle) * spread,
      y: Math.sin(angle) * spread,
      depth: random(),
      size: .45 + random() ** 2 * 1.2,
      color: colors[index % colors.length]
    };
  });
  let width, height, backdrop;

  function draw(progress) {
    canvas.hidden = false;
    const nextWidth = canvas.clientWidth, nextHeight = canvas.clientHeight;
    if (!nextWidth || !nextHeight) return;
    if (width !== nextWidth || height !== nextHeight) {
      width = nextWidth;
      height = nextHeight;
      const ratio = Math.min(devicePixelRatio || 1, lowQuality ? 1.25 : 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      backdrop = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) * .57);
      backdrop.addColorStop(0, '#18325d');
      backdrop.addColorStop(.25, '#111d39');
      backdrop.addColorStop(.68, '#070c20');
      backdrop.addColorStop(1, '#02030b');
    }
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const phase = clamp(progress);
    const speed = Math.sin(Math.PI * phase) ** 1.4;
    const travel = smooth(phase) * 2.6;
    const cx = width / 2, cy = height / 2;
    const span = Math.hypot(width, height) * .66;
    ctx.lineCap = 'round';
    for (const star of stars) {
      // Head and tail share a trajectory; perspective stretches the trail as it approaches.
      const cycle = ((star.depth - travel) % 1 + 1) % 1;
      const depth = .09 + cycle * .97;
      const tailDepth = depth + .013 + speed * .48;
      const x = star.x * span, y = star.y * span;
      const opacity = smooth((depth - .09) / .095) * (1 - smooth((depth - .82) / .24));
      if (opacity < .02) continue;
      const headX = cx + x / depth, headY = cy + y / depth;
      const tailX = cx + x / tailDepth, tailY = cy + y / tailDepth;
      if (Math.min(headX, tailX) > width + 4 || Math.max(headX, tailX) < -4 ||
          Math.min(headY, tailY) > height + 4 || Math.max(headY, tailY) < -4) continue;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = star.color;
      ctx.lineWidth = star.size * (2.1 + speed * 1.3);
      ctx.globalAlpha = opacity * speed * .14;
      ctx.stroke();
      ctx.lineWidth = star.size;
      ctx.globalAlpha = opacity * (.52 + speed * .36);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return {
    draw,
    hide() { canvas.hidden = true; },
    dispose() { canvas.remove(); }
  };
}
