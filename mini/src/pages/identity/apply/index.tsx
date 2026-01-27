import Taro from '@tarojs/taro';
import { View, Text, Picker } from '@tarojs/components';
import React, { useState } from 'react';

import { useIdentityStore } from '@/store/identity';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

import './index.scss';

const identityTypes = [
  { value: 'designer', label: '设计师' },
  { value: 'company', label: '装修公司' },
  { value: 'foreman', label: '工长' },
  { value: 'worker', label: '工人' }
];

export default function IdentityApply() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [documents, setDocuments] = useState<string[]>([]);
  const { applyIdentity, loading } = useIdentityStore();

  const handlePickerChange = (e: any) => {
    setSelectedIndex(e.detail.value);
  };

  const handleUploadDocument = async () => {
    try {
      const res = await Taro.chooseImage({
        count: 3,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      setDocuments([...documents, ...res.tempFilePaths]);
      Taro.showToast({ title: '图片已添加', icon: 'success' });
    } catch (err) {
      Taro.showToast({ title: '选择图片失败', icon: 'none' });
    }
  };

  const handleSubmit = async () => {
    const selectedType = identityTypes[selectedIndex].value;

    try {
      await applyIdentity(selectedType, documents);
      setTimeout(() => {
        Taro.navigateBack();
      }, 1500);
    } catch (err) {
      // Error already handled in store
    }
  };

  return (
    <View className="page identity-apply">
      <View className="m-md">
        <Card title="申请新身份" className="mb-lg">
          <View className="form-item">
            <Text className="form-label">身份类型</Text>
            <Picker mode="selector" range={identityTypes.map((t) => t.label)} value={selectedIndex} onChange={handlePickerChange}>
              <View className="picker-value">{identityTypes[selectedIndex].label}</View>
            </Picker>
          </View>

          <View className="form-item">
            <Text className="form-label">资质证明（可选）</Text>
            <View className="document-list">
              {documents.map((doc, index) => (
                <View key={index} className="document-item">
                  <Text className="text-secondary">文档 {index + 1}</Text>
                </View>
              ))}
              <Button onClick={handleUploadDocument} variant="outline" size="small">
                上传证明文件
              </Button>
            </View>
          </View>

          <View className="form-tips">
            <Text className="text-secondary">提交后将进入审核流程，审核通过后即可切换使用该身份</Text>
          </View>

          <Button onClick={handleSubmit} variant="primary" loading={loading} disabled={loading}>
            提交申请
          </Button>
        </Card>
      </View>
    </View>
  );
}
