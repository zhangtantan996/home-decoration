import Taro from '@tarojs/taro';
import { Image, Text, Textarea, View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useMountedRef } from '@/hooks/useMountedRef';
import { submitUserFeedback } from '@/services/userSettings';
import { uploadFile } from '@/services/uploads';
import { isUserCancelError, showErrorToast } from '@/utils/error';

import './index.scss';

const FEEDBACK_TYPES = [
  { label: '产品建议', value: '产品建议' },
  { label: '功能异常', value: '功能异常' },
  { label: '体验问题', value: '体验问题' },
  { label: '其他', value: '其他' },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]['value'];

type FeedbackImageItem = {
  previewUrl: string;
  remoteUrl: string;
};

const isValidContact = (value: string) => {
  const next = value.trim();
  if (!next) {
    return true;
  }
  if (/^1[3-9]\d{9}$/.test(next)) {
    return true;
  }
  return /^[A-Za-z][A-Za-z0-9_-]{5,19}$/.test(next);
};

const navigateBackAfterSubmit = () => {
  const pages = Taro.getCurrentPages();
  if (pages.length > 1) {
    Taro.navigateBack();
    return;
  }
  Taro.switchTab({ url: '/pages/profile/index' });
};

export default function FeedbackSettingsPage() {
  const mountedRef = useMountedRef();
  const [feedbackType, setFeedbackType] = useState<FeedbackType | ''>('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState<FeedbackImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contentTouched, setContentTouched] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [focusedField, setFocusedField] = useState<'content' | 'contact' | null>(null);

  const contentInvalid = contentTouched && content.trim().length === 0;
  const contactInvalid = contactTouched && !isValidContact(contact);
  const submitDisabled = useMemo(
    () => !feedbackType || content.trim().length === 0 || submitting || uploading,
    [content, feedbackType, submitting, uploading],
  );

  const handleChooseImages = async () => {
    if (uploading || images.length >= 4) {
      return;
    }

    try {
      if (mountedRef.current) {
        setUploading(true);
      }
      const result = await Taro.chooseImage({
        count: 4 - images.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      const uploaded = await Promise.all(
        result.tempFilePaths.map(async (filePath) => {
          const item = await uploadFile(filePath, { category: 'feedback' });
          return {
            previewUrl: filePath,
            remoteUrl: item.url,
          };
        }),
      );
      if (mountedRef.current) {
        setImages((prev) => [...prev, ...uploaded].slice(0, 4));
      }
    } catch (error) {
      if (isUserCancelError(error)) {
        return;
      }
      if (mountedRef.current) {
        showErrorToast(error, '上传失败，请重试');
      }
    } finally {
      if (mountedRef.current) {
        setUploading(false);
      }
    }
  };

  const handleRemoveImage = (targetUrl: string) => {
    setImages((prev) => prev.filter((item) => item.remoteUrl !== targetUrl));
  };

  const handleSubmit = async () => {
    if (!feedbackType) {
      Taro.showToast({ title: '请选择反馈分类', icon: 'none' });
      return;
    }
    if (!content.trim()) {
      setContentTouched(true);
      Taro.showToast({ title: '请填写问题描述', icon: 'none' });
      return;
    }
    if (!isValidContact(contact)) {
      setContactTouched(true);
      Taro.showToast({ title: '请填写正确的联系方式', icon: 'none' });
      return;
    }

    try {
      if (mountedRef.current) {
        setSubmitting(true);
      }
      await submitUserFeedback({
        type: feedbackType,
        content: content.trim(),
        contact: contact.trim() || undefined,
        images: images.length > 0 ? images.map((item) => item.remoteUrl).join(',') : undefined,
      });
      if (!mountedRef.current) {
        return;
      }
      Taro.showToast({ title: '反馈已提交', icon: 'success' });
      setContent('');
      setContact('');
      setImages([]);
      setFeedbackType('');
      setTimeout(navigateBackAfterSubmit, 520);
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '反馈提交失败');
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <SettingsLayout
      title="意见反馈"
      className="feedback-page"
      footer={
        <Button block className="feedback-page__submit" disabled={submitDisabled} loading={submitting} onClick={handleSubmit}>
          {submitting ? '提交中...' : '提交反馈'}
        </Button>
      }
    >
      <View className="feedback-page__card">
        <Text className="feedback-page__card-title">反馈分类</Text>
        <View className="feedback-page__types">
          {FEEDBACK_TYPES.map((item) => {
            const active = item.value === feedbackType;
            return (
              <View
                key={item.value}
                className={`feedback-page__type-pill${active ? ' feedback-page__type-pill--active' : ''}`}
                hoverClass="feedback-page__type-pill--pressed"
                onClick={() => setFeedbackType(item.value)}
              >
                <Text className="feedback-page__type-text">{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="feedback-page__card">
        <Text className="feedback-page__card-title">反馈内容</Text>
        <View className="feedback-page__label-row">
          <Text className="feedback-page__label">问题描述</Text>
          <Text className={`feedback-page__counter${content.length >= 270 ? ' feedback-page__counter--near-limit' : ''}`}>
            {content.length}/300
          </Text>
        </View>
        <Textarea
          className={`feedback-page__textarea${focusedField === 'content' ? ' feedback-page__textarea--focused' : ''}${contentInvalid ? ' feedback-page__textarea--error' : ''}`}
          maxlength={300}
          placeholder="描述你遇到的问题或你的建议，便于我们快速定位。"
          placeholderClass="feedback-page__placeholder"
          value={content}
          onBlur={() => {
            setFocusedField(null);
            setContentTouched(true);
          }}
          onFocus={() => setFocusedField('content')}
          onInput={(event) => setContent(event.detail.value)}
        />
        {contentInvalid ? <Text className="feedback-page__error">请填写问题描述</Text> : null}
      </View>

      <View className="feedback-page__card">
        <Text className="feedback-page__card-title">联系方式</Text>
        <View className={`feedback-page__contact-shell${focusedField === 'contact' ? ' feedback-page__contact-shell--focused' : ''}${contactInvalid ? ' feedback-page__contact-shell--error' : ''}`}>
          <Input
            className="feedback-page__contact-input"
            label=""
            placeholder="手机号 / 微信号（选填）"
            value={contact}
            onBlur={() => {
              setFocusedField(null);
              setContactTouched(true);
            }}
            onChange={(value) => setContact(value)}
            onFocus={() => setFocusedField('contact')}
          />
        </View>
        {contactInvalid ? <Text className="feedback-page__error">请填写正确的手机号或微信号</Text> : null}
      </View>

      <View className="feedback-page__card">
        <View className="feedback-page__gallery-head">
          <Text className="feedback-page__card-title">辅助截图</Text>
          <Text className="feedback-page__gallery-copy">最多上传 4 张</Text>
        </View>
        <View className="feedback-page__gallery">
          {images.map((item) => (
            <View key={item.remoteUrl} className="feedback-page__image-card">
              <Image className="feedback-page__image" src={item.previewUrl} mode="aspectFill" />
              <View
                className="feedback-page__remove"
                hoverClass="feedback-page__remove--pressed"
                onClick={() => handleRemoveImage(item.remoteUrl)}
              >
                <Text className="feedback-page__remove-text">×</Text>
              </View>
            </View>
          ))}
          {images.length < 4 ? (
            <View
              className={`feedback-page__upload${uploading ? ' feedback-page__upload--loading' : ''}`}
              hoverClass={uploading ? 'none' : 'feedback-page__upload--pressed'}
              onClick={handleChooseImages}
            >
              <Text className="feedback-page__upload-plus">+</Text>
              <Text className="feedback-page__upload-text">{uploading ? '上传中...' : '添加截图'}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </SettingsLayout>
  );
}
