import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { ChoiceChips } from '@/components/choice-chips';
import { styles } from '@/app/index.styles';
import { BJJRoundEvent, BJJRoundLog, DBPosition, DBMove, DBPartner } from '@/types/bjj';
import { 
  ACCENT_COLOR, 
  GRIP_TAGS, 
  SPACE_TAGS, 
  getBeltColor, 
  getActionVerb, 
  invertPerspective, 
  isNegativeTag 
} from '@/utils/bjj-helpers';

interface LogSessionModalProps {
  visible: boolean;
  editingLog: BJJRoundLog | null;
  initialDate?: string | null;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export function LogSessionModal({ visible, editingLog, initialDate, onClose, onSaveSuccess }: LogSessionModalProps) {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const modalFormScrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  // Data Loading States
  const [dbPositions, setDbPositions] = useState<DBPosition[]>([]);
  const [dbMoves, setDbMoves] = useState<DBMove[]>([]);
  const [dbPartners, setDbPartners] = useState<DBPartner[]>([]);
  const [savingLog, setSavingLog] = useState(false);

  // Steps & Modals
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerBelt, setNewPartnerBelt] = useState<'White' | 'Blue' | 'Purple' | 'Brown' | 'Black'>('White');
  const [newPartnerWeight, setNewPartnerWeight] = useState<'Lighter' | 'Matched' | 'Heavier' | 'Ultra Heavier'>('Matched');
  const [creatingPartnerState, setCreatingPartnerState] = useState(false);

  // Form States - Log
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAttire, setFormAttire] = useState<'Gi' | 'No-Gi'>('Gi');
  const [formDuration, setFormDuration] = useState('5');
  const [formTotalRounds, setFormTotalRounds] = useState('1');
  const [formIntensity, setFormIntensity] = useState<'Flow Roll' | 'Technical Sparring' | 'Competition Mode'>('Technical Sparring');
  
  // Selected Partner (anonymous by default)
  const [formPartnerId, setFormPartnerId] = useState<string>('anonymous');
  const [formPartnerName, setFormPartnerName] = useState('Anonymous Partner');
  const [formPartnerRank, setFormPartnerRank] = useState<'White' | 'Blue' | 'Purple' | 'Brown' | 'Black'>('White');
  const [formPartnerWeight, setFormPartnerWeight] = useState<'Lighter' | 'Matched' | 'Heavier' | 'Ultra Heavier'>('Matched');
  
  const [formRoundFocus, setFormRoundFocus] = useState('');
  const [formFeel, setFormFeel] = useState<number>(5);
  const [formLockerMemo, setFormLockerMemo] = useState('');

  // Custom show manual date input fallback toggle
  const [showCustomDateInput, setShowCustomDateInput] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Bottom sheet config for conversational selectors
  const [bottomSheetConfig, setBottomSheetConfig] = useState<{
    type: 'who' | 'action_type' | 'resulting_position' | 'move_name' | 'micro_notes';
    eventIndex: number;
    title: string;
  } | null>(null);

  // Height state for auto-growing Focus Goal input (defaults to 2 lines)
  const [focusHeight, setFocusHeight] = useState(52);

  // Interactive Timeline Builder State
  const [timelineEvents, setTimelineEvents] = useState<BJJRoundEvent[]>([
    {
      sequence_order: 1,
      who: 'I',
      action_type: 'Initial State',
      move_name: 'Started Standing',
      resulting_position: 'Standing / Takedown Phase',
      micro_notes_tags: [],
      micro_notes_text: '',
    }
  ]);

  // Track expanded state for timeline block micro notes
  const [expandedEventIndexes, setExpandedEventIndexes] = useState<Record<number, boolean>>({});

  // Fetch partners, positions, and moves
  const fetchBJJMetadata = async () => {
    try {
      const { data: posData } = await supabase.from('bjj_positions').select('*').order('name');
      if (posData) setDbPositions(posData);

      const { data: moveData } = await supabase.from('bjj_moves').select('*').order('name');
      if (moveData) setDbMoves(moveData);

      if (user) {
        const { data: partnerData } = await supabase.from('bjj_partners').select('*').order('name');
        if (partnerData) setDbPartners(partnerData as DBPartner[]);
      }
    } catch (e) {
      console.warn('Could not fetch positions taxonomy metadata', e);
    }
  };

  // Fetch metadata on mount or when user changes
  useEffect(() => {
    if (visible) {
      fetchBJJMetadata();
    }
  }, [visible, user]);

  // Handle edit prepopulation
  useEffect(() => {
    if (visible && editingLog) {
      setFormDate(editingLog.date);
      setFormAttire(editingLog.attire);
      setFormDuration(String(editingLog.duration));
      setFormTotalRounds(String(editingLog.total_rounds || 1));
      setFormIntensity(editingLog.intensity);
      
      const foundPartner = dbPartners.find(p => p.name === editingLog.partner_name);
      if (foundPartner) {
        setFormPartnerId(foundPartner.id);
      } else if (editingLog.partner_name === 'Anonymous Partner') {
        setFormPartnerId('anonymous');
      } else {
        setFormPartnerId('new');
      }
      
      setFormPartnerName(editingLog.partner_name || 'Anonymous Partner');
      setFormPartnerRank(editingLog.partner_rank || 'White');
      setFormPartnerWeight(editingLog.partner_weight || 'Matched');
      setFormRoundFocus(editingLog.round_focus || '');
      setFormFeel(editingLog.feel);
      setFormLockerMemo(editingLog.locker_room_memo || '');
      
      if (editingLog.bjj_round_events && editingLog.bjj_round_events.length > 0) {
        setTimelineEvents(editingLog.bjj_round_events.map(ev => ({
          sequence_order: ev.sequence_order,
          who: ev.who,
          action_type: ev.action_type,
          move_name: ev.move_name || '',
          resulting_position: ev.resulting_position,
          micro_notes_tags: ev.micro_notes_tags || [],
          micro_notes_text: ev.micro_notes_text || '',
        })));
      } else {
        resetTimeline();
      }
      setCurrentStep(1);
    } else if (visible && !editingLog) {
      // Clear form for fresh log
      resetFormStates();
      if (initialDate) {
        setFormDate(initialDate);
      }
    }
  }, [visible, editingLog, dbPartners, initialDate]);

  const resetTimeline = () => {
    setTimelineEvents([
      {
        sequence_order: 1,
        who: 'I',
        action_type: 'Initial State',
        move_name: 'Started Standing',
        resulting_position: 'Standing / Takedown Phase',
        micro_notes_tags: [],
        micro_notes_text: '',
      }
    ]);
  };

  const resetFormStates = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAttire('Gi');
    setFormDuration('5');
    setFormTotalRounds('1');
    setFormIntensity('Technical Sparring');
    setFormPartnerId('anonymous');
    setFormPartnerName('Anonymous Partner');
    setFormPartnerRank('White');
    setFormPartnerWeight('Matched');
    setFormRoundFocus('');
    setFormFeel(5);
    setFormLockerMemo('');
    resetTimeline();
    setExpandedEventIndexes({});
    setCurrentStep(1);
    setShowCreatePartner(false);
    setNewPartnerName('');
    setNewPartnerBelt('White');
    setNewPartnerWeight('Matched');
    setShowCustomDateInput(false);
  };

  // Add timeline block constructor
  const addTimelineBlock = () => {
    setTimelineEvents(prevEvents => {
      const lastEvent = prevEvents[prevEvents.length - 1];
      const defaultPos = lastEvent ? lastEvent.resulting_position : 'Standing / Takedown Phase';
      return [
        ...prevEvents,
        {
          sequence_order: prevEvents.length + 1,
          who: 'I',
          action_type: 'Guard Pass',
          move_name: '',
          resulting_position: defaultPos,
          micro_notes_tags: [],
          micro_notes_text: '',
        }
      ];
    });
  };

  // Remove timeline block
  const removeTimelineBlock = (idxToRemove: number) => {
    setTimelineEvents(prevEvents => {
      const filtered = prevEvents.filter((_, idx) => idx !== idxToRemove);
      return filtered.map((ev, i) => ({
        ...ev,
        sequence_order: i + 1
      }));
    });
  };

  // Helper selectors
  const selectPartner = (partner: DBPartner | 'anonymous') => {
    if (partner === 'anonymous') {
      setFormPartnerId('anonymous');
      setFormPartnerName('Anonymous Partner');
      setFormPartnerRank('White');
      setFormPartnerWeight('Matched');
    } else {
      setFormPartnerId(partner.id);
      setFormPartnerName(partner.name);
      setFormPartnerRank(partner.belt);
      setFormPartnerWeight(partner.weight);
    }
  };

  const handleCreatePartner = async () => {
    if (!user || !newPartnerName.trim()) return;
    setCreatingPartnerState(true);
    try {
      const { data, error } = await supabase
        .from('bjj_partners')
        .insert({
          user_id: user.id,
          name: newPartnerName.trim(),
          belt: newPartnerBelt,
          weight: newPartnerWeight
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error creating partner', error.message);
        return;
      }

      if (data) {
        setDbPartners(prev => [data as DBPartner, ...prev]);
        selectPartner(data as DBPartner);
        setShowCreatePartner(false);
        setNewPartnerName('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingPartnerState(false);
    }
  };

  // Save full timeline round in Supabase
  const handleSaveRound = async () => {
    if (!user) return;
    setSavingLog(true);

    try {
      let parentLog = null;
      if (editingLog) {
        const { data, error: parentError } = await supabase
          .from('bjj_logs')
          .update({
            date: formDate,
            attire: formAttire,
            duration: parseInt(formDuration) || 5,
            total_rounds: parseInt(formTotalRounds) || 1,
            intensity: formIntensity,
            partner_name: formPartnerName,
            partner_rank: formPartnerRank,
            partner_weight: formPartnerWeight,
            round_focus: formRoundFocus.trim(),
            feel: formFeel,
            locker_room_memo: formLockerMemo.trim(),
          })
          .eq('id', editingLog.id)
          .select()
          .single();

        if (parentError) {
          Alert.alert('Database Error', parentError.message);
          setSavingLog(false);
          return;
        }
        parentLog = data;

        // Delete existing events
        await supabase.from('bjj_round_events').delete().eq('log_id', editingLog.id);
      } else {
        const { data, error: parentError } = await supabase
          .from('bjj_logs')
          .insert({
            user_id: user.id,
            date: formDate,
            attire: formAttire,
            duration: parseInt(formDuration) || 5,
            total_rounds: parseInt(formTotalRounds) || 1,
            intensity: formIntensity,
            partner_name: formPartnerName,
            partner_rank: formPartnerRank,
            partner_weight: formPartnerWeight,
            round_focus: formRoundFocus.trim(),
            feel: formFeel,
            locker_room_memo: formLockerMemo.trim(),
          })
          .select()
          .single();

        if (parentError) {
          Alert.alert('Database Error', parentError.message);
          setSavingLog(false);
          return;
        }
        parentLog = data;
      }

      if (parentLog) {
        const eventsToInsert = timelineEvents.map(event => ({
          log_id: parentLog.id,
          sequence_order: event.sequence_order,
          who: event.who,
          action_type: event.action_type,
          move_name: event.move_name.trim() || null,
          resulting_position: event.resulting_position,
          micro_notes_tags: event.micro_notes_tags,
          micro_notes_text: event.micro_notes_text.trim() || null,
        }));

        const { error: eventsError } = await supabase
          .from('bjj_round_events')
          .insert(eventsToInsert);

        if (eventsError) {
          console.warn('Could not insert timeline events', eventsError);
        }
      }

      resetFormStates();
      onSaveSuccess();
    } catch (e: any) {
      Alert.alert('Error saving round log', e.message);
    } finally {
      setSavingLog(false);
    }
  };

  const handleClose = () => {
    resetFormStates();
    onClose();
  };

  // Last 14 days dynamic calculation
  const last14Days = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      if (i === 0) dayName = 'Today';
      else if (i === 1) dayName = 'Yest.';
      list.push({
        date: dateStr,
        dayName,
        dayNum: d.getDate(),
      });
    }
    return list;
  }, []);

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as any);
      modalFormScrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as any);
      modalFormScrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  // Soft Pastel Micro-Chip color mapping
  const getBeltChipColors = (belt: string) => {
    switch (belt) {
      case 'White': return { bg: 'rgba(187,187,187,0.18)', text: theme.text };
      case 'Blue': return { bg: 'rgba(61,133,198,0.18)', text: '#2A75B6' };
      case 'Purple': return { bg: 'rgba(142,124,195,0.18)', text: '#7E6CA8' };
      case 'Brown': return { bg: 'rgba(140,90,60,0.18)', text: '#8C5A3C' };
      case 'Black': return { bg: 'rgba(17,17,17,0.18)', text: theme.text };
      default: return { bg: 'rgba(187,187,187,0.18)', text: theme.text };
    }
  };

  const getWeightChipColors = (weight: string) => {
    switch (weight) {
      case 'Lighter': return { bg: 'rgba(142,229,162,0.18)', text: '#3D8C50' };
      case 'Matched': return { bg: 'rgba(187,187,187,0.18)', text: theme.textSecondary };
      case 'Heavier': return { bg: 'rgba(241,194,50,0.18)', text: '#A27B00' };
      case 'Ultra Heavier': return { bg: 'rgba(204,0,0,0.18)', text: '#CC0000' };
      default: return { bg: 'rgba(187,187,187,0.18)', text: theme.textSecondary };
    }
  };

  const getAttireChipColors = (attire: string) => {
    return attire === 'Gi'
      ? { bg: 'rgba(61,133,198,0.18)', text: '#2A75B6' }
      : { bg: 'rgba(230,52,98,0.18)', text: ACCENT_COLOR };
  };

  const getIntensityChipColors = (intensity: string) => {
    switch (intensity) {
      case 'Flow Roll': return { bg: 'rgba(162,196,201,0.18)', text: '#4F8388' };
      case 'Technical Sparring': return { bg: 'rgba(241,194,50,0.18)', text: '#A27B00' };
      case 'Competition Mode': return { bg: 'rgba(204,0,0,0.18)', text: '#CC0000' };
      default: return { bg: 'rgba(187,187,187,0.18)', text: theme.textSecondary };
    }
  };

  const getFeelChipColors = (feel: number) => {
    switch (feel) {
      case 1: return { bg: 'rgba(204,0,0,0.18)', text: '#CC0000' };
      case 2: return { bg: 'rgba(224,102,102,0.18)', text: '#E06666' };
      case 3: return { bg: 'rgba(241,194,50,0.18)', text: '#A27B00' };
      case 4: return { bg: 'rgba(142,229,162,0.18)', text: '#3D8C50' };
      case 5: return { bg: 'rgba(61,133,198,0.18)', text: '#2A75B6' };
      default: return { bg: 'rgba(187,187,187,0.18)', text: theme.textSecondary };
    }
  };

  const getWhoColors = (who: string) => {
    return who === 'I'
      ? { bg: 'rgba(230,52,98,0.18)', text: ACCENT_COLOR }
      : { bg: 'rgba(187,187,187,0.18)', text: theme.textSecondary };
  };

  const renderBottomSheetOptions = () => {
    if (!bottomSheetConfig) return null;
    const { type, eventIndex } = bottomSheetConfig;
    const event = timelineEvents[eventIndex];
    if (!event) return null;

    if (type === 'who') {
      return ['I', 'Opponent'].map(option => (
        <TouchableOpacity
          key={option}
          style={{ paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderBottomWidth: 0.5, borderBottomColor: theme.backgroundElement }}
          onPress={() => {
            setTimelineEvents(prev => {
              const copy = [...prev];
              copy[eventIndex].who = option as any;
              return copy;
            });
            setBottomSheetConfig(null);
          }}>
          <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 15, color: theme.text }}>
            {option === 'I' ? 'I / You' : 'Opponent'}
          </Text>
        </TouchableOpacity>
      ));
    }

    if (type === 'action_type') {
      const actions = ['Takedown', 'Guard Pass', 'Sweep', 'Escape', 'Submission Attempt', 'Submission Finish'] as const;
      return actions.map(act => (
        <TouchableOpacity
          key={act}
          style={{ paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderBottomWidth: 0.5, borderBottomColor: theme.backgroundElement }}
          onPress={() => {
            setTimelineEvents(prev => {
              const copy = [...prev];
              copy[eventIndex].action_type = act;
              if (act === 'Escape') {
                copy[eventIndex].resulting_position = 'Closed Guard (Bottom)';
              } else if (act === 'Submission Finish') {
                copy[eventIndex].resulting_position = 'Tapped Out';
              }
              return copy;
            });
            setBottomSheetConfig(null);
          }}>
          <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 15, color: theme.text }}>{act}</Text>
        </TouchableOpacity>
      ));
    }

    if (type === 'resulting_position') {
      const isInitial = event.action_type === 'Initial State';
      
      let positions = ['Standing / Takedown Phase', ...dbPositions.map(p => p.name)];
      
      if (!isInitial) {
        if (event.action_type === 'Submission Finish') {
          positions = ['Tapped Out'];
        }
      }
      
      // Make unique
      positions = Array.from(new Set(positions));

      // Sort popular positions to the top
      const popularOrder = [
        'Standing / Takedown Phase',
        'Mount (Top)',
        'Mount (Bottom)',
        'Side Control (Top)',
        'Side Control (Bottom)',
        'Closed Guard (Top)',
        'Closed Guard (Bottom)',
        'Closed Guard (Top Passing)',
        'Half Guard (Standard)',
        'Half Guard (Top Passing)',
        'Back Control (Attacking)',
        'Back Taken (Defending)',
        'Guard (Top)',
        'Guard (Bottom)',
      ];

      positions.sort((a, b) => {
        const idxA = popularOrder.findIndex(p => a === p);
        const idxB = popularOrder.findIndex(p => b === p);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

      return positions.map(pos => (
        <TouchableOpacity
          key={pos}
          style={{ paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderBottomWidth: 0.5, borderBottomColor: theme.backgroundElement }}
          onPress={() => {
            setTimelineEvents(prev => {
              const copy = [...prev];
              copy[eventIndex].resulting_position = pos;
              return copy;
            });
            setBottomSheetConfig(null);
          }}>
          <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 15, color: theme.text }}>
            {invertPerspective(pos, event.who)}
          </Text>
        </TouchableOpacity>
      ));
    }

    if (type === 'move_name') {
      const actType = event.action_type;
      
      let predefinedMoves: string[] = [];
      if (actType === 'Takedown') {
        predefinedMoves = ['Double Leg', 'Single Leg', 'Guard Pull', 'Arm Drag', 'Hip Toss', 'Ankle Pick', 'Snap Down'];
      } else if (actType === 'Guard Pass') {
        predefinedMoves = ['Knee Slice', 'Torreando Pass', 'Over-Under Pass', 'Smash Pass', 'Body Lock Pass', 'X-Pass'];
      } else if (actType === 'Sweep') {
        predefinedMoves = ['Scissor Sweep', 'Flower Sweep', 'Hip Bump Sweep', 'Butterfly Sweep', 'Pendulum Sweep', 'Lasso Sweep'];
      } else if (actType === 'Escape') {
        predefinedMoves = ['Hip Escape / Shrimping', 'Bridge & Roll', 'Guard Recovery', 'Heist', 'Underhook Escape'];
      } else if (actType === 'Submission Attempt' || actType === 'Submission Finish') {
        predefinedMoves = ['Rear Naked Choke (RNC)', 'Guillotine Choke', 'Triangle Choke', 'Armbar', 'Kimura', 'Americana', 'Straight Ankle Lock', 'Heel Hook', 'Omoplata', 'Ezekiel Choke'];
      }

      const dbMatched = dbMoves
        .filter(m => {
          if (actType === 'Submission Finish' || actType === 'Submission Attempt') {
            return m.type === 'Submission';
          }
          if (actType === 'Guard Pass') return m.type === 'Pass' || m.type === 'Guard Pass';
          if (actType === 'Sweep') return m.type === 'Sweep';
          if (actType === 'Escape') return m.type === 'Escape';
          if (actType === 'Takedown') return m.type === 'Takedown';
          return false;
        })
        .map(m => m.name);

      const allMoves = Array.from(new Set([...predefinedMoves, ...dbMatched]));

      return (
        <View style={{ paddingHorizontal: Spacing.four, paddingTop: Spacing.two }}>
          <TextInput
            style={[
              styles.input, 
              { 
                borderColor: theme.backgroundElement, 
                color: theme.text, 
                backgroundColor: theme.backgroundElement, 
                marginBottom: Spacing.three,
                borderWidth: 1,
              }
            ]}
            placeholder="Type custom move name..."
            placeholderTextColor={theme.textSecondary}
            value={event.move_name}
            onChangeText={(val) => {
              setTimelineEvents(prev => {
                const copy = [...prev];
                copy[eventIndex].move_name = val;
                return copy;
              });
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {allMoves.map(move => {
              const isSelected = event.move_name === move;
              return (
                <TouchableOpacity
                  key={move}
                  style={{ 
                    paddingVertical: 8, 
                    paddingHorizontal: 12, 
                    borderRadius: 8, 
                    backgroundColor: isSelected ? ACCENT_COLOR : theme.backgroundElement,
                    borderWidth: 1,
                    borderColor: isSelected ? 'transparent' : theme.textSecondary + '22'
                  }}
                  onPress={() => {
                    setTimelineEvents(prev => {
                      const copy = [...prev];
                      copy[eventIndex].move_name = move;
                      return copy;
                    });
                    setBottomSheetConfig(null);
                  }}>
                  <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 13, color: isSelected ? '#ffffff' : theme.text }}>
                    {move}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (type === 'micro_notes') {
      const activeTags = event.micro_notes_tags || [];
      return (
        <View style={{ padding: Spacing.four }}>
          <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 12, color: theme.textSecondary, marginBottom: Spacing.two }}>SELECT DETAILS</Text>
          
          <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 10, color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.5 }}>GRIP SYSTEM</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.four }}>
            {GRIP_TAGS.map(tag => {
              const isSelected = activeTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => {
                    setTimelineEvents(prev => {
                      const copy = [...prev];
                      const currentTags = copy[eventIndex].micro_notes_tags || [];
                      if (currentTags.includes(tag)) {
                        copy[eventIndex].micro_notes_tags = currentTags.filter(t => t !== tag);
                      } else {
                        copy[eventIndex].micro_notes_tags = [...currentTags, tag];
                      }
                      return copy;
                    });
                  }}
                  style={{
                    backgroundColor: isSelected ? 'rgba(230,52,98,0.15)' : theme.backgroundElement,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    borderWidth: isSelected ? 0.5 : 0,
                    borderColor: ACCENT_COLOR,
                  }}>
                  <Text style={{ fontSize: 12, color: isSelected ? ACCENT_COLOR : theme.text }}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 10, color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.5 }}>SPACE & CONTROL MISTAKES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.four }}>
            {SPACE_TAGS.map(tag => {
              const isSelected = activeTags.includes(tag);
              const isNeg = isNegativeTag(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => {
                    setTimelineEvents(prev => {
                      const copy = [...prev];
                      const currentTags = copy[eventIndex].micro_notes_tags || [];
                      if (currentTags.includes(tag)) {
                        copy[eventIndex].micro_notes_tags = currentTags.filter(t => t !== tag);
                      } else {
                        copy[eventIndex].micro_notes_tags = [...currentTags, tag];
                      }
                      return copy;
                    });
                  }}
                  style={{
                    backgroundColor: isSelected 
                      ? (isNeg ? 'rgba(204,0,0,0.12)' : 'rgba(230,52,98,0.15)') 
                      : theme.backgroundElement,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    borderWidth: isSelected ? 0.5 : 0,
                    borderColor: isSelected ? (isNeg ? '#CC0000' : ACCENT_COLOR) : 'transparent',
                  }}>
                  <Text style={{ fontSize: 12, color: isSelected ? (isNeg ? '#CC0000' : ACCENT_COLOR) : theme.text }}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 10, color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.5 }}>MEMO NOTES</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, height: 60 }]}
            placeholder="Describe grips, angles, errors..."
            placeholderTextColor={theme.textSecondary}
            value={event.micro_notes_text}
            onChangeText={(txt) => {
              setTimelineEvents(prev => {
                const copy = [...prev];
                copy[eventIndex].micro_notes_text = txt;
                return copy;
              });
            }}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.text, marginTop: Spacing.four }]}
            onPress={() => setBottomSheetConfig(null)}>
            <Text style={{ color: theme.background, fontFamily: 'Pliant-Bold' }}>Done</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  return (
    <>
      <Modal
        animationType="slide"
        transparent={false}
        visible={visible}
        onRequestClose={handleClose}>
        <View style={[styles.modalOverlayFullScreen, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContentFullScreen, { paddingTop: safeAreaInsets.top + Spacing.four }]}>
            
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitleFullScreen, { color: theme.text }]}>Log a Round</Text>
                <Text style={[styles.breadcrumbText, { color: theme.textSecondary }]}>
                  Step {currentStep} of 3: {currentStep === 1 ? 'Baseline Context' : currentStep === 2 ? 'Timeline Builder' : 'Review & Save'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Step Indicators Bar */}
            <View style={styles.stepIndicatorRow}>
              {[1, 2, 3].map(stepNum => (
                <View 
                  key={stepNum} 
                  style={[
                    styles.stepIndicatorLine, 
                    { 
                      backgroundColor: currentStep >= stepNum ? theme.text : theme.backgroundElement 
                    }
                  ]} 
                />
              ))}
            </View>

            <ScrollView 
              ref={modalFormScrollViewRef}
              showsVerticalScrollIndicator={false} 
              {...({ delaysContentTouches: false } as any)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.modalForm, { paddingBottom: safeAreaInsets.bottom + Spacing.six }]}>
              
              {/* STEP 1: General Round Baseline Context */}
              {currentStep === 1 && (
                <View style={styles.stepContainer}>
                  <View style={styles.formSectionHeader}>
                    <Text style={[styles.formSectionTitle, { color: theme.text }]}>1. Round Baseline Context</Text>
                  </View>

                  {/* Premium Dynamic Horizontal Date Selector */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Roll Date</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      {...({ delaysContentTouches: false } as any)}
                      style={styles.horizontalScroll}>
                      <View style={{ flexDirection: 'row', gap: Spacing.two, paddingVertical: Spacing.one }}>
                        {last14Days.map((dayItem) => {
                          const isSelected = formDate === dayItem.date && !showCustomDateInput;
                          return (
                            <Pressable
                              key={dayItem.date}
                              style={({ pressed }) => [
                                styles.horizontalPill,
                                {
                                  backgroundColor: isSelected 
                                    ? 'rgba(230,52,98,0.15)' 
                                    : (pressed ? theme.backgroundSelected : theme.backgroundElement),
                                  paddingVertical: Spacing.two,
                                  paddingHorizontal: Spacing.three,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderWidth: 0,
                                }
                              ]}
                              onPress={() => {
                                setFormDate(dayItem.date);
                                setShowCustomDateInput(false);
                              }}>
                              <Text 
                                style={{ 
                                  fontFamily: isSelected ? 'Pliant-Bold' : 'Pliant-Regular', 
                                  fontSize: 12, 
                                  color: isSelected ? ACCENT_COLOR : theme.text 
                                }}>
                                {dayItem.dayName}
                              </Text>
                              <Text 
                                style={{ 
                                  fontFamily: 'Pliant-Bold', 
                                  fontSize: 14, 
                                  color: isSelected ? ACCENT_COLOR : theme.textSecondary,
                                  marginTop: 1
                                }}>
                                {dayItem.dayNum}
                              </Text>
                            </Pressable>
                          );
                        })}

                        <Pressable
                          style={({ pressed }) => [
                            styles.horizontalPill,
                            {
                              backgroundColor: showCustomDateInput 
                                ? 'rgba(230,52,98,0.15)' 
                                : (pressed ? theme.backgroundSelected : theme.backgroundElement),
                              paddingVertical: Spacing.two,
                              paddingHorizontal: Spacing.three,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 0,
                            }
                          ]}
                          onPress={() => setShowCustomDateInput(true)}>
                          <Ionicons 
                            name="calendar-outline" 
                            size={16} 
                            color={showCustomDateInput ? ACCENT_COLOR : theme.textSecondary} 
                          />
                          <Text 
                            style={{ 
                              fontFamily: showCustomDateInput ? 'Pliant-Bold' : 'Pliant-Regular', 
                              fontSize: 11, 
                              color: showCustomDateInput ? ACCENT_COLOR : theme.textSecondary,
                              marginTop: 2
                            }}>
                            Custom
                          </Text>
                        </Pressable>
                      </View>
                    </ScrollView>

                    {/* Display beautiful inline calendar grid picker if custom toggled */}
                    {showCustomDateInput && (
                      <View style={{ marginTop: Spacing.two, padding: Spacing.three, backgroundColor: theme.backgroundElement, borderRadius: 12 }}>
                        {/* Month navigation */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two }}>
                          <TouchableOpacity 
                            onPress={() => {
                              if (calendarMonth === 0) {
                                setCalendarMonth(11);
                                setCalendarYear(prev => prev - 1);
                              } else {
                                setCalendarMonth(prev => prev - 1);
                              }
                            }}
                            style={{ padding: Spacing.one }}>
                            <Ionicons name="chevron-back" size={20} color={theme.text} />
                          </TouchableOpacity>
                          <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 14, color: theme.text }}>
                            {new Date(calendarYear, calendarMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                          </Text>
                          <TouchableOpacity 
                            onPress={() => {
                              if (calendarMonth === 11) {
                                setCalendarMonth(0);
                                setCalendarYear(prev => prev + 1);
                              } else {
                                setCalendarMonth(prev => prev + 1);
                              }
                            }}
                            style={{ padding: Spacing.one }}>
                            <Ionicons name="chevron-forward" size={20} color={theme.text} />
                          </TouchableOpacity>
                        </View>

                        {/* Weekday letters header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.one }}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayL, idx) => (
                            <Text key={idx} style={{ fontFamily: 'Pliant-Bold', fontSize: 10, color: theme.textSecondary, width: 32, textAlign: 'center' }}>
                              {dayL}
                            </Text>
                          ))}
                        </View>

                        {/* Grid cells */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'space-between' }}>
                          {(() => {
                            const cells = [];
                            const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
                            const prevMonthDate = new Date(calendarYear, calendarMonth, 0);
                            const prevMonthDaysCount = prevMonthDate.getDate();

                            // Pad start with previous month's ending days
                            for (let i = firstDayIndex - 1; i >= 0; i--) {
                              const dNum = prevMonthDaysCount - i;
                              const m = calendarMonth === 0 ? 11 : calendarMonth - 1;
                              const y = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
                              const formattedM = String(m + 1).padStart(2, '0');
                              const formattedD = String(dNum).padStart(2, '0');
                              const dStr = `${y}-${formattedM}-${formattedD}`;
                              
                              cells.push(
                                <Pressable
                                  key={`prev-${dNum}`}
                                  onPress={() => {
                                    setFormDate(dStr);
                                  }}
                                  style={({ pressed }) => [
                                    {
                                      width: 32,
                                      height: 32,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderRadius: 16,
                                      opacity: 0.3,
                                      backgroundColor: pressed ? theme.backgroundSelected : 'transparent'
                                    }
                                  ]}>
                                  <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 12, color: theme.text }}>
                                    {dNum}
                                  </Text>
                                </Pressable>
                              );
                            }

                            // Current month days
                            const daysCount = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                            for (let i = 1; i <= daysCount; i++) {
                              const formattedM = String(calendarMonth + 1).padStart(2, '0');
                              const formattedD = String(i).padStart(2, '0');
                              const dStr = `${calendarYear}-${formattedM}-${formattedD}`;
                              const isSelected = formDate === dStr;

                              cells.push(
                                <Pressable
                                  key={`curr-${i}`}
                                  onPress={() => {
                                    setFormDate(dStr);
                                  }}
                                  style={({ pressed }) => [
                                    {
                                      width: 32,
                                      height: 32,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderRadius: 16,
                                      backgroundColor: isSelected 
                                        ? 'rgba(230,52,98,0.15)' 
                                        : (pressed ? theme.backgroundSelected : 'transparent')
                                    }
                                  ]}>
                                  <Text 
                                    style={{ 
                                      fontFamily: isSelected ? 'Pliant-Bold' : 'Pliant-Regular', 
                                      fontSize: 12, 
                                      color: isSelected ? ACCENT_COLOR : theme.text 
                                    }}>
                                    {i}
                                  </Text>
                                </Pressable>
                              );
                            }

                            return cells;
                          })()}
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Partner Selection Dropdown */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Select Gym Partner</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      {...({ delaysContentTouches: false } as any)}
                      style={styles.horizontalScroll}>
                      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.horizontalPill,
                            { 
                              backgroundColor: formPartnerId === 'anonymous' 
                                ? 'rgba(230,52,98,0.15)' 
                                : (pressed ? theme.backgroundSelected : theme.backgroundElement),
                              borderWidth: 0
                            }
                          ]}
                          onPress={() => selectPartner('anonymous')}>
                          <Text 
                            style={[
                              styles.selectorBtnText, 
                              { 
                                color: formPartnerId === 'anonymous' ? ACCENT_COLOR : theme.textSecondary,
                                fontFamily: formPartnerId === 'anonymous' ? 'Pliant-Bold' : 'Pliant-Regular'
                              }
                            ]}>
                            Anonymous Partner
                          </Text>
                        </Pressable>

                        {dbPartners.map(partner => {
                          const isSelected = formPartnerId === partner.id;
                          return (
                            <Pressable
                              key={partner.id}
                              style={({ pressed }) => [
                                styles.horizontalPill,
                                { 
                                  backgroundColor: isSelected 
                                    ? 'rgba(230,52,98,0.15)' 
                                    : (pressed ? theme.backgroundSelected : theme.backgroundElement),
                                  borderWidth: 0
                                }
                              ]}
                              onPress={() => selectPartner(partner)}>
                              <Text 
                                style={[
                                  styles.selectorBtnText, 
                                  { 
                                    color: isSelected ? ACCENT_COLOR : theme.textSecondary,
                                    fontFamily: isSelected ? 'Pliant-Bold' : 'Pliant-Regular'
                                  }
                                ]}>
                                {partner.name} ({partner.belt})
                              </Text>
                            </Pressable>
                          );
                        })}

                        <Pressable
                          style={({ pressed }) => [
                            styles.horizontalPill,
                            { 
                              backgroundColor: pressed ? theme.backgroundSelected : 'rgba(230,52,98,0.08)', 
                              borderWidth: 0 
                            }
                          ]}
                          onPress={() => setShowCreatePartner(!showCreatePartner)}>
                          <Text style={[styles.selectorBtnText, { color: ACCENT_COLOR, fontFamily: 'Pliant-Bold' }]}>
                            {showCreatePartner ? 'Cancel' : '+ Create Partner'}
                          </Text>
                        </Pressable>
                      </View>
                    </ScrollView>
                  </View>

                  {/* Dynamic Create Partner Sub-Form */}
                  {showCreatePartner && (
                    <View style={[styles.createPartnerSubCard, { backgroundColor: theme.backgroundElement }]}>
                      <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 14, color: theme.text, marginBottom: Spacing.two }}>Create Gym Crew Partner</Text>
                      
                      <View style={styles.formSubGroup}>
                        <TextInput
                          style={[styles.inputMini, { borderColor: theme.background, color: theme.text, backgroundColor: theme.background }]}
                          placeholder="Partner Name"
                          placeholderTextColor={theme.textSecondary}
                          value={newPartnerName}
                          onChangeText={setNewPartnerName}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Belt Rank</Text>
                        <ChoiceChips
                          value={newPartnerBelt}
                          options={['White', 'Blue', 'Purple', 'Brown', 'Black'] as const}
                          onChange={setNewPartnerBelt}
                          getColors={getBeltChipColors}
                          theme={theme}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Weight Category</Text>
                        <ChoiceChips
                          value={newPartnerWeight}
                          options={['Lighter', 'Matched', 'Heavier', 'Ultra Heavier'] as const}
                          onChange={setNewPartnerWeight}
                          getColors={getWeightChipColors}
                          theme={theme}
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.submitBtn, { backgroundColor: theme.text, marginTop: Spacing.two, height: 38 }]}
                        onPress={handleCreatePartner}
                        disabled={creatingPartnerState}>
                        {creatingPartnerState ? (
                          <ActivityIndicator size="small" color={theme.background} />
                        ) : (
                          <Text style={[styles.submitBtnText, { color: theme.background, fontSize: 13 }]}>Create & Select Partner</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {formPartnerId !== 'anonymous' && (
                    <View style={styles.partnerDetailsRow}>
                      <Ionicons name="person-circle-outline" size={16} color={theme.textSecondary} />
                      <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 13, color: theme.textSecondary }}>
                        Rolling with <Text style={{ fontFamily: 'Pliant-Bold', color: theme.text }}>{formPartnerName}</Text> • Rank: {formPartnerRank} • Weight: {formPartnerWeight}
                      </Text>
                    </View>
                  )}

                  {formPartnerId === 'anonymous' && (
                    <>
                      <View style={styles.formGroup}>
                        <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Partner Rank / Belt</Text>
                        <ChoiceChips
                          value={formPartnerRank}
                          options={['White', 'Blue', 'Purple', 'Brown', 'Black'] as const}
                          onChange={setFormPartnerRank}
                          getColors={getBeltChipColors}
                          theme={theme}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Partner Relative Weight</Text>
                        <ChoiceChips
                          value={formPartnerWeight}
                          options={['Lighter', 'Matched', 'Heavier', 'Ultra Heavier'] as const}
                          onChange={setFormPartnerWeight}
                          getColors={getWeightChipColors}
                          theme={theme}
                        />
                      </View>
                    </>
                  )}

                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Attire</Text>
                    <ChoiceChips
                      value={formAttire}
                      options={['Gi', 'No-Gi'] as const}
                      onChange={setFormAttire}
                      getColors={getAttireChipColors}
                      theme={theme}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Intensity</Text>
                    <ChoiceChips
                      value={formIntensity}
                      options={['Flow Roll', 'Technical Sparring', 'Competition Mode'] as const}
                      onChange={setFormIntensity}
                      getColors={getIntensityChipColors}
                      theme={theme}
                    />
                  </View>

                  {/* Auto-growing focus input field */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Round Focus Goal</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { 
                          borderColor: theme.backgroundElement, 
                          color: theme.text, 
                          backgroundColor: theme.backgroundElement,
                          height: focusHeight,
                          textAlignVertical: 'top',
                          paddingTop: Spacing.three,
                          paddingBottom: Spacing.three,
                        }
                      ]}
                      value={formRoundFocus}
                      onChangeText={setFormRoundFocus}
                      placeholder="E.g. Defensive Survival, Guard Passing focus"
                      placeholderTextColor={theme.textSecondary}
                      multiline={true}
                      onContentSizeChange={(e) => {
                        setFocusHeight(Math.max(52, e.nativeEvent.contentSize.height));
                      }}
                    />
                  </View>

                  {/* Duration & Total Rounds */}
                  <View style={styles.durationRow}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Duration (mins)</Text>
                      <TextInput
                        style={[styles.input, { borderColor: theme.backgroundElement, color: theme.text, backgroundColor: theme.backgroundElement }]}
                        value={formDuration}
                        onChangeText={setFormDuration}
                        keyboardType="numeric"
                        placeholder="5"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>

                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Total Rounds</Text>
                      <TextInput
                        style={[styles.input, { borderColor: theme.backgroundElement, color: theme.text, backgroundColor: theme.backgroundElement }]}
                        value={formTotalRounds}
                        onChangeText={setFormTotalRounds}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.navRow}>
                    <TouchableOpacity
                      style={[styles.navBtn, { backgroundColor: theme.text, flex: 1 }]}
                      onPress={nextStep}
                      activeOpacity={0.8}>
                      <Text style={[styles.navBtnText, { color: theme.background }]}>Next (Timeline)</Text>
                      <Ionicons name="arrow-forward" size={16} color={theme.background} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 2: Interactive Timeline Chain Builder */}
              {currentStep === 2 && (
                <View style={styles.stepContainer}>
                  <View style={styles.formSectionHeader}>
                    <Text style={[styles.formSectionTitle, { color: theme.text }]}>2. Interactive Round Timeline</Text>
                  </View>

                  <View style={{ position: 'relative', paddingLeft: 40, marginVertical: Spacing.two }}>
                    {/* Spine Axis Line */}
                    <View 
                      style={{ 
                        position: 'absolute', 
                        left: 20, 
                        top: 10, 
                        bottom: 10, 
                        width: 1.5, 
                        backgroundColor: theme.textSecondary + '33' 
                      }} 
                    />

                    {timelineEvents.map((event, index) => {
                      return (
                        <View key={index} style={{ position: 'relative', marginBottom: 42 }}>
                          {/* Dot Sitting on Spine */}
                          <View 
                            style={{ 
                              position: 'absolute', 
                              left: -26, 
                              top: 10, 
                              width: 12, 
                              height: 12, 
                              borderRadius: 6, 
                              backgroundColor: event.action_type === 'Initial State' ? theme.textSecondary : ACCENT_COLOR,
                              borderWidth: 2,
                              borderColor: theme.background,
                              zIndex: 2,
                            }} 
                          />

                          {/* Conversational Sentence */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 8 }}>
                            {event.action_type === 'Initial State' ? (
                              <>
                                <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                  I started from
                                </Text>
                                <Pressable 
                                  style={({ pressed }) => [
                                    styles.tokenPill, 
                                    { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                  ]} 
                                  onPress={() => setBottomSheetConfig({
                                    type: 'resulting_position',
                                    eventIndex: index,
                                    title: 'Select Initial Position'
                                  })}>
                                  <Text style={[styles.tokenText, { color: theme.text }]}>
                                    {event.resulting_position || 'Select Position'}
                                  </Text>
                                </Pressable>
                                <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                  .
                                </Text>
                              </>
                            ) : (() => {
                              const startingPosition = index > 0 ? timelineEvents[index - 1].resulting_position : 'Standing / Takedown Phase';
                              
                              if (event.action_type === 'Escape') {
                                return (
                                  <>
                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'who',
                                        eventIndex: index,
                                        title: 'Who Initiated?'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        {event.who === 'I' ? 'I' : 'Opponent'}
                                      </Text>
                                    </Pressable>

                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'action_type',
                                        eventIndex: index,
                                        title: 'Select Action Type'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        escaped
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      from
                                    </Text>

                                    <View style={[styles.tokenPill, { backgroundColor: theme.backgroundElement, opacity: 0.8 }]}>
                                      <Text style={[styles.tokenText, { color: theme.textSecondary }]}>
                                        {invertPerspective(startingPosition, event.who) || 'Standing'}
                                      </Text>
                                    </View>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      using
                                    </Text>

                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'move_name',
                                        eventIndex: index,
                                        title: 'Select Escape Move'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        {event.move_name || 'Select Move'}
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      to
                                    </Text>

                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'resulting_position',
                                        eventIndex: index,
                                        title: 'Select Resulting Position'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        {invertPerspective(event.resulting_position, event.who) || 'Select Position'}
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      .
                                    </Text>
                                  </>
                                );
                              }

                              if (event.action_type === 'Submission Finish') {
                                return (
                                  <>
                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'who',
                                        eventIndex: index,
                                        title: 'Who Initiated?'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        {event.who === 'I' ? 'I' : 'Opponent'}
                                      </Text>
                                    </Pressable>

                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'action_type',
                                        eventIndex: index,
                                        title: 'Select Action Type'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        submitted
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      {event.who === 'I' ? 'the opponent with a' : 'me with a'}
                                    </Text>

                                    <Pressable 
                                      style={({ pressed }) => [
                                        styles.tokenPill, 
                                        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                      ]} 
                                      onPress={() => setBottomSheetConfig({
                                        type: 'move_name',
                                        eventIndex: index,
                                        title: 'Select Submission Move'
                                      })}>
                                      <Text style={[styles.tokenText, { color: theme.text }]}>
                                        {event.move_name || 'Select Submission'}
                                      </Text>
                                    </Pressable>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      from
                                    </Text>

                                    <View style={[styles.tokenPill, { backgroundColor: theme.backgroundElement, opacity: 0.8 }]}>
                                      <Text style={[styles.tokenText, { color: theme.textSecondary }]}>
                                        {invertPerspective(startingPosition, event.who) || 'Standing'}
                                      </Text>
                                    </View>

                                    <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                      .
                                    </Text>
                                  </>
                                );
                              }

                              // Default: Takedown, Guard Pass, Sweep, Transition, Submission Attempt
                              return (
                                <>
                                  <Pressable 
                                    style={({ pressed }) => [
                                      styles.tokenPill, 
                                      { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                    ]} 
                                    onPress={() => setBottomSheetConfig({
                                      type: 'who',
                                      eventIndex: index,
                                      title: 'Who Initiated?'
                                    })}>
                                    <Text style={[styles.tokenText, { color: theme.text }]}>
                                      {event.who === 'I' ? 'I' : 'Opponent'}
                                    </Text>
                                  </Pressable>

                                  <Pressable 
                                    style={({ pressed }) => [
                                      styles.tokenPill, 
                                      { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                    ]} 
                                    onPress={() => setBottomSheetConfig({
                                      type: 'action_type',
                                      eventIndex: index,
                                      title: 'Select Action Type'
                                    })}>
                                    <Text style={[styles.tokenText, { color: theme.text }]}>
                                      {getActionVerb(event.action_type)}
                                    </Text>
                                  </Pressable>

                                  <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                    using
                                  </Text>

                                  <Pressable 
                                    style={({ pressed }) => [
                                      styles.tokenPill, 
                                      { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                    ]} 
                                    onPress={() => setBottomSheetConfig({
                                      type: 'move_name',
                                      eventIndex: index,
                                      title: `Select ${event.action_type} Move`
                                    })}>
                                    <Text style={[styles.tokenText, { color: theme.text }]}>
                                      {event.move_name || 'Select Move'}
                                    </Text>
                                  </Pressable>

                                  <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                    and got to
                                  </Text>

                                  <Pressable 
                                    style={({ pressed }) => [
                                      styles.tokenPill, 
                                      { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }
                                    ]} 
                                    onPress={() => setBottomSheetConfig({
                                      type: 'resulting_position',
                                      eventIndex: index,
                                      title: 'Select Resulting Position'
                                    })}>
                                    <Text style={[styles.tokenText, { color: theme.text }]}>
                                      {invertPerspective(event.resulting_position, event.who) || 'Select Position'}
                                    </Text>
                                  </Pressable>

                                  <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 14, color: theme.text }}>
                                    .
                                  </Text>
                                </>
                              );
                            })()}
                          </View>

                          {/* Selected Tags list underneath */}
                          {event.micro_notes_tags && event.micro_notes_tags.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.two }}>
                              {event.micro_notes_tags.map((tag, tagIdx) => {
                                const isNeg = isNegativeTag(tag);
                                return (
                                  <View 
                                    key={tagIdx} 
                                    style={{
                                      backgroundColor: isNeg ? 'rgba(204,0,0,0.06)' : theme.backgroundElement,
                                      paddingVertical: 3,
                                      paddingHorizontal: 8,
                                      borderRadius: 6,
                                      borderWidth: isNeg ? 0.5 : 0,
                                      borderColor: isNeg ? 'rgba(204,0,0,0.15)' : 'transparent',
                                    }}>
                                    <Text style={{ 
                                      fontSize: 10, 
                                      fontFamily: 'Pliant-Regular', 
                                      color: isNeg ? '#CC0000' : theme.textSecondary 
                                    }}>
                                      {tag}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}

                          {/* Micro-notes memo text */}
                          {event.micro_notes_text ? (
                            <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', marginTop: Spacing.one }}>
                              "{event.micro_notes_text}"
                            </Text>
                          ) : null}

                          {/* Action Row Under Sentence: Add Details + Trash */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two }}>
                            <TouchableOpacity 
                              onPress={() => setBottomSheetConfig({
                                  type: 'micro_notes',
                                  eventIndex: index,
                                  title: 'Add Event Details'
                                })}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                              activeOpacity={0.7}>
                              <Ionicons name="add" size={12} color={theme.textSecondary} />
                              <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 11, color: theme.textSecondary }}>
                                Add Details
                              </Text>
                            </TouchableOpacity>

                            {index > 0 && (
                              <TouchableOpacity 
                                onPress={() => removeTimelineBlock(index)}
                                activeOpacity={0.7}>
                                <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 11, color: '#ff3b30' }}>
                                  Remove
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Floating Axis Plus Button */}
                    <View style={{ position: 'relative', height: 40, justifyContent: 'center', marginTop: Spacing.one }}>
                      <TouchableOpacity 
                        onPress={addTimelineBlock}
                        activeOpacity={0.8}
                        style={{
                          position: 'absolute',
                          left: -36,
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: theme.text,
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 3,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.2,
                          shadowRadius: 2,
                          elevation: 3,
                        }}>
                        <Ionicons name="add" size={18} color={theme.background} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.navRow}>
                    <TouchableOpacity
                      style={[styles.navBtn, { backgroundColor: theme.backgroundElement, borderColor: 'transparent', borderWidth: 0 }]}
                      onPress={prevStep}
                      activeOpacity={0.8}>
                      <Ionicons name="arrow-back" size={16} color={theme.text} />
                      <Text style={[styles.navBtnText, { color: theme.text }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.navBtn, { backgroundColor: theme.text, flex: 1 }]}
                      onPress={nextStep}
                      activeOpacity={0.8}>
                      <Text style={[styles.navBtnText, { color: theme.background }]}>Next (Review)</Text>
                      <Ionicons name="arrow-forward" size={16} color={theme.background} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 3: Overall Round Feel & Locker Room Memo */}
              {currentStep === 3 && (
                <View style={styles.stepContainer}>
                  <View style={styles.formSectionHeader}>
                    <Text style={[styles.formSectionTitle, { color: theme.text }]}>3. Review & Locker Room Memo</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>Round Feel Rating (1-5)</Text>
                    <ChoiceChips
                      value={formFeel}
                      options={[1, 2, 3, 4, 5]}
                      onChange={setFormFeel}
                      getColors={getFeelChipColors}
                      theme={theme}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.fieldLabelMinimal, { color: theme.textSecondary }]}>The "Locker Room Memo" (Optional)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.textArea,
                        { borderColor: theme.backgroundElement, color: theme.text, backgroundColor: theme.backgroundElement }
                      ]}
                      value={formLockerMemo}
                      onChangeText={setFormLockerMemo}
                      placeholder="Cardio felt amazing, left fingers are sore from gripping too hard..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.navRow}>
                    <TouchableOpacity
                      style={[styles.navBtn, { backgroundColor: theme.backgroundElement, borderColor: 'transparent', borderWidth: 0 }]}
                      onPress={prevStep}>
                      <Ionicons name="arrow-back" size={16} color={theme.text} />
                      <Text style={[styles.navBtnText, { color: theme.text }]}>Back</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: ACCENT_COLOR, flex: 2 }]}
                      onPress={handleSaveRound}
                      disabled={savingLog}
                      activeOpacity={0.9}>
                      {savingLog ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.submitBtnText}>Save Round Timeline</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Conversational Bottom Sheet Selector */}
      {bottomSheetConfig && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!bottomSheetConfig}
          onRequestClose={() => setBottomSheetConfig(null)}>
          <View style={styles.bottomSheetOverlay}>
            <Pressable style={styles.bottomSheetBackdrop} onPress={() => setBottomSheetConfig(null)} />
            <ThemedView style={[styles.bottomSheetContent, { backgroundColor: theme.background }]}>
              <View style={styles.bottomSheetHeader}>
                <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>
                  {bottomSheetConfig.title}
                </Text>
                <TouchableOpacity onPress={() => setBottomSheetConfig(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                {...({ delaysContentTouches: false } as any)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: Spacing.six }}>
                {renderBottomSheetOptions()}
              </ScrollView>
            </ThemedView>
          </View>
        </Modal>
      )}
    </>
  );
}
