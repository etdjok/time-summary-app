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
    tags.push(match[1]);
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

function stripMetadata(content: string): string {
  return content
    .replace(/^!!?\s*/, '')
    .replace(/#\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseChatMd(content: string, fileName: string = 'Chat.md'): MarkdownEntry[] {
  const entries: MarkdownEntry[] = [];
  const lines = content.split('\n');
  
  let currentDate = formatDate(new Date());
  let currentTime = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const dateMatch = trimmed.match(/^##\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch) {
      currentDate = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
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
      
      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(cleanContent),
        type: isTodo ? 'todo' : 'chat',
        date: currentDate,
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
  
  let currentDate = formatDate(new Date());
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
      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(contentToParse),
        type: 'journal',
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
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
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
      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(cleanContent),
        type: 'todo',
        date: formatDate(new Date()),
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
  
  let currentTitle = '';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.match(/^#+\s+/) && currentContent.length > 0) {
      entries.push({
        id: `${fileName}-${entries.length}`,
        content: stripMetadata(currentContent.join('\n')),
        type: 'note',
        date: formatDate(new Date()),
        sourceFile: fileName,
        priority: 'medium' as const,
        tags: extractTags(currentContent.join('\n')),
      });
      currentContent = [];
      currentTitle = trimmed.replace(/^#+\s+/, '');
    }
    
    if (trimmed) {
      currentContent.push(trimmed);
    }
  }
  
  if (currentContent.length > 0) {
    entries.push({
      id: `${fileName}-${entries.length}`,
      content: stripMetadata(currentContent.join('\n')),
      type: 'note',
      date: formatDate(new Date()),
      sourceFile: fileName,
      priority: 'medium' as const,
      tags: extractTags(currentContent.join('\n')),
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