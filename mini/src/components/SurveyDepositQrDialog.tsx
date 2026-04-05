import { Image, Text, View } from '@tarojs/components';
import React from 'react';

import { Button } from './Button';

interface SurveyDepositQrDialogProps {
  amount: number;
  classNamePrefix: string;
  expired: boolean;
  onClose: () => void;
  qrCodeImageUrl?: string;
  remainingSeconds: number;
  statusText: string;
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
  classNamePrefix,
  expired,
  onClose,
  qrCodeImageUrl,
  remainingSeconds,
  statusText,
}) => {
  const className = (suffix: string) => `${classNamePrefix}__${suffix}`;

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
          <Text className={className('qr-amount-label')}>待支付量房费</Text>
          <Text className={className('qr-amount-value')}>{formatCurrency(amount)}</Text>
        </View>

        <View className={className('qr-image-shell')}>
          <Image className={className('qr-image')} src={qrCodeImageUrl || ''} mode="aspectFit" />
        </View>

        <Text className={`${className('qr-status')} ${expired ? className('qr-status--expired') : ''}`}>
          {statusText}
        </Text>

        {!expired && remainingSeconds > 0 ? (
          <Text className={className('qr-countdown')}>剩余有效时间 {formatRemainingTime(remainingSeconds)}</Text>
        ) : null}

        <Button variant="primary" block onClick={onClose}>
          取消支付
        </Button>
      </View>
    </View>
  );
};
