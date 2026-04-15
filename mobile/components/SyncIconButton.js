import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView, Alert, Animated, Easing, Dimensions,
} from 'react-native';
import {
  RefreshCw, WifiOff, Wifi, AlertCircle, Check, X,
  Trash2, RotateCcw, DatabaseZap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import useSyncStore from '../stores/syncStore';
import useThemeStore from '../stores/themeStore';
import { Button } from './ui/Button';
import { deltaSync, processQueue, fullResync } from '../lib/syncEngine';
import { getFailedEntries, retryFailed, discardFailed } from '../lib/mutationQueue';

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const POPOVER_WIDTH = Math.min(SCREEN_WIDTH - 32, 320);

export default function SyncIconButton() {
  const { isOnline, isSyncing, pendingCount, failedCount, lastSyncAt } = useSyncStore();
  const { resolvedTheme } = useThemeStore();
  const dark = resolvedTheme === 'dark';

  const [open, setOpen] = useState(false);
  const [failedEntries, setFailedEntries] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const primaryColor = dark ? 'hsl(148, 48%, 38%)' : 'hsl(148, 60%, 20%)';
  const mutedColor = dark ? 'hsl(148, 10%, 55%)' : 'hsl(150, 10%, 45%)';
  const dangerColor = dark ? '#f87171' : '#dc2626';
  const amberColor = dark ? '#fbbf24' : '#d97706';
  const cardBg = dark ? 'hsl(150, 20%, 8%)' : '#fff';
  const textColor = dark ? '#e8ede8' : '#1a2e1a';

  const loadFailed = useCallback(async () => {
    try {
      const entries = await getFailedEntries();
      setFailedEntries(entries);
    } catch {
      setFailedEntries([]);
    }
  }, []);

  useEffect(() => {
    if (open) loadFailed();
  }, [open, isSyncing, pendingCount, failedCount, loadFailed]);

  const show = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(true);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hide = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => setOpen(false));
  };

  const handleSyncNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await deltaSync();
      await processQueue();
    } catch { /* handled by engine */ } finally {
      setSyncing(false);
      await loadFailed();
    }
  };

  const handleFullResync = () => {
    hide();
    setTimeout(() => {
      Alert.alert(
        'Full Resync',
        pendingCount > 0
          ? `This will clear all local data and re-download from the server.\n\nYou have ${pendingCount} unsynced change${pendingCount !== 1 ? 's' : ''} that will be lost.`
          : 'This will clear all local data and re-download everything from the server.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Resync', style: 'destructive', onPress: () => fullResync() },
        ],
      );
    }, 200);
  };

  const handleRetry = async (id) => {
    setRetryingId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await retryFailed(id);
      await processQueue();
      await loadFailed();
    } finally {
      setRetryingId(null);
    }
  };

  const handleDiscard = (id, entityType, action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Discard Change',
      `Discard this failed ${action} on ${entityType}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard', style: 'destructive',
          onPress: async () => { await discardFailed(id); await loadFailed(); },
        },
      ],
    );
  };

  // Icon button state
  let Icon, iconColor;
  let badgeCount = 0;
  let badgeColor = null;

  if (!isOnline) {
    Icon = WifiOff; iconColor = dark ? '#f87171' : '#dc2626';
  } else if (isSyncing) {
    Icon = null; iconColor = primaryColor;
  } else if (failedCount > 0) {
    Icon = AlertCircle; iconColor = dangerColor;
    badgeCount = failedCount; badgeColor = dangerColor;
  } else if (pendingCount > 0) {
    Icon = RefreshCw; iconColor = amberColor;
    badgeCount = pendingCount; badgeColor = amberColor;
  } else {
    Icon = Check; iconColor = primaryColor;
  }

  // Popover status
  let statusIcon, statusLabel, statusColor;
  if (!isOnline) {
    statusIcon = <WifiOff size={16} color={dangerColor} />;
    statusLabel = 'Offline'; statusColor = dangerColor;
  } else if (isSyncing || syncing) {
    statusIcon = <ActivityIndicator size={14} color={primaryColor} />;
    statusLabel = 'Syncing\u2026'; statusColor = primaryColor;
  } else if (failedCount > 0) {
    statusIcon = <AlertCircle size={16} color={dangerColor} />;
    statusLabel = `${failedCount} Failed`; statusColor = dangerColor;
  } else if (pendingCount > 0) {
    statusIcon = <RefreshCw size={16} color={amberColor} />;
    statusLabel = `${pendingCount} Pending`; statusColor = amberColor;
  } else {
    statusIcon = <Check size={16} color={primaryColor} />;
    statusLabel = 'All Synced'; statusColor = primaryColor;
  }

  return (
    <View style={{ zIndex: 999 }}>
      {/* The icon button */}
      <Pressable
        onPress={open ? hide : show}
        hitSlop={8}
        style={{
          width: 36, height: 36, borderRadius: 10,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        }}
      >
        {Icon ? <Icon size={18} color={iconColor} /> : <ActivityIndicator size={16} color={iconColor} />}
        {badgeCount > 0 && (
          <View style={{
            position: 'absolute', top: -3, right: -3,
            backgroundColor: badgeColor, borderRadius: 8,
            minWidth: 16, height: 16,
            alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
          }}>
            <Text style={{ fontSize: 10, fontFamily: 'Poppins-Bold', color: '#fff', lineHeight: 14 }}>
              {badgeCount}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Backdrop + Popover */}
      {open && (
        <>
          {/* Invisible full-screen backdrop to catch taps */}
          <Pressable
            onPress={hide}
            style={{
              position: 'absolute',
              top: -200, left: -SCREEN_WIDTH, right: -SCREEN_WIDTH, bottom: -2000,
              zIndex: 998,
            }}
          />

          {/* Popover card */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 42,
              right: 0,
              width: POPOVER_WIDTH,
              zIndex: 999,
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                { translateY: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
              ],
            }}
          >
            {/* Arrow nub */}
            <View style={{
              position: 'absolute', top: -6, right: 12, width: 12, height: 12,
              backgroundColor: cardBg, borderWidth: 1,
              borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              transform: [{ rotate: '45deg' }], zIndex: 0,
              borderRightWidth: 0, borderBottomWidth: 0,
            }} />

            <View style={{
              backgroundColor: cardBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: dark ? 0.4 : 0.12, shadowRadius: 20,
              elevation: 16,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
              }}>
                <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: textColor }}>
                  Sync Status
                </Text>
                <Pressable onPress={hide} hitSlop={12}>
                  <X size={18} color={mutedColor} />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 360, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Status card */}
                <View style={{
                  borderRadius: 10, padding: 12,
                  backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  borderWidth: 1,
                  borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  marginBottom: 12,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {statusIcon}
                    <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: statusColor }}>
                      {statusLabel}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: 10, fontFamily: 'Poppins-Regular', color: mutedColor }}>Connection</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        {isOnline ? <Wifi size={11} color={primaryColor} /> : <WifiOff size={11} color={dangerColor} />}
                        <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: textColor }}>
                          {isOnline ? 'Connected' : 'No connection'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Poppins-Regular', color: mutedColor }}>Last synced</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: textColor, marginTop: 1 }}>
                        {formatTimeAgo(lastSyncAt)}
                      </Text>
                    </View>
                  </View>
                  {pendingCount > 0 && (
                    <View style={{
                      marginTop: 10, paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                    }}>
                      <RefreshCw size={12} color={amberColor} />
                      <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: amberColor }}>
                        {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="default"
                      size="sm"
                      onPress={handleSyncNow}
                      disabled={!isOnline || isSyncing || syncing}
                      loading={syncing}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={13} color="#f5f8f5" />
                        <Text style={{ fontSize: 13, fontFamily: 'Poppins-Medium', color: '#f5f8f5' }}>Sync Now</Text>
                      </View>
                    </Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button variant="outline" size="sm" onPress={handleFullResync}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <DatabaseZap size={13} color={textColor} />
                        <Text style={{ fontSize: 13, fontFamily: 'Poppins-Medium', color: textColor }}>Full Resync</Text>
                      </View>
                    </Button>
                  </View>
                </View>

                {/* Failed entries */}
                {failedEntries.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <AlertCircle size={13} color={dangerColor} />
                      <Text style={{ fontSize: 13, fontFamily: 'Poppins-SemiBold', color: dangerColor }}>
                        Failed ({failedEntries.length})
                      </Text>
                    </View>
                    {failedEntries.map((entry) => (
                      <View key={entry.id} style={{
                        borderRadius: 8, padding: 10,
                        backgroundColor: dark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
                        borderWidth: 1,
                        borderColor: dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                        marginBottom: 6,
                      }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: textColor }} numberOfLines={1}>
                          {entry.entityType} \u2014 {entry.action}
                        </Text>
                        {entry.error && (
                          <Text style={{ fontSize: 11, fontFamily: 'Poppins-Regular', color: mutedColor, marginTop: 2 }} numberOfLines={2}>
                            {entry.error}
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                          <Pressable
                            onPress={() => handleRetry(entry.id)}
                            disabled={retryingId === entry.id}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: retryingId === entry.id ? 0.5 : 1 }}
                          >
                            {retryingId === entry.id
                              ? <ActivityIndicator size={11} color={primaryColor} />
                              : <RotateCcw size={12} color={primaryColor} />}
                            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: primaryColor }}>Retry</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDiscard(entry.id, entry.entityType, entry.action)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                          >
                            <Trash2 size={12} color={dangerColor} />
                            <Text style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: dangerColor }}>Discard</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Bottom padding */}
              <View style={{ height: 6 }} />
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}
