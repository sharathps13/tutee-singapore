/* assets/js/sg-hero-parallax.js */
(function() {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const scene = document.querySelector('.hw-scene-container');
  if (!scene) return;

  const windowEl = scene.querySelector('.hw-3d-window');
  const atmosphereEl = scene.querySelector('.hw-atmosphere');
  const rankEl = scene.querySelector('.hw-floating-rank');
  const typography = document.querySelector('.hw-typography');
  const innerVideo = scene.querySelector('.hw-3d-window video, .hw-3d-window img');

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  let ticking = false;

  const onMouseMove = (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  };

  const update = () => {
    // Smooth easing
    targetX += (mouseX - targetX) * 0.08;
    targetY += (mouseY - targetY) * 0.08;

    // Apply transforms
    // Mobile check to disable heavy 3D
    if (window.innerWidth > 900) {
      if (windowEl) {
        windowEl.style.transform = `translateZ(-50px) rotateY(${-15 + targetX * 12}deg) rotateX(${targetY * -8}deg)`;
      }
      if (atmosphereEl) {
        atmosphereEl.style.transform = `translateZ(-300px) scale(1.4) translateX(${targetX * -30}px) translateY(${targetY * -30}px)`;
      }
      if (rankEl) {
        rankEl.style.transform = `translateZ(80px) translateX(${targetX * 25}px) translateY(${targetY * 25}px)`;
      }
      if (typography) {
        typography.style.transform = `translateZ(50px) translateX(${targetX * 10}px) translateY(${targetY * 10}px)`;
      }
      if (innerVideo) {
        // Inverse parallax inside the window to give an illusion of a deep background behind the glass
        innerVideo.style.transform = `scale(1.05) translateX(${targetX * -15}px) translateY(${targetY * -15}px)`;
      }
    }

    requestAnimationFrame(update);
  };

  // Only bind if we have IntersectionObserver to pause when out of view
  if ('IntersectionObserver' in window) {
    let observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      } else {
        ticking = false;
      }
    }, { threshold: 0 });
    observer.observe(document.querySelector('.hw-revamp'));
  } else {
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
})();
document.documentElement.classList.remove('hw-intro-on');
