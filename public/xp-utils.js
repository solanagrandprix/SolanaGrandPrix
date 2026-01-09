// public/xp-utils.js
// Single source of truth for driver XP / level / rank.

window.SGPXP = {
  compute: function (stats, races) {
    races = races || [];

    const starts = stats.starts || races.length || 0;
    const wins = stats.wins || 0;
    const podiums = stats.podiums || 0;
    const dnfs = stats.dnfs || 0;
    const championships = stats.championships || 0;
    const earnings =
      typeof stats.earnings === 'number' ? stats.earnings : 0;

    const totalRaces = races.length || starts;
    const winRate = totalRaces
      ? Math.round((wins / totalRaces) * 100)
      : 0;

    // best finish
    let bestFinish = null;
    races.forEach((r) => {
      if (typeof r.finish === 'number') {
        if (bestFinish === null || r.finish < bestFinish) {
          bestFinish = r.finish;
        }
      }
    });
    const bestFinishText = bestFinish === null ? '—' : 'P' + bestFinish;

    // XP math
    const xpFromStarts = starts * 50;
    const xpFromWins = wins * 150;
    const baseXp = 200;
    const totalXp = baseXp + xpFromStarts + xpFromWins;

    const xpPerLevel = 500;
    const level = Math.floor(totalXp / xpPerLevel) + 1;
    const xpIntoLevel = totalXp % xpPerLevel;
    const progressPct = Math.min(
      100,
      Math.round((xpIntoLevel / xpPerLevel) * 100)
    );

    // Skill tier
    let skillTier = 'Beginner';
    if (level >= 3 && winRate >= 20) skillTier = 'Club Racer';
    if (level >= 5 && winRate >= 35) skillTier = 'Hotlap Hero';
    if (level >= 7 && winRate >= 50) skillTier = 'Alien';

    return {
      // raw stats
      starts,
      wins,
      podiums,
      dnfs,
      championships,
      earnings,
      formattedEarnings: earnings.toLocaleString('en-US'),
      totalRaces,

      // performance
      winRate,
      bestFinish,
      bestFinishText,

      // XP / level
      totalXp,
      xpPerLevel,
      xpIntoLevel,
      progressPct,
      level,
      skillTier,
    };
  },
};
