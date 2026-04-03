import Taro, { usePageScroll } from '@tarojs/taro';
import { useCallback, useEffect, useRef, useState } from 'react';

export type PullToRefreshFeedbackStatus =
  | 'idle'
  | 'refreshing'
  | 'success'
  | 'error';

interface PullToRefreshReloadOptions {
  withFeedback?: boolean;
}

interface TouchLikeEvent {
  touches?: Array<{
    clientY?: number;
    pageY?: number;
  }>;
}

const PULL_THRESHOLD = 92;
const MAX_PULL_DISTANCE = 132;
const DRAWER_HOLD_HEIGHT = 76;
const DRAWER_RELEASE_DELAY = 420;
const DRAWER_CLOSE_DURATION = 220;

const getTouchY = (event: unknown) => {
  const touch = (event as TouchLikeEvent | undefined)?.touches?.[0];
  if (!touch) {
    return 0;
  }
  return Number(touch.clientY ?? touch.pageY ?? 0);
};

const applyPullResistance = (distance: number) => {
  if (distance <= 0) {
    return 0;
  }
  return Math.min(MAX_PULL_DISTANCE, distance * 0.52);
};

export function usePullToRefreshFeedback(
  reloadHandler: () => Promise<unknown> | unknown,
) {
  const [status, setStatus] = useState<PullToRefreshFeedbackStatus>('idle');
  const [drawerHeight, setDrawerHeight] = useState(0);
  const [drawerProgress, setDrawerProgress] = useState(0);

  const activeTaskRef = useRef<Promise<void> | null>(null);
  const reloadHandlerRef = useRef(reloadHandler);
  const drawerHeightRef = useRef(0);
  const scrollTopRef = useRef(0);
  const touchStartYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullEligibleRef = useRef(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePageScroll((event) => {
    scrollTopRef.current = Number(event.scrollTop || 0);
  });

  useEffect(() => {
    reloadHandlerRef.current = reloadHandler;
  }, [reloadHandler]);

  const setDrawerVisual = useCallback((height: number) => {
    drawerHeightRef.current = height;
    setDrawerHeight(height);
    setDrawerProgress(height > 0 ? Math.min(1, height / PULL_THRESHOLD) : 0);
  }, []);

  const clearTimers = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const collapseDrawer = useCallback(
    (delay = 0) => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }

      const run = () => {
        setDrawerVisual(0);
      };

      if (delay > 0) {
        collapseTimerRef.current = setTimeout(() => {
          run();
          collapseTimerRef.current = null;
        }, delay);
        return;
      }

      run();
    },
    [setDrawerVisual],
  );

  const resetStatusToIdle = useCallback((delay = 0) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    resetTimerRef.current = setTimeout(() => {
      setStatus('idle');
      resetTimerRef.current = null;
    }, delay);
  }, []);

  const finishFeedback = useCallback(
    (nextStatus: 'success' | 'error') => {
      setStatus(nextStatus);
      setDrawerVisual(DRAWER_HOLD_HEIGHT);
      collapseDrawer(DRAWER_RELEASE_DELAY);
      resetStatusToIdle(DRAWER_RELEASE_DELAY + DRAWER_CLOSE_DURATION);
    },
    [collapseDrawer, resetStatusToIdle, setDrawerVisual],
  );

  const runReload = useCallback(
    async ({ withFeedback = false }: PullToRefreshReloadOptions = {}) => {
      if (activeTaskRef.current) {
        return activeTaskRef.current;
      }

      clearTimers();

      if (withFeedback) {
        setStatus('refreshing');
        setDrawerVisual(DRAWER_HOLD_HEIGHT);
      }

      const task = (async () => {
        try {
          await Promise.resolve(reloadHandlerRef.current());
          if (withFeedback) {
            finishFeedback('success');
          }
        } catch (error) {
          if (withFeedback) {
            finishFeedback('error');
          }
          throw error;
        } finally {
          Taro.stopPullDownRefresh();
          activeTaskRef.current = null;
        }
      })();

      activeTaskRef.current = task;
      return task;
    },
    [clearTimers, finishFeedback, setDrawerVisual],
  );

  const handleTouchStart = useCallback(
    (event: unknown) => {
      if (activeTaskRef.current || status === 'refreshing') {
        return;
      }

      pullEligibleRef.current = scrollTopRef.current <= 1;
      pullingRef.current = false;
      touchStartYRef.current = getTouchY(event);
    },
    [status],
  );

  const handleTouchMove = useCallback(
    (event: unknown) => {
      if (activeTaskRef.current || status !== 'idle') {
        return;
      }

      const deltaY = getTouchY(event) - touchStartYRef.current;
      if (!pullEligibleRef.current && scrollTopRef.current > 1) {
        return;
      }

      if (deltaY <= 0) {
        if (pullingRef.current) {
          collapseDrawer();
        }
        return;
      }

      const nextHeight = applyPullResistance(deltaY);
      if (nextHeight <= 0) {
        return;
      }

      clearTimers();
      pullingRef.current = true;
      setDrawerVisual(nextHeight);
    },
    [clearTimers, collapseDrawer, setDrawerVisual, status],
  );

  const finishPull = useCallback(() => {
    if (!pullingRef.current || status !== 'idle') {
      return;
    }

    const shouldRefresh = drawerHeightRef.current >= PULL_THRESHOLD;
    pullingRef.current = false;
    pullEligibleRef.current = false;

    if (shouldRefresh) {
      void runReload({ withFeedback: true });
      return;
    }

    collapseDrawer();
  }, [collapseDrawer, runReload, status]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    refreshStatus: status,
    drawerHeight,
    drawerProgress,
    bindPullToRefresh: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: finishPull,
      onTouchCancel: finishPull,
    },
    runReload,
  };
}
