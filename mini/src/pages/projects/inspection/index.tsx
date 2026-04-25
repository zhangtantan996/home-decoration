import { View, Text, Button, Checkbox, Textarea } from '@tarojs/components'
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { request } from '@/utils/request'
import { getErrorMessage } from '@/utils/error'
import './index.scss'

interface InspectionItem {
  name: string
  description: string
  required: boolean
  passed: boolean
  note: string
}

interface Milestone {
  id: number
  name: string
  status: number
  amount: number
  seq: number
  submittedAt?: string
  acceptedAt?: string
}

interface InspectionChecklist {
  id: number
  status: string
  inspectionNotes?: string
  rectificationNotes?: string
  resubmitCount: number
  itemsList: InspectionItem[]
}

interface ApiDataResponse<T> {
  data?: T
}

export default function InspectionPage() {
  const [projectId, setProjectId] = useState<number>(0)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [inspectionMode, setInspectionMode] = useState<'staged' | 'all'>('staged')
  const [currentMilestoneId, setCurrentMilestoneId] = useState<number>(0)
  const [checklistItems, setChecklistItems] = useState<InspectionItem[]>([])
  const [checklist, setChecklist] = useState<InspectionChecklist | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRectificationInput, setShowRectificationInput] = useState(false)

  const loadTemplate = useCallback(async (category: string) => {
    try {
      const res = await request<ApiDataResponse<InspectionChecklist>>({
        url: `/projects/inspection-template?category=${category}`,
        method: 'GET',
      })
      if (res.data && res.data.itemsList) {
        setChecklistItems(res.data.itemsList)
      }
    } catch (error) {
      console.error('加载模板失败', error)
    }
  }, [])

  const loadChecklist = useCallback(async (
    projectId: number,
    milestoneId: number,
    milestoneList: Milestone[],
  ) => {
    try {
      const res = await request<ApiDataResponse<InspectionChecklist>>({
        url: `/projects/${projectId}/inspections?milestoneId=${milestoneId}`,
        method: 'GET',
      })
      if (res.data && res.data.itemsList) {
        setChecklist(res.data)
        setChecklistItems(res.data.itemsList)
      } else {
        // 加载默认模板
        const milestone = milestoneList.find(m => m.id === milestoneId)
        if (milestone) {
          await loadTemplate(milestone.name)
        }
      }
    } catch (error) {
      // 如果没有验收清单，加载默认模板
      const milestone = milestoneList.find(m => m.id === milestoneId)
      if (milestone) {
        await loadTemplate(milestone.name)
      }
    }
  }, [loadTemplate])

  const loadMilestones = useCallback(async (projectId: number) => {
    try {
      const res = await request<ApiDataResponse<Milestone[]>>({
        url: `/projects/${projectId}/milestones`,
        method: 'GET',
      })
      const nextMilestones = res.data || []
      setMilestones(nextMilestones)
      if (nextMilestones.length > 0) {
        const firstMilestone = nextMilestones[0]
        setCurrentMilestoneId(firstMilestone.id)
        await loadChecklist(projectId, firstMilestone.id, nextMilestones)
      }
    } catch (error) {
      Taro.showToast({
        title: '加载失败',
        icon: 'none',
      })
    }
  }, [loadChecklist])

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.projectId) {
      const nextProjectId = Number(params.projectId)
      setProjectId(nextProjectId)
      void loadMilestones(nextProjectId)
    }
  }, [loadMilestones])

  const handleItemCheck = (index: number, checked: boolean) => {
    const newItems = [...checklistItems]
    newItems[index].passed = checked
    setChecklistItems(newItems)
  }

  const handleNoteChange = (index: number, note: string) => {
    const newItems = [...checklistItems]
    newItems[index].note = note
    setChecklistItems(newItems)
  }

  const handleSubmit = async () => {
    // 检查必填项是否全部通过
    const allRequiredPassed = checklistItems.every(
      item => !item.required || item.passed
    )

    if (inspectionMode === 'staged') {
      // 按阶段验收
      if (showRectificationInput && !notes.trim()) {
        Taro.showToast({
          title: '请填写整改要求',
          icon: 'none',
        })
        return
      }

      setLoading(true)
      try {
        if (allRequiredPassed) {
          // 验收通过
          await request({
            url: `/milestones/${currentMilestoneId}/inspect`,
            method: 'POST',
            data: {
              passed: true,
              notes,
            },
          })
          Taro.showToast({
            title: '验收通过，款项已放款',
            icon: 'success',
          })
        } else {
          // 验收不通过，要求整改
          await request({
            url: `/milestones/${currentMilestoneId}/request-rectification`,
            method: 'POST',
            data: {
              notes,
            },
          })
          Taro.showToast({
            title: '整改要求已发送',
            icon: 'success',
          })
        }

        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } catch (error: any) {
        Taro.showToast({
          title: getErrorMessage(error, '操作失败'),
          icon: 'none',
        })
      } finally {
        setLoading(false)
      }
    } else {
      // 整体验收一次性放款
      if (!allRequiredPassed) {
        Taro.showModal({
          title: '提示',
          content: '整体验收要求所有阶段都已完成，请确认',
          showCancel: false,
        })
        return
      }

      setLoading(true)
      try {
        await request({
          url: `/projects/${projectId}/accept-all-milestones`,
          method: 'POST',
        })
        Taro.showToast({
          title: '整体验收成功，款项已全部放款',
          icon: 'success',
        })

        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } catch (error: any) {
        Taro.showToast({
          title: getErrorMessage(error, '验收失败'),
          icon: 'none',
        })
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <View className="inspection-page">
      <View className="mode-switch">
        <View
          className={`mode-item ${inspectionMode === 'staged' ? 'active' : ''}`}
          onClick={() => setInspectionMode('staged')}
        >
          按阶段验收
        </View>
        <View
          className={`mode-item ${inspectionMode === 'all' ? 'active' : ''}`}
          onClick={() => setInspectionMode('all')}
        >
          整体验收
        </View>
      </View>

      {inspectionMode === 'staged' && (
        <View className="milestone-tabs">
          {milestones.map(milestone => (
            <View
              key={milestone.id}
              className={`milestone-tab ${
                currentMilestoneId === milestone.id ? 'active' : ''
              }`}
              onClick={() => {
                setCurrentMilestoneId(milestone.id)
                void loadChecklist(projectId, milestone.id, milestones)
              }}
            >
              {milestone.name}
            </View>
          ))}
        </View>
      )}

      <View className="checklist">
        <View className="checklist-header">
          <Text className="title">验收清单</Text>
          <Text className="subtitle">
            {inspectionMode === 'staged'
              ? '请逐项检查施工质量'
              : '整体验收将一次性验收所有阶段并放款'}
          </Text>
        </View>

        {checklist && checklist.status === 'resubmitted' && (
          <View className="resubmit-notice">
            <Text className="notice-title">商家已整改并重新提交</Text>
            <Text className="notice-content">整改说明：{checklist.rectificationNotes}</Text>
            <Text className="notice-count">重新提交次数：{checklist.resubmitCount}</Text>
          </View>
        )}

        {checklist && checklist.status === 'failed' && (
          <View className="failed-notice">
            <Text className="notice-title">上次验收不通过</Text>
            <Text className="notice-content">整改要求：{checklist.inspectionNotes}</Text>
          </View>
        )}

        {inspectionMode === 'staged' ? (
          <View className="checklist-items">
            {checklistItems.map((item, index) => (
              <View key={index} className="checklist-item">
                <View className="item-header">
                  <Checkbox
                    value={`inspection-${index}`}
                    checked={item.passed}
                    onChange={e => handleItemCheck(index, e.detail.value.length > 0)}
                  />
                  <Text className="item-name">
                    {item.name}
                    {item.required && <Text className="required">*</Text>}
                  </Text>
                </View>
                <Text className="item-desc">{item.description}</Text>
                <Textarea
                  className="item-note"
                  placeholder="备注（选填）"
                  value={item.note}
                  onInput={e => handleNoteChange(index, e.detail.value)}
                />
              </View>
            ))}

            <View className="inspection-actions">
              <View className="action-item">
                <Checkbox
                  value="rectification"
                  checked={showRectificationInput}
                  onChange={e => setShowRectificationInput(e.detail.value.length > 0)}
                />
                <Text>验收不通过，要求整改</Text>
              </View>
            </View>

            {showRectificationInput && (
              <View className="rectification-input">
                <Text className="input-label">整改要求（必填）</Text>
                <Textarea
                  className="input-textarea"
                  placeholder="请详细说明需要整改的内容"
                  value={notes}
                  onInput={e => setNotes(e.detail.value)}
                />
              </View>
            )}
          </View>
        ) : (
          <View className="all-inspection-info">
            <View className="info-item">
              <Text className="label">验收阶段：</Text>
              <Text className="value">全部阶段</Text>
            </View>
            <View className="info-item">
              <Text className="label">验收方式：</Text>
              <Text className="value">一次性验收并放款</Text>
            </View>
            <View className="info-item">
              <Text className="label">总金额：</Text>
              <Text className="value amount">
                ¥{milestones.reduce((sum, m) => sum + m.amount, 0).toFixed(2)}
              </Text>
            </View>
            <View className="warning">
              <Text>
                提示：整体验收将一次性验收所有施工阶段，并立即放款给施工方。请确保所有施工内容已完成并符合要求。
              </Text>
            </View>
          </View>
        )}

        {inspectionMode === 'staged' && !showRectificationInput && (
          <View className="notes-section">
            <Text className="notes-label">验收备注</Text>
            <Textarea
              className="notes-input"
              placeholder="请输入验收备注（选填）"
              value={notes}
              onInput={e => setNotes(e.detail.value)}
            />
          </View>
        )}
      </View>

      <View className="submit-section">
        <Button
          className="submit-btn"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          {inspectionMode === 'staged'
            ? (showRectificationInput ? '提交整改要求' : '提交验收')
            : '确认整体验收并放款'}
        </Button>
        {inspectionMode === 'staged' && (
          <Button
            className="history-btn"
            onClick={() => {
              Taro.navigateTo({
                url: `/pages/projects/inspection/history/index?projectId=${projectId}&milestoneId=${currentMilestoneId}`,
              })
            }}
          >
            查看验收历史
          </Button>
        )}
      </View>
    </View>
  )
}
