import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';

import { Button } from '@/components/Button';
import MiniPageNav from '@/components/MiniPageNav';
import { createQuoteInquiry, type QuoteInquiryPublicDetail } from '@/services/quote-inquiry';
import { getErrorMessage } from '@/utils/error';
import { getPageBottomSpacerStyle } from '@/utils/fixedLayout';
import {
  clearQuoteInquirySubmitDraft,
  getQuoteInquirySubmitDraft,
} from '@/utils/quoteInquirySubmitDraft';
import { XIAN_CITY_CODE } from '@/utils/xianAddress';

import './index.scss';

type SubmitPhase = 'intro' | 'waiting' | 'error';

const COUNTDOWN_SECONDS = 5;
const COUNTDOWN_INTERVAL_MS = 1000;

const QuoteInquirySubmittingPage: React.FC = () => {
  const pageBottomStyle = useMemo(() => getPageBottomSpacerStyle(0), []);
  const [phase, setPhase] = useState<SubmitPhase>('intro');
  const [errorMessage, setErrorMessage] = useState('');
  const [canRetry, setCanRetry] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState(COUNTDOWN_SECONDS);

  const attemptIdRef = useRef(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const countdownFinishedRef = useRef(false);
  const pendingResponseRef = useRef<QuoteInquiryPublicDetail | null>(null);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const invalidateCurrentAttempt = useCallback(() => {
    attemptIdRef.current += 1;
    clearCountdownTimer();
    countdownFinishedRef.current = false;
    pendingResponseRef.current = null;
  }, [clearCountdownTimer]);

  const jumpToResult = useCallback(
    (response: QuoteInquiryPublicDetail) => {
      clearCountdownTimer();
      clearQuoteInquirySubmitDraft();
      const query = response.accessToken
        ? `id=${response.inquiry.id}&accessToken=${encodeURIComponent(response.accessToken)}`
        : `id=${response.inquiry.id}`;

      void Taro.redirectTo({
        url: `/pages/quote-inquiry/result/index?${query}`,
      });
    },
    [clearCountdownTimer],
  );

  const showErrorState = useCallback((message: string, retryable: boolean) => {
    clearCountdownTimer();
    setErrorMessage(message);
    setCanRetry(retryable);
    setPhase('error');
  }, [clearCountdownTimer]);

  const startSubmission = useCallback(async () => {
    const draft = getQuoteInquirySubmitDraft();
    if (!draft) {
      showErrorState('提交信息已失效，请返回重新填写后再生成报价。', false);
      return;
    }

    invalidateCurrentAttempt();
    const attemptId = attemptIdRef.current;

    setErrorMessage('');
    setCanRetry(true);
    setPhase('intro');
    setRemainingSeconds(COUNTDOWN_SECONDS);
    countdownFinishedRef.current = false;
    pendingResponseRef.current = null;

    countdownTimerRef.current = setInterval(() => {
      if (attemptIdRef.current !== attemptId) return;

      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearCountdownTimer();
          countdownFinishedRef.current = true;
          if (pendingResponseRef.current) {
            jumpToResult(pendingResponseRef.current);
          } else {
            setPhase('waiting');
          }
          return 0;
        }

        return current - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);

    try {
      const response = await createQuoteInquiry({
        address: draft.address,
        cityCode: draft.cityCode || XIAN_CITY_CODE,
        area: draft.area,
        houseLayout: draft.houseLayout,
        renovationType: draft.renovationType,
        style: draft.style,
        phone: draft.phone,
        source: draft.source,
        wechatCode: draft.wechatCode,
      });

      if (attemptIdRef.current !== attemptId) return;
      if (countdownFinishedRef.current) {
        jumpToResult(response);
        return;
      }

      pendingResponseRef.current = response;
    } catch (error) {
      if (attemptIdRef.current !== attemptId) return;
      const message = getErrorMessage(error, '报价生成失败，请稍后重试');
      showErrorState(message, true);
    }
  }, [clearCountdownTimer, invalidateCurrentAttempt, jumpToResult, showErrorState]);

  useLoad(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startSubmission();
  });

  useEffect(
    () => () => {
      invalidateCurrentAttempt();
    },
    [invalidateCurrentAttempt],
  );

  const handleBackToCreate = useCallback(() => {
    invalidateCurrentAttempt();
    void Taro.redirectTo({
      url: '/pages/quote-inquiry/create/index?restoreDraft=1',
    });
  }, [invalidateCurrentAttempt]);

  const handleRetry = useCallback(() => {
    void startSubmission();
  }, [startSubmission]);

  const panelClassName =
    phase === 'intro'
      ? 'quote-inquiry-submitting__panel quote-inquiry-submitting__panel--intro'
      : 'quote-inquiry-submitting__panel';

  const title =
    phase === 'waiting' ? '正在计算预算与费用说明' : '正在生成报价详情';
  const copy =
    phase === 'waiting'
      ? '请稍候，结果准备好后会自动进入详情页。'
      : '正在整理预算结构。';
  const countdownLabel = '预计生成时间';

  return (
    <View className="quote-inquiry-submitting" style={pageBottomStyle}>
      <MiniPageNav title="生成报价" onBack={handleBackToCreate} placeholder />

      <View className="quote-inquiry-submitting__content">
        {phase === 'error' ? (
          <View className="quote-inquiry-submitting__error-card">
            <Text className="quote-inquiry-submitting__error-title">
              这次报价没有成功生成
            </Text>
            <Text className="quote-inquiry-submitting__error-copy">{errorMessage}</Text>

            <View className="quote-inquiry-submitting__error-actions">
              <Button
                block
                variant="secondary"
                className="quote-inquiry-submitting__error-secondary"
                onClick={handleBackToCreate}
              >
                返回修改
              </Button>
              {canRetry ? (
                <Button
                  block
                  variant="primary"
                  className="quote-inquiry-submitting__error-primary"
                  onClick={handleRetry}
                >
                  重新生成
                </Button>
              ) : null}
            </View>
          </View>
        ) : (
          <View className={panelClassName}>
            <View className="quote-inquiry-submitting__visual">
              <View className="quote-inquiry-submitting__ring quote-inquiry-submitting__ring--outer" />
              <View className="quote-inquiry-submitting__ring quote-inquiry-submitting__ring--middle" />
              <View className="quote-inquiry-submitting__ring-core" />
              <View className="quote-inquiry-submitting__grid">
                {Array.from({ length: 9 }).map((_, index) => (
                  <View className="quote-inquiry-submitting__grid-dot" key={index} />
                ))}
              </View>
            </View>

            <Text className="quote-inquiry-submitting__eyebrow">AI QUOTE ENGINE</Text>
            <Text className="quote-inquiry-submitting__title">{title}</Text>
            <Text className="quote-inquiry-submitting__copy">{copy}</Text>

            {phase === 'intro' ? (
              <View className="quote-inquiry-submitting__countdown">
                <Text className="quote-inquiry-submitting__countdown-label">{countdownLabel}</Text>
                <Text className="quote-inquiry-submitting__countdown-value">
                  {remainingSeconds} 秒
                </Text>
              </View>
            ) : null}

            {phase === 'waiting' ? (
              <View className="quote-inquiry-submitting__waiting-list">
                <View className="quote-inquiry-submitting__waiting-row">
                  <View className="quote-inquiry-submitting__waiting-dot" />
                  <Text className="quote-inquiry-submitting__waiting-text">
                    正在核算设计、施工、主材三部分费用结构
                  </Text>
                </View>
                <View className="quote-inquiry-submitting__waiting-row">
                  <View className="quote-inquiry-submitting__waiting-dot" />
                  <Text className="quote-inquiry-submitting__waiting-text">
                    正在整理费用说明与预计工期
                  </Text>
                </View>
                <View className="quote-inquiry-submitting__waiting-row">
                  <View className="quote-inquiry-submitting__waiting-dot" />
                  <Text className="quote-inquiry-submitting__waiting-text">
                    结果准备好后会自动进入报价详情页
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
};

export default QuoteInquirySubmittingPage;
