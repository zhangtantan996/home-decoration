import { Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useState } from 'react';

import { MINI_ENV } from '@/config/env';
import {
  QR_IMAGE_ERROR_TEXT,
  QR_LOADING_TEXT,
  QR_SUCCESS_TEXT,
  QR_WAITING_TEXT,
} from '@/constants/paymentQr';
import { Button } from './Button';

export type SurveyDepositQrDialogPhase = 'waiting' | 'checking' | 'success' | 'expired';
export type SurveyDepositQrDialogStatusTone = 'default' | 'warning' | 'error' | 'success';

interface SurveyDepositQrDialogProps {
  amount: number;
  amountLabel?: string;
  classNamePrefix: string;
  confirmLoading?: boolean;
  closeLabel?: string;
  imageErrorText?: string;
  onClose: () => void;
  onConfirmPaid?: () => void;
  onRetry?: () => void;
  phase: SurveyDepositQrDialogPhase;
  qrCodeImageUrl?: string;
  remainingSeconds: number;
  statusText: string;
  statusTone?: SurveyDepositQrDialogStatusTone;
}

const formatRemainingTime = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`;
};

const formatCurrency = (amount: number) => `¥${Number(amount || 0).toLocaleString()}`;

export const SurveyDepositQrDialog: React.FC<SurveyDepositQrDialogProps> = ({
  amount,
  amountLabel = '待支付金额',
  classNamePrefix,
  confirmLoading = false,
  closeLabel,
  imageErrorText,
  onClose,
  onConfirmPaid,
  onRetry,
  phase,
  qrCodeImageUrl,
  remainingSeconds,
  statusText,
  statusTone = 'default',
}) => {
  const className = (suffix: string) => `${classNamePrefix}__${suffix}`;
  const isExpired = phase === 'expired';
  const isSuccess = phase === 'success';
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    let alive = true;

    if (isSuccess || isExpired) {
      setImageSrc('');
      setImageState(isExpired ? 'error' : 'loaded');
      return () => {
        alive = false;
      };
    }

    const source = String(qrCodeImageUrl || '').trim();
    if (!source) {
      setImageSrc('');
      setImageState('error');
      return () => {
        alive = false;
      };
    }

    setImageState('loading');

    if (process.env.TARO_ENV !== 'weapp') {
      setImageSrc(source);
      return () => {
        alive = false;
      };
    }

    Taro.downloadFile({ url: source })
      .then((result) => {
        if (!alive) {
          return;
        }
        if (result.statusCode >= 200 && result.statusCode < 300 && result.tempFilePath) {
          setImageSrc(result.tempFilePath);
          setImageState('loading');
          return;
        }
        setImageSrc('');
        setImageState('error');
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        setImageSrc('');
        setImageState('error');
      });

    return () => {
      alive = false;
    };
  }, [isExpired, isSuccess, qrCodeImageUrl]);

  const diagnosticHint = useMemo(() => {
    if (MINI_ENV.APP_ENV === 'production') {
      return '';
    }
    return '请优先检查小程序 downloadFile 合法域名是否已配置。';
  }, []);

  const shouldShowRetry = !!onRetry && (isExpired || imageState === 'error');
  const shouldShowConfirm = !!onConfirmPaid && !isExpired && !isSuccess && imageState === 'loaded';
  const resolvedCloseLabel = closeLabel || '关闭';
  const resolvedStatusText = (() => {
    if (imageState === 'error') {
      return imageErrorText || QR_IMAGE_ERROR_TEXT;
    }
    return statusText;
  })();
  const primaryTip = (() => {
    if (isSuccess) {
      return QR_SUCCESS_TEXT;
    }
    if (imageState === 'loading') {
      return QR_LOADING_TEXT;
    }
    return QR_WAITING_TEXT;
  })();
  const shouldShowStatusText = !!resolvedStatusText
    && resolvedStatusText !== primaryTip
    && imageState !== 'loading';
  const resolvedStatusTone = imageState === 'error' || isExpired ? 'error' : statusTone;
  const statusClassName = [
    className('qr-status'),
    resolvedStatusTone !== 'default' ? className('qr-status--notice') : '',
    resolvedStatusTone === 'warning' ? className('qr-status--warning') : '',
    resolvedStatusTone === 'error' ? className('qr-status--error') : '',
    resolvedStatusTone === 'success' ? className('qr-status--success') : '',
  ].filter(Boolean).join(' ');
  const showCountdown = !isExpired && !isSuccess && imageState !== 'error' && remainingSeconds > 0;

  return (
    <View className={className('qr-mask')} onClick={onClose}>
      <View className={className('qr-dialog')} onClick={(event) => event.stopPropagation()}>
        <View className={className('qr-header')}>
          <Text className={className('qr-title')}>支付宝扫码支付</Text>
          <Text className={className('qr-close')} onClick={onClose}>
            ×
          </Text>
        </View>

        <View className={className('qr-amount')}>
          <Text className={className('qr-amount-label')}>{amountLabel}</Text>
          <Text className={className('qr-amount-value')}>{formatCurrency(amount)}</Text>
        </View>

        <View className={className('qr-image-shell')}>
          {isSuccess ? (
            <View className={className('qr-placeholder')}>
              <Text className={className('qr-placeholder-title')}>支付成功</Text>
            </View>
          ) : imageState === 'error' || isExpired ? (
            <View className={className('qr-placeholder')}>
              <Text className={className('qr-placeholder-title')}>
                {isExpired ? '二维码已失效' : '二维码加载失败'}
              </Text>
            </View>
          ) : imageSrc ? (
            <>
              <Image
                className={className('qr-image')}
                src={imageSrc}
                mode="aspectFit"
                onLoad={() => setImageState('loaded')}
                onError={() => {
                  setImageSrc('');
                  setImageState('error');
                }}
              />
              {imageState === 'loading' ? (
                <View className={className('qr-loading')}>
                  <Text className={className('qr-loading-text')}>{QR_LOADING_TEXT}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View className={className('qr-loading')}>
              <Text className={className('qr-loading-text')}>{QR_LOADING_TEXT}</Text>
            </View>
          )}
        </View>

        <Text className={className('qr-tip')}>{primaryTip}</Text>
        {shouldShowStatusText ? (
          <Text className={statusClassName}>{resolvedStatusText}</Text>
        ) : null}
        {diagnosticHint && imageState === 'error' ? (
          <Text className={className('qr-diagnostic')}>{diagnosticHint}</Text>
        ) : null}
        {showCountdown ? (
          <Text className={className('qr-countdown')}>剩余有效时间 {formatRemainingTime(remainingSeconds)}</Text>
        ) : null}

        <View className={className('qr-actions')}>
          <Button variant="outline" className={className('qr-action-button')} onClick={onClose}>
            {resolvedCloseLabel}
          </Button>
          {shouldShowConfirm ? (
            <Button
              variant="primary"
              className={className('qr-action-button')}
              loading={confirmLoading}
              disabled={confirmLoading}
              onClick={onConfirmPaid}
            >
              我已支付
            </Button>
          ) : null}
          {shouldShowRetry ? (
            <Button variant="primary" className={className('qr-action-button')} onClick={onRetry}>
              重新获取二维码
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
};
