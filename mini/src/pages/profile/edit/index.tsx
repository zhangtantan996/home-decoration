import Taro from '@tarojs/taro';
import { Image, Picker, Text, Textarea, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useMountedRef } from '@/hooks/useMountedRef';
import { getUserProfile, updateUserProfile, type UpdateProfileDTO } from '@/services/profile';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';
import { resolveProfileAvatarDisplayUrl } from '@/utils/profileAvatar';

import './index.scss';

const buildFallbackNickname = (phone?: string) => {
  const value = String(phone || '').trim();
  if (value.length >= 4) {
    return `用户${value.slice(-4)}`;
  }
  return '用户';
};

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const date = `${today.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export default function ProfileEdit() {
  const auth = useAuthStore();
  const mountedRef = useMountedRef();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [formData, setFormData] = useState({
    nickname: '',
    avatar: '',
    birthday: '',
    bio: '',
  });

  const birthdayEnd = useMemo(() => getTodayDateString(), []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getUserProfile();
        if (!mountedRef.current) {
          return;
        }
        setFormData({
          nickname: profile.nickname || '',
          avatar: profile.avatar || '',
          birthday: profile.birthday || '',
          bio: profile.bio || '',
        });
        setAvatarPreview(resolveProfileAvatarDisplayUrl(profile.avatar, auth.user?.avatar));
      } catch (error) {
        if (mountedRef.current) {
          showErrorToast(error, '资料加载失败');
        }
      }
    };

    void fetchProfile();
  }, [auth.user?.avatar, mountedRef]);

  const displayName = useMemo(() => {
    return formData.nickname.trim() || buildFallbackNickname(auth.user?.phone);
  }, [auth.user?.phone, formData.nickname]);

  const handleChooseAvatar = async () => {
    if (uploading) {
      return;
    }

    try {
      const result = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      if (!result.tempFilePaths?.length) {
        return;
      }

      if (mountedRef.current) {
        setUploading(true);
      }
      const uploadResult = await uploadFile(result.tempFilePaths[0], { category: 'avatar' });
      if (!mountedRef.current) {
        return;
      }
      setFormData((prev) => ({ ...prev, avatar: uploadResult.path || uploadResult.url }));
      setAvatarPreview(result.tempFilePaths[0]);
      Taro.showToast({ title: '头像已更新', icon: 'success' });
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '头像上传失败');
      }
    } finally {
      if (mountedRef.current) {
        setUploading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.nickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    try {
      if (mountedRef.current) {
        setLoading(true);
      }
      const payload: UpdateProfileDTO = {
        nickname: formData.nickname.trim(),
        avatar: formData.avatar || undefined,
        birthday: formData.birthday || undefined,
        bio: formData.bio.trim() || undefined,
      };

      await updateUserProfile(payload);
      const latestProfile = await getUserProfile().catch(() => null);
      if (!mountedRef.current) {
        return;
      }

      auth.updateUser({
        nickname: latestProfile?.nickname || payload.nickname || displayName,
        avatar: resolveProfileAvatarDisplayUrl(latestProfile?.avatar, avatarPreview || auth.user?.avatar),
      });

      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 500);
    } catch (error) {
      if (mountedRef.current) {
        showErrorToast(error, '保存失败');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <SettingsLayout
      title="个人资料"
      description="头像、昵称和个人简介会同步展示在你的个人页。"
      className="profile-edit-page"
      footer={
        <Button block loading={loading} onClick={handleSubmit}>
          保存资料
        </Button>
      }
    >
      <View className="profile-edit-page__hero-card">
        <View className="profile-edit-page__avatar-wrap" onClick={handleChooseAvatar}>
          <View className="profile-edit-page__avatar-shell">
            <View className="profile-edit-page__avatar-media">
              {avatarPreview ? (
                <Image className="profile-edit-page__avatar-image" src={avatarPreview} mode="aspectFill" />
              ) : (
                <View className="profile-edit-page__avatar-fallback">
                  <Icon name="profile" size={52} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View className="profile-edit-page__avatar-badge">
              <Text className="profile-edit-page__avatar-badge-text">{uploading ? '上传中' : '更换'}</Text>
            </View>
          </View>
        </View>
        <Text className="profile-edit-page__name">{displayName}</Text>
        <Text className="profile-edit-page__hint">{uploading ? '头像上传中...' : '点击头像即可更换'}</Text>
      </View>

      <View className="profile-edit-page__form-card">
        <Input
          label="昵称"
          value={formData.nickname}
          placeholder="请输入昵称"
          onChange={(value) => setFormData((prev) => ({ ...prev, nickname: value }))}
        />

        <View className="profile-edit-page__field">
          <View className="profile-edit-page__label-row">
            <Text className="profile-edit-page__label">生日</Text>
            <Text className="profile-edit-page__field-tip">选填</Text>
          </View>
          <Picker
            mode="date"
            value={formData.birthday || birthdayEnd}
            start="1940-01-01"
            end={birthdayEnd}
            onChange={(event) => setFormData((prev) => ({ ...prev, birthday: event.detail.value }))}
          >
            <View className={`profile-edit-page__picker${formData.birthday ? '' : ' profile-edit-page__picker--placeholder'}`}>
              <Text className="profile-edit-page__picker-text">
                {formData.birthday || '请选择生日'}
              </Text>
              <Text className="profile-edit-page__picker-arrow">›</Text>
            </View>
          </Picker>
        </View>

        <View className="profile-edit-page__field profile-edit-page__field--textarea">
          <View className="profile-edit-page__label-row">
            <Text className="profile-edit-page__label">个人简介</Text>
            <Text className="profile-edit-page__field-tip">最多 200 字</Text>
          </View>
          <View className="profile-edit-page__textarea-wrap">
            <Textarea
              className="profile-edit-page__textarea"
              value={formData.bio}
              maxlength={200}
              autoHeight
              placeholder="介绍一下你希望展示的个人信息或装修偏好"
              onInput={(event) => setFormData((prev) => ({ ...prev, bio: event.detail.value }))}
            />
          </View>
        </View>
      </View>
    </SettingsLayout>
  );
}
