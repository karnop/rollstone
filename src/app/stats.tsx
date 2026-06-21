import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Text, TouchableOpacity, Animated, RefreshControl, Dimensions, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import { SwipeWrapper } from '@/components/swipe-wrapper';

const ACCENT_COLOR = '#E63462';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ActiveTab = 'overview' | 'positions' | 'weapons';

interface ScatterNode {
  id: string;
  weight: 'Lighter' | 'Matched' | 'Heavier' | 'Ultra Heavier';
  winPct: number;
  belt: 'White' | 'Blue' | 'Purple' | 'Brown' | 'Black';
  partnerName: string;
  rounds: number;
}

export default function StatsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [logsCount, setLogsCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<ScatterNode | null>(null);

  // Modal Popups for KPIs
  const [activeKpiModal, setActiveKpiModal] = useState<'win' | 'feel' | 'control' | null>(null);

  // Drawer states for Weapons details
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'offensive' | 'defensive' | null>(null);
  const [drawerSort, setDrawerSort] = useState<'frequency' | 'time'>('frequency');
  const [rawSubmissions, setRawSubmissions] = useState<{ name: string; count: number; latestDate: string }[]>([]);
  const [rawDefensives, setRawDefensives] = useState<{ name: string; count: number; latestDate: string }[]>([]);

  // Scroll Refs for horizontal swiping
  const horizontalScrollRef = useRef<ScrollView>(null);

  // Animation values
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  // Real Calculated Metrics
  const [metrics, setMetrics] = useState({
    totalMatHours: 0,
    winRate: 0,
    avgFeel: 0,
    topControl: 0,
    passingEfficiency: 0,
    sweepRate: 0,
    survivalRate: 0,
    heavyRoundsCount: 0,
    kneeSlicePassPct: 0,
    subsOffensive: 0,
    subsConceded: 0,
    giPct: 0,
    noGiPct: 0,
    guardRetention: 0,
    setupToFinish: 0,
  });

  // Weekly Session Frequency (Horizontal spark-strip: MTWTFSS)
  const [weeklyFrequency, setWeeklyFrequency] = useState([
    { day: 'M', active: 0 },
    { day: 'T', active: 0 },
    { day: 'W', active: 0 },
    { day: 'T', active: 0 },
    { day: 'F', active: 0 },
    { day: 'S', active: 0 },
    { day: 'S', active: 0 },
  ]);

  // Offensive Arsenal Breakdown (Donut chart data)
  const [submissions, setSubmissions] = useState<{ name: string; pct: number; color: string; key: string }[]>([]);

  // Defensive Vulnerability Tracker
  const [defensiveVulnerabilities, setDefensiveVulnerabilities] = useState<{ name: string; pct: number; color: string }[]>([]);

  // Positional Win-Rate Rows
  const [positionalRates, setPositionalRates] = useState<{ name: string; rate: number }[]>([]);

  // Intensity Allocation (Stacked weekly bar)
  const [weeklyMatTime, setWeeklyMatTime] = useState<{ label: string; data: number[] }[]>([]);

  // Partner Matrix Scatter Plot Nodes
  const [partnerNodes, setPartnerNodes] = useState<ScatterNode[]>([]);

  const fetchStats = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: logsData, error: logsError } = await supabase
        .from('bjj_logs')
        .select(`
          id, feel, attire, partner_weight, partner_name, partner_rank, date, duration, total_rounds, intensity,
          bjj_round_events (
            who, action_type, resulting_position, move_name
          )
        `)
        .eq('user_id', user.id);

      if (logsError || !logsData || logsData.length === 0) {
        setLogsCount(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const totalLogs = logsData.length;
      setLogsCount(totalLogs);

      const allEvents = logsData.flatMap(log => 
        (log.bjj_round_events || []).map(e => ({
          ...e,
          date: log.date
        }))
      );

      // 1. Total Mat Volume (Total duration in hours)
      const totalMins = logsData.reduce((sum, log) => sum + ((log.duration || 5) * (log.total_rounds || 1)), 0);
      const totalMatHours = Math.round((totalMins / 60) * 10) / 10;

      // 2. Win/Loss Ratio from submissions
      const wins = allEvents.filter(e => e.who === 'I' && e.action_type === 'Submission Finish').length;
      const losses = allEvents.filter(e => e.who === 'Opponent' && e.action_type === 'Submission Finish').length;
      const totalSubs = wins + losses;
      const winRate = totalSubs > 0 ? Math.round((wins / totalSubs) * 100) : 0;

      // 3. Average Feel
      const totalFeel = logsData.reduce((sum, log) => sum + (log.feel || 0), 0);
      const avgFeel = Math.round((totalFeel / totalLogs) * 10) / 10;

      // 4. Control Dominance Percentage (Top vs Bottom)
      let topCount = 0;
      let bottomCount = 0;
      allEvents.forEach(e => {
        const pos = (e.resulting_position || '').toLowerCase();
        if (pos.includes('(top)') || pos.includes('mount') && !pos.includes('bottom')) {
          topCount++;
        } else if (pos.includes('(bottom)') || pos.includes('guard')) {
          bottomCount++;
        }
      });
      const totalPos = topCount + bottomCount;
      const topControl = totalPos > 0 ? Math.round((topCount / totalPos) * 100) : 0;

      // 5. Guard Passing Success Rate
      const myPassAttempts = allEvents.filter(e => e.who === 'I' && e.action_type === 'Guard Pass');
      const passingEfficiency = myPassAttempts.length > 0 ? 100 : 0;

      // 6. Sweep Success Rate
      const mySweeps = allEvents.filter(e => e.who === 'I' && e.action_type === 'Sweep').length;
      const opponentSweeps = allEvents.filter(e => e.who === 'Opponent' && e.action_type === 'Sweep').length;
      const totalSweeps = mySweeps + opponentSweeps;
      const sweepRate = totalSweeps > 0 ? Math.round((mySweeps / totalSweeps) * 100) : 0;

      // 7. Escape Recovery Rate
      const myEscapes = allEvents.filter(e => e.who === 'I' && e.action_type === 'Escape').length;
      const opponentEscapes = allEvents.filter(e => e.who === 'Opponent' && e.action_type === 'Escape').length;
      const totalEscapes = myEscapes + opponentEscapes;
      const survivalRate = totalEscapes > 0 ? Math.round((myEscapes / totalEscapes) * 100) : 0;

      // 8. Dynamic Diagnostics (heavier partners passed by Knee Slice)
      const heavierLogs = logsData.filter(log => log.partner_weight === 'Heavier' || log.partner_weight === 'Ultra Heavier');
      let kneeSlicePasses = 0;
      heavierLogs.forEach(log => {
        const events = log.bjj_round_events || [];
        const wasPassed = events.some(e => e.who === 'Opponent' && e.action_type === 'Guard Pass' && (e.move_name || '').toLowerCase().includes('knee slice'));
        if (wasPassed) {
          kneeSlicePasses++;
        }
      });
      const kneeSlicePassPct = heavierLogs.length > 0 ? Math.round((kneeSlicePasses / heavierLogs.length) * 100) : 0;

      // 9. Gi vs No-Gi
      const giCount = logsData.filter(log => log.attire === 'Gi').length;
      const noGiCount = logsData.filter(log => log.attire === 'No-Gi').length;
      const totalAttire = giCount + noGiCount;
      const giPct = totalAttire > 0 ? Math.round((giCount / totalAttire) * 100) : 0;
      const noGiPct = totalAttire > 0 ? Math.round((noGiCount / totalAttire) * 100) : 0;

      // 10. Guard Retention Index
      const opponentPassAttempts = allEvents.filter(e => e.who === 'Opponent' && e.action_type === 'Guard Pass').length;
      const guardRetention = Math.max(0, 100 - (opponentPassAttempts * 15));

      // 11. Submission Efficiency Scale (Setup to Finish)
      const myAttempts = allEvents.filter(e => e.who === 'I' && e.action_type === 'Submission Attempt').length;
      const myFinishes = allEvents.filter(e => e.who === 'I' && e.action_type === 'Submission Finish').length;
      const setupToFinish = (myAttempts + myFinishes) > 0 ? Math.round((myFinishes / (myAttempts + myFinishes)) * 100) : 0;

      setMetrics({
        totalMatHours,
        winRate,
        avgFeel,
        topControl,
        passingEfficiency,
        sweepRate,
        survivalRate,
        heavyRoundsCount: heavierLogs.length,
        kneeSlicePassPct,
        subsOffensive: wins,
        subsConceded: losses,
        giPct,
        noGiPct,
        guardRetention,
        setupToFinish,
      });

      // 12. Weekly Frequency spark-strip (MTWTFSS in last 7 logs)
      const dayMappings = [6, 0, 1, 2, 3, 4, 5];
      const newFreq = [
        { day: 'M', active: 0 },
        { day: 'T', active: 0 },
        { day: 'W', active: 0 },
        { day: 'T', active: 0 },
        { day: 'F', active: 0 },
        { day: 'S', active: 0 },
        { day: 'S', active: 0 },
      ];
      logsData.slice(0, 7).forEach(log => {
        const d = new Date(log.date);
        const idx = dayMappings[d.getDay()];
        if (idx !== undefined && newFreq[idx]) {
          newFreq[idx].active = 1;
        }
      });
      setWeeklyFrequency(newFreq);

      // 13. Offensive Arsenal Breakdown (Donut chart data)
      const subCounts: Record<string, { count: number; latestDate: string }> = {};
      allEvents.forEach(e => {
        if (e.who === 'I' && e.action_type === 'Submission Finish') {
          const name = e.move_name || 'Other';
          const dateStr = e.date || '';
          if (!subCounts[name]) {
            subCounts[name] = { count: 1, latestDate: dateStr };
          } else {
            subCounts[name].count++;
            if (dateStr && (!subCounts[name].latestDate || dateStr > subCounts[name].latestDate)) {
              subCounts[name].latestDate = dateStr;
            }
          }
        }
      });
      const sortedSubs = Object.entries(subCounts)
        .map(([name, val]) => ({ name, count: val.count, latestDate: val.latestDate }))
        .sort((a, b) => b.count - a.count);
      const totalUserSubs = sortedSubs.reduce((sum, item) => sum + item.count, 0);
      setRawSubmissions(sortedSubs);
      if (totalUserSubs > 0) {
        const formattedSubs = sortedSubs.slice(0, 3).map((item, idx) => {
          const colors = [ACCENT_COLOR, '#4B5563', '#9CA3AF'];
          return {
            name: item.name,
            pct: Math.round((item.count / totalUserSubs) * 100),
            color: colors[idx] || '#D1D5DB',
            key: item.name,
          };
        });
        setSubmissions(formattedSubs);
      } else {
        setSubmissions([]);
      }

      // 14. Defensive Vulnerabilities (from db)
      const defCounts: Record<string, { count: number; latestDate: string }> = {};
      allEvents.forEach(e => {
        if (e.who === 'Opponent' && e.action_type === 'Submission Finish') {
          const name = e.move_name || 'Other';
          const dateStr = e.date || '';
          if (!defCounts[name]) {
            defCounts[name] = { count: 1, latestDate: dateStr };
          } else {
            defCounts[name].count++;
            if (dateStr && (!defCounts[name].latestDate || dateStr > defCounts[name].latestDate)) {
              defCounts[name].latestDate = dateStr;
            }
          }
        }
      });
      const sortedDefs = Object.entries(defCounts)
        .map(([name, val]) => ({ name, count: val.count, latestDate: val.latestDate }))
        .sort((a, b) => b.count - a.count);
      const totalOppSubs = sortedDefs.reduce((sum, item) => sum + item.count, 0);
      setRawDefensives(sortedDefs);
      if (totalOppSubs > 0) {
        const formattedDefs = sortedDefs.slice(0, 3).map((item, idx) => {
          const colors = ['#EF4444', '#4B5563', '#9CA3AF'];
          return {
            name: item.name,
            pct: Math.round((item.count / totalOppSubs) * 100),
            color: colors[idx] || '#D1D5DB'
          };
        });
        setDefensiveVulnerabilities(formattedDefs);
      } else {
        setDefensiveVulnerabilities([]);
      }

      // 15. Positional Win-Rate Rows
      const mountAttempts = allEvents.filter(e => (e.resulting_position || '').toLowerCase().includes('mount'));
      const mountSuccess = mountAttempts.filter(e => !(e.resulting_position || '').toLowerCase().includes('bottom')).length;
      const mountRate = mountAttempts.length > 0 ? Math.round((mountSuccess / mountAttempts.length) * 100) : 0;

      const backAttempts = allEvents.filter(e => (e.resulting_position || '').toLowerCase().includes('back'));
      const backSuccess = backAttempts.filter(e => !(e.resulting_position || '').toLowerCase().includes('taken') && !(e.resulting_position || '').toLowerCase().includes('defend')).length;
      const backRate = backAttempts.length > 0 ? Math.round((backSuccess / backAttempts.length) * 100) : 0;

      setPositionalRates([
        { name: 'Back Control', rate: backRate || 0 },
        { name: 'Mount Control', rate: mountRate || 0 },
        { name: 'Guard Passing', rate: passingEfficiency || 0 },
        { name: 'Active Guard', rate: sweepRate || 0 },
        { name: 'Half Guard Bottom', rate: survivalRate || 0 },
      ]);

      // 16. Intensity Allocation
      const weeklyDataMap: Record<string, number[]> = {};
      logsData.forEach(log => {
        const date = new Date(log.date);
        const weekNo = 'W' + Math.ceil(date.getDate() / 7);
        if (!weeklyDataMap[weekNo]) {
          weeklyDataMap[weekNo] = [0, 0, 0];
        }
        const idx = log.intensity === 'Flow Roll' ? 0 : log.intensity === 'Technical Sparring' ? 1 : 2;
        const durationHrs = ((log.duration || 5) * (log.total_rounds || 1)) / 60;
        weeklyDataMap[weekNo][idx] = (weeklyDataMap[weekNo][idx] || 0) + durationHrs;
      });
      const sortedWeeks = Object.entries(weeklyDataMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(item => ({
          label: item[0],
          data: item[1]
        }));
      setWeeklyMatTime(sortedWeeks);

      // 17. Partner Matrix Scatter Nodes
      const partnerMap: Record<string, { weight: string; rank: string; wins: number; total: number }> = {};
      logsData.forEach(log => {
        if (log.partner_name) {
          if (!partnerMap[log.partner_name]) {
            partnerMap[log.partner_name] = {
              weight: log.partner_weight || 'Matched',
              rank: log.partner_rank || 'White',
              wins: 0,
              total: 0
            };
          }
          partnerMap[log.partner_name].total++;
          const events = log.bjj_round_events || [];
          const didWin = events.some(e => e.who === 'I' && e.action_type === 'Submission Finish');
          if (didWin) {
            partnerMap[log.partner_name].wins++;
          }
        }
      });
      const computedNodes = Object.entries(partnerMap).map(([name, data], idx) => ({
        id: String(idx + 1),
        weight: data.weight as any,
        winPct: Math.round((data.wins / data.total) * 100),
        belt: data.rank as any,
        partnerName: `${name} (${data.rank} Belt)`,
        rounds: data.total
      }));
      setPartnerNodes(computedNodes);

    } catch (e) {
      console.error('Error fetching stats', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleSelectNode = (node: ScatterNode) => {
    setSelectedNode(node);
    tooltipAnim.setValue(0);
    Animated.spring(tooltipAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  // Scroll offset listener for horizontal paging
  const handleHorizontalScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
    const tabs: ActiveTab[] = ['overview', 'positions', 'weapons'];
    if (tabs[pageIndex] && activeTab !== tabs[pageIndex]) {
      setActiveTab(tabs[pageIndex]);
    }
  };

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const tabs: ActiveTab[] = ['overview', 'positions', 'weapons'];
    const idx = tabs.indexOf(tab);
    horizontalScrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  };

  // Helper to dynamically style circular progress border segments
  const getProgressCircleBorder = (pct: number, activeColor: string, inactiveColor: string) => {
    return {
      borderTopColor: pct > 0 ? activeColor : inactiveColor,
      borderRightColor: pct >= 25 ? activeColor : inactiveColor,
      borderBottomColor: pct >= 50 ? activeColor : inactiveColor,
      borderLeftColor: pct >= 75 ? activeColor : inactiveColor,
    };
  };

  const getBeltColor = (belt: string) => {
    switch (belt) {
      case 'White': return '#E5E7EB';
      case 'Blue': return '#3B82F6';
      case 'Purple': return '#8B5CF6';
      case 'Brown': return '#92400E';
      case 'Black': return '#1F2937';
      default: return '#6B7280';
    }
  };

  const getWeightXPosition = (weight: string) => {
    switch (weight) {
      case 'Lighter': return 15;
      case 'Matched': return 38;
      case 'Heavier': return 62;
      case 'Ultra Heavier': return 85;
      default: return 50;
    }
  };

  const getWinPctYPosition = (pct: number) => {
    return 100 - (10 + (pct / 100) * 80);
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
      </ThemedView>
    );
  }

  const selectedNodeBeltColor = selectedNode ? getBeltColor(selectedNode.belt) : ACCENT_COLOR;

  // Render a clean empty state if the user has no logged data
  if (logsCount === 0) {
    return (
      <SwipeWrapper>
        <ThemedView style={styles.container}>
        <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

        {/* Uniform Header Row */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <AnimatedIcon />
          </View>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT_COLOR} colors={[ACCENT_COLOR]} />
          }
          contentContainerStyle={styles.emptyStateCenter}>
          <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="bar-chart-outline" size={42} color={ACCENT_COLOR} />
          </View>
          <ThemedText style={styles.emptyTitle}>Performance Analytics</ThemedText>
          <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
            Your sparring flow statistics, position control ratios, and submission trends will generate dynamically once you start logging rounds on the home page.
          </ThemedText>
        </ScrollView>
      </ThemedView>
    </SwipeWrapper>
    );
  }

  return (
    <SwipeWrapper
      disableLeft={activeTab !== 'weapons'}
      disableRight={activeTab !== 'overview'}
    >
      <ThemedView style={styles.container}>
      <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

      {/* Uniform Header Row */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AnimatedIcon />
        </View>
      </View>

      {/* Premium Tab Headers */}
      <View style={styles.chipRow}>
        {(['overview', 'positions', 'weapons'] as ActiveTab[]).map(tab => {
          const isSelected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => selectTab(tab)}
              style={styles.tabButton}
              activeOpacity={0.7}>
              <Text 
                style={[
                  styles.tabText, 
                  { 
                    color: theme.text,
                    fontWeight: isSelected ? '700' : '400',
                    opacity: isSelected ? 1.0 : 0.4,
                  }
                ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {isSelected && <View style={[styles.activeUnderline, { backgroundColor: ACCENT_COLOR }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Horizontal Swipeable paging Container */}
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleHorizontalScroll}
        style={{ flex: 1 }}>

        {/* ==================== PAGE 1: OVERVIEW ==================== */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT_COLOR} colors={[ACCENT_COLOR]} />
          }
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: safeAreaInsets.bottom + Spacing.six }]}>
          
          {/* KPI Circular Donut charts */}
          <View style={styles.kpiRow}>
            {/* Dial 1: Win/Loss */}
            <TouchableOpacity
              onPress={() => setActiveKpiModal('win')}
              activeOpacity={0.8}
              style={[styles.kpiBlock, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.circleProgress, getProgressCircleBorder(metrics.winRate, ACCENT_COLOR, theme.background)]}>
                <Text style={[styles.circleValText, { color: theme.text }]}>{metrics.winRate}%</Text>
              </View>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kpiLabel}>Win Ratio</ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={styles.kpiSub}>submissions</ThemedText>
            </TouchableOpacity>

            {/* Dial 2: Average Feel */}
            <TouchableOpacity
              onPress={() => setActiveKpiModal('feel')}
              activeOpacity={0.8}
              style={[styles.kpiBlock, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.circleProgress, getProgressCircleBorder(Math.round((metrics.avgFeel / 5) * 100), ACCENT_COLOR, theme.background)]}>
                <Text style={[styles.circleValText, { color: theme.text }]}>{metrics.avgFeel}</Text>
              </View>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kpiLabel}>Avg Feel</ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={styles.kpiSub}>out of 5</ThemedText>
            </TouchableOpacity>

            {/* Dial 3: Control Dominance */}
            <TouchableOpacity
              onPress={() => setActiveKpiModal('control')}
              activeOpacity={0.8}
              style={[styles.kpiBlock, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.circleProgress, getProgressCircleBorder(metrics.topControl, ACCENT_COLOR, theme.background)]}>
                <Text style={[styles.circleValText, { color: theme.text }]}>{metrics.topControl}%</Text>
              </View>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kpiLabel}>Top Control</ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={styles.kpiSub}>dominance</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Mat Volume & Session Frequency card */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="fitness-outline" size={18} color={theme.textSecondary} />
              <ThemedText style={styles.cardTitle}>Training Volume & Frequency</ThemedText>
            </View>

            <View style={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.two }}>
              <View style={styles.volumeRow}>
                <View>
                  <ThemedText type="smallBold" themeColor="textSecondary">Total Mat Volume</ThemedText>
                  <Text style={[styles.matVolumeVal, { color: theme.text }]}>{metrics.totalMatHours} hrs</Text>
                </View>
              </View>

              <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: Spacing.four, marginBottom: Spacing.two }}>
                Weekly Session Frequency
              </ThemedText>
              <View style={styles.sparkStrip}>
                {weeklyFrequency.map((day, idx) => (
                  <View key={idx} style={styles.sparkDayColumn}>
                    <Text style={[styles.sparkDayLabel, { color: theme.textSecondary }]}>{day.day}</Text>
                    <View 
                      style={[
                        styles.sparkDot, 
                        { 
                          backgroundColor: day.active ? ACCENT_COLOR : theme.backgroundElement,
                          borderColor: day.active ? ACCENT_COLOR : theme.textSecondary + '22',
                        }
                      ]} 
                    />
                  </View>
                ))}
              </View>

              <View style={styles.miniDialsContainer}>
                <View style={styles.miniDialColumn}>
                  <View style={[styles.miniProgressCircle, getProgressCircleBorder(metrics.winRate, ACCENT_COLOR, theme.background)]}>
                    <Text style={[styles.miniCircleVal, { color: theme.text }]}>{metrics.subsOffensive}:{metrics.subsConceded}</Text>
                  </View>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>Submits / Taps</ThemedText>
                </View>

                <View style={styles.miniDialColumn}>
                  <View style={[styles.miniProgressCircle, getProgressCircleBorder(metrics.giPct, ACCENT_COLOR, theme.background)]}>
                    <Text style={[styles.miniCircleVal, { color: theme.text }]}>{metrics.giPct}%</Text>
                  </View>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>Gi Attire Ratio</ThemedText>
                </View>
              </View>
            </View>
          </ThemedView>

          {/* Mat Time & Intensity Stacked Bar Chart */}
          {weeklyMatTime.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="bar-chart-outline" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardTitle}>Intensity Allocation</ThemedText>
              </View>
              
              <View style={styles.stackedBarChartContainer}>
                {(() => {
                  const currentMaxVal = weeklyMatTime.length > 0 
                    ? Math.max(...weeklyMatTime.map(w => w.data.reduce((a, b) => a + b, 0)), 1)
                    : 1;
                  const chartMaxVal = currentMaxVal * 2;
                  
                  const formatHour = (val: number) => {
                    const rounded = Math.round(val * 10) / 10;
                    if (rounded % 1 === 0) return `${Math.round(rounded)}h`;
                    return `${rounded.toFixed(1)}h`;
                  };

                  return (
                    <>
                      <View style={styles.yAxisGuide}>
                        <Text style={[styles.guideText, { color: theme.textSecondary }]}>{formatHour(chartMaxVal)}</Text>
                        <Text style={[styles.guideText, { color: theme.textSecondary }]}>{formatHour(chartMaxVal * 2 / 3)}</Text>
                        <Text style={[styles.guideText, { color: theme.textSecondary }]}>{formatHour(chartMaxVal / 3)}</Text>
                        <Text style={[styles.guideText, { color: theme.textSecondary }]}>0h</Text>
                      </View>

                      <View style={styles.barsContainer}>
                        {weeklyMatTime.map((week, idx) => {
                          const total = week.data.reduce((a, b) => a + b, 0);
                          const scaleHeight = `${Math.min(100, (total / chartMaxVal) * 100)}%` as any;
                          
                          const flowPct = total > 0 ? (week.data[0] / total) * 100 : 0;
                          const techPct = total > 0 ? (week.data[1] / total) * 100 : 0;
                          const compPct = total > 0 ? (week.data[2] / total) * 100 : 0;

                          return (
                            <View key={idx} style={styles.barColumn}>
                              <View style={[styles.barStack, { height: scaleHeight }]}>
                                <View style={[styles.barSegment, { height: `${compPct}%`, backgroundColor: theme.text }]} />
                                <View style={[styles.barSegment, { height: `${techPct}%`, backgroundColor: theme.textSecondary + '77' }]} />
                                <View style={[styles.barSegment, { height: `${flowPct}%`, backgroundColor: theme.textSecondary + '22' }]} />
                              </View>
                              <Text style={[styles.barLabel, { color: theme.textSecondary }]}>{week.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  );
                })()}
              </View>

              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIndicator, { backgroundColor: theme.textSecondary + '22' }]} />
                  <Text style={[styles.legendTextVal, { color: theme.textSecondary }]}>Flow Roll</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIndicator, { backgroundColor: theme.textSecondary + '77' }]} />
                  <Text style={[styles.legendTextVal, { color: theme.textSecondary }]}>Technical</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendIndicator, { backgroundColor: theme.text }]} />
                  <Text style={[styles.legendTextVal, { color: theme.textSecondary }]}>Competition</Text>
                </View>
              </View>
            </ThemedView>
          ) : null}
        </ScrollView>

        {/* ==================== PAGE 2: POSITIONS ==================== */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT_COLOR} colors={[ACCENT_COLOR]} />
          }
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: safeAreaInsets.bottom + Spacing.six }]}>
          
          {/* Positional Win-Rate Grid */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="grid-outline" size={18} color={theme.textSecondary} />
              <ThemedText style={styles.cardTitle}>Positional Efficiency</ThemedText>
            </View>

            <View style={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.four }}>
              {positionalRates.map((pos, idx) => {
                const isWarning = pos.rate > 0 && pos.rate < 30;
                const barFillColor = isWarning ? '#EF4444' : theme.text;
                
                return (
                  <View key={idx} style={{ marginBottom: Spacing.three }}>
                    <View style={styles.positionGridLabelRow}>
                      <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>{pos.name}</ThemedText>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: isWarning ? '#EF4444' : theme.text }}>
                        {pos.rate}%
                      </Text>
                    </View>
                    <View style={[styles.progressTrackGrid, { backgroundColor: theme.background }]}>
                      <View style={[styles.progressBarGrid, { width: `${pos.rate}%`, backgroundColor: barFillColor }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </ThemedView>

          {/* Defense & Transition Indexes */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-outline" size={18} color={theme.textSecondary} />
              <ThemedText style={styles.cardTitle}>Defense & Transition Indexes</ThemedText>
            </View>

            <View style={{ paddingHorizontal: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.two }}>
              <View style={styles.indexRow}>
                <View>
                  <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Guard Passing Success</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Passing phase efficiency</ThemedText>
                </View>
                <Text style={[styles.indexValue, { color: theme.text }]}>{metrics.passingEfficiency}%</Text>
              </View>
              
              <View style={[styles.dividerLine, { backgroundColor: theme.background }]} />

              <View style={styles.indexRow}>
                <View>
                  <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Guard Retention Index</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Prevented guard pass completions</ThemedText>
                </View>
                <Text style={[styles.indexValue, { color: theme.text }]}>{metrics.guardRetention}%</Text>
              </View>

              <View style={[styles.dividerLine, { backgroundColor: theme.background }]} />

              <View style={styles.indexRow}>
                <View>
                  <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Sweep Success Rate</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Sweeps completed from bottom guard</ThemedText>
                </View>
                <Text style={[styles.indexValue, { color: theme.text }]}>{metrics.sweepRate}%</Text>
              </View>

              <View style={[styles.dividerLine, { backgroundColor: theme.background }]} />

              <View style={styles.indexRow}>
                <View>
                  <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Escape Recovery Window</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Escapes completed from bottom pin</ThemedText>
                </View>
                <Text style={[styles.indexValue, { color: theme.text }]}>{metrics.survivalRate}%</Text>
              </View>
            </View>
          </ThemedView>

          {/* Partner Matrix Scatter Plot */}
          {partnerNodes.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="people-outline" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardTitle}>The Partner Matrix</ThemedText>
              </View>

              <View style={styles.scatterPlotWrapper}>
                <View style={[styles.scatterPlotBox, { borderColor: theme.background }]}>
                  <View style={[styles.scatterGridLine, { top: '25%', borderColor: theme.background }]} />
                  <View style={[styles.scatterGridLine, { top: '50%', borderColor: theme.background }]} />
                  <View style={[styles.scatterGridLine, { top: '75%', borderColor: theme.background }]} />
                  <View style={[styles.scatterGridVertLine, { left: '38%', borderColor: theme.background }]} />
                  <View style={[styles.scatterGridVertLine, { left: '62%', borderColor: theme.background }]} />

                  {partnerNodes.map(node => {
                    const leftPct = getWeightXPosition(node.weight);
                    const topPct = getWinPctYPosition(node.winPct);
                    const isSelected = selectedNode?.id === node.id;
                    const anySelected = selectedNode !== null;
                    const beltBg = getBeltColor(node.belt);

                    const nodeOpacity = anySelected ? (isSelected ? 1.0 : 0.3) : 1.0;
                    const nodeScale = anySelected ? (isSelected ? 1.3 : 0.75) : 1.0;

                    return (
                      <TouchableOpacity
                        key={node.id}
                        onPress={() => handleSelectNode(node)}
                        style={[
                          styles.scatterNode,
                          {
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            backgroundColor: beltBg,
                            borderColor: isSelected ? ACCENT_COLOR : '#FFF',
                            borderWidth: isSelected ? 2 : 1.5,
                            opacity: nodeOpacity,
                            transform: [{ scale: nodeScale }],
                          }
                        ]}
                        activeOpacity={0.7}
                      />
                    );
                  })}
                </View>

                <View style={styles.scatterXLabels}>
                  <Text style={[styles.scatterAxisText, { color: theme.textSecondary }]}>Lighter</Text>
                  <Text style={[styles.scatterAxisText, { color: theme.textSecondary }]}>Matched</Text>
                  <Text style={[styles.scatterAxisText, { color: theme.textSecondary }]}>Heavier</Text>
                  <Text style={[styles.scatterAxisText, { color: theme.textSecondary }]}>Ultra Hvy</Text>
                </View>
              </View>

              {selectedNode ? (
                <Animated.View 
                  style={[
                    styles.tooltipContainer, 
                    { 
                      backgroundColor: theme.background,
                      borderColor: selectedNodeBeltColor,
                      borderLeftWidth: 4,
                      opacity: tooltipAnim,
                      transform: [
                        {
                          translateY: tooltipAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0]
                          })
                        }
                      ]
                    }
                  ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedText style={{ fontWeight: '700', fontSize: 14 }}>{selectedNode.partnerName}</ThemedText>
                    <TouchableOpacity onPress={() => setSelectedNode(null)}>
                      <Ionicons name="close" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two }}>
                    <ThemedText type="small" themeColor="textSecondary">Rounds logged: {selectedNode.rounds}</ThemedText>
                    <ThemedText type="smallBold" style={{ color: selectedNodeBeltColor }}>Win Rate: {selectedNode.winPct}%</ThemedText>
                  </View>
                </Animated.View>
              ) : (
                <View style={styles.tooltipPlaceholder}>
                  <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                    Tap a partner dot on the grid to inspect rounds summary.
                  </ThemedText>
                </View>
              )}
            </ThemedView>
          ) : null}
        </ScrollView>

        {/* ==================== PAGE 3: WEAPONS ==================== */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT_COLOR} colors={[ACCENT_COLOR]} />
          }
          style={{ width: SCREEN_WIDTH }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: safeAreaInsets.bottom + Spacing.six }]}>
          
          {/* Offensive Arsenal Pie/Donut Chart */}
          {submissions.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pie-chart-outline" size={18} color={theme.textSecondary} />
                    <ThemedText style={styles.cardTitle}>Offensive Arsenal Breakdown</ThemedText>
                  </View>
                  
                  <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => {
                      setDrawerType('offensive');
                      setDrawerVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.one, paddingLeft: 24 }}
                  >
                    <Text style={{ color: ACCENT_COLOR, fontWeight: '700', fontSize: 12, fontFamily: 'Pliant-Bold' }}>View All Details</Text>
                    <Ionicons name="chevron-forward" size={12} color={ACCENT_COLOR} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.donutRow}>
                <View style={[styles.donutOuter, { borderColor: theme.background }]}>
                  <View 
                    style={[
                      styles.donutSegment, 
                      { 
                        borderColor: ACCENT_COLOR, 
                        borderWidth: 6.5,
                        shadowColor: ACCENT_COLOR,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.35,
                        shadowRadius: 3,
                        elevation: 4,
                      }
                    ]} 
                  />
                  {submissions.length > 1 && <View style={[styles.donutSegment, { borderColor: '#4B5563', borderWidth: 3.5, width: 90, height: 90, top: 5, left: 5 }]} />}
                  {submissions.length > 2 && <View style={[styles.donutSegment, { borderColor: '#9CA3AF', borderWidth: 3.5, width: 80, height: 80, top: 10, left: 10 }]} />}
                  <View style={[styles.donutInner, { backgroundColor: theme.backgroundElement }]} />
                </View>

                <View style={styles.submissionsList}>
                  {submissions.map((sub, idx) => (
                    <View key={idx} style={styles.submissionRow}>
                      <View style={[styles.subDot, { backgroundColor: sub.color }]} />
                      <ThemedText style={styles.subText}>{sub.name}</ThemedText>
                      <Text style={[styles.subPct, { color: sub.color === ACCENT_COLOR ? ACCENT_COLOR : theme.text, fontWeight: sub.color === ACCENT_COLOR ? '700' : '400' }]}>
                        {sub.pct}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ThemedView>
          ) : null}

          {/* Defensive Vulnerability Donut Chart */}
          {defensiveVulnerabilities.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-outline" size={18} color={theme.textSecondary} />
                    <ThemedText style={styles.cardTitle}>Defensive Vulnerabilities</ThemedText>
                  </View>
                  
                  <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => {
                      setDrawerType('defensive');
                      setDrawerVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: Spacing.one, paddingLeft: 24 }}
                  >
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12, fontFamily: 'Pliant-Bold' }}>View All Details</Text>
                    <Ionicons name="chevron-forward" size={12} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.donutRow}>
                <View style={[styles.donutOuter, { borderColor: theme.background }]}>
                  <View 
                    style={[
                      styles.donutSegment, 
                      { 
                        borderColor: '#EF4444', 
                        borderWidth: 6.5,
                        shadowColor: '#EF4444',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.35,
                        shadowRadius: 3,
                        elevation: 4,
                      }
                    ]} 
                  />
                  {defensiveVulnerabilities.length > 1 && <View style={[styles.donutSegment, { borderColor: '#4B5563', borderWidth: 3.5, width: 90, height: 90, top: 5, left: 5 }]} />}
                  {defensiveVulnerabilities.length > 2 && <View style={[styles.donutSegment, { borderColor: '#9CA3AF', borderWidth: 3.5, width: 80, height: 80, top: 10, left: 10 }]} />}
                  <View style={[styles.donutInner, { backgroundColor: theme.backgroundElement }]} />
                </View>

                <View style={styles.submissionsList}>
                  {defensiveVulnerabilities.map((def, idx) => (
                    <View key={idx} style={styles.submissionRow}>
                      <View style={[styles.subDot, { backgroundColor: def.color }]} />
                      <ThemedText style={styles.subText}>{def.name}</ThemedText>
                      <Text style={[styles.subPct, { color: def.color === '#EF4444' ? '#EF4444' : theme.text, fontWeight: def.color === '#EF4444' ? '700' : '400' }]}>
                        {def.pct}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ThemedView>
          ) : null}

          {/* Submission Efficiency Card */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="analytics-outline" size={18} color={theme.textSecondary} />
              <ThemedText style={styles.cardTitle}>Offensive Efficiency</ThemedText>
            </View>

            <View style={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.two }}>
              <View style={styles.indexRow}>
                <View>
                  <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>Submission Efficiency</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Total submission setups finalized</ThemedText>
                </View>
                  <Text style={[styles.indexValue, { color: theme.text }]}>{metrics.setupToFinish}%</Text>
              </View>
            </View>
          </ThemedView>

          {/* Dynamic System Diagnostic (automated leak card) */}
          {metrics.heavyRoundsCount > 0 && metrics.kneeSlicePassPct > 0 ? (
            <ThemedView type="backgroundElement" style={styles.diagnosticContainer}>
              <View style={styles.diagnosticHeader}>
                <Ionicons name="flash" size={18} color={ACCENT_COLOR} />
                <Text style={styles.diagnosticTitle}>Guard Leak Detected</Text>
              </View>

              <Text style={[styles.diagnosticBody, { color: theme.text }]}>
                You logged <Text style={{ fontWeight: '700', color: theme.text }}>{metrics.heavyRoundsCount} rounds</Text> recently against <Text style={{ fontWeight: '700', color: theme.text }}>Heavier</Text> partners. In <Text style={{ color: ACCENT_COLOR, fontWeight: '700' }}>{metrics.kneeSlicePassPct}%</Text> of those rounds, your opponent successfully passed via a <Text style={{ fontWeight: '700', color: theme.text }}>Knee Slice</Text> because your micro-notes flagged a <Text style={{ color: ACCENT_COLOR, fontWeight: '700' }}>Lost Underhook 🔴</Text>.
              </Text>

              <View style={styles.divider} />

              <View style={styles.connectionHeader}>
                <Ionicons name="bulb-outline" size={18} color={theme.text} />
                <Text style={[styles.connectionTitle, { color: theme.text }]}>The Connection Loop</Text>
              </View>

              <Text style={[styles.connectionBody, { color: theme.textSecondary }]}>
                Focus on establishing that early underhook frame during live sparring tomorrow to counter the knee slice passing game of your heavier opponents.
              </Text>
            </ThemedView>
          ) : null}
        </ScrollView>
      </ScrollView>

      {/* KPI Detail Popups */}
      {/* 1. Win/Loss KPI Details */}
      <Modal visible={activeKpiModal === 'win'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Win/Loss Analysis</ThemedText>
              <TouchableOpacity onPress={() => setActiveKpiModal(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginVertical: Spacing.three }}>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Submissions Secured (Wins)</ThemedText>
                <Text style={[styles.modalStatValue, { color: ACCENT_COLOR }]}>{metrics.subsOffensive}</Text>
              </View>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Submissions Yielded (Losses)</ThemedText>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>{metrics.subsConceded}</Text>
              </View>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Submission Efficiency</ThemedText>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>{metrics.setupToFinish}%</Text>
              </View>
              <View style={styles.modalTextSection}>
                <ThemedText type="smallBold" style={{ marginBottom: 4 }}>Tactical Diagnostic</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Your current submission win rate of {metrics.winRate}% is based on logged session finishes. Continue recording live round submission details to calculate weapon-specific threat indexes.
                </ThemedText>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* 2. Feel KPI Details */}
      <Modal visible={activeKpiModal === 'feel'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Session Feel Analytics</ThemedText>
              <TouchableOpacity onPress={() => setActiveKpiModal(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginVertical: Spacing.three }}>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Rolling Average feel</ThemedText>
                <Text style={[styles.modalStatValue, { color: ACCENT_COLOR }]}>{metrics.avgFeel} / 5.0</Text>
              </View>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Total Training Sessions</ThemedText>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>{logsCount}</Text>
              </View>
              <View style={styles.modalTextSection}>
                <ThemedText type="smallBold" style={{ marginBottom: 4 }}>Haptic Feel Insights</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Average feel correlates to your physical states and locker room notes. A rating above 4.0 indicates consistent technical progress and healthy recovery during live sparring.
                </ThemedText>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* 3. Control Ratio KPI Details */}
      <Modal visible={activeKpiModal === 'control'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Control Dominance Details</ThemedText>
              <TouchableOpacity onPress={() => setActiveKpiModal(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginVertical: Spacing.three }}>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Top Position Time Ratio</ThemedText>
                <Text style={[styles.modalStatValue, { color: ACCENT_COLOR }]}>{metrics.topControl}%</Text>
              </View>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Bottom Position Time Ratio</ThemedText>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>{100 - metrics.topControl}%</Text>
              </View>
              <View style={styles.modalStatItem}>
                <ThemedText type="small" themeColor="textSecondary">Guard Passing Success</ThemedText>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>{metrics.passingEfficiency}%</Text>
              </View>
              <View style={styles.modalTextSection}>
                <ThemedText type="smallBold" style={{ marginBottom: 4 }}>Control Analysis</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Your control ratio tracks the proportion of rounds spent in top vs bottom positions. A higher top percentage shows strong pass rates and positional maintenance.
                </ThemedText>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Bottom Drawer for Submissions / Vulnerabilities details */}
      <Modal visible={drawerVisible} animationType="slide" transparent>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={() => { setDrawerVisible(false); setDrawerType(null); }} 
          />
          <ThemedView type="backgroundElement" style={styles.drawerCard}>
            {/* Native Top Drag Indicator */}
            <View style={[styles.dragIndicator, { backgroundColor: theme.textSecondary + '33' }]} />
            
            <View style={styles.drawerHeader}>
              <ThemedText style={styles.drawerTitle}>
                {drawerType === 'offensive' ? 'Offensive Arsenal' : 'Defensive Vulnerabilities'}
              </ThemedText>
              <TouchableOpacity onPress={() => { setDrawerVisible(false); setDrawerType(null); }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Premium Segmented Sorting Toggles */}
            <View style={[styles.sortSegmentContainer, { backgroundColor: theme.background }]}>
              <TouchableOpacity
                onPress={() => setDrawerSort('frequency')}
                style={[
                  styles.sortSegmentButton,
                  drawerSort === 'frequency' && { backgroundColor: theme.backgroundElement }
                ]}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.sortSegmentText, 
                  { 
                    color: drawerSort === 'frequency' ? theme.text : theme.textSecondary,
                    fontFamily: drawerSort === 'frequency' ? 'Pliant-Bold' : 'Pliant-Regular',
                  }
                ]}>
                  Most Frequent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setDrawerSort('time')}
                style={[
                  styles.sortSegmentButton,
                  drawerSort === 'time' && { backgroundColor: theme.backgroundElement }
                ]}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.sortSegmentText, 
                  { 
                    color: drawerSort === 'time' ? theme.text : theme.textSecondary,
                    fontFamily: drawerSort === 'time' ? 'Pliant-Bold' : 'Pliant-Regular',
                  }
                ]}>
                  Most Recent
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginVertical: Spacing.two, maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const list = drawerType === 'offensive' ? rawSubmissions : rawDefensives;
                const sortedList = [...list].sort((a, b) => {
                  if (drawerSort === 'frequency') {
                    return b.count - a.count;
                  } else {
                    return (b.latestDate || '').localeCompare(a.latestDate || '');
                  }
                });

                if (sortedList.length === 0) {
                  return (
                    <Text style={[styles.emptyDrawerText, { color: theme.textSecondary }]}>
                      No logged records found.
                    </Text>
                  );
                }

                return sortedList.map((item, idx) => (
                  <View key={idx} style={[styles.drawerItemRow, { borderBottomColor: theme.background }]}>
                    <View style={styles.drawerItemLeft}>
                      <View style={[styles.drawerItemDot, { backgroundColor: drawerType === 'offensive' ? ACCENT_COLOR : '#EF4444' }]} />
                      <View>
                        <ThemedText style={styles.drawerItemName}>{item.name}</ThemedText>
                        {item.latestDate ? (
                          <Text style={[styles.drawerItemSub, { color: theme.textSecondary }]}>
                            Latest: {new Date(item.latestDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={[styles.drawerCountBadge, { backgroundColor: drawerType === 'offensive' ? ACCENT_COLOR + '15' : '#EF444415' }]}>
                      <Text style={[styles.drawerCountVal, { color: drawerType === 'offensive' ? ACCENT_COLOR : '#EF4444' }]}>
                        {item.count}x
                      </Text>
                    </View>
                  </View>
                ));
              })()}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

    </ThemedView>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  emptyTitle: {
    fontFamily: 'Pliant-Bold',
    fontSize: 20,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Pliant-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.six,
    marginVertical: Spacing.two,
  },
  tabButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 15,
  },
  activeUnderline: {
    height: 1.5,
    borderRadius: 1,
    position: 'absolute',
    bottom: -4,
    left: 8,
    right: 8,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  kpiBlock: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  kpiLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  kpiSub: {
    fontSize: 9,
    opacity: 0.6,
  },
  circleProgress: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleValText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Pliant-Bold',
  },
  controlBarContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    width: '80%',
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  controlBarTop: {
    height: '100%',
    backgroundColor: ACCENT_COLOR,
  },
  controlBarBottom: {
    height: '100%',
    backgroundColor: '#9CA3AF',
  },
  card: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.four,
    marginBottom: Spacing.five,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  volumeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matVolumeVal: {
    fontSize: 24,
    fontFamily: 'Pliant-Bold',
    fontWeight: '700',
    marginTop: 2,
  },
  sparkStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  sparkDayColumn: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  sparkDayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  sparkDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  miniDialsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: Spacing.four,
  },
  miniDialColumn: {
    alignItems: 'center',
  },
  miniProgressCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCircleVal: {
    fontSize: 10,
    fontWeight: '700',
  },
  stackedBarChartContainer: {
    flexDirection: 'row',
    height: 160,
    paddingHorizontal: Spacing.four,
    paddingRight: Spacing.six,
  },
  yAxisGuide: {
    justifyContent: 'space-between',
    height: 130,
    paddingRight: Spacing.two,
  },
  guideText: {
    fontSize: 10,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barStack: {
    width: 22,
    justifyContent: 'flex-end',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barSegment: {
    width: '100%',
  },
  barLabel: {
    fontSize: 10,
    marginTop: Spacing.two,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    marginTop: Spacing.four,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendTextVal: {
    fontSize: 11,
  },
  diagnosticContainer: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(230, 52, 98, 0.15)',
    marginBottom: Spacing.five,
  },
  diagnosticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  diagnosticTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  diagnosticBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.three,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  connectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  connectionBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  positionGridLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  progressTrackGrid: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarGrid: {
    height: '100%',
    borderRadius: 3,
  },
  indexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indexValue: {
    fontSize: 16,
    fontFamily: 'Pliant-Bold',
    fontWeight: '700',
  },
  dividerLine: {
    height: 1,
  },
  scatterPlotWrapper: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  scatterPlotBox: {
    height: 160,
    borderWidth: 1,
    position: 'relative',
  },
  scatterGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  scatterGridVertLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderStyle: 'dashed',
  },
  scatterNode: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    marginTop: -7,
    marginLeft: -7,
  },
  scatterXLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '8%',
    marginTop: Spacing.two,
  },
  scatterAxisText: {
    fontSize: 10,
  },
  tooltipContainer: {
    marginHorizontal: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  tooltipPlaceholder: {
    padding: Spacing.two,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.five,
    justifyContent: 'center',
    paddingBottom: Spacing.two,
  },
  donutOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    position: 'relative',
  },
  donutSegment: {
    position: 'absolute',
    borderRadius: 50,
    width: 100,
    height: 100,
    top: -2,
    left: -2,
  },
  donutInner: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    top: 9,
    left: 9,
  },
  submissionsList: {
    flex: 1,
    gap: Spacing.two,
  },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.two,
  },
  subText: {
    fontSize: 13,
    flex: 1,
  },
  subPct: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.five,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: Spacing.two,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Pliant-Bold',
  },
  modalTextSection: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: Spacing.two,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  drawerTitle: {
    fontSize: 20,
    fontFamily: 'Pliant-Bold',
    fontWeight: '800',
  },
  sortSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  sortSegmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortSegmentText: {
    fontSize: 13,
  },
  drawerItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  drawerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  drawerItemName: {
    fontFamily: 'Pliant-Bold',
    fontSize: 15,
  },
  drawerItemSub: {
    fontSize: 12,
    fontFamily: 'Pliant-Regular',
    marginTop: 2,
  },
  drawerCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  drawerCountVal: {
    fontFamily: 'Pliant-Bold',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyDrawerText: {
    textAlign: 'center',
    fontFamily: 'Pliant-Regular',
    paddingVertical: Spacing.six,
  },
});
