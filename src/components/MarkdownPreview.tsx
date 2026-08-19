import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return null;
  }

  return (
    <div className={`markdown-preview prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mb-2 mt-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-800 mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-700 mb-1 mt-2">{children}</h3>,
        p: ({ children }) => <p className="text-gray-700 mb-2 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
        em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700">{children}</ol>,
        li: ({ children }) => <li className="ml-2">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-amber-400 pl-3 py-1 my-2 italic text-gray-600 bg-amber-50 rounded-r-xl">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-xl overflow-x-auto text-sm mb-2">
                <code>{children}</code>
              </pre>
            );
          }
          return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-700">{children}</code>;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
            {children}
          </a>
        ),
        table: ({ children }) => <div className="overflow-x-auto my-2"><table className="border-collapse w-full text-sm">{children}</table></div>,
        th: ({ children }) => <th className="border border-gray-300 px-3 py-2 bg-gray-50 font-semibold text-gray-700">{children}</th>,
        td: ({ children }) => <td className="border border-gray-300 px-3 py-2 text-gray-700">{children}</td>,
        hr: () => <hr className="my-4 border-gray-200" />,
      }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}