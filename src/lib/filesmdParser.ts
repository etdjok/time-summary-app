import { MarkdownEntry } from '../types';

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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

function stripCategoryIdMarker(content: string): string {
  return content.replace(/@cat:\S+\s*/g, '').trim();
}

function stripMetadata(content: string): string {
  return content
    .replace(/@cat:\S+\s*/g, '')
    .replace(/^!!?\s*/, '')
    .replace(/#\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 尝试从内容中提取完整日期 YYYY-MM-DD
function extractDateFromContent(content: string): string | null {
  // 匹配 YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY.MM.DD
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
      // 补齐月日为两位
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }
    
    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s*-?\s*/);
    if (timeMatch) {
      currentTime = timeMatch[1];
    }
    
    const contentToParse = timeMatch ? trimmed.replace(/^\d{1,2}:\d{2}\s*-?\s*/, '') : trimmed;
    
    if (contentToParse && !contentToParse.startsWith('#') && contentToParse.length > 0) {
      const isTodo = contentToParse.startsWith('- [ ]') || contentToParse.startsWith('- [x]') || contentToParse.startsWith('* [ ]') || contentToParse.startsWith('* [x]');
      const isCompleted = contentToParse.startsWith('- [x]') || contentToParse.startsWith('* [x]');
      
      let cleanContent = contentToParse;
      if (isTodo) {
        cleanContent = contentToParse.replace(/^[-*]\s*\[[x ]\]\s*/, '');
      }

      const categoryId = extractCategoryId(cleanContent);
      
      let entryType: string;
      if (categoryId) {
        entryType = categoryId;
      } else {
        entryType = isTodo ? 'todo' : 'chat';
      }
      
      // 确定日期：优先用日期头，其次从内容提取，最后为空
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
        completed: isTodo ? isCompleted : undefined,
      });
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
      });
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
    
    const isTodo = trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || 
                   trimmed.startsWith('* [ ]') || trimmed.startsWith('* [x]') ||
                   trimmed.startsWith('- ') || trimmed.startsWith('* ');
    
    if (!isTodo && !trimmed.match(/^\d+\./)) continue;
    
    const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('* [x]');
    
    let cleanContent = trimmed
      .replace(/^[-*]\s*\[[x ]\]\s*/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+\.\s*/, '');
    
    if (cleanContent && cleanContent.length > 0) {
      const categoryId = extractCategoryId(cleanContent);
      const entryType = categoryId || 'todo';
      
      // 确定日期：优先用日期头，其次从内容提取
      let entryDate = currentDate;
      if (!entryDate) {
        entryDate = extractDateFromContent(cleanContent) || '';
      }
      
      // 提取时间（如果有）
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
      });
    }
  }
  
  return entries;
}

export function parseBrainMd(content: string, fileName: string): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');
  
  let currentDate = '';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 匹配 ## YYYY-MM-DD 日期头
    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      // 如果有积累的内容，先保存
      if (currentContent.length > 0) {
        const contentStr = currentContent.join('\n');
        const categoryId = extractCategoryId(contentStr);
        
        entries.push({
          id: `${fileName}-${entries.length}`,
          content: stripMetadata(contentStr),
          type: categoryId || 'note',
          categoryId: categoryId || undefined,
          date: currentDate,
          sourceFile: fileName,
          priority: 'medium' as const,
          tags: extractTags(contentStr),
        });
        currentContent = [];
      }
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        currentDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      continue;
    }
    
    if (trimmed.match(/^#+\s+/) && currentContent.length > 0) {
      const contentStr = currentContent.join('\n');
      const categoryId = extractCategoryId(contentStr);
      
      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(contentStr),
        type: categoryId || 'note',
        categoryId: categoryId || undefined,
        date: currentDate,
        sourceFile: fileName,
        priority: 'medium' as const,
        tags: extractTags(contentStr),
      });
      currentContent = [];
    }
    
    if (trimmed) {
      currentContent.push(trimmed);
    }
  }
  
  if (currentContent.length > 0) {
    const contentStr = currentContent.join('\n');
    const categoryId = extractCategoryId(contentStr);
    
    entries.push({
      id: `${fileName}-${entries.length}`,
      content: stripMetadata(contentStr),
      type: categoryId || 'note',
      categoryId: categoryId || undefined,
      date: currentDate,
      sourceFile: fileName,
      priority: 'medium' as const,
      tags: extractTags(contentStr),
    });
  }
  
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