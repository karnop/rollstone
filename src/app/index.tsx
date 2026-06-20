import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';

import { BJJRoundLog, PeriodType } from '@/types/bjj';
import { 
  ACCENT_COLOR, 
  getDatesForPeriod, 
  getBeltColor
} from '@/utils/bjj-helpers';
import { styles } from './index.styles';
import { RoundDetailModal } from '@/components/round-detail-modal';
import { LogSessionModal } from '@/components/log-session-modal';

export default function HomeScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const mainScrollViewRef = useRef<ScrollView>(null);
  const calendarScrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();

  // Data Loading States
  const [logs, setLogs] = useState<BJJRoundLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Active States
  const [activePeriod, setActivePeriod] = useState<PeriodType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoundDetail, setSelectedRoundDetail] = useState<BJJRoundLog | null>(null);
  const [editingLog, setEditingLog] = useState<BJJRoundLog | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);

  // Fetch BJJ Logs
  const fetchUserLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bjj_logs')
        .select(`
          id, date, attire, duration, total_rounds, intensity, partner_name, partner_rank, partner_weight, round_focus, feel, locker_room_memo,
          bjj_round_events (
            id, log_id, sequence_order, who, action_type, move_name, resulting_position, micro_notes_tags, micro_notes_text
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (data && !error) {
        const formattedLogs = data.map((log: any) => ({
          ...log,
          bjj_round_events: (log.bjj_round_events || []).sort(
            (a: any, b: any) => a.sequence_order - b.sequence_order
          ),
        }));
        setLogs(formattedLogs as BJJRoundLog[]);
      }
    } catch (e) {
      console.error('Error fetching logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLogs();
  }, [user]);

  // Auto-scroll to end of ScrollView
  const handleScrollToEnd = () => {
    setTimeout(() => {
      calendarScrollViewRef.current?.scrollToEnd({ animated: false });
    }, 50);
  };

  useEffect(() => {
    handleScrollToEnd();
  }, [activePeriod, logs]);

  // Calendar weeks structure
  const { weeks, monthHeaders } = useMemo(() => {
    const rawDates = getDatesForPeriod(activePeriod);
    const numWeeks = Math.ceil(rawDates.length / 7);
    const weeksArr: string[][] = [];
    const headers: { colIndex: number; label: string }[] = [];

    let lastMonth = '';

    for (let w = 0; w < numWeeks; w++) {
      const weekDates = rawDates.slice(w * 7, (w + 1) * 7);
      weeksArr.push(weekDates);

      if (weekDates[3]) {
        const d = new Date(weekDates[3]);
        const currentMonthName = d.toLocaleDateString(undefined, { month: 'short' });
        if (currentMonthName !== lastMonth) {
          headers.push({ colIndex: w, label: currentMonthName });
          lastMonth = currentMonthName;
        }
      }
    }

    return { weeks: weeksArr, monthHeaders: headers };
  }, [activePeriod]);

  // Map dates to logged rounds
  const sessionMap = useMemo(() => {
    const map: Record<string, BJJRoundLog[]> = {};
    logs.forEach(log => {
      if (!map[log.date]) {
        map[log.date] = [];
      }
      map[log.date].push(log);
    });
    return map;
  }, [logs]);

  // Streak calculation
  const currentStreak = useMemo(() => {
    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    let checkDate = new Date();

    let hasTrainedTodayOrYesterday = sessionMap[todayStr];
    if (!hasTrainedTodayOrYesterday) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (sessionMap[yesterdayStr]) {
        hasTrainedTodayOrYesterday = sessionMap[yesterdayStr];
        checkDate = yesterday;
      }
    }

    if (hasTrainedTodayOrYesterday) {
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (sessionMap[dateStr]) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
    return streak;
  }, [sessionMap]);

  const totalHours = useMemo(() => {
    const totalMins = logs.reduce((sum, log) => sum + (log.duration * (log.total_rounds || 1)), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [logs]);

  const totalRoundsCount = useMemo(() => {
    return logs.reduce((sum, log) => sum + (log.total_rounds || 1), 0);
  }, [logs]);

  const getCellColor = (dateStr: string) => {
    const rounds = sessionMap[dateStr];
    if (!rounds || rounds.length === 0) return theme.backgroundElement;
    
    const maxFeel = Math.max(...rounds.map(r => r.feel));
    switch (maxFeel) {
      case 1: return `${ACCENT_COLOR}22`;
      case 2: return `${ACCENT_COLOR}44`;
      case 3: return `${ACCENT_COLOR}77`;
      case 4: return `${ACCENT_COLOR}bb`;
      case 5: return ACCENT_COLOR;
      default: return theme.backgroundElement;
    }
  };

  const handleCellPress = (dateStr: string) => {
    const rounds = sessionMap[dateStr];
    if (rounds && rounds.length > 0) {
      setSelectedRoundDetail(rounds[0]);
    } else {
      setInitialDate(dateStr);
      setEditingLog(null);
      setModalVisible(true);
    }
  };

  const startEditRound = (log: BJJRoundLog) => {
    setEditingLog(log);
    setInitialDate(null);
    setSelectedRoundDetail(null);
    setModalVisible(true);
  };

  const handleCloseFormModal = () => {
    setModalVisible(false);
    setEditingLog(null);
    setInitialDate(null);
  };

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  const filterOptions: { value: PeriodType; label: string }[] = [
    { value: 'this_month', label: 'Month' },
    { value: 'this_year', label: 'Year' },
    { value: 'all', label: 'All' },
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AnimatedIcon />
        </View>
        
        <TouchableOpacity 
          style={[styles.addBtn, { backgroundColor: ACCENT_COLOR }]} 
          onPress={() => {
            setEditingLog(null);
            setInitialDate(null);
            setModalVisible(true);
          }}
          activeOpacity={0.8}>
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.addBtnText}>Log a Round</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {filterOptions.map(opt => {
          const isSelected = activePeriod === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setActivePeriod(opt.value)}
              style={[
                styles.filterPill,
                isSelected && { backgroundColor: theme.textSecondary + '22' }
              ]}
              activeOpacity={0.7}>
              <Text 
                style={[
                  styles.filterPillText, 
                  { 
                    color: isSelected ? theme.text : theme.textSecondary,
                  }
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView 
        ref={mainScrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.six }]}
        keyboardShouldPersistTaps="handled">
        
        {/* Heatmap Section */}
        <View style={styles.heatmapSection}>
          <View style={styles.heatmapRowContainer}>
            {/* Scrollable grid */}
            <ScrollView 
              ref={calendarScrollViewRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              onContentSizeChange={handleScrollToEnd}
              contentContainerStyle={styles.gridScroll}>
              <View style={styles.gridColumnsContainer}>
                {weeks.map((week, colIndex) => {
                  const headerMatch = monthHeaders.find(h => h.colIndex === colIndex);
                  const hasLabel = !!headerMatch;
                  const isNewMonthColumn = colIndex > 0 && hasLabel;

                  return (
                    <View 
                      key={colIndex} 
                      style={[
                        styles.gridColumn,
                        isNewMonthColumn && { marginLeft: Spacing.three } // Gap for month segregation
                      ]}>
                      
                      {/* Month Label header block */}
                      <View style={styles.monthHeaderContainer}>
                        {hasLabel && (
                          <Text style={[styles.monthLabel, { color: theme.textSecondary }]}>
                            {headerMatch.label}
                          </Text>
                        )}
                      </View>

                      {/* 7 Days of the week (column layout) */}
                      <View style={styles.cellsColumn}>
                        {week.map(dateStr => (
                          <TouchableOpacity
                            key={dateStr}
                            style={[styles.gridCell, { backgroundColor: getCellColor(dateStr) }]}
                            onPress={() => handleCellPress(dateStr)}
                            activeOpacity={0.7}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Day Labels Column on the Right */}
            <View style={styles.dayLabelsColumn}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={idx} style={[styles.dayLabel, { color: theme.textSecondary }]}>
                  {day}
                </Text>
              ))}
            </View>
          </View>

          {/* Color Intensity Legend */}
          <View style={styles.legendRow}>
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Less</Text>
            <View style={[styles.gridCellLegend, { backgroundColor: theme.backgroundElement }]} />
            <View style={[styles.gridCellLegend, { backgroundColor: `${ACCENT_COLOR}22` }]} />
            <View style={[styles.gridCellLegend, { backgroundColor: `${ACCENT_COLOR}44` }]} />
            <View style={[styles.gridCellLegend, { backgroundColor: `${ACCENT_COLOR}77` }]} />
            <View style={[styles.gridCellLegend, { backgroundColor: `${ACCENT_COLOR}bb` }]} />
            <View style={[styles.gridCellLegend, { backgroundColor: ACCENT_COLOR }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>More</Text>
          </View>
        </View>

        {/* Cohesive Metrics Bar */}
        <View style={[styles.metricsContainer, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.metricSection}>
            <Ionicons name="flame-outline" size={18} color={ACCENT_COLOR} />
            <View style={{ marginLeft: Spacing.two, flexShrink: 1 }}>
              <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 10, color: theme.textSecondary }}>Streak</Text>
              <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 13, color: theme.text }} numberOfLines={1}>
                {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>
          
          <View style={[styles.metricDivider, { backgroundColor: theme.textSecondary }]} />
          
          <View style={styles.metricSection}>
            <Ionicons name="calendar-outline" size={18} color={ACCENT_COLOR} />
            <View style={{ marginLeft: Spacing.two, flexShrink: 1 }}>
              <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 10, color: theme.textSecondary }}>Total Rolls</Text>
              <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 13, color: theme.text }} numberOfLines={1}>
                {totalRoundsCount} rds
              </Text>
            </View>
          </View>

          <View style={[styles.metricDivider, { backgroundColor: theme.textSecondary }]} />

          <View style={styles.metricSection}>
            <Ionicons name="time-outline" size={18} color={ACCENT_COLOR} />
            <View style={{ marginLeft: Spacing.two, flexShrink: 1 }}>
              <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 10, color: theme.textSecondary }}>Roll Time</Text>
              <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 13, color: theme.text }} numberOfLines={1}>
                {totalHours}h
              </Text>
            </View>
          </View>
        </View>

        {/* Timeline Log Book Feed */}
        <View style={styles.timelineSection}>
          <View style={styles.timelineHeaderRow}>
            <Text style={[styles.timelineTitleNew, { color: theme.textSecondary }]}>TRAINING LOGS</Text>
            <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 11, color: theme.textSecondary, letterSpacing: 0.5 }}>
              {logs.length} rolls
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={ACCENT_COLOR} style={{ marginVertical: Spacing.four }} />
          ) : sortedLogs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="journal-outline" size={32} color={theme.textSecondary} style={{ marginBottom: Spacing.two }} />
              <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 14, color: theme.text, marginBottom: 2 }}>No Training Rounds Logged</Text>
              <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 12, color: theme.textSecondary, textAlign: 'center' }}>
                Tap "Log a Round" above or press any calendar day to start tracking.
              </Text>
            </View>
          ) : (
            sortedLogs.map((log, index) => {
              const partnerBeltColor = getBeltColor(log.partner_rank);
              
              return (
                <View key={log.id} style={styles.timelineItem}>
                  {/* Left Timeline Spine column */}
                  <View style={styles.timelineLeftColumn}>
                    <View style={[styles.timelineNode, { borderColor: partnerBeltColor }]} />
                    {index < sortedLogs.length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: theme.backgroundElement }]} />
                    )}
                  </View>

                  {/* Right Timeline Card clickable summary */}
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setSelectedRoundDetail(log)}
                    style={[styles.timelineCard, { backgroundColor: theme.backgroundElement }]}>
                    
                    {/* Brief Header */}
                    <View style={styles.cardHeaderNew}>
                      <View style={styles.cardHeaderLeftNew}>
                        <View style={[styles.beltDot, { backgroundColor: partnerBeltColor }]} />
                        <Text style={[styles.partnerNameText, { color: theme.text }]} numberOfLines={1}>
                          {log.partner_name}
                        </Text>
                      </View>
                      <Text style={[styles.cardDateNew, { color: theme.textSecondary }]}>
                        {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    {/* Brief Badges Wrapper */}
                    <View style={styles.badgesWrapper}>
                      <View style={[styles.miniChip, { backgroundColor: theme.background }]}>
                        <Text style={[styles.miniChipText, { color: theme.text }]} numberOfLines={1}>
                          {log.attire} • {log.total_rounds || 1} x {log.duration}m
                        </Text>
                      </View>
                      <View style={[styles.miniChip, { backgroundColor: theme.background }]}>
                        <Text style={[styles.miniChipText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {log.intensity}
                        </Text>
                      </View>
                    </View>

                    {/* Brief Focus View */}
                    {log.round_focus ? (
                      <View style={[styles.focusContainerNew, { backgroundColor: theme.background }]}>
                        <Text style={[styles.focusLabelNew, { color: theme.textSecondary }]}>Focus</Text>
                        <Text style={[styles.focusValueNew, { color: theme.text }]} numberOfLines={2}>
                          {log.round_focus}
                        </Text>
                      </View>
                    ) : null}

                    {/* Hint to tap for details */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.two }}>
                      <Ionicons name="chevron-forward-circle-outline" size={13} color={theme.textSecondary} />
                      <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 11, color: theme.textSecondary }}>
                        Tap to view full timeline & notes
                      </Text>
                    </View>

                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modular Log Session Modal */}
      <LogSessionModal
        visible={modalVisible}
        editingLog={editingLog}
        initialDate={initialDate}
        onClose={handleCloseFormModal}
        onSaveSuccess={() => {
          handleCloseFormModal();
          fetchUserLogs();
        }}
      />

      {/* Modular Selected Round View Modal */}
      <RoundDetailModal
        visible={!!selectedRoundDetail}
        log={selectedRoundDetail}
        onClose={() => setSelectedRoundDetail(null)}
        onEdit={startEditRound}
      />
    </ThemedView>
  );
}
