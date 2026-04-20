import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { AtButton, AtProgress } from 'taro-ui'
import request from '@/utils/request'
import './index.scss'

interface Milestone {
  id: number
  name: string
  seq: number
  amount: number
  percentage: number
  status: number
  paidAt: string | null
  releasedAt: string | null
}

interface PaymentStatus {
  projectId: number
  projectName: string
  totalAmount: number
  paidAmount: number
  releasedAmount: number
  milestoneCount: number
  paidCount: number
  releasedCount: number
  milestones: Milestone[]
  constructionQuote: number
}

export default function MilestonePaymentList() {
  const router = useRouter()
  const { projectId } = router.params
  const [loading, setLoading] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)

  useEffect(() => {
    loadPaymentStatus()
  }, [projectId])

  const loadPaymentStatus = async () => {
    try {
      setLoading(true)
      const res = await request.get(`/projects/${projectId}/milestone-payments`)
      setPaymentStatus(res.data)
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (milestone: Milestone) => {
    if (milestone.releasedAt) return '已放款'
    if (milestone.paidAt) return '已支付'
    return '待支付'
  }

  const getStatusClass = (milestone: Milestone) => {
    if (milestone.releasedAt) return 'status-released'
    if (milestone.paidAt) return 'status-paid'
    return 'status-pending'
  }

  const handleMilestoneClick = (milestone: Milestone) => {
    Taro.navigateTo({
      url: `/pages/projects/milestone-payment/detail/index?projectId=${projectId}&milestoneId=${milestone.id}`
    })
  }

  if (loading) {
    return (
      <View className="milestone-payment-list loading">
        <Text>加载中...</Text>
      </View>
    )
  }

  if (!paymentStatus) {
    return (
      <View className="milestone-payment-list empty">
        <Text>暂无数据</Text>
      </View>
    )
  }

  const paymentProgress = paymentStatus.totalAmount > 0
    ? (paymentStatus.paidAmount / paymentStatus.totalAmount) * 100
    : 0

  return (
    <View className="milestone-payment-list">
      <View className="header">
        <Text className="title">{paymentStatus.projectName}</Text>
        <Text className="subtitle">节点付款管理</Text>
      </View>

      <View className="summary-card">
        <View className="summary-row">
          <Text className="label">施工总价</Text>
          <Text className="value">¥{paymentStatus.constructionQuote.toFixed(2)}</Text>
        </View>
        <View className="summary-row">
          <Text className="label">已支付</Text>
          <Text className="value paid">¥{paymentStatus.paidAmount.toFixed(2)}</Text>
        </View>
        <View className="summary-row">
          <Text className="label">已放款</Text>
          <Text className="value released">¥{paymentStatus.releasedAmount.toFixed(2)}</Text>
        </View>
        <View className="progress-section">
          <Text className="progress-label">支付进度</Text>
          <AtProgress percent={paymentProgress} strokeWidth={8} />
          <Text className="progress-text">
            {paymentStatus.paidCount}/{paymentStatus.milestoneCount} 个节点已支付
          </Text>
        </View>
      </View>

      <View className="milestone-list">
        {paymentStatus.milestones.map((milestone) => (
          <View
            key={milestone.id}
            className="milestone-item"
            onClick={() => handleMilestoneClick(milestone)}
          >
            <View className="milestone-header">
              <View className="milestone-title">
                <Text className="name">{milestone.name}</Text>
                <Text className={`status ${getStatusClass(milestone)}`}>
                  {getStatusText(milestone)}
                </Text>
              </View>
              <Text className="amount">¥{milestone.amount.toFixed(2)}</Text>
            </View>
            <View className="milestone-info">
              <Text className="percentage">{milestone.percentage}%</Text>
              {milestone.paidAt && (
                <Text className="date">支付时间: {new Date(milestone.paidAt).toLocaleDateString()}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
