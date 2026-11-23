export interface FrontmatterSplit {
  /**
   * Raw frontmatter including its `---` delimiters (e.g. `"---\nname: x\n---"`),
   * or null when the document has no frontmatter.
   */
  frontmatter: string | null
  /** Everything after the frontmatter block. */
  body: string
}

/**
 * Splits a leading YAML frontmatter block (`---` delimited) from the rest of
 * a Markdown document. Unterminated frontmatter is treated as regular content.
 */
export const splitFrontmatter = (md: string): FrontmatterSplit => {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: null, body: md }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '---' || line === '...') {
      return {
        frontmatter: lines.slice(0, i + 1).join('\n'),
        body: lines.slice(i + 1).join('\n'),
      }
    }
  }

  return { frontmatter: null, body: md }
}

/**
 * Renders frontmatter as a `yaml` code fence so it survives a Tiptap
 * parse/serialize round trip (Tiptap has no frontmatter node, and raw `---`
 * delimiters would be mangled into thematic breaks and paragraphs).
 */
export const withFrontmatterAsCodeFence = (md: string): string => {
  const { frontmatter, body } = splitFrontmatter(md)
  if (!frontmatter) {
    return md
  }
  return '```yaml\n' + frontmatter + '\n```\n\n' + body
}

/**
 * Inverse of `withFrontmatterAsCodeFence`: converts a leading `yaml` code
 * fence back into `---` delimited frontmatter. Returns the input unchanged
 * when it does not start with a `yaml` fence.
 */
export const restoreFrontmatterFromCodeFence = (md: string): string => {
  const match = /^```yaml\n([\s\S]*?)\n?```(?:\n\n|\n|$)/.exec(md)
  if (!match) {
    return md
  }
  return match[1] + '\n\n' + md.slice(match[0].length)
}
