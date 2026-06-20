import { PeriodType } from '../types/bjj';

export const ACCENT_COLOR = '#E63462';

export const GRIP_TAGS = ['Underhook/Overhook', 'Collar-Sleeve', 'Pants/Ankle', '2-on-1 / Russian Tie', 'Seatbelt Control'];
export const SPACE_TAGS = ['Inside Space Control', 'Cross-face', 'Knee Shield', 'Lost Underhook', 'Flat on Back', 'Poor Frame'];

export const getSunday = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

export const getSaturday = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  return new Date(d.setDate(diff));
};

export const getDatesForPeriod = (period: PeriodType) => {
  const today = new Date();
  let startDate = new Date();

  switch (period) {
    case 'this_month':
      startDate.setDate(today.getDate() - 34);
      break;
    case 'this_year':
      startDate = new Date(today.getFullYear(), 0, 1);
      break;
    case '2025':
      startDate = new Date(2025, 0, 1);
      break;
    case '2026':
      startDate = new Date(2026, 0, 1);
      break;
    case 'all':
    default:
      startDate.setDate(today.getDate() - 363);
      break;
  }

  const startSunday = getSunday(new Date(startDate));
  
  let endLimit = new Date();
  if (period === '2025') {
    endLimit = getSaturday(new Date(2025, 11, 31));
  } else if (period === '2026') {
    endLimit = getSaturday(new Date(2026, 11, 31));
  } else {
    endLimit = getSaturday(today);
  }

  const dates: string[] = [];
  const curr = new Date(startSunday);
  while (curr <= endLimit) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

export const getBeltColor = (rank: string) => {
  const r = rank?.toLowerCase();
  if (r === 'white') return '#E0E0E0';
  if (r === 'blue') return '#2A6FDB';
  if (r === 'purple') return '#8B5CF6';
  if (r === 'brown') return '#8B5A2B';
  if (r === 'black') return '#1A1A1A';
  return '#8E8E93'; // Fallback
};

export const getActionVerb = (type: string) => {
  if (type === 'Takedown') return 'secured a takedown';
  if (type === 'Guard Pass') return 'passed guard';
  if (type === 'Sweep') return 'swept';
  if (type === 'Submission Attempt') return 'attempted a submission';
  return type; // Fallback
};

export const invertPerspective = (position: string, who: 'I' | 'Opponent') => {
  if (who === 'I') return position;
  if (!position) return position;
  if (position === 'Back Control (Attacking)') return 'Back Taken (Defending)';
  if (position === 'Back Taken (Defending)') return 'Back Control (Attacking)';
  if (position === 'Closed Guard (Bottom)') return 'Closed Guard (Top)';
  if (position === 'Closed Guard (Top Passing)') return 'Closed Guard (Bottom)';
  if (position === 'Half Guard (Standard)') return 'Half Guard (Top)';
  if (position === 'Half Guard (Top Passing)') return 'Half Guard (Standard)';
  if (position.endsWith('(Top)')) {
    return position.replace('(Top)', '(Bottom)');
  }
  if (position.endsWith('(Bottom)')) {
    return position.replace('(Bottom)', '(Top)');
  }
  return position;
};

export const getIntensityDots = (intensity: string) => {
  if (intensity === 'Flow Roll') return '● ○ ○';
  if (intensity === 'Technical Sparring') return '● ● ○';
  if (intensity === 'Competition Mode') return '● ● ●';
  return '● ● ○';
};

export const isNegativeTag = (tag: string) => {
  const normalized = tag.toLowerCase().replace(' 🔴', '');
  return ['lost underhook', 'flat on back', 'flat on my back', 'poor frame', 'lost underhook 🔴', 'flat on my back 🔴', 'poor frame 🔴'].includes(normalized);
};
