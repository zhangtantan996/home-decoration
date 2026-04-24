import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, message, Modal, Descriptions, Timeline, Statistic, Row, Col } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import api from '../../services/api'

interface Milestone {
  id: number
  projectId: number
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

interface Project {
  id: number
  title: string
  constructionQuote: number
}

interface MilestoneWithProject extends Milestone {
  project: Project
}

export default function MerchantMilestonePayments() {
  const [loading, setLoading] = useState(false)
  const [milestones, setMilestones] = useState<MilestoneWithProject[]>([])
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneWithProject | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)

  useEffect(() => {
    loadMilestones()
  }, [])

  const loadMilestones = async () => {
    try {
      setLoading(true)
      // 获取商家的所有项目
      const projectsRes = await api.get('/merchant/projects')
      const projects = projectsRes.data.projects || []

      // 获取每个项目的节点付款信息
      const allMilestones: MilestoneWithProject[] = []
      for (const project of projects) {
        try {
          const res = await api.get(`/projects/${project.id}/milestone-payments`)
          const projectMilestones = res.data.milestones || []
          projectMilestones.forEach((m: Milestone) => {
            allMilestones.push({
              ...m,
              project: {
                id: project.id,
                title: project.title,
                constructionQuote: res.data.constructionQuote
              }
            })
          })
        } catch (error) {
          console.error(`Failed to load milestones for project ${project.id}`, error)
        }
      }

      setMilestones(allMilestones)
    } catch (error: any) {
      message.error(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (milestone: Milestone) => {
    if (milestone.releasedAt) {
      return <Tag color="success">已收款</Tag>
    }
    if (milestone.paidAt) {
      return <Tag color="processing">待放款</Tag>
    }
    return <Tag color="default">待支付</Tag>
  }

  const handleViewDetail = (milestone: MilestoneWithProject) => {
    setSelectedMilestone(milestone)
    setDetailVisible(true)
  }

  const columns = [
    {
      title: '项目名称',
      dataIndex: ['project', 'title'],
      key: 'projectTitle',
      width: 200,
    },
    {
      title: '节点名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '节点顺序',
      dataIndex: 'seq',
      key: 'seq',
      width: 100,
      render: (seq: number) => `第${seq}节点`,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '比例',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 80,
      render: (percentage: number) => `${percentage}%`,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: Milestone) => getStatusTag(record),
    },
    {
      title: '支付时间',
      dataIndex: 'paidAt',
      key: 'paidAt',
      width: 180,
      render: (paidAt: string | null) => paidAt ? new Date(paidAt).toLocaleString() : '-',
    },
    {
      title: '放款时间',
      dataIndex: 'releasedAt',
      key: 'releasedAt',
      width: 180,
      render: (releasedAt: string | null) => releasedAt ? new Date(releasedAt).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: MilestoneWithProject) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ]

  // 统计数据
  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0)
  const paidAmount = milestones.filter(m => m.paidAt).reduce((sum, m) => sum + m.amount, 0)
  const releasedAmount = milestones.filter(m => m.releasedAt).reduce((sum, m) => sum + m.amount, 0)
  const pendingAmount = paidAmount - releasedAmount

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: '24px' }}>节点收款管理</h2>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总金额"
              value={totalAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已支付"
              value={paidAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已收款"
              value={releasedAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待放款"
              value={pendingAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={milestones}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="节点详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedMilestone && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="项目名称" span={2}>
                {selectedMilestone.project.title}
              </Descriptions.Item>
              <Descriptions.Item label="节点名称">
                {selectedMilestone.name}
              </Descriptions.Item>
              <Descriptions.Item label="节点顺序">
                第{selectedMilestone.seq}节点
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                ¥{selectedMilestone.amount.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="比例">
                {selectedMilestone.percentage}%
              </Descriptions.Item>
              <Descriptions.Item label="验收标准" span={2}>
                {selectedMilestone.criteria}
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                {getStatusTag(selectedMilestone)}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: '24px' }}>
              <h4>付款时间线</h4>
              <Timeline style={{ marginTop: '16px' }}>
                <Timeline.Item
                  color={selectedMilestone.paidAt ? 'green' : 'gray'}
                  dot={selectedMilestone.paidAt ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                >
                  <p>业主支付节点款项</p>
                  {selectedMilestone.paidAt && (
                    <p style={{ color: '#999', fontSize: '12px' }}>
                      {new Date(selectedMilestone.paidAt).toLocaleString()}
                    </p>
                  )}
                </Timeline.Item>
                <Timeline.Item
                  color={selectedMilestone.acceptedAt ? 'green' : 'gray'}
                  dot={selectedMilestone.acceptedAt ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                >
                  <p>节点验收通过</p>
                  {selectedMilestone.acceptedAt && (
                    <p style={{ color: '#999', fontSize: '12px' }}>
                      {new Date(selectedMilestone.acceptedAt).toLocaleString()}
                    </p>
                  )}
                </Timeline.Item>
                <Timeline.Item
                  color={selectedMilestone.releasedAt ? 'green' : 'gray'}
                  dot={selectedMilestone.releasedAt ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                >
                  <p>平台放款到账</p>
                  {selectedMilestone.releasedAt && (
                    <p style={{ color: '#999', fontSize: '12px' }}>
                      {new Date(selectedMilestone.releasedAt).toLocaleString()}
                    </p>
                  )}
                </Timeline.Item>
              </Timeline>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
