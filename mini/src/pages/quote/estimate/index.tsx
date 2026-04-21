import React, { useState } from "react";
import { Button, Input, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import MiniPageNav from "@/components/MiniPageNav";
import { showErrorToast } from "@/utils/error";
import {
  isResidentialAreaValid,
  normalizeResidentialAreaInput,
  RESIDENTIAL_AREA_MAX,
  RESIDENTIAL_AREA_MIN,
} from "@/utils/residentialArea";
import { request } from "@/utils/request";

import "./index.scss";

const STYLE_OPTIONS = [
  "现代简约",
  "北欧",
  "中式",
  "轻奢",
  "日式",
  "美式",
];

const REGION_OPTIONS = ["一线城市", "二线城市", "三线城市"];

interface MaterialBudgetItem {
  category: string;
  budget: number;
}

interface RiskItem {
  item: string;
  description: string;
}

interface QuoteEstimateResult {
  halfPackMin: number;
  halfPackMax: number;
  fullPackMin: number;
  fullPackMax: number;
  duration: number;
  materials: MaterialBudgetItem[];
  riskItems: RiskItem[];
}

const QuoteEstimatePage: React.FC = () => {
  const [area, setArea] = useState("");
  const [styleIndex, setStyleIndex] = useState(0);
  const [regionIndex, setRegionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteEstimateResult | null>(null);

  const handleStyleChange = (e: any) => {
    setStyleIndex(Number(e.detail.value));
  };

  const handleRegionChange = (e: any) => {
    setRegionIndex(Number(e.detail.value));
  };

  const handleAreaInput = (e: any) => {
    const nextArea = normalizeResidentialAreaInput(String(e.detail.value || ""));
    if (!nextArea.value) {
      setArea("");
      return;
    }
    setArea(nextArea.value);
  };

  const handleGenerateQuote = async () => {
    // 输入校验
    const areaNum = parseFloat(area);
    if (!area || isNaN(areaNum) || !isResidentialAreaValid(areaNum)) {
      showErrorToast(`请输入有效的房屋面积（${RESIDENTIAL_AREA_MIN}-${RESIDENTIAL_AREA_MAX}㎡）`);
      return;
    }

    setLoading(true);
    try {
      const response = await request<QuoteEstimateResult>({
        url: "/quote-estimate",
        method: "POST",
        data: {
          area: areaNum,
          style: STYLE_OPTIONS[styleIndex],
          region: REGION_OPTIONS[regionIndex],
        },
      });

      setResult(response);
      Taro.showToast({
        title: "报价生成成功",
        icon: "success",
        duration: 1500,
      });
    } catch (error: any) {
      showErrorToast(error.message || "生成报价失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = () => {
    Taro.navigateTo({
      url: "/pages/booking/create/index",
    });
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  const formatPrice = (price: number) => {
    return (price / 10000).toFixed(1);
  };

  return (
    <View className="quote-estimate-page">
      <MiniPageNav title="智能报价" onBack={handleBack} />

      <View className="form-section">
        <View className="form-title">填写装修信息</View>

        <View className="form-item">
          <Text className="form-label">房屋面积</Text>
          <Input
            className="form-input"
            type="digit"
            placeholder="请输入房屋面积"
            value={area}
            onInput={handleAreaInput}
          />
          <Text className="form-unit">㎡</Text>
        </View>

        <View className="form-item">
          <Text className="form-label">装修风格</Text>
          <Picker
            mode="selector"
            range={STYLE_OPTIONS}
            value={styleIndex}
            onChange={handleStyleChange}
          >
            <View className="form-picker">
              <Text>{STYLE_OPTIONS[styleIndex]}</Text>
            </View>
          </Picker>
        </View>

        <View className="form-item">
          <Text className="form-label">所在区域</Text>
          <Picker
            mode="selector"
            range={REGION_OPTIONS}
            value={regionIndex}
            onChange={handleRegionChange}
          >
            <View className="form-picker">
              <Text>{REGION_OPTIONS[regionIndex]}</Text>
            </View>
          </Picker>
        </View>

        <Button
          className="generate-btn"
          onClick={handleGenerateQuote}
          loading={loading}
          disabled={loading}
        >
          生成报价
        </Button>
      </View>

      {result && (
        <View className="result-section">
          <View className="result-title">报价结果</View>

          <View className="price-cards">
            <View className="price-card">
              <Text className="price-card-title">半包报价</Text>
              <View className="price-range">
                <Text className="price-value">
                  {formatPrice(result.halfPackMin)}
                </Text>
                <Text className="price-separator">-</Text>
                <Text className="price-value">
                  {formatPrice(result.halfPackMax)}
                </Text>
                <Text className="price-unit">万元</Text>
              </View>
              <Text className="price-desc">包工包辅料，主材自购</Text>
            </View>

            <View className="price-card">
              <Text className="price-card-title">全包报价</Text>
              <View className="price-range">
                <Text className="price-value">
                  {formatPrice(result.fullPackMin)}
                </Text>
                <Text className="price-separator">-</Text>
                <Text className="price-value">
                  {formatPrice(result.fullPackMax)}
                </Text>
                <Text className="price-unit">万元</Text>
              </View>
              <Text className="price-desc">包工包料，省心省力</Text>
            </View>
          </View>

          <View className="duration-card">
            <Text className="duration-label">预计工期</Text>
            <Text className="duration-value">{result.duration}</Text>
            <Text className="duration-unit">天</Text>
          </View>

          {result.materials && result.materials.length > 0 && (
            <View className="materials-section">
              <View className="section-title">材料预算明细</View>
              {result.materials.map((item, index) => (
                <View key={index} className="material-item">
                  <Text className="material-category">{item.category}</Text>
                  <Text className="material-budget">
                    ¥{item.budget.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {result.riskItems && result.riskItems.length > 0 && (
            <View className="risk-section">
              <View className="section-title">风险项提醒</View>
              {result.riskItems.map((item, index) => (
                <View key={index} className="risk-item">
                  <Text className="risk-item-title">{item.item}</Text>
                  <Text className="risk-item-desc">{item.description}</Text>
                </View>
              ))}
            </View>
          )}

          <View className="disclaimer">
            <Text className="disclaimer-text">
              * 以上报价为系统估算，实际价格以量房后的详细报价为准
            </Text>
          </View>
        </View>
      )}

      {result && (
        <View className="bottom-action">
          <Button className="booking-btn" onClick={handleBooking}>
            立即预约
          </Button>
        </View>
      )}
    </View>
  );
};

export default QuoteEstimatePage;
