import React from 'react';
import { Code, List, ListOrdered, Bold, Italic, Link, Image, Heading1, Heading2, Heading3, Quote, CheckSquare } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const toolbarButtons = [
  { icon: Heading1, action: '# ', title: '标题1' },
  { icon: Heading2, action: '## ', title: '标题2' },
  { icon: Heading3, action: '### ', title: '标题3' },
  { type: 'divider' },
  { icon: Bold, action: '**', title: '粗体', wrap: true },
  { icon: Italic, action: '_', title: '斜体', wrap: true },
  { icon: Code, action: '`', title: '代码', wrap: true },
  { type: 'divider' },
  { icon: List, action: '- ', title: '无序列表' },
  { icon: ListOrdered, action: '1. ', title: '有序列表' },
  { icon: CheckSquare, action: '- [ ] ', title: '任务列表' },
  { type: 'divider' },
  { icon: Quote, action: '> ', title: '引用' },
  { icon: Link, action: '[](url)', title: '链接', cursor: true },
  { icon: Image, action: '![](url)', title: '图片', cursor: true },
];

export function MarkdownEditor({ value, onChange, placeholder, className }: MarkdownEditorProps) {
  const handleToolbarClick = (action: string, wrap = false, cursor = false) => {
    const textarea = document.querySelector('.markdown-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    let newText: string;
    let cursorPos: number;

    if (wrap) {
      newText = value.substring(0, start) + action + selectedText + action + value.substring(end);
      cursorPos = end + action.length * 2;
    } else if (cursor) {
      newText = value.substring(0, start) + action + value.substring(end);
      cursorPos = start + action.indexOf('url');
    } else {
      newText = value.substring(0, start) + action + selectedText + value.substring(end);
      cursorPos = start + action.length + selectedText.length;
    }

    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded-t-xl">
        {toolbarButtons.map((btn, index) => (
          btn.type === 'divider' ? (
            <div key={index} className="w-px h-6 bg-gray-300 mx-1" />
          ) : (
            <button
              key={index}
              onClick={() => handleToolbarClick(btn.action!, btn.wrap, btn.cursor)}
              title={btn.title}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
              aria-label={btn.title}
            >
              <btn.icon className="w-4 h-4" />
            </button>
          )
        ))}
      </div>
      <textarea
        className="markdown-textarea flex-1 w-full px-4 py-3 bg-white border border-t-0 border-gray-200 rounded-b-xl focus:outline-none focus:border-amber-400 transition-colors resize-none text-sm font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '使用 Markdown 格式编写内容...'}
        spellCheck={false}
      />
    </div>
  );
}