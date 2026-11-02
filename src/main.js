import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './styles.css';
import './immersive.css';
import comparisonSceneUrl from './assets/editing-comparison.svg';

gsap.registerPlugin(ScrollTrigger);

const projects = [
  { title: 'Edit #1', category: 'YouTube Short', videoId: '0SdDKNIrH8c', status: 'published' },
  { title: 'Edit #2', category: 'YouTube Short', videoId: 'wjXuGwtLzpk', status: 'published' },
  { title: 'Edit #3', category: 'YouTube Short', videoId: '1HiJHl1n-UY', status: 'published' },
  { title: 'Edit #4', category: 'YouTube Short', videoId: 'C7dTj_kpD-w', status: 'published' },
  { title: 'Edit #5', category: 'YouTube Short', videoId: 'qHCxUogEjM4', status: 'published' },
  { title: 'Edit #6', category: 'YouTube Short', videoId: 'zX9xppsH8-Y', status: 'published' },
  { title: 'Edit #7', category: 'YouTube Short', videoId: 'ysH77cciSAI', status: 'published' },
  { title: 'Edit #8', category: 'YouTube Short', videoId: 'Cj0E0HgP9wI', status: 'published' },
];

const projectTrack = document.querySelector('#work-track');
document.querySelectorAll('.compare-scene').forEach((image) => { image.src = comparisonSceneUrl; });
const videoDialog = document.querySelector('#video-dialog');
const dialogVideo = document.querySelector('#dialog-video');
const pcExperienceDialog = document.querySelector('#pc-experience-dialog');
const pcExperienceFallback = document.querySelector('#pc-webgl-fallback');
let workstationApi = null;
let resolveWorkstationReady;
const workstationReady = new Promise((resolve) => { resolveWorkstationReady = resolve; });
let pcExperienceModule;

projects.forEach((project, index) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'project-card';
  card.setAttribute('aria-label', `Play ${project.title}, ${project.category}`);
  card.dataset.videoId = project.videoId;
  const thumbnailUrl = `https://i.ytimg.com/vi/${project.videoId}/hqdefault.jpg`;
  const visual = `<img src="${thumbnailUrl}" alt="" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer" /><span class="project-play" aria-hidden="true">▶</span>`;
  card.innerHTML = `<span class="project-index">0${index + 1} / 08</span><span class="project-visual project-visual-${index + 1}">${visual}<span class="project-visual-grid"></span></span><span class="project-meta"><span><small>${project.category}</small><strong>${project.title}</strong></span><span class="project-arrow" aria-hidden="true">↗</span></span>`;
  projectTrack.append(card);
});

document.querySelectorAll('.project-card[data-video-id]').forEach((card) => {
  let previewTimer;
  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion || !window.matchMedia('(hover: hover)').matches) return;
    previewTimer = window.setTimeout(() => {
      if (!card.matches(':hover')) return;
      const videoId = card.dataset.videoId;
      const preview = document.createElement('iframe');
      preview.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0`;
      preview.title = `Preview ${card.getAttribute('aria-label')}`;
      preview.loading = 'lazy';
      preview.allow = 'autoplay; encrypted-media; picture-in-picture';
      preview.setAttribute('aria-hidden', 'true');
      preview.tabIndex = -1;
      card.querySelector('.project-visual').append(preview);
    }, 500);
  });
  card.addEventListener('pointerleave', () => {
    window.clearTimeout(previewTimer);
    card.querySelector('.project-visual iframe')?.remove();
  });
  card.addEventListener('click', () => {
    const videoId = card.dataset.videoId;
    const player = document.createElement('iframe');
    player.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
    player.title = card.getAttribute('aria-label');
    player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allowFullscreen = true;
    dialogVideo.replaceChildren(player);
    videoDialog.showModal();
  });
});

function closeVideo() {
  videoDialog.close();
  dialogVideo.replaceChildren();
}

document.querySelector('.dialog-close').addEventListener('click', closeVideo);
videoDialog.addEventListener('click', (event) => {
  if (event.target === videoDialog) closeVideo();
});
videoDialog.addEventListener('close', () => dialogVideo.replaceChildren());

window.addEventListener('amaan:workstation-ready', (event) => {
  workstationApi = event.detail;
  resolveWorkstationReady(workstationApi);
}, { once: true });

async function openPCExperience() {
  if (pcExperienceDialog.open) return;
  pcExperienceFallback.hidden = true;
  pcExperienceDialog.showModal();
  try {
    if (!workstationApi && document.documentElement.classList.contains('webgl-unavailable')) {
      throw new Error('WebGL is unavailable');
    }
    const api = workstationApi || await workstationReady;
    pcExperienceModule ??= await import('./scene/pc-experience.js');
    await pcExperienceModule.mountPCExperience({ api, dialog: pcExperienceDialog });
  } catch (error) {
    console.error('Unable to open the workstation experience.', error);
    pcExperienceFallback.hidden = false;
  }
}

document.querySelector('#open-pc-experience').addEventListener('click', openPCExperience);
document.querySelector('#pc-experience-back').addEventListener('click', () => pcExperienceDialog.close());
pcExperienceFallback.querySelector('[data-pc-close]').addEventListener('click', () => pcExperienceDialog.close());
pcExperienceDialog.addEventListener('click', (event) => {
  if (event.target === pcExperienceDialog) pcExperienceDialog.close();
});

const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  navLinks.classList.toggle('is-open', open);
});
navLinks.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  navLinks.classList.remove('is-open');
}));

document.querySelectorAll('.faq-list details').forEach((item) => {
  item.addEventListener('toggle', () => {
    if (item.open) document.querySelectorAll('.faq-list details').forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

const compareBefore = document.querySelector('#compare-before');
const compareDivider = document.querySelector('#compare-divider');
const compareRange = document.querySelector('#compare-range');
function setCompare(value) {
  compareBefore.style.width = `${value}%`;
  compareDivider.style.left = `${value}%`;
}
compareRange.addEventListener('input', () => setCompare(Number(compareRange.value)));
setCompare(Number(compareRange.value));

document.querySelector('#contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = `Project Inquiry - ${data.get('type') || 'Video Editing'}`;
  const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\nService: ${data.get('type')}\n\nMessage:\n${data.get('message')}`;
  const mailto = `mailto:ahaan321.kj@gmail.com?${new URLSearchParams({ subject, body })}`;
  document.querySelector('#form-note').textContent = 'Opening your email app…';
  window.location.href = mailto;
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const progressFill = document.querySelector('.scroll-progress span');
ScrollTrigger.create({
  trigger: document.documentElement,
  start: 0,
  end: () => ScrollTrigger.maxScroll(window),
  onUpdate: (self) => { progressFill.style.transform = `scaleY(${self.progress})`; },
});

const finePointer = window.matchMedia('(pointer: fine)');
const canUseCustomCursor = () => finePointer.matches && window.innerWidth > 700 && !reducedMotion;
const syncCursorMode = () => document.documentElement.classList.toggle('custom-cursor', canUseCustomCursor());
syncCursorMode();
window.addEventListener('resize', syncCursorMode, { passive: true });

if (finePointer.matches && !reducedMotion) {
  const cursorDot = document.querySelector('.cursor-dot');
  const cursorRing = document.querySelector('.cursor-ring');
  const moveRingX = gsap.quickTo(cursorRing, 'x', { duration: 0.18, ease: 'power3.out' });
  const moveRingY = gsap.quickTo(cursorRing, 'y', { duration: 0.18, ease: 'power3.out' });
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    gsap.set(cursorDot, { x: event.clientX, y: event.clientY });
    moveRingX(event.clientX);
    moveRingY(event.clientY);
  }, { passive: true });
  document.addEventListener('pointerover', (event) => {
    if (canUseCustomCursor() && event.target.closest('a,button,input,textarea,select,summary,[role="button"]')) {
      document.documentElement.classList.add('cursor-hover');
    }
  });
  document.addEventListener('pointerout', (event) => {
    if (event.target.closest('a,button,input,textarea,select,summary,[role="button"]')) {
      document.documentElement.classList.remove('cursor-hover');
    }
  });
}

if (reducedMotion) {
  document.documentElement.classList.add('reduce-motion');
} else {
  const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  gsap.from('.hero-eyebrow, .hero-name, .hero-role, .hero-tagline, .hero-actions', {
    y: 30, opacity: 0, duration: 0.8, stagger: 0.11, ease: 'power3.out', delay: 0.18,
  });
  gsap.utils.toArray('.section-heading, .service-card, .channel-copy, .channel-panel, .about-copy, .about-art, .skill-card, .process-list article, .faq-layout, .contact-layout').forEach((element) => {
    gsap.from(element, {
      y: 28,
      opacity: 0,
      duration: 0.72,
      ease: 'power2.out',
      scrollTrigger: { trigger: element, start: 'top 88%', once: true },
    });
  });

  gsap.fromTo('.timeline-playhead', { left: '12%' }, {
    left: '94%', ease: 'none',
    scrollTrigger: { trigger: '.timeline-window', start: 'top 85%', end: 'bottom 25%', scrub: 0.8 },
  });
  gsap.fromTo('.cta-orbit', { scale: 0.55, rotate: -18 }, {
    scale: 1.15, rotate: 24, ease: 'none',
    scrollTrigger: { trigger: '.final-cta', start: 'top bottom', end: 'bottom top', scrub: 1 },
  });

  gsap.matchMedia().add('(min-width: 900px)', () => {
    const track = document.querySelector('#work-track');
    const tween = gsap.to(track, {
      x: () => -(track.scrollWidth - window.innerWidth + 80),
      ease: 'none',
      scrollTrigger: {
        trigger: '#work',
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        end: () => `+=${track.scrollWidth - window.innerWidth + 80}`,
      },
    });
    return () => tween.scrollTrigger?.kill();
  });
}

document.querySelectorAll('.service-card').forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || reducedMotion) return;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    card.style.setProperty('--tilt-x', `${-y * 5}deg`);
    card.style.setProperty('--tilt-y', `${x * 5}deg`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
  });
});

import('./scene/experience.js')
  .then(({ initExperience }) => initExperience())
  .catch(() => document.querySelector('.hero-art')?.classList.add('no-webgl'));