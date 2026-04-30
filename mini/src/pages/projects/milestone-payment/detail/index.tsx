import { View, Text, Button } from '@tarojs/components'
import { useCallback, useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '@/utils/request'
import { getErrorMessage } from '@/utils/error'
import { isRealNameRequiredError, navigateToRealNameVerification } from '@/utils/realNameVerification'
import { miniPaymentAdapter } from '@/adapters/payment'
import { getPaymentStatus } from '@/services/payments'
import { startOrderCenterEntryPayment } from '@/services/orderCenter'
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

interface PaymentPlan {
  id: number
  milestoneId?: number
  payable?: boolean
  status?: string | number
}

interface MilestonePaymentStatus {
  milestones: Milestone[]
  paymentPlans?: PaymentPlan[]
  constructionOrderEntryKey?: string
}

export default function MilestonePaymentDetail() {
  const router = useRouter()
  const { projectId, milestoneId } = router.params
  const [loading, setLoading] = useState(true)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [processing, setProcessing] = useState(false)
  const [constructionOrderEntryKey, setConstructionOrderEntryKey] = useState('')
  const [nextPayablePlan, setNextPayablePlan] = useState<PaymentPlan | null>(null)

  const loadMilestoneDetail = useCallback(async () => {
    try {
      setLoading(true)
      const res = await request<MilestonePaymentStatus>({
        url: `/projects/${projectId}/milestone-payments`
      })
      const milestones = res.milestones || []
      const found = milestones.find((m: Milestone) => m.id === Number(milestoneId))
      setMilestone(found || null)
      setConstructionOrderEntryKey(res.constructionOrderEntryKey || '')
      const plans: PaymentPlan[] = res.paymentPlans || []
      setNextPayablePlan(plans.find((plan) => plan.payable) || null)
    } catch (error: any) {
      Taro.showToast({
        title: getErrorMessage(error, '加载失败'),
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, milestoneId])

  useEffect(() => {
    void loadMilestoneDetail()
  }, [loadMilestoneDetail])

  const handlePay = async () => {
    try {
      setProcessing(true)
      if (!constructionOrderEntryKey) {
        throw new Error('施工订单暂未生成，请稍后再试')
      }
      if (!nextPayablePlan || nextPayablePlan.milestoneId !== Number(milestoneId)) {
        throw new Error('请按施工付款计划顺序支付当前应付节点')
      }
      const launch = await startOrderCenterEntryPayment(constructionOrderEntryKey, {
        channel: 'wechat',
        terminalType: 'mini_wechat_jsapi'
      })
      if (launch.launchMode !== 'wechat_jsapi' || !launch.wechatPayParams) {
        throw new Error('当前节点暂不支持小程序微信支付')
      }
      await miniPaymentAdapter.requestPayment(launch.wechatPayParams)
      const backendStatus = await waitPaymentCompleted(launch.paymentId)
      Taro.showToast({
        title: backendStatus === 'paid' ? '支付已确认' : '支付结果确认中',
        icon: backendStatus === 'paid' ? 'success' : 'none'
      })
      await loadMilestoneDetail()
    } catch (error: any) {
      if (isRealNameRequiredError(error)) {
        Taro.showToast({ title: '支付前请先完成实名认证', icon: 'none' })
        navigateToRealNameVerification()
        return
      }
      Taro.showToast({
        title: getErrorMessage(error, '支付失败'),
        icon: 'none'
      })
    } finally {
      setProcessing(false)
    }
  }

  const confirmPay = async () => {
    if (!milestone) {
      return
    }
    const res = await Taro.showModal({
      title: '确认支付',
      content: `确认通过微信支付 ¥${milestone.amount.toFixed(2)}？支付结果以后端确认为准。`
    })
    if (res.confirm) {
      await handlePay()
    }
  }

  const waitPaymentCompleted = async (paymentId: number): Promise<'paid' | 'pending'> => {
    for (let i = 0; i < 8; i++) {
      const status = await getPaymentStatus(paymentId)
      if (status.status === 'paid') {
        return 'paid'
      }
      if (status.status === 'closed' || status.status === 'failed') {
        throw new Error('支付未完成，请重新发起')
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    return 'pending'
  }

  const handleRelease = async () => {
    try {
      setProcessing(true)
      await request({
        url: `/milestones/${milestoneId}/release-payment?projectId=${projectId}`,
        method: 'POST'
      })
      Taro.showToast({
        title: '已提交结算',
        icon: 'success'
      })
      await loadMilestoneDetail()
    } catch (error: any) {
      Taro.showToast({
        title: getErrorMessage(error, '结算提交失败'),
        icon: 'none'
      })
    } finally {
      setProcessing(false)
    }
  }

  const confirmRelease = async () => {
    const res = await Taro.showModal({
      title: '确认结算',
      content: '确认节点已完成验收？系统将生成结算记录并等待线下打款确认。'
    })
    if (res.confirm) {
      await handleRelease()
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

  const canPay = milestone.status === 0 && nextPayablePlan?.milestoneId === milestone.id
  const canRelease = milestone.status === 3 && milestone.acceptedAt && !milestone.releasedAt

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
              <Text className="timeline-title">线下打款确认</Text>
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
          <Button className="primary-action" onClick={confirmPay} disabled={processing}>
            支付节点款项
          </Button>
        )}
        {canRelease && (
          <Button className="primary-action" onClick={confirmRelease} disabled={processing}>
            确认验收并结算
          </Button>
        )}
      </View>
    </View>
  )
}
