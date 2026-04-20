import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Tag, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../../services/api';

interface ProjectClosureApplication {
  id: number;
  projectId: number;
  projectName: string;
  closureType: 'normal' | 'abnormal';
  reason: string;
  status: string;
  createdAt: string;
  user: {
    id: number;
    nickname: string;
    phone: string;
  };
  provider: {
    id: number;
    companyName: string;
  };
}

const ProjectClosureReview: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<ProjectClosureApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ProjectClosureApplication | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/project-audits', {
        params: {
          page,
          pageSize,
          status: 'pending',
        },
      });
      const filteredData = response.data.list.filter(
        (item: any) => item.auditType === 'close'
      );
      setDataSource(filteredData);
      setTotal(filteredData.length);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const handleApprove = (record: ProjectClosureApplication) => {
    setCurrentRecord(record);
    setModalVisible(true);
  };

  const handleReject = async (record: ProjectClosureApplication) => {
    Modal.confirm({
      title: '确认拒绝关闭申请',
      content: '拒绝后项目将继续进行，是否确认？',
      onOk: async () => {
        try {
          await api.post(`/admin/projects/${record.projectId}/close`, {
            closureType: 'rejected',
            reason: '管理员拒绝关闭申请',
          });
          message.success('已拒绝关闭申请');
          fetchData();
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (!currentRecord) return;

      await api.post(`/admin/projects/${currentRecord.projectId}/close`, {
        closureType: currentRecord.closureType,
        reason: values.reason || currentRecord.reason,
      });

      message.success('项目已关闭');
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns: ColumnsType<ProjectClosureApplication> = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
    },
    {
      title: '客户',
      key: 'user',
      render: (_, record) => (
        <div>
          <div>{record.user?.nickname}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.user?.phone}</div>
        </div>
      ),
    },
    {
      title: '商家',
      dataIndex: ['provider', 'companyName'],
      key: 'provider',
    },
    {
      title: '关闭类型',
      dataIndex: 'closureType',
      key: 'closureType',
      render: (type: string) => (
        <Tag color={type === 'normal' ? 'green' : 'red'}>
          {type === 'normal' ? '正常关闭' : '异常关闭'}
        </Tag>
      ),
    },
    {
      title: '关闭原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" onClick={() => handleApprove(record)}>
            批准关闭
          </Button>
          <Button size="small" onClick={() => handleReject(record)}>
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>项目关闭审核</h2>
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize || 20);
          },
        }}
      />

      <Modal
        title="确认关闭项目"
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="项目名称">
            <Input value={currentRecord?.projectName} disabled />
          </Form.Item>
          <Form.Item label="关闭类型">
            <Tag color={currentRecord?.closureType === 'normal' ? 'green' : 'red'}>
              {currentRecord?.closureType === 'normal' ? '正常关闭' : '异常关闭'}
            </Tag>
          </Form.Item>
          <Form.Item label="原因">
            <Input.TextArea value={currentRecord?.reason} disabled rows={4} />
          </Form.Item>
          <Form.Item
            label="补充说明（可选）"
            name="reason"
          >
            <Input.TextArea rows={3} placeholder="可补充关闭说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectClosureReview;




