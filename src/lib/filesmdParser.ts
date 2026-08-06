import { MarkdownEntry } from '../types';

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function extractTags(content: string): string[] {
  const tagRegex = /#(\S+)/g;
  const tags: string[] = [];
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    if (!match[1].startsWith('cat:')) {
      tags.push(match[1]);
    }
  }
  return [...new Set(tags)];
}

function extractPriority(content: string): 'urgent' | 'high' | 'medium' | 'low' {
  if (content.includes('!!') || content.includes('紧急') || content.includes('urgent')) {
    return 'urgent';
  }
  if (content.includes('!') || content.includes('重要') || content.includes('important')) {
    return 'high';
  }
  return 'medium';
}

function extractCategoryId(content: string): string | null {
  const match = content.match(/@cat:(\S+)/);
  return match ? match[1] : null;
}

function isNewEntryLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.match(/^##\s/)) return true;
  if (trimmed.match(/^###?\s/)) return true;
  if (trimmed.match(/^\d{1,2}:\d{2}\s/)) return true;
  if (trimmed.match(/^[-*]\s*\[[x ]\]/)) return true;
  if (trimmed.match(/^[-*]\s+/)) return true;
  if (trimmed.match(/^\d+\.\s/)) return true;
  return false;
}

function stripMetadata(content: string): string {
  return content
    .replace(/@cat:\S+\s*/g, '')
    .replace(/^!!?\s*/gm, '')
    .replace(/#\S+/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n')
    .trim();
}

function extractDateFromContent(content: string): string | null {
  const match = content.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  return null;
}

function extractTimeFromContent(content: string): string | null {
  const match = content.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return null;
}

export function parseChatMd(content: string, fileName: string = 'Chat.md'): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');

  let currentDate = '';
  let currentTime = '';
  let hasAnyDateHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      hasAnyDateHeader = true;
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }

    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s*-?\s*/);
    const isTodoStart = trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('* [ ]') || trimmed.startsWith('* [x]');

    if (timeMatch || isTodoStart) {
      if (timeMatch) currentTime = timeMatch[1];

      const contentToParse = timeMatch
        ? trimmed.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '')
        : trimmed;

      const isCompleted = contentToParse.startsWith('- [x]') || contentToParse.startsWith('* [x]');

      let cleanContent = contentToParse;
      if (isTodoStart) {
        cleanContent = contentToParse.replace(/^[-*]\s*\[[x ]\]\s*/, '');
        const innerTime = cleanContent.match(/^(\d{1,2}:\d{2})\s*/);
        if (innerTime) {
          currentTime = innerTime[1];
          cleanContent = cleanContent.replace(/^\d{1,2}:\d{2}\s*/, '');
        }
      }

      const categoryId = extractCategoryId(cleanContent);
      const entryType = categoryId || (isTodoStart ? 'todo' : 'chat');

      let entryDate = currentDate;
      if (!entryDate) {
        entryDate = extractDateFromContent(cleanContent) || '';
      }
      // v1.18.5: 无日期头的条目，使用文件中最后一个日期头或今天
      if (!entryDate && !hasAnyDateHeader) {
        entryDate = formatDate(new Date());
      }

      const entryTime = currentTime || extractTimeFromContent(cleanContent) || '';

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(cleanContent),
        type: entryType,
        categoryId: categoryId || undefined,
        date: entryDate,
        time: entryTime || undefined,
        sourceFile: fileName,
        priority: extractPriority(contentToParse),
        tags: extractTags(contentToParse),
        completed: isTodoStart ? isCompleted : undefined,
      });
    } else if (!isNewEntryLine(trimmed) && entries.length > 0) {
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
    }
  }

  return entries;
}

export function parseJournalMd(content: string, fileName: string): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');

  let currentDate = '';
  const monthMatch = fileName.match(/(\d{4})[.](\d{2})/);
  if (monthMatch) {
    currentDate = `${monthMatch[1]}-${monthMatch[2]}-01`;
  }

  let currentTime = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }

    const dayMatch = trimmed.match(/^###?\s*(\d{1,2})[日号]/);
    if (dayMatch && monthMatch) {
      currentDate = `${monthMatch[1]}-${monthMatch[2]}-${dayMatch[1].padStart(2, '0')}`;
      continue;
    }

    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s*-?\s*/);
    if (timeMatch) {
      currentTime = timeMatch[1];
    }

    const contentToParse = timeMatch ? trimmed.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '') : trimmed;

    if (contentToParse && !contentToParse.startsWith('#') && contentToParse.length > 0) {
      if (timeMatch || !isNewEntryLine(trimmed)) {
        if (timeMatch) {
          const categoryId = extractCategoryId(contentToParse);
          const entryType = categoryId || 'journal';

          let entryDate = currentDate;
          if (!entryDate) {
            entryDate = extractDateFromContent(contentToParse) || '';
          }
          if (!entryDate) {
            entryDate = formatDate(new Date());
          }

          const entryTime = currentTime || extractTimeFromContent(contentToParse) || '';

          entries.push({
            id: `${fileName}-${entries.length}`,
            content: stripMetadata(contentToParse),
            type: entryType,
            categoryId: categoryId || undefined,
            date: entryDate,
            time: entryTime || undefined,
            sourceFile: fileName,
            priority: extractPriority(contentToParse),
            tags: extractTags(contentToParse),
          });
        } else if (entries.length > 0) {
          const prev = entries[entries.length - 1];
          prev.content += '\n' + trimmed;
        }
      }
    }
  }

  return entries;
}

export function parseTodoMd(content: string, fileName: string = 'Later.md'): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');

  let currentDate = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }

    const isTodo = trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') ||
                   trimmed.startsWith('* [ ]') || trimmed.startsWith('* [x]') ||
                   trimmed.startsWith('- ') || trimmed.startsWith('* ');

    if (isTodo || trimmed.match(/^\d+\./)) {
      const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('* [x]');

      let cleanContent = trimmed
        .replace(/^[-*]\s*\[[x ]\]\s*/, '')
        .replace(/^[-*]\s+/, '')
        .replace(/^\d+\.\s*/, '');

      if (cleanContent && cleanContent.length > 0) {
        const categoryId = extractCategoryId(cleanContent);
        const entryType = categoryId || 'todo';

        let entryDate = currentDate;
        if (!entryDate) {
          entryDate = extractDateFromContent(cleanContent) || '';
        }
        if (!entryDate) {
          entryDate = formatDate(new Date());
        }

        const timeMatch = cleanContent.match(/^(\d{1,2}:\d{2})\s*/);
        let entryTime = '';
        if (timeMatch) {
          entryTime = timeMatch[1];
          cleanContent = cleanContent.replace(/^\d{1,2}:\d{2}\s*/, '');
        }
        if (!entryTime) {
          entryTime = extractTimeFromContent(cleanContent) || '';
        }

        entries.push({
          id: `${fileName}-${entries.length}`,
          content: stripMetadata(cleanContent),
          type: entryType,
          categoryId: categoryId || undefined,
          date: entryDate,
          time: entryTime || undefined,
          sourceFile: fileName,
          priority: extractPriority(trimmed),
          tags: extractTags(trimmed),
          completed: isCompleted,
        });
      }
    } else if (!isNewEntryLine(trimmed) && entries.length > 0) {
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
    }
  }

  return entries;
}

export function parseBrainMd(content: string, fileName: string): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');

  let currentDate = '';
  let currentContent: string[] = [];

  const flushContent = () => {
    if (currentContent.length > 0) {
      const contentStr = currentContent.join('\n');
      const categoryId = extractCategoryId(contentStr);

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(contentStr),
        type: categoryId || 'note',
        categoryId: categoryId || undefined,
        date: currentDate || formatDate(new Date()),
        sourceFile: fileName,
        priority: 'medium' as const,
        tags: extractTags(contentStr),
      });
      currentContent = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      flushContent();
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }

    if (trimmed.match(/^#+\s+/) && currentContent.length > 0) {
      flushContent();
    }

    if (trimmed) {
      currentContent.push(trimmed);
    }
  }

  flushContent();

  return entries;
}

export function parseMarkdownFile(content: string, fileName: string): MarkdownEntry[] {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes('journal') || lowerName.includes('日记') || lowerName.match(/\d{4}\.\d{2}/)) {
    return parseJournalMd(content, fileName);
  }

  if (lowerName === 'later.md' || lowerName.includes('todo') || lowerName.includes('待办')) {
    return parseTodoMd(content, fileName);
  }

  if (lowerName.includes('read') || lowerName.includes('watch') || lowerName.includes('shop')) {
    return parseTodoMd(content, fileName);
  }

  if (lowerName.includes('brain') || lowerName.includes('笔记') || lowerName.includes('note')) {
    return parseBrainMd(content, fileName);
  }

  return parseChatMd(content, fileName);
}