import { X, BookOpen, Cloud, Tag, Clock, Folder, Smartphone, Shield } from 'lucide-react';

interface HelpPageProps {
  onClose: () => void;
}

export function HelpPage({ onClose }: HelpPageProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">心光使用帮助</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-sm text-gray-700">
          <section>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-amber-500" />
              坚果云连接
            </h3>
            <p className="text-gray-600 leading-relaxed">
              首次使用需要配置坚果云账号。在设置中输入你的坚果云账号（如 wxpemail@163.com）和第三方应用密码（不是登录密码），同步目录建议填写 <code className="bg-gray-100 px-1 rounded">/我的坚果云/笔记</code>。
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-amber-500" />
              快速记录
            </h3>
            <p className="text-gray-600 leading-relaxed">
              选择分类标签（收集、待办、想法、日记、笔记），输入内容后点击发送。系统会自动在内容前加上当前时间，并保存到对应的坚果云文件中。
            </p>
            <ul className="mt-2 space-y-1 text-gray-500 text-xs">
              <li>· 收集/想法/笔记 → 保存到 Chat.md</li>
              <li>· 待办 → 保存到 Later.md（自动添加勾选框）</li>
              <li>· 日记 → 保存到 journal/YYYY.MM.md</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              时间周期汇总
            </h3>
            <p className="text-gray-600 leading-relaxed">
              支持按日、周、月、季度、半年、年查看记录。使用左右箭头切换周期，点击"今天"回到当前周期。
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-amber-500" />
              自定义分类
            </h3>
            <p className="text-gray-600 leading-relaxed">
              在分类管理中，你可以添加、删除自己的分类。每个分类可以设置名称、图标、颜色，并选择保存到收集箱、待办或日记文件。
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-500" />
              手机访问
            </h3>
            <p className="text-gray-600 leading-relaxed">
              手机和电脑连接到同一 WiFi 后，手机浏览器访问电脑局域网 IP 即可使用。地址示例：<code className="bg-gray-100 px-1 rounded">http://10.x.x.x:3001</code>（具体 IP 请查看电脑端显示）。
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-500" />
              隐私说明
            </h3>
            <p className="text-gray-600 leading-relaxed">
              你的账号密码仅保存在当前设备的浏览器 localStorage 中，不会上传到任何第三方服务器。所有数据通过你的坚果云账号同步，心光只读取和写入你指定的文件。
            </p>
          </section>

          <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            心光 v1.11 · 你的时光记录与思考空间
          </div>
        </div>
      </div>
    </div>
  );
}
