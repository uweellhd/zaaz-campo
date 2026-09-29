/* Fibras ópticas suaves na área de marca do login. Sem dependências. */
(() => {
  const canvas = document.getElementById('fiberCanvas');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(0);
  }

  function path(index) {
    const step = index / 13;
    const startY = height * (.9 + step * .14);
    const endY = height * (.18 + step * .55);
    context.beginPath();
    context.moveTo(-width * .14, startY);
    context.bezierCurveTo(width * .24, height * (.72 + step * .18), width * .56,
      height * (.48 + step * .14), width * 1.16, endY);
  }

  function pointOnFiber(index, t) {
    const step = index / 13;
    const p0 = [-width * .14, height * (.9 + step * .14)];
    const p1 = [width * .24, height * (.72 + step * .18)];
    const p2 = [width * .56, height * (.48 + step * .14)];
    const p3 = [width * 1.16, height * (.18 + step * .55)];
    const u = 1 - t;
    const coordinate = axis => u ** 3 * p0[axis] + 3 * u ** 2 * t * p1[axis]
      + 3 * u * t ** 2 * p2[axis] + t ** 3 * p3[axis];
    return { x: coordinate(0), y: coordinate(1) };
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    if (!width || !height) return;
    for (let i = 0; i < 14; i++) {
      path(i);
      const yellow = i % 5 === 0;
      context.strokeStyle = yellow ? 'rgba(255, 210, 93, .22)' : 'rgba(125, 184, 255, .22)';
      context.lineWidth = yellow ? 1.4 : 1;
      context.stroke();

      if (reducedMotion.matches) continue;
      const period = 4200 + i * 230;
      const progress = ((time + i * 470) % period) / period;
      const point = pointOnFiber(i, progress);
      // Pequeno brilho viajando no mesmo sentido das fibras.
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 17);
      glow.addColorStop(0, yellow ? 'rgba(255,218,110,.9)' : 'rgba(179,222,255,.8)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, 17, 0, Math.PI * 2);
      context.fill();
    }
  }

  function tick(time) {
    if (!running) return;
    draw(time);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const shouldRun = !reducedMotion.matches && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      frame = requestAnimationFrame(tick);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(frame);
      draw(0);
    }
  }

  new ResizeObserver(resize).observe(canvas);
  reducedMotion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  resize();
  sync();
})();
