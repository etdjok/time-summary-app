import { sendStreamAndGetContent } from './aiClient';
import { getAIConfig } from './aiSecurity';
import type { Category } from '../hooks/useCategories';

/**
 * AI语义识别自动分类
 * 根据用户输入的内容，通过AI分析语义，自动匹配最合适的分类标签。
 * 如果用户已经手动选择了标签（selectedCategory），则跳过AI分类。
 * 按照 files.md 设计理念，AI通过分析输出内容进行语义识别自动归类。
 */
export async function aiClassifyContent(
  content: string,
  categories: Category[],
  selectedCategory?: string | null
): Promise<string | null> {
  // 如果用户已手动选择了标签，AI不干涉
  if (selectedCategory) {
    return null;
  }

  const config = getAIConfig();
  if (!config || !config.enabled) {
    return null;
  }

  // 构建分类选项说明
  const categoryOptions = categories.map(c => {
    const label = c.label && c.label.startsWith('custom_')
      ? (c.id.startsWith('custom_') ? c.id.slice(7) : c.label.slice(7))
      : c.label;
    return `- ${c.id}: ${label}`;
  }).join('\n');

  const systemPrompt = `你是一个智能分类助手。请根据用户输入的内容，从以下分类中选择最合适的1个分类ID。

分类选项：
${categoryOptions}

规则：
1. 只返回分类ID，不要返回其他内容
2. 如果内容明显属于某个分类，返回该分类的ID
3. 如果不确定，返回 "chat"（收集箱）
4. 注意：todo 分类用于待办事项，idea 用于灵感想法，journal 用于日记，note 用于笔记`;

  const userPrompt = `请对以下内容进行分类：\n${content}`;

  try {
    const result = await sendStreamAndGetContent(
      [
        { role: 'system', content: systemPrompt, timestamp: new Date().toISOString() },
        { role: 'user', content: userPrompt, timestamp: new Date().toISOString() },
      ],
      config
    );

    const cleaned = result.trim().toLowerCase();
    
    // 检查返回的ID是否在有效分类中
    const validIds = categories.map(c => c.id.toLowerCase());
    if (validIds.includes(cleaned)) {
      return categories.find(c => c.id.toLowerCase() === cleaned)?.id || null;
    }

    // 如果AI返回了多余文本，尝试提取分类ID
    for (const c of categories) {
      if (cleaned.includes(c.id.toLowerCase())) {
        return c.id;
      }
    }

    return null;
  } catch {
    return null;
  }
}
