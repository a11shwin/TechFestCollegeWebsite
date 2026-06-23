/**
 * Carmel College Tech Fest - IGNITRON '26
 * Client Side Core Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Hide Preloader
  window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      preloader.style.opacity = '0';
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 500);
    }
  });

  // Fallback if load event doesn't trigger quickly
  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader && preloader.style.display !== 'none') {
      preloader.style.opacity = '0';
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 500);
    }
  }, 1500);

  // Initialize App Modules
  initCursorGlow();
  initThreeParticles();
  initCountdown();
  renderEvents();
  initGSAPAnimations();
  initFormLogic();
  initDOMRepelEffect();
  initMobileMenu();
  updateAuthUI();
});

/* ==========================================
   1. Cursor Glow Follower
   ========================================== */
function initCursorGlow() {
  const glow = document.getElementById('cursor-glow');
  if (!glow) return;

  document.addEventListener('mousemove', (e) => {
    // Smooth follow using gsap
    gsap.to(glow, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.3,
      ease: 'power2.out'
    });
  });
}

/* ==========================================
   2. Three.js Particles with Repel Physics
   ========================================== */
function initThreeParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Particle System Parameters
  const count = 1000;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const originalPositions = new Float32Array(count * 3);

  // Initialize particles randomly
  for (let i = 0; i < count; i++) {
    // Position
    const x = (Math.random() - 0.5) * 10;
    const y = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 5;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    originalPositions[i * 3] = x;
    originalPositions[i * 3 + 1] = y;
    originalPositions[i * 3 + 2] = z;

    // Velocity (subtle drift)
    velocities[i * 3] = (Math.random() - 0.5) * 0.005;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Custom premium shader material (glowing points)
  const material = new THREE.PointsMaterial({
    size: 0.015,
    color: 0xe11d48,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  // Mouse Tracking
  const mouse = { x: 9999, y: 9999 }; // Offscreen initially
  const targetMouse = { x: 9999, y: 9999 };

  window.addEventListener('mousemove', (e) => {
    // Normalize coordinates (-1 to 1)
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('mouseleave', () => {
    targetMouse.x = 9999;
    targetMouse.y = 9999;
  });

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation Loop
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);

    const positionsArray = particleSystem.geometry.attributes.position.array;
    
    // Smoothly interpolate mouse coordinates
    if (targetMouse.x !== 9999) {
      mouse.x += (targetMouse.x - mouse.x) * 0.1;
      mouse.y += (targetMouse.y - mouse.y) * 0.1;
    } else {
      mouse.x = 9999;
      mouse.y = 9999;
    }

    // Convert mouse position to 3D world space (approximate at z=0 plane)
    const mouseVector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
    mouseVector.unproject(camera);
    const dir = mouseVector.sub(camera.position).normalize();
    const distanceToZZero = -camera.position.z / dir.z;
    const mouseWorld = camera.position.clone().add(dir.multiplyScalar(distanceToZZero));

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      let px = positionsArray[idx];
      let py = positionsArray[idx + 1];
      let pz = positionsArray[idx + 2];

      // Subtle natural drift
      px += velocities[idx];
      py += velocities[idx + 1];
      pz += velocities[idx + 2];

      // Boundary reset
      const bounds = 6;
      if (Math.abs(px) > bounds) px = -px;
      if (Math.abs(py) > bounds) py = -py;

      // Mouse Repulsion (Anti-gravity) Physics
      if (mouse.x !== 9999) {
        const dx = px - mouseWorld.x;
        const dy = py - mouseWorld.y;
        const dz = pz - mouseWorld.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        const repelRadius = 1.2;
        if (dist < repelRadius) {
          const force = (repelRadius - dist) / repelRadius;
          const pushX = (dx / dist) * force * 0.15;
          const pushY = (dy / dist) * force * 0.15;
          const pushZ = (dz / dist) * force * 0.1;

          px += pushX;
          py += pushY;
          pz += pushZ;
        } else {
          // Slow spring-back to original/drift position
          const ox = originalPositions[idx];
          const oy = originalPositions[idx + 1];
          const oz = originalPositions[idx + 2];

          px += (ox - px) * 0.02;
          py += (oy - py) * 0.02;
          pz += (oz - pz) * 0.02;
        }
      } else {
        // Return to normal when mouse leaves screen
        const ox = originalPositions[idx];
        const oy = originalPositions[idx + 1];
        const oz = originalPositions[idx + 2];

        px += (ox - px) * 0.02;
        py += (oy - py) * 0.02;
        pz += (oz - pz) * 0.02;
      }

      positionsArray[idx] = px;
      positionsArray[idx + 1] = py;
      positionsArray[idx + 2] = pz;
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    
    // Rotate system slightly
    particleSystem.rotation.y += 0.0005;
    particleSystem.rotation.x += 0.0002;

    renderer.render(scene, camera);
  }

  animate();
}

/* ==========================================
   3. Event Dynamic Render Setup
   ========================================== */
const sampleEvents = [
  {
    id: "hackathon",
    name: "Hackathon",
    desc: "A 24-hour sprint to build functional prototypes solving real-world civic, clinical, or technological issues.",
    date: "Oct 15, 2026",
    venue: "Advanced Labs (Block B)",
    fee: "Free",
    max: "4 per team",
    icon: "code"
  },
  {
    id: "uiux",
    name: "UI/UX Design Challenge",
    desc: "Craft high-fidelity mockups and intuitive visual workflows under tight constraints. Aesthetic precision meets layout science.",
    date: "Oct 15, 2026",
    venue: "Design Lab (Main Block)",
    fee: "Free",
    max: "Individual",
    icon: "palette"
  },
  {
    id: "coding",
    name: "Coding Competition",
    desc: "Algorithm sprints and algorithmic runtime challenges. Speed, efficiency, and optimization are your keys to the leaderboard.",
    date: "Oct 15, 2026",
    venue: "Systems Lab 1",
    fee: "₹100",
    max: "Individual",
    icon: "terminal"
  },
  {
    id: "ai",
    name: "AI Innovation Challenge",
    desc: "Build or pitch artificial intelligence solutions using LLMs, neural grids, computer vision, or predictive data models.",
    date: "Oct 16, 2026",
    venue: "AI Research Wing",
    fee: "₹200",
    max: "3 per team",
    icon: "cpu"
  },
  {
    id: "robotics",
    name: "Robotics Contest",
    desc: "Line-followers, drone maneuver challenges, or soccer-bot showoffs. Calibrate your chassis and compile your Arduino scripts.",
    date: "Oct 16, 2026",
    venue: "Central Courtyard Arena",
    fee: "₹400",
    max: "4 per team",
    icon: "cog"
  },
  {
    id: "webdev",
    name: "Web Development Contest",
    desc: "Build modern, accessible frontend landing layouts or complete full-stack tools. Responsive integrity is heavily audited.",
    date: "Oct 15, 2026",
    venue: "Web Tech Lab",
    fee: "₹150",
    max: "Individual",
    icon: "globe"
  },
  {
    id: "gaming",
    name: "Gaming Tournament",
    desc: "Competitive multiplayer esports showdown. Bring your custom gear and showcase your squad coordination in standard titles.",
    date: "Oct 16, 2026",
    venue: "Seminar Hall Complex",
    fee: "₹250",
    max: "Individual / Team",
    icon: "gamepad-2"
  },
  {
    id: "pitching",
    name: "Startup Pitch Competition",
    desc: "Pitch a venture business concept to active venture capitalists and incubation leads. Validate market readiness and revenue models.",
    date: "Oct 16, 2026",
    venue: "CCET Conference Hall",
    fee: "₹200",
    max: "4 per team",
    icon: "lightbulb"
  }
];

function renderEvents() {
  const container = document.getElementById('events-container');
  if (!container) return;

  container.innerHTML = sampleEvents.map(event => `
    <div class="glass-card p-6 rounded-2xl flex flex-col justify-between h-full group border border-white/5 hover:border-rose-500/30 relative overflow-hidden repel-element" data-event-name="${event.name}">
      <!-- Glowing hover corner -->
      <div class="absolute -top-10 -right-10 w-24 h-24 bg-rose-600/5 rounded-full blur-2xl group-hover:bg-rose-600/10 transition-all duration-300"></div>

      <div>
        <!-- Icon & Tag -->
        <div class="flex items-center justify-between mb-5">
          <div class="w-11 h-11 bg-rose-600/5 rounded-lg flex items-center justify-center text-rose-500 border border-rose-500/10 group-hover:border-rose-500/30 group-hover:bg-rose-600/10 transition-all duration-300">
            <i data-lucide="${event.icon}" class="w-5.5 h-5.5"></i>
          </div>
          <span class="event-tag text-[9px] uppercase font-display font-bold px-3 py-1 rounded-full tracking-wider">
            ${event.max}
          </span>
        </div>

        <!-- Name & Desc -->
        <h4 class="font-display font-bold text-lg text-white tracking-wide group-hover:text-rose-500 transition-colors">${event.name}</h4>
        <p class="text-xs text-zinc-400 mt-2.5 leading-relaxed">${event.desc}</p>
      </div>

      <!-- Info Details -->
      <div class="mt-6 border-t border-white/5 pt-4 space-y-2">
        <div class="flex justify-between text-xs text-zinc-400">
          <span class="flex items-center"><i data-lucide="calendar" class="w-3.5 h-3.5 mr-1.5 text-rose-500"></i> Date:</span>
          <span class="text-white font-medium">${event.date}</span>
        </div>
        <div class="flex justify-between text-xs text-zinc-400">
          <span class="flex items-center"><i data-lucide="map-pin" class="w-3.5 h-3.5 mr-1.5 text-rose-500"></i> Venue:</span>
          <span class="text-white font-medium truncate max-w-[160px]">${event.venue}</span>
        </div>
        <div class="flex justify-between text-xs text-zinc-400">
          <span class="flex items-center"><i data-lucide="credit-card" class="w-3.5 h-3.5 mr-1.5 text-rose-500"></i> Entry Fee:</span>
          <span class="text-rose-500 font-display font-bold text-sm">${event.fee}</span>
        </div>

        <!-- Action Register Button -->
        <button onclick="registerForEvent('${event.name}')" class="w-full mt-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-display font-bold rounded-md text-xs uppercase tracking-widest transition-colors flex items-center justify-center space-x-2">
          <span>Register Now</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* ==========================================
   4. Countdown Timer Engine
   ========================================== */
function initCountdown() {
  // Set date to 30 days into the future dynamically so it always ticks!
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 29);
  targetDate.setHours(9, 30, 0, 0); // 9:30 AM starts

  function update() {
    const now = new Date().getTime();
    const diff = targetDate.getTime() - now;

    if (diff <= 0) {
      clearInterval(interval);
      document.getElementById('days').innerText = "00";
      document.getElementById('hours').innerText = "00";
      document.getElementById('minutes').innerText = "00";
      document.getElementById('seconds').innerText = "00";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('days').innerText = String(d).padStart(2, '0');
    document.getElementById('hours').innerText = String(h).padStart(2, '0');
    document.getElementById('minutes').innerText = String(m).padStart(2, '0');
    document.getElementById('seconds').innerText = String(s).padStart(2, '0');
  }

  update();
  const interval = setInterval(update, 1000);
}

/* ==========================================
   5. GSAP Entrance Scroll Reveals
   ========================================== */
function initGSAPAnimations() {
  if (typeof gsap === 'undefined') return;

  // Hero section entry sequence
  const heroTl = gsap.timeline();
  
  heroTl.to('.reveal-hero', {
    y: 0,
    opacity: 1,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power4.out',
    delay: 0.5
  });

  // Scroll reveals for sections
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Navbar effect on scroll
    ScrollTrigger.create({
      start: 'top -80px',
      onEnter: () => {
        document.querySelector('header').classList.add('py-1', 'shadow-2xl', 'bg-black/90');
        document.querySelector('header').classList.remove('py-0');
      },
      onLeaveBack: () => {
        document.querySelector('header').classList.remove('py-1', 'shadow-2xl', 'bg-black/90');
      }
    });

    // Animate cards on scroll reveal
    gsap.from('#events-container > div', {
      scrollTrigger: {
        trigger: '#events-container',
        start: 'top 80%',
      },
      opacity: 0,
      y: 40,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power3.out'
    });

    // Schedule Timeline animation
    gsap.from('#schedule .relative.pl-8', {
      scrollTrigger: {
        trigger: '#schedule',
        start: 'top 75%',
      },
      opacity: 0,
      x: -30,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power3.out'
    });
  }
}

/* ==========================================
   6. DOM Elements Mouse Repel / Anti-Gravity
   ========================================== */
function initDOMRepelEffect() {
  const isMobile = window.innerWidth < 768;
  if (isMobile) return; // Disable on mobile to prevent layout jitter

  document.addEventListener('mousemove', (e) => {
    const repelElements = document.querySelectorAll('.repel-element');
    const mx = e.clientX;
    const my = e.clientY;

    repelElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Center of element
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = cx - mx;
      const dy = cy - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Repulsion radius (200px)
      const maxDist = 220;
      if (dist < maxDist) {
        const force = (maxDist - dist) / maxDist;
        // Subtle offset (max 15 pixels push)
        const pushX = (dx / dist) * force * 15;
        const pushY = (dy / dist) * force * 15;

        el.style.transform = `translate(${pushX}px, ${pushY}px) scale(1.01)`;
        el.style.boxShadow = `0 10px 30px rgba(225, 29, 72, ${force * 0.08})`;
      } else {
        // Reset element position cleanly
        el.style.transform = '';
        el.style.boxShadow = '';
      }
    });
  });
}

/* ==========================================
   7. Registration Gate Modal & Multi-Step Logic
   ========================================== */
let activeStep = 1;

// Global click listener to close profile dropdown
document.addEventListener('click', (e) => {
  const container = document.getElementById('profile-dropdown-container');
  const dropdown = document.getElementById('profile-dropdown');
  if (container && dropdown && !container.contains(e.target)) {
    dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
    dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
  }
});

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) {
    const isHidden = dropdown.classList.contains('opacity-0');
    if (isHidden) {
      dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
      dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
    } else {
      dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
      dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    }
  }
}

function updateAuthUI() {
  const session = localStorage.getItem('currentUser');
  const menuContent = document.getElementById('profile-menu-content');
  const mobileContent = document.getElementById('mobile-menu-auth-content');
  const profileInitials = document.getElementById('profile-initials');
  const profileIconDefault = document.getElementById('profile-icon-default');
  
  if (session) {
    const user = JSON.parse(session);
    
    // Set Initials
    if (profileInitials && profileIconDefault) {
      profileIconDefault.classList.add('hidden');
      profileInitials.classList.remove('hidden');
      const initials = (user.name || 'User').substring(0, 2).toUpperCase();
      profileInitials.innerText = initials;
    }

    const loggedInLinks = `
      <div class="px-4 py-3 border-b border-white/5 mb-1 bg-rose-950/20">
        <p class="text-[10px] text-zinc-400 uppercase tracking-widest font-display mb-0.5">Welcome back</p>
        <p class="text-sm text-white font-bold truncate">${user.name || 'Student'}</p>
      </div>
      <a href="#profile" class="flex items-center space-x-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
        <i data-lucide="user" class="w-4 h-4 text-zinc-500"></i>
        <span>My Profile</span>
      </a>
      <a href="#registrations" class="flex items-center space-x-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
        <i data-lucide="ticket" class="w-4 h-4 text-zinc-500"></i>
        <span>My Registrations</span>
      </a>
      <a href="#settings" class="flex items-center space-x-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
        <i data-lucide="settings" class="w-4 h-4 text-zinc-500"></i>
        <span>Settings</span>
      </a>
      <div class="h-[1px] bg-white/5 my-1 mx-2"></div>
      <button onclick="logoutUser()" class="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left">
        <i data-lucide="log-out" class="w-4 h-4 text-zinc-500"></i>
        <span>Sign Out</span>
      </button>
    `;

    if (menuContent) menuContent.innerHTML = loggedInLinks;
    if (mobileContent) mobileContent.innerHTML = loggedInLinks;

  } else {
    // Logged out state
    if (profileInitials && profileIconDefault) {
      profileInitials.classList.add('hidden');
      profileIconDefault.classList.remove('hidden');
    }

    const loggedOutLinks = `
      <a href="login.html#signup" class="flex items-center space-x-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
        <i data-lucide="user-plus" class="w-4 h-4 text-zinc-500"></i>
        <span>Create New Account</span>
      </a>
      <a href="login.html" class="flex items-center space-x-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
        <i data-lucide="log-in" class="w-4 h-4 text-zinc-500"></i>
        <span>Sign In</span>
      </a>
      <div class="h-[1px] bg-white/5 my-1 mx-2"></div>
      <button onclick="openAdminAuthModal()" class="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left">
        <i data-lucide="shield" class="w-4 h-4"></i>
        <span>Admin Login</span>
      </button>
    `;

    if (menuContent) menuContent.innerHTML = loggedOutLinks;
    if (mobileContent) mobileContent.innerHTML = loggedOutLinks;
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  updateAuthUI();
  window.location.reload();
}

// ─── ADMIN LOGIN MODAL LOGIC ───
function openAdminAuthModal() {
  // Close mobile or profile dropdowns first
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileDropdown) {
    profileDropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
    profileDropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
  }
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
    toggleMobileMenu();
  }

  const dialog = document.getElementById('admin-auth-dialog');
  if (dialog) {
    dialog.showModal();
    // Small delay to allow display:block before fading in
    setTimeout(() => {
      dialog.classList.remove('opacity-0', 'scale-95');
      dialog.classList.add('opacity-100', 'scale-100');
    }, 10);
  }
}

function closeAdminAuthModal() {
  const dialog = document.getElementById('admin-auth-dialog');
  if (dialog) {
    dialog.classList.remove('opacity-100', 'scale-100');
    dialog.classList.add('opacity-0', 'scale-95');
    // Wait for transition before closing
    setTimeout(() => dialog.close(), 300);
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const passwordInput = document.getElementById('admin-modal-password');
  const password = passwordInput.value;
  const errorBanner = document.getElementById('admin-auth-error');
  const errorText = document.getElementById('admin-auth-error-text');
  const submitBtn = document.getElementById('admin-modal-submit');
  const originalText = submitBtn.innerHTML;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      sessionStorage.setItem('adminPassword', result.adminPassword || password);
      submitBtn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 mr-2"></i><span>Success</span>';
      lucide.createIcons();
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 500);
    } else {
      errorText.innerText = result.error || 'Invalid credentials';
      errorBanner.classList.remove('hidden');
      passwordInput.value = '';
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    errorText.innerText = 'Connection error. Please try again.';
    errorBanner.classList.remove('hidden');
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

function openRegisterModal() {
  const dialog = document.getElementById('register-dialog');
  if (dialog) {
    const token = localStorage.getItem('token');
    const session = localStorage.getItem('currentUser');
    if (!token || !session) {
      window.location.href = 'login.html';
      return;
    }
    const user = JSON.parse(session);
    
    // Reset form states
    resetForm();
    dialog.showModal();
  }
}

function closeRegisterModal() {
  const dialog = document.getElementById('register-dialog');
  if (dialog) {
    dialog.close();
  }
}

function registerForEvent(eventName) {
  openRegisterModal();
  const select = document.getElementById('selectedEvent');
  if (select) {
    select.value = eventName;
    updateFormForEventPrice();
  }
}

function updateFormForEventPrice() {
  const selectedEvent = document.getElementById('selectedEvent').value;
  const paymentBox = document.getElementById('payment-details-box');
  const screenshotBox = document.getElementById('screenshot-upload-box');
  const screenshotInput = document.getElementById('paymentScreenshot');
  const submitBtnText = document.querySelector('#submit-btn span');

  const freeEvents = ['Hackathon', 'UI/UX Design Challenge'];
  
  if (!selectedEvent || selectedEvent === '') {
    paymentBox.classList.add('hidden');
    screenshotBox.classList.add('hidden');
    screenshotInput.removeAttribute('required');
    if (submitBtnText) submitBtnText.innerText = 'Register';
  } else if (freeEvents.includes(selectedEvent)) {
    // Free Event
    paymentBox.classList.add('hidden');
    screenshotBox.classList.add('hidden');
    screenshotInput.removeAttribute('required');
    if (submitBtnText) submitBtnText.innerText = 'Confirm Registration';
  } else {
    // Paid Event
    paymentBox.classList.remove('hidden');
    screenshotBox.classList.remove('hidden');
    screenshotInput.setAttribute('required', 'required');
    if (submitBtnText) submitBtnText.innerText = 'Register & Pay';
  }
}

function resetForm() {
  activeStep = 1;
  document.getElementById('registration-form').classList.remove('hidden');
  document.getElementById('register-success').classList.add('hidden');
  document.getElementById('form-step-1').classList.remove('hidden');
  document.getElementById('form-step-2').classList.add('hidden');
  
  // Indicators
  document.getElementById('step-1-indicator').classList.add('text-red-500', 'font-bold');
  document.getElementById('step-1-indicator').classList.remove('text-gray-500');
  document.getElementById('step-2-indicator').classList.add('text-gray-500');
  document.getElementById('step-2-indicator').classList.remove('text-red-500', 'font-bold');

  // Input resets
  document.getElementById('registration-form').reset();
  updateFormForEventPrice(); // Hide payment fields on reset

  const errorBanner = document.getElementById('form-error-banner');
  errorBanner.classList.add('hidden');
  document.getElementById('upload-filename').innerText = 'Drag and drop file here, or click to browse';
  document.getElementById('upload-icon').className = 'w-10 h-10 text-gray-500 mb-2';

  // Remove valid/invalid borders
  document.querySelectorAll('#registration-form input, #registration-form select').forEach(input => {
    input.classList.remove('border-red-500', 'border-green-500');
  });
}

function nextStep() {
  // Validate Step 1 Inputs
  const name = document.getElementById('name');
  const department = document.getElementById('department');
  const email = document.getElementById('email');
  const studentId = document.getElementById('studentId');

  let valid = true;

  // Validate helper functions
  const validateField = (field, errId) => {
    const errorSpan = document.getElementById(errId);
    if (!field || !field.value || field.value.trim() === '') {
      if (errorSpan) errorSpan.classList.remove('hidden');
      if (field) field.classList.add('border-red-500');
      valid = false;
    } else {
      if (errorSpan) errorSpan.classList.add('hidden');
      if (field) {
        field.classList.remove('border-red-500');
        field.classList.add('border-green-500');
      }
    }
  };

  validateField(name, 'err-name');
  validateField(department, 'err-department');
  validateField(studentId, 'err-studentId');

  // Email check
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.value || !emailPattern.test(email.value)) {
    document.getElementById('err-email').classList.remove('hidden');
    email.classList.add('border-red-500');
    valid = false;
  } else {
    document.getElementById('err-email').classList.add('hidden');
    email.classList.remove('border-red-500');
    email.classList.add('border-green-500');
  }

  if (!valid) {
    const errorBanner = document.getElementById('form-error-banner');
    errorBanner.classList.remove('hidden');
    document.getElementById('form-error-text').innerText = 'Please fill out all fields correctly before proceeding.';
    return;
  }

  // Go to step 2
  activeStep = 2;
  document.getElementById('form-step-1').classList.add('hidden');
  document.getElementById('form-step-2').classList.remove('hidden');
  document.getElementById('form-error-banner').classList.add('hidden');

  // Update indicators
  document.getElementById('step-1-indicator').classList.remove('text-red-500', 'font-bold');
  document.getElementById('step-1-indicator').classList.add('text-gray-500');
  document.getElementById('step-2-indicator').classList.add('text-red-500', 'font-bold');
  document.getElementById('step-2-indicator').classList.remove('text-gray-500');
}

function prevStep() {
  activeStep = 1;
  document.getElementById('form-step-2').classList.add('hidden');
  document.getElementById('form-step-1').classList.remove('hidden');
  document.getElementById('form-error-banner').classList.add('hidden');

  // Update indicators
  document.getElementById('step-1-indicator').classList.add('text-red-500', 'font-bold');
  document.getElementById('step-1-indicator').classList.remove('text-gray-500');
  document.getElementById('step-2-indicator').classList.add('text-gray-500');
  document.getElementById('step-2-indicator').classList.remove('text-red-500', 'font-bold');
}

function initFormLogic() {
  const form = document.getElementById('registration-form');
  const screenshotInput = document.getElementById('paymentScreenshot');
  const filenameSpan = document.getElementById('upload-filename');
  const uploadIcon = document.getElementById('upload-icon');

  if (!form) return;

  // File Upload Visual Listener
  if (screenshotInput) {
    screenshotInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        filenameSpan.innerText = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        filenameSpan.classList.add('text-green-500', 'font-semibold');
        
        // Style changes
        uploadIcon.className = 'w-10 h-10 text-green-500 mb-2';
        document.getElementById('err-screenshot').classList.add('hidden');
      } else {
        filenameSpan.innerText = 'Drag and drop file here, or click to browse';
        filenameSpan.classList.remove('text-green-500', 'font-semibold');
        uploadIcon.className = 'w-10 h-10 text-gray-500 mb-2';
      }
    });
  }

  // Event Change Selection Listener
  const selectedEventSelect = document.getElementById('selectedEvent');
  if (selectedEventSelect) {
    selectedEventSelect.addEventListener('change', updateFormForEventPrice);
  }

  // Form Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedEvent = document.getElementById('selectedEvent');
    const paymentScreenshot = document.getElementById('paymentScreenshot');
    const submitBtn = document.getElementById('submit-btn');

    let valid = true;

    // Validate step 2 details
    if (!selectedEvent.value) {
      document.getElementById('err-event').classList.remove('hidden');
      valid = false;
    } else {
      document.getElementById('err-event').classList.add('hidden');
    }

    const freeEvents = ['Hackathon', 'UI/UX Design Challenge'];
    const isFree = freeEvents.includes(selectedEvent.value);

    if (paymentScreenshot.files.length === 0 && !isFree) {
      document.getElementById('err-screenshot').classList.remove('hidden');
      valid = false;
    } else {
      document.getElementById('err-screenshot').classList.add('hidden');
    }

    if (!valid) return;

    // Show Loading Spinner in submit button
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Securing Seat...</span>
    `;

    // Package Multipart Form Data
    const formData = new FormData(form);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success Actions
        form.classList.add('hidden');
        const successBox = document.getElementById('register-success');
        successBox.classList.remove('hidden');

        // Populate receipt info
        document.getElementById('receipt-id').innerText = result.registration.id.substring(0, 8).toUpperCase();
        document.getElementById('receipt-event').innerText = result.registration.event;

        // Trigger Confetti Celebrations!
        if (typeof confetti !== 'undefined') {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
      } else {
        // Failure Actions
        const errorBanner = document.getElementById('form-error-banner');
        errorBanner.classList.remove('hidden');
        document.getElementById('form-error-text').innerText = result.error || 'Registration failed. Please check details and try again.';
      }
    } catch (err) {
      console.error('Submit API error:', err);
      const errorBanner = document.getElementById('form-error-banner');
      errorBanner.classList.remove('hidden');
      document.getElementById('form-error-text').innerText = 'Server connection timeout. Please verify network settings.';
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/* ==========================================
   8. Mobile Drawer Menu Toggle
   ========================================== */
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const drawer = document.getElementById('mobile-menu');

  if (toggle && drawer) {
    toggle.addEventListener('click', toggleMobileMenu);
  }
}

function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-menu');
  drawer.classList.toggle('hidden');
}
