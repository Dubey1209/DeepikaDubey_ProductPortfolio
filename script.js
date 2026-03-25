// Mobile Navigation
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const drawerOverlay = document.querySelector('.drawer-overlay');
const drawerCloseBtn = document.querySelector('.drawer-close-btn');
const dropdownToggles = document.querySelectorAll('.dropdown > a');
let isMenuOpen = false;

// Toggle mobile menu
function toggleMenu() {
  isMenuOpen = !isMenuOpen;
  navLinks.classList.toggle('open', isMenuOpen);
  document.body.style.overflow = isMenuOpen ? 'hidden' : '';
  
  if (drawerOverlay) {
    drawerOverlay.classList.toggle('visible', isMenuOpen);
  }
  
  // Toggle aria attributes
  menuToggle.setAttribute('aria-expanded', isMenuOpen);
  
  // Close all dropdowns when toggling the main menu
  if (!isMenuOpen) {
    document.querySelectorAll('.dropdown-content').forEach(dropdown => {
      dropdown.classList.remove('show');
    });
    dropdownToggles.forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }
}

// Close menu when clicking outside
function closeMenu() {
  navLinks.classList.remove('open');
  document.body.style.overflow = '';
  
  if (drawerOverlay) {
    drawerOverlay.classList.remove('visible');
  }
  
  menuToggle.setAttribute('aria-expanded', 'false');
}

// Toggle dropdown menus on mobile
function toggleDropdown(e) {
  if (window.innerWidth <= 800) {
    e.preventDefault();
    const dropdown = this.nextElementSibling;
    const isOpen = !dropdown.classList.contains('show');
    
    // Close all dropdowns first
    document.querySelectorAll('.dropdown-content').forEach(item => {
      item.classList.remove('show');
    });
    
    // Toggle current dropdown if needed
    if (isOpen) {
      dropdown.classList.add('show');
      this.setAttribute('aria-expanded', 'true');
      
      // Close dropdown when clicking outside
      const handleClickOutside = (event) => {
        if (!event.target.closest('.dropdown')) {
          dropdown.classList.remove('show');
          this.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', handleClickOutside);
        }
      };
      
      // Add event listener to close on outside click
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      this.setAttribute('aria-expanded', 'false');
    }
  }
}

// Event Listeners
if (menuToggle && navLinks) {
  // Toggle menu when clicking the hamburger button
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });
  
  // Close menu when clicking on overlay
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }
  
  // Close menu when clicking close button
  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }
  
  // Close menu when clicking a nav link (for single page navigation)
  navLinks.querySelectorAll('a:not(.dropdown > a)').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 800) {
        closeMenu();
      }
    });
  });
  
  // Handle dropdown toggles
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', toggleDropdown);
    
    // Add keyboard navigation for dropdowns
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDropdown(e);
      } else if (e.key === 'Escape') {
        const dropdown = toggle.nextElementSibling;
        dropdown.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// Close menu when pressing Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isMenuOpen) {
    closeMenu();
  }
});

// Initialize dropdown toggles
dropdownToggles.forEach(toggle => {
  toggle.addEventListener('click', toggleDropdown);
  
  // Add dropdown indicator
  const indicator = document.createElement('span');
  indicator.className = 'dropdown-indicator';
  indicator.innerHTML = '<svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  
  if (window.innerWidth <= 768) {
    toggle.appendChild(indicator);
  }
});

// Handle window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth > 768) {
      // Reset mobile menu state on desktop
      closeMenu();
      
      // Reset dropdowns
      document.querySelectorAll('.dropdown-content').forEach(dropdown => {
        dropdown.classList.remove('show');
      });
    }
  }, 250);
});

// Prevent form submission (demo only)
document.querySelector('.contact-form').addEventListener('submit', function(e) {
  e.preventDefault();
});

// Fade-in on scroll for story-scroll-segment
function revealStorySegments() {
  const segments = document.querySelectorAll('.story-scroll-segment');
  const windowHeight = window.innerHeight;
  segments.forEach(seg => {
    const rect = seg.getBoundingClientRect();
    if (rect.top < windowHeight - 60) {
      seg.classList.add('visible');
    }
  });
}
window.addEventListener('scroll', revealStorySegments);
window.addEventListener('DOMContentLoaded', revealStorySegments);

// Unique Section/Page Transition Effects
(function() {
  // Create overlay for page transitions
  let overlay = document.createElement('div');
  overlay.className = 'page-transition-overlay';
  document.body.appendChild(overlay);

  // Helper: get section from hash
  function getSectionFromHash(hash) {
    if (!hash) return null;
    return document.querySelector(hash);
  }

  // Animate section transitions for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function(e) {
      const hash = this.getAttribute('href');
      if (!hash || hash === '#' || !document.querySelector(hash)) return;
      const targetSection = document.querySelector(hash);
      const currentSection = document.querySelector('.section:target') || document.querySelector('.section');
      if (!targetSection || targetSection === currentSection) return;
      e.preventDefault();
      // Animate out current
      if (currentSection) {
        currentSection.classList.add('transitioning-out');
        setTimeout(() => {
          currentSection.classList.remove('transitioning-out');
        }, 600);
      }
      // Animate in target
      setTimeout(() => {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetSection.classList.add('transitioning-in');
        setTimeout(() => {
          targetSection.classList.remove('transitioning-in');
        }, 800);
      }, 200);
    });
  });

  // Animate page transitions for .html links
  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      overlay.classList.add('active');
      setTimeout(() => {
        window.location.href = href;
      }, 600);
    });
  });
})();

// Smooth scroll for anchor links
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId.length > 1 && document.querySelector(targetId)) {
        e.preventDefault();
        document.querySelector(targetId).scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});

// Fade in/out transition for section navigation

document.addEventListener('DOMContentLoaded', function() {
  const anchors = document.querySelectorAll('a[href^="#"]');
  const sections = document.querySelectorAll('section');

  anchors.forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId.length > 1 && document.querySelector(targetId)) {
        e.preventDefault();
        const targetSection = document.querySelector(targetId);
        const currentSection = Array.from(sections).find(sec => sec.getBoundingClientRect().top <= 80 && sec.getBoundingClientRect().bottom > 80);
        if (currentSection && currentSection !== targetSection) {
          currentSection.style.transition = 'opacity 0.4s';
          currentSection.style.opacity = 0;
          setTimeout(() => {
            window.location.hash = targetId;
            currentSection.style.opacity = '';
            sections.forEach(sec => sec.style.opacity = '');
            targetSection.style.opacity = 0;
            targetSection.style.transition = 'opacity 0.4s';
            setTimeout(() => {
              targetSection.style.opacity = 1;
              setTimeout(() => {
                targetSection.style.transition = '';
                targetSection.style.opacity = '';
              }, 400);
            }, 10);
          }, 400);
        } else {
          window.location.hash = targetId;
        }
      }
    });
  });
});

// Experience Modal Functionality
const experienceData = {
  tnumber: {
    title: "Associate Product Management Intern",
    company: "Tnumber",
    type: "Communication Platform",
    period: "Current",
    description: `
      <ul>
        <li><strong>Product Led end-to-end execution</strong> of product features across web dashboards and mobile applications, coordinating with engineers to deliver usability improvements that resulted in 30% reduction in support tickets.</li>
        <li><strong>Restructured product backlog</strong> by detailing Jira tickets with subtasks and prioritizing high-impact bugs, streamlining sprint execution and achieving 35% faster bug resolution.</li>
        <li><strong>Implemented onboarding improvements</strong> by simplifying UI flows based on user feedback, collaborating with design team to improve product intuitiveness, leading to 15% improvement in onboarding completion rate.</li>
        <li><strong>Analyzed product analytics</strong> and user feedback to track adoption and usage trends, identifying areas for feature iteration and informing product decisions that drove 15% increase in feature adoption.</li>
        <li><strong>Conducted product QA</strong> across platforms, identified 60+ bugs, and raised GitHub issues, collaborating with engineering teams to ensure stable feature releases.</li>
      </ul>
    `
  },
  thatha: {
    title: "Product Lead Intern", 
    company: "THATha Business Development",
    type: "Early-stage SaaS Startup",
    period: "Jul 2025 - Nov 2025",
    location: "Bangalore, India",
    description: `
      <ul>
        <li><strong>Owned roadmap planning</strong> and backlog prioritization for a multi-tenant SaaS product, aligning delivery with customer success goals, resulting in 20% increase in user engagement.</li>
        <li><strong>Translated stakeholder requirements</strong> into technical specifications, streamlining website flow and clarifying feature sections to accelerate engineering execution by 15%.</li>
        <li><strong>Led usability testing</strong> and funnel analysis with 15-20 participants to identify friction points in user journey and simplify the interface.</li>
        <li><strong>Refined website flow</strong> and feature presentation, improving user experience and enhancing overall engagement from new users, leading to a 17% increase in conversion rates.</li>
        <li><strong>Collaborated with design and development teams</strong> to implement 10 website features for an early-stage SaaS product, iterating quickly based on user feedback.</li>
        <li><strong>Conducted lightweight usability testing</strong>, guiding users through the product and observing navigation of key flows to identify usability issues.</li>
        <li><strong>Prioritized features</strong> to improve usability and customer onboarding for pilot customers, shaping the product experience based on early user feedback.</li>
      </ul>
    `
  },
  'sdc-si': {
    title: "Android Developer",
    company: "Software Incubator (SDC SI)", 
    type: "Mobile Product Development",
    period: "Aug 2023 - Nov 2023",
    location: "Ghaziabad, India",
    description: `
      <ul>
        <li><strong>Developed Android UI screens</strong> using XML layouts, integrating backend REST APIs to ensure smooth data retrieval and interaction, leading to 10% improvement in app responsiveness.</li>
        <li><strong>Optimized onboarding flow</strong> and feature accessibility based on product usage data, improving API integrations and UI responsiveness, resulting in a 10% increase in feature adoption and Day-1 retention.</li>
        <li><strong>Addressed delays in data fetching</strong> from backend APIs by optimizing network calls and data rendering within the UI, achieving 15% reduction in data loading times.</li>
      </ul>
    `
  }
};

function openExperienceModal(experienceId) {
  const modal = document.getElementById('experienceModal');
  const modalBody = document.getElementById('modal-body');
  const data = experienceData[experienceId];
  
  if (data) {
    let modalHTML = `
      <h3>${data.title}</h3>
      <div class="company-info">
        <span class="company-name">${data.company}</span>
        <span class="company-type">${data.type}</span>
        <span class="experience-period">${data.period}</span>
        ${data.location ? `<span class="experience-period">${data.location}</span>` : ''}
      </div>
      <div class="full-description">
        ${data.description}
      </div>
    `;
    
    modalBody.innerHTML = modalHTML;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeExperienceModal() {
  const modal = document.getElementById('experienceModal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeExperienceModal();
  }
});

// Close modal when clicking outside content
document.getElementById('experienceModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeExperienceModal();
  }
}); 