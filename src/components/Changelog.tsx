import { X, Clock, Tag, CheckCircle } from 'lucide-react';

interface ChangelogProps {
  onClose: () => void;
}

interface ChangeItem {
  date: string;
  version: string;
  title: string;
  changes: string[];
}

const changelogData: ChangeItem[] = [
  {
    date: '2026-07-25',
    version: 'v1.3',
    title: '编辑功能与可视化升级',
    changes: [
      '新增：发送后的记录可以继续编辑，修改内容、重新分类',
      '新增：支持修改优先级（紧急/重要/一般/次要）',
      '新增：支持修改状态（草稿/未完成/进行中/已完成/已归档）',
      '新增：四象限矩阵视图，按优先级直观展示任务分布',
      '新增：日历热力图视图，展示每日任务密度和月度统计',
      '新增：三种视图模式切换（列表/四象限/热力图）',
      '新增：状态标签显示，在列表和四象限中展示任务状态',
      '优化：编辑按钮集成到每条记录的右下角',
      '优化：底部文案更新为"支持编辑和重新分类"',
    ],
  },
  {
    date: '2026-07-23',
    version: 'v1.0',
    title: '心光正式发布',
    changes: [
      '项目命名为「心光」，版本号从 v1.0 开始',
      '支持坚果云 files.md 笔记同步',
      '快速记录功能：收集、待办、想法、日记、笔记分类',
      '自动添加时间戳（如：16:30 开会）',
      '时间周期汇总：日、周、月、季度、半年、年',
      '统计概览：总记录数、已完成待办、类型分布',
      '分类自定义管理：支持添加/删除分类，选择图标和颜色',
      '帮助页面：使用说明、隐私说明',
      '修复 localStorage 缓存导致的数据不一致问题',
      '修复 Service Worker 拦截坚果云请求的问题',
      '修复分类图标显示问题',
    ],
  },
];

export function Changelog({ onClose }: ChangelogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">更新日志</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {changelogData.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg">
                  {item.version}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {item.date}
                </span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
              <ul className="space-y-2">
                {item.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
            更新日志从「心光」命名后开始记录
          </div>
        </div>
      </div>
    </div>
  );
}
