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
    date: '2026-08-20',
    version: 'v2.2.4',
    title: '恢复码重置后云端备份自动升级双通道',
    changes: [
      '恢复码重置成功后，旧格式云端备份（仅恢复码通道）自动升级为双通道（恢复码+密码）',
      '此后清缓存/换设备凭加密密码即可直接恢复，无需再翻恢复码',
    ],
  },
  {
    date: '2026-08-20',
    version: 'v2.2.3',
    title: '强制重置与恢复码云端回退修复',
    changes: [
      '修复：强制重新设置原先未清除本地旧加密配置，保存时仍被要求输入旧密码，"生成全新密钥"从未生效',
      '修复：恢复码重置原先只查本地配置，本地为旧设置残留时正确恢复码也被拒；现自动回退云端备份',
      '修复：坚果云凭据被旧密钥加密不可读时，云端恢复流程先用表单凭据兜底保存',
    ],
  },
  {
    date: '2026-08-20',
    version: 'v2.2.2',
    title: '解锁死锁修复 + 历史迁移手动入口',
    changes: [
      '修复：本地登录哈希残留导致正确加密密码被拒的死锁（以主密钥解密为权威校验，残留哈希自动修复）',
      '修复：修改加密密码同样不再被残留哈希卡死',
      '新增：已启用加密用户的手动"加密云端历史明文文件"按钮（原先仅首次启用流程可触发）',
    ],
  },
  {
    date: '2026-08-20',
    version: 'v2.2.0',
    title: '加密可靠性 + 登录修复 + 安全增强',
    changes: [
      '历史文件迁移加密：一键加密云端已有明文笔记，含进度与统计',
      '加密设置失败自动回滚：中途失败恢复原状，不留半成品配置',
      '加密状态三态显示：已启用（会话解锁/未解锁）、云端已加密·本浏览器未解锁、未启用',
      '云端备份双通道：恢复密钥同时用恢复码与密码包裹备份，清缓存/换机后输原密码即可恢复',
      '防误覆盖：云端已有加密备份时禁止直接生成新密钥，强制走恢复流程',
      '修复 iOS 登录失败后按钮永久锁定的问题',
      '登录错误细分提示：网络错误不再误报为密码错误',
      '登录密码改为 PBKDF2 加盐哈希存储，旧明文自动升级',
      '登录限流：同 IP 15 分钟内最多 10 次尝试',
      '可选 API 鉴权：XINGUANG_API_AUTH=on 开启后接口需携带令牌（默认关闭）',
      '替换危险防火墙脚本：新脚本仅放行专用网络，防火墙保持开启',
      '构建代码分割：vendor 独立 chunk，移动端首屏加载更快',
      '新增 19 个加密核心单元测试（npm test）',
    ],
  },
  {
    date: '2026-08-19',
    version: 'v2.1.0',
    title: '加密凭据兼容性修复 + 安全增强',
    changes: [
      '移除登录页默认密码显示',
      '修复 deriveAESKey 密钥导出参数导致的登录验证崩溃',
      '凭据智能加密存储：加密会话下坚果云凭据自动加密落盘',
      '凭据获取全面异步化：修复加密凭据时坚果云读写全部失败的问题',
      '断开连接时立即清除会话密钥',
    ],
  },
  {
    date: '2026-08-15',
    version: 'v1.20.1',
    title: '云端备份恢复密钥 + 修改加密密码',
    changes: [
      '恢复码只弹一次：首次开启加密时展示恢复码，确认后记录已保存',
      '恢复密钥云端备份：恢复码包裹的主密钥备份到坚果云，换机/清缓存后可用恢复码找回',
      '云端检测防覆盖：检测到云端已有加密数据时给出警告，防止重新设置加密导致旧数据不可读',
      '忘记密码云端恢复：输入恢复码+新密码，从云端拉取恢复密钥，换机后可恢复数据',
      '修改加密密码：已解锁会话可直接修改，未解锁需验证当前密码，主密钥不变数据不受影响',
      '已启用加密摘要页：显示加密状态、会话解锁状态、云端备份状态',
      '修复恢复密码后再次保存被拦截的问题',
      '修复旧版恢复后缺少加密设置标记导致误判首次启用的问题',
    ],
  },
  {
    date: '2026-08-13',
    version: 'v1.20.0',
    title: '主密钥架构 + 恢复码',
    changes: [
      '主密钥架构：随机生成 256 位主密钥，所有文件加密使用主密钥',
      '密码不落盘：PBKDF2 哈希验证，密码明文永不存储',
      '恢复码机制：24 位 alphanumeric 恢复码，忘记密码可重置',
      '恢复码验证：设置时需完整输入恢复码确认已保存',
      '安全提示：恢复码建议存 U 盘或打印，不要截图',
      '会话密钥：主密钥仅存内存，页面关闭即清除',
      '自动迁移：登录后自动将旧格式文件迁移到新格式',
      '坚果云凭据改用主密钥加密，不再依赖加密密码',
    ],
  },
  {
    date: '2026-08-13',
    version: 'v1.19.1',
    title: '坚果云凭据加密存储',
    changes: [
      '坚果云账号密码使用 AES-256-GCM 加密后存储',
      '加密密钥由用户设置的加密密码通过 PBKDF2 派生',
      'localStorage 中不再存储明文密码',
      '向后兼容：未启用加密时仍使用明文存储',
    ],
  },
  {
    date: '2026-08-13',
    version: 'v1.19',
    title: '坚果云端到端加密',
    changes: [
      '新增端到端加密功能：采用 AES-256-GCM + PBKDF2 加密算法',
      '加密开关：在坚果云配置中可一键开启/关闭加密',
      '两次密码确认：启用加密时需输入两次密码防止输错',
      '忘记密码警示：明确提示忘记密码无法找回',
      '一键迁移：可将坚果云中所有历史文件批量加密',
      '向后兼容：已存在的明文文件仍可正常读取',
      '跨设备同步：其他设备输入相同密码即可解密',
      '加密标记：密文文件以 [XG_ENC] 标记头识别',
    ],
  },
  {
    date: '2026-08-12',
    version: 'v1.18.10',
    title: '完成/未完成修复、语音输入与AI自动分类',
    changes: [
      '修复完成/未完成选项bug：切换完成状态时直接修改 [ ]/[x] 标记，不再产生新的编辑行',
      '新增语音输入功能：点击麦克风按钮使用语音输入，支持 Chrome/Edge 浏览器',
      '新增AI语义自动分类：输入内容后AI自动识别并匹配最合适的分类标签',
      'AI分类尊重用户手动选择：用户手动选择了标签后AI不再自动归类',
      '快速记录模块新增AI分类按钮（Sparkles图标），可手动触发AI分类',
      'AI分类器支持所有自定义标签，自动识别用户添加的任何分类',
    ],
  },
  {
    date: '2026-07-31',
    version: 'v1.12',
    title: 'AI智能分析、热力图恢复与编辑时间戳',
    changes: [
      '新增AI智能分析模块：根据日/周/月/年周期自动生成归纳总结和下期计划',
      'AI分析支持完成/未完成标签筛选，可按标签汇总待办事项',
      'AI分析可一键切换待办完成状态，支持按优先级排序',
      '恢复热力图模块：按月展示日历网格，支持点击日期查看详情',
      '恢复四象限视图：支持紧急/重要/一般/次要四个象限分类',
      '编辑条目时自动在修改内容前添加日期时间，另起一行展示',
      '原始条目的创建日期和时间保持不变，修改内容以新行追加',
      '编辑模式优化：显示原始内容（只读），输入框用于补充内容',
      '工具栏新增热力图和AI分析入口按钮',
    ],
  },
  {
    date: '2026-07-31',
    version: 'v1.11',
    title: '分类标签修复与稳定性提升',
    changes: [
      '修复快速记录中选择非默认分类后输出仍显示为收集标签的问题',
      '优化 @cat 标记解析正则，支持带时间戳前缀的分类标记提取',
      '确保 addEntry 始终写入 @cat 标记，updateEntry 保留分类信息',
      '修复 Service Worker 缓存旧版本导致更新不生效',
      'EntryItem 组件通过 displayType 正确渲染分类标签和颜色',
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