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
  // 优先解析 #priority 标签格式（新增的标准格式）
  const priorityMatch = content.match(/#(urgent|high|medium|low)/i);
  if (priorityMatch) {
    return priorityMatch[1].toLowerCase() as 'urgent' | 'high' | 'medium' | 'low';
  }
  // 兼容旧格式：!! 表示紧急且重要
  if (content.includes('!!')) {
    return 'urgent';
  }
  // 兼容旧格式：! 表示重要不紧急
  if (content.includes('!')) {
    return 'high';
  }
  return 'medium';
}

function extractCategoryId(content: string): string | null {
  const match = content.match(/@cat:(\S+)/);
  return match ? match[1] : null;
}

// 判断一行是否为新条目的开头（时间戳、待办标记、日期头等）
function isNewEntryLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true; // 空行视为分隔
  // 以日期时间戳 YYYY-MM-DD HH:MM 开头的行是新条目（v1.18.9 新格式）
  if (trimmed.match(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/)) return true;
  if (trimmed.match(/^##\s/)) return true; // 日期头
  if (trimmed.match(/^###?\s/)) return true; // 子标题
  if (trimmed.match(/^\d{1,2}:\d{2}\s/)) return true; // 时间戳开头
  if (trimmed.match(/^[-*]\s*\[[x ]\]/)) return true; // 待办标记
  if (trimmed.match(/^[-*]\s+/)) return true; // 列表项
  if (trimmed.match(/^\d+\.\s/)) return true; // 编号列表
  return false;
}

function stripMetadata(content: string): string {
  return content
    .replace(/@cat:\S+\s*/g, '')
    .replace(/^!!?\s*/gm, '')
    .replace(/#\S+/g, '')
    .replace(/\[编辑\]\s*/g, '')
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

export function parseChatMd(content: string, fileName: string = 'Chat.md'): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');

  let currentDate = '';
  let currentTime = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 匹配 ## YYYY-MM-DD 日期头
    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }

    // 时间戳开头 -> 新条目
    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s*-?\s*/);
    // 待办标记开头 -> 新条目
    const isTodoStart = trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('* [ ]') || trimmed.startsWith('* [x]');

    // 检查行中完整日期时间戳 YYYY-MM-DD HH:MM 出现次数
    const fullDateTimeMatch = trimmed.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d{1,2}:\d{2})\s*-?\s*/);
    const dateTimeMatches = trimmed.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/g);
    const dateTimeCount = dateTimeMatches ? dateTimeMatches.length : 0;
    // 编辑行：有 [编辑]/[已编辑] 标记，或多个时间戳（向后兼容旧格式）
    const isEditLine = trimmed.includes('[编辑]') || trimmed.includes('[已编辑') || dateTimeCount > 1;

    if (fullDateTimeMatch && !isEditLine) {
      // 新格式：YYYY-MM-DD HH:MM 开头的新条目
      currentDate = fullDateTimeMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      currentTime = fullDateTimeMatch[2];

      const contentToParse = trimmed.replace(fullDateTimeMatch[0], '').trim();

      const categoryId = extractCategoryId(contentToParse);
      const entryType = categoryId || 'chat';

      let entryDate = currentDate;

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(contentToParse),
        type: entryType,
        categoryId: categoryId || undefined,
        date: entryDate,
        time: currentTime || undefined,
        sourceFile: fileName,
        priority: extractPriority(contentToParse),
        tags: extractTags(contentToParse),
        rawLine: trimmed,
      });
    } else if (isEditLine && entries.length > 0) {
      // 编辑行：合并到前一个条目
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
      prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
    } else if (isEditLine && entries.length === 0 && (timeMatch || isTodoStart)) {
      // 第一行包含编辑标记但有时间戳/待办开头：创建新条目
      if (timeMatch) currentTime = timeMatch[1];

      const contentToParse = timeMatch
        ? trimmed.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '')
        : trimmed;

      const isCompleted = contentToParse.startsWith('- [x]') || contentToParse.startsWith('* [x]');

      let cleanContent = contentToParse;
      if (isTodoStart) {
        cleanContent = contentToParse.replace(/^[-*]\s*\[[x ]\]\s*/, '');
      }

      const categoryId = extractCategoryId(cleanContent);
      const entryType = categoryId || (isTodoStart ? 'todo' : 'chat');

      let entryDate = currentDate;
      if (!entryDate) {
        entryDate = extractDateFromContent(cleanContent) || '';
      }

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(cleanContent),
        type: entryType,
        categoryId: categoryId || undefined,
        date: entryDate,
        time: currentTime || undefined,
        sourceFile: fileName,
        priority: extractPriority(contentToParse),
        tags: extractTags(contentToParse),
        completed: isTodoStart ? isCompleted : undefined,
        rawLine: trimmed,
      });
    } else if (!isEditLine && (timeMatch || isTodoStart)) {
      if (timeMatch) currentTime = timeMatch[1];

      const contentToParse = timeMatch
        ? trimmed.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '')
        : trimmed;

      const isCompleted = contentToParse.startsWith('- [x]') || contentToParse.startsWith('* [x]');

      let cleanContent = contentToParse;
      if (isTodoStart) {
        cleanContent = contentToParse.replace(/^[-*]\s*\[[x ]\]\s*/, '');
        // 待办行内可能还有时间戳
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

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(cleanContent),
        type: entryType,
        categoryId: categoryId || undefined,
        date: entryDate,
        time: currentTime || undefined,
        sourceFile: fileName,
        priority: extractPriority(contentToParse),
        tags: extractTags(contentToParse),
        completed: isTodoStart ? isCompleted : undefined,
        rawLine: trimmed,  // 保存原始行用于精确匹配
      });
    } else if (isEditLine && entries.length > 0) {
      // 编辑行：合并到前一个条目
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
      prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
    } else if (!isNewEntryLine(trimmed) && entries.length > 0) {
      // 延续行：合并到前一个条目
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
      prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
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

    // 检查完整日期时间戳 YYYY-MM-DD HH:MM（v1.18.9+ 新格式）
    const fullDateTimeMatch = trimmed.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d{1,2}:\d{2})\s*-?\s*/);
    const dateTimeMatchesJournal = trimmed.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/g);
    const dateTimeCountJournal = dateTimeMatchesJournal ? dateTimeMatchesJournal.length : 0;
    // 编辑行：有 [编辑]/[已编辑] 标记，或多个时间戳（向后兼容旧格式）
    const isEditLineJournal = trimmed.includes('[编辑]') || trimmed.includes('[已编辑') || dateTimeCountJournal > 1;

    if (contentToParse && !contentToParse.startsWith('#') && contentToParse.length > 0) {
      if (fullDateTimeMatch && !isEditLineJournal) {
        // 新格式：YYYY-MM-DD HH:MM 开头的新条目
        currentDate = fullDateTimeMatch[1].replace(/\./g, '-').replace(/\//g, '-');
        const parts = currentDate.split('-');
        if (parts.length === 3) {
          currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        currentTime = fullDateTimeMatch[2];

        const contentToParseFull = trimmed.replace(fullDateTimeMatch[0], '').trim();

        const categoryId = extractCategoryId(contentToParseFull);
        const entryType = categoryId || 'journal';

        entries.push({
          id: `${fileName}-${entries.length}`,
          content: stripMetadata(contentToParseFull),
          type: entryType,
          categoryId: categoryId || undefined,
          date: currentDate,
          time: currentTime || undefined,
          sourceFile: fileName,
          priority: extractPriority(contentToParseFull),
          tags: extractTags(contentToParseFull),
          rawLine: trimmed,
        });
      } else if (isEditLineJournal && entries.length > 0) {
        // 编辑行：合并到前一个条目
        const prev = entries[entries.length - 1];
        prev.content += '\n' + trimmed;
        prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
      } else if (isEditLineJournal && entries.length === 0 && (timeMatch || fullDateTimeMatch)) {
        // 第一行包含编辑标记但有时间戳开头：创建新条目
        const categoryId = extractCategoryId(contentToParse);
        const entryType = categoryId || 'journal';

        entries.push({
          id: `${fileName}-${entries.length}`,
          content: stripMetadata(contentToParse),
          type: entryType,
          categoryId: categoryId || undefined,
          date: currentDate,
          time: currentTime || undefined,
          sourceFile: fileName,
          priority: extractPriority(contentToParse),
          tags: extractTags(contentToParse),
          rawLine: trimmed,
        });
      } else if (!isEditLineJournal && (timeMatch || fullDateTimeMatch || !isNewEntryLine(trimmed))) {
        if (timeMatch || fullDateTimeMatch) {
          // 新条目（HH:MM 或 YYYY-MM-DD HH:MM 格式）
          const categoryId = extractCategoryId(contentToParse);
          const entryType = categoryId || 'journal';

          entries.push({
            id: `${fileName}-${entries.length}`,
            content: stripMetadata(contentToParse),
            type: entryType,
            categoryId: categoryId || undefined,
            date: currentDate,
            time: currentTime || undefined,
            sourceFile: fileName,
            priority: extractPriority(contentToParse),
            tags: extractTags(contentToParse),
            rawLine: trimmed,
          });
        } else if (entries.length > 0) {
          // 延续行
          const prev = entries[entries.length - 1];
          prev.content += '\n' + trimmed;
          prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
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

    // 检查行中完整日期时间戳 YYYY-MM-DD HH:MM 出现次数
    const dateTimeMatchesTodo = trimmed.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}/g);
    const dateTimeCountTodo = dateTimeMatchesTodo ? dateTimeMatchesTodo.length : 0;
    // 编辑行：有 [编辑]/[已编辑] 标记，或多个时间戳（向后兼容旧格式）
    const isEditLineTodo = trimmed.includes('[编辑]') || trimmed.includes('[已编辑') || dateTimeCountTodo > 1;
    // 新格式条目：YYYY-MM-DD HH:MM 开头（可带 checkbox 前缀）
    const fullDateTimeMatchTodo = trimmed.match(/^(?:[-*]\s*\[[x ]\]\s*)?(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d{1,2}:\d{2})\s*-?\s*/);
    
    if (isEditLineTodo && entries.length > 0) {
      // 编辑行：合并到前一个条目
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
      prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
    } else if (isEditLineTodo && entries.length === 0 && isTodo) {
      // 第一行包含编辑标记但是待办项：创建新条目
      const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('* [x]');

      let cleanContent = trimmed
        .replace(/^[-*]\s*\[[x ]\]\s*/, '')
        .replace(/^[-*]\s+/, '');

      if (cleanContent && cleanContent.length > 0) {
        const categoryId = extractCategoryId(cleanContent);
        const entryType = categoryId || 'todo';

        let entryDate = currentDate;
        if (!entryDate) {
          entryDate = extractDateFromContent(cleanContent) || '';
        }

        entries.push({
          id: `${fileName}-${entries.length}`,
          content: stripMetadata(cleanContent),
          type: entryType,
          categoryId: categoryId || undefined,
          date: entryDate,
          sourceFile: fileName,
          priority: extractPriority(trimmed),
          tags: extractTags(trimmed),
          completed: isCompleted,
          rawLine: trimmed,
        });
      }
    } else if (fullDateTimeMatchTodo && !isEditLineTodo) {
      // 新格式条目：YYYY-MM-DD HH:MM 开头
      const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('* [x]');
      const rawDate = fullDateTimeMatchTodo[1].replace(/\./g, '-').replace(/\//g, '-');
      const dateParts = rawDate.split('-');
      const normalizedDate = dateParts.length === 3
        ? `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`
        : rawDate;
      const entryTime = fullDateTimeMatchTodo[2];

      let contentToParse = trimmed.replace(fullDateTimeMatchTodo[0], '').trim();
      contentToParse = contentToParse.replace(/^[-*]\s*\[[x ]\]\s*/, '');

      const categoryId = extractCategoryId(contentToParse);
      const entryType = categoryId || 'todo';

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(contentToParse),
        type: entryType,
        categoryId: categoryId || undefined,
        date: normalizedDate,
        time: entryTime,
        sourceFile: fileName,
        priority: extractPriority(contentToParse),
        tags: extractTags(contentToParse),
        completed: isCompleted || undefined,
        rawLine: trimmed,
      });
    } else if (!isEditLineTodo && (isTodo || trimmed.match(/^\d+\./))) {
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

        const timeMatch = cleanContent.match(/^(\d{1,2}:\d{2})\s*/);
        let entryTime = '';
        if (timeMatch) {
          entryTime = timeMatch[1];
          cleanContent = cleanContent.replace(/^\d{1,2}:\d{2}\s*/, '');
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
          rawLine: trimmed,
        });
      }
    } else if (!isNewEntryLine(trimmed) && entries.length > 0) {
      // 延续行：合并到前一个条目
      const prev = entries[entries.length - 1];
      prev.content += '\n' + trimmed;
      prev.rawLine = (prev.rawLine || '') + '\n' + trimmed;
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

      // 修复 v1.17：当没有 ## 日期头时，尝试从内容中提取日期
      let brainDate = currentDate;
      if (!brainDate) {
        brainDate = extractDateFromContent(contentStr) || '';
      }

      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(contentStr),
        type: categoryId || 'note',
        categoryId: categoryId || undefined,
        date: brainDate,
        sourceFile: fileName,
        priority: 'medium' as const,
        tags: extractTags(contentStr),
        rawLine: contentStr,
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