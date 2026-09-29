/**
 * 心光 v2.4.2 独立文档库核心逻辑测试
 * 覆盖：重名冲突命名、缓存格式兼容解析、文档路径拼接
 */
import { describe, it, expect } from 'vitest';
import { pickDocFileName, parseCachedResult, buildDocPath } from '../src/lib/nutstore';

describe('pickDocFileName 重名冲突命名', () => {
  it('无冲突时保留原文件名', () => {
    expect(pickDocFileName('笔记.md', [])).toBe('笔记.md');
    expect(pickDocFileName('a.txt', ['b.md'])).toBe('a.txt');
  });

  it('重名时追加序号，且跳过已占用的序号', () => {
    expect(pickDocFileName('笔记.md', ['笔记.md'])).toBe('笔记(2).md');
    expect(pickDocFileName('笔记.md', ['笔记.md', '笔记(2).md'])).toBe('笔记(3).md');
    expect(pickDocFileName('笔记.md', ['笔记.md', '笔记(3).md'])).toBe('笔记(2).md');
  });

  it('保留扩展名，无扩展名与多点文件名正确处理', () => {
    expect(pickDocFileName('a.txt', ['a.txt'])).toBe('a(2).txt');
    expect(pickDocFileName('无扩展名', ['无扩展名'])).toBe('无扩展名(2)');
    expect(pickDocFileName('a.b.md', ['a.b.md'])).toBe('a.b(2).md');
  });

  it('本批已用名参与冲突检测（模拟批量导入）', () => {
    const used: string[] = [];
    const first = pickDocFileName('同名.md', ['同名.md']);
    expect(first).toBe('同名(2).md');
    used.push(first);
    expect(pickDocFileName('同名.md', ['同名.md', ...used])).toBe('同名(3).md');
  });
});

describe('parseCachedResult 缓存格式兼容', () => {
  it('空值与非法 JSON 返回空结果', () => {
    expect(parseCachedResult(null)).toEqual({ entries: [], documents: [] });
    expect(parseCachedResult('not-json')).toEqual({ entries: [], documents: [] });
  });

  it('兼容 v2.4.2 前的数组格式（旧缓存）', () => {
    const old = JSON.stringify([{ id: '1', content: '测试', type: 'chat', date: '2026-09-01' }]);
    const parsed = parseCachedResult(old);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.documents).toEqual([]);
  });

  it('解析 v2.4.2 新格式 { entries, documents }', () => {
    const payload = {
      entries: [{ id: '1' }],
      documents: [{ fileName: 'a.md', path: '/文档/a.md', content: 'x' }],
    };
    const parsed = parseCachedResult(JSON.stringify(payload));
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.documents).toHaveLength(1);
    expect(parsed.documents[0].fileName).toBe('a.md');
  });

  it('字段缺失或类型错误时降级为空数组', () => {
    expect(parseCachedResult('{"entries":null,"documents":"bad"}')).toEqual({ entries: [], documents: [] });
  });
});

describe('buildDocPath 路径拼接', () => {
  it('拼接《文档》目录路径', () => {
    expect(buildDocPath('', 'a.md')).toBe('/文档/a.md');
    expect(buildDocPath('/xinguang', 'a.md')).toBe('/xinguang/文档/a.md');
  });
});
