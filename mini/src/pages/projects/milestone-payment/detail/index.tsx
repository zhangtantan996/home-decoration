import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { AtButton, AtModal, AtModalHeader, AtModalContent, AtModalAction } from 'taro-ui'
import request from '@/utils/request'
import './index.scss'

interface Milestone {
  id: number
  name: string
  seq: number
  amount: number
  percentage: number
  status: number
  criteria: string
  paidAt: string | null
  releasedAt: string | null
  submittedAt: string | null
  acceptedAt: string | null
}

export default function MilestonePaymentDetail() {
  const router = useRouter()
  const { projectId, milestoneId } = router.params
  const [loading, setLoading] = useState(true)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadMilestoneDetail()
  }, [milestoneId])

  const loadMilestoneDetail = async () => {
    try {
      setLoading(true)
      const res = await request.get(`/projects/${projectId}/milestone-payments`)
      const milestones = res.data.milestones || []
      const found = milestones.find((m: Milestone) => m.id === Number(milestoneId))
      setMilestone(found || null)
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async () => {
    try {
      setProcessing(true)
      await request.post(`/milestones/${milestoneId}/pay?projectId=${projectId}`, {
        paymentType: 'wechat'
      })
      Taro.showToast({
        title: '支付成功',
        icon: 'success'
      })
      setShowPayModal(false)
      loadMilestoneDetail()
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '支付失败',
        icon: 'none'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleRelease = async () => {
    try {
      setProcessing(true)
      await request.post(`/milestones/${milestoneId}/release-payment?projectId=${projectId}`)
      Taro.showToast({
        title: '放款成功',
        icon: 'success'
      })
      setShowReleaseModal(false)
      loadMilestoneDetail()
    } catch (error: any) {
      Taro.showToast({
        title: error.message || '放款失败',
        icon: 'none'
      })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <View className="milestone-payment-detail loading">
        <Text>加载中...</Text>
      </View>
    )
  }

  if (!milestone) {
    return (
      <View className="milestone-payment-detail empty">
        <Text>节点不存在</Text>
      </View>
    )
  }

  const canPay = milestone.status === 0
  const canRelease = milestone.status === 1 && milestone.paidAt && !milestone.releasedAt

  return (
    <View className="milestone-payment-detail">
      <View className="header">
        <Text className="title">{milestone.name}</Text>
        <Text className="amount">¥{milestone.amount.toFixed(2)}</Text>
      </View>

      <View className="info-card">
        <View className="info-row">
          <Text className="label">节点顺序</Text>
          <Text className="value">第 {milestone.seq} 节点</Text>
        </View>
        <View className="info-row">
          <Text className="label">付款比例</Text>
          <Text className="value">{milestone.percentage}%</Text>
        </View>
        <View className="info-row">
          <Text className="label">验收标准</Text>
          <Text className="value criteria">{milestone.criteria}</Text>
        </View>
      </View>

      <View className="status-card">
        <Text className="card-title">付款状态</Text>
        <View className="timeline">
          <View className={`timeline-item ${milestone.paidAt ? 'completed' : 'pending'}`}>
            <View className="timeline-dot" />
            <View className="timeline-content">
              <Text className="timeline-title">支付节点款项</Text>
              {milestone.paidAt && (
                <Text className="timeline-time">
                  {new Date(milestone.paidAt).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
          <View className={`timeline-item ${milestone.acceptedAt ? 'completed' : 'pending'}`}>
            <View className="timeline-dot" />
            <View className="timeline-content">
              <Text className="timeline-title">节点验收通过</Text>
              {milestone.acceptedAt && (
                <Text className="timeline-time">
                  {new Date(milestone.acceptedAt).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
          <View className={`timeline-item ${milestone.releasedAt ? 'completed' : 'pending'}`}>
            <View className="timeline-dot" />
            <View className="timeline-content">
              <Text className="timeline-title">平台放款给商家</Text>
              {milestone.releasedAt && (
                <Text className="timeline-time">
                  {new Date(milestone.releasedAt).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <View className="actions">
        {canPay && (
          <AtButton type="primary" onClick={() => setShowPayModal(true)}>
            支付节点款项
          </AtButton>
        )}
        {canRelease && (
          <AtButton type="primary" onClick={() => setShowReleaseModal(true)}>
            确认完成并放款
          </AtButton>
        )}
      </View>

      <AtModal isOpened={showPayModal}>
        <AtModalHeader>确认支付</AtModalHeader>
        <AtModalContent>
          <Text>确认支付 ¥{milestone.amount.toFixed(2)} 到托管账户？</Text>
        </AtModalContent>
        <AtModalAction>
          <button onClick={() => setShowPayModal(false)}>取消</button>
          <button onClick={handlePay} disabled={processing}>
            {processing ? '处理中...' : '确认'}
          </button>
        </AtModalAction>
      </AtModal>

      <AtModal isOpened={showReleaseModal}>
        <AtModalHeader>确认放款</AtModalHeader>
        <AtModalContent>
          <Text>确认节点已完成验收，平台将放款 ¥{milestone.amount.toFixed(2)} 给商家</Text>
        </AtModalContent>
        <AtModalAction>
          <button onClick={() => setShowReleaseModal(false)}>取消</button>
          <button onClick={handleRelease} disabled={processing}>
            {processing ? '处理中...' : '确认'}
          </button>
        </AtModalAction>
      </AtModal>
    </View>
  )
}
