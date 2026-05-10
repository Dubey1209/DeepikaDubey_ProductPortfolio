// Skill persona tooltips on skill cards (single init per card)
function initializeSkillPersona() {
  const skillCards = document.querySelectorAll('.skill-card-pm');

  skillCards.forEach((card) => {
    if (card.dataset.personaBound === 'true') return;

    const persona = card.getAttribute('data-skill-persona');
    if (!persona) return;

    card.dataset.personaBound = 'true';

    const popup = document.createElement('div');
    popup.className = 'skill-persona-popup';
    popup.style.cssText = `
      position: absolute;
      top: 50%;
      left: 100%;
      transform: translateY(-50%);
      width: 280px;
      background: linear-gradient(135deg, #2a7ae2 0%, #a259ff 100%);
      color: white;
      padding: 1rem;
      border-radius: 12px;
      font-size: 0.85rem;
      line-height: 1.4;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 1000;
      box-shadow: 0 10px 30px rgba(42, 122, 226, 0.3);
      margin-left: 1rem;
      pointer-events: none;
    `;

    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      top: 50%;
      left: -8px;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 8px 8px 8px 0;
      border-color: transparent #2a7ae2 transparent transparent;
    `;
    popup.appendChild(arrow);

    const emoji = document.createElement('div');
    emoji.textContent = '💭';
    emoji.style.cssText = `
      position: absolute;
      top: -10px;
      right: 10px;
      font-size: 1.2rem;
      opacity: 0.7;
    `;
    popup.appendChild(emoji);

    const text = document.createElement('div');
    text.textContent = persona;
    text.style.cssText = 'position: relative; z-index: 1;';
    popup.appendChild(text);

    card.appendChild(popup);

    card.addEventListener('mouseenter', () => {
      popup.style.opacity = '1';
      popup.style.visibility = 'visible';
      popup.style.transform = 'translateY(-50%) translateX(10px)';
      card.style.boxShadow = '0 15px 35px rgba(42, 122, 226, 0.15)';
      card.style.transform = 'translateY(-5px) scale(1.02)';
    });

    card.addEventListener('mouseleave', () => {
      popup.style.opacity = '0';
      popup.style.visibility = 'hidden';
      popup.style.transform = 'translateY(-50%)';
      card.style.boxShadow = '';
      card.style.transform = '';
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSkillPersona);
} else {
  initializeSkillPersona();
}
