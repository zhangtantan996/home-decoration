import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Cell, Avatar, Toast } from '@nutui/nutui-react-taro';
import { User, Photograph } from '@nutui/icons-react-taro';

import { getUserProfile, updateUserProfile, type UpdateProfileDTO } from '@/services/profile';
import { uploadFile } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { showErrorToast } from '@/utils/error';

export default function ProfileEdit() {
  const auth = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    avatar: '',
    email: '',
    realName: '',
    address: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const profile = await getUserProfile();
      setFormData({
        nickname: profile.nickname || '',
        avatar: profile.avatar || '',
        email: profile.email || '',
        realName: profile.realName || '',
        address: profile.address || '',
      });
    } catch (err) {
      showErrorToast(err, '加载失败');
    }
  };

  const handleChooseAvatar = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      if (!res.tempFilePaths || res.tempFilePaths.length === 0) {
        return;
      }

      setUploading(true);
      const filePath = res.tempFilePaths[0];

      // 上传头像
      const uploadRes = await uploadFile(filePath, 'avatar');
      setFormData({ ...formData, avatar: uploadRes.url });
      Toast.show({ content: '头像上传成功', icon: 'success' });
    } catch (err) {
      showErrorToast(err, '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.nickname.trim()) {
      Toast.show({ content: '请输入昵称', icon: 'fail' });
      return;
    }

    setLoading(true);
    try {
      const updateData: UpdateProfileDTO = {
        nickname: formData.nickname,
        avatar: formData.avatar,
        email: formData.email,
        realName: formData.realName,
        address: formData.address,
      };

      const updatedProfile = await updateUserProfile(updateData);

      // 更新 auth store 中的用户信息
      if (auth.user) {
        auth.setUser({
          ...auth.user,
          nickname: updatedProfile.nickname,
          avatar: updatedProfile.avatar,
        });
      }

      Toast.show({ content: '保存成功', icon: 'success' });
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (err) {
      showErrorToast(err, '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page">
      <View className="m-md">
        {/* 头像 */}
        <Cell
          title="头像"
          extra={
            <View onClick={handleChooseAvatar} style={{ position: 'relative' }}>
              {formData.avatar ? (
                <Avatar size="large" src={formData.avatar} />
              ) : (
                <Avatar size="large" icon={<User />} />
              )}
              {uploading && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ color: '#fff', fontSize: '24rpx' }}>上传中...</View>
                </View>
              )}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '48rpx',
                  height: '48rpx',
                  borderRadius: '24rpx',
                  backgroundColor: '#D4AF37',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Photograph size="16" color="#fff" />
              </View>
            </View>
          }
        />

        {/* 表单 */}
        <Form style={{ marginTop: '32rpx' }}>
          <Form.Item label="昵称" required>
            <Input
              placeholder="请输入昵称"
              value={formData.nickname}
              onChange={(val) => setFormData({ ...formData, nickname: val })}
              maxLength={20}
            />
          </Form.Item>

          <Form.Item label="真实姓名">
            <Input
              placeholder="请输入真实姓名"
              value={formData.realName}
              onChange={(val) => setFormData({ ...formData, realName: val })}
              maxLength={20}
            />
          </Form.Item>

          <Form.Item label="邮箱">
            <Input
              placeholder="请输入邮箱"
              type="email"
              value={formData.email}
              onChange={(val) => setFormData({ ...formData, email: val })}
            />
          </Form.Item>

          <Form.Item label="地址">
            <Input
              placeholder="请输入地址"
              value={formData.address}
              onChange={(val) => setFormData({ ...formData, address: val })}
              maxLength={100}
            />
          </Form.Item>
        </Form>

        {/* 保存按钮 */}
        <View style={{ marginTop: '64rpx' }}>
          <Button
            type="primary"
            block
            loading={loading}
            onClick={handleSubmit}
          >
            保存
          </Button>
        </View>
      </View>
    </View>
  );
}
