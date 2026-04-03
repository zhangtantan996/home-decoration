import Taro from '@tarojs/taro';
import { Image, Text, Textarea, View } from '@tarojs/components';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import SettingsLayout, { SettingsGroup } from '@/components/settings/SettingsLayout';
import { useMountedRef } from '@/hooks/useMountedRef';
import { submitUserFeedback } from '@/services/userSettings';
import { uploadFile } from '@/services/uploads';
import { showErrorToast } from '@/utils/error';

import './index.scss';

const FEEDBACK_TYPES = ['产品建议', '功能异常', '体验问题', '其他'];
type FeedbackImageItem = {
  previewUrl: string;
  remoteUrl: string;
};

export default function FeedbackSettingsPage() {
  const mountedRef = useMountedRef();
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [images, setImages] = useState<FeedbackImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitDisabled = useMemo(() => content.trim().length < 10 || submitting || uploading, [content, submitting, uploading]);

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
      if (mountedRef.current) {
        showErrorToast(error, '图片上传失败');
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
    if (content.trim().length < 10) {
      Taro.showToast({ title: '请至少填写 10 个字', icon: 'none' });
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
      Taro.navigateBack();
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
        <Button block disabled={submitDisabled} loading={submitting} onClick={handleSubmit}>
          提交反馈
        </Button>
      }
    >
      <SettingsGroup title="反馈分类">
        <View className="feedback-page__types">
          {FEEDBACK_TYPES.map((item) => {
            const active = item === feedbackType;
            return (
              <View
                key={item}
                className={`feedback-page__type-pill${active ? ' feedback-page__type-pill--active' : ''}`}
                onClick={() => setFeedbackType(item)}
              >
                <Text className={`feedback-page__type-text${active ? ' feedback-page__type-text--active' : ''}`}>{item}</Text>
              </View>
            );
          })}
        </View>
      </SettingsGroup>

      <SettingsGroup title="反馈内容">
        <View className="feedback-page__form">
          <View className="feedback-page__field">
            <View className="feedback-page__label-row">
              <Text className="feedback-page__label">问题描述</Text>
              <Text className="feedback-page__counter">{content.length}/300</Text>
            </View>
            <Textarea
              className="feedback-page__textarea"
              maxlength={300}
              placeholder="请描述遇到的问题或你的建议，便于我们快速定位。"
              value={content}
              onInput={(event) => setContent(event.detail.value)}
            />
          </View>

          <View className="feedback-page__field">
            <Text className="feedback-page__label">联系方式</Text>
            <Input
              className="feedback-page__contact-input"
              label=""
              placeholder="手机号 / 微信号（选填）"
              value={contact}
              onChange={(value) => setContact(value)}
            />
          </View>

          <View className="feedback-page__field feedback-page__field--gallery">
            <View className="feedback-page__gallery-head">
              <Text className="feedback-page__label">辅助截图</Text>
              <Text className="feedback-page__gallery-copy">最多上传 4 张</Text>
            </View>
            <View className="feedback-page__gallery">
              {images.map((item) => (
                <View key={item.remoteUrl} className="feedback-page__image-card">
                  <Image className="feedback-page__image" src={item.previewUrl} mode="aspectFill" />
                  <View className="feedback-page__remove" onClick={() => handleRemoveImage(item.remoteUrl)}>
                    <Text className="feedback-page__remove-text">×</Text>
                  </View>
                </View>
              ))}
              {images.length < 4 ? (
                <View className="feedback-page__upload" onClick={handleChooseImages}>
                  <Text className="feedback-page__upload-plus">+</Text>
                  <Text className="feedback-page__upload-text">{uploading ? '上传中...' : '添加截图'}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </SettingsGroup>
    </SettingsLayout>
  );
}
