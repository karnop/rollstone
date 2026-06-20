export interface BJJRoundEvent {
  id?: string;
  sequence_order: number;
  who: 'I' | 'Opponent';
  action_type: 'Initial State' | 'Takedown' | 'Guard Pass' | 'Sweep' | 'Escape' | 'Submission Attempt' | 'Submission Finish';
  move_name: string;
  resulting_position: string;
  micro_notes_tags: string[];
  micro_notes_text: string;
}

export interface BJJRoundLog {
  id: string;
  date: string;
  attire: 'Gi' | 'No-Gi';
  duration: number;
  total_rounds: number;
  intensity: 'Flow Roll' | 'Technical Sparring' | 'Competition Mode';
  partner_name: string;
  partner_rank: 'White' | 'Blue' | 'Purple' | 'Brown' | 'Black';
  partner_weight: 'Lighter' | 'Matched' | 'Heavier' | 'Ultra Heavier';
  round_focus: string;
  feel: number;
  locker_room_memo: string;
  bjj_round_events?: BJJRoundEvent[];
}

export interface DBPosition {
  id: string;
  name: string;
  category: string;
}

export interface DBMove {
  id: string;
  name: string;
  type: string;
  position_id: string | null;
}

export interface DBPartner {
  id: string;
  name: string;
  belt: 'White' | 'Blue' | 'Purple' | 'Brown' | 'Black';
  weight: 'Lighter' | 'Matched' | 'Heavier' | 'Ultra Heavier';
}

export type PeriodType = 'this_month' | 'this_year' | 'all' | '2025' | '2026';
