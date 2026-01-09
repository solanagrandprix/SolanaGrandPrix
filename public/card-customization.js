// Shared utility for applying card customizations across the site

(function() {
  'use strict';

  // Default customization state
  const defaultCustomization = {
    borderPreset: 'green-blue-purple',
    borderColor1: '#22c55e',
    borderColor2: '#06b6d4',
    borderColor3: '#8b5cf6',
    glowIntensity: 50,
    glowAnimation: 'pulse',
    borderWidth: 2,
    bgTheme: 'dark',
    bgColor1: '#0b1120',
    bgColor2: '#020617',
    nameColor: '#ffffff',
    nameEffect: 'solid',
    teamColor: '#9ca3af',
    carColor: '#d1fae5',
    statsColor: '#e5e7eb',
    enableParticles: false,
    enableShimmer: false,
    enableScanlines: false,
    cardRotation: 0,
  };

  function getGlowColors(customization) {
    const preset = customization.borderPreset || defaultCustomization.borderPreset;
    const intensity = (customization.glowIntensity || defaultCustomization.glowIntensity) / 100;
    
    if (preset === 'custom') {
      return {
        color1: customization.borderColor1 || defaultCustomization.borderColor1,
        color2: customization.borderColor2 || defaultCustomization.borderColor2,
        color3: customization.borderColor3 || defaultCustomization.borderColor3,
      };
    }

    const presets = {
      'green-blue-purple': { color1: '#22c55e', color2: '#06b6d4', color3: '#8b5cf6' },
      'fire': { color1: '#ef4444', color2: '#f97316', color3: '#fbbf24' },
      'ice': { color1: '#06b6d4', color2: '#3b82f6', color3: '#8b5cf6' },
      'electric': { color1: '#fbbf24', color2: '#8b5cf6', color3: '#ec4899' },
      'neon-pink': { color1: '#ec4899', color2: '#f472b6', color3: '#fb7185' },
      'gold': { color1: '#fbbf24', color2: '#f59e0b', color3: '#d97706' },
      'rainbow': { color1: '#ef4444', color2: '#fbbf24', color3: '#22c55e' },
    };

    return presets[preset] || presets['green-blue-purple'];
  }

  function getBackgroundStyle(customization) {
    const theme = customization.bgTheme || defaultCustomization.bgTheme;
    const color1 = customization.bgColor1 || defaultCustomization.bgColor1;
    const color2 = customization.bgColor2 || defaultCustomization.bgColor2;

    const styles = {
      'dark': `background: #0b1120;`,
      'darker': `background: #020617;`,
      'gradient-dark': `background: linear-gradient(135deg, ${color1}, ${color2});`,
      'gradient-purple': `background: linear-gradient(135deg, #1e1b4b, #312e81);`,
      'gradient-blue': `background: linear-gradient(135deg, #0c4a6e, #075985);`,
      'gradient-green': `background: linear-gradient(135deg, #064e3b, #065f46);`,
      'grid': `background: 
        linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px);
        background-size: 20px 20px;
        background-color: ${color1};`,
      'stars': `background: 
        radial-gradient(2px 2px at 20px 30px, #eee, transparent),
        radial-gradient(2px 2px at 60px 70px, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 50px 50px, #fff, transparent),
        radial-gradient(1px 1px at 90px 90px, rgba(255,255,255,0.6), transparent);
        background-size: 200px 200px;
        background-color: ${color1};
        background-position: 0 0, 40px 60px, 130px 270px, 70px 100px;`,
      'nebula': `background: radial-gradient(ellipse at top, rgba(139, 92, 246, 0.3), transparent),
        radial-gradient(ellipse at bottom, rgba(6, 182, 212, 0.3), transparent),
        ${color1};`,
      'matrix': `background: 
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34, 197, 94, 0.03) 2px, rgba(34, 197, 94, 0.03) 4px),
        ${color1};`,
    };

    return styles[theme] || styles['dark'];
  }

  function getNameStyle(customization) {
    const color = customization.nameColor || defaultCustomization.nameColor;
    const effect = customization.nameEffect || defaultCustomization.nameEffect;

    if (effect === 'gradient') {
      return `background: linear-gradient(135deg, ${color}, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;`;
    } else if (effect === 'glow') {
      return `color: ${color}; text-shadow: 0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color};`;
    } else if (effect === 'neon') {
      return `color: ${color}; text-shadow: 0 0 5px ${color}, 0 0 10px ${color}, 0 0 15px ${color}, 0 0 20px ${color};`;
    } else if (effect === 'anaglyph') {
      return `color: ${color}; text-shadow: 2px 2px 0px #ff0000, -2px -2px 0px #00ffff;`;
    } else {
      return `color: ${color};`;
    }
  }

  function getGlowAnimation(customization) {
    const anim = customization.glowAnimation || defaultCustomization.glowAnimation;
    const intensity = (customization.glowIntensity || defaultCustomization.glowIntensity) / 100;
    
    if (anim === 'static') return 'none';
    return anim;
  }

  // Apply customizations to a card element
  window.applyCardCustomization = function(cardElement, customization, stats) {
    if (!cardElement || !customization) return;

    const frame = cardElement.querySelector('.nft-frame') || cardElement;
    const inner = cardElement.querySelector('.nft-inner') || frame.querySelector('.nft-inner');
    
    if (!frame) return;

    // Merge with defaults
    const custom = { ...defaultCustomization, ...customization };
    
    const glowColors = getGlowColors(custom);
    const borderWidth = custom.borderWidth || defaultCustomization.borderWidth;
    const borderGradient = `linear-gradient(135deg, ${glowColors.color1}, ${glowColors.color2}, ${glowColors.color3})`;
    const glowAnim = getGlowAnimation(custom);
    const intensity = custom.glowIntensity / 100;
    const rotation = custom.cardRotation || 0;
    
    // Build glow shadow
    let glowShadow = '';
    if (glowAnim === 'static') {
      const r1 = Math.round(parseInt(glowColors.color1.slice(1, 3), 16) * intensity);
      const g1 = Math.round(parseInt(glowColors.color1.slice(3, 5), 16) * intensity);
      const b1 = Math.round(parseInt(glowColors.color1.slice(5, 7), 16) * intensity);
      const r2 = Math.round(parseInt(glowColors.color2.slice(1, 3), 16) * intensity);
      const g2 = Math.round(parseInt(glowColors.color2.slice(3, 5), 16) * intensity);
      const b2 = Math.round(parseInt(glowColors.color2.slice(5, 7), 16) * intensity);
      glowShadow = `0 0 ${20 * intensity}px rgba(${r1}, ${g1}, ${b1}, 0.8), 0 0 ${40 * intensity}px rgba(${r2}, ${g2}, ${b2}, 0.6)`;
    }

    // Animation class
    let animClass = '';
    if (glowAnim === 'pulse') animClass = 'glowPulse';
    else if (glowAnim === 'flicker') animClass = 'glowFlicker';
    else if (glowAnim === 'breath') animClass = 'glowBreath';
    else if (glowAnim === 'wave') animClass = 'glowWave';
    else if (glowAnim === 'chaos') animClass = 'glowChaos';

    // Apply styles to frame
    frame.style.padding = `${borderWidth}px`;
    frame.style.background = borderGradient;
    frame.style.transform = rotation !== 0 ? `perspective(1000px) rotateY(${rotation}deg)` : '';
    
    if (glowAnim === 'static') {
      frame.style.boxShadow = glowShadow;
      frame.style.animation = 'none';
    } else {
      frame.style.animation = `${animClass} 4s ease-in-out infinite`;
    }

    // Add effect classes
    if (custom.enableShimmer) {
      frame.classList.add('shimmer-effect');
    } else {
      frame.classList.remove('shimmer-effect');
    }

    if (custom.enableScanlines) {
      frame.classList.add('scanlines');
    } else {
      frame.classList.remove('scanlines');
    }

    // Apply background to inner
    if (inner) {
      inner.style.cssText += '; ' + getBackgroundStyle(custom);
    }

    // Apply text colors
    const nameEl = cardElement.querySelector('.driver-name');
    if (nameEl && stats) {
      nameEl.style.cssText = getNameStyle(custom);
    }

    const teamEl = cardElement.querySelector('.driver-team');
    if (teamEl) {
      teamEl.style.color = custom.teamColor || defaultCustomization.teamColor;
    }

    const carEl = cardElement.querySelector('.driver-car');
    if (carEl) {
      carEl.style.color = custom.carColor || defaultCustomization.carColor;
    }

    const statsEl = cardElement.querySelector('.driver-stats');
    if (statsEl) {
      statsEl.style.color = custom.statsColor || defaultCustomization.statsColor;
    }
  };
})();
